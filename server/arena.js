'use strict';

// Node port of pvp_arena.py. Collision, spawns and bot navigation are derived
// from the same imported voxel asset the browser renders.
const fs = require('node:fs');
const path = require('node:path');
const STEP = 1 / 20;
const MAP = { floorY: 8, min: -16, max: 16, wallHeight: 6, obstacles: [[-2, 8, -1, 2, 11, 1]] };
const KIT = 'diamond_sword';
const round = (n, digits = 1) => Number(n.toFixed(digits));
const finite = n => typeof n === 'number' && Number.isFinite(n);
const control = () => ({ strafe: 0, forward: 0, jump: false, sprint: false, use: false });
const flat = (p, point) => Math.hypot(p.x - point[0], p.z - point[1]);
const wrap = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const WEAPONS = {};
for (const [id, values] of Object.entries({
    glock: [0, 25, .28, 30, 20, 120, 2.2, 'Glock-18', false, .0035, .005, 3.6, .55, .94],
    deagle: [700, 42, .42, 34, 7, 35, 2.2, 'Desert Eagle', false, .002, .018, 2.5, .80, .97],
    mp5: [1500, 23, .11, 28, 30, 120, 2.5, 'MP5', true, .004, .006, 3, .60, .92],
    ak47: [2700, 35, .11, 85, 30, 90, 2.5, 'AK-47', true, .012, .038, 4, .78, .98],
    m4a1: [2900, 33, .12, 40, 30, 90, 2.5, 'M4A1', true, .0015, .008, 3.5, .72, .98],
    awp: [4750, 105, 1.15, 52, 10, 30, 3.5, 'AWP', false, .0005, .025, 2, .95, .99]
})) WEAPONS[id] = Object.fromEntries(['cost', 'damage', 'cooldown', 'range', 'magazine', 'reserve', 'reload', 'name', 'automatic', 'spread', 'recoil', 'headshotMultiplier', 'armorMultiplier', 'rangeModifier'].map((key, i) => [key, values[i]]));

const source = fs.readFileSync(path.join(__dirname, '../js/de_eblan2.js'), 'utf8');
const data = JSON.parse(source.slice(source.indexOf('{"id"')).trim().replace(/;$/, ''));
const levels = new Map(), columns = new Map(), nav = new Map();
for (const [key, pairs] of Object.entries(data.chunks)) {
    const [cx, cz] = key.split(',').map(Number);
    for (let i = 0; i < pairs.length; i += 2) {
        if (!pairs[i + 1]) continue;
        const index = pairs[i], x = cx * 16 + index % 16, z = cz * 16 + Math.floor(index / 512), y = Math.floor(index / 16) % 32;
        const k = `${x},${z}`;
        if (!levels.has(k)) levels.set(k, new Set());
        levels.get(k).add(y);
    }
}
const boxes = [];
for (const [key, ys] of levels) {
    const [x, z] = key.split(',').map(Number), runs = [];
    for (const y of [...ys].sort((a, b) => a - b)) {
        if (runs.length && runs.at(-1)[4] === y) runs.at(-1)[4] = y + 1;
        else runs.push([x, y, z, x + 1, y + 1, z + 1]);
        if (!ys.has(y + 1) && !ys.has(y + 2)) nav.set(`${x},${y + 1},${z}`, [x, y + 1, z]);
    }
    columns.set(key, runs); boxes.push(...runs);
}
// Collision and rays follow carved pixels; navigation uses their actual tops.
if (data.chunkDesigns) {
    const carved = new Map();
    for (const [key, pairs] of Object.entries(data.chunkDesigns)) {
        const [cx, cz] = key.split(',').map(Number);
        for (let i = 0; i < pairs.length; i += 2) {
            const index = pairs[i], x = cx * 16 + index % 16;
            const y = Math.floor(index / 16) % 32, z = cz * 16 + Math.floor(index / 512);
            const cells = new Set(data.designs[pairs[i + 1]].cells), bounds = [];
            for (const cell of [...cells].sort((a, b) => a - b)) {
                if (!cells.has(cell)) continue;
                const px = cell % 8, py = Math.floor(cell / 8) % 8, pz = Math.floor(cell / 64);
                let ex = px + 1, ey = py + 1, ez = pz + 1;
                while (ex < 8 && cells.has(ex + 8 * py + 64 * pz)) ex++;
                const row = (yy, zz) => {
                    for (let xx = px; xx < ex; xx++) if (!cells.has(xx + 8 * yy + 64 * zz)) return false;
                    return true;
                };
                while (ey < 8 && row(ey, pz)) ey++;
                while (ez < 8 && Array.from({ length: ey - py }, (_, j) => py + j).every(yy => row(yy, ez))) ez++;
                for (let zz = pz; zz < ez; zz++) for (let yy = py; yy < ey; yy++) for (let xx = px; xx < ex; xx++) cells.delete(xx + 8 * yy + 64 * zz);
                bounds.push([x + px / 8, y + py / 8, z + pz / 8, x + ex / 8, y + ey / 8, z + ez / 8]);
            }
            carved.set(`${x},${y},${z}`, bounds);
        }
    }
    boxes.length = 0;
    for (const [key, ys] of levels) {
        const [x, z] = key.split(',').map(Number), bounds = [];
        for (const y of ys) bounds.push(...(carved.get(`${x},${y},${z}`) || [[x, y, z, x + 1, y + 1, z + 1]]));
        columns.set(key, bounds); boxes.push(...bounds);
    }
}
// A block containing a floor pixel is not a full-height floor. Keep X/Z on
// the navigation grid, but use exact supported heights and player headroom.
nav.clear();
const navColumns = new Map();
for (const [key, bounds] of columns) {
    const [x, z] = key.split(',').map(Number), cx = x + .5, cz = z + .5;
    const candidates = new Set(bounds.filter(b => b[0] < cx + .3 && b[3] > cx - .3 && b[2] < cz + .3 && b[5] > cz - .3).map(b => b[4]));
    const obstacles = nearby(cx, cz);
    for (const y of [...candidates].sort((a, b) => a - b)) {
        if (obstacles.some(b => cx + .3 > b[0] && cx - .3 < b[3] && cz + .3 > b[2] && cz - .3 < b[5] && y < b[4] && y + 1.8 > b[1])) continue;
        const node = [x, y, z];
        nav.set(node.join(','), node);
        if (!navColumns.has(key)) navColumns.set(key, []);
        navColumns.get(key).push(node);
    }
}
function nearest(cost) {
    let best, score = Infinity;
    for (const n of nav.values()) { const value = cost(n); if (value < score) { best = n; score = value; } }
    return best;
}
function point(x, z) {
    const n = nearest(n => (n[0] - x) ** 2 + (n[2] - z) ** 2 + Math.max(0, n[1] - 12) ** 2 * 4);
    return [n[0] + .5, n[1], n[2] + .5];
}
const sites = { A: point(45, -40), B: point(-50, -40) };
const DUST2_MAP = { id: 'de_eblan2', floorY: 0, min: -85, max: 85, wallHeight: 0, movement: 'walk', obstacles: boxes,
    sites: Object.fromEntries(Object.entries(sites).map(([k, p]) => [k, [p[0], p[2]]])),
    siteHeights: Object.fromEntries(Object.entries(sites).map(([k, p]) => [k, p[1]])),
    spawns: { T: [-2, 0, 2].map(o => point(o, 55)), CT: [-2, 0, 2].map(o => point(o, 20)) } };
function nearby(x, z) {
    const result = [];
    for (let ix = Math.floor(x - .3); ix <= Math.floor(x + .3); ix++) {
        for (let iz = Math.floor(z - .3); iz <= Math.floor(z + .3); iz++) result.push(...(columns.get(`${ix},${iz}`) || []));
    }
    return result;
}
function rayBox(origin, direction, bounds, reach) {
    let near = 0, far = reach;
    for (let i = 0; i < 3; i++) {
        if (Math.abs(direction[i]) < 1e-9) { if (origin[i] < bounds[i] || origin[i] > bounds[i + 3]) return null; }
        else {
            const a = (bounds[i] - origin[i]) / direction[i], b = (bounds[i + 3] - origin[i]) / direction[i];
            near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
            if (near > far) return null;
        }
    }
    return near;
}
function obstacleDistance(origin, direction, distance) {
    const visited = new Set(); let best = null;
    for (let i = 0; i <= Math.ceil(distance * 2); i++) {
        const t = Math.min(distance, i * .5);
        if (best !== null && t > best + 1) break;
        const key = `${Math.floor(origin[0] + direction[0] * t)},${Math.floor(origin[2] + direction[2] * t)}`;
        if (visited.has(key)) continue;
        visited.add(key);
        for (const b of columns.get(key) || []) {
            const hit = rayBox(origin, direction, b, distance);
            if (hit !== null && (best === null || hit < best)) best = hit;
        }
    }
    return best;
}

class ArenaRoom {
    constructor(name, dust = false) {
        this.name = name; this.clients = new Map(); this.dust = dust;
        if (dust) Object.assign(this, { players: new Map(), phase: 'buy', deadline: 0, round_number: 0,
            score: { T: 0, CT: 0 }, target_site: 'A', bomb_carrier: null, bomb_position: null,
            bomb_planted_at: null, bomb_site: null, objective_actor: null, objective_started_at: null,
            last_result: null, match_complete: false });
    }
    remove_client(id) {
        const p = this.clients.get(id); this.clients.delete(id); this.players?.delete(id);
        if (p && this.dust && this.clients.size && this.onHumanLeave) {
            this.onHumanLeave(p);
            return p;
        }
        if (this.bomb_carrier === id) { this.bomb_carrier = null; if (p) this.bomb_position = [p.x, p.z]; }
        return p;
    }
    broadcast(message, exclude) { for (const p of this.clients.values()) if (p.id !== exclude && !p.is_closed) p.send_json(message); }
    state(now) {
        const planted = this.bomb_planted_at !== null, action = this.objective_actor === null ? null : (planted ? 'defuse' : 'plant');
        const duration = planted ? 5 : 3, elapsed = this.objective_started_at === null ? 0 : Math.max(0, now - this.objective_started_at);
        return { phase: this.phase, remaining: Math.max(0, round(this.deadline - now)), round: this.round_number,
            score: { ...this.score }, sideSwapRound: 7, result: this.last_result,
            bomb: { status: planted ? 'planted' : this.bomb_carrier ? 'carried' : this.bomb_position ? 'dropped' : 'idle',
                carrierId: this.bomb_carrier, position: this.bomb_position || DUST2_MAP.sites[this.bomb_site] || null,
                site: this.bomb_site, actor: this.objective_actor, action, progress: action ? Math.min(1, elapsed / duration) : 0,
                actionRemaining: action ? Math.max(0, round(duration - elapsed)) : null,
                remaining: planted ? Math.max(0, round(40 - (now - this.bomb_planted_at))) : null } };
    }
}

class ArenaService {
    constructor(clock = () => Date.now() / 1000) { this.clock = clock; this.rooms = new Map(); }
    state(p) {
        return { id: p.id, name: p.name, position: { x: p.x, y: p.y, z: p.z }, velocity: { x: p.vx, y: p.vy, z: p.vz },
            yaw: p.yaw, pitch: p.pitch, health: p.health, alive: p.is_alive, heldItem: KIT,
            isWalking: Math.abs(p.vx) + Math.abs(p.vz) > .1, isSprinting: p.arena_input.sprint,
            onGround: p.on_ground, seq: p.input_seq, jumpHeld: p.jump_held, spawn: p.spawn_id };
    }
    dustState(p, now = this.clock()) {
        return { ...this.state(p), team: p.team, bot: !!p.is_bot, money: p.money, armor: p.armor, heldItem: p.weapon,
            primary: p.primary, secondary: p.secondary, slot: p.weapon === p.primary ? 1 : 2, kills: p.kills, deaths: p.deaths,
            ammo: p.ammo, reserveAmmo: p.reserve_ammo, reloading: p.reload_until !== null,
            reloadRemaining: p.reload_until !== null ? Math.max(0, round(p.reload_until - now, 2)) : 0,
            hasBomb: p.id === p.room.bomb_carrier, objective: p.objective };
    }
    spawn(p, now) {
        const others = [...p.room.clients.values()].filter(o => o !== p && o.is_alive);
        const spots = [[-10, -10], [10, 10], [-10, 10], [10, -10], [0, -12], [0, 12]];
        spots.sort((a, b) => Math.min(...others.map(o => (b[0] - o.x) ** 2 + (b[1] - o.z) ** 2), Infinity) - Math.min(...others.map(o => (a[0] - o.x) ** 2 + (a[1] - o.z) ** 2), Infinity));
        Object.assign(p, { x: spots[0][0], y: MAP.floorY, z: spots[0][1], vx: 0, vy: 0, vz: 0, health: 100,
            is_alive: true, on_ground: true, yaw: 0, pitch: 0, invulnerable_until: now + 1.5, last_attack_time: now,
            dead_since: null, last_input_time: now, attack_pending: false, arena_input: control(), jump_held: false,
            spawn_id: (p.spawn_id || 0) + 1, held_item: KIT });
    }
    collides(x, y, z, map = MAP) {
        if (x - .3 < map.min + 1 || x + .3 > map.max - (map === DUST2_MAP ? 1 : 0) ||
            z - .3 < map.min + 1 || z + .3 > map.max - (map === DUST2_MAP ? 1 : 0)) return true;
        return (map === DUST2_MAP ? nearby(x, z) : map.obstacles).some(([a, b, c, d, e, f]) =>
            x + .3 > a && x - .3 < d && y + 1.8 > b && y < e && z + .3 > c && z - .3 < f);
    }
    integrate(p, map) {
        // Sweep in increments smaller than a carved pixel to avoid skipping
        // thin walls and stair treads at server tick speeds.
        const count = map === DUST2_MAP ? Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vz), Math.abs(p.vy) + 22 * STEP) * STEP / .1)) : 1;
        const dt = STEP / count;
        for (let i = 0; i < count; i++) {
            p.vy = Math.max(-30, p.vy - 22 * dt);
            const moveAxis = axis => {
                const next = p[axis] + p['v' + axis] * dt;
                const x = axis === 'x' ? next : p.x, z = axis === 'z' ? next : p.z;
                if (!this.collides(x, p.y, z, map)) { p[axis] = next; return; }
                if (map === DUST2_MAP && p.on_ground) {
                    for (let rise = .125; rise <= .5; rise += .125) {
                        if (!this.collides(p.x, p.y + rise, p.z, map) && !this.collides(x, p.y + rise, z, map)) {
                            p[axis] = next; p.y += rise; return;
                        }
                    }
                }
                p['v' + axis] = 0;
            };
            moveAxis('x'); moveAxis('z');
            const ny = p.y + p.vy * dt;
            if (ny <= map.floorY) { p.y = map.floorY; p.vy = 0; p.on_ground = true; }
            else if (!this.collides(p.x, ny, p.z, map)) { p.y = ny; p.on_ground = false; }
            else {
                if (p.vy < 0) {
                    const tops = (map === DUST2_MAP ? nearby(p.x, p.z) : map.obstacles)
                        .filter(b => b[0] - .3 < p.x && p.x < b[3] + .3 && b[2] - .3 < p.z && p.z < b[5] + .3 && b[4] <= p.y && b[4] >= ny).map(b => b[4]);
                    p.y = tops.length ? Math.max(...tops) : p.y; p.on_ground = true;
                }
                p.vy = 0;
            }
        }
    }
    move(p, now, dust = false) {
        if (!p.is_alive) { p.vx = p.vy = p.vz = 0; return; }
        const fresh = p.is_bot || now - p.last_input_time <= .25, c = p.arena_input;
        let sx = fresh ? c.strafe : 0, fw = fresh ? c.forward : 0;
        const length = Math.max(1, Math.hypot(sx, fw));
        if (length) { sx /= length; fw /= length; }
        const wx = sx * Math.cos(p.yaw) - fw * Math.sin(p.yaw), wz = -sx * Math.sin(p.yaw) - fw * Math.cos(p.yaw);
        const jump = fresh && c.jump;
        if (jump && !p.jump_held && p.on_ground) { p.vy = 8.5; p.on_ground = false; }
        const speed = c.sprint ? (dust ? 7.2 : 7.5) : 4.5;
        p.vx = wx * speed; p.vz = wz * speed;
        p.jump_held = jump; this.integrate(p, dust ? DUST2_MAP : MAP);
    }
    attack(p, room, now) {
        if (!p.attack_pending) return;
        p.attack_pending = false;
        if (!p.is_alive || now - p.last_attack_time < .55 || now - p.last_input_time > .25) return;
        p.last_attack_time = now;
        const origin = [p.x, p.y + 1.62, p.z], direction = [-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)];
        const hits = [];
        for (const t of room.clients.values()) {
            if (t === p || !t.is_alive) continue;
            const d = rayBox(origin, direction, [t.x - .3, t.y, t.z - .3, t.x + .3, t.y + 1.8, t.z + .3], 3.5);
            if (d !== null) hits.push([d, t]);
        }
        hits.sort((a, b) => a[0] - b[0]);
        if (!hits.length) return;
        const [d, t] = hits[0];
        if (MAP.obstacles.some(b => rayBox(origin, direction, b, d) !== null) || now < t.invulnerable_until) return;
        t.health = Math.max(0, t.health - 18); t.invulnerable_until = now + .4;
        if (!t.health) { t.is_alive = false; t.dead_since = now; }
        return { type: 'arena_hit', attackerId: p.id, targetId: t.id, damage: 18, health: t.health, alive: t.is_alive };
    }
    newDust(p, team, now) {
        Object.assign(p, { team, is_bot: !!p.is_bot, money: 800, losses: 0, armor: false, primary: null, secondary: 'glock', weapon: 'glock',
            kills: 0, deaths: 0, shots_fired: 0, burst_count: 0, weapon_ammo: {}, target_id: null, target_seen_at: null,
            x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, health: 100, is_alive: false, on_ground: true, yaw: 0, pitch: 0,
            input_seq: -1, jump_held: false, spawn_id: 0, dead_since: now, last_attack_time: -Infinity, last_input_time: now,
            attack_pending: false, objective: 'spectating', arena_input: control() });
        this.refill(p);
    }
    refill(p) { const s = WEAPONS[p.weapon]; p.ammo = s.magazine; p.reserve_ammo = s.reserve; p.reload_until = null; this.store(p); }
    store(p) { p.weapon_ammo[p.weapon] = [p.ammo, p.reserve_ammo]; }
    createBot(room, team, now, slot) {
        room.bot_serial = (room.bot_serial || 0) + 1;
        const p = { id: `bot_${room.round_number}_${team}_${room.bot_serial}`, name: `${team}-BOT ${slot + 1}`, slot,
            is_bot: true, is_closed: false, room, route_key: null, route: [], route_index: 0, send_json() {} };
        this.newDust(p, team, now); room.players.set(p.id, p);
        return p;
    }
    transferSlot(room, from, to, now) {
        // Transfer game state only; socket identity and validated input remain
        // owned by the joining human or newly created bot.
        for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'health', 'is_alive', 'on_ground', 'yaw', 'pitch',
            'money', 'armor', 'primary', 'secondary', 'weapon', 'ammo', 'reserve_ammo', 'reload_until',
            'kills', 'deaths', 'losses', 'dead_since', 'objective', 'slot', 'invulnerable_until', 'shots_fired',
            'last_attack_time', 'burst_count', 'last_hit_at', 'last_hit_by']) {
            if (from[key] !== undefined) to[key] = from[key];
        }
        to.weapon_ammo = Object.fromEntries(Object.entries(from.weapon_ammo).map(([key, ammo]) => [key, [...ammo]]));
        to.arena_input = control(); to.jump_held = false; to.attack_pending = false;
        to.last_input_time = now; to.spawn_id++; to.route_key = null;
        if (room.bomb_carrier === from.id) room.bomb_carrier = to.id;
        if (room.objective_actor === from.id) room.objective_actor = room.objective_started_at = null;
    }
    ensureBots(room, now) {
        for (const team of ['T', 'CT']) {
            const humans = [...room.clients.values()].filter(p => p.team === team && !p.is_closed);
            const wanted = Math.max(0, 3 - humans.length), bots = [...room.players.values()].filter(p => p.is_bot && p.team === team);
            for (const p of bots.slice(wanted)) room.players.delete(p.id);
            for (let i = bots.length; i < wanted; i++) {
                const used = new Set([...room.players.values()].filter(p => p.team === team).map(p => p.slot));
                let slot = 0; while (used.has(slot)) slot++;
                this.createBot(room, team, now, slot);
            }
        }
    }
    spawnDust(p, now, slot) {
        if (!p.is_alive) { p.armor = false; p.primary = null; p.secondary = p.weapon = 'glock'; }
        const [x, y, z] = DUST2_MAP.spawns[p.team][slot % 3];
        Object.assign(p, { x, y, z, slot, weapon_ammo: {}, vx: 0, vy: 0, vz: 0, health: 100, is_alive: true, on_ground: true,
            yaw: p.team === 'T' ? 0 : Math.PI, pitch: 0, jump_held: false, spawn_id: p.spawn_id + 1,
            dead_since: null, last_attack_time: now - 1, attack_pending: false, last_input_time: now, objective: 'buy',
            burst_count: 0, target_id: null, target_seen_at: null, arena_input: control() });
        for (const weapon of [p.primary, p.secondary]) if (weapon) p.weapon_ammo[weapon] = [WEAPONS[weapon].magazine, WEAPONS[weapon].reserve];
        this.refill(p); if (p.is_bot) { p.route_key = null; p.progress_position = null; p.progress_at = now; p.next_jump_at = now; }
    }
    botBuy(p) {
        const choice = p.team === 'T' ? 'ak47' : 'm4a1';
        if (p.primary) this.equip(p, 1);
        else if (p.money >= WEAPONS[choice].cost + 650) { p.money -= WEAPONS[choice].cost; p.primary = p.weapon = choice; }
        else if (p.money >= WEAPONS.mp5.cost) { p.money -= WEAPONS.mp5.cost; p.primary = p.weapon = 'mp5'; }
        else if (p.secondary !== 'deagle' && p.money >= WEAPONS.deagle.cost) { p.money -= WEAPONS.deagle.cost; p.secondary = p.weapon = 'deagle'; }
        if (!p.armor && p.money >= 650) { p.money -= 650; p.armor = true; }
    }
    beginRound(room, now) {
        if (room.match_complete) {
            room.match_complete = false; room.round_number = 0; room.score = { T: 0, CT: 0 };
            for (const p of room.players.values()) Object.assign(p, { money: 800, losses: 0, kills: 0, deaths: 0, is_alive: false });
        }
        if (room.round_number === 6) {
            room.score = { T: room.score.CT, CT: room.score.T };
            for (const p of room.players.values()) Object.assign(p, { team: p.team === 'T' ? 'CT' : 'T', money: 800, losses: 0, is_alive: false });
        }
        room.round_number++; room.target_site = room.round_number % 2 ? 'A' : 'B';
        this.ensureBots(room, now); const slots = { T: 0, CT: 0 };
        for (const p of room.players.values()) this.spawnDust(p, now, slots[p.team]++);
        const terrorists = [...room.players.values()].filter(p => p.team === 'T');
        room.bomb_carrier = (terrorists.find(p => !p.is_bot) || terrorists[0]).id;
        for (const k of ['bomb_position', 'bomb_planted_at', 'bomb_site', 'objective_actor', 'objective_started_at', 'last_result']) room[k] = null;
        room.phase = 'buy'; room.deadline = now + 10;
        for (const p of room.players.values()) if (p.is_bot) { this.botBuy(p); this.refill(p); }
    }
    endRound(room, winner, reason, now) {
        if (room.phase === 'post') return;
        room.score[winner]++;
        for (const p of room.players.values()) {
            if (p.team === winner) { p.money = Math.min(16000, p.money + (reason === 'bomb' ? 3500 : 3250)); p.losses = 0; }
            else { p.losses = Math.min(4, p.losses + 1); p.money = Math.min(16000, p.money + Math.min(3400, 1400 + (p.losses - 1) * 500)); }
        }
        Object.assign(room, { last_result: { winner, reason }, phase: 'post', deadline: now + 6,
            objective_actor: null, objective_started_at: null, match_complete: room.score[winner] >= 7 });
    }
    buy(p, item) {
        if (item === 'armor') { if (!p.armor && p.money >= 650) { p.money -= 650; p.armor = true; } return; }
        const s = Object.hasOwn(WEAPONS, item) ? WEAPONS[item] : null;
        if (!s || item === 'glock' || p.money < s.cost || (item === 'ak47' && p.team !== 'T') || (item === 'm4a1' && p.team !== 'CT') || [p.primary, p.secondary].includes(item)) return;
        this.store(p); p.money -= s.cost; p.weapon = item;
        if (['ak47', 'm4a1', 'mp5', 'awp'].includes(item)) p.primary = item; else p.secondary = item;
        this.refill(p);
    }
    equip(p, slot) {
        if (![1, 2].includes(slot) || !p.is_alive) return;
        const weapon = slot === 1 ? p.primary : p.secondary;
        if (!weapon || weapon === p.weapon) return;
        this.store(p); p.weapon = weapon;
        [p.ammo, p.reserve_ammo] = p.weapon_ammo[weapon] || [WEAPONS[weapon].magazine, WEAPONS[weapon].reserve];
        p.reload_until = null; p.attack_pending = false; p.burst_count = 0;
    }
    reload(p, room, now) {
        const s = WEAPONS[p.weapon];
        if (!['buy', 'live'].includes(room.phase) || !p.is_alive || p.reload_until !== null || p.ammo >= s.magazine || p.reserve_ammo <= 0) return;
        p.reload_until = now + s.reload; p.attack_pending = false;
    }
    die(room, p, killer, now) {
        if (!p.is_alive) return;
        Object.assign(p, { health: 0, is_alive: false, dead_since: now, objective: 'spectating', attack_pending: false, reload_until: null });
        p.deaths++;
        if (killer && killer !== p) { killer.money = Math.min(16000, killer.money + 300); killer.kills++; }
        if (room.bomb_carrier === p.id) { room.bomb_carrier = null; room.bomb_position = [p.x, p.z]; }
        if (room.objective_actor === p.id) room.objective_actor = room.objective_started_at = null;
    }
    fire(room, p, now) {
        if (!p.attack_pending) return;
        const s = WEAPONS[p.weapon];
        if (room.phase !== 'live' || !p.is_alive || (!p.is_bot && now - p.last_input_time > .25) || p.reload_until !== null || p.ammo <= 0) { p.attack_pending = false; return; }
        const elapsed = now - p.last_attack_time;
        if (elapsed < s.cooldown) return;
        p.attack_pending = false; p.burst_count = elapsed < s.cooldown * 2.5 ? Math.min(12, p.burst_count + 1) : 0;
        p.last_attack_time = now; p.ammo--; this.store(p);
        const origin = [p.x, p.y + 1.62, p.z], speed = Math.hypot(p.vx, p.vz);
        let spread = (p.arena_input.aim ? (p.weapon === 'awp' ? .0005 : s.spread * .55) : s.spread) + Math.min(1.5, speed / 7.2) * .018 + (p.on_ground ? 0 : .045) + Math.min(8, p.burst_count) * s.recoil * .45;
        if (p.is_bot) spread += .024 + Math.min(.016, p.burst_count * .004);
        p.shots_fired++;
        const angle = p.shots_fired * 2.399963 + [...p.id].reduce((sum, c) => sum + c.codePointAt(0), 0) * .17;
        const radius = spread * Math.sqrt((p.shots_fired * .618034) % 1), yaw = p.yaw + Math.cos(angle) * radius, pitch = p.pitch + Math.sin(angle) * radius;
        const direction = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)], hits = [];
        for (const t of room.players.values()) {
            if (t === p || !t.is_alive || t.team === p.team) continue;
            for (const [head, bounds] of [[true, [t.x - .27, t.y + 1.35, t.z - .27, t.x + .27, t.y + 1.8, t.z + .27]],
                [false, [t.x - .3, t.y, t.z - .3, t.x + .3, t.y + 1.35, t.z + .3]]]) {
                const d = rayBox(origin, direction, bounds, s.range);
                if (d !== null) hits.push([d, t, head]);
            }
        }
        hits.sort((a, b) => a[0] - b[0]); let hit = hits[0];
        const wall = obstacleDistance(origin, direction, s.range);
        if (wall !== null && (!hit || wall <= hit[0])) hit = null;
        const d = hit ? hit[0] : wall ?? s.range;
        room.broadcast({ type: 'arena_shot', attackerId: p.id, weapon: p.weapon,
            origin: { x: origin[0], y: origin[1], z: origin[2] },
            end: { x: origin[0] + direction[0] * d, y: origin[1] + direction[1] * d, z: origin[2] + direction[2] * d },
            ammo: p.ammo, reserveAmmo: p.reserve_ammo, spread: round(spread, 5), recoil: s.recoil });
        if (!hit) return;
        const [distance, t, headshot] = hit;
        const damage = round(s.damage * s.rangeModifier ** (distance / 10) * (headshot ? s.headshotMultiplier : 1) * (t.armor ? s.armorMultiplier : 1));
        t.health = Math.max(0, round(t.health - damage)); t.last_hit_at = now; t.last_hit_by = p.id;
        if (!t.health) this.die(room, t, p, now);
        return { type: 'arena_hit', attackerId: p.id, targetId: t.id, damage, health: t.health, alive: t.is_alive,
            killed: !t.is_alive, headshot, weapon: p.weapon, weaponName: s.name, attackerName: p.name,
            targetName: t.name, kills: p.kills, deaths: t.deaths };
    }
    route(bot, room, bombTarget) {
        const site = bot.team === 'T' ? room.target_site : bot.slot % 2 ? 'B' : 'A';
        const target = bombTarget && room.bomb_position ? room.bomb_position : DUST2_MAP.sites[site];
        const start = nearest(n => (n[0] + .5 - bot.x) ** 2 + (n[2] + .5 - bot.z) ** 2 + (n[1] - bot.y) ** 2);
        const goal = nearest(n => (n[0] + .5 - target[0]) ** 2 + (n[2] + .5 - target[1]) ** 2 + (n[1] - (DUST2_MAP.siteHeights[room.bomb_site || site] ?? 8)) ** 2);
        const queue = [start], parents = new Map([[start.join(','), null]]);
        let closest = start;
        const distance = n => (n[0] - goal[0]) ** 2 + (n[2] - goal[2]) ** 2 + (n[1] - goal[1]) ** 2;
        const pathTo = node => {
            const result = [];
            while (node) { result.push([node[0] + .5, node[2] + .5, node[1]]); node = parents.get(node.join(',')); }
            return result.reverse();
        };
        for (let i = 0; i < queue.length; i++) {
            let p = queue[i];
            if (distance(p) < distance(closest)) closest = p;
            if (p.join(',') === goal.join(',')) return pathTo(p);
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                for (const n of navColumns.get(`${p[0] + dx},${p[2] + dz}`) || []) {
                    const key = n.join(','), rise = n[1] - p[1], y = Math.max(p[1], n[1]);
                    if (rise > 1 || rise < -1.5 || parents.has(key) || this.collides(p[0] + .5, y, p[2] + .5, DUST2_MAP) ||
                        this.collides(n[0] + .5, y, n[2] + .5, DUST2_MAP) || this.collides(p[0] + .5 + dx * .5, y, p[2] + .5 + dz * .5, DUST2_MAP)) continue;
                    parents.set(key, p); queue.push(n);
                }
            }
        }
        return pathTo(closest);
    }
    think(room, p, now) {
        p.arena_input.use = false;
        if (!p.ammo) this.reload(p, room, now);
        const visible = [];
        for (const e of room.players.values()) {
            if (!e.is_alive || e.team === p.team) continue;
            const d = Math.hypot(e.x - p.x, e.z - p.z);
            if (d > WEAPONS[p.weapon].range || Math.abs(e.y - p.y) >= 1.5) continue;
            if (obstacleDistance([p.x, p.y + 1.4, p.z], d ? [(e.x - p.x) / d, 0, (e.z - p.z) / d] : [0, 0, 0], d) !== null) continue;
            const aim = Math.atan2(-(e.x - p.x), -(e.z - p.z));
            if (Math.abs(wrap(aim - p.yaw)) < 1.35 || d < 2.8 || (e.id === p.last_hit_by && now - (p.last_hit_at || 0) < 3)) visible.push([d, e]);
        }
        visible.sort((a, b) => a[0] - b[0]);
        if (visible.length) {
            const [d, e] = visible[0];
            if (p.target_id !== e.id) { p.target_id = e.id; p.target_seen_at = now; p.burst_pause_until = 0; }
            const aim = Math.atan2(-(e.x - p.x), -(e.z - p.z)), turn = wrap(aim - p.yaw), step = Math.max(-.12, Math.min(.12, turn));
            p.yaw = wrap(p.yaw + step); p.pitch = Math.atan2(e.y + .72 - (p.y + 1.62), Math.max(.1, d));
            if ((p.burst_pause_until || 0) > now) p.attack_pending = false;
            else if (p.burst_count >= (d > 10 ? 3 : 5) && WEAPONS[p.weapon].automatic) { p.burst_pause_until = now + .35; p.attack_pending = false; }
            else p.attack_pending = now - p.target_seen_at >= .44 + .06 * (p.slot % 3) && Math.abs(turn - step) < .10;
            p.objective = 'engage'; Object.assign(p.arena_input, { strafe: 0, forward: 0, jump: false, sprint: false }); return;
        }
        p.target_id = p.target_seen_at = null; p.attack_pending = false; p.burst_pause_until = 0;
        const planted = room.bomb_planted_at !== null;
        let target, label;
        if (p.team === 'T') {
            [target, label] = planted ? [room.bomb_position, 'defend bomb'] : !room.bomb_carrier ? [room.bomb_position, 'recover C4'] : [DUST2_MAP.sites[room.target_site], `plant ${room.target_site}`];
        } else [target, label] = planted ? [room.bomb_position, 'rotate / defuse'] : [DUST2_MAP.sites[p.slot % 2 ? 'B' : 'A'], 'hold site'];
        if (!target) return;
        const key = `${label}:${target[0]}:${target[1]}`;
        if (p.route_key !== key) { p.route_key = key; p.route = this.route(p, room, planted || !room.bomb_carrier); p.route_index = 0; }
        while (p.route_index < p.route.length - 1 && flat(p, p.route[p.route_index]) < .45 && Math.abs(p.y - p.route[p.route_index][2]) <= .5) p.route_index++;
        const point = p.route[p.route_index] || target, dx = point[0] - p.x, dz = point[1] - p.z;
        const forward = Math.hypot(dx, dz) > (p.route_index < p.route.length - 1 ? .1 : 1.1);
        let jump = false;
        if (forward && point.length > 2 && point[2] > p.y + .5 && p.on_ground && now >= (p.next_jump_at || 0)) {
            jump = !p.jump_held;
            if (jump) p.next_jump_at = now + 1.25;
        }
        // Recover from a blocked route using measured progress, not repeated
        // jumps against a crate or a waypoint on another level.
        if (!forward) { p.progress_at = now; p.progress_position = [p.x, p.z]; }
        else if (!p.progress_position || flat(p, p.progress_position) >= .25) {
            p.progress_at = now; p.progress_position = [p.x, p.z];
        } else if (now - p.progress_at >= 1) {
            p.route_key = null; p.progress_at = now; jump = false;
        }
        p.yaw = !forward && label === 'hold site' ? wrap((p.slot % 2 ? 1.2 : -.8) + .5 * Math.sin(now * .9 + p.slot)) : Math.atan2(-dx, -dz);
        p.pitch = 0; p.objective = label;
        Object.assign(p.arena_input, { strafe: 0, forward: forward ? 1 : 0, jump, sprint: true });
        if (p.team === 'T' && room.bomb_carrier === p.id && flat(p, DUST2_MAP.sites[room.target_site]) < 2.2) p.arena_input.use = true;
        if (p.team === 'CT' && planted && flat(p, room.bomb_position) < 2.2) p.arena_input.use = true;
    }
    objective(room, now) {
        if (!room.bomb_carrier && room.bomb_position && room.bomb_planted_at === null) {
            const p = [...room.players.values()].find(p => p.team === 'T' && p.is_alive && flat(p, room.bomb_position) < 1.5);
            if (p) { room.bomb_carrier = p.id; room.bomb_position = null; }
        }
        let actor = null, action, needed;
        const using = p => p && p.is_alive && (p.is_bot || now - p.last_input_time <= .25) && p.arena_input.use;
        if (room.bomb_planted_at === null && room.bomb_carrier) {
            const p = room.players.get(room.bomb_carrier);
            if (using(p)) for (const [site, point] of Object.entries(DUST2_MAP.sites)) {
                if (flat(p, point) < 2.2 && Math.abs(p.y - DUST2_MAP.siteHeights[site]) < 1) { actor = p; action = 'plant'; needed = 3; room.bomb_site = site; break; }
            }
        } else if (room.bomb_planted_at !== null) {
            actor = [...room.players.values()].find(p => p.team === 'CT' && using(p) && flat(p, room.bomb_position) < 2.2 && Math.abs(p.y - DUST2_MAP.siteHeights[room.bomb_site]) < 1) || null;
            action = 'defuse'; needed = 5;
        }
        if (!actor) { room.objective_actor = room.objective_started_at = null; return; }
        if (room.objective_actor !== actor.id) { room.objective_actor = actor.id; room.objective_started_at = now; return; }
        if (now - room.objective_started_at < needed) return;
        actor.money = Math.min(16000, actor.money + 300);
        if (action === 'plant') { room.bomb_carrier = null; room.bomb_position = [...DUST2_MAP.sites[room.bomb_site]]; room.bomb_planted_at = now; actor.objective = `planted ${room.bomb_site}`; }
        else this.endRound(room, 'CT', 'defuse', now);
        room.objective_actor = room.objective_started_at = null;
    }
    process(p, msg) {
        const now = this.clock(), type = msg.type;
        if (type === 'arena_join') {
            if (p.room) return;
            const name = msg.room ?? (msg.mode === 'dust2' ? 'dust2' : 'arena'), dust = msg.mode === 'dust2';
            if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(name)) return p.send_json({ type: 'arena_error', message: 'Invalid room code' });
            if (dust && msg.team !== undefined && !['T', 'CT'].includes(msg.team)) return p.send_json({ type: 'arena_error', message: 'Invalid team' });
            let room = this.rooms.get(name);
            if (!room && this.rooms.size < 64) {
                room = new ArenaRoom(name, dust); room.bot_serial = 0;
                room.onHumanLeave = old => {
                    const bot = this.createBot(room, old.team, this.clock(), old.slot ?? 0);
                    this.transferSlot(room, old, bot, this.clock());
                };
                this.rooms.set(name, room);
            }
            if (!room || room.dust !== dust || room.clients.size >= (dust ? 6 : 16)) return p.send_json({ type: 'arena_error', message: 'Arena is full' });
            const count = team => [...room.clients.values()].filter(p => p.team === team).length;
            const team = dust ? (msg.team || (count('T') <= count('CT') ? 'T' : 'CT')) : null;
            if (dust && count(team) >= 3) return p.send_json({ type: 'arena_error', message: 'Your team is full (3 players)' });
            p.arena_mode = true; p.room = room; p.name = typeof msg.name === 'string' ? msg.name.slice(0, 24).trim() || 'Player' : 'Player';
            p.input_seq = -1; p.last_chat_time = -Infinity;
            if (dust) {
                const bots = [...room.players.values()].filter(o => o.is_bot && o.team === team);
                const replacement = bots.find(o => o.is_alive) || bots[0];
                this.newDust(p, team, now); room.clients.set(p.id, p); room.players.set(p.id, p);
                if (!room.round_number) this.beginRound(room, now);
                else if (replacement) {
                    this.transferSlot(room, replacement, p, now);
                    room.players.delete(replacement.id);
                } else {
                    // A round with no living bot does not grant a fresh life.
                    this.ensureBots(room, now);
                }
                p.send_json({ type: 'arena_welcome', id: p.id, room: name, map: DUST2_MAP, kit: 'glock', mode: 'dust2',
                    players: [...room.players.values()].map(o => this.dustState(o, now)), weaponSpecs: WEAPONS, match: room.state(now) });
            } else { this.spawn(p, now); room.clients.set(p.id, p); p.send_json({ type: 'arena_welcome', id: p.id, room: name, map: MAP, kit: KIT, players: [...room.clients.values()].map(o => this.state(o)) }); }
            return;
        }
        const room = p.room;
        if (!room || this.rooms.get(room.name) !== room) return;
        if (type === 'arena_input') {
            const vals = ['strafe', 'forward', 'yaw', 'pitch'].map(k => msg[k]);
            if (!Number.isInteger(msg.seq) || msg.seq <= p.input_seq || msg.seq > 2147483647 || !vals.every(finite) ||
                Math.abs(vals[0]) > 1 || Math.abs(vals[1]) > 1 || Math.abs(vals[2]) > Math.PI || Math.abs(vals[3]) > Math.PI / 2 ||
                (msg.aim !== undefined && typeof msg.aim !== 'boolean') ||
                (room.dust ? ['jump', 'sprint', 'use'] : ['jump', 'sprint']).some(k => typeof msg[k] !== 'boolean')) return;
            p.input_seq = msg.seq; p.yaw = msg.yaw; p.pitch = msg.pitch; p.last_input_time = now;
            p.arena_input = { strafe: msg.strafe, forward: msg.forward, jump: msg.jump, sprint: msg.sprint, aim: msg.aim === true, use: room.dust ? msg.use : false };
        } else if (type === 'arena_attack') p.attack_pending = p.is_alive && (!room.dust || room.phase === 'live');
        else if (type === 'arena_respawn' && !room.dust && !p.is_alive && p.dead_since !== null && now - p.dead_since >= 2) this.spawn(p, now);
        else if (type === 'arena_chat' && typeof msg.text === 'string' && msg.text.trim() && now - p.last_chat_time >= 1) {
            p.last_chat_time = now; room.broadcast({ type: 'arena_chat', sender: p.name, text: msg.text.trim().slice(0, 256) });
        } else if (room.dust) {
            if (type === 'arena_reload') this.reload(p, room, now);
            else if (type === 'arena_equip' && ['buy', 'live'].includes(room.phase)) this.equip(p, msg.slot);
            else if (type === 'arena_buy' && room.phase === 'buy' && p.is_alive && typeof msg.item === 'string') this.buy(p, msg.item);
        }
    }
    tick() {
        const now = this.clock();
        for (const [name, room] of this.rooms) {
            for (const p of room.clients.values()) if (p.is_closed) room.remove_client(p.id);
            if (!room.clients.size) { this.rooms.delete(name); continue; }
            if (!room.dust) {
                for (const p of room.clients.values()) this.move(p, now);
                for (const p of room.clients.values()) { const hit = this.attack(p, room, now); if (hit) room.broadcast(hit); }
                room.broadcast({ type: 'arena_snapshot', players: [...room.clients.values()].map(p => this.state(p)) }); continue;
            }
            if (room.phase === 'post' && now >= room.deadline) this.beginRound(room, now);
            if (room.phase === 'buy' && now >= room.deadline) { room.phase = 'live'; room.deadline = now + 85; for (const p of room.players.values()) p.objective = 'live'; }
            if (room.phase === 'live') {
                for (const p of room.players.values()) if (p.is_bot && p.is_alive) this.think(room, p, now);
                for (const p of room.players.values()) this.move(p, now, true);
            }
            for (const p of room.players.values()) if (p.is_alive && p.reload_until !== null && now >= p.reload_until) {
                const amount = Math.min(WEAPONS[p.weapon].magazine - p.ammo, p.reserve_ammo);
                p.ammo += amount; p.reserve_ammo -= amount; p.reload_until = null; this.store(p);
            }
            if (room.phase === 'live' && room.bomb_planted_at !== null && now - room.bomb_planted_at >= 40) this.endRound(room, 'T', 'bomb', now);
            if (room.phase === 'live') {
                this.objective(room, now);
                for (const p of room.players.values()) { const event = this.fire(room, p, now); if (event) room.broadcast(event); }
                const alive = team => [...room.players.values()].some(p => p.is_alive && p.team === team);
                if (room.bomb_planted_at !== null && now - room.bomb_planted_at >= 40) this.endRound(room, 'T', 'bomb', now);
                else if (room.phase === 'live') {
                    if (!alive('T') && room.bomb_planted_at === null) this.endRound(room, 'CT', 'elimination', now);
                    else if (!alive('CT')) this.endRound(room, 'T', 'elimination', now);
                    else if (room.bomb_planted_at === null && now >= room.deadline) this.endRound(room, 'CT', 'time', now);
                }
            }
            room.broadcast({ type: 'arena_snapshot', players: [...room.players.values()].map(p => this.dustState(p, now)), match: room.state(now) });
        }
    }
}
module.exports = { ArenaService, ArenaRoom, MAP, DUST2_MAP, WEAPONS, rayBox, obstacleDistance };

#!/usr/bin/env node
'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');
const { AuthorityWorld } = require('./server/engine');
const { ArenaService } = require('./server/arena');

const ROOT = __dirname;
const WEAPON_DAMAGE = {
    fist: 5, wood_pickaxe: 6, stone_pickaxe: 9, iron_pickaxe: 12, diamond_pickaxe: 16,
    netherite_pickaxe: 20, eblan_pickaxe: 28, wood_sword: 18, stone_sword: 24,
    iron_sword: 30, diamond_sword: 36, netherite_sword: 42, eblan_sword: 55,
    ak47: 24, m4a1: 22, awp: 62, shotgun: 42, deagle: 35, glock: 15, mp5: 17,
    rpg: 65, grenade: 45
};
const DUEL_KITS = {
    classic: { item: 'diamond_sword', damage: 30, cooldown: .55, armor: .2 },
    shawarma: { item: null, damage: 12, cooldown: .3, armor: 0 }
};
const DUEL_MAP = { floorY: 5, min: -18, max: 18, wallHeight: 5, obstacles: [] };
const finite = v => typeof v === 'number' && Number.isFinite(v);
const round = (v, n = 1) => Number(v.toFixed(n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const clean = (s, size, fallback = '') => typeof s === 'string' ? s.slice(0, size).trim() || fallback : fallback;
let nextId = 1000;
const ACTION_LIMITS = {
    blocks: { player: [8, 12], room: [32, 80] },
    explosives: { player: [8, 2], room: [16, 4] },
    chunks: { player: [8, 20], room: [32, 100] }
};
const MAX_CHAIN_EXPLOSIVES = 16;
const MAX_BLASTS_PER_TICK = 8;

class GameRoom {
    constructor(name, mode = 'survival') {
        this.name = name;
        this.cooperative = name.startsWith('coop_');
        this.mode = mode === 'creative' ? 'creative' : 'survival';
        this.seed = crypto.createHash('sha256').update(name).digest().readUInt32BE() % 899999 + 100000;
        this.clients = new Map();
        this.blocks = new Map();
        this.tnt = new Map();
        this.actionBuckets = new Map();
        this.lastActive = Date.now();
        this.engine = null;
    }
    world() { return this.engine ||= new AuthorityWorld(this.seed, this.cooperative ? {} : { arenaMap: { floorY: 5, min: -48, max: 48, wallHeight: 0, obstacles: [] } }); }
    remove_client(id) { const c = this.clients.get(id); this.clients.delete(id); this.lastActive = Date.now(); return c; }
    broadcast(message, exclude) {
        for (const c of this.clients.values()) if (c.id !== exclude) c.send_json({ ...message, room: this.name });
    }
}

class WSClient {
    constructor(socket, server) {
        this.socket = socket;
        this.server = server;
        Object.assign(this, { id: `p_${++nextId}`, room: null, name: 'Боєць', skin: 'classic',
            x: 0, y: 32, z: 0, yaw: 0, pitch: 0, health: 100, max_health: 100,
            is_alive: true, is_closed: false, invulnerable_until: 0, last_attack_time: 0,
            held_item: null, inventory: Array(27).fill(null), selected_slot: 0,
            armor_reduction: .68, arena_mode: false, packet_times: [], last_move_time: Date.now() / 1000 });
        this.actionBuckets = new Map();
        this.movementCredit = .5;
    }
    send_json(message) {
        if (!this.socket || this.is_closed) return;
        if (this.socket.bufferedAmount > 4 * 1024 * 1024) return this.close();
        if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    }
    close() {
        if (this.is_closed) return;
        this.is_closed = true;
        this.server.leave(this);
        this.server.clients.delete(this);
        this.socket?.terminate();
    }
}

class AuthoritativeGameServer {
    constructor({ clock = () => Date.now() / 1000 } = {}) {
        this.clock = clock;
        this.rooms = new Map();
        this.clients = new Set();
        this.duel_queue = [];
        this.arena = new ArenaService(clock);
        this.timers = new Set();
        this.pendingExplosions = [];
    }
    allowAction(client, room, key) {
        const now = this.clock(), rule = ACTION_LIMITS[key], buckets = [];
        for (const [owner, [capacity, rate]] of [[client, rule.player], [room, rule.room]]) {
            let bucket = owner.actionBuckets.get(key);
            if (!bucket) { bucket = { tokens: capacity, at: now }; owner.actionBuckets.set(key, bucket); }
            bucket.tokens = Math.min(capacity, bucket.tokens + Math.max(0, now - bucket.at) * rate);
            bucket.at = now; buckets.push(bucket);
        }
        if (buckets.some(bucket => bucket.tokens < 1)) return false;
        for (const bucket of buckets) bucket.tokens--;
        return true;
    }
    queueExplosion(room, source, tnt) {
        if (tnt.queued || !room.tnt.has(tnt.id)) return;
        tnt.queued = true;
        this.pendingExplosions.push({ room, source, tnt });
    }
    later(fn, ms) {
        const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, ms);
        timer.unref(); this.timers.add(timer); return timer;
    }
    get_or_create_room(name, mode) {
        if (!this.rooms.has(name)) {
            if (this.canCreateRoom && !this.canCreateRoom(name)) return null;
            if (this.rooms.size >= 64) return null;
            this.rooms.set(name, new GameRoom(name, mode));
        }
        return this.rooms.get(name);
    }
    remove_from_duel_queue(client) { this.duel_queue = this.duel_queue.filter(q => q.client !== client && !q.client.is_closed); }
    leave(client) {
        this.remove_from_duel_queue(client);
        const room = client.room;
        if (!room) return;
        if (room.name.startsWith('duel_')) {
            const other = [...room.clients.values()].find(p => p !== client && !p.is_closed);
            if (other) this.finish_duel(room, other, client, `${client.name} покинув арену.`);
        }
        room.remove_client(client.id);
        room.broadcast({ type: 'player_left', id: client.id, name: client.name });
        if (room.name.startsWith('duel_') && !room.clients.size) this.rooms.delete(room.name);
        client.room = null;
        client.arena_mode = false;
    }
    player(client) {
        const keys = ['id', 'name', 'skin', 'x', 'y', 'z', 'yaw', 'pitch', 'health', 'held_item', 'is_alive'];
        return Object.fromEntries(keys.map(k => [k, client[k]]));
    }
    enqueue_duel(client, nick, kit) {
        if (!Object.hasOwn(DUEL_KITS, kit) || client.room?.name !== 'pvp_arena') {
            return client.send_json({ type: 'duel_error', message: 'Цей формат дуелі недоступний.' });
        }
        this.duel_queue = this.duel_queue.filter(q => !q.client.is_closed && q.client.room?.name === 'pvp_arena');
        if (!this.duel_queue.some(q => q.client === client)) this.duel_queue.push({ client, nick, kit });
        const matches = this.duel_queue.filter(q => q.kit === kit);
        client.send_json({ type: 'duel_queue_status', kit, waiting: matches.length });
        if (matches.length >= 2) {
            const entries = matches.slice(0, 2);
            this.duel_queue = this.duel_queue.filter(q => !entries.includes(q));
            this.start_duel_match(...entries);
        }
    }
    start_duel_match(a, b) {
        const spec = DUEL_KITS[a.kit];
        const room = this.get_or_create_room(`duel_${Date.now()}_${a.client.id}_${b.client.id}`);
        if (!room) return;
        Object.assign(room, { duel_kit: a.kit, duel_phase: 'loading', duel_ready: new Set() });
        for (const [i, entry] of [a, b].entries()) {
            const p = entry.client;
            this.leave(p);
            Object.assign(p, { room, name: entry.nick, health: 100, is_alive: true, armor_reduction: spec.armor,
                held_item: spec.item, last_attack_time: 0, invulnerable_until: 0, duel_blocking: false,
                x: 0, y: 5, z: i ? 14 : -14, yaw: i ? 0 : Math.PI });
            room.clients.set(p.id, p);
        }
        for (const p of room.clients.values()) {
            const opponent = [...room.clients.values()].find(o => o !== p);
            p.send_json({ type: 'duel_matched', room: room.name, kit: a.kit, map: DUEL_MAP,
                opponent: { id: opponent.id, name: opponent.name, skin: opponent.skin },
                spawn: { x: p.x, y: p.y, z: p.z, yaw: p.yaw } });
            p.send_json({ type: 'player_joined', player: this.player(opponent) });
        }
    }
    countdown_duel(room, seconds = 3) {
        if (room.duel_phase !== 'countdown') return;
        if (!seconds) room.duel_phase = 'live';
        room.broadcast({ type: 'duel_countdown', seconds });
        if (seconds) this.later(() => this.countdown_duel(room, seconds - 1), 1000);
    }
    finish_duel(room, winner, loser, reason) {
        if (room.duel_phase === 'finished') return;
        room.duel_phase = 'finished';
        room.broadcast({ type: 'duel_round_end', winner_id: winner.id, winner_name: winner.name,
            loser_id: loser.id, loser_name: loser.name, reason });
    }
    damage(room, target, attacker, damage, crit = false, knockback = { x: 0, y: .28, z: 0 }) {
        target.health = Math.max(0, round(target.health - damage));
        room.broadcast({ type: 'damage_event', target_id: target.id, attacker_id: attacker.id,
            attacker_name: attacker.name, damage, health_remaining: target.health, is_crit: crit, knockback });
        if (!target.health && target.is_alive) {
            target.is_alive = false;
            room.broadcast({ type: 'death_event', victim_id: target.id, victim_name: target.name,
                killer_id: attacker.id, killer_name: attacker.name, message: `⚔️ ${attacker.name} ліквідував ${target.name}!` });
            if (room.name.startsWith('duel_')) this.finish_duel(room, attacker, target, `${attacker.name} переміг у двобої.`);
        }
    }
    explode(room, source, tnt) {
        if (!room.tnt.delete(tnt.id)) return;
        const radius = tnt.kind === 'c4' ? 5.5 : 3.8;
        if (room.cooperative) {
            const world = room.world();
            const cx = Math.floor(tnt.x), cy = Math.floor(tnt.y + .5), cz = Math.floor(tnt.z);
            const r = Math.ceil(radius), chain = [];
            for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
                if (dx * dx + dy * dy + dz * dz > radius * radius || cy + dy < 0 || cy + dy >= 32) continue;
                const x = cx + dx, y = cy + dy, z = cz + dz, block = world.getBlock(x, y, z);
                if (!block || block === world.blocks.BEDROCK) continue;
                world.setBlock(x, y, z, 0);
                room.blocks.set(`${x},${y},${z}`, { x, y, z, block_type: 0 });
                if (block === world.blocks.TNT) chain.push({ x: x + .5, y, z: z + .5 });
            }
            for (const position of chain) {
                if (room.tnt.size >= 32 || tnt.chain.remaining <= 0) break;
                tnt.chain.remaining--;
                this.spawnExplosive(room, source, { ...position, vx: 0, vy: 3, vz: 0, fuse: .3, kind: 'tnt', chain: tnt.chain });
            }
        }
        room.broadcast({ type: 'tnt_exploded', tnt_id: tnt.id, x: tnt.x, y: tnt.y, z: tnt.z, radius, source_id: source.id });
        for (const p of room.clients.values()) {
            if (!p.is_alive || (room.cooperative && p !== source)) continue;
            const d = distance(p, tnt);
            if (d >= 8) continue;
            const force = (1 - d / 8) * 22;
            const knockback = { x: round((p.x - tnt.x) / (d || 1) * force, 3),
                y: round(Math.max(6, (p.y - tnt.y) / (d || 1) * force + 6), 3),
                z: round((p.z - tnt.z) / (d || 1) * force, 3) };
            const now = this.clock(), previous = p.explosionImpulse;
            const elapsed = previous ? now - previous.at : Infinity;
            const decay = elapsed >= 0 && elapsed < 3 ? Math.exp(-1.5 * elapsed) : 0;
            const velocity = Object.fromEntries(['x', 'y', 'z'].map(k => [k, (previous?.velocity[k] ?? 0) * decay + knockback[k]]));
            p.explosionImpulse = { velocity, at: now, credit: 0 };
            this.damage(room, p, source, round(Math.max(3, Math.max(8, (1 - d / 8) * 55) * (1 - p.armor_reduction))), false,
                knockback);
        }
    }
    spawnExplosive(room, source, state) {
        const tnt = room.world().tnt({ id: crypto.randomUUID(), chain: { remaining: MAX_CHAIN_EXPLOSIVES - 1 }, ...state,
            owner_id: source.id }, t => this.queueExplosion(room, source, t));
        if (state.kind === 'c4') tnt.update = () => {};
        room.tnt.set(tnt.id, tnt);
        room.broadcast({ type: 'tnt_spawned', tnt_id: tnt.id, request_id: state.request_id, kind: state.kind,
            spawner_id: source.id, x: tnt.x - .5, y: tnt.y, z: tnt.z - .5,
            vx: tnt.vx, vy: tnt.vy, vz: tnt.vz, fuse: state.kind === 'c4' ? null : tnt.fuse });
        return tnt;
    }
    process_message(client, msg) {
        if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
        const type = msg.type, now = this.clock();
        if (type === 'ping') return client.send_json({ type: 'pong', client_time: msg.client_time, server_time: Math.floor(now * 1000) });
        if (type === 'leave') return this.leave(client);
        if (client.arena_mode || type === 'arena_join') return this.arena.process(client, msg);
        if (type === 'join') {
            const name = clean(msg.room, 32, 'pvp_arena');
            if (!/^[A-Za-z0-9_-]{1,32}$/.test(name) || name.startsWith('duel_')) return;
            if (name.startsWith('coop_hosted_') && !this.economy?.canJoin(client, name)) return client.send_json({ type: 'server_error', message: 'Hosted world expired, unavailable, or full.' });
            const room = this.get_or_create_room(name, name.startsWith('coop_hosted_') ? 'survival' : msg.mode);
            if (!room || (client.room !== room && room.clients.size >= 16)) return client.send_json({ type: 'server_error', message: 'Room is full' });
            const switching = client.room !== room;
            if (switching) {
                this.leave(client);
                Object.assign(client, room.cooperative ? room.world().spawn() : { x: 0, y: name === 'pvp_arena' ? 5.05 : 32, z: 0 });
            }
            Object.assign(client, { room, name: clean(msg.name, 24, 'Боєць'), skin: clean(msg.skin, 32, 'classic') });
            if (switching) {
                Object.assign(client, { health: 100, is_alive: true, last_move_time: now, armor_reduction: .68, invulnerable_until: now + 1.5 });
                client.explosionImpulse = null;
            }
            room.clients.set(client.id, client);
            client.send_json({ type: 'welcome', id: client.id, room: name,
                players: [...room.clients.values()].filter(p => p !== client).map(p => this.player(p)),
                blocks: [...room.blocks.values()], world: room.cooperative ? { seed: room.seed, mode: room.mode, type: 'normal', authority: 'eblan' } : null,
                pvp: !room.cooperative, explosives: 'server', health: client.health, spawn: { x: client.x, y: client.y, z: client.z } });
            if (switching) room.broadcast({ type: 'player_joined', player: this.player(client) }, client.id);
            return;
        }
        const room = client.room;
        if (!room) return;
        if (room.name.startsWith('coop_hosted_') && !this.economy?.leaseFor(room.name)) {
            this.leave(client);
            return client.send_json({ type: 'server_error', message: 'Hosting expired. Renew in Addons → Hosting.' });
        }
        const duel = room.name.startsWith('duel_');
        if (type === 'duel_ready' && duel && room.duel_phase === 'loading') {
            room.duel_ready.add(client.id);
            if (room.duel_ready.size === 2) { room.duel_phase = 'countdown'; this.countdown_duel(room); }
            return;
        }
        if (type === 'move') {
            if (!client.is_alive || (duel && room.duel_phase !== 'live')) return;
            if (![msg.x, msg.y, msg.z, msg.yaw, msg.pitch].every(finite)) return;
            // Legacy clients still predict movement. Bound travel by elapsed time,
            // and use the original voxel world to reject wall penetration in co-op.
            const dt = Math.min(.25, Math.max(0, now - client.last_move_time));
            client.last_move_time = now;
            client.movementCredit = Math.min(8, client.movementCredit + 30 * dt);
            const impulse = client.explosionImpulse;
            const age = impulse ? now - impulse.at : Infinity;
            const velocity = age >= 0 && age < 3 ? impulse.velocity : { x: 0, y: 0, z: 0 };
            const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
            const direction = Object.fromEntries(['x', 'y', 'z'].map(k => [k, velocity[k] / (speed || 1)]));
            if (impulse) impulse.credit = Math.min(speed * .25, impulse.credit + speed * Math.exp(-1.5 * Math.max(0, age)) * dt);
            const delta = { x: msg.x - client.x, y: msg.y - client.y, z: msg.z - client.z };
            const projection = Math.max(0, delta.x * direction.x + delta.y * direction.y + delta.z * direction.z);
            const external = Math.min(impulse?.credit ?? 0, projection);
            const cost = Math.hypot(delta.x - external * direction.x, delta.y - external * direction.y, delta.z - external * direction.z);
            if (cost > client.movementCredit + 1e-6 || Math.abs(msg.x) > 4095 || Math.abs(msg.z) > 4095 || msg.y < -64 || msg.y > 256 ||
                (room.cooperative && !room.world().pathClear(client, msg))) {
                client.send_json({ type: 'position_correction', room: room.name, x: client.x, y: client.y, z: client.z });
                return;
            }
            client.movementCredit = Math.max(0, client.movementCredit - cost);
            if (impulse) impulse.credit -= external;
            for (const k of ['x', 'y', 'z', 'yaw', 'pitch']) client[k] = msg[k];
            client.held_item = clean(msg.held_item, 32) || null;
            client.duel_blocking = !!msg.is_blocking && ['shield', 'diamond_sword'].includes(client.held_item);
            room.broadcast({ type: 'player_moved', ...this.player(client), is_walking: !!msg.is_walking, is_sprinting: !!msg.is_sprinting }, client.id);
            return;
        }
        if (type === 'chunk_request' && room.cooperative) {
            const { cx, cz } = msg;
            if (![cx, cz].every(Number.isInteger) || Math.abs(cx) > 256 || Math.abs(cz) > 256 ||
                Math.abs(cx - Math.floor(client.x / 16)) > 5 || Math.abs(cz - Math.floor(client.z / 16)) > 5) return;
            if (!this.allowAction(client, room, 'chunks')) return client.send_json({ type: 'chunk_rejected', room: room.name, cx, cz });
            client.send_json({ type: 'chunk_state', room: room.name, cx, cz, voxels: Buffer.from(room.world().chunk(cx, cz)).toString('base64') });
            return;
        }
        if (type === 'attack') {
            if (room.cooperative || !client.is_alive || (duel && room.duel_phase !== 'live')) return;
            const target = room.clients.get(msg.target_id), spec = duel ? DUEL_KITS[room.duel_kit] : null;
            if (!target || target === client || !target.is_alive || now - client.last_attack_time < (spec?.cooldown ?? .2) || now < target.invulnerable_until) return;
            const d = distance(client, target);
            if (d > (duel ? 4.8 : 6.5) || (duel && client.duel_blocking)) return;
            const weaponDamage = Object.hasOwn(WEAPON_DAMAGE, client.held_item) ? WEAPON_DAMAGE[client.held_item] : 5;
            let damage = (spec?.damage ?? weaponDamage) * (msg.is_crit ? 1.35 : 1) * (1 - target.armor_reduction);
            if (duel && room.duel_kit === 'classic' && target.duel_blocking &&
                -Math.sin(target.yaw) * (client.x - target.x) - Math.cos(target.yaw) * (client.z - target.z) > 0) damage *= target.held_item === 'shield' ? .35 : .65;
            client.last_attack_time = now; target.invulnerable_until = now + (duel ? .18 : .4);
            this.damage(room, target, client, Math.max(1, round(Math.min(65, damage))), !!msg.is_crit,
                { x: round((target.x - client.x) / (d || 1) * .45, 3), y: .28, z: round((target.z - client.z) / (d || 1) * .45, 3) });
            return;
        }
        if (type === 'inventory_sync') {
            const slots = msg.inventory ?? msg.hotbar ?? [], selected = msg.selected_slot ?? 0;
            if (!Array.isArray(slots) || slots.length > 27 || !Number.isInteger(selected) || selected < 0 || selected > 8) return;
            if (slots.some(s => s !== null && (!s || typeof s !== 'object' || !['string', 'number'].includes(typeof s.itemId) ||
                !String(s.itemId).length || String(s.itemId).length > 64 || (typeof s.itemId === 'number' && !finite(s.itemId)) ||
                !Number.isInteger(s.count) || s.count < 1 || s.count > 9999))) return;
            const designs = [];
            try {
                for (const slot of slots) designs.push(slot?.design && room.mode === 'creative' ? room.world().context.normalizeBlockDesign(slot.design) : null);
            } catch { return; }
            client.inventory = slots.map((s, i) => s === null ? null : { itemId: s.itemId, count: s.count, name: clean(s.name, 64), ...(designs[i] ? { design: designs[i] } : {}) });
            while (client.inventory.length < 27) client.inventory.push(null);
            client.selected_slot = selected; client.held_item = client.inventory[selected]?.name || null;
            room.broadcast({ type: 'inventory_sync', id: client.id, held_item: client.held_item, hotbar: client.inventory.slice(0, 9) }, client.id);
            client.send_json({ type: 'inventory_state', inventory: client.inventory, selected_slot: selected });
            return;
        }
        if (type === 'block_action') {
            if (duel || !client.is_alive || !['place', 'break'].includes(msg.action) ||
                ![msg.x, msg.y, msg.z, msg.block_type].every(Number.isInteger) || msg.y < 0 || msg.y >= 32 ||
                msg.block_type < 1 || msg.block_type > 255 || distance(client, msg) > 9) return;
            const block = msg.action === 'break' ? 0 : msg.block_type;
            let design = null;
            if (msg.design != null) {
                if (room.mode !== 'creative' || msg.action !== 'place') return;
                try { design = room.world().context.normalizeBlockDesign(msg.design); } catch { return; }
            }
            if (room.cooperative) {
                const world = room.world();
                const previous = world.getBlock(msg.x, msg.y, msg.z);
                const reject = () => client.send_json({ type: 'block_update', action: previous ? 'place' : 'break',
                    x: msg.x, y: msg.y, z: msg.z, block_type: previous, design: world.getBlockDesign(msg.x, msg.y, msg.z) });
                const protectedBlock = room.mode !== 'creative' && (previous === world.blocks.BEDROCK || block === world.blocks.BEDROCK);
                const editing = msg.expected_type !== undefined;
                const previousInfo = world.info[previous];
                const nextInfo = world.info[block];
                const previousBase = previousInfo?.baseType || previous;
                const nextBase = nextInfo?.baseType || block;
                const validEdit = editing && msg.action === 'place' && room.mode === 'creative' &&
                    msg.expected_type === previous && previousInfo &&
                    (design || (!previousInfo.transparent && !previousInfo.fluid && previousInfo.solid !== false &&
                    (nextBase === previousBase || (nextBase >= world.blocks.WHITE_CONCRETE && nextBase <= world.blocks.BLACK_CONCRETE))));
                const occupied = msg.action === 'place' && world.solid(previous) && !validEdit;
                const boxes = world.context.blockDesignBoxes(block, design);
                const trapsPlayer = msg.action === 'place' && (design ? design.solid : world.solid(block)) && [...room.clients.values()].some(p => p.is_alive && boxes.some(bounds =>
                    p.x + .3 > msg.x + bounds[0] && p.x - .3 < msg.x + bounds[3] &&
                    p.y + 1.8 > msg.y + bounds[1] && p.y < msg.y + bounds[4] &&
                    p.z + .3 > msg.z + bounds[2] && p.z - .3 < msg.z + bounds[5]));
                if (!Object.hasOwn(world.info, msg.block_type) || (editing && !validEdit) || protectedBlock || occupied || trapsPlayer ||
                    !this.allowAction(client, room, 'blocks') || !world.visible({ x: client.x, y: client.y + 1.62, z: client.z },
                        { x: msg.x + .5, y: msg.y + .5, z: msg.z + .5 })) {
                    return reject();
                }
                world.setBlock(msg.x, msg.y, msg.z, block, design);
            } else if (!this.allowAction(client, room, 'blocks')) return;
            room.blocks.set(`${msg.x},${msg.y},${msg.z}`, { x: msg.x, y: msg.y, z: msg.z, block_type: block, ...(design ? { design } : {}) });
            room.broadcast({ type: 'block_update', action: msg.action, x: msg.x, y: msg.y, z: msg.z, block_type: block, player_id: client.id, ...(design ? { design } : {}) });
            return;
        }
        if (type === 'respawn' && !duel && !client.is_alive) {
            Object.assign(client, room.cooperative ? room.world().spawn() : { x: 0, y: 32, z: 0 });
            client.health = 100; client.is_alive = true; client.invulnerable_until = now + 1.5; client.last_move_time = now;
            client.explosionImpulse = null;
            client.movementCredit = Math.min(.5, client.movementCredit);
            room.broadcast({ type: 'player_respawned', id: client.id, health: 100, x: client.x, y: client.y, z: client.z });
            return;
        }
        if (type === 'join_duel_queue') return this.enqueue_duel(client, clean(msg.player_name ?? msg.name, 24, client.name), clean(msg.kit, 24, 'classic'));
        if (type === 'leave_duel_queue') return this.remove_from_duel_queue(client);
        if (type === 'chat') {
            const text = clean(msg.text, 256);
            if (text) room.broadcast({ type: 'chat', sender: client.name, sender_id: client.id,
                text: text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') });
        }
        if (type === 'item_drop' && client.is_alive) {
            const item = clean(msg.itemId ?? msg.item_id, 32), count = msg.count ?? 1;
            if (!item || !Number.isInteger(count) || count < 1 || count > 9999 ||
                ![msg.x, msg.y, msg.z, msg.vx ?? 0, msg.vy ?? 2, msg.vz ?? 0].every(finite) || distance(client, msg) > 9) return;
            room.broadcast({ type: 'item_drop', player_id: client.id, itemId: item, count, x: msg.x, y: msg.y, z: msg.z,
                vx: msg.vx ?? 0, vy: msg.vy ?? 2, vz: msg.vz ?? 0 }, client.id);
        }
        if (type === 'tnt_spawn' && !duel && client.is_alive) {
            const reject = () => client.send_json({ type: 'tnt_rejected', room: room.name, request_id: msg.request_id });
            const velocities = [msg.vx ?? 0, msg.vy ?? 3, msg.vz ?? 0];
            if (![msg.x, msg.y, msg.z, ...velocities].every(finite) || distance(client, msg) > 9 ||
                velocities.some(v => Math.abs(v) > 20) || room.tnt.size >= 32 ||
                (msg.request_id !== undefined && (typeof msg.request_id !== 'string' || msg.request_id.length > 64))) return reject();
            if (msg.request_id && [...room.tnt.values()].some(t => t.owner_id === client.id && t.request_id === msg.request_id)) return;
            if (!this.allowAction(client, room, 'explosives')) return reject();
            const world = room.world(), bx = Math.floor(msg.x), by = Math.floor(msg.y), bz = Math.floor(msg.z);
            const originBlock = world.getBlock(bx, by, bz);
            if (room.cooperative && ((world.solid(originBlock) && originBlock !== world.blocks.TNT) ||
                !world.visible({ x: client.x, y: client.y + 1.62, z: client.z }, { x: msg.x, y: msg.y + .5, z: msg.z }))) return reject();
            if (room.cooperative && world.getBlock(bx, by, bz) === world.blocks.TNT) {
                world.setBlock(bx, by, bz, 0);
                room.blocks.set(`${bx},${by},${bz}`, { x: bx, y: by, z: bz, block_type: 0 });
                room.broadcast({ type: 'block_update', action: 'break', x: bx, y: by, z: bz, block_type: 0 });
            }
            const kind = msg.kind === 'c4' ? 'c4' : 'tnt';
            this.spawnExplosive(room, client, { x: msg.x, y: msg.y, z: msg.z, request_id: msg.request_id, kind,
                vx: kind === 'c4' ? 0 : velocities[0], vy: kind === 'c4' ? 0 : velocities[1], vz: kind === 'c4' ? 0 : velocities[2], fuse: 2.2 });
        }
        if (type === 'tnt_detonate' && !duel && client.is_alive && typeof msg.request_id === 'string') {
            const tnt = [...room.tnt.values()].find(t => t.owner_id === client.id && t.kind === 'c4' && t.request_id === msg.request_id);
            if (tnt) this.queueExplosion(room, client, tnt);
        }
        // Client tnt_explode packets cannot fabricate damage or bypass a fuse.
    }
    tick() {
        this.arena.tick();
        for (const [name, room] of this.rooms) {
            for (const tnt of [...room.tnt.values()]) tnt.update(.05);
            if (room.engine && room.clients.size) {
                room.engine.world.updateWaterPhysics(.05);
                for (const [key, block] of room.engine.world.modifiedBlocks) {
                    const design = room.engine.world.blockDesigns.get(key) || null;
                    if (room.blocks.get(key)?.block_type === block && JSON.stringify(room.blocks.get(key)?.design || null) === JSON.stringify(design)) continue;
                    const [x, y, z] = key.split(',').map(Number);
                    room.blocks.set(key, { x, y, z, block_type: block, ...(design ? { design } : {}) });
                    room.broadcast({ type: 'block_update', action: block ? 'place' : 'break', x, y, z, block_type: block, ...(design ? { design } : {}) });
                }
            }
            if (!room.clients.size && !room.tnt.size && Date.now() - room.lastActive > 30 * 60 * 1000) this.rooms.delete(name);
        }
        for (let i = 0; i < MAX_BLASTS_PER_TICK && this.pendingExplosions.length; i++) {
            const { room, source, tnt } = this.pendingExplosions.shift();
            this.explode(room, source, tnt);
        }
    }
    stop() { for (const t of this.timers) clearTimeout(t); for (const c of [...this.clients]) c.close(); }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
function serve(req, res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
    if (url.pathname === '/proxy/emuos' || url.pathname.startsWith('/proxy/emuos/')) {
        const suffix = url.pathname.slice('/proxy/emuos'.length) || '/';
        const target = new URL('https://emupedia.net/beta/emuos' + suffix + url.search);
        const upstream = https.get(target, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, response => {
            res.writeHead(response.statusCode, { 'Content-Type': response.headers['content-type'] || 'text/html' });
            response.pipe(res);
        });
        upstream.on('timeout', () => upstream.destroy(new Error('Proxy timeout')));
        upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Proxy unavailable'); });
        return;
    }
    let decoded;
    try { decoded = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    // Serve public game assets, never source/configuration or node_modules.
    const parts = decoded.split('/').filter(Boolean);
    if (parts.some(p => p.startsWith('.') || p === 'node_modules' || p === 'server' || p === 'tests') ||
        /(?:server\.(?:py|js)|package(?:-lock)?\.json|AGENTS\.md)$/.test(decoded)) { res.writeHead(403); return res.end(); }
    let file = path.resolve(ROOT, '.' + decoded);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403); return res.end(); }
    fs.stat(file, (error, stat) => {
        if (error) { res.writeHead(404); return res.end(); }
        if (stat.isDirectory()) file = path.join(file, 'index.html');
        fs.realpath(file, (error, real) => {
            if (error || !real.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end(); }
            res.setHeader('Content-Type', MIME[path.extname(real)] || 'application/octet-stream');
            const stream = fs.createReadStream(real);
            stream.on('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); });
            if (req.method === 'HEAD') { stream.destroy(); return res.end(); }
            stream.pipe(res);
        });
    });
}

function start({ host = process.env.HOST || '0.0.0.0', httpPort = Number(process.env.HTTP_PORT ?? 8081), wsPort = Number(process.env.WS_PORT ?? 8082) } = {}) {
    const game = new AuthoritativeGameServer();
    const economyReady = require('./server/economy-node').createEconomyHandler().then(service => { game.economy = service.economy; return service; });
    economyReady.catch(error => console.error('Economy unavailable:', error.message));
    const handler = (req, res) => {
        if (!req.url?.startsWith('/api/economy/')) return serve(req, res);
        economyReady.then(service => service.handle(req, res)).catch(() => { if (!res.headersSent) res.writeHead(503); res.end('{"error":"Economy unavailable"}'); });
    };
    const web = http.createServer(handler), wsHttp = httpPort === wsPort ? web : http.createServer(handler);
    const wss = new WebSocketServer({ noServer: true, maxPayload: 65536, perMessageDeflate: false });
    const upgrade = (req, socket, head) => {
        if (!['/ws', '/'].includes(req.url?.split('?')[0]) || game.clients.size >= 128) return socket.destroy();
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    };
    web.on('upgrade', upgrade);
    if (wsHttp !== web) wsHttp.on('upgrade', upgrade);
    wss.on('connection', socket => {
        const client = new WSClient(socket, game); game.clients.add(client);
        socket.on('error', () => client.close()); socket.on('close', () => client.close());
        socket.on('message', async (data, binary) => {
            const now = game.clock(); client.packet_times.push(now);
            while (client.packet_times.length && client.packet_times[0] <= now - 1) client.packet_times.shift();
            if (client.packet_times.length >= 120 || binary || (client.arena_mode && data.length > 2048)) return client.close();
            let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
            if (msg?.type === 'economy_auth') {
                try { const { economy } = await economyReady; client.economyAccount = (await economy.account(msg.token)).id; }
                catch { client.send_json({ type: 'economy_error', message: 'Wallet authentication failed.' }); }
                return;
            }
            try { game.process_message(client, msg); } catch (error) { console.error(`[${client.id}] ${error.message}`); client.close(); }
            if (msg?.type === 'move' || msg?.type === 'arena_input') game.economy?.recordPlay(client).catch(error => console.error('Reward save failed:', error.message));
        });
    });
    const tick = setInterval(() => game.tick(), 50);
    web.listen(httpPort, host, () => console.log(`Eblankraft: http://${host}:${web.address().port} — original Eblan engine authority`));
    if (wsHttp !== web) wsHttp.listen(wsPort, host, () => console.log(`WebSocket: ws://${host}:${wsHttp.address().port}/ws`));
    const stop = () => { clearInterval(tick); game.stop(); wss.close(); web.close(); if (wsHttp !== web) wsHttp.close(); };
    return { game, web, wsHttp, wss, stop };
}
if (require.main === module) {
    const service = start();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, service.stop);
}
module.exports = { start, serve, AuthoritativeGameServer, WSClient, GameRoom, DUEL_KITS, DUEL_MAP };

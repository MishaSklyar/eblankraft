'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { AuthorityWorld } = require('../server/engine');
const { AuthoritativeGameServer, WSClient, start } = require('../server');
const { DUST2_MAP, WEAPONS } = require('../server/arena');

function harness(t) {
    let now = 100;
    const game = new AuthoritativeGameServer({ clock: () => now });
    t.after(() => game.stop());
    const player = (room = 'test', extra = {}) => {
        const p = new WSClient(null, game); p.messages = []; p.send_json = m => p.messages.push(m);
        game.process_message(p, { type: 'join', room, ...extra }); return p;
    };
    return { game, player, send: (p, msg) => game.process_message(p, msg), advance: n => { now += n; }, now: () => now };
}

test('original engine generates deterministic chunks with room-isolated Wasm seeds', () => {
    const a = new AuthorityWorld(1337), b = new AuthorityWorld(7331);
    const expected = Buffer.from(a.chunk(-3, 4));
    assert.notDeepEqual(expected, Buffer.from(b.chunk(-3, 4)));
    assert.deepEqual(expected, Buffer.from(a.chunk(-3, 4)));
    assert.equal(expected.length, 8192);
    assert.equal(a.world.textureManager, null);
    const spawn = a.spawn();
    assert.ok(a.getBlock(0, spawn.y - 1, 0));
    assert.equal(a.collides(spawn.x, spawn.y, spawn.z), false);
    for (const block of [a.blocks.WATER, a.blocks.PORTAL_NETHER, a.blocks.PORTAL_END, a.blocks.RED_FLOWER]) {
        a.setBlock(50, 29, 50, block);
        assert.equal(a.collides(50.5, 29, 50.5), false, `pass-through block ${block}`);
    }
    a.setBlock(50, 29, 50, a.blocks.STONE);
    assert.equal(a.collides(50.5, 29, 50.5), true);
});

test('join, inventory validation, room switching, edits and late-join AIR compatibility', t => {
    const { game, player, send } = harness(t), p = player();
    Object.assign(p, { x: 1, y: 2, z: 3 });
    send(p, { type: 'block_action', action: 'break', x: 1, y: 2, z: 3, block_type: 1 });
    send(p, { type: 'block_action', action: 'place', x: 2, y: 2, z: 3, block_type: 4 });
    const late = player();
    assert.deepEqual(late.messages[0].blocks, [{ x: 1, y: 2, z: 3, block_type: 0 }, { x: 2, y: 2, z: 3, block_type: 4 }]);
    const inv = Array(27).fill(null); inv[26] = { itemId: 7, count: 64, name: 'apple' };
    send(p, { type: 'inventory_sync', inventory: inv });
    assert.equal(p.inventory[26].count, 64);
    const previous = p.inventory;
    for (const inventory of ['bad', [false], [{ itemId: 5, count: -1 }], Array(28).fill(null)]) send(p, { type: 'inventory_sync', inventory });
    assert.equal(p.inventory, previous);
    game.process_message(p, []);
    const old = p.room;
    send(p, { type: 'join', room: 'other' });
    assert.equal(old.clients.has(p.id), false);
    assert.deepEqual(p.messages.at(-1).blocks, []);
    send(p, { type: 'leave' });
    assert.equal(p.room, null);
});

test('co-op world owns chunks, bedrock validation, movement corrections and water', t => {
    const { player, send, game } = harness(t), p = player('coop_friends');
    assert.equal(p.messages[0].world.authority, 'eblan');
    const engine = p.room.world();
    engine.setBlock(1, 9, 1, engine.blocks.BEDROCK);
    send(p, { type: 'block_action', action: 'break', x: 1, y: 9, z: 1, block_type: engine.blocks.BEDROCK });
    assert.equal(engine.getBlock(1, 9, 1), engine.blocks.BEDROCK);
    send(p, { type: 'move', x: 999, y: 9, z: 0, yaw: 0, pitch: 0 });
    assert.equal(p.messages.at(-1).type, 'position_correction');
    send(p, { type: 'chunk_request', cx: 0, cz: 0 });
    assert.deepEqual(Buffer.from(p.messages.at(-1).voxels, 'base64'), Buffer.from(engine.chunk(0, 0)));
    const before = p.messages.length;
    send(p, { type: 'chunk_request', cx: 200, cz: 200 });
    assert.equal(p.messages.length, before);
    engine.setBlock(2, 28, 2, 0); engine.setBlock(2, 29, 2, engine.blocks.WATER);
    for (let i = 0; i < 4; i++) game.tick();
    assert.equal(engine.getBlock(2, 28, 2), engine.blocks.WATER);
    assert.ok(p.messages.some(m => m.type === 'block_update' && m.x === 2 && m.y === 28));
    const friend = player('coop_friends', { mode: 'creative' });
    assert.equal(friend.room.mode, 'survival');
    send(p, { type: 'attack', target_id: friend.id }); assert.equal(friend.health, 100);
});

test('elapsed-time speed guard rejects rapid movement bursts and nonfinite coordinates', t => {
    const { player, send, advance } = harness(t), p = player();
    advance(.1); send(p, { type: 'move', x: 1, y: 32, z: 0, yaw: 0, pitch: 0 }); assert.equal(p.x, 1);
    send(p, { type: 'move', x: 6, y: 32, z: 0, yaw: 0, pitch: 0 }); assert.equal(p.x, 1);
    send(p, { type: 'move', x: Infinity, y: 32, z: 0, yaw: 0, pitch: 0 }); assert.equal(p.x, 1);
});

test('duel kit matching, readiness, damage, shielding, cooldown and one result', t => {
    const { player, send, game, advance } = harness(t), a = player('pvp_arena'), b = player('pvp_arena'), c = player('pvp_arena');
    send(a, { type: 'join_duel_queue', kit: 'classic' });
    send(c, { type: 'join_duel_queue', kit: 'shawarma' });
    send(b, { type: 'join_duel_queue', kit: 'classic' });
    assert.equal(a.room, b.room); assert.equal(c.room.name, 'pvp_arena');
    Object.assign(b, { x: a.x, y: a.y, z: a.z + 2, yaw: 0 });
    send(a, { type: 'attack', target_id: b.id }); assert.equal(b.health, 100);
    send(a, { type: 'duel_ready' }); assert.equal(a.room.duel_phase, 'loading');
    send(b, { type: 'duel_ready' }); assert.equal(a.room.duel_phase, 'countdown');
    for (const seconds of [2, 1, 0]) game.countdown_duel(a.room, seconds);
    assert.deepEqual(a.messages.filter(m => m.type === 'duel_countdown').map(m => m.seconds), [3, 2, 1, 0]);
    a.held_item = 'eblan_sword'; b.duel_blocking = true; b.held_item = 'shield';
    send(a, { type: 'attack', target_id: b.id }); assert.equal(b.health, 91.6);
    send(a, { type: 'attack', target_id: b.id }); assert.equal(b.health, 91.6);
    advance(1); b.health = 1; b.duel_blocking = false;
    send(a, { type: 'attack', target_id: b.id });
    assert.equal(a.room.duel_phase, 'finished');
    send(b, { type: 'respawn' }); assert.equal(b.is_alive, false);
    send(b, { type: 'leave' });
    assert.equal(a.messages.filter(m => m.type === 'duel_round_end').length, 1);
});

test('legacy arena owns movement, stale input, sequences and snapshots', t => {
    const { game, send, advance } = harness(t), p = new WSClient(null, game);
    p.messages = []; p.send_json = m => p.messages.push(m);
    send(p, { type: 'arena_join', room: 'arena' });
    const x = p.x;
    const input = { type: 'arena_input', seq: 1, strafe: 1, forward: 0, yaw: 0, pitch: 0, jump: false, sprint: false };
    send(p, input); game.tick(); assert.ok(p.x > x);
    send(p, { ...input, seq: 0, strafe: -1 }); assert.equal(p.arena_input.strafe, 1);
    advance(.3); const stopped = p.x; game.tick(); assert.equal(p.x, stopped);
    assert.equal(p.messages.at(-1).type, 'arena_snapshot');
});

test('Dust2 map, six players, buying, ammo, reloads, objectives and side swaps', t => {
    const { game, send, advance, now } = harness(t), p = new WSClient(null, game);
    p.messages = []; p.send_json = m => p.messages.push(m);
    send(p, { type: 'arena_join', mode: 'dust2', room: 'dust2' });
    const room = p.room, arena = game.arena;
    assert.equal(room.players.size, 6); assert.equal(p.messages[0].map.id, 'de_eblan2');
    assert.equal(p.messages[0].weaponSpecs.ak47.magazine, 30);
    p.money = 10000; send(p, { type: 'arena_buy', item: 'm4a1' }); assert.equal(p.primary, null);
    send(p, { type: 'arena_buy', item: 'ak47' }); assert.equal(p.primary, 'ak47'); assert.equal(p.ammo, 30);
    p.ammo = 0; send(p, { type: 'arena_reload' }); assert.ok(p.reload_until > now());
    advance(3); game.tick(); assert.equal(p.ammo, 30); assert.equal(p.reserve_ammo, 60);
    room.phase = 'live'; room.deadline = now() + 85;
    p.x = DUST2_MAP.sites.A[0]; p.z = DUST2_MAP.sites.A[1]; p.y = DUST2_MAP.siteHeights.A;
    p.arena_input.use = true; p.last_input_time = now(); arena.objective(room, now());
    advance(3.1); p.last_input_time = now(); arena.objective(room, now());
    assert.equal(room.bomb_planted_at, now());
    const ct = [...room.players.values()].find(o => o.team === 'CT');
    Object.assign(ct, { x: p.x, y: p.y, z: p.z }); ct.arena_input.use = true;
    arena.objective(room, now()); advance(5.1); arena.objective(room, now());
    assert.equal(room.phase, 'post'); assert.equal(room.last_result.reason, 'defuse');
    const oldTeam = p.team; room.round_number = 6; arena.beginRound(room, now());
    assert.notEqual(p.team, oldTeam); assert.equal(room.players.size, 6);
    assert.equal(WEAPONS.awp.damage, 105);
});

test('TNT explosions require a server-owned fuse and cannot damage co-op friends', t => {
    const { player, send, game } = harness(t), p = player('coop_bombs'), friend = player('coop_bombs');
    send(p, { type: 'tnt_explode', x: friend.x, y: friend.y, z: friend.z, radius: 999 });
    assert.equal(friend.health, 100); assert.equal(p.health, 100);
    send(p, { type: 'tnt_spawn', x: p.x, y: p.y, z: p.z });
    const tnt = [...p.room.tnt.values()][0]; assert.ok(tnt);
    game.explode(p.room, p, tnt);
    assert.equal(friend.health, 100); assert.ok(p.health < 100);
    const health = p.health; game.explode(p.room, p, tnt); assert.equal(p.health, health);
});

test('Dust2 shots own damage, armor, ammo, cooldown, freshness and weapon switching', t => {
    const { game, send, advance, now } = harness(t), p = new WSClient(null, game);
    p.send_json = () => {};
    send(p, { type: 'arena_join', mode: 'dust2', room: 'combat' });
    const room = p.room, arena = game.arena, target = [...room.players.values()].find(o => o.team !== p.team);
    room.phase = 'live'; room.deadline = now() + 85;
    Object.assign(p, { x: 0, y: 40, z: 0, yaw: 0, pitch: 0, last_input_time: now() });
    Object.assign(target, { x: 0, y: 40, z: -2, armor: false });
    p.attack_pending = true;
    const hit = arena.fire(room, p, now());
    assert.equal(hit.targetId, target.id); assert.equal(hit.headshot, true);
    assert.ok(hit.damage > 80 && hit.damage < 100); assert.equal(p.ammo, 19);
    p.attack_pending = true; arena.fire(room, p, now()); assert.equal(p.ammo, 19);
    advance(.4); p.last_input_time = now(); target.health = 100; target.armor = true;
    p.attack_pending = true; const armored = arena.fire(room, p, now());
    assert.ok(armored.damage < hit.damage); assert.equal(p.ammo, 18);
    advance(.4); p.attack_pending = true; arena.fire(room, p, now()); assert.equal(p.ammo, 18);
    p.money = 10000; room.phase = 'buy'; arena.buy(p, 'ak47'); p.ammo = 7;
    arena.equip(p, 2); assert.equal(p.weapon, 'glock'); assert.equal(p.ammo, 18);
    arena.equip(p, 1); assert.equal(p.weapon, 'ak47'); assert.equal(p.ammo, 7);
});

test('server TNT uses original moving projectile physics and broadcasts its final position', t => {
    const { player, send, game } = harness(t), p = player('coop_projectile');
    send(p, { type: 'tnt_spawn', x: p.x, y: 30, z: p.z, vx: 14, vy: 3.5, vz: 0 });
    // Spawn above reach is rejected.
    assert.equal(p.room.tnt.size, 0);
    Object.assign(p, { x: .5, y: 30, z: .5 });
    send(p, { type: 'tnt_spawn', x: .5, y: 30, z: .5, vx: 14, vy: 3.5, vz: 0 });
    const tnt = [...p.room.tnt.values()][0];
    game.tick(); assert.ok(Math.abs(tnt.x - 1.2) < 1e-9); assert.ok(Math.abs(tnt.vy - 2.6) < 1e-9);
    for (let i = 0; i < 44; i++) game.tick();
    const explosion = p.messages.find(m => m.type === 'tnt_exploded');
    assert.ok(explosion.x > 5); assert.equal(explosion.x, tnt.x); assert.equal(explosion.tnt_id, tnt.id);
    assert.equal(p.room.tnt.size, 0);
});

test('HTTP assets, access boundaries and actual WebSocket protocol', async t => {
    const service = start({ host: '127.0.0.1', httpPort: 0, wsPort: 0 });
    t.after(() => service.stop());
    await once(service.web, 'listening');
    const base = `http://127.0.0.1:${service.web.address().port}`;
    const home = await fetch(base); assert.equal(home.status, 200); assert.match(await home.text(), /select-render-scale/);
    for (const route of ['/server.js', '/server.py', '/server/engine.js', '/package.json', '/node_modules/ws/package.json', '/.git/config']) {
        assert.equal((await fetch(base + route)).status, 403, route);
    }
    const wasm = await fetch(base + '/js/eblan_core.wasm'); assert.equal(wasm.headers.get('content-type'), 'application/wasm');
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws'); t.after(() => ws.terminate());
    await once(ws, 'open');
    let response = once(ws, 'message'); ws.send(JSON.stringify({ type: 'join', room: 'wire', name: 'Player' }));
    const welcome = JSON.parse((await response)[0]); assert.equal(welcome.type, 'welcome');
    response = once(ws, 'message'); ws.send(JSON.stringify({ type: 'ping', client_time: 17 }));
    assert.equal(JSON.parse((await response)[0]).client_time, 17);
    response = once(ws, 'message'); ws.send('{invalid'); ws.send(JSON.stringify({ type: 'ping', client_time: 18 }));
    assert.equal(JSON.parse((await response)[0]).client_time, 18);
});


test('creative middle-click edits replace only expected blocks and preserve slab collision height', t => {
    const { player, send } = harness(t);
    const p = player('coop_editor', { mode: 'creative' });
    Object.assign(p, { x: 0.5, y: 28, z: 0.5 });
    const world = p.room.world(), b = world.blocks;
    world.setBlock(2, 28, 0, b.STONE);
    const edit = { type: 'block_action', action: 'place', x: 2, y: 28, z: 0,
        block_type: b.STONE_SLAB, expected_type: b.STONE };
    send(p, edit);
    assert.equal(world.getBlock(2, 28, 0), b.STONE_SLAB);
    assert.equal(world.collides(2.5, 28.5, .5), false);
    assert.equal(world.collides(2.5, 28.4, .5), true);
    send(p, { ...edit, block_type: b.RED_CONCRETE_SLAB });
    assert.equal(world.getBlock(2, 28, 0), b.STONE_SLAB, 'stale source cannot overwrite a newer edit');
    send(p, { ...edit, expected_type: b.STONE_SLAB, block_type: b.RED_CONCRETE_SLAB });
    assert.equal(world.getBlock(2, 28, 0), b.RED_CONCRETE_SLAB);
    p.room.mode = 'survival';
    send(p, { ...edit, expected_type: b.RED_CONCRETE_SLAB, block_type: b.RED_CONCRETE });
    assert.equal(world.getBlock(2, 28, 0), b.RED_CONCRETE_SLAB, 'survival cannot use the creative editor');
});

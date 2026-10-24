const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { ArenaService, DUST2_MAP } = require('../server/arena');
function client(map = DUST2_MAP, prefix = 'js') {
    const context = vm.createContext({ window: {}, performance, console, document: { getElementById: () => null } });
    vm.runInContext(fs.readFileSync(`${prefix}/arena_client.js`, 'utf8'), context);
    const game = { world: { arenaMap: map } };
    return { c: new context.window.ArenaClient(game, {}), context, game };
}
function player(x = 0, y = 40, z = 0) {
    return { x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, is_alive: true, on_ground: true, jump_held: false,
        last_input_time: 100, arena_input: { strafe: 0, forward: 0, jump: false, sprint: true } };
}
test('Dust2 stops lateral drift, turns directly, normalizes diagonals, and expires input', () => {
    const arena = new ArenaService(), p = player();
    p.arena_input.strafe = 1; arena.move(p, 100, true);
    assert.equal(p.vx, 7.2);
    p.arena_input.strafe = 0; p.arena_input.forward = 1; arena.move(p, 100, true);
    assert.equal(p.vx, 0); assert.equal(p.vz, -7.2);
    p.yaw = Math.PI / 2; arena.move(p, 100, true);
    assert.ok(Math.abs(p.vx + 7.2) < 1e-10); assert.ok(Math.abs(p.vz) < 1e-10);
    p.arena_input.strafe = 1; arena.move(p, 100, true);
    assert.ok(Math.abs(Math.hypot(p.vx, p.vz) - 7.2) < 1e-10);
    arena.move(p, 101, true); assert.ok(p.vx === 0 && p.vz === 0);
});
for (const prefix of ['js', 'web/js']) {
    test(`${prefix}: prediction matches authority over actual carved Dust2 ground`, () => {
        const arena = new ArenaService(), { c } = client(DUST2_MAP, prefix);
        const p = player(...DUST2_MAP.spawns.T[0]);
        const s = { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, onGround: true, jumpHeld: false };
        for (let i = 0; i < 240; i++) {
            const input = { strafe: i % 60 < 30 ? 1 : -1, forward: 1, yaw: Math.floor(i / 60) * Math.PI / 2,
                jump: i === 45 || i === 160, sprint: true };
            p.arena_input = input; p.yaw = input.yaw; p.last_input_time = 100;
            arena.move(p, 100, true); c.predict(s, input, .05);
            for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(Math.abs(p[k] - s[k]) < 1e-9, `${i}: ${k}`);
            assert.equal(p.on_ground, s.onGround);
            assert.equal(arena.collides(p.x, p.y, p.z, DUST2_MAP), false);
        }
        assert.ok(c.nearbyObstacles(p.x, p.z).length < DUST2_MAP.obstacles.length / 100, 'collision queries stay local');
    });
    test(`${prefix}: prediction climbs one pixel rather than one block and blocks thin walls`, () => {
        const map = { id: 'de_eblan2', floorY: 0, min: -10, max: 10, obstacles: [[0, 0, -2, 1, .125, 2]] };
        const { c } = client(map, prefix);
        const s = { x: -.31, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true, jumpHeld: false };
        const input = { strafe: 1, forward: 0, yaw: 0, jump: false, sprint: true };
        c.predict(s, input, .05);
        assert.equal(s.y, .125); assert.equal(s.onGround, true);
        assert.equal(c.predictionCollides(s.x, s.y, s.z), false);
        map.obstacles = [[0, 0, -2, .125, 3, 2]];
        Object.assign(s, { x: -.31, y: 0, vx: 0, vy: 0, vz: 0, onGround: true });
        c.predict(s, input, .1);
        assert.ok(s.x <= -.3); assert.equal(s.y, 0);
    });
    test(`${prefix}: old co-op corrections cannot move an arena or local-world player`, () => {
        const { context, game } = client(DUST2_MAP, prefix);
        vm.runInContext(fs.readFileSync(`${prefix}/shared_world_client.js`, 'utf8'), context);
        let corrected = 0;
        game.player = { position: { set: () => corrected++ }, velocity: { set() {} } };
        game.arenaClient = { isActive: true };
        const Shared = vm.runInContext('SharedWorldClient', context);
        const shared = Object.assign(Object.create(Shared.prototype), { game, currentRoom: 'coop_old' });
        const packet = JSON.stringify({ type: 'position_correction', x: 0, y: 0, z: 0 });
        shared.handleMessage(packet); assert.equal(corrected, 0);
        game.arenaClient.isActive = false; shared.currentRoom = null;
        shared.handleMessage(packet); assert.equal(corrected, 0);
        shared.currentRoom = 'coop_new'; shared.handleMessage(packet); assert.equal(corrected, 1, 'active co-op retains anticheat correction');
    });
}

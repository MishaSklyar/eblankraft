const test = require('node:test');
const assert = require('node:assert/strict');
const { ArenaService, KNOCK_MAP } = require('../server/arena');

function setup() {
    let now = 0;
    const arena = new ArenaService(() => now);
    const mk = id => ({ id, sent: [], is_closed: false, send_json(m) { this.sent.push(m); } });
    const a = mk('a'), b = mk('b');
    for (const p of [a, b]) arena.process(p, { type: 'arena_join', room: 'k', mode: 'knockback', name: p.id });
    return { arena, a, b, tick: (n = 1) => { for (let i = 0; i < n; i++) { now += .05; arena.tick(); } }, now: () => now };
}

test('knockback: welcome carries the platform map and mode', () => {
    const { a } = setup();
    const w = a.sent.find(m => m.type === 'arena_welcome');
    assert.equal(w.mode, 'knockback');
    assert.equal(w.map, KNOCK_MAP);
});

test('knockback: a hit deals no damage, shoves the target and raises its percent', () => {
    const { arena, a, b, tick } = setup();
    Object.assign(a, { x: 0, z: 0, yaw: 0, pitch: 0 }); Object.assign(b, { x: 0, z: -2, y: 8, invulnerable_until: 0 });
    tick(3);
    a.last_input_time = b.last_input_time = 1e9; a.last_attack_time = -Infinity;
    Object.assign(a, { x: 0, z: 0, y: 8, yaw: 0, pitch: 0, attack_pending: true });
    Object.assign(b, { x: 0, z: -2, y: 8, invulnerable_until: 0 });
    const hit = arena.attack(a, a.room, 100);
    assert.ok(hit, 'hit lands');
    assert.deepEqual([hit.damage, b.health, b.percent], [0, 100, 10]);
    assert.ok(b.kz < -5 && Math.abs(b.kx) < 1e-6, 'pushed away from the attacker');
    arena.move(b, 100.05); assert.ok(b.z < -2, 'shove moves the player');
});

test('knockback: higher percent shoves harder', () => {
    const { arena, a, b } = setup();
    const push = percent => {
        Object.assign(a, { x: 0, z: 0, y: 8, yaw: 0, pitch: 0, attack_pending: true, last_attack_time: -Infinity, last_input_time: 1e9 });
        Object.assign(b, { x: 0, z: -2, y: 8, kx: 0, kz: 0, percent, invulnerable_until: 0 });
        arena.attack(a, a.room, 100); return Math.abs(b.kz);
    };
    assert.ok(push(100) > push(0) * 2.5);
});

test('knockback: leaving the platform falls to a credited knockout, then respawns', () => {
    const { arena, a, b, tick } = setup();
    Object.assign(b, { x: 20, y: 8, z: 0, kx: 0, kz: 0, last_hit_by: 'a', last_hit_at: 0 });
    b.last_input_time = 1e9;
    tick(1); assert.ok(b.y < 8, 'no floor past the rim');
    for (let i = 0; i < 100 && b.is_alive; i++) tick();
    assert.equal(b.is_alive, false);
    assert.deepEqual([a.kills, b.deaths], [1, 1]);
    const kill = a.sent.findLast(m => m.type === 'arena_hit' && m.killed);
    assert.deepEqual([kill.attackerId, kill.targetId], ['a', 'b']);
    tick(50);
    assert.equal(b.is_alive, true);
    assert.deepEqual([b.percent, b.kx, b.kz], [0, 0, 0]);
    assert.ok(Math.hypot(b.x, b.z) < 8 && b.y === 8);
});

test('knockback: rooms stay separate from classic and dust2 rooms', () => {
    const { arena } = setup();
    const c = { id: 'c', sent: [], is_closed: false, send_json(m) { this.sent.push(m); } };
    arena.process(c, { type: 'arena_join', room: 'k', mode: 'dust2' });
    assert.equal(c.sent.at(-1).type, 'arena_error');
});

test('knockback: client prediction matches the server integrator step for step', () => {
    const fs = require('node:fs'), vm = require('node:vm');
    const ctx = vm.createContext({ window: {}, document: { getElementById: () => null }, localStorage: { getItem: () => null }, console });
    vm.runInContext(fs.readFileSync(`${__dirname}/../js/arena_client.js`, 'utf8') + ';this.ArenaClient=ArenaClient', ctx);
    const { arena, a, tick } = setup();
    Object.assign(a, { x: 6, z: 0, y: 8, kx: 18, kz: -6, vy: 0, last_input_time: 1e9 });
    a.arena_input = { strafe: 0, forward: 0, jump: false, sprint: false };
    const s = { x: 6, y: 8, z: 0, vx: 0, vy: 0, vz: 0, kx: 18, kz: -6, onGround: true };
    for (let i = 0; i < 30; i++) {
        arena.move(a, 0, false);
        ctx.ArenaClient.prototype.predictKnock.call({}, s, .05, KNOCK_MAP);
        assert.ok(Math.abs(a.x - s.x) < 1e-9 && Math.abs(a.y - s.y) < 1e-9 && Math.abs(a.z - s.z) < 1e-9, `step ${i}`);
    }
    assert.ok(s.y < 8, 'drifted off the rim and is falling');
});

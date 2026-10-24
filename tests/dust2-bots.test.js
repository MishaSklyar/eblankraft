const test = require('node:test');
const assert = require('node:assert/strict');
const { ArenaService, DUST2_MAP } = require('../server/arena');
function setup() {
    const arena = new ArenaService(), bot = { id: 'ct-bot', is_bot: true, slot: 1 };
    arena.newDust(bot, 'CT', 100); arena.spawnDust(bot, 100, 1);
    const room = { players: new Map([[bot.id, bot]]), bomb_planted_at: null, bomb_carrier: 't-bot',
        bomb_position: null, target_site: 'B', bomb_site: null };
    return { arena, bot, room };
}
test('CT bot travels to B over carved floors, then holds without repeatedly jumping', () => {
    const { arena, bot, room } = setup();
    let jumps = 0;
    for (let i = 0; i < 1600; i++) {
        const now = 100 + i * .05;
        arena.think(room, bot, now);
        if (bot.arena_input.jump) jumps++;
        arena.move(bot, now, true);
        assert.equal(arena.collides(bot.x, bot.y, bot.z, DUST2_MAP), false);
    }
    assert.ok(Math.hypot(bot.x - DUST2_MAP.sites.B[0], bot.z - DUST2_MAP.sites.B[1]) < 1.1, 'bot reaches B');
    assert.equal(jumps, 0, 'this ground route needs no jumping');
    const held = [bot.x, bot.y, bot.z];
    for (let i = 0; i < 200; i++) {
        const now = 180 + i * .05;
        arena.think(room, bot, now); arena.move(bot, now, true);
        assert.equal(bot.arena_input.jump, false);
    }
    assert.deepEqual([bot.x, bot.y, bot.z], held, 'holding B stays stationary');
});
test('route waypoints have exact floor support and full player headroom', () => {
    const { arena, bot, room } = setup();
    const route = arena.route(bot, room, false);
    assert.ok(route.length > 2);
    assert.ok(route.some(p => p[2] % 1 !== 0), 'route retains carved floor heights');
    for (const [x, z, y] of route) {
        assert.equal(arena.collides(x, y, z, DUST2_MAP), false);
        assert.equal(arena.collides(x, y - .001, z, DUST2_MAP), true, 'waypoint stands on a real floor');
    }
});
test('holding a site never jumps just because a cached waypoint is higher', () => {
    const { arena, bot, room } = setup();
    arena.think(room, bot, 100);
    bot.route = [[bot.x, bot.z, bot.y + .875]]; bot.route_index = 0;
    for (let i = 0; i < 60; i++) {
        arena.think(room, bot, 100 + i * .05);
        assert.equal(bot.arena_input.forward, 0); assert.equal(bot.arena_input.jump, false);
    }
});
test('a blocked bot invalidates its route instead of using jump spam as recovery', () => {
    const { arena, bot, room } = setup();
    arena.think(room, bot, 100);
    bot.route = [[bot.x + 2, bot.z, bot.y]]; bot.route_index = 0;
    bot.progress_position = [bot.x, bot.z]; bot.progress_at = 100;
    let invalidated = false;
    for (let i = 0; i < 22; i++) {
        arena.think(room, bot, 100 + i * .05);
        assert.equal(bot.arena_input.jump, false);
        invalidated ||= bot.route_key === null;
    }
    assert.equal(invalidated, true, 'lack of measured progress schedules replanning');
    assert.ok(bot.route.length > 1, 'next tick calculates a fresh path');
});

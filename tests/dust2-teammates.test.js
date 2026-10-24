const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AuthoritativeGameServer, WSClient } = require('../server');
function setup(t) {
    const game = new AuthoritativeGameServer({ clock: () => 100 }); t.after(() => game.stop());
    const join = team => {
        const p = new WSClient(null, game); p.messages = []; p.send_json = m => p.messages.push(m);
        game.process_message(p, { type: 'arena_join', room: 'friends', mode: 'dust2', ...(team ? { team } : {}) });
        return p;
    };
    return { game, join };
}
test('a teammate joining live takes a bot and its current gear, health and C4', t => {
    const { game, join } = setup(t), host = join('T'), room = host.room;
    room.phase = 'live';
    const bot = [...room.players.values()].find(p => p.is_bot && p.team === 'T');
    Object.assign(bot, { health: 37, money: 1700, primary: 'ak47', weapon: 'ak47', ammo: 12, reserve_ammo: 51, armor: true, last_attack_time: 99.99 });
    bot.weapon_ammo.ak47 = [12, 51]; room.bomb_carrier = bot.id;
    room.objective_actor = bot.id; room.objective_started_at = 99;
    const friend = join('T');
    assert.equal(friend.team, 'T'); assert.equal(room.players.size, 6);
    assert.equal(room.players.has(bot.id), false); assert.equal(friend.is_bot, false);
    for (const k of ['x', 'y', 'z', 'health', 'money', 'weapon', 'ammo', 'reserve_ammo', 'armor', 'last_attack_time']) assert.equal(friend[k], bot[k]);
    assert.equal(room.bomb_carrier, friend.id); assert.equal(room.objective_actor, null);
    assert.equal(friend.messages[0].players.find(p => p.id === friend.id).alive, true);
    assert.equal(friend.input_seq, -1); assert.equal(friend.attack_pending, false);
    friend.weapon_ammo.ak47[0] = 0; assert.equal(bot.weapon_ammo.ak47[0], 12);
});
test('full teams and full matches reject additional humans without growing the roster', t => {
    const { join } = setup(t), host = join('T'), room = host.room;
    join('T'); join('T');
    const rejected = join('T');
    assert.equal(rejected.room, null); assert.equal(rejected.messages[0].type, 'arena_error');
    join('CT'); join('CT'); join('CT');
    assert.equal(room.players.size, 6); assert.equal([...room.players.values()].filter(p => p.is_bot).length, 0);
    assert.equal(join().room, null); assert.equal(room.clients.size, 6);
});
test('joining a dead bot waits for next round rather than resurrecting a team', t => {
    const { join } = setup(t), host = join('T'), room = host.room;
    room.phase = 'live';
    for (const bot of room.players.values()) if (bot.is_bot && bot.team === 'T') { bot.is_alive = false; bot.health = 0; }
    const friend = join('T');
    assert.equal(friend.is_alive, false); assert.equal(friend.health, 0); assert.equal(room.players.size, 6);
});
test('departing humans become bots in place, preserving lives and the bomb', t => {
    const { game, join } = setup(t), host = join('T'), friend = join('T'), room = host.room;
    room.phase = 'live'; room.bomb_carrier = friend.id;
    Object.assign(friend, { x: 4.5, y: 8.125, z: -12.5, health: 23 });
    game.leave(friend);
    const replacement = [...room.players.values()].find(p => p.is_bot && p.x === 4.5 && p.z === -12.5);
    assert.ok(replacement); assert.equal(replacement.health, 23); assert.equal(room.bomb_carrier, replacement.id);
    assert.equal(room.players.size, 6); assert.equal(room.clients.size, 1);
    replacement.is_alive = false; replacement.health = 0;
    const deadFriend = join('T');
    deadFriend.is_alive = false; deadFriend.health = 0;
    game.leave(deadFriend);
    assert.equal(room.players.size, 6);
});
test('repeated joins and departures keep unique bot IDs and three slots per team', t => {
    const { game, join } = setup(t), host = join('T'), room = host.room;
    for (let i = 0; i < 10; i++) {
        const p = join('T'); assert.equal(room.players.size, 6);
        game.leave(p); game.arena.ensureBots(room, 100);
        assert.equal(room.players.size, 6);
        for (const team of ['T', 'CT']) assert.equal([...room.players.values()].filter(p => p.team === team).length, 3);
    }
    const bad = join('invalid'); assert.equal(bad.room, null); assert.equal(room.players.size, 6);
});
for (const prefix of ['js', 'web/js']) {
    test(`${prefix}: teammate code copies the room/team and routes through the normal join UI`, async () => {
        let copied, connected;
        const context = vm.createContext({ window: {}, console, performance,
            navigator: { clipboard: { writeText: async code => { copied = code; } } },
            localStorage: { getItem: () => null }, document: { getElementById: () => null } });
        for (const file of ['arena_client', 'multiplayer']) vm.runInContext(fs.readFileSync(`${prefix}/${file}.js`, 'utf8'), context);
        const Arena = context.window.ArenaClient, Multi = vm.runInContext('MultiplayerManager', context);
        const client = Object.assign(Object.create(Arena.prototype), { isConnected: true, roomCode: 'friends', localState: { team: 'CT' }, multiplayer: { showToast() {} } });
        await client.inviteTeammate(); assert.equal(copied, 'friends:CT');
        const manager = Object.assign(Object.create(Multi.prototype), { game: { arenaClient: { connect: (...args) => { connected = args; } } } });
        manager.joinRoom(copied); assert.deepEqual(connected, ['friends', 'CT']);
        manager.joinRoom('dust2'); assert.deepEqual(connected, ['dust2']);
    });
}

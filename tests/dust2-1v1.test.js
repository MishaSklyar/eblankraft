const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AuthoritativeGameServer, WSClient } = require('../server');
const arena = require('../server/arena');

function setup(t) {
    let now = 100;
    const game = new AuthoritativeGameServer({ clock: () => now }); t.after(() => game.stop());
    const join = (extra = {}) => {
        const p = new WSClient(null, game); p.messages = []; p.send_json = m => p.messages.push(m);
        game.process_message(p, { type: 'arena_join', mode: 'dust2', size: 1, ...extra });
        return p;
    };
    return { game, join, advance: s => { now += s; } };
}

test('server/arena re-exports the shared browser/Node arena core', () => {
    assert.equal(arena, require('../js/arena_core.js'));
    assert.equal(typeof arena.ArenaService, 'function');
    assert.ok(arena.DUST2_MAP.obstacles.length > 1000);
});

test('1v1 room: one human versus one bot, team size reported to the client', t => {
    const { join } = setup(t), p = join(), room = p.room;
    assert.equal(room.name, 'dust2_1v1'); assert.equal(room.team_size, 1);
    assert.equal(room.players.size, 2);
    const teams = [...room.players.values()].map(o => o.team).sort();
    assert.deepEqual(teams, ['CT', 'T']);
    const welcome = p.messages[0];
    assert.equal(welcome.type, 'arena_welcome'); assert.equal(welcome.teamSize, 1); assert.equal(welcome.match.teamSize, 1);
});

test('1v1 room: a second human replaces the bot; a third is refused', t => {
    const { join } = setup(t), a = join(), room = a.room;
    const b = join();
    assert.equal(b.room, room); assert.notEqual(b.team, a.team);
    assert.equal([...room.players.values()].filter(p => p.is_bot).length, 0);
    const c = join();
    assert.equal(c.room, null); assert.equal(c.messages[0].type, 'arena_error');
});

test('1v1 and 3v3 rooms do not mix, invalid sizes are rejected', t => {
    const { join } = setup(t);
    const classic = join({ room: 'mix', size: 3 });
    assert.equal(classic.room.team_size, 3); assert.equal(classic.room.players.size, 6);
    const duel = join({ room: 'mix', size: 1 });
    assert.equal(duel.room, null); assert.match(duel.messages[0].message, /3v3/);
    const bad = join({ room: 'other', size: 2 });
    assert.equal(bad.room, null); assert.match(bad.messages[0].message, /size/i);
});

test('1v1 round: eliminating the only opponent wins the round', t => {
    const { game, join, advance } = setup(t), p = join(), room = p.room;
    advance(10.1); game.tick();
    assert.equal(room.phase, 'live');
    const bot = [...room.players.values()].find(o => o.is_bot);
    game.arena.die(room, bot, p, 110.2);
    advance(.1); game.tick();
    assert.equal(room.phase, 'post');
    assert.equal(room.score[p.team], 1); assert.equal(room.last_result.reason, 'elimination');
    advance(6.1); game.tick();
    assert.equal(room.phase, 'buy'); assert.equal(room.players.size, 2);
});

test('browser: arena core runs from a <script> with the map from window.EBLAN_MAPS', () => {
    const context = vm.createContext({ console, performance });
    context.window = context; context.self = context;
    vm.runInContext(fs.readFileSync('js/de_eblan2.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('js/arena_core.js', 'utf8'), context);
    const { ArenaService } = context.EblanArena;
    const service = new ArenaService(() => 50), messages = [];
    const client = { id: 'local', is_closed: false, send_json: m => messages.push(m) };
    service.process(client, { type: 'arena_join', mode: 'dust2', size: 1, room: 'dust2_1v1', name: 'Me' });
    assert.equal(messages[0].type, 'arena_welcome'); assert.equal(messages[0].teamSize, 1);
    assert.equal(messages[0].players.length, 2);
    service.tick();
    assert.equal(messages.at(-1).type, 'arena_snapshot');
});

test('browser: LocalArenaSocket speaks the WebSocket protocol ArenaClient uses', async () => {
    const scripts = [];
    const context = vm.createContext({ console, performance, Promise, setInterval, clearInterval, setTimeout, queueMicrotask,
        document: { head: { appendChild: s => { scripts.push(s); setTimeout(() => {
            vm.runInContext(fs.readFileSync(s.src.split('?')[0], 'utf8'), context); s.onload();
        }); } }, createElement: () => ({}) } });
    context.window = context; context.self = context;
    vm.runInContext(fs.readFileSync('js/local_arena.js', 'utf8'), context);
    const socket = new context.LocalArenaSocket(), received = [];
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = e => reject(e.error); });
    assert.equal(socket.readyState, 1);
    assert.deepEqual(scripts.map(s => s.src.split('?')[0]), ['js/de_eblan2.js', 'js/arena_core.js']);
    socket.onmessage = event => received.push(event.data);
    socket.send(JSON.stringify({ type: 'economy_auth', token: 'x' }));       // ignored, like a server without economy
    socket.send(JSON.stringify({ type: 'arena_join', room: 'dust2_1v1', mode: 'dust2', size: 1, name: 'Me' }));
    await new Promise(r => setTimeout(r, 120));
    assert.equal(received[0].type, 'arena_welcome');
    assert.ok(received.some(m => m.type === 'arena_snapshot'));
    socket.close();
    assert.equal(socket.readyState, 3);
});

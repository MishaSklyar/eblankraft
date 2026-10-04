const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
let now = 0;
const context = vm.createContext({
    window: { location: { protocol: 'http:', host: 'localhost:8081', hostname: 'localhost', port: '8081' } },
    document: { getElementById: () => null },
    localStorage: { getItem: () => null },
    performance: { now: () => now }, console,
});
vm.runInContext(fs.readFileSync(path.join(root, 'web/js/three.min.js'), 'utf8'), context);
const source = process.env.ARENA_CLIENT_SOURCE || 'web/js/arena_client.js';
vm.runInContext(fs.readFileSync(path.join(root, source), 'utf8'), context);
const map = { floorY: 8, min: -16, max: 16, wallHeight: 6, obstacles: [[-2, 8, -1, 2, 11, 1]] };

function setup() {
    now = 0;
    const Vector3 = vm.runInContext('THREE.Vector3', context);
    const player = {
        position: new Vector3(-10, 8, -10), velocity: new Vector3(),
        yaw: 0, pitch: 0, isSprinting: false, attackCooldown: 1, walkCycle: 0,
        updateView() {},
    };
    const game = { player, world: { arenaMap: map }, ui: {} };
    const multiplayer = { remotePlayers: new Map(), updatePlayerCount() {} };
    const client = new context.window.ArenaClient(game, multiplayer);
    const sent = [];
    client.send = packet => { sent.push(packet); return true; };
    client.isConnected = client.isActive = true;
    client.clientId = 'me';
    game.arenaClient = client;
    const state = { id: 'me', position: { x: -10, y: 8, z: -10 }, velocity: { x: 0, y: 0, z: 0 },
        health: 100, alive: true, onGround: true, jumpHeld: false, spawn: 1, seq: -1 };
    client.applySnapshot([state]);
    return { client, player, state, sent, game };
}

function frame(client, forward = 1, jump = false, dt = 1 / 60) {
    now += dt * 1000;
    client.updatePlayer(dt, { x: 0, y: forward }, jump);
}

function close(a, b, message, epsilon = 1e-8) {
    assert.ok(Math.abs(a - b) < epsilon, `${message}: ${a} != ${b}`);
}

// The old client stayed motionless between snapshots. Input now moves the camera every frame.
{
    const { client, player, sent } = setup();
    for (let i = 0; i < 12; i++) {
        const z = player.position.z;
        frame(client);
        assert.ok(player.position.z < z, 'local movement must not wait for a server snapshot');
        close(z - player.position.z, 4.5 / 60, '60 Hz walk distance');
    }
    assert.ok(sent.length <= 5, 'prediction must not increase network sends to rendering rate');
    assert.ok(sent.every(packet => packet.type === 'arena_input' && !('position' in packet) && !('dt' in packet)),
        'the server still receives controls, never client positions or elapsed time');
}

// Reconciliation keeps inputs newer than the server acknowledgement and keeps the view continuous.
{
    for (const fps of [30, 60, 144]) {
        const { client, player } = setup();
        for (let i = 0; i < fps; i++) {
            client.lastSnapshot = now;
            frame(client, 1, false, 1 / fps);
        }
        close(player.position.z, -14.5, 'walk distance is independent of rendering FPS');
    }
}
{
    const { client, player, state } = setup();
    for (let i = 0; i < 12; i++) frame(client);
    const rendered = player.position.clone();
    const pending = client.pendingFrames.filter(record => record.seq > 1);
    const remaining = pending.reduce((sum, record) => sum + record.dt, 0);
    client.applySnapshot([{ ...state, seq: 1, position: { x: -10, y: 8, z: -10.3 } }]);
    close(client.predicted.z, -10.3 - 4.5 * remaining, 'replay only unacknowledged movement');
    close(player.position.z, rendered.z, 'a small correction must not snap the view');
    assert.ok(client.pendingFrames.every(record => record.seq > 1));
    const error = Math.abs(client.correction.z);
    frame(client, 0);
    assert.ok(Math.abs(client.correction.z) < error, 'correction fades with frame time');
}

// Respawning and death clear movement history instead of replaying an old life.
{
    const { client, player, state } = setup();
    frame(client);
    client.applySnapshot([{ ...state, spawn: 2, seq: 1, position: { x: 10, y: 8, z: 10 } }]);
    assert.equal(client.pendingFrames.length, 0);
    close(player.position.x, 10, 'respawn position');
    client.applySnapshot([{ ...state, spawn: 2, alive: false, health: 0,
        position: { x: 10, y: 8, z: 10 } }]);
    frame(client);
    close(player.position.z, 10, 'dead players cannot predict movement');
    assert.equal(player.health, 0);
}

// No floor/wall penetration, repeated jumps on held input, menu movement, or endless offline prediction.
{
    const { client, player } = setup();
    frame(client, 0, true);
    assert.ok(player.position.y > 8, 'jump responds immediately');
    for (let i = 0; i < 90; i++) {
        client.lastSnapshot = now;
        frame(client, 0, true);
    }
    close(player.position.y, 8, 'holding jump must not repeatedly jump after landing');
    assert.equal(player.onGround, true);
}
{
    const { client, player, game } = setup();
    game.ui.menuOpen = true;
    frame(client);
    close(player.position.z, -10, 'pause menu stops movement');
    game.ui.menuOpen = false;
    now = 1000;
    frame(client);
    close(player.position.z, -10, 'prediction stops when server snapshots stop');
    client.resetPrediction();
    assert.equal(client.pendingFrames.length, 0);
    assert.equal(client.predicted, null);
}

// Compare the client collider and physics with the real Python server, not a copied test model.
const fixture = spawnSync('python', ['-c', `
import json
from types import SimpleNamespace
from pvp_arena import ArenaService, MAP
arena = ArenaService(clock=lambda: 0)
player = SimpleNamespace(id='me', room=None, is_closed=False, send_json=lambda message: None)
arena.process(player, {'type': 'arena_join', 'room': 'test'})
cases = []
for start, controls in [
    ((-10,8,-10), [{'strafe':1,'forward':1,'yaw':0.4,'jump':False,'sprint':True}]*30),
    ((-10,8,-10), [{'strafe':0,'forward':0,'yaw':0,'jump':True,'sprint':False}]*40),
    ((0,8,4), [{'strafe':0,'forward':1,'yaw':0,'jump':False,'sprint':True}]*30),
    ((15,8,10), [{'strafe':1,'forward':0,'yaw':0,'jump':False,'sprint':True}]*20),
    ((0,12,0), [{'strafe':0,'forward':0,'yaw':0,'jump':False,'sprint':False}]*20),
]:
    arena.spawn(player, 0)
    player.x,player.y,player.z = start
    player.on_ground = start[1] == MAP['floorY']
    case = {'initial':arena.state(player), 'frames':[]}
    for control in controls:
        player.arena_input = control
        player.yaw = control['yaw']
        arena.move(player, 0)
        case['frames'].append({'control':control, 'state':arena.state(player)})
    cases.append(case)
print(json.dumps(cases))
`], { cwd: root, encoding: 'utf8' });
assert.equal(fixture.status, 0, fixture.stderr);
for (const testCase of JSON.parse(fixture.stdout)) {
    const { client } = setup();
    client.applySnapshot([testCase.initial]);
    for (const { control, state } of testCase.frames) {
        client.predict(client.predicted, control, 0.05);
        for (const key of ['x', 'y', 'z']) close(client.predicted[key], state.position[key], 'server position ' + key);
        for (const key of ['x', 'y', 'z']) close(client.predicted['v' + key], state.velocity[key], 'server velocity ' + key);
        assert.equal(client.predicted.onGround, state.onGround);
        assert.equal(client.predicted.jumpHeld, state.jumpHeld);
    }
}

if (!process.env.ARENA_CLIENT_SOURCE) {
    assert.equal(fs.readFileSync(path.join(root, 'js/arena_client.js'), 'utf8'),
        fs.readFileSync(path.join(root, 'web/js/arena_client.js'), 'utf8'), 'root and web clients must match');
}
console.log('PASS: per-frame prediction, bounded sends, replay, smooth correction, respawn/death reset, jump, pause, stale connection, server collision/physics parity');

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { WebSocket } = require('ws');
const { AuthoritativeGameServer, WSClient } = require('../server');
const THREE = require('../js/three.min.js');

function setup(t) {
    let now = 100;
    const server = new AuthoritativeGameServer({ clock: () => now });
    t.after(() => server.stop());
    const p = new WSClient(null, server), messages = [];
    p.send_json = msg => messages.push(msg);
    server.process_message(p, { type: 'join', room: 'coop_tnt_test' });
    Object.assign(p, { x: .5, y: 30, z: .5 });
    messages.length = 0;
    const context = vm.createContext({ window: {}, THREE, WebSocket, performance, console, setTimeout, clearTimeout,
        BLOCK_TYPES: p.room.world().blocks });
    for (const file of ['particles', 'shared_world_client']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, `../js/${file}.js`), 'utf8'), context);
    }
    let localDamage = 0, blockWrites = 0;
    const game = { tntEntities: [], scene: new THREE.Scene(),
        player: { position: new THREE.Vector3(.5, 30, .5), velocity: new THREE.Vector3(), health: 100,
            takeDamage() { localDamage++; } },
        world: { getBlock: () => 3, setBlock() { blockWrites++; }, updateMeshes() {} },
        textureManager: { getBlockMaterial: () => new THREE.MeshBasicMaterial(), getItemDropMaterial: () => new THREE.MeshBasicMaterial() },
        soundManager: { playFuse() {}, playExplosion() {} },
        particleSystem: { particles: [], spawnExplosionParticles() {}, spawnBlockBreakParticles() {} } };
    const outgoing = [], client = Object.create(context.window.SharedWorldClient.prototype);
    Object.assign(client, { game, clientId: p.id, currentRoom: p.room.name, engineAuthority: true,
        nextExplosiveId: 0, loadingRoom: false, isConnected: true,
        socket: { readyState: WebSocket.OPEN, send(data) { outgoing.push(JSON.parse(data)); } } });
    game.serverClient = client;
    const deliver = () => { while (messages.length) client.handleMessage(JSON.stringify(messages.shift())); };
    const flush = () => { while (outgoing.length) server.process_message(p, outgoing.shift()); deliver(); };
    const entity = (c4 = false) => new context.window[c4 ? 'C4Entity' : 'TNTEntity'](
        0, 28, 0, game.scene, game.textureManager, game.soundManager, game.world, game.particleSystem, game);
    return { server, p, game, client, outgoing, entity, flush, deliver,
        damageCount: () => localDamage, writes: () => blockWrites,
        advance: dt => { now += dt; }, now: () => now };
}

test('actual browser TNT registers once, waits for server explosion, and applies one authoritative impulse', t => {
    const h = setup(t), tnt = h.entity();
    tnt.vx = 14; tnt.vy = 3.5; tnt.vz = 0;
    tnt.update(.01);
    assert.equal(h.outgoing.length, 1);
    assert.equal(h.outgoing[0].type, 'tnt_spawn');
    assert.equal(h.outgoing[0].vx, 14, 'register after throw velocities have been assigned');
    tnt.explode();
    assert.equal(tnt.exploded, false);
    assert.equal(h.damageCount(), 0);
    assert.equal(h.writes(), 0, 'local explosion must not destroy unconfirmed terrain');
    h.flush();
    assert.equal(h.game.tntEntities.length, 1, 'spawn acknowledgment must not duplicate the local entity');
    assert.equal(h.p.room.tnt.size, 1);
    const authoritative = [...h.p.room.tnt.values()][0];
    assert.equal(tnt.serverId, authoritative.id);
    tnt.update(.01); assert.equal(h.outgoing.length, 0);
    h.server.explode(h.p.room, h.p, authoritative); h.deliver();
    assert.equal(tnt.exploded, true);
    assert.equal(h.damageCount(), 1);
    assert.equal(h.game.player.health, h.p.health);
    assert.ok(h.game.player.velocity.y >= 6);
});

test('server-confirmed blast motion is accepted; fabricated blasts and expired allowance are rejected', t => {
    const h = setup(t);
    h.server.process_message(h.p, { type: 'tnt_spawn', x: .5, y: 28, z: .5 });
    const tnt = [...h.p.room.tnt.values()][0];
    h.server.explode(h.p.room, h.p, tnt);
    h.advance(.05);
    h.server.process_message(h.p, { type: 'move', x: .5, y: 32.5, z: .5, yaw: 0, pitch: 0 });
    assert.equal(h.p.y, 32.5, 'blast movement exceeds normal allowance but is authorized by server impulse');
    h.advance(3.1); h.p.last_move_time = h.now() - .05;
    h.server.process_message(h.p, { type: 'tnt_explode', x: .5, y: 30, z: .5, radius: 999 });
    h.server.process_message(h.p, { type: 'move', x: .5, y: 35, z: .5, yaw: 0, pitch: 0 });
    assert.equal(h.p.y, 32.5, 'raw explosion packets must not grant movement permission');
});

test('actual C4 registration stays stationary and detonation requires its owner', t => {
    const h = setup(t), charge = h.entity(true);
    charge.update(); h.flush();
    const tnt = [...h.p.room.tnt.values()][0];
    assert.equal(tnt.kind, 'c4');
    for (let i = 0; i < 50; i++) h.server.tick();
    assert.equal(tnt.y, 28); assert.equal(h.p.room.tnt.size, 1);
    const other = new WSClient(null, h.server); other.send_json = () => {};
    h.server.process_message(other, { type: 'join', room: h.p.room.name });
    h.server.process_message(other, { type: 'tnt_detonate', request_id: charge.serverRequestId });
    assert.equal(h.p.room.tnt.size, 1);
    charge.explode(); assert.equal(charge.exploded, false); h.flush();
    assert.equal(charge.exploded, false, 'detonation waits for the bounded server simulation tick');
    h.server.tick(); h.deliver();
    assert.equal(charge.exploded, true); assert.equal(h.p.room.tnt.size, 0);
});

test('overlapping confirmed explosions accumulate movement allowance', t => {
    const h = setup(t);
    for (let i = 0; i < 2; i++) {
        h.server.process_message(h.p, { type: 'tnt_spawn', x: .5, y: 28, z: .5 });
        h.server.explode(h.p.room, h.p, [...h.p.room.tnt.values()][0]);
    }
    h.advance(.05);
    h.server.process_message(h.p, { type: 'move', x: .5, y: 34, z: .5, yaw: 0, pitch: 0 });
    assert.equal(h.p.y, 34, 'stacked blast impulses must not trigger correction');
});

test('ignited TNT and chain explosions update server terrain and synchronize primed entities', t => {
    const h = setup(t), world = h.p.room.world();
    world.setBlock(0, 28, 0, world.blocks.TNT);
    world.setBlock(2, 28, 0, world.blocks.TNT);
    const tnt = h.entity(); tnt.vx = tnt.vy = tnt.vz = 0;
    tnt.update(.01); h.flush();
    assert.equal(world.getBlock(0, 28, 0), 0, 'server removes the ignited block before movement collision checks');
    h.server.explode(h.p.room, h.p, [...h.p.room.tnt.values()][0]); h.deliver();
    assert.equal(world.getBlock(2, 28, 0), 0);
    assert.equal(h.p.room.tnt.size, 1, 'nearby TNT is primed on the server');
    assert.equal(h.game.tntEntities.length, 2, 'chain spawn must not be mistaken for a local acknowledgment');
    for (let i = 0; i < 7; i++) h.server.tick();
    h.deliver(); assert.equal(h.p.room.tnt.size, 0);
});

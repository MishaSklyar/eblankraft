'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthoritativeGameServer, WSClient } = require('../server');

function setup(t) {
    let now = 100;
    const server = new AuthoritativeGameServer({ clock: () => now });
    t.after(() => server.stop());
    const player = (mode = 'survival') => {
        const p = new WSClient(null, server); p.messages = []; p.send_json = m => p.messages.push(m);
        server.process_message(p, { type: 'join', room: 'coop_limits', mode });
        Object.assign(p, { x: 1.5, y: 10, z: 1.5 });
        return p;
    };
    const p = player(), world = p.room.world();
    for (const chunk of Object.values(world.world.chunks)) chunk.voxels.fill(0);
    world.world.modifiedBlocks.clear(); p.room.blocks.clear();
    return { server, p, world, player, send: (msg, target = p) => server.process_message(target, msg),
        advance: n => { now += n; }, now: () => now };
}

test('rapid movement packets cannot accumulate packet slack or cross solid walls', t => {
    const h = setup(t);
    for (let i = 0; i < 100; i++) h.send({ type: 'move', x: h.p.x + .4, y: 10, z: 1.5, yaw: 0, pitch: 0 });
    assert.ok(h.p.x <= 2, 'one initial tolerance, not a new allowance per packet');
    Object.assign(h.p, { x: 1.5, y: 10, z: 1.5 });
    for (let y = 10; y < 12; y++) h.world.setBlock(2, y, 1, h.world.blocks.STONE);
    h.advance(.2);
    h.send({ type: 'move', x: 3.5, y: 10, z: 1.5, yaw: 0, pitch: 0 });
    assert.equal(h.p.x, 1.5, 'clear destination must not permit tunneling through the intervening wall');
});

test('explosive flood limits survive repeated join packets and room-wide pressure', t => {
    const h = setup(t);
    for (let i = 0; i < 40; i++) {
        h.send({ type: 'tnt_spawn', request_id: `spam${i}`, x: 3.5, y: 10, z: 1.5, kind: 'c4' });
        h.send({ type: 'join', room: h.p.room.name });
        Object.assign(h.p, { x: 1.5, y: 10, z: 1.5 });
    }
    assert.ok(h.p.room.tnt.size <= 8, 'spawn budget must not reset on join');
    h.p.health = 12;
    h.send({ type: 'join', room: h.p.room.name });
    assert.equal(h.p.health, 12, 'duplicate join must not heal players');
    for (let i = 0; i < 8; i++) {
        const other = h.player();
        for (let j = 0; j < 8; j++) h.send({ type: 'tnt_spawn', request_id: `other${i}:${j}`, x: 3.5, y: 10, z: 1.5, kind: 'c4' }, other);
    }
    assert.ok(h.p.room.tnt.size <= 16, 'room budget must also bound multiple clients');
});

test('block spam is bounded; normal placement and breaks remain possible', t => {
    const h = setup(t);
    for (let i = 0; i < 40; i++) {
        const x = 3 + i % 5, z = -2 + Math.floor(i / 5);
        h.send({ type: 'block_action', action: 'place', x, y: 10, z, block_type: h.world.blocks.STONE });
    }
    assert.ok(h.p.room.blocks.size <= 8);
    h.advance(1);
    h.send({ type: 'block_action', action: 'place', x: 0, y: 10, z: 1, block_type: h.world.blocks.STONE });
    assert.equal(h.world.getBlock(0, 10, 1), h.world.blocks.STONE);
    h.advance(.2);
    h.send({ type: 'block_action', action: 'break', x: 0, y: 10, z: 1, block_type: h.world.blocks.STONE });
    assert.equal(h.world.getBlock(0, 10, 1), 0);
});

test('placements cannot replace solids, trap players, create survival bedrock, or edit through walls', t => {
    const h = setup(t);
    h.world.setBlock(3, 10, 1, h.world.blocks.STONE);
    h.send({ type: 'block_action', action: 'place', x: 3, y: 10, z: 1, block_type: h.world.blocks.DIRT });
    assert.equal(h.world.getBlock(3, 10, 1), h.world.blocks.STONE);
    h.send({ type: 'block_action', action: 'place', x: 1, y: 10, z: 1, block_type: h.world.blocks.STONE });
    assert.equal(h.world.getBlock(1, 10, 1), 0);
    h.send({ type: 'block_action', action: 'place', x: 0, y: 10, z: 1, block_type: h.world.blocks.BEDROCK });
    assert.equal(h.world.getBlock(0, 10, 1), 0);
    for (let y = 9; y < 14; y++) for (let z = -2; z <= 4; z++) h.world.setBlock(2, y, z, h.world.blocks.STONE);
    h.send({ type: 'block_action', action: 'break', x: 3, y: 10, z: 1, block_type: h.world.blocks.STONE });
    assert.equal(h.world.getBlock(3, 10, 1), h.world.blocks.STONE);
    h.send({ type: 'tnt_spawn', x: 3.5, y: 10, z: 1.5 });
    assert.equal(h.p.room.tnt.size, 0, 'explosives must not be spawned through walls');
});

test('server blast allowance cannot be redirected sideways', t => {
    const h = setup(t);
    h.send({ type: 'tnt_spawn', x: 1.5, y: 8, z: 1.5 });
    h.server.explode(h.p.room, h.p, [...h.p.room.tnt.values()][0]);
    h.advance(.05);
    h.send({ type: 'move', x: 4, y: 10, z: 1.5, yaw: 0, pitch: 0 });
    assert.equal(h.p.x, 1.5, 'vertical knockback must not authorize horizontal teleporting');
});

test('a chain reaction has a finite lifetime budget and preserves distant blocks', t => {
    const h = setup(t);
    for (let x = 2; x <= 100; x++) for (let z = 0; z <= 2; z++) h.world.setBlock(x, 9, z, h.world.blocks.STONE);
    for (let x = 3; x <= 100; x++) h.world.setBlock(x, 10, 1, h.world.blocks.TNT);
    let spawned = 0;
    const spawn = h.server.spawnExplosive.bind(h.server);
    h.server.spawnExplosive = (...args) => { spawned++; return spawn(...args); };
    h.send({ type: 'tnt_spawn', x: 3.5, y: 10, z: 1.5, vx: 0, vy: 3, vz: 0 });
    for (let i = 0; i < 120; i++) { h.advance(.05); h.server.tick(); }
    assert.ok(spawned > 1, 'ordinary chain reactions must still happen');
    assert.ok(spawned <= 16, 'active-entity limit alone must not allow endless propagation');
    assert.equal(h.p.room.tnt.size, 0);
    assert.equal(h.world.getBlock(100, 10, 1), h.world.blocks.TNT);
});

test('simultaneous C4 detonations have bounded work per tick and queued blasts finish', t => {
    const h = setup(t);
    for (let i = 0; i < 16; i++) {
        h.server.spawnExplosive(h.p.room, h.p, { kind: 'c4', request_id: `charge${i}`, x: 100.5 + i * 12,
            y: 28, z: 100.5, vx: 0, vy: 0, vz: 0, fuse: 2.2 });
        h.send({ type: 'tnt_detonate', request_id: `charge${i}` });
        h.send({ type: 'tnt_detonate', request_id: `charge${i}` });
    }
    assert.equal(h.server.pendingExplosions.length, 16, 'duplicate requests cannot enqueue duplicate work');
    h.server.tick();
    assert.equal(h.p.messages.filter(m => m.type === 'tnt_exploded').length, 8);
    h.server.tick();
    assert.equal(h.p.messages.filter(m => m.type === 'tnt_exploded').length, 16);
    assert.equal(h.server.pendingExplosions.length, 0);
});

test('normal time-spaced movement does not lose tolerance and rejected chunks can retry', t => {
    const h = setup(t);
    for (let i = 0; i < 20; i++) {
        h.advance(.05);
        h.send({ type: 'move', x: 1.5 + (i + 1) * .25, y: 10, z: 1.5, yaw: 0, pitch: 0 });
    }
    assert.equal(h.p.x, 6.5);
    for (let i = 0; i < 9; i++) h.send({ type: 'chunk_request', cx: 0, cz: 0 });
    assert.equal(h.p.messages.at(-1).type, 'chunk_rejected');
    h.advance(.1); h.send({ type: 'chunk_request', cx: 0, cz: 0 });
    assert.equal(h.p.messages.at(-1).type, 'chunk_state');
});

test('swept collision permits a normal jump over a ledge without permitting wall tunneling', t => {
    const h = setup(t);
    h.world.setBlock(2, 10, 1, h.world.blocks.STONE);
    h.advance(.15);
    h.send({ type: 'move', x: 2.3, y: 11.05, z: 1.5, yaw: 0, pitch: 0 });
    assert.equal(h.p.x, 2.3);
    assert.equal(h.p.y, 11.05);
});

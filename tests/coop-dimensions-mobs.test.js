'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthoritativeGameServer, WSClient } = require('../server');

function harness(t) {
    let now = 100;
    const game = new AuthoritativeGameServer({ clock: () => now });
    t.after(() => game.stop());
    const player = (room = 'coop_dims') => {
        const p = new WSClient(null, game); p.messages = []; p.send_json = m => p.messages.push(m);
        game.process_message(p, { type: 'join', room }); return p;
    };
    return { game, player, send: (p, m) => game.process_message(p, m), advance: n => { now += n; } };
}
const last = (p, type) => p.messages.findLast(m => m.type === type);

test('co-op dimensions are isolated: blocks, players, spawn and chunks differ per dimension', t => {
    const { player, send, advance } = harness(t), a = player(), b = player();
    advance(2);
    send(a, { type: 'dimension_change', dim: 'nether' });
    const state = last(a, 'dimension_state');
    assert.equal(state.dim, 'nether');
    assert.deepEqual([state.x, state.y, state.z], [1.5, 7.05, 2.5]);
    assert.deepEqual(state.players, []);
    assert.ok(last(b, 'player_left').moved);
    send(a, { type: 'dimension_change', dim: 'bogus' });                      // invalid dimension ignored
    assert.equal(a.dim, 'nether');

    // different terrain per dimension
    send(a, { type: 'chunk_request', cx: 0, cz: 0 });
    send(b, { type: 'chunk_request', cx: 0, cz: 0 });
    assert.notEqual(last(a, 'chunk_state').voxels, last(b, 'chunk_state').voxels);

    // a block placed in the nether is neither broadcast to nor stored for the overworld
    const world = a.room.world('nether');
    world.setBlock(1, 12, 2, 0); world.setBlock(1, 11, 2, 0);
    Object.assign(a, { x: 1.5, y: 12, z: 2.5 });
    const before = b.messages.length;
    send(a, { type: 'block_action', action: 'place', x: 1, y: 11, z: 2, block_type: 4 });
    assert.equal(b.messages.length, before);
    assert.equal(last(a, 'block_update')?.block_type, 4);
    const late = player();
    assert.deepEqual(late.messages[0].blocks, []);
    advance(2);
    send(a, { type: 'dimension_change', dim: 'overworld' });
    advance(2);
    send(a, { type: 'dimension_change', dim: 'nether' });
    assert.deepEqual(last(a, 'dimension_state').blocks.map(x => x.block_type), [4]);
    // player_moved only reaches the same dimension
    const moves = b.messages.length;
    send(a, { type: 'move', x: a.x, y: a.y, z: a.z, yaw: 0, pitch: 0 });
    assert.equal(b.messages.length, moves);
});

test('co-op respawn is never rate limited and lands on the current dimension spawn', t => {
    const { player, send, advance } = harness(t), a = player();
    send(a, { type: 'respawn' });
    assert.equal(last(a, 'player_respawned').id, a.id);
    send(a, { type: 'respawn' });                                              // 0s later: still honoured in co-op
    assert.equal(a.messages.filter(m => m.type === 'player_respawned').length, 2);
    advance(2);
    send(a, { type: 'dimension_change', dim: 'the_end' });
    send(a, { type: 'respawn' });
    const r = last(a, 'player_respawned');
    assert.deepEqual([r.x, r.y, r.z], [.5, 14.05, 18]);
});

test('mobs: one owner per dimension streams state, hits and damage are relayed, ownership migrates', t => {
    const { player, send, advance } = harness(t), a = player(), b = player();
    assert.equal(last(a, 'mob_owner').owner_id, a.id);
    assert.equal(last(b, 'mob_owner').owner_id, a.id);
    const mob = { id: 1, t: 'zombie', x: 3, y: 12, z: 3, yaw: 0, hp: 20, wc: 0 };
    send(b, { type: 'mob_sync', mobs: [mob] });                                // non-owner cannot publish
    assert.equal(last(a, 'mob_sync'), undefined);
    send(a, { type: 'mob_sync', mobs: [mob] });
    assert.equal(last(b, 'mob_sync').mobs[0].t, 'zombie');
    send(a, { type: 'mob_sync', mobs: [{ ...mob, x: NaN }] });                 // malformed snapshot rejected
    assert.equal(last(b, 'mob_sync').mobs[0].x, 3);

    send(b, { type: 'mob_hit', id: 1, damage: 7, kx: 1, kz: 0 });
    assert.deepEqual([last(a, 'mob_hit').id, last(a, 'mob_hit').from], [1, b.id]);
    send(b, { type: 'mob_hit', id: 1, damage: 9999 });
    assert.equal(a.messages.filter(m => m.type === 'mob_hit').length, 1);

    send(a, { type: 'mob_attack', target_id: b.id, amount: 6, reason: 'Зомбі' });
    assert.equal(last(b, 'mob_damage').amount, 6);
    send(b, { type: 'mob_attack', target_id: a.id, amount: 6 });               // only the owner can hurt people
    assert.equal(last(a, 'mob_damage'), undefined);

    send(a, { type: 'mob_loot', itemId: 'apple', count: 2, x: 3, y: 12, z: 3 });
    assert.equal(last(b, 'item_drop').itemId, 'apple');

    // mobs persist across an owner leaving: the new owner is handed the last snapshot
    send(a, { type: 'leave' });
    const owner = last(b, 'mob_owner');
    assert.equal(owner.owner_id, b.id);
    assert.equal(owner.mobs.length, 1);

    // mob state is per dimension
    advance(2);
    send(b, { type: 'dimension_change', dim: 'nether' });
    assert.deepEqual([last(b, 'mob_owner').dim, last(b, 'mob_owner').mobs], ['nether', []]);
});

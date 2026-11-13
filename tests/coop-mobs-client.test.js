'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

function load() {
    const c = vm.createContext({ THREE, console, document: { getElementById: () => null }, window: null,
        localStorage: { getItem: () => null }, WebSocket: { OPEN: 1, CONNECTING: 0 }, performance, setTimeout, clearTimeout });
    c.window = c;
    vm.runInContext('var MOB_DEFS = { zombie: {}, pig: {} };', c);
    vm.runInContext(fs.readFileSync('js/shared_world_client.js', 'utf8') + '\nthis.CoopMobs = CoopMobs;', c);
    return c;
}
function fakeMob(type, x, y, z) {
    return { type, position: new THREE.Vector3(x, y, z), group: { position: new THREE.Vector3(), rotation: { y: 0 } }, yaw: 0, health: 20,
        walkCycle: 0, isDead: false, hurtTimer: 0, _setTint() {}, resetColor() {}, takeDamage(a) { this.health -= a; this.hit = a; }, die(drop) { this.isDead = true; this.dropped = drop; } };
}
function setup(clientId = 'me') {
    const c = load(), sent = [];
    const mgr = { mobs: [], spawnMob(t, x, y, z) { const m = fakeMob(t, x, y, z); this.mobs.push(m); return m; }, _lootSink: null };
    const client = { clientId, engineAuthority: true, currentRoom: 'coop_x', loadingRoom: false, sendRaw: m => (sent.push(m), true),
        game: { mobManager: mgr, world: { dimension: 'overworld' }, multiplayer: { remotePlayers: new Map() }, player: { position: new THREE.Vector3(), isDead: false } } };
    return { net: new c.CoopMobs(client), mgr, client, sent, c };
}

test('role: pending until the server names an owner, then owner or puppet', () => {
    const { net } = setup();
    assert.equal(net.role(), 'pending');
    net.handleOwner({ dim: 'overworld', owner_id: 'other', mobs: [] });
    assert.equal(net.role(), 'puppet');
    net.handleOwner({ dim: 'overworld', owner_id: 'me', mobs: [] });
    assert.equal(net.role(), 'owner');
    net.handleOwner({ dim: 'nether', owner_id: 'other', mobs: [] });          // stale dimension ignored
    assert.equal(net.role(), 'owner');
});

test('new owner adopts the previous owner\'s mobs and keeps ids unique', () => {
    const { net, mgr } = setup();
    net.handleOwner({ dim: 'overworld', owner_id: 'me', mobs: [{ id: 7, t: 'zombie', x: 1, y: 2, z: 3, yaw: 1, hp: 11, wc: 0 }, { id: 8, t: 'nope', x: 0, y: 0, z: 0, yaw: 0, hp: 1, wc: 0 }] });
    assert.equal(mgr.mobs.length, 1);
    assert.deepEqual([mgr.mobs[0].netId, mgr.mobs[0].health], [7, 11]);
    const fresh = fakeMob('pig', 0, 0, 0); mgr.mobs.push(fresh);
    net.tickOwner(mgr, 1);
    assert.equal(fresh.netId, 8);
});

test('owner streams snapshots; puppets mirror them, relay hits and vanish when the owner removes the mob', () => {
    const owner = setup('me'), puppet = setup('p2');
    owner.net.handleOwner({ dim: 'overworld', owner_id: 'me', mobs: [] });
    owner.mgr.spawnMob('zombie', 5, 6, 7);
    owner.net.tickOwner(owner.mgr, 1);
    const sync = owner.sent.find(m => m.type === 'mob_sync');
    assert.equal(sync.mobs.length, 1);

    puppet.net.handleOwner({ dim: 'overworld', owner_id: 'me', mobs: [] });
    puppet.net.handleSync({ dim: 'overworld', mobs: sync.mobs });
    const mob = puppet.mgr.mobs[0];
    assert.equal(mob.isPuppet, true);
    for (let i = 0; i < 30; i++) puppet.net.updatePuppet(mob, .05);
    assert.ok(mob.group.position.distanceTo(new THREE.Vector3(5, 6, 7)) < .01);
    mob.takeDamage(6, { x: 1, z: 0 });                                          // hit goes to the owner, not applied locally
    assert.deepEqual(JSON.parse(JSON.stringify(puppet.sent.at(-1))), { type: 'mob_hit', id: sync.mobs[0].id, damage: 6, kx: 1, kz: 0 });
    assert.equal(mob.isDead, false);

    owner.net.handleHit({ id: sync.mobs[0].id, damage: 6, kx: 1, kz: 0, from: 'p2' });
    puppet.net.handleSync({ dim: 'overworld', mobs: [] });
    assert.equal(mob.isDead, true);
});

test('owner targets the nearest player (local or remote) and routes remote damage through the server', () => {
    const { net, client, sent } = setup('me');
    net.handleOwner({ dim: 'overworld', owner_id: 'me', mobs: [] });
    const rp = { group: { position: new THREE.Vector3(50, 0, 0) }, health: 100 };
    client.game.multiplayer.remotePlayers.set('p2', rp);
    const local = client.game.player;
    assert.equal(net.nearestTarget(new THREE.Vector3(1, 0, 0), local), local);
    const target = net.nearestTarget(new THREE.Vector3(48, 0, 0), local);
    assert.equal(target.id, 'p2');
    target.takeDamage(8, 'Зомбі');
    assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))), { type: 'mob_attack', target_id: 'p2', amount: 8, reason: 'Зомбі' });
    local.isDead = true;                                                        // dead local player is not targeted
    assert.equal(net.nearestTarget(new THREE.Vector3(1, 0, 0), local).id, 'p2');
});

test('owner shares mob loot through the server and damages its mobs with room explosions', () => {
    const { net, mgr, sent } = setup('me');
    net.handleOwner({ dim: 'overworld', owner_id: 'me', mobs: [] });
    const dropped = [];
    mgr.spawnItemDrop = function (x, y, z, id, n) { if (this._lootSink && this._lootSink(x, y, z, id, n)) return null; dropped.push(id); return {}; };
    net.shareLoot(mgr, () => mgr.spawnItemDrop(1, 2, 3, 'apple', 2));
    assert.equal(dropped.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))), { type: 'mob_loot', itemId: 'apple', count: 2, x: 1, y: 2, z: 3 });
    assert.equal(mgr._lootSink, null);                                          // only for the duration of the kill

    const near = mgr.spawnMob('zombie', 1, 0, 0), far = mgr.spawnMob('zombie', 40, 0, 0);
    net.blast({ x: 0, y: 0, z: 0, radius: 3.8 });
    assert.ok(near.hit > 3); assert.equal(far.hit, undefined);
});

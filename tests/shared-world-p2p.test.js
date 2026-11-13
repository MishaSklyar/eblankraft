'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

function load() {
    const c = vm.createContext({ THREE, console, document: { getElementById: () => null }, window: null, performance, setTimeout, clearTimeout,
        localStorage: { getItem: () => null }, WebSocket: { OPEN: 1 } });
    c.window = c;
    vm.runInContext('var MOB_DEFS = { zombie: {} }; class RemotePlayerStub {}', c);
    vm.runInContext(fs.readFileSync('js/shared_world_client.js', 'utf8') + '\nthis.CoopMobs = CoopMobs;', c);
    // MultiplayerManager's file pulls in DOM-heavy classes; only the class bodies are needed here.
    vm.runInContext(fs.readFileSync('js/multiplayer.js', 'utf8') + '\nthis.MultiplayerManager = MultiplayerManager; this.P2PMobLink = P2PMobLink;', c);
    return c;
}

function peer(c, { host, id }) {
    const sent = [];
    const world = { dimension: 'overworld', applyingRemote: false, edits: [], setBlock(x, y, z, t, d) { this.edits.push([x, y, z, t, d, this.applyingRemote]); }, updateMeshes() {} };
    const mgr = { mobs: [], itemDrops: [], _lootSink: null, spawnMob(t, x, y, z) { const m = { type: t, position: new THREE.Vector3(x, y, z), isDead: false, _setTint() {}, die() { this.isDead = true; }, takeDamage(a) { this.hit = a; } }; this.mobs.push(m); return m; },
        spawnItemDrop(x, y, z, id, n) { if (this._lootSink && this._lootSink(x, y, z, id, n)) return null; const d = { x, y, z, id, count: n, destroy() {} }; this.itemDrops.push(d); return d; } };
    const player = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), damage: [], takeDamage(a, r) { this.damage.push([a, r]); } };
    const mp = Object.create(c.MultiplayerManager.prototype);
    Object.assign(mp, { isHost: host, isConnected: true, peer: {}, peerId: id, game: { world, mobManager: mgr, player, arenaClient: null, timeOfDay: 0.2, particleSystem: null, soundManager: null },
        remotePlayers: new Map(), connections: new Map(), pendingBlocks: new Map(), sendTimer: 0, hostConnection: null });
    mp.mobs = new c.CoopMobs(new c.P2PMobLink(mp));
    mp.broadcast = (p, except) => { sent.push({ p, except }); return true; };
    mp.sendToPeer = (to, p) => { sent.push({ p, to }); return true; };
    return { mp, sent, world, mgr, player };
}

test('block edits from any source are batched and replicated, and remote edits are not echoed', () => {
    const c = load(), a = peer(c, { host: true, id: 'host' }), b = peer(c, { host: false, id: 'guest' });
    assert.equal(a.mp.netGuest, false); assert.equal(b.mp.netGuest, true);
    a.mp.queueBlock(1, 2, 3, 5, null); a.mp.queueBlock(1, 2, 3, 0, null); a.mp.queueBlock(4, 5, 6, 7, { solid: true });
    a.mp.flushBlocks();
    const pkt = a.sent.at(-1).p;
    assert.equal(pkt.type, 'blocks');
    assert.equal(pkt.list.length, 2);                                       // same cell collapses to the latest value
    b.mp.handlePacket(JSON.parse(JSON.stringify(pkt)), 'host');
    assert.deepEqual(JSON.parse(JSON.stringify(b.world.edits)), [[1, 2, 3, 0, null, true], [4, 5, 6, 7, { solid: true }, true]]);
    assert.equal(b.world.applyingRemote, false);
    b.mp.handlePacket({ type: 'blocks', dim: 'nether', list: [[9, 9, 9, 1, 0]] }, 'host');   // other dimension ignored
    assert.equal(b.world.edits.length, 2);
    // the host relays a guest's edits to everyone else
    a.mp.handlePacket({ type: 'blocks', dim: 'overworld', list: [[1, 1, 1, 3, 0]] }, 'guest');
    assert.deepEqual([a.sent.at(-1).p.type, a.sent.at(-1).except], ['blocks', 'guest']);
});

test('explosions hurt and push other players, but not the thrower, and creeper fx do no damage', () => {
    const c = load(), g = peer(c, { host: false, id: 'guest' });
    g.player.position.set(2, 0, 0);
    g.mp.handlePacket({ type: 'explosion', x: 0, y: 0, z: 0, radius: 8, from: 'host', dim: 'overworld' }, 'host');
    assert.equal(g.player.damage.length, 1); assert.ok(g.player.velocity.x > 0);
    g.mp.handlePacket({ type: 'explosion', x: 0, y: 0, z: 0, radius: 2.4, fx: true, from: 'host', dim: 'overworld' }, 'host');
    g.mp.handlePacket({ type: 'explosion', x: 0, y: 0, z: 0, radius: 8, from: 'guest', dim: 'overworld' }, 'host');
    g.mp.handlePacket({ type: 'explosion', x: 0, y: 0, z: 0, radius: 8, from: 'host', dim: 'nether' }, 'host');
    assert.equal(g.player.damage.length, 1);
});

test('host owns mobs: guests mirror them, hits and damage and loot travel over the star', () => {
    const c = load(), host = peer(c, { host: true, id: 'host' }), guest = peer(c, { host: false, id: 'guest' });
    host.mp.announceMobOwner();
    assert.equal(host.mp.mobs.role(), 'owner');
    guest.mp.handlePacket(JSON.parse(JSON.stringify(host.sent.at(-1).p)), 'host');
    assert.equal(guest.mp.mobs.role(), 'puppet');

    const zombie = host.mgr.spawnMob('zombie', 3, 4, 5);
    host.mp.mobs.tickOwner(host.mgr, 1);
    const sync = JSON.parse(JSON.stringify(host.sent.at(-1).p));
    assert.equal(sync.type, 'mob_sync');
    guest.mp.handlePacket(sync, 'host');
    const puppet = guest.mgr.mobs[0];
    assert.ok(puppet.isPuppet);

    puppet.takeDamage(7, { x: 1, z: 0 });                                  // the guest's hit goes to the host...
    const hit = JSON.parse(JSON.stringify(guest.sent.at(-1).p));
    assert.equal(hit.type, 'mob_hit');
    host.mp.handlePacket(hit, 'guest');                                    // ...and lands on the real mob
    assert.equal(zombie.hit, 7);

    host.mp.mobs.proxy('guest', { group: { position: new THREE.Vector3() } }).takeDamage(6, 'Зомбі');   // host mob bites the guest
    const bite = host.sent.at(-1);
    assert.deepEqual([bite.to, bite.p.type, bite.p.amount], ['guest', 'mob_damage', 6]);
    guest.mp.handlePacket(JSON.parse(JSON.stringify(bite.p)), 'host');
    assert.equal(guest.player.damage[0][0], 6);

    host.mp.mobs.shareLoot(host.mgr, () => host.mgr.spawnItemDrop(0, 0, 0, 'apple', 2));   // loot: dropped for everyone, once
    const drop = JSON.parse(JSON.stringify(host.sent.find(s => s.p.type === 'item_drop').p));
    assert.equal(host.mgr.itemDrops.length, 1);
    guest.mp.handlePacket(drop, 'host');
    assert.equal(guest.mgr.itemDrops[0].netId, drop.drop_id);
    guest.mp.handlePacket({ type: 'item_taken', id: drop.drop_id }, 'host');
    assert.equal(guest.mgr.itemDrops[0].pickedUp, true);
});

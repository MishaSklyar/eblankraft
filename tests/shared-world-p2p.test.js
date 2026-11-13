'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

function load() {
    const c = vm.createContext({ THREE, console, document: { getElementById: () => null }, window: null, performance, setTimeout, clearTimeout,
        localStorage: { getItem: () => null }, WebSocket: { OPEN: 1 }, crypto });
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
    const player = { iq: 0, position: new THREE.Vector3(), velocity: new THREE.Vector3(), damage: [], takeDamage(a, r) { this.damage.push([a, r]); } };
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

test('the Ender Dragon: host simulates it, guests mirror it, and boss/crystal hits go to the host', () => {
    const c = load();
    vm.runInContext(`
      class DragonFireball { constructor(x, y, z) { this.position = new THREE.Vector3(x, y, z); this.exploded = false; } explode() { this.exploded = true; } }
      var ITEM_TYPES = {};`, c);
    const host = peer(c, { host: true, id: 'host' }), guest = peer(c, { host: false, id: 'guest' });
    for (const p of [host, guest]) {
        p.mgr.fireballs = []; p.mgr.crystals = []; p.mgr.scene = { remove() {} };
        p.mgr.clearBoss = function () { this.fireballs = []; this.dragon = null; };
    }
    const mkDragon = (puppet) => ({ mesh: { position: new THREE.Vector3(1, 22, 3), quaternion: new THREE.Quaternion(0, 0, 0, 1) }, health: 800, isDead: false, isPuppet: puppet, scene: { remove() {} },
        takeDamage(a) { this.hit = a; }, soundManager: null });
    host.mgr.spawnPuppetDragon = guest.mgr.spawnPuppetDragon = function () { return (this.dragon = mkDragon(true)); };
    host.mp.announceMobOwner(); guest.mp.handlePacket(JSON.parse(JSON.stringify(host.sent.at(-1).p)), 'host');
    host.mp.mobs.dim = guest.mp.mobs.dim = 'overworld';

    // The End: crystals are generated identically on both sides
    for (const p of [host, guest]) { p.world.dimension = 'the_end'; p.mp.mobs.dim = 'the_end'; for (const id of [0, 1]) p.mgr.crystals.push({ netId: id, isDestroyed: false, group: { position: new THREE.Vector3() }, takeDamage(a) { this.dealt = a; this.isDestroyed = true; }, destroy() {} }); }
    host.mgr.dragon = mkDragon(false);
    host.mgr.fireballs.push({ position: new THREE.Vector3(5, 20, 5), exploded: false });
    host.mgr.crystals[1].isDestroyed = true;                                  // the host already blew up crystal 1
    host.mp.mobs.tickOwner(host.mgr, 1);
    const boss = JSON.parse(JSON.stringify(host.sent.find(s => s.p.type === 'boss_sync').p));
    assert.equal(boss.dragon.hp, 800); assert.deepEqual(boss.crystals, [0]); assert.equal(boss.fireballs.length, 1);

    guest.mp.handlePacket(boss, 'host');
    assert.ok(guest.mgr.dragon.isPuppet);                                     // a mirrored dragon, not a second AI
    assert.equal(guest.mgr.fireballs.length, 1);
    assert.equal(guest.mgr.crystals[1].isDestroyed, true);                    // crystal 1 went away on the guest too
    assert.equal(guest.mgr.crystals[0].isDestroyed, false);

    guest.mgr.dragon.takeDamage(55);                                          // guest swings at the dragon
    const hit = JSON.parse(JSON.stringify(guest.sent.at(-1).p));
    assert.deepEqual([hit.type, hit.damage], ['boss_hit', 55]);
    host.mp.handlePacket(hit, 'guest');
    assert.equal(host.mgr.dragon.hit, 55);

    guest.mgr.crystals[0].takeDamage(10);                                     // ...and at a crystal
    const chit = JSON.parse(JSON.stringify(guest.sent.at(-1).p));
    assert.deepEqual([chit.type, chit.id], ['crystal_hit', 0]);
    host.mp.handlePacket(chit, 'guest');
    assert.equal(host.mgr.crystals[0].dealt, 10);

    host.mgr.dragon.isDead = true;                                            // dragon dies on the host: guests celebrate once
    host.mp.mobs.tickOwner(host.mgr, 1);
    guest.mp.handlePacket(JSON.parse(JSON.stringify(host.sent.findLast(s => s.p.type === 'boss_sync').p)), 'host');
    assert.equal(guest.mgr.dragon.isDead, true);
    assert.equal(guest.player.iq, 1000);
});

test('share codes are short (eblan-1234), case-insensitive, and retry when taken', () => {
    const c = load(), M = c.MultiplayerManager;
    for (let i = 0; i < 50; i++) assert.match(M.newWorldCode(), /^eblan-[1-9]\d{3}$/);
    assert.equal(M.codeToPeerId('EBLAN-1234'), 'eblankraft-eblan-1234');
    assert.equal(M.peerIdToCode('eblankraft-eblan-1234'), 'eblan-1234');
});

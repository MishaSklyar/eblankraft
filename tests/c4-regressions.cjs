const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, console, performance, setTimeout, clearTimeout,
    assert, BLOCK_TYPES: { AIR: 0, TNT: 11, BEDROCK: 15 }, CHUNK_SIZE_Y: 128 });
for (const name of ['three.min.js', 'items.js', 'particles.js', 'player.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', name), 'utf8'), context);
}
vm.runInContext(`
const scene = new THREE.Scene();
const game = { tntEntities: [], ui: { showToast() {} }, arenaClient: { isActive: false } };
const world = { getBlock: () => BLOCK_TYPES.AIR, setBlock() {}, updateMeshes() {} };
const textures = { getBlockMaterial: () => new THREE.MeshBasicMaterial(), getItemDropMaterial: () => new THREE.MeshBasicMaterial() };
const sound = { playFuse() {}, playExplosion() {} };
const particles = { particles: [], spawnExplosionParticles() {}, spawnBlockBreakParticles() {} };
const player = Object.create(Player.prototype);
let consumed = 0;
Object.assign(player, { game, world, scene, soundManager: sound, particleSystem: particles,
    position: new THREE.Vector3(20, 10, 20), width: 0.6, height: 1.8, depth: 0.6,
    targetBlock: { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, type: 1 },
    getSelectedItem: () => ({ itemId: ITEM_TYPES.C4, count: 3 }),
    removeItem: (id, count) => { assert.equal(id, ITEM_TYPES.C4); consumed += count; } });
game.textureManager = textures;
player.placeBlock();
assert.equal(consumed, 1);
assert.equal(game.tntEntities.length, 1);
const charge = game.tntEntities[0];
charge.update(1000);
assert.equal(charge.exploded, false);
assert.equal(charge.y, 1);
assert.equal(charge.blastRadius, 5.5);
player._lastPlaceTime = 0;
player.placeBlock();
assert.equal(consumed, 1, 'duplicate position must not consume another charge');
game.arenaClient.isActive = true;
player.detonateTNT();
assert.equal(charge.exploded, false, 'arena must prohibit detonation');
game.arenaClient.isActive = false;
player.detonateTNT();
assert.equal(charge.exploded, true);
assert.equal(scene.children.length, 0);
player.detonateTNT();
assert.equal(consumed, 1, 'empty C4 detonator must not throw TNT');
const tnt = new TNTEntity(0, 1, 0, scene, textures, sound, world, particles, game);
assert.equal(tnt.fuse, 2.2);
assert.equal(tnt.blastRadius, 3.8);
assert.ok(CRAFTING_RECIPES.find(r => r.id === 'craft_c4'));
`, context);
for (const name of ['items.js', 'textures.js', 'particles.js', 'player.js']) {
    assert.equal(fs.readFileSync(path.join(root, 'js', name), 'utf8'), fs.readFileSync(path.join(root, 'web/js', name), 'utf8'));
}
console.log('PASS: C4 placement, consumption, stationary charge, duplicate prevention, arena guard, detonation, TNT defaults, recipe, source parity');

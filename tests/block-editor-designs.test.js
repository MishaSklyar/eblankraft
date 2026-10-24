const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');
const { AuthorityWorld } = require('../server/engine');
const { AuthoritativeGameServer, WSClient } = require('../server');
const design = (shape = 'slab', extra = {}) => ({ shape, color: '#318fcb', opacity: .6, solid: true, emissive: .2, ...extra });
function world() { const w = new AuthorityWorld(123, { worldType: 'flat' }); w.chunk(0, 0).fill(0); w.world.modifiedBlocks.clear(); return w; }

test('arbitrary materials retain independent per-cell shape, RGB and properties', () => {
    const w = world();
    for (const type of [w.blocks.GLASS, w.blocks.WATER, w.blocks.RED_FLOWER, w.blocks.TNT, w.blocks.COAL_ORE]) {
        w.setBlock(4, 10, 4, type, design());
        assert.equal(w.getBlock(4, 10, 4), type);
        assert.deepEqual(JSON.parse(JSON.stringify(w.getBlockDesign(4, 10, 4))), design());
        assert.equal(w.collides(4.5, 10.5, 4.5), false);
        assert.equal(w.collides(4.5, 10.4, 4.5), true);
        w.setBlock(6, 10, 4, type);
        assert.equal(w.getBlockDesign(6, 10, 4), null);
    }
    w.setBlock(4, 10, 4, w.blocks.STONE, design('cube', { solid: false }));
    assert.equal(w.collides(4.5, 10, 4.5), false);
    w.setBlock(4, 10, 4, 0); assert.equal(w.getBlockDesign(4, 10, 4), null);
});

test('custom pixel occupancy drives both geometry and authoritative collision', () => {
    const w = world(), value = design('custom', { cells: [0, 1], opacity: 1 });
    w.setBlock(4, 10, 4, w.blocks.GLASS, value);
    assert.equal(w.collides(4.1, 10, 4.1), true);
    assert.equal(w.collides(4.8, 10, 4.8), false);
    const material = new THREE.MeshLambertMaterial();
    const manager = { getBlockMaterial: () => material, getDesignMaterial: () => material };
    const chunk = w.world.getChunk(0, 0); chunk.rebuildMesh(manager, null);
    // Two adjacent pixels merge into one cuboid with six exposed rectangles.
    assert.equal(chunk.mesh.geometry.getAttribute('position').count, 36);
    assert.equal(chunk.mesh.geometry.boundingBox.containsPoint(new THREE.Vector3(4.25, 10.125, 4.125)), true);
});

test('JSON, dimension states, snapshots and edit replay keep complete designs', async () => {
    const w = world(), value = design('custom', { cells: [0, 64, 128] });
    w.setBlock(4, 10, 4, w.blocks.STONE, value);
    const replay = w.world.getModifiedBlocksArray();
    assert.deepEqual(JSON.parse(JSON.stringify(replay[0].design)), value);
    w.world.createSnapshot('editor', 4, 10, 4, 4, 10, 4);
    w.setBlock(4, 10, 4, w.blocks.DIRT); w.world.restoreSnapshot('editor');
    assert.deepEqual(JSON.parse(JSON.stringify(w.getBlockDesign(4, 10, 4))), value);
    const json = w.world.exportJSON();
    const restored = world(); restored.world.generateTerrain = () => {}; restored.world.importJSON(json);
    assert.deepEqual(JSON.parse(JSON.stringify(restored.getBlockDesign(4, 10, 4))), value);
    w.world.initWorld = () => {}; w.world.preloadChunksAsync = async () => {}; w.world.updateMeshes = () => {};
    await w.world.switchDimension('nether'); assert.equal(w.getBlockDesign(4, 10, 4), null);
    await w.world.switchDimension('overworld');
    assert.deepEqual(JSON.parse(JSON.stringify(w.getBlockDesign(4, 10, 4))), value);
});

test('creative server validates, echoes and replays designs and clone inventory metadata', t => {
    const game = new AuthoritativeGameServer(); t.after(() => game.stop());
    const join = () => {
        const p = new WSClient(null, game); p.messages = []; p.send_json = msg => p.messages.push(msg);
        game.process_message(p, { type: 'join', room: 'coop_designs', mode: 'creative' }); return p;
    };
    const p = join(), w = p.room.world(); w.chunk(0, 0).fill(0); w.world.modifiedBlocks.clear();
    Object.assign(p, { x: .5, y: 10, z: .5 }); w.setBlock(3, 11, 0, w.blocks.GLASS);
    const value = design('custom', { cells: [0, 1, 2] });
    const msg = { type: 'block_action', action: 'place', x: 3, y: 11, z: 0, block_type: w.blocks.WATER, expected_type: w.blocks.GLASS, design: value };
    game.process_message(p, msg);
    assert.equal(w.getBlock(3, 11, 0), w.blocks.WATER);
    assert.deepEqual(JSON.parse(JSON.stringify(w.getBlockDesign(3, 11, 0))), value);
    const late = join(); assert.deepEqual(JSON.parse(JSON.stringify(late.messages[0].blocks[0].design)), value);
    game.process_message(p, { type: 'inventory_sync', inventory: [{ itemId: 'water', count: 64, design: value }], selected_slot: 0 });
    assert.deepEqual(JSON.parse(JSON.stringify(p.inventory[0].design)), value);
    for (const bad of [design('bogus'), design('custom', { cells: [512] }), design('cube', { opacity: -1 }), design('cube', { color: 'url(bad)' })]) {
        game.process_message(p, { ...msg, expected_type: w.blocks.WATER, design: bad });
        assert.deepEqual(JSON.parse(JSON.stringify(w.getBlockDesign(3, 11, 0))), value);
    }
    p.room.mode = 'survival';
    game.process_message(p, { ...msg, expected_type: w.blocks.WATER, design: design('cube') });
    assert.deepEqual(JSON.parse(JSON.stringify(w.getBlockDesign(3, 11, 0))), value);
});

test('clone keeps material and complete design in the selected inventory slot', () => {
    const w = world();
    vm.runInContext(fs.readFileSync('js/items.js', 'utf8'), w.context);
    vm.runInContext(fs.readFileSync('js/block_editor.js', 'utf8'), w.context);
    const value = design('custom', { cells: [0, 1] }); w.setBlock(4, 10, 4, w.blocks.STONE, value);
    const player = { isCreative: true, world: w, selectedHotbarIndex: 2, inventory: Array(27).fill(null),
        saveInventoryDebounced() {}, updateHeldBlock() {}, syncInventoryWithServer() {}, game: {} };
    w.context.BlockEditor.clone({ player }, { x: 4, y: 10, z: 4, type: w.blocks.STONE });
    assert.equal(player.inventory[2].itemId, 'stone');
    assert.deepEqual(JSON.parse(JSON.stringify(player.inventory[2].design)), value);
    player.inventory[2].design.cells.pop();
    assert.equal(w.getBlockDesign(4, 10, 4).cells.length, 2, 'clone is independent');
});

test('editor and edited game sources match root and web versions', () => {
    for (const file of ['block_editor.js', 'textures.js', 'items.js', 'world.js', 'player.js', 'controls.js', 'multiplayer.js', 'shared_world_client.js'])
        assert.equal(fs.readFileSync('js/' + file, 'utf8'), fs.readFileSync('web/js/' + file, 'utf8'), file);
});

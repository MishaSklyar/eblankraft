const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'web/js', name), 'utf8');
const storage = new Map();
const errors = [];
const cards = [];
const container = { innerHTML: '', appendChild: card => cards.push(card) };
const context = vm.createContext({
    window: { focus() {} },
    navigator: { userAgent: 'Desktop', hardwareConcurrency: 8 },
    document: {
        activeElement: null,
        body: { classList: { add() {}, contains: () => false } },
        getElementById: id => id === 'mm-worlds-list' ? container : null,
        createElement: () => {
            const fields = {};
            return { getContext: () => null, querySelector: selector => fields[selector] ||= {} };
        }
    },
    localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value))
    },
    console: { log() {}, error: (...args) => errors.push(args.join(' ')) },
    PerlinNoise: class {},
    BLOCK_TYPES: { AIR: 0, STONE: 1 },
    setTimeout, clearTimeout,
    ITEM_TYPES: Object.fromEntries(['WOOD_PICKAXE', 'WOOD_SWORD', 'PLANKS', 'APPLE', 'COBBLESTONE', 'GLOWSTONE', 'TNT', 'CRAFTING_TABLE', 'EBLAN_BLOCK'].map(key => [key, key]))
});
vm.runInContext(read('three.min.js'), context);
vm.runInContext(read('world.js'), context);
vm.runInContext(read('ui.js'), context);
vm.runInContext(read('player.js'), context);
vm.runInContext(read('multiplayer.js'), context);

function world() {
    const w = Object.create(context.window.VoxelWorld.prototype);
    Object.assign(w, {
        seed: 42, worldType: 'normal', chunkRadius: 1, chunks: {},
        scene: { remove() {} }, modifiedBlocks: new Map(), blockHistory: new Map(),
        activeWaterBlocks: new Map(), isGeneratingTerrain: true, trackModifications: false,
        updateMeshes() {},
        generateTerrain() { this.setBlock(1, 1, 1, 1); }
    });
    w.invalidateChunkCache();
    w.generateTerrain();
    w.trackModifications = true;
    return w;
}

async function main() {
    let launchedSeed;
    const ui = Object.create(context.window.UIManager.prototype);
    Object.assign(ui, {
        game: { initWorld: (type, seed) => { launchedSeed = seed; } },
        getMMWorldsList: () => [], closeMainMenu() {}, showPreloader() {},
        hidePreloader: async () => {}
    });
    await ui.launchWorld({ id: 'test', name: 'Test', seed: 42 });
    assert.equal(launchedSeed, 42);
    assert.deepEqual(errors, []);

    const stream = world();
    stream.worldType = 'flat';
    stream.dimension = 'overworld';
    stream.waterLevel = 6;
    stream.chunkGenQueue = [];
    stream.spawnCarMapVehicles = () => {};
    stream.generateTerrain = function () { this.generateSingleChunk(0, 0); };
    context.window.EblanEng = {
        ready: true, currentSeed: 42, setSeed() {},
        generateChunk: () => new Uint8Array(8192).fill(1)
    };
    stream.clearWorld();
    stream.generateSingleChunk(0, 0);
    stream.setBlock(1, 1, 1, 0);
    stream.setBlock(2, 1, 1, 3);
    stream.chunks['0,0'].dispose();
    delete stream.chunks['0,0'];
    stream.invalidateChunkCache();
    stream.generateSingleChunk(0, 0);
    assert.equal(stream.getBlock(1, 1, 1), 0, 'streaming must restore AIR');
    assert.equal(stream.getBlock(2, 1, 1), 3, 'streaming must restore placed blocks');
    await stream.switchDimension('nether');
    assert.equal(stream.getBlock(1, 1, 1), 1, 'overworld edits must not leak into nether');
    stream.setBlock(1, 1, 1, 4);
    await stream.switchDimension('overworld');
    assert.equal(stream.getBlock(1, 1, 1), 0, 'portal round trip must restore overworld');
    await stream.switchDimension('nether');
    assert.equal(stream.getBlock(1, 1, 1), 4, 'nether must keep its own edits');
    const dimensionSave = stream.exportJSON();
    stream.importJSON(dimensionSave);
    assert.equal(stream.dimension, 'nether');
    assert.equal(stream.getBlock(1, 1, 1), 4);
    await stream.switchDimension('overworld');
    assert.equal(stream.getBlock(1, 1, 1), 0, 'inactive dimension must survive save/load');
    context.window.EblanEng.ready = false;
    stream.generateSingleOverworldChunk = chunk => chunk.voxels.fill(1);
    stream.clearWorld();
    stream.generateSingleChunk(0, 0);
    assert.equal(stream.getBlock(1, 1, 1), 0, 'JS generator must restore AIR too');
    const generateChunk = stream.generateSingleChunk;
    stream.generateSingleChunk = function (cx, cz) {
        const chunk = generateChunk.call(this, cx, cz);
        chunk.rebuildMesh = () => {};
        return chunk;
    };
    for (const chunk of Object.values(stream.chunks)) chunk.rebuildMesh = () => {};
    stream.buildNetherPortal = () => stream.setBlock(1, 1, 1, 1);
    stream.buildStarterVillage = () => {};
    await stream.preloadChunksAsync();
    assert.equal(stream.getBlock(1, 1, 1), 0, 'preload structures must not overwrite saved edits');
    delete context.window.EblanEng;

    const player = Object.create(context.window.Player.prototype);
    player.updateHeldBlock = () => {};
    player.spawnSafe = () => {};
    const legacyInventory = Array(27).fill(null);
    legacyInventory[0] = { itemId: 'legacy', count: 5 };
    storage.set('eblankraft_inventory', JSON.stringify(legacyInventory));
    storage.set('eblankraft_active_world_id', 'world_main');
    player.loadInventoryForWorld('world_main');
    assert.equal(player.inventory[0].itemId, 'legacy', 'existing active inventory must migrate');
    player.inventory[0] = { itemId: 'diamond', count: 64 };
    player.saveInventoryDebounced();
    player.loadInventoryForWorld('second');
    assert.equal(player._saveInvTimer, null);
    assert.equal(player.inventory[0].itemId, 'WOOD_PICKAXE', 'new world must get starter inventory');
    player.inventory[0] = { itemId: 'apple', count: 3 };
    player.loadInventoryForWorld('world_main');
    assert.equal(player.inventory[0].itemId, 'diamond');
    player.loadInventoryForWorld('second');
    assert.equal(player.inventory[0].itemId, 'apple');

    ui.game.player = player;
    ui.game.world = { preloadChunksAsync: async () => {} };
    await ui.launchWorld({ id: 'second', name: 'Second', mode: 'creative' });
    assert.equal(player.isFlying, true);
    await ui.launchWorld({ id: 'world_main', name: 'Main', mode: 'hardcore' });
    assert.equal(player.isFlying, false);
    assert.equal(player.isCreative, false);
    assert.equal(player.hardcore, true);
    await ui.launchWorld({ id: 'second', name: 'Second', mode: 'survival' });
    assert.equal(player.hardcore, false);
    assert.equal(player.godMode, false);

    let reseeds = 0;
    const multiplayer = Object.create(context.window.MultiplayerManager.prototype);
    Object.assign(multiplayer, {
        isHost: true, hostConnection: { peer: 'host' },
        game: { world: { reseedWorld: () => reseeds++ } }, showToast() {}
    });
    const packet = { type: 'world_init', seed: 123 };
    multiplayer.handlePacket(packet, 'client');
    assert.equal(reseeds, 0, 'host must reject client world_init');
    multiplayer.isHost = false;
    multiplayer.handlePacket(packet, 'stranger');
    assert.equal(reseeds, 0, 'client must reject unknown sender');
    multiplayer.handlePacket(packet, 'host');
    assert.equal(reseeds, 1, 'client must accept its actual host');

    const original = world();
    original.setBlock(1, 1, 1, 0);
    original.setBlock(2, 1, 1, 1);
    const restored = world();
    const oldChunk = restored.getChunk(0, 0);
    let removed = 0, disposed = 0;
    restored.scene.remove = () => removed++;
    oldChunk.mesh = { geometry: { dispose: () => disposed++ } };
    oldChunk.waterMesh = { geometry: { dispose: () => disposed++ } };
    restored.importJSON(original.exportJSON());
    assert.equal(restored.getBlock(1, 1, 1), 0, 'mined block must remain AIR');
    assert.equal(restored.getBlock(2, 1, 1), 1, 'placed block must survive');
    assert.equal(removed, 2);
    assert.equal(disposed, 2);
    assert.notEqual(restored.getChunk(0, 0), oldChunk, 'chunk cache must be invalidated');
    assert.equal(restored.modifiedBlocks.get('1,1,1'), 0);
    assert.equal(restored.trackModifications, true);
    restored.importJSON(restored.exportJSON());
    assert.equal(restored.getBlock(1, 1, 1), 0, 'AIR must survive repeated saves');

    restored.importJSON(JSON.stringify({ seed: 42, customBlocks: [[2, 1, 1, 1]] }));
    assert.equal(restored.getBlock(1, 1, 1), 1, 'legacy terrain must still generate');
    assert.equal(restored.getBlock(2, 1, 1), 1, 'legacy blocks must still load');
    assert.deepEqual(errors, []);

    const payload = '<img src=x onerror="throw 1">';
    ui.getMMWorldsList = () => [{ id: 'test', name: payload, type: payload, seed: payload }];
    ui.renderMMWorldsList();
    assert.equal(cards.length, 1);
    assert.ok(!cards[0].innerHTML.includes(payload));
    for (const field of ['name', 'type', 'seed']) {
        assert.equal(cards[0].querySelector('.mm-world-' + field).textContent, payload);
    }

    // Run the actual initialization prefix without constructing a WebGL renderer.
    const game = read('game.js');
    const prefix = game.slice(game.indexOf('        window.game = this;'), game.indexOf('        this.cloudOffset = 0;'));
    for (const value of ['0', 'false', '1', 'true', null]) {
        for (const key of ['wind_leaves', 'underwater_fx', 'quick_mods']) {
            if (value === null) storage.delete('eblankraft_' + key);
            else storage.set('eblankraft_' + key, value);
        }
        const settings = vm.runInContext('(function() {' + prefix + '; return this;}).call({})', context);
        const expected = value !== '0' && value !== 'false';
        for (const key of ['windLeavesEnabled', 'underwaterEffectsEnabled', 'quickModsEnabled']) {
            assert.equal(settings[key], expected, key + ' with ' + value);
        }
    }
    for (const name of ['ui.js', 'world.js', 'game.js', 'player.js', 'multiplayer.js']) {
        assert.equal(fs.readFileSync(path.join(root, 'js', name), 'utf8'), read(name));
    }
    console.log('PASS: launch seed, AIR/placed blocks, mesh disposal/cache, legacy saves, safe fields, settings, streaming, dimension persistence, isolated inventories, mode reset, world_init authorization, source parity');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

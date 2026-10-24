'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const THREE = require('../js/three.min.js');
const { editReplayHarness, streamingHarness } = require('./streaming-harness.cjs');

test('chunk replay avoids distant edits and preserves AIR, overwrite, deletion and Map ordering', () => {
    const { world, chunk, replay } = editReplayHarness();
    let visited = 0;
    const iterator = world.modifiedBlocks[Symbol.iterator].bind(world.modifiedBlocks);
    world.modifiedBlocks[Symbol.iterator] = function* () {
        for (const entry of iterator()) { visited++; yield entry; }
    };
    chunk.voxels.fill(1);
    replay();
    assert.equal(visited, 0, 'a local replay must not iterate the global edit log');
    assert.equal(chunk.getBlock(0, 4, 0), 2);
    assert.equal(chunk.getBlock(1, 4, 0), 0, 'mined AIR must survive unloading');
    world.modifiedBlocks.set('0,4,0', 3);
    replay();
    assert.equal(chunk.getBlock(0, 4, 0), 3);
    assert.equal(world.modifiedBlocks.delete('0,4,0'), true);
    assert.equal(world.modifiedBlocks.delete('0,4,0'), false);
    chunk.setBlock(0, 4, 0, 1);
    replay();
    assert.equal(chunk.getBlock(0, 4, 0), 1, 'deleted edits must leave no stale index entry');

    // Multiple fractional keys can name one voxel; filtered global insertion
    // order must still decide which value wins, including after reinsertion.
    world.modifiedBlocks.set('0.2,4,0', 4).set('0.8,4,0', 5).set('0.2,4,0', 6);
    replay();
    assert.equal(chunk.getBlock(0, 4, 0), 5);
    world.modifiedBlocks.delete('0.2,4,0');
    world.modifiedBlocks.set('0.2,4,0', 6);
    replay();
    assert.equal(chunk.getBlock(0, 4, 0), 6);
    world.modifiedBlocks.set('-0.2,4,-16.2', 7);
    const negative = world.getOrCreateChunk(-1, -2);
    world.restoreChunkEdits(negative);
    assert.equal(negative.getBlock(15, 4, 15), 7, 'negative fractional boundaries use floor');

    world.modifiedBlocks.clear();
    assert.equal(world.modifiedBlocks.size, 0);
    chunk.voxels.fill(1);
    replay();
    assert.equal(chunk.getBlock(0, 4, 0), 1, 'clear removes every indexed edit');
    // Mods may still supply a regular Map.
    world.modifiedBlocks = new Map([['1,4,1', 0]]);
    replay();
    assert.equal(chunk.getBlock(1, 4, 1), 0);
});

test('save, import, dimension round trips and regenerated chunks retain indexed edits', async () => {
    const { engine, world } = streamingHarness();
    engine.context.setTimeout = callback => { callback(); };
    world.buildNetherPortal = () => {};
    world.buildStarterVillage = () => {};
    world.generateSingleChunk(0, 0);
    world.setBlock(1, 1, 1, 0);
    world.setBlock(2, 1, 1, engine.blocks.GLASS);
    await world.switchDimension('nether');
    world.setBlock(1, 1, 1, engine.blocks.GLOWSTONE);
    const save = JSON.parse(world.exportJSON());
    assert.ok(save.dimensionStates.overworld.modifiedBlocks.some(edit => edit.x === 1 && edit.type === 0));
    // Import the existing dimension/edit format without retaining generated snapshots.
    save.customBlocks = [];
    world.importJSON(JSON.stringify(save));
    assert.equal(world.getBlock(1, 1, 1), engine.blocks.GLOWSTONE);
    await world.switchDimension('overworld');
    world.clearWorld();
    world.generateSingleChunk(0, 0);
    assert.equal(world.getBlock(1, 1, 1), 0);
    assert.equal(world.getBlock(2, 1, 1), engine.blocks.GLASS);
    await world.switchDimension('nether');
    assert.equal(world.getBlock(1, 1, 1), engine.blocks.GLOWSTONE);
    world.reseedWorld(43, 'flat');
    assert.equal(world.modifiedBlocks.size, 0, 'a new seed must not retain the old edit index');
});

test('preload meshes each chunk once, with generated neighbors, final structures and saved AIR edits', async () => {
    const { engine, world } = streamingHarness();
    engine.context.setTimeout = callback => { callback(); };
    world.chunkRadius = 2;
    const material = new THREE.MeshBasicMaterial();
    world.textureManager = { getBlockMaterial: () => material };
    world.modifiedBlocks.set('15,4,1', 0);
    world.buildNetherPortal = () => world.setBlock(15, 4, 1, engine.blocks.STONE);
    world.buildStarterVillage = () => world.setBlock(16, 4, 1, engine.blocks.GLASS);
    const builds = new Map();
    const rebuild = world.rebuildChunkAsync.bind(world);
    world.rebuildChunkAsync = async chunk => {
        assert.equal(Object.values(world.chunks).filter(c => c.isGenerated).length, 25);
        assert.equal(world.getBlock(15, 4, 1), 0, 'saved AIR overrides a generated structure before meshing');
        assert.equal(world.getBlock(16, 4, 1), engine.blocks.GLASS);
        const key = `${chunk.cx},${chunk.cz}`;
        builds.set(key, (builds.get(key) || 0) + 1);
        await rebuild(chunk);
        assert.ok(chunk.mesh, 'actual Wasm geometry is installed');
        assert.equal(chunk.isDirty, false);
    };
    const progress = [];
    await world.preloadChunksAsync(update => progress.push(update.percent));
    assert.equal(builds.size, 25);
    assert.equal([...builds.values()].reduce((sum, count) => sum + count, 0), 25);
    assert.equal(progress.at(-1), 100);
    assert.equal(world.worldPreloaded, true);
    assert.equal(world.trackModifications, true);
    assert.equal(world.isGeneratingTerrain, false);
    assert.equal(fs.readFileSync(path.join(__dirname, '../js/world.js'), 'utf8'),
        fs.readFileSync(path.join(__dirname, '../web/js/world.js'), 'utf8'));
});

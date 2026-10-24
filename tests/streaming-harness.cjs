'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');
const { AuthorityWorld } = require('../server/engine');

function streamingHarness(sourceDir) {
    const engine = new AuthorityWorld(42, { worldType: 'flat' });
    if (sourceDir) vm.runInContext(`(() => { ${fs.readFileSync(path.join(sourceDir, 'world.js'), 'utf8')} })()`, engine.context);
    const world = sourceDir
        ? new engine.context.VoxelWorld(new THREE.Scene(), null, { seed: 42, worldType: 'flat' })
        : engine.world;
    world.clearWorld();
    world.modifiedBlocks.clear();
    return { engine, world };
}

function editReplayHarness(sourceDir, distantEdits = 20000) {
    const h = streamingHarness(sourceDir);
    for (let i = 0; i < distantEdits; i++) {
        h.world.modifiedBlocks.set(`${160 + i % 160},${i % 32},${160 + Math.floor(i / 160)}`, 1);
    }
    const chunk = h.world.getOrCreateChunk(0, 0);
    chunk.isGenerated = true;
    for (let i = 0; i < 32; i++) h.world.modifiedBlocks.set(`${i % 16},4,${Math.floor(i / 16)}`, i % 2 ? 0 : 2);
    return { ...h, chunk, replay: () => h.world.restoreChunkEdits(chunk) };
}

async function countPreloadBuilds(sourceDir) {
    const { engine, world } = streamingHarness(sourceDir);
    world.chunkRadius = 2;
    world.buildNetherPortal = () => {};
    world.buildStarterVillage = () => {};
    const builds = new Map();
    world.rebuildChunkAsync = async chunk => {
        const key = `${chunk.cx},${chunk.cz}`;
        builds.set(key, (builds.get(key) || 0) + 1);
        chunk.isDirty = false;
    };
    engine.context.setTimeout = callback => { callback(); };
    await world.preloadChunksAsync();
    return { chunks: builds.size, meshBuilds: [...builds.values()].reduce((sum, count) => sum + count, 0) };
}

module.exports = { streamingHarness, editReplayHarness, countPreloadBuilds };

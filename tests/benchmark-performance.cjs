'use strict';

const { performance } = require('node:perf_hooks');
const THREE = require('../js/three.min.js');
const { hudHarness, rayHarness, waterHarness } = require('./performance-harness.cjs');

function measure(run, iterations) {
    for (let i = 0; i < 1000; i++) run();
    const times = [];
    for (let trial = 0; trial < 7; trial++) {
        const started = performance.now();
        for (let i = 0; i < iterations; i++) run();
        times.push((performance.now() - started) * 1000 / iterations);
    }
    return Number(times.sort((a, b) => a - b)[3].toFixed(2));
}

async function main() {
    const sourceDir = process.env.EBLANKRAFT_BENCH_SOURCE;
    const hud = hudHarness(sourceDir), ray = rayHarness(sourceDir), water = waterHarness(sourceDir);
    // Instrumentation belongs to regression checks, not CPU timing.
    ray.player._rayCurrentPos.addScaledVector = THREE.Vector3.prototype.addScaledVector;
    const hudUs = measure(() => hud.ui.update(1 / 60), 10000);
    const rayUs = measure(() => ray.player.updateRaycast(), 10000);
    const waterUs = measure(water.rebuild, 1000);
    const world = water.world, core = water.engine.context.EblanEng;
    core.workerReady = true;
    core.materialList = [world.textureManager.getBlockMaterial()];
    core.requestChunkAsync = async () => ({ ...water.emptyMesh, groups: new Uint32Array(0) });
    const prepared = await world.prepareChunkMesh(water.chunk);
    const snapshotUs = measure(() => prepared.isCurrent(), 10000);
    const before = hud.writes();
    for (let i = 0; i < 60; i++) hud.ui.update(1 / 60);
    console.log(JSON.stringify({ source: sourceDir || 'current',
        medianMicroseconds: { hud: hudUs, ray: rayUs, waterRebuild: waterUs, snapshotValidation: snapshotUs },
        unchangedHudWritesPer60Frames: hud.writes() - before,
        waterSurfaceVertices: water.chunk.waterMesh.geometry.getAttribute('position').count,
        note: 'CPU microbenchmarks and DOM write counts; no GPU or browser FPS measurement.' }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });

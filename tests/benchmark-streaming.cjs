'use strict';

const { performance } = require('node:perf_hooks');
const { editReplayHarness, countPreloadBuilds } = require('./streaming-harness.cjs');

async function main() {
    const sourceDir = process.env.EBLANKRAFT_BENCH_SOURCE;
    const h = editReplayHarness(sourceDir);
    for (let i = 0; i < 20; i++) h.replay();
    const samples = [];
    for (let trial = 0; trial < 7; trial++) {
        const start = performance.now();
        for (let i = 0; i < 50; i++) h.replay();
        samples.push((performance.now() - start) * 1000 / 50);
    }
    let visits = 0;
    const iterator = h.world.modifiedBlocks[Symbol.iterator].bind(h.world.modifiedBlocks);
    h.world.modifiedBlocks[Symbol.iterator] = function* () {
        for (const entry of iterator()) { visits++; yield entry; }
    };
    h.replay();
    console.log(JSON.stringify({ source: sourceDir || 'current', savedEdits: h.world.modifiedBlocks.size,
        medianEditReplayMicroseconds: Number(samples.sort((a, b) => a - b)[3].toFixed(2)),
        globalEntriesVisitedPerReplay: visits, preload: await countPreloadBuilds(sourceDir),
        note: 'CPU replay microbenchmark and preload mesh work counts; no browser FPS measurement.' }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });

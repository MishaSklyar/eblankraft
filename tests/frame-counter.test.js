'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { hudHarness } = require('./performance-harness.cjs');
for (const directory of ['js', 'web/js']) {
    test(`${directory}: FPS uses render intervals, includes 200ms stalls and averages elapsed time`, () => {
        const context = vm.createContext({ window: {} });
        vm.runInContext(fs.readFileSync(`${directory}/game.js`, 'utf8'), context);
        const game = Object.create(context.window.Game.prototype);
        game.lastFrameCpuTime = 1000 / 1500;
        for (let now = 0; now <= 600; now += 200) game.recordRenderedFrame(now);
        assert.equal(game.getFrameStats().fps, 5);
        assert.equal(game.getFrameStats().max, 200);
        assert.equal(game.getFrameStats().spikes, 3);
        assert.equal(game.getFrameStats().count, 3);
        game.lastRenderedAt = undefined; // tab became hidden
        game.recordRenderedFrame(10000);
        assert.equal(game.getFrameStats().count, 3);
        game.frameIntervals = [];
        game.recordRenderedFrame(10010);
        game.recordRenderedFrame(10200);
        assert.equal(game.getFrameStats().fps, 10, 'average duration, not average inverse durations');
        for (let i = 1; i <= 130; i++) game.recordRenderedFrame(10200 + i * 200);
        assert.equal(game.getFrameStats().count, 120);
    });
}

test('HUD shows 5 FPS despite fast CPU and clamped simulation timestep', () => {
    const { ui, context } = hudHarness();
    context.performance.now = () => 400;
    ui.hudFps = { textContent: '' };
    ui.game.getFrameStats = () => ({ fps: 5, count: 3 });
    ui.game.lastFrameCpuTime = .67;
    ui.update(.1);
    assert.match(ui.hudFps.textContent, /FPS: 5/);
    assert.doesNotMatch(ui.hudFps.textContent, /uncapped|1500/);
});

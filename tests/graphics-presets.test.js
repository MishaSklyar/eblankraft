'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');
function harness(directory, saved = {}) {
    const values = new Map(Object.entries(saved));
    const context = vm.createContext({ THREE, navigator: { userAgent: 'Test browser', hardwareConcurrency: 8 },
        document: { getElementById: () => null }, window: { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 },
        localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) },
        performance: { now: () => 0 }, requestAnimationFrame() {} });
    vm.runInContext(fs.readFileSync(`${directory}/game.js`, 'utf8'), context);
    const Game = context.window.Game;
    for (const name of ['initThree', 'initManagers', 'initMods', 'initWorld', 'initPlayer', 'initControls', 'initUI', 'initLights', 'initSkyAndAtmosphere']) Game.prototype[name] = () => {};
    return { game: new Game(), values, context };
}
for (const directory of ['js', 'web/js']) {
    test(`${directory}: migrate old modes once, explicit preset wins on reload`, () => {
        const old = harness(directory, { eblankraft_turbofps: 'true', eblankraft_a02_mode: 'true' });
        assert.equal(old.game.graphicsPreset, 'low');
        assert.equal(old.game.isA02Mode, false);
        const selected = harness(directory, { eblankraft_graphics_preset: 'high', eblankraft_turbofps: 'true', eblankraft_a02_mode: 'true' });
        assert.equal(selected.game.graphicsPreset, 'high');
        assert.equal(selected.game.turboFPS, false);
        assert.equal(selected.game.shadowsEnabled, true);
    });
    test(`${directory}: switching presets updates renderer, effects, radius and schedules chunk rebuilds`, () => {
        const { game, values } = harness(directory);
        let rebuilds = 0, ratio;
        game.renderer = { shadowMap: {}, setPixelRatio: value => { ratio = value; }, setSize() {}, domElement: { style: {} } };
        game.scene = new THREE.Scene();
        game.sunLight = { visible: true };
        game.hemiLight = { visible: true };
        game.ambientLight = { intensity: .6 };
        game.world = { chunks: {}, chunkRadius: 2, lastCenterCX: 0, updateChunkMaterials() {}, updateMeshes(force) { assert.equal(force, true); rebuilds++; } };
        for (const [name, scale, radius, shadows, water] of [
            ['low', .5, 1, false, false], ['high', 1, 4, true, true], ['medium', .75, 2, false, false]
        ]) {
            assert.equal(game.setGraphicsPreset(name), true);
            assert.equal(ratio, scale);
            assert.equal(game.world.chunkRadius, radius);
            assert.equal(game.world.lastCenterCX, null);
            assert.equal(game.shadowsEnabled, shadows);
            assert.equal(game.fancyWaterEnabled, water);
            assert.equal(game.turboFPS, name === 'low');
            assert.equal(game.isA02Mode, false);
            assert.equal(game.sunLight.visible, name !== 'low');
            assert.equal(game.windLeavesEnabled, name !== 'low');
            assert.equal(values.get('eblankraft_graphics_preset'), name);
            assert.equal(values.has('eblankraft_a02_mode'), false);
        }
        assert.equal(rebuilds, 3);
        assert.equal(game.setGraphicsPreset('invalid'), false);
        const reloaded = harness(directory, Object.fromEntries(values));
        assert.equal(reloaded.game.graphicsPreset, 'medium');
        assert.equal(reloaded.game.renderScale, .75);
    });
}

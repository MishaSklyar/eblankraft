'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

for (const prefix of ['js', 'web/js']) {
    test(`${prefix}: leaves use depth-tested cutouts in both graphics modes`, () => {
        const context = vm.createContext({ window: {}, THREE });
        vm.runInContext(fs.readFileSync(`${prefix}/textures.js`, 'utf8'), context);
        const manager = Object.create(context.window.TextureManager.prototype);
        Object.assign(manager, { generateTextures() {}, canvasCache: {}, materials: {},
            threeTextures: new Proxy({}, { get(target, key) { return target[key] ||= new THREE.Texture(); } }) });
        manager.init();
        for (const key of ['LEAVES', 'BIRCH_LEAVES', 'SPRUCE_LEAVES', 'JUNGLE_LEAVES']) {
            const material = manager.materials[context.window.BLOCK_TYPES[key]];
            for (const mat of [material, material.basicCounterpart]) {
                assert.equal(mat.transparent, false, 'foliage must not enter the camera-sorted blending pass');
                assert.equal(mat.alphaTest, .1, 'preserve leaf texture holes');
                assert.equal(mat.depthWrite, true);
            }
        }
        assert.equal(manager.materials[context.window.BLOCK_TYPES.WATER].transparent, true);
    });

    test(`${prefix}: wind updates every species and respects disabled/low graphics settings`, () => {
        const source = fs.readFileSync(`${prefix}/game.js`, 'utf8');
        const start = source.indexOf('        // Keep every leaf species');
        const end = source.indexOf('        // Ambient Falling Leaves', start);
        const blocks = { LEAVES: 7, BIRCH_LEAVES: 41, SPRUCE_LEAVES: 44, JUNGLE_LEAVES: 47 };
        const game = { waterTime: 12, textureManager: { materials: {} }, windLeavesEnabled: true };
        for (const id of Object.values(blocks)) game.textureManager.materials[id] = {
            userData: { uTime: { value: 0 }, uWindStrength: { value: 1 } }
        };
        const context = vm.createContext({ game, BLOCK_TYPES: blocks });
        for (const [setting, value, expected] of [
            ['windLeavesEnabled', true, 1], ['windLeavesEnabled', false, 0],
            ['windLeavesEnabled', true, 1], ['turboFPS', true, 0],
            ['turboFPS', false, 1], ['isA02Mode', true, 0]
        ]) {
            game[setting] = value;
            vm.runInContext(`(function () { ${source.slice(start, end)} }).call(game)`, context);
            for (const material of Object.values(game.textureManager.materials)) {
                assert.equal(material.userData.uTime.value, 12);
                assert.equal(material.userData.uWindStrength.value, expected);
            }
        }
    });
}

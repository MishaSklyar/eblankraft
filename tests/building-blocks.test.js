'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

for (const prefix of ['js', 'web/js']) {
    test(`${prefix}: new building blocks have textures, materials and recoverable inventory items`, () => {
        const drawing = new Proxy({
            getImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) }),
            createImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) })
        }, { get: (target, key) => target[key] || (() => {}) });
        const context = vm.createContext({ window: {}, THREE, document: {
            createElement: () => ({ width: 16, height: 16, getContext: () => drawing })
        } });
        for (const file of ['textures.js', 'items.js']) {
            vm.runInContext(fs.readFileSync(`${prefix}/${file}`, 'utf8'), context);
        }
        const manager = new context.window.TextureManager();
        const { BLOCK_TYPES, BLOCK_INFO, ITEM_REGISTRY, BLOCK_DROP_MAP } = context.window;
        const ids = Object.values(BLOCK_TYPES);
        assert.equal(new Set(ids).size, ids.length);
        const added = Object.values(ITEM_REGISTRY).filter(item => item.blockType >= 65 && item.blockType <= 88);
        assert.equal(added.length, 24);
        for (const item of added) {
            assert.equal(item.category, 'block');
            assert.equal(item.maxStack, 64);
            assert.equal(BLOCK_INFO[item.blockType].transparent, false);
            assert.equal(BLOCK_DROP_MAP[item.blockType], item.id);
            assert.ok(manager.canvasCache[item.icon], item.icon);
            assert.equal(manager.canvasCache[item.icon].width, 16);
            const material = manager.materials[item.blockType];
            assert.ok(material?.map, item.id);
            assert.equal(material.map.image, manager.canvasCache[item.icon]);
            context.window.game = { lowGraphicsMode: true };
            assert.equal(manager.getBlockMaterial(item.blockType), material.basicCounterpart);
        }
        const voxels = new Uint8Array(added.map(item => item.blockType));
        assert.deepEqual(Array.from(voxels), added.map(item => item.blockType));
    });
}

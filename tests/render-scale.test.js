'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('render scale requests distinct buffer dimensions across DPR and device modes', () => {
    const THREE = require('../js/three.min.js');
    const context = vm.createContext({ window: {}, THREE, localStorage: { setItem() {} } });
    vm.runInContext(fs.readFileSync(require.resolve('../js/game.js'), 'utf8'), context);
    const proto = context.window.Game.prototype;
    for (const dpr of [1, 2, 3]) for (const potato of [false, true]) {
        Object.assign(context.window, { devicePixelRatio: dpr, innerWidth: 1280, innerHeight: 720 });
        // Verify calls at the renderer boundary without creating a GPU context.
        const canvas = { width: 0, height: 0, style: {} }, renderer = Object.create(THREE.WebGLRenderer.prototype);
        let ratio = 1, width = 1280, height = 720;
        // Those renderer methods are per-instance closures, so model their public
        // drawing-buffer contract and assert every change invokes both setters.
        let calls = 0;
        renderer.domElement = canvas;
        renderer.setPixelRatio = value => { ratio = value; calls++; };
        renderer.setSize = (w, h) => { width = w; height = h; canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio); calls++; };
        const game = Object.assign(Object.create(proto), { renderScale: 1, renderer, isA02Mode: potato, turboFPS: potato, isUL20FT: potato });
        const dimensions = [];
        for (const scale of [.25, .5, .75, 1, 1.25, 1.5]) {
            game.setRenderScale(scale);
            assert.equal(canvas.width, Math.floor(1280 * Math.min(dpr, 2) * scale));
            assert.equal(canvas.height, Math.floor(720 * Math.min(dpr, 2) * scale));
            dimensions.push(canvas.width);
        }
        assert.equal(calls, 12);
        assert.ok(dimensions.every((w, i) => i === 0 || w > dimensions[i - 1]));
    }
});

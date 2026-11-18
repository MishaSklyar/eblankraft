'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

function load(navigatorStub = {}) {
    const listeners = [];
    const context = vm.createContext({
        THREE, console, Math, Float32Array, Uint32Array, Uint16Array, Uint8Array, Int32Array, ArrayBuffer, JSON,
        navigator: navigatorStub,
        localStorage: { getItem: () => null, setItem() {} },
        window: { addEventListener: (type, fn) => listeners.push(type) },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/webgpu_pt.js'), 'utf8'), context);
    return { PT: context.window.WebGPUPathTracer, listeners };
}

// minimal Radiance writer: new-style RLE scanlines (literal runs only) or flat pixels
function writeHdr(w, h, pixel, rle) {
    const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'latin1');
    const body = [];
    for (let y = 0; y < h; y++) {
        const px = [];
        for (let x = 0; x < w; x++) {
            const [r, g, b] = pixel(x, y);
            const m = Math.max(r, g, b);
            if (m < 1e-32) { px.push([0, 0, 0, 0]); continue; }
            const e = Math.ceil(Math.log2(m + 1e-12)) + (Number.isInteger(Math.log2(m)) ? 1 : 0);
            const s = 256 / 2 ** e;
            px.push([Math.floor(r * s), Math.floor(g * s), Math.floor(b * s), e + 128]);
        }
        if (rle) {
            body.push(2, 2, w >> 8, w & 255);
            for (let c = 0; c < 4; c++) for (let i = 0; i < w; i += 128) {
                const n = Math.min(128, w - i);
                body.push(n, ...px.slice(i, i + n).map(p => p[c]));
            }
        } else px.forEach(p => body.push(...p));
    }
    return new Uint8Array(Buffer.concat([head, Buffer.from(body)]));
}

test('RGBE parser decodes RLE and flat scanlines', () => {
    const { PT } = load();
    const pixel = (x, y) => [x + 1, y + 1, 0.5];
    for (const rle of [true, false]) {
        const w = rle ? 16 : 4, h = 3;
        const img = PT.parseRGBE(writeHdr(w, h, pixel, rle));
        assert.equal(img.w, w); assert.equal(img.h, h);
        for (const [x, y] of [[0, 0], [w - 1, 2], [2, 1]]) {
            const o = (y * w + x) * 3, [r, g, b] = pixel(x, y);
            assert.ok(Math.abs(img.data[o] - r) / r < 0.02, `r at ${x},${y}`);
            assert.ok(Math.abs(img.data[o + 1] - g) / g < 0.02, `g at ${x},${y}`);
            assert.ok(Math.abs(img.data[o + 2] - b) / b < 0.02, `b at ${x},${y}`);
        }
    }
    assert.throws(() => PT.parseRGBE(new Uint8Array([1, 2, 3])), /Radiance/);
});

test('float -> half conversion', () => {
    const { PT } = load();
    assert.equal(PT.f2h(1), 0x3c00);
    assert.equal(PT.f2h(0.5), 0x3800);
    assert.equal(PT.f2h(2), 0x4000);
    assert.equal(PT.f2h(0), 0);
    assert.equal(PT.f2h(-3), 0);
    assert.equal(PT.f2h(1e9), PT.f2h(65000));
});

test('block light-transport classes', () => {
    const { PT } = load();
    assert.equal(PT.blockPbr('WATER').kind, 3);
    assert.equal(PT.blockPbr('GLASS').kind, 4);
    assert.equal(PT.blockPbr('OAK_LEAVES').kind, 2);
    assert.equal(PT.blockPbr('RED_FLOWER').kind, 5);
    assert.ok(PT.blockPbr('GLOWSTONE').emit > 0);
    assert.ok(PT.blockPbr('LAVA').emit > 0);
    assert.equal(PT.blockPbr('GOLD_BLOCK').metal, 1);
    assert.equal(PT.blockPbr('STONE').kind, 1);
});

test('sun transmittance reddens and dims toward the horizon', () => {
    const { PT } = load();
    const noon = PT.atmosphereTransmittance(1), low = PT.atmosphereTransmittance(0.05);
    assert.ok(noon[0] > 0.8 && noon[2] > 0.6);
    assert.ok(low[2] < noon[2] && low[0] / low[2] > noon[0] / noon[2]);
});

test('without WebGPU the tracer reports it and never starts', async () => {
    const { PT, listeners } = load({});
    assert.equal(PT.isAvailable(), false);
    const pt = new PT({ ui: null });
    assert.match(pt.status, /not supported/);
    assert.equal(await pt.enable(), false);
    assert.equal(pt.active, false);
    assert.equal(pt.render(16), false);
    assert.ok(listeners.includes('keydown'));
});

test('shaders expose their entry points and the uniform layout matches the JS side', () => {
    const { PT } = load();
    for (const k of ['WGSL_TRACE', 'WGSL_BRICKS', 'WGSL_SKY', 'WGSL_TEMPORAL', 'WGSL_ATROUS']) assert.match(PT[k], /fn main\(/, k);
    assert.match(PT.WGSL_COMPOSITE, /@vertex fn vs/);
    assert.match(PT.WGSL_COMPOSITE, /@fragment fn fs/);
    // 2 mat4 + 14 vec4 in struct U
    const vec4s = (PT.WGSL_COMMON.match(/: vec4[fiu],/g) || []).length;
    assert.equal(32 + vec4s * 4, PT.U_FLOATS);
    // Mat = 7 vec4
    assert.equal((PT.WGSL_TRACE.match(/struct Mat \{([^}]*)\}/)[1].match(/vec4/g) || []).length * 4, PT.MAT_FLOATS);
});

test('game wiring: script tag, render hook, Cinematic preset', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.indexOf('js/webgpu_pt.js') > 0 && html.indexOf('js/webgpu_pt.js') < html.indexOf('js/rtx_gui.js'));
    const game = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf8');
    assert.match(game, /new WebGPUPathTracer\(this\)/);
    assert.match(game, /this\.pathTracer\.render\(/);
    const gui = fs.readFileSync(path.join(__dirname, '../js/rtx_gui.js'), 'utf8');
    assert.match(gui, /Cinematic:\s*\{[^\n]*pathTrace: true/);
});

test('BVH builder covers every primitive once and parents contain children', () => {
    const { PT } = load();
    const n = 257, boxes = [];
    for (let i = 0; i < n; i++) { const x = (i * 37) % 101, y = (i * 13) % 7, z = (i * 71) % 53; boxes.push([x, y, z, x + 1 + (i % 3), y + 1, z + 0.5]); }
    const bvh = PT.buildBVH(n, (i, o) => { for (let k = 0; k < 6; k++) o[k] = boxes[i][k]; }, 4);
    const nu = new Uint32Array(bvh.nodes.buffer, bvh.nodes.byteOffset, bvh.nodes.length);
    const seen = new Uint8Array(n);
    const inside = (p, c) => p[0] <= c[0] && p[1] <= c[1] && p[2] <= c[2] && p[3] >= c[3] && p[4] >= c[4] && p[5] >= c[5];
    const box = (k) => [bvh.nodes[k * 8], bvh.nodes[k * 8 + 1], bvh.nodes[k * 8 + 2], bvh.nodes[k * 8 + 4], bvh.nodes[k * 8 + 5], bvh.nodes[k * 8 + 6]];
    const stack = [0];
    while (stack.length) {
        const k = stack.pop(), cnt = nu[k * 8 + 7], first = nu[k * 8 + 3];
        if (cnt) {
            assert.ok(cnt <= 4);
            for (let j = first; j < first + cnt; j++) { const prim = bvh.order[j]; seen[prim]++; assert.ok(inside(box(k), boxes[prim])); }
        } else {
            assert.ok(inside(box(k), box(first)) && inside(box(k), box(first + 1)));
            stack.push(first, first + 1);
        }
    }
    assert.ok(seen.every(v => v === 1));
});

test('relief map of a flat texture is a flat normal', () => {
    const { PT } = load();
    const S = 8, px = new Uint8Array(S * S * 4).fill(128);
    const out = PT.reliefMap(px, S, null, 'stone');
    for (let i = 0; i < S * S; i++) {
        assert.ok(Math.abs(out[i * 4] - 127.5) <= 1 && Math.abs(out[i * 4 + 1] - 127.5) <= 1 && out[i * 4 + 2] >= 254);
    }
});

test('post-processing settings do not restart accumulation; quality presets exist', () => {
    const { PT } = load();
    const pt = new PT({ ui: null });
    pt._resetPending = false;
    pt.setCfg('bloom', 0.2);
    pt.setCfg('tonemap', 'aces');
    assert.equal(pt._resetPending, false);
    pt.setCfg('bounces', 6);
    assert.equal(pt._resetPending, true);
    assert.ok(Object.keys(PT.PRESETS).some(k => /3060/.test(k)));
    pt.applyPreset(Object.keys(PT.PRESETS)[0]);
    assert.equal(pt.cfg.dynRes, true);
});

test('ray tracing mode is a flag on the same kernel and defaults to the path tracer', () => {
    const { PT } = load();
    assert.equal(PT.CFG_DEFAULTS.renderMode, 'path');
    assert.match(PT.WGSL_COMMON, /const F_RAYTRACE: u32 = 512u;/);
    assert.match(PT.WGSL_TRACE, /if \(\(u\.res\.w & F_RAYTRACE\) != 0u\) \{ rayMain\(id\); return; \}/);
    const src = fs.readFileSync(path.join(__dirname, '../js/webgpu_pt.js'), 'utf8');
    assert.match(src, /\(rt \? 512 : 0\)/);
    assert.match(src, /const iters = cfg\.denoise && !rt \?/);
    const pt = new PT({ ui: null });
    pt._resetPending = false;
    pt.setCfg('renderMode', 'ray');
    assert.equal(pt._resetPending, true, 'switching renderer restarts accumulation');
});

test('ray tracing code never draws Monte Carlo samples (only the sub-pixel jitter)', () => {
    const { PT } = load();
    const W = PT.WGSL_TRACE;
    const region = W.slice(W.indexOf('fn rtMissRad'), W.indexOf('@compute @workgroup_size(8, 8)'));
    assert.ok(region.length > 2000, 'found the ray tracing block');
    assert.equal((region.match(/\brnd\(/g) || []).length, 0, 'no rnd() in the ray tracing block');
    assert.equal((region.match(/\brnd2\(/g) || []).length, 1, 'rnd2() only for the pixel jitter');
    for (const f of ['sampleBsdf(', 'sampleEmitters(', 'sampleEnv(', 'cosineSample(']) assert.ok(!region.includes(f), f);
});

test('ray tracing keeps one call site per traced helper (large inlined copies crash some drivers)', () => {
    const { PT } = load();
    const W = PT.WGSL_TRACE;
    const region = W.slice(W.indexOf('fn rtMissRad'), W.indexOf('@compute @workgroup_size(8, 8)'));
    assert.equal((region.match(/shadowRay\(/g) || []).length, 1);
    assert.equal((region.match(/rtShadeOnce\(/g) || []).length, 2, 'one definition, one call');
    assert.equal((region.match(/rtIntersect\(/g) || []).length, 3, 'one definition, two calls');
});

test('ray tracing light list: nearest emitters within 12 blocks, nearest first, capped at 8', () => {
    const { PT } = load();
    const pt = new PT({ ui: null });
    const writes = [];
    pt.device = { queue: { writeBuffer: (buf, off, data) => writes.push(Float32Array.from(data)) } };
    pt.rtLightBuf = {};
    const near = [[2, 64, 2, 91], [-3, 64, 0, 93], [3, 64, 1, 90]];
    const far = [];
    for (let x = 6; x <= 10; x++) far.push([x, 64, 0, 100 + x]);
    const outOfRange = [[40, 40, 40, 77], [10, 64, 10, 78]];
    const flat = [...near, ...far, ...outOfRange].flat();
    pt._slotEmit = [Float32Array.from(flat), null];
    pt.updateRtLights({ position: { x: 0.5, y: 64.5, z: 0.5 } });
    const b = writes[0];
    assert.equal(b[0], 8, 'count capped at 8');
    const ids = [1, 2, 3, 4, 5, 6, 7, 8].map(k => b[k * 4 + 3]);
    assert.deepEqual(ids, [91, 93, 90, 106, 107, 108, 109, 110]);
    assert.deepEqual([b[4], b[5], b[6]], [2, 64, 2]);
    pt._slotEmit = [Float32Array.from(outOfRange.flat())];
    pt.updateRtLights({ position: { x: 0.5, y: 64.5, z: 0.5 } });
    assert.equal(writes[1][0], 0, 'nothing within range means no lights');
});

test('game wiring: Renderer control and Ray tracing preset; Cinematic resets the renderer', () => {
    const gui = fs.readFileSync(path.join(__dirname, '../js/rtx_gui.js'), 'utf8');
    assert.match(gui, /ptF\.add\(C, 'renderMode'/);
    assert.match(gui, /'Ray tracing': \{ parts: 'all', pathTrace: true, ptCfg: \{ renderMode: 'ray' \}/);
    assert.match(gui, /Cinematic:\s*\{[^\n]*ptCfg: \{ renderMode: 'path'/);
});

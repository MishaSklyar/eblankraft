'use strict';
// Low-end device optimisations: chunk texture atlas batching, frame limiter, entity draw distance and boot-time work.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

function fakeCanvasFactory(log = []) {
    return () => {
        const canvas = { width: 0, height: 0 };
        canvas.getContext = () => ({
            imageSmoothingEnabled: true,
            clearRect: (...args) => log.push(['clear', ...args]),
            drawImage: (image, ...args) => log.push(['draw', image, ...args])
        });
        return canvas;
    };
}

function loadWorld() {
    const context = vm.createContext({ window: {}, THREE, console, performance: { now: () => 0 } });
    vm.runInContext(fs.readFileSync('js/world.js', 'utf8'), context);
    return context.window.ChunkAtlas;
}

function blockMaterial(key, opts = {}) {
    const tex = new THREE.Texture({ width: 16, height: 16, key });
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.userData.key = key;
    return new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, ...opts });
}

// One quad (6 vertices) per group, every vertex tagged with its group number so the reordering can be checked.
function meshData(groupCount) {
    const n = groupCount * 6;
    const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2), colors = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
        positions[v * 3] = Math.floor(v / 6);
        uvs[v * 2] = v;
        colors[v * 3] = 0.5;
        normals[v * 3 + 1] = 1;
    }
    const groups = Array.from({ length: groupCount }, (_, i) => ({ start: i * 6, count: 6, materialIndex: i }));
    return { positions, normals, uvs, colors, groups };
}

test('Low preset chunk meshes collapse every compatible block material into one atlas draw per render state', () => {
    const ChunkAtlas = loadWorld();
    const log = [];
    const atlas = new ChunkAtlas(fakeCanvasFactory(log));
    const stone = blockMaterial('stone'), dirt = blockMaterial('dirt'), grass = blockMaterial('grass_top');
    const leaves = blockMaterial('leaves', { alphaTest: 0.1 }), birch = blockMaterial('birch_leaves', { alphaTest: 0.1 });
    const tinted = blockMaterial('tinted', { color: 0x2980b9 });          // a material colour cannot live in the atlas
    const water = blockMaterial('water');                                  // animated: keeps its own material
    const materials = [stone, leaves, dirt, tinted, grass, birch, water];
    const d = meshData(materials.length);
    const out = atlas.batch(d.positions, d.normals, d.uvs, d.colors, d.groups, materials);
    assert.ok(out, 'batching must apply');
    assert.equal(out.groups.length, 4, 'opaque atlas + cutout atlas + two materials that keep their own draw');
    const opaque = out.materials[0], cutout = out.materials[1];
    assert.equal(opaque.userData.chunkAtlas, true);
    assert.equal(opaque.alphaTest, 0);
    assert.equal(cutout.userData.chunkAtlas, true);
    assert.equal(cutout.alphaTest, 0.1);
    assert.equal(out.materials[2], tinted);
    assert.equal(out.materials[3], water);
    assert.equal(opaque.map, atlas.texture);
    assert.equal(opaque.vertexColors, true);
    // Vertices are regrouped, not lost or altered: the source group of every output vertex, in output order.
    const order = Array.from({ length: out.positions.length / 3 }, (_, v) => out.positions[v * 3]);
    assert.deepEqual([...new Set(order)], [0, 2, 4, 1, 5, 3, 6]);
    assert.equal(order.length, materials.length * 6);
    assert.equal(out.groups.map(g => `${g.start}+${g.count}`).join(' '), '0+18 18+12 30+6 36+6');
    for (let v = 0; v < order.length; v++) {
        const src = order[v] * 6 + (v % 6);
        assert.equal(out.uvs[v * 2], src, 'repeating greedy UVs are kept as they are');
        assert.equal(out.colors[v * 3], 0.5, 'face shading colours follow their vertices');
    }
    // Tile ids are handed out in source order (stone 0, leaves 1, dirt 2, grass 3, birch 4); non-atlas vertices get 0.
    const tileOf = v => out.tiles[v];
    assert.deepEqual([tileOf(0), tileOf(6), tileOf(12), tileOf(18), tileOf(24), tileOf(30), tileOf(36)], [0, 2, 3, 1, 4, 0, 0]);
    assert.equal(out.normals, null, 'unlit basic materials do not need a normal attribute');
    assert.equal(atlas.count, 5);
    assert.equal(log.filter(entry => entry[0] === 'draw').length, 5, 'each texture is copied into the atlas once');

    // Same textures again: no redraw. A pack / mod redrawing a texture bumps its version and refreshes that one tile.
    atlas.batch(d.positions, d.normals, d.uvs, d.colors, d.groups, materials);
    assert.equal(log.filter(entry => entry[0] === 'draw').length, 5);
    dirt.map.needsUpdate = true;
    atlas.batch(d.positions, d.normals, d.uvs, d.colors, d.groups, materials);
    const draws = log.filter(entry => entry[0] === 'draw');
    assert.equal(draws.length, 6);
    assert.equal(draws[5][1], dirt.map.image);
    assert.deepEqual(draws[5].slice(2), [32, 0, 16, 16], 'dirt keeps cell 2');
});

test('chunk atlas keeps lava scrolling, refuses textures it cannot reproduce and skips meshes with nothing to merge', () => {
    const ChunkAtlas = loadWorld();
    const atlas = new ChunkAtlas(fakeCanvasFactory());
    const lava = blockMaterial('lava'), stone = blockMaterial('stone');
    lava.map.offset.set(0.25, 0.5);
    const d = meshData(2);
    const out = atlas.batch(d.positions, d.normals, d.uvs, d.colors, d.groups, [stone, lava]);
    assert.equal(out.groups.length, 1);
    assert.equal(out.tiles[0], 0);
    assert.equal(out.tiles[6], -2, 'scrolling tiles are encoded as -(index + 1)');
    assert.equal(atlas.scroll.value, lava.map.offset, 'the shader reads the live offset the game loop animates');

    const shifted = blockMaterial('stone'); shifted.map.offset.set(0.1, 0);
    const repeated = blockMaterial('stone'); repeated.map.repeat.set(2, 2);
    const linear = blockMaterial('stone'); linear.map.magFilter = THREE.LinearFilter;
    const big = blockMaterial('stone'); big.map.image = { width: 64, height: 64 };
    const lambert = new THREE.MeshLambertMaterial({ map: stone.map });
    const hooked = blockMaterial('stone'); hooked.onBeforeCompile = () => {};
    const portal = blockMaterial('portal_nether', { transparent: true, opacity: 0.8 });
    for (const m of [shifted, repeated, linear, big, lambert, hooked, portal]) assert.equal(atlas.tileFor(m), -1);

    const single = meshData(2);
    assert.equal(atlas.batch(single.positions, single.normals, single.uvs, single.colors, single.groups, [stone, big]), null,
        'a single atlas group saves nothing');
});

test('chunk atlas grows without moving tiles and patches the basic material shader', () => {
    const ChunkAtlas = loadWorld();
    const atlas = new ChunkAtlas(fakeCanvasFactory());
    const capacity = atlas.cols * atlas.rows;
    for (let i = 0; i <= capacity; i++) assert.equal(atlas.tileFor(blockMaterial('b' + i)), i);
    assert.equal(atlas.rows, 8);
    assert.equal(atlas.grid.value.y, 8, 'the shader grid uniform follows the new size');
    assert.equal(atlas.canvas.height, 8 * 16);

    const material = atlas.materialFor(blockMaterial('x'));
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    material.onBeforeCompile(shader);
    assert.match(shader.vertexShader, /attribute float atlasTile;/);
    assert.match(shader.vertexShader, /vAtlasOrigin = /);
    assert.match(shader.fragmentShader, /fract\(vMapUv \+ vAtlasScroll\)/);
    assert.doesNotMatch(shader.fragmentShader, /#include <map_fragment>/);
    assert.equal(shader.uniforms.atlasGrid, atlas.grid);
    assert.equal(shader.uniforms.atlasScroll, atlas.scroll);
    assert.equal(atlas.materialFor(blockMaterial('y')), material, 'one material per render state');
});

function gameHarness(saved = {}) {
    const values = new Map(Object.entries(saved));
    const classes = new Set();
    const context = vm.createContext({ THREE, navigator: { userAgent: 'Test browser', hardwareConcurrency: 8 },
        document: { getElementById: () => null, documentElement: { classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } } },
        window: { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 },
        localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) },
        performance: { now: () => 0 }, requestAnimationFrame() {} });
    vm.runInContext(fs.readFileSync('js/game.js', 'utf8'), context);
    const Game = context.window.Game;
    for (const name of ['initThree', 'initManagers', 'initMods', 'initWorld', 'initPlayer', 'initControls', 'initUI', 'initLights', 'initSkyAndAtmosphere']) Game.prototype[name] = () => {};
    return { game: new Game(), values, classes, context };
}

test('frame limiter skips early vsyncs, persists, and does not read capped frames as slow for dynamic resolution', () => {
    const { game, values, context } = gameHarness({ eblankraft_fps_cap: '30' });
    assert.equal(game.fpsCap, 30);
    assert.equal(game.setFpsCap('999'), 0, 'unknown values mean no cap');
    assert.equal(values.get('eblankraft_fps_cap'), '0');
    game.setFpsCap(30);
    let now = 1000, worked = 0;
    context.performance.now = () => now;
    game.lastTime = 1000;
    game.updateDayNight = () => { worked++; throw new Error('stop after the limiter'); };
    for (const t of [1016.7, 1030]) { now = t; game.animate(); }
    assert.equal(worked, 0, 'vsyncs inside the 33 ms window are skipped');
    now = 1033.4;
    assert.throws(() => game.animate(), /stop after the limiter/);
    assert.equal(worked, 1);

    // 30 FPS cap: steady 33 ms frames neither shed nor regain resolution; real slowness still sheds it.
    const steady = gameHarness({ eblankraft_fps_cap: '30' }).game;
    steady.renderScale = 0.5; steady.autoScaleMax = 0.5; steady.applyViewport = () => {};
    for (let i = 0; i < 400; i++) steady.adaptMobileScale(33.4);
    assert.equal(steady.renderScale, 0.5);
    for (let i = 0; i < 200; i++) steady.adaptMobileScale(60);
    assert.ok(steady.renderScale < 0.5);
});

test('Low preset culls far mobs and drops costly CSS layers; other presets keep them', () => {
    const { game, classes } = gameHarness();
    const mob = (x) => ({ position: new THREE.Vector3(x, 0, -5), height: 1.8, width: 0.6, group: { visible: true, castShadow: false } });
    const near = mob(0), far = mob(40);
    game.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
    game.world = { chunks: {}, getBlock: () => 0 };
    game.mobManager = { mobs: [near, far] };
    game.camera.lookAt(0, 0, -5);
    game.graphicsPreset = 'low';
    game.performFrustumAndOcclusionCulling();
    assert.equal(near.group.visible, true);
    assert.equal(far.group.visible, false);
    game.graphicsPreset = 'high';
    far.position.set(0, 0, -40);
    game.performFrustumAndOcclusionCulling();
    assert.equal(far.group.visible, true);

    game.scene = new THREE.Scene();
    game.graphicsPreset = 'low';
    game.updateGraphicsLighting();
    assert.ok(classes.has('gfx-low'));
    game.graphicsPreset = 'medium';
    game.updateGraphicsLighting();
    assert.ok(!classes.has('gfx-low'));
    const css = fs.readFileSync('css/style.css', 'utf8');
    assert.match(css, /html\.gfx-low \*[^{]*\{[^}]*backdrop-filter: none !important/);
    assert.match(css, /html\.gfx-low #shader-overlay \{ display: none !important; \}/);
});

test('boot skips work nobody asked for: Blockly loads on first open, water normals only bake if the JPG fails', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert.match(html, /<iframe id="blockly-iframe" data-src="blockly\/index\.html" src="about:blank"/);
    assert.match(html, /<select id="select-fps-cap">/);
    const ui = fs.readFileSync('js/ui.js', 'utf8');
    assert.match(ui, /iframe\.src = iframe\.dataset\.src/);

    let baked = 0, failLoad = null;
    const context = vm.createContext({ window: {}, THREE: Object.assign(Object.create(THREE), {
        makeWaterNormals: () => { baked++; return new THREE.Texture(); },
        TextureLoader: class { load(url, onLoad, onProgress, onError) { failLoad = onError; } }
    }), console });
    context.window.THREE = context.THREE;
    vm.runInContext(fs.readFileSync('js/textures.js', 'utf8'), context);
    const manager = Object.create(context.window.TextureManager.prototype);
    Object.assign(manager, { generateTextures() {}, canvasCache: {}, materials: {},
        threeTextures: new Proxy({}, { get(target, key) { return target[key] ||= new THREE.Texture(); } }) });
    manager.init();
    assert.equal(baked, 0, 'no procedural bake at startup');
    const water = manager.materials[context.window.BLOCK_TYPES.WATER];
    assert.equal(water.normalMap, null);
    failLoad(new Error('offline'));
    assert.equal(baked, 1);
    assert.ok(water.normalMap);
});

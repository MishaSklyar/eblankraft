'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');
const { AuthorityWorld } = require('../server/engine');

function source(name, sourceDir = path.join(__dirname, '../js')) {
    return fs.readFileSync(path.join(sourceDir, `${name}.js`), 'utf8');
}

function hudHarness(sourceDir) {
    let writes = 0;
    const node = () => {
        const count = target => new Proxy(target, { set(object, key, value) {
            writes++;
            object[key] = value;
            return true;
        } });
        return count({ style: count({}), classList: { toggle() {} } });
    };
    const context = vm.createContext({ window: { innerWidth: 1280 },
        document: { getElementById: () => null }, performance: { now: () => 0 } });
    vm.runInContext(source('ui', sourceDir), context);
    const ui = Object.create(context.window.UIManager.prototype);
    Object.assign(ui, {
        game: { world: { dimension: 'overworld' }, mobManager: {} },
        player: { health: 100, maxHealth: 100, hunger: 100, iq: 0,
            position: { x: .5, y: 10, z: .5 }, attackCooldown: 1, oxygen: 100 },
        fpsHistory: [], lastFpsUpdate: 0, updateDuel() {},
    });
    for (const name of ['hudHealth', 'hudHunger', 'hudDimension', 'hudIQ', 'hudCoords',
        'miningProgressContainer', 'miningProgressBar', 'attackIndicatorContainer',
        'attackIndicatorFill', 'attackIndicatorIcon', 'bossBarContainer', 'bossBarFill', 'bossBarTitle']) {
        ui[name] = node();
    }
    return { ui, context, writes: () => writes };
}

function rayHarness(sourceDir) {
    const context = vm.createContext({ window: {}, THREE, BLOCK_TYPES: { AIR: 0, WATER: 19 } });
    vm.runInContext(source('player', sourceDir), context);
    const player = Object.create(context.window.Player.prototype);
    const blocks = new Map();
    let lookups = 0, samples = 0;
    const current = new THREE.Vector3();
    const add = current.addScaledVector;
    current.addScaledVector = function (...args) { samples++; return add.apply(this, args); };
    Object.assign(player, {
        position: new THREE.Vector3(.5, 10, .5), eyeHeight: 0, yaw: 0, pitch: 0,
        isCreative: true, _rayOrigin: new THREE.Vector3(), _rayDir: new THREE.Vector3(),
        _rayPrevPos: new THREE.Vector3(), _rayCurrentPos: current,
        wireframeBox: new THREE.Object3D(),
        world: { getBlock(x, y, z) { lookups++; return blocks.get(`${x},${y},${z}`) || 0; } },
    });
    return { player, blocks, lookups: () => lookups, samples: () => samples };
}

function waterHarness(sourceDir) {
    const engine = new AuthorityWorld(42, { worldType: 'flat' });
    if (sourceDir) vm.runInContext(`(() => { ${source('world', sourceDir)} })()`, engine.context);
    const world = sourceDir ? new engine.context.VoxelWorld(new THREE.Scene(), null,
        { seed: 42, worldType: 'flat' }) : engine.world;
    world.clearWorld();
    const material = new THREE.MeshBasicMaterial();
    const fancyWater = new THREE.MeshPhongMaterial();
    fancyWater.basicCounterpart = material;
    world.textureManager = { getBlockMaterial: block => {
        const game = engine.context.game;
        return block === engine.blocks.WATER && !game.turboFPS && !game.isA02Mode && game.fancyWaterEnabled !== false
            ? fancyWater : material;
    } };
    engine.context.game = { turboFPS: true };
    for (const [x, z] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
        world.getOrCreateChunk(x, z).isGenerated = true;
    }
    const chunk = world.getChunk(0, 0);
    const emptyMesh = { positions: new Float32Array(0), normals: new Float32Array(0),
        uvs: new Float32Array(0), groups: [], materials: [] };
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        chunk.setBlock(x, 0, z, engine.blocks.STONE);
        chunk.setBlock(x, 1, z, engine.blocks.WATER);
        if (x === 0) world.getChunk(-1, 0).setBlock(15, 1, z, engine.blocks.WATER);
        if (x === 15) world.getChunk(1, 0).setBlock(0, 1, z, engine.blocks.WATER);
        if (z === 0) world.getChunk(0, -1).setBlock(x, 1, 15, engine.blocks.WATER);
        if (z === 15) world.getChunk(0, 1).setBlock(x, 1, 0, engine.blocks.WATER);
    }
    const rebuild = () => { chunk.isDirty = true; chunk.rebuildMesh(world.textureManager, emptyMesh); };
    return { engine, world, chunk, rebuild, emptyMesh };
}

module.exports = { hudHarness, rayHarness, waterHarness };

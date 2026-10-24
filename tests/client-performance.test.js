'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { hudHarness, rayHarness, waterHarness } = require('./performance-harness.cjs');

test('unchanged HUD performs no DOM writes; state changes and resizing refresh immediately', () => {
    const h = hudHarness();
    h.ui.update(1 / 60);
    const initialWrites = h.writes();
    for (let frame = 0; frame < 60; frame++) h.ui.update(1 / 60);
    assert.equal(h.writes(), initialWrites, 'steady frames must leave DOM nodes intact');
    h.ui.player.health = 73;
    h.ui.player.maxHealth = 200;
    h.ui.player.hunger = 24;
    h.ui.player.iq = 501;
    h.ui.player.position.x = -1.1;
    h.ui.game.world.dimension = 'nether';
    h.ui.update(1 / 60);
    assert.match(h.ui.hudHealth.innerHTML, /73\/200/);
    assert.match(h.ui.hudHunger.innerHTML, /24%/);
    assert.match(h.ui.hudIQ.innerHTML, /501/);
    assert.match(h.ui.hudCoords.textContent, /-2/);
    assert.match(h.ui.hudDimension.innerHTML, /НЕЗЕР/);
    h.context.window.innerWidth = 320;
    h.ui.update(1 / 60);
    assert.equal(h.ui.hudHealth.innerHTML, '❤️ <b>73</b>/200');
    assert.equal(h.ui.hudHunger.innerHTML, '🍗 <b>24%</b>');
    h.ui.player.maxHealth = 300;
    h.ui.update(1 / 60);
    assert.equal(h.ui.hudHealth.innerHTML, '❤️ <b>73</b>/300');
});

test('mining, attack cooldown and boss HUD retain immediate animation and visibility changes', () => {
    const h = hudHarness(), ui = h.ui;
    ui.player.isMining = true;
    ui.player.miningProgress = .3;
    ui.player.attackCooldown = .5;
    ui.game.mobManager.dragon = { health: 750, maxHealth: 1000, mesh: {} };
    ui.update(1 / 60);
    assert.equal(ui.miningProgressBar.style.width, '30%');
    assert.equal(ui.attackIndicatorFill.style.width, '50%');
    assert.equal(ui.bossBarFill.style.width, '75%');
    ui.player.miningProgress = .6;
    ui.player.attackCooldown = .98;
    ui.game.mobManager.dragon.health = 500;
    ui.update(1 / 60);
    assert.equal(ui.miningProgressBar.style.width, '60%');
    assert.equal(ui.attackIndicatorFill.style.width, '98%');
    assert.equal(ui.bossBarFill.style.width, '50%');
    ui.player.isMining = false;
    ui.player.attackCooldown = 1;
    ui.game.mobManager.dragon.isDead = true;
    ui.update(1 / 60);
    assert.equal(ui.miningProgressContainer.style.display, 'none');
    assert.equal(ui.attackIndicatorContainer.style.display, 'none');
    assert.equal(ui.bossBarContainer.style.display, 'none');
});

test('voxel ray traversal skips fixed-distance samples, ignores water and returns all six placement faces', () => {
    for (const [yaw, pitch, x, y, z, nx, ny, nz] of [
        [-Math.PI / 2, 0, 3, 10, 0, -1, 0, 0],
        [Math.PI / 2, 0, -3, 10, 0, 1, 0, 0],
        [0, 0, 0, 10, -3, 0, 0, 1],
        [Math.PI, 0, 0, 10, 3, 0, 0, -1],
        [0, Math.PI / 2, 0, 13, 0, 0, -1, 0],
        [0, -Math.PI / 2, 0, 7, 0, 0, 1, 0],
    ]) {
        const h = rayHarness();
        Object.assign(h.player, { yaw, pitch });
        h.player.position.y = 10.5;
        h.blocks.set('0,10,0', 19);
        h.blocks.set(`${x},${y},${z}`, 1);
        h.player.updateRaycast();
        assert.deepEqual({ ...h.player.targetBlock }, { hit: true, x, y, z, nx, ny, nz, type: 1 });
        assert.equal(h.player.wireframeBox.visible, true);
        assert.equal(h.samples(), 0, 'ray must step across voxel boundaries instead of sampling every 0.05 block');
    }
});

test('ray reach, negative integer boundaries, diagonal ties and thin voxel intersections stay precise', () => {
    const h = rayHarness(), p = h.player;
    p.customReach = 2;
    h.blocks.set('0,10,-3', 1);
    p.updateRaycast();
    assert.equal(p.targetBlock, null);
    assert.equal(p.wireframeBox.visible, false);
    p.customReach = 3;
    p.updateRaycast();
    assert.equal(p.targetBlock.z, -3);
    h.blocks.clear();
    p.position.z = 0;
    h.blocks.set('0,10,0', 1);
    h.blocks.set('0,10,-1', 2);
    p.updateRaycast();
    assert.equal(p.targetBlock.z, -1, 'boundary origin must enter the voxel in the ray direction');
    assert.equal(p.targetBlock.nz, 1, 'boundary hits still need a valid placement face');
    h.blocks.clear();
    p.position.set(.5, 10.5, .5);
    p.yaw = -Math.PI / 4;
    h.blocks.set('1,10,-1', 1);
    p.updateRaycast();
    assert.equal(p.targetBlock.x, 1);
    assert.equal(Math.abs(p.targetBlock.nx) + Math.abs(p.targetBlock.ny) + Math.abs(p.targetBlock.nz), 1);
    h.blocks.clear();
    p.position.set(.5, 10.99, .5);
    p.yaw = -Math.PI / 2;
    p.pitch = Math.atan(.0199);
    h.blocks.set('1,10,0', 1);
    p.updateRaycast();
    assert.equal(p.targetBlock?.x, 1, 'a short intersection near a voxel corner must not be skipped');
});

test('voxel rays agree with independent ray-box intersections across varied directions', () => {
    const h = rayHarness(), p = h.player;
    let state = 42;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const hitDistance = (origin, direction, cell) => {
        let near = 0, far = Infinity;
        for (let axis = 0; axis < 3; axis++) {
            if (direction[axis] === 0) {
                if (origin[axis] < cell[axis] || origin[axis] >= cell[axis] + 1) return Infinity;
            } else {
                const a = (cell[axis] - origin[axis]) / direction[axis];
                const b = (cell[axis] + 1 - origin[axis]) / direction[axis];
                near = Math.max(near, Math.min(a, b));
                far = Math.min(far, Math.max(a, b));
            }
        }
        return far > near ? near : Infinity;
    };
    for (let trial = 0; trial < 150; trial++) {
        h.blocks.clear();
        p.position.set(random() * 4 - 2, random() * 4 + 8, random() * 4 - 2);
        p.yaw = random() * Math.PI * 2;
        p.pitch = (random() - .5) * Math.PI;
        const origin = [p.position.x, p.position.y, p.position.z];
        const direction = [-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)];
        for (let block = 0; block < 30; block++) {
            const distance = random() * 12;
            const cell = origin.map((value, axis) => Math.floor(value + direction[axis] * distance + random() - .5));
            h.blocks.set(cell.join(','), random() < .2 ? 19 : 1);
        }
        let closest = Infinity, expected = null;
        for (const [key, type] of h.blocks) {
            if (type === 19) continue;
            const cell = key.split(',').map(Number);
            const distance = hitDistance(origin, direction, cell);
            if (distance <= 10 && distance < closest) { closest = distance; expected = key; }
        }
        p.updateRaycast();
        const target = p.targetBlock;
        assert.equal(target ? `${target.x},${target.y},${target.z}` : null, expected, `ray ${trial}`);
    }
});

function topCoverage(chunk) {
    const positions = chunk.waterMesh.geometry.getAttribute('position');
    const normals = chunk.waterMesh.geometry.getAttribute('normal');
    const cells = new Map();
    for (let start = 0; start < positions.count; start += 6) {
        if (normals.getY(start) !== 1) continue;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let v = start; v < start + 6; v++) {
            minX = Math.min(minX, positions.getX(v)); maxX = Math.max(maxX, positions.getX(v));
            minZ = Math.min(minZ, positions.getZ(v)); maxZ = Math.max(maxZ, positions.getZ(v));
            assert.ok(Math.abs(positions.getY(v) - 1.85) < 1e-6);
        }
        for (let z = minZ; z < maxZ; z++) for (let x = minX; x < maxX; x++) {
            const key = `${x},${z}`;
            cells.set(key, (cells.get(key) || 0) + 1);
        }
    }
    return cells;
}

test('Turbo water merges a 16×16 surface into one quad with repeated texture coordinates', () => {
    const h = waterHarness();
    h.rebuild();
    const geometry = h.chunk.waterMesh.geometry;
    assert.equal(geometry.getAttribute('position').count, 6);
    assert.deepEqual(Array.from(geometry.getAttribute('uv').array), [0, 0, 16, 0, 16, 16, 0, 0, 16, 16, 0, 16]);
    assert.equal(topCoverage(h.chunk).size, 256);
    h.engine.context.game.turboFPS = false;
    h.engine.context.game.isA02Mode = true;
    h.rebuild();
    assert.equal(h.chunk.waterMesh.geometry.getAttribute('position').count, 6);
    h.engine.context.game.isA02Mode = false;
    h.rebuild();
    assert.equal(h.chunk.waterMesh.geometry.getAttribute('position').count, 1536, 'fancy water keeps per-block wave vertices');
});

test('merged water preserves holes, covered surfaces, exposed sides and empty geometry cleanup', () => {
    const h = waterHarness();
    h.chunk.setBlock(5, 1, 5, h.engine.blocks.AIR);
    h.chunk.setBlock(8, 2, 8, h.engine.blocks.STONE);
    h.rebuild();
    const cells = topCoverage(h.chunk);
    assert.equal(cells.size, 254);
    assert.equal(cells.has('5,5'), false);
    assert.equal(cells.has('8,8'), false);
    assert.ok([...cells.values()].every(count => count === 1));
    const positions = h.chunk.waterMesh.geometry.getAttribute('position');
    const normals = h.chunk.waterMesh.geometry.getAttribute('normal');
    assert.equal(Array.from(normals.array).filter((_, i) => i % 3 === 1 && normals.array[i] === 0).length, 24,
        'four side faces around the hole remain visible');
    assert.ok(positions.count < 1536);
    const oldWater = h.chunk.waterMesh;
    h.chunk.voxels.fill(0);
    h.rebuild();
    assert.equal(h.chunk.waterMesh, null, 'empty geometry must not be revived by camera culling');
    assert.equal(h.world.scene.children.includes(oldWater), false);
});

test('wave settings rebuild water geometry through the existing bounded chunk queue', () => {
    const h = waterHarness(), game = h.engine.context.game;
    h.rebuild();
    assert.equal(h.chunk.waterMesh.geometry.getAttribute('position').count, 6);
    game.turboFPS = false;
    h.world.updateChunkMaterials();
    assert.equal(h.chunk.isDirty, true, 'fancy water requires its detailed wave vertices');
    h.chunk.rebuildMesh(h.world.textureManager, h.emptyMesh);
    assert.equal(h.chunk.waterMesh.geometry.getAttribute('position').count, 1536);
    game.fancyWaterEnabled = false;
    h.world.updateChunkMaterials();
    assert.equal(h.chunk.isDirty, true, 'turning off waves enables merging on desktop too');
    h.chunk.rebuildMesh(h.world.textureManager, h.emptyMesh);
    assert.equal(h.chunk.waterMesh.geometry.getAttribute('position').count, 6);
    h.world.updateChunkMaterials();
    assert.equal(h.chunk.isDirty, false, 'an unchanged material setting does not remesh chunks');
});

test('empty solid chunks release geometry and stay absent after culling', () => {
    const h = waterHarness();
    h.chunk.voxels.fill(0);
    h.chunk.setBlock(5, 1, 5, h.engine.blocks.STONE);
    h.chunk.rebuildMesh(h.world.textureManager);
    assert.ok(h.chunk.mesh);
    const oldMesh = h.chunk.mesh;
    let disposed = false;
    oldMesh.geometry.addEventListener('dispose', () => { disposed = true; });
    h.chunk.voxels.fill(0);
    h.rebuild();
    assert.equal(h.chunk.mesh, null);
    assert.equal(h.world.scene.children.includes(oldMesh), false);
    assert.equal(disposed, true);
});

test('worker mesh validation detects neighbor edits, raw voxel writes and unloaded boundaries', async () => {
    const h = waterHarness(), core = h.engine.context.EblanEng;
    core.workerReady = true;
    core.materialList = [h.world.textureManager.getBlockMaterial()];
    core.requestChunkAsync = async () => ({ ...h.emptyMesh, groups: new Uint32Array(0) });
    const prepared = await h.world.prepareChunkMesh(h.chunk);
    assert.equal(prepared.isCurrent(), true);
    const neighbor = h.world.getChunk(1, 0);
    neighbor.setBlock(0, 2, 0, h.engine.blocks.STONE);
    assert.equal(prepared.isCurrent(), false);
    neighbor.setBlock(0, 2, 0, h.engine.blocks.AIR);
    assert.equal(prepared.isCurrent(), true);
    h.chunk.voxels[7000] = h.engine.blocks.STONE;
    assert.equal(prepared.isCurrent(), false, 'direct voxel changes must not bypass stale-result protection');
    h.chunk.voxels[7000] = h.engine.blocks.AIR;
    delete h.world.chunks['1,0'];
    h.world.invalidateChunkCache();
    assert.equal(prepared.isCurrent(), false);
});

test('performance changes remain identical in root and web builds', () => {
    for (const name of ['ui', 'player', 'world']) {
        assert.equal(fs.readFileSync(path.join(__dirname, '../js', `${name}.js`), 'utf8'),
            fs.readFileSync(path.join(__dirname, '../web/js', `${name}.js`), 'utf8'));
    }
});

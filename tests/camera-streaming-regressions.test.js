'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const THREE = require('../js/three.min.js');
const { streamingHarness } = require('./streaming-harness.cjs');

for (const file of ['js/game.js', 'web/js/game.js']) {
    test(`${file}: turning away preserves offscreen shadow casters`, () => {
        const context = vm.createContext({ window: {}, THREE, CHUNK_SIZE_X: 16, CHUNK_SIZE_Y: 32, CHUNK_SIZE_Z: 16 });
        vm.runInContext(fs.readFileSync(file, 'utf8'), context);
        const game = Object.create(context.window.Game.prototype);
        const camera = new THREE.PerspectiveCamera(72, 1, .1, 500);
        camera.position.set(8, 16, 8);
        const chunk = { cx: 0, cz: 2, isGenerated: true,
            mesh: { visible: false, castShadow: true }, waterMesh: { visible: true } };
        const mob = { position: new THREE.Vector3(8, 16, 40), mesh: { castShadow: true, visible: false } };
        Object.assign(game, { camera, world: { chunks: { test: chunk } }, mobManager: { mobs: [mob] },
            _cullProjScreenMatrix: new THREE.Matrix4(), _cullFrustum: new THREE.Frustum(),
            _camPos: new THREE.Vector3(), _camDir: new THREE.Vector3(), _cullSphere: new THREE.Sphere() });
        game.performFrustumAndOcclusionCulling();
        assert.equal(chunk.mesh.visible, true, 'offscreen terrain still participates in shadow pass');
        assert.equal(mob.mesh.visible, true);
        assert.equal(chunk.waterMesh.visible, false, 'non-shadow water retains FOV culling');
        chunk.mesh.castShadow = false;
        game.performFrustumAndOcclusionCulling();
        assert.equal(chunk.mesh.visible, false);
        camera.rotation.y = Math.PI;
        game.performFrustumAndOcclusionCulling();
        assert.equal(chunk.mesh.visible, true);
        assert.equal(chunk.waterMesh.visible, true);
    });
}

test('expensive unloading yields before meshing, then resumes on the next frame', () => {
    const { engine, world } = streamingHarness();
    let now = 0;
    engine.context.performance = { now: () => now };
    world.updateWaterPhysics = () => {};
    world.chunkRadius = 0;
    const near = world.generateSingleChunk(0, 0);
    let rebuilds = 0;
    near.rebuildMesh = () => { rebuilds++; near.isDirty = false; };
    for (let x = 10; x < 13; x++) {
        const far = world.generateSingleChunk(x, 0);
        far.dispose = () => { now += 5; };
    }
    for (let frame = 0; frame < 3; frame++) {
        world.update(0, 0);
        assert.equal(rebuilds, 0, 'do not stack mesh installation on a spent frame budget');
        assert.equal(Object.values(world.chunks).length, 3 - frame);
    }
    world.update(0, 0);
    assert.equal(rebuilds, 1);
});

test('chunk bounds contain solid and water geometry without vertex scans', () => {
    const { world } = streamingHarness();
    const material = new THREE.MeshBasicMaterial();
    world.textureManager = { getBlockMaterial: () => material };
    const chunk = world.generateSingleChunk(-2, 3);
    chunk.setBlock(2, 10, 2, 19);
    chunk.rebuildMesh(world.textureManager);
    for (const mesh of [chunk.mesh, chunk.waterMesh]) {
        assert.ok(mesh);
        const geometry = mesh.geometry;
        const position = geometry.getAttribute('position');
        const point = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
            point.fromBufferAttribute(position, i);
            assert.ok(geometry.boundingBox.containsPoint(point));
            assert.ok(geometry.boundingSphere.containsPoint(point));
        }
    }
});

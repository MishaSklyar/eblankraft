const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AuthorityWorld } = require('../server/engine');

test('Dust2 loads native custom pixels and keeps edits over generated designs', () => {
    const w = new AuthorityWorld(1, { worldType: 'de_eblan2' });
    const map = w.context.window.EBLAN_MAPS.de_eblan2;
    assert.equal(map.version, 2);
    assert.equal(map.pixelsPerBlock, 8);
    assert.ok(map.pixelCount > map.blockCount);
    const [key, pairs] = Object.entries(map.chunkDesigns).find(([, p]) => map.designs[p[1]].cells.length < 512);
    const [cx, cz] = key.split(',').map(Number), index = pairs[0];
    const x = cx * 16 + index % 16, y = Math.floor(index / 16) % 32, z = cz * 16 + Math.floor(index / 512);
    w.chunk(cx, cz);
    const design = w.getBlockDesign(x, y, z);
    assert.equal(design.shape, 'custom');
    assert.deepEqual([...design.cells], [...map.designs[pairs[1]].cells]);
    const filled = design.cells[0], empty = Array.from({ length: 512 }, (_, i) => i).find(i => !design.cells.includes(i));
    const point = cell => [x + (cell % 8 + .5) / 8, y + (Math.floor(cell / 8) % 8 + .5) / 8, z + (Math.floor(cell / 64) + .5) / 8];
    const contains = cell => w.world.getBlockBoxes(x, y, z).some(b => {
        const p = point(cell).map((n, i) => n - [x, y, z][i]);
        return p.every((n, i) => n > b[i] && n < b[i + 3]);
    });
    assert.equal(contains(filled), true);
    assert.equal(contains(empty), false);
    w.setBlock(x, y, z, 0);
    assert.equal(w.getBlockDesign(x, y, z), null);
    delete w.world.chunks[key]; w.world.invalidateChunkCache(); w.chunk(cx, cz);
    assert.equal(w.getBlock(x, y, z), 0);
    assert.equal(w.getBlockDesign(x, y, z), null);
    for (const file of ['de_eblan2.js', 'world.js']) assert.equal(fs.readFileSync('js/' + file, 'utf8'), fs.readFileSync('web/js/' + file, 'utf8'));
});

test('Dust2 material tints load through the editor design and material system', () => {
    const w = new AuthorityWorld(1, { worldType: 'de_eblan2' });
    const map = w.context.window.EBLAN_MAPS.de_eblan2;
    const colors = new Set(map.designs.map(d => d.color));
    for (const color of ['#f1d5bb', '#e5bd90', '#a98970', '#b4bf8a']) assert.ok(colors.has(color), color);
    assert.ok(map.designs.every(d => /^#[0-9a-f]{6}$/.test(d.color)));
    const THREE = require('../js/three.min.js');
    const manager = vm.runInContext('Object.create(TextureManager.prototype)', w.context);
    const base = new THREE.MeshLambertMaterial({ color: 0xffffff });
    manager.getBlockMaterial = () => base;
    for (const color of ['#f1d5bb', '#a98970', '#b4bf8a']) {
        let found = false;
        for (const [key, pairs] of Object.entries(map.chunkDesigns)) {
            const at = pairs.findIndex((n, i) => i % 2 === 1 && map.designs[n].color === color);
            if (at < 0) continue;
            const [cx, cz] = key.split(',').map(Number), index = pairs[at - 1];
            const x = cx * 16 + index % 16, y = Math.floor(index / 16) % 32, z = cz * 16 + Math.floor(index / 512);
            w.chunk(cx, cz);
            const design = w.getBlockDesign(x, y, z);
            assert.equal(design.color, color);
            const material = manager.getDesignMaterial(w.getBlock(x, y, z), design);
            assert.equal(material.color.getHexString(), color.slice(1));
            assert.equal(manager.getDesignMaterial(w.getBlock(x, y, z), design), material, 'same tint reuses its material');
            assert.equal(base.color.getHexString(), 'ffffff', 'tint does not alter the base material');
            found = true; break;
        }
        assert.ok(found, color);
    }
});

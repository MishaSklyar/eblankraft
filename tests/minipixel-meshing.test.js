const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthorityWorld } = require('../server/engine');
const THREE = require('../js/three.min.js');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
    const w = new AuthorityWorld(1, { worldType: 'flat' });
    w.chunk(0, 0).fill(0);
    const material = new THREE.MeshLambertMaterial();
    const manager = { getBlockMaterial: () => material, getDesignMaterial: () => material };
    const design = cells => ({ shape: 'custom', cells, color: '#ffffff', opacity: 1, solid: true, emissive: 0 });
    const mesh = (cx = 0) => { const c = w.world.getChunk(cx, 0); c.rebuildMesh(manager); return c.mesh.geometry; };
    return { w, design, mesh };
}
test('pixel sheet merges to six rectangles and uses block-scale UVs on all sides', () => {
    const { w, design, mesh } = setup();
    const cells = Array.from({ length: 64 }, (_, i) => i % 8 + 64 * Math.floor(i / 8));
    w.setBlock(2, 10, 3, w.blocks.STONE, design(cells));
    const g = mesh(), p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = g.getAttribute('uv');
    assert.equal(p.count, 36, 'a flat sheet needs six quads instead of 160 pixel quads');
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) - 2, y = p.getY(i) - 10, z = p.getZ(i) - 3;
        const expected = n.getX(i) > 0 ? [1 - z, y] : n.getX(i) < 0 ? [z, y] :
            n.getY(i) > 0 ? [x, 1 - z] : n.getY(i) < 0 ? [x, z] : n.getZ(i) > 0 ? [x, y] : [1 - x, y];
        assert.equal(uv.getX(i), expected[0]); assert.equal(uv.getY(i), expected[1]);
    }
});
test('carved faces cull across chunk seams but remain behind transparent neighbors', () => {
    const { w, design, mesh } = setup();
    w.chunk(1, 0).fill(0);
    const cells = Array.from({ length: 512 }, (_, i) => i);
    w.setBlock(15, 10, 3, w.blocks.STONE, design(cells));
    w.setBlock(16, 10, 3, w.blocks.STONE, design(cells));
    assert.equal(mesh().getAttribute('position').count, 30);
    assert.equal(mesh(1).getAttribute('position').count, 30);
    w.setBlock(16, 10, 3, w.blocks.STONE, { ...design(cells), opacity: .5 });
    assert.equal(mesh().getAttribute('position').count, 36);
});
test('partial pixel neighbors hide only matching occupied boundary pixels', () => {
    const { w, design, mesh } = setup();
    w.setBlock(2, 10, 3, w.blocks.STONE, design([7, 15]));
    w.setBlock(3, 10, 3, w.blocks.STONE, design([0]));
    const g = mesh(), p = g.getAttribute('position'), n = g.getAttribute('normal');
    let seamTriangles = 0;
    for (let i = 0; i < p.count; i += 3) {
        if (n.getX(i) === 1 && p.getX(i) === 3) {
            seamTriangles++;
            for (let j = 0; j < 3; j++) assert.ok(p.getY(i + j) >= 10.125);
        }
    }
    assert.equal(seamTriangles, 2, 'only the unoccluded upper pixel face remains');
});
test('greedy rectangles preserve exposed area for irregular carved geometry', () => {
    const { w, design } = setup();
    const cells = Array.from({ length: 512 }, (_, i) => i).filter(i => (i * 17 % 23) < 13);
    w.context.sampleDesign = design(cells);
    const surface = vm.runInContext('carvedSurface(sampleDesign)', w.context);
    let rectanglesArea = 0, pixelFaces = 0;
    for (let f = 0; f < 6; f++) {
        const axis = f >> 1, u = axis === 0 ? 1 : 0, v = axis === 2 ? 1 : 2;
        for (const slice of surface.sides[f]) {
            pixelFaces += slice.mask.reduce((a, b) => a + b, 0);
            for (const b of slice.faces) rectanglesArea += (b[u + 3] - b[u]) * (b[v + 3] - b[v]);
        }
    }
    assert.equal(rectanglesArea, pixelFaces / 64);
    assert.equal(fs.readFileSync('js/world.js', 'utf8'), fs.readFileSync('web/js/world.js', 'utf8'));
});

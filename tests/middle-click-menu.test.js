const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

function load(prefix) {
    const node = () => ({ style: {}, children: [], classList: { add() {}, toggle() {} },
        appendChild(child) { this.children.push(child); }, remove() { this.removed = true; } });
    const context = vm.createContext({ window: {}, THREE, document: { createElement: node, body: node() } });
    for (const name of ['textures', 'items', 'world', 'player', 'controls'])
        vm.runInContext(fs.readFileSync(`${prefix}/${name}.js`, 'utf8'), context);
    vm.runInContext('this.Controls = Controls; this.Chunk = Chunk;', context);
    return context;
}
for (const prefix of ['js', 'web/js']) {
    test(`${prefix}: creative middle menu applies gesture to original target, cancellation and survival are inert`, () => {
        const c = load(prefix), blocks = c.window.BLOCK_TYPES;
        const edits = [], broadcasts = [], opened = [];
        c.window.BlockEditor = { open: (controls, target, tab) => opened.push({ target: { ...target }, tab }) };
        const controls = Object.create(c.Controls.prototype);
        controls.player = { isCreative: true, targetBlock: { x: 3, y: 4, z: 5, type: blocks.STONE },
            position: { x: 0, y: 10, z: 0 }, width: .6, depth: .6, height: 1.8,
            setBlocking() {}, world: { getBlock: () => blocks.STONE, setBlock: (...args) => edits.push(args), updateMeshes() {} },
            game: { textureManager: { getTextureCanvas: () => ({ toDataURL: () => 'data:image/png;base64,' }) },
                multiplayer: { broadcastBlockPlace: (...args) => broadcasts.push(args) } } };
        controls.openMiddleClickMenu();
        assert.equal(controls.middleClickMenu.options.length, 5);
        controls.closeMiddleClickMenu(true);
        assert.equal(edits.length, 0, 'neutral click leaves block unchanged');
        controls.openMiddleClickMenu();
        controls.moveMiddleClickMenu(0, -100);
        assert.equal(controls.middleClickMenu.selected, 0);
        controls.player.targetBlock = { x: 10, y: 4, z: 5, type: blocks.STONE };
        controls.closeMiddleClickMenu(true);
        assert.deepEqual(JSON.parse(JSON.stringify(opened[0])), { target: { x: 3, y: 4, z: 5, type: blocks.STONE }, tab: 0 });
        assert.equal(edits.length, 0);
        assert.equal(broadcasts.length, 0);
        controls.openMiddleClickMenu(); controls.moveMiddleClickMenu(0, -100); controls.closeMiddleClickMenu();
        assert.equal(opened.length, 1);
        controls.player.isCreative = false; controls.openMiddleClickMenu();
        assert.equal(controls.middleClickMenu, null);
    });

    test(`${prefix}: slabs render at half height and physics and picking respect empty upper half`, () => {
        const c = load(prefix), blocks = c.window.BLOCK_TYPES;
        const scene = new THREE.Scene(), material = new THREE.MeshBasicMaterial();
        const world = { scene, getChunk: () => null };
        const chunk = new c.Chunk(0, 0, world);
        chunk.isGenerated = true;
        chunk.setBlock(4, 4, 4, blocks.STONE_SLAB);
        chunk.rebuildMesh({ getBlockMaterial: () => material }, { positions: new Float32Array(), groups: [] });
        const vertices = chunk.mesh.geometry.getAttribute('position');
        const ys = Array.from({ length: vertices.count }, (_, i) => vertices.getY(i));
        assert.equal(Math.min(...ys), 4); assert.equal(Math.max(...ys), 4.5);
        assert.equal(vertices.count, 36);
        const player = Object.create(c.window.Player.prototype);
        Object.assign(player, { world: { getBlock: (x, y, z) => x === 4 && y === 4 && z === 4 ? blocks.STONE_SLAB : 0 },
            width: .6, depth: .6, height: 1.8, position: new THREE.Vector3(4.5, 4.5, 6.5),
            eyeHeight: .25, yaw: 0, pitch: 0, _rayOrigin: new THREE.Vector3(), _rayDir: new THREE.Vector3(),
            wireframeBox: new THREE.Object3D() });
        assert.equal(player.checkCollision({ x: 4.5, y: 4.5, z: 4.5 }), false);
        assert.equal(player.checkCollision({ x: 4.5, y: 4.4, z: 4.5 }), true);
        player.updateRaycast(); assert.equal(player.targetBlock, null, 'horizontal ray passes above slab');
        player.position.set(4.5, 6, 4.5); player.pitch = -Math.PI / 2;
        player.updateRaycast();
        assert.equal(player.targetBlock.type, blocks.STONE_SLAB); assert.equal(player.targetBlock.ny, 1);
        assert.equal(player.wireframeBox.position.y, 4.25); assert.equal(player.wireframeBox.scale.y, .5);
        assert.equal(c.window.BLOCK_DROP_MAP[blocks.STONE_SLAB], 'stone_slab');
    });
}

for (const prefix of ['js', 'web/js']) {
    test(`${prefix}: mouse motion selects menu without rotating camera`, () => {
        const context = load(prefix);
        const source = fs.readFileSync(`${prefix}/controls.js`, 'utf8');
        const start = source.indexOf('// Mouse look');
        const end = source.indexOf('// Mouse Buttons', start);
        let move;
        context.document.addEventListener = (event, handler) => { if (event === 'mousemove') move = handler; };
        const controls = Object.create(context.Controls.prototype);
        controls.player = { yaw: 1, pitch: .2 }; controls.isPointerLocked = true;
        controls.mouseSensitivity = .01; controls.middleClickMenu = {};
        let gesture;
        controls.moveMiddleClickMenu = (x, y) => { gesture = [x, y]; };
        context.controls = controls;
        vm.runInContext(`(function () { ${source.slice(start, end)} }).call(controls)`, context);
        move({ movementX: 20, movementY: 10 });
        assert.deepEqual(gesture, [20, 10]);
        assert.equal(controls.player.yaw, 1); assert.equal(controls.player.pitch, .2);
        controls.middleClickMenu = null; move({ movementX: 20, movementY: 10 });
        assert.equal(controls.player.yaw, .8); assert.equal(controls.player.pitch, .1);
    });
    test(`${prefix}: panel, pillar and beam geometry and collisions match their bounds`, () => {
        const c = load(prefix), blocks = c.window.BLOCK_TYPES;
        for (const shape of ['PANEL_X', 'PANEL_Z', 'PILLAR', 'BEAM']) {
            const type = blocks['STONE_' + shape], bounds = c.window.getBlockBounds(type);
            const chunk = new c.Chunk(0, 0, { scene: new THREE.Scene(), getChunk: () => null });
            chunk.isGenerated = true; chunk.setBlock(4, 4, 4, type);
            chunk.rebuildMesh({ getBlockMaterial: () => new THREE.MeshBasicMaterial() }, null);
            const vertices = chunk.mesh.geometry.getAttribute('position');
            for (let axis = 0; axis < 3; axis++) {
                const values = Array.from({ length: vertices.count }, (_, i) => vertices.array[i * 3 + axis]);
                assert.equal(Math.min(...values), 4 + bounds[axis]);
                assert.equal(Math.max(...values), 4 + bounds[axis + 3]);
            }
            const player = Object.create(c.window.Player.prototype);
            Object.assign(player, { world: { getBlock: (x, y, z) => x === 4 && y === 4 && z === 4 ? type : 0 },
                width: .1, depth: .1, height: .1 });
            assert.equal(player.checkCollision({ x: 4.5, y: 4.45, z: 4.5 }), true);
            assert.equal(player.checkCollision({ x: 4.1, y: 4.1, z: 4.1 }), false);
            assert.ok(c.window.ITEM_REGISTRY[c.window.BLOCK_DROP_MAP[type]]);
        }
        assert.ok(Math.max(...Object.values(blocks)) <= 255, 'forms fit saved voxel IDs');
    });
}

for (const prefix of ['js', 'web/js']) {
    test(`${prefix}: mobile TNT button opens editor in creative and preserves survival TNT`, () => {
        const c = load(prefix), handlers = {};
        c.document.getElementById = id => id === 'touch-zone-left' || id === 'touch-zone-right' ? { addEventListener() {} } : null;
        const controls = Object.create(c.Controls.prototype);
        const opened = []; let bombs = 0;
        controls.player = { isCreative: true, detonateTNT() { bombs++; } };
        controls.bindTouchButton = (id, handler) => { handlers[id] = handler; };
        controls.openMiddleClickMenu = touch => opened.push(touch);
        controls.setupTouchControls();
        handlers['btn-tnt'](true); handlers['btn-tnt'](false);
        assert.deepEqual(opened, [true]); assert.equal(bombs, 0);
        controls.player.isCreative = false; handlers['btn-tnt'](true);
        assert.equal(bombs, 1);
    });
    test(`${prefix}: mobile circle supports tap selection and keeps its target`, () => {
        const c = load(prefix), opened = [];
        c.window.innerWidth = 390; c.window.innerHeight = 844;
        c.document.createElement = () => ({ style: {}, children: [], handlers: {}, attributes: {},
            classList: { toggle() {}, add() {} }, appendChild(child) { this.children.push(child); },
            addEventListener(name, handler) { this.handlers[name] = handler; },
            setAttribute(name, value) { this.attributes[name] = value; }, remove() {} });
        c.window.BlockEditor = { open: (controls, target, tab) => opened.push({ target: { ...target }, tab }) };
        const controls = Object.create(c.Controls.prototype);
        controls.inputVector = new THREE.Vector2(1, 1);
        controls.player = { isCreative: true, targetBlock: { x: 1, y: 2, z: 3, type: 9 },
            world: { getBlock: () => 9 }, setBlocking() {} };
        controls.openMiddleClickMenu(true);
        assert.equal(controls.middleClickMenu.touch, true);
        assert.equal(controls.inputVector.length(), 0);
        const size = controls.middleClickMenu.options[1].element;
        assert.equal(size.attributes['aria-label'], 'Поменять размер');
        size.handlers.click({ preventDefault() {}, stopPropagation() {} });
        assert.equal(controls.middleClickMenu, null);
        assert.deepEqual(JSON.parse(JSON.stringify(opened[0])), { target: { x: 1, y: 2, z: 3, type: 9 }, tab: 1 });
    });
}

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

const TYPES = ['default', 'bayonet', 'huntsman', 'm9', 'butterfly', 'karambit', 'gold'];

for (const prefix of ['js', 'web/js']) {
    function load() {
        const c = vm.createContext({ THREE, performance, console, ITEM_TYPES: {}, ITEM_REGISTRY: {
            knife_m9: { isKnife: true, isSword: true, icon: 'knife_m9' } },
            localStorage: { getItem: () => null }, document: { getElementById: () => null } });
        c.window = c;
        for (const f of ['upgrader_skins', 'player']) vm.runInContext(fs.readFileSync(`${prefix}/${f}.js`, 'utf8'), c);
        return c;
    }
    const pose = (c, extra = {}) => {
        const p = Object.create(c.Player.prototype);
        Object.assign(p, { itemPivot: new THREE.Group(), armSwing: 0, onGround: true, isSprinting: false,
            heldKnifeMesh: c.createVoxelKnifeModel('m9'), ...extra });
        return p;
    };

    test(`${prefix}: every CS knife has a distinct 3D model pointing along -Z with its pivot at the handle`, () => {
        const c = load();
        const sigs = new Set();
        for (const type of TYPES) {
            const k = c.createVoxelKnifeModel(type);
            assert.equal(k.name, 'knife_' + type);
            let meshes = 0; k.traverse(n => { if (n.isMesh) { meshes++; assert.equal(n.geometry.type, 'BoxGeometry'); } });
            assert.ok(meshes >= 12, `${type} is built from enough parts`);
            const b = new THREE.Box3().setFromObject(k);
            assert.ok(b.min.z < -.2 && b.min.z > -.45, `${type}: blade points to -Z`);
            assert.ok(b.max.z > .02 && b.max.z < .35, `${type}: handle behind the pivot`);
            sigs.add(JSON.stringify([meshes, +b.min.z.toFixed(3), +b.max.z.toFixed(3), k.children[0].children[0].material.color.getHex()]));
        }
        assert.equal(sigs.size, TYPES.length);
    });

    test(`${prefix}: knife viewmodel — draw settles, attacks alternate slash/back-slash/stab, inspect rolls and ends`, () => {
        const c = load();
        const p = pose(c, { knifeDraw: 1 });
        const idle = () => { p.updateKnifeView(1 / 60, 0, 0, 0); return p.itemPivot.position.clone(); };
        const first = idle();
        for (let i = 0; i < 60; i++) idle();
        const settled = idle();
        assert.ok(settled.y > first.y + .2, 'draw comes up from below');
        // three attacks -> three different swing variants
        const poses = [];
        for (let k = 0; k < 3; k++) {
            p.armSwing = 1; p.updateKnifeView(1 / 60, 0, 0, 0);           // new swing detected
            p.updateKnifeView(1 / 60, 0, 0, 1);                             // peak of the swing
            poses.push(p.itemPivot.position.toArray().concat(p.itemPivot.rotation.toArray().slice(0, 3)).map(v => +v.toFixed(2)).join());
            p.armSwing = 0; p.updateKnifeView(1 / 60, 0, 0, 0);
        }
        assert.equal(new Set(poses).size, 3, 'slash, back-slash and stab differ');
        // inspect rolls the knife itself, then returns to rest
        p.getSelectedItem = () => ({ itemId: 'knife_m9' });
        assert.equal(p.inspectKnife(), true);
        let maxRoll = 0;
        for (let i = 0; i < 200; i++) { p.updateKnifeView(1 / 60, 0, 0, 0); maxRoll = Math.max(maxRoll, Math.abs(p.heldKnifeMesh.rotation.z)); }
        assert.ok(maxRoll > 3, 'knife rolls');
        assert.equal(p.knifeInspect, 0);
        assert.ok(Math.abs(p.heldKnifeMesh.rotation.z) < 1e-6 || Math.abs(p.heldKnifeMesh.rotation.z - Math.PI * 2) < 1e-6 || p.heldKnifeMesh.rotation.z === 0);
        for (const v of [...p.itemPivot.position.toArray(), ...p.itemPivot.rotation.toArray().slice(0, 3)]) assert.ok(Number.isFinite(v));
        // cannot inspect without a knife
        p.getSelectedItem = () => ({ itemId: 'stone' });
        assert.equal(p.inspectKnife(), false);
    });

    test(`${prefix}: every knife type has its own pickup and inspect animation that start offset and end at rest`, () => {
        const c = load();
        const sigs = new Set();
        for (const type of TYPES) {
            const p = pose(c, { knifeDraw: 1, _knifeType: type, heldKnifeMesh: c.createVoxelKnifeModel(type) });
            p.getSelectedItem = () => ({ itemId: 'knife_m9' });
            p.updateKnifeView(1 / 60, 0, 0, 0);
            const r0 = p.heldKnifeMesh.rotation, start = [p.itemPivot.position.y, r0.x, r0.y, r0.z].map(v => +v.toFixed(2)).join();
            for (let i = 0; i < 120; i++) p.updateKnifeView(1 / 60, 0, 0, 0);
            assert.equal(p.knifeDraw, 0, `${type}: pickup ends`);
            assert.deepEqual(p.heldKnifeMesh.rotation.toArray().slice(0, 3), [0, 0, 0], `${type}: knife at rest after pickup`);
            p.knifeInspect = 1; let moved = 0;
            for (let i = 0; i < 400; i++) { p.updateKnifeView(1 / 60, 0, 0, 0); const q = p.heldKnifeMesh.rotation; moved = Math.max(moved, Math.abs(q.x), Math.abs(q.y), Math.abs(q.z)); }
            assert.ok(moved > .5, `${type}: inspect animates the knife`);
            assert.equal(p.knifeInspect, 0);
            sigs.add(start + '|' + moved.toFixed(2));
        }
        assert.equal(sigs.size, TYPES.length, 'animations differ per knife');
    });

    test(`${prefix}: every knife has its own hold pose and swing; balisong handles fan; karambit spins around its ring`, () => {
        const c = load();
        const holds = new Set(), swings = new Set();
        for (const type of TYPES) {
            const p = pose(c, { knifeDraw: 0, _knifeType: type, heldKnifeMesh: c.createVoxelKnifeModel(type) });
            p.updateKnifeView(1 / 60, 0, 0, 0);
            holds.add([...p.itemPivot.position.toArray(), ...p.itemPivot.rotation.toArray().slice(0, 3), c.KNIFE_ANIMS[type].pose.scale].map(v => +v.toFixed(2)).join());
            const row = [];
            for (let k = 0; k < 3; k++) {
                p.armSwing = 1; p.updateKnifeView(1 / 60, 0, 0, 0); p.updateKnifeView(1 / 60, 0, 0, 1);
                row.push([...p.itemPivot.position.toArray(), ...p.heldKnifeMesh.rotation.toArray().slice(0, 3)].map(v => +v.toFixed(2)).join());
                p.armSwing = 0; p.updateKnifeView(1 / 60, 0, 0, 0);
            }
            swings.add(row.join('|'));
        }
        assert.equal(holds.size, TYPES.length, 'hold pose differs per knife');
        assert.equal(swings.size, TYPES.length, 'swings differ per knife');
        // butterfly: handle halves rotate during inspect
        const b = pose(c, { _knifeType: 'butterfly', heldKnifeMesh: c.createVoxelKnifeModel('butterfly'), knifeInspect: .75 });
        b.updateKnifeView(1 / 60, 0, 0, 0);
        const [hA, hB] = b.heldKnifeMesh.userData.halves;
        assert.ok(hA.rotation.x > 1 && hB.rotation.x > 0 && hA.rotation.x !== hB.rotation.x, 'handles fan out of sync');
        // karambit: the spin keeps the ring in place (pivot offset), the handle moves
        const k = pose(c, { _knifeType: 'karambit', heldKnifeMesh: c.createVoxelKnifeModel('karambit'), knifeInspect: .8 });
        k.updateKnifeView(1 / 60, 0, 0, 0);
        const m = k.heldKnifeMesh, ring = new THREE.Vector3(...c.KNIFE_ANIMS.karambit.pivot);
        const worldRing = ring.clone().applyEuler(m.rotation).multiplyScalar(m.scale.x).add(m.position);
        assert.ok(worldRing.distanceTo(ring.clone().multiplyScalar(m.scale.x)) < 1e-6, 'ring stays fixed while spinning');
        assert.ok(m.position.length() > .01, 'knife orbits the ring');
    });
}

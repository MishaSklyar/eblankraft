const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

const TYPES = ['default', 'bayonet', 'huntsman', 'm9', 'butterfly', 'karambit', 'gold'];
const DT = 1 / 60;
const r2 = v => +v.toFixed(2);
const wrapPi = a => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

for (const prefix of ['js', 'web/js']) {
    function load() {
        const c = vm.createContext({ THREE, performance, console, ITEM_TYPES: {}, ITEM_REGISTRY: {
            knife_m9: { isKnife: true, isSword: true, icon: 'knife_m9' } },
            localStorage: { getItem: () => null }, document: { getElementById: () => null } });
        c.window = c;
        for (const f of ['upgrader_skins', 'player']) vm.runInContext(fs.readFileSync(`${prefix}/${f}.js`, 'utf8'), c);
        return c;
    }
    // a bare Player with just what the knife viewmodel needs; rig = true also builds the glove, forearm and trail
    const mk = (c, type = 'm9', extra = {}, rig = false) => {
        const p = Object.create(c.Player.prototype);
        const km = c.createVoxelKnifeModel(type);
        km.scale.setScalar(c.KNIFE_ANIMS[type].pose.scale);
        Object.assign(p, { itemPivot: new THREE.Group(), armSwing: 0, onGround: true, isSprinting: false, yaw: 0, pitch: 0,
            walkCycle: 0, velocity: new THREE.Vector3(), _knifeType: type, knifeDraw: 0, knifeInspect: 0, heldKnifeMesh: km, ...extra });
        p.itemPivot.add(km);
        p.getSelectedItem = () => ({ itemId: 'knife_m9' });
        if (rig) { p.handGroup = new THREE.Group(); p.handGroup.add(p.itemPivot); p.buildKnifeRig(type); }
        return p;
    };
    const run = (p, n) => { for (let i = 0; i < n; i++) p.updateKnifeView(DT); };
    const state = p => [...p.itemPivot.position.toArray(), ...p.itemPivot.quaternion.toArray()];
    const attack = p => { p.armSwing = 1; p.updateKnifeView(DT); p.armSwing = 0; };

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
            assert.ok(k.userData.tip.z < k.userData.mid.z && k.userData.tip.z >= b.min.z - .02, `${type}: blade tip for the slash trail`);
            sigs.add(JSON.stringify([meshes, +b.min.z.toFixed(3), +b.max.z.toFixed(3), k.children[0].children[0].material.color.getHex()]));
        }
        assert.equal(sigs.size, TYPES.length);
    });

    test(`${prefix}: spline clips pass through their keys, start/end at rest and stay smooth`, () => {
        const c = load();
        const clip = c.knifeClip(1, [[.25, { px: .3 }], [.5, { px: -.2, ry: 1 }]]);
        assert.equal(c.sampleKnifeTrack(clip.tracks.px, 0), 0);
        assert.ok(Math.abs(c.sampleKnifeTrack(clip.tracks.px, .25) - .3) < 1e-9);
        assert.ok(Math.abs(c.sampleKnifeTrack(clip.tracks.px, .5) + .2) < 1e-9);
        assert.equal(c.sampleKnifeTrack(clip.tracks.px, 1), 0);
        assert.equal(c.sampleKnifeTrack(clip.tracks.ry, 1), 0);
        let prev = 0, maxStep = 0;
        for (let t = 0; t <= 1; t += .005) { const v = c.sampleKnifeTrack(clip.tracks.px, t); maxStep = Math.max(maxStep, Math.abs(v - prev)); prev = v; }
        assert.ok(maxStep < .02, 'no jumps between samples');
    });

    test(`${prefix}: draw rises from below and settles, attacks run a 3-hit combo that resets, inspect plays and ends`, () => {
        const c = load();
        const p = mk(c, 'm9', { knifeDraw: 1 });
        p.updateKnifeView(DT);
        const first = p.itemPivot.position.clone();
        run(p, 90);
        assert.equal(p.knifeDraw, 0);
        const rest = p.itemPivot.position.clone();
        assert.ok(rest.y > first.y + .2, 'draw comes up from below');
        assert.ok(p.heldKnifeMesh.rotation.toArray().slice(0, 3).every(v => Math.abs(wrapPi(v)) < 1e-6), 'knife at rest after the draw');

        // three attacks in a row -> slash, back-slash, stab: each sampled at its strike
        const strikes = [];
        for (let k = 0; k < 3; k++) {
            attack(p);
            assert.equal(p.knifeSwingIdx, k);
            run(p, 11);
            strikes.push(state(p).map(r2).join());
            run(p, 25);
        }
        assert.equal(new Set(strikes).size, 3, 'slash, back-slash and stab differ');
        run(p, 60);
        attack(p);
        assert.equal(p.knifeSwingIdx, 0, 'combo resets after a pause');
        run(p, 60);
        assert.ok(p.itemPivot.position.distanceTo(rest) < .01, 'returns to the hold pose');

        assert.equal(p.inspectKnife(), true);
        let moved = 0;
        for (let i = 0; i < 260; i++) { p.updateKnifeView(DT); moved = Math.max(moved, p.itemPivot.position.distanceTo(rest)); }
        assert.ok(moved > .05, 'inspect brings the knife up');
        assert.equal(p.knifeInspect, 0);
        for (const v of state(p)) assert.ok(Number.isFinite(v));
        p.getSelectedItem = () => ({ itemId: 'stone' });
        assert.equal(p.inspectKnife(), false, 'cannot inspect without a knife');
    });

    test(`${prefix}: no pops — every frame of draw, interrupted inspect and chained attacks moves continuously`, () => {
        const c = load();
        for (const type of TYPES) {
            const p = mk(c, type, { knifeDraw: 1 });
            p.updateKnifeView(DT);
            let prev = state(p), maxJump = 0;
            const tick = () => {
                p.updateKnifeView(DT);
                const s = state(p);
                const dq = 1 - Math.abs(s.slice(3).reduce((a, v, i) => a + v * prev[3 + i], 0));
                maxJump = Math.max(maxJump, Math.hypot(s[0] - prev[0], s[1] - prev[1], s[2] - prev[2]), dq);
                prev = s;
            };
            for (let i = 0; i < 80; i++) tick();
            p.inspectKnife();
            for (let i = 0; i < 40; i++) tick();
            p.armSwing = 1; tick(); p.armSwing = 0;               // attack cancels the inspect
            for (let i = 0; i < 9; i++) tick();
            p.armSwing = 1; tick(); p.armSwing = 0;               // next hit cuts the first one short
            for (let i = 0; i < 60; i++) tick();
            assert.ok(maxJump < .095, `${type}: largest per-frame jump ${maxJump.toFixed(3)}`);
        }
    });

    test(`${prefix}: every knife has its own hold pose, pickup, swings and inspect`, () => {
        const c = load();
        const holds = new Set(), draws = new Set(), swings = new Set(), inspects = new Set();
        for (const type of TYPES) {
            const p = mk(c, type, { knifeDraw: 1 });
            p.updateKnifeView(DT);
            draws.add(state(p).map(r2).join() + p.heldKnifeMesh.rotation.toArray().slice(0, 3).map(r2).join());
            run(p, 90);
            assert.equal(p.knifeDraw, 0, `${type}: pickup ends`);
            holds.add(state(p).map(r2).join());
            const row = [];
            for (let k = 0; k < 3; k++) { attack(p); run(p, 12); row.push(state(p).map(r2).join() + p.heldKnifeMesh.rotation.toArray().slice(0, 3).map(r2).join()); run(p, 30); }
            swings.add(row.join('|'));
            run(p, 60);
            p.inspectKnife(); let moved = 0; const sig = [];
            for (let i = 0; i < 260; i++) {
                p.updateKnifeView(DT);
                const q = p.heldKnifeMesh.rotation;
                moved = Math.max(moved, Math.abs(wrapPi(q.x)), Math.abs(wrapPi(q.y)), Math.abs(wrapPi(q.z)));
                if (i % 20 === 0) sig.push(state(p).map(r2).join());
            }
            assert.ok(moved > .5, `${type}: inspect spins the knife in the hand`);
            assert.equal(p.knifeInspect, 0);
            inspects.add(sig.join('|'));
        }
        for (const [name, set] of Object.entries({ holds, draws, swings, inspects })) assert.equal(set.size, TYPES.length, `${name} differ per knife`);
    });

    test(`${prefix}: balisong handles fan out of sync; karambit sits in a reverse grip and spins around its ring`, () => {
        const c = load();
        const b = mk(c, 'butterfly', { knifeInspect: .75 });
        b.updateKnifeView(DT);
        const [hA, hB] = b.heldKnifeMesh.userData.halves;
        assert.ok(hA.rotation.x > 1 && hB.rotation.x > 0 && hA.rotation.x !== hB.rotation.x, 'handles fan out of sync');

        const k = mk(c, 'karambit');
        k.updateKnifeView(DT);
        const m = k.heldKnifeMesh, anim = c.KNIFE_ANIMS.karambit, s = m.scale.x;
        const ringInHand = () => new THREE.Vector3(...anim.pivot).multiplyScalar(s).applyQuaternion(m.quaternion).add(m.position);
        const restRing = ringInHand();
        const tipDir = new THREE.Vector3(0, 0, -1).applyQuaternion(m.quaternion);
        assert.ok(tipDir.z > .9, 'reverse grip: blade comes out of the pinky side');
        k.knifeInspect = .8; k.updateKnifeView(DT);
        assert.ok(ringInHand().distanceTo(restRing) < 1e-6, 'ring stays on the finger while spinning');
        assert.ok(m.position.distanceTo(new THREE.Vector3(...anim.mount.pos).multiplyScalar(s)) > .01, 'knife orbits the ring');
    });

    test(`${prefix}: gloved hand, forearm on the wrist, slash trail, sprint / sway / block layers`, () => {
        const c = load();
        const p = mk(c, 'default', {}, true);
        run(p, 30);
        assert.ok(p.knifeHand && p.knifeHand.userData.fingers.children.length >= 12, 'fingers wrap the handle');
        const anim = c.KNIFE_ANIMS.default;
        const wrist = new THREE.Vector3(...anim.wrist).multiplyScalar(anim.pose.scale).applyMatrix4(p.itemPivot.matrix);
        assert.ok(p.knifeForearm.position.distanceTo(wrist) < 1e-6, 'forearm starts at the wrist');
        const armDir = new THREE.Vector3(0, 1, 0).applyQuaternion(p.knifeForearm.quaternion);
        assert.ok(armDir.x > .3 && armDir.y < 0, 'forearm runs to the bottom-right');

        let trail = false;
        attack(p);
        for (let i = 0; i < 30; i++) { p.updateKnifeView(DT); trail = trail || p._knifeTrail.visible; }
        assert.ok(trail, 'trail shows during the strike');
        run(p, 30);
        assert.equal(p._knifeTrail.visible, false, 'and fades out');

        const rest = p.itemPivot.position.clone();
        p.isSprinting = true; run(p, 40);
        assert.ok(p.itemPivot.position.y < rest.y - .03, 'sprint lowers the knife');
        p.isSprinting = false; run(p, 60);
        p.yaw -= .3; p.updateKnifeView(DT); run(p, 2);
        assert.ok(p.itemPivot.position.x < rest.x - .005, 'turning right drags the knife left (sway)');
        run(p, 90);
        assert.ok(p.itemPivot.position.distanceTo(rest) < .01, 'sway settles');
        p.isBlocking = true; run(p, 30);
        assert.ok(p.itemPivot.position.distanceTo(rest) > .05, 'block raises a guard');
        p.disposeKnifeRig();
        assert.equal(p.knifeHand, null);
        assert.equal(p.knifeForearm, null);
    });
}

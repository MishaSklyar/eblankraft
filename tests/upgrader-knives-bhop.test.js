const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

for (const prefix of ['js', 'web/js']) {
    function load(files) {
        const c = vm.createContext({ THREE, console, localStorage: { getItem: () => null, setItem() {} }, document: { createElement: () => ({ getContext: () => ({}) }) } });
        c.window = c;
        for (const f of files) vm.runInContext(fs.readFileSync(`${prefix}/${f}.js`, 'utf8'), c);
        return c;
    }

    test(`${prefix}: CS knives are registered as fast melee weapons with icons and values`, () => {
        const c = load(['textures', 'items']);
        const knives = Object.values(c.ITEM_REGISTRY).filter(r => r.isKnife);
        assert.equal(knives.length, 7);
        for (const k of knives) {
            assert.equal(k.category, 'weapon');
            assert.ok(k.isSword && k.attackSpeed >= 2.5 && k.attackDamage > 0 && k.value > 0, k.id);
        }
    });

    test(`${prefix}: upgrader chance math, targets and roll are consistent`, () => {
        const c = load(['textures', 'items']);
        try { vm.runInContext(fs.readFileSync(`${prefix}/upgrader_skins.js`, 'utf8'), c); } catch (e) { /* skin manager needs a DOM, helpers are defined before it */ }
        assert.ok(c.calcUpgradeChance, 'helpers exported');
        assert.equal(c.calcUpgradeChance(0, 100), 0);
        assert.ok(Math.abs(c.calcUpgradeChance(50, 100) - 0.475) < 1e-9, 'house edge applied');
        assert.equal(c.calcUpgradeChance(1000, 10), 0.9, 'capped');
        assert.equal(c.calcUpgradeChance(1, 100000), 0.01, 'floored');
        const targets = c.getUpgradeTargets(100);
        assert.ok(targets.length > 5 && targets.every(t => t.value > 105));
        assert.ok(targets.every((t, i) => i === 0 || targets[i - 1].value <= t.value), 'sorted');
        assert.ok(targets.some(t => t.id === 'knife_karambit'));
        assert.ok(c.getUpgradeTargets(100, '', true).every(t => t.reg.isKnife));
        // roll: win lands inside the win zone, loss outside; frequency matches chance
        let wins = 0;
        for (let i = 0; i < 20000; i++) {
            const r = c.rollUpgrade(0.3);
            assert.equal(r.angle < 108, r.win);
            if (r.win) wins++;
        }
        assert.ok(Math.abs(wins / 20000 - 0.3) < 0.02);
    });

    test(`${prefix}: bunny hop air strafing gains speed, straight air keeps it, speed is capped`, () => {
        const c = load(['textures', 'items', 'player']);
        const fake = () => ({ velocity: new THREE.Vector3(6, 0, 0) });
        const hop = (p, mx, mz, frames = 60) => { for (let i = 0; i < frames; i++) c.Player.prototype.airAccelerate.call(p, mx, mz, 4.5, 1 / 60); return Math.hypot(p.velocity.x, p.velocity.z); };
        // moving +x, strafing +z with the camera turned (wish dir perpendicular) -> speed grows
        const strafe = fake(); assert.ok(hop(strafe, 0, 1, 20) > 6.01);
        // holding forward along the current velocity does not change speed
        const straight = fake(); assert.ok(Math.abs(hop(straight, 1, 0, 20) - 6) < 1e-9);
        // hard cap
        const fast = fake(); fast.velocity.set(20, 0, 0); assert.ok(hop(fast, 0, 1, 1) <= 16.0001);
        // frame-rate independence (60 fps vs 144 fps over 0.5 s)
        const a = fake(), b = fake();
        for (let i = 0; i < 30; i++) c.Player.prototype.airAccelerate.call(a, 0, 1, 4.5, 1 / 60);
        for (let i = 0; i < 72; i++) c.Player.prototype.airAccelerate.call(b, 0, 1, 4.5, 1 / 144);
        assert.ok(Math.abs(Math.hypot(a.velocity.x, a.velocity.z) - Math.hypot(b.velocity.x, b.velocity.z)) < 0.25);
    });
}

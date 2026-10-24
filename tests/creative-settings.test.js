const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');
for (const prefix of ['js', 'web/js']) {
    function context() {
        const values = new Map();
        const c = vm.createContext({ window: {}, THREE, localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
        for (const file of ['textures', 'player', 'mobs']) vm.runInContext(fs.readFileSync(`${prefix}/${file}.js`, 'utf8'), c);
        return { c, values };
    }
    test(`${prefix}: creative break interval persists, limits repeated breaks, and survival retains mining`, () => {
        const { c, values } = context();
        const p = Object.create(c.window.Player.prototype); let broken = 0;
        Object.assign(p, { isCreative: true, godMode: true, isMining: true, targetBlock: { x: 0, y: 10, z: 0, type: 3 }, game: {},
            finishBreakingBlock() { broken++; }, miningProgress: 0, miningSoundTimer: 0,
            getSelectedItem: () => null, hunger: 20 });
        p.setCreativeBreakInterval(250);
        assert.equal(values.get('eblankraft_creative_break_interval'), '250');
        p.updateMining(.01); assert.equal(broken, 1);
        p.updateMining(.1); p.updateMining(.1); assert.equal(broken, 1);
        p.updateMining(.05); assert.equal(broken, 2);
        p.isMining = false; p.updateMining(.5); p.isMining = true;
        p.updateMining(.01); assert.equal(broken, 3, 'idle time counts toward cooldown');
        p.setCreativeBreakInterval(0); p.updateMining(.01); p.updateMining(.01); assert.equal(broken, 5);
        p.setCreativeBreakInterval(99999); assert.equal(p.creativeBreakIntervalMs, 1000);
        p.isCreative = false; p.godMode = false;
        c.window.ITEM_REGISTRY = {}; c.ITEM_REGISTRY = {};
        p.updateMining(.01); assert.equal(broken, 5); assert.ok(p.miningProgress > 0);
    });
    test(`${prefix}: disabled creative mobs pause and hide while drops still update; enabling or survival restores them`, () => {
        const { c } = context();
        const player = { isCreative: true, position: new THREE.Vector3() }, game = { player, creativeMobsEnabled: false };
        const manager = new c.window.MobManager(new THREE.Scene(), null, null, game);
        let mobs = 0, drops = 0, bosses = 0, spawns = 0;
        manager.mobs = [{ position: new THREE.Vector3(), group: new THREE.Group(), update() { mobs++; } }];
        manager.itemDrops = [{ position: new THREE.Vector3(), age: 0, maxAge: 100, update() { drops++; } }];
        manager.dragon = { mesh: new THREE.Group(), update() { bosses++; } };
        manager.spawnTimer = 14; manager.handlePeriodicSpawns = () => { spawns++; };
        manager.update(.1, player, {});
        assert.equal(manager.mobs[0].group.visible, false); assert.equal(manager.dragon.mesh.visible, false);
        assert.equal(mobs, 0); assert.equal(bosses, 0); assert.equal(spawns, 0); assert.equal(drops, 1);
        game.creativeMobsEnabled = true; manager.update(.1, player, {});
        assert.equal(manager.mobs[0].group.visible, true); assert.equal(manager.dragon.mesh.visible, true);
        assert.equal(mobs, 1); assert.equal(bosses, 1); assert.equal(spawns, 1); assert.equal(drops, 2);
        game.creativeMobsEnabled = false; player.isCreative = false; manager.update(.1, player, {});
        assert.equal(mobs, 2); assert.equal(bosses, 2); assert.equal(manager.creativeMobsDisabled, false);
    });
}

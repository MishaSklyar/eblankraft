const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

for (const prefix of ['js', 'web/js']) {
    const load = () => {
        const c = vm.createContext({ THREE, performance, console, localStorage: { getItem: () => null, setItem() {} },
            document: { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) } });
        c.window = c;
        for (const f of ['textures', 'items', 'upgrader_skins', 'player']) {
            try { vm.runInContext(fs.readFileSync(`${prefix}/${f}.js`, 'utf8'), c); } catch (e) { if (f !== 'upgrader_skins') throw e; }
        }
        return c;
    };

    test(`${prefix}: AWP | Dragon Lore (Souvenir) is an AWP with the same mechanics, a skin, a value and drop sources`, () => {
        const c = load();
        const dl = c.ITEM_REGISTRY.awp_dragon_lore, awp = c.ITEM_REGISTRY.awp;
        assert.ok(dl, 'registered');
        assert.equal(dl.gunType, 'awp'); assert.equal(dl.ammoType, awp.ammoType); assert.equal(dl.attackDamage, awp.attackDamage);
        assert.ok(dl.isGun && dl.souvenir && dl.skin === 'dragon_lore' && dl.maxStack === 1);
        assert.equal(c.getItemValue('awp_dragon_lore'), 25000);
        assert.ok(c.CASES_CONFIG[c.ITEM_TYPES.CASE_DRAGON].items.some(i => i.item === 'awp_dragon_lore'), 'dragon case can drop it');
        assert.ok(c.getUpgradeTargets(10).some(t => t.id === 'awp_dragon_lore'), 'upgrader target');
    });

    test(`${prefix}: Dragon Lore model recolors the AWP and adds gold/dragon decals without breaking the sight picture`, () => {
        const c = load();
        const base = c.createVoxelGunModel('awp'), dl = c.createVoxelGunModel('awp', 'dragon_lore');
        assert.ok(dl.children.length > base.children.length + 15);
        assert.ok(dl.children.some(m => m.name === 'skin_dragon') && dl.children.some(m => m.name === 'skin_sticker'));
        assert.notEqual(dl.children[0].material.color.getHex(), base.children[0].material.color.getHex());
        assert.ok(dl.children.every(m => m.geometry.type === 'BoxGeometry'));
        // the centre of the aimed view stays open, like the stock AWP
        dl.position.set(0, -.17, -.54); dl.updateMatrixWorld(true);
        assert.equal(new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1)).intersectObjects(dl.children).length, 0);
    });
}

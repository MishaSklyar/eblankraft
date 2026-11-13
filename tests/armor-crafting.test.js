const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

function load() {
    const c = vm.createContext({ THREE, console, localStorage: { getItem: () => null, setItem() {} }, document: { createElement: () => ({ getContext: () => ({}) }) } });
    c.window = c;
    for (const f of ['textures', 'items']) vm.runInContext(fs.readFileSync(`js/${f}.js`, 'utf8'), c);
    return c;
}
const cells = (m) => { const g = new Array(9).fill(null); for (const [i, id, n] of m) g[i] = { itemId: id, count: n || 1 }; return g; };

test('20 armor pieces are registered with slot, defense and value', () => {
    const c = load();
    assert.equal(c.ARMOR_ITEM_IDS.length, 20);
    for (const id of c.ARMOR_ITEM_IDS) {
        const r = c.ITEM_REGISTRY[id];
        assert.ok(['helmet', 'chestplate', 'leggings', 'boots'].includes(r.armorSlot), id);
        assert.ok(r.defense > 0 && r.value > 0 && r.maxStack === 1 && r.icon === id, id);
    }
});

test('shaped armor recipes match anywhere in the grid and nothing else matches', () => {
    const c = load();
    const iron = 'iron_ingot';
    const helmet = c.matchCraftingGrid(cells([[0, iron], [1, iron], [2, iron], [3, iron], [5, iron]]));
    assert.equal(helmet.recipe.output.itemId, 'iron_helmet');
    const helmetLow = c.matchCraftingGrid(cells([[3, iron], [4, iron], [5, iron], [6, iron], [8, iron]]));
    assert.equal(helmetLow.recipe.output.itemId, 'iron_helmet');
    const boots = c.matchCraftingGrid(cells([[3, iron], [5, iron], [6, iron], [8, iron]]));
    assert.equal(boots.recipe.output.itemId, 'iron_boots');
    const chest = c.matchCraftingGrid(cells([[0, iron], [2, iron], [3, iron], [4, iron], [5, iron], [6, iron], [7, iron], [8, iron]]));
    assert.equal(chest.recipe.output.itemId, 'iron_chestplate');
    const legs = c.matchCraftingGrid(cells([[0, iron], [1, iron], [2, iron], [3, iron], [5, iron], [6, iron], [8, iron]]));
    assert.equal(legs.recipe.output.itemId, 'iron_leggings');
    assert.equal(c.matchCraftingGrid(cells([[0, iron], [1, iron], [2, iron]])), null, 'wrong shape');
    assert.equal(c.matchCraftingGrid(cells([[0, iron], [1, 'gold_ingot'], [2, iron], [3, iron], [5, iron]])), null, 'mixed materials');
    assert.equal(c.matchCraftingGrid(new Array(9).fill(null)), null);
});

test('legacy recipes work shapeless in the grid, consuming from stacks', () => {
    const c = load();
    const totem = c.matchCraftingGrid(cells([[0, 'gold_ingot', 4], [4, 'emerald', 2], [8, 'ender_eye', 1]]));
    assert.equal(totem.recipe.output.itemId, 'totem_of_undying');
    assert.equal(JSON.stringify(totem.consume), '[[0,4],[4,2],[8,1]]');
    assert.equal(c.matchCraftingGrid(cells([[0, 'gold_ingot', 3], [4, 'emerald', 2], [8, 'ender_eye', 1]])), null, 'not enough gold');
});

test('totem is equippable', () => {
    assert.equal(load().ITEM_REGISTRY.totem_of_undying.equipSlot, 'totem');
});

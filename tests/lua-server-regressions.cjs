const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
global.window = {};
const fengari = require('../js/fengari-web.js');
const context = vm.createContext({ window: {}, fengari, console,
    document: { getElementById: () => null }, BLOCK_TYPES: {}, ITEM_TYPES: {},
    setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(path.join(root, 'web/js/mods.js'), 'utf8'), context);
const manager = Object.create(context.window.ModManager.prototype);
const logs = [];
manager.log = (text, level) => logs.push({ text, level });
manager.game = { player: { inventory: Array(27).fill(null), selectedHotbarIndex: 0,
    updateHeldBlock() {} }, ui: { initHotbar() {} } };
manager.game.player.inventory[0] = { itemId: 'stone', count: 3 };
manager.initLua();
const { lua } = fengari;
const top = lua.lua_gettop(manager.L);
for (let i = 0; i < 100; i++) manager.runLua('return 1, 2, 3', 'returns');
assert.equal(lua.lua_gettop(manager.L), top);
assert.throws(() => manager.runLua('local =', 'syntax-test'), /syntax-test/);
assert.throws(() => manager.runLua('error("failed")', 'runtime-test'), /runtime-test/);
assert.equal(lua.lua_gettop(manager.L), top);
manager.runLua(`
assert(Player.getInventorySlot(1).id == "stone")
assert(Player:getInventorySlot(1).count == 3)
assert(Player.getInventorySlot(2) == nil)
assert(Player.getInventorySlot(0) == nil)
assert(Player.getInventorySlot(28) == nil)
local inv = Player.getInventory()
assert(#inv == 27 and inv[2] == false)
assert(Player:selectSlot(9))
assert(Player.getSelectedSlot() == 9)
assert(not Player.selectSlot(10))
`, 'inventory-api');
for (const file of ['js/mods.js', 'competitive/js/mods.js']) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'),
        fs.readFileSync(path.join(root, 'web/js/mods.js'), 'utf8'));
}
vm.runInContext(fs.readFileSync(path.join(root, 'competitive/js/server_client.js'), 'utf8'), context);
const Client = vm.runInContext('CompetitiveServerClient', context);
const client = Object.create(Client.prototype);
client.currentRoom = 'world';
const blocks = [];
let meshUpdates = 0, syncs = 0;
client.game = { world: { setBlock: (...args) => blocks.push(args), updateMeshes: () => meshUpdates++ },
    player: { syncInventoryWithServer: () => syncs++ } };
client.handleMessage(JSON.stringify({ type: 'welcome', id: 'p1', room: 'world',
    blocks: [{ x: 1, y: 2, z: 3, block_type: 0 }, { x: 2, y: 2, z: 3, block_type: 4 }] }));
assert.deepEqual(blocks, [[1, 2, 3, 0], [2, 2, 3, 4]]);
assert.equal(syncs, 1);
client.handleMessage(JSON.stringify({ type: 'block_update', action: 'break', x: 2, y: 2, z: 3 }));
assert.deepEqual(blocks.at(-1), [2, 2, 3, 0]);
assert.equal(meshUpdates, 2);
console.log('PASS: real Lua bootstrap, inventory API, dot/colon calls, stack cleanup, named errors, source parity, late-join blocks and live meshes');

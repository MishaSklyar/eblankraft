const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const context = vm.createContext({ console, assert, performance, setTimeout, clearTimeout, TextEncoder, TextDecoder });
context.window = context;
context.self = context;
for (const name of ['three.min.js', 'noise.js', 'textures.js', 'items.js', 'de_eblan2.js', 'world.js', 'mobs.js', 'mods.js', 'fengari-web.js']) {
    vm.runInContext(read('js/' + name), context);
}
vm.runInContext(`
Chunk.prototype.rebuildMesh = function () {};
const scene = new THREE.Scene();
const sound = new Proxy({}, {get: () => () => {}});
const game = { scene, soundManager: sound, textureManager: {}, ui: {showToast() {}}, arenaClient: {isActive: false},
    player: {position: new THREE.Vector3(0.5, 1, 0.5), velocity: new THREE.Vector3(), takeDamage(d) { this.damage = (this.damage || 0) + d; }} };
// The custom map must bypass procedural terrain, including the WASM generator.
window.EblanEng = {ready: true, setSeed() {}, generateChunk() {throw Error('WASM must not generate Dust2');}};
const mapWorld = new VoxelWorld(scene, {}, {worldType: 'de_eblan2', seed: 42, game});
const map = window.EBLAN_MAPS.de_eblan2;
assert.ok(map.blockCount > 20000);
assert.ok(Object.keys(map.chunks).length > 60);
const floorY = Math.floor(map.spawn[1]) - 1;
assert.notEqual(mapWorld.getBlock(0, floorY, 0), 0);
for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    assert.notEqual(mapWorld.getBlock(dx, floorY, dz), 0);
    for (let dy = 1; dy <= 3; dy++) assert.equal(mapWorld.getBlock(dx, floorY + dy, dz), 0);
}
assert.equal(mapWorld.modifiedBlocks.size, 0, 'portals/villages must not alter the imported map');
mapWorld.setBlock(0, floorY, 0, 0);
delete mapWorld.chunks['0,0'];
mapWorld.invalidateChunkCache();
mapWorld.generateSingleChunk(0, 0);
assert.equal(mapWorld.getBlock(0, floorY, 0), 0, 'mined map blocks must survive chunk streaming');
const saved = mapWorld.exportJSON();
mapWorld.importJSON(saved);
assert.equal(mapWorld.worldType, 'de_eblan2');
assert.equal(mapWorld.getBlock(0, floorY, 0), 0, 'map edits must survive save/load');
assert.equal(mapWorld.generateSingleChunk(100, 100).voxels.some(Boolean), false, 'outside map must stay empty');
window.EblanEng = undefined;

let wall = false;
game.world = {getBlock(x, y, z) {return y === 0 || (wall && x === 2 && y < 4) ? 3 : 0;}};
const mm = game.mobManager = new MobManager(scene, {}, sound, game);
const logs = [];
const manager = Object.create(ModManager.prototype);
Object.assign(manager, {game, chatCommands: new Map(), eventListeners: {}, log: (msg, level) => logs.push({msg, level})});
game.modManager = manager;
manager.initLua();
assert.ok(!logs.some(l => l.level === 'error'), JSON.stringify(logs));
function runLua(code) {
    const f = manager.fengari;
    const result = f.lauxlib.luaL_dostring(manager.L, f.to_luastring(code));
    if (result !== f.lua.LUA_OK) throw new Error(String(f.interop.tojs(manager.L, -1)));
}
runLua('assert(Bots.spawn("guard", 0.5, 1, 0.5) == "guard"); assert(Bots.exists("guard")); assert(Bots.getHealth("guard") == 30)');
runLua('assert(Bots.spawn("guard", 1, 1, 1) == false); assert(Bots.getPosition("missing") == nil)');
const bot = mm.getBot('guard');
runLua('assert(Bots.moveTo("guard", 4.5, 1, 0.5))');
for (let i = 0; i < 120; i++) bot.update(1 / 60, game.player, game.world);
assert.ok(Math.abs(bot.position.x - 4.5) < 0.3, 'moveTo must move the physical bot');
runLua('assert(Bots:stop("guard")); assert(Bots:setSpeed("guard", 4)); assert(Bots:followPlayer("guard"))');
const startX = bot.position.x;
for (let i = 0; i < 30; i++) bot.update(1 / 60, game.player, game.world);
assert.ok(bot.position.x < startX, 'follow must move towards the player');
runLua('assert(Bots.stop("guard"))');
wall = true;
bot.position.set(0.5, 1, 0.5);
runLua('assert(Bots.moveTo("guard", 4.5, 1, 0.5))');
for (let i = 0; i < 120; i++) bot.update(1 / 60, game.player, game.world);
assert.ok(bot.position.x < 2, 'bot must not walk through a tall wall');
runLua('assert(Bots.jump("guard")); assert(Bots.jump("guard") == false)');
wall = false;
bot.position.set(1.5, 1, 0.5);
bot.attackCooldown = 0;
runLua('assert(Bots.attack("guard", "player")); assert(Bots.attack("guard", "player") == false)');
assert.equal(game.player.damage, 8);
wall = true;
bot.position.set(1.5, 1, 0.5); game.player.position.set(3, 1, 0.5); bot.attackCooldown = 0;
runLua('assert(Bots.attack("guard", "player") == false)');
wall = false;
game.arenaClient.isActive = true;
runLua('assert(Bots.spawn("arena", 0, 1, 0) == false); assert(Bots.remove("guard") == false); assert(Bots.attack("guard", "player") == false)');
game.arenaClient.isActive = false;
runLua('assert(Bots.remove("guard")); assert(not Bots.exists("guard")); assert(Bots.getHealth("guard") == 0)');
for (let i = 0; i < 32; i++) assert.ok(mm.spawnBot('bot' + i, 0.5, 1, 0.5));
assert.equal(mm.spawnBot('overflow', 0.5, 1, 0.5), false);
mm.clearBots();
assert.equal(mm.mobs.length, 0);
assert.equal(mm.spawnBot('nan', NaN, 1, 0), false);
assert.equal(mm.spawnBot('underground', 0, 0, 0), false);
window.runBotLua = runLua;
window.testManager = manager;
window.testGame = game;
window.testBots = mm;
`, context);

// Execute the shipped example through the real Fengari bridge, including /bot.
context.runBotLua(read('blockly/examples/bots.lua'));
assert.ok(context.testManager.chatCommands.has('/bot'));
context.testGame.player.position.set(0.5, 1, 0.5);
context.testManager.callLua(context.testManager.chatCommands.get('/bot'), '', 'test');
assert.ok(context.testBots.getBot('guard'));
context.testManager.callLua(context.testManager.chatCommands.get('/removebot'), '', 'test');
assert.equal(context.testBots.getBot('guard'), null);

// Use the actual vendored Blockly and Lua generator, without WebGL or a DOM.
for (const name of ['vendor/blockly_compressed.js', 'vendor/blocks_compressed.js', 'vendor/lua_compressed.js', 'vendor/en.js',
    'js/lua_shim.js', 'js/blocks_def.js', 'js/blocks_def2.js', 'js/blocks_def3.js', 'js/blocks_def4.js', 'js/blocks_def5.js', 'js/blocks_def6.js', 'js/blocks_gen1.js', 'js/blocks_gen2.js', 'js/blocks_gen3.js', 'js/blocks_gen4.js', 'js/blocks_gen5.js', 'js/bots.js']) {
    vm.runInContext(read('blockly/' + name), context);
}
vm.runInContext(`
Blockly.Events.disable();
const botTypes = EBLAN_TOOLBOX.contents.find(c => c.name === '🤖 Боти').contents;
assert.equal(botTypes.length, 11);
for (const entry of botTypes) {
    const workspace = new Blockly.Workspace();
    const block = workspace.newBlock(entry.type);
    const code = Blockly.Lua.workspaceToCode(workspace);
    assert.ok(code.includes('Bots.'), entry.type);
    // Parse every generated block as Lua, including value expressions.
    const chunk = block.outputConnection ? 'local value = ' + Blockly.Lua.blockToCode(block)[0] : code;
    runBotLua('local fn, err = load(' + JSON.stringify(chunk) + '); assert(fn, err)');
    workspace.dispose();
}
`, context);
for (const name of ['mobs.js', 'mods.js', 'world.js', 'game.js', 'player.js', 'ui.js', 'de_eblan2.js']) {
    assert.equal(read('js/' + name), read('web/js/' + name));
}
for (const name of ['index.html', 'js/bots.js', 'examples/bots.lua']) {
    assert.equal(read('blockly/' + name), read('web/blockly/' + name));
}
console.log('PASS: Dust2 generation/WASM bypass, safe spawn, streaming/save edits, bounds; real Lua bot API, movement/collision, jump, attacks, arena, limits, cleanup, example; 11 actual Blockly generators; source parity');

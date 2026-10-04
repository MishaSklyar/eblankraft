const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const elements = new Map();
const element = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, textContent: '', value: '', remove() { elements.delete(id); } });
    return elements.get(id);
};
element('input-mp-server-url').value = 'ws://localhost:8082/ws';
class Vector {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    clone() { return new Vector(this.x, this.y, this.z); }
    copy(v) { return this.set(v.x, v.y, v.z); }
}
class Socket {
    static OPEN = 1; static CONNECTING = 0;
    constructor() { this.readyState = 0; this.sent = []; }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    close() { this.readyState = 3; }
}
const timers = new Map();
let timerId = 0;
const context = vm.createContext({ console, URL, performance: { now: () => 1000 },
    WebSocket: Socket, localStorage: { getItem: () => null },
    setInterval: fn => { timers.set(++timerId, fn); return timerId; }, clearInterval: id => timers.delete(id), clearTimeout() {},
    window: { location: { protocol: 'http:', host: 'localhost:8081', hostname: 'localhost', port: '8081' } },
    document: { getElementById: id => elements.get(id) || null, exitPointerLock() {},
        querySelector: () => null, querySelectorAll: () => [] },
    ITEM_TYPES: { DIAMOND_SWORD: 'diamond_sword', SHIELD: 'shield' },
    VoxelWorld: class { constructor() { this.chunks = {}; } clearWorld() { this.cleared = true; } },
});
for (const file of ['shared_world_client.js', 'ui.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
const Client = vm.runInContext('SharedWorldClient', context);
const UI = vm.runInContext('UIManager', context);
const ui = Object.create(UI.prototype);
const originalInventory = [{ itemId: 'apple', count: 9 }];
let saved = 0, synced = 0;
const player = { position: new Vector(7, 9, 11), velocity: new Vector(1, 2, 3),
    inventory: originalInventory, selectedHotbarIndex: 2, health: 63, hunger: 41, iq: 9,
    isCreative: true, godMode: true, canFly: true, yaw: 0.8, pitch: 0.2,
    gunReload: { item: originalInventory[0] }, gunTriggerHeld: true, gunBurst: 4, gunRecoilPitch: 0.1, isScoped: true,
    camera: { fov: 24, updateProjectionMatrix() {} },
    saveInventory: () => saved++, syncInventoryWithServer: () => synced++, updateHeldBlock() {} };
const originalMesh = { visible: true }, originalMob = { group: { visible: true }, health: 17 };
const world = { chunks: { '0,0': { mesh: originalMesh } }, worldType: 'normal' };
const commands = [];
const originalMobs = [originalMob];
const manager = { mobs: originalMobs, itemDrops: [], crystals: [], fireballs: [], dragon: null,
    handlePeriodicSpawns() {}, clearAll() { this.mobs = []; },
    spawnBot(id) { this.bot = { health: 20, isDead: false }; this.mobs.push(this.bot); return id; },
    getBot() { return this.bot; }, commandBot: (id, action) => commands.push(action) };
const remote = { group: { position: new Vector() }, targetPosition: new Vector(), updateHeldItem(item) { this.item = item; } };
const game = { player, world, mobManager: manager, tntEntities: [], timeOfDay: 0.7, ui,
    arenaClient: { disconnect() {} }, multiplayer: { playerName: 'Player', remotePlayers: new Map(),
        addRemotePlayer: () => remote, removeRemotePlayer() {} } };
Object.assign(ui, { game, player, closeMainMenu() {}, initHotbar() {}, showToast() {},
    mountDuelHud() { for (const id of ['duel-hud', 'duel-hud-health', 'duel-countdown', 'duel-result', 'duel-result-title', 'duel-result-reason']) element(id); } });
const sc = new Client(game);
game.serverClient = sc;
sc.updateBadge = () => {};
sc.startPingLoop = () => {};
sc.stopPingLoop = () => {};
assert.equal(sc.joinDuelQueue('Player', 'bow'), false, 'unimplemented modes cannot enter a queue');
assert.equal(sc.joinDuelQueue('Player', 'classic'), true);
assert.equal(sc.socket.sent.length, 0, 'no queue request before transport opens');
sc.socket.readyState = 1;
sc.socket.onopen();
assert.equal(sc.socket.sent.at(-1).type, 'join');
sc.handleMessage(JSON.stringify({ type: 'welcome', room: 'pvp_arena', id: 'local', players: [] }));
assert.equal(sc.socket.sent.at(-1).type, 'join_duel_queue');
assert.equal(sc.socket.sent.at(-1).kit, 'classic');
sc.handleMessage(JSON.stringify({ type: 'duel_matched', room: 'duel_real', kit: 'classic',
    opponent: { id: 'other', name: 'Opponent' }, spawn: { x: 0, y: 5.05, z: -14, yaw: Math.PI } }));
assert.equal(ui.isDuelActive, true);
assert.equal(ui.duelCountdown, 3);
assert.equal(sc.socket.sent.at(-1).type, 'duel_ready');
assert.equal(remote.item, 'diamond_sword');
assert.equal(saved, 1);
assert.equal(synced, 2, 'welcome and actual duel equipment synchronize');
assert.notEqual(player.inventory, originalInventory);
assert.equal(originalMesh.visible, false);
assert.equal(originalMob.group.visible, false);
sc.handleMessage(JSON.stringify({ type: 'duel_countdown', room: 'duel_real', seconds: 0 }));
assert.equal(ui.duelCountdown, 0);
sc.handleMessage(JSON.stringify({ type: 'duel_round_end', room: 'duel_real', winner_id: 'local', reason: 'Win' }));
assert.equal(ui.duelFinished, true);
assert.equal(element('duel-result-title').textContent, '🏆 Перемога');
ui.showDuelResult({ winner_id: 'other', reason: 'Duplicate' });
assert.equal(element('duel-result-reason').textContent, 'Win', 'duplicate result must not replace first');
ui.cleanupDuel();
assert.equal(player.inventory, originalInventory);
assert.equal(game.world, world);
assert.equal(manager.mobs, originalMobs);
assert.equal(originalMesh.visible, true);
assert.equal(originalMob.group.visible, true);
assert.equal(player.health, 63);
assert.equal(player.godMode, true);
assert.equal(player.isScoped, true);
assert.equal(player.camera.fov, 24);
assert.deepEqual([player.position.x, player.position.y, player.position.z], [7, 9, 11]);
assert.equal(sc.currentRoom, null);
ui.startDuelMatch({ is_bot: true, kit: 'shawarma', opponent: { id: 'duel-practice', name: 'Bot' } });
assert.equal(player.inventory[0], null, 'fists kit differs from swords');
ui.updateDuel();
assert.equal(commands.includes('attack'), false, 'bot cannot attack during countdown');
ui.showDuelCountdown(0);
ui.updateDuel();
assert.equal(commands.includes('followPlayer'), true);
assert.equal(commands.includes('attack'), true);
ui.duelBot.isDead = true;
ui.updateDuel();
assert.equal(ui.duelFinished, true);
assert.equal(commands.at(-1), 'stop');
ui.cleanupDuel();
assert.equal(player.inventory, originalInventory);
assert.equal(timers.size, 0, 'all duel timers removed');
console.log('PASS: real queue, supported kits, ready/countdown, opponent equipment, single result, actual bot combat, complete session restoration');

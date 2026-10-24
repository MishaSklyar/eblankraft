const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function runVersion(prefix, clientFile, clientClass) {
    const elements = Object.fromEntries(['btn-coop-join', 'btn-coop-leave', 'input-coop-room', 'input-coop-mode', 'coop-room-status', 'input-mp-server-url'].map(id => [id, {}]));
    elements['input-mp-server-url'].value = 'ws://localhost:8082/ws';
    elements['input-coop-room'].value = 'Friends';
    elements['input-coop-mode'].value = 'creative';
    const context = vm.createContext({ window: {}, console, clearTimeout, URL,
        document: { getElementById: id => elements[id] || null, querySelectorAll: () => [] } });
    vm.runInContext(fs.readFileSync(path.join(root, prefix, clientFile), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, prefix, 'multiplayer.js'), 'utf8'), context);
    const Client = vm.runInContext(clientClass, context);
    const MP = vm.runInContext('MultiplayerManager', context);
    const sc = Object.create(Client.prototype);
    const mp = Object.create(MP.prototype);
    let launch, finishLaunch, meshes = 0, synced = 0, saved = 0;
    const blocks = [], sent = [], removed = [];
    const world = { id: 'solo', setBlock: (...block) => blocks.push(block), updateMeshes: () => meshes++ };
    const player = { inventory: Array(27).fill(null), isFlying: true, hardcore: true,
        saveInventory: () => saved++, initDefaultInventory() { this.inventory[0] = { itemId: 1, count: 3 }; },
        updateHeldBlock() {}, syncInventoryWithServer: () => synced++ };
    const game = { world, player, multiplayer: mp, ui: { initHotbar() {},
        launchWorld: data => { launch = data; return new Promise(resolve => finishLaunch = resolve); } } };
    Object.assign(sc, { game, isConnected: true, currentRoom: null, roomGeneration: 0,
        loadingRoom: false, roomPackets: [], sendRaw: packet => { sent.push(packet); return true; } });
    game.serverClient = sc;
    Object.assign(mp, { game, playerName: 'Builder', remotePlayers: new Map([['old', {}]]),
        removeRemotePlayer: id => { removed.push(id); mp.remotePlayers.delete(id); },
        toggleModal() {}, showToast() {} });
    mp.initUI();
    elements['btn-coop-join'].onclick();
    assert.equal(sc.currentRoom, 'coop_friends');
    assert.equal(sent[0].type, 'join');
    assert.equal(sent[0].mode, 'creative');
    assert.deepEqual(removed, ['old']);
    assert.equal(sc.joinCooperativeRoom('invalid room'), false);
    const welcome = { type: 'welcome', id: 'me', room: 'coop_friends', players: [],
        world: { seed: 4321, type: 'normal', mode: 'survival' },
        blocks: [{ x: 1, y: 2, z: 3, block_type: 0 }] };
    sc.handleMessage(JSON.stringify(welcome));
    assert.equal(sc.loadingRoom, true);
    assert.equal(launch.seed, 4321);
    assert.equal(launch.serverRoom, true);
    sc.handleMessage(JSON.stringify({ type: 'block_update', room: 'coop_friends', action: 'place', x: 4, y: 2, z: 3, block_type: 5 }));
    sc.handleMessage(JSON.stringify({ type: 'block_update', room: 'old_room', action: 'place', x: 99, y: 2, z: 3, block_type: 5 }));
    assert.equal(blocks.length, 0, 'edits must wait for world generation');
    finishLaunch();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sc.loadingRoom, false);
    assert.deepEqual(blocks, [[1, 2, 3, 0, undefined], [4, 2, 3, 5, undefined]]);
    assert.equal(meshes, 2);
    assert.equal(saved, 1);
    assert.equal(synced, 1);
    assert.equal(world.id, 'server:coop_friends');
    assert.equal(player.isCreative, false, 'server room mode overrides joiner preference');
    assert.equal(player.isFlying, false);
    assert.equal(player.hardcore, false);
    assert.equal(sc.requestAttack('friend'), false);
    mp.sendChatMessage('hello');
    assert.equal(sent.at(-1).type, 'chat');
    elements['btn-coop-leave'].onclick();
    assert.equal(sent.at(-1).type, 'leave');
    assert.equal(sc.currentRoom, null);
    const count = sent.length;
    sc.sendBlockAction('break', 1, 2, 3, 1);
    assert.equal(sent.length, count, 'local edits after leaving must not reach server');
    if (clientClass === 'SharedWorldClient') {
        const idle = new Client(game);
        assert.equal(idle.socket, null, 'solo startup must not open a socket');
        context.WebSocket = class {
            static OPEN = 1; static CONNECTING = 0;
            constructor() { this.readyState = 0; }
        };
        idle.updateBadge = () => {};
        assert.equal(idle.joinCooperativeRoom('friends'), true, 'menu must connect on demand');
        assert.ok(idle.socket);
        assert.equal(idle.currentRoom, 'coop_friends');
        context.window.ITEM_REGISTRY = { 2: { name: 'stone' } };
        assert.equal(idle.resolveHeldItem('2'), 2);
        assert.equal(idle.resolveHeldItem('stone'), 2);
    }
    sc.joinDuelQueue('Fighter');
    assert.equal(sc.currentRoom, 'pvp_arena');
    if (clientClass === 'SharedWorldClient') {
        assert.equal(sent.at(-1).type, 'join', 'queue waits for actual lobby welcome');
        sc.handleMessage(JSON.stringify({ type: 'welcome', room: 'pvp_arena', id: 'me', players: [] }));
    }
    assert.equal(sent.at(-1).type, 'join_duel_queue');
    console.log('PASS: cooperative menu, shared seed/mode, loading queue, room isolation, inventory setup, chat, no PvP, leave and duel transition');
}
async function main() {
    for (const name of ['game.js', 'player.js', 'multiplayer.js', 'ui.js', 'world.js', 'particles.js', 'arena_client.js', 'shared_world_client.js']) {
        assert.equal(fs.readFileSync(path.join(root, 'js', name), 'utf8'), fs.readFileSync(path.join(root, 'web/js', name), 'utf8'));
    }
    for (const file of ['index.html', 'web/index.html']) {
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        assert.ok(html.includes('id="btn-coop-join"'));
        assert.ok(html.indexOf('js/shared_world_client.js') < html.indexOf('js/game.js'));
    }
    await runVersion('js', 'shared_world_client.js', 'SharedWorldClient');
    await runVersion('web/js', 'shared_world_client.js', 'SharedWorldClient');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

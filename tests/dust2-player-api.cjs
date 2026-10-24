const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const directory of ['js', 'web/js']) {
    const context = vm.createContext({
        console, performance: { now: () => 1000 },
        window: { location: { protocol: 'http:', host: 'localhost:8081', hostname: 'localhost', port: '8081' } },
        document: { getElementById: () => null }, localStorage: { getItem: () => null },
    });
    for (const file of ['player.js', 'arena_client.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', directory, file), 'utf8'), context);
    }
    const Player = vm.runInContext('Player', context);
    const Arena = vm.runInContext('ArenaClient', context);
    const player = Object.assign(Object.create(Player.prototype), {
        inventory: Array(27).fill(null), selectedHotbarIndex: 0, yaw: 0, pitch: 0,
        updateHeldBlock() {},
    });
    const client = new Arena({ player, ui: { initHotbar() {} } }, { remotePlayers: new Map(), updatePlayerCount() {} });
    client.mode = 'dust2';
    client.clientId = 'me';
    client.isConnected = true;
    for (const method of ['reconcile', 'renderDustHud', 'renderScoreboard', 'updateBombMarker', 'sendInput']) client[method] = () => {};
    const packets = [];
    client.send = packet => { packets.push(packet); return true; };
    const state = { id: 'me', alive: true, health: 100, spawn: 1, heldItem: 'glock', secondary: 'glock', ammo: 20, reserveAmmo: 100 };
    client.applySnapshot([state], { phase: 'live' });
    assert.equal(player.getSelectedItem().itemId, 'glock');
    assert.equal(client.attack(), true);
    assert.equal(packets.at(-1).type, 'arena_attack', `${directory}: equipped pistol must fire`);
    assert.equal(state.ammo, 19);
    client.applySnapshot([{ ...state, primary: 'ak47', heldItem: 'glock' }]);
    assert.equal(player.selectedHotbarIndex, 1);
    assert.equal(player.getSelectedItem().itemId, 'glock');
    client.applySnapshot([{ ...state, primary: 'ak47', heldItem: 'ak47' }]);
    assert.equal(player.selectedHotbarIndex, 0);
    assert.equal(player.getSelectedItem().itemId, 'ak47');
}
console.log('PASS: Dust2 snapshots and shooting use the real Player inventory API in both builds');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const directory of ['js', 'web/js']) {
    const button = {};
    const input = { value: 'ws://localhost:8082/ws' };
    let socket, leftWorld = 0, modalOpened = false;
    const context = vm.createContext({
        console, URL, Uint8Array,
        window: { location: { protocol: 'http:', host: 'localhost:8081', hostname: 'localhost', port: '8081' } },
        document: { getElementById: id => id === 'mm-btn-dust2' ? button : id === 'input-mp-server-url' ? input : null },
        localStorage: { getItem: () => null, setItem() {} },
        setTimeout: () => 1,
        WebSocket: class {
            static OPEN = 1;
            constructor(url) { this.url = url; this.readyState = 1; this.bufferedAmount = 0; this.packets = []; socket = this; }
            send(raw) { this.packets.push(JSON.parse(raw)); }
        },
    });
    for (const file of ['ui.js', 'multiplayer.js', 'arena_client.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', directory, file), 'utf8'), context);
    }
    const UI = vm.runInContext('UIManager', context);
    const Multiplayer = vm.runInContext('MultiplayerManager', context);
    const Arena = vm.runInContext('ArenaClient', context);
    const game = { serverClient: { leaveRoom() { leftWorld++; } } };
    const mp = Object.assign(Object.create(Multiplayer.prototype), {
        game, playerName: 'Player', toggleModal() { modalOpened = true; },
    });
    game.multiplayer = mp;
    game.arenaClient = new Arena(game, mp);
    game.arenaClient.disconnect = () => {};
    const ui = Object.assign(Object.create(UI.prototype), { game });
    ui.initMMNavigation();
    button.onclick();
    assert.equal(modalOpened, false, `${directory}: Dust2 must bypass the shared-world modal`);
    assert.ok(leftWorld > 0, `${directory}: leave the default world`);
    assert.equal(socket.url, input.value);
    socket.onopen();
    assert.deepEqual(socket.packets, [{ type: 'arena_join', room: 'dust2', name: 'Player', mode: 'dust2' }]);
}
console.log('PASS: Dust2 button leaves the default world and sends a Dust2 arena join in both builds');

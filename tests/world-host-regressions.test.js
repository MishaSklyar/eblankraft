'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AuthoritativeGameServer, WSClient } = require('../server');

for (const directory of ['js', 'web/js']) {
    function setup() {
        const peers = [];
        class Events {
            constructor() { this.events = {}; }
            on(name, fn) { this.events[name] = fn; }
            emit(name, value) { this.events[name]?.(value); }
        }
        class Peer extends Events {
            constructor(id) { super(); this.id = id; peers.push(this); }
            connect(id) { this.conn = new Events(); this.conn.peer = id; this.conn.close = () => {}; return this.conn; }
            destroy() { this.emit('disconnected'); }
        }
        const c = vm.createContext({ window: {}, console, Peer, performance,
            crypto: require('node:crypto').webcrypto, Uint8Array,
            document: { getElementById: () => null } });
        for (const name of ['multiplayer', 'shared_world_client']) {
            vm.runInContext(fs.readFileSync(`${directory}/${name}.js`, 'utf8'), c);
        }
        return { c, peers, Events };
    }

    test(`${directory}: host world with mods, join its code and retain PvP routing`, () => {
        const { c, peers, Events } = setup();
        const Manager = vm.runInContext('MultiplayerManager', c);
        const mods = [{ name: 'test', code: 'print(1)' }];
        c.window.modManager = { getSyncableMods: () => mods };
        const game = { world: { seed: 42, worldType: 'flat', dimension: 'overworld', getModifiedBlocksArray: () => [[1,2,3,4]] },
            ui: { mainMenuOpen: false }, arenaClient: { disconnect() {}, connect(code) { this.code = code; } },
            serverClient: { leaveRoom() {} } };
        const make = () => Object.assign(Object.create(Manager.prototype), { game, remotePlayers: new Map(), connections: new Map(),
            playerName: 'Host', updateConnectedUI() {}, showToast() {}, updatePlayerCount() {}, handlePacket(data) { this.packet = data; } });
        const host = make(), world = game.world;
        host.startWorldHost();
        assert.equal(game.world, world);
        const peer = peers.at(-1);
        assert.match(peer.id, /^world-[a-f0-9]{16}$/);
        peer.emit('open', peer.id);
        assert.equal(host.isHost, true);
        const conn = new Events(); conn.peer = 'friend'; conn.send = data => { conn.packet = data; }; conn.close = () => {};
        peer.emit('connection', conn); conn.emit('open');
        assert.equal(conn.packet.seed, 42);
        assert.equal(conn.packet.mods, mods);
        const friend = make(); friend.joinRoom(peer.id);
        const clientPeer = peers.at(-1); clientPeer.emit('open', 'friend');
        assert.equal(clientPeer.conn.peer, peer.id);
        clientPeer.conn.emit('open'); clientPeer.conn.emit('data', conn.packet);
        assert.equal(friend.isConnected, true);
        assert.equal(friend.packet, conn.packet);
        friend.disconnect();
        assert.equal(friend.isConnecting, false);
        friend.joinRoom('arena-example');
        assert.equal(game.arenaClient.code, 'arena-example');
        host.disconnect(); conn.emit('data', { type: 'stale' });
        assert.equal(host.packet, undefined);
        game.ui.mainMenuOpen = true;
        const count = peers.length; host.startWorldHost(); assert.equal(peers.length, count);
    });

    test(`${directory}: wall sliding remains collision-safe after sending coordinates`, t => {
        const { c } = setup();
        const server = new AuthoritativeGameServer(); t.after(() => server.stop());
        const p = new WSClient(null, server), messages = []; p.send_json = m => messages.push(m);
        server.process_message(p, { type: 'join', room: 'coop_wall' });
        const world = p.room.world();
        for (const chunk of Object.values(world.world.chunks)) chunk.voxels.fill(0);
        world.world.modifiedBlocks.clear();
        for (let z = 0; z < 4; z++) for (let y = 10; y < 12; y++) world.setBlock(2, y, z, world.blocks.STONE);
        Object.assign(p, { x: 1.70099, y: 10, z: 1.5 });
        assert.equal(world.collides(p.x, p.y, p.z), false);
        assert.equal(world.collides(Math.round(p.x * 1000) / 1000, p.y, p.z), true);
        const client = Object.create(c.window.SharedWorldClient.prototype);
        Object.assign(client, { currentRoom: p.room.name, game: { player: {} }, lastMoveTime: -Infinity, moveInterval: 0,
            sendRaw: msg => server.process_message(p, msg) });
        messages.length = 0;
        client.sendMove(p.x, 10, 1.75, 0, 0);
        assert.equal(p.z, 1.75);
        assert.equal(messages.some(m => m.type === 'position_correction'), false);
        client.sendMove(2.1, 10, 1.75, 0, 0);
        assert.equal(p.x, 1.70099);
        assert.equal(messages.at(-1).type, 'position_correction');
    });
}

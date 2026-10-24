'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Package = require('../js/addon_package');
const pkg = (id = 'builder', version = '1.0.0', dependencies = []) => ({ format: 'eblankraft-addon', apiVersion: 1,
    manifest: { id, name: 'Builder', version, description: 'Build things.', author: 'Creator', category: 'building', dependencies }, code: 'print("hello")' });
const origin = 'https://game.example';
function req(route, data, token = '', headers = {}) {
    return new Request(origin + '/api/economy/' + route, { method: data === undefined ? 'GET' : 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
}
async function setup(options = {}) {
    const { Economy } = await import('../server/economy.mjs');
    const economy = new Economy({ adminToken: 'moderator', hosting: true, ...options });
    async function call(route, data, token, status = 200) {
        const response = await economy.fetch(req(route, data, token));
        const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
    }
    const seller = await call('account', { name: 'Seller' }), buyer = await call('account', { name: 'Buyer' });
    return { economy, call, seller, buyer };
}

test('portable packages validate, normalize legacy versions, and import disabled', () => {
    assert.equal(Package.unpack(pkg()).enabled, false);
    assert.equal(Package.pack({ ...Package.unpack(pkg()), version: '1.2' }).manifest.version, '1.2.0');
    for (const bad of [{ ...pkg(), apiVersion: 2 }, { ...pkg(), code: ' '.repeat(2) }, { ...pkg(), code: 'x'.repeat(131073) },
        { ...pkg(), manifest: { ...pkg().manifest, id: '../bad' } }, pkg('a', '1.0.0', [{ id: 'a', minVersion: '1.0.0' }])]) assert.throws(() => Package.validate(bad));
    assert.equal(Package.validate({ ...pkg(), enabled: true, balance: 100 }).balance, undefined);
});

test('dependency order, disabled/missing versions and cycles isolate affected addons', () => {
    const mod = (id, dependencies = [], enabled = true) => ({ ...Package.unpack(pkg(id, '1.0.0', dependencies)), enabled });
    const base = mod('base'), child = mod('child', [{ id: 'base', minVersion: '1.0.0' }]);
    assert.deepEqual(Package.resolve([child, base]).ordered.map(m => m.id), ['base', 'child']);
    for (const mods of [[child], [child, { ...base, enabled: false }], [{ ...child, dependencies: [{ id: 'base', minVersion: '2.0.0' }] }, base]]) assert(Package.resolve(mods).errors.has('child'));
    const cycle = Package.resolve([mod('a', [{ id: 'b', minVersion: '1.0.0' }]), mod('b', [{ id: 'a', minVersion: '1.0.0' }]), base]);
    assert.deepEqual(cycle.ordered.map(m => m.id), ['base']); assert.equal(cycle.errors.size, 2);
    assert.doesNotThrow(() => Package.resolve([{ ...base, dependencies: {} }]));
});

test('runtime dependency failure skips consumers while unrelated addons still run', () => {
    const context = vm.createContext({ window: { AddonPackage: Package }, console: { warn() {} } });
    vm.runInContext(fs.readFileSync('js/mods.js', 'utf8'), context);
    const manager = Object.create(context.window.ModManager.prototype), ran = [];
    Object.assign(manager, { game: {}, mods: [
        { id: 'consumer', enabled: true, dependencies: [{ id: 'bad', minVersion: '1.0.0' }] },
        { id: 'bad', enabled: true, version: '1.0.0' }, { id: 'okay', enabled: true }
    ], clearEventListeners() {}, initLua() {}, updateCreativeBadge() {}, updateFlyTouchVisibility() {},
        runLua(code, name) { ran.push(name); }, });
    manager.mods.forEach(m => m.name = m.id);
    manager.runLua = (code, name) => { ran.push(name); if (name === 'bad') throw new Error('broken'); };
    manager.reinitAllMods(); assert.deepEqual(ran, ['bad', 'okay']); assert(manager.addonErrors.has('consumer'));
});

test('wallet keys are sent only to the matching authority, never custom WebSocket hosts', () => {
    const prototype = { initUI() {}, renderModsList() {} };
    const context = vm.createContext({ window: { location: { host: 'game.example', hostname: 'game.example', port: '', protocol: 'https:' } },
        ModManager: { prototype }, URL, localStorage: { getItem: () => 'private-key' } });
    vm.runInContext(fs.readFileSync('js/addons.js', 'utf8'), context);
    const packets = [], socket = url => ({ url, readyState: 1, send: p => packets.push(JSON.parse(p)) });
    for (const url of ['wss://evil.example/ws', 'ws://game.example/ws', 'wss://game.example.evil.example/ws']) context.window.authenticateAddonWallet(socket(url));
    assert.equal(packets.length, 0);
    context.window.authenticateAddonWallet(socket('wss://game.example/ws')); assert.equal(packets.length, 1);
});

test('marketplace review, concurrent purchase retries, seller credit and paid update entitlement', async () => {
    const { economy, call, seller, buyer } = await setup();
    const listing = await call('publish', { package: pkg(), price: 30 }, seller.token);
    assert.equal((await call('catalog')).length, 0);
    await call('buy', { id: listing.id, price: 30, version: '1.0.0' }, buyer.token, 404);
    await call('moderate', { id: listing.id, status: 'approved' }, buyer.token, 403);
    await call('moderate', { id: listing.id, status: 'approved' }, 'moderator');
    await call('download', { id: listing.id }, buyer.token, 403);
    await call('buy', { id: listing.id, price: 30, version: '1.0.0' }, buyer.token, 400);
    economy.state.accounts[buyer.wallet.id].balance = 100;
    await call('buy', { id: listing.id, price: 1, version: '1.0.0' }, buyer.token, 409);
    await Promise.all(Array.from({ length: 6 }, () => call('buy', { id: listing.id, price: 30, version: '1.0.0' }, buyer.token)));
    assert.equal((await call('wallet', undefined, buyer.token)).balance, 70);
    assert.equal((await call('wallet', undefined, seller.token)).balance, 30);
    assert.equal(economy.state.listings[listing.id].sales, 1);
    await call('publish', { package: pkg('builder', '1.1.0'), price: 80 }, seller.token);
    await call('download', { id: listing.id }, buyer.token, 409);
    await call('moderate', { id: listing.id, status: 'approved' }, 'moderator');
    assert.equal((await call('download', { id: listing.id }, buyer.token)).package.manifest.version, '1.1.0');
    assert.equal((await call('wallet', undefined, buyer.token)).balance, 70);
});

test('failed persistence rolls back both sides of a sale', async () => {
    let broken = false;
    const { economy, call, seller, buyer } = await setup({ save: async () => { if (broken) throw new Error('disk full'); } });
    const l = await call('publish', { package: pkg(), price: 20 }, seller.token);
    await call('moderate', { id: l.id, status: 'approved' }, 'moderator'); economy.state.accounts[buyer.wallet.id].balance = 50; broken = true;
    await call('buy', { id: l.id, price: 20, version: '1.0.0' }, buyer.token, 503);
    assert.equal(economy.state.accounts[buyer.wallet.id].balance, 50); assert.equal(economy.state.accounts[seller.wallet.id].balance, 0);
    assert.equal(economy.state.accounts[buyer.wallet.id].owned.length, 0); assert.equal(economy.state.listings[l.id].sales, 0);
});

test('play rewards use elapsed server time, active movement, one sample per wallet and daily caps', async () => {
    let now = 1000000;
    const { economy, call, buyer } = await setup({ now: () => now });
    const client = { id: 'one', economyAccount: buyer.wallet.id, room: { name: 'pvp' }, is_alive: true, x: 0, y: 5, z: 0 };
    await economy.recordPlay(client);
    for (let i = 0; i < 300; i++) { now += 1000; client.x += .1; await economy.recordPlay(client); }
    assert.equal(economy.state.accounts[buyer.wallet.id].balance, 10);
    for (let i = 0; i < 60; i++) { now += 1000; await economy.recordPlay(client); }
    assert.equal(economy.state.accounts[buyer.wallet.id].playSeconds, 0);
    now += 60000; client.x += 1; await economy.recordPlay(client);
    assert.equal(economy.state.accounts[buyer.wallet.id].playSeconds, 0);
    const a = economy.state.accounts[buyer.wallet.id]; a.playEarned = 120; a.playSeconds = 299;
    now += 1000; client.x += .1; await economy.recordPlay(client); assert.equal(a.balance, 10);
    now += 86400000; await economy.recordPlay(client); assert.equal(a.playEarned, 0);
    await call('reward', { coins: 10000 }, buyer.token, 404);
});

test('hosting lease purchase, renewal, capacity and expiry are enforced by the game authority', async () => {
    let now = 1000000;
    const { economy, call, buyer, seller } = await setup({ now: () => now });
    await call('hosting', { plan: 'world-day' }, buyer.token, 400);
    economy.state.accounts[buyer.wallet.id].balance = 100;
    const result = await call('hosting', { plan: 'world-day', name: 'Friends' }, buyer.token);
    assert.equal(result.wallet.balance, 60);
    const { AuthoritativeGameServer, WSClient } = require('../server');
    const game = new AuthoritativeGameServer(); game.economy = economy;
    const client = new WSClient({ readyState: 1, bufferedAmount: 0, send() {}, terminate() {} }, game);
    game.process_message(client, { type: 'join', room: result.lease.room }); assert.equal(client.room.name, result.lease.room);
    client.room.clients = new Map(Array.from({ length: 8 }, (_, i) => [i, {}]));
    const stranger = new WSClient({ readyState: 1, bufferedAmount: 0, send() {}, terminate() {} }, game);
    assert.equal(economy.canJoin(stranger, result.lease.room), false);
    await call('hosting', { plan: 'world-day', lease: result.lease.id }, seller.token, 404);
    await call('hosting', { plan: 'world-day', lease: result.lease.id }, buyer.token);
    assert.equal(economy.state.leases[result.lease.id].expires, now + 48 * 3600000);
    now += 49 * 3600000; assert.equal(economy.canJoin(client, result.lease.room), false);
    // Remove synthetic capacity occupants before exercising expiry.
    client.room.clients = new Map([[client.id, client]]);
    game.process_message(client, { type: 'move' }); assert.equal(client.room, null); game.stop();
});

test('wallets survive service reconstruction; unsafe origins, oversized bodies, and forged tokens fail', async () => {
    let saved;
    const { economy, call, buyer } = await setup({ save: async s => { saved = structuredClone(s); } });
    const { Economy } = await import('../server/economy.mjs'); const restored = new Economy({ state: saved });
    assert.equal((await restored.account(buyer.token)).id, buyer.wallet.id);
    const response = await economy.fetch(req('account', {}, '', { Origin: 'https://evil.example' })); assert.equal(response.status, 403);
    assert.equal((await economy.fetch(req('publish', { code: 'x'.repeat(160000) }, buyer.token))).status, 413);
    await call('wallet', undefined, 'fake', 401);
    const config = await call('config'); assert.equal(config.ads.rewarded, false);
});

test('hosting at capacity never charges coins and unavailable Node hosting cannot sell leases', async () => {
    const { economy, call, buyer } = await setup({ canAllocateHosting: () => false });
    economy.state.accounts[buyer.wallet.id].balance = 100;
    await call('hosting', { plan: 'world-day' }, buyer.token, 503);
    assert.equal(economy.state.accounts[buyer.wallet.id].balance, 100);
    assert.equal(Object.keys(economy.state.leases).length, 0);
    economy.hosting = false;
    await call('hosting', { plan: 'world-day' }, buyer.token, 503);
});

test('SQLite storage preserves large packages and hosted block designs across restarts', async () => {
    const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(':memory:');
    const storage = { sql: { exec(sql, ...args) { const stmt = db.prepare(sql); return stmt.columns().length ? stmt.all(...args) : (stmt.run(...args), []); } },
        transactionSync(fn) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
    const { EconomyStore } = await import('../cloudflare/beta/economy-store.mjs');
    const store = new EconomyStore(storage); const state = store.load();
    state.listings.large = { package: { ...pkg(), code: 'x'.repeat(131072) } }; store.save(state);
    const blocks = Array.from({ length: 300 }, (_, i) => ({ x: i, y: 10, z: 0, block_type: 1, design: { shape: 'slab', color: '#ff0000' } }));
    store.saveWorld({ name: 'coop_hosted_test', blocks: new Map(blocks.map((b, i) => [i, b])) });
    const restarted = new EconomyStore(storage); assert.deepEqual(restarted.load(), state); assert.deepEqual(restarted.loadWorld('coop_hosted_test'), blocks); db.close();
});

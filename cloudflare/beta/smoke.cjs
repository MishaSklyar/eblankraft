const { WebSocket } = require('ws');
const assert = require('node:assert/strict');
const url = process.argv[2] || 'ws://localhost:18787/ws';
const sockets = [];
async function connect(packet, expected) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url); sockets.push(ws);
        const timer = setTimeout(() => reject(new Error('Timed out: ' + expected)), 20000);
        ws.on('error', reject);
        ws.on('open', () => ws.send(JSON.stringify(packet)));
        ws.on('message', data => {
            const message = JSON.parse(data);
            if (message.type === expected) { clearTimeout(timer); resolve({ ws, message }); }
        });
    });
}
(async () => {
    try {
        const a = await connect({ type: 'join', room: 'beta_smoke', name: 'Smoke A' }, 'welcome');
        const b = await connect({ type: 'join', room: 'beta_smoke', name: 'Smoke B' }, 'welcome');
        assert(b.message.players.some(p => p.id === a.message.id));
        console.log('Shared room between two WebSocket connections: OK');
        const coop = await connect({ type: 'join', room: 'coop_beta_smoke', name: 'Smoke world' }, 'welcome');
        assert.equal(coop.message.world.authority, 'eblan');
        console.log('Original Wasm world authority: OK');
        const arena = await connect({ type: 'arena_join', room: 'dust2', name: 'Smoke arena', mode: 'dust2' }, 'arena_welcome');
        assert.equal(arena.message.mode, 'dust2');
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('No arena snapshots')), 10000);
            arena.ws.on('message', data => {
                if (JSON.parse(data).type === 'arena_snapshot') { clearTimeout(timer); resolve(); }
            });
        });
        console.log('Dust2 join and authoritative snapshots: OK');
    } finally { sockets.forEach(ws => ws.close()); }
})().catch(error => { console.error(error); process.exitCode = 1; });

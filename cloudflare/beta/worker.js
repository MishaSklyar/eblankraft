import { BugReports } from './bug-reports.mjs';
import { AuthoritativeGameServer, WSClient } from './generated/server.js';
import { Economy } from '../../server/economy.mjs';
import { EconomyStore } from './economy-store.mjs';

export class GameServer {
    constructor(ctx, env) {
        this.bugReports = new BugReports(env);
        this.ctx = ctx;
        this.game = new AuthoritativeGameServer();
        this.tick = null;
        this.ready = ctx.blockConcurrencyWhile(async () => {
            this.store = new EconomyStore(ctx.storage);
            this.economy = new Economy({ state: this.store.load(), hosting: true,
                adminToken: env.EBLAN_MARKET_ADMIN_TOKEN || '', allowedOrigin: 'https://eblancraftbeta.pages.dev', save: state => this.store.save(state),
                canAllocateHosting: () => this.allocatedRooms() < 64 });
            this.game.economy = this.economy;
            this.game.canCreateRoom = name => !!this.economy.leaseFor(name) || this.allocatedRooms() < 64;
            const create = this.game.get_or_create_room.bind(this.game);
            this.game.get_or_create_room = (name, mode) => {
                const exists = this.game.rooms.has(name), room = create(name, mode);
                if (room && !exists && name.startsWith('coop_hosted_')) {
                    // The room seed is already deterministically derived from its name.
                    for (const b of this.store.loadWorld(name)) {
                        room.world().setBlock(b.x, b.y, b.z, b.block_type, b.design || null);
                        room.blocks.set(`${b.x},${b.y},${b.z}`, b);
                    }
                }
                return room;
            };
        });
    }

    allocatedRooms() {
        const reserved = Object.values(this.economy.state.leases).filter(l => l.expires > Date.now() && !this.game.rooms.has(l.room)).length;
        return this.game.rooms.size + reserved;
    }

    async fetch(request) {
        await this.ready;
        const url = new URL(request.url);
        if (url.pathname.startsWith('/api/economy/')) return this.economy.fetch(request);
        if (url.pathname === '/api/bug-report') return this.bugReports.fetch(request);
        if (url.pathname === '/api/status') {
            return Response.json({ online: true, clients: this.game.clients.size, rooms: this.game.rooms.size, protocol: 'eblancraftbeta' });
        }
        if (url.pathname !== '/ws') return new Response('Not found', { status: 404 });
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket upgrade required', { status: 426 });
        if (this.game.clients.size >= 128) return new Response('Server full', { status: 503 });
        const pair = new WebSocketPair();
        const browser = pair[0], socket = pair[1];
        socket.accept();
        const adapter = {
            get readyState() { return socket.readyState; },
            bufferedAmount: 0,
            send(data) { socket.send(data); },
            terminate() { try { socket.close(1000, 'Disconnected'); } catch {} }
        };
        const client = new WSClient(adapter, this.game);
        this.game.clients.add(client);
        if (!this.tick) this.tick = setInterval(() => {
            this.game.tick();
            const now = Date.now();
            if (now - (this.lastSave || 0) >= 15000) {
                this.lastSave = now;
                for (const room of this.game.rooms.values()) if (room.name.startsWith('coop_hosted_')) {
                    this.store.saveWorld(room);
                    if (!this.economy.leaseFor(room.name)) {
                        for (const client of [...room.clients.values()]) {
                            client.send_json({ type: 'server_error', message: 'Hosting expired. Renew in Addons → Hosting.' }); this.game.leave(client);
                        }
                    }
                }
            }
        }, 50);
        const close = () => {
            if (client.room?.name.startsWith('coop_hosted_')) this.store.saveWorld(client.room);
            client.close();
            if (!this.game.clients.size && this.tick) {
                clearInterval(this.tick);
                this.tick = null;
            }
        };
        socket.addEventListener('close', close);
        socket.addEventListener('error', close);
        socket.addEventListener('message', async event => {
            if (client.is_closed) return;
            const data = event.data;
            const now = this.game.clock();
            client.packet_times.push(now);
            while (client.packet_times.length && client.packet_times[0] <= now - 1) client.packet_times.shift();
            if (client.packet_times.length >= 120 || typeof data !== 'string' || new TextEncoder().encode(data).length > (client.arena_mode ? 2048 : 65536)) return close();
            let message;
            try { message = JSON.parse(data); } catch { return; }
            if (message?.type === 'economy_auth') {
                try { client.economyAccount = (await this.economy.account(message.token)).id; }
                catch { client.send_json({ type: 'economy_error', message: 'Wallet authentication failed.' }); }
                return;
            }
            try { this.game.process_message(client, message); }
            catch (error) { console.error('Game protocol:', error.message); close(); }
            if (message?.type === 'move' || message?.type === 'arena_input') this.ctx.waitUntil(this.economy.recordPlay(client));
        });
        return new Response(null, { status: 101, webSocket: browser });
    }
}

export default {
    fetch(request, env) {
        const id = env.GAME.idFromName('beta');
        return env.GAME.get(id).fetch(request);
    }
};

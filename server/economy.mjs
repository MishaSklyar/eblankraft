import '../js/addon_package.js';

const DAY = 86400000;
export const PLANS = [{ id: 'world-day', name: 'Hosted world · 24 hours', price: 40, hours: 24, players: 8 },
    { id: 'world-week', name: 'Hosted world · 7 days', price: 200, hours: 168, players: 8 }];
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const tokenHash = async token => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(b => b.toString(16).padStart(2, '0')).join('');
export class Economy {
    constructor({ state, save = async () => {}, now = Date.now, hosting = false, adminToken = '', allowedOrigin = '', canAllocateHosting = () => true } = {}) {
        this.state = state || { accounts: {}, listings: {}, leases: {} };
        this.save = save; this.now = now; this.hosting = hosting; this.adminToken = adminToken; this.allowedOrigin = allowedOrigin;
        this.canAllocateHosting = canAllocateHosting;
        this.samples = new Map(); this.playRequests = new Map(); this.rates = new Map(); this.queue = Promise.resolve();
    }
    rate(key, limit, period) {
        const now = this.now();
        if (this.rates.size > 5000) for (const [k, v] of this.rates) if (v.until <= now) this.rates.delete(k);
        let v = this.rates.get(key);
        if (!v || v.until <= now) this.rates.set(key, v = { count: 0, until: now + period });
        if (++v.count > limit) fail('Please wait before trying again.', 429);
    }
    async account(token) {
        if (typeof token !== 'string' || !/^[a-f0-9-]{73}$/.test(token)) fail('Connect your wallet first.', 401);
        const hash = await tokenHash(token);
        const a = Object.values(this.state.accounts).find(a => a.hash === hash);
        if (!a) fail('Wallet key is invalid. Restore your saved key.', 401);
        return a;
    }
    ledger(a, amount, reason) {
        if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(a.balance + amount) || a.balance + amount < 0) fail('Not enough Eblancoins.');
        a.balance += amount;
        a.history.unshift({ id: crypto.randomUUID(), amount, reason, at: this.now() });
        a.history = a.history.slice(0, 100);
    }
    publicListing(l, a) {
        return { ...l.pkg.manifest, addonId: l.pkg.manifest.id, id: l.id, price: l.price, seller: l.seller, status: l.status,
            owned: a?.owned.includes(l.id) || a?.id === l.seller, sales: l.sales };
    }
    wallet(a) {
        const day = Math.floor(this.now() / DAY);
        return { id: a.id, name: a.name, balance: a.balance, history: a.history,
            playSeconds: a.playDay === day ? a.playSeconds : 0, playEarned: a.playDay === day ? a.playEarned : 0,
            leases: Object.values(this.state.leases).filter(l => l.owner === a.id),
            listings: Object.values(this.state.listings).filter(l => l.seller === a.id).map(l => this.publicListing(l, a)) };
    }
    // Samples use accepted authority positions, never client-supplied reward amounts or elapsed time.
    observe(client) {
        const a = this.state.accounts[client.economyAccount];
        if (!a || !client.room || !client.is_alive || client.is_closed) return false;
        const now = this.now(), day = Math.floor(now / DAY);
        if (a.playDay !== day) Object.assign(a, { playDay: day, playSeconds: 0, playEarned: 0 });
        const previous = this.samples.get(a.id);
        if (previous && now - previous.at < 1000) return false;
        this.samples.set(a.id, { at: now, client: client.id, room: client.room.name, x: client.x, y: client.y, z: client.z });
        if (!previous || previous.client !== client.id || previous.room !== client.room.name || now - previous.at > 5000 ||
            Math.hypot(client.x - previous.x, client.y - previous.y, client.z - previous.z) < .05) return false;
        a.playSeconds += Math.min(2, (now - previous.at) / 1000);
        if (a.playSeconds >= 300 && a.playEarned < 120) {
            a.playSeconds -= 300; a.playEarned += 10;
            this.ledger(a, 10, '5 minutes of active multiplayer play');
            return true;
        }
        a.playSeconds = Math.min(a.playSeconds, 300);
        return false;
    }
    leaseFor(room) { return Object.values(this.state.leases).find(l => l.room === room && l.expires > this.now()); }
    recordPlay(client) {
        const at = this.now(), id = client.economyAccount;
        if (!this.state.accounts[id] || at - (this.playRequests.get(id) || 0) < 1000) return Promise.resolve();
        this.playRequests.set(id, at);
        const sample = { economyAccount: client.economyAccount, id: client.id, room: client.room,
            is_alive: client.is_alive, is_closed: client.is_closed, x: client.x, y: client.y, z: client.z };
        const result = this.queue.then(async () => {
            const before = structuredClone(this.state.accounts[sample.economyAccount] || null);
            if (!this.observe(sample)) return;
            try { await this.save(this.state); }
            catch (error) { if (before) this.state.accounts[before.id] = before; throw error; }
        });
        this.queue = result.catch(() => {});
        return result;
    }
    canJoin(client, name) {
        if (!name.startsWith('coop_hosted_')) return true;
        const lease = this.leaseFor(name);
        return !!lease && (!client.room || client.room.name !== name ? (client.server.rooms.get(name)?.clients.size || 0) < lease.players : true);
    }
    fetch(request) {
        // Serialize the entire read/validate/write/save transaction, including concurrent HTTP requests.
        const result = this.queue.then(() => this.handle(request));
        this.queue = result.catch(() => {});
        return result;
    }
    async handle(request) {
        const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
        let before;
        try {
            const url = new URL(request.url), route = url.pathname.slice('/api/economy'.length);
            if (!['GET', 'POST'].includes(request.method)) fail('Method not allowed.', 405);
            const origin = request.headers.get('Origin');
            if (request.method === 'POST' && origin && origin !== url.origin && origin !== this.allowedOrigin) fail('Use the same-origin game endpoint.', 403);
            const ip = request.headers.get('CF-Connecting-IP') || 'local';
            this.rate('requests:' + ip, 180, 60000);
            let data = {};
            if (request.method === 'POST') {
                if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('Expected JSON.', 415);
                const reader = request.body?.getReader(); let bytes = 0, chunks = [];
                if (reader) while (true) {
                    const { done, value } = await reader.read(); if (done) break;
                    bytes += value.byteLength; if (bytes > 150 * 1024) { await reader.cancel(); fail('Package is too large.', 413); }
                    chunks.push(value);
                }
                const joined = new Uint8Array(bytes); let offset = 0;
                for (const part of chunks) { joined.set(part, offset); offset += part.length; }
                try { data = JSON.parse(new TextDecoder().decode(joined)); } catch { fail('Invalid JSON.'); }
                if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Expected an object.');
            }
            const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
            let out;
            if (route === '/config' && request.method === 'GET') {
                out = { hosting: this.hosting, plans: PLANS, ads: { provider: 'Adsterra', rewarded: false,
                    reason: 'Adsterra prohibits incentivized traffic. Ad rewards are unavailable.' }, play: { seconds: 300, coins: 10, dailyCap: 120 } };
            } else if (route === '/account' && request.method === 'POST') {
                this.rate('signup:' + ip, 5, 3600000);
                if (Object.keys(this.state.accounts).length >= 10000) fail('Wallet capacity reached.', 503);
                before = structuredClone(this.state);
                const key = crypto.randomUUID() + '-' + crypto.randomUUID();
                const a = { id: crypto.randomUUID(), hash: await tokenHash(key), name: String(data.name || 'Player').trim().slice(0, 40), balance: 0, owned: [], history: [], playDay: 0, playSeconds: 0, playEarned: 0 };
                this.state.accounts[a.id] = a; out = { token: key, wallet: this.wallet(a) };
            } else if (route === '/catalog' && request.method === 'GET') {
                const a = token ? await this.account(token) : null;
                out = Object.values(this.state.listings).filter(l => l.status === 'approved').map(l => this.publicListing(l, a));
            } else if (route === '/moderate' && request.method === 'POST') {
                if (!this.adminToken || token.length !== this.adminToken.length || token !== this.adminToken) fail('Moderator access required.', 403);
                const l = this.state.listings[data.id]; if (!l) fail('Listing not found.', 404);
                if (!['approved', 'rejected'].includes(data.status)) fail('Invalid review decision.');
                before = structuredClone(this.state); l.status = data.status; out = { ok: true };
            } else if (route === '/review' && request.method === 'GET') {
                if (!this.adminToken || token !== this.adminToken) fail('Moderator access required.', 403);
                out = Object.values(this.state.listings).filter(l => l.status === 'pending');
            } else {
                const a = await this.account(token);
                if (route === '/wallet' && request.method === 'GET') out = this.wallet(a);
                else if (route === '/publish' && request.method === 'POST') {
                    const pkg = globalThis.AddonPackage.validate(data.package);
                    if (!Number.isSafeInteger(data.price) || data.price < 0 || data.price > 100000) fail('Price must be a whole number between 0 and 100000.');
                    const id = a.id + ':' + pkg.manifest.id, existing = this.state.listings[id];
                    if (!existing && Object.values(this.state.listings).filter(l => l.seller === a.id).length >= 30) fail('Maximum 30 listings per creator.');
                    if (existing && globalThis.AddonPackage.compare(pkg.manifest.version, existing.pkg.manifest.version) <= 0) fail('Publish a higher version number.');
                    before = structuredClone(this.state);
                    this.state.listings[id] = { id, seller: a.id, pkg, price: data.price, status: 'pending', sales: existing?.sales || 0 };
                    out = this.publicListing(this.state.listings[id], a);
                } else if (route === '/buy' && request.method === 'POST') {
                    const l = this.state.listings[data.id];
                    if (!l || l.status !== 'approved') fail('Addon is unavailable.', 404);
                    if (!a.owned.includes(l.id) && l.seller !== a.id) {
                        if (data.price !== l.price || data.version !== l.pkg.manifest.version) fail('Listing changed. Refresh and review its price.', 409);
                        before = structuredClone(this.state);
                        this.ledger(a, -l.price, 'Addon: ' + l.pkg.manifest.name);
                        this.ledger(this.state.accounts[l.seller], l.price, 'Sale: ' + l.pkg.manifest.name);
                        a.owned.push(l.id); l.sales++;
                    }
                    out = { wallet: this.wallet(a) };
                } else if (route === '/download' && request.method === 'POST') {
                    const l = this.state.listings[data.id];
                    if (!l || (!a.owned.includes(l.id) && l.seller !== a.id)) fail('Acquire this addon first.', 403);
                    if (l.status !== 'approved' && l.seller !== a.id) fail('This version is awaiting review.', 409);
                    out = { package: l.pkg, listingId: l.id };
                } else if (route === '/hosting' && request.method === 'POST') {
                    if (!this.hosting) fail('Hosted worlds require the Cloudflare Workers deployment.', 503);
                    const plan = PLANS.find(p => p.id === data.plan); if (!plan) fail('Choose a hosting plan.');
                    let lease = data.lease ? this.state.leases[data.lease] : null;
                    if (data.lease && (!lease || lease.owner !== a.id)) fail('Hosting lease not found.', 404);
                    if ((!lease || lease.expires <= this.now()) && !this.canAllocateHosting()) fail('Hosted world capacity is full. No coins were spent.', 503);
                    before = structuredClone(this.state);
                    this.ledger(a, -plan.price, plan.name);
                    if (lease) lease.expires = Math.max(this.now(), lease.expires) + plan.hours * 3600000;
                    else {
                        if (Object.values(this.state.leases).filter(l => l.owner === a.id).length >= 10) fail('Maximum 10 hosted worlds per wallet.');
                        const id = crypto.randomUUID();
                        lease = { id, owner: a.id, name: String(data.name || 'My world').trim().slice(0, 60), room: 'coop_hosted_' + id.replaceAll('-', '').slice(0, 16), expires: this.now() + plan.hours * 3600000, players: plan.players };
                        this.state.leases[id] = lease;
                    }
                    out = { lease, wallet: this.wallet(a) };
                } else fail('Endpoint not found.', 404);
            }
            if (before) await this.save(this.state);
            return Response.json(out, { headers });
        } catch (error) {
            if (before) this.state = before;
            return Response.json({ error: error.status ? error.message : 'Economy service could not save your change.' }, { status: error.status || 503, headers });
        }
    }
}

(function () {
    'use strict';
    // Wallet credentials belong to this site's economy, never a custom multiplayer server.
    window.authenticateAddonWallet = socket => {
        try {
            if (!socket || socket.readyState !== 1) return;
            const url = new URL(socket.url), loc = window.location;
            const host = loc.port === '8081' ? loc.hostname + ':8082' : loc.host;
            if (url.host !== host || url.protocol !== (loc.protocol === 'https:' ? 'wss:' : 'ws:')) return;
            const token = localStorage.getItem('eblankraft_wallet_key');
            if (token) socket.send(JSON.stringify({ type: 'economy_auth', token }));
        } catch { /* Offline or unavailable browser storage does not break gameplay. */ }
    };
    const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const button = (text, action, cls = '') => { const b = el('button', text, 'addon-button ' + cls); b.type = 'button'; b.onclick = action; return b; };
    const input = (placeholder, type = 'text') => { const n = el('input'); n.type = type; n.placeholder = placeholder; return n; };
    function download(name, text, type = 'application/json') {
        const url = URL.createObjectURL(new Blob([text], { type })); const a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    class AddonHub {
        constructor(manager) {
            this.manager = manager; this.game = manager.game; this.catalog = []; this.tab = 'market'; this.busy = false;
            this.token = localStorage.getItem('eblankraft_wallet_key') || '';
            this.mount();
        }
        field(parent, title, node) { const label = el('label', undefined, 'addon-field'); label.append(el('span', title), node); parent.append(label); return node; }
        async api(route, body, token = this.token) {
            const r = await fetch('/api/economy/' + route, { method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
                headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
            let data; try { data = await r.json(); } catch { throw new Error('Marketplace service unavailable. Run the Node server or Cloudflare Workers backend.'); }
            if (!r.ok) throw new Error(data.error || 'Request failed.'); return data;
        }
        async task(fn) {
            if (this.busy) return;
            this.busy = true; this.status.textContent = 'Working…'; this.root.setAttribute('aria-busy', 'true');
            try { await fn(); this.status.textContent = ''; }
            catch (error) { this.status.textContent = error.message; }
            finally { this.busy = false; this.root.setAttribute('aria-busy', 'false'); }
        }
        authenticateSockets() {
            for (const socket of [this.game.serverClient?.socket, this.game.arenaClient?.socket]) {
                window.authenticateAddonWallet(socket);
            }
        }
        mount() {
            const modal = document.getElementById('mods-modal'); if (!modal) return;
            this.root = modal;
            modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Addon workshop');
            modal.querySelector('.modal-title').textContent = 'ADDONS / Creator workshop';
            const tabs = modal.querySelector('.mods-tabs-header');
            const tabButton = el('button', '◈ Marketplace', 'mods-tab-btn'); tabButton.dataset.tab = 'hub'; tabs.append(tabButton);
            this.panel = el('div', undefined, 'mods-tab-content addon-hub'); this.panel.id = 'mods-tab-hub'; this.panel.style.display = 'none';
            modal.querySelector('.mods-modal-box').append(this.panel);
            tabButton.onclick = () => {
                tabs.querySelectorAll('.mods-tab-btn').forEach(n => n.classList.toggle('active', n === tabButton));
                modal.querySelectorAll('.mods-tab-content').forEach(n => n.style.display = n === this.panel ? 'block' : 'none');
                this.refresh();
            };
            const header = el('div', undefined, 'addon-banner');
            const heading = el('div'); heading.append(el('small', 'EBLANKRAFT COMMUNITY'), el('h2', 'Make it your world.'), el('p', 'Discover addons. Support creators. Keep playing.'));
            this.balance = el('strong', '◈ Eblancoins', 'addon-balance'); header.append(heading, this.balance);
            const nav = el('nav', undefined, 'addon-nav'); nav.setAttribute('aria-label', 'Marketplace sections');
            for (const [id, label] of [['market', 'Explore'], ['publish', 'Sell addons'], ['wallet', 'Eblancoins'], ['hosting', 'Hosting']]) {
                const b = button(label, () => { this.tab = id; this.render(); }); b.dataset.section = id; nav.append(b);
            }
            this.status = el('p', '', 'addon-status'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
            this.body = el('div', undefined, 'addon-body'); this.panel.append(header, nav, this.body);
            tabs.after(this.status);
            const bar = modal.querySelector('#mods-tab-list .mods-top-bar');
            const file = input('', 'file'); file.accept = '.ebaddon,.json'; file.setAttribute('aria-label', 'Import addon package');
            file.onchange = () => this.task(async () => {
                const f = file.files[0]; if (!f) return;
                try { if (f.size > 150 * 1024) throw new Error('Addon package exceeds 150 KiB.'); await this.install(JSON.parse(await f.text())); }
                finally { file.value = ''; }
            });
            const label = el('label', 'Import .ebaddon', 'addon-import'); label.append(file); bar.append(label);
            this.search = input('Search installed addons…', 'search'); this.search.setAttribute('aria-label', 'Search installed addons');
            this.search.oninput = () => this.decorateLibrary(); bar.append(this.search);
            this.decorateLibrary();
            const editor = modal.querySelector('#mods-tab-editor');
            const settings = el('details', undefined, 'addon-package-settings'); settings.append(el('summary', 'Addon package settings'));
            const categories = el('select'); categories.id = 'editor-addon-category';
            for (const c of AddonPackage.CATEGORIES) categories.append(el('option', c));
            const deps = input('base-addon@1.0.0, another-addon@2.0.0'); deps.id = 'editor-addon-dependencies';
            this.field(settings, 'Category', categories); this.field(settings, 'Dependencies (ID@minimum version, comma separated)', deps);
            editor.prepend(settings);
            for (const id of ['mm-btn-mods', 'btn-mods-manager']) {
                const b = document.getElementById(id); if (b) b.title = 'Addons, marketplace & Eblancoins';
            }
        }
        decorateLibrary() {
            const q = (this.search?.value || '').toLowerCase();
            const cards = document.querySelectorAll('#mods-items-list .mod-card');
            cards.forEach((card, i) => {
                const mod = this.manager.mods[i]; if (!mod) return;
                card.style.display = [mod.name, mod.author, mod.description, mod.category].join(' ').toLowerCase().includes(q) ? '' : 'none';
                card.querySelector('.addon-library-extra')?.remove();
                const extra = el('div', undefined, 'addon-library-extra');
                const error = this.manager.addonErrors?.get(mod.id);
                extra.append(el('small', error || (mod.enabled ? 'Enabled' : 'Disabled · review code before enabling'), error ? 'addon-error' : 'addon-muted'));
                extra.append(button('Export package', () => this.task(async () => download(mod.id + '.ebaddon', JSON.stringify(AddonPackage.pack(mod), null, 2)))));
                card.querySelector('.mod-card-left').append(extra);
            });
        }
        async install(data, marketplaceId) {
            const pkg = AddonPackage.validate(data), mod = AddonPackage.unpack(pkg);
            const old = this.manager.mods.find(m => m.id === mod.id);
            if (old) {
                if (old.marketplaceId !== marketplaceId) throw new Error('An addon with this ID already exists from another source. Export/remove it first.');
                const previous = AddonPackage.pack(old);
                if (AddonPackage.compare(mod.version, previous.manifest.version) <= 0) throw new Error('This version is already installed, or is older.');
            }
            if (!confirm(`${old ? 'Update' : 'Install'} ${mod.name} v${mod.version} by ${mod.author}?\n\n${mod.description}\n\nDependencies: ${mod.dependencies.map(d => d.id + ' ≥ ' + d.minVersion).join(', ') || 'none'}\n\nLua addons can modify your game and world. Review the code before enabling. This addon will be installed disabled.${old ? '\nExisting code will be replaced; export your changes first.' : ''}`)) return;
            const installed = { ...mod, ...(marketplaceId ? { marketplaceId } : {}) };
            const next = this.manager.mods.filter(m => m.id !== installed.id).concat(installed);
            localStorage.setItem('eblankraft_lua_mods', JSON.stringify(next));
            this.manager.addOrUpdateMod(installed);
            this.manager.switchTab('list');
        }
        async refresh() {
            await this.task(async () => {
                this.config = await this.api('config');
                if (this.token) { this.wallet = await this.api('wallet'); this.authenticateSockets(); }
                this.catalog = await this.api('catalog'); this.render();
            });
        }
        render() {
            this.balance.textContent = this.wallet ? `◈ ${this.wallet.balance.toLocaleString()} EC` : '◈ Connect a wallet';
            this.panel.querySelectorAll('[data-section]').forEach(n => { n.classList.toggle('selected', n.dataset.section === this.tab); n.setAttribute('aria-current', n.dataset.section === this.tab ? 'page' : 'false'); });
            this.body.replaceChildren();
            if (this.tab === 'market') this.renderMarket();
            else if (this.tab === 'wallet') this.renderWallet();
            else if (!this.wallet) this.body.append(el('p', 'Connect a wallet in Eblancoins to continue.'), button('Connect wallet', () => { this.tab = 'wallet'; this.render(); }));
            else if (this.tab === 'publish') this.renderPublish();
            else this.renderHosting();
        }
        renderMarket() {
            const controls = el('div', undefined, 'addon-controls'); const search = input('Search addons or creators…', 'search');
            search.setAttribute('aria-label', 'Search marketplace'); const category = el('select'); category.setAttribute('aria-label', 'Category');
            for (const c of ['all', ...AddonPackage.CATEGORIES]) { const o = el('option', c === 'all' ? 'All categories' : c); o.value = c; category.append(o); }
            controls.append(search, category, button('Refresh', () => this.refresh()));
            const list = el('div', undefined, 'addon-grid'); this.body.append(controls, list);
            const draw = () => {
                list.replaceChildren();
                const found = this.catalog.filter(l => (category.value === 'all' || l.category === category.value) && [l.name, l.author, l.description].join(' ').toLowerCase().includes(search.value.toLowerCase()));
                for (const l of found) {
                    const card = el('article', undefined, 'addon-card'); card.append(el('small', l.category.toUpperCase(), 'addon-muted'), el('h3', l.name), el('p', `by ${l.author} · v${l.version}`, 'addon-muted'), el('p', l.description));
                    if (l.dependencies.length) card.append(el('small', 'Requires: ' + l.dependencies.map(d => d.id + ' ≥ ' + d.minVersion).join(', ')));
                    const installed = this.manager.mods.find(m => m.marketplaceId === l.id);
                    const current = installed && AddonPackage.compare(AddonPackage.pack(installed).manifest.version, l.version) >= 0;
                    const b = button(current ? 'Installed' : l.owned ? (installed ? 'Update addon' : 'Install owned addon') : l.price ? `Buy · ${l.price} EC` : 'Get free addon', () => this.task(async () => {
                        if (!this.wallet) throw new Error('Connect a wallet in Eblancoins first.');
                        if (!l.owned && l.price && !confirm(`Buy ${l.name} for ${l.price} Eblancoins?`)) return;
                        if (!l.owned) await this.api('buy', { id: l.id, price: l.price, version: l.version });
                        const data = await this.api('download', { id: l.id });
                        await this.install(data.package, l.id);
                        this.wallet = await this.api('wallet'); this.catalog = await this.api('catalog'); this.render();
                    }), 'primary');
                    b.disabled = !!current; card.append(b); list.append(card);
                }
                if (!found.length) list.append(el('p', this.catalog.length ? 'No addons match your search.' : 'The marketplace is ready for its first creators. Publish an addon for review.', 'addon-empty'));
            };
            search.oninput = category.onchange = draw; draw();
        }
        renderWallet() {
            this.body.append(el('h3', 'Earn by playing. Spend on your world.'), el('p', 'Earn 10 EC for every 5 minutes of active play on this server, up to 120 EC per UTC day. Solo play and idle time do not earn coins. Eblancoins are in-game credits with no cash withdrawal.'));
            const ad = el('div', undefined, 'addon-notice'); ad.append(el('strong', 'Adsterra · ad rewards unavailable'), el('p', this.config?.ads.reason || 'Ad rewards are not connected.')); this.body.append(ad);
            if (!this.wallet) {
                const name = input('Creator / player name'); this.field(this.body, 'New wallet', name);
                this.body.append(button('Create wallet', () => this.task(async () => {
                    const data = await this.api('account', { name: name.value }, '');
                    localStorage.setItem('eblankraft_wallet_key', data.token); this.token = data.token; this.wallet = data.wallet; this.authenticateSockets(); this.render();
                }), 'primary'));
                const key = input('Paste your private wallet key', 'password'); key.autocomplete = 'off'; this.field(this.body, 'Restore wallet', key);
                this.body.append(button('Restore', () => this.task(async () => {
                    const value = key.value.trim(); const wallet = await this.api('wallet', undefined, value);
                    localStorage.setItem('eblankraft_wallet_key', value); this.token = value; this.wallet = wallet; this.authenticateSockets(); this.render();
                })));
                return;
            }
            this.body.append(el('p', `${this.wallet.name} · ${this.wallet.balance} EC · earned today: ${this.wallet.playEarned}/120 EC`));
            const progress = el('progress'); progress.max = 300; progress.value = this.wallet.playSeconds; progress.setAttribute('aria-label', 'Progress toward next play reward');
            this.body.append(progress, el('p', `${Math.floor(this.wallet.playSeconds)}/300 active seconds toward the next reward. Refresh to update.`, 'addon-muted'));
            const actions = el('div', undefined, 'addon-controls');
            actions.append(button('Refresh balance', () => this.refresh()), button('Back up wallet key', () => download('eblankraft-wallet-key.txt', this.token, 'text/plain')));
            this.body.append(actions, el('p', 'Keep your backup private. Anyone with this key controls your coins and listings. Clearing browser storage without a backup loses access.', 'addon-muted'));
            this.body.append(el('h3', 'Recent activity'));
            if (!this.wallet.history.length) this.body.append(el('p', 'Your earnings and purchases will appear here.', 'addon-muted'));
            for (const h of this.wallet.history.slice(0, 20)) {
                const row = el('div', undefined, 'addon-ledger'); row.append(el('span', `${h.reason} · ${new Date(h.at).toLocaleString()}`), el('strong', `${h.amount > 0 ? '+' : ''}${h.amount} EC`)); this.body.append(row);
            }
        }
        renderPublish() {
            this.body.append(el('h3', 'Your addon. Your price.'), el('p', 'Creators receive 100% of each sale in Eblancoins. New listings and updates await moderator review. Buyers keep ownership of future approved updates.'));
            const form = el('form', undefined, 'addon-form'); const select = el('select');
            for (const mod of this.manager.mods.filter(m => !m.marketplaceId)) { const o = el('option', mod.name + ' · v' + mod.version); o.value = mod.id; select.append(o); }
            this.field(form, 'Installed addon to publish', select);
            const price = input('0 = free', 'number'); price.min = 0; price.max = 100000; price.step = 1; price.value = 0; this.field(form, 'Price in Eblancoins', price);
            const category = el('select'); for (const c of AddonPackage.CATEGORIES) { const o = el('option', c); category.append(o); } this.field(form, 'Category', category);
            const submit = button('Submit for review'); submit.type = 'submit'; submit.classList.add('primary'); submit.disabled = !select.options.length; form.append(submit);
            form.onsubmit = event => { event.preventDefault(); this.task(async () => {
                const mod = this.manager.mods.find(m => m.id === select.value); if (!mod) throw new Error('Create or import an addon first.');
                const pkg = AddonPackage.pack({ ...mod, category: category.value });
                await this.api('publish', { package: pkg, price: Number(price.value) });
                this.wallet = await this.api('wallet'); this.render();
            }); };
            this.body.append(form, el('h3', 'Your listings'));
            for (const l of this.wallet.listings) this.body.append(el('p', `${l.name} · v${l.version} · ${l.price} EC · ${l.sales} sales · ${l.status}`));
        }
        renderHosting() {
            this.body.append(el('h3', 'A world that stays yours.'), el('p', 'Cloudflare Workers hosted co-op rooms for up to 8 players. Share the room code with friends. Hosting time starts at purchase; renewals extend the expiry.'));
            if (!this.config?.hosting) { this.body.append(el('p', 'Hosting purchases are available on the Cloudflare Workers deployment.', 'addon-notice')); return; }
            const name = input('My world'); this.field(this.body, 'World name', name);
            const grid = el('div', undefined, 'addon-grid');
            for (const plan of this.config.plans) {
                const card = el('article', undefined, 'addon-card'); card.append(el('h3', plan.name), el('strong', `${plan.price} EC`), el('p', `${plan.players} players · saved world blocks`), button('Create hosted world', () => this.buyHosting(plan, name.value), 'primary')); grid.append(card);
            }
            this.body.append(grid, el('h3', 'Your hosted worlds'));
            for (const lease of this.wallet.leases) {
                const card = el('article', undefined, 'addon-card'); const active = lease.expires > Date.now();
                card.append(el('h3', lease.name), el('p', `${active ? 'Expires' : 'Expired'} ${new Date(lease.expires).toLocaleString()}`), el('code', lease.room));
                if (active) card.append(button('Join world', () => this.task(async () => {
                    const client = this.game.serverClient; if (!client) throw new Error('Start a game first to join a hosted world.');
                    if (!client.isConnected) { client.currentRoom = lease.room; client.roomMode = 'survival'; client.connect(); }
                    else client.joinRoom(lease.room, this.wallet.name, 'classic', 'survival');
                    this.manager.toggleModal(false);
                })));
                for (const plan of this.config.plans) card.append(button(`Extend · ${plan.hours}h / ${plan.price} EC`, () => this.buyHosting(plan, lease.name, lease.id)));
                this.body.append(card);
            }
        }
        buyHosting(plan, name, lease) {
            return this.task(async () => {
                if (!confirm(`${lease ? 'Extend' : 'Create'} hosting: ${plan.name} for ${plan.price} EC?`)) return;
                const data = await this.api('hosting', { plan: plan.id, name, lease }); this.wallet = data.wallet; this.render();
            });
        }
    }
    const originalInit = ModManager.prototype.initUI;
    ModManager.prototype.initUI = function () { originalInit.call(this); this.addonHub = new AddonHub(this); };
    const originalRender = ModManager.prototype.renderModsList;
    ModManager.prototype.renderModsList = function () { originalRender.call(this); this.addonHub?.decorateLibrary(); };
    window.AddonHub = AddonHub;
})();

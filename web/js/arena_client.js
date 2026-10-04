/** Server-owned PvP. Client sends controls and renders authoritative snapshots. */
class ArenaClient {
    constructor(game, multiplayer) {
        this.game = game;
        this.multiplayer = multiplayer;
        this.socket = null;
        this.isActive = false;
        this.isConnected = false;
        this.clientId = null;
        this.seq = 0;
        this.lastInput = -Infinity;
        this.lastAttack = -Infinity;
        this.savedSession = null;
        this.localState = null;
        this.mode = 'legacy';
        this.match = null;
        this.playerStates = [];
        this.useHeld = false;
        this.buyOpen = false;
        this.spectatorIndex = 0;
        this.weaponSpecs = {};
        this.triggerHeld = false;
        this.scoreboardOpen = false;
        this.killFeed = [];
        this.tracers = [];
        this.hitUntil = 0;
        this.resetPrediction();
        if (window.addEventListener) {
            window.addEventListener('keydown', event => {
                if (!this.isConnected || this.mode !== 'dust2') return;
                if (event.target?.matches?.('input, textarea, [contenteditable="true"]')) return;
                if (event.code === 'Tab') { this.scoreboardOpen = true; this.renderScoreboard(); event.preventDefault(); return; }
                if (event.repeat || this.game.ui?.menuOpen || this.game.ui?.mainMenuOpen) return;
                if (event.code === 'KeyE') { this.useHeld = true; event.preventDefault(); }
                if (event.code === 'KeyB') { this.toggleBuy(); event.preventDefault(); }
                if (event.code === 'KeyR') { this.reload(); event.preventDefault(); }
                if (event.code === 'Digit1' || event.code === 'Digit2') { this.equip(Number(event.code.slice(-1))); event.preventDefault(); }
                if (event.code === 'BracketLeft') this.spectatorIndex--;
                if (event.code === 'BracketRight') this.spectatorIndex++;
            });
            window.addEventListener('keyup', event => {
                if (event.code === 'KeyE') this.useHeld = false;
                if (event.code === 'Tab') { this.scoreboardOpen = false; this.renderScoreboard(); }
            });
            window.addEventListener('blur', () => { this.useHeld = false; this.releaseTrigger(); this.scoreboardOpen = false; this.renderScoreboard(); });
        }
        const input = document.getElementById('input-mp-server-url');
        if (input) input.value = localStorage.getItem('eblankraft_pvp_server') || this.defaultUrl();
    }

    defaultUrl() {
        const loc = window.location;
        const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = loc.port === '8081' ? `${loc.hostname}:8082` : loc.host;
        return `${protocol}//${host}/ws`;
    }

    connect(room) {
        if (this.game.serverClient) this.game.serverClient.leaveRoom();
        this.disconnect();
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(room)) {
            this.multiplayer.showToast('Некоректний код кімнати');
            return;
        }
        const input = document.getElementById('input-mp-server-url');
        const address = input ? input.value.trim() : this.defaultUrl();
        let socket;
        try {
            const url = new URL(address);
            if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password) throw new Error('URL');
            socket = new WebSocket(url.href);
        } catch (error) {
            this.multiplayer.showToast('Вкажіть адресу PvP-сервера: ws:// або wss://');
            return;
        }
        localStorage.setItem('eblankraft_pvp_server', address);
        this.socket = socket;
        this.seq = 0;
        this.lastInput = this.lastAttack = -Infinity;
        const status = document.getElementById('mp-status-text');
        if (status) status.textContent = 'Підключення до PvP-сервера...';
        this.connectTimeout = setTimeout(() => {
            if (this.socket === socket && !this.isConnected) {
                this.disconnect();
                this.multiplayer.showToast('PvP-сервер не відповідає. Перевірте адресу та запуск сервера.');
            }
        }, 8000);
        socket.onopen = () => {
            if (this.socket !== socket) return;
            this.mode = 'dust2';
            this.send({ type: 'arena_join', room, name: this.multiplayer.playerName, mode: 'dust2' });
        };
        socket.onmessage = event => {
            if (this.socket !== socket) return;
            try { this.handleMessage(JSON.parse(event.data)); }
            catch (error) {
                console.error('Arena protocol error:', error);
                this.disconnect();
                this.multiplayer.showToast('Помилка протоколу PvP-сервера');
            }
        };
        socket.onerror = () => {
            if (this.socket === socket) this.multiplayer.showToast('Не вдалося підключитися до PvP-сервера');
        };
        socket.onclose = () => {
            if (this.socket !== socket) return;
            this.disconnect();
            this.multiplayer.showToast('З’єднання з PvP-сервером закрито');
        };
    }

    send(packet) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 32768) return false;
        this.socket.send(JSON.stringify(packet));
        return true;
    }

    enterArena(map) {
        const game = this.game, player = game.player;
        if (player._saveInvTimer) {
            clearTimeout(player._saveInvTimer);
            player._saveInvTimer = null;
        }
        player.saveInventory();
        const fields = ['inventory', 'selectedHotbarIndex', 'health', 'hunger', 'isDead', 'deathReason',
            'isCreative', 'godMode', 'isFlying', 'canFly', 'noclip', 'instantBreak', 'infiniteBlocks',
            'customReach', 'hardcore', 'mountedVehicle', 'yaw', 'pitch', 'onGround'];
        this.savedSession = {
            world: game.world, position: player.position.clone(), velocity: player.velocity.clone(),
            player: Object.fromEntries(fields.map(key => [key, player[key]])), hidden: [],
            timeOfDay: game.timeOfDay,
        };
        const hide = object => {
            if (object && !this.savedSession.hidden.some(entry => entry[0] === object)) {
                this.savedSession.hidden.push([object, object.visible]);
                object.visible = false;
            }
        };
        for (const chunk of Object.values(game.world.chunks)) {
            hide(chunk.mesh); hide(chunk.waterMesh);
        }
        const manager = game.mobManager;
        if (manager) {
            const entities = [...manager.mobs, ...manager.itemDrops, ...manager.crystals, ...manager.fireballs, manager.dragon];
            for (const entity of entities) {
                if (entity) { hide(entity.mesh); hide(entity.group); hide(entity.beamLine); }
            }
        }
        for (const tnt of game.tntEntities || []) hide(tnt.mesh);
        this.isActive = true;
        game.world = new VoxelWorld(game.scene, game.textureManager, {
            seed: 1, worldType: map.id === 'de_eblan2' ? 'de_eblan2' : 'pvp_arena', arenaMap: map, chunkRadius: 6, game,
        });
        player.world = game.world;
        player.inventory = Array(27).fill(null);
        player.inventory[0] = { itemId: this.mode === 'dust2' ? ITEM_TYPES.GLOCK : ITEM_TYPES.DIAMOND_SWORD, count: 1 };
        player.selectedHotbarIndex = 0;
        for (const key of ['isCreative', 'godMode', 'isFlying', 'canFly', 'noclip', 'instantBreak',
            'infiniteBlocks', 'hardcore', 'isDead', 'isMining']) player[key] = false;
        player.mountedVehicle = null;
        player.customReach = 3.5;
        player.hunger = 100;
        game.timeOfDay = 0.25;
        player.updateHeldBlock();
        if (this.mode === 'dust2' && window.THREE) {
            this.siteMarkers = Object.entries(map.sites).map(([name, point]) => {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 128;
                const context = canvas.getContext('2d');
                context.fillStyle = '#dca64b';
                context.font = 'bold 96px sans-serif';
                context.textAlign = 'center';
                context.fillText(name, 64, 100);
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: true }));
                sprite.position.set(point[0], (map.siteHeights?.[name] ?? map.floorY) + 3, point[1]);
                sprite.scale.set(2, 2, 1);
                game.scene.add(sprite);
                return sprite;
            });
        }
        if (game.ui) {
            game.ui.initHotbar();
            game.ui.closeMainMenu();
        }
    }

    handleMessage(message) {
        if (!message || typeof message !== 'object') return;
        const mp = this.multiplayer;
        switch (message.type) {
            case 'arena_error':
                this.disconnect();
                mp.showToast(message.message);
                break;
            case 'arena_welcome':
                if (this.isConnected) return;
                if (message.mode !== 'dust2') {
                    this.disconnect();
                    mp.showToast('Сервер запустив стару арену. Перезапустіть python3 server.py та оновіть сторінку Ctrl+Shift+R.');
                    return;
                }
                clearTimeout(this.connectTimeout);
                this.clientId = message.id;
                this.mode = message.mode || 'legacy';
                this.weaponSpecs = message.weaponSpecs || {};
                this.enterArena(message.map);
                this.isConnected = mp.isConnected = true;
                mp.isHost = false;
                mp.peerId = message.room;
                mp.updateConnectedUI(true, message.room, false);
                this.applySnapshot(message.players, message.match);
                if (this.mode === 'dust2') this.mountDustHud();
                this.heartbeat = setInterval(() => {
                    const controls = this.game.controls;
                    const paused = this.game.ui?.mainMenuOpen || this.game.ui?.menuOpen;
                    this.sendInput(paused ? 0 : (controls?.inputVector.x || 0),
                        paused ? 0 : (controls?.inputVector.y || 0),
                        !paused && controls?.jumpPressed, !paused && this.game.player.isSprinting, true);
                }, 5000);
                mp.showToast(this.mode === 'dust2'
                    ? 'Dust2: B — купівля, E — встановити / розмінувати, [ ] — спостерігати'
                    : 'PvP-арена: алмазний меч, серверний рух та урон');
                break;
            case 'arena_snapshot':
                if (this.isConnected) this.applySnapshot(message.players, message.match);
                break;
            case 'arena_shot':
                if (this.isConnected && this.mode === 'dust2') this.showShot(message);
                break;
            case 'arena_hit': {
                if (!this.isConnected) break;
                if (message.attackerId === this.clientId) {
                    this.hitUntil = performance.now() + (message.killed ? 450 : 220);
                    const marker = document.getElementById('dust2-hit');
                    if (marker) {
                        marker.textContent = `${message.headshot ? '✦' : '×'} ${Math.ceil(message.damage)}`;
                        marker.style.color = message.killed ? '#ff6b6b' : '#fff';
                        marker.style.display = 'block';
                    }
                }
                if (message.killed) {
                    this.killFeed.push({ text: `${message.attackerName || message.attackerId} · ${message.weaponName || message.weapon || ''}${message.headshot ? ' · HS' : ''} · ${message.targetName || message.targetId}`, until: performance.now() + 8000 });
                    this.killFeed = this.killFeed.slice(-5);
                    this.renderKillFeed();
                }
                if (message.targetId === this.clientId) {
                    const player = this.game.player;
                    player.health = message.health;
                    player.isDead = !message.alive;
                    if (this.localState) {
                        this.localState.health = message.health;
                        this.localState.alive = message.alive;
                    }
                    if (!message.alive) this.resetPrediction();
                    if (player.isDead) player.deathReason = 'Вас перемогли на PvP-арені';
                    if (this.game.soundManager) this.game.soundManager.playHurt();
                    if (this.game.flashDamageScreen) this.game.flashDamageScreen();
                } else {
                    const remote = mp.remotePlayers.get(message.targetId);
                    if (remote) {
                        remote.takeDamage(message.damage);
                        remote.health = message.health;
                        remote.updateNameplate();
                    }
                }
                break;
            }
            case 'arena_chat':
                if (this.isConnected) mp.addChatMessage(message.sender, message.text);
                break;
        }
    }

    applySnapshot(players, match = null) {
        if (!Array.isArray(players)) throw new Error('Missing arena players');
        this.playerStates = players;
        if (match) this.match = match;
        const present = new Set();
        for (const state of players) {
            if (state.id === this.clientId) {
                const player = this.game.player;
                this.reconcile(state);
                if (this.localState?.spawn !== state.spawn || this.localState?.heldItem !== state.heldItem) {
                    this.releaseTrigger();
                    this.lastAttack = -Infinity;
                    if (player.isScoped) player.toggleScope?.();
                }
                this.localState = state;
                if (this.mode === 'dust2' && player.inventory[0]?.itemId !== state.heldItem) {
                    player.inventory[0] = { itemId: state.heldItem, count: 1 };
                    player.selectedHotbarIndex = 0;
                    player.updateHeldBlock();
                    this.game.ui?.initHotbar();
                }
                player.health = state.health;
                player.isDead = !state.alive;
                const screen = document.getElementById('death-screen');
                if (screen && (state.alive || this.mode === 'dust2')) screen.style.display = 'none';
                continue;
            }
            present.add(state.id);
            let remote = this.multiplayer.remotePlayers.get(state.id);
            if (!remote) {
                remote = new RemotePlayer(state.id, state.name, this.game.scene, this.game.textureManager,
                    this.game.soundManager, this.game.particleSystem);
                remote.group.position.set(state.position.x, state.position.y, state.position.z);
                this.multiplayer.remotePlayers.set(state.id, remote);
            }
            remote.setTargetState(state);
            remote.group.visible = state.alive;
        }
        for (const id of this.multiplayer.remotePlayers.keys()) {
            if (!present.has(id)) this.multiplayer.removeRemotePlayer(id);
        }
        this.multiplayer.updatePlayerCount();
        if (this.mode === 'dust2') {
            this.renderDustHud();
            this.renderScoreboard();
            this.updateBombMarker();
            if (!this.localState?.alive) this.updateSpectator();
        }
    }

    sendInput(strafe, forward, jump, sprint, force = false) {
        const now = performance.now();
        if (!this.isConnected || (!force && now - this.lastInput < 50)) return;
        const player = this.game.player;
        const yaw = Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw));
        const pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.pitch));
        if (this.send({ type: 'arena_input', seq: ++this.seq, strafe, forward, yaw, pitch,
            jump: !!jump, sprint: !!sprint, use: this.mode === 'dust2' && this.useHeld })) this.lastInput = now;
    }

    mountDustHud() {
        if (!document.createElement || document.getElementById('dust2-hud')) return;
        const hud = document.createElement('div');
        hud.id = 'dust2-hud';
        hud.innerHTML = `<div id="dust2-score"></div>
            <div id="dust2-status"></div>
            <div id="dust2-player"></div>
            <div id="dust2-ammo"></div>
            <div id="dust2-hit" style="display:none">💥 ВЛУЧИВ!</div>
            <div id="dust2-feed"></div>
            <div id="dust2-progress" style="display:none"></div>
            <div id="dust2-board" style="display:none"></div>
            <div id="dust2-actions">
                <button class="eblan-btn-pixel" data-action="reload" aria-label="Перезарядити">R ↻</button>
                <button class="eblan-btn-pixel" data-action="equip" aria-label="Змінити зброю">1 / 2</button>
                <button class="eblan-btn-pixel danger" data-action="use" aria-label="Утримуйте для C4">💣 E C4</button>
                <button class="eblan-btn-pixel primary" data-action="buy" aria-label="Магазин">🛒 B $</button>
                <button class="eblan-btn-pixel" data-action="board" aria-label="Рахунок гравців">📊 Tab</button>
            </div>
            <div id="dust2-buy" style="display:none">
                <div style="color:#ffd700;font-size:16px;font-weight:900;margin-bottom:12px;text-shadow:2px 2px 0 #000">🛒 ВОЄНТОРГ ЄБЛАНА · B закрити</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    <button class="eblan-btn-pixel" data-buy="armor">🛡️ Броня $650</button>
                    <button class="eblan-btn-pixel" data-buy="deagle">🔫 Deagle $700</button>
                    <button class="eblan-btn-pixel" data-buy="mp5">⚡ MP5 $1500</button>
                    <button class="eblan-btn-pixel" data-buy="ak47">🔥 AK-47 $2700 (T)</button>
                    <button class="eblan-btn-pixel" data-buy="m4a1">🎯 M4A1 $2900 (CT)</button>
                    <button class="eblan-btn-pixel" data-buy="awp">💥 AWP $4750</button>
                </div>
                <button class="eblan-btn-pixel primary" data-action="buy" style="margin-top:12px;width:100%">▶ Продовжити бій</button>
            </div>`;
        document.body.appendChild(hud);
        for (const button of hud.querySelectorAll('[data-buy]')) {
            button.onclick = () => this.buy(button.dataset.buy);
        }
        for (const button of hud.querySelectorAll('[data-action]')) {
            if (button.dataset.action === 'use') {
                button.onpointerdown = event => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); this.useHeld = true; };
                button.onpointerup = button.onpointercancel = () => { this.useHeld = false; };
                button.onlostpointercapture = () => { this.useHeld = false; };
            } else button.onclick = () => {
                const action = button.dataset.action;
                if (action === 'reload') this.reload();
                if (action === 'equip') this.equip(this.localState?.slot === 1 ? 2 : 1);
                if (action === 'buy') this.toggleBuy();
                if (action === 'board') { this.scoreboardOpen = !this.scoreboardOpen; this.renderScoreboard(); }
            };
        }
        this.renderDustHud();
    }

    renderDustHud() {
        const match = this.match, state = this.localState;
        if (!match || !state) return;
        const score = document.getElementById('dust2-score');
        const status = document.getElementById('dust2-status');
        const player = document.getElementById('dust2-player');
        const buy = document.getElementById('dust2-buy');
        const alive = team => this.playerStates.filter(p => p.team === team && p.alive).length;
        if (score) {
            const tWins = match.score.T || 0;
            const ctWins = match.score.CT || 0;
            score.innerHTML = `<span style="color:#ffaa00">💣 ТЕРОРИ ${tWins}</span>  —  <span style="color:#55aaff">${ctWins} СПЕЦНАЗ 🛡️</span>   |   <span style="color:#ffd700">Раунд ${match.round}</span>   |   🟢 ${alive('T')} : ${alive('CT')}`;
        }
        const bomb = match.bomb || {};
        let objective = `${match.phase.toUpperCase()} · ${Math.ceil(match.remaining)}с`;
        if (bomb.status === 'planted') objective = `💣 C4 ${bomb.site} · ${Math.ceil(bomb.remaining)}с`;
        else if (bomb.status === 'dropped') objective = '💣 C4 скинуто';
        else if (state.hasBomb && match.phase === 'live') objective += ' · 💣 E на A або B';
        if (match.phase === 'post' && match.result) {
            const reasons = { bomb: 'C4 вибухнув', defuse: 'C4 розміновано', elimination: 'Команду знищено', time: 'Час вичерпано' };
            objective = `${match.result.winner} перемагають · ${reasons[match.result.reason] || match.result.reason} · ${Math.ceil(match.remaining)}с`;
        } else if (!state.alive) {
            const target = this.spectatorTarget();
            objective = `СПОСТЕРІГАЧ: ${target?.name || 'очікування'} · [ ] змінити ціль`;
        }
        if (status) status.textContent = objective;
        if (player) {
            const teamLabel = state.team === 'T' ? '💣 ТЕРОР' : '🛡️ СПЕЦНАЗ';
            const teamColor = state.team === 'T' ? '#ffaa00' : '#55aaff';
            const hp = Math.max(0, Math.ceil(state.health));
            const armorText = state.armor ? ' · 🛡️ Броня' : '';
            player.innerHTML = `<span style="color:${teamColor};font-weight:bold">${teamLabel}</span> · <span style="color:#ffd700">$${state.money}</span> · <span style="color:${hp <= 25 ? '#ff4444' : '#55ff55'}">❤️ ${hp} HP</span>${armorText} · 💀 ${state.kills || 0}/${state.deaths || 0} K/D`;
        }
        const ammo = document.getElementById('dust2-ammo');
        const spec = this.weaponSpec();
        if (ammo) {
            const reloadStr = state.reloading ? ` · <span style="color:#ffaa00">🔄 ${Math.ceil(state.reloadRemaining || 0)}с</span>` : '';
            ammo.innerHTML = `🔫 <span style="color:#ffd700">${(spec.name || state.heldItem).toUpperCase()}</span> · <span style="font-size:20px;font-weight:900">${state.ammo}</span> / ${state.reserveAmmo}${reloadStr}`;
        }
        const progress = document.getElementById('dust2-progress');
        if (progress) {
            progress.style.display = bomb.actor ? 'block' : 'none';
            progress.textContent = `${bomb.action === 'defuse' ? 'Розмінування' : 'Встановлення'} ${Math.round((bomb.progress || 0) * 100)}% · ${(bomb.actionRemaining || 0).toFixed(1)}с`;
        }
        if (match.phase !== 'buy' || !state.alive) this.buyOpen = false;
        if (buy) buy.style.display = this.buyOpen ? 'block' : 'none';
        for (const button of buy?.querySelectorAll?.('[data-buy]') || []) {
            const item = button.dataset.buy;
            const cost = item === 'armor' ? 650 : this.weaponSpecs[item]?.cost;
            button.disabled = match.phase !== 'buy' || !state.alive || state.money < (cost || 0) ||
                (item === 'armor' && state.armor) || (item === 'ak47' && state.team !== 'T') || (item === 'm4a1' && state.team !== 'CT') || state.primary === item || state.secondary === item;
            button.style.opacity = button.disabled ? '.4' : '1';
        }
    }

    renderScoreboard() {
        const board = document.getElementById('dust2-board');
        if (!board) return;
        board.style.display = this.scoreboardOpen ? 'block' : 'none';
        board.innerHTML = `
            <div style="font-size:16px;font-weight:900;color:#ffd700;margin-bottom:12px;text-align:center;text-shadow:2px 2px 0 #000">📊 ТАБЛИЦЯ ЛІДЕРІВ · DUST2 ЄБЛАН</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                    <div style="color:#ffaa00;font-weight:bold;border-bottom:2px solid #ffaa00;margin-bottom:6px;padding-bottom:2px">💣 ТЕРОРИСТИ</div>
                    ${this.playerStates.filter(p => p.team === 'T').sort((a, b) => (b.kills || 0) - (a.kills || 0)).map(p =>
                        `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #333;font-size:12px;color:${p.id === this.clientId ? '#55ff55' : '#fff'}">
                            <span>${p.id === this.clientId ? '▸ ' : ''}${p.name}${p.bot ? ' [BOT]' : ''}</span>
                            <span>${p.kills || 0}/${p.deaths || 0} · ${p.alive ? Math.ceil(p.health) + ' HP' : '💀 †'}</span>
                        </div>`
                    ).join('')}
                </div>
                <div style="flex:1;min-width:200px">
                    <div style="color:#55aaff;font-weight:bold;border-bottom:2px solid #55aaff;margin-bottom:6px;padding-bottom:2px">🛡️ СПЕЦНАЗ</div>
                    ${this.playerStates.filter(p => p.team === 'CT').sort((a, b) => (b.kills || 0) - (a.kills || 0)).map(p =>
                        `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #333;font-size:12px;color:${p.id === this.clientId ? '#55ff55' : '#fff'}">
                            <span>${p.id === this.clientId ? '▸ ' : ''}${p.name}${p.bot ? ' [BOT]' : ''}</span>
                            <span>${p.kills || 0}/${p.deaths || 0} · ${p.alive ? Math.ceil(p.health) + ' HP' : '💀 †'}</span>
                        </div>`
                    ).join('')}
                </div>
            </div>
            <div style="margin-top:14px;text-align:center">
                <button class="eblan-btn-pixel" onclick="if(window.game?.arenaClient){window.game.arenaClient.scoreboardOpen=false;window.game.arenaClient.renderScoreboard();}">❌ Закрити [Tab]</button>
            </div>
        `;
    }

    renderKillFeed() {
        this.killFeed = this.killFeed.filter(entry => entry.until > performance.now());
        const feed = document.getElementById('dust2-feed');
        if (feed) feed.textContent = this.killFeed.map(entry => entry.text).join('\n');
        if (feed) feed.style.whiteSpace = 'pre-line';
    }

    weaponSpec() {
        const weapon = this.localState?.heldItem || 'glock';
        return this.weaponSpecs[weapon] || { cooldown: weapon === 'awp' ? 1.15 : ['glock', 'deagle'].includes(weapon) ? .3 : .12,
            automatic: ['mp5', 'ak47', 'm4a1'].includes(weapon), recoil: weapon === 'awp' ? .065 : .025 };
    }

    reload() {
        if (!this.isConnected || this.mode !== 'dust2' || this.buyOpen || !this.localState?.alive) return false;
        return this.send({ type: 'arena_reload' });
    }

    equip(slot) {
        if (!this.isConnected || this.mode !== 'dust2' || !this.localState?.alive || this.buyOpen) return false;
        this.releaseTrigger();
        return this.send({ type: 'arena_equip', slot });
    }

    releaseTrigger() { this.triggerHeld = false; }

    showShot(message) {
        if (message.attackerId !== this.clientId) {
            this.game.modManager?.soundSynth?.gunshot(.8, .12);
            const remote = this.multiplayer.remotePlayers.get(message.attackerId);
            if (remote) remote.armSwing = .55;
        }
        if (!window.THREE || !this.game.scene || !message.origin || !message.end) return;
        const vector = point => new THREE.Vector3(point.x, point.y, point.z);
        const start = vector(message.origin), end = vector(message.end);
        if (message.attackerId === this.clientId) {
            // Offset the tracer from the camera while retaining the server's hit point.
            start.y -= .15;
        }
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const material = new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: .8 });
        const line = new THREE.Line(geometry, material);
        this.game.scene.add(line);
        this.tracers.push({ line, until: performance.now() + 90 });
    }

    toggleBuy() {
        if (this.mode !== 'dust2' || this.match?.phase !== 'buy') return;
        const panel = document.getElementById('dust2-buy');
        this.buyOpen = !this.buyOpen;
        if (panel) panel.style.display = this.buyOpen ? 'block' : 'none';
        if (this.buyOpen) document.exitPointerLock?.();
        else this.game.renderer?.domElement?.requestPointerLock?.();
    }

    buy(item) {
        if (this.mode === 'dust2') this.send({ type: 'arena_buy', item });
    }

    spectatorTarget() {
        if (!this.localState) return null;
        const candidates = this.playerStates.filter(state => state.alive && state.team === this.localState.team);
        if (!candidates.length) return null;
        const index = ((this.spectatorIndex % candidates.length) + candidates.length) % candidates.length;
        return candidates[index];
    }

    updateSpectator() {
        const target = this.spectatorTarget();
        if (!target) return;
        const player = this.game.player;
        player.position.set(target.position.x, target.position.y, target.position.z);
        player.velocity.set(target.velocity.x, target.velocity.y, target.velocity.z);
        player.yaw = target.yaw;
        player.pitch = target.pitch;
    }

    updateBombMarker() {
        const bomb = this.match?.bomb;
        if (bomb?.status === 'planted' && bomb.position && this.game.scene && window.THREE) {
            if (!this.bombMarker) {
                const group = new THREE.Group();
                const charge = new THREE.Mesh(new THREE.BoxGeometry(.45, .25, .45), new THREE.MeshLambertMaterial({ color: 0xd32f2f, emissive: 0x330000 }));
                charge.position.y = .12;
                group.add(charge);
                this.game.scene.add(group);
                this.bombMarker = group;
            }
            this.bombMarker.position.set(bomb.position[0], this.game.world.arenaMap.siteHeights?.[bomb.site] ?? this.game.world.arenaMap.floorY, bomb.position[1]);
            this.bombMarker.visible = true;
        } else if (this.bombMarker) this.bombMarker.visible = false;
    }

    resetPrediction() {
        this.predicted = null;
        this.pendingFrames = [];
        this.correction = { x: 0, y: 0, z: 0 };
        this.lastSnapshot = -Infinity;
    }

    reconcile(state) {
        const player = this.game.player;
        const reset = !this.predicted || !state.alive ||
            this.localState?.alive !== state.alive || this.localState?.spawn !== state.spawn;
        this.pendingFrames = reset ? [] : this.pendingFrames.filter(frame => frame.seq > state.seq);
        this.predicted = {
            ...state.position, vx: state.velocity.x, vy: state.velocity.y, vz: state.velocity.z,
            onGround: state.onGround, jumpHeld: state.jumpHeld ?? false,
        };
        for (const frame of this.pendingFrames) this.predict(this.predicted, frame.control, frame.dt);
        // Keep the current rendered position while small authoritative corrections fade out.
        const error = Math.hypot(player.position.x - this.predicted.x,
            player.position.y - this.predicted.y, player.position.z - this.predicted.z);
        if (reset || error > 2) {
            this.correction = { x: 0, y: 0, z: 0 };
            this.renderPrediction();
        } else {
            this.correction = {
                x: player.position.x - this.predicted.x,
                y: player.position.y - this.predicted.y,
                z: player.position.z - this.predicted.z,
            };
        }
        this.lastSnapshot = performance.now();
    }

    predictionCollides(x, y, z) {
        const map = this.game.world.arenaMap;
        const edge = map.movement === 'bhop' ? 1 : 0;
        if (x - 0.3 < map.min + 1 || x + 0.3 > map.max - edge ||
            z - 0.3 < map.min + 1 || z + 0.3 > map.max - edge) return true;
        return map.obstacles.some(([a, b, c, d, e, f]) =>
            x + 0.3 > a && x - 0.3 < d && y + 1.8 > b && y < e && z + 0.3 > c && z - 0.3 < f);
    }

    predict(state, control, dt) {
        // Match server speeds, gravity, jump edges and arena collision bounds.
        // Substeps prevent a long rendering frame from tunnelling through cover.
        const count = Math.max(1, Math.ceil(dt / 0.05));
        const step = dt / count;
        const bhop = this.game.world.arenaMap.movement === 'bhop';
        for (let i = 0; i < count; i++) {
            const length = Math.hypot(control.strafe, control.forward);
            const sx = length ? control.strafe / length : 0;
            const fw = length ? control.forward / length : 0;
            const wishX = sx * Math.cos(control.yaw) - fw * Math.sin(control.yaw);
            const wishZ = -sx * Math.sin(control.yaw) - fw * Math.cos(control.yaw);
            if (bhop) {
                if (control.jump && !state.jumpHeld && state.onGround) {
                    state.vy = 8.5;
                    state.onGround = false;
                }
                if (state.onGround) {
                    const speed = Math.hypot(state.vx, state.vz);
                    if (speed) {
                        const slowed = Math.max(0, speed - Math.max(speed, 5) * 7.5 * step);
                        state.vx *= slowed / speed;
                        state.vz *= slowed / speed;
                    }
                }
                const current = state.vx * wishX + state.vz * wishZ;
                const gain = Math.min(7.2 - current, (state.onGround ? 55 : 13) * step * 7.2);
                if (gain > 0) { state.vx += wishX * gain; state.vz += wishZ * gain; }
                const speed = Math.hypot(state.vx, state.vz);
                if (!state.onGround && speed > 13) { state.vx *= 13 / speed; state.vz *= 13 / speed; }
            } else {
                const normalized = Math.max(1, length);
                const speed = control.sprint ? 7.5 : 4.5;
                state.vx = (control.strafe * Math.cos(control.yaw) - control.forward * Math.sin(control.yaw)) / normalized * speed;
                state.vz = (-control.strafe * Math.sin(control.yaw) - control.forward * Math.cos(control.yaw)) / normalized * speed;
            }
            if (control.jump && !state.jumpHeld && state.onGround) {
                state.vy = 8.5;
                state.onGround = false;
            }
            state.jumpHeld = control.jump;
            state.vy = Math.max(-30, state.vy - 22 * step);
            const nx = state.x + state.vx * step, nz = state.z + state.vz * step;
            if (!this.predictionCollides(nx, state.y, state.z)) state.x = nx;
            else if (this.game.world.arenaMap.id === 'de_eblan2' && state.onGround && !this.predictionCollides(nx, state.y + 1, state.z)) { state.x = nx; state.y += 1; }
            else state.vx = 0;
            if (!this.predictionCollides(state.x, state.y, nz)) state.z = nz;
            else if (this.game.world.arenaMap.id === 'de_eblan2' && state.onGround && !this.predictionCollides(state.x, state.y + 1, nz)) { state.z = nz; state.y += 1; }
            else state.vz = 0;
            const ny = state.y + state.vy * step;
            if (ny <= this.game.world.arenaMap.floorY) {
                state.y = this.game.world.arenaMap.floorY;
                state.vy = 0;
                state.onGround = true;
            } else if (!this.predictionCollides(state.x, ny, state.z)) {
                state.y = ny;
                state.onGround = false;
            } else {
                if (state.vy < 0) {
                    const tops = this.game.world.arenaMap.obstacles.filter(box =>
                        box[0] - 0.3 < state.x && state.x < box[3] + 0.3 &&
                        box[2] - 0.3 < state.z && state.z < box[5] + 0.3 && box[4] <= state.y);
                    if (tops.length) state.y = Math.max(...tops.map(box => box[4]));
                    state.onGround = true;
                }
                state.vy = 0;
            }
        }
    }

    renderPrediction() {
        if (!this.predicted) return;
        const player = this.game.player, state = this.predicted, offset = this.correction;
        let x = state.x + offset.x, y = state.y + offset.y, z = state.z + offset.z;
        if (this.predictionCollides(x, y, z)) {
            x = state.x; y = state.y; z = state.z;
            this.correction = { x: 0, y: 0, z: 0 };
        }
        player.position.set(x, y, z);
        player.velocity.set(state.vx, state.vy, state.vz);
        player.onGround = state.onGround;
    }

    updatePlayer(dt, input, jump) {
        const player = this.game.player;
        const frozen = this.mode === 'dust2' && this.match && this.match.phase !== 'live';
        const paused = this.game.ui?.mainMenuOpen || this.game.ui?.menuOpen || this.buyOpen || frozen;
        const controls = this.game.controls;
        if (paused || !((controls?.mouseLeftDown && controls?.isPointerLocked) || controls?.attackBtnPressed || controls?.breakBtnPressed)) this.releaseTrigger();
        this.useHeld = paused ? false : this.useHeld;
        const now = performance.now();
        if (now >= this.hitUntil) {
            const marker = document.getElementById('dust2-hit');
            if (marker) marker.style.display = 'none';
        }
        this.renderKillFeed();
        this.tracers = this.tracers.filter(entry => {
            if (now < entry.until) return true;
            this.game.scene?.remove(entry.line);
            entry.line.geometry.dispose();
            entry.line.material.dispose();
            return false;
        });
        const spectating = this.mode === 'dust2' && !this.localState?.alive;
        const control = {
            strafe: paused || spectating ? 0 : Math.max(-1, Math.min(1, input.x)),
            forward: paused || spectating ? 0 : Math.max(-1, Math.min(1, input.y)),
            jump: !paused && !spectating && !!jump, sprint: !paused && !spectating && !!player.isSprinting,
            yaw: Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)),
        };
        this.sendInput(control.strafe, control.forward, control.jump, control.sprint);
        if (!frozen && this.predicted && this.localState?.alive && performance.now() - this.lastSnapshot < 500) {
            const frame = { seq: this.seq, control, dt: Math.max(0, Math.min(dt, 0.1)) };
            this.predict(this.predicted, control, frame.dt);
            this.pendingFrames.push(frame);
            if (this.pendingFrames.length > 240) this.pendingFrames.shift();
        }
        const decay = Math.exp(-14 * Math.max(0, dt));
        this.correction.x *= decay;
        this.correction.y *= decay;
        this.correction.z *= decay;
        if (!spectating) this.renderPrediction();
        else this.updateSpectator();
        player.attackCooldown = Math.min(1, player.attackCooldown + dt / (this.mode === 'dust2' ? 0.12 : 0.55));
        if (this.localState) {
            player.health = this.localState.health;
            player.isDead = !this.localState.alive;
        }
        if (Math.abs(player.velocity.x) + Math.abs(player.velocity.z) > 0.1) {
            player.walkCycle += dt * (player.isSprinting ? 14 : 9);
        } else player.walkCycle = 0;
        player.updateView(dt);
    }

    attack() {
        const now = performance.now(), player = this.game.player;
        const dust = this.mode === 'dust2';
        const spec = this.weaponSpec();
        const cooldown = dust ? spec.cooldown * 1000 : 550;
        // Arena controls consume the action even when firing is unavailable.
        if (!this.isConnected || player.isDead || this.buyOpen || this.game.ui?.menuOpen || this.game.ui?.mainMenuOpen ||
            (dust && (this.match?.phase !== 'live' || !this.localState?.alive))) return dust;
        if (dust && !spec.automatic && this.triggerHeld) return true;
        if (now - this.lastAttack < cooldown) return dust;
        if (dust && (this.localState.reloading || this.localState.ammo <= 0)) {
            if (!this.localState.reloading && this.localState.reserveAmmo > 0) this.reload();
            return true;
        }
        const controls = this.game.controls;
        this.sendInput(controls?.inputVector.x || 0, controls?.inputVector.y || 0,
            controls?.jumpPressed || false, player.isSprinting, true);
        if (!this.send({ type: 'arena_attack' })) return dust;
        this.lastAttack = now;
        this.triggerHeld = true;
        player.armSwing = dust ? .55 : 1;
        player.attackCooldown = 0;
        if (dust) {
            this.localState.ammo = Math.max(0, this.localState.ammo - 1);
            player.pitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, player.pitch + (spec.recoil || .025)));
            this.game.modManager?.soundSynth?.gunshot(this.localState.heldItem === 'awp' ? .4 : .85, .35);
            this.renderDustHud();
        }
        return true;
    }

    requestRespawn() {
        if (this.mode !== 'dust2') this.send({ type: 'arena_respawn' });
    }

    disconnect() {
        const socket = this.socket;
        this.socket = null;
        this.useHeld = false;
        this.releaseTrigger();
        clearTimeout(this.connectTimeout);
        clearInterval(this.heartbeat);
        this.isConnected = false;
        if (socket) { socket.onclose = null; socket.close(); }
        for (const remote of this.multiplayer.remotePlayers.values()) remote.destroy();
        this.multiplayer.remotePlayers.clear();
        if (this.savedSession) {
            const saved = this.savedSession, player = this.game.player;
            if (player.isScoped) player.toggleScope?.();
            if (this.game.world !== saved.world) this.game.world.clearWorld();
            this.game.world = saved.world;
            player.world = saved.world;
            Object.assign(player, saved.player);
            player.position.copy(saved.position);
            player.velocity.copy(saved.velocity);
            this.game.timeOfDay = saved.timeOfDay;
            for (const [object, visible] of saved.hidden) object.visible = visible;
            this.isActive = false;
            this.savedSession = null;
            this.localState = null;
            player.updateHeldBlock();
            if (this.game.ui) this.game.ui.initHotbar();
            const screen = document.getElementById('death-screen');
            if (screen) screen.style.display = player.isDead ? 'flex' : 'none';
        }
        this.isActive = false;
        this.clientId = null;
        this.match = null;
        this.playerStates = [];
        this.mode = 'legacy';
        this.buyOpen = false;
        this.scoreboardOpen = false;
        this.weaponSpecs = {};
        this.killFeed = [];
        for (const entry of this.tracers) {
            this.game.scene?.remove(entry.line);
            entry.line.geometry.dispose();
            entry.line.material.dispose();
        }
        this.tracers = [];
        for (const marker of this.siteMarkers || []) {
            this.game.scene?.remove(marker);
            marker.material.map?.dispose();
            marker.material.dispose();
        }
        this.siteMarkers = [];
        if (this.bombMarker) {
            this.game.scene?.remove(this.bombMarker);
            this.bombMarker.traverse?.(object => { object.geometry?.dispose(); object.material?.dispose(); });
            this.bombMarker = null;
        }
        const hud = document.getElementById('dust2-hud');
        if (hud) hud.remove();
        this.resetPrediction();
        this.multiplayer.isConnected = false;
        this.multiplayer.peerId = null;
        this.multiplayer.updateConnectedUI(false, null, false);
        this.multiplayer.updatePlayerCount();
    }
}
window.ArenaClient = ArenaClient;

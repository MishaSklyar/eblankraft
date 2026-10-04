/**
 * Eblankraft — shared-world WebSocket client for mainline
 * Connects to port 8082 for server-authoritative PvP, anti-cheat, anti-one-tap, and room sync.
 */

class SharedWorldClient {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.clientId = null;
        this.currentRoom = null;
        this.roomMode = 'survival';
        this.loadingRoom = false;
        this.roomPackets = [];
        this.roomGeneration = 0;
        this.ping = 0;
        this.pingInterval = null;
        this.reconnectTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.lastMoveTime = 0;
        this.moveInterval = 50; // 20 updates per second (50ms)

        this.serverUrl = this.computeServerUrl();

    }

    computeServerUrl() {
        const input = document.getElementById('input-mp-server-url');
        if (input && input.value.trim()) return input.value.trim();
        if (this.game.arenaClient) return this.game.arenaClient.defaultUrl();
        const loc = window.location;
        const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = loc.port === '8081' ? loc.hostname + ':8082' : loc.host;
        return protocol + '//' + host + '/ws';
    }

    createStatusBadge() {
        if (document.getElementById('server-status-badge')) return;

        const badge = document.createElement('div');
        badge.id = 'server-status-badge';
        badge.style.cssText = `
            position: fixed;
            top: 8px;
            right: 180px;
            z-index: 10000;
            background: rgba(16, 24, 32, 0.85);
            border: 1px solid rgba(0, 230, 118, 0.4);
            color: #00e676;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 6px;
            backdrop-filter: blur(4px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            pointer-events: auto;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            user-select: none;
            transition: all 0.25s ease;
        `;
        badge.innerHTML = `
            <span id="server-status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffaa00;box-shadow:0 0 6px #ffaa00;"></span>
            <span id="server-status-text">СЕРВЕР: ПІДКЛЮЧЕННЯ...</span>
        `;
        badge.title = "Натисніть для перепідключення до Авторитетного Сервера (Порт 8082)";
        badge.onclick = () => {
            if (!this.isConnected && !this.isConnecting) {
                this.connect();
            }
        };

        document.body.appendChild(badge);
    }

    updateBadge(status, color, pingText = '') {
        const roomStatus = document.getElementById('coop-room-status');
        if (roomStatus && !pingText) roomStatus.textContent = status;
        const dot = document.getElementById('server-status-dot');
        const text = document.getElementById('server-status-text');
        const badge = document.getElementById('server-status-badge');
        if (!dot || !text || !badge) return;

        dot.style.background = color;
        dot.style.boxShadow = `0 0 8px ${color}`;
        badge.style.borderColor = color;
        text.style.color = color;
        text.textContent = pingText ? `СЕРВЕР 8082 | ${pingText} | ЗАХИСТ ON` : status;
    }

    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.isConnecting = true;
        this.updateBadge("СЕРВЕР: ПІДКЛЮЧЕННЯ...", "#ffaa00");

        try {
            this.socket = new WebSocket(this.serverUrl);

            this.socket.onopen = () => {
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.updateBadge("СЕРВЕР: ОНЛАЙН", "#00e676");
                console.log("[Shared WS] Connected to Authoritative Game Server on port 8082");

                // Start Latency Pinging
                this.startPingLoop();

                // Rejoin the selected room; solo worlds stay outside multiplayer rooms.
                const room = this.currentRoom || ((this.game && this.game.world && this.game.world.worldType === 'pvp_arena') ? 'pvp_arena' : null);
                const nick = (this.game && this.game.multiplayer && this.game.multiplayer.playerName) || 
                             localStorage.getItem('eblankraft_nickname') || 'Боєць';
                const skin = (this.game && this.game.upgrader && this.game.upgrader.equippedSkin) || 'classic';
                if (room) this.joinRoom(room, nick, skin, this.roomMode);
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.socket.onerror = (err) => {
                // Silently handle error, fallback to practice
                this.isConnected = false;
            };

            this.socket.onclose = () => {
                this.isConnected = false;
                this.isConnecting = false;
                this.stopPingLoop();
                this.roomGeneration++;
                this.loadingRoom = false;
                this.roomPackets = [];
                this.clearRemotePlayers();
                this.updateBadge("СЕРВЕР: ОФЛАЙН — перевірте адресу та запуск сервера", "#888888");

                // Attempt reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
                }
            };
        } catch (e) {
            this.isConnected = false;
            this.isConnecting = false;
            this.updateBadge("СЕРВЕР: ПОМИЛКА", "#ff5252");
        }
    }

    startPingLoop() {
        this.stopPingLoop();
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.sendRaw({
                    type: 'ping',
                    client_time: performance.now()
                });
            }
        }, 2500);
    }

    stopPingLoop() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    sendRaw(obj) {
        if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(obj));
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    joinRoom(roomName = 'pvp_arena', playerName = 'Боєць', skin = 'classic', mode = 'survival') {
        this.roomMode = mode;
        this.roomGeneration++;
        this.roomPackets = [];
        this.clearRemotePlayers();
        this.currentRoom = roomName;
        this.sendRaw({
            type: 'join',
            room: roomName,
            name: playerName,
            skin: skin,
            mode: mode
        });
    }

    resolveHeldItem(value) {
        if (value == null) return null;
        const registry = window.ITEM_REGISTRY || {};
        if (registry[value]) return /^\d+$/.test(String(value)) ? Number(value) : value;
        const key = Object.keys(registry).find(id => registry[id].name === value);
        return key === undefined ? null : (/^\d+$/.test(key) ? Number(key) : key);
    }

    clearRemotePlayers() {
        const mp = this.game && this.game.multiplayer;
        if (mp && mp.remotePlayers) {
            for (const id of [...mp.remotePlayers.keys()]) mp.removeRemotePlayer(id);
        }
    }

    leaveRoom() {
        this.sendRaw({ type: 'leave' });
        this.currentRoom = null;
        this.roomGeneration++;
        this.roomPackets = [];
        this.loadingRoom = false;
        this.clearRemotePlayers();
        const status = document.getElementById('coop-room-status');
        if (status) status.textContent = 'Ви вийшли з кімнати. Світ тепер локальний.';
    }

    joinCooperativeRoom(code, mode = 'survival') {
        if (this.loadingRoom) return false;
        code = String(code).trim().toLowerCase();
        if (!/^[a-z0-9_-]{1,24}$/.test(code)) return false;
        try {
            const url = new URL(this.computeServerUrl());
            if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password) return false;
            if (this.socket && this.serverUrl !== url.href) {
                const oldSocket = this.socket;
                oldSocket.onclose = oldSocket.onopen = oldSocket.onmessage = oldSocket.onerror = null;
                oldSocket.close();
                this.socket = null;
                this.isConnected = false;
            }
            this.serverUrl = url.href;
        } catch (error) { return false; }
        if (this.game.arenaClient?.socket) this.game.arenaClient.disconnect();
        const mp = this.game && this.game.multiplayer;
        if (mp && mp.isConnected) mp.disconnect();
        const name = (mp && mp.playerName) || 'Гравець';
        this.joinRoom('coop_' + code, name, 'classic', mode);
        if (!this.isConnected) this.connect();
        return true;
    }

    async enterCooperativeWorld(msg) {
        const generation = this.roomGeneration;
        this.loadingRoom = true;
        try {
            const player = this.game.player;
            if (player._saveInvTimer) clearTimeout(player._saveInvTimer);
            player._saveInvTimer = null;
            player.saveInventory();
            await this.game.ui.launchWorld({ id: 'server:' + msg.room, serverRoom: true,
                name: '🌲 ' + msg.room.slice(5), seed: msg.world.seed,
                mode: msg.world.mode, type: msg.world.type, dim: 'overworld' });
            if (generation !== this.roomGeneration) return;
            this.game.world.id = 'server:' + msg.room;
            player.isCreative = msg.world.mode === 'creative';
            player.godMode = player.isCreative;
            player.isFlying = false;
            player.hardcore = false;
            player.instantBreak = player.isCreative;
            player.infiniteBlocks = player.isCreative;
            player.customReach = player.isCreative ? 9 : 5.2;
            player.updateHeldBlock();
            if (this.game.ui.initHotbar) this.game.ui.initHotbar();
            this.roomMode = msg.world.mode;
            this.loadingRoom = false;
            this.handleMessage(JSON.stringify({ ...msg, world: null }));
            const queued = this.roomPackets;
            this.roomPackets = [];
            for (const raw of queued) this.handleMessage(raw);
            const status = document.getElementById('coop-room-status');
            if (status) status.textContent = 'Кімната: ' + msg.room.slice(5) + ' · ' +
                (msg.world.mode === 'creative' ? 'Творчість' : 'Виживання') + ' · PvP вимкнено';
        } catch (error) {
            console.error('Cooperative world failed:', error);
            if (generation === this.roomGeneration) this.leaveRoom();
        }
    }

    sendMove(x, y, z, yaw, pitch, heldItem, isWalking, isSprinting) {
        if (!this.currentRoom || this.loadingRoom) return;
        const now = performance.now();
        if (now - this.lastMoveTime < this.moveInterval) return;
        this.lastMoveTime = now;

        this.sendRaw({
            type: 'move',
            x: Math.round(x * 1000) / 1000,
            y: Math.round(y * 1000) / 1000,
            z: Math.round(z * 1000) / 1000,
            yaw: Math.round(yaw * 100) / 100,
            pitch: Math.round(pitch * 100) / 100,
            held_item: heldItem || null,
            is_walking: !!isWalking,
            is_sprinting: !!isSprinting
        });
    }

    requestAttack(targetId, isCrit = false) {
        if (this.currentRoom && this.currentRoom.startsWith('coop_')) return false;
        // Authoritative Combat: Client requests attack; server decides hit, reach, damage and i-frames!
        return this.sendRaw({
            type: 'attack',
            target_id: targetId,
            is_crit: !!isCrit
        });
    }

    requestRespawn() {
        this.sendRaw({ type: 'respawn' });
    }

    sendBlockAction(action, x, y, z, blockType) {
        if (!this.currentRoom || this.loadingRoom) return;
        this.sendRaw({
            type: 'block_action',
            action: action,
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z),
            block_type: blockType
        });
    }

    sendInventorySync(inventory, heldItemKey, selectedSlot = 0) {
        if (!this.currentRoom || this.loadingRoom) return;
        this.sendRaw({
            type: 'inventory_sync',
            held_item: heldItemKey || null,
            inventory: inventory || [],
            selected_slot: selectedSlot
        });
    }

    sendItemDrop(itemId, count, x, y, z, vx = 0, vy = 2, vz = 0) {
        this.sendRaw({
            type: 'item_drop',
            itemId: itemId,
            count: count,
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            z: Math.round(z * 100) / 100,
            vx: Math.round(vx * 100) / 100,
            vy: Math.round(vy * 100) / 100,
            vz: Math.round(vz * 100) / 100
        });
    }

    joinDuelQueue(playerName = 'Боєць', kitId = 'classic_sword') {
        this.joinRoom('pvp_arena', playerName);
        this.sendRaw({
            type: 'join_duel_queue',
            name: playerName,
            player_name: playerName,
            kit: kitId
        });
    }

    leaveDuelQueue() {
        this.sendRaw({
            type: 'leave_duel_queue'
        });
    }

    sendChat(text) {
        if (!text) return;
        this.sendRaw({
            type: 'chat',
            text: text
        });
    }

    handleMessage(raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            return;
        }

        if (msg.room && msg.type !== 'duel_matched' && msg.room !== this.currentRoom) return;
        if (msg.type === 'welcome' && msg.world && msg.room.startsWith('coop_')) {
            this.enterCooperativeWorld(msg);
            return;
        }
        if (this.loadingRoom && msg.type !== 'pong') {
            this.roomPackets.push(raw);
            return;
        }
        const mp = this.game ? this.game.multiplayer : null;

        switch (msg.type) {
            case 'pong': {
                const now = performance.now();
                if (msg.client_time) {
                    this.ping = Math.max(1, Math.round(now - msg.client_time));
                    this.updateBadge("СЕРВЕР: ОНЛАЙН", "#00e676", `${this.ping}ms`);
                }
                break;
            }

            case 'welcome': {
                this.clientId = msg.id;
                console.log(`[Shared WS] Joined room '${msg.room}' with Client ID: ${msg.id}`);

                if (this.game && this.game.world && Array.isArray(msg.blocks)) {
                    for (const block of msg.blocks) {
                        this.game.world.setBlock(block.x, block.y, block.z, block.block_type);
                    }
                    this.game.world.updateMeshes();
                }
                if (this.game && this.game.player) this.game.player.syncInventoryWithServer();

                // Synchronize existing players
                if (mp && Array.isArray(msg.players)) {
                    msg.players.forEach(p => {
                        if (!mp.remotePlayers.has(p.id)) {
                            mp.addRemotePlayer(p.id, p.name);
                            const rp = mp.remotePlayers.get(p.id);
                            if (rp) {
                                rp.targetPosition.set(p.x, p.y, p.z);
                                rp.group.position.set(p.x, p.y, p.z);
                                if (p.skin) rp.setSkin(p.skin);
                            }
                        }
                    });
                }
                break;
            }

            case 'player_joined': {
                const p = msg.player;
                if (!p || p.id === this.clientId) break;
                if (mp) {
                    mp.addRemotePlayer(p.id, p.name);
                    const rp = mp.remotePlayers.get(p.id);
                    if (rp) {
                        rp.targetPosition.set(p.x, p.y, p.z);
                        rp.group.position.set(p.x, p.y, p.z);
                        if (p.skin) rp.setSkin(p.skin);
                    }
                    if (mp.showToast) mp.showToast(`👋 Гравець [${p.name}] приєднався до сервера!`);
                }
                break;
            }

            case 'player_moved': {
                if (msg.id === this.clientId) break;
                if (mp) {
                    const rp = mp.remotePlayers.get(msg.id);
                    if (rp) {
                        rp.targetPosition.set(msg.x, msg.y, msg.z);
                        rp.targetYaw = msg.yaw;
                        rp.targetPitch = msg.pitch;
                        rp.isWalking = msg.is_walking;
                        rp.isSprinting = msg.is_sprinting;
                        if (msg.held_item !== undefined) {
                            rp.updateHeldItem(this.resolveHeldItem(msg.held_item));
                        }
                    }
                }
                break;
            }

            case 'damage_event': {
                // Authoritative damage event confirmed by server!
                const isLocalTarget = (msg.target_id === this.clientId);
                const isLocalAttacker = (msg.attacker_id === this.clientId);

                if (isLocalTarget) {
                    // Local player took verified damage
                    if (this.game && this.game.player) {
                        this.game.player.takeDamage(msg.damage, `⚔️ Вас убив ${msg.attacker_name || 'Гравець'}!`);
                        if (msg.health_remaining !== undefined) {
                            this.game.player.health = msg.health_remaining;
                        }
                        if (msg.knockback) {
                            this.game.player.velocity.x += msg.knockback.x;
                            this.game.player.velocity.y += msg.knockback.y;
                            this.game.player.velocity.z += msg.knockback.z;
                        }
                    }

                    if (this.game && this.game.ui && this.game.ui.spawnFloatingDamage) {
                        this.game.ui.spawnFloatingDamage(
                            this.game.player.position.x,
                            this.game.player.position.y + 1.2,
                            this.game.player.position.z,
                            msg.damage,
                            msg.is_crit,
                            false
                        );
                    }
                } else if (mp) {
                    // Remote player took verified damage
                    const rp = mp.remotePlayers.get(msg.target_id);
                    if (rp) {
                        rp.takeDamage(msg.damage, msg.attacker_name, msg.is_crit, false, msg.knockback);
                        if (this.game && this.game.ui && this.game.ui.spawnFloatingDamage) {
                            this.game.ui.spawnFloatingDamage(
                                rp.group.position.x,
                                rp.group.position.y + 1.2,
                                rp.group.position.z,
                                msg.damage,
                                msg.is_crit,
                                false
                            );
                        }
                    }
                }

                if (isLocalAttacker && mp && mp.showToast) {
                    const badge = msg.is_crit ? " ⚡ КРИТ!" : "";
                    mp.showToast(`⚔️ Сервер підтвердив удар: -${Math.round(msg.damage)} HP${badge}`);
                }

                if (this.game && this.game.ui && this.game.ui.updateDuelHealth) {
                    this.game.ui.updateDuelHealth(msg.target_id, msg.health_remaining);
                }
                break;
            }

            case 'death_event': {
                if (msg.victim_id === this.clientId) {
                    if (this.game && this.game.player) {
                        this.game.player.die(msg.message || "⚔️ Вас було ліквідовано!");
                    }
                }
                if (mp && mp.showToast) {
                    mp.showToast(msg.message || `⚔️ ${msg.killer_name} знищив ${msg.victim_name}!`);
                }
                break;
            }

            case 'player_respawned': {
                if (msg.id === this.clientId) {
                    if (this.game && this.game.player) {
                        this.game.player.health = 100;
                        this.game.player.isDead = false;
                        this.game.player.position.set(msg.x || 0, msg.y || 32, msg.z || 0);
                    }
                } else if (mp) {
                    const rp = mp.remotePlayers.get(msg.id);
                    if (rp) {
                        rp.health = 100;
                        rp.group.position.set(msg.x || 0, msg.y || 32, msg.z || 0);
                        rp.targetPosition.set(msg.x || 0, msg.y || 32, msg.z || 0);
                    }
                }
                break;
            }

            case 'player_left': {
                if (mp) {
                    mp.removeRemotePlayer(msg.id);
                    if (mp.showToast) mp.showToast(`👋 Гравець [${msg.name}] покинув арену.`);
                }
                break;
            }

            case 'block_update': {
                if (this.game && this.game.world) {
                    if (msg.action === 'place') {
                        this.game.world.setBlock(msg.x, msg.y, msg.z, msg.block_type);
                    } else if (msg.action === 'break') {
                        this.game.world.setBlock(msg.x, msg.y, msg.z, 0);
                    }
                    this.game.world.updateMeshes();
                }
                break;
            }

            case 'chat': {
                if (mp && mp.addChatMessage) {
                    mp.addChatMessage(msg.sender, msg.text);
                }
                break;
            }

            case 'inventory_state': {
                // Acknowledgement only: local edits may be newer than this snapshot.
                this.inventorySnapshot = msg.inventory;
                break;
            }

            case 'inventory_sync': {
                if (msg.id === this.clientId) break;
                if (mp) {
                    const rp = mp.remotePlayers.get(msg.id);
                    if (rp) {
                        rp.updateHeldItem(this.resolveHeldItem(msg.held_item));
                    }
                }
                break;
            }

            case 'item_drop': {
                if (this.game && this.game.mobManager) {
                    const throwVel = new THREE.Vector3(msg.vx || 0, msg.vy || 2, msg.vz || 0);
                    this.game.mobManager.spawnItemDrop(msg.x, msg.y, msg.z, msg.itemId, msg.count, 0.8, throwVel);
                }
                break;
            }

            case 'tnt_spawned': {
                if (this.game && this.game.scene) {
                    const tnt = new TNTEntity(
                        msg.x, msg.y, msg.z,
                        this.game.scene,
                        this.game.textureManager,
                        this.game.soundManager,
                        this.game.world,
                        this.game.particleSystem,
                        this.game,
                        {
                            isRemote: true,
                            fuse: msg.fuse || 2.2,
                            vx: msg.vx || 0,
                            vy: msg.vy || 3.0,
                            vz: msg.vz || 0
                        }
                    );
                    tnt.vx = msg.vx || 0;
                    tnt.vy = msg.vy || 3.0;
                    tnt.vz = msg.vz || 0;
                }
                break;
            }

            case 'tnt_exploded': {
                if (this.game) {
                    if (this.game.soundManager && this.game.soundManager.playExplosion) {
                        this.game.soundManager.playExplosion();
                    }
                    if (this.game.particleSystem && this.game.particleSystem.spawnExplosionParticles) {
                        this.game.particleSystem.spawnExplosionParticles(msg.x, msg.y + 0.5, msg.z, 28);
                    }
                    if (this.game.triggerCameraShake) {
                        this.game.triggerCameraShake(0.55, 12);
                    }
                    if (this.game.world) {
                        const radius = msg.radius || 3.8;
                        const rInt = Math.ceil(radius);
                        const cx = Math.floor(msg.x);
                        const cy = Math.floor(msg.y + 0.5);
                        const cz = Math.floor(msg.z);
                        for (let ox = -rInt; ox <= rInt; ox++) {
                            for (let oy = -rInt; oy <= rInt; oy++) {
                                for (let oz = -rInt; oz <= rInt; oz++) {
                                    if (ox * ox + oy * oy + oz * oz <= radius * radius) {
                                        const b = this.game.world.getBlock(cx + ox, cy + oy, cz + oz);
                                        if (b !== 0 && b !== 18) { // AIR / BEDROCK
                                            this.game.world.setBlock(cx + ox, cy + oy, cz + oz, 0);
                                        }
                                    }
                                }
                            }
                        }
                        this.game.world.updateMeshes();
                    }
                }
                break;
            }

            case 'duel_matched': {
                if (msg.room) {
                    this.currentRoom = msg.room;
                }
                if (this.game && this.game.ui) {
                    this.game.ui.startDuelMatch(msg);
                }
                break;
            }

            case 'duel_countdown': {
                if (this.game && this.game.ui) {
                    this.game.ui.showDuelCountdown(msg.seconds);
                }
                break;
            }

            case 'duel_round_end': {
                if (this.game && this.game.ui) {
                    this.game.ui.showDuelResult(msg);
                }
                break;
            }
        }
    }
}

// Global expose
window.SharedWorldClient = SharedWorldClient;

window.SharedWorldClient = SharedWorldClient;

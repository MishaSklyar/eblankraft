/**
 * Eblankraft 2.0 - Multiplayer Engine via PeerJS (WebRTC P2P)
 * Features:
 *  - Full P2P Serverless Star-Topology (Host/Client)
 *  - 3D Humanoid Remote Player Models with Animated Limbs, Skin Colors, Held Item & 3D Billboarding Nameplates
 *  - Smooth Linear Interpolation (LERP) for Latency Compensation
 *  - World Synchronization (Identical World Seed + Dynamic Block Placement & Mining Replication)
 *  - Real-Time PvP Combat & Knockback
 *  - In-Game Chat System with Commands (/help, /tp, /clear, /time)
 *  - Shareable Invite Link & 1-Click Room Code Copy
 */

// --- 3D REMOTE PLAYER MODEL ---
class RemotePlayer {
    constructor(peerId, name, scene, textureManager, soundManager, particleSystem) {
        this.peerId = peerId;
        this.name = name || 'Гравець';
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.particleSystem = particleSystem;

        this.health = 100;
        this.maxHealth = 100;
        this.heldItem = null;
        this.skin = 'classic';
        this.customSkin = null;

        this.targetPosition = new THREE.Vector3(0, 30, 0);
        this.targetYaw = 0;
        this.targetPitch = 0;
        this.currentYaw = 0;
        this.isWalking = false;
        this.isSprinting = false;
        this.armSwingTimer = 0;
        this.walkTimer = 0;
        this.damageFlashTimer = 0;

        this.createMesh();
    }

    createMesh() {
        const skinTex = window.skinManager ? window.skinManager.getSkinTexture(this.skin, this.customSkin) : null;
        this.mcModel = createMinecraftPlayerHierarchy(skinTex);
        this.group = this.mcModel.root;
        this.group.position.copy(this.targetPosition);

        // Keep references for backwards compatibility and easy access
        this.head = this.mcModel.headMesh;
        this.torso = this.mcModel.torsoMesh;
        this.leftArm = this.mcModel.leftArmMesh;
        this.rightArm = this.mcModel.rightArmMesh;
        this.leftLeg = this.mcModel.leftLegMesh;
        this.rightLeg = this.mcModel.rightLegMesh;
        this.leftArmPivot = this.mcModel.leftArmPivot;
        this.rightArmPivot = this.mcModel.rightArmPivot;
        this.leftLegPivot = this.mcModel.leftLegPivot;
        this.rightLegPivot = this.mcModel.rightLegPivot;
        this.itemContainer = this.mcModel.itemContainer;

        // 3D Billboard Nameplate
        this.createNameplate();

        if (this.mcModel && this.mcModel.setArmor) {
            this.mcModel.setArmor(this.armorType || 'diamond');
        }

        this.scene.add(this.group);
    }

    setArmor(armorType = 'diamond') {
        this.armorType = armorType;
        if (this.mcModel && this.mcModel.setArmor) {
            this.mcModel.setArmor(armorType);
        }
    }

    setSkin(skinId, customSkinDataUrl = null) {
        this.skin = skinId || 'classic';
        if (customSkinDataUrl) {
            this.customSkin = customSkinDataUrl;
        }
        if (this.mcModel && window.skinManager) {
            const tex = window.skinManager.getSkinTexture(this.skin, this.customSkin);
            this.mcModel.setSkinTexture(tex);
        }
    }

    setHeldItem(itemKey) {
        this.heldItem = itemKey || null;
        if (!this.itemContainer) return;

        // Clear existing held item meshes
        while (this.itemContainer.children.length > 0) {
            const child = this.itemContainer.children[0];
            this.itemContainer.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        if (!itemKey) return;

        // Resolve item from registry
        let reg = null;
        if (window.ITEM_REGISTRY) {
            if (typeof itemKey === 'string') {
                reg = Object.values(window.ITEM_REGISTRY).find(r => r.name === itemKey || r.icon === itemKey);
            } else if (typeof itemKey === 'number') {
                reg = window.ITEM_REGISTRY[itemKey];
            }
        }

        if (reg && reg.category === 'block' && this.textureManager) {
            const geom = new THREE.BoxGeometry(0.32, 0.32, 0.32);
            const mat = this.textureManager.getBlockMaterial(reg.blockType || 1);
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(0, -0.05, 0.05);
            this.itemContainer.add(mesh);
        } else {
            const iconName = reg ? reg.icon : (typeof itemKey === 'string' ? itemKey : 'stone');
            const tex = this.textureManager ? this.textureManager.getTexture(iconName) : null;
            if (tex) {
                const geom = new THREE.PlaneGeometry(0.42, 0.42);
                const mat = new THREE.MeshBasicMaterial({
                    map: tex,
                    transparent: true,
                    alphaTest: 0.1,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.rotation.set(-0.35, 0.75, -0.42);
                mesh.position.set(0, -0.02, 0.08);
                this.itemContainer.add(mesh);
            }
        }
    }

    createFaceCanvas() {
        const cvs = document.createElement('canvas');
        cvs.width = 64;
        cvs.height = 64;
        const ctx = cvs.getContext('2d');

        // Skin base
        ctx.fillStyle = '#e0a97b';
        ctx.fillRect(0, 0, 64, 64);

        // Hair
        ctx.fillStyle = '#4a2e18';
        ctx.fillRect(0, 0, 64, 18);
        ctx.fillRect(0, 18, 12, 16);
        ctx.fillRect(52, 18, 12, 16);

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(14, 28, 12, 8);
        ctx.fillRect(38, 28, 12, 8);

        ctx.fillStyle = '#2255aa';
        ctx.fillRect(18, 30, 6, 6);
        ctx.fillRect(40, 30, 6, 6);

        // Smile
        ctx.fillStyle = '#7a3e20';
        ctx.fillRect(24, 46, 16, 6);

        return cvs;
    }

    createNameplate() {
        this.nameCanvas = document.createElement('canvas');
        this.nameCanvas.width = 256;
        this.nameCanvas.height = 64;
        this.nameTexture = new THREE.CanvasTexture(this.nameCanvas);
        this.nameTexture.magFilter = THREE.LinearFilter;

        const mat = new THREE.SpriteMaterial({ map: this.nameTexture, transparent: true, depthTest: false });
        this.nameplate = new THREE.Sprite(mat);
        this.nameplate.scale.set(1.8, 0.45, 1);
        this.nameplate.position.y = 2.15;
        this.group.add(this.nameplate);

        this.updateNameplate();
    }

    updateNameplate() {
        if (!this.nameCanvas) return;
        const ctx = this.nameCanvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 64);

        // Semi-transparent dark pill background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.roundRect(10, 8, 236, 48, 14);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Player Name
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 22px monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, 128, 24);

        // Health Bar / Text
        ctx.fillStyle = this.health > 50 ? '#4caf50' : (this.health > 20 ? '#ff9800' : '#f44336');
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`❤️ ${Math.max(0, Math.round(this.health))}%`, 128, 44);

        this.nameTexture.needsUpdate = true;
    }

    updateHeldItem(itemId) {
        if (this.heldItem === itemId) return;
        this.heldItem = itemId;

        // Clear existing held mesh
        while (this.itemContainer.children.length > 0) {
            const child = this.itemContainer.children[0];
            this.itemContainer.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        if (!itemId) return;

        const info = (window.ITEM_REGISTRY && window.ITEM_REGISTRY[itemId]) ? window.ITEM_REGISTRY[itemId] : null;
        if (!info) return;

        if (info.category === 'blocks') {
            // Block 3D mini cube
            const texCanvas = this.textureManager ? this.textureManager.getTextureCanvas(info.icon || 'stone') : null;
            let mat;
            if (texCanvas) {
                const tex = new THREE.CanvasTexture(texCanvas);
                tex.magFilter = THREE.NearestFilter;
                mat = new THREE.MeshLambertMaterial({ map: tex });
            } else {
                mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
            }
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), mat);
            this.itemContainer.add(mesh);
        } else {
            // Tool / Weapon
            let color = 0x888888;
            if (itemId.includes('diamond')) color = 0x4df2ff;
            else if (itemId.includes('netherite')) color = 0x3d3539;
            else if (itemId.includes('gold')) color = 0xffd700;
            else if (itemId.includes('iron')) color = 0xdcdcdc;
            else if (itemId.includes('eblan')) color = 0xff00ff;

            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.42, 0.08),
                new THREE.MeshLambertMaterial({ color })
            );
            mesh.rotation.x = Math.PI / 4;
            this.itemContainer.add(mesh);
        }
    }

    setTargetState(state) {
        if (!state) return;
        if (state.name && state.name !== this.name) {
            this.name = state.name;
            this.updateNameplate();
        }

        if (state.position) {
            this.targetPosition.set(state.position.x, state.position.y, state.position.z);
        }
        if (state.yaw !== undefined) this.targetYaw = state.yaw;
        if (state.pitch !== undefined) this.targetPitch = state.pitch;

        this.isWalking = !!state.isWalking;
        this.isSprinting = !!state.isSprinting;

        if (state.armSwing > 0.5 && this.armSwingTimer <= 0) {
            this.armSwingTimer = 1.0;
        }

        if (state.health !== undefined && state.health !== this.health) {
            this.health = state.health;
            this.updateNameplate();
        }

        if (state.heldItem !== undefined) {
            this.updateHeldItem(state.heldItem);
        }

        if (state.skin && (state.skin !== this.skin || (state.customSkin && state.customSkin !== this.customSkin))) {
            this.setSkin(state.skin, state.customSkin);
        }
    }

    takeDamage(amount, attackerName, isCrit = false, isSweep = false, knockback = null) {
        this.health = Math.max(0, this.health - amount);
        this.updateNameplate();

        if (this.soundManager) {
            if (isCrit) this.soundManager.playCritHit();
            else this.soundManager.playHurt();
        }

        // Crit or Blood particles
        if (this.particleSystem) {
            if (isCrit) {
                this.particleSystem.spawnCritParticles(
                    this.group.position.x,
                    this.group.position.y + 1.2,
                    this.group.position.z,
                    22
                );
            } else {
                this.particleSystem.spawnBlockBreakParticles(
                    this.group.position.x,
                    this.group.position.y + 1.0,
                    this.group.position.z,
                    window.BLOCK_TYPES ? window.BLOCK_TYPES.REDSTONE_BLOCK : 13,
                    14
                );
            }
        }

        // Floating Damage Number
        if (this.game && this.game.ui && this.game.ui.spawnFloatingDamage) {
            this.game.ui.spawnFloatingDamage(
                this.group.position.x,
                this.group.position.y + 1.4,
                this.group.position.z,
                amount,
                isCrit,
                isSweep
            );
        }

        // Apply visual knockback drift
        if (knockback && this.group) {
            this.group.position.x += (knockback.x || 0) * 0.45;
            this.group.position.z += (knockback.z || 0) * 0.45;
        }

        // Flash red
        this.damageFlashTimer = 0.22;
        this.setRedTint(true);
    }

    setRedTint(enabled) {
        if (this.mcModel && this.mcModel.skinMat) {
            this.mcModel.skinMat.color.setHex(enabled ? 0xff4444 : 0xffffff);
        }
    }

    update(dt) {
        // Interpolate position smoothly towards target
        this.group.position.lerp(this.targetPosition, Math.min(1.0, dt * 14));

        // Smooth Yaw rotation
        let dyaw = this.targetYaw - this.currentYaw;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        this.currentYaw += dyaw * Math.min(1.0, dt * 12);
        this.group.rotation.y = this.currentYaw;

        // Head pitch on neck pivot
        if (this.mcModel && this.mcModel.headPivot) {
            this.mcModel.headPivot.rotation.x = this.targetPitch;
        } else if (this.head) {
            this.head.rotation.x = this.targetPitch;
        }

        // Walking limb animation
        if (this.isWalking) {
            this.walkTimer += dt * (this.isSprinting ? 14 : 9);
            const swing = Math.sin(this.walkTimer) * 0.65;
            this.leftLegPivot.rotation.x = swing;
            this.rightLegPivot.rotation.x = -swing;
            this.leftArmPivot.rotation.x = -swing * 0.7;
            if (this.armSwingTimer <= 0) {
                this.rightArmPivot.rotation.x = swing * 0.7;
            }
        } else {
            this.leftLegPivot.rotation.x *= 0.8;
            this.rightLegPivot.rotation.x *= 0.8;
            this.leftArmPivot.rotation.x *= 0.8;
            if (this.armSwingTimer <= 0) {
                this.rightArmPivot.rotation.x *= 0.8;
            }
        }

        // Arm swing punch
        if (this.armSwingTimer > 0) {
            this.armSwingTimer -= dt * 4.5;
            this.rightArmPivot.rotation.x = -Math.sin(this.armSwingTimer * Math.PI) * 1.4;
        }

        // Damage flash
        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer -= dt;
            if (this.damageFlashTimer <= 0) {
                this.setRedTint(false);
            }
        }
    }

    setPropDisguise(disguise) {
        this.clearPropDisguise();
        if (!disguise) return;

        let propObj = null;
        const scale = disguise.scale || 1.0;

        if (disguise.blockId !== undefined) {
            const geo = new THREE.BoxGeometry(scale, scale, scale);
            const mat = this.textureManager ? this.textureManager.getMaterial(disguise.blockId) : new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
            propObj = new THREE.Mesh(geo, mat);
            propObj.position.y = 0.5 * scale;
            propObj.castShadow = true;
            propObj.receiveShadow = true;
        } else if (disguise.modelId && window.modManager && window.modManager.modelManager && window.modManager.modelManager.cachedModels.has(disguise.modelId)) {
            const gltf = window.modManager.modelManager.cachedModels.get(disguise.modelId);
            propObj = gltf.scene.clone(true);
            propObj.scale.set(scale, scale, scale);
        }

        if (propObj) {
            this.propMesh = propObj;
            this.group.add(this.propMesh);
            if (this.mcModel && this.mcModel.modelGroup) this.mcModel.modelGroup.visible = false;
            if (this.nameplate) this.nameplate.visible = false;
        }
    }

    clearPropDisguise() {
        if (this.propMesh) {
            this.group.remove(this.propMesh);
            if (this.propMesh.geometry) this.propMesh.geometry.dispose();
            this.propMesh = null;
        }
        if (this.mcModel && this.mcModel.modelGroup) this.mcModel.modelGroup.visible = true;
        if (this.nameplate) this.nameplate.visible = true;
    }

    destroy() {
        this.clearPropDisguise();
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        }
    }
}

// --- MULTIPLAYER MANAGER (PEERJS) ---
class MultiplayerManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.peerId = null;
        this.isHost = false;
        this.isConnected = false;
        this.isConnecting = false;

        this.hostConnection = null; // Client -> Host connection
        this.connections = new Map(); // Host -> Clients map: peerId -> DataConnection
        this.remotePlayers = new Map(); // peerId -> RemotePlayer

        // Player Profile
        this.playerName = localStorage.getItem('eblankraft_nickname') || ('Гравець_' + Math.floor(Math.random() * 900 + 100));

        // Network tick timer (20 updates/sec)
        this.sendTimer = 0;
        this.sendInterval = 0.05;

        this.initUI();
        this.initChat();
        this.checkURLParams();
    }

    initUI() {
        const btnOpen = document.getElementById('btn-open-multiplayer');
        if (btnOpen) {
            btnOpen.onclick = () => this.toggleModal(true);
        }

        const modalClose = document.getElementById('mp-modal-close');
        if (modalClose) {
            modalClose.onclick = () => this.toggleModal(false);
        }

        const btnPlayNow = document.getElementById('btn-mp-play-now');
        if (btnPlayNow) {
            btnPlayNow.onclick = () => {
                this.toggleModal(false);
                if (this.game && this.game.ui && this.game.ui.mainMenuOpen) {
                    this.game.ui.closeMainMenu();
                }
            };
        }

        const coopJoin = document.getElementById('btn-coop-join');
        if (coopJoin) coopJoin.onclick = () => {
            const code = document.getElementById('input-coop-room').value;
            const mode = document.getElementById('input-coop-mode').value;
            const sc = this.game && this.game.serverClient;
            if (!sc || !sc.isConnected) {
                this.showToast('Сервер ще не підключено. Запустіть сервер та спробуйте знову.');
                return;
            }
            if (!sc.joinCooperativeRoom(code, mode)) {
                this.showToast(sc.loadingRoom ? 'Зачекайте завантаження світу.' : 'Код: 1–24 латинські літери, цифри, - або _.');
                return;
            }
            document.getElementById('coop-room-status').textContent = 'Підключення до кімнати…';
            this.toggleModal(false);
        };
        const coopLeave = document.getElementById('btn-coop-leave');
        if (coopLeave) coopLeave.onclick = () => {
            const sc = this.game && this.game.serverClient;
            if (sc && sc.currentRoom && sc.currentRoom.startsWith('coop_')) sc.leaveRoom();
        };

        // Tab switching (Host / Join)
        const tabs = document.querySelectorAll('.mp-tab-btn');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.dataset.tab;
                const panelHost = document.getElementById('mp-panel-host');
                const panelJoin = document.getElementById('mp-panel-join');
                if (panelHost) panelHost.style.display = target === 'host' ? 'block' : 'none';
                if (panelJoin) panelJoin.style.display = target === 'join' ? 'block' : 'none';
            };
        });

        // Host Button
        const btnCreateHost = document.getElementById('btn-mp-create-host');
        if (btnCreateHost) {
            btnCreateHost.onclick = () => this.startHost();
        }

        // Join Button
        const btnJoinRoom = document.getElementById('btn-mp-join');
        if (btnJoinRoom) {
            btnJoinRoom.onclick = () => {
                const input = document.getElementById('input-mp-room-id');
                const code = input ? input.value.trim() : '';
                if (!code) {
                    this.showToast('⚠️ Введіть код кімнати!');
                    return;
                }
                this.joinRoom(code);
            };
        }

        // Copy Room Code Button
        const btnCopyCode = document.getElementById('btn-mp-copy-code');
        if (btnCopyCode) {
            btnCopyCode.onclick = () => {
                if (this.peerId) {
                    navigator.clipboard.writeText(this.peerId).then(() => {
                        this.showToast('📋 Код кімнати скопійовано!');
                    }).catch(() => {
                        this.showToast(`Код: ${this.peerId}`);
                    });
                }
            };
        }

        // Copy Link Button
        const btnCopyLink = document.getElementById('btn-mp-copy-link');
        if (btnCopyLink) {
            btnCopyLink.onclick = () => {
                if (this.peerId) {
                    const url = `${window.location.origin}${window.location.pathname}?room=${this.peerId}`;
                    navigator.clipboard.writeText(url).then(() => {
                        this.showToast('🔗 Посилання скопійовано! Надішліть другу');
                    }).catch(() => {
                        this.showToast(`Посилання: ${url}`);
                    });
                }
            };
        }

        // Disconnect Button
        const btnDisconnect = document.getElementById('btn-mp-disconnect');
        if (btnDisconnect) {
            btnDisconnect.onclick = () => this.disconnect();
        }

        // Nickname Input
        const nameInput = document.getElementById('input-mp-nickname');
        if (nameInput) {
            nameInput.value = this.playerName;
            nameInput.onchange = (e) => {
                const val = e.target.value.trim();
                if (val) {
                    this.playerName = val.slice(0, 16);
                    localStorage.setItem('eblankraft_nickname', this.playerName);
                    this.showToast(`👤 Ваш нікнейм: ${this.playerName}`);
                }
            };
        }
    }

    initChat() {
        const chatInput = document.getElementById('chat-input');
        const btnChatToggle = document.getElementById('btn-chat-toggle');

        if (btnChatToggle) {
            btnChatToggle.onclick = () => this.toggleChatInput();
        }

        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const text = chatInput.value.trim();
                    if (text) {
                        this.sendChatMessage(text);
                        chatInput.value = '';
                    }
                    this.toggleChatInput(false);
                } else if (e.key === 'Escape') {
                    this.toggleChatInput(false);
                }
            });
        }

        // Press 'T' or 'Enter' on desktop to open chat
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || (e.key === 't' && document.activeElement !== chatInput)) {
                if (this.game && this.game.ui && (this.game.ui.inventoryOpen || this.game.ui.menuOpen || this.game.ui.dragModeOpen)) return;
                e.preventDefault();
                this.toggleChatInput(true);
            }
        });
    }

    toggleChatInput(forceState = null) {
        const chatInput = document.getElementById('chat-input');
        const chatInputRow = document.getElementById('chat-input-row');
        if (!chatInputRow || !chatInput) return;

        const isVisible = forceState !== null ? forceState : (chatInputRow.style.display !== 'flex');
        chatInputRow.style.display = isVisible ? 'flex' : 'none';

        if (isVisible) {
            chatInput.focus();
            if (document.pointerLockElement) document.exitPointerLock();
        } else {
            chatInput.blur();
        }
    }

    addChatMessage(sender, text, isSystem = false) {
        const messagesList = document.getElementById('chat-messages');
        if (!messagesList) return;

        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg' + (isSystem ? ' system-msg' : '');

        if (isSystem) {
            msgEl.innerHTML = `<span class="chat-system-prefix">⚙️</span> <span class="chat-text">${this.escapeHtml(text)}</span>`;
        } else {
            msgEl.innerHTML = `<b class="chat-sender">&lt;${this.escapeHtml(sender)}&gt;</b> <span class="chat-text">${this.escapeHtml(text)}</span>`;
        }

        messagesList.appendChild(msgEl);
        messagesList.scrollTop = messagesList.scrollHeight;

        // Auto-remove old messages from visual list after 12 seconds
        setTimeout(() => {
            msgEl.classList.add('fading');
            setTimeout(() => {
                if (msgEl.parentElement) msgEl.parentElement.removeChild(msgEl);
            }, 1000);
        }, 11000);
    }

    escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m]));
    }

    checkURLParams() {
        try {
            const params = new URLSearchParams(window.location.search);
            const room = params.get('room') || params.get('join');
            if (room) {
                setTimeout(() => {
                    const input = document.getElementById('input-mp-room-id');
                    if (input) input.value = room;
                    this.toggleModal(true);
                    this.showToast(`🔗 Знайдено кімнату: ${room}`);
                }, 1000);
            }
        } catch(e) {}
    }

    toggleModal(forceState = null) {
        const modal = document.getElementById('multiplayer-modal');
        if (!modal) return;
        const isOpen = forceState !== null ? forceState : (modal.style.display !== 'flex');
        modal.style.display = isOpen ? 'flex' : 'none';
        if (isOpen && this.game && this.game.soundManager) {
            this.game.soundManager.playClick();
        }
    }

    // --- HOST INITIALIZATION ---
    startHost(preferredId = null) {
        if (this.game.serverClient) this.game.serverClient.leaveRoom();
        if (this.peer) this.disconnect();

        const statusEl = document.getElementById('mp-status-text');
        if (statusEl) statusEl.textContent = '🟡 Створення сервера...';

        // Friendly room code generator: e.g. eblan-7492
        const randomCode = preferredId || ('eblan-' + Math.floor(1000 + Math.random() * 9000));

        this.peer = new Peer(randomCode, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            this.peerId = id;
            this.isHost = true;
            this.isConnected = true;

            this.updateConnectedUI(true, id, true);
            this.addChatMessage('СИСТЕМА', `👑 Сервер створено! Код кімнати: ${id}`, true);
            this.showToast(`🟢 Сервер запущено! Код: ${id}`);
        });

        this.peer.on('connection', (conn) => {
            this.setupHostClientConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            if (statusEl) statusEl.textContent = `❌ Помилка: ${err.type}`;
            this.showToast(`❌ Помилка PeerJS: ${err.message || err.type}`);
        });

        this.peer.on('close', () => {
            this.disconnect();
        });
    }

    setupHostClientConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);

            // Handshake: Send initial world state, seed, dimension, time and existing block modifications!
            conn.send({
                type: 'world_init',
                seed: this.game.world.seed,
                worldType: this.game.world.worldType,
                dimension: this.game.world.dimension,
                time: this.game.dayTime || 0,
                modifiedBlocks: this.game.world.getModifiedBlocksArray(),
                hostName: this.playerName,
                mods: (window.modManager ? window.modManager.getSyncableMods() : [])
            });

            this.updatePlayerCount();
        });

        conn.on('data', (data) => {
            this.handlePacket(data, conn.peer);
        });

        conn.on('close', () => {
            this.removeRemotePlayer(conn.peer);
            this.connections.delete(conn.peer);
            this.updatePlayerCount();
            this.broadcast({ type: 'player_leave', peerId: conn.peer });
        });

        conn.on('error', (err) => {
            console.warn('Connection error with peer:', conn.peer, err);
        });
    }

    // --- CLIENT JOIN INITIALIZATION ---
    joinRoom(hostPeerId) {
        if (this.game.serverClient) this.game.serverClient.leaveRoom();
        if (this.peer) this.disconnect();

        const statusEl = document.getElementById('mp-status-text');
        if (statusEl) statusEl.textContent = '🟡 Підключення до хоста...';

        this.peer = new Peer(undefined, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        this.peer.on('open', (myId) => {
            this.peerId = myId;
            this.isHost = false;

            const conn = this.peer.connect(hostPeerId, { reliable: true });
            this.hostConnection = conn;

            conn.on('open', () => {
                this.isConnected = true;
                this.updateConnectedUI(true, hostPeerId, false);
                this.addChatMessage('СИСТЕМА', `🟢 Успішно підключено до кімнати: ${hostPeerId}!`, true);
                this.showToast('🟢 Підключено до мультиплеєру!');
            });

            conn.on('data', (data) => {
                this.handlePacket(data, hostPeerId);
            });

            conn.on('close', () => {
                this.addChatMessage('СИСТЕМА', '❌ З\'єднання з хостом розірвано', true);
                this.disconnect();
            });

            conn.on('error', (err) => {
                console.error('Host connection error:', err);
                this.showToast(`❌ Помилка підключення: ${err.message || 'Не вдалося з\'єднатися'}`);
            });
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Join Error:', err);
            if (statusEl) statusEl.textContent = `❌ Помилка: ${err.type}`;
            this.showToast(`❌ Помилка: ${err.message || err.type}`);
        });
    }

    // --- PACKET DISPATCH & HANDLING ---
    handlePacket(data, senderPeerId) {
        if (!data || !data.type) return;

        // Mod Interceptor: filter incoming packets
        if (window.modManager && typeof window.modManager.filterIncomingPacket === 'function') {
            const filtered = window.modManager.filterIncomingPacket(data, senderPeerId);
            if (filtered === false) return; // Dropped / cancelled!
            if (filtered && typeof filtered === 'object') data = filtered;
        }

        // Host relays directed packet if target is another peer
        if (this.isHost && data._directedTo) {
            const target = data._directedTo;
            delete data._directedTo;
            if (target !== this.peerId) {
                this.sendToPeer(target, data);
                return;
            }
        }

        switch (data.type) {
            case 'world_init': {
                // Client synchronizes world with Host
                if (data.seed !== undefined && this.game.world) {
                    this.game.world.reseedWorld(data.seed, data.worldType || 'normal', data.dimension || 'overworld');
                    if (data.modifiedBlocks) {
                        this.game.world.applyModifiedBlocks(data.modifiedBlocks);
                    }
                    if (data.time !== undefined) {
                        this.game.dayTime = data.time;
                    }
                    this.showToast(`🌍 Світ синхронізовано з хостом [${data.hostName || 'Host'}]!`);
                }
                if (this.game && this.game.ui && this.game.ui.mainMenuOpen) {
                    this.game.ui.closeMainMenu();
                }
                if (data.mods && data.mods.length > 0 && window.modManager) {
                    window.modManager.promptMultiplayerModsDownload(data.mods, data.hostName || 'Хост');
                }
                break;
            }

            case 'player_state': {
                const targetId = data.peerId || senderPeerId;
                let remote = this.remotePlayers.get(targetId);
                if (!remote) {
                    remote = new RemotePlayer(
                        targetId,
                        data.name,
                        this.game.scene,
                        this.game.textureManager,
                        this.game.soundManager,
                        this.game.particleSystem
                    );
                    this.remotePlayers.set(targetId, remote);
                    this.addChatMessage('СИСТЕМА', `👋 ${data.name || 'Гравець'} приєднався до гри!`, true);
                    this.updatePlayerCount();
                }

                remote.setTargetState(data);

                // If we are Host, relay client state to all other connected peers!
                if (this.isHost) {
                    data.peerId = targetId;
                    this.broadcast(data, targetId);
                }
                break;
            }

            case 'block_place': {
                if (this.game.world) {
                    this.game.world.setBlock(data.x, data.y, data.z, data.blockType);
                    this.game.world.updateMeshes();
                    if (this.game.soundManager && window.BLOCK_INFO) {
                        this.game.soundManager.playPlace(window.BLOCK_INFO[data.blockType]?.sound || 'stone');
                    }
                }
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'block_break': {
                if (this.game.world) {
                    this.game.world.setBlock(data.x, data.y, data.z, window.BLOCK_TYPES ? window.BLOCK_TYPES.AIR : 0);
                    this.game.world.updateMeshes();
                    if (this.game.soundManager) this.game.soundManager.playBreak('stone');
                    if (this.game.particleSystem) {
                        this.game.particleSystem.spawnBlockBreakParticles(data.x, data.y, data.z, data.blockType || 1, 10);
                    }
                }
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'tnt_explode': {
                if (this.game.particleSystem) {
                    this.game.particleSystem.spawnExplosionParticles(data.x, data.y + 0.5, data.z, 30);
                }
                if (this.game.soundManager) this.game.soundManager.playExplosion();
                if (this.game.triggerCameraShake) this.game.triggerCameraShake(0.5, 10);
                if (this.game.player) {
                    const p = this.game.player;
                    const dist = Math.hypot(p.position.x - data.x, p.position.y - data.y, p.position.z - data.z);
                    if (dist < 8.0) {
                        const force = (1.0 - dist / 8.0) * 18.0;
                        p.velocity.x += ((p.position.x - data.x) / (dist || 1)) * force;
                        p.velocity.y += Math.max(5.0, ((p.position.y - data.y) / (dist || 1)) * force + 5.0);
                        p.velocity.z += ((p.position.z - data.z) / (dist || 1)) * force;
                        const dmg = Math.floor((1.0 - dist / 8.0) * 55);
                        p.takeDamage(dmg, "💣 Підірвався на динаміті (ТНТ)!");
                    }
                }
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'pvp_hit': {
                if (this.game && this.game.serverClient && this.game.serverClient.isConnected && this.game.serverClient.currentRoom) {
                    // Block direct peer-to-peer forged hits when running under Authoritative Server!
                    console.warn("[Anti-Cheat] Ignored untrusted direct P2P hit in Authoritative Server mode");
                    break;
                }
                if (data.targetId === this.peerId) {
                    // We were hit by another player!
                    if (this.game.player) {
                        // Sound & camera shake for incoming hit
                        if (this.game.soundManager) {
                            if (data.isCrit) this.game.soundManager.playCritHit();
                            else this.game.soundManager.playHurt();
                        }
                        if (data.isCrit && this.game.triggerCameraShake) {
                            this.game.triggerCameraShake(0.4);
                        }

                        // Knockback
                        if (data.knockback) {
                            this.game.player.velocity.x += (data.knockback.x || 0) * 5.5;
                            this.game.player.velocity.y += Math.max(3.2, (data.knockback.y || 0.4) * 5.5);
                            this.game.player.velocity.z += (data.knockback.z || 0) * 5.5;
                        }

                        // Crit particles on self
                        if (data.isCrit && this.game.particleSystem) {
                            this.game.particleSystem.spawnCritParticles(
                                this.game.player.position.x,
                                this.game.player.position.y + 1.1,
                                this.game.player.position.z,
                                20
                            );
                        }

                        // Floating damage
                        if (this.game.ui && this.game.ui.spawnFloatingDamage) {
                            this.game.ui.spawnFloatingDamage(
                                this.game.player.position.x,
                                this.game.player.position.y + 1.3,
                                this.game.player.position.z,
                                data.damage,
                                data.isCrit,
                                data.isSweep
                            );
                        }

                        this.game.player.takeDamage(data.damage, `⚔️ Вас убив ${data.attackerName || 'Гравець'}!`);
                    }
                } else {
                    // Another remote player was hit
                    const remote = this.remotePlayers.get(data.targetId);
                    if (remote) remote.takeDamage(data.damage, data.attackerName, data.isCrit, data.isSweep, data.knockback);
                }
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'chat': {
                this.addChatMessage(data.sender, data.text);
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'skin_change': {
                const targetPeerId = data.peerId || senderPeerId;
                const remote = this.remotePlayers.get(targetPeerId);
                if (remote) {
                    remote.setSkin(data.skin, data.customSkin);
                }
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'inventory_sync': {
                const targetPeerId = data.peerId || senderPeerId;
                const remote = this.remotePlayers.get(targetPeerId);
                if (remote) {
                    remote.setHeldItem(data.held_item);
                }
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'item_drop': {
                if (this.game && this.game.mobManager) {
                    const throwVel = new THREE.Vector3(data.vx || 0, data.vy || 2, data.vz || 0);
                    this.game.mobManager.spawnItemDrop(data.x, data.y, data.z, data.itemId, data.count, 0.8, throwVel);
                }
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'player_leave': {
                this.removeRemotePlayer(data.peerId);
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }

            case 'mod_net': {
                if (window.modManager) {
                    window.modManager.handleNetPacket(data.channel, data.payload || data, senderPeerId);
                }
                if (this.isHost) this.broadcast(data, senderPeerId);
                break;
            }
        }
    }

    // Broadcast skin change event
    broadcastSkinChange(skinId) {
        if (!this.isConnected) return;
        const customData = (skinId === 'custom' && window.skinManager) ? window.skinManager.customSkinDataUrl : null;
        this.broadcast({
            type: 'skin_change',
            peerId: this.peer ? this.peer.id : null,
            skin: skinId,
            customSkin: customData
        });
    }

    // Broadcast packet to connected peers
    broadcast(packet, excludePeerId = null) {
        if (window.modManager && typeof window.modManager.filterOutgoingPacket === 'function') {
            const filtered = window.modManager.filterOutgoingPacket(packet, excludePeerId, null);
            if (filtered === false) return false;
            if (filtered && typeof filtered === 'object') packet = filtered;
        }

        if (this.isHost) {
            for (let [id, conn] of this.connections.entries()) {
                if (id !== excludePeerId && conn.open) {
                    try { conn.send(packet); } catch(e) {}
                }
            }
        } else if (this.hostConnection && this.hostConnection.open) {
            try { this.hostConnection.send(packet); } catch(e) {}
        }
        return true;
    }

    // Send packet to a specific peer
    sendToPeer(peerId, packet) {
        if (!this.isConnected) return false;
        if (window.modManager && typeof window.modManager.filterOutgoingPacket === 'function') {
            const filtered = window.modManager.filterOutgoingPacket(packet, null, peerId);
            if (filtered === false) return false;
            if (filtered && typeof filtered === 'object') packet = filtered;
        }

        if (this.isHost) {
            const conn = this.connections.get(peerId);
            if (conn && conn.open) {
                try { conn.send(packet); return true; } catch(e) { return false; }
            }
        } else if (this.hostConnection && this.hostConnection.open) {
            try {
                this.hostConnection.send({
                    ...packet,
                    _directedTo: peerId
                });
                return true;
            } catch(e) { return false; }
        }
        return false;
    }

    // --- ACTION BROADCAST METHODS ---
    broadcastBlockPlace(x, y, z, blockType) {
        if (this.game && this.game.serverClient && this.game.serverClient.isConnected && this.game.serverClient.currentRoom) {
            this.game.serverClient.sendBlockAction('place', x, y, z, blockType);
        }
        if (!this.isConnected) return;
        this.broadcast({ type: 'block_place', x, y, z, blockType });
    }

    broadcastBlockBreak(x, y, z, blockType = 1) {
        if (this.game && this.game.serverClient && this.game.serverClient.isConnected && this.game.serverClient.currentRoom) {
            this.game.serverClient.sendBlockAction('break', x, y, z, blockType);
        }
        if (!this.isConnected) return;
        this.broadcast({ type: 'block_break', x, y, z, blockType });
    }

    broadcastTNTExplode(x, y, z, radius = 3.5) {
        if (this.game && this.game.serverClient && this.game.serverClient.isConnected && this.game.serverClient.currentRoom) {
            this.game.serverClient.sendRaw({ type: 'tnt_explode', x, y, z, radius });
        }
        if (!this.isConnected) return;
        this.broadcast({ type: 'tnt_explode', x, y, z, radius });
    }

    broadcastPvPHit(targetId, damage) {
        if (!this.isConnected) return;
        this.broadcast({
            type: 'pvp_hit',
            targetId,
            damage,
            attackerName: this.playerName
        });
    }

    sendChatMessage(text) {
        if (!text) return;

        // Mod Event: onChat
        if (window.modManager) {
            const res = window.modManager.triggerEvent("onChat", text, this.playerName);
            if (res === false) return;
        }

        // Command handler
        if (text.startsWith('/')) {
            this.handleCommand(text);
            return;
        }

        const sc = this.game && this.game.serverClient;
        if (sc && sc.isConnected && sc.currentRoom) {
            sc.sendChat(text);
            return;
        }
        this.addChatMessage(this.playerName, text);
        if (this.isConnected) {
            this.broadcast({
                type: 'chat',
                sender: this.playerName,
                text
            });
        }
    }

    handleCommand(cmd) {
        const parts = cmd.trim().split(' ');
        const c = parts[0].toLowerCase();

        switch (c) {
            case '/help':
                this.addChatMessage('СИСТЕМА', '📋 Команди: /help, /preload, /gamemode <c/s>, /weather <clear/rain/thunder/snow>, /fly, /mods, /lua <код>, /nick <ім\'я>, /time <day/night>, /spawn, /clear', true);
                break;
            case '/pregen':
            case '/preload':
                if (this.game && this.game.world && this.game.ui) {
                    this.addChatMessage('СИСТЕМА', '🚀 Запуск попередньої генерації навколишніх чанків...', true);
                    this.game.ui.showPreloader("ПРЕГЕНЕРАЦІЯ ЧАНКІВ", "Preloading surrounding chunks...");
                    this.game.world.preloadChunksAsync((info) => {
                        this.game.ui.updatePreloader(info);
                    }).then(async () => {
                        if (this.game.player) this.game.player.spawnSafe();
                        await this.game.ui.hidePreloader();
                        this.addChatMessage('СИСТЕМА', '✅ Всі чанки навколо повністю згенеровані та завантажені без лагів!', true);
                    });
                }
                break;
            case '/weather':
                const wType = (parts[1] || '').toLowerCase();
                if (['clear', 'rain', 'thunder', 'snow'].includes(wType)) {
                    if (this.game && this.game.weatherManager) {
                        this.game.weatherManager.setWeather(wType);
                        this.addChatMessage('СИСТЕМА', `🌦️ Встановлено погоду: ${wType}`, true);
                    }
                } else {
                    this.addChatMessage('СИСТЕМА', 'Використання: /weather <clear|rain|thunder|snow>', true);
                }
                break;
            case '/rain':
                if (this.game && this.game.weatherManager) {
                    this.game.weatherManager.setWeather('rain');
                    this.addChatMessage('СИСТЕМА', '🌧️ Увімкнено дощ!', true);
                }
                break;
            case '/snow':
                if (this.game && this.game.weatherManager) {
                    this.game.weatherManager.setWeather('snow');
                    this.addChatMessage('СИСТЕМА', '❄️ Увімкнено снігопад!', true);
                }
                break;
            case '/thunder':
                if (this.game && this.game.weatherManager) {
                    this.game.weatherManager.setWeather('thunder');
                    this.addChatMessage('СИСТЕМА', '⛈️ Увімкнено грозу та блискавки!', true);
                }
                break;
            case '/sun':
                if (this.game && this.game.weatherManager) {
                    this.game.weatherManager.setWeather('clear');
                    this.addChatMessage('СИСТЕМА', '☀️ Погода очищена!', true);
                }
                break;
            case '/gamemode':
            case '/gm':
                const mode = (parts[1] || '').toLowerCase();
                if (mode === 'c' || mode === 'creative' || mode === '1') {
                    if (this.game && this.game.player) {
                        this.game.player.isCreative = true;
                        this.game.player.godMode = true;
                        this.game.player.instantBreak = true;
                        this.game.player.infiniteBlocks = true;
                        this.game.player.customReach = 10.0;
                    }
                    if (window.modManager) window.modManager.triggerEvent("onGameModeChange", "creative");
                    this.addChatMessage('СИСТЕМА', '✨ Встановлено режим Креативу (Creative)!', true);
                    if (this.game && this.game.ui) this.game.ui.showToast('✨ Режим Креативу УВІМКНЕНО!');
                } else if (mode === 's' || mode === 'survival' || mode === '0') {
                    if (this.game && this.game.player) {
                        this.game.player.isCreative = false;
                        this.game.player.isFlying = false;
                        this.game.player.godMode = false;
                        this.game.player.instantBreak = false;
                        this.game.player.infiniteBlocks = false;
                        this.game.player.customReach = 5.2;
                    }
                    if (window.modManager) window.modManager.triggerEvent("onGameModeChange", "survival");
                    this.addChatMessage('СИСТЕМА', '🏕️ Встановлено режим Виживання (Survival)!', true);
                    if (this.game && this.game.ui) this.game.ui.showToast('🏕️ Режим Виживання УВІМКНЕНО!');
                } else {
                    this.addChatMessage('СИСТЕМА', 'Використання: /gamemode <creative|survival> (або /gmc, /gms)', true);
                }
                break;
            case '/gmc':
                if (this.game && this.game.player) {
                    this.game.player.isCreative = true;
                    this.game.player.godMode = true;
                    this.game.player.instantBreak = true;
                    this.game.player.infiniteBlocks = true;
                    this.game.player.customReach = 10.0;
                }
                if (window.modManager) window.modManager.triggerEvent("onGameModeChange", "creative");
                this.addChatMessage('СИСТЕМА', '✨ Режим Креативу увімкнено! [F - Політ]', true);
                if (this.game && this.game.ui) this.game.ui.showToast('✨ Креатив УВІМКНЕНО!');
                break;
            case '/gms':
                if (this.game && this.game.player) {
                    this.game.player.isCreative = false;
                    this.game.player.isFlying = false;
                    this.game.player.godMode = false;
                    this.game.player.instantBreak = false;
                    this.game.player.infiniteBlocks = false;
                    this.game.player.customReach = 5.2;
                }
                if (window.modManager) window.modManager.triggerEvent("onGameModeChange", "survival");
                this.addChatMessage('СИСТЕМА', '🏕️ Режим Виживання увімкнено!', true);
                if (this.game && this.game.ui) this.game.ui.showToast('🏕️ Виживання УВІМКНЕНО!');
                break;
            case '/fly':
                if (this.game && this.game.player) {
                    this.game.player.isFlying = !this.game.player.isFlying;
                    const flyState = this.game.player.isFlying;
                    this.addChatMessage('СИСТЕМА', flyState ? '🕊️ Політ УВІМКНЕНО' : '🕊️ Політ ВИМКНЕНО', true);
                    if (this.game.ui) this.game.ui.showToast(flyState ? '🕊️ Політ УВІМКНЕНО' : '🕊️ Політ ВИМКНЕНО');
                    if (window.modManager) window.modManager.triggerEvent("onFlyToggle", flyState);
                }
                break;
            case '/mods':
                if (window.modManager) {
                    window.modManager.toggleModal(true);
                }
                break;
            case '/lua':
                const luaCode = cmd.slice(5).trim();
                if (!luaCode) {
                    this.addChatMessage('СИСТЕМА', 'Використання: /lua <код>', true);
                } else if (window.modManager) {
                    try {
                        const result = window.modManager.runLua(luaCode, "Chat Command");
                        this.addChatMessage('LUA', result !== undefined ? String(result) : '✔ Виконано успішно', true);
                    } catch (err) {
                        this.addChatMessage('LUA ПОМИЛКА', err.message || String(err), true);
                    }
                }
                break;
            case '/nick':
                if (parts[1]) {
                    this.playerName = parts[1].slice(0, 16);
                    localStorage.setItem('eblankraft_nickname', this.playerName);
                    this.addChatMessage('СИСТЕМА', `👤 Нікнейм змінено на: ${this.playerName}`, true);
                }
                break;
            case '/clear':
                const list = document.getElementById('chat-messages');
                if (list) list.innerHTML = '';
                break;
            case '/time':
                if (parts[1] === 'day') {
                    if (this.game) this.game.dayTime = 0.25;
                    this.addChatMessage('СИСТЕМА', '☀️ Встановлено день', true);
                } else if (parts[1] === 'night') {
                    if (this.game) this.game.dayTime = 0.75;
                    this.addChatMessage('СИСТЕМА', '🌙 Встановлено ніч', true);
                }
                break;
            case '/spawn':
                if (this.game && this.game.player) {
                    this.game.player.position.set(0, 32, 0);
                    this.game.player.velocity.set(0, 0, 0);
                    this.addChatMessage('СИСТЕМА', '✨ Телепортовано на спавн!', true);
                }
                break;
            case '/village':
                if (this.game && this.game.world && this.game.player) {
                    const p = this.game.player.position;
                    this.game.world.buildVillage(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), true);
                    this.addChatMessage('СИСТЕМА', '🏡 Село з жителями успішно збудовано навколо вас!', true);
                    if (this.game.ui) this.game.ui.showToast('🏡 Село з жителями збудовано!');
                }
                break;
            case '/villager':
                if (this.game && this.game.mobManager && this.game.player) {
                    const p = this.game.player.position;
                    this.game.mobManager.spawnMob('villager', p.x + 1.5, p.y, p.z + 1.5);
                    this.addChatMessage('СИСТЕМА', '👨‍🌾 Жителя села заспавнено! Клацніть правою кнопкою миші для торгівлі.', true);
                    if (this.game.ui) this.game.ui.showToast('👨‍🌾 Житель села заспавнений!');
                }
                break;
            case '/redstone':
                if (this.game && this.game.player) {
                    const pl = this.game.player;
                    pl.addItem(ITEM_TYPES.REDSTONE_DUST, 64);
                    pl.addItem(ITEM_TYPES.REDSTONE_WIRE, 64);
                    pl.addItem(ITEM_TYPES.LEVER, 16);
                    pl.addItem(ITEM_TYPES.REDSTONE_TORCH, 16);
                    pl.addItem(ITEM_TYPES.REDSTONE_LAMP, 16);
                    pl.addItem(ITEM_TYPES.STONE_BUTTON, 16);
                    pl.addItem(ITEM_TYPES.PRESSURE_PLATE, 16);
                    pl.addItem(ITEM_TYPES.TNT, 32);
                    this.addChatMessage('СИСТЕМА', '⚡ Набір Редстоуну та дротів видано в інвентар!', true);
                    if (this.game.ui) this.game.ui.showToast('⚡ Набір Редстоуну видано!');
                }
                break;
            case '/pc':
            case '/computer':
                if (this.game) {
                    if (this.game.player) {
                        this.game.player.addItem(ITEM_TYPES.COMPUTER, 1);
                    }
                    if (this.game.ui) {
                        this.game.ui.openEmuOSModal();
                    }
                    this.addChatMessage('СИСТЕМА', '🖥️ Комп\'ютер відкрито! (EmuOS Retro PC)', true);
                }
                break;
            case '/guns':
            case '/allguns':
                if (this.game && this.game.player) {
                    const pl = this.game.player;
                    pl.addItem(ITEM_TYPES.AK47, 1);
                    pl.addItem(ITEM_TYPES.M4A1, 1);
                    pl.addItem(ITEM_TYPES.AWP, 1);
                    pl.addItem(ITEM_TYPES.SHOTGUN, 1);
                    pl.addItem(ITEM_TYPES.DEAGLE, 1);
                    pl.addItem(ITEM_TYPES.GLOCK, 1);
                    pl.addItem(ITEM_TYPES.MP5, 1);
                    pl.addItem(ITEM_TYPES.RPG, 1);
                    pl.addItem(ITEM_TYPES.GRENADE, 10);
                    pl.addItem(ITEM_TYPES.AMMO_PISTOL, 120);
                    pl.addItem(ITEM_TYPES.AMMO_RIFLE, 180);
                    pl.addItem(ITEM_TYPES.AMMO_SNIPER, 40);
                    pl.addItem(ITEM_TYPES.AMMO_SHOTGUN, 48);
                    pl.addItem(ITEM_TYPES.AMMO_ROCKET, 10);
                    this.addChatMessage('СИСТЕМА', '🔫 Повний арсенал зброї та набоїв додано в інвентар!', true);
                    if (this.game.ui) this.game.ui.showToast('🔫 Весь арсенал зброї видано!');
                }
                break;
            case '/ultra':
            case '/graphics':
                if (this.game && this.game.ui) {
                    this.game.ui.applyUltraPreset();
                    this.addChatMessage('СИСТЕМА', '💎 УЛЬТРА ГРАФІКА АКТИВОВАНА! 100% Scaling + Antialiasing + RTX Shadows!', true);
                }
                break;
            case '/potato':
                if (this.game && this.game.ui) {
                    const btn = document.getElementById('btn-ultra-potato-preset');
                    if (btn) btn.click();
                    this.addChatMessage('СИСТЕМА', '🥔 Режим тостера активовано!', true);
                }
                break;
            case '/join':
            case '/prop':
            case '/taunt':
            case '/job':
            case '/money':
            case '/wanted':
            case '/arrest':
            case '/buy':
            case '/sell':
            case '/lock':
            case '/unlock':
            case '/blind':
            case '/ph':
            case '/rp':
                if (window.modManager && window.modManager.handleChatCommand(cmd)) {
                    break;
                }
                if (c === '/join' && window.modManager && window.modManager.propHuntManager) {
                    const team = (parts[1] || '').toLowerCase();
                    if (team === 'props' || team === 'hunters') {
                        if (team === 'props') {
                            window.modManager.propHuntManager.disguise(1);
                        } else {
                            window.modManager.propHuntManager.undisguise();
                        }
                        this.addChatMessage('PropHunt', `Ви приєдналися до команди: ${team}!`, true);
                    } else {
                        this.addChatMessage('PropHunt', 'Використання: /join <props|hunters>', true);
                    }
                    break;
                }
                if (c === '/prop' && window.modManager && window.modManager.propHuntManager) {
                    if (parts[1]) {
                        window.modManager.propHuntManager.disguise(parts[1]);
                    } else {
                        this.addChatMessage('PropHunt', 'Використання: /prop <назва_блоку>', true);
                    }
                    break;
                }
                if (c === '/taunt' && window.modManager && window.modManager.propHuntManager) {
                    window.modManager.propHuntManager.taunt(parts[1] || 'whistle');
                    break;
                }
                if (c === '/job' && window.modManager && window.modManager.blackRPManager) {
                    if (parts[1]) {
                        window.modManager.blackRPManager.setJob(parts[1]);
                        this.addChatMessage('BlackRP', `💼 Ваша нова робота: ${parts[1]}`, true);
                    } else {
                        this.addChatMessage('BlackRP', 'Використання: /job <citizen|police|gangster|medic|gun_dealer|miner>', true);
                    }
                    break;
                }
                if (c === '/money' && window.modManager && window.modManager.blackRPManager) {
                    this.addChatMessage('BlackRP', `💰 Ваш баланс: $${window.modManager.blackRPManager.getMoney()}`, true);
                    break;
                }
                this.addChatMessage('СИСТЕМА', `Команда ${c} активна коли підключено відповідний мод`, true);
                break;
            default:
                if (window.modManager && window.modManager.handleChatCommand(cmd)) {
                    break;
                }
                this.addChatMessage('СИСТЕМА', `Невідома команда: ${c}. Напишіть /help`, true);
                break;
        }
    }

    // Check PvP Raycast hit against remote players (Precision Modern Hitbox)
    checkPvPHit(origin, dir, reach, baseDmg, isCrit = false, isSweep = false, knockback = null) {
        if (!this.remotePlayers || this.remotePlayers.size === 0) return false;

        let hit = false;
        for (let [peerId, remote] of this.remotePlayers.entries()) {
            if (!remote || !remote.group) continue;

            const rPos = remote.group.position;
            // Raycast against vertical cylinder of the opponent (head to feet)
            const toCenter = new THREE.Vector3(rPos.x, rPos.y + 0.95, rPos.z).sub(origin);
            const distAlongRay = toCenter.dot(dir);

            if (distAlongRay > 0 && distAlongRay <= reach) {
                const rayPoint = origin.clone().addScaledVector(dir, distAlongRay);
                const hDist = Math.hypot(rayPoint.x - rPos.x, rayPoint.z - rPos.z);
                const vOffset = rayPoint.y - rPos.y;

                // Generous cylinder: radius 0.85, height -0.2 to 2.15 (covers full player body)
                if (hDist <= 0.85 && vOffset >= -0.2 && vOffset <= 2.15) {
                    // Confirmed hit on player!
                    if (this.game && this.game.serverClient && this.game.serverClient.isConnected && this.game.serverClient.currentRoom && !peerId.startsWith('bot_')) {
                        this.game.serverClient.requestAttack(peerId, isCrit);
                        hit = true;
                        break;
                    }

                    const kbObj = knockback ? { x: knockback.x, y: knockback.y, z: knockback.z } : null;
                    let packet = {
                        type: 'pvp_hit',
                        targetId: peerId,
                        damage: baseDmg,
                        isCrit: isCrit,
                        isSweep: isSweep,
                        knockback: kbObj,
                        attackerName: this.playerName
                    };

                    remote.takeDamage(baseDmg, this.playerName, isCrit, isSweep, kbObj);
                    if (this.isConnected) {
                        this.broadcast(packet);
                    }
                    hit = true;
                    const badge = isCrit ? " ⚡ КРИТ!" : (isSweep ? " ⚔️ СВИП!" : "");
                    if (this.showToast) {
                        this.showToast(`⚔️ Ви вдарили [${remote.name}] (-${Math.round(baseDmg)} HP)${badge}!`);
                    }
                    break;
                }
            }
        }
        return hit;
    }

    addRemotePlayer(peerId, name = 'Гравець') {
        let remote = this.remotePlayers.get(peerId);
        if (!remote) {
            remote = new RemotePlayer(
                peerId,
                name,
                this.game.scene,
                this.game.textureManager,
                this.game.soundManager,
                this.game.particleSystem
            );
            this.remotePlayers.set(peerId, remote);
            this.updatePlayerCount();
        }
        return remote;
    }

    removeRemotePlayer(peerId) {
        const remote = this.remotePlayers.get(peerId);
        if (remote) {
            this.addChatMessage('СИСТЕМА', `👋 ${remote.name} покинув гру`, true);
            remote.destroy();
            this.remotePlayers.delete(peerId);
            this.updatePlayerCount();
        }
    }

    updateConnectedUI(connected, roomCode, isHost) {
        const statusEl = document.getElementById('mp-status-text');
        const activeBox = document.getElementById('mp-active-room-box');
        const codeDisplay = document.getElementById('mp-display-room-code');
        const panelHost = document.getElementById('mp-panel-host');
        const panelJoin = document.getElementById('mp-panel-join');
        const btnDisconnect = document.getElementById('btn-mp-disconnect');

        if (statusEl) {
            statusEl.textContent = connected ? (isHost ? '🟢 Ви Хост сервера' : '🟢 Підключено до гри') : '⚪ Не підключено';
        }
        if (activeBox) activeBox.style.display = connected ? 'block' : 'none';
        if (codeDisplay) codeDisplay.textContent = roomCode || '---';
        if (btnDisconnect) btnDisconnect.style.display = connected ? 'block' : 'none';

        if (connected) {
            if (panelHost) panelHost.style.display = 'none';
            if (panelJoin) panelJoin.style.display = 'none';
        }
    }

    updatePlayerCount() {
        const badge = document.getElementById('mp-player-count-badge');
        const total = 1 + this.remotePlayers.size;
        if (badge) badge.textContent = `Гравців онлайн: ${total}`;
    }

    disconnect() {
        this.isConnected = false;
        this.isHost = false;

        for (let remote of this.remotePlayers.values()) {
            remote.destroy();
        }
        this.remotePlayers.clear();

        for (let conn of this.connections.values()) {
            try { conn.close(); } catch(e) {}
        }
        this.connections.clear();

        if (this.hostConnection) {
            try { this.hostConnection.close(); } catch(e) {}
            this.hostConnection = null;
        }

        if (this.peer) {
            try { this.peer.destroy(); } catch(e) {}
            this.peer = null;
        }

        this.peerId = null;
        this.updateConnectedUI(false, null, false);
        this.showToast('З\'єднання закрито');
    }

    showToast(msg) {
        if (this.game && this.game.ui && this.game.ui.showToast) {
            this.game.ui.showToast(msg);
        }
    }

    // Main render loop update
    update(dt) {
        // 1. Update all remote players
        for (let remote of this.remotePlayers.values()) {
            remote.update(dt);
        }

        // 2. Broadcast local player state at fixed interval (20 Hz)
        if (this.isConnected && this.game.player) {
            this.sendTimer += dt;
            if (this.sendTimer >= this.sendInterval) {
                this.sendTimer = 0;
                const p = this.game.player;
                const statePacket = {
                    type: 'player_state',
                    name: this.playerName,
                    position: {
                        x: Math.round(p.position.x * 100) / 100,
                        y: Math.round(p.position.y * 100) / 100,
                        z: Math.round(p.position.z * 100) / 100
                    },
                    yaw: Math.round(p.yaw * 100) / 100,
                    pitch: Math.round(p.pitch * 100) / 100,
                    isWalking: !!(p.velocity && (Math.abs(p.velocity.x) > 0.4 || Math.abs(p.velocity.z) > 0.4)),
                    isSprinting: !!p.isSprinting,
                    armSwing: p.armSwing || 0,
                    health: p.health || 100,
                    heldItem: p.getSelectedItem() ? p.getSelectedItem().itemId : null,
                    skin: (this.game && this.game.upgrader ? this.game.upgrader.equippedSkin : 'classic'),
                    customSkin: (window.skinManager ? window.skinManager.customSkinDataUrl : null)
                };

                this.broadcast(statePacket);
            }
        }
    }
}

window.MultiplayerManager = MultiplayerManager;
window.RemotePlayer = RemotePlayer;

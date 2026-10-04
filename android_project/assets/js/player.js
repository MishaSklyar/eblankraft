/**
 * Eblankraft 2.0 - Player Controller, Survival Mechanics, Mining Speed, Combat & Skins
 */

function isPassThroughBlock(b) {
    if (b === 0 || b === undefined || b === null) return true;
    if (window.BLOCK_INFO && window.BLOCK_INFO[b] && window.BLOCK_INFO[b].solid === false) {
        return true;
    }
    const bt = window.BLOCK_TYPES || (typeof BLOCK_TYPES !== 'undefined' ? BLOCK_TYPES : {});
    return b === bt.AIR ||
           b === bt.WATER ||
           b === bt.PORTAL_NETHER ||
           b === bt.PORTAL_END ||
           b === bt.RED_FLOWER ||
           b === bt.YELLOW_FLOWER ||
           b === bt.RED_MUSHROOM ||
           b === bt.BROWN_MUSHROOM ||
           b === bt.REDSTONE_WIRE ||
           b === bt.REDSTONE_TORCH ||
           b === bt.LEVER ||
           b === bt.STONE_BUTTON ||
           b === bt.PRESSURE_PLATE;
}
window.isPassThroughBlock = isPassThroughBlock;

class Player {
    get world() {
        return (this.game && this.game.world) ? this.game.world : this._world;
    }
    set world(w) {
        this._world = w;
    }

    constructor(scene, camera, world, soundManager, particleSystem, game) {
        this.scene = scene;
        this.camera = camera;
        this._world = world;
        this.soundManager = soundManager;
        this.particleSystem = particleSystem;
        this.game = game;

        // Reusable scratch vectors for raycasting & physics (0 heap allocations per frame)
        this._rayOrigin = new THREE.Vector3();
        this._rayDir = new THREE.Vector3();
        this._rayPrevPos = new THREE.Vector3();
        this._rayCurrentPos = new THREE.Vector3();
        this._scratchNextPos = new THREE.Vector3();
        this._scratchStepPos = new THREE.Vector3();

        // Position & Movement
        this.position = new THREE.Vector3(0, 16, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;   // Left/Right rotation
        this.pitch = 0; // Up/Down rotation

        // Dimensions
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;
        this.eyeHeight = 1.62;

        // Survival Stats
        this.health = 100;
        this.maxHealth = 100;
        this.hunger = 100;
        this.maxHunger = 100;
        this.iq = 0;
        this.isDead = false;
        this.deathReason = "";
        this.hungerTimer = 0;
        this.regenTimer = 0;
        this.portalTimer = 0;

        // States
        this.onGround = false;
        this.timeSinceGrounded = 0;
        this.jumpBufferTimer = 0;
        this.jumpCooldown = 0;
        this.isFlying = false;
        this.canFly = false;
        this.flySpeed = 11.0;
        this.godMode = false;
        this.isCreative = false;
        this.instantBreak = false;
        this.infiniteBlocks = false;
        this.customReach = 5.2;
        this.speedMultiplier = 1.0;
        this.noclip = false;
        this.isSprinting = false;
        this.mountedVehicle = null;
        this.walkCycle = 0;
        this.armSwing = 0;
        this.isThirdPerson = false;

        // Modern Combat System (Minecraft 1.9+ Java Combat & Tactical PvP)
        this.attackCooldown = 1.0; // 0.0 to 1.0 (1.0 = fully charged)
        this.isBlocking = false;
        this.blockStartTime = 0;
        this.parryCounterBonus = 1.0;
        this.comboCounter = 0;
        this.comboTimer = 0;
        this.comboStep = 0; // 0=jab, 1=slash, 2=finisher
        this.lastAttackHitTime = 0;
        this.whiffLagTimer = 0; // miss penalty delay
        this.dodgeCooldown = 0;
        this.dodgeRollInvulnerable = false;
        this.dodgeTimer = 0;
        this.totemInvulnerableTimer = 0;
        this.isTargetLocked = false;

        // Underwater & Breathing System (дихання & плавання)
        this.oxygen = 100;
        this.maxOxygen = 100;
        this.drownTimer = 0;
        this.bubbleParticleTimer = 0;
        this.swimSoundTimer = 0;
        this.isInWater = false;
        this.isSubmerged = false;
        this.wasInWater = false;
        this.swimBobbingTimer = 0;
        this.waterExitBoostTimer = 0;

        // 🌋 Molten Lava Interaction State
        this.isInLava = false;
        this.isLavaSubmerged = false;
        this.wasInLava = false;
        this.lavaSizzleTimer = 0;

        // Inventory System (27 slots: 0..8 hotbar, 9..26 backpack)
        this.inventory = new Array(27).fill(null);
        this.selectedHotbarIndex = 0;
        this.initDefaultInventory();

        // Mining State & Speed
        this.targetBlock = null; // { hit, x, y, z, nx, ny, nz, type }
        this.miningProgress = 0.0; // 0 to 1
        this.isMining = false;
        this.miningSoundTimer = 0;

        // Target Wireframe Box
        const wireGeom = new THREE.BoxGeometry(1.005, 1.005, 1.005);
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
            wireframeLinewidth: 2,
            transparent: true,
            opacity: 0.45
        });
        this.wireframeBox = new THREE.Mesh(wireGeom, wireMat);
        this.wireframeBox.visible = false;
        this.scene.add(this.wireframeBox);

        // 3D First Person Hand & Third Person Model
        this.initFirstPersonHand();
        this.initThirdPersonModel();

        // Spawn player on safe terrain
        this.spawnSafe();
    }

    initDefaultInventory() {
        // Load from localStorage if saved
        try {
            const saved = localStorage.getItem('eblankraft_inventory');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length === 27) {
                    this.inventory = parsed;
                    return;
                }
            }
        } catch (e) {}

        // Default starting survival kit:
        this.inventory[0] = { itemId: ITEM_TYPES.WOOD_PICKAXE, count: 1 };
        this.inventory[1] = { itemId: ITEM_TYPES.WOOD_SWORD, count: 1 };
        this.inventory[2] = { itemId: ITEM_TYPES.PLANKS, count: 32 };
        this.inventory[3] = { itemId: ITEM_TYPES.APPLE, count: 16 };
        this.inventory[4] = { itemId: ITEM_TYPES.COBBLESTONE, count: 16 };
        this.inventory[5] = { itemId: ITEM_TYPES.GLOWSTONE, count: 8 };
        this.inventory[6] = { itemId: ITEM_TYPES.TNT, count: 4 };
        this.inventory[7] = { itemId: ITEM_TYPES.CRAFTING_TABLE, count: 1 };
        this.inventory[8] = { itemId: ITEM_TYPES.EBLAN_BLOCK, count: 2 };
    }

    saveInventory() {
        try {
            localStorage.setItem('eblankraft_inventory', JSON.stringify(this.inventory));
        } catch (e) {}
    }

    saveInventoryDebounced() {
        if (this._saveInvTimer) clearTimeout(this._saveInvTimer);
        this._saveInvTimer = setTimeout(() => {
            this.saveInventory();
            this._saveInvTimer = null;
        }, 250);
    }

    resetToStarterInventory() {
        this.inventory = new Array(27).fill(null);
        this.inventory[0] = { itemId: ITEM_TYPES.WOOD_PICKAXE, count: 1 };
        this.inventory[1] = { itemId: ITEM_TYPES.WOOD_SWORD, count: 1 };
        this.inventory[2] = { itemId: ITEM_TYPES.PLANKS, count: 32 };
        this.inventory[3] = { itemId: ITEM_TYPES.APPLE, count: 16 };
        this.inventory[4] = { itemId: ITEM_TYPES.COBBLESTONE, count: 16 };
        this.inventory[5] = { itemId: ITEM_TYPES.GLOWSTONE, count: 8 };
        this.inventory[6] = { itemId: ITEM_TYPES.TNT, count: 4 };
        this.inventory[7] = { itemId: ITEM_TYPES.CRAFTING_TABLE, count: 1 };
        this.inventory[8] = { itemId: ITEM_TYPES.EBLAN_BLOCK, count: 2 };
        this.selectedHotbarIndex = 0;
        this.saveInventory();
        this.updateHeldBlock();
    }

    clearInventory() {
        this.inventory = new Array(27).fill(null);
        this.selectedHotbarIndex = 0;
        this.saveInventory();
        this.updateHeldBlock();
    }

    // Inventory Helpers
    getSelectedItem() {
        return this.inventory[this.selectedHotbarIndex] || null;
    }

    getSelectedBlockType() {
        const it = this.getSelectedItem();
        if (!it) return null;
        const reg = ITEM_REGISTRY[it.itemId];
        if (reg && reg.category === 'block') return reg.blockType;
        return null;
    }

    addItem(itemId, count = 1) {
        if (!itemId || count <= 0) return false;
        const reg = ITEM_REGISTRY[itemId];
        const maxStack = reg ? reg.maxStack : 64;

        // 1. Try stacking into existing slots
        if (maxStack > 1) {
            for (let i = 0; i < this.inventory.length; i++) {
                const slot = this.inventory[i];
                if (slot && slot.itemId === itemId && slot.count < maxStack) {
                    const space = maxStack - slot.count;
                    const add = Math.min(space, count);
                    slot.count += add;
                    count -= add;
                    if (count <= 0) {
                        this.saveInventoryDebounced();
                        this.updateHeldBlock();
                        if (this.game.ui) this.game.ui.initHotbar();
                        return true;
                    }
                }
            }
        }

        // 2. Place into empty slots
        for (let i = 0; i < this.inventory.length; i++) {
            if (!this.inventory[i]) {
                const add = Math.min(maxStack, count);
                this.inventory[i] = { itemId, count: add };
                count -= add;
                if (count <= 0) {
                    this.saveInventoryDebounced();
                    this.updateHeldBlock();
                    if (this.game.ui) this.game.ui.initHotbar();
                    return true;
                }
            }
        }

        this.saveInventoryDebounced();
        this.updateHeldBlock();
        if (this.game.ui) this.game.ui.initHotbar();
        return false; // full
    }

    removeItem(itemId, count = 1) {
        let remaining = count;
        for (let i = 0; i < this.inventory.length; i++) {
            const slot = this.inventory[i];
            if (slot && slot.itemId === itemId) {
                if (slot.count > remaining) {
                    slot.count -= remaining;
                    remaining = 0;
                    break;
                } else {
                    remaining -= slot.count;
                    this.inventory[i] = null;
                }
            }
        }
        this.saveInventoryDebounced();
        this.updateHeldBlock();
        if (this.game.ui) this.game.ui.initHotbar();
        return remaining === 0;
    }

    getItemCount(itemId) {
        let total = 0;
        for (let slot of this.inventory) {
            if (slot && slot.itemId === itemId) total += slot.count;
        }
        return total;
    }

    hasItem(itemId, count = 1) {
        return this.getItemCount(itemId) >= count;
    }

    dropItem(slotIndex = this.selectedHotbarIndex, count = 1) {
        const slot = this.inventory[slotIndex];
        if (!slot) return;

        const dropCount = Math.min(slot.count, count);
        slot.count -= dropCount;
        const droppedId = slot.itemId;

        if (slot.count <= 0) {
            this.inventory[slotIndex] = null;
        }

        this.saveInventoryDebounced();
        this.updateHeldBlock();
        if (this.game.ui) this.game.ui.initHotbar();

        // Spawn item drop thrown forward with 1.2s pickup delay so player doesn't instantly re-vacuum it
        if (this.game.mobManager) {
            const origin = this.position.clone().add(new THREE.Vector3(0, this.eyeHeight - 0.2, 0));
            const lookDir = new THREE.Vector3(
                -Math.sin(this.yaw) * Math.cos(this.pitch),
                Math.sin(this.pitch),
                -Math.cos(this.yaw) * Math.cos(this.pitch)
            ).normalize();

            const spawnPos = origin.clone().addScaledVector(lookDir, 0.8);
            const throwVelocity = lookDir.clone().multiplyScalar(4.5).add(new THREE.Vector3(0, 2.0, 0));
            this.game.mobManager.spawnItemDrop(spawnPos.x, spawnPos.y, spawnPos.z, droppedId, dropCount, 1.2, throwVelocity);
        }

        if (this.soundManager) this.soundManager.playClick();
    }

    spawnSafe() {
        const dim = (this.world && this.world.dimension) ? this.world.dimension : 'overworld';
        const wType = (this.world && this.world.worldType) ? this.world.worldType : 'normal';

        if (wType === 'race_track' || dim === 'race_track') {
            this.position.set(0.5, 5.05, 12.0);
            this.velocity.set(0, 0, 0);
            this.yaw = 0;
            this.pitch = 0;
            this.onGround = true;
            return;
        }

        if (wType === 'highway_city' || dim === 'highway_city') {
            this.position.set(24.5, 5.05, 4.0);
            this.velocity.set(0, 0, 0);
            this.yaw = 0;
            this.pitch = 0;
            this.onGround = true;
            return;
        }

        let spawnX = 0.5;
        let spawnY = 18.05;
        let spawnZ = 0.5;

        if (dim === 'nether') {
            // Nether: Safe spawn inside cavern in front of portal on Nether Bricks
            spawnX = 1.5;
            spawnZ = 2.5;
            spawnY = 7.05; // Floor is at y=6, air at y=7..13
            this.yaw = 0; // Look forward into the Nether cavern
            this.pitch = 0;
        } else if (dim === 'the_end') {
            // The End: Safe spawn on the Obsidian Platform at (0, 14, 18)
            spawnX = 0.5;
            spawnZ = 18.0;
            spawnY = 14.05; // Platform is at y=13, air at y=14..17
            this.yaw = Math.PI; // Face towards the center island (0, 0)
            this.pitch = 0;
        } else {
            // Overworld: Search from top down for solid surface with clear air
            let foundSpawn = false;
            const searchCoords = [
                [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
                [1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2],
                [2, 2], [-2, -2], [3, 3], [-3, -3], [4, 4], [-4, -4]
            ];
            for (const [sx, sz] of searchCoords) {
                for (let y = CHUNK_SIZE_Y - 2; y >= 2; y--) {
                    const bFloor = this.world.getBlock(sx, y, sz);
                    const bLegs = this.world.getBlock(sx, y + 1, sz);
                    const bHead = this.world.getBlock(sx, y + 2, sz);
                    if (!isPassThroughBlock(bFloor) &&
                        bFloor !== BLOCK_TYPES.WATER && bFloor !== BLOCK_TYPES.LAVA &&
                        bFloor !== BLOCK_TYPES.PORTAL_NETHER && bFloor !== BLOCK_TYPES.PORTAL_END &&
                        isPassThroughBlock(bLegs) && bLegs !== BLOCK_TYPES.LAVA &&
                        isPassThroughBlock(bHead) && bHead !== BLOCK_TYPES.LAVA) {
                        spawnX = sx + 0.5;
                        spawnZ = sz + 0.5;
                        spawnY = y + 1.05;
                        foundSpawn = true;
                        break;
                    }
                }
                if (foundSpawn) break;
            }
            if (!foundSpawn) {
                spawnX = 0.5;
                spawnZ = 0.5;
                spawnY = 18.05;
            }
        }

        this.position.set(spawnX, spawnY, spawnZ);
        this.velocity.set(0, 0, 0);
        this.onGround = true;
        this.timeSinceGrounded = 0;
        this.jumpBufferTimer = 0;
        this.jumpCooldown = 0;
        this.portalTimer = -3.0; // 3 seconds portal immunity on spawn
        this.health = this.maxHealth;
        this.hunger = 100;
        this.isDead = false;
        this.miningProgress = 0;
        this.isMining = false;
    }

    initFirstPersonHand() {
        this.handGroup = new THREE.Group();
        this.camera.add(this.handGroup);

        // Unified item pivot in bottom-right corner of screen
        this.itemPivot = new THREE.Group();
        this.itemPivot.position.set(0.36, -0.36, -0.52);
        this.handGroup.add(this.itemPivot);

        // 1. Arm box (Minecraft right arm extending forward with equipped skin texture)
        const armGeom = createMinecraftBoxGeometry(0.24, 0.72, 0.24, 40, 16, 4, 12, 4);
        armGeom.translate(0, -0.22, 0.12);
        const curSkinId = (this.game && this.game.upgrader) ? this.game.upgrader.equippedSkin : 'classic';
        const initTex = window.skinManager ? window.skinManager.getSkinTexture(curSkinId) : null;
        this.armMat = new THREE.MeshLambertMaterial({ map: initTex, color: 0xffffff });
        this.armMesh = new THREE.Mesh(armGeom, this.armMat);
        this.armMesh.rotation.set(0.32, -0.22, 0.1);
        this.itemPivot.add(this.armMesh);

        // 2. Held Block Mesh (3D isometric block held in hand)
        const blockGeom = new THREE.BoxGeometry(0.36, 0.36, 0.36);
        this.heldItemMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        this.heldBlockMesh = new THREE.Mesh(blockGeom, this.heldItemMat);
        this.heldBlockMesh.position.set(-0.02, 0.12, -0.16);
        this.heldBlockMesh.rotation.set(0.35, 0.75, -0.15);
        this.itemPivot.add(this.heldBlockMesh);

        // 3. Held Tool / Weapon / Item Mesh (Minecraft-style angled weapon)
        const toolGeom = new THREE.PlaneGeometry(0.55, 0.55);
        this.heldToolMat = new THREE.MeshLambertMaterial({ transparent: true, side: THREE.DoubleSide });
        this.heldToolMesh = new THREE.Mesh(toolGeom, this.heldToolMat);
        this.heldToolMesh.position.set(-0.04, 0.20, -0.18);
        this.heldToolMesh.rotation.set(-0.35, 0.75, -0.42);
        this.itemPivot.add(this.heldToolMesh);

        this.applySkinVisuals();
        this.updateHeldBlock();
    }

    initThirdPersonModel() {
        const curSkinId = (this.game && this.game.upgrader) ? this.game.upgrader.equippedSkin : 'classic';
        const tex = window.skinManager ? window.skinManager.getSkinTexture(curSkinId) : null;

        this.mcModel = createMinecraftPlayerHierarchy(tex);
        this.playerBodyGroup = this.mcModel.root;
        this.playerBodyGroup.visible = false;
        this.scene.add(this.playerBodyGroup);
    }

    applySkinVisuals() {
        const skinId = (this.game && this.game.upgrader) ? this.game.upgrader.equippedSkin : 'classic';
        if (!window.skinManager) return;
        const tex = window.skinManager.getSkinTexture(skinId);

        if (this.armMat) {
            this.armMat.map = tex;
            this.armMat.needsUpdate = true;
        }
        if (this.mcModel) {
            this.mcModel.setSkinTexture(tex);
        }
    }

    updateHeldBlock() {
        if (!this.itemPivot) return;
        const it = this.getSelectedItem();

        if (!it) {
            // Bare hand (fist)
            if (this.heldBlockMesh) this.heldBlockMesh.visible = false;
            if (this.heldToolMesh) this.heldToolMesh.visible = false;
            if (this.armMesh) {
                this.armMesh.visible = true;
                this.armMesh.position.set(-0.06, 0, 0);
            }
            return;
        }

        const reg = ITEM_REGISTRY[it.itemId];
        if (this.armMesh) {
            this.armMesh.visible = true;
            this.armMesh.position.set(0, 0, 0);
        }

        if (reg && reg.category === 'block') {
            if (this.heldBlockMesh) {
                this.heldBlockMesh.visible = true;
                this.heldBlockMesh.material = this.game.textureManager.getBlockMaterial(reg.blockType);
            }
            if (this.heldToolMesh) this.heldToolMesh.visible = false;
        } else {
            // Weapon, tool, food, or item
            if (this.heldBlockMesh) this.heldBlockMesh.visible = false;
            if (this.heldToolMesh) {
                this.heldToolMesh.visible = true;
                const iconName = reg ? reg.icon : 'stone';
                const tex = this.game.textureManager.getTexture(iconName);
                if (this.heldToolMat.map !== tex) {
                    this.heldToolMat.map = tex;
                    this.heldToolMat.needsUpdate = true;
                }

                if (reg && (reg.category === 'weapon' || reg.category === 'tool')) {
                    // Sword / pickaxe: angled forward ready to slash
                    this.heldToolMesh.scale.set(1.15, 1.15, 1.0);
                    this.heldToolMesh.position.set(-0.04, 0.22, -0.18);
                    this.heldToolMesh.rotation.set(-0.35, 0.75, -0.42);
                } else {
                    // Food, junk, material: held in hand
                    this.heldToolMesh.scale.set(0.85, 0.85, 1.0);
                    this.heldToolMesh.position.set(-0.02, 0.12, -0.14);
                    this.heldToolMesh.rotation.set(-0.15, 0.45, -0.15);
                }
            }
        }

        // Also update held item in 3rd person model
        if (this.mcModel && this.mcModel.itemContainer) {
            while (this.mcModel.itemContainer.children.length > 0) {
                this.mcModel.itemContainer.remove(this.mcModel.itemContainer.children[0]);
            }
            if (it && reg) {
                if (reg.category === 'block') {
                    const bMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.24, 0.24, 0.24),
                        this.game.textureManager.getBlockMaterial(reg.blockType)
                    );
                    bMesh.position.set(0, -0.1, 0.1);
                    this.mcModel.itemContainer.add(bMesh);
                } else {
                    const iconName = reg.icon || 'stone';
                    const tex = this.game.textureManager.getTexture(iconName);
                    const tMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
                    const tMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), tMat);
                    tMesh.position.set(0, -0.08, 0.12);
                    tMesh.rotation.set(-0.35, 0.75, -0.42);
                    this.mcModel.itemContainer.add(tMesh);
                }
            }
        }
    }

    toggleThirdPerson() {
        this.isThirdPerson = !this.isThirdPerson;
        if (this.playerBodyGroup) this.playerBodyGroup.visible = this.isThirdPerson;
        if (this.handGroup) this.handGroup.visible = !this.isThirdPerson;
        if (this.soundManager) this.soundManager.playClick();
    }

    // --- COMBAT WEAPON STATS & BLOCKING ---
    getWeaponAttackSpeed() {
        const item = this.getSelectedItem();
        if (!item) return 4.0; // Bare fists: very fast (0.25s)
        const reg = window.ITEM_REGISTRY ? ITEM_REGISTRY[item.itemId] : null;
        if (!reg) return 4.0;
        if (reg.attackSpeed) return reg.attackSpeed;
        if (reg.isGun) return 6.0;
        return 2.5;
    }

    getAttackDamageMultiplier() {
        const progress = Math.min(1.0, Math.max(0.0, this.attackCooldown));
        return 0.2 + 0.8 * (progress * progress);
    }

    setBlocking(blocking) {
        if (blocking && !this.isBlocking) {
            this.blockStartTime = performance.now();
        }
        this.isBlocking = !!blocking;
    }

    // Health, Hunger, Damage & Food
    takeDamage(amount, reason = "Ти здох!") {
        if (this.godMode || this.isCreative || this.isDead) return;

        // 0. Evasion frames from Dodge Roll (i-frames)
        if (this.dodgeRollInvulnerable) return;

        // 1. Divine Shield from Totem of Undying
        if (this.totemInvulnerableTimer > 0) return;

        if (window.modManager) {
            const res = window.modManager.triggerEvent("onPlayerDamage", amount, reason);
            if (res === false) return;
        }

        // 2. Check Shield & Sword Blocking / Perfect Parry
        if (this.isBlocking) {
            const held = this.getSelectedItem();
            const reg = (held && window.ITEM_REGISTRY) ? ITEM_REGISTRY[held.itemId] : null;
            const isShield = reg && reg.isShield;
            const isSword = reg && reg.isSword;
            if (isShield || isSword) {
                const blockDuration = (performance.now() - (this.blockStartTime || 0)) / 1000;
                // Perfect Parry window: block pressed within 0.28 seconds of hit!
                const isParry = blockDuration <= 0.28;

                if (isParry) {
                    if (this.soundManager) this.soundManager.playParry();
                    if (this.particleSystem) {
                        this.particleSystem.spawnCritParticles(this.position.x, this.position.y + 1.2, this.position.z, 28);
                    }
                    if (this.game && this.game.triggerCameraShake) this.game.triggerCameraShake(0.35);
                    if (this.game && this.game.ui) {
                        this.game.ui.showToast("⚡ ІДЕАЛЬНЕ ПАРУВАННЯ! 100% захист + Контратака!");
                    }
                    this.parryCounterBonus = 2.0; // Next strike does 2x damage!
                    return; // 100% damage blocked!
                }

                const blockPct = isShield ? 0.90 : 0.55; // Shield 90% block, Sword parry 55% block
                const blockedDmg = Math.round(amount * blockPct);
                amount = Math.max(0, amount - blockedDmg);

                if (this.soundManager) this.soundManager.playShieldBlock();
                if (this.particleSystem) {
                    this.particleSystem.spawnShieldBlockParticles(this.position.x, this.position.y + 1.2, this.position.z, 14);
                }
                if (this.game && this.game.ui) {
                    this.game.ui.showToast(isShield ? "🛡️ Заблоковано щитом (-90%)" : "⚔️ Спаровано мечем (-55%)");
                }
                if (amount <= 0) return;
            }
        }

        // Apply Upgrader Defense reduction
        if (this.game.upgrader) {
            const red = this.game.upgrader.getDamageReduction();
            amount = Math.max(1, Math.round(amount * (1 - red)));
        }

        // --- 3. CHECK TOTEM OF UNDYING (Lethal damage prevention) ---
        if (this.health - amount <= 0) {
            let totemSlot = -1;
            const held = this.getSelectedItem();
            if (held && held.itemId === ITEM_TYPES.TOTEM_OF_UNDYING) {
                totemSlot = this.selectedHotbarIndex;
            } else {
                for (let i = 0; i < this.inventory.length; i++) {
                    if (this.inventory[i] && this.inventory[i].itemId === ITEM_TYPES.TOTEM_OF_UNDYING) {
                        totemSlot = i;
                        break;
                    }
                }
            }

            if (totemSlot !== -1) {
                this.consumeTotem(totemSlot);
                return; // Death prevented by totem!
            }
        }

        this.health = Math.max(0, this.health - amount);
        this.soundManager.playHurt();

        if (this.game && this.game.flashDamageScreen) {
            this.game.flashDamageScreen();
        }

        if (this.health <= 0) {
            this.isDead = true;
            this.deathReason = reason;
            this.iq -= 50;
            this.soundManager.speakRandomMeme(["Ой бля, ти здох!", "Ну все, приїхали!", "Єблан розбився!"]);
        }
    }

    // Consume Totem of Undying upon lethal damage
    consumeTotem(slot) {
        if (this.inventory[slot]) {
            this.inventory[slot].count -= 1;
            if (this.inventory[slot].count <= 0) {
                this.inventory[slot] = null;
            }
        }
        // Resurrect with 75% max HP and full food
        this.health = Math.max(this.health, Math.round(this.maxHealth * 0.75));
        this.hunger = 100;
        this.totemInvulnerableTimer = 3.5;
        this.isLavaSubmerged = false;

        if (this.soundManager) {
            this.soundManager.playTotemActivate();
        }
        if (this.particleSystem && this.particleSystem.spawnTotemParticles) {
            this.particleSystem.spawnTotemParticles(this.position.x, this.position.y + 1.0, this.position.z);
        }
        if (this.game && this.game.triggerCameraShake) {
            this.game.triggerCameraShake(0.5);
        }
        if (this.game && this.game.ui && this.game.ui.triggerTotemAnimation) {
            this.game.ui.triggerTotemAnimation();
        }
        if (this.game && this.game.ui) {
            this.game.ui.showToast("✨ ТОТЕМ БЕЗСМЕРТЯ ВРЯТУВАВ ВАС ВІД ЗАГИБЕЛІ!");
        }
    }

    // Tactical Dodge Roll / Dash (i-frames)
    tryDodgeRoll(dirVector = null) {
        if (this.dodgeCooldown > 0 || this.isDead || this.mountedVehicle || this.isInWater || this.isInLava) return false;

        this.dodgeCooldown = 1.1; // 1.1s cooldown
        this.dodgeRollInvulnerable = true;
        this.dodgeTimer = 0.32; // 0.32s i-frames

        let rollDir = new THREE.Vector3();
        if (dirVector && (dirVector.x !== 0 || dirVector.y !== 0)) {
            const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
            const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
            rollDir.addScaledVector(forward, dirVector.y);
            rollDir.addScaledVector(right, -dirVector.x);
            if (rollDir.lengthSq() > 0.01) rollDir.normalize();
        } else {
            rollDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
        }

        const rollForce = 15.5;
        this.velocity.x = rollDir.x * rollForce;
        this.velocity.z = rollDir.z * rollForce;
        if (this.onGround) this.velocity.y = 2.4;

        if (this.soundManager) this.soundManager.playDodgeRoll();
        if (this.particleSystem) {
            this.particleSystem.spawnBlockBreakParticles(this.position.x, this.position.y + 0.1, this.position.z, BLOCK_TYPES.DIRT, 8);
        }
        if (this.game && this.game.ui) {
            this.game.ui.showToast("💨 УХИЛЕННЯ! (i-frames)");
        }
        return true;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    eatFood() {
        const item = this.getSelectedItem();
        if (!item) return false;
        const reg = ITEM_REGISTRY[item.itemId];
        if (!reg || reg.category !== 'food') return false;

        if (this.hunger >= 100 && this.health >= this.maxHealth) return false;

        this.hunger = Math.min(this.maxHunger, this.hunger + (reg.foodRestore || 20));
        if (reg.hpRestore) this.heal(reg.hpRestore);

        this.soundManager.playEat();
        this.armSwing = 1.0;

        // Consume 1 food
        item.count -= 1;
        if (item.count <= 0) {
            this.inventory[this.selectedHotbarIndex] = null;
        }

        this.saveInventory();
        this.updateHeldBlock();
        if (this.game.ui) this.game.ui.initHotbar();
        return true;
    }

    // Raycast for Blocks & Mobs
    updateRaycast() {
        const maxDist = this.customReach || (this.isCreative ? 10.0 : 5.2);
        const origin = this._rayOrigin.set(
            this.position.x,
            this.position.y + this.eyeHeight,
            this.position.z
        );

        const dir = this._rayDir.set(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        const step = 0.05;
        const prevPos = this._rayPrevPos.copy(origin);
        const currentPos = this._rayCurrentPos.copy(origin);

        this.targetBlock = null;
        let lastBx = -999999, lastBy = -999999, lastBz = -999999;

        for (let d = 0; d < maxDist; d += step) {
            currentPos.addScaledVector(dir, step);
            const bx = Math.floor(currentPos.x);
            const by = Math.floor(currentPos.y);
            const bz = Math.floor(currentPos.z);

            if (bx === lastBx && by === lastBy && bz === lastBz) {
                prevPos.copy(currentPos);
                continue;
            }
            lastBx = bx;
            lastBy = by;
            lastBz = bz;

            const block = this.world.getBlock(bx, by, bz);
            if (block !== BLOCK_TYPES.AIR && block !== BLOCK_TYPES.WATER) {
                const pbx = Math.floor(prevPos.x);
                const pby = Math.floor(prevPos.y);
                const pbz = Math.floor(prevPos.z);

                let nx = pbx - bx;
                let ny = pby - by;
                let nz = pbz - bz;

                if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) !== 1) {
                    if (Math.abs(currentPos.x - (bx + 0.5)) > 0.48) nx = Math.sign(currentPos.x - (bx + 0.5));
                    else if (Math.abs(currentPos.y - (by + 0.5)) > 0.48) ny = Math.sign(currentPos.y - (by + 0.5));
                    else if (Math.abs(currentPos.z - (bz + 0.5)) > 0.48) nz = Math.sign(currentPos.z - (bz + 0.5));
                }

                this.targetBlock = {
                    hit: true,
                    x: bx,
                    y: by,
                    z: bz,
                    nx: nx || 0,
                    ny: ny || 0,
                    nz: nz || 0,
                    type: block
                };
                break;
            }
            prevPos.copy(currentPos);
        }

        // Update wireframe box outline
        if (this.targetBlock) {
            this.wireframeBox.visible = true;
            this.wireframeBox.position.set(
                this.targetBlock.x + 0.5,
                this.targetBlock.y + 0.5,
                this.targetBlock.z + 0.5
            );
        } else {
            this.wireframeBox.visible = false;
        }
    }

    // Combat Attack check against Mobs, Boss Dragon, or Remote Players (Modern Skill-Based Tactical Combat)
    attackMob() {
        // Whiff lag recovery check (cannot attack during miss recovery)
        if (this.whiffLagTimer > 0) return false;

        const origin = new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
        const dir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        this.armSwing = 1.0;

        // Base damage from equipped tool/weapon (bare fists = 12 dmg)
        const heldItem = this.getSelectedItem();
        const reg = (heldItem && window.ITEM_REGISTRY) ? ITEM_REGISTRY[heldItem.itemId] : null;
        let rawBaseDmg = reg ? (reg.attackDamage || 12) : 12;

        // Apply Upgrader damage multiplier
        if (this.game.upgrader) {
            rawBaseDmg = this.game.upgrader.getEffectiveDamage(rawBaseDmg);
        }

        // --- ATTACK COOLDOWN ---
        const cooldown = Math.min(1.0, Math.max(0.0, this.attackCooldown));
        this.attackCooldown = 0.0; // Reset attack charge

        // --- 3-HIT RHYTHMIC COMBO SYSTEM ---
        const now = performance.now();
        const deltaSinceLastHit = (now - (this.lastAttackHitTime || 0)) / 1000;
        let comboMult = 1.0;
        let isFinisher = false;

        if (this.lastAttackHitTime > 0 && deltaSinceLastHit >= 0.22 && deltaSinceLastHit <= 0.85) {
            this.comboStep = ((this.comboStep || 0) + 1) % 3;
            if (this.comboStep === 1) {
                comboMult = 1.35; // Strike 2: Slash (+35%)
            } else if (this.comboStep === 2) {
                comboMult = 1.95; // Strike 3: Heavy Finisher (+95%)
                isFinisher = true;
            }
        } else if (this.lastAttackHitTime > 0 && deltaSinceLastHit < 0.22) {
            // Mashing too fast before weapon recovery -> glancing blow!
            comboMult = 0.45;
            this.comboStep = 0;
            if (this.game && this.game.ui) {
                this.game.ui.showToast("⚠️ Занадто швидкий спам! Удар ковзний (-55%)");
            }
        } else {
            this.comboStep = 0; // Strike 1: Jab
        }

        // Apply Parry Counterattack Bonus
        if (this.parryCounterBonus && this.parryCounterBonus > 1.0) {
            comboMult *= this.parryCounterBonus;
            this.parryCounterBonus = 1.0;
            if (this.game && this.game.ui) {
                this.game.ui.showToast("💥 КОНТРАТАКА ПІСЛЯ ПАРУВАННЯ (x2)!");
            }
        }

        const cooldownMult = 0.2 + 0.8 * (cooldown * cooldown);
        const isFullCharge = (cooldown >= 0.85);

        // --- CRITICAL HIT (КРИТ) ---
        const isFalling = (this.velocity.y < -0.05) && !this.onGround;
        const notSubmerged = !this.isInWater && !this.isInLava && !this.isFlying;
        const isCrit = isFalling && notSubmerged && isFullCharge;

        // --- SWEEPING ATTACK (СВИП МЕЧОМ) ---
        const isSword = reg && reg.isSword;
        const isSweep = isSword && (cooldown >= 0.95) && !isCrit;

        // --- SPRINT KNOCKBACK (W-TAP) ---
        const isSprintHit = this.isSprinting && (cooldown >= 0.7);
        const knockbackPower = (isSprintHit ? 2.2 : (0.6 + 0.4 * cooldown)) * (isCrit ? 1.4 : 1.0) * (isFinisher ? 2.4 : 1.0);
        if (isSprintHit) {
            this.isSprinting = false;
        }

        let baseDmg = Math.round(rawBaseDmg * cooldownMult * (isCrit ? 1.6 : 1.0) * comboMult);
        baseDmg = Math.max(1, baseDmg);

        let hitAny = false;
        const reach = this.customReach || (this.isCreative ? 8.0 : 4.8);
        const kbDir = new THREE.Vector3(dir.x, 0.38, dir.z).normalize().multiplyScalar(knockbackPower);

        // 0. Check Multiplayer PvP (Precise Hitbox)
        if (this.game.multiplayer) {
            if (this.game.multiplayer.checkPvPHit(origin, dir, reach, baseDmg, isCrit, isSweep, kbDir)) {
                hitAny = true;
            }
        }

        // 1. Check End Crystals
        if (this.game.mobManager) {
            for (let c of this.game.mobManager.crystals) {
                if (!c.isDestroyed && c.group) {
                    if (this.position.distanceTo(c.group.position) < reach + 1.2) {
                        c.takeDamage(10);
                        hitAny = true;
                    }
                }
            }

            // 2. Check Dragon Boss
            const dragon = this.game.mobManager.dragon;
            if (dragon && !dragon.isDead && dragon.mesh) {
                const dist = this.position.distanceTo(dragon.mesh.position);
                if (dist < 14.0) {
                    let dragonDmg = baseDmg;
                    const skin = (this.game.upgrader && window.SKINS_REGISTRY) ? SKINS_REGISTRY[this.game.upgrader.equippedSkin] : null;
                    if (skin && skin.buffs && skin.buffs.bossDamageMult) dragonDmg *= skin.buffs.bossDamageMult;

                    dragon.takeDamage(dragonDmg);
                    if (this.particleSystem) {
                        if (isCrit || isFinisher) {
                            this.particleSystem.spawnCritParticles(dragon.mesh.position.x, dragon.mesh.position.y + 1.5, dragon.mesh.position.z, 28);
                        } else {
                            this.particleSystem.spawnBlockBreakParticles(dragon.mesh.position.x, dragon.mesh.position.y, dragon.mesh.position.z, BLOCK_TYPES.DRAGON_EGG, 14);
                        }
                    }
                    if (this.game.ui && this.game.ui.spawnFloatingDamage) {
                        this.game.ui.spawnFloatingDamage(dragon.mesh.position.x, dragon.mesh.position.y + 2.0, dragon.mesh.position.z, dragonDmg, isCrit || isFinisher, false);
                    }
                    hitAny = true;
                }
            }

            // 3. Check Normal Mobs (Strict Crosshair Raycast to Cylinder Hitbox)
            let primaryMob = null;
            let closestDist = 999;

            for (let mob of this.game.mobManager.mobs) {
                if (!mob.isDead && mob.group) {
                    const mobCenter = mob.position.clone().add(new THREE.Vector3(0, (mob.height || 1.8) * 0.5, 0));
                    const toMob = mobCenter.sub(origin);
                    const distAlongRay = toMob.dot(dir);

                    if (distAlongRay > 0 && distAlongRay < reach) {
                        const perpDist = toMob.sub(dir.clone().multiplyScalar(distAlongRay)).length();
                        const hitboxRadius = (mob.width || 0.65) * 0.95 + 0.18; // Precise cylinder

                        if (perpDist <= hitboxRadius && distAlongRay < closestDist) {
                            closestDist = distAlongRay;
                            primaryMob = mob;
                        }
                    }
                }
            }

            if (primaryMob) {
                primaryMob.takeDamage(baseDmg, kbDir);
                hitAny = true;

                if (this.particleSystem && (isCrit || isFinisher)) {
                    this.particleSystem.spawnCritParticles(primaryMob.position.x, primaryMob.position.y + 0.9, primaryMob.position.z, isFinisher ? 32 : 22);
                }
                if (this.game.ui && this.game.ui.spawnFloatingDamage) {
                    this.game.ui.spawnFloatingDamage(primaryMob.position.x, primaryMob.position.y + 1.1, primaryMob.position.z, baseDmg, isCrit || isFinisher, false);
                }

                // Sweeping Edge: secondary mobs in cone receive 50% sweep damage and knockback
                if (isSweep) {
                    const sweepDmg = Math.max(1, Math.round(baseDmg * 0.5));
                    for (let other of this.game.mobManager.mobs) {
                        if (other !== primaryMob && !other.isDead && other.group) {
                            const toOther = other.position.clone().sub(this.position);
                            const d = toOther.length();
                            if (d < reach) {
                                const dot = dir.dot(toOther.normalize());
                                if (dot > 0.35) {
                                    const sweepKb = toOther.normalize().multiplyScalar(0.7);
                                    other.takeDamage(sweepDmg, sweepKb);
                                    if (this.game.ui && this.game.ui.spawnFloatingDamage) {
                                        this.game.ui.spawnFloatingDamage(other.position.x, other.position.y + 1.0, other.position.z, sweepDmg, false, true);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- WHIFF / MISS PENALTY (Anti-Spam / Anti-Tap) ---
        if (!hitAny) {
            this.whiffLagTimer = 0.38; // 0.38s recovery lag
            this.attackCooldown = 0.0; // Reset charge
            this.comboStep = 0; // Break combo
            if (this.soundManager) this.soundManager.playWhiff();
            return false;
        }

        // Combat Audio, Visual Effects & Combos
        this.lastAttackHitTime = performance.now();
        if (isFinisher) {
            if (this.soundManager) this.soundManager.playFinisherHit();
            if (this.game && this.game.triggerCameraShake) this.game.triggerCameraShake(0.45);
            if (this.game && this.game.ui) {
                this.game.ui.showToast("💥 КОМБО-ФІНІШЕР x3! (+95% урону)");
            }
        } else if (this.comboStep === 1) {
            if (this.soundManager) this.soundManager.playStrongHit();
            if (this.game && this.game.ui) {
                this.game.ui.showToast("⚡ СЕРІЙНИЙ УДАР x2 (+35% урону)");
            }
        } else if (isCrit) {
            if (this.soundManager) this.soundManager.playCritHit();
            if (this.game && this.game.triggerCameraShake) this.game.triggerCameraShake(0.35);
        } else if (isSprintHit) {
            if (this.soundManager) this.soundManager.playStrongHit();
            if (this.game && this.game.triggerCameraShake) this.game.triggerCameraShake(0.25);
        } else if (isSweep) {
            if (this.soundManager) this.soundManager.playSweep();
        } else {
            if (this.soundManager) this.soundManager.playStrongHit();
        }

        if (isSweep && this.particleSystem) {
            this.particleSystem.spawnSweepParticles(origin, dir);
        }

        // Combo counter
        this.comboCounter = (this.comboTimer > 0 ? this.comboCounter + 1 : 1);
        this.comboTimer = 2.5;
        if (this.comboCounter >= 3 && this.game.ui) {
            this.game.ui.showToast(`🔥 КОМБО x${this.comboCounter}!`);
        }

        if (window.modManager) {
            window.modManager.triggerEvent("onAttack", hitAny ? "hit" : "miss", baseDmg);
        }
        return hitAny;
    }

    // Update Mining Progress & Speed
    updateMining(dt) {
        if (!this.isMining || !this.targetBlock) {
            this.miningProgress = 0.0;
            return;
        }

        const { x, y, z, type } = this.targetBlock;

        if (type === BLOCK_TYPES.BEDROCK && !this.isCreative) {
            this.soundManager.speakRandomMeme(["Бедрок не ламається, єблан!"]);
            this.miningProgress = 0;
            this.isMining = false;
            return;
        }

        // Special: Instant ignite TNT
        if (type === BLOCK_TYPES.TNT) {
            if (window.modManager && !window.modManager.canBreakBlock(x, y, z, type, this)) {
                this.miningProgress = 0;
                this.isMining = false;
                return;
            }
            this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
            this.world.updateMeshes();
            new TNTEntity(x, y, z, this.scene, this.game.textureManager, this.soundManager, this.world, this.particleSystem, this.game);
            this.iq += 15;
            this.miningProgress = 0;
            this.isMining = false;
            return;
        }

        // Creative / Godmode / Instant Break
        if (this.godMode || this.isCreative || this.instantBreak) {
            this.finishBreakingBlock();
            return;
        }

        // Calculate break speed for survival
        const info = BLOCK_INFO[type] || { hardness: 1.0 };
        const hardness = info.hardness || 1.0;
        const heldItem = this.getSelectedItem();
        const reg = heldItem ? ITEM_REGISTRY[heldItem.itemId] : null;
        let toolSpeed = reg ? (reg.miningSpeed || 1.0) : 1.0;
        let effectiveSpeed = (this.game.upgrader) ? this.game.upgrader.getEffectiveMiningSpeed(toolSpeed) : toolSpeed;

        // Time to break in seconds
        const breakDuration = Math.max(0.08, (hardness / effectiveSpeed) * 0.9);
        this.miningProgress += dt / breakDuration;

        // Rhythmic arm swing and chipping sounds
        this.armSwing = 1.0;
        this.miningSoundTimer += dt;
        if (this.miningSoundTimer > 0.22) {
            this.miningSoundTimer = 0;
            this.soundManager.playChip();
            this.particleSystem.spawnBlockBreakParticles(x, y, z, type, 3);
            // Drain small hunger while digging
            this.hunger = Math.max(0, this.hunger - 0.15);
        }

        // Completed breaking
        if (this.miningProgress >= 1.0) {
            this.finishBreakingBlock();
        }
    }

    finishBreakingBlock() {
        if (!this.targetBlock) return;
        const { x, y, z, type } = this.targetBlock;

        if (window.modManager) {
            const canBreak = window.modManager.canBreakBlock(x, y, z, type, this);
            if (!canBreak) {
                this.miningProgress = 0.0;
                return;
            }
        }

        this.soundManager.playBreak(BLOCK_INFO[type]?.sound || 'stone');
        this.particleSystem.spawnBlockBreakParticles(x, y, z, type, 16);
        this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        this.world.updateMeshes();

        if (this.game.multiplayer) {
            this.game.multiplayer.broadcastBlockBreak(x, y, z, type);
        }

        // 3D Item Drops in World (Only in survival)
        if (this.game.mobManager && !this.isCreative) {
            const blockDef = (window.BLOCK_INFO) ? window.BLOCK_INFO[type] : null;
            const dropItemId = (blockDef && blockDef.dropItem !== undefined) ? blockDef.dropItem : BLOCK_DROP_MAP[type];
            if (dropItemId) {
                let dropCount = (blockDef && blockDef.dropCount) ? Number(blockDef.dropCount) : 1;
                // Fortune double drop check
                const fortuneChance = (this.game.upgrader) ? this.game.upgrader.getFortuneChance() : 0;
                if (Math.random() < fortuneChance) dropCount *= 2;

                this.game.mobManager.spawnItemDrop(x + 0.5, y + 0.5, z + 0.5, dropItemId, dropCount, 0.35);
            }

            // 12% Chance of Random Junk Drop (Sock, Beer, Cig, Nut)
            if (Math.random() < 0.12) {
                const junkId = JUNK_ITEMS_POOL[Math.floor(Math.random() * JUNK_ITEMS_POOL.length)];
                this.game.mobManager.spawnItemDrop(x + 0.5, y + 0.5, z + 0.5, junkId, 1, 0.35);
            }
        }

        // IQ updates
        if (type === BLOCK_TYPES.DIAMOND_BLOCK || type === BLOCK_TYPES.NETHERITE_BLOCK) {
            this.iq += 100;
            this.soundManager.speakRandomMeme(["Алмази знайшов!", "Оце скарб!"]);
        } else if (type === BLOCK_TYPES.EBLAN_BLOCK) {
            this.iq -= 25;
            this.soundManager.speakRandomMeme(["Навіщо ти зламав єблана?!"]);
        } else {
            this.iq += 2;
        }

        this.miningProgress = 0.0;
    }

    // Place Block Action
    placeBlock() {
        // If holding a vehicle item, spawn and mount vehicle!
        const heldItem = this.getSelectedItem();
        const heldReg = heldItem ? ITEM_REGISTRY[heldItem.itemId] : null;
        if (heldReg && (heldReg.isVehicle || heldReg.category === 'vehicle')) {
            const vMgr = (window.modManager && window.modManager.vehicleManager) || (this.game && this.game.modManager && this.game.modManager.vehicleManager);
            if (vMgr) {
                const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
                const spawnPos = this.position.clone().add(forward.multiplyScalar(2.6));
                spawnPos.y += 0.6;
                const vId = vMgr.spawn(heldReg.vehicleType || 'sport', spawnPos.x, spawnPos.y, spawnPos.z, { yaw: this.yaw });
                const veh = vMgr.vehicles.get(vId);
                if (veh) {
                    if (!this.isCreative) {
                        this.removeItem(heldItem.itemId, 1);
                    }
                    this.mountVehicle(veh);
                    if (this.game && this.game.soundManager) this.game.soundManager.playDoor();
                    if (this.game && this.game.ui) this.game.ui.showToast(`🚗 Ви сіли в ${heldReg.name}! [W/A/S/D] - Їзда, [F] - Вийти, [H] - Сигнал, [L] - Фари`);
                }
                return;
            }
        }

        // If clicking near a parked vehicle, mount it!
        const vMgr = (window.modManager && window.modManager.vehicleManager) ||
                     (this.game && this.game.vehicleManager) ||
                     (this.game && this.game.modManager && this.game.modManager.vehicleManager);
        if (vMgr && !this.mountedVehicle) {
            const nearbyV = vMgr.getNearbyVehicles(this.position, 4.2);
            if (nearbyV.length > 0 && !nearbyV[0].driver) {
                this.mountVehicle(nearbyV[0]);
                if (this.game && this.game.soundManager) this.game.soundManager.playDoor();
                return;
            }
        }

        // If holding grenade, throw grenade!
        if (heldReg && heldReg.isThrowable) {
            this.tryThrowGrenade();
            return;
        }

        // If holding sniper rifle (AWP), toggle scope!
        if (heldReg && heldReg.gunType === 'awp') {
            this.toggleScope();
            return;
        }

        // If right-clicking a mob (e.g. Villager for trading)
        const origin = new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
        const lookDir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();
        if (this.game && this.game.mobManager) {
            for (let mob of this.game.mobManager.mobs) {
                if (!mob.isDead && mob.group && mob.type === 'villager') {
                    const toMob = mob.position.clone().sub(this.position);
                    if (toMob.length() < 4.8) {
                        const dot = lookDir.dot(toMob.clone().normalize());
                        if (dot > 0.55) {
                            mob.interact(this);
                            return;
                        }
                    }
                }
            }
        }

        // If holding food, try eating instead!
        const item = this.getSelectedItem();
        if (item && ITEM_REGISTRY[item.itemId]?.category === 'food') {
            this.eatFood();
            return;
        }

        // If holding portal activation item
        if (item && item.itemId === ITEM_TYPES.PORTAL_END) {
            this.world.switchDimension('the_end');
            return;
        }

        if (!this.targetBlock) return;

        const { x, y, z, nx, ny, nz, type } = this.targetBlock;

        // ⚡ Interactive Block Click Check (Lever, Button, Computer)
        if (type === BLOCK_TYPES.LEVER) {
            const redstone = (this.game && this.game.redstoneEngine) || (window.game && window.game.redstoneEngine);
            if (redstone) {
                redstone.toggleLever(x, y, z);
                this.armSwing = 0.5;
                return;
            }
        }
        if (type === BLOCK_TYPES.STONE_BUTTON) {
            const redstone = (this.game && this.game.redstoneEngine) || (window.game && window.game.redstoneEngine);
            if (redstone) {
                redstone.pressButton(x, y, z);
                this.armSwing = 0.5;
                return;
            }
        }
        if (type === BLOCK_TYPES.COMPUTER) {
            if (this.game && this.game.ui && this.game.ui.openEmuOSModal) {
                this.game.ui.openEmuOSModal();
                this.armSwing = 0.5;
                return;
            }
        }

        // Interactive check on clicked block
        if (window.modManager) {
            const canInteract = window.modManager.canInteractBlock(x, y, z, type, this);
            if (canInteract === false) return;
        }

        // Placement cooldown to prevent double-tap lag and duplicate events
        const now = performance.now();
        if (this._lastPlaceTime && (now - this._lastPlaceTime < 160)) {
            return;
        }
        this._lastPlaceTime = now;

        const px = x + nx;
        const py = y + ny;
        const pz = z + nz;

        if (py < 0 || py >= CHUNK_SIZE_Y) return;

        // Collision check with player
        const playerMinX = this.position.x - this.width / 2;
        const playerMaxX = this.position.x + this.width / 2;
        const playerMinY = this.position.y;
        const playerMaxY = this.position.y + this.height;
        const playerMinZ = this.position.z - this.depth / 2;
        const playerMaxZ = this.position.z + this.depth / 2;

        const intersectsPlayer = (
            playerMinX < px + 1 && playerMaxX > px &&
            playerMinY < py + 1 && playerMaxY > py &&
            playerMinZ < pz + 1 && playerMaxZ > pz
        );
        if (intersectsPlayer) return;

        const blockType = this.getSelectedBlockType();
        if (!blockType) return;

        if (window.modManager) {
            const canPlace = window.modManager.canPlaceBlock(px, py, pz, blockType, this);
            if (canPlace === false) return;
        }

        this.armSwing = 1.0;
        this.world.setBlock(px, py, pz, blockType);
        this.world.updateMeshes();

        if (this.game.multiplayer) {
            this.game.multiplayer.broadcastBlockPlace(px, py, pz, blockType);
        }

        this.soundManager.playPlace(BLOCK_INFO[blockType]?.sound || 'stone');

        // Consume block from inventory in survival
        if (!this.godMode && !this.isCreative && !this.infiniteBlocks) {
            item.count -= 1;
            if (item.count <= 0) {
                this.inventory[this.selectedHotbarIndex] = null;
            }
            this.saveInventoryDebounced();
            this.updateHeldBlock();
            if (this.game.ui) this.game.ui.initHotbar();
        }

        if (blockType === BLOCK_TYPES.EBLAN_BLOCK) {
            this.iq += 50;
            this.soundManager.speakRandomMeme(["О, ще один єблан!"]);
        }
    }

    // Detonate TNT / Bomb throw
    detonateTNT() {
        if (!this.hasItem(ITEM_TYPES.TNT, 1) && !this.godMode) {
            this.soundManager.speakRandomMeme(["Немає ТНТ в руках!"]);
            return;
        }

        if (!this.godMode) this.removeItem(ITEM_TYPES.TNT, 1);

        this.armSwing = 1.0;
        const origin = this.position.clone().add(new THREE.Vector3(0, this.eyeHeight - 0.2, 0));
        const dir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        const spawnPos = origin.clone().addScaledVector(dir, 1.2);
        const tnt = new TNTEntity(
            spawnPos.x - 0.5,
            spawnPos.y - 0.5,
            spawnPos.z - 0.5,
            this.scene,
            this.game.textureManager,
            this.soundManager,
            this.world,
            this.particleSystem,
            this.game
        );
        tnt.vx = dir.x * 14;
        tnt.vy = dir.y * 14 + 3.5;
        tnt.vz = dir.z * 14;

        if (this.game.multiplayer) {
            this.game.multiplayer.broadcastTNTExplode(spawnPos.x, spawnPos.y, spawnPos.z);
        }

        this.iq += 5;
    }

    checkCollision(pos) {
        if (this.noclip) return false;
        const minX = Math.floor(pos.x - this.width / 2 + 0.001);
        const maxX = Math.floor(pos.x + this.width / 2 - 0.001);
        const minY = Math.floor(pos.y + 0.001);
        const maxY = Math.floor(pos.y + this.height - 0.001);
        const minZ = Math.floor(pos.z - this.depth / 2 + 0.001);
        const maxZ = Math.floor(pos.z + this.depth / 2 - 0.001);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const b = this.world.getBlock(x, y, z);
                    if (!isPassThroughBlock(b)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    checkIsGrounded() {
        if (this.onGround) return true;
        const minX = Math.floor(this.position.x - this.width / 2 + 0.05);
        const maxX = Math.floor(this.position.x + this.width / 2 - 0.05);
        const testY = Math.floor(this.position.y - 0.15);
        const minZ = Math.floor(this.position.z - this.depth / 2 + 0.05);
        const maxZ = Math.floor(this.position.z + this.depth / 2 - 0.05);

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const b = this.world.getBlock(x, testY, z);
                if (!isPassThroughBlock(b)) {
                    return true;
                }
            }
        }
        return false;
    }

    checkPortals() {
        this.portalTimer += 0.016;
        if (this.portalTimer < 1.0) return;

        const bx = Math.floor(this.position.x);
        const by = Math.floor(this.position.y + 0.5);
        const bz = Math.floor(this.position.z);
        const b = this.world.getBlock(bx, by, bz);

        if (b === BLOCK_TYPES.PORTAL_NETHER) {
            this.portalTimer = 0;
            const target = this.world.dimension === 'nether' ? 'overworld' : 'nether';
            this.world.switchDimension(target);
        } else if (b === BLOCK_TYPES.PORTAL_END) {
            this.portalTimer = 0;
            const target = this.world.dimension === 'the_end' ? 'overworld' : 'the_end';
            this.world.switchDimension(target);
        }
    }

    updatePhysics(dt, inputVector, jumpPressed, flyUpPressed, flyDownPressed) {
        if (this.isDead) return;

        // Anti-stuck safety clearance: if player somehow ended up inside solid blocks
        if (this.checkCollision(this.position)) {
            for (let dy = 0.05; dy <= 2.5; dy += 0.1) {
                this._scratchNextPos.copy(this.position);
                this._scratchNextPos.y += dy;
                if (!this.checkCollision(this._scratchNextPos)) {
                    this.position.y += dy;
                    this.velocity.y = 0;
                    break;
                }
            }
        }

        // Modern Combat Attack Cooldown & Combo Timers
        if (this.attackCooldown < 1.0) {
            this.attackCooldown = Math.min(1.0, this.attackCooldown + dt * this.getWeaponAttackSpeed());
        }
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.comboCounter = 0;
        }
        if (this.whiffLagTimer > 0) {
            this.whiffLagTimer -= dt;
        }
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= dt;
        }
        if (this.dodgeTimer > 0) {
            this.dodgeTimer -= dt;
            if (this.dodgeTimer <= 0) {
                this.dodgeRollInvulnerable = false;
            }
        }
        if (this.totemInvulnerableTimer > 0) {
            this.totemInvulnerableTimer -= dt;
        }
        if (this.parryCounterBonus && performance.now() - (this.lastAttackHitTime || 0) > 2000) {
            this.parryCounterBonus = 1.0;
        }

        // Survival Hunger & Regeneration loop
        if (!this.godMode && !this.isCreative) {
            this.hungerTimer += dt;
            if (this.hungerTimer > 3.0) {
                this.hungerTimer = 0;
                // Drain hunger faster if sprinting
                const drain = this.isSprinting ? 1.5 : 0.4;
                this.hunger = Math.max(0, this.hunger - drain);

                // Natural regen if hunger > 80
                if (this.hunger > 80 && this.health < this.maxHealth) {
                    this.heal(3);
                }
                // Starvation damage if hunger is 0
                if (this.hunger <= 0) {
                    this.takeDamage(4, "Помер з голоду як справжній єблан!");
                }
            }
        }

        // Check Portal Stepping
        this.checkPortals();

        // Update Mining Progress
        this.updateMining(dt);

        // --- LIQUIDS (WATER & LAVA) & BREATHING CHECKS ---
        const px = Math.floor(this.position.x);
        const pyFeet = Math.floor(this.position.y);
        const pyWaist = Math.floor(this.position.y + 0.8);
        const pyHead = Math.floor(this.position.y + 1.55);
        const pz = Math.floor(this.position.z);
        const blockFeet = this.world.getBlock(px, pyFeet, pz);
        const blockWaist = this.world.getBlock(px, pyWaist, pz);
        const blockHead = this.world.getBlock(px, pyHead, pz);

        let blockEye = blockHead;
        if (this.camera) {
            blockEye = this.world.getBlock(
                Math.floor(this.camera.position.x),
                Math.floor(this.camera.position.y),
                Math.floor(this.camera.position.z)
            );
        }

        // 🌋 Molten Lava State Checks
        this.isInLava = (blockFeet === BLOCK_TYPES.LAVA || blockWaist === BLOCK_TYPES.LAVA || blockHead === BLOCK_TYPES.LAVA || blockEye === BLOCK_TYPES.LAVA);
        this.isLavaSubmerged = (blockHead === BLOCK_TYPES.LAVA || blockEye === BLOCK_TYPES.LAVA);

        if (this.isInLava) {
            // Lava damage
            const hasFireImmunity = (this.game.upgrader) ? this.game.upgrader.hasFireImmunity() : false;
            if (!this.godMode && !this.isCreative && !hasFireImmunity) {
                this.takeDamage(16 * dt, "Згорів у розпеченій лаві!");
            }

            // Sizzle audio and sparks
            this.lavaSizzleTimer = (this.lavaSizzleTimer || 0) - dt;
            if (this.lavaSizzleTimer <= 0) {
                this.lavaSizzleTimer = 0.45;
                if (this.soundManager && this.soundManager.playSizzle) this.soundManager.playSizzle();
                if (this.game && this.game.particleSystem && this.game.particleSystem.spawnLavaPopParticles) {
                    this.game.particleSystem.spawnLavaPopParticles(this.position.x, this.position.y + 0.4, this.position.z, 3);
                }
            }
        }

        // Lava splash entry/exit
        if (this.isInLava && !this.wasInLava) {
            if (this.soundManager && this.soundManager.playSizzle) this.soundManager.playSizzle();
            if (this.game && this.game.particleSystem && this.game.particleSystem.spawnLavaPopParticles) {
                this.game.particleSystem.spawnLavaPopParticles(this.position.x, this.position.y + 0.2, this.position.z, 6);
            }
        }
        this.wasInLava = this.isInLava;

        this.isInWater = (blockFeet === BLOCK_TYPES.WATER || blockWaist === BLOCK_TYPES.WATER || blockHead === BLOCK_TYPES.WATER || blockEye === BLOCK_TYPES.WATER);
        this.isSubmerged = (blockHead === BLOCK_TYPES.WATER || blockEye === BLOCK_TYPES.WATER);

        // Splash entry/exit
        this.splashCooldown = (this.splashCooldown || 0) - dt;
        if (this.isInWater && !this.wasInWater) {
            if (this.splashCooldown <= 0) {
                this.splashCooldown = 0.35;
                if (this.soundManager && this.soundManager.playSplash) this.soundManager.playSplash();
                if (this.game && this.game.particleSystem && this.game.particleSystem.spawnBubbleParticles) {
                    this.game.particleSystem.spawnBubbleParticles(this.position.x, this.position.y + 0.5, this.position.z, 10);
                }
            }
        } else if (!this.isInWater && this.wasInWater) {
            if (this.splashCooldown <= 0) {
                this.splashCooldown = 0.35;
                if (this.soundManager && this.soundManager.playSplash) this.soundManager.playSplash();
            }
            // 🐬 Feature-Bug: Waterclip Dolphin Boost (імпульс при виході з води)
            this.waterExitBoostTimer = 0.35;
            this.velocity.y = Math.max(this.velocity.y, 3.9);
            if (this.game && this.game.particleSystem && this.game.particleSystem.spawnBubbleParticles) {
                this.game.particleSystem.spawnBubbleParticles(this.position.x, this.position.y + 0.2, this.position.z, 6);
            }
        }
        this.wasInWater = this.isInWater;

        // Underwater Breathing & Drowning System (controlled by toggle)
        const underwaterEnabled = !this.game || this.game.underwaterEffectsEnabled !== false;
        if (underwaterEnabled && !this.godMode && !this.isCreative) {
            if (this.isSubmerged) {
                // Drain oxygen (100 over ~20s)
                this.oxygen = Math.max(0, this.oxygen - dt * 5.0);
                if (this.oxygen <= 0) {
                    this.drownTimer += dt;
                    if (this.drownTimer >= 1.2) {
                        this.drownTimer = 0;
                        this.takeDamage(4, "Потонув у воді як справжній єблан!");
                    }
                }
                // Periodic rising breath bubbles
                this.bubbleParticleTimer += dt;
                if (this.bubbleParticleTimer >= 0.55) {
                    this.bubbleParticleTimer = 0;
                    if (this.game && this.game.particleSystem && this.game.particleSystem.spawnBubbleParticles) {
                        this.game.particleSystem.spawnBubbleParticles(
                            this.position.x + (Math.random() - 0.5) * 0.3,
                            this.position.y + 1.4,
                            this.position.z + (Math.random() - 0.5) * 0.3,
                            2
                        );
                    }
                }
            } else {
                // Quick oxygen recovery when surfacing
                this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 35.0);
                this.drownTimer = 0;
            }
        } else {
            this.oxygen = this.maxOxygen;
            this.drownTimer = 0;
        }

        // --- VEHICLE DRIVING PHYSICS ---
        if (this.mountedVehicle) {
            this.mountedVehicle.updateDriver(dt, inputVector, jumpPressed, this.isSprinting);
            this.position.copy(this.mountedVehicle.position);
            this.position.y += 0.35;
            this.velocity.set(0, 0, 0);
            this.onGround = true;
            this.timeSinceGrounded = 0;
        } else if (this.isFlying) {
            let baseSpeed = (this.isSprinting ? 7.5 : 4.5);
            if (this.speedMultiplier) baseSpeed *= this.speedMultiplier;
            if (this.game.upgrader) baseSpeed *= this.game.upgrader.getSpeedMultiplier();
            const sinYaw = Math.sin(this.yaw);
            const cosYaw = Math.cos(this.yaw);
            const moveX = inputVector.x * cosYaw - inputVector.y * sinYaw;
            const moveZ = -inputVector.x * sinYaw - inputVector.y * cosYaw;

            const flySpeed = (this.flySpeed || 11.0) * (this.isSprinting ? 1.6 : 1.0);
            this.velocity.x = moveX * flySpeed;
            this.velocity.z = moveZ * flySpeed;

            if (flyUpPressed || jumpPressed) {
                this.velocity.y = flySpeed;
            } else if (flyDownPressed) {
                this.velocity.y = -flySpeed;
            } else {
                this.velocity.y = 0;
            }

            // Move X
            const nextPosX = this._scratchNextPos.copy(this.position);
            nextPosX.x += this.velocity.x * dt;
            if (this.noclip || !this.checkCollision(nextPosX)) {
                this.position.x = nextPosX.x;
            }

            // Move Z
            const nextPosZ = this._scratchNextPos.copy(this.position);
            nextPosZ.z += this.velocity.z * dt;
            if (this.noclip || !this.checkCollision(nextPosZ)) {
                this.position.z = nextPosZ.z;
            }

            // Move Y
            const nextPosY = this._scratchNextPos.copy(this.position);
            nextPosY.y += this.velocity.y * dt;
            if (this.noclip || !this.checkCollision(nextPosY)) {
                this.position.y = nextPosY.y;
            }

            this.onGround = false;
            this.timeSinceGrounded = 0;
        } else {
            // Movement Speed with Skin and Mod modifier (phys* = Lua Physics API overrides)
            let baseSpeed = (this.isSprinting ? (this.physSprintSpeed ?? 7.5) : (this.physWalkSpeed ?? 4.5));
            if (this.speedMultiplier) baseSpeed *= this.speedMultiplier;
            if (this.game.upgrader) baseSpeed *= this.game.upgrader.getSpeedMultiplier();
            if (this.isBlocking) baseSpeed *= 0.45; // Shield/Sword blocking slowdown like in Minecraft

            // 🐬 Waterclip Dolphin Speed Boost (+30% boost for 0.35s upon water exit)
            if (this.waterExitBoostTimer > 0) {
                this.waterExitBoostTimer = Math.max(0, this.waterExitBoostTimer - dt);
                baseSpeed *= 1.30;
            }
            const sinYaw = Math.sin(this.yaw);
            const cosYaw = Math.cos(this.yaw);
            const moveX = inputVector.x * cosYaw - inputVector.y * sinYaw;
            const moveZ = -inputVector.x * sinYaw - inputVector.y * cosYaw;

            let isGroundedNow = false;

        if (this.isInLava) {
            baseSpeed *= 0.42; // Thick viscous molten magma drag
            this.velocity.x = moveX * baseSpeed;
            this.velocity.z = moveZ * baseSpeed;

            // Heavy molten buoyancy & struggle swim
            if (jumpPressed || flyUpPressed) {
                this.velocity.y = 2.4; // Struggling upward
                this.lavaSoundTimer = (this.lavaSoundTimer || 0) + dt;
                if (this.lavaSoundTimer > 0.4) {
                    this.lavaSoundTimer = 0;
                    if (this.soundManager && this.soundManager.playLavaPop) this.soundManager.playLavaPop();
                }
            } else if (flyDownPressed) {
                this.velocity.y = -2.8;
            } else {
                // Sinks slowly in dense molten rock
                this.velocity.y -= 2.0 * dt;
                if (this.velocity.y < -1.8) this.velocity.y = -1.8;
                this.velocity.y *= Math.pow(0.82, dt * 60);
            }
        } else if (this.isInWater) {
            baseSpeed *= 0.72; // Smooth water swimming speed
            this.velocity.x = moveX * baseSpeed;
            this.velocity.z = moveZ * baseSpeed;

            // Waterfall downward pull only if directly above an empty drop
            if (this.world) {
                const bx = Math.floor(this.position.x);
                const by = Math.floor(this.position.y);
                const bz = Math.floor(this.position.z);
                const blockUnder = this.world.getBlock(bx, by - 1, bz);
                if (blockUnder === BLOCK_TYPES.AIR) {
                    this.velocity.y -= 3.5 * dt;
                }
            }

            // Swimming upward/downward & buoyancy
            if (jumpPressed || flyUpPressed) {
                this.velocity.y = 3.6;
                this.swimSoundTimer += dt;
                if (this.swimSoundTimer > 0.45) {
                    this.swimSoundTimer = 0;
                    if (this.soundManager && this.soundManager.playSwim) this.soundManager.playSwim();
                }
            } else if (flyDownPressed) {
                this.velocity.y = -3.4;
            } else {
                // Slower sinking + gentle buoyancy bobbing
                this.velocity.y -= 4.0 * dt;
                if (this.velocity.y < -3.5) this.velocity.y = -3.5;
                this.velocity.y *= Math.pow(0.88, dt * 60);

                this.swimBobbingTimer += dt * 2.2;
                this.velocity.y += Math.sin(this.swimBobbingTimer) * 0.08 * dt;
            }

            const isMoving = Math.abs(inputVector.x) > 0.1 || Math.abs(inputVector.y) > 0.1;
            if (isMoving && !jumpPressed && !flyUpPressed) {
                this.swimSoundTimer += dt;
                if (this.swimSoundTimer > 0.65) {
                    this.swimSoundTimer = 0;
                    if (this.soundManager && this.soundManager.playSwim) this.soundManager.playSwim();
                }
            }

            this.onGround = false;
            this.timeSinceGrounded = 999;
            isGroundedNow = false;
        } else {
            // Gravity
            this.velocity.y -= (this.physGravity ?? 22.0) * dt;
            if (this.velocity.y < -30) this.velocity.y = -30;

            // Jump buffer & cooldown timers
            if (jumpPressed) {
                this.jumpBufferTimer = 0.18;
            } else if (this.jumpBufferTimer > 0) {
                this.jumpBufferTimer -= dt;
            }
            if (this.jumpCooldown > 0) {
                this.jumpCooldown -= dt;
            }

            isGroundedNow = this.onGround || this.checkIsGrounded();
            if (isGroundedNow) {
                this.timeSinceGrounded = 0;
                this.onGround = true;
            } else {
                this.timeSinceGrounded += dt;
            }

            // Jump execution (Responsive with coyote time & buffer)
            const canJump = (this.timeSinceGrounded < 0.16);
            if (this.jumpBufferTimer > 0 && canJump && this.jumpCooldown <= 0) {
                let jumpPower = (this.physJumpPower ?? 8.5);
                const skin = (window.SKINS_REGISTRY && this.game.upgrader) ? window.SKINS_REGISTRY[this.game.upgrader.equippedSkin] : null;
                if (skin && skin.buffs && skin.buffs.jumpMult) jumpPower *= skin.buffs.jumpMult;

                this.velocity.y = jumpPower;
                this.onGround = false;
                this.timeSinceGrounded = 999;
                this.jumpBufferTimer = 0;
                this.jumpCooldown = (this.physJumpCooldown ?? 0.18);
                this.soundManager.playJump();
                this.hunger = Math.max(0, this.hunger - 0.2);
            }

            const isAirborne = !isGroundedNow;
            if (isAirborne && !this.isFlying) {
                // Normal in-air steering & momentum
                this.velocity.x += moveX * 0.28;
                this.velocity.z += moveZ * 0.28;
                const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
                if (currentSpeed > baseSpeed) {
                    const f = baseSpeed / currentSpeed;
                    this.velocity.x *= f;
                    this.velocity.z *= f;
                }
            } else {
                // Crisp Ground Movement (Instant responsive deceleration)
                this.velocity.x = moveX * baseSpeed;
                this.velocity.z = moveZ * baseSpeed;
            }
        }

        // Move X
        const nextPosX = this._scratchNextPos.copy(this.position);
        nextPosX.x += this.velocity.x * dt;
        if (!this.checkCollision(nextPosX)) {
            this.position.x = nextPosX.x;
        } else {
            this.velocity.x = 0;
        }

        // Move Z
        const nextPosZ = this._scratchNextPos.copy(this.position);
        nextPosZ.z += this.velocity.z * dt;
        if (!this.checkCollision(nextPosZ)) {
            this.position.z = nextPosZ.z;
        } else {
            this.velocity.z = 0;
        }

        // Move Y
        const nextPosY = this._scratchNextPos.copy(this.position);
        const prevVy = this.velocity.y;
        nextPosY.y += this.velocity.y * dt;

        if (!this.checkCollision(nextPosY)) {
            this.position.y = nextPosY.y;
            this.onGround = false;
        } else {
            if (this.velocity.y < 0) {
                // Falling: find the highest solid surface under the player's feet
                const minX = Math.floor(this.position.x - this.width / 2 + 0.001);
                const maxX = Math.floor(this.position.x + this.width / 2 - 0.001);
                const minZ = Math.floor(this.position.z - this.depth / 2 + 0.001);
                const maxZ = Math.floor(this.position.z + this.depth / 2 - 0.001);

                const startY = Math.floor(this.position.y);
                const endY = Math.floor(nextPosY.y);
                let landedBlockY = null;

                for (let y = startY; y >= endY; y--) {
                    for (let x = minX; x <= maxX; x++) {
                        for (let z = minZ; z <= maxZ; z++) {
                            const b = this.world.getBlock(x, y, z);
                            if (!isPassThroughBlock(b)) {
                                landedBlockY = y;
                                break;
                            }
                        }
                        if (landedBlockY !== null) break;
                    }
                    if (landedBlockY !== null) break;
                }

                if (landedBlockY !== null) {
                    this.position.y = landedBlockY + 1.0;
                } else {
                    this.position.y = Math.floor(nextPosY.y) + 1.0;
                }
                this.onGround = true;
                this.timeSinceGrounded = 0;

                // Fall damage (negated if landing in water or lava)
                if (prevVy < -16 && !this.godMode && !this.isCreative && !this.isFlying && !this.isInWater && !this.isInLava && !this.physNoFallDamage) {
                    const fallDamage = Math.floor((-prevVy - 14) * 4);
                    this.takeDamage(fallDamage, "Розбився об землю як єблан!");
                }
            } else if (this.velocity.y > 0) {
                // Head hit ceiling: snap head cleanly below the ceiling block
                const ceilBlockY = Math.floor(nextPosY.y + this.height);
                this.position.y = ceilBlockY - this.height - 0.001;
            }
            this.velocity.y = 0;
        }

            // Void fall check
            if (this.position.y < -15) {
                if (this.godMode || this.isCreative || this.isFlying) {
                    this.position.y = 30;
                    this.velocity.set(0, 0, 0);
                } else {
                    this.takeDamage(100, "Впав у бездну!");
                }
            }

            // Footsteps (only on ground and not in water)
            const isMoving = Math.abs(inputVector.x) > 0.1 || Math.abs(inputVector.y) > 0.1;
            if (isMoving && this.onGround && !this.isInWater) {
                this.walkCycle += dt * (this.isSprinting ? 14 : 9);
                this.soundManager.playStep();
            } else {
                this.walkCycle = 0;
            }
        }

        // Vehicle camera
        if (this.mountedVehicle) {
            this.updateVehicleCamera();
            this.updateRaycast();
            return;
        }

        // Camera setup (1st vs 3rd person)
        if (this.isThirdPerson) {
            const dist = 3.5;
            const camX = this.position.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
            const camY = this.position.y + this.eyeHeight + Math.sin(-this.pitch) * dist + 0.4;
            const camZ = this.position.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist;

            this.camera.position.set(camX, camY, camZ);
            this.camera.lookAt(this.position.x, this.position.y + this.eyeHeight, this.position.z);

            // Third person body orientation & animation
            this.playerBodyGroup.position.copy(this.position);
            this.playerBodyGroup.rotation.y = this.yaw;

            if (this.mcModel) {
                // Head pitch tilting
                if (this.mcModel.headPivot) {
                    this.mcModel.headPivot.rotation.x = this.pitch;
                }

                // Limbs walking / swimming swing
                const isMoving = this.velocity && (Math.abs(this.velocity.x) > 0.15 || Math.abs(this.velocity.z) > 0.15);
                if (this.isInWater) {
                    const swimCycle = (this.swimBobbingTimer || 0) * 3.5;
                    const legAngle = Math.sin(swimCycle) * 0.45;
                    this.mcModel.leftLegPivot.rotation.x = legAngle;
                    this.mcModel.rightLegPivot.rotation.x = -legAngle;
                    this.mcModel.leftArmPivot.rotation.x = -legAngle * 0.5;
                    if (this.armSwing <= 0) {
                        this.mcModel.rightArmPivot.rotation.x = legAngle * 0.5;
                    }
                } else if (isMoving && this.onGround) {
                    const legAngle = Math.sin(this.walkCycle) * 0.65;
                    this.mcModel.leftLegPivot.rotation.x = legAngle;
                    this.mcModel.rightLegPivot.rotation.x = -legAngle;
                    this.mcModel.leftArmPivot.rotation.x = -legAngle * 0.7;
                    if (this.armSwing <= 0) {
                        this.mcModel.rightArmPivot.rotation.x = legAngle * 0.7;
                    }
                } else {
                    this.mcModel.leftLegPivot.rotation.x *= 0.8;
                    this.mcModel.rightLegPivot.rotation.x *= 0.8;
                    this.mcModel.leftArmPivot.rotation.x *= 0.8;
                    if (this.armSwing <= 0) {
                        this.mcModel.rightArmPivot.rotation.x *= 0.8;
                    }
                }

                // 3rd Person Arm swing punch / mining attack
                if (this.armSwing > 0) {
                    this.mcModel.rightArmPivot.rotation.x = -Math.sin(this.armSwing * Math.PI) * 1.35;
                    this.mcModel.rightArmPivot.rotation.y = Math.sin(this.armSwing * Math.PI) * 0.35;
                } else {
                    this.mcModel.rightArmPivot.rotation.y *= 0.8;
                }
            }
        } else {
            const verticalBob = this.onGround
                ? Math.sin(this.walkCycle) * 0.04
                : (this.isInWater ? Math.sin(this.swimBobbingTimer) * 0.04 : 0);
            this.camera.position.set(
                this.position.x,
                this.position.y + this.eyeHeight + verticalBob,
                this.position.z
            );
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.y = this.yaw;
            this.camera.rotation.x = this.pitch;
        }

        // First-person hand & held item swing animation (Minecraft-style slash/chop arc & shield blocking pose)
        if (this.itemPivot) {
            const bobX = Math.cos(this.walkCycle * 0.5) * 0.025;
            const bobY = Math.abs(Math.sin(this.walkCycle)) * 0.025;

            if (this.armSwing > 0) {
                this.armSwing = Math.max(0, this.armSwing - dt * 6.5);
            }
            const swingOffset = Math.sin(this.armSwing * Math.PI);

            if (this.isBlocking) {
                // Minecraft-style Shield / Sword blocking pose (raised in front of chest)
                this.itemPivot.position.set(0.12, -0.22, -0.44);
                this.itemPivot.rotation.set(-0.35, 0.45, -0.65);
            } else {
                this.itemPivot.position.set(
                    0.36 + bobX - swingOffset * 0.16,
                    -0.36 + bobY - swingOffset * 0.14,
                    -0.52 - swingOffset * 0.22
                );
                this.itemPivot.rotation.set(
                    -swingOffset * 0.95,
                    swingOffset * 0.65,
                    -swingOffset * 0.75
                );
            }
        }

        // Raycasting
        this.updateRaycast();
        this.updateTargetLock();
    }

    updateTargetLock() {
        if (!this.camera || this.isDead) {
            this.isTargetLocked = false;
            const ch = document.getElementById('crosshair');
            if (ch) ch.classList.remove('target-locked');
            return;
        }

        const origin = new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
        const dir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        const reach = this.customReach || (this.isCreative ? 8.0 : 4.8);
        let locked = false;

        // Check Mobs
        if (this.game && this.game.mobManager) {
            for (let mob of this.game.mobManager.mobs) {
                if (!mob.isDead && mob.group) {
                    const mobCenter = mob.position.clone().add(new THREE.Vector3(0, (mob.height || 1.8) * 0.5, 0));
                    const toMob = mobCenter.sub(origin);
                    const distAlongRay = toMob.dot(dir);
                    if (distAlongRay > 0 && distAlongRay < reach) {
                        const perpDist = toMob.sub(dir.clone().multiplyScalar(distAlongRay)).length();
                        const hitboxRadius = (mob.width || 0.65) * 0.95 + 0.18;
                        if (perpDist <= hitboxRadius) {
                            locked = true;
                            break;
                        }
                    }
                }
            }
            if (!locked && this.game.mobManager.dragon && !this.game.mobManager.dragon.isDead && this.game.mobManager.dragon.mesh) {
                if (this.position.distanceTo(this.game.mobManager.dragon.mesh.position) < 14.0) {
                    locked = true;
                }
            }
        }

        // Check remote multiplayer players
        if (!locked && this.game && this.game.multiplayer && this.game.multiplayer.players) {
            for (let [id, remote] of this.game.multiplayer.players.entries()) {
                if (remote && remote.mesh) {
                    const pCenter = remote.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
                    const toP = pCenter.sub(origin);
                    const distAlongRay = toP.dot(dir);
                    if (distAlongRay > 0 && distAlongRay < reach) {
                        const perpDist = toP.sub(dir.clone().multiplyScalar(distAlongRay)).length();
                        if (perpDist <= 0.65) {
                            locked = true;
                            break;
                        }
                    }
                }
            }
        }

        this.isTargetLocked = locked;
        const crosshair = document.getElementById('crosshair');
        if (crosshair) {
            if (locked) {
                crosshair.classList.add('target-locked');
            } else {
                crosshair.classList.remove('target-locked');
            }
        }
    }

    updateVehicleCamera() {
        if (!this.mountedVehicle) return;
        const v = this.mountedVehicle;
        const dist = 5.2;
        const camHeight = 2.0;
        const camPitch = Math.max(-0.6, Math.min(0.5, this.pitch));
        let camX = v.position.x + Math.sin(this.yaw) * Math.cos(camPitch) * dist;
        let camY = v.position.y + camHeight + Math.sin(-camPitch) * dist;
        let camZ = v.position.z + Math.cos(this.yaw) * Math.cos(camPitch) * dist;

        if (this.world) {
            const targetX = v.position.x;
            const targetY = v.position.y + 0.9;
            const targetZ = v.position.z;
            const steps = 8;
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const testX = targetX + (camX - targetX) * t;
                const testY = targetY + (camY - targetY) * t;
                const testZ = targetZ + (camZ - targetZ) * t;
                const b = this.world.getBlock(Math.floor(testX), Math.floor(testY), Math.floor(testZ));
                if (b !== 0 && b !== 19 && b !== 13) {
                    const safeT = Math.max(0.2, (i - 1) / steps);
                    camX = targetX + (camX - targetX) * safeT;
                    camY = targetY + (camY - targetY) * safeT;
                    camZ = targetZ + (camZ - targetZ) * safeT;
                    break;
                }
            }
        }

        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(v.position.x, v.position.y + 0.8, v.position.z);

        if (this.playerBodyGroup) {
            this.playerBodyGroup.position.copy(v.position);
            this.playerBodyGroup.position.y += 0.35;
            this.playerBodyGroup.rotation.y = v.yaw;
            this.playerBodyGroup.visible = true;
        }
        if (this.itemPivot) this.itemPivot.visible = false;
        if (this.handGroup) this.handGroup.visible = false;
    }

    mountVehicle(vehicle) {
        if (!vehicle) return;
        if (this.mountedVehicle) this.dismountVehicle();
        this.mountedVehicle = vehicle;
        vehicle.driver = this;
        this.isThirdPerson = true;
        this.yaw = vehicle.yaw;
        this.pitch = 0.15;
        if (this.playerBodyGroup) this.playerBodyGroup.visible = true;
        if (this.handGroup) this.handGroup.visible = false;
        if (this.itemPivot) this.itemPivot.visible = false;
        this.updateVehicleCamera();
        if (window.modManager) {
            window.modManager.showVehicleHud(vehicle);
            window.modManager.triggerEvent("onVehicleEnter", vehicle.id, this);
        }
        if (this.game.ui) this.game.ui.showToast("🚗 Ви сіли в авто! [WASD] Рух, [Space] Гальма, [H] Сигнал, [L] Фари, [E] Вийти");
    }

    dismountVehicle() {
        if (!this.mountedVehicle) return;
        const v = this.mountedVehicle;
        this.position.x = v.position.x + Math.sin(v.yaw + Math.PI / 2) * 1.8;
        this.position.y = v.position.y + 0.3;
        this.position.z = v.position.z + Math.cos(v.yaw + Math.PI / 2) * 1.8;
        v.driver = null;
        this.mountedVehicle = null;
        this.isThirdPerson = false;
        if (this.playerBodyGroup) this.playerBodyGroup.visible = false;
        if (this.handGroup) this.handGroup.visible = true;
        if (this.itemPivot) this.itemPivot.visible = true;
        if (window.modManager) {
            window.modManager.hideVehicleHud();
            window.modManager.triggerEvent("onVehicleExit", v.id, this);
        }
        if (this.game.ui) this.game.ui.showToast("Ви вийшли з авто");
    }

    getVehicle() {
        return this.mountedVehicle || null;
    }

    getVehicleId() {
        return this.mountedVehicle ? this.mountedVehicle.id : null;
    }

    isMounted() {
        return !!this.mountedVehicle;
    }

    toggleScope() {
        if (!this.camera) return;
        this.isScoped = !this.isScoped;
        const targetFOV = this.isScoped ? 24 : 72;
        this.setFOV(targetFOV);
        if (this.game && this.game.soundManager) this.game.soundManager.playClick();
        if (this.game && this.game.ui) {
            this.game.ui.showToast(this.isScoped ? "🎯 Оптичний приціл увімкнено (FOV 24)" : "👁️ Звичайний огляд (FOV 72)");
        }
    }

    tryThrowGrenade() {
        const item = this.getSelectedItem();
        if (!item) return false;
        const reg = ITEM_REGISTRY[item.itemId];
        if (!reg || !reg.isThrowable) return false;

        const wMgr = (window.modManager && window.modManager.weaponManager) || (this.game && this.game.modManager && this.game.modManager.weaponManager);
        if (wMgr && wMgr.throwGrenade) {
            wMgr.throwGrenade({
                damage: reg.attackDamage || 120,
                blastRadius: 4.2
            });
            if (!this.isCreative) {
                this.removeItem(item.itemId, 1);
            }
            if (this.game && this.game.ui) this.game.ui.showToast("💣 Гранату кинуто!");
            return true;
        }
        return false;
    }

    tryShootGun() {
        const item = this.getSelectedItem();
        if (!item) return false;
        const reg = ITEM_REGISTRY[item.itemId];
        if (!reg || !reg.isGun) return false;

        const now = performance.now();
        const fireDelays = {
            'ak47': 110,
            'm4a1': 90,
            'awp': 1200,
            'shotgun': 800,
            'deagle': 350,
            'glock': 180,
            'mp5': 95,
            'rpg': 1500
        };
        const delay = fireDelays[reg.gunType] || reg.fireDelay || 150;
        if (this.lastGunShotTime && now - this.lastGunShotTime < delay) {
            return true; // Still cooling down, don't break blocks
        }

        // Ammo check in survival mode
        if (!this.isCreative && reg.ammoType) {
            const ammoCount = this.getItemCount(reg.ammoType);
            if (ammoCount <= 0) {
                if (now - (this.lastDryFireTime || 0) > 400) {
                    this.lastDryFireTime = now;
                    if (this.game && this.game.soundManager) this.game.soundManager.playClick();
                    const ammoReg = ITEM_REGISTRY[reg.ammoType];
                    if (this.game && this.game.ui) this.game.ui.showToast(`⚠️ Немає патронів! Потрібно: ${ammoReg ? ammoReg.name : reg.ammoType}`);
                }
                return true;
            }
            this.removeItem(reg.ammoType, 1);
        }

        this.lastGunShotTime = now;

        const wMgr = (window.modManager && window.modManager.weaponManager) || (this.game && this.game.modManager && this.game.modManager.weaponManager);
        if (!wMgr) return false;

        if (reg.gunType === 'rpg') {
            if (wMgr.launchRocket) {
                wMgr.launchRocket({
                    damage: 250,
                    blastRadius: 4.8,
                    speed: 36.0
                });
            }
            return true;
        }

        let damage = reg.attackDamage || 40;
        let range = 80;
        let spread = 0.02;
        let recoil = 0.035;
        let bulletCount = 1;
        let pitch = 1.0;

        if (reg.gunType === 'ak47') {
            damage = 48; range = 85; spread = 0.024; recoil = 0.038; pitch = 0.95;
        } else if (reg.gunType === 'm4a1') {
            damage = 40; range = 90; spread = 0.016; recoil = 0.025; pitch = 1.25;
        } else if (reg.gunType === 'awp') {
            damage = 150; range = 180; spread = this.isScoped ? 0.0005 : 0.01; recoil = 0.095; pitch = 0.65;
        } else if (reg.gunType === 'shotgun') {
            damage = 22; range = 38; spread = 0.085; recoil = 0.075; bulletCount = 8; pitch = 0.75;
        } else if (reg.gunType === 'deagle') {
            damage = 65; range = 65; spread = 0.014; recoil = 0.065; pitch = 0.82;
        } else if (reg.gunType === 'glock') {
            damage = 28; range = 55; spread = 0.025; recoil = 0.02; pitch = 1.4;
        } else if (reg.gunType === 'mp5') {
            damage = 32; range = 60; spread = 0.022; recoil = 0.022; pitch = 1.3;
        }

        wMgr.shoot({
            damage: damage,
            range: range,
            spread: spread,
            recoilPitch: recoil,
            recoilYaw: recoil * 0.45,
            bulletCount: bulletCount,
            pitch: pitch,
            volume: 0.4
        });

        return true;
    }

    setFOV(fov) {
        if (this.camera && typeof fov === 'number' && fov >= 15 && fov <= 140) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }

    getFOV() {
        return this.camera ? this.camera.fov : 72;
    }
}

window.Player = Player;

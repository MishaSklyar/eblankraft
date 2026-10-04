/**
 * Eblankraft 2.0 - Upgrader, Cases Roulette & Skins System
 */

// --- SKINS DEFINITIONS ---
const SKINS_REGISTRY = {
    classic: {
        id: 'classic',
        name: 'Класичний Єблан',
        desc: 'Стандартний скін справжнього копача',
        buffDesc: 'Без бонусів',
        unlocked: true,
        colors: {
            head: '#cca07a',
            hair: '#4a2f18',
            shirt: '#1a73e8',
            pants: '#1e3f8a',
            hands: '#cca07a',
            glow: null
        },
        buffs: {}
    },
    gopnik: {
        id: 'gopnik',
        name: 'Чоткий Пацан (Адідас)',
        desc: 'Три смужки, сємки і чоткий біг',
        buffDesc: '🏃 +20% швидкість бігу',
        unlocked: false,
        colors: {
            head: '#d8aa84',
            hair: '#111111',
            shirt: '#151515',
            stripes: '#ffffff',
            pants: '#151515',
            hands: '#d8aa84',
            glow: null
        },
        buffs: { speedMult: 1.2 }
    },
    rich: {
        id: 'rich',
        name: 'Золотий Мажор',
        desc: 'Обвішаний золотом і понтами',
        buffDesc: '🍀 +30% шанс подвійного дропу (Фортуна)',
        unlocked: false,
        colors: {
            head: '#e0b58e',
            hair: '#f5c518',
            shirt: '#e6a817',
            pants: '#222222',
            hands: '#f5c518',
            glow: 0xffd700
        },
        buffs: { fortuneBonus: 0.3 }
    },
    cyber: {
        id: 'cyber',
        name: 'Кібер-Єблан 2077',
        desc: 'Неонові імпланти та кібер-руки',
        buffDesc: '⛏️ +25% швидкість копання',
        unlocked: false,
        colors: {
            head: '#90caf9',
            hair: '#00e5ff',
            shirt: '#121212',
            pants: '#212121',
            hands: '#00e5ff',
            glow: 0x00e5ff
        },
        buffs: { miningSpeedMult: 1.25 }
    },
    demon: {
        id: 'demon',
        name: 'Незерський Демон 🔥',
        desc: 'Народжений у лаві Незера',
        buffDesc: '🔥 Стійкість до лави та вогню',
        unlocked: false,
        colors: {
            head: '#c62828',
            hair: '#ff5722',
            shirt: '#880e4f',
            pants: '#260404',
            hands: '#e53935',
            glow: 0xff3d00
        },
        buffs: { fireImmunity: true }
    },
    slayer: {
        id: 'slayer',
        name: 'Драконоборець 🐲',
        desc: 'Броня з луски Єблан Дракона',
        buffDesc: '⚔️ +50% шкоди по босах і мобах',
        unlocked: false,
        colors: {
            head: '#2e0854',
            hair: '#b33bf6',
            shirt: '#4a148c',
            pants: '#12002b',
            hands: '#ba68c8',
            glow: 0xba68c8
        },
        buffs: { bossDamageMult: 1.5 }
    },
    popcat: {
        id: 'popcat',
        name: 'Поп-Кот Мемний 🐱',
        desc: 'Широко відкриває рот при копанні',
        buffDesc: '🦘 +35% висота стрибка',
        unlocked: false,
        colors: {
            head: '#fff8e7',
            hair: '#d7ccc8',
            shirt: '#ffab91',
            pants: '#8d6e63',
            hands: '#fff8e7',
            glow: 0xfff9c4
        },
        buffs: { jumpMult: 1.35 }
    },
    gigachad: {
        id: 'gigachad',
        name: 'ГІГА-ЄБЛАН ВСЕСВІТУ 👑',
        desc: 'Абсолютний домінант Єбланкрафту',
        buffDesc: '🌟 +40% до ВСІХ характеристик!',
        unlocked: false,
        colors: {
            head: '#ffd54f',
            hair: '#000000',
            shirt: '#37474f',
            pants: '#263238',
            hands: '#ffca28',
            glow: 0xffffff
        },
        buffs: { allMult: 1.4 }
    },
    custom: {
        id: 'custom',
        name: 'Власний скін (PNG) 🎭',
        desc: 'Завантажений з файлу скін гравця',
        buffDesc: '✨ Повна кастомізація',
        unlocked: true,
        colors: {
            head: '#cca07a',
            hair: '#4a2f18',
            shirt: '#1a73e8',
            pants: '#1e3f8a',
            hands: '#cca07a',
            glow: null
        },
        buffs: {}
    }
};

// --- CASES CONFIGURATION ---
const CASES_CONFIG = {
    [ITEM_TYPES.CASE_HOBO]: {
        id: ITEM_TYPES.CASE_HOBO,
        name: 'Бомж-Кейс 📦',
        desc: 'Простий кейс за мусорні жетони або безкоштовно щохвилини!',
        cost: { itemId: ITEM_TYPES.JUNK_TOKEN, count: 2 },
        items: [
            { item: ITEM_TYPES.JUNK_SOCK, count: 3, weight: 30, isSkin: false },
            { item: ITEM_TYPES.WOOD, count: 8, weight: 25, isSkin: false },
            { item: ITEM_TYPES.APPLE, count: 4, weight: 20, isSkin: false },
            { item: ITEM_TYPES.STONE_PICKAXE, count: 1, weight: 12, isSkin: false },
            { item: ITEM_TYPES.IRON_INGOT, count: 3, weight: 8, isSkin: false },
            { skinId: 'gopnik', weight: 5, isSkin: true }
        ]
    },
    [ITEM_TYPES.CASE_DIAMOND]: {
        id: ITEM_TYPES.CASE_DIAMOND,
        name: 'Алмазний Кейс 💎',
        desc: 'Багатий кейс для справжніх майнерів',
        cost: { itemId: ITEM_TYPES.DIAMOND_ITEM, count: 2 },
        items: [
            { item: ITEM_TYPES.GOLD_INGOT, count: 5, weight: 25, isSkin: false },
            { item: ITEM_TYPES.DIAMOND_ITEM, count: 3, weight: 20, isSkin: false },
            { item: ITEM_TYPES.TNT, count: 6, weight: 20, isSkin: false },
            { item: ITEM_TYPES.DIAMOND_PICKAXE, count: 1, weight: 15, isSkin: false },
            { skinId: 'rich', weight: 10, isSkin: true },
            { skinId: 'cyber', weight: 7, isSkin: true },
            { skinId: 'popcat', weight: 3, isSkin: true }
        ]
    },
    [ITEM_TYPES.CASE_NETHER]: {
        id: ITEM_TYPES.CASE_NETHER,
        name: 'Незер-Кейс 🔥',
        desc: 'Пекельний кейс з древніми уламками',
        cost: { itemId: ITEM_TYPES.NETHERITE_SCRAP, count: 1 },
        items: [
            { item: ITEM_TYPES.BLAZE_ROD, count: 4, weight: 25, isSkin: false },
            { item: ITEM_TYPES.NETHER_QUARTZ, count: 16, weight: 20, isSkin: false },
            { item: ITEM_TYPES.NETHERITE_SCRAP, count: 2, weight: 15, isSkin: false },
            { item: ITEM_TYPES.NETHERITE_SWORD, count: 1, weight: 12, isSkin: false },
            { skinId: 'demon', weight: 15, isSkin: true },
            { skinId: 'cyber', weight: 10, isSkin: true },
            { skinId: 'gigachad', weight: 3, isSkin: true }
        ]
    },
    [ITEM_TYPES.CASE_DRAGON]: {
        id: ITEM_TYPES.CASE_DRAGON,
        name: 'Кейс Дракона 👑',
        desc: 'Легендарний кейс переможця Єблан Дракона!',
        cost: { itemId: ITEM_TYPES.DRAGON_EGG, count: 1 },
        items: [
            { item: ITEM_TYPES.NETHERITE_BLOCK, count: 2, weight: 25, isSkin: false },
            { item: ITEM_TYPES.EBLAN_SWORD, count: 1, weight: 20, isSkin: false },
            { item: ITEM_TYPES.EBLAN_PICKAXE, count: 1, weight: 20, isSkin: false },
            { skinId: 'slayer', weight: 20, isSkin: true },
            { skinId: 'gigachad', weight: 15, isSkin: true }
        ]
    }
};

// --- UPGRADE DEFINITIONS ---
const UPGRADES_CONFIG = {
    miningSpeed: {
        id: 'miningSpeed',
        name: 'Швидкість копання',
        icon: '⛏️',
        desc: '+35% до швидкості за кожен рівень',
        maxLevel: 10,
        baseCost: 2, // Junk Tokens or Iron
        costType: ITEM_TYPES.JUNK_TOKEN,
        costTypeAlt: ITEM_TYPES.IRON_INGOT,
        getMultiplier: (lvl) => 1 + lvl * 0.35
    },
    damage: {
        id: 'damage',
        name: 'Сила атаки',
        icon: '⚔️',
        desc: '+30% до шкоди зброї та руки',
        maxLevel: 10,
        baseCost: 3,
        costType: ITEM_TYPES.IRON_INGOT,
        costTypeAlt: ITEM_TYPES.DIAMOND_ITEM,
        getMultiplier: (lvl) => 1 + lvl * 0.3
    },
    maxHealth: {
        id: 'maxHealth',
        name: 'Максимальне здоров’я',
        icon: '❤️',
        desc: '+20 HP за рівень (до 300 HP)',
        maxLevel: 10,
        baseCost: 2,
        costType: ITEM_TYPES.GOLD_INGOT,
        costTypeAlt: ITEM_TYPES.APPLE,
        getValue: (lvl) => 100 + lvl * 20
    },
    magnet: {
        id: 'magnet',
        name: 'Магніт дропу',
        icon: '🧲',
        desc: '+1 метр до радіусу підбору предметів',
        maxLevel: 8,
        baseCost: 2,
        costType: ITEM_TYPES.JUNK_TOKEN,
        costTypeAlt: ITEM_TYPES.GOLD_INGOT,
        getValue: (lvl) => 2.2 + lvl * 0.8
    },
    fortune: {
        id: 'fortune',
        name: 'Удача та подвійний дроп',
        icon: '🍀',
        desc: '+10% шанс подвійного випадання блоків',
        maxLevel: 8,
        baseCost: 1,
        costType: ITEM_TYPES.DIAMOND_ITEM,
        costTypeAlt: ITEM_TYPES.NETHERITE_SCRAP,
        getValue: (lvl) => lvl * 0.1
    },
    defense: {
        id: 'defense',
        name: 'Броня та захист',
        icon: '🛡️',
        desc: '+8% зменшення будь-якої шкоди',
        maxLevel: 8,
        baseCost: 3,
        costType: ITEM_TYPES.IRON_INGOT,
        costTypeAlt: ITEM_TYPES.OBSIDIAN,
        getValue: (lvl) => Math.min(0.7, lvl * 0.08)
    }
};

class UpgraderSkinsManager {
    constructor(game) {
        this.game = game;
        this.upgrades = {
            miningSpeed: 0,
            damage: 0,
            maxHealth: 0,
            magnet: 0,
            fortune: 0,
            defense: 0
        };
        this.equippedSkin = 'classic';
        this.unlockedSkins = { classic: true };
        this.lastFreeHoboCaseTime = 0;

        this.loadSavedData();
    }

    loadSavedData() {
        try {
            const savedUpgrades = localStorage.getItem('eblankraft_upgrades');
            if (savedUpgrades) this.upgrades = Object.assign(this.upgrades, JSON.parse(savedUpgrades));

            const savedSkins = localStorage.getItem('eblankraft_skins');
            if (savedSkins) this.unlockedSkins = Object.assign(this.unlockedSkins, JSON.parse(savedSkins));

            const savedCurrentSkin = localStorage.getItem('eblankraft_current_skin');
            if (savedCurrentSkin && SKINS_REGISTRY[savedCurrentSkin]) {
                this.equippedSkin = savedCurrentSkin;
            }
        } catch (e) {
            console.error("Failed to load saved upgrader/skins", e);
        }
    }

    saveData() {
        try {
            localStorage.setItem('eblankraft_upgrades', JSON.stringify(this.upgrades));
            localStorage.setItem('eblankraft_skins', JSON.stringify(this.unlockedSkins));
            localStorage.setItem('eblankraft_current_skin', this.equippedSkin);
        } catch (e) {}
    }

    getEffectiveMiningSpeed(baseToolSpeed = 1.0) {
        const upgMult = UPGRADES_CONFIG.miningSpeed.getMultiplier(this.upgrades.miningSpeed);
        const skin = SKINS_REGISTRY[this.equippedSkin];
        let skinMult = (skin && skin.buffs.miningSpeedMult) ? skin.buffs.miningSpeedMult : 1.0;
        if (skin && skin.buffs.allMult) skinMult *= skin.buffs.allMult;
        return baseToolSpeed * upgMult * skinMult;
    }

    getEffectiveDamage(baseWeaponDamage = 5) {
        const upgMult = UPGRADES_CONFIG.damage.getMultiplier(this.upgrades.damage);
        const skin = SKINS_REGISTRY[this.equippedSkin];
        let skinMult = 1.0;
        if (skin && skin.buffs.allMult) skinMult *= skin.buffs.allMult;
        return baseWeaponDamage * upgMult * skinMult;
    }

    getEffectiveMaxHealth() {
        const base = UPGRADES_CONFIG.maxHealth.getValue(this.upgrades.maxHealth);
        const skin = SKINS_REGISTRY[this.equippedSkin];
        if (skin && skin.buffs.allMult) return Math.round(base * skin.buffs.allMult);
        return base;
    }

    getPickupMagnetRadius() {
        return UPGRADES_CONFIG.magnet.getValue(this.upgrades.magnet);
    }

    getFortuneChance() {
        const base = UPGRADES_CONFIG.fortune.getValue(this.upgrades.fortune);
        const skin = SKINS_REGISTRY[this.equippedSkin];
        const skinBonus = (skin && skin.buffs.fortuneBonus) ? skin.buffs.fortuneBonus : 0;
        return base + skinBonus;
    }

    getDamageReduction() {
        return UPGRADES_CONFIG.defense.getValue(this.upgrades.defense);
    }

    getSpeedMultiplier() {
        const skin = SKINS_REGISTRY[this.equippedSkin];
        let mult = (skin && skin.buffs.speedMult) ? skin.buffs.speedMult : 1.0;
        if (skin && skin.buffs.allMult) mult *= skin.buffs.allMult;
        return mult;
    }

    hasFireImmunity() {
        const skin = SKINS_REGISTRY[this.equippedSkin];
        return skin && (skin.buffs.fireImmunity || skin.buffs.allMult);
    }

    equipSkin(skinId) {
        if (!SKINS_REGISTRY[skinId]) return false;
        if (skinId !== 'custom' && !this.unlockedSkins[skinId]) return false;

        this.equippedSkin = skinId;
        this.saveData();

        if (this.game.player) {
            this.game.player.applySkinVisuals();
            this.game.player.maxHealth = this.getEffectiveMaxHealth();
        }
        if (this.game.soundManager) {
            this.game.soundManager.speakRandomMeme(["О, нормальний скін!", "Красава, тепер стильний!"]);
        }
        if (this.game.multiplayer && this.game.multiplayer.isConnected) {
            this.game.multiplayer.broadcastSkinChange(skinId);
        }
        return true;
    }

    unlockSkin(skinId) {
        if (!SKINS_REGISTRY[skinId]) return;
        this.unlockedSkins[skinId] = true;
        this.saveData();
    }

    canAffordUpgrade(upgradeId) {
        const cfg = UPGRADES_CONFIG[upgradeId];
        if (!cfg) return false;
        const curLvl = this.upgrades[upgradeId] || 0;
        if (curLvl >= cfg.maxLevel) return false;

        const cost = cfg.baseCost * (curLvl + 1);
        const countPrimary = this.game.player.getItemCount(cfg.costType);
        const countAlt = this.game.player.getItemCount(cfg.costTypeAlt);
        return (countPrimary >= cost) || (countAlt >= Math.max(1, Math.floor(cost / 2)));
    }

    purchaseUpgrade(upgradeId) {
        const cfg = UPGRADES_CONFIG[upgradeId];
        if (!cfg || !this.canAffordUpgrade(upgradeId)) return false;

        const curLvl = this.upgrades[upgradeId] || 0;
        const cost = cfg.baseCost * (curLvl + 1);

        if (this.game.player.getItemCount(cfg.costType) >= cost) {
            this.game.player.removeItem(cfg.costType, cost);
        } else {
            const altCost = Math.max(1, Math.floor(cost / 2));
            this.game.player.removeItem(cfg.costTypeAlt, altCost);
        }

        this.upgrades[upgradeId] = curLvl + 1;
        this.saveData();

        // Update player stats
        if (this.game.player) {
            const newMaxHp = this.getEffectiveMaxHealth();
            const hpDiff = newMaxHp - this.game.player.maxHealth;
            this.game.player.maxHealth = newMaxHp;
            if (hpDiff > 0) this.game.player.heal(hpDiff);
        }

        if (this.game.soundManager) {
            this.game.soundManager.playClick();
            this.game.soundManager.speakRandomMeme(["Апгрейд готовий!", "Став сильнішим!", "Оце прокачка!"]);
        }
        return true;
    }

    // Open Case logic
    openCase(caseId) {
        const cfg = CASES_CONFIG[caseId];
        if (!cfg) return null;

        // Check cost
        if (cfg.cost && !this.game.player.hasItem(cfg.cost.itemId, cfg.cost.count)) {
            // Check if free hobo case is available (every 60s)
            const now = performance.now();
            if (caseId === ITEM_TYPES.CASE_HOBO && (now - this.lastFreeHoboCaseTime > 60000)) {
                this.lastFreeHoboCaseTime = now;
            } else {
                return null;
            }
        } else if (cfg.cost) {
            this.game.player.removeItem(cfg.cost.itemId, cfg.cost.count);
        }

        // Weighted random selection
        const totalWeight = cfg.items.reduce((sum, it) => sum + it.weight, 0);
        let rnd = Math.random() * totalWeight;
        let chosen = cfg.items[0];

        for (let it of cfg.items) {
            if (rnd < it.weight) {
                chosen = it;
                break;
            }
            rnd -= it.weight;
        }

        // Apply reward
        if (chosen.isSkin) {
            this.unlockSkin(chosen.skinId);
        } else {
            this.game.player.addItem(chosen.item, chosen.count || 1);
        }

        return chosen;
    }
}

// --- MINECRAFT PLAYER BOX GEOMETRY UV MAPPER ---
function createMinecraftBoxGeometry(w, h, d, u, v, partW, partH, partD, mirror = false, texW = 64, texH = 64) {
    const geom = new THREE.BoxGeometry(w, h, d);
    const uv = geom.attributes.uv.array;

    let rX0 = u, rX1 = u + partD;
    let fX0 = rX1, fX1 = fX0 + partW;
    let lX0 = fX1, lX1 = lX0 + partD;
    let bX0 = lX1, bX1 = bX0 + partW;

    if (mirror) {
        const tmpR0 = rX0, tmpR1 = rX1;
        rX0 = lX1; rX1 = lX0;
        lX0 = tmpR1; lX1 = tmpR0;
        const tmpF0 = fX0; fX0 = fX1; fX1 = tmpF0;
        const tmpB0 = bX0; bX0 = bX1; bX1 = tmpB0;
    }

    const y0 = v, y1 = v + partD, y2 = y1 + partH;

    const setUV = (faceIdx, uTL, vTL, uTR, vTR, uBL, vBL, uBR, vBR) => {
        const base = faceIdx * 8;
        uv[base + 0] = uTL / texW; uv[base + 1] = 1.0 - (vTL / texH);
        uv[base + 2] = uTR / texW; uv[base + 3] = 1.0 - (vTR / texH);
        uv[base + 4] = uBL / texW; uv[base + 5] = 1.0 - (vBL / texH);
        uv[base + 6] = uBR / texW; uv[base + 7] = 1.0 - (vBR / texH);
    };

    // Face 0: +X (Right side of part)
    setUV(0, rX1, y1,  rX0, y1,  rX1, y2,  rX0, y2);

    // Face 1: -X (Left side of part)
    setUV(1, lX1, y1,  lX0, y1,  lX1, y2,  lX0, y2);

    // Face 2: +Y (Top of part)
    setUV(2, fX1, y0,  fX0, y0,  fX1, y1,  fX0, y1);

    // Face 3: -Y (Bottom of part)
    const botX0 = fX1, botX1 = botX0 + partW;
    setUV(3, botX1, y0,  botX0, y0,  botX1, y1,  botX0, y1);

    // Face 4: +Z (Front face of part)
    setUV(4, fX1, y1,  fX0, y1,  fX1, y2,  fX0, y2);

    // Face 5: -Z (Back face of part)
    setUV(5, bX1, y1,  bX0, y1,  bX1, y2,  bX0, y2);

    geom.attributes.uv.needsUpdate = true;
    return geom;
}

// --- MINECRAFT PLAYER 3D HIERARCHY BUILDER ---
function createMinecraftPlayerHierarchy(skinTexture) {
    const root = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({
        map: skinTexture,
        transparent: false
    });
    const hatMat = new THREE.MeshLambertMaterial({
        map: skinTexture,
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide
    });

    // 1. Head Pivot at neck (0, 1.5, 0)
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.5, 0);

    const headGeom = createMinecraftBoxGeometry(0.5, 0.5, 0.5, 0, 0, 8, 8, 8);
    const headMesh = new THREE.Mesh(headGeom, skinMat);
    headMesh.position.set(0, 0.25, 0);
    headPivot.add(headMesh);

    // Hat / 3D Outer Layer (overlay)
    const hatGeom = createMinecraftBoxGeometry(0.56, 0.56, 0.56, 32, 0, 8, 8, 8);
    const hatMesh = new THREE.Mesh(hatGeom, hatMat);
    hatMesh.position.set(0, 0.25, 0);
    headPivot.add(hatMesh);

    // 2. Torso (0, 1.125, 0)
    const torsoGeom = createMinecraftBoxGeometry(0.5, 0.75, 0.25, 16, 16, 8, 12, 4);
    const torsoMesh = new THREE.Mesh(torsoGeom, skinMat);
    torsoMesh.position.set(0, 1.125, 0);

    // 3. Right Arm Pivot at shoulder (0.375, 1.375, 0)
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.375, 1.375, 0);
    const rArmGeom = createMinecraftBoxGeometry(0.25, 0.75, 0.25, 40, 16, 4, 12, 4);
    const rightArmMesh = new THREE.Mesh(rArmGeom, skinMat);
    rightArmMesh.position.set(0, -0.375, 0);
    rightArmPivot.add(rightArmMesh);

    // Held item container on right hand
    const itemContainer = new THREE.Group();
    itemContainer.position.set(0, -0.32, 0.14);
    rightArmMesh.add(itemContainer);

    // 4. Left Arm Pivot at shoulder (-0.375, 1.375, 0)
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.375, 1.375, 0);
    const lArmGeom = createMinecraftBoxGeometry(0.25, 0.75, 0.25, 32, 48, 4, 12, 4);
    const leftArmMesh = new THREE.Mesh(lArmGeom, skinMat);
    leftArmMesh.position.set(0, -0.375, 0);
    leftArmPivot.add(leftArmMesh);

    // 5. Right Leg Pivot at hip (0.125, 0.75, 0)
    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.125, 0.75, 0);
    const rLegGeom = createMinecraftBoxGeometry(0.25, 0.75, 0.25, 0, 16, 4, 12, 4);
    const rightLegMesh = new THREE.Mesh(rLegGeom, skinMat);
    rightLegMesh.position.set(0, -0.375, 0);
    rightLegPivot.add(rightLegMesh);

    // 6. Left Leg Pivot at hip (-0.125, 0.75, 0)
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.125, 0.75, 0);
    const lLegGeom = createMinecraftBoxGeometry(0.25, 0.75, 0.25, 16, 48, 4, 12, 4);
    const leftLegMesh = new THREE.Mesh(lLegGeom, skinMat);
    leftLegMesh.position.set(0, -0.375, 0);
    leftLegPivot.add(leftLegMesh);

    root.add(headPivot, torsoMesh, rightArmPivot, leftArmPivot, rightLegPivot, leftLegPivot);

    const setSkinTexture = (newTex) => {
        if (!newTex) return;
        skinMat.map = newTex;
        skinMat.needsUpdate = true;
        hatMat.map = newTex;
        hatMat.needsUpdate = true;
    };

    return {
        root,
        skinMat,
        hatMat,
        headPivot,
        headMesh,
        hatMesh,
        torsoMesh,
        rightArmPivot,
        rightArmMesh,
        itemContainer,
        leftArmPivot,
        leftArmMesh,
        rightLegPivot,
        rightLegMesh,
        leftLegPivot,
        leftLegMesh,
        setSkinTexture
    };
}

// --- MINECRAFT SKIN MANAGER (PROCEDURAL 64x64 + CUSTOM SKIN SUPPORT) ---
class MinecraftSkinManager {
    constructor() {
        this.skinTextures = new Map();
        this.skinCanvases = new Map();
        this.customSkinDataUrl = null;
        try {
            this.customSkinDataUrl = localStorage.getItem('eblankraft_custom_skin') || null;
        } catch (e) {}
    }

    createProceduralSkinCanvas(skinId) {
        if (this.skinCanvases.has(skinId)) {
            return this.skinCanvases.get(skinId);
        }

        const cvs = document.createElement('canvas');
        cvs.width = 64;
        cvs.height = 64;
        const ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        let skinColor = '#d9a073';
        let hairColor = '#4a2f18';
        let eyeColor = '#2b4e8c';
        let shirtColor = '#00a8a8';
        let pantsColor = '#2c397a';
        let shoesColor = '#555555';

        if (skinId === 'gopnik') {
            skinColor = '#d8aa84';
            hairColor = '#1a1a1a';
            eyeColor = '#3a3a3a';
            shirtColor = '#181818';
            pantsColor = '#181818';
            shoesColor = '#ffffff';
        } else if (skinId === 'rich') {
            skinColor = '#e0b58e';
            hairColor = '#f5c518';
            eyeColor = '#111111';
            shirtColor = '#d4af37';
            pantsColor = '#222222';
            shoesColor = '#111111';
        } else if (skinId === 'cyber') {
            skinColor = '#90caf9';
            hairColor = '#00e5ff';
            eyeColor = '#00e5ff';
            shirtColor = '#151c24';
            pantsColor = '#10141a';
            shoesColor = '#00e5ff';
        } else if (skinId === 'demon') {
            skinColor = '#c62828';
            hairColor = '#ff5722';
            eyeColor = '#ffd600';
            shirtColor = '#4a0e17';
            pantsColor = '#210808';
            shoesColor = '#ff3d00';
        } else if (skinId === 'slayer') {
            skinColor = '#3d1766';
            hairColor = '#ba68c8';
            eyeColor = '#e040fb';
            shirtColor = '#220b3b';
            pantsColor = '#140524';
            shoesColor = '#7b1fa2';
        } else if (skinId === 'popcat') {
            skinColor = '#fff8e7';
            hairColor = '#d7ccc8';
            eyeColor = '#ff5722';
            shirtColor = '#ffab91';
            pantsColor = '#8d6e63';
            shoesColor = '#d7ccc8';
        } else if (skinId === 'gigachad') {
            skinColor = '#e2b382';
            hairColor = '#111111';
            eyeColor = '#263238';
            shirtColor = '#37474f';
            pantsColor = '#263238';
            shoesColor = '#111111';
        }

        // 1. HEAD BASE: (0, 0) to (32, 16)
        ctx.fillStyle = skinColor;
        ctx.fillRect(0, 0, 32, 16);

        // Hair
        ctx.fillStyle = hairColor;
        ctx.fillRect(8, 0, 8, 8); // Top
        ctx.fillRect(0, 8, 32, 3); // Top perimeter
        ctx.fillRect(0, 8, 8, 6);  // Right side
        ctx.fillRect(16, 8, 8, 6); // Left side
        ctx.fillRect(24, 8, 8, 8); // Back

        // Face details on Front (8, 8, 8, 8)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(9, 12, 2, 1);
        ctx.fillRect(13, 12, 2, 1);
        ctx.fillStyle = eyeColor;
        ctx.fillRect(10, 12, 1, 1);
        ctx.fillRect(13, 12, 1, 1);

        // Mouth / Beard / Features
        if (skinId === 'classic') {
            ctx.fillStyle = '#6b4124';
            ctx.fillRect(10, 14, 4, 1);
            ctx.fillRect(11, 15, 2, 1);
        } else if (skinId === 'gopnik') {
            ctx.fillStyle = '#7a3e20';
            ctx.fillRect(10, 14, 4, 1);
        } else if (skinId === 'rich') {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(8, 11, 8, 3);
            ctx.fillStyle = '#111111';
            ctx.fillRect(9, 12, 2, 2);
            ctx.fillRect(13, 12, 2, 2);
        } else if (skinId === 'cyber') {
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(8, 11, 8, 3);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(10, 12, 4, 1);
        } else if (skinId === 'demon') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(10, 14, 1, 1);
            ctx.fillRect(13, 14, 1, 1);
        } else if (skinId === 'popcat') {
            ctx.fillStyle = '#ff1744';
            ctx.fillRect(10, 13, 4, 3);
        } else if (skinId === 'gigachad') {
            ctx.fillStyle = '#333333';
            ctx.fillRect(9, 14, 6, 2);
        }

        // Head Overlay (Hat layer): (32, 0) to (64, 16)
        if (skinId === 'gopnik') {
            ctx.fillStyle = '#111111';
            ctx.fillRect(40, 0, 8, 8);
            ctx.fillRect(32, 8, 32, 3);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(43, 8, 2, 2);
        } else if (skinId === 'demon') {
            ctx.fillStyle = '#ff3d00';
            ctx.fillRect(39, 6, 2, 3);
            ctx.fillRect(47, 6, 2, 3);
        } else if (skinId === 'slayer') {
            ctx.fillStyle = '#9c27b0';
            ctx.fillRect(40, 0, 8, 8);
            ctx.fillStyle = '#e040fb';
            ctx.fillRect(40, 8, 8, 2);
        } else if (skinId === 'popcat') {
            ctx.fillStyle = '#ffccbc';
            ctx.fillRect(39, 6, 2, 2);
            ctx.fillRect(47, 6, 2, 2);
        }

        // 2. TORSO: (16, 16) to (40, 32)
        ctx.fillStyle = shirtColor;
        ctx.fillRect(16, 16, 24, 16);

        if (skinId === 'classic') {
            ctx.fillStyle = skinColor;
            ctx.fillRect(22, 20, 4, 2);
            ctx.fillRect(23, 22, 2, 1);
        } else if (skinId === 'gopnik') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(23, 20, 2, 12);
            ctx.fillRect(20, 20, 1, 12);
            ctx.fillRect(27, 20, 1, 12);
        } else if (skinId === 'rich') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(22, 20, 4, 4);
            ctx.fillStyle = '#111111';
            ctx.fillRect(23, 21, 2, 6);
        } else if (skinId === 'cyber') {
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(22, 23, 4, 4);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(23, 24, 2, 2);
        } else if (skinId === 'demon') {
            ctx.fillStyle = '#ff5722';
            ctx.fillRect(22, 22, 4, 8);
            ctx.fillStyle = '#ffd600';
            ctx.fillRect(23, 24, 2, 4);
        } else if (skinId === 'gigachad') {
            ctx.fillStyle = skinColor;
            ctx.fillRect(20, 20, 8, 6);
            ctx.fillStyle = '#b27f54';
            ctx.fillRect(22, 22, 4, 1);
            ctx.fillRect(23, 23, 2, 3);
        }

        ctx.fillStyle = '#111111';
        ctx.fillRect(20, 30, 8, 2);

        // 3. RIGHT ARM: (40, 16) to (56, 32)
        ctx.fillStyle = shirtColor;
        ctx.fillRect(40, 16, 16, 6);
        ctx.fillStyle = skinColor;
        ctx.fillRect(40, 22, 16, 10);
        if (skinId === 'gopnik') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(41, 16, 1, 6);
            ctx.fillRect(43, 16, 1, 6);
        } else if (skinId === 'rich') {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(44, 26, 4, 2);
        } else if (skinId === 'cyber') {
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(45, 24, 2, 6);
        }

        // 4. LEFT ARM: (32, 48) to (48, 64)
        ctx.fillStyle = shirtColor;
        ctx.fillRect(32, 48, 16, 6);
        ctx.fillStyle = skinColor;
        ctx.fillRect(32, 54, 16, 10);
        if (skinId === 'gopnik') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(33, 48, 1, 6);
            ctx.fillRect(35, 48, 1, 6);
        } else if (skinId === 'cyber') {
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(37, 56, 2, 6);
        }

        // 5. RIGHT LEG: (0, 16) to (16, 32)
        ctx.fillStyle = pantsColor;
        ctx.fillRect(0, 16, 16, 12);
        ctx.fillStyle = shoesColor;
        ctx.fillRect(0, 28, 16, 4);
        if (skinId === 'gopnik') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(1, 16, 1, 12);
            ctx.fillRect(3, 16, 1, 12);
        }

        // 6. LEFT LEG: (16, 48) to (32, 64)
        ctx.fillStyle = pantsColor;
        ctx.fillRect(16, 48, 16, 12);
        ctx.fillStyle = shoesColor;
        ctx.fillRect(16, 60, 16, 4);
        if (skinId === 'gopnik') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(17, 48, 1, 12);
            ctx.fillRect(19, 48, 1, 12);
        }

        this.skinCanvases.set(skinId, cvs);
        return cvs;
    }

    getSkinTexture(skinId = 'classic', customDataUrl = null) {
        if (customDataUrl) {
            return this.getTextureFromDataUrl(customDataUrl);
        }
        if (skinId === 'custom') {
            if (this.customSkinDataUrl) {
                return this.getTextureFromDataUrl(this.customSkinDataUrl);
            }
            skinId = 'classic';
        }

        if (this.skinTextures.has(skinId)) {
            return this.skinTextures.get(skinId);
        }

        const cvs = this.createProceduralSkinCanvas(skinId);
        const tex = new THREE.CanvasTexture(cvs);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        this.skinTextures.set(skinId, tex);
        return tex;
    }

    getTextureFromDataUrl(dataUrl) {
        if (this.skinTextures.has(dataUrl)) {
            return this.skinTextures.get(dataUrl);
        }

        const cvs = document.createElement('canvas');
        cvs.width = 64;
        cvs.height = 64;
        const ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const tex = new THREE.CanvasTexture(cvs);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        this.skinTextures.set(dataUrl, tex);

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            ctx.clearRect(0, 0, 64, 64);
            if (img.height === 32) {
                // Classic 64x32 skin format -> expand to 64x64
                ctx.drawImage(img, 0, 0);
                // Copy right arm to left arm (32, 48)
                ctx.drawImage(img, 40, 16, 16, 16, 32, 48, 16, 16);
                // Copy right leg to left leg (16, 48)
                ctx.drawImage(img, 0, 16, 16, 16, 16, 48, 16, 16);
            } else {
                ctx.drawImage(img, 0, 0, 64, 64);
            }
            tex.needsUpdate = true;
        };
        img.src = dataUrl;
        return tex;
    }

    setCustomSkin(dataUrl) {
        this.customSkinDataUrl = dataUrl;
        try {
            localStorage.setItem('eblankraft_custom_skin', dataUrl);
        } catch (e) {}
        this.skinTextures.delete('custom');
        const tex = this.getTextureFromDataUrl(dataUrl);
        this.skinTextures.set('custom', tex);
        return tex;
    }

    getFacePreviewCanvas(skinId = 'classic') {
        const preview = document.createElement('canvas');
        preview.width = 48;
        preview.height = 48;
        const pctx = preview.getContext('2d');
        pctx.imageSmoothingEnabled = false;

        let srcCvs = null;
        if (skinId === 'custom' && this.customSkinDataUrl) {
            const cachedTex = this.skinTextures.get('custom') || this.getTextureFromDataUrl(this.customSkinDataUrl);
            srcCvs = cachedTex ? cachedTex.image : null;
        } else {
            srcCvs = this.createProceduralSkinCanvas(skinId);
        }

        if (srcCvs) {
            // Draw head base (8, 8, 8, 8)
            pctx.drawImage(srcCvs, 8, 8, 8, 8, 0, 0, 48, 48);
            // Draw hat overlay (40, 8, 8, 8)
            pctx.drawImage(srcCvs, 40, 8, 8, 8, 0, 0, 48, 48);
        } else {
            pctx.fillStyle = '#cca07a';
            pctx.fillRect(0, 0, 48, 48);
        }

        return preview;
    }
}

window.createMinecraftBoxGeometry = createMinecraftBoxGeometry;
window.createMinecraftPlayerHierarchy = createMinecraftPlayerHierarchy;
window.MinecraftSkinManager = MinecraftSkinManager;
window.skinManager = new MinecraftSkinManager();

window.SKINS_REGISTRY = SKINS_REGISTRY;
window.CASES_CONFIG = CASES_CONFIG;
window.UPGRADES_CONFIG = UPGRADES_CONFIG;
window.UpgraderSkinsManager = UpgraderSkinsManager;



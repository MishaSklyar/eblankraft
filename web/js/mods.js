/**
 * Eblankraft 2.0 - MOD SCRIPT API (Lua 5.3) & Mod Manager Engine
 * Powered by Fengari (Lua 5.3 runtime in Pure JavaScript)
 */

// ==========================================
// 1. SOUND SYNTHESIZER (Web Audio API)
// ==========================================
class SoundSynthesizer {
    constructor(soundManager) {
        this.soundManager = soundManager;
        this.ctx = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.engineFilter = null;
        this.isEngineRunning = false;
    }

    getCtx() {
        if (!this.ctx) {
            if (this.soundManager && this.soundManager.ctx) {
                this.ctx = this.soundManager.ctx;
            } else {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.ctx = new AudioContext();
                }
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    play(name) {
        if (this.soundManager && typeof this.soundManager[name] === 'function') {
            try { this.soundManager[name](); return true; } catch(e) {}
        }
        return false;
    }

    tone(freq = 440, duration = 0.2, type = 'sine') {
        const ctx = this.getCtx();
        if (!ctx) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(Number(freq) || 440, ctx.currentTime);

            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + Math.max(0.05, Number(duration) || 0.2));

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + Math.max(0.05, Number(duration) || 0.2));
        } catch(e) {}
    }

    beep(freq = 600, duration = 0.1) {
        this.tone(freq, duration, 'square');
    }

    horn(duration = 0.45) {
        const ctx = this.getCtx();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const dur = Math.max(0.2, Number(duration) || 0.45);

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sawtooth';
            osc2.type = 'triangle';
            osc1.frequency.setValueAtTime(349.2, now);
            osc2.frequency.setValueAtTime(440.0, now);

            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.26, now + 0.04);
            gain.gain.setValueAtTime(0.26, now + dur - 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + dur);
            osc2.stop(now + dur);
        } catch(e) {}
    }

    engine(rpm = 1000, volume = 0.15) {
        const ctx = this.getCtx();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const freq = Math.max(45, Math.min(320, 50 + (Number(rpm) || 1000) * 0.04));

            if (!this.engineOsc || !this.isEngineRunning) {
                this.engineOsc = ctx.createOscillator();
                this.engineGain = ctx.createGain();
                this.engineFilter = ctx.createBiquadFilter();

                this.engineOsc.type = 'sawtooth';
                this.engineFilter.type = 'lowpass';
                this.engineFilter.frequency.setValueAtTime(400, now);

                this.engineOsc.frequency.setValueAtTime(freq, now);
                this.engineGain.gain.setValueAtTime(0.01, now);
                this.engineGain.gain.linearRampToValueAtTime(Math.min(0.28, Number(volume) || 0.15), now + 0.1);

                this.engineOsc.connect(this.engineFilter);
                this.engineFilter.connect(this.engineGain);
                this.engineGain.connect(ctx.destination);

                this.engineOsc.start();
                this.isEngineRunning = true;
            } else {
                this.engineOsc.frequency.setTargetAtTime(freq, now, 0.08);
                this.engineFilter.frequency.setTargetAtTime(300 + freq * 2.2, now, 0.08);
                this.engineGain.gain.setTargetAtTime(Math.min(0.28, Number(volume) || 0.15), now, 0.08);
            }
        } catch(e) {}
    }

    stopEngine() {
        if (!this.isEngineRunning || !this.engineGain) return;
        try {
            const ctx = this.getCtx();
            const now = ctx ? ctx.currentTime : 0;
            this.engineGain.gain.linearRampToValueAtTime(0.001, now + 0.12);
            setTimeout(() => {
                try {
                    if (this.engineOsc) {
                        this.engineOsc.stop();
                        this.engineOsc.disconnect();
                    }
                } catch(e) {}
                this.engineOsc = null;
                this.isEngineRunning = false;
            }, 150);
        } catch(e) {
            this.isEngineRunning = false;
        }
    }

    screech(duration = 0.3) {
        const ctx = this.getCtx();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const dur = Math.max(0.1, Number(duration) || 0.3);
            const bufferSize = ctx.sampleRate * dur;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.7));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, now);
            filter.Q.setValueAtTime(3.0, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            noise.start(now);
        } catch(e) {}
    }

    gunshot(pitch = 1.0, volume = 0.35) {
        const ctx = this.getCtx();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const p = Math.max(0.4, Math.min(2.5, Number(pitch) || 1.0));
            const vol = Math.max(0.05, Math.min(1.0, Number(volume) || 0.35));

            // Layer 1: Sharp noise transient
            const bufLen = Math.floor(ctx.sampleRate * 0.12);
            const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
            const out = noiseBuf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) {
                out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.22));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuf;

            const bpf = ctx.createBiquadFilter();
            bpf.type = 'bandpass';
            bpf.frequency.setValueAtTime(1600 * p, now);
            bpf.Q.setValueAtTime(1.8, now);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(vol * 0.85, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

            noise.connect(bpf);
            bpf.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(now);

            // Layer 2: Heavy punch body (frequency drop)
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220 * p, now);
            osc.frequency.exponentialRampToValueAtTime(38 * p, now + 0.09);

            const lpf = ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.setValueAtTime(450 * p, now);
            lpf.frequency.exponentialRampToValueAtTime(80, now + 0.12);

            oscGain.gain.setValueAtTime(vol * 0.9, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

            osc.connect(lpf);
            lpf.connect(oscGain);
            oscGain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {}
    }

    reload(stage = 'click') {
        const ctx = this.getCtx();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            if (stage === 'mag_out') {
                osc.frequency.setValueAtTime(420, now);
                osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            } else if (stage === 'mag_in') {
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(680, now + 0.07);
                gain.gain.setValueAtTime(0.24, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            } else if (stage === 'bolt') {
                osc.frequency.setValueAtTime(750, now);
                osc.frequency.exponentialRampToValueAtTime(480, now + 0.1);
                gain.gain.setValueAtTime(0.26, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
            } else {
                osc.frequency.setValueAtTime(580, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
            }
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        } catch (e) {}
    }

    dryFire() {
        const ctx = this.getCtx();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.06);
        } catch (e) {}
    }
}

// ==========================================
// 2. CUSTOM BLOCKS REGISTRATION SUBSYSTEM
// ==========================================
// ==========================================
class CustomBlockRegistry {
    constructor(game, modManager) {
        this.game = game;
        this.modManager = modManager;
        this.registeredBlocks = new Map();
        this.nextBlockId = 50;
    }

    register(rawOpts = {}) {
        if (!this.game.textureManager) return 0;

        const opts = (this.modManager && typeof this.modManager.luaToJs === 'function')
            ? this.modManager.luaToJs(rawOpts)
            : rawOpts;

        const id = Number(opts.id) || this.nextBlockId++;
        if (id >= this.nextBlockId) this.nextBlockId = id + 1;

        const nameKey = (opts.name || opts.id_name || (`custom_${id}`)).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        const upperKey = nameKey.toUpperCase();
        const title = String(opts.title || opts.name || `Блок ${id}`);
        const sound = String(opts.sound || 'stone');
        const hardness = Number(opts.hardness) || 1.5;
        const solid = opts.solid !== false;
        const transparent = !!opts.transparent;
        const opacity = transparent ? (Number(opts.opacity) || 0.8) : 1.0;
        const alphaTest = Number(opts.alphaTest) || (transparent ? 0.1 : 0);
        const emissive = opts.emissive ? new THREE.Color(opts.emissive) : undefined;
        const tool = opts.tool || 'pickaxe';
        const dropItem = (opts.dropItem !== undefined) ? opts.dropItem : nameKey;
        const dropCount = Number(opts.dropCount) || 1;

        const tm = this.game.textureManager;

        // Determine if multi-face textures or single texture
        let material;
        let iconCanvas = null;

        const faceMap = opts.textures || opts.faces;
        if (faceMap) {
            // Three.js BoxGeometry face order:
            // 0: +X (Right / East)
            // 1: -X (Left / West)
            // 2: +Y (Top)
            // 3: -Y (Bottom)
            // 4: +Z (Front / South)
            // 5: -Z (Back / North)
            let faceSpecs = [];
            if (Array.isArray(faceMap)) {
                faceSpecs = faceMap.slice(0, 6);
                while (faceSpecs.length < 6) faceSpecs.push(faceSpecs[0] || opts.texture || opts.color || '#444444');
            } else if (typeof faceMap === 'object') {
                const top = faceMap.top || faceMap.up || faceMap.y || opts.texture || opts.color || '#555555';
                const bottom = faceMap.bottom || faceMap.down || top;
                const side = faceMap.side || faceMap.sides || opts.texture || opts.color || '#444444';
                const right = faceMap.right || faceMap.east || faceMap.posX || side;
                const left = faceMap.left || faceMap.west || faceMap.negX || side;
                const front = faceMap.front || faceMap.south || faceMap.posZ || side;
                const back = faceMap.back || faceMap.north || faceMap.negZ || side;
                faceSpecs = [right, left, top, bottom, front, back];
            }

            const faceMaterials = [];
            for (let f = 0; f < 6; f++) {
                const spec = faceSpecs[f];
                let texObj = null;
                const cv = tm.createCanvasFromSpec(spec, 16, 16, () => {
                    if (texObj) texObj.needsUpdate = true;
                    if (this.game.world) this.game.world.updateMeshes();
                });
                if (f === 2 || !iconCanvas) iconCanvas = cv; // Top face for icon

                texObj = new THREE.CanvasTexture(cv);
                texObj.magFilter = THREE.NearestFilter;
                texObj.minFilter = THREE.NearestFilter;

                const mat = new THREE.MeshLambertMaterial({
                    map: texObj,
                    transparent: transparent,
                    opacity: opacity,
                    alphaTest: alphaTest,
                    emissive: emissive
                });
                faceMaterials.push(mat);
            }
            material = faceMaterials;
            tm.materials[id] = faceMaterials;
        } else {
            // Single texture across all faces
            const spec = opts.pixels ? { pixels: opts.pixels, colors: opts.colors }
                       : opts.texture || opts.textureUrl || opts.image || opts.dataUrl || { color: opts.color || '#444444', pattern: opts.pattern || 'noise' };

            let texObj = null;
            const cv = tm.createCanvasFromSpec(spec, 16, 16, () => {
                if (texObj) texObj.needsUpdate = true;
                if (this.game.world) this.game.world.updateMeshes();
            });
            if (typeof opts.draw === 'function') {
                try { opts.draw(cv.getContext('2d'), 16, 16); } catch(e) {}
            }
            iconCanvas = cv;

            texObj = new THREE.CanvasTexture(cv);
            texObj.magFilter = THREE.NearestFilter;
            texObj.minFilter = THREE.NearestFilter;

            material = new THREE.MeshLambertMaterial({
                map: texObj,
                transparent: transparent,
                opacity: opacity,
                alphaTest: alphaTest,
                emissive: emissive
            });
            tm.materials[id] = material;
        }

        // Register in TextureManager canvasCache
        if (iconCanvas) {
            tm.canvasCache[nameKey] = iconCanvas;
            if (tm.iconDataUrlCache) {
                tm.iconDataUrlCache.delete(nameKey);
                tm.iconDataUrlCache.delete(id);
            }
        }

        // Register in Global Block Registries
        if (window.BLOCK_TYPES) window.BLOCK_TYPES[upperKey] = id;
        if (window.BLOCK_INFO) {
            window.BLOCK_INFO[id] = {
                id,
                name: title,
                sound: sound,
                hardness: hardness,
                transparent: transparent,
                solid: solid,
                tool: tool,
                dropItem: dropItem,
                dropCount: dropCount,
                iconKey: nameKey
            };
        }

        // Register in Items Registry
        if (window.ITEM_TYPES) window.ITEM_TYPES[upperKey] = nameKey;
        if (window.ITEM_REGISTRY) {
            window.ITEM_REGISTRY[nameKey] = {
                id: nameKey,
                name: title,
                category: 'block',
                blockType: id,
                icon: nameKey,
                maxStack: Number(opts.maxStack) || 64
            };
        }

        this.registeredBlocks.set(id, { id, nameKey, upperKey, title, opts });

        if (this.game.world) {
            this.game.world.updateMeshes();
        }

        return id;
    }

    clear() {
        for (const [id, info] of this.registeredBlocks.entries()) {
            if (window.BLOCK_TYPES && window.BLOCK_TYPES[info.upperKey]) {
                delete window.BLOCK_TYPES[info.upperKey];
            }
            if (window.BLOCK_INFO && window.BLOCK_INFO[id]) {
                delete window.BLOCK_INFO[id];
            }
            if (window.ITEM_REGISTRY && window.ITEM_REGISTRY[info.nameKey]) {
                delete window.ITEM_REGISTRY[info.nameKey];
            }
            if (this.game.textureManager && this.game.textureManager.materials[id]) {
                delete this.game.textureManager.materials[id];
            }
        }
        this.registeredBlocks.clear();
    }
}

// ==========================================
// 2. REGION SYSTEM (Grief Prevention / Private Regions)
// ==========================================
class RegionManager {
    constructor(game, modManager) {
        this.game = game;
        this.modManager = modManager;
        this.regions = new Map();
    }

    create(id, x1, y1, z1, x2, y2, z2, opts = {}) {
        if (!id) id = `reg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const minX = Math.min(Math.floor(x1), Math.floor(x2));
        const maxX = Math.max(Math.floor(x1), Math.floor(x2));
        const minY = Math.max(0, Math.min(Math.floor(y1), Math.floor(y2)));
        const maxY = Math.min(31, Math.max(Math.floor(y1), Math.floor(y2)));
        const minZ = Math.min(Math.floor(z1), Math.floor(z2));
        const maxZ = Math.max(Math.floor(z1), Math.floor(z2));

        const region = {
            id: String(id),
            name: String(opts.name || id),
            minX, minY, minZ,
            maxX, maxY, maxZ,
            owner: String(opts.owner || 'server'),
            members: Array.isArray(opts.members) ? opts.members.map(String) : [],
            allowBreak: !!opts.allowBreak,
            allowPlace: !!opts.allowPlace,
            allowExplosion: !!opts.allowExplosion,
            allowInteract: opts.allowInteract !== false,
            message: opts.message !== undefined ? String(opts.message) : '⚠️ Цей регіон захищено!',
            onBreak: typeof opts.onBreak === 'function' ? opts.onBreak : null,
            onPlace: typeof opts.onPlace === 'function' ? opts.onPlace : null,
            onInteract: typeof opts.onInteract === 'function' ? opts.onInteract : null
        };
        this.regions.set(region.id, region);
        return region;
    }

    remove(id) {
        return this.regions.delete(String(id));
    }

    clear() {
        this.regions.clear();
    }

    getAt(x, y, z) {
        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);
        for (const reg of this.regions.values()) {
            if (bx >= reg.minX && bx <= reg.maxX &&
                by >= reg.minY && by <= reg.maxY &&
                bz >= reg.minZ && bz <= reg.maxZ) {
                return reg;
            }
        }
        return null;
    }

    list() {
        return Array.from(this.regions.values());
    }

    isAllowed(player, x, y, z, action) {
        const reg = this.getAt(x, y, z);
        if (!reg) return true;

        const isCreative = player && (player.isCreative || player.godMode);
        if (isCreative) return true;

        if (action === 'break') {
            if (reg.onBreak) {
                const res = reg.onBreak(x, y, z, player);
                if (res !== undefined) return !!res;
            }
            return !!reg.allowBreak;
        }

        if (action === 'place') {
            if (reg.onPlace) {
                const res = reg.onPlace(x, y, z, player);
                if (res !== undefined) return !!res;
            }
            return !!reg.allowPlace;
        }

        if (action === 'explode') {
            return !!reg.allowExplosion;
        }

        if (action === 'interact') {
            if (reg.onInteract) {
                const res = reg.onInteract(x, y, z, player);
                if (res !== undefined) return !!res;
            }
            return !!reg.allowInteract;
        }

        return true;
    }
}

// ==========================================
// 2b. CUSTOM ITEMS REGISTRATION SUBSYSTEM
// ==========================================
class CustomItemRegistry {
    constructor(game) {
        this.game = game;
        this.registeredItems = new Map();
    }

    register(opts = {}) {
        if (!opts || !opts.id) return null;

        const id = String(opts.id).trim().toLowerCase();
        const upperKey = id.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const name = String(opts.name || opts.title || id);
        const category = String(opts.category || 'weapon').toLowerCase();
        const maxStack = Number(opts.maxStack) || (category === 'weapon' || category === 'tool' ? 1 : 64);
        const attackDamage = Number(opts.attackDamage) || (category === 'weapon' ? 35 : 12);
        const miningSpeed = Number(opts.miningSpeed) || 1.0;
        const durability = Number(opts.durability) || 1500;
        const iconKey = String(opts.icon || id);

        // Procedural 16x16 Pixel Texture Canvas for the item icon
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        let hasCustomDrawing = false;

        // 1. Pixel grid drawing if provided
        // opts.pixels: array of 16 strings, e.g. ["....####...."]
        // opts.colors: map of character to color string, e.g. { "#": "#222", "W": "#8b4513" }
        if (opts.pixels && Array.isArray(opts.pixels) && opts.colors) {
            hasCustomDrawing = true;
            for (let y = 0; y < Math.min(16, opts.pixels.length); y++) {
                const row = String(opts.pixels[y]);
                for (let x = 0; x < Math.min(16, row.length); x++) {
                    const ch = row[x];
                    const color = opts.colors[ch];
                    if (color && color !== 'transparent' && color !== 'none' && color !== ' ') {
                        ctx.fillStyle = color;
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        } else if (typeof opts.draw === 'function') {
            hasCustomDrawing = true;
            try { opts.draw(ctx, 16, 16); } catch (e) {}
        } else if (opts.color) {
            hasCustomDrawing = true;
            ctx.fillStyle = opts.color;
            ctx.fillRect(2, 2, 12, 12);
        }

        // Register in TextureManager
        const tm = this.game.textureManager;
        if (tm) {
            if (hasCustomDrawing || !tm.canvasCache[iconKey]) {
                tm.canvasCache[iconKey] = canvas;
                // Invalidate icon data URL cache if present
                if (tm.iconDataUrlCache) {
                    tm.iconDataUrlCache.delete(iconKey);
                    tm.iconDataUrlCache.delete(id);
                }
                const tex = new THREE.CanvasTexture(canvas);
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                tm.threeTextures[iconKey] = tex;
                if (tm.itemDropTextures) {
                    tm.itemDropTextures[iconKey] = tex;
                }
                if (tm.itemDropMaterials && tm.itemDropMaterials[id]) {
                    delete tm.itemDropMaterials[id];
                }
            }
        }

        // Register into global ITEM_TYPES and ITEM_REGISTRY
        if (window.ITEM_TYPES) {
            window.ITEM_TYPES[upperKey] = id;
        }

        const itemDef = {
            id: id,
            name: name,
            category: category,
            icon: iconKey,
            maxStack: maxStack,
            attackDamage: attackDamage,
            miningSpeed: miningSpeed,
            durability: durability,
            transparent: true,
            alphaTest: 0.05
        };

        if (window.ITEM_REGISTRY) {
            window.ITEM_REGISTRY[id] = itemDef;
        }

        this.registeredItems.set(id, { id, upperKey, iconKey });
        return id;
    }

    clear() {
        for (const [id, info] of this.registeredItems.entries()) {
            if (window.ITEM_TYPES && window.ITEM_TYPES[info.upperKey]) {
                delete window.ITEM_TYPES[info.upperKey];
            }
            if (window.ITEM_REGISTRY && window.ITEM_REGISTRY[id]) {
                delete window.ITEM_REGISTRY[id];
            }
            if (this.game.textureManager) {
                const tm = this.game.textureManager;
                if (tm.canvasCache && tm.canvasCache[info.iconKey]) {
                    delete tm.canvasCache[info.iconKey];
                }
                if (tm.threeTextures && tm.threeTextures[info.iconKey]) {
                    delete tm.threeTextures[info.iconKey];
                }
                if (tm.iconDataUrlCache) {
                    tm.iconDataUrlCache.delete(info.iconKey);
                    tm.iconDataUrlCache.delete(id);
                }
                if (tm.itemDropMaterials && tm.itemDropMaterials[id]) {
                    delete tm.itemDropMaterials[id];
                }
            }
        }
        this.registeredItems.clear();
    }
}

// ==========================================
// 2c. WEAPON & COMBAT SUBSYSTEM (Raycasting, Tracers, Recoil)
// ==========================================
class WeaponCombatManager {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
    }

    shoot(opts = {}) {
        const player = this.game.player;
        if (!player || player.isDead) return { hit: false, reason: 'dead_or_no_player' };

        const damage = Number(opts.damage) || 35;
        const range = Number(opts.range) || 65;
        const spread = Math.max(0, Number(opts.spread) || 0);
        const recoilPitch = Number(opts.recoilPitch) || 0.04;
        const recoilYaw = Number(opts.recoilYaw) || 0.01;
        const tracerColor = (opts.tracerColor !== undefined) ? opts.tracerColor : 0xffdd44;
        const count = Math.max(1, Math.min(20, Math.floor(Number(opts.bulletCount) || 1)));

        // Arm swing animation for shooting visual
        player.armSwing = 0.55;

        // Recoil camera pitch/yaw kick
        if (recoilPitch > 0) {
            player.pitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, player.pitch + recoilPitch));
        }
        if (recoilYaw !== 0) {
            player.yaw += (Math.random() - 0.5) * recoilYaw;
        }

        // Camera trauma / shake
        if (this.game.cameraShakeTrauma !== undefined) {
            this.game.cameraShakeTrauma = Math.min(1.0, (this.game.cameraShakeTrauma || 0) + 0.12);
        }

        // Gunshot Sound
        if (opts.sound !== false && this.game.modManager && this.game.modManager.soundSynth) {
            this.game.modManager.soundSynth.gunshot(opts.pitch || 1.0, opts.volume || 0.35);
        }

        const origin = new THREE.Vector3(
            player.position.x,
            player.position.y + player.eyeHeight,
            player.position.z
        );

        let bestResult = { hit: false, type: 'none', distance: range };

        for (let b = 0; b < count; b++) {
            let dir = new THREE.Vector3(
                -Math.sin(player.yaw) * Math.cos(player.pitch),
                Math.sin(player.pitch),
                -Math.cos(player.yaw) * Math.cos(player.pitch)
            ).normalize();

            if (spread > 0) {
                const spreadX = (Math.random() - 0.5) * spread;
                const spreadY = (Math.random() - 0.5) * spread;
                const spreadZ = (Math.random() - 0.5) * spread;
                dir.add(new THREE.Vector3(spreadX, spreadY, spreadZ)).normalize();
            }

            const bulletHit = this._raycastBullet(origin, dir, range, damage, opts);
            if (bulletHit.hit && (!bestResult.hit || bulletHit.distance < bestResult.distance)) {
                bestResult = bulletHit;
            }

            // Visual Tracer Line
            this._spawnTracer(origin, dir, bulletHit.hit ? bulletHit.distance : range, tracerColor);
        }

        return bestResult;
    }

    _raycastBullet(origin, dir, maxRange, damage, opts) {
        let closestDist = maxRange;
        let hitType = 'none';
        let hitTarget = null;
        let hitPoint = origin.clone().addScaledVector(dir, maxRange);
        let hitBlock = null;

        // 1. Check World Voxels (Blocks) using raymarching
        if (this.game.world) {
            const step = 0.1;
            const curPos = origin.clone();
            for (let d = 0; d < maxRange; d += step) {
                curPos.addScaledVector(dir, step);
                const bx = Math.floor(curPos.x);
                const by = Math.floor(curPos.y);
                const bz = Math.floor(curPos.z);
                const b = this.game.world.getBlock(bx, by, bz);
                if (b !== 0 && b !== 19) { // Not air or water
                    closestDist = d;
                    hitType = 'block';
                    hitPoint = curPos.clone();
                    hitBlock = { x: bx, y: by, z: bz, type: b };
                    break;
                }
            }
        }

        // 2. Check Ender Dragon Boss
        if (this.game.mobManager && this.game.mobManager.dragon) {
            const dragon = this.game.mobManager.dragon;
            if (!dragon.isDead && dragon.mesh) {
                const dragonPos = dragon.mesh.position.clone();
                const d = this._distRayToPoint(origin, dir, dragonPos);
                const projDist = dragonPos.clone().sub(origin).dot(dir);
                if (projDist > 0 && projDist < closestDist && d < 4.5) {
                    closestDist = projDist;
                    hitType = 'dragon';
                    hitTarget = dragon;
                    hitPoint = origin.clone().addScaledVector(dir, projDist);
                }
            }
        }

        // 3. Check Mobs
        if (this.game.mobManager && this.game.mobManager.mobs) {
            for (let mob of this.game.mobManager.mobs) {
                if (mob.isDead || !mob.group) continue;
                const mobCenter = mob.position.clone().add(new THREE.Vector3(0, 0.9, 0));
                const d = this._distRayToPoint(origin, dir, mobCenter);
                const projDist = mobCenter.clone().sub(origin).dot(dir);
                if (projDist > 0 && projDist < closestDist && d < 0.85) {
                    closestDist = projDist;
                    hitType = 'mob';
                    hitTarget = mob;
                    hitPoint = origin.clone().addScaledVector(dir, projDist);
                }
            }
        }

        // 4. Check Remote Players (PvP)
        if (this.game.multiplayer && this.game.multiplayer.remotePlayers) {
            for (let [peerId, remote] of this.game.multiplayer.remotePlayers.entries()) {
                if (!remote.group) continue;
                const remoteCenter = remote.group.position.clone().add(new THREE.Vector3(0, 1.0, 0));
                const d = this._distRayToPoint(origin, dir, remoteCenter);
                const projDist = remoteCenter.clone().sub(origin).dot(dir);
                if (projDist > 0 && projDist < closestDist && d < 0.9) {
                    closestDist = projDist;
                    hitType = 'player';
                    hitTarget = { remote, peerId };
                    hitPoint = origin.clone().addScaledVector(dir, projDist);
                }
            }
        }

        // Apply effects based on what was hit
        if (hitType === 'mob' && hitTarget) {
            hitTarget.takeDamage(damage, dir);
            if (this.game.particleSystem) {
                this.game.particleSystem.spawnBlockBreakParticles(hitPoint.x, hitPoint.y, hitPoint.z, 26, 8); // red blood particles
            }
            return { hit: true, type: 'mob', distance: closestDist, point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z } };
        } else if (hitType === 'dragon' && hitTarget) {
            hitTarget.takeDamage(damage);
            if (this.game.particleSystem) {
                this.game.particleSystem.spawnBlockBreakParticles(hitPoint.x, hitPoint.y, hitPoint.z, 32, 12);
            }
            return { hit: true, type: 'dragon', distance: closestDist, point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z } };
        } else if (hitType === 'player' && hitTarget) {
            hitTarget.remote.takeDamage(damage, (this.game.multiplayer && this.game.multiplayer.playerName) || 'Player');
            if (this.game.multiplayer && this.game.multiplayer.broadcastPvPHit) {
                this.game.multiplayer.broadcastPvPHit(hitTarget.peerId, damage);
            }
            if (this.game.particleSystem) {
                this.game.particleSystem.spawnBlockBreakParticles(hitPoint.x, hitPoint.y, hitPoint.z, 26, 10);
            }
            return { hit: true, type: 'player', peerId: hitTarget.peerId, distance: closestDist, point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z } };
        } else if (hitType === 'block' && hitBlock) {
            if (this.game.particleSystem) {
                this.game.particleSystem.spawnBlockBreakParticles(hitPoint.x, hitPoint.y, hitPoint.z, hitBlock.type, 5);
            }
            return { hit: true, type: 'block', distance: closestDist, point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z }, block: hitBlock };
        }

        return { hit: false, type: 'none', distance: maxRange, point: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z } };
    }

    _distRayToPoint(origin, dir, pt) {
        const v = pt.clone().sub(origin);
        const t = v.dot(dir);
        if (t <= 0) return v.length();
        const proj = origin.clone().addScaledVector(dir, t);
        return proj.distanceTo(pt);
    }

    _spawnTracer(origin, dir, length, color = 0xffdd44) {
        if (!this.scene) return;
        const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
        const start = origin.clone().addScaledVector(right, 0.18).add(new THREE.Vector3(0, -0.15, 0)).addScaledVector(dir, 0.35);
        const end = origin.clone().addScaledVector(dir, length);

        const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2,
            transparent: true,
            opacity: 0.95
        });
        const line = new THREE.Line(geom, mat);
        this.scene.add(line);

        setTimeout(() => {
            if (this.scene) this.scene.remove(line);
            geom.dispose();
            mat.dispose();
        }, 60);
    }

    launchRocket(opts = {}) {
        const player = this.game.player;
        if (!player || player.isDead) return;

        const origin = new THREE.Vector3(
            player.position.x,
            player.position.y + player.eyeHeight,
            player.position.z
        );
        const dir = new THREE.Vector3(
            -Math.sin(player.yaw) * Math.cos(player.pitch),
            Math.sin(player.pitch),
            -Math.cos(player.yaw) * Math.cos(player.pitch)
        ).normalize();

        const rocketGroup = new THREE.Group();
        const bodyGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8);
        bodyGeom.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
        const body = new THREE.Mesh(bodyGeom, bodyMat);

        const tipGeom = new THREE.ConeGeometry(0.12, 0.22, 8);
        tipGeom.rotateX(-Math.PI / 2);
        const tipMat = new THREE.MeshLambertMaterial({ color: 0xc62828 });
        const tip = new THREE.Mesh(tipGeom, tipMat);
        tip.position.z = -0.35;

        rocketGroup.add(body);
        rocketGroup.add(tip);
        rocketGroup.position.copy(origin).addScaledVector(dir, 0.8);
        rocketGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);

        this.scene.add(rocketGroup);

        player.armSwing = 0.8;
        if (this.game.modManager && this.game.modManager.soundSynth) {
            this.game.modManager.soundSynth.gunshot(0.4, 0.5);
        }

        const rocketSpeed = 34.0;
        let lifetime = 4.0;
        const damage = Number(opts.damage) || 250;
        const blastRadius = Number(opts.radius) || 3.5;

        const interval = setInterval(() => {
            if (!rocketGroup.parent) {
                clearInterval(interval);
                return;
            }

            const dt = 0.033;
            lifetime -= dt;
            const deltaPos = dir.clone().multiplyScalar(rocketSpeed * dt);
            const nextPos = rocketGroup.position.clone().add(deltaPos);

            if (this.game.particleSystem) {
                this.game.particleSystem.spawnBlockBreakParticles(rocketGroup.position.x, rocketGroup.position.y, rocketGroup.position.z, 2, 2);
            }

            let hit = false;
            if (this.game.world) {
                const bx = Math.floor(nextPos.x);
                const by = Math.floor(nextPos.y);
                const bz = Math.floor(nextPos.z);
                const block = this.game.world.getBlock(bx, by, bz);
                if (block !== 0 && block !== 19) {
                    hit = true;
                }
            }

            if (!hit && this.game.mobManager && this.game.mobManager.mobs) {
                for (let mob of this.game.mobManager.mobs) {
                    if (!mob.isDead && mob.position.distanceTo(nextPos) < 1.4) {
                        hit = true;
                        break;
                    }
                }
            }

            if (hit || lifetime <= 0) {
                clearInterval(interval);
                this._explodeAt(rocketGroup.position.x, rocketGroup.position.y, rocketGroup.position.z, blastRadius, damage);
                this.scene.remove(rocketGroup);
            } else {
                rocketGroup.position.copy(nextPos);
            }
        }, 33);
    }

    throwGrenade(opts = {}) {
        const player = this.game.player;
        if (!player || player.isDead) return;

        const origin = new THREE.Vector3(
            player.position.x,
            player.position.y + player.eyeHeight,
            player.position.z
        );
        const dir = new THREE.Vector3(
            -Math.sin(player.yaw) * Math.cos(player.pitch),
            Math.sin(player.pitch),
            -Math.cos(player.yaw) * Math.cos(player.pitch)
        ).normalize();

        const grenadeGeom = new THREE.DodecahedronGeometry(0.12);
        const grenadeMat = new THREE.MeshLambertMaterial({ color: 0x33691e });
        const grenadeMesh = new THREE.Mesh(grenadeGeom, grenadeMat);
        grenadeMesh.position.copy(origin).addScaledVector(dir, 0.6);
        this.scene.add(grenadeMesh);

        let vel = dir.clone().multiplyScalar(18.0);
        vel.y += 3.5;

        player.armSwing = 0.7;
        if (this.game.soundManager) this.game.soundManager.playClick();

        let fuseTime = 2.4;
        const blastRadius = Number(opts.radius) || 3.0;
        const damage = Number(opts.damage) || 160;

        const interval = setInterval(() => {
            if (!grenadeMesh.parent) {
                clearInterval(interval);
                return;
            }
            const dt = 0.033;
            fuseTime -= dt;

            vel.y -= 20.0 * dt;
            grenadeMesh.position.addScaledVector(vel, dt);
            grenadeMesh.rotation.x += 4 * dt;
            grenadeMesh.rotation.y += 3 * dt;

            if (this.game.world) {
                const bx = Math.floor(grenadeMesh.position.x);
                const by = Math.floor(grenadeMesh.position.y);
                const bz = Math.floor(grenadeMesh.position.z);
                const b = this.game.world.getBlock(bx, by, bz);
                if (b !== 0 && b !== 19) {
                    vel.y = -vel.y * 0.45;
                    vel.x *= 0.65;
                    vel.z *= 0.65;
                    grenadeMesh.position.y = by + 1.1;
                }
            }

            if (fuseTime <= 0) {
                clearInterval(interval);
                this._explodeAt(grenadeMesh.position.x, grenadeMesh.position.y, grenadeMesh.position.z, blastRadius, damage);
                this.scene.remove(grenadeMesh);
            }
        }, 33);
    }

    _explodeAt(ex, ey, ez, radius = 3.2, damage = 180) {
        if (this.game.soundManager && this.game.soundManager.playExplosion) {
            this.game.soundManager.playExplosion();
        } else if (this.game.modManager && this.game.modManager.soundSynth) {
            this.game.modManager.soundSynth.gunshot(0.3, 0.6);
        }

        if (this.game.cameraShakeTrauma !== undefined) {
            this.game.cameraShakeTrauma = 1.0;
        }

        if (this.game.world) {
            const radInt = Math.ceil(radius);
            for (let dx = -radInt; dx <= radInt; dx++) {
                for (let dy = -radInt; dy <= radInt; dy++) {
                    for (let dz = -radInt; dz <= radInt; dz++) {
                        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        if (dist <= radius) {
                            const bx = Math.floor(ex + dx);
                            const by = Math.floor(ey + dy);
                            const bz = Math.floor(ez + dz);
                            const b = this.game.world.getBlock(bx, by, bz);
                            if (b !== 0 && b !== BLOCK_TYPES.BEDROCK && b !== BLOCK_TYPES.OBSIDIAN) {
                                if (dist < radius * 0.7 || Math.random() < 0.6) {
                                    this.game.world.setBlock(bx, by, bz, BLOCK_TYPES.AIR);
                                    if (this.game.particleSystem && Math.random() < 0.25) {
                                        this.game.particleSystem.spawnBlockBreakParticles(bx + 0.5, by + 0.5, bz + 0.5, b, 4);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            this.game.world.updateMeshes();
        }

        if (this.game.mobManager && this.game.mobManager.mobs) {
            for (let mob of this.game.mobManager.mobs) {
                if (!mob.isDead && mob.group) {
                    const d = mob.position.distanceTo(new THREE.Vector3(ex, ey, ez));
                    if (d <= radius + 1.5) {
                        const falloff = 1.0 - (d / (radius + 1.5));
                        mob.takeDamage(Math.floor(damage * falloff));
                    }
                }
            }
        }

        if (this.game.mobManager && this.game.mobManager.dragon && !this.game.mobManager.dragon.isDead) {
            const dragon = this.game.mobManager.dragon;
            if (dragon.mesh) {
                const d = dragon.mesh.position.distanceTo(new THREE.Vector3(ex, ey, ez));
                if (d < radius + 4.0) {
                    dragon.takeDamage(damage * 0.7);
                }
            }
        }

        if (this.game.player && !this.game.player.godMode) {
            const pd = this.game.player.position.distanceTo(new THREE.Vector3(ex, ey, ez));
            if (pd < radius + 1.0) {
                const pDamage = Math.floor(damage * 0.35 * (1.0 - pd / (radius + 1.0)));
                this.game.player.takeDamage(pDamage, 'explosion');
            }
        }
    }

    clear() {}
}

// ==========================================
// 3. VEHICLE ENTITY & PHYSICS SIMULATION
// ==========================================
class Vehicle {
    constructor(id, modelType, x, y, z, opts = {}, game) {
        this.id = id;
        this.modelType = modelType || 'car';
        this.game = game;
        this.scene = game.scene;

        this.position = new THREE.Vector3(Number(x) || 0, Number(y) || 20, Number(z) || 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.yaw = Number(opts.yaw) || 0;

        this.speed = 0;
        this.steerAngle = 0;
        this.verticalVelocity = 0;
        this.onGround = false;
        this.driver = null;

        this.isBicycle = (this.modelType === 'bicycle' || this.modelType === 'bike');
        this.isF1 = (this.modelType === 'f1' || this.modelType === 'formula1' || this.modelType === 'car_f1');

        // Custom specs based on vehicle type
        if (this.isF1) {
            this.maxSpeed = 68.0; // ~245 km/h
            this.acceleration = 48.0;
            this.braking = 55.0; // Carbon-ceramic race brakes
            this.stepHeight = 1.05;
            this.color = opts.color || '#e53935';
        } else if (this.isBicycle) {
            this.maxSpeed = 22.0;
            this.acceleration = 16.0;
            this.braking = 24.0;
            this.stepHeight = 1.15;
            this.color = opts.color || '#00e5ff';
        } else if (this.modelType === 'sports_car' || this.modelType === 'sport') {
            this.maxSpeed = 42.0;
            this.acceleration = 28.0;
            this.braking = 32.0;
            this.stepHeight = 1.15;
            this.color = opts.color || '#ff1744';
        } else if (this.modelType === 'police_car' || this.modelType === 'police') {
            this.maxSpeed = 36.0;
            this.acceleration = 24.0;
            this.braking = 28.0;
            this.stepHeight = 1.2;
            this.color = '#111111';
        } else if (this.modelType === 'cyber_truck' || this.modelType === 'cyber') {
            this.maxSpeed = 34.0;
            this.acceleration = 26.0;
            this.braking = 26.0;
            this.stepHeight = 1.35;
            this.color = '#b0bec5';
        } else if (this.modelType === 'truck' || this.modelType === 'jeep') {
            this.maxSpeed = 26.0;
            this.acceleration = 18.0;
            this.braking = 22.0;
            this.stepHeight = 1.45;
            this.color = opts.color || '#33691e';
        } else {
            this.maxSpeed = Number(opts.maxSpeed) || 28.0;
            this.acceleration = Number(opts.acceleration) || 18.0;
            this.braking = Number(opts.braking) || 26.0;
            this.stepHeight = 1.15;
            this.color = opts.color || '#e53935';
        }

        this.maxReverseSpeed = this.isBicycle ? -4.0 : (this.isF1 ? -15.0 : -10.0);
        this.friction = this.isBicycle ? 2.5 : (this.isF1 ? 5.2 : 4.0);
        this.steerSpeed = this.isBicycle ? 5.0 : (this.isF1 ? 4.5 : 3.4);
        this.maxSteerAngle = this.isBicycle ? 0.72 : (this.isF1 ? 0.44 : 0.54);
        this.turnRate = this.isBicycle ? 3.0 : (this.isF1 ? 2.8 : 2.0);

        // Nitro & Drift
        this.nitro = 100;
        this.maxNitro = 100;
        this.isNitro = false;
        this.isDrifting = false;

        // Siren & Damage
        this.sirenActive = false;
        this.sirenTimer = 0;
        this.health = 100;
        this.maxHealth = 100;

        this.headlightsOn = false;
        this.honk = this.honk.bind(this);
        this.toggleHeadlights = this.toggleHeadlights.bind(this);
        this.toggleSiren = this.toggleSiren.bind(this);

        this.wheels = [];
        this.frontPivots = [];

        this.createMesh();
    }

    createBicycleMesh() {
        const matFrame = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.color || '#00e5ff') });
        const matDark = new THREE.MeshLambertMaterial({ color: 0x1f1f1f });
        const matChrome = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        const matWheel = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const matRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });

        const wheelRadius = 0.44;
        const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.08, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.75, wheelRadius * 0.75, 0.09, 8);
        rimGeom.rotateZ(Math.PI / 2);

        // 1. Rear Wheel (Fixed to frame)
        const rearWheel = new THREE.Mesh(wheelGeom, matWheel);
        const rearRim = new THREE.Mesh(rimGeom, matChrome);
        rearWheel.add(rearRim);
        rearWheel.position.set(0, wheelRadius, 0.78);
        this.group.add(rearWheel);
        this.wheels.push(rearWheel);

        // 2. Front Fork Pivot (Steers with handlebar)
        const forkPivot = new THREE.Group();
        forkPivot.position.set(0, wheelRadius, -0.78);

        const frontWheel = new THREE.Mesh(wheelGeom, matWheel);
        const frontRim = new THREE.Mesh(rimGeom, matChrome);
        frontWheel.add(frontRim);
        forkPivot.add(frontWheel);
        this.wheels.push(frontWheel);

        // Fork Struts
        const forkStrutGeom = new THREE.BoxGeometry(0.05, 0.58, 0.05);
        const forkL = new THREE.Mesh(forkStrutGeom, matChrome);
        forkL.position.set(-0.08, 0.22, 0);
        forkPivot.add(forkL);
        const forkR = new THREE.Mesh(forkStrutGeom, matChrome);
        forkR.position.set(0.08, 0.22, 0);
        forkPivot.add(forkR);

        // Handlebar stem & bar
        const stemGeom = new THREE.BoxGeometry(0.06, 0.35, 0.06);
        const stem = new THREE.Mesh(stemGeom, matChrome);
        stem.position.set(0, 0.52, -0.05);
        forkPivot.add(stem);

        const barGeom = new THREE.BoxGeometry(0.76, 0.05, 0.05);
        const bar = new THREE.Mesh(barGeom, matDark);
        bar.position.set(0, 0.70, -0.08);
        forkPivot.add(bar);

        // Bicycle Bell & Front LED
        const bellGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8);
        const bellMesh = new THREE.Mesh(bellGeom, matChrome);
        bellMesh.position.set(-0.18, 0.74, -0.08);
        forkPivot.add(bellMesh);

        const lightGeom = new THREE.BoxGeometry(0.08, 0.08, 0.06);
        const frontLight = new THREE.Mesh(lightGeom, matWhite);
        frontLight.position.set(0, 0.62, -0.14);
        forkPivot.add(frontLight);

        this.group.add(forkPivot);
        this.frontPivots.push(forkPivot);

        // 3. Bicycle Frame (Diamond Structure)
        // Bottom Bracket & Crank
        const bbGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8);
        bbGeom.rotateZ(Math.PI / 2);
        const bb = new THREE.Mesh(bbGeom, matDark);
        bb.position.set(0, wheelRadius - 0.08, 0.05);
        this.group.add(bb);

        this.crankGroup = new THREE.Group();
        this.crankGroup.position.set(0, wheelRadius - 0.08, 0.05);
        const pedalL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), matDark);
        pedalL.position.set(-0.16, 0.12, 0);
        this.crankGroup.add(pedalL);
        const pedalR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), matDark);
        pedalR.position.set(0.16, -0.12, 0);
        this.crankGroup.add(pedalR);
        this.group.add(this.crankGroup);

        // Frame Tubes
        const downTube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.95), matFrame);
        downTube.position.set(0, wheelRadius + 0.18, -0.35);
        downTube.rotation.x = -0.45;
        this.group.add(downTube);

        const seatTube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.06), matFrame);
        seatTube.position.set(0, wheelRadius + 0.24, 0.12);
        seatTube.rotation.x = 0.20;
        this.group.add(seatTube);

        const topTube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.88), matFrame);
        topTube.position.set(0, wheelRadius + 0.48, -0.32);
        topTube.rotation.x = -0.05;
        this.group.add(topTube);

        // Rear chainstays & seatstays
        const chainstayL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.75), matFrame);
        chainstayL.position.set(-0.06, wheelRadius - 0.02, 0.42);
        this.group.add(chainstayL);
        const chainstayR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.75), matFrame);
        chainstayR.position.set(0.06, wheelRadius - 0.02, 0.42);
        this.group.add(chainstayR);

        const seatstayL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.72), matFrame);
        seatstayL.position.set(-0.06, wheelRadius + 0.26, 0.46);
        seatstayL.rotation.x = -0.65;
        this.group.add(seatstayL);
        const seatstayR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.72), matFrame);
        seatstayR.position.set(0.06, wheelRadius + 0.26, 0.46);
        seatstayR.rotation.x = -0.65;
        this.group.add(seatstayR);

        // Saddle (Seat)
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.32), matDark);
        saddle.position.set(0, wheelRadius + 0.58, 0.16);
        this.group.add(saddle);

        // Rear Red Reflector
        const rearRefl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), matRed);
        rearRefl.position.set(0, wheelRadius + 0.48, 0.26);
        this.group.add(rearRefl);

        // Spotlight
        this.spotLight = new THREE.SpotLight(0xfffae6, 0, 24, Math.PI / 5, 0.4, 1.2);
        this.spotLight.position.set(0, wheelRadius + 0.62, -0.85);
        const lightTarget = new THREE.Object3D();
        lightTarget.position.set(0, 0.2, -10);
        this.group.add(lightTarget);
        this.spotLight.target = lightTarget;
        this.group.add(this.spotLight);
    }

    createF1Mesh() {
        const matBody = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.color || '#e53935') });
        const matDark = new THREE.MeshLambertMaterial({ color: 0x141414 }); // Carbon fiber
        const matHalo = new THREE.MeshLambertMaterial({ color: 0x2e2e2e }); // Titanium
        const matWheel = new THREE.MeshLambertMaterial({ color: 0x181818 }); // Slick rubber
        const matPirelli = new THREE.MeshBasicMaterial({ color: 0xff1744 }); // Red Soft Slick
        const matLightRed = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // 1. Central Aerodynamic Tub / Monocoque
        const chassisGeom = new THREE.BoxGeometry(0.88, 0.34, 2.3);
        const chassis = new THREE.Mesh(chassisGeom, matBody);
        chassis.position.set(0, 0.30, 0.05);
        this.group.add(chassis);

        // Tapered Nose Cone
        const noseGeom = new THREE.BoxGeometry(0.48, 0.22, 1.3);
        const nose = new THREE.Mesh(noseGeom, matBody);
        nose.position.set(0, 0.24, -1.55);
        this.group.add(nose);

        // 2. Front Dual-Plane Wing with Endplates
        const frontWingLower = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.04, 0.38), matDark);
        frontWingLower.position.set(0, 0.16, -1.95);
        this.group.add(frontWingLower);

        const frontWingUpper = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.03, 0.26), matBody);
        frontWingUpper.position.set(0, 0.22, -1.90);
        this.group.add(frontWingUpper);

        const endplateGeom = new THREE.BoxGeometry(0.04, 0.26, 0.44);
        const endplateL = new THREE.Mesh(endplateGeom, matBody);
        endplateL.position.set(-0.94, 0.24, -1.92);
        this.group.add(endplateL);
        const endplateR = new THREE.Mesh(endplateGeom, matBody);
        endplateR.position.set(0.94, 0.24, -1.92);
        this.group.add(endplateR);

        // 3. Sidepods & Radiators
        const sidepodGeom = new THREE.BoxGeometry(0.42, 0.34, 1.45);
        const sidepodL = new THREE.Mesh(sidepodGeom, matBody);
        sidepodL.position.set(-0.66, 0.32, 0.1);
        this.group.add(sidepodL);
        const sidepodR = new THREE.Mesh(sidepodGeom, matBody);
        sidepodR.position.set(0.66, 0.32, 0.1);
        this.group.add(sidepodR);

        // Radiator air intakes (dark hollow)
        const intakeGeom = new THREE.BoxGeometry(0.36, 0.26, 0.06);
        const intakeL = new THREE.Mesh(intakeGeom, matDark);
        intakeL.position.set(-0.66, 0.32, -0.63);
        this.group.add(intakeL);
        const intakeR = new THREE.Mesh(intakeGeom, matDark);
        intakeR.position.set(0.66, 0.32, -0.63);
        this.group.add(intakeR);

        // 4. Cockpit, Steering Wheel & Titanium HALO
        const cockpitOpening = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.85), matDark);
        cockpitOpening.position.set(0, 0.45, -0.3);
        this.group.add(cockpitOpening);

        // F1 Steering wheel
        const wheelF1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.04), matDark);
        wheelF1.position.set(0, 0.46, -0.6);
        this.group.add(wheelF1);

        // Halo Central Strut
        const haloStrut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.05), matHalo);
        haloStrut.position.set(0, 0.62, -0.68);
        this.group.add(haloStrut);

        // Halo Curved Loop Bar
        const haloLoop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.58), matHalo);
        haloLoop.position.set(0, 0.78, -0.38);
        this.group.add(haloLoop);

        // 5. Overhead Engine Airbox Scoop & Shark Fin
        const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.55), matBody);
        airbox.position.set(0, 0.82, 0.05);
        this.group.add(airbox);

        const airIntake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.06), matDark);
        airIntake.position.set(0, 0.86, -0.23);
        this.group.add(airIntake);

        // Shark Fin (Vertical aerodynamic stabilizer)
        const finGeom = new THREE.BoxGeometry(0.04, 0.42, 1.15);
        const sharkFin = new THREE.Mesh(finGeom, matBody);
        sharkFin.position.set(0, 0.72, 0.78);
        this.group.add(sharkFin);

        // 6. Huge Downforce Rear Wing & DRS
        const rStrutL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.38), matDark);
        rStrutL.position.set(-0.68, 0.78, 1.55);
        this.group.add(rStrutL);
        const rStrutR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.38), matDark);
        rStrutR.position.set(0.68, 0.78, 1.55);
        this.group.add(rStrutR);

        const rearWingMain = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 0.34), matDark);
        rearWingMain.position.set(0, 0.78, 1.55);
        this.group.add(rearWingMain);

        const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.03, 0.22), matBody);
        drsFlap.position.set(0, 0.95, 1.55);
        this.group.add(drsFlap);

        // 7. Rear Diffuser & Blinking Rain/Safety LED
        const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, 0.45), matDark);
        diffuser.position.set(0, 0.18, 1.45);
        this.group.add(diffuser);

        this.f1RainLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), matLightRed);
        this.f1RainLight.position.set(0, 0.24, 1.68);
        this.group.add(this.f1RainLight);

        // 8. Open-Wheel Wide Racing Slicks with Pirelli Rings
        const frontRadius = 0.34;
        const rearRadius = 0.36;
        const fGeom = new THREE.CylinderGeometry(frontRadius, frontRadius, 0.32, 16);
        fGeom.rotateZ(Math.PI / 2);
        const rGeom = new THREE.CylinderGeometry(rearRadius, rearRadius, 0.42, 16);
        rGeom.rotateZ(Math.PI / 2);
        const rimGeom = new THREE.CylinderGeometry(0.20, 0.20, 0.33, 8);
        rimGeom.rotateZ(Math.PI / 2);
        const pirelliRingGeom = new THREE.CylinderGeometry(0.26, 0.26, 0.33, 16);
        pirelliRingGeom.rotateZ(Math.PI / 2);

        const wheelPositions = [
            { x: -0.98, y: frontRadius, z: -1.25, isFront: true, geom: fGeom },
            { x:  0.98, y: frontRadius, z: -1.25, isFront: true, geom: fGeom },
            { x: -1.04, y: rearRadius,  z:  1.18, isFront: false, geom: rGeom },
            { x:  1.04, y: rearRadius,  z:  1.18, isFront: false, geom: rGeom }
        ];

        wheelPositions.forEach(pos => {
            const pivot = new THREE.Group();
            pivot.position.set(pos.x, pos.y, pos.z);

            const wheelMesh = new THREE.Mesh(pos.geom, matWheel);
            const rim = new THREE.Mesh(rimGeom, matDark);
            wheelMesh.add(rim);
            const pirelli = new THREE.Mesh(pirelliRingGeom, matPirelli);
            wheelMesh.add(pirelli);

            pivot.add(wheelMesh);
            this.group.add(pivot);

            this.wheels.push(wheelMesh);
            if (pos.isFront) {
                this.frontPivots.push(pivot);
            }
        });

        // Headlight SpotLight
        this.spotLight = new THREE.SpotLight(0xfffae6, 0, 48, Math.PI / 4, 0.4, 1.2);
        this.spotLight.position.set(0, 0.35, -1.9);
        const lightTarget = new THREE.Object3D();
        lightTarget.position.set(0, 0.2, -18);
        this.group.add(lightTarget);
        this.spotLight.target = lightTarget;
        this.group.add(this.spotLight);
    }

    createMesh() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.rotation.y = this.yaw;

        if (this.isBicycle) {
            this.createBicycleMesh();
            this.scene.add(this.group);
            return;
        }

        if (this.isF1) {
            this.createF1Mesh();
            this.scene.add(this.group);
            return;
        }

        const bodyColor = new THREE.Color(this.color);
        const matChassis = new THREE.MeshLambertMaterial({ color: bodyColor });
        const matDark = new THREE.MeshLambertMaterial({ color: 0x1f1f1f });
        const matWhite = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
        const matChrome = new THREE.MeshLambertMaterial({ color: 0xdddddd });
        const matGlass = new THREE.MeshLambertMaterial({ color: 0x88ccee, transparent: true, opacity: 0.65 });
        const matLightWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const matLightRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });
        const matWheel = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const matRim = new THREE.MeshLambertMaterial({ color: 0xd0d0d0 });

        // 1. Chassis
        const isCyber = (this.modelType === 'cyber_truck' || this.modelType === 'cyber');
        const isPolice = (this.modelType === 'police_car' || this.modelType === 'police');
        const isSport = (this.modelType === 'sports_car' || this.modelType === 'sport');
        const isTruck = (this.modelType === 'truck' || this.modelType === 'jeep');

        const chassisWidth = isTruck ? 1.85 : 1.7;
        const chassisHeight = isSport ? 0.4 : 0.5;
        const chassisGeom = new THREE.BoxGeometry(chassisWidth, chassisHeight, 3.2);
        const chassis = new THREE.Mesh(chassisGeom, isPolice ? matDark : matChassis);
        chassis.position.y = 0.45;
        this.group.add(chassis);

        // 2. Cabin & Roof
        if (isCyber) {
            // Angular Cybertruck geometry
            const cabinGeom = new THREE.BoxGeometry(1.6, 0.65, 2.0);
            const cabin = new THREE.Mesh(cabinGeom, matChassis);
            cabin.position.set(0, 0.95, -0.1);
            this.group.add(cabin);

            // Front LED lightbar
            const ledGeom = new THREE.BoxGeometry(1.5, 0.08, 0.08);
            const led = new THREE.Mesh(ledGeom, matLightWhite);
            led.position.set(0, 0.62, -1.62);
            this.group.add(led);
        } else if (isTruck) {
            // Truck Cabin + open flatbed
            const cabinGeom = new THREE.BoxGeometry(1.5, 0.62, 1.4);
            const cabin = new THREE.Mesh(cabinGeom, matGlass);
            cabin.position.set(0, 0.95, -0.5);
            this.group.add(cabin);

            const roofGeom = new THREE.BoxGeometry(1.46, 0.08, 1.35);
            const roof = new THREE.Mesh(roofGeom, matChassis);
            roof.position.set(0, 1.27, -0.5);
            this.group.add(roof);

            // Flatbed walls
            const bedWallGeom = new THREE.BoxGeometry(0.12, 0.35, 1.3);
            const bedLeft = new THREE.Mesh(bedWallGeom, matDark);
            bedLeft.position.set(-0.8, 0.85, 0.8);
            this.group.add(bedLeft);

            const bedRight = new THREE.Mesh(bedWallGeom, matDark);
            bedRight.position.set(0.8, 0.85, 0.8);
            this.group.add(bedRight);
        } else {
            // Standard / Sport / Police Cabin
            const cabinGeom = new THREE.BoxGeometry(1.4, isSport ? 0.42 : 0.48, 1.7);
            const cabin = new THREE.Mesh(cabinGeom, matGlass);
            cabin.position.set(0, isSport ? 0.82 : 0.88, -0.15);
            this.group.add(cabin);

            const roofGeom = new THREE.BoxGeometry(1.36, 0.08, 1.6);
            const roof = new THREE.Mesh(roofGeom, isPolice ? matWhite : matChassis);
            roof.position.set(0, isSport ? 1.05 : 1.14, -0.15);
            this.group.add(roof);

            // Police White Doors Accent
            if (isPolice) {
                const doorGeom = new THREE.BoxGeometry(0.08, 0.45, 1.4);
                const doorL = new THREE.Mesh(doorGeom, matWhite);
                doorL.position.set(-0.84, 0.45, -0.15);
                this.group.add(doorL);

                const doorR = new THREE.Mesh(doorGeom, matWhite);
                doorR.position.set(0.84, 0.45, -0.15);
                this.group.add(doorR);
            }
        }

        // 3. Police Lightbar
        if (isPolice) {
            const barBaseGeom = new THREE.BoxGeometry(1.0, 0.06, 0.18);
            const barBase = new THREE.Mesh(barBaseGeom, matDark);
            barBase.position.set(0, 1.21, -0.15);
            this.group.add(barBase);

            this.strobeRedMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            this.strobeBlueMat = new THREE.MeshBasicMaterial({ color: 0x0055ff });

            const strobeGeom = new THREE.BoxGeometry(0.38, 0.12, 0.16);
            this.strobeRed = new THREE.Mesh(strobeGeom, this.strobeRedMat);
            this.strobeRed.position.set(-0.3, 1.27, -0.15);
            this.group.add(this.strobeRed);

            this.strobeBlue = new THREE.Mesh(strobeGeom, this.strobeBlueMat);
            this.strobeBlue.position.set(0.3, 1.27, -0.15);
            this.group.add(this.strobeBlue);
        }

        // 4. Sports Car Rear Spoiler & Dual Exhausts
        if (isSport) {
            const strutGeom = new THREE.BoxGeometry(0.08, 0.28, 0.12);
            const strutL = new THREE.Mesh(strutGeom, matDark);
            strutL.position.set(-0.55, 0.78, 1.35);
            this.group.add(strutL);

            const strutR = new THREE.Mesh(strutGeom, matDark);
            strutR.position.set(0.55, 0.78, 1.35);
            this.group.add(strutR);

            const wingGeom = new THREE.BoxGeometry(1.65, 0.06, 0.32);
            const wing = new THREE.Mesh(wingGeom, matDark);
            wing.position.set(0, 0.94, 1.35);
            this.group.add(wing);

            // Dual Chrome Exhausts
            const exGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.25, 8);
            exGeom.rotateX(Math.PI / 2);
            const exL = new THREE.Mesh(exGeom, matChrome);
            exL.position.set(-0.4, 0.28, 1.68);
            this.group.add(exL);

            const exR = new THREE.Mesh(exGeom, matChrome);
            exR.position.set(0.4, 0.28, 1.68);
            this.group.add(exR);
        }

        // 5. Bumper & Headlights
        const bumperGeom = new THREE.BoxGeometry(chassisWidth - 0.1, 0.22, 0.2);
        const bumper = new THREE.Mesh(bumperGeom, matDark);
        bumper.position.set(0, 0.35, -1.62);
        this.group.add(bumper);

        const lightGeom = new THREE.BoxGeometry(0.28, 0.18, 0.1);
        const lightLeft = new THREE.Mesh(lightGeom, matLightWhite);
        lightLeft.position.set(-0.55, 0.45, -1.62);
        this.group.add(lightLeft);

        const lightRight = new THREE.Mesh(lightGeom, matLightWhite);
        lightRight.position.set(0.55, 0.45, -1.62);
        this.group.add(lightRight);

        // Real Light Source (SpotLight)
        this.spotLight = new THREE.SpotLight(0xfffae6, 0, 36, Math.PI / 4, 0.4, 1.2);
        this.spotLight.position.set(0, 0.6, -1.6);
        const lightTarget = new THREE.Object3D();
        lightTarget.position.set(0, 0.2, -14);
        this.group.add(lightTarget);
        this.spotLight.target = lightTarget;
        this.group.add(this.spotLight);

        // Taillights
        const tailGeom = new THREE.BoxGeometry(0.3, 0.16, 0.1);
        const tailLeft = new THREE.Mesh(tailGeom, matLightRed);
        tailLeft.position.set(-0.55, 0.48, 1.62);
        this.group.add(tailLeft);

        const tailRight = new THREE.Mesh(tailGeom, matLightRed);
        tailRight.position.set(0.55, 0.48, 1.62);
        this.group.add(tailRight);

        // 6. Wheels
        const wheelRadius = isTruck ? 0.46 : 0.38;
        const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.26, 16);
        wheelGeom.rotateZ(Math.PI / 2);

        const wheelPositions = [
            { x: -0.92, y: wheelRadius, z: -1.05, isFront: true },
            { x:  0.92, y: wheelRadius, z: -1.05, isFront: true },
            { x: -0.92, y: wheelRadius, z:  1.05, isFront: false },
            { x:  0.92, y: wheelRadius, z:  1.05, isFront: false }
        ];

        wheelPositions.forEach(pos => {
            const pivot = new THREE.Group();
            pivot.position.set(pos.x, pos.y, pos.z);

            const wheelMesh = new THREE.Mesh(wheelGeom, matWheel);
            const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, 0.27, 8);
            rimGeom.rotateZ(Math.PI / 2);
            const rimMesh = new THREE.Mesh(rimGeom, matRim);
            wheelMesh.add(rimMesh);

            pivot.add(wheelMesh);
            this.group.add(pivot);

            this.wheels.push(wheelMesh);
            if (pos.isFront) {
                this.frontPivots.push(pivot);
            }
        });

        this.scene.add(this.group);
    }

    toggleHeadlights() {
        this.headlightsOn = !this.headlightsOn;
        if (this.spotLight) {
            this.spotLight.intensity = this.headlightsOn ? 1.8 : 0;
        }
        return this.headlightsOn;
    }

    toggleSiren() {
        this.sirenActive = !this.sirenActive;
        if (this.game.ui) {
            this.game.ui.showToast(this.sirenActive ? "🚨 Поліцейська сирена: УВІМКНЕНО" : "🚨 Поліцейська сирена: ВИМКНЕНО");
        }
        return this.sirenActive;
    }

    repair() {
        this.health = this.maxHealth;
        if (this.game.ui) {
            this.game.ui.showToast("🔧 Автомобіль повністю відремонтовано (100 HP)!");
        }
    }

    honk() {
        if (this.isBicycle) {
            if (this.game.soundManager && this.game.soundManager.playBicycleBell) {
                this.game.soundManager.playBicycleBell();
            }
            if (this.game.ui) this.game.ui.showToast("🔔 Дзинь-дзинь! Велодзвінок");
            return;
        }
        if (this.game.modManager && this.game.modManager.soundSynth) {
            this.game.modManager.soundSynth.horn();
        }
    }

    updateDriver(dt, inputVector, isBraking, isSprinting) {
        let throttle = (inputVector ? inputVector.y : 0);
        let steerInput = (inputVector ? -inputVector.x : 0);

        if (this.game.modManager) {
            if (this.game.modManager.touchGas) throttle = 1.0;
            else if (this.game.modManager.touchBrake) throttle = -1.0;

            if (this.game.modManager.touchSteerLeft) steerInput = 1.0;
            else if (this.game.modManager.touchSteerRight) steerInput = -1.0;
        }

        const targetSteer = steerInput * this.maxSteerAngle;
        this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, dt * this.steerSpeed * 3);

        // --- BICYCLE BUNNY HOP ---
        if (this.isBicycle && isBraking && this.onGround && Math.abs(this.verticalVelocity) < 0.2) {
            this.verticalVelocity = 8.5;
            this.onGround = false;
            if (this.game.soundManager && this.game.soundManager.playJump) {
                this.game.soundManager.playJump();
            }
            if (this.game.ui) this.game.ui.showToast("🐰 Bunny Hop!");
        }

        // --- NITRO BOOST ---
        const wantsNitro = isSprinting && (throttle > 0.1);
        if (wantsNitro && this.nitro > 4) {
            this.isNitro = true;
            this.nitro = Math.max(0, this.nitro - 28 * dt);
        } else {
            this.isNitro = false;
            this.nitro = Math.min(this.maxNitro, this.nitro + 12 * dt);
        }

        const nitroMult = this.isNitro ? 1.55 : 1.0;

        // --- DRIFT / HANDBRAKE ---
        if (isBraking && Math.abs(this.steerAngle) > 0.12 && Math.abs(this.speed) > 6.0) {
            this.isDrifting = true;
            // High lateral yaw rotation
            const dirSign = this.speed >= 0 ? 1 : -1;
            this.yaw += this.steerAngle * this.turnRate * 2.2 * dirSign * dt;
            // Less deceleration during drift for sweet sideways slide
            this.speed = Math.max(0, this.speed - this.braking * 0.45 * dt);
        } else {
            this.isDrifting = false;

            if (isBraking || (this.game.modManager && this.game.modManager.touchBrake && this.speed > 0.5)) {
                if (this.speed > 0) {
                    this.speed = Math.max(0, this.speed - this.braking * 1.5 * dt);
                } else if (this.speed < 0) {
                    this.speed = Math.min(0, this.speed + this.braking * 1.5 * dt);
                }
            } else if (throttle > 0.1) {
                this.speed = Math.min(this.maxSpeed * nitroMult, this.speed + this.acceleration * throttle * dt * (this.isNitro ? 1.6 : 1.0));
            } else if (throttle < -0.1) {
                this.speed = Math.max(this.maxReverseSpeed, this.speed + this.acceleration * throttle * dt * 0.7);
            } else {
                if (this.speed > 0) {
                    this.speed = Math.max(0, this.speed - this.friction * dt);
                } else if (this.speed < 0) {
                    this.speed = Math.min(0, this.speed + this.friction * dt);
                }
            }
        }

        if (Math.abs(this.speed) > 0.3 && !this.isDrifting) {
            const dirSign = this.speed >= 0 ? 1 : -1;
            const deltaYaw = this.steerAngle * this.turnRate * dirSign * dt * (Math.abs(this.speed) / this.maxSpeed + 0.35);
            this.yaw += deltaYaw;
            if (this.driver) {
                this.driver.yaw += deltaYaw;
            }
        }

        // Camera follow behind car
        if (this.driver && this.speed > 1.0) {
            let diff = this.yaw - this.driver.yaw;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.driver.yaw += diff * Math.min(1.0, dt * 2.5);
        }
    }

    update(dt) {
        this.frontPivots.forEach(p => {
            p.rotation.y = this.steerAngle;
        });
        const wheelRollSpeed = (this.speed / 0.38) * dt;
        this.wheels.forEach(w => {
            w.rotation.x -= wheelRollSpeed;
        });

        // Camera FOV Kick during Nitro
        if (this.game.camera) {
            const targetFOV = this.isNitro ? 84 : 72;
            if (Math.abs(this.game.camera.fov - targetFOV) > 0.2) {
                this.game.camera.fov += (targetFOV - this.game.camera.fov) * dt * 5;
                this.game.camera.updateProjectionMatrix();
            }
        }

        // Police Siren Lightbar Strobe Animation
        if (this.sirenActive && this.strobeRed && this.strobeBlue) {
            this.sirenTimer += dt;
            const flash = Math.floor(this.sirenTimer * 10) % 2 === 0;
            this.strobeRed.material.color.setHex(flash ? 0xff0000 : 0x330000);
            this.strobeBlue.material.color.setHex(flash ? 0x000033 : 0x0066ff);
        }

        // Tire Smoke on Drift
        if (this.isDrifting && this.game.particleSystem && Math.random() < 0.4) {
            const rx = this.position.x + Math.sin(this.yaw) * 1.2;
            const rz = this.position.z + Math.cos(this.yaw) * 1.2;
            this.game.particleSystem.spawnBlockBreakParticles(rx, this.position.y + 0.2, rz, BLOCK_TYPES.SAND, 3);
        }

        // Nitro Exhaust Flames
        if (this.isNitro && this.game.particleSystem) {
            const exX = this.position.x + Math.sin(this.yaw) * 1.6;
            const exZ = this.position.z + Math.cos(this.yaw) * 1.6;
            this.game.particleSystem.spawnBlockBreakParticles(exX, this.position.y + 0.35, exZ, BLOCK_TYPES.LAVA, 2);
        }

        // Low Health Smoke
        if (this.health < 40 && this.game.particleSystem && Math.random() < 0.3) {
            const fx = this.position.x - Math.sin(this.yaw) * 1.2;
            const fz = this.position.z - Math.cos(this.yaw) * 1.2;
            this.game.particleSystem.spawnBlockBreakParticles(fx, this.position.y + 0.7, fz, BLOCK_TYPES.COAL_ORE, 2);
        }

        const world = this.game.world;
        const forwardX = -Math.sin(this.yaw);
        const forwardZ = -Math.cos(this.yaw);

        const deltaDist = this.speed * dt;
        const nextX = this.position.x + forwardX * deltaDist;
        const nextZ = this.position.z + forwardZ * deltaDist;

        if (world) {
            const bx = Math.floor(nextX);
            const bz = Math.floor(nextZ);
            const currentBy = Math.floor(this.position.y);

            const frontBlock = world.getBlock(bx, currentBy, bz);
            const aboveBlock = world.getBlock(bx, currentBy + 1, bz);

            if (frontBlock !== 0 && frontBlock !== 19) {
                if (aboveBlock === 0 || aboveBlock === 19) {
                    this.position.y += Math.min(1.2, this.stepHeight * dt * 8);
                    this.position.x = nextX;
                    this.position.z = nextZ;
                } else {
                    if (Math.abs(this.speed) > 12.0) {
                        this.health = Math.max(0, this.health - Math.floor(Math.abs(this.speed) * 0.7));
                    }
                    this.speed = -this.speed * 0.25;
                    if (this.game.soundManager) this.game.soundManager.playBreak('stone');
                }
            } else {
                this.position.x = nextX;
                this.position.z = nextZ;
            }

            let groundY = -100;
            for (let y = Math.min(31, Math.floor(this.position.y + 0.5)); y >= 0; y--) {
                const b = world.getBlock(Math.floor(this.position.x), y, Math.floor(this.position.z));
                if (b !== 0 && b !== 19) {
                    groundY = y + 1.0;
                    break;
                }
            }

            if (this.position.y > groundY + 0.05) {
                this.verticalVelocity -= 22 * dt;
                this.position.y += this.verticalVelocity * dt;
                this.onGround = false;
                if (this.position.y <= groundY) {
                    this.position.y = groundY;
                    this.verticalVelocity = 0;
                    this.onGround = true;
                }
            } else {
                this.position.y = groundY;
                this.verticalVelocity = 0;
                this.onGround = true;
            }
        } else {
            this.position.x = nextX;
            this.position.z = nextZ;
        }

        this.group.position.copy(this.position);
        this.group.rotation.y = this.yaw;

        // Bicycle Roll/Banking & Pedal Crank Rotation
        if (this.isBicycle) {
            this.group.rotation.z = -this.steerAngle * 0.42;
            if (this.crankGroup) {
                this.crankGroup.rotation.x -= (this.speed / 0.22) * dt;
            }
        } else {
            this.group.rotation.z = 0;
        }

        // F1 Rear Rain / Safety Strobe LED
        if (this.isF1 && this.f1RainLight) {
            const isBlink = Math.floor(performance.now() * 0.008) % 2 === 0;
            this.f1RainLight.material.color.setHex(isBlink ? 0xff0000 : 0x220000);
        }

        if (this.driver) {
            this.driver.position.copy(this.position);
            this.driver.position.y += this.isBicycle ? 0.62 : 0.35;
            if (this.driver.updateVehicleCamera) {
                this.driver.updateVehicleCamera();
            }
            if (this.game.modManager) {
                if (this.isBicycle) {
                    this.game.modManager.updateSpeedometerHUD(Math.abs(this.speed) * 3.6, this.speed, 100, this.health);
                } else {
                    const baseRpm = this.isF1 ? 4000 : 800;
                    const maxAdd = this.isF1 ? 14500 : 4500;
                    const rpm = baseRpm + Math.abs(this.speed / this.maxSpeed) * maxAdd;
                    this.game.modManager.soundSynth.engine(rpm, this.isF1 ? 0.22 : 0.16);
                    this.game.modManager.updateSpeedometerHUD(Math.abs(this.speed) * 3.6, this.speed, this.nitro, this.health);
                }
            }
        }
    }

    destroy() {
        if (this.group && this.scene) {
            this.scene.remove(this.group);
        }
        if (this.driver && this.driver.mountedVehicle === this) {
            this.driver.dismountVehicle();
        }
    }
}

class VehicleManager {
    constructor(game) {
        this.game = game;
        this.vehicles = new Map();
        this.nextVehicleId = 1;
    }

    spawn(modelType = 'car', x = 0, y = 20, z = 0, opts = {}) {
        const id = 'veh_' + (this.nextVehicleId++);
        if (opts.yaw === undefined && this.game.player) {
            opts.yaw = this.game.player.yaw;
        }
        const veh = new Vehicle(id, modelType, x, y, z, opts, this.game);
        this.vehicles.set(id, veh);
        return id;
    }

    remove(id) {
        const v = this.vehicles.get(id);
        if (v) {
            v.destroy();
            this.vehicles.delete(id);
            return true;
        }
        return false;
    }

    get(id) {
        const v = this.vehicles.get(id);
        if (!v) return null;
        return {
            id: v.id,
            x: v.position.x,
            y: v.position.y,
            z: v.position.z,
            yaw: v.yaw,
            speed: v.speed,
            isMounted: !!v.driver
        };
    }

    getAll() {
        const res = [];
        for (const [id, v] of this.vehicles.entries()) {
            res.push({
                id: v.id,
                x: v.position.x,
                y: v.position.y,
                z: v.position.z,
                yaw: v.yaw,
                speed: v.speed
            });
        }
        return res;
    }

    getNearbyVehicles(pos, maxDist = 3.5) {
        const list = [];
        for (const v of this.vehicles.values()) {
            const d = v.position.distanceTo(pos);
            if (d <= maxDist) {
                list.push(v);
            }
        }
        return list;
    }

    update(dt) {
        for (const v of this.vehicles.values()) {
            v.update(dt);
        }
    }

    clear() {
        for (const v of this.vehicles.values()) {
            v.destroy();
        }
        this.vehicles.clear();
    }
}

// ==========================================
// 4. CUSTOM UI SUBSYSTEM (DOM OVERLAY)
// ==========================================
class CustomUIManager {
    constructor() {
        this.elements = new Map();
        this.container = document.getElementById('mod-custom-ui-layer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'mod-custom-ui-layer';
            document.body.appendChild(this.container);
        }
    }

    createPanel(id, opts = {}) {
        const elId = `mod-ui-${id}`;
        let panel = document.getElementById(elId);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = elId;
            panel.className = 'mod-custom-panel';
            this.container.appendChild(panel);
            this.elements.set(id, panel);
        }
        if (opts.title) {
            panel.innerHTML = `<div class="mod-panel-header">${opts.title}</div><div class="mod-panel-body"></div>`;
        }
        this.applyStyles(panel, opts);
        return id;
    }

    createButton(id, opts = {}, onClickFn = null) {
        const elId = `mod-ui-${id}`;
        let btn = document.getElementById(elId);
        if (!btn) {
            btn = document.createElement('button');
            btn.id = elId;
            btn.className = 'mod-custom-btn';
            this.container.appendChild(btn);
            this.elements.set(id, btn);
        }
        btn.textContent = String(opts.text || 'Кнопка');
        this.applyStyles(btn, opts);
        if (typeof onClickFn === 'function') {
            btn.onclick = (e) => {
                e.stopPropagation();
                try { onClickFn(); } catch(err) { console.error(err); }
            };
        }
        return id;
    }

    createLabel(id, opts = {}) {
        const elId = `mod-ui-${id}`;
        let lbl = document.getElementById(elId);
        if (!lbl) {
            lbl = document.createElement('div');
            lbl.id = elId;
            lbl.className = 'mod-custom-label';
            this.container.appendChild(lbl);
            this.elements.set(id, lbl);
        }
        lbl.textContent = String(opts.text || '');
        this.applyStyles(lbl, opts);
        return id;
    }

    applyStyles(el, opts) {
        if (opts.x !== undefined) el.style.left = `${Number(opts.x)}px`;
        if (opts.y !== undefined) el.style.top = `${Number(opts.y)}px`;
        if (opts.width !== undefined) el.style.width = typeof opts.width === 'number' ? `${opts.width}px` : opts.width;
        if (opts.height !== undefined) el.style.height = typeof opts.height === 'number' ? `${opts.height}px` : opts.height;
        if (opts.background) el.style.background = opts.background;
        if (opts.color) el.style.color = opts.color;
        if (opts.fontSize) el.style.fontSize = typeof opts.fontSize === 'number' ? `${opts.fontSize}px` : opts.fontSize;
    }

    setText(id, text) {
        const el = this.elements.get(id);
        if (el) el.textContent = String(text);
    }

    setStyle(id, prop, val) {
        const el = this.elements.get(id);
        if (el) el.style[prop] = val;
    }

    show(id) {
        const el = this.elements.get(id);
        if (el) el.style.display = '';
    }

    hide(id) {
        const el = this.elements.get(id);
        if (el) el.style.display = 'none';
    }

    remove(id) {
        const el = this.elements.get(id);
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
            this.elements.delete(id);
        }
    }

    clear() {
        this.container.innerHTML = '';
        this.elements.clear();
    }
}

// ==========================================
// 5. GLTF & GLB 3D MODEL MANAGER
// ==========================================
class GLTFModelManager {
    constructor(game) {
        this.game = game;
        this.cachedModels = new Map();
        this.instances = new Map();
        this.nextInstanceId = 1;
        this.loader = (typeof THREE !== 'undefined' && THREE.GLTFLoader) ? new THREE.GLTFLoader() : null;
    }

    load(modelId, urlOrData, callback = null, onError = null) {
        if (!this.loader) {
            if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
                this.loader = new THREE.GLTFLoader();
            } else {
                console.warn("GLTFLoader is not available!");
                if (onError) onError("GLTFLoader unavailable");
                return false;
            }
        }

        const onLoad = (gltf) => {
            let tris = 0;
            try {
                gltf.scene.traverse((o) => {
                    const ms = o.material ? [].concat(o.material) : [];
                    for (const m of ms) {
                        // В движке нет envmap: чистый металл (metalness ~1) выглядит чёрно-серой кашей.
                        // Притупляем такие материалы — касается всех sketchfab-моделей без текстур.
                        if (m && m.isMeshStandardMaterial && m.metalness > 0.5 && !m.metalnessMap) {
                            m.metalness = 0.3;
                        }
                    }
                    // Подсчёт полигонов для лимита
                    const geo = o.geometry;
                    if (o.isMesh && geo && geo.attributes && geo.attributes.position) {
                        tris += Math.floor((geo.index ? geo.index.count : geo.attributes.position.count) / 3);
                    }
                });
            } catch (e) {}
            // Полигональный лимит (жирные модели вешают телефоны)
            let lim = 100000;
            try { lim = Number(localStorage.getItem('eblan_poly_limit')) || 100000; } catch (e) {}
            if (tris > lim) {
                const msg = `⛔ Модель [${modelId}]: ${(tris / 1000).toFixed(1)}k полигонов, лимит ${(lim / 1000).toFixed(0)}k. Упрости модель или подними лимит: Eblan.setPolyLimit(n)`;
                console.warn(msg);
                if (this.game.ui) this.game.ui.showToast(msg);
                if (onError) { try { onError('poly limit'); } catch (e) {} }
                return;
            }
            this.cachedModels.set(modelId, gltf);
            if (this.game.ui) this.game.ui.showToast(`📦 Модель GLTF [${modelId}] завантажено! (${(tris / 1000).toFixed(1)}k tris)`);
            if (callback) {
                try { callback(modelId, gltf); } catch(e){}
            }
        };

        const onFail = (err) => {
            console.error(`Failed to load GLTF ${modelId}:`, err);
            if (onError) {
                try { onError(String(err)); } catch(e){}
            }
        };

        try {
            if (typeof urlOrData === 'string' && (urlOrData.startsWith('http') || urlOrData.startsWith('blob:') || urlOrData.startsWith('data:') || urlOrData.startsWith('/'))) {
                this.loader.load(urlOrData, onLoad, undefined, onFail);
            } else if (urlOrData instanceof ArrayBuffer) {
                this.loader.parse(urlOrData, '', onLoad, onFail);
            } else if (typeof urlOrData === 'string' && urlOrData.length > 50) {
                const binary = atob(urlOrData);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                this.loader.parse(bytes.buffer, '', onLoad, onFail);
            }
            return true;
        } catch (e) {
            onFail(e);
            return false;
        }
    }

    spawn(modelId, x = 0, y = 16, z = 0, opts = {}) {
        const gltf = this.cachedModels.get(modelId);
        if (!gltf) {
            console.warn(`GLTF model [${modelId}] not cached yet.`);
            return null;
        }

        const group = new THREE.Group();
        const cloneScene = gltf.scene.clone(true);

        const s = typeof opts.scale === 'number' ? opts.scale : (opts.scale || 1.0);
        if (typeof s === 'number') {
            cloneScene.scale.set(s, s, s);
        } else if (s && typeof s.x === 'number') {
            cloneScene.scale.set(s.x, s.y || s.x, s.z || s.x);
        }

        cloneScene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = opts.castShadow !== false;
                child.receiveShadow = opts.receiveShadow !== false;
            }
        });

        group.add(cloneScene);
        group.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);

        if (opts.yaw !== undefined) group.rotation.y = Number(opts.yaw);
        if (opts.pitch !== undefined) group.rotation.x = Number(opts.pitch);
        if (opts.roll !== undefined) group.rotation.z = Number(opts.roll);

        this.game.scene.add(group);

        let mixer = null;
        if (gltf.animations && gltf.animations.length > 0 && opts.animate !== false) {
            mixer = new THREE.AnimationMixer(cloneScene);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
        }

        const instanceId = 'gltf_' + (this.nextInstanceId++);
        const inst = {
            id: instanceId,
            modelId,
            group,
            scene: cloneScene,
            mixer,
            position: group.position,
            rotation: group.rotation,
            scale: cloneScene.scale,
            name: opts.name || modelId,
            remove: () => this.remove(instanceId)
        };

        this.instances.set(instanceId, inst);
        return instanceId;
    }

    setPosition(instanceId, x, y, z) {
        const inst = this.instances.get(instanceId);
        if (inst && inst.group) inst.group.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
    }

    setRotation(instanceId, yaw, pitch, roll) {
        const inst = this.instances.get(instanceId);
        if (inst && inst.group) {
            if (yaw !== undefined) inst.group.rotation.y = Number(yaw);
            if (pitch !== undefined) inst.group.rotation.x = Number(pitch);
            if (roll !== undefined) inst.group.rotation.z = Number(roll);
        }
    }

    setScale(instanceId, sx, sy, sz) {
        const inst = this.instances.get(instanceId);
        if (inst && inst.scene) {
            if (sy !== undefined && sz !== undefined) {
                inst.scene.scale.set(Number(sx) || 1, Number(sy) || 1, Number(sz) || 1);
            } else {
                const s = Number(sx) || 1;
                inst.scene.scale.set(s, s, s);
            }
        }
    }

    playAnimation(instanceId, animIndexOrName = 0) {
        const inst = this.instances.get(instanceId);
        if (!inst) return;
        const gltf = this.cachedModels.get(inst.modelId);
        if (!gltf || !gltf.animations || gltf.animations.length === 0) return;
        let clip = null;
        if (typeof animIndexOrName === 'string') {
            clip = gltf.animations.find(c => c.name === animIndexOrName);
        } else {
            clip = gltf.animations[animIndexOrName || 0];
        }
        if (clip) {
            if (!inst.mixer) inst.mixer = new THREE.AnimationMixer(inst.scene);
            inst.mixer.stopAllAction();
            const action = inst.mixer.clipAction(clip);
            action.play();
        }
    }

    remove(instanceId) {
        const inst = this.instances.get(instanceId);
        if (!inst) return false;
        if (inst.group) {
            if (inst.group.parent) inst.group.parent.remove(inst.group);
            else if (this.game.scene) this.game.scene.remove(inst.group);
        }
        this.instances.delete(instanceId);
        return true;
    }

    get(instanceId) {
        const inst = this.instances.get(instanceId);
        if (!inst) return null;
        return {
            id: inst.id,
            modelId: inst.modelId,
            name: inst.name,
            x: inst.position.x,
            y: inst.position.y,
            z: inst.position.z,
            yaw: inst.rotation.y,
            pitch: inst.rotation.x,
            roll: inst.rotation.z,
            scaleX: inst.scale.x,
            scaleY: inst.scale.y,
            scaleZ: inst.scale.z
        };
    }

    getAll() {
        const res = [];
        for (const [id, inst] of this.instances.entries()) {
            res.push({
                id,
                modelId: inst.modelId,
                name: inst.name,
                x: inst.position.x,
                y: inst.position.y,
                z: inst.position.z
            });
        }
        return res;
    }

    importFromFile(callback = null) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.glb,.gltf';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const modelId = file.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
            const reader = new FileReader();
            reader.onload = (re) => {
                const buffer = re.target.result;
                this.load(modelId, buffer, (id) => {
                    if (this.game.ui) this.game.ui.showToast(`✔ GLTF/GLB [${id}] імпортовано успішно!`);
                    if (callback) callback(id);
                });
            };
            reader.readAsArrayBuffer(file);
            document.body.removeChild(input);
        };

        input.click();
    }

    clear() {
        for (const inst of this.instances.values()) {
            if (inst.group && this.game.scene) {
                this.game.scene.remove(inst.group);
            }
        }
        this.instances.clear();
    }

    update(dt) {
        for (const inst of this.instances.values()) {
            if (inst.mixer) {
                inst.mixer.update(dt);
            }
        }
    }
}

// ==========================================
// 6. PROP HUNT SYSTEM (Disguise, Taunts, Lock, Blindness, EyeTrace)
// ==========================================
class PropHuntManager {
    constructor(game, modManager) {
        this.game = game;
        this.modManager = modManager;
        this.currentDisguise = null;
        this.isLocked = false;
        this.remoteDisguises = new Map();
        this.blindnessOverlay = null;
        this.blindnessTimer = null;
    }

    disguise(type, opts = {}) {
        this.undisguise();

        const p = this.game.player;
        if (!p) return false;

        let mesh = null;
        const scale = opts.scale || 1.0;

        let blockId = null;
        if (typeof type === 'number') {
            blockId = type;
        } else if (typeof type === 'string') {
            const upper = type.toUpperCase();
            if (window.BLOCK_TYPES && window.BLOCK_TYPES[upper] !== undefined) {
                blockId = window.BLOCK_TYPES[upper];
            } else if (this.game.textureManager && this.game.textureManager.materials && this.game.textureManager.materials[type]) {
                blockId = type;
            }
        }

        if (blockId !== null) {
            const geo = new THREE.BoxGeometry(scale, scale, scale);
            let mat = this.game.textureManager ? this.game.textureManager.getMaterial(blockId) : new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
            mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.currentDisguise = { type: 'block', blockId, mesh, scale, lockedYaw: p.yaw };
        } else if (this.modManager.modelManager && this.modManager.modelManager.cachedModels.has(type)) {
            const gltf = this.modManager.modelManager.cachedModels.get(type);
            mesh = gltf.scene.clone(true);
            mesh.scale.set(scale, scale, scale);
            this.currentDisguise = { type: 'model', modelId: type, mesh, scale, lockedYaw: p.yaw };
        } else {
            const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const mat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
            mesh = new THREE.Mesh(geo, mat);
            this.currentDisguise = { type: 'block', blockId: 1, mesh, scale: 0.8, lockedYaw: p.yaw };
        }

        mesh.position.copy(p.position);
        mesh.position.y += 0.5 * scale;
        this.game.scene.add(mesh);

        this.isLocked = !!opts.locked;
        if (this.isLocked) {
            this.currentDisguise.lockedYaw = p.yaw;
        }

        if (this.game.multiplayer && this.game.multiplayer.isConnected) {
            this.game.multiplayer.broadcast({
                type: 'mod_net',
                channel: 'prop_disguise',
                peerId: this.game.multiplayer.peer ? this.game.multiplayer.peer.id : null,
                disguise: {
                    type: this.currentDisguise.type,
                    blockId: this.currentDisguise.blockId,
                    modelId: this.currentDisguise.modelId,
                    scale,
                    locked: this.isLocked
                }
            });
        }

        if (this.game.ui) this.game.ui.showToast(`🎭 Ви замаскувались у [${type}]!`);
        return true;
    }

    undisguise() {
        if (this.currentDisguise && this.currentDisguise.mesh) {
            this.game.scene.remove(this.currentDisguise.mesh);
            this.currentDisguise = null;
        }
        this.isLocked = false;

        if (this.game.multiplayer && this.game.multiplayer.isConnected) {
            this.game.multiplayer.broadcast({
                type: 'mod_net',
                channel: 'prop_undisguise',
                peerId: this.game.multiplayer.peer ? this.game.multiplayer.peer.id : null
            });
        }
    }

    isDisguised() {
        return !!this.currentDisguise;
    }

    getDisguise() {
        if (!this.currentDisguise) return null;
        return {
            type: this.currentDisguise.type,
            blockId: this.currentDisguise.blockId,
            modelId: this.currentDisguise.modelId,
            isLocked: this.isLocked
        };
    }

    lock(val = true) {
        this.isLocked = !!val;
        if (this.currentDisguise && this.game.player) {
            this.currentDisguise.lockedYaw = this.game.player.yaw;
        }
        if (this.game.ui) this.game.ui.showToast(this.isLocked ? "🔒 Проп заблоковано в положенні" : "🔓 Проп розблоковано");
    }

    taunt(soundName = 'whistle') {
        const p = this.game.player;
        if (!p) return;

        if (soundName === 'whistle') {
            this.modManager.soundSynth.tone(880, 0.25, 'sine');
            setTimeout(() => this.modManager.soundSynth.tone(1200, 0.35, 'sine'), 200);
        } else if (soundName === 'horn') {
            this.modManager.soundSynth.horn(0.4);
        } else if (soundName === 'beep') {
            this.modManager.soundSynth.beep(750, 0.15);
        } else {
            this.modManager.soundSynth.play(soundName);
        }

        if (this.game.particleSystem) {
            this.game.particleSystem.spawnBlockBreakParticles(p.position.x, p.position.y + 1, p.position.z, 16, 12);
        }

        if (this.game.multiplayer && this.game.multiplayer.isConnected) {
            this.game.multiplayer.broadcast({
                type: 'mod_net',
                channel: 'prop_taunt',
                sound: soundName,
                x: p.position.x,
                y: p.position.y,
                z: p.position.z
            });
        }
    }

    setBlindness(enabled, durationSeconds = 30) {
        if (this.blindnessTimer) {
            clearInterval(this.blindnessTimer);
            this.blindnessTimer = null;
        }

        let el = document.getElementById('prop-blindness-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'prop-blindness-overlay';
            el.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;font-weight:bold;';
            document.body.appendChild(el);
        }

        if (!enabled) {
            el.style.display = 'none';
            return;
        }

        el.style.display = 'flex';
        let left = Math.round(Number(durationSeconds) || 30);
        el.innerHTML = `<div style="font-size:32px;color:#ff4444;margin-bottom:12px;">🙈 ВИСЛІПЛЕННЯ МИСЛИВЦІВ</div><div style="font-size:20px;color:#ffd700;">Пропи ховаються! Зачекайте: <b id="prop-blind-sec">${left}</b> сек.</div>`;

        this.blindnessTimer = setInterval(() => {
            left--;
            const sec = document.getElementById('prop-blind-sec');
            if (sec) sec.textContent = left;
            if (left <= 0) {
                clearInterval(this.blindnessTimer);
                this.blindnessTimer = null;
                el.style.display = 'none';
                if (this.game.soundManager) this.game.soundManager.speakRandomMeme(["Полювання почалося!"]);
            }
        }, 1000);
    }

    getEyeTrace(maxDist = 30) {
        if (!this.game.camera) return { hit: false };

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
        raycaster.far = maxDist;

        // Check remote players with prop mesh
        if (this.game.multiplayer && this.game.multiplayer.remotePlayers) {
            for (const [peerId, rp] of this.game.multiplayer.remotePlayers.entries()) {
                if (rp.propMesh) {
                    const hits = raycaster.intersectObject(rp.propMesh, true);
                    if (hits.length > 0) {
                        return {
                            hit: true,
                            isProp: true,
                            player: peerId,
                            distance: hits[0].distance,
                            x: hits[0].point.x,
                            y: hits[0].point.y,
                            z: hits[0].point.z
                        };
                    }
                }
            }
        }

        const propTargets = [];
        for (const [peerId, mesh] of this.remoteDisguises.entries()) {
            propTargets.push({ peerId, mesh });
        }

        for (const target of propTargets) {
            const hits = raycaster.intersectObject(target.mesh, true);
            if (hits.length > 0) {
                return {
                    hit: true,
                    isProp: true,
                    player: target.peerId,
                    distance: hits[0].distance,
                    x: hits[0].point.x,
                    y: hits[0].point.y,
                    z: hits[0].point.z
                };
            }
        }

        const origin = this.game.camera.position.clone();
        const dir = new THREE.Vector3();
        this.game.camera.getWorldDirection(dir);

        let step = 0.2;
        for (let d = 0.5; d < maxDist; d += step) {
            const testPos = origin.clone().addScaledVector(dir, d);
            const bx = Math.floor(testPos.x);
            const by = Math.floor(testPos.y);
            const bz = Math.floor(testPos.z);
            const block = this.game.world ? this.game.world.getBlock(bx, by, bz) : 0;
            if (block !== 0 && block !== 19 && block !== 20) {
                return {
                    hit: true,
                    isProp: false,
                    block,
                    x: bx,
                    y: by,
                    z: bz,
                    distance: d
                };
            }
        }

        return { hit: false };
    }

    handleRemoteDisguise(peerId, disguise) {
        if (this.game.multiplayer && this.game.multiplayer.remotePlayers) {
            const rp = this.game.multiplayer.remotePlayers.get(peerId);
            if (rp) {
                rp.setPropDisguise(disguise);
                return;
            }
        }

        this.handleRemoteUndisguise(peerId);

        let mesh = null;
        const scale = disguise.scale || 1.0;
        if (disguise.blockId !== undefined) {
            const geo = new THREE.BoxGeometry(scale, scale, scale);
            const mat = this.game.textureManager ? this.game.textureManager.getMaterial(disguise.blockId) : new THREE.MeshLambertMaterial({ color: 0x888888 });
            mesh = new THREE.Mesh(geo, mat);
        } else if (disguise.modelId && this.modManager.modelManager && this.modManager.modelManager.cachedModels.has(disguise.modelId)) {
            const gltf = this.modManager.modelManager.cachedModels.get(disguise.modelId);
            mesh = gltf.scene.clone(true);
            mesh.scale.set(scale, scale, scale);
        }

        if (mesh) {
            this.game.scene.add(mesh);
            this.remoteDisguises.set(peerId, mesh);
        }
    }

    handleRemoteUndisguise(peerId) {
        if (this.game.multiplayer && this.game.multiplayer.remotePlayers) {
            const rp = this.game.multiplayer.remotePlayers.get(peerId);
            if (rp) {
                rp.clearPropDisguise();
            }
        }

        const mesh = this.remoteDisguises.get(peerId);
        if (mesh) {
            this.game.scene.remove(mesh);
            this.remoteDisguises.delete(peerId);
        }
    }

    handleRemoteTaunt(soundName, x, y, z) {
        if (soundName === 'whistle') {
            this.modManager.soundSynth.tone(880, 0.25, 'sine');
            setTimeout(() => this.modManager.soundSynth.tone(1200, 0.35, 'sine'), 200);
        } else {
            this.modManager.soundSynth.play(soundName);
        }
        if (this.game.particleSystem) {
            this.game.particleSystem.spawnBlockBreakParticles(x, y + 1, z, 16, 12);
        }
    }

    update(dt) {
        if (this.currentDisguise && this.currentDisguise.mesh && this.game.player) {
            const p = this.game.player;
            this.currentDisguise.mesh.position.set(p.position.x, p.position.y + 0.4 * (this.currentDisguise.scale || 1), p.position.z);
            if (!this.isLocked) {
                this.currentDisguise.mesh.rotation.y = p.yaw;
            } else {
                this.currentDisguise.mesh.rotation.y = this.currentDisguise.lockedYaw || 0;
            }
        }

        if (this.game.multiplayer) {
            for (const [peerId, mesh] of this.remoteDisguises.entries()) {
                const rp = this.game.multiplayer.remotePlayers.get(peerId);
                if (rp && rp.position) {
                    mesh.position.set(rp.position.x, rp.position.y + 0.4, rp.position.z);
                }
            }
        }
    }

    clear() {
        this.undisguise();
        for (const mesh of this.remoteDisguises.values()) {
            this.game.scene.remove(mesh);
        }
        this.remoteDisguises.clear();
        this.setBlindness(false);
    }

    reset() {
        this.clear();
    }
}

// ==========================================
// 7. BLACKRP / DARKRP SYSTEM (Economy, Jobs, Doors, 3D Text, Entities, Arrest)
// ==========================================
class BlackRPManager {
    constructor(game, modManager) {
        this.game = game;
        this.modManager = modManager;

        this.money = 500;
        this.loadMoney();

        this.jobs = new Map();
        this.currentJobId = "citizen";
        this.salaryInterval = null;
        this.setupDefaultJobs();

        this.doors = new Map();
        this.textSprites = new Map();
        this.entities = new Map();
        this.nextEntityId = 1;

        this.isArrestedState = false;
        this.arrestTimer = null;
        this.isWantedState = false;
        this.wantedReason = "";

        this.startSalaryTimer();
    }

    loadMoney() {
        try {
            const v = localStorage.getItem('eblan_rp_money');
            if (v !== null) this.money = Number(v) || 500;
        } catch(e){}
    }

    saveMoney() {
        try {
            localStorage.setItem('eblan_rp_money', String(this.money));
        } catch(e){}
    }

    getMoney() { return this.money; }
    setMoney(val) {
        this.money = Math.max(0, Number(val) || 0);
        this.saveMoney();
        this.updateHUD();
    }
    addMoney(val) {
        this.setMoney(this.money + (Number(val) || 0));
        if (this.game.soundManager) this.modManager.soundSynth.beep(900, 0.08);
    }
    takeMoney(val) {
        this.setMoney(Math.max(0, this.money - (Number(val) || 0)));
    }
    canAfford(val) {
        return this.money >= (Number(val) || 0);
    }

    updateHUD() {
        const job = this.jobs.get(this.currentJobId) || { name: 'Громадянин', color: '#fff' };
        let el = document.getElementById('blackrp-hud');
        if (!el) {
            el = document.createElement('div');
            el.id = 'blackrp-hud';
            el.style.cssText = 'position:fixed;bottom:80px;left:16px;background:rgba(20,20,20,0.85);border:1.5px solid #ffd700;border-radius:8px;padding:8px 14px;color:#fff;font-family:sans-serif;font-size:13px;z-index:90;pointer-events:none;box-shadow:0 4px 15px rgba(0,0,0,0.6);';
            document.body.appendChild(el);
        }
        el.innerHTML = `
            <div style="font-weight:bold;color:${job.color || '#ffd700'};font-size:14px;margin-bottom:3px;">💼 Професія: ${job.name}</div>
            <div style="color:#00ff88;font-weight:bold;">💵 Гроші: $${this.money}</div>
            <div style="font-size:11px;color:#bbb;">Зарплата: $${job.salary || 50} / хв</div>
            ${this.isWantedState ? '<div style="color:#ff3333;font-weight:bold;">⚠️ У РОЗШУКУ!</div>' : ''}
        `;
    }

    setupDefaultJobs() {
        this.registerJob("citizen", { name: "Громадянин", color: "#4caf50", salary: 50, description: "Звичайний мешканець міста." });
        this.registerJob("police", { name: "Поліцейський", color: "#2196f3", salary: 120, weapons: ["iron_sword"], description: "Охорона закону і арешт злочинців." });
        this.registerJob("dealer", { name: "Торговець зброєю", color: "#ff9800", salary: 80, description: "Продаж зброї та амуніції." });
        this.registerJob("mayor", { name: "Мер міста", color: "#e91e63", salary: 250, description: "Керує містом і оголошує розшук." });
    }

    registerJob(id, data) {
        this.jobs.set(id, {
            id,
            name: data.name || id,
            color: data.color || "#ffffff",
            salary: Number(data.salary) || 50,
            weapons: data.weapons || [],
            max: data.max || 0,
            description: data.description || ""
        });
    }

    setJob(id) {
        const job = this.jobs.get(id);
        if (!job) return false;
        this.currentJobId = id;
        if (job.weapons && job.weapons.length > 0 && this.game.player) {
            for (const w of job.weapons) {
                this.game.player.addItem(w, 1);
            }
        }
        if (this.game.ui) this.game.ui.showToast(`💼 Ви стали [${job.name}]!`);
        this.updateHUD();
        return true;
    }

    getJob() {
        return this.jobs.get(this.currentJobId);
    }

    startSalaryTimer() {
        if (this.salaryInterval) clearInterval(this.salaryInterval);
        this.salaryInterval = setInterval(() => {
            if (this.game && this.game.player && !this.game.player.isDead) {
                const job = this.getJob();
                const sal = job ? job.salary : 50;
                this.addMoney(sal);
                if (this.game.ui) this.game.ui.showToast(`💰 Зарплата отримана: +$${sal}!`);
            }
        }, 60000);
        this.updateHUD();
    }

    addText3D(id, text, x, y, z, opts = {}) {
        this.removeText3D(id);

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const draw = (t) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = opts.bgColor || 'rgba(10, 10, 15, 0.85)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 16);
            } else {
                ctx.rect(10, 10, canvas.width - 20, canvas.height - 20);
            }
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = opts.borderColor || '#ffd700';
            ctx.stroke();

            ctx.font = 'bold 36px monospace, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = opts.color || '#ffffff';
            ctx.fillText(t, canvas.width / 2, canvas.height / 2);
        };

        draw(text);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: true });
        const sprite = new THREE.Sprite(material);

        const scale = opts.size || 1.8;
        sprite.scale.set(scale * 2.8, scale * 0.7, 1);
        sprite.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);

        this.game.scene.add(sprite);
        this.textSprites.set(id, { sprite, canvas, ctx, texture, draw, opts });
        return true;
    }

    updateText3D(id, newText) {
        const item = this.textSprites.get(id);
        if (!item) return false;
        item.draw(newText);
        item.texture.needsUpdate = true;
        return true;
    }

    removeText3D(id) {
        const item = this.textSprites.get(id);
        if (!item) return false;
        if (item.sprite && this.game.scene) {
            this.game.scene.remove(item.sprite);
        }
        this.textSprites.delete(id);
        return true;
    }

    clearText3D() {
        for (const item of this.textSprites.values()) {
            if (item.sprite && this.game.scene) this.game.scene.remove(item.sprite);
        }
        this.textSprites.clear();
    }

    doorKey(x, y, z) { return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`; }

    setDoorOwner(x, y, z, owner) {
        const k = this.doorKey(x, y, z);
        const door = this.doors.get(k) || { locked: false, price: 100 };
        door.owner = owner;
        this.doors.set(k, door);
        this.updateDoorTag(x, y, z);
    }

    lockDoor(x, y, z, val = true) {
        const k = this.doorKey(x, y, z);
        const door = this.doors.get(k) || {};
        door.locked = !!val;
        this.doors.set(k, door);
        this.updateDoorTag(x, y, z);
        if (this.game.soundManager) this.modManager.soundSynth.beep(val ? 300 : 700, 0.1);
    }

    isDoorLocked(x, y, z) {
        const d = this.doors.get(this.doorKey(x, y, z));
        return d ? !!d.locked : false;
    }

    updateDoorTag(x, y, z) {
        const k = this.doorKey(x, y, z);
        const d = this.doors.get(k);
        if (!d) return;
        const text = d.owner ? `[Двері] Власник: ${d.owner} (${d.locked ? '🔒 Зачинено' : '🔓 Відчинено'})` : `[Двері] Продаються: $${d.price || 100}`;
        this.addText3D('door_' + k, text, Math.floor(x) + 0.5, Math.floor(y) + 1.2, Math.floor(z) + 0.5, {
            size: 1.2,
            color: d.owner ? '#ffd700' : '#00ff88'
        });
    }

    spawnEntity(type, x, y, z, opts = {}) {
        const id = 'ent_' + (this.nextEntityId++);
        let mesh = null;

        if (type === 'money_printer') {
            const geo = new THREE.BoxGeometry(0.8, 0.6, 0.6);
            const mat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y + 0.3, z);
            this.game.scene.add(mesh);

            const ent = {
                id,
                type,
                mesh,
                storedMoney: 0,
                timer: 0,
                maxMoney: opts.max || 500,
                rate: opts.rate || 20,
                onUse: () => {
                    if (ent.storedMoney > 0) {
                        this.addMoney(ent.storedMoney);
                        if (this.game.ui) this.game.ui.showToast(`💵 Забрано з принтера: +$${ent.storedMoney}!`);
                        ent.storedMoney = 0;
                        this.updateText3D('tag_' + id, `[Принтер] $0`);
                    }
                }
            };
            this.addText3D('tag_' + id, `[Принтер] $0`, x, y + 0.85, z, { size: 1.0, color: '#00ff88' });
            this.entities.set(id, ent);
            return id;
        } else if (type === 'dropped_money') {
            const amount = Number(opts.amount) || 50;
            const geo = new THREE.BoxGeometry(0.5, 0.1, 0.3);
            const mat = new THREE.MeshLambertMaterial({ color: 0x81c784 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y + 0.1, z);
            this.game.scene.add(mesh);

            const ent = {
                id,
                type,
                mesh,
                amount,
                onUse: () => {
                    this.addMoney(amount);
                    if (this.game.ui) this.game.ui.showToast(`💵 Підібрано: $${amount}!`);
                    this.removeEntity(id);
                }
            };
            this.addText3D('tag_' + id, `💵 $${amount}`, x, y + 0.4, z, { size: 0.9, color: '#ffd700' });
            this.entities.set(id, ent);
            return id;
        } else {
            const geo = new THREE.BoxGeometry(opts.sx || 1, opts.sy || 1, opts.sz || 1);
            const mat = new THREE.MeshLambertMaterial({ color: opts.color || 0x999999 });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y + (opts.sy || 1) / 2, z);
            this.game.scene.add(mesh);
            const ent = { id, type, mesh, onUse: opts.onUse };
            this.entities.set(id, ent);
            return id;
        }
    }

    removeEntity(id) {
        const ent = this.entities.get(id);
        if (!ent) return false;
        if (ent.mesh && this.game.scene) {
            this.game.scene.remove(ent.mesh);
        }
        this.removeText3D('tag_' + id);
        this.entities.delete(id);
        return true;
    }

    dropMoney(amount, x, y, z) {
        return this.spawnEntity('dropped_money', x, y, z, { amount });
    }

    arrest(durationSeconds = 60, jailPos = null) {
        this.isArrestedState = true;
        if (jailPos && this.game.player) {
            this.game.player.position.set(jailPos.x || 0, jailPos.y || 16, jailPos.z || 0);
        }
        if (this.game.ui) this.game.ui.showToast(`👮 ВАС ЗААРЕШТОВАНО на ${durationSeconds} сек.!`);

        if (this.arrestTimer) clearTimeout(this.arrestTimer);
        this.arrestTimer = setTimeout(() => {
            this.unarrest();
        }, durationSeconds * 1000);
    }

    unarrest() {
        this.isArrestedState = false;
        if (this.arrestTimer) {
            clearTimeout(this.arrestTimer);
            this.arrestTimer = null;
        }
        if (this.game.ui) this.game.ui.showToast("🔓 Ви відбули строк і вільні!");
    }

    setWanted(val, reason = "Порушення закону") {
        this.isWantedState = !!val;
        this.wantedReason = reason;
        this.updateHUD();
        if (this.isWantedState) {
            if (this.game.soundManager) this.modManager.soundSynth.horn(0.3);
            if (this.game.ui) this.game.ui.showToast(`⚠️ Оголошено в розшук: ${reason}!`);
        }
    }

    update(dt) {
        for (const [id, ent] of this.entities.entries()) {
            if (ent.type === 'money_printer') {
                ent.timer = (ent.timer || 0) + dt;
                if (ent.timer >= 8.0) {
                    ent.timer = 0;
                    if (ent.storedMoney < ent.maxMoney) {
                        ent.storedMoney = Math.min(ent.maxMoney, ent.storedMoney + ent.rate);
                        this.updateText3D('tag_' + id, `[Принтер] $${ent.storedMoney}`);
                        this.modManager.soundSynth.beep(520, 0.04);
                    }
                }
            } else if (ent.type === 'dropped_money' && this.game.player) {
                if (ent.mesh.position.distanceTo(this.game.player.position) < 1.4) {
                    ent.onUse();
                }
            }
        }
    }

    clear() {
        this.clearText3D();
        for (const ent of this.entities.values()) {
            if (ent.mesh && this.game.scene) this.game.scene.remove(ent.mesh);
        }
        this.entities.clear();
        if (this.salaryInterval) clearInterval(this.salaryInterval);
        const hud = document.getElementById('blackrp-hud');
        if (hud && hud.parentElement) hud.parentElement.removeChild(hud);
    }

    reset() {
        this.clear();
    }
}

// ==========================================
// 8. TIMER & TEAMS MANAGERS
// ==========================================
class TimerManager {
    constructor() {
        this.timers = new Map();
        this.nextTimerId = 1;
    }

    simple(delaySec, fn) {
        const id = 'timer_simple_' + (this.nextTimerId++);
        const target = performance.now() + Math.max(0, Number(delaySec) || 0) * 1000;
        this.timers.set(id, { target, repeats: 1, fn });
        return id;
    }

    create(id, intervalSec, repeats, fn) {
        const interval = Math.max(0.01, Number(intervalSec) || 1.0) * 1000;
        const target = performance.now() + interval;
        this.timers.set(String(id), { target, interval, repeats: Number(repeats) || 0, count: 0, fn });
        return id;
    }

    remove(id) {
        return this.timers.delete(String(id));
    }

    exists(id) {
        return this.timers.has(String(id));
    }

    update() {
        const now = performance.now();
        for (const [id, t] of this.timers.entries()) {
            if (now >= t.target) {
                try {
                    t.fn();
                } catch(e) {
                    console.error("Timer error:", e);
                }
                t.count = (t.count || 0) + 1;
                if (t.repeats > 0 && t.count >= t.repeats) {
                    this.timers.delete(id);
                } else if (t.interval) {
                    t.target = now + t.interval;
                } else {
                    this.timers.delete(id);
                }
            }
        }
    }

    clear() {
        this.timers.clear();
    }
}

class TeamsManager {
    constructor() {
        this.teams = new Map();
        this.playerTeams = new Map();
    }

    create(id, opts = {}) {
        this.teams.set(String(id), {
            id: String(id),
            name: opts.name || id,
            color: opts.color || '#ffffff',
            score: Number(opts.score) || 0
        });
    }

    set(player, teamId) {
        this.playerTeams.set(String(player), String(teamId));
    }

    get(player) {
        return this.playerTeams.get(String(player)) || null;
    }

    getPlayers(teamId) {
        const list = [];
        for (const [p, t] of this.playerTeams.entries()) {
            if (t === String(teamId)) list.push(p);
        }
        return list;
    }

    setScore(teamId, score) {
        const tm = this.teams.get(String(teamId));
        if (tm) tm.score = Number(score) || 0;
    }

    getScore(teamId) {
        const tm = this.teams.get(String(teamId));
        return tm ? tm.score : 0;
    }

    getAll() {
        const arr = [];
        for (const tm of this.teams.values()) arr.push(tm);
        return arr;
    }

    clear() {
        this.teams.clear();
        this.playerTeams.clear();
    }
}

class ModManager {
    constructor(game) {
        this.game = game;
        this.player = game.player;
        this.world = game.world;

        this.soundSynth = new SoundSynthesizer(game.soundManager);
        this.blockRegistry = new CustomBlockRegistry(game, this);
        this.regionManager = new RegionManager(game, this);
        this.itemRegistry = new CustomItemRegistry(game);
        this.weaponManager = new WeaponCombatManager(game);
        this.vehicleManager = new VehicleManager(game);
        this.customUI = new CustomUIManager();
        this.modelManager = new GLTFModelManager(game);
        this.propHuntManager = new PropHuntManager(game, this);
        this.blackRPManager = new BlackRPManager(game, this);
        this.timerManager = new TimerManager();
        this.teamsManager = new TeamsManager();
        this.chatCommands = new Map();
        this.netReceivers = new Map();
        this.packetSendHooks = [];
        this.packetReceiveHooks = [];

        this.L = null;
        this.mods = [];
        this._luaMobId = 0;
        this.eventListeners = {};
        this.consoleLogs = [];
        this.maxLogs = 250;
        this.consoleHistory = [];
        this.historyIndex = -1;
        this.currentEditingModId = null;

        // Touch driving inputs for phones
        this.touchGas = false;
        this.touchBrake = false;
        this.touchSteerLeft = false;
        this.touchSteerRight = false;

        this.initLua();
        this.loadSavedMods();
        this.initUI();
        this.initDevConsole();
        this.initTouchFlyControls();
        this.initTouchVehicleControls();
    }

    callLua(fn, ...args) {
        if (!this.L || !this.fengari) return undefined;
        const { lua, interop } = this.fengari;
        const top = lua.lua_gettop(this.L);
        try {
            interop.push(this.L, fn);
            for (let i = 0; i < args.length; i++) {
                interop.push(this.L, args[i]);
            }
            const status = lua.lua_pcall(this.L, args.length, 1, 0);
            if (status !== lua.LUA_OK) {
                const err = lua.lua_tojsstring(this.L, -1);
                lua.lua_settop(this.L, top);
                console.error("Lua call error:", err);
                this.log(`Lua callback: ${err}`, "error");
                return undefined;
            }
            const res = interop.tojs(this.L, -1);
            lua.lua_settop(this.L, top);
            return res;
        } catch (e) {
            lua.lua_settop(this.L, top);
            console.error("callLua exception:", e);
            return undefined;
        }
    }

    luaToJs(val) {
        if (val === null || val === undefined) return val;
        if (typeof val === "function") {
            const s = String(val);
            if (s.startsWith("function:")) {
                const self = this;
                return function(...args) {
                    return self.callLua(val, ...args);
                };
            }
            if (typeof val.get === "function") {
                const obj = {};
                let count = 0;
                try {
                    for (const [k, v] of val) {
                        obj[k] = this.luaToJs(v);
                        count++;
                    }
                } catch (e) {}
                if (count > 0) {
                    let isArr = true;
                    for (let i = 1; i <= count; i++) {
                        if (!(i in obj)) { isArr = false; break; }
                    }
                    if (isArr) {
                        const arr = [];
                        for (let i = 1; i <= count; i++) arr.push(obj[i]);
                        return arr;
                    }
                }
                return obj;
            }
        }
        return val;
    }

    // --- FULL NETWORKING HOOK SYSTEM ---
    addPacketSendHook(typeOrFn, fn) {
        if (!fn || typeof typeOrFn === "function" || (typeOrFn && String(typeOrFn).startsWith("function:"))) {
            this.packetSendHooks.push({ type: "*", fn: typeOrFn });
        } else {
            this.packetSendHooks.push({ type: String(typeOrFn), fn: fn });
        }
    }

    addPacketReceiveHook(typeOrFn, fn) {
        if (!fn || typeof typeOrFn === "function" || (typeOrFn && String(typeOrFn).startsWith("function:"))) {
            this.packetReceiveHooks.push({ type: "*", fn: typeOrFn });
        } else {
            this.packetReceiveHooks.push({ type: String(typeOrFn), fn: fn });
        }
    }

    clearPacketHooks() {
        this.packetSendHooks = [];
        this.packetReceiveHooks = [];
    }

    filterOutgoingPacket(packet, excludePeerId = null, targetPeerId = null) {
        if (!packet || typeof packet !== 'object') return packet;
        if (packet._outgoingFiltered) return packet;

        // 1. Run type-specific and wildcard hooks
        for (const hook of this.packetSendHooks) {
            if (hook.type === "*" || hook.type === packet.type) {
                try {
                    const res = (typeof this.callLua === "function")
                        ? this.callLua(hook.fn, packet, targetPeerId, excludePeerId)
                        : hook.fn(packet, targetPeerId, excludePeerId);

                    if (res === false) {
                        return false; // Packet cancelled!
                    }
                    if (res && (typeof res === "object" || typeof res === "function")) {
                        const converted = this.luaToJs ? this.luaToJs(res) : res;
                        if (converted && typeof converted === "object") packet = converted;
                    }
                } catch (e) {
                    console.error("Error in packet send hook:", e);
                }
            }
        }

        // 2. Trigger general event 'packet_send'
        const evRes = this.triggerEvent("packet_send", packet, targetPeerId, excludePeerId);
        if (evRes === false) return false;

        packet._outgoingFiltered = true;
        return packet;
    }

    filterIncomingPacket(packet, senderPeerId = null) {
        if (!packet || typeof packet !== 'object') return packet;
        if (packet._incomingFiltered) return packet;

        // 1. Run type-specific and wildcard hooks
        for (const hook of this.packetReceiveHooks) {
            if (hook.type === "*" || hook.type === packet.type) {
                try {
                    const res = (typeof this.callLua === "function")
                        ? this.callLua(hook.fn, packet, senderPeerId)
                        : hook.fn(packet, senderPeerId);

                    if (res === false) {
                        return false; // Packet dropped!
                    }
                    if (res && (typeof res === "object" || typeof res === "function")) {
                        const converted = this.luaToJs ? this.luaToJs(res) : res;
                        if (converted && typeof converted === "object") packet = converted;
                    }
                } catch (e) {
                    console.error("Error in packet receive hook:", e);
                }
            }
        }

        // 2. Trigger general event 'packet_receive'
        const evRes = this.triggerEvent("packet_receive", packet, senderPeerId);
        if (evRes === false) return false;

        packet._incomingFiltered = true;
        return packet;
    }

    canBreakBlock(x, y, z, type, player) {
        const reg = this.regionManager ? this.regionManager.getAt(x, y, z) : null;
        if (reg && !this.regionManager.isAllowed(player, x, y, z, 'break')) {
            if (reg.message && this.game.ui) {
                this.game.ui.showToast(reg.message);
            }
            if (this.game.soundManager) {
                this.game.soundManager.speakRandomMeme(["Тут не можна ламати!", "Приват регіону!"]);
            }
            return false;
        }

        const eventRes = this.triggerEvent("onBlockBreak", x, y, z, type, player);
        if (eventRes === false) return false;

        const blockDef = this.blockRegistry ? this.blockRegistry.registeredBlocks.get(type) : null;
        if (blockDef && blockDef.opts && typeof blockDef.opts.onBreak === 'function') {
            try {
                const bRes = blockDef.opts.onBreak(x, y, z, player);
                if (bRes === false) return false;
            } catch (e) {
                console.error("Error in block onBreak callback:", e);
            }
        }

        return true;
    }

    canPlaceBlock(x, y, z, type, player) {
        const reg = this.regionManager ? this.regionManager.getAt(x, y, z) : null;
        if (reg && !this.regionManager.isAllowed(player, x, y, z, 'place')) {
            if (reg.message && this.game.ui) {
                this.game.ui.showToast(reg.message);
            }
            if (this.game.soundManager) {
                this.game.soundManager.speakRandomMeme(["Тут не можна ставити!", "Приват регіону!"]);
            }
            return false;
        }

        const eventRes = this.triggerEvent("onBlockPlace", x, y, z, type, player);
        if (eventRes === false) return false;

        const blockDef = this.blockRegistry ? this.blockRegistry.registeredBlocks.get(type) : null;
        if (blockDef && blockDef.opts && typeof blockDef.opts.onPlace === 'function') {
            try {
                const bRes = blockDef.opts.onPlace(x, y, z, player);
                if (bRes === false) return false;
            } catch (e) {
                console.error("Error in block onPlace callback:", e);
            }
        }

        return true;
    }

    canExplodeBlock(x, y, z, type) {
        if (this.regionManager && !this.regionManager.isAllowed(null, x, y, z, 'explode')) {
            return false;
        }
        const eventRes = this.triggerEvent("onBlockExplode", x, y, z, type);
        if (eventRes === false) return false;
        return true;
    }

    canInteractBlock(x, y, z, type, player) {
        if (this.regionManager && !this.regionManager.isAllowed(player, x, y, z, 'interact')) {
            return false;
        }
        const eventRes = this.triggerEvent("onBlockInteract", x, y, z, type, player);
        if (eventRes === false) return false;

        const blockDef = this.blockRegistry ? this.blockRegistry.registeredBlocks.get(type) : null;
        if (blockDef && blockDef.opts && typeof blockDef.opts.onInteract === 'function') {
            try {
                const res = blockDef.opts.onInteract(x, y, z, player);
                if (res === false) return false;
            } catch (e) {
                console.error("Error in block onInteract callback:", e);
            }
        }
        return true;
    }

    // --- LUA ENGINE INITIALIZATION ---
    initLua() {
        if (typeof fengari === "undefined") {
            console.error("Fengari Lua runtime is not loaded!");
            return;
        }

        const { lua, lauxlib, lualib, interop, to_luastring, to_jsstring } = fengari;
        this.fengari = fengari;

        // Use standard Lua state
        this.L = lauxlib.luaL_newstate();
        lualib.luaL_openlibs(this.L);
        lauxlib.luaL_requiref(this.L, to_luastring("js"), interop.luaopen_js, 1);
        lua.lua_pop(this.L, 1);

        // Bridge Object linking JavaScript to Lua
        const bridge = {
            log: (level, msg) => this.log(msg, level),
            addEventListener: (eventName, fn) => this.addEventListener(eventName, fn),
            removeEventListener: (eventName, fn) => this.removeEventListener(eventName, fn),
            clearEventListeners: (eventName) => this.clearEventListeners(eventName),

            // Player Bridge
            player: {
                isCreative: () => !!(this.game.player && this.game.player.isCreative),
                setCreative: (val) => {
                    const p = this.game.player;
                    if (!p) return;
                    p.isCreative = !!val;
                    if (val) {
                        p.godMode = true;
                        p.instantBreak = true;
                        p.infiniteBlocks = true;
                        p.customReach = 10.0;
                    } else {
                        p.instantBreak = false;
                        p.infiniteBlocks = false;
                        p.customReach = 5.2;
                    }
                    this.updateFlyTouchVisibility();
                    this.updateCreativeBadge();
                },
                isFlying: () => !!(this.game.player && this.game.player.isFlying),
                setFlying: (val) => {
                    const p = this.game.player;
                    if (!p) return;
                    p.isFlying = !!val;
                    this.updateFlyTouchVisibility();
                },
                getFlySpeed: () => (this.game.player ? (this.game.player.flySpeed || 11.0) : 11.0),
                setFlySpeed: (val) => {
                    if (this.game.player) this.game.player.flySpeed = Number(val) || 11.0;
                },
                isGodMode: () => !!(this.game.player && this.game.player.godMode),
                setGodMode: (val) => {
                    if (this.game.player) {
                        this.game.player.godMode = !!val;
                        const chk = document.getElementById("chk-godmode");
                        if (chk) chk.checked = !!val;
                    }
                },
                isInstantBreak: () => !!(this.game.player && this.game.player.instantBreak),
                setInstantBreak: (val) => {
                    if (this.game.player) this.game.player.instantBreak = !!val;
                },
                isInfiniteBlocks: () => !!(this.game.player && this.game.player.infiniteBlocks),
                setInfiniteBlocks: (val) => {
                    if (this.game.player) this.game.player.infiniteBlocks = !!val;
                },
                getReach: () => (this.game.player ? (this.game.player.customReach || 5.2) : 5.2),
                setReach: (val) => {
                    if (this.game.player) this.game.player.customReach = Number(val) || 5.2;
                },
                getSpeed: () => (this.game.player ? (this.game.player.speedMultiplier || 1.0) : 1.0),
                setSpeed: (val) => {
                    if (this.game.player) this.game.player.speedMultiplier = Number(val) || 1.0;
                },
                // Physics API (переопределения констант updatePhysics).
                // ВАЖНО: Lua-таблицы не доезжают до JS (fengari отдаёт opaque-обёртку),
                // поэтому только скалярные сеттеры, не set({таблица}).
                getPhysics: () => {
                    const p = this.game.player;
                    if (!p) return {};
                    return {
                        gravity: p.physGravity ?? 22.0,
                        jumpPower: p.physJumpPower ?? 8.5,
                        walkSpeed: p.physWalkSpeed ?? 4.5,
                        sprintSpeed: p.physSprintSpeed ?? 7.5,
                        jumpCooldown: p.physJumpCooldown ?? 0.18,
                        noFallDamage: !!p.physNoFallDamage,
                        onGround: !!p.onGround,
                    };
                },
                // setPhysicsField(field, value): value null/undefined = сброс к дефолту
                setPhysicsField: (field, val) => {
                    const p = this.game.player;
                    if (!p) return false;
                    const v = (val === undefined || val === null) ? undefined : Number(val);
                    switch (String(field)) {
                        case 'gravity': p.physGravity = v; break;
                        case 'jumpPower': p.physJumpPower = v; break;
                        case 'walkSpeed': p.physWalkSpeed = v; break;
                        case 'sprintSpeed': p.physSprintSpeed = v; break;
                        case 'jumpCooldown': p.physJumpCooldown = v; break;
                        case 'noFallDamage': p.physNoFallDamage = (v ? true : undefined); break;
                        default: return false;
                    }
                    return true;
                },
                resetPhysics: () => {
                    const p = this.game.player;
                    if (!p) return;
                    delete p.physGravity; delete p.physJumpPower; delete p.physWalkSpeed;
                    delete p.physSprintSpeed; delete p.physJumpCooldown; delete p.physNoFallDamage;
                },
                getPosition: () => {
                    const p = this.game.player;
                    return p ? { x: p.position.x, y: p.position.y, z: p.position.z } : { x: 0, y: 0, z: 0 };
                },
                setPosition: (x, y, z) => {
                    const p = this.game.player;
                    if (p) {
                        p.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
                        p.velocity.set(0, 0, 0);
                    }
                },
                getVelocity: () => {
                    const v = this.game.player ? this.game.player.velocity : null;
                    return v ? { x: v.x, y: v.y, z: v.z } : { x: 0, y: 0, z: 0 };
                },
                setVelocity: (x, y, z) => {
                    if (this.game.player) {
                        this.game.player.velocity.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
                    }
                },
                getRotation: () => {
                    const p = this.game.player;
                    return p ? { yaw: p.yaw, pitch: p.pitch } : { yaw: 0, pitch: 0 };
                },
                setRotation: (yaw, pitch) => {
                    if (this.game.player) {
                        if (yaw !== undefined) this.game.player.yaw = Number(yaw);
                        if (pitch !== undefined) this.game.player.pitch = Number(pitch);
                    }
                },
                getHealth: () => (this.game.player ? this.game.player.health : 100),
                setHealth: (hp) => {
                    if (this.game.player) {
                        this.game.player.health = Math.max(0, Math.min(this.game.player.maxHealth, Number(hp)));
                    }
                },
                heal: (hp) => {
                    if (this.game.player) this.game.player.heal(Number(hp) || 0);
                },
                damage: (amount, reason) => {
                    if (this.game.player) this.game.player.takeDamage(Number(amount) || 1, reason || "Пошкодження");
                },
                getHunger: () => (this.game.player ? this.game.player.hunger : 100),
                setHunger: (val) => {
                    if (this.game.player) {
                        this.game.player.hunger = Math.max(0, Math.min(this.game.player.maxHunger, Number(val)));
                    }
                },
                getIQ: () => (this.game.player ? this.game.player.iq : 0),
                setIQ: (iq) => {
                    if (this.game.player) this.game.player.iq = Number(iq) || 0;
                },
                giveItem: (itemId, count) => {
                    if (this.game.player) return this.game.player.addItem(String(itemId), Number(count) || 1);
                    return false;
                },
                removeItem: (itemId, count) => {
                    if (this.game.player) return this.game.player.removeItem(String(itemId), Number(count) || 1);
                    return false;
                },
                getItemCount: (itemId) => (this.game.player ? this.game.player.getItemCount(String(itemId)) : 0),
                getInventorySlot: (slot) => {
                    const index = Number(slot) - 1;
                    const p = this.game.player;
                    if (!p || !Number.isInteger(index) || index < 0 || index >= 27) return null;
                    const item = p.inventory[index];
                    return item ? { id: item.itemId, count: item.count } : null;
                },
                getSelectedSlot: () => this.game.player ? this.game.player.selectedHotbarIndex + 1 : 1,
                selectSlot: (slot) => {
                    const index = Number(slot) - 1;
                    const p = this.game.player;
                    if (!p || !Number.isInteger(index) || index < 0 || index >= 9) return false;
                    p.selectedHotbarIndex = index;
                    p.updateHeldBlock();
                    if (this.game.ui) this.game.ui.initHotbar();
                    return true;
                },
                clearInventory: () => {
                    if (this.game.player) this.game.player.clearInventory();
                },
                getHeldItem: () => {
                    const item = this.game.player ? this.game.player.getSelectedItem() : null;
                    return item ? { id: item.itemId, count: item.count } : null;
                },
                spawnSafe: () => {
                    if (this.game.player) this.game.player.spawnSafe();
                },
                detonateTNT: () => {
                    if (this.game.player) this.game.player.detonateTNT();
                },
                mount: (vehicleId) => {
                    if (this.game.player) {
                        const veh = this.vehicleManager.vehicles.get(vehicleId);
                        if (veh) this.game.player.mountVehicle(veh);
                    }
                },
                dismount: () => {
                    if (this.game.player) this.game.player.dismountVehicle();
                },
                getVehicle: () => (this.game.player ? this.game.player.getVehicle() : null),
                isMounted: () => !!(this.game.player && this.game.player.isMounted()),
                setFOV: (fov) => {
                    if (this.game.player) this.game.player.setFOV(Number(fov));
                },
                getFOV: () => (this.game.player ? this.game.player.getFOV() : 72),
                isThirdPerson: () => !!(this.game.player && this.game.player.isThirdPerson),
                setHandVisible: (val) => {
                    const p = this.game.player;
                    if (p && p.itemPivot) p.itemPivot.visible = !!val;
                },
                isMouseDown: (btn) => {
                    const ctrl = this.game.controls;
                    if (!ctrl) return false;
                    const b = (btn === undefined || btn === null) ? 0 : btn;
                    if (b === 0 || b === 'left') return !!(ctrl.mouseLeftDown || ctrl.attackBtnPressed || ctrl.breakBtnPressed);
                    if (b === 2 || b === 'right') return !!ctrl.mouseRightDown;
                    if (b === 1 || b === 'middle') return !!ctrl.mouseMiddleDown;
                    return false;
                },
                shoot: (opts) => this.weaponManager.shoot(opts)
            },

            // World Bridge
            world: {
                getBlock: (x, y, z) => {
                    if (this.game.world) {
                        return this.game.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
                    }
                    return 0;
                },
                getBlockName: (x, y, z) => {
                    const id = this.game.world ? this.game.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) : 0;
                    if (window.BLOCK_INFO && window.BLOCK_INFO[id]) {
                        return window.BLOCK_INFO[id].name || String(id);
                    }
                    return String(id);
                },
                setBlock: (x, y, z, type) => {
                    if (this.game.world) {
                        const bx = Math.floor(x);
                        const by = Math.floor(y);
                        const bz = Math.floor(z);
                        const bt = Number(type);
                        this.game.world.setBlock(bx, by, bz, bt);
                        this.game.world.updateMeshes();
                        if (this.game.multiplayer) {
                            this.game.multiplayer.broadcastBlockPlace(bx, by, bz, bt);
                        }
                    }
                },
                setBlocks: (x1, y1, z1, x2, y2, z2, type) => {
                    if (!this.game.world) return;
                    const minX = Math.min(Math.floor(x1), Math.floor(x2));
                    const maxX = Math.max(Math.floor(x1), Math.floor(x2));
                    const minY = Math.max(0, Math.min(Math.floor(y1), Math.floor(y2)));
                    const maxY = Math.min(31, Math.max(Math.floor(y1), Math.floor(y2)));
                    const minZ = Math.min(Math.floor(z1), Math.floor(z2));
                    const maxZ = Math.max(Math.floor(z1), Math.floor(z2));
                    const bt = Number(type);

                    for (let x = minX; x <= maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            for (let z = minZ; z <= maxZ; z++) {
                                this.game.world.setBlock(x, y, z, bt);
                            }
                        }
                    }
                    this.game.world.updateMeshes();
                },
                restoreBlock: (x, y, z) => {
                    if (!this.game.world) return false;
                    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
                    const prev = this.game.world.restoreBlock(bx, by, bz);
                    if (prev !== null && prev !== false) {
                        if (this.game.multiplayer) this.game.multiplayer.broadcastBlockPlace(bx, by, bz, prev);
                        return prev;
                    }
                    return false;
                },
                getPreviousBlock: (x, y, z) => {
                    return this.game.world ? this.game.world.getPreviousBlock(Math.floor(x), Math.floor(y), Math.floor(z)) : null;
                },
                createSnapshot: (name, x1, y1, z1, x2, y2, z2) => {
                    return this.game.world ? this.game.world.createSnapshot(String(name), x1, y1, z1, x2, y2, z2) : 0;
                },
                restoreSnapshot: (name) => {
                    return this.game.world ? this.game.world.restoreSnapshot(String(name)) : false;
                },
                saveRegion: (name, x1, y1, z1, x2, y2, z2) => {
                    return this.game.world ? this.game.world.createSnapshot(String(name), x1, y1, z1, x2, y2, z2) : 0;
                },
                restoreRegion: (name) => {
                    return this.game.world ? this.game.world.restoreSnapshot(String(name)) : false;
                },
                getDimension: () => (this.game.world ? this.game.world.dimension : 'overworld'),
                setDimension: (dim) => {
                    if (this.game.world) this.game.world.switchDimension(String(dim));
                },
                getTime: () => (this.game.dayTime !== undefined ? this.game.dayTime : 0.25),
                setTime: (val) => {
                    if (this.game) this.game.dayTime = Number(val) || 0;
                },
                spawnTNT: (x, y, z, vx, vy, vz) => {
                    if (this.game && window.TNTEntity) {
                        const tnt = new window.TNTEntity(
                            x, y, z,
                            this.game.scene,
                            this.game.textureManager,
                            this.game.soundManager,
                            this.game.world,
                            this.game.particleSystem,
                            this.game
                        );
                        tnt.vx = Number(vx) || 0;
                        tnt.vy = Number(vy) || 5;
                        tnt.vz = Number(vz) || 0;
                        if (this.game.tntEntities) this.game.tntEntities.push(tnt);
                    }
                },
                explode: (x, y, z, radius = 3, power = 10) => {
                    if (!this.game.world) return;
                    const r = Math.min(10, Math.max(1, Number(radius)));
                    const cx = Math.floor(x);
                    const cy = Math.floor(y);
                    const cz = Math.floor(z);

                    for (let dx = -r; dx <= r; dx++) {
                        for (let dy = -r; dy <= r; dy++) {
                            for (let dz = -r; dz <= r; dz++) {
                                if (dx * dx + dy * dy + dz * dz <= r * r) {
                                    const bx = cx + dx;
                                    const by = cy + dy;
                                    const bz = cz + dz;
                                    const b = this.game.world.getBlock(bx, by, bz);
                                    if (b !== 0 && b !== 15) {
                                        if (!this.canExplodeBlock || this.canExplodeBlock(bx, by, bz, b)) {
                                            this.game.world.setBlock(bx, by, bz, 0);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    this.game.world.updateMeshes();
                    if (this.game.soundManager) this.game.soundManager.playExplosion();
                    if (this.game.particleSystem) this.game.particleSystem.spawnExplosion(cx, cy, cz, 40);
                    if (this.game.cameraShakeTrauma !== undefined) this.game.cameraShakeTrauma = 1.0;
                },
                registerBlock: (opts) => {
                    const id = this.blockRegistry.register(opts);
                    this.syncBlocksToLua();
                    return id;
                }
            },

            // Blocks Bridge (Specialized Block Management & Restoration)
            blocks: {
                get: (x, y, z) => {
                    return this.game.world ? this.game.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) : 0;
                },
                set: (x, y, z, type) => {
                    if (!this.game.world) return;
                    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z), bt = Number(type);
                    this.game.world.setBlock(bx, by, bz, bt);
                    this.game.world.updateMeshes();
                    if (this.game.multiplayer) this.game.multiplayer.broadcastBlockPlace(bx, by, bz, bt);
                },
                restore: (x, y, z) => {
                    if (!this.game.world) return false;
                    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
                    const prev = this.game.world.restoreBlock(bx, by, bz);
                    if (prev !== null && prev !== false) {
                        if (this.game.multiplayer) this.game.multiplayer.broadcastBlockPlace(bx, by, bz, prev);
                        return prev;
                    }
                    return false;
                },
                getPrevious: (x, y, z) => {
                    if (!this.game.world) return null;
                    return this.game.world.getPreviousBlock(Math.floor(x), Math.floor(y), Math.floor(z));
                },
                break: (x, y, z, dropItem = true) => {
                    if (!this.game.world) return false;
                    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
                    const type = this.game.world.getBlock(bx, by, bz);
                    if (type === 0 || type === 15) return false;
                    if (this.canBreakBlock && !this.canBreakBlock(bx, by, bz, type, this.game.player)) {
                        return false;
                    }
                    this.game.world.setBlock(bx, by, bz, 0);
                    this.game.world.updateMeshes();
                    if (this.game.soundManager && window.BLOCK_INFO) {
                        this.game.soundManager.playBreak(window.BLOCK_INFO[type]?.sound || 'stone');
                    }
                    if (this.game.particleSystem) {
                        this.game.particleSystem.spawnBlockBreakParticles(bx, by, bz, type, 12);
                    }
                    if (dropItem && this.game.mobManager) {
                        const blockDef = window.BLOCK_INFO ? window.BLOCK_INFO[type] : null;
                        const dropId = blockDef?.dropItem || (window.BLOCK_DROP_MAP ? window.BLOCK_DROP_MAP[type] : null);
                        if (dropId) {
                            this.game.mobManager.spawnItemDrop(bx + 0.5, by + 0.5, bz + 0.5, dropId, Number(blockDef?.dropCount) || 1, 0.35);
                        }
                    }
                    if (this.game.multiplayer) this.game.multiplayer.broadcastBlockBreak(bx, by, bz, type);
                    return true;
                },
                fill: (x1, y1, z1, x2, y2, z2, type) => {
                    if (!this.game.world) return;
                    const minX = Math.min(Math.floor(x1), Math.floor(x2));
                    const maxX = Math.max(Math.floor(x1), Math.floor(x2));
                    const minY = Math.max(0, Math.min(Math.floor(y1), Math.floor(y2)));
                    const maxY = Math.min(31, Math.max(Math.floor(y1), Math.floor(y2)));
                    const minZ = Math.min(Math.floor(z1), Math.floor(z2));
                    const maxZ = Math.max(Math.floor(z1), Math.floor(z2));
                    const bt = Number(type);
                    for (let x = minX; x <= maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            for (let z = minZ; z <= maxZ; z++) {
                                this.game.world.setBlock(x, y, z, bt);
                            }
                        }
                    }
                    this.game.world.updateMeshes();
                },
                getName: (idOrX, y, z) => {
                    let id;
                    if (y !== undefined && z !== undefined) {
                        id = this.game.world ? this.game.world.getBlock(Math.floor(idOrX), Math.floor(y), Math.floor(z)) : 0;
                    } else {
                        id = Number(idOrX);
                    }
                    return (window.BLOCK_INFO && window.BLOCK_INFO[id]) ? (window.BLOCK_INFO[id].name || String(id)) : String(id);
                },
                getInfo: (idOrX, y, z) => {
                    let id;
                    if (y !== undefined && z !== undefined) {
                        id = this.game.world ? this.game.world.getBlock(Math.floor(idOrX), Math.floor(y), Math.floor(z)) : 0;
                    } else {
                        id = Number(idOrX);
                    }
                    const info = (window.BLOCK_INFO && window.BLOCK_INFO[id]) ? window.BLOCK_INFO[id] : { id, name: String(id), hardness: 1.0, solid: true, transparent: false, sound: 'stone', tool: 'pickaxe' };
                    return {
                        id: info.id || id,
                        name: info.name || String(id),
                        sound: info.sound || 'stone',
                        hardness: info.hardness || 1.0,
                        solid: info.solid !== false,
                        transparent: !!info.transparent,
                        tool: info.tool || 'pickaxe',
                        dropItem: info.dropItem || '',
                        dropCount: info.dropCount || 1
                    };
                },
                isSolid: (x, y, z) => {
                    const id = this.game.world ? this.game.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) : 0;
                    if (id === 0 || id === 19 || id === 20) return false;
                    return (window.BLOCK_INFO && window.BLOCK_INFO[id]) ? (window.BLOCK_INFO[id].solid !== false) : true;
                },
                isTransparent: (x, y, z) => {
                    const id = this.game.world ? this.game.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) : 0;
                    if (id === 0 || id === 19) return true;
                    return (window.BLOCK_INFO && window.BLOCK_INFO[id]) ? !!window.BLOCK_INFO[id].transparent : false;
                },
                createSnapshot: (name, x1, y1, z1, x2, y2, z2) => {
                    return this.game.world ? this.game.world.createSnapshot(String(name), x1, y1, z1, x2, y2, z2) : 0;
                },
                restoreSnapshot: (name) => {
                    return this.game.world ? this.game.world.restoreSnapshot(String(name)) : false;
                },
                saveRegion: (name, x1, y1, z1, x2, y2, z2) => {
                    return this.game.world ? this.game.world.createSnapshot(String(name), x1, y1, z1, x2, y2, z2) : 0;
                },
                restoreRegion: (name) => {
                    return this.game.world ? this.game.world.restoreSnapshot(String(name)) : false;
                },
                register: (opts) => {
                    const id = this.blockRegistry.register(opts);
                    this.syncBlocksToLua();
                    return id;
                }
            },

            // Regions Bridge (Protected Areas / Anti-Grief)
            regions: {
                create: (id, x1, y1, z1, x2, y2, z2, opts) => {
                    const jsOpts = this.luaToJs(opts) || {};
                    return this.regionManager.create(id, x1, y1, z1, x2, y2, z2, jsOpts);
                },
                remove: (id) => {
                    return this.regionManager.remove(String(id));
                },
                get: (x, y, z) => {
                    const reg = this.regionManager.getAt(x, y, z);
                    if (!reg) return null;
                    return {
                        id: reg.id,
                        name: reg.name,
                        minX: reg.minX, minY: reg.minY, minZ: reg.minZ,
                        maxX: reg.maxX, maxY: reg.maxY, maxZ: reg.maxZ,
                        owner: reg.owner,
                        allowBreak: reg.allowBreak,
                        allowPlace: reg.allowPlace,
                        allowExplosion: reg.allowExplosion,
                        allowInteract: reg.allowInteract,
                        message: reg.message
                    };
                },
                list: () => {
                    return this.regionManager.list().map(r => ({
                        id: r.id, name: r.name,
                        minX: r.minX, minY: r.minY, minZ: r.minZ,
                        maxX: r.maxX, maxY: r.maxY, maxZ: r.maxZ,
                        owner: r.owner,
                        allowBreak: r.allowBreak,
                        allowPlace: r.allowPlace,
                        allowExplosion: r.allowExplosion
                    }));
                },
                isAllowed: (player, x, y, z, action) => {
                    return this.regionManager.isAllowed(this.game.player, x, y, z, String(action));
                },
                protect: (id, x1, y1, z1, x2, y2, z2, msg) => {
                    return this.regionManager.create(id, x1, y1, z1, x2, y2, z2, {
                        allowBreak: false,
                        allowPlace: false,
                        allowExplosion: false,
                        message: msg || '⚠️ Цей регіон захищено!'
                    });
                },
                saveBlocks: (id) => {
                    const reg = this.regionManager.regions.get(String(id));
                    if (!reg || !this.game.world) return false;
                    return this.game.world.createSnapshot(`reg_${id}`, reg.minX, reg.minY, reg.minZ, reg.maxX, reg.maxY, reg.maxZ);
                },
                restoreBlocks: (id) => {
                    if (!this.game.world) return false;
                    return this.game.world.restoreSnapshot(`reg_${id}`);
                }
            },

            // Textures Bridge
            textures: {
                register: (name, opts) => {
                    const jsOpts = this.luaToJs(opts);
                    if (this.game.textureManager) {
                        return this.game.textureManager.registerTexture(String(name), jsOpts);
                    }
                    return null;
                },
                override: (targetName, opts) => {
                    const jsOpts = this.luaToJs(opts);
                    if (this.game.textureManager) {
                        return this.game.textureManager.overrideTexture(String(targetName), jsOpts);
                    }
                    return null;
                },
                get: (name) => {
                    return this.game.textureManager ? this.game.textureManager.getIconDataURL(String(name)) : '';
                },
                exists: (name) => {
                    return !!(this.game.textureManager && this.game.textureManager.canvasCache[String(name).toLowerCase()]);
                }
            },

            // Game Bridge
            game: {
                toast: (msg) => {
                    if (this.game.ui) this.game.ui.showToast(String(msg));
                },
                chat: (msg, sender = "MOD") => {
                    if (this.game.multiplayer) {
                        this.game.multiplayer.addChatMessage(String(sender), String(msg), sender === "СИСТЕМА");
                    }
                },
                playSound: (soundName) => {
                    this.soundSynth.play(soundName);
                },
                speak: (text) => {
                    if (this.game.soundManager) this.game.soundManager.speakRandomMeme([String(text)]);
                },
                spawnParticles: (x, y, z, blockType = 1, count = 10) => {
                    if (this.game.particleSystem) {
                        this.game.particleSystem.spawnBlockBreakParticles(x, y, z, Number(blockType), Number(count));
                    }
                },
                executeCommand: (cmd) => {
                    if (this.game.multiplayer) this.game.multiplayer.handleCommand(String(cmd));
                },
                setGameMode: (mode) => {
                    const isC = String(mode).toLowerCase() === 'creative';
                    bridge.player.setCreative(isC);
                },
                getGameMode: () => (bridge.player.isCreative() ? 'creative' : 'survival')
            },

            // Sound Bridge
            sound: {
                play: (name) => this.soundSynth.play(name),
                tone: (freq, dur, type) => this.soundSynth.tone(freq, dur, type),
                beep: (freq, dur) => this.soundSynth.beep(freq, dur),
                horn: (dur) => this.soundSynth.horn(dur),
                engine: (rpm, vol) => this.soundSynth.engine(rpm, vol),
                stopEngine: () => this.soundSynth.stopEngine(),
                screech: (dur) => this.soundSynth.screech(dur),
                gunshot: (pitch, vol) => this.soundSynth.gunshot(pitch, vol),
                reload: (stage) => this.soundSynth.reload(stage),
                dryFire: () => this.soundSynth.dryFire()
            },

            // Items Bridge
            items: {
                register: (opts) => this.itemRegistry.register(opts),
                get: (id) => (window.ITEM_REGISTRY ? window.ITEM_REGISTRY[id] : null),
                getAll: () => (window.ITEM_REGISTRY ? Object.values(window.ITEM_REGISTRY) : [])
            },

            // Weapons & Combat Bridge
            weapons: {
                shoot: (opts) => this.weaponManager.shoot(opts)
            },

            bots: {
                spawn: (id, x, y, z) => this.game.mobManager?.spawnBot(id, x, y, z) || false,
                command: (id, action, ...args) => this.game.mobManager?.commandBot(id, action, ...args) || false,
                exists: id => !!this.game.mobManager?.getBot(id),
                getPosition: id => {
                    const p = this.game.mobManager?.getBot(id)?.position;
                    return p ? { x: p.x, y: p.y, z: p.z } : false;
                },
                getHealth: id => this.game.mobManager?.getBot(id)?.health || 0
            },

            // Mobs Bridge (для турелей и модов: поиск + урон)
            mobs: {
                getNearby: (x, y, z, r) => {
                    const res = [];
                    const mm = this.game.mobManager;
                    if (!mm) return res;
                    const R = Math.max(1, Math.min(48, Number(r) || 12));
                    const add = (mob, kind) => {
                        if (!mob || mob.isDead) return;
                        const mp = mob.position || (mob.mesh && mob.mesh.position);
                        if (!mp) return;
                        const dx = mp.x - x, dy = mp.y - y, dz = mp.z - z;
                        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        if (d <= R) {
                            if (mob.__luaId === undefined) mob.__luaId = ++this._luaMobId;
                            res.push({ id: mob.__luaId, type: kind, x: mp.x, y: mp.y, z: mp.z, dist: d, hp: mob.health || 0 });
                        }
                    };
                    if (mm.mobs) for (const m of mm.mobs) add(m, m.type);
                    if (mm.dragon) add(mm.dragon, 'dragon');
                    return res;
                },
                damage: (id, dmg, kx, kz) => {
                    const mm = this.game.mobManager;
                    if (!mm) return false;
                    const all = (mm.mobs || []).concat(mm.dragon ? [mm.dragon] : []);
                    const mob = all.find(m => m.__luaId === Number(id));
                    if (!mob || mob.isDead) return false;
                    try {
                        if (kx !== undefined) mob.takeDamage(Number(dmg) || 1, { x: kx, y: 0, z: kz || 0 });
                        else mob.takeDamage(Number(dmg) || 1);
                        return true;
                    } catch (e) { return false; }
                }
            },

            // UI Bridge
            ui: {
                createPanel: (opts) => this.customUI.createPanel(opts.id || ('panel_' + Date.now()), opts),
                createButton: (opts, cb) => this.customUI.createButton(opts.id || ('btn_' + Date.now()), opts, cb),
                createLabel: (opts) => this.customUI.createLabel(opts.id || ('lbl_' + Date.now()), opts),
                setText: (id, text) => this.customUI.setText(id, text),
                setStyle: (id, prop, val) => this.customUI.setStyle(id, prop, val),
                show: (id) => this.customUI.show(id),
                hide: (id) => this.customUI.hide(id),
                remove: (id) => this.customUI.remove(id),
                clear: () => this.customUI.clear(),
                showSpeedometer: (opts) => this.showVehicleHud(opts),
                updateSpeedometer: (spd, gear, rpm) => this.updateSpeedometerHUD(spd, gear, rpm),
                hideSpeedometer: () => this.hideVehicleHud(),
                isTouch: () => {
                    try {
                        return ('ontouchstart' in window) || ((navigator.maxTouchPoints || 0) > 0);
                    } catch (e) { return false; }
                },
            },

            // Vehicles Bridge
            vehicles: {
                spawn: (model, x, y, z, opts) => this.vehicleManager.spawn(model, x, y, z, opts),
                remove: (id) => this.vehicleManager.remove(id),
                get: (id) => this.vehicleManager.get(id),
                getAll: () => this.vehicleManager.getAll(),
                mount: (id) => {
                    const v = this.vehicleManager.vehicles.get(id);
                    if (v && this.game.player) this.game.player.mountVehicle(v);
                },
                dismount: () => {
                    if (this.game.player) this.game.player.dismountVehicle();
                },
                setSpeed: (id, spd) => {
                    const v = this.vehicleManager.vehicles.get(id);
                    if (v) v.speed = Number(spd) || 0;
                },
                setHeadlights: (id, state) => {
                    const v = this.vehicleManager.vehicles.get(id);
                    if (v) {
                        if (state === 'toggle') v.toggleHeadlights();
                        else {
                            v.headlightsOn = !!state;
                            if (v.spotLight) v.spotLight.intensity = v.headlightsOn ? 1.8 : 0;
                        }
                    }
                },
                honk: (id) => {
                    const v = this.vehicleManager.vehicles.get(id);
                    if (v) v.honk();
                    else this.soundSynth.horn();
                },
                clear: () => this.vehicleManager.clear()
            },

            // Console Bridge
            console: {
                open: () => this.toggleDevConsole(true),
                close: () => this.toggleDevConsole(false),
                toggle: () => this.toggleDevConsole(),
                log: (msg, level) => this.log(msg, level),
                clear: () => {
                    this.consoleLogs = [];
                    const out = document.getElementById('dev-console-logs');
                    if (out) out.innerHTML = '';
                },
                isOpen: () => {
                    const el = document.getElementById('game-dev-console');
                    return el ? el.style.display !== 'none' : false;
                }
            },

            // Storage Bridge (per mod key-value)
            storage: {
                get: (key, defVal) => {
                    try {
                        const v = localStorage.getItem('eblan_mod_' + key);
                        return v !== null ? JSON.parse(v) : defVal;
                    } catch (e) {
                        return defVal;
                    }
                },
                set: (key, val) => {
                    try {
                        localStorage.setItem('eblan_mod_' + key, JSON.stringify(val));
                    } catch (e) {}
                }
            },

            // Models Bridge (GLTF/GLB 3D)
            models: {
                load: (name, url, cb) => {
                    this.modelManager.load(String(name), String(url), () => {
                        if (cb) cb(true, String(name));
                    }, (err) => {
                        if (cb) cb(false, String(err));
                    });
                },
                spawn: (name, x, y, z, opts) => {
                    return this.modelManager.spawn(String(name), Number(x) || 0, Number(y) || 0, Number(z) || 0, opts || {});
                },
                remove: (id) => this.modelManager.remove(String(id)),
                clear: () => this.modelManager.clear(),
                setPos: (id, x, y, z) => this.modelManager.setPosition(String(id), x, y, z),
                setRot: (id, rx, ry, rz) => this.modelManager.setRotation(String(id), rx, ry, rz),
                setScale: (id, sx, sy, sz) => this.modelManager.setScale(String(id), sx, sy, sz),
                playAnim: (id, anim) => this.modelManager.playAnimation(String(id), anim),
                openPicker: (cb) => this.modelManager.importFromFile(cb),
                has: (name) => this.modelManager.cachedModels.has(String(name)),
                getAll: () => this.modelManager.getAll(),
                // Прицепить модель к камере (FPS вьюмодель: не плавает от боба/тряски/FOV)
                attachCamera: (id, x, y, z, rx, ry, rz) => {
                    const inst = this.modelManager.instances.get(String(id));
                    const cam = this.game.player && this.game.player.camera;
                    if (!inst || !cam) return false;
                    inst.group.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
                    inst.group.rotation.set(Number(rx) || 0, Number(ry) || 0, Number(rz) || 0);
                    cam.add(inst.group);
                    return true;
                }
            },

            // Prop Hunt Bridge
            prop: {
                disguise: (type, opts) => this.propHuntManager.disguise(type, opts || {}),
                undisguise: () => this.propHuntManager.undisguise(),
                isDisguised: () => this.propHuntManager.isDisguised(),
                getDisguise: () => this.propHuntManager.getDisguise(),
                lock: (val) => this.propHuntManager.lock(val),
                isLocked: () => this.propHuntManager.isLocked,
                taunt: (snd) => this.propHuntManager.taunt(snd || 'whistle'),
                blindHunters: (sec) => this.propHuntManager.setBlindness(true, Number(sec) || 30),
                unblind: () => this.propHuntManager.setBlindness(false),
                getEyeTrace: (maxDist) => this.propHuntManager.getEyeTrace(Number(maxDist) || 30)
            },

            // BlackRP / DarkRP Bridge
            rp: {
                getMoney: () => this.blackRPManager.getMoney(),
                setMoney: (val) => this.blackRPManager.setMoney(val),
                addMoney: (val) => this.blackRPManager.addMoney(val),
                takeMoney: (val) => this.blackRPManager.takeMoney(val),
                canAfford: (val) => this.blackRPManager.canAfford(val),
                registerJob: (id, opts) => this.blackRPManager.registerJob(String(id), opts || {}),
                setJob: (id) => this.blackRPManager.setJob(String(id)),
                getJob: () => {
                    const j = this.blackRPManager.getJob();
                    return j ? { id: j.id, name: j.name, salary: j.salary, color: j.color } : null;
                },
                addText3D: (id, text, x, y, z, opts) => this.blackRPManager.addText3D(String(id), String(text), x, y, z, opts || {}),
                updateText3D: (id, text) => this.blackRPManager.updateText3D(String(id), String(text)),
                removeText3D: (id) => this.blackRPManager.removeText3D(String(id)),
                clearText3D: () => this.blackRPManager.clearText3D(),
                setDoorOwner: (x, y, z, owner) => this.blackRPManager.setDoorOwner(x, y, z, owner),
                lockDoor: (x, y, z, val) => this.blackRPManager.lockDoor(x, y, z, val),
                isDoorLocked: (x, y, z) => this.blackRPManager.isDoorLocked(x, y, z),
                spawnEntity: (type, x, y, z, opts) => this.blackRPManager.spawnEntity(String(type), x, y, z, opts || {}),
                removeEntity: (id) => this.blackRPManager.removeEntity(String(id)),
                dropMoney: (amount, x, y, z) => this.blackRPManager.dropMoney(amount, x, y, z),
                arrest: (sec, x, y, z) => this.blackRPManager.arrest(sec, (x !== undefined && y !== undefined && z !== undefined) ? {x, y, z} : null),
                unarrest: () => this.blackRPManager.unarrest(),
                isArrested: () => this.blackRPManager.isArrestedState,
                setWanted: (val, reason) => this.blackRPManager.setWanted(val, reason),
                isWanted: () => this.blackRPManager.isWantedState
            },

            // Timer Bridge
            timer: {
                simple: (sec, fn) => this.timerManager.simple(sec, fn),
                create: (id, sec, reps, fn) => this.timerManager.create(id, sec, reps, fn),
                remove: (id) => this.timerManager.remove(id),
                exists: (id) => this.timerManager.exists(id),
                clear: () => this.timerManager.clear()
            },

            // Teams Bridge
            teams: {
                create: (id, opts) => this.teamsManager.create(id, opts || {}),
                set: (player, teamId) => this.teamsManager.set(player, teamId),
                get: (player) => this.teamsManager.get(player),
                getPlayers: (teamId) => this.teamsManager.getPlayers(teamId),
                setScore: (teamId, score) => this.teamsManager.setScore(teamId, score),
                getScore: (teamId) => this.teamsManager.getScore(teamId),
                clear: () => this.teamsManager.clear()
            },

            // Chat Commands & Say Bridge
            chat: {
                addCommand: (cmd, cb) => {
                    if (!cmd) return;
                    let str = String(cmd).trim();
                    if (!str.startsWith('/')) str = '/' + str;
                    const key = str.toLowerCase();
                    this.chatCommands.set(key, cb);
                },
                say: (msg, sender = "MOD") => {
                    if (this.game.multiplayer) {
                        this.game.multiplayer.addChatMessage(sender, String(msg), sender === "СИСТЕМА");
                        if (this.game.multiplayer.isConnected) {
                            this.game.multiplayer.broadcast({
                                type: 'chat',
                                sender: sender,
                                text: String(msg)
                            });
                        }
                    }
                }
            },

            // Net Networking Bridge (Full networking access, raw packets, hooks, filters)
            net: {
                send: (channel, payload) => {
                    if (this.game.multiplayer && this.game.multiplayer.isConnected) {
                        const jsPayload = this.luaToJs ? this.luaToJs(payload) : payload;
                        return this.game.multiplayer.broadcast({
                            type: 'mod_net',
                            channel: String(channel),
                            payload: jsPayload || {}
                        });
                    }
                    return false;
                },
                sendTo: (peerId, channel, payload) => {
                    if (this.game.multiplayer && this.game.multiplayer.isConnected) {
                        const jsPayload = this.luaToJs ? this.luaToJs(payload) : payload;
                        return this.game.multiplayer.sendToPeer(String(peerId), {
                            type: 'mod_net',
                            channel: String(channel),
                            payload: jsPayload || {}
                        });
                    }
                    return false;
                },
                receive: (channel, cb) => {
                    const ch = String(channel);
                    if (!this.netReceivers.has(ch)) this.netReceivers.set(ch, []);
                    this.netReceivers.get(ch).push(cb);
                    return true;
                },
                sendRaw: (packet, targetPeerId) => {
                    if (!this.game.multiplayer || !this.game.multiplayer.isConnected) return false;
                    const jsPacket = this.luaToJs ? this.luaToJs(packet) : packet;
                    if (!jsPacket || typeof jsPacket !== 'object') return false;
                    if (targetPeerId) {
                        return this.game.multiplayer.sendToPeer(String(targetPeerId), jsPacket);
                    } else {
                        return this.game.multiplayer.broadcast(jsPacket);
                    }
                },
                broadcastRaw: (packet) => {
                    if (!this.game.multiplayer || !this.game.multiplayer.isConnected) return false;
                    const jsPacket = this.luaToJs ? this.luaToJs(packet) : packet;
                    if (!jsPacket || typeof jsPacket !== 'object') return false;
                    return this.game.multiplayer.broadcast(jsPacket);
                },
                simulatePacket: (packet, senderPeerId) => {
                    if (!this.game.multiplayer) return false;
                    const jsPacket = this.luaToJs ? this.luaToJs(packet) : packet;
                    if (!jsPacket || typeof jsPacket !== 'object') return false;
                    this.game.multiplayer.handlePacket(jsPacket, senderPeerId || 'simulated');
                    return true;
                },
                hookSend: (typeOrFn, fn) => {
                    this.addPacketSendHook(typeOrFn, fn);
                    return true;
                },
                hookReceive: (typeOrFn, fn) => {
                    this.addPacketReceiveHook(typeOrFn, fn);
                    return true;
                },
                clearHooks: () => {
                    this.clearPacketHooks();
                    return true;
                },
                isConnected: () => {
                    return !!(this.game.multiplayer && this.game.multiplayer.isConnected);
                },
                isHost: () => {
                    return !!(this.game.multiplayer && this.game.multiplayer.isHost);
                },
                getPeerId: () => {
                    return (this.game.multiplayer && this.game.multiplayer.peer) ? this.game.multiplayer.peer.id : null;
                },
                getHostPeerId: () => {
                    return (this.game.multiplayer) ? (this.game.multiplayer.isHost ? this.game.multiplayer.peerId : (this.game.multiplayer.hostConnection ? this.game.multiplayer.hostConnection.peer : null)) : null;
                },
                getPeers: () => {
                    if (!this.game.multiplayer) return [];
                    const peers = [];
                    if (this.game.multiplayer.isHost) {
                        for (const [id, conn] of this.game.multiplayer.connections.entries()) {
                            peers.push({ id, name: this.game.multiplayer.remotePlayers.get(id)?.name || id, open: conn.open });
                        }
                    } else if (this.game.multiplayer.remotePlayers) {
                        for (const [id, remote] of this.game.multiplayer.remotePlayers.entries()) {
                            peers.push({ id, name: remote.name || id, open: true });
                        }
                    }
                    return peers;
                },
                getPlayers: () => {
                    if (!this.game.multiplayer) return [];
                    const players = [];
                    if (this.game.player) {
                        players.push({
                            peerId: this.game.multiplayer.peerId || 'local',
                            name: this.game.multiplayer.playerName || 'Player',
                            isLocal: true,
                            isHost: !!this.game.multiplayer.isHost,
                            health: this.game.player.health,
                            x: this.game.player.position.x,
                            y: this.game.player.position.y,
                            z: this.game.player.position.z
                        });
                    }
                    if (this.game.multiplayer.remotePlayers) {
                        for (const [id, remote] of this.game.multiplayer.remotePlayers.entries()) {
                            const pos = remote.group ? remote.group.position : { x: 0, y: 0, z: 0 };
                            players.push({
                                peerId: id,
                                name: remote.name || id,
                                isLocal: false,
                                isHost: id === this.game.multiplayer.hostPeerId,
                                health: remote.health || 100,
                                x: pos.x,
                                y: pos.y,
                                z: pos.z
                            });
                        }
                    }
                    return players;
                },
                disconnect: () => {
                    if (this.game.multiplayer) {
                        this.game.multiplayer.disconnect();
                        return true;
                    }
                    return false;
                },
                kick: (peerId, reason) => {
                    if (this.game.multiplayer && this.game.multiplayer.isHost) {
                        const conn = this.game.multiplayer.connections.get(peerId);
                        if (conn) {
                            try {
                                conn.send({ type: 'chat', sender: 'СИСТЕМА', text: `§cВас було кікнуто: ${reason || 'Без причини'}` });
                                conn.close();
                            } catch(e) {}
                            this.game.multiplayer.removeRemotePlayer(peerId);
                            return true;
                        }
                    }
                    return false;
                }
            }
        };

        interop.push(this.L, bridge);
        lua.lua_setglobal(this.L, to_luastring("__BRIDGE__"));

        // Lua Bootstrap script defining the API wrapper in Lua
        const bootstrap = `
local bridge = __BRIDGE__

-- Custom print redirecting to Mod Console
print = function(...)
    local t = {}
    for i = 1, select("#", ...) do
        t[i] = tostring(select(i, ...))
    end
    bridge:log("info", table.concat(t, " "))
end

-- Helper to normalize self vs normal args in Lua methods
local function norm(...)
    local args = {...}
    if #args > 0 and type(args[1]) == "table" and (
        args[1] == Player or args[1] == World or args[1] == Game or 
        args[1] == Mod or args[1] == Events or args[1] == Sound or 
        args[1] == UI or args[1] == Vehicles or args[1] == Console or
        args[1] == Models or args[1] == Prop or args[1] == Economy or
        args[1] == Jobs or args[1] == Doors or args[1] == Draw3D or
        args[1] == Entities or args[1] == Timer or args[1] == Teams or
        args[1] == Chat or args[1] == Net or args[1] == Items or
        args[1] == Weapons or args[1] == Mobs or args[1] == Bots or args[1] == Physics or
        args[1] == Blocks or args[1] == Regions or args[1] == Textures
    ) then
        table.remove(args, 1)
    end
    return table.unpack(args)
end

-- Mod Table
Mod = {
    _registered = {},
    register = function(...)
        local opts = norm(...)
        if type(opts) == "table" then
            Mod._registered = opts
            if opts.onEnable and type(opts.onEnable) == "function" then
                pcall(opts.onEnable)
            end
        end
    end,
    log = function(...) print(...) end,
    warn = function(...)
        local t = {}
        for i = 1, select("#", ...) do t[i] = tostring(select(i, ...)) end
        bridge:log("warn", table.concat(t, " "))
    end,
    error = function(...)
        local t = {}
        for i = 1, select("#", ...) do t[i] = tostring(select(i, ...)) end
        bridge:log("error", table.concat(t, " "))
    end,
    storage = {
        get = function(...)
            local k, def = norm(...)
            return bridge.storage:get(tostring(k), def)
        end,
        set = function(...)
            local k, v = norm(...)
            bridge.storage:set(tostring(k), v)
        end
    }
}

-- Events System
Events = {
    on = function(...)
        local name, fn = norm(...)
        bridge:addEventListener(tostring(name), fn)
        return fn
    end,
    listen = function(...) return Events.on(...) end,
    clear = function(...)
        local name = norm(...)
        bridge:clearEventListeners(name and tostring(name) or nil)
    end
}

-- Player API
Player = {
    isCreative = function() return bridge.player:isCreative() end,
    setCreative = function(...) return bridge.player:setCreative(norm(...)) end,
    isFlying = function() return bridge.player:isFlying() end,
    setFlying = function(...) return bridge.player:setFlying(norm(...)) end,
    getFlySpeed = function() return bridge.player:getFlySpeed() end,
    setFlySpeed = function(...) return bridge.player:setFlySpeed(norm(...)) end,
    isGodMode = function() return bridge.player:isGodMode() end,
    setGodMode = function(...) return bridge.player:setGodMode(norm(...)) end,
    isInstantBreak = function() return bridge.player:isInstantBreak() end,
    setInstantBreak = function(...) return bridge.player:setInstantBreak(norm(...)) end,
    isInfiniteBlocks = function() return bridge.player:isInfiniteBlocks() end,
    setInfiniteBlocks = function(...) return bridge.player:setInfiniteBlocks(norm(...)) end,
    getReach = function() return bridge.player:getReach() end,
    setReach = function(...) return bridge.player:setReach(norm(...)) end,
    getSpeed = function() return bridge.player:getSpeed() end,
    setSpeed = function(...) return bridge.player:setSpeed(norm(...)) end,

    getPosition = function()
        local p = bridge.player:getPosition()
        return { x = p.x, y = p.y, z = p.z }
    end,
    getPos = function()
        local p = bridge.player:getPosition()
        return p.x, p.y, p.z
    end,
    setPosition = function(...)
        local a1, a2, a3 = norm(...)
        if type(a1) == "table" and a1.x then
            bridge.player:setPosition(a1.x, a1.y, a1.z)
        else
            bridge.player:setPosition(a1, a2, a3)
        end
    end,
    setPos = function(...) return Player.setPosition(...) end,

    getVelocity = function()
        local v = bridge.player:getVelocity()
        return { x = v.x, y = v.y, z = v.z }
    end,
    getRotation = function()
        local r = bridge.player:getRotation()
        return r.yaw, r.pitch
    end,
    setVelocity = function(...)
        local a1, a2, a3 = norm(...)
        if type(a1) == "table" and a1.x then
            bridge.player:setVelocity(a1.x, a1.y, a1.z)
        else
            bridge.player:setVelocity(a1, a2, a3)
        end
    end,

    getHealth = function() return bridge.player:getHealth() end,
    setHealth = function(...) return bridge.player:setHealth(norm(...)) end,
    heal = function(...) return bridge.player:heal(norm(...)) end,
    damage = function(...)
        local amt, reason = norm(...)
        return bridge.player:damage(amt, reason)
    end,

    getHunger = function() return bridge.player:getHunger() end,
    setHunger = function(...) return bridge.player:setHunger(norm(...)) end,
    getIQ = function() return bridge.player:getIQ() end,
    setIQ = function(...) return bridge.player:setIQ(norm(...)) end,

    giveItem = function(...)
        local id, count = norm(...)
        return bridge.player:giveItem(id, count)
    end,
    removeItem = function(...)
        local id, count = norm(...)
        return bridge.player:removeItem(id, count)
    end,
    getItemCount = function(...) return bridge.player:getItemCount(norm(...)) end,
    clearInventory = function() return bridge.player:clearInventory() end,
    -- getHeldItem: пустая рука из JS приходит null-userdata (truthy!) — нормализуем в nil,
    -- иначе любой held.id падает с "can't access property id of null"
    getHeldItem = function()
        local ok, res = pcall(function()
            local h = bridge.player:getHeldItem()
            if h == nil then return nil end
            return { id = h.id, count = h.count }
        end)
        if not ok then return nil end
        return res
    end,
    -- Lua slots are 1-based; empty slots are nil (false in getInventory).
    getInventorySlot = function(...)
        local slot = norm(...)
        local ok, item = pcall(function()
            local h = bridge.player:getInventorySlot(slot)
            return { id = h.id, count = h.count }
        end)
        if ok then return item end
        return nil
    end,
    getInventory = function()
        local slots = {}
        for i = 1, 27 do slots[i] = Player.getInventorySlot(i) or false end
        return slots
    end,
    getSelectedSlot = function() return bridge.player:getSelectedSlot() end,
    selectSlot = function(...) return bridge.player:selectSlot(norm(...)) end,
    spawnSafe = function() return bridge.player:spawnSafe() end,
    detonateTNT = function() return bridge.player:detonateTNT() end,
    mount = function(...) return bridge.player:mount(norm(...)) end,
    dismount = function() return bridge.player:dismount() end,
    getVehicle = function() return bridge.player:getVehicle() end,
    isMounted = function() return bridge.player:isMounted() end,
    setFOV = function(...) return bridge.player:setFOV(norm(...)) end,
    getFOV = function() return bridge.player:getFOV() end,
    isMouseDown = function(...) return bridge.player:isMouseDown(norm(...)) end,
    isThirdPerson = function() return bridge.player:isThirdPerson() end,
    setHandVisible = function(...) return bridge.player:setHandVisible(norm(...)) end,
    shoot = function(...) return Weapons.shoot(...) end
}

-- World API
World = {
    getBlock = function(...)
        local x, y, z = norm(...)
        return bridge.world:getBlock(x, y, z)
    end,
    getBlockName = function(...)
        local x, y, z = norm(...)
        return bridge.world:getBlockName(x, y, z)
    end,
    setBlock = function(...)
        local x, y, z, bt = norm(...)
        return bridge.world:setBlock(x, y, z, bt)
    end,
    setBlocks = function(...)
        local x1, y1, z1, x2, y2, z2, bt = norm(...)
        return bridge.world:setBlocks(x1, y1, z1, x2, y2, z2, bt)
    end,
    getDimension = function() return bridge.world:getDimension() end,
    setDimension = function(...) return bridge.world:setDimension(norm(...)) end,
    getTime = function() return bridge.world:getTime() end,
    setTime = function(...) return bridge.world:setTime(norm(...)) end,
    spawnTNT = function(...)
        local x, y, z, vx, vy, vz = norm(...)
        return bridge.world:spawnTNT(x, y, z, vx, vy, vz)
    end,
    explode = function(...)
        local x, y, z, r, pwr = norm(...)
        return bridge.world:explode(x, y, z, r, pwr)
    end,
    registerBlock = function(...)
        local opts = norm(...)
        return bridge.world:registerBlock(opts)
    end,
    restoreBlock = function(...)
        local x, y, z = norm(...)
        return bridge.world:restoreBlock(x, y, z)
    end,
    revertBlock = function(...)
        local x, y, z = norm(...)
        return bridge.world:restoreBlock(x, y, z)
    end,
    getPreviousBlock = function(...)
        local x, y, z = norm(...)
        return bridge.world:getPreviousBlock(x, y, z)
    end,
    createSnapshot = function(...)
        local name, x1, y1, z1, x2, y2, z2 = norm(...)
        return bridge.world:createSnapshot(name, x1, y1, z1, x2, y2, z2)
    end,
    restoreSnapshot = function(...)
        local name = norm(...)
        return bridge.world:restoreSnapshot(name)
    end,
    saveRegion = function(...)
        local name, x1, y1, z1, x2, y2, z2 = norm(...)
        return bridge.world:saveRegion(name, x1, y1, z1, x2, y2, z2)
    end,
    restoreRegion = function(...)
        local name = norm(...)
        return bridge.world:restoreRegion(name)
    end,

    BLOCKS = {
        AIR = 0,
        GRASS = 1,
        DIRT = 2,
        STONE = 3,
        COBBLESTONE = 4,
        WOOD = 5,
        PLANKS = 6,
        LEAVES = 7,
        BRICKS = 8,
        GLASS = 9,
        SAND = 10,
        TNT = 11,
        DIAMOND_BLOCK = 12,
        GOLD_BLOCK = 13,
        EBLAN_BLOCK = 14,
        BEDROCK = 15,
        GLOWSTONE = 16,
        BOOKSHELF = 17,
        CRAFTING_TABLE = 18,
        WATER = 19,
        LAVA = 20,
        SPONGE = 21,
        MEME_CAT = 22,
        COAL_ORE = 23,
        IRON_ORE = 24,
        OBSIDIAN = 25,
        NETHERRACK = 26,
        SOUL_SAND = 27,
        NETHER_BRICKS = 28,
        NETHER_QUARTZ = 29,
        NETHERITE_BLOCK = 30,
        END_STONE = 31,
        DRAGON_EGG = 32,
        PORTAL_NETHER = 33,
        PORTAL_END = 34
    }
}

-- Blocks API (комплексное управление блоками, откат, кастомные блоки)
Blocks = {
    get = function(...)
        local x, y, z = norm(...)
        return bridge.blocks:get(x, y, z)
    end,
    getName = function(...)
        local x, y, z = norm(...)
        return bridge.blocks:getName(x, y, z)
    end,
    getInfo = function(...)
        local bt = norm(...)
        return bridge.blocks:getInfo(bt)
    end,
    set = function(...)
        local x, y, z, bt = norm(...)
        return bridge.blocks:set(x, y, z, bt)
    end,
    restore = function(...)
        local x, y, z = norm(...)
        return bridge.blocks:restore(x, y, z)
    end,
    revert = function(...)
        local x, y, z = norm(...)
        return bridge.blocks:restore(x, y, z)
    end,
    getPrevious = function(...)
        local x, y, z = norm(...)
        return bridge.blocks:getPrevious(x, y, z)
    end,
    breakBlock = function(...)
        local x, y, z, drop = norm(...)
        return bridge.blocks:breakBlock(x, y, z, drop)
    end,
    fill = function(...)
        local x1, y1, z1, x2, y2, z2, bt = norm(...)
        return bridge.blocks:fill(x1, y1, z1, x2, y2, z2, bt)
    end,
    isSolid = function(...)
        local bt = norm(...)
        return bridge.blocks:isSolid(bt)
    end,
    isTransparent = function(...)
        local bt = norm(...)
        return bridge.blocks:isTransparent(bt)
    end,
    createSnapshot = function(...)
        local name, x1, y1, z1, x2, y2, z2 = norm(...)
        return bridge.blocks:createSnapshot(name, x1, y1, z1, x2, y2, z2)
    end,
    restoreSnapshot = function(...)
        local name = norm(...)
        return bridge.blocks:restoreSnapshot(name)
    end,
    saveRegion = function(...)
        local name, x1, y1, z1, x2, y2, z2 = norm(...)
        return bridge.blocks:saveRegion(name, x1, y1, z1, x2, y2, z2)
    end,
    restoreRegion = function(...)
        local name = norm(...)
        return bridge.blocks:restoreRegion(name)
    end,
    register = function(...)
        local opts = norm(...)
        return bridge.blocks:register(opts)
    end,
    TYPES = World.BLOCKS
}

-- Regions API (приват, зоны защиты, откат)
Regions = {
    create = function(...)
        local opts = norm(...)
        return bridge.regions:create(opts)
    end,
    remove = function(...)
        local id = norm(...)
        return bridge.regions:remove(id)
    end,
    get = function(...)
        local x, y, z = norm(...)
        return bridge.regions:get(x, y, z)
    end,
    list = function()
        return bridge.regions:list()
    end,
    isAllowed = function(...)
        local act, x, y, z, p = norm(...)
        return bridge.regions:isAllowed(act, x, y, z, p)
    end,
    protect = function(id, x1, y1, z1, x2, y2, z2, owner, msg)
        return bridge.regions:create({
            id = id,
            min = { x = math.min(x1, x2), y = math.min(y1, y2), z = math.min(z1, z2) },
            max = { x = math.max(x1, x2), y = math.max(y1, y2), z = math.max(z1, z2) },
            owner = owner or "player",
            allowBreak = false,
            allowPlace = false,
            allowExplosion = false,
            allowInteract = false,
            message = msg or "§c[Регион] Эта территория защищена!"
        })
    end,
    saveBlocks = function(...)
        local name, x1, y1, z1, x2, y2, z2 = norm(...)
        return bridge.world:saveRegion(name, x1, y1, z1, x2, y2, z2)
    end,
    restoreBlocks = function(...)
        local name = norm(...)
        return bridge.world:restoreRegion(name)
    end
}

-- Textures API (кастомные текстуры, пиксель-арт, URL)
Textures = {
    register = function(...)
        local name, spec, opts = norm(...)
        return bridge.textures:register(name, spec, opts)
    end,
    override = function(...)
        local name, spec = norm(...)
        return bridge.textures:override(name, spec)
    end,
    get = function(...)
        local name = norm(...)
        return bridge.textures:get(name)
    end,
    exists = function(...)
        local name = norm(...)
        return bridge.textures:exists(name)
    end
}

-- Game API
Game = {
    toast = function(...) return bridge.game:toast(norm(...)) end,
    chat = function(...)
        local msg, sender = norm(...)
        return bridge.game:chat(msg, sender or "MOD")
    end,
    playSound = function(...) return bridge.game:playSound(norm(...)) end,
    speak = function(...) return bridge.game:speak(norm(...)) end,
    spawnParticles = function(...)
        local x, y, z, bt, count = norm(...)
        return bridge.game:spawnParticles(x, y, z, bt, count)
    end,
    executeCommand = function(...) return bridge.game:executeCommand(norm(...)) end,
    setGameMode = function(...) return bridge.game:setGameMode(norm(...)) end,
    getGameMode = function() return bridge.game:getGameMode() end
}

-- Items API
Items = {
    register = function(...)
        local opts = norm(...)
        return bridge.items:register(opts)
    end,
    get = function(...)
        local id = norm(...)
        return bridge.items:get(id)
    end,
    getAll = function()
        return bridge.items:getAll()
    end,
    ITEMS = {
        GRASS = "grass", DIRT = "dirt", STONE = "stone", COBBLESTONE = "cobblestone",
        WOOD = "wood", PLANKS = "planks", LEAVES = "leaves", BRICKS = "bricks",
        GLASS = "glass", SAND = "sand", TNT = "tnt", DIAMOND_BLOCK = "diamond_block",
        GOLD_BLOCK = "gold_block", EBLAN_BLOCK = "eblan_block", BEDROCK = "bedrock",
        GLOWSTONE = "glowstone", BOOKSHELF = "bookshelf", CRAFTING_TABLE = "crafting_table",
        WATER = "water", LAVA = "lava", SPONGE = "sponge", MEME_CAT = "meme_cat",
        COAL_ORE = "coal_ore", IRON_ORE = "iron_ore", OBSIDIAN = "obsidian",
        NETHERRACK = "netherrack", SOUL_SAND = "soul_sand", NETHER_BRICKS = "nether_bricks",
        NETHER_QUARTZ = "nether_quartz", NETHERITE_BLOCK = "netherite_block",
        END_STONE = "end_stone", DRAGON_EGG = "dragon_egg",
        WOOD_PICKAXE = "wood_pickaxe", STONE_PICKAXE = "stone_pickaxe",
        IRON_PICKAXE = "iron_pickaxe", DIAMOND_PICKAXE = "diamond_pickaxe",
        NETHERITE_PICKAXE = "netherite_pickaxe", EBLAN_PICKAXE = "eblan_pickaxe",
        WOOD_SWORD = "wood_sword", STONE_SWORD = "stone_sword",
        IRON_SWORD = "iron_sword", DIAMOND_SWORD = "diamond_sword",
        NETHERITE_SWORD = "netherite_sword", EBLAN_SWORD = "eblan_sword",
        STICK = "stick", COAL = "coal", IRON_INGOT = "iron_ingot",
        GOLD_INGOT = "gold_ingot", DIAMOND_ITEM = "diamond_item",
        APPLE = "apple", COOKED_STEAK = "cooked_steak", MEME_DONER = "meme_doner"
    }
}

-- Weapons & Combat API
Weapons = {
    shoot = function(...)
        local opts = norm(...)
        return bridge.weapons:shoot(opts or {})
    end
}

-- Programmable bots (temporary local entities, removed when changing worlds).
Bots = {
    spawn = function(...) return bridge.bots:spawn(norm(...)) end,
    exists = function(...) return bridge.bots:exists(norm(...)) end,
    getPosition = function(...)
        local p = bridge.bots:getPosition(norm(...))
        if not p then return nil end
        return { x = p.x, y = p.y, z = p.z }
    end,
    getHealth = function(...) return bridge.bots:getHealth(norm(...)) end,
    moveTo = function(...)
        local id, x, y, z = norm(...)
        return bridge.bots:command(id, "moveTo", x, y, z)
    end,
    followPlayer = function(...) return bridge.bots:command(norm(...), "followPlayer") end,
    stop = function(...) return bridge.bots:command(norm(...), "stop") end,
    jump = function(...) return bridge.bots:command(norm(...), "jump") end,
    remove = function(...) return bridge.bots:command(norm(...), "remove") end,
    setSpeed = function(...)
        local id, speed = norm(...)
        return bridge.bots:command(id, "setSpeed", speed)
    end,
    attack = function(...)
        local id, target = norm(...)
        return bridge.bots:command(id, "attack", target)
    end
}

-- Mobs API (поиск целей для турелей и модов)
Mobs = {    getNearby = function(...)
        local x, y, z, r = norm(...)
        local js = bridge.mobs:getNearby(x, y, z, r or 12)
        local t = {} -- JS-массив в обычную Lua-таблицу (ipairs по userdata не ходит)
        for i = 0, 64 do
            local m = js[i]
            if m == nil then break end
            t[#t + 1] = { id = m.id, type = m.type, x = m.x, y = m.y, z = m.z, dist = m.dist, hp = m.hp }
        end
        return t
    end,
    damage = function(...)
        local id, dmg, kx, kz = norm(...)
        return bridge.mobs:damage(id, dmg, kx, kz)
    end
}

-- Physics API (гравитация, прыжок, скорость — те же поля, что крутят слайдеры паузы)
Physics = {
    get = function()
        local p = bridge.player:getPhysics()
        return { gravity = p.gravity, jumpPower = p.jumpPower, walkSpeed = p.walkSpeed,
                 sprintSpeed = p.sprintSpeed, jumpCooldown = p.jumpCooldown,
                 noFallDamage = p.noFallDamage, onGround = p.onGround }
    end,
    set = function(field, val)
        if type(field) == "table" then return false end -- таблицы не доезжают до JS, только пары
        return bridge.player:setPhysicsField(tostring(field), val)
    end,
    reset = function() return bridge.player:resetPhysics() end
}

-- Sound API
Sound = {
    play = function(...) return bridge.sound:play(norm(...)) end,
    tone = function(...) return bridge.sound:tone(norm(...)) end,
    beep = function(...) return bridge.sound:beep(norm(...)) end,
    horn = function(...) return bridge.sound:horn(norm(...)) end,
    engine = function(...) return bridge.sound:engine(norm(...)) end,
    stopEngine = function() return bridge.sound:stopEngine() end,
    screech = function(...) return bridge.sound:screech(norm(...)) end,
    gunshot = function(...) return bridge.sound:gunshot(norm(...)) end,
    reload = function(...) return bridge.sound:reload(norm(...)) end,
    dryFire = function() return bridge.sound:dryFire() end
}

-- UI API
UI = {
    createPanel = function(...) return bridge.ui:createPanel(norm(...)) end,
    createButton = function(...)
        local opts, cb = norm(...)
        return bridge.ui:createButton(opts, cb)
    end,
    createLabel = function(...) return bridge.ui:createLabel(norm(...)) end,
    setText = function(...)
        local id, text = norm(...)
        return bridge.ui:setText(id, text)
    end,
    setStyle = function(...)
        local id, prop, val = norm(...)
        return bridge.ui:setStyle(id, prop, val)
    end,
    show = function(...) return bridge.ui:show(norm(...)) end,
    hide = function(...) return bridge.ui:hide(norm(...)) end,
    remove = function(...) return bridge.ui:remove(norm(...)) end,
    clear = function() return bridge.ui:clear() end,
    showSpeedometer = function(...) return bridge.ui:showSpeedometer(norm(...)) end,
    updateSpeedometer = function(...)
        local spd, gear, rpm = norm(...)
        return bridge.ui:updateSpeedometer(spd, gear, rpm)
    end,
    hideSpeedometer = function() return bridge.ui:hideSpeedometer() end
}

-- Vehicles API
Vehicles = {
    spawn = function(...)
        local model, x, y, z, opts = norm(...)
        return bridge.vehicles:spawn(model, x, y, z, opts)
    end,
    remove = function(...) return bridge.vehicles:remove(norm(...)) end,
    get = function(...) return bridge.vehicles:get(norm(...)) end,
    getAll = function() return bridge.vehicles:getAll() end,
    mount = function(...) return bridge.vehicles:mount(norm(...)) end,
    dismount = function() return bridge.vehicles:dismount() end,
    setSpeed = function(...)
        local id, spd = norm(...)
        return bridge.vehicles:setSpeed(id, spd)
    end,
    setHeadlights = function(...)
        local id, state = norm(...)
        return bridge.vehicles:setHeadlights(id, state)
    end,
    honk = function(...) return bridge.vehicles:honk(norm(...)) end,
    clear = function() return bridge.vehicles:clear() end
}

-- Console API
Console = {
    open = function() return bridge.console:open() end,
    close = function() return bridge.console:close() end,
    toggle = function() return bridge.console:toggle() end,
    log = function(...)
        local t = {}
        for i = 1, select("#", ...) do t[i] = tostring(select(i, ...)) end
        bridge.console:log(table.concat(t, " "), "info")
    end,
    warn = function(...)
        local t = {}
        for i = 1, select("#", ...) do t[i] = tostring(select(i, ...)) end
        bridge.console:log(table.concat(t, " "), "warn")
    end,
    error = function(...)
        local t = {}
        for i = 1, select("#", ...) do t[i] = tostring(select(i, ...)) end
        bridge.console:log(table.concat(t, " "), "error")
    end,
    clear = function() return bridge.console:clear() end,
    isOpen = function() return bridge.console:isOpen() end
}

-- Models API (GLTF / GLB 3D)
Models = {
    load = function(...)
        local name, url, cb = norm(...)
        return bridge.models:load(tostring(name), tostring(url), cb)
    end,
    spawn = function(...)
        local name, x, y, z, opts = norm(...)
        return bridge.models:spawn(tostring(name), x, y, z, opts or {})
    end,
    remove = function(...) return bridge.models:remove(norm(...)) end,
    clear = function() return bridge.models:clear() end,
    setPos = function(...)
        local id, x, y, z = norm(...)
        return bridge.models:setPos(id, x, y, z)
    end,
    setRot = function(...)
        local id, rx, ry, rz = norm(...)
        return bridge.models:setRot(id, rx, ry, rz)
    end,
    setScale = function(...)
        local id, sx, sy, sz = norm(...)
        return bridge.models:setScale(id, sx, sy, sz)
    end,
    playAnim = function(...)
        local id, anim = norm(...)
        return bridge.models:playAnim(id, anim)
    end,
    openPicker = function(...)
        local cb = norm(...)
        return bridge.models:openPicker(cb)
    end,
    attachCamera = function(...)
        local id, x, y, z, rx, ry, rz = norm(...)
        return bridge.models:attachCamera(id, x, y, z, rx, ry, rz)
    end,
    has = function(...) return bridge.models:has(norm(...)) end,
    getAll = function() return bridge.models:getAll() end
}

-- Prop Hunt API
Prop = {
    disguise = function(...)
        local typeOrId, opts = norm(...)
        return bridge.prop:disguise(typeOrId, opts or {})
    end,
    undisguise = function() return bridge.prop:undisguise() end,
    isDisguised = function() return bridge.prop:isDisguised() end,
    getDisguise = function() return bridge.prop:getDisguise() end,
    lock = function(...) return bridge.prop:lock(norm(...)) end,
    isLocked = function() return bridge.prop:isLocked() end,
    taunt = function(...)
        local snd = norm(...)
        return bridge.prop:taunt(snd or "whistle")
    end,
    blindHunters = function(...)
        local sec = norm(...)
        return bridge.prop:blindHunters(sec or 30)
    end,
    unblind = function() return bridge.prop:unblind() end,
    getEyeTrace = function(...)
        local dist = norm(...)
        return bridge.prop:getEyeTrace(dist or 30)
    end
}

-- BlackRP / DarkRP Economy & Jobs API
Economy = {
    get = function() return bridge.rp:getMoney() end,
    set = function(...) return bridge.rp:setMoney(norm(...)) end,
    add = function(...) return bridge.rp:addMoney(norm(...)) end,
    take = function(...) return bridge.rp:takeMoney(norm(...)) end,
    canAfford = function(...) return bridge.rp:canAfford(norm(...)) end,
    drop = function(...)
        local amount, x, y, z = norm(...)
        return bridge.rp:dropMoney(amount, x, y, z)
    end
}

Jobs = {
    register = function(...)
        local id, data = norm(...)
        return bridge.rp:registerJob(id, data)
    end,
    set = function(...) return bridge.rp:setJob(norm(...)) end,
    get = function() return bridge.rp:getJob() end
}

Doors = {
    setOwner = function(...)
        local x, y, z, owner = norm(...)
        return bridge.rp:setDoorOwner(x, y, z, owner)
    end,
    lock = function(...)
        local x, y, z, val = norm(...)
        return bridge.rp:lockDoor(x, y, z, val ~= false)
    end,
    unlock = function(...)
        local x, y, z = norm(...)
        return bridge.rp:lockDoor(x, y, z, false)
    end,
    isLocked = function(...)
        local x, y, z = norm(...)
        return bridge.rp:isDoorLocked(x, y, z)
    end
}

Draw3D = {
    addText = function(...)
        local id, text, x, y, z, opts = norm(...)
        return bridge.rp:addText3D(id, text, x, y, z, opts or {})
    end,
    updateText = function(...)
        local id, text = norm(...)
        return bridge.rp:updateText3D(id, text)
    end,
    removeText = function(...) return bridge.rp:removeText3D(norm(...)) end,
    clear = function() return bridge.rp:clearText3D() end
}

Entities = {
    spawn = function(...)
        local type, x, y, z, opts = norm(...)
        return bridge.rp:spawnEntity(type, x, y, z, opts or {})
    end,
    remove = function(...) return bridge.rp:removeEntity(norm(...)) end,
    spawnPrinter = function(...)
        local x, y, z, opts = norm(...)
        return bridge.rp:spawnEntity("money_printer", x, y, z, opts or {})
    end,
    dropMoney = function(...)
        local amount, x, y, z = norm(...)
        return bridge.rp:dropMoney(amount, x, y, z)
    end
}

-- Timer API
Timer = {
    simple = function(...)
        local delay, fn = norm(...)
        local wrapper = function(self, ...)
            return fn(...)
        end
        return bridge.timer:simple(delay, wrapper)
    end,
    create = function(...)
        local id, interval, reps, fn = norm(...)
        local wrapper = function(self, ...)
            return fn(...)
        end
        return bridge.timer:create(id, interval, reps, wrapper)
    end,
    remove = function(...) return bridge.timer:remove(norm(...)) end,
    exists = function(...) return bridge.timer:exists(norm(...)) end,
    clear = function() return bridge.timer:clear() end
}

-- Teams API
Teams = {
    create = function(...)
        local id, opts = norm(...)
        return bridge.teams:create(id, opts or {})
    end,
    set = function(...)
        local player, teamId = norm(...)
        return bridge.teams:set(player, teamId)
    end,
    get = function(...) return bridge.teams:get(norm(...)) end,
    getPlayers = function(...) return bridge.teams:getPlayers(norm(...)) end,
    setScore = function(...)
        local teamId, score = norm(...)
        return bridge.teams:setScore(teamId, score)
    end,
    getScore = function(...) return bridge.teams:getScore(norm(...)) end,
    clear = function() return bridge.teams:clear() end
}

-- Chat & Commands API
Chat = {
    addCommand = function(...)
        local cmd, cb = norm(...)
        local wrapper = function(self, ...)
            return cb(...)
        end
        return bridge.chat:addCommand(cmd, wrapper)
    end,
    say = function(...)
        local text, sender = norm(...)
        return bridge.chat:say(text, sender or "MOD")
    end
}

-- Multiplayer Net API (повний доступ до мережевих пакетів, хуки, фільтрація, скасування)
Net = {
    send = function(...)
        local ch, payload = norm(...)
        return bridge.net:send(ch, payload or {})
    end,
    sendTo = function(...)
        local peerId, ch, payload = norm(...)
        return bridge.net:sendTo(peerId, ch, payload or {})
    end,
    receive = function(...)
        local ch, cb = norm(...)
        local wrapper = function(self, ...)
            return cb(...)
        end
        return bridge.net:receive(ch, wrapper)
    end,
    sendRaw = function(...)
        local packet, peerId = norm(...)
        return bridge.net:sendRaw(packet, peerId)
    end,
    broadcastRaw = function(...)
        local packet = norm(...)
        return bridge.net:broadcastRaw(packet)
    end,
    simulatePacket = function(...)
        local packet, sender = norm(...)
        return bridge.net:simulatePacket(packet, sender)
    end,
    hookSend = function(...)
        local a1, a2 = norm(...)
        if type(a1) == "function" then
            return bridge.net:hookSend(a1)
        else
            return bridge.net:hookSend(a1, a2)
        end
    end,
    hookReceive = function(...)
        local a1, a2 = norm(...)
        if type(a1) == "function" then
            return bridge.net:hookReceive(a1)
        else
            return bridge.net:hookReceive(a1, a2)
        end
    end,
    clearHooks = function()
        return bridge.net:clearHooks()
    end,
    isConnected = function()
        return bridge.net:isConnected()
    end,
    isHost = function()
        return bridge.net:isHost()
    end,
    getPeerId = function()
        return bridge.net:getPeerId()
    end,
    getHostPeerId = function()
        return bridge.net:getHostPeerId()
    end,
    getPeers = function()
        local js = bridge.net:getPeers()
        local t = {}
        for i = 0, 128 do
            local p = js[i]
            if p == nil then break end
            t[#t + 1] = { id = p.id, name = p.name, open = p.open }
        end
        return t
    end,
    getPlayers = function()
        local js = bridge.net:getPlayers()
        local t = {}
        for i = 0, 128 do
            local p = js[i]
            if p == nil then break end
            t[#t + 1] = {
                peerId = p.peerId,
                name = p.name,
                isLocal = p.isLocal,
                isHost = p.isHost,
                health = p.health,
                x = p.x, y = p.y, z = p.z
            }
        end
        return t
    end,
    disconnect = function()
        return bridge.net:disconnect()
    end,
    kick = function(...)
        local peerId, reason = norm(...)
        return bridge.net:kick(peerId, reason or "Kicked by admin")
    end,
    cancel = function()
        return false
    end,
    drop = function()
        return false
    end,
    PACKETS = {
        PVP_HIT = "pvp_hit",
        BLOCK_PLACE = "block_place",
        BLOCK_BREAK = "block_break",
        TNT_EXPLODE = "tnt_explode",
        CHAT = "chat",
        PLAYER_STATE = "player_state",
        SKIN_CHANGE = "skin_change",
        PLAYER_LEAVE = "player_leave",
        WORLD_INIT = "world_init",
        MOD_NET = "mod_net"
    }
}

-- Player Extension Aliases
Player.disguise = function(...) return Prop.disguise(...) end
Player.undisguise = function() return Prop.undisguise() end
Player.isDisguised = function() return Prop.isDisguised() end
Player.getDisguise = function() return Prop.getDisguise() end
Player.lockProp = function(...) return Prop.lock(...) end
Player.isPropLocked = function() return Prop.isLocked() end
Player.taunt = function(...) return Prop.taunt(...) end
Player.getEyeTrace = function(...) return Prop.getEyeTrace(...) end
Player.getMoney = function() return bridge.rp:getMoney() end
Player.setMoney = function(...) return bridge.rp:setMoney(norm(...)) end
Player.addMoney = function(...) return bridge.rp:addMoney(norm(...)) end
Player.takeMoney = function(...) return bridge.rp:takeMoney(norm(...)) end
Player.canAfford = function(...) return bridge.rp:canAfford(norm(...)) end
Player.setJob = function(...) return bridge.rp:setJob(norm(...)) end
Player.getJob = function() return bridge.rp:getJob() end
Player.arrest = function(...)
    local sec, x, y, z = norm(...)
    return bridge.rp:arrest(sec or 60, x, y, z)
end
Player.unarrest = function() return bridge.rp:unarrest() end
Player.isArrested = function() return bridge.rp:isArrested() end
Player.setWanted = function(...)
    local val, reason = norm(...)
    return bridge.rp:setWanted(val, reason or "Порушення закону")
end
Player.isWanted = function() return bridge.rp:isWanted() end
`

        const res = lauxlib.luaL_dostring(this.L, to_luastring(bootstrap));
        if (res !== lua.LUA_OK) {
            const err = to_jsstring(lua.lua_tostring(this.L, -1));
            lua.lua_pop(this.L, 1);
            console.error("Lua Bootstrap failed:", err);
            this.log("Помилка ініціалізації Lua: " + err, "error");
        } else {
            this.syncBlocksToLua();
            this.log("🟢 Мод-система Lua 5.3 готова до роботи!", "system");
        }
    }

    syncBlocksToLua() {
        if (!this.L || !this.blockRegistry) return;
        const { to_luastring } = this.fengari;
        let code = "if World and World.BLOCKS then\n";
        for (const [id, info] of this.blockRegistry.registeredBlocks.entries()) {
            code += `World.BLOCKS["${info.upperKey}"] = ${id}\n`;
        }
        code += "end\n";
        code += "if Blocks and Blocks.TYPES then\n";
        for (const [id, info] of this.blockRegistry.registeredBlocks.entries()) {
            code += `Blocks.TYPES["${info.upperKey}"] = ${id}\n`;
        }
        code += "end\n";
        this.fengari.lauxlib.luaL_dostring(this.L, to_luastring(code));
    }

    // --- EVENT SYSTEM ---
    addEventListener(eventName, fn) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(fn);
    }

    removeEventListener(eventName, fn) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName] = this.eventListeners[eventName].filter(f => f !== fn);
        }
    }

    clearEventListeners(eventName = null) {
        if (eventName) {
            this.eventListeners[eventName] = [];
        } else {
            this.eventListeners = {};
        }
    }

    triggerEvent(eventName, ...args) {
        const listeners = this.eventListeners[eventName];
        if (!listeners || listeners.length === 0) return true;

        let result = true;
        for (let i = 0; i < listeners.length; i++) {
            const fn = listeners[i];
            try {
                const res = (typeof this.callLua === "function") ? this.callLua(fn, ...args) : fn.apply(null, args);
                if (res === false) {
                    result = false;
                }
            } catch (err) {
                console.error(`Error in Lua event [${eventName}]:`, err);
                this.log(`Помилка в події [${eventName}]: ${err.message || err}`, "error");
            }
        }
        return result;
    }

    // --- LOGGING & CONSOLE ---
    log(msg, level = "info") {
        const time = new Date().toLocaleTimeString();
        const entry = { time, level, text: String(msg) };
        this.consoleLogs.push(entry);
        if (this.consoleLogs.length > this.maxLogs) {
            this.consoleLogs.shift();
        }

        const consoleOutput = document.getElementById("lua-console-output");
        if (consoleOutput) {
            const row = document.createElement("div");
            row.className = `lua-log-row log-${level}`;
            row.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-text">${this.escapeHtml(msg)}</span>`;
            consoleOutput.appendChild(row);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }

        const devLogs = document.getElementById("dev-console-logs");
        if (devLogs) {
            const row = document.createElement("div");
            row.className = `dev-log-row log-${level}`;
            row.innerHTML = `<span class="dev-log-time">[${time}]</span> <span class="dev-log-text">${this.escapeHtml(msg)}</span>`;
            devLogs.appendChild(row);
            devLogs.scrollTop = devLogs.scrollHeight;
        }

        if (level === "error") {
            console.error("[LUA]", msg);
        } else if (level === "warn") {
            console.warn("[LUA]", msg);
        } else {
            console.log("[LUA]", msg);
        }
    }

    escapeHtml(str) {
        return (str || "").replace(/[&<>"']/g, m => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '&quot;',
            "'": "&#039;"
        }[m]));
    }

    // --- LUA EXECUTION ---
    runLua(code, sourceName = "Script") {
        if (!this.L) throw new Error("Lua runtime не ініціалізовано!");
        const { lua, lauxlib, to_luastring, to_jsstring } = this.fengari;

        this.log(`▶ Запуск [${sourceName}]...`, "system");
        const top = lua.lua_gettop(this.L);
        try {
            // Named chunks give errors the mod/console source instead of [string].
            let status = lauxlib.luaL_loadbuffer(this.L, to_luastring(code), null, to_luastring(String(sourceName)));
            if (status === lua.LUA_OK) status = lua.lua_pcall(this.L, 0, 0, 0);
            if (status !== lua.LUA_OK) {
                const errMsg = lua.lua_tojsstring(this.L, -1) || "Unknown Lua error";
                this.log(`❌ Помилка в [${sourceName}]: ${errMsg}`, "error");
                throw new Error(errMsg);
            }
            this.log(`✔ [${sourceName}] виконано успішно!`, "success");
            return true;
        } finally {
            // Scripts may return any number of values or fail; neither leaks stack entries.
            lua.lua_settop(this.L, top);
        }
    }

    // --- MODS STORAGE & LIFECYCLE ---
    loadSavedMods() {
        const saved = localStorage.getItem("eblankraft_lua_mods");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Remove legacy starter hardcoded mods as strictly instructed by user
                this.mods = parsed.filter(m => m.id !== 'creative_mode' && m.id !== 'builder_wand' && m.id !== 'super_tnt');
            } catch (e) {
                this.mods = [];
            }
        } else {
            this.mods = [];
        }

        this.saveMods();
        this.reinitAllMods();
    }

    saveMods() {
        try {
            localStorage.setItem("eblankraft_lua_mods", JSON.stringify(this.mods));
        } catch (e) {}
    }

    getDefaultMods() {
        // Zero hardcoded starter mods
        return [];
    }

    reinitAllMods() {
        this.game.mobManager?.clearBots();
        this.clearEventListeners();
        if (this.chatCommands) this.chatCommands.clear();
        if (this.netReceivers) this.netReceivers.clear();
        if (this.clearPacketHooks) this.clearPacketHooks();
        if (this.blockRegistry) this.blockRegistry.clear();
        if (this.regionManager) this.regionManager.clear();
        if (this.itemRegistry) this.itemRegistry.clear();
        if (this.weaponManager) this.weaponManager.clear();
        if (this.vehicleManager) this.vehicleManager.clear();
        if (this.customUI) this.customUI.clear();
        if (this.modelManager) this.modelManager.clear();
        if (this.propHuntManager) this.propHuntManager.reset();
        if (this.blackRPManager) this.blackRPManager.reset();
        if (this.timerManager) this.timerManager.clear();
        if (this.teamsManager) this.teamsManager.clear();
        this.initLua();

        for (const mod of this.mods) {
            if (mod.enabled) {
                try {
                    this.runLua(mod.code, mod.name);
                } catch (e) {
                    console.warn(`Failed to run mod ${mod.name}:`, e);
                }
            }
        }
        this.updateCreativeBadge();
        this.updateFlyTouchVisibility();
        // Реинит чистит кеш моделей — докачиваем модели из сохранённых .eblan паков
        if (window.Eblan && window.Eblan.reapplyModels) {
            try { window.Eblan.reapplyModels(); } catch (e) {}
        }
    }

    toggleMod(id, forceState = null) {
        const mod = this.mods.find(m => m.id === id);
        if (!mod) return;

        mod.enabled = forceState !== null ? forceState : !mod.enabled;
        this.saveMods();
        this.reinitAllMods();
        this.renderModsList();
        this.log(`Мод [${mod.name}] ${mod.enabled ? "🟢 УВІМКНЕНО" : "🔴 ВИМКНЕНО"}`, "system");
    }

    addOrUpdateMod(modObj) {
        const existingIdx = this.mods.findIndex(m => m.id === modObj.id);
        if (existingIdx >= 0) {
            this.mods[existingIdx] = modObj;
        } else {
            this.mods.push(modObj);
        }
        this.saveMods();
        this.reinitAllMods();
        this.renderModsList();
        this.log(`💾 Мод [${modObj.name}] збережено!`, "success");
    }

    deleteMod(id) {
        this.mods = this.mods.filter(m => m.id !== id);
        this.saveMods();
        this.reinitAllMods();
        this.renderModsList();
        this.log(`🗑️ Мод видалено.`, "warn");
    }

    update(dt) {
        if (this.vehicleManager) {
            this.vehicleManager.update(dt);
        }
        if (this.modelManager) {
            this.modelManager.update(dt);
        }
        if (this.propHuntManager) {
            this.propHuntManager.update(dt);
        }
        if (this.blackRPManager) {
            this.blackRPManager.update(dt);
        }
        if (this.timerManager) {
            this.timerManager.update();
        }
        this.triggerEvent("onTick", dt);
    }

    handleChatCommand(fullCmd) {
        if (!fullCmd || typeof fullCmd !== 'string') return false;
        const clean = fullCmd.trim();
        if (!clean.startsWith('/')) return false;
        const cleanLower = clean.toLowerCase();

        // 1. Exact match
        if (this.chatCommands.has(cleanLower)) {
            const cb = this.chatCommands.get(cleanLower);
            try {
                if (typeof cb === 'function') {
                    cb('', []);
                }
                return true;
            } catch (err) {
                console.error(`Error in chat command [${cleanLower}]:`, err);
                this.log(`Помилка команди [${cleanLower}]: ${err.message || err}`, "error");
                return true;
            }
        }

        // 2. Prefix matching for commands with arguments (e.g. /join hunters, /prop tnt, /job police)
        const sortedCmds = Array.from(this.chatCommands.keys()).sort((a, b) => b.length - a.length);
        for (const registeredCmd of sortedCmds) {
            if (cleanLower.startsWith(registeredCmd + ' ') || cleanLower === registeredCmd) {
                const cb = this.chatCommands.get(registeredCmd);
                const rawArgs = clean.slice(registeredCmd.length).trim();
                const argsList = rawArgs.split(/\s+/).filter(Boolean);
                try {
                    if (typeof cb === 'function') {
                        cb(rawArgs, argsList);
                    }
                    return true;
                } catch (err) {
                    console.error(`Error in chat command [${registeredCmd}]:`, err);
                    this.log(`Помилка команди [${registeredCmd}]: ${err.message || err}`, "error");
                    return true;
                }
            }
        }

        return false;
    }

    handleNetPacket(channel, payload, senderPeerId) {
        if (!channel) return;
        const ch = String(channel);

        // Built-in PropHunt synchronization
        if (ch === 'prop_disguise' && this.propHuntManager) {
            this.propHuntManager.handleRemoteDisguise(senderPeerId, payload.disguise || payload);
        } else if (ch === 'prop_undisguise' && this.propHuntManager) {
            this.propHuntManager.handleRemoteUndisguise(senderPeerId);
        } else if (ch === 'prop_taunt' && this.propHuntManager) {
            this.propHuntManager.handleRemoteTaunt(payload.sound || 'whistle', payload.x || 0, payload.y || 0, payload.z || 0);
        }

        // Custom Lua net receivers
        if (this.netReceivers.has(ch)) {
            const list = this.netReceivers.get(ch);
            for (const fn of list) {
                try {
                    fn(payload, senderPeerId);
                } catch (e) {
                    console.error(`Net receiver error on channel [${ch}]:`, e);
                }
            }
        }

        this.triggerEvent("onNetMessage", ch, payload, senderPeerId);
    }

    // --- TOUCH FLY CONTROLS ---
    initTouchFlyControls() {
        const container = document.getElementById("touch-fly-controls");
        if (!container) return;

        const btnFlyToggle = document.getElementById("btn-touch-fly-toggle");
        const btnFlyUp = document.getElementById("btn-touch-fly-up");
        const btnFlyDown = document.getElementById("btn-touch-fly-down");

        if (btnFlyToggle) {
            btnFlyToggle.addEventListener("touchstart", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.game.player) {
                    this.game.player.isFlying = !this.game.player.isFlying;
                    btnFlyToggle.classList.toggle("active", this.game.player.isFlying);
                    this.updateFlyTouchVisibility();
                    if (this.game.ui) this.game.ui.showToast(this.game.player.isFlying ? "🕊️ Політ: УВІМКНЕНО" : "🕊️ Політ: ВИМКНЕНО");
                    this.triggerEvent("onFlyToggle", this.game.player.isFlying);
                }
            }, { passive: false });
        }

        const setupHoldBtn = (btn, isUp) => {
            if (!btn) return;
            const start = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.game.controls) {
                    if (isUp) this.game.controls.touchFlyUp = true;
                    else this.game.controls.touchFlyDown = true;
                }
                btn.classList.add("active");
            };
            const stop = (e) => {
                e.preventDefault();
                if (this.game.controls) {
                    if (isUp) this.game.controls.touchFlyUp = false;
                    else this.game.controls.touchFlyDown = false;
                }
                btn.classList.remove("active");
            };
            btn.addEventListener("touchstart", start, { passive: false });
            btn.addEventListener("touchend", stop);
            btn.addEventListener("touchcancel", stop);
            btn.addEventListener("mousedown", start);
            btn.addEventListener("mouseup", stop);
            btn.addEventListener("mouseleave", stop);
        };

        setupHoldBtn(btnFlyUp, true);
        setupHoldBtn(btnFlyDown, false);
    }

    updateFlyTouchVisibility() {
        const container = document.getElementById("touch-fly-controls");
        if (!container) return;

        const isCreativeOrFlying = this.game.player && (this.game.player.isCreative || this.game.player.isFlying || this.game.player.canFly);
        container.style.display = isCreativeOrFlying ? "flex" : "none";

        const btnFlyToggle = document.getElementById("btn-touch-fly-toggle");
        if (btnFlyToggle && this.game.player) {
            btnFlyToggle.classList.toggle("active", !!this.game.player.isFlying);
        }
    }

    updateCreativeBadge() {
        let badge = document.getElementById("hud-creative-badge");
        const isCreative = this.game.player && this.game.player.isCreative;

        if (isCreative) {
            if (!badge) {
                const subRow = document.querySelector("#hud-stats-group .hud-sub-row");
                if (subRow) {
                    badge = document.createElement("div");
                    badge.id = "hud-creative-badge";
                    badge.className = "hud-badge badge-creative";
                    badge.textContent = "✨ КРЕАТИВ";
                    subRow.prepend(badge);
                }
            } else {
                badge.style.display = "inline-block";
            }
        } else if (badge) {
            badge.style.display = "none";
        }
    }

    // --- MODAL UI & TABS ---
    initUI() {
        const topBtns = document.getElementById("top-buttons");
        const btnMods = document.getElementById("btn-mods-manager");
        if (btnMods) {
            const openModal = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                this.toggleModal(true);
            };
            btnMods.onclick = openModal;
            btnMods.ontouchend = openModal;
        } else if (topBtns) {
            const btn = document.createElement("button");
            btn.id = "btn-mods-manager";
            btn.className = "top-btn btn-mods-top";
            btn.title = "Моди (Lua Script API)";
            btn.innerHTML = '<span class="top-btn-icon">📜</span><span class="top-btn-text"> Моди</span>';
            const openModal = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                this.toggleModal(true);
            };
            btn.onclick = openModal;
            btn.ontouchend = openModal;
            topBtns.prepend(btn);
        }

        const extraActions = document.querySelector(".menu-extra-actions");
        let btnPauseMods = document.getElementById("btn-pause-mods");
        if (!btnPauseMods && extraActions) {
            btnPauseMods = document.createElement("button");
            btnPauseMods.id = "btn-pause-mods";
            btnPauseMods.className = "menu-btn";
            btnPauseMods.style.cssText = "width:100%; margin-bottom: 6px; font-weight: bold; background: linear-gradient(135deg, #2e7d32, #1565c0); border: 2px solid #00e676;";
            btnPauseMods.innerHTML = "🧩 Моди (Lua Script API)";
            extraActions.prepend(btnPauseMods);
        }
        if (btnPauseMods) {
            const handlePauseMods = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                if (this.game.ui) this.game.ui.togglePauseMenu(false);
                this.toggleModal(true);
            };
            btnPauseMods.onclick = handlePauseMods;
            btnPauseMods.ontouchend = handlePauseMods;
        }

        const closeBtn = document.getElementById("mods-modal-close");
        if (closeBtn) {
            const handleClose = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                this.toggleModal(false);
            };
            closeBtn.onclick = handleClose;
            closeBtn.ontouchend = handleClose;
        }

        const tabs = document.querySelectorAll(".mods-tab-btn");
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                const target = tab.dataset.tab;
                document.querySelectorAll(".mods-tab-content").forEach(c => {
                    c.style.display = (c.id === `mods-tab-${target}`) ? "block" : "none";
                });
                if (target === "list") this.renderModsList();
            };
        });

        const btnConsoleExec = document.getElementById("btn-lua-exec");
        const inputConsole = document.getElementById("lua-console-input");
        const runConsoleInput = () => {
            if (!inputConsole) return;
            const code = inputConsole.value.trim();
            if (!code) return;
            this.log(`> ${code}`, "input");
            try {
                this.runLua(code, "Console");
            } catch (e) {}
            inputConsole.value = "";
        };

        if (btnConsoleExec) btnConsoleExec.onclick = runConsoleInput;
        if (inputConsole) {
            inputConsole.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    runConsoleInput();
                }
            });
        }

        const btnClearConsole = document.getElementById("btn-clear-lua-console");
        if (btnClearConsole) {
            btnClearConsole.onclick = () => {
                this.consoleLogs = [];
                const out = document.getElementById("lua-console-output");
                if (out) out.innerHTML = "";
            };
        }

        const btnNewMod = document.getElementById("btn-new-mod");
        if (btnNewMod) {
            btnNewMod.onclick = () => this.openEditorForMod(null);
        }

        const btnSaveMod = document.getElementById("btn-editor-save");
        if (btnSaveMod) {
            btnSaveMod.onclick = () => this.saveCurrentEditorMod();
        }

        const btnTestMod = document.getElementById("btn-editor-test");
        if (btnTestMod) {
            btnTestMod.onclick = () => {
                const code = (document.getElementById("editor-mod-code")?.value || "").trim();
                const name = (document.getElementById("editor-mod-name")?.value || "Тест").trim();
                if (!code) return;
                try {
                    this.runLua(code, name);
                    if (this.game.ui) this.game.ui.showToast(`✔ Код виконано успішно!`);
                } catch (e) {
                    if (this.game.ui) this.game.ui.showToast(`❌ Помилка: ${e.message}`);
                }
            };
        }

        const selectTemplate = document.getElementById("select-mod-template");
        if (selectTemplate) {
            selectTemplate.onchange = (e) => this.applyTemplate(e.target.value);
        }

        const fileInput = document.getElementById("input-import-lua");
        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const content = ev.target.result;
                    const modName = file.name.replace(/\.lua$/i, "");
                    this.openEditorForMod({
                        id: "mod_" + Date.now(),
                        name: modName,
                        version: "1.0",
                        author: "User",
                        description: "Імпортований мод " + file.name,
                        code: content,
                        enabled: true
                    });
                    this.switchTab("editor");
                    if (this.game.ui) this.game.ui.showToast(`📂 Файл ${file.name} завантажено в редактор!`);
                };
                reader.readAsText(file);
            };
        }

        const btnExportLua = document.getElementById("btn-editor-export");
        if (btnExportLua) {
            btnExportLua.onclick = () => {
                const code = document.getElementById("editor-mod-code")?.value || "";
                const name = (document.getElementById("editor-mod-name")?.value || "mod").replace(/[^a-zA-Z0-9_-]/g, "_");
                const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${name}.lua`;
                a.click();
                URL.revokeObjectURL(url);
            };
        }

        this.renderModsList();
    }

    toggleModal(forceState = null) {
        const modal = document.getElementById("mods-modal");
        if (!modal) return;
        const isOpen = forceState !== null ? forceState : (modal.style.display !== "flex");
        modal.style.display = isOpen ? "flex" : "none";

        if (isOpen) {
            this.renderModsList();
            if (document.pointerLockElement) document.exitPointerLock();
            if (this.game.soundManager) this.game.soundManager.playClick();
        }
    }

    switchTab(tabName) {
        const tabBtn = document.querySelector(`.mods-tab-btn[data-tab="${tabName}"]`);
        if (tabBtn) tabBtn.click();
    }

    renderModsList() {
        const container = document.getElementById("mods-items-list");
        if (!container) return;

        container.innerHTML = "";
        if (this.mods.length === 0) {
            container.innerHTML = '<div style="color:#aaa;text-align:center;padding:20px;">Немає встановлених модів. Створіть новий або імпортуйте .lua файл!</div>';
            return;
        }

        this.mods.forEach(mod => {
            const card = document.createElement("div");
            card.className = `mod-card ${mod.enabled ? "active-mod" : ""}`;

            const left = document.createElement("div");
            left.className = "mod-card-left";
            left.innerHTML = `
                <div class="mod-card-header">
                    <span class="mod-name">${this.escapeHtml(mod.name)}</span>
                    <span class="mod-version">v${this.escapeHtml(mod.version || "1.0")}</span>
                    <span class="mod-author">by ${this.escapeHtml(mod.author || "Author")}</span>
                </div>
                <div class="mod-desc">${this.escapeHtml(mod.description || "")}</div>
            `;

            const right = document.createElement("div");
            right.className = "mod-card-right";

            const toggleLabel = document.createElement("label");
            toggleLabel.className = "mod-switch";
            toggleLabel.innerHTML = `
                <input type="checkbox" ${mod.enabled ? "checked" : ""}>
                <span class="mod-slider"></span>
            `;
            const checkbox = toggleLabel.querySelector("input");
            checkbox.onchange = () => this.toggleMod(mod.id, checkbox.checked);

            const btnEdit = document.createElement("button");
            btnEdit.className = "btn-mod-action btn-mod-edit";
            btnEdit.title = "Редагувати код";
            btnEdit.innerHTML = "✏️";
            btnEdit.onclick = () => {
                this.openEditorForMod(mod);
                this.switchTab("editor");
            };

            const btnDel = document.createElement("button");
            btnDel.className = "btn-mod-action btn-mod-del";
            btnDel.title = "Видалити мод";
            btnDel.innerHTML = "🗑️";
            btnDel.onclick = () => {
                if (confirm(`Видалити мод "${mod.name}"?`)) {
                    this.deleteMod(mod.id);
                }
            };

            right.appendChild(toggleLabel);
            right.appendChild(btnEdit);
            right.appendChild(btnDel);

            card.appendChild(left);
            card.appendChild(right);
            container.appendChild(card);
        });
    }

    openEditorForMod(mod = null) {
        const nameInput = document.getElementById("editor-mod-name");
        const versionInput = document.getElementById("editor-mod-version");
        const authorInput = document.getElementById("editor-mod-author");
        const descInput = document.getElementById("editor-mod-desc");
        const codeInput = document.getElementById("editor-mod-code");

        if (mod) {
            this.currentEditingModId = mod.id;
            if (nameInput) nameInput.value = mod.name || "";
            if (versionInput) versionInput.value = mod.version || "1.0";
            if (authorInput) authorInput.value = mod.author || "Гравець";
            if (descInput) descInput.value = mod.description || "";
            if (codeInput) codeInput.value = mod.code || "";
        } else {
            this.currentEditingModId = "mod_" + Date.now();
            if (nameInput) nameInput.value = "Мій Новий Мод";
            if (versionInput) versionInput.value = "1.0";
            if (authorInput) authorInput.value = "Гравець";
            if (descInput) descInput.value = "Опис мого крутого моду.";
            if (codeInput) codeInput.value = this.getTemplateCode("custom");
            this.switchTab("editor");
        }
    }

    saveCurrentEditorMod() {
        const name = (document.getElementById("editor-mod-name")?.value || "Без назви").trim();
        const version = (document.getElementById("editor-mod-version")?.value || "1.0").trim();
        const author = (document.getElementById("editor-mod-author")?.value || "Гравець").trim();
        const description = (document.getElementById("editor-mod-desc")?.value || "").trim();
        const code = (document.getElementById("editor-mod-code")?.value || "").trim();

        if (!code) {
            alert("Код моду не може бути порожнім!");
            return;
        }

        const id = this.currentEditingModId || ("mod_" + Date.now());
        const existing = this.mods.find(m => m.id === id);
        const enabled = existing ? existing.enabled : true;

        const modObj = {
            id,
            name,
            version,
            author,
            description,
            code,
            enabled
        };

        this.addOrUpdateMod(modObj);
        if (this.game.ui) this.game.ui.showToast(`💾 Мод "${name}" збережено!`);
        this.switchTab("list");
    }

    applyTemplate(templateKey) {
        const codeInput = document.getElementById("editor-mod-code");
        if (!codeInput) return;

        const template = this.getTemplateCode(templateKey);
        if (template) {
            if (codeInput.value && !confirm("Замінити поточний код шаблоном?")) return;
            codeInput.value = template;
        }
    }

    getTemplateCode(key) {
        switch (key) {
            case "creative":
                return `-- Шаблон: Креативний Режим
Mod.register({
    name = "Креативний Режим",
    version = "1.0",
    description = "Політ, швидке ламання і нескінченні блоки",
    onEnable = function()
        Player.setCreative(true)
        Player.setFlying(true)
        Player.setReach(10.0)
        Game.toast("✨ Креатив увімкнено!")
    end,
    onDisable = function()
        Player.setCreative(false)
        Player.setFlying(false)
        Game.toast("🏕️ Креатив вимкнено!")
    end
})

Events.on("onKey", function(key, down)
    if down and key == "KeyF" then
        local f = not Player.isFlying()
        Player.setFlying(f)
        Game.toast(f and "🕊️ Політ ON" or "🕊️ Політ OFF")
    end
end)
`;
            case "builder":
                return `-- Шаблон: Будівельний інструмент
Mod.register({
    name = "Платформа по команді",
    onEnable = function()
        Game.toast("Введіть /build у чаті для створення платформи!")
    end
})

Events.on("onChat", function(msg, sender)
    if msg == "/build" then
        local px, py, pz = Player.getPos()
        World.setBlocks(px - 3, py - 1, pz - 3, px + 3, py - 1, pz + 3, World.BLOCKS.DIAMOND_BLOCK)
        Game.toast("💎 Алмазна платформа створена!")
        return false
    end
end)
`;
            case "tnt":
                return `-- Шаблон: ТНТ Експлоужен
Mod.register({
    name = "ТНТ по кліку",
    onEnable = function()
        Game.toast("Клікніть щоб кинути ТНТ!")
    end
})

Events.on("onAttack", function(target, dmg)
    local px, py, pz = Player.getPos()
    World.spawnTNT(px, py + 2, pz, 0, 8, 0)
end)
`;
            case "weapon":
                return `-- Шаблон: Кастомна вогнепальна зброя
Items.register({
    id = "laser_blaster",
    name = "Лазерний Бластер",
    category = "weapon",
    maxStack = 1,
    color = "#00e5ff"
})

Events.on("onMouseDown", function(button)
    local held = Player.getHeldItem()
    if held and held.id == "laser_blaster" and button == 0 then
        Weapons.shoot({
            damage = 40,
            range = 75,
            tracerColor = 0x00e5ff,
            sound = true
        })
        return false -- блокує стандартне ламання блоків
    end
end)
`;
            default:
                return `-- Новий Мод для Eblankraft
Mod.register({
    name = "Мій Мод",
    version = "1.0",
    author = "Гравець",
    description = "Опис моду",
    onEnable = function()
        Game.toast("Мод активовано!")
    end
})

Events.on("onTick", function(dt)
    -- викликається кожен кадр
end)
`;
        }
    }
    // --- DEVELOPER CONSOLE ---
    initDevConsole() {
        const btnTop = document.getElementById("btn-dev-console-top");
        const btnClose = document.getElementById("dev-console-close");
        const btnClear = document.getElementById("dev-console-clear");
        const input = document.getElementById("dev-console-input");
        const btnExec = document.getElementById("dev-console-exec");

        if (btnTop) {
            const handleToggle = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                this.toggleDevConsole();
            };
            btnTop.onclick = handleToggle;
            btnTop.ontouchend = handleToggle;
        }

        if (btnClose) {
            const handleClose = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                this.toggleDevConsole(false);
            };
            btnClose.onclick = handleClose;
            btnClose.ontouchend = handleClose;
        }

        if (btnClear) {
            btnClear.onclick = () => {
                this.consoleLogs = [];
                const devLogs = document.getElementById("dev-console-logs");
                if (devLogs) devLogs.innerHTML = "";
                const luaLogs = document.getElementById("lua-console-output");
                if (luaLogs) luaLogs.innerHTML = "";
            };
        }

        const runCmd = () => {
            if (!input) return;
            const val = input.value.trim();
            if (!val) return;
            this.consoleHistory.push(val);
            this.historyIndex = this.consoleHistory.length;
            input.value = "";

            this.log(`> ${val}`, "input");

            if (val.startsWith("/")) {
                if (this.game.multiplayer) {
                    this.game.multiplayer.handleCommand(val);
                }
            } else {
                try {
                    this.runLua(val, "DevConsole");
                } catch (err) {}
            }
        };

        if (btnExec) {
            btnExec.onclick = (e) => { e.preventDefault(); runCmd(); };
            btnExec.ontouchend = (e) => { e.preventDefault(); runCmd(); };
        }

        if (input) {
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    runCmd();
                } else if (e.key === "ArrowUp") {
                    if (this.historyIndex > 0) {
                        this.historyIndex--;
                        input.value = this.consoleHistory[this.historyIndex] || "";
                    }
                } else if (e.key === "ArrowDown") {
                    if (this.historyIndex < this.consoleHistory.length - 1) {
                        this.historyIndex++;
                        input.value = this.consoleHistory[this.historyIndex] || "";
                    } else {
                        this.historyIndex = this.consoleHistory.length;
                        input.value = "";
                    }
                }
            });
        }

        const pills = document.querySelectorAll(".dev-pill-btn");
        pills.forEach(pill => {
            const handlePill = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                const cmd = pill.dataset.cmd;
                if (!cmd) return;
                if (input) input.value = cmd;
                runCmd();
            };
            pill.onclick = handlePill;
            pill.ontouchend = handlePill;
        });
    }

    toggleDevConsole(forceState = null) {
        const el = document.getElementById("game-dev-console");
        if (!el) return;
        const isOpen = forceState !== null ? forceState : (el.style.display !== "flex");
        el.style.display = isOpen ? "flex" : "none";

        if (isOpen) {
            if (document.pointerLockElement) document.exitPointerLock();
            const input = document.getElementById("dev-console-input");
            if (input) setTimeout(() => input.focus(), 50);
        }
    }

    // --- VEHICLE HUD & TOUCH CONTROLS ---
    showVehicleHud(opts = {}) {
        const hud = document.getElementById("vehicle-hud");
        if (!hud) return;
        hud.style.display = "block";

        const btnLights = document.getElementById("btn-vehicle-lights");
        if (btnLights && !btnLights._bound) {
            btnLights._bound = true;
            const handleLights = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                const v = this.game.player ? this.game.player.getVehicle() : null;
                if (v) v.toggleHeadlights();
            };
            btnLights.onclick = handleLights;
            btnLights.ontouchend = handleLights;
        }

        const btnHorn = document.getElementById("btn-vehicle-horn");
        if (btnHorn && !btnHorn._bound) {
            btnHorn._bound = true;
            const handleHorn = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                const v = this.game.player ? this.game.player.getVehicle() : null;
                if (v) v.honk();
                else this.soundSynth.horn();
            };
            btnHorn.onclick = handleHorn;
            btnHorn.ontouchend = handleHorn;
        }

        const btnExit = document.getElementById("btn-vehicle-exit");
        if (btnExit && !btnExit._bound) {
            btnExit._bound = true;
            const handleExit = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                if (this.game.player) this.game.player.dismountVehicle();
            };
            btnExit.onclick = handleExit;
            btnExit.ontouchend = handleExit;
        }

        const btnSiren = document.getElementById("btn-vehicle-siren");
        if (btnSiren && !btnSiren._bound) {
            btnSiren._bound = true;
            const handleSiren = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                const v = this.game.player ? this.game.player.getVehicle() : null;
                if (v && v.toggleSiren) v.toggleSiren();
            };
            btnSiren.onclick = handleSiren;
            btnSiren.ontouchend = handleSiren;
        }

        const touchControls = document.getElementById("touch-vehicle-controls");
        if (touchControls) {
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            touchControls.style.display = isTouch ? "flex" : "none";
        }
    }

    updateSpeedometerHUD(speedKmH = 0, rawSpeed = 0, nitro = 100, health = 100) {
        const spdEl = document.getElementById("vehicle-speed-value");
        if (spdEl) spdEl.textContent = Math.round(Math.abs(speedKmH));

        const gearEl = document.getElementById("vehicle-gear-indicator");
        if (gearEl) {
            if (Math.abs(rawSpeed) < 0.2) gearEl.textContent = "P";
            else if (rawSpeed > 0) {
                const gearNum = Math.min(6, Math.max(1, Math.ceil(Math.abs(speedKmH) / 18)));
                gearEl.textContent = String(gearNum);
            }
            else gearEl.textContent = "R";
        }

        const nitroFill = document.getElementById("vehicle-nitro-fill");
        if (nitroFill) {
            nitroFill.style.width = `${Math.max(0, Math.min(100, nitro))}%`;
        }

        const healthFill = document.getElementById("vehicle-health-fill");
        if (healthFill) {
            healthFill.style.width = `${Math.max(0, Math.min(100, health))}%`;
            healthFill.style.background = health > 50 ? '#4caf50' : (health > 25 ? '#ff9800' : '#f44336');
        }
    }

    hideVehicleHud() {
        const hud = document.getElementById("vehicle-hud");
        if (hud) hud.style.display = "none";
        this.soundSynth.stopEngine();
    }

    initTouchVehicleControls() {
        const bindBtn = (id, onDown, onUp) => {
            const el = document.getElementById(id);
            if (!el) return;
            const down = (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.classList.add("active");
                onDown();
            };
            const up = (e) => {
                e.preventDefault();
                el.classList.remove("active");
                onUp();
            };
            el.addEventListener("touchstart", down, { passive: false });
            el.addEventListener("touchend", up);
            el.addEventListener("touchcancel", up);
            el.addEventListener("mousedown", down);
            el.addEventListener("mouseup", up);
            el.addEventListener("mouseleave", up);
        };

        bindBtn("touch-v-gas", () => { this.touchGas = true; }, () => { this.touchGas = false; });
        bindBtn("touch-v-brake", () => { this.touchBrake = true; }, () => { this.touchBrake = false; });
        bindBtn("touch-v-steer-left", () => { this.touchSteerLeft = true; }, () => { this.touchSteerLeft = false; });
        bindBtn("touch-v-steer-right", () => { this.touchSteerRight = true; }, () => { this.touchSteerRight = false; });
    }

    // --- MULTIPLAYER MOD SYNC ---
    promptMultiplayerModsDownload(mods, hostName) {
        if (!mods || !Array.isArray(mods) || mods.length === 0) return;
        const modal = document.getElementById("mp-mod-sync-modal");
        if (!modal) return;

        const hostLabel = document.getElementById("mp-sync-host-name");
        if (hostLabel) hostLabel.textContent = hostName || "Хост";

        const list = document.getElementById("mp-sync-mods-list");
        if (list) {
            list.innerHTML = "";
            mods.forEach(m => {
                const item = document.createElement("div");
                item.className = "mp-sync-item";
                item.innerHTML = `<b>${this.escapeHtml(m.name || m.id)}</b> <span style="color:#aaa;">v${this.escapeHtml(m.version || "1.0")}</span> - <span style="color:#ccc;">${this.escapeHtml(m.description || "Мод від хоста")}</span>`;
                list.appendChild(item);
            });
        }

        modal.style.display = "flex";
        if (document.pointerLockElement) document.exitPointerLock();

        const btnAccept = document.getElementById("btn-mp-sync-accept");
        const btnDecline = document.getElementById("btn-mp-sync-decline");

        if (btnAccept) {
            const handleAccept = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                mods.forEach(mod => {
                    const existing = this.mods.find(m => m.id === mod.id);
                    if (existing) {
                        existing.code = mod.code;
                        existing.enabled = true;
                    } else {
                        this.mods.push({
                            id: mod.id,
                            name: mod.name || mod.id,
                            version: mod.version || "1.0",
                            author: mod.author || "Хост",
                            description: mod.description || "",
                            code: mod.code,
                            enabled: true
                        });
                    }
                });
                this.saveMods();
                this.reinitAllMods();
                modal.style.display = "none";
                if (this.game.ui) this.game.ui.showToast(`✔ Завантажено та активовано ${mods.length} модів!`);
            };
            btnAccept.onclick = handleAccept;
            btnAccept.ontouchend = handleAccept;
        }

        if (btnDecline) {
            const handleDecline = (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                modal.style.display = "none";
                if (this.game.ui) this.game.ui.showToast(`⚠️ Гра продовжується без модів хоста.`);
            };
            btnDecline.onclick = handleDecline;
            btnDecline.ontouchend = handleDecline;
        }
    }

    getSyncableMods() {
        return this.mods
            .filter(m => m.enabled)
            .map(m => ({
                id: m.id,
                name: m.name,
                version: m.version,
                author: m.author,
                description: m.description,
                code: m.code
            }));
    }
}

window.ModManager = ModManager;

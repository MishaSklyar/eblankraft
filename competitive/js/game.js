/**
 * Eblankraft - Main Game Loop & Scene Engine
 */

class Game {
    constructor() {
        window.game = this;
        this.container = document.getElementById('game-container');
        this.tntEntities = [];
        this.cameraShakeTrauma = 0;
        this.timeOfDay = 0.2; // 0 to 1 (0.2 = morning/day)
        this.daySpeed = 0.005; // speed of day/night cycle
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isAndroidOrApp = /Android|Mobile|SM-A02|Silk/i.test(navigator.userAgent) || !!window.isAndroidApp || (window.location && window.location.protocol === 'file:');
        const isLowEndMobile = isAndroidOrApp || (isTouch && (
            (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
            (navigator.deviceMemory && navigator.deviceMemory <= 3) ||
            /Android.*(A0|A1|A2|J|Core|Go|SM-A02)/i.test(navigator.userAgent)
        ));
        const storedA02 = localStorage.getItem('eblankraft_a02_mode');
        this.isA02Mode = (storedA02 !== null) ? (storedA02 === 'true') : isLowEndMobile;

        if (isAndroidOrApp && 'wakeLock' in navigator) {
            navigator.wakeLock.request('screen').catch(() => {});
        }

        // 💻 Auto-detect ASUS UL20FT / Intel Ironlake (GMA HD) / Netbook 2010
        const isIntelIronlakeOrAncient = () => {
            try {
                const testCanvas = document.createElement('canvas');
                const testGl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
                if (!testGl) return false;
                const dbg = testGl.getExtension('WEBGL_debug_renderer_info');
                if (dbg) {
                    const r = (testGl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
                    if (r.includes('ironlake') || r.includes('ilk') || r.includes('gma') || r.includes('pineview') ||
                        ((r.includes('intel') && (r.includes('hd graphics') || r.includes('965') || r.includes('g45') || r.includes('g41'))) &&
                        !r.includes('uhd') && !r.includes('iris') && !r.includes('xe') && !r.includes('gen9') && !r.includes('gen11') && !r.includes('gen12'))) {
                        return true;
                    }
                }
                if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2 && !isAndroidOrApp) {
                    return true;
                }
            } catch (e) {}
            return false;
        };

        const isUL20FT = isIntelIronlakeOrAncient();
        this.isUL20FT = isUL20FT;

        // Auto-configure optimal settings on first run on UL20FT / 2010 netbook
        if (isUL20FT && localStorage.getItem('eblankraft_ul20ft_auto_set') === null) {
            localStorage.setItem('eblankraft_ul20ft_auto_set', '1');
            localStorage.setItem('eblankraft_turbofps', 'true');
            localStorage.setItem('eblankraft_render_scale', '0.5');
            localStorage.setItem('eblankraft_shadows', 'false');
            localStorage.setItem('eblankraft_clouds', 'false');
            localStorage.setItem('eblankraft_fancy_water', '0');
            localStorage.setItem('eblankraft_wind_leaves', '0');
            localStorage.setItem('eblankraft_underwater_fx', '0');
            localStorage.setItem('eblankraft_antialias', 'false');
        }

        const storedTurbo = localStorage.getItem('eblankraft_turbofps');
        this.turboFPS = (storedTurbo !== null) ? (storedTurbo === 'true') : this.isUL20FT;

        const storedScale = localStorage.getItem('eblankraft_render_scale');
        this.renderScale = storedScale ? parseFloat(storedScale) : (this.isUL20FT ? 0.5 : (this.isA02Mode ? 0.75 : 1.0));

        const storedShadows = localStorage.getItem('eblankraft_shadows');
        this.shadowsEnabled = storedShadows !== null ? (storedShadows === 'true') : (!this.turboFPS && !this.isA02Mode && !this.isUL20FT);
        this.cloudsEnabled = (localStorage.getItem('eblankraft_clouds') !== 'false') && !this.turboFPS && !this.isUL20FT;
        this.windLeavesEnabled = (localStorage.getItem('eblankraft_wind_leaves') !== 'false') && !this.turboFPS && !this.isUL20FT;
        this.underwaterEffectsEnabled = (localStorage.getItem('eblankraft_underwater_fx') !== 'false');
        this.quickModsEnabled = (localStorage.getItem('eblankraft_quick_mods') !== 'false');
        this.cloudOffset = 0;
        this.renderFrameCount = 0;

        // Detect low-spec potato PC (<=2 cores or ancient netbook/mobile)
        const isPotato = this.isA02Mode || this.turboFPS || this.isUL20FT || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
        const storedAA = localStorage.getItem('eblankraft_antialias');
        this.antialias = (storedAA !== null) ? (storedAA === 'true') : !isPotato;

        // 🌊 4K Water with Waves & Normal Maps (Disabled in Low / A02 / Turbo / 2010 settings)
        const storedFancyWater = localStorage.getItem('eblankraft_fancy_water');
        this.fancyWaterEnabled = (storedFancyWater !== null) ? (storedFancyWater === '1') : (!this.turboFPS && !this.isA02Mode && !isPotato);

        // Preallocated Frustum Culling & FOV Math Objects (Zero Garbage Collection!)
        this._cullProjScreenMatrix = new THREE.Matrix4();
        this._cullFrustum = new THREE.Frustum();
        this._cullSphere = new THREE.Sphere();
        this._camPos = new THREE.Vector3();
        this._camDir = new THREE.Vector3();
        this.backend = 'webgl';

        this.initThree();
        this.initManagers();
        this.initMods();
        this.initWorld();
        this.initPlayer();
        this.initControls();
        this.initUI();
        this.initLights();
        this.initSkyAndAtmosphere();

        this.lastTime = performance.now();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    getEffectivePixelRatio() {
        const isPotato = this.isA02Mode || this.turboFPS || this.isUL20FT;
        const maxRatio = (this.ultraGraphics || this.renderScale >= 1.0) ? Math.min(window.devicePixelRatio || 1, 2.0) : (isPotato ? 0.75 : 1.5);
        const baseRatio = isPotato ? 0.75 : (window.devicePixelRatio || 1);
        const scale = this.renderScale || 1.0;
        return Math.max(0.2, Math.min(maxRatio, baseRatio * scale));
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x80bfff);
        this.scene.fog = new THREE.FogExp2(0x80bfff, 0.018);

        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 500);
        this.scene.add(this.camera);

        const isPotato = this.isA02Mode || this.turboFPS || this.isUL20FT || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

        this.renderer = new THREE.WebGLRenderer({
            antialias: (this.antialias !== false) && (!isPotato || this.ultraGraphics || localStorage.getItem('eblankraft_antialias') === 'true'),
            powerPreference: 'high-performance',
            precision: isPotato ? 'mediump' : 'highp',
            depth: true,
            stencil: false,
            alpha: false
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(this.getEffectivePixelRatio());
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Tone Mapping: disabled in A02 / Turbo / UL20FT mode to save massive ALU cycles on weak GPUs
        if (this.isA02Mode || this.turboFPS || this.isUL20FT) {
            this.renderer.toneMapping = THREE.NoToneMapping;
        } else {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.05;
        }

        // Real-Time Shadow Mapping (Smooth & optimized for 60+ FPS)
        this.renderer.shadowMap.enabled = this.shadowsEnabled;
        this.renderer.shadowMap.type = (this.isA02Mode || this.turboFPS || this.isUL20FT) ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = !this.isA02Mode && !this.turboFPS && !this.isUL20FT;

        if (this.renderScale < 1.0) {
            this.renderer.domElement.style.imageRendering = 'pixelated';
        }
        this.container.appendChild(this.renderer.domElement);

        window.addEventListener('resize', () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
            this.renderer.setPixelRatio(this.getEffectivePixelRatio());
        });
    }

    initLights() {
        // Ambient Light
        this.ambientLight = new THREE.AmbientLight(0xe8f0ff, 0.6);
        this.scene.add(this.ambientLight);

        // Sun Directional Light with soft real-time shadow camera
        this.sunLight = new THREE.DirectionalLight(0xfffaee, 0.9);
        this.sunLight.position.set(50, 100, 30);
        this.sunLight.castShadow = this.shadowsEnabled;
        const shadowDim = this.isA02Mode ? 512 : 1024;
        this.sunLight.shadow.mapSize.width = shadowDim;
        this.sunLight.shadow.mapSize.height = shadowDim;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 180;
        const d = this.isA02Mode ? 26 : 38;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0006;
        this.sunLight.shadow.normalBias = 0.05; // Eliminates shadow acne on voxel cubes!
        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        // Hemisphere Light for soft natural ground bounce
        this.hemiLight = new THREE.HemisphereLight(0xa0c8ff, 0x544230, 0.45);
        this.scene.add(this.hemiLight);

        // Glowing Sun Sprite with Radial Corona Flare (Shaders)
        const sunCanvas = document.createElement('canvas');
        sunCanvas.width = 128;
        sunCanvas.height = 128;
        const sCtx = sunCanvas.getContext('2d');
        const sunGrad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 64);
        sunGrad.addColorStop(0, '#ffffff');
        sunGrad.addColorStop(0.2, '#fff7b2');
        sunGrad.addColorStop(0.5, 'rgba(255, 180, 50, 0.65)');
        sunGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
        sCtx.fillStyle = sunGrad;
        sCtx.fillRect(0, 0, 128, 128);

        const sunTex = new THREE.CanvasTexture(sunCanvas);
        const sunMat = new THREE.SpriteMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending });
        this.sunSprite = new THREE.Sprite(sunMat);
        this.sunSprite.scale.set(40, 40, 1);
        this.scene.add(this.sunSprite);

        // Glowing Moon Sprite
        const moonCanvas = document.createElement('canvas');
        moonCanvas.width = 128;
        moonCanvas.height = 128;
        const mCtx = moonCanvas.getContext('2d');
        const moonGrad = mCtx.createRadialGradient(64, 64, 6, 64, 64, 56);
        moonGrad.addColorStop(0, '#ffffff');
        moonGrad.addColorStop(0.25, '#c8d8f8');
        moonGrad.addColorStop(0.6, 'rgba(100, 149, 237, 0.45)');
        moonGrad.addColorStop(1, 'rgba(0, 0, 50, 0)');
        mCtx.fillStyle = moonGrad;
        mCtx.fillRect(0, 0, 128, 128);

        const moonTex = new THREE.CanvasTexture(moonCanvas);
        const moonMat = new THREE.SpriteMaterial({ map: moonTex, transparent: true, blending: THREE.AdditiveBlending });
        this.moonSprite = new THREE.Sprite(moonMat);
        this.moonSprite.scale.set(32, 32, 1);
        this.scene.add(this.moonSprite);
    }

    initSkyAndAtmosphere() {
        // 1. Procedural Voxel Clouds
        this.initClouds();

        // 2. Twinkling Starfield in Night Sky
        this.initStars();

        // 3. Nether Embers & End Stardust Particles
        this.initDimensionAtmosphere();
    }

    initClouds() {
        const cloudGrid = 18;
        const cellSize = 14;
        const cloudGeom = new THREE.BoxGeometry(cellSize, 3.2, cellSize);
        const cloudMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.78
        });

        const matrices = [];
        const m = new THREE.Matrix4();
        const half = cloudGrid / 2;

        for (let x = -half; x < half; x++) {
            for (let z = -half; z < half; z++) {
                const val = Math.sin(x * 0.45) * Math.cos(z * 0.45) + Math.sin((x + z) * 0.25);
                if (val > 0.15) {
                    m.setPosition(x * cellSize, 65, z * cellSize);
                    matrices.push(m.clone());
                }
            }
        }

        if (matrices.length > 0) {
            this.cloudMesh = new THREE.InstancedMesh(cloudGeom, cloudMat, matrices.length);
            for (let i = 0; i < matrices.length; i++) {
                this.cloudMesh.setMatrixAt(i, matrices[i]);
            }
            this.cloudMesh.instanceMatrix.needsUpdate = true;
            this.cloudMesh.castShadow = false;
            this.cloudMesh.receiveShadow = false;
            this.cloudMesh.frustumCulled = false;
            this.cloudMesh.visible = this.cloudsEnabled;
            this.scene.add(this.cloudMesh);
        }
    }

    initStars() {
        const count = 400;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 0.95 + 0.05);
            const r = 260;
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.cos(phi);
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.starMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2.2,
            transparent: true,
            opacity: 0
        });
        this.starfield = new THREE.Points(geom, this.starMat);
        this.starfield.frustumCulled = false;
        this.scene.add(this.starfield);
    }

    initDimensionAtmosphere() {
        // Nether rising embers
        const emberCount = 50;
        const emberPos = new Float32Array(emberCount * 3);
        for (let i = 0; i < emberCount * 3; i += 3) {
            emberPos[i] = (Math.random() - 0.5) * 35;
            emberPos[i + 1] = Math.random() * 20;
            emberPos[i + 2] = (Math.random() - 0.5) * 35;
        }
        const emberGeom = new THREE.BufferGeometry();
        emberGeom.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
        this.emberMat = new THREE.PointsMaterial({
            color: 0xff6611,
            size: 2.2,
            transparent: true,
            opacity: 0.85
        });
        this.emberPoints = new THREE.Points(emberGeom, this.emberMat);
        this.emberPoints.visible = false;
        this.scene.add(this.emberPoints);

        // End cosmic stardust
        const dustCount = 50;
        const dustPos = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount * 3; i += 3) {
            dustPos[i] = (Math.random() - 0.5) * 45;
            dustPos[i + 1] = Math.random() * 25 + 5;
            dustPos[i + 2] = (Math.random() - 0.5) * 45;
        }
        const dustGeom = new THREE.BufferGeometry();
        dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        this.dustMat = new THREE.PointsMaterial({
            color: 0xda33ff,
            size: 2.5,
            transparent: true,
            opacity: 0.8
        });
        this.dustPoints = new THREE.Points(dustGeom, this.dustMat);
        this.dustPoints.visible = false;
        this.scene.add(this.dustPoints);
    }

    setShadowsEnabled(enabled) {
        this.shadowsEnabled = enabled;
        try { localStorage.setItem('eblankraft_shadows', enabled ? 'true' : 'false'); } catch (e) {}
        if (this.renderer && this.renderer.shadowMap) {
            this.renderer.shadowMap.enabled = enabled;
            this.renderer.shadowMap.type = this.isA02Mode ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = !this.isA02Mode;
        }
        if (this.sunLight) this.sunLight.castShadow = enabled;
        if (this.world && this.world.chunks) {
            for (let k in this.world.chunks) {
                const c = this.world.chunks[k];
                if (c.mesh) {
                    c.mesh.castShadow = enabled;
                    c.mesh.receiveShadow = enabled;
                    if (c.mesh.material) {
                        if (Array.isArray(c.mesh.material)) {
                            c.mesh.material.forEach(m => { m.needsUpdate = true; });
                        } else {
                            c.mesh.material.needsUpdate = true;
                        }
                    }
                }
                if (c.waterMesh) {
                    c.waterMesh.receiveShadow = false;
                }
            }
        }
    }

    setRenderScale(scale) {
        this.renderScale = Math.max(0.25, Math.min(1.5, parseFloat(scale) || 1.0));
        try { localStorage.setItem('eblankraft_render_scale', this.renderScale.toString()); } catch (e) {}
        if (this.renderer) {
            this.renderer.setPixelRatio(this.getEffectivePixelRatio());
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.renderer.setSize(w, h);
            if (this.renderer.domElement) {
                this.renderer.domElement.style.imageRendering = (this.renderScale < 1.0) ? 'pixelated' : 'auto';
            }
        }
    }

    setTurboFPS(enabled) {
        this.turboFPS = enabled;
        try { localStorage.setItem('eblankraft_turbofps', enabled ? 'true' : 'false'); } catch (e) {}
        if (this.renderer) {
            this.renderer.toneMapping = (enabled || this.isA02Mode || this.isUL20FT) ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
            this.renderer.setPixelRatio(this.getEffectivePixelRatio());
        }
        if (enabled) {
            this.setShadowsEnabled(false);
            this.setCloudsEnabled(false);
            if (this.scene) this.scene.fog = null; // Completely bypass fog calculations in shaders!
            if (this.world) this.world.chunkRadius = 1;
            // Simplify lighting to eliminate light vector calculations in vertex shaders
            if (this.sunLight) this.sunLight.visible = false;
            if (this.hemiLight) this.hemiLight.visible = false;
            if (this.ambientLight) this.ambientLight.intensity = 1.0;
        } else {
            if (this.scene && !this.scene.fog) {
                this.scene.fog = new THREE.FogExp2(0x80bfff, 0.018);
            }
            if (this.sunLight) this.sunLight.visible = true;
            if (this.hemiLight) this.hemiLight.visible = true;
            if (this.ambientLight) this.ambientLight.intensity = 0.6;
        }

        // Hot-swap all loaded chunks between unlit Basic and Lambert materials
        if (this.world && this.world.chunks) {
            for (let key in this.world.chunks) {
                const ch = this.world.chunks[key];
                if (ch && ch.mesh && Array.isArray(ch.mesh.material)) {
                    ch.mesh.material = ch.mesh.material.map(m => enabled ? ((m && m.basicCounterpart) ? m.basicCounterpart : m) : ((m && m.lambertCounterpart) ? m.lambertCounterpart : m));
                    ch.mesh.material.needsUpdate = true;
                    ch.mesh.castShadow = !enabled;
                    ch.mesh.receiveShadow = !enabled;
                }
                if (ch && ch.waterMesh && ch.waterMesh.material) {
                    const wm = ch.waterMesh.material;
                    ch.waterMesh.material = enabled ? ((wm && wm.basicCounterpart) ? wm.basicCounterpart : wm) : ((wm && wm.fancyCounterpart) ? wm.fancyCounterpart : wm);
                    ch.waterMesh.material.needsUpdate = true;
                }
            }
        }
    }

    // 💎 ULTRA Graphics Mode (100% Native Resolution Scaling + Antialiasing + PCF Soft Shadows + 4K Water)
    setUltraGraphics(enabled = true) {
        this.ultraGraphics = enabled;
        try {
            localStorage.setItem('eblankraft_ultra_graphics', enabled ? 'true' : 'false');
            localStorage.setItem('eblankraft_antialias', 'true');
            localStorage.setItem('eblankraft_render_scale', '1.0');
            localStorage.setItem('eblankraft_turbofps', 'false');
            localStorage.setItem('eblankraft_shadows', 'true');
            localStorage.setItem('eblankraft_clouds', 'true');
            localStorage.setItem('eblankraft_wind_leaves', '1');
            localStorage.setItem('eblankraft_underwater_fx', '1');
            localStorage.setItem('eblankraft_fancy_water', '1');
        } catch (e) {}

        this.turboFPS = false;
        this.isA02Mode = false;
        this.isUL20FT = false;
        this.antialias = true;
        this.renderScale = 1.0;

        this.setRenderScale(1.0);
        this.setShadowsEnabled(true);
        this.setCloudsEnabled(true);
        this.windLeavesEnabled = true;
        this.underwaterEffectsEnabled = true;
        if (this.setFancyWaterEnabled) this.setFancyWaterEnabled(true);

        if (this.world) {
            this.world.chunkRadius = Math.max(this.world.chunkRadius, 4);
        }

        if (this.renderer) {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.1;
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = true;
            this.renderer.setPixelRatio(this.getEffectivePixelRatio());
            if (this.renderer.domElement) {
                this.renderer.domElement.style.imageRendering = 'auto';
            }
        }

        if (this.sunLight) {
            this.sunLight.visible = true;
            this.sunLight.castShadow = true;
            if (this.sunLight.shadow) {
                this.sunLight.shadow.mapSize.width = 2048;
                this.sunLight.shadow.mapSize.height = 2048;
                this.sunLight.shadow.bias = -0.0005;
                if (this.sunLight.shadow.map) {
                    this.sunLight.shadow.map.dispose();
                    this.sunLight.shadow.map = null;
                }
            }
        }

        // Restore all chunks to full high quality materials & dynamic shadows
        if (this.world && this.world.chunks) {
            for (let key in this.world.chunks) {
                const ch = this.world.chunks[key];
                if (ch && ch.mesh && Array.isArray(ch.mesh.material)) {
                    ch.mesh.material = ch.mesh.material.map(m => (m && m.lambertCounterpart) ? m.lambertCounterpart : m);
                    ch.mesh.material.needsUpdate = true;
                    ch.mesh.castShadow = true;
                    ch.mesh.receiveShadow = true;
                }
                if (ch && ch.waterMesh && ch.waterMesh.material) {
                    const wm = ch.waterMesh.material;
                    ch.waterMesh.material = (wm && wm.fancyCounterpart) ? wm.fancyCounterpart : wm;
                    ch.waterMesh.material.needsUpdate = true;
                }
            }
        }
    }

    setA02Mode(enabled) {
        this.isA02Mode = enabled;
        try { localStorage.setItem('eblankraft_a02_mode', enabled ? 'true' : 'false'); } catch (e) {}
        if (this.renderer) {
            this.renderer.setPixelRatio(this.getEffectivePixelRatio());
            if (this.renderer.shadowMap) {
                this.renderer.shadowMap.type = enabled ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
                this.renderer.shadowMap.autoUpdate = !enabled && !this.turboFPS;
            }
            this.renderer.toneMapping = (enabled || this.turboFPS) ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
        }
        if (this.sunLight && this.sunLight.shadow) {
            const dim = enabled ? 512 : 1024;
            this.sunLight.shadow.mapSize.set(dim, dim);
            if (this.sunLight.shadow.map) {
                this.sunLight.shadow.map.dispose();
                this.sunLight.shadow.map = null;
            }
            const d = enabled ? 26 : 38;
            this.sunLight.shadow.camera.left = -d;
            this.sunLight.shadow.camera.right = d;
            this.sunLight.shadow.camera.top = d;
            this.sunLight.shadow.camera.bottom = -d;
            this.sunLight.shadow.camera.updateProjectionMatrix();
        }
        if (this.world) {
            if (enabled && this.world.chunkRadius > 2) {
                this.world.chunkRadius = 2;
            }
        }
    }

    setCloudsEnabled(enabled) {
        this.cloudsEnabled = enabled;
        try { localStorage.setItem('eblankraft_clouds', enabled ? 'true' : 'false'); } catch (e) {}
        if (this.cloudMesh) this.cloudMesh.visible = enabled;
    }

    updateShaderAtmosphere(shaderName) {
        if (shaderName === 'turbo') {
            if (this.scene.fog) this.scene.fog.density = 0.008;
            if (this.sunSprite) this.sunSprite.visible = false;
            if (this.moonSprite) this.moonSprite.visible = false;
            this.setShadowsEnabled(false);
            this.setCloudsEnabled(false);
        } else if (shaderName === 'bsl') {
            if (this.scene.fog) this.scene.fog.density = 0.015;
            if (this.sunSprite) this.sunSprite.scale.set(44, 44, 1);
            this.setShadowsEnabled(true);
            this.setCloudsEnabled(true);
        } else {
            // vanilla
            if (this.scene.fog) this.scene.fog.density = 0.018;
            if (this.sunSprite) this.sunSprite.scale.set(32, 32, 1);
            this.setShadowsEnabled(false);
            this.setCloudsEnabled(true);
        }
        if (this.world && this.world.updateChunkMaterials) {
            this.world.updateChunkMaterials();
        }
    }

    isFancyWaterActive() {
        if (this.fancyWaterEnabled === false) return false;
        if (this.turboFPS || this.isA02Mode) return false;
        if (this.ui && this.ui.currentShader && this.ui.currentShader !== 'bsl') return false;
        return true;
    }

    setFancyWaterEnabled(enabled) {
        this.fancyWaterEnabled = !!enabled;
        try { localStorage.setItem('eblankraft_fancy_water', enabled ? '1' : '0'); } catch (e) {}
        if (this.world && this.world.updateChunkMaterials) {
            this.world.updateChunkMaterials();
        }
    }

    initManagers() {
        this.textureManager = new TextureManager();
        if (window.EblanEng) {
            window.EblanEng.init(1337).then(() => {
                if (this.world) {
                    window.EblanEng.setSeed(this.world.seed);
                    for (let key in this.world.chunks) {
                        const ch = this.world.chunks[key];
                        if (ch) ch.isDirty = true;
                    }
                }
                window.EblanEng.syncMaterials(this.textureManager);
            });
        }
        this.soundManager = new SoundManager();
        this.particleSystem = new ParticleSystem(this.scene, this.textureManager);
        this.upgrader = new UpgraderSkinsManager(this);
        this.mobManager = new MobManager(this.scene, this.textureManager, this.soundManager, this);
        if (window.WeatherManager) {
            this.weatherManager = new WeatherManager(this);
        }
        if (window.MultiplayerManager) {
            this.multiplayer = new MultiplayerManager(this);
        }
        if (window.CompetitiveServerClient) {
            this.serverClient = new CompetitiveServerClient(this);
        }
        if (window.RedstoneEngine) {
            this.redstoneEngine = new RedstoneEngine(this);
        }
    }

    initWorld(worldType = 'normal', seed = null) {
        if (this.world) {
            for (let key in this.world.chunks) {
                const chunk = this.world.chunks[key];
                if (chunk.mesh) this.scene.remove(chunk.mesh);
                if (chunk.waterMesh) this.scene.remove(chunk.waterMesh);
            }
        }
        if (!worldType) {
            const selectWorldType = document.getElementById('select-world-type');
            worldType = (selectWorldType && selectWorldType.value) ? selectWorldType.value : 'normal';
        }
        let chosenSeed = (seed !== null && seed !== undefined) ? Number(seed) : null;
        if (chosenSeed === null || isNaN(chosenSeed)) {
            const seedInput = document.getElementById('input-seed');
            if (seedInput && seedInput.value.trim() !== "") {
                chosenSeed = parseInt(seedInput.value) || 1337;
            } else {
                chosenSeed = Math.floor(Math.random() * 899999) + 100000;
            }
        }

        if (window.EblanEng) {
            window.EblanEng.setSeed(chosenSeed);
        }
        this.world = new VoxelWorld(this.scene, this.textureManager, {
            worldType: worldType,
            seed: chosenSeed,
            chunkRadius: 2,
            game: this
        });
        if (this.player) {
            this.player.world = this.world;
        }
        if (this.redstoneEngine) {
            this.redstoneEngine.init(this.world);
        }
        if (this.modManager) {
            this.modManager.world = this.world;
        }
        if (worldType === 'pvp_arena') {
            const col = new THREE.Color(0x280b18);
            this.scene.background = col;
            this.scene.fog.color = col;
            this.scene.fog.density = 0.015;
            if (this.ambientLight) this.ambientLight.color.setHex(0xff7755);
        }
    }

    initPlayer() {
        this.player = new Player(
            this.scene,
            this.camera,
            this.world,
            this.soundManager,
            this.particleSystem,
            this
        );
    }

    initControls() {
        this.controls = new Controls(this.player, this.renderer.domElement);
    }

    initUI() {
        this.ui = new UIManager(this);
    }

    resetWorld(worldType = 'normal') {
        // Clear TNTs
        for (let t of this.tntEntities) {
            if (t.mesh) this.scene.remove(t.mesh);
        }
        this.tntEntities = [];

        if (this.mobManager) {
            this.mobManager.clearAll();
        }

        this.initWorld(worldType);
        this.player.world = this.world;
        this.player.spawnSafe();
        this.ui.initHotbar();
        if (this.world && this.world.spawnCarMapVehicles) {
            this.world.spawnCarMapVehicles(worldType);
        }
    }

    triggerCameraShake(intensity = 0.5, speed = 10) {
        this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + intensity);
    }

    flashDamageScreen() {
        if (this.ui) this.ui.flashDamage();
    }

    updateDayNight(dt) {
        // Skip overworld day-night cycle if in Nether, End, or PvP Arena
        if (this.world && (this.world.dimension === 'nether' || this.world.dimension === 'the_end' || this.world.dimension === 'pvp_arena' || this.world.worldType === 'pvp_arena')) {
            if (this.starfield) this.starfield.visible = false;
            return;
        }

        this.timeOfDay = (this.timeOfDay + dt * this.daySpeed) % 1.0;

        const sunAngle = this.timeOfDay * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle);

        if (this.player) {
            const snapX = Math.round(this.player.position.x);
            const snapY = Math.round(this.player.position.y);
            const snapZ = Math.round(this.player.position.z);
            this.sunLight.target.position.set(snapX, snapY, snapZ);
            const sunDist = this.isA02Mode ? 42 : 55;
            this.sunLight.position.set(
                snapX + Math.cos(sunAngle) * sunDist,
                snapY + Math.max(12, sunHeight * (this.isA02Mode ? 46 : 60)),
                snapZ + 25
            );
        }

        this.sunLight.castShadow = this.shadowsEnabled && (sunHeight > 0.05);

        this.cachedSkyColor = this.cachedSkyColor || new THREE.Color();
        const skyColor = this.cachedSkyColor;
        if (sunHeight > 0.1) {
            // Day - natural blue sky with warm sunlight & natural ground bounce
            skyColor.setRGB(0.48, 0.72, 0.98);
            this.ambientLight.intensity = 0.58;
            this.ambientLight.color.setHex(0xe8f0ff);
            this.sunLight.intensity = 0.92 * sunHeight;
            this.sunLight.color.setHex(0xfffaee);
            if (this.hemiLight) {
                this.hemiLight.color.setHex(0xa0c8ff);
                this.hemiLight.groundColor.setHex(0x544230);
            }
            if (this.starfield) this.starfield.visible = false;
        } else if (sunHeight > -0.1) {
            // Sunset / Sunrise - warm golden-orange atmosphere
            skyColor.setRGB(0.85, 0.45, 0.22);
            this.ambientLight.intensity = 0.45;
            this.ambientLight.color.setHex(0xffb080);
            this.sunLight.intensity = 0.5;
            this.sunLight.color.setHex(0xff9944);
            if (this.hemiLight) {
                this.hemiLight.color.setHex(0xff8844);
                this.hemiLight.groundColor.setHex(0x442211);
            }
            if (this.starfield && this.starMat) {
                this.starfield.visible = true;
                this.starMat.opacity = Math.max(0, -sunHeight * 5);
            }
        } else {
            // Night - deep starry sky with cool atmospheric moonlight
            skyColor.setRGB(0.04, 0.07, 0.14);
            this.ambientLight.intensity = 0.22;
            this.ambientLight.color.setHex(0x223355);
            this.sunLight.intensity = 0.08;
            this.sunLight.color.setHex(0x88aaff);
            if (this.hemiLight) {
                this.hemiLight.color.setHex(0x182438);
                this.hemiLight.groundColor.setHex(0x0a0e14);
            }
            if (this.starfield && this.starMat) {
                this.starfield.visible = true;
                this.starMat.opacity = 0.85;
            }
        }

        const isUnderwater = this.player && this.player.isSubmerged && (this.underwaterEffectsEnabled !== false);
        if (this.scene.background && this.scene.background.isColor) {
            if (isUnderwater) {
                this.scene.background.setHex(0x103a60);
            } else {
                this.scene.background.copy(skyColor);
            }
        } else {
            this.scene.background = isUnderwater ? new THREE.Color(0x103a60) : skyColor.clone();
        }

        if (!this.player || !this.player.isSubmerged || this.underwaterEffectsEnabled === false) {
            if (this.scene.fog && this.scene.fog.color) {
                this.scene.fog.color.copy(skyColor);
            }
        }

        // Position 3D Sun and Moon sprites in the sky relative to player
        if (this.player) {
            if (this.sunSprite) {
                this.sunSprite.position.set(
                    this.player.position.x + Math.cos(sunAngle) * 110,
                    this.player.position.y + sunHeight * 110,
                    this.player.position.z + 35
                );
                this.sunSprite.visible = (sunHeight > -0.2);
            }
            if (this.moonSprite) {
                this.moonSprite.position.set(
                    this.player.position.x - Math.cos(sunAngle) * 110,
                    this.player.position.y - sunHeight * 110,
                    this.player.position.z - 35
                );
                this.moonSprite.visible = (sunHeight < 0.2);
            }
        }
    }

    updateSkyAndAtmosphere(dt) {
        const dim = (this.world && this.world.dimension) ? this.world.dimension : 'overworld';

        // 1. Procedural Voxel Clouds
        if (this.cloudMesh && this.player) {
            if (dim === 'overworld' && this.cloudsEnabled) {
                this.cloudOffset += dt * 1.5;
                const cellSize = 14;
                const px = Math.floor(this.player.position.x / cellSize) * cellSize;
                const pz = Math.floor(this.player.position.z / cellSize) * cellSize;
                this.cloudMesh.position.set(px + (this.cloudOffset % cellSize), 0, pz);
                this.cloudMesh.visible = true;
            } else {
                this.cloudMesh.visible = false;
            }
        }

        // 2. Stars
        if (this.starfield && this.player) {
            if (dim === 'overworld') {
                this.starfield.position.set(this.player.position.x, 0, this.player.position.z);
            } else {
                this.starfield.visible = false;
            }
        }

        // 3. Nether Embers
        if (this.emberPoints && this.player) {
            if (dim === 'nether') {
                this.emberPoints.visible = true;
                this.emberPoints.position.set(this.player.position.x, this.player.position.y, this.player.position.z);
                const pos = this.emberPoints.geometry.attributes.position.array;
                for (let i = 1; i < pos.length; i += 3) {
                    pos[i] += dt * 2.5;
                    if (pos[i] > 20) pos[i] = -5;
                }
                this.emberPoints.geometry.attributes.position.needsUpdate = true;
            } else {
                this.emberPoints.visible = false;
            }
        }

        // 4. End Stardust
        if (this.dustPoints && this.player) {
            if (dim === 'the_end') {
                this.dustPoints.visible = true;
                this.dustPoints.position.set(this.player.position.x, this.player.position.y, this.player.position.z);
                const pos = this.dustPoints.geometry.attributes.position.array;
                for (let i = 0; i < pos.length; i += 3) {
                    pos[i] += Math.sin(performance.now() * 0.001 + i) * dt * 0.8;
                    pos[i + 1] += Math.cos(performance.now() * 0.0012 + i) * dt * 0.6;
                }
                this.dustPoints.geometry.attributes.position.needsUpdate = true;
            } else {
                this.dustPoints.visible = false;
            }
        }
    }

    animate() {
        requestAnimationFrame(this.animate);

        const now = performance.now();
        const rawDt = (now - this.lastTime) / 1000;
        const dt = Math.min(rawDt, 0.1); // Clamp dt against lag spikes
        this.lastTime = now;

        // Day/Night Cycle & Atmosphere
        this.updateDayNight(dt);
        this.updateSkyAndAtmosphere(dt);

        // Title screen panoramic camera rotation when in Main Menu (with gentle mouse parallax)
        if (this.ui && this.ui.mainMenuOpen && this.player) {
            const parallaxY = (window._mmMouseY || 0) * 0.08;
            this.player.yaw = (this.player.yaw || 0) + dt * 0.08;
            this.player.pitch = 0.04 * Math.sin(now * 0.0006) + parallaxY;
        }

        // Infinite World Generation around Player & Water Physics
        if (this.world && this.player) {
            this.world.update(this.player.position.x, this.player.position.z, dt);
        }

        // Animated Water Shaders (Flowing waves & specular ripples)
        this.waterTime = (this.waterTime || 0) + dt;
        if (!this.turboFPS && !this.isA02Mode && this.textureManager && this.textureManager.materials && this.textureManager.materials[BLOCK_TYPES.WATER]) {
            const wMat = this.textureManager.materials[BLOCK_TYPES.WATER];
            if (wMat.userData && wMat.userData.uTime) {
                wMat.userData.uTime.value = (this.underwaterEffectsEnabled !== false) ? this.waterTime : 0.0;
            }
            if (wMat.normalMap) {
                wMat.normalMap.offset.x = (this.waterTime * 0.035) % 1;
                wMat.normalMap.offset.y = (this.waterTime * 0.022) % 1;
            }
            if (wMat.map) {
                wMat.map.offset.x = (this.waterTime * 0.015) % 1;
                wMat.map.offset.y = (this.waterTime * 0.01) % 1;
            }
        }

        // 🌋 Animated Real-Time Lava (Convective magma fluid flow + vertex waves)
        if (this.textureManager) {
            if (this.textureManager.updateLava && !this.turboFPS) {
                this.textureManager.updateLava(this.waterTime);
            }
            if (this.textureManager.materials && this.textureManager.materials[BLOCK_TYPES.LAVA]) {
                const lavaMat = this.textureManager.materials[BLOCK_TYPES.LAVA];
                if (lavaMat.userData && lavaMat.userData.uTime) {
                    lavaMat.userData.uTime.value = this.waterTime;
                }
                if (lavaMat.map) {
                    lavaMat.map.offset.x = (this.waterTime * 0.012) % 1;
                    lavaMat.map.offset.y = (this.waterTime * 0.008) % 1;
                }
            }
        }

        // 🌋 Ambient Lava Spark / Pop Particles near lava pools
        this.lavaParticleTimer = (this.lavaParticleTimer || 0) + dt;
        if (!this.turboFPS && this.lavaParticleTimer > 0.35 && this.particleSystem && this.player && this.world) {
            this.lavaParticleTimer = 0;
            const px = Math.floor(this.player.position.x + (Math.random() - 0.5) * 16);
            const py = Math.floor(this.player.position.y + (Math.random() - 0.5) * 6);
            const pz = Math.floor(this.player.position.z + (Math.random() - 0.5) * 16);
            const b = this.world.getBlock(px, py, pz);
            if (b === BLOCK_TYPES.LAVA) {
                const above = this.world.getBlock(px, py + 1, pz);
                if (above === BLOCK_TYPES.AIR) {
                    this.particleSystem.spawnLavaPopParticles(px + 0.5, py + 1.0, pz + 0.5, 2);
                    if (Math.random() < 0.25 && this.soundManager && this.soundManager.playLavaPop) {
                        this.soundManager.playLavaPop();
                    }
                }
            }
        }

        // Animated Wind Leaves (Trees)
        if (!this.turboFPS && !this.isA02Mode && this.textureManager && this.textureManager.materials && this.textureManager.materials[BLOCK_TYPES.LEAVES]) {
            const lMat = this.textureManager.materials[BLOCK_TYPES.LEAVES];
            if (lMat.userData && lMat.userData.uTime) {
                lMat.userData.uTime.value = this.waterTime;
                lMat.userData.uWindStrength.value = (this.windLeavesEnabled !== false) ? 1.0 : 0.0;
            }
        }

        // Ambient Falling Leaves Particles near trees (throttled to avoid frame drops, skipped in turbo/a02)
        this.leafParticleTimer = (this.leafParticleTimer || 0) + dt;
        if (!this.turboFPS && !this.isA02Mode && this.windLeavesEnabled !== false && this.leafParticleTimer > 0.25 && this.particleSystem && this.player && this.world) {
            this.leafParticleTimer = 0;
            const px = this.player.position.x + (Math.random() - 0.5) * 20;
            const py = this.player.position.y + 2 + Math.random() * 8;
            const pz = this.player.position.z + (Math.random() - 0.5) * 20;
            const b = this.world.getBlock(Math.floor(px), Math.floor(py), Math.floor(pz));
            if (b === BLOCK_TYPES.LEAVES) {
                this.particleSystem.spawnFallingLeaves(px, py - 0.5, pz, 1);
            }
        }

        // Underwater & Lava Fog Adjustment
        if (this.scene && this.scene.fog && this.player) {
            if (this.player.isLavaSubmerged) {
                if (this.origFogDensity === undefined) {
                    this.origFogDensity = this.scene.fog.density || 0.018;
                    this.origFogColor = this.scene.fog.color.getHex();
                }
                this.scene.fog.color.setHex(0xb71c1c); // Fiery deep red magma fog
                this.scene.fog.density = 0.12; // Dense glowing lava fog
            } else if (this.player.isSubmerged && (this.underwaterEffectsEnabled !== false)) {
                if (this.origFogDensity === undefined) {
                    this.origFogDensity = this.scene.fog.density || 0.018;
                    this.origFogColor = this.scene.fog.color.getHex();
                }
                this.scene.fog.color.setHex(0x103a60);
                this.scene.fog.density = 0.055; // Murky atmospheric deep water
            } else if (this.origFogDensity !== undefined) {
                this.scene.fog.color.setHex(this.origFogColor);
                this.scene.fog.density = this.origFogDensity;
                this.origFogDensity = undefined;
            }
        }

        // Update Controls & Physics
        if (this.controls) {
            this.controls.update(dt);
        }

        // Update Mobs, Boss Dragon, and 3D Item Drops
        if (this.mobManager && this.player && this.world) {
            this.mobManager.update(dt, this.player, this.world);
        }

        // Update TNT entities
        for (let i = this.tntEntities.length - 1; i >= 0; i--) {
            const tnt = this.tntEntities[i];
            tnt.update(dt);
            if (tnt.exploded) {
                this.tntEntities.splice(i, 1);
            }
        }

        // Update Particles
        if (this.particleSystem) {
            this.particleSystem.update(dt, this.world);
        }

        // Update Redstone & Wires
        if (this.redstoneEngine) {
            this.redstoneEngine.update(dt);
        }

        // Camera Shake effect
        if (this.cameraShakeTrauma > 0) {
            this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 1.5);
            const shake = this.cameraShakeTrauma * this.cameraShakeTrauma * 0.15;
            this.camera.position.x += (Math.random() - 0.5) * shake;
            this.camera.position.y += (Math.random() - 0.5) * shake;
            this.camera.position.z += (Math.random() - 0.5) * shake;
        }

        // Update Multiplayer
        if (this.multiplayer) {
            this.multiplayer.update(dt);
        }

        // Authoritative Server Movement Sync
        if (this.serverClient && this.serverClient.isConnected && this.player) {
            const held = this.player.getSelectedItem ? this.player.getSelectedItem() : null;
            const heldItemKey = held ? held.itemId : (this.player.heldItem ? this.player.heldItem.name : 'fist');
            this.serverClient.sendMove(
                this.player.position.x,
                this.player.position.y,
                this.player.position.z,
                this.player.yaw,
                this.player.pitch,
                heldItemKey,
                this.player.isWalking,
                this.player.isSprinting
            );
        }

        // Update UI & HUD
        if (this.ui) {
            this.ui.update(dt);
        }

        // Update Weather
        if (this.weatherManager) {
            this.weatherManager.update(dt);
        }

        // Update Lua Mods
        if (this.modManager) {
            this.modManager.update(dt);
        }

        // Throttled shadow update for Samsung A02 mode (updates every 2nd frame)
        this.renderFrameCount = (this.renderFrameCount || 0) + 1;
        if (this.shadowsEnabled && this.isA02Mode && this.renderer.shadowMap) {
            if (this.renderFrameCount % 2 === 0) {
                this.renderer.shadowMap.needsUpdate = true;
            }
        }

        // 🚀 HARDWARE FOV & FRUSTUM CULLING (Stops rendering anything not in FOV or behind player)
        this.performFrustumAndOcclusionCulling();

        // Render Scene
        this.renderer.render(this.scene, this.camera);
        this.lastFrameCpuTime = performance.now() - now;
    }

    performFrustumAndOcclusionCulling() {
        if (!this.camera || !this.world) return;

        // 1. Update Camera Matrices & Calculate Frustum
        this.camera.updateMatrixWorld();
        this._cullProjScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this._cullFrustum.setFromProjectionMatrix(this._cullProjScreenMatrix);
        this.camera.getWorldPosition(this._camPos);
        this.camera.getWorldDirection(this._camDir);

        // 2. Chunks Frustum Culling (FOV Culling)
        const chunks = this.world.chunks;
        if (chunks) {
            for (const key in chunks) {
                const chunk = chunks[key];
                if (!chunk || !chunk.isGenerated) continue;

                if (!chunk.bounds) {
                    chunk.bounds = new THREE.Box3(
                        new THREE.Vector3(chunk.cx * CHUNK_SIZE_X, 0, chunk.cz * CHUNK_SIZE_Z),
                        new THREE.Vector3((chunk.cx + 1) * CHUNK_SIZE_X, CHUNK_SIZE_Y, (chunk.cz + 1) * CHUNK_SIZE_Z)
                    );
                }

                // If chunk is not inside camera frustum (not in FOV), DO NOT RENDER IT
                const inFOV = this._cullFrustum.intersectsBox(chunk.bounds);

                if (chunk.mesh) {
                    chunk.mesh.visible = inFOV;
                }
                if (chunk.waterMesh) {
                    chunk.waterMesh.visible = inFOV;
                }
            }
        }

        // 3. Mobs FOV Culling
        if (this.mobManager && this.mobManager.mobs) {
            const mobs = this.mobManager.mobs;
            for (let i = 0; i < mobs.length; i++) {
                const mob = mobs[i];
                if (!mob || !mob.mesh) continue;
                this._cullSphere.center.copy(mob.position);
                this._cullSphere.center.y += (mob.height || 1.8) * 0.5;
                this._cullSphere.radius = Math.max(mob.width || 0.6, mob.height || 1.8);
                mob.mesh.visible = this._cullFrustum.intersectsSphere(this._cullSphere);
            }
        }

        // 4. Item Drops & TNT FOV Culling
        if (this.mobManager && this.mobManager.itemDrops) {
            const drops = this.mobManager.itemDrops;
            for (let i = 0; i < drops.length; i++) {
                const item = drops[i];
                if (!item || !item.mesh) continue;
                this._cullSphere.center.copy(item.position);
                this._cullSphere.radius = 1.0;
                item.mesh.visible = this._cullFrustum.intersectsSphere(this._cullSphere);
            }
        }
        if (this.mobManager && this.mobManager.tntEntities) {
            const tnts = this.mobManager.tntEntities;
            for (let i = 0; i < tnts.length; i++) {
                const tnt = tnts[i];
                if (!tnt || !tnt.mesh) continue;
                this._cullSphere.center.copy(tnt.mesh.position);
                this._cullSphere.radius = 1.2;
                tnt.mesh.visible = this._cullFrustum.intersectsSphere(this._cullSphere);
            }
        }

        // 5. Boss (EblanDragon) Frustum Culling
        if (this.mobManager && this.mobManager.boss && this.mobManager.boss.mesh) {
            this._cullSphere.center.copy(this.mobManager.boss.position);
            this._cullSphere.radius = 12.0;
            this.mobManager.boss.mesh.visible = this._cullFrustum.intersectsSphere(this._cullSphere);
        }

        // 6. Vehicles FOV Culling
        const vMgr = (window.modManager && window.modManager.vehicleManager) || (this.vehicleManager);
        if (vMgr && vMgr.vehicles) {
            const vs = vMgr.vehicles;
            for (let i = 0; i < vs.length; i++) {
                const v = vs[i];
                if (!v || !v.mesh) continue;
                this._cullSphere.center.copy(v.position);
                this._cullSphere.radius = 3.5;
                v.mesh.visible = this._cullFrustum.intersectsSphere(this._cullSphere);
            }
        }

        // 6. Particles FOV Culling
        if (this.particleManager && this.particleManager.particles) {
            const particles = this.particleManager.particles;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (!p || !p.mesh) continue;
                p.mesh.visible = this._cullFrustum.containsPoint(p.mesh.position);
            }
        }

        // 7. Clouds, Sun & Moon Occlusion Culling (when underground or in cave)
        if (this.player && this.world) {
            const px = Math.floor(this.player.position.x);
            const py = Math.floor(this.player.position.y);
            const pz = Math.floor(this.player.position.z);
            let hasSkyView = false;
            for (let y = py + 2; y <= Math.min(py + 18, 63); y++) {
                const b = this.world.getBlock(px, y, pz);
                if (b === BLOCK_TYPES.AIR || b === BLOCK_TYPES.GLASS || b === BLOCK_TYPES.WATER) {
                    hasSkyView = true;
                } else {
                    hasSkyView = false;
                    break;
                }
            }
            if (this.cloudMesh) {
                this.cloudMesh.visible = this.cloudsEnabled && hasSkyView;
            }
            if (this.sunSprite) {
                this.sunSprite.visible = hasSkyView;
            }
            if (this.moonSprite) {
                this.moonSprite.visible = hasSkyView;
            }
        }
    }

    initMods() {
        if (window.ModManager && !this.modManager) {
            this.modManager = new window.ModManager(this);
            window.modManager = this.modManager;
            this.vehicleManager = this.modManager.vehicleManager;
        }
    }
}

window.Game = Game;

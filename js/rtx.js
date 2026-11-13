// RTX ON — cinematic render pipeline layered on top of the 64px PBR textures (textures.js).
//
//  scene.environment      procedural HDR sky (PMREM) so metal/clearcoat maps have something to reflect
//  ACES Filmic + sRGB     applied in the final HDR pass (scene is rendered to a half-float target)
//  PCFSoftShadowMap sun   low-angle golden-hour DirectionalLight, 2048 map, wide frustum -> long shadows
//  HemisphereLight        sky-blue top bounce / dirt-brown bottom bounce
//  Scene pass + depth SSAO contact shadows in block corners & under foliage: ONE scene render into an HDR target that keeps its depth
//                         texture, then a half-res depth-only AO + depth-aware blur (no second normals pass, unlike three's SSAOPass)
//  SSRPass                screen-space reflections on water, half-res and only while water is actually near the camera
//  UnrealBloomPass        HDR selective bloom (threshold > 1.0; 2.2 here because lit white blocks already reach ~2): sun glints + emissive pixels only
//  God rays               screen-space radial blur from the sun, occluded by trees/hills
//  FogExp2                horizon-tinted atmospheric haze (colour already follows the sky)
//  Colour grading         contrast / vibrance / warm-cool split toning (LUT-style, in the final pass)
//  SMAAPass               anti-aliasing of the final image
//  POM                    parallax occlusion mapping lives in textures.js (makePomHook)
//
// Performance (target: max settings >= 30 fps on an M1 / >= 20 fps on an RTX 3060, usually far more):
//  * adaptive internal resolution (pixel budget at start + frame-time controller), restored when the frame time recovers
//  * heavy effects are gated: SSR only with water in view, shadow map refreshed every 1-3 frames by frame time
//  * quality tiers 3..0 shed SSR -> SSAO/SMAA -> bloom/god rays when even the minimum resolution is not enough
// The post stack is loaded lazily (rtx_vendor.js = three r128 example passes) the first time RTX is switched on.
class RTXPipeline {
    constructor(game) {
        this.game = game;
        this.parts = RTXPipeline.loadParts();
        this.cfg = RTXPipeline.loadCfg();
        this.fgPhase = 0;          // frame generation: 0 = render a real frame next, 1 = present a reprojected one
        this.fgRT = null;
        this.fgCam = null;
        this.active = false;
        this.loading = false;
        this.composer = null;
        this.saved = null;
        this.quality = 3;          // 3 = everything, 2 = no SSR, 1 = no SSAO/SSR, 0 = lights only
        this.slowFrames = 0;
        this.fastFrames = 0;
        this.waterMeshes = [];
        this.waterNear = false;
        this.frame = 0;
        this.resScale = 1;         // internal resolution multiplier (dynamic, only when the FSR upscaler is off)
        this.baseScale = 1;        // best scale for this screen (pixel budget); the controller climbs back to it
        this.minScale = this.cfg.minScale;
        this.ema = 0;              // smoothed frame time (ms)
        this.cool = 0;
        this._shadowTick = 0;
        this._sunNdc = new THREE.Vector3();
    }

    part(id) { return this.parts[id] !== false; }

    // Toggle one effect live. Scene-level parts are re-applied, material parts rebuild the chunk meshes.
    setPart(id, on) {
        this.parts[id] = !!on;
        try { localStorage.setItem('eblankraft_rtx_parts', JSON.stringify(this.parts)); } catch (e) {}
        const tm = this.game.textureManager;
        if (id === 'pbr' || id === 'pom') { if (tm && tm.refreshPbr) tm.refreshPbr(); }
        if (this.active) this.applyParts();
    }

    setAllParts(on) {
        for (const p of RTXPipeline.PARTS) this.parts[p.id] = !!on;
        try { localStorage.setItem('eblankraft_rtx_parts', JSON.stringify(this.parts)); } catch (e) {}
        const tm = this.game.textureManager;
        if (tm && tm.refreshPbr) tm.refreshPbr();
        if (this.active) this.applyParts();
    }

    supported() {
        const g = this.game;
        return !!(g && g.renderer && !g.isA02Mode && !g.turboFPS && !g.isUL20FT);
    }

    setEnabled(on) {
        if (on) this.enable(); else this.disable();
    }

    loadVendor() {
        if (window.__rtxVendor) return window.__rtxVendor;
        window.__rtxVendor = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'js/rtx_vendor.js?v=1';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('rtx_vendor.js failed to load'));
            document.head.appendChild(s);
        });
        return window.__rtxVendor;
    }

    enable() {
        if (this.active || this.loading || !this.supported()) return;
        this.loading = true;
        this.loadVendor().then(() => {
            this.loading = false;
            if (!(window.game && window.game.textureManager ? window.game.textureManager.textureX64 : true)) return;
            this.start();
        }).catch((e) => {
            this.loading = false;
            console.warn('[RTX] post stack unavailable, using lights/PBR only:', e.message);
            this.startLightsOnly();
        });
    }

    // ---- scene-level setup (lights, shadows, environment, fog) ----
    applySceneSetup() {
        const g = this.game, r = g.renderer, scene = g.scene;
        if (!this.saved) {
            this.saved = {
                env: scene.environment,
                fog: scene.fog,
                toneMapping: r.toneMapping,
                exposure: r.toneMappingExposure,
                shadowType: r.shadowMap.type,
                mapSize: g.sunLight ? g.sunLight.shadow.mapSize.x : 1024,
                d: g.sunLight ? g.sunLight.shadow.camera.right : 38,
                far: g.sunLight ? g.sunLight.shadow.camera.far : 180
            };
        }
        r.outputEncoding = THREE.sRGBEncoding;           // r128 name of SRGBColorSpace
        this.active = true;
        this.applyParts();
    }

    // (Re)applies every scene-level part from this.parts: shadows, environment, fog, post-pass switches.
    applyParts() {
        const g = this.game, r = g.renderer, scene = g.scene, s = this.saved;
        if (!s) return;
        const env = this.part('env') && g.textureManager && g.textureManager.ensureEnvironment();
        scene.environment = env || s.env || null;
        if (this.part('fog')) { if (!scene.fog) scene.fog = new THREE.FogExp2(0x80bfff, 0.018); }
        else if (scene.fog && !s.fog) scene.fog = null;
        else if (s.fog) scene.fog = s.fog;
        const sl = g.sunLight;
        if (sl) {
            const on = this.part('shadows');
            const size = on ? 2048 : s.mapSize, d = on ? 56 : s.d, far = on ? 260 : s.far;
            r.shadowMap.type = on ? THREE.PCFSoftShadowMap : s.shadowType;
            if (sl.shadow.mapSize.x !== size) {
                sl.shadow.mapSize.set(size, size);
                if (sl.shadow.map) { sl.shadow.map.dispose(); sl.shadow.map = null; }
            }
            const c = sl.shadow.camera;
            c.left = -d; c.right = d; c.top = d; c.bottom = -d; c.far = far;
            c.updateProjectionMatrix();
            sl.shadow.radius = on ? 2.5 : 1;
            r.shadowMap.needsUpdate = true;
        }
        this.applyQuality();
    }

    startLightsOnly() {
        this.applySceneSetup();
        this.composer = null;
    }

    start() {
        this.applySceneSetup();
        const g = this.game, r = g.renderer;
        this.computeBaseScale();
        const size = this.targetSize();
        const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
            type: THREE.HalfFloatType, format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
        });
        const composer = new THREE.EffectComposer(r, rt);
        composer.setPixelRatio(1);
        composer.setSize(size.x, size.y);
        const w = size.x, h = size.y;

        this.scenePass = null;
        this.ssao = null;
        if (RTXPipeline.depthSupported(r)) {
            this.scenePass = RTXPipeline.makeScenePass(g.scene, g.camera, w, h);
            composer.addPass(this.scenePass);
        } else {   // very old GPUs without depth textures: stock three.js passes
            composer.addPass(new THREE.RenderPass(g.scene, g.camera));
            this.ssao = new THREE.SSAOPass(g.scene, g.camera, w, h);
            this.ssao.kernelRadius = 0.9;
            this.ssao.minDistance = 0.0006;
            this.ssao.maxDistance = 0.012;
            this.ssao.kernelSize = 12;
            composer.addPass(this.ssao);
        }

        this.ssr = null;
        try {
            // half resolution: reflections are blurred anyway and SSR re-renders the scene several times
            this.ssr = new THREE.SSRPass({ renderer: r, scene: g.scene, camera: g.camera, width: Math.max(2, w >> 1), height: Math.max(2, h >> 1), selects: [], groundReflector: null });
            const ssrSetSize = this.ssr.setSize.bind(this.ssr);
            this.ssr.setSize = (sw, sh) => ssrSetSize(Math.max(2, sw >> 1), Math.max(2, sh >> 1));
            this.ssr.enabled = false;          // switched on by updateWater() when water is near
            this.ssr.maxDistance = 40;
            this.ssr.thickness = 0.04;
            this.ssr.opacity = 0.55;
            this.ssr.output = THREE.SSRPass.OUTPUT.Default;
            composer.addPass(this.ssr);
        } catch (e) { console.warn('[RTX] SSR unavailable:', e.message); this.ssr = null; }

        // HDR selective bloom: only pixels brighter than 1.0 (sun glints on metal, emissive blocks).
        this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.55, 2.2);
        composer.addPass(this.bloom);

        this.godrays = new THREE.ShaderPass(RTXPipeline.GodRayShader());
        composer.addPass(this.godrays);

        this.final = new THREE.ShaderPass(RTXPipeline.FinalShader());
        composer.addPass(this.final);

        this.smaa = new THREE.SMAAPass(w, h);
        composer.addPass(this.smaa);

        this.composer = composer;
        this.quality = 3;
        this.ema = 0; this.cool = 60;
        this.applyQuality();
    }

    disable() {
        if (!this.active && !this.composer) { this.loading = false; return; }
        const g = this.game, r = g.renderer, scene = g.scene, s = this.saved;
        if (this.composer) {
            for (const p of this.composer.passes) if (p.dispose) { try { p.dispose(); } catch (e) {} }
            if (this.composer.renderTarget1) this.composer.renderTarget1.dispose();
            if (this.composer.renderTarget2) this.composer.renderTarget2.dispose();
            this.composer = null;
        }
        this.scenePass = null; this.ssao = null; this.ssr = null; this.disposeFG();
        r.shadowMap.autoUpdate = true;
        if (s) {
            scene.environment = s.env || null;
            if (!s.fog) scene.fog = null;
            r.toneMapping = s.toneMapping;
            r.toneMappingExposure = s.exposure;
            r.shadowMap.type = s.shadowType;
            const sl = g.sunLight;
            if (sl) {
                sl.shadow.mapSize.set(s.mapSize, s.mapSize);
                if (sl.shadow.map) { sl.shadow.map.dispose(); sl.shadow.map = null; }
                const c = sl.shadow.camera;
                c.left = -s.d; c.right = s.d; c.top = s.d; c.bottom = -s.d; c.far = s.far;
                c.updateProjectionMatrix();
                sl.shadow.radius = 1;
            }
        }
        this.saved = null;
        this.active = false;
    }

    applyQuality() {
        const q = this.quality;
        if (this.scenePass) this.scenePass.aoOn = q >= 1 && this.part('ssao');
        if (this.ssao) this.ssao.enabled = q >= 1 && this.part('ssao');
        if (this.ssr) this.ssr.enabled = q >= 3 && this.part('ssr') && this.waterNear;
        if (this.bloom) this.bloom.enabled = q >= 1 && this.part('bloom');
        const u = this.final && this.final.uniforms;
        const c = this.cfg;
        if (u) {
            u.useAces.value = this.part('aces') ? 1 : 0; u.useGrade.value = this.part('grade') ? 1 : 0;
            u.exposure.value = c.exposure; u.contrast.value = c.contrast; u.vibrance.value = c.vibrance;
        }
        if (this.bloom) { this.bloom.strength = c.bloomStrength; this.bloom.radius = c.bloomRadius; this.bloom.threshold = c.bloomThreshold; }
        if (this.ssr) { this.ssr.opacity = c.ssrOpacity; this.ssr.maxDistance = c.ssrDistance; }
        if (this.scenePass) { const au = this.scenePass.aoMat.uniforms; au.radius.value = c.aoRadius; au.intensity.value = c.aoIntensity; }
        window.RTX_POM.value = c.pomDepth;
    }

    setCfg(key, value) {
        this.cfg[key] = value;
        try { localStorage.setItem('eblankraft_rtx_cfg', JSON.stringify(this.cfg)); } catch (e) {}
        if (key === 'frameGen') { this.fgPhase = 0; if (!value) this.disposeFG(); }
        if (key === 'minScale') { this.minScale = value; this.setResScale(this.resScale); }
        if (key === 'dynRes' && !value) this.setResScale(this.baseScale);
        if (this.active) this.applyQuality();
    }

    // Pixel budget: ~2.4 MP internal (1080p-class) is plenty for the full stack; retina / 4K screens start lower and the
    // frame-time controller (render()) moves within [minScale, baseScale] from there.
    computeBaseScale() {
        const v = new THREE.Vector2();
        this.game.renderer.getDrawingBufferSize(v);
        const px = Math.max(1, v.x * v.y);
        this.baseScale = Math.max(this.minScale, Math.min(1, Math.sqrt(2.4e6 / px)));
        if (!(this.resScale > 0) || this.resScale > this.baseScale) this.resScale = this.baseScale;
    }

    setResScale(s) {
        s = Math.max(this.minScale, Math.min(this.baseScale, s));
        if (Math.abs(s - this.resScale) < 0.01) return false;
        this.resScale = s;
        this.syncSize();
        return true;
    }

    // Internal resolution: the drawing buffer, or the upscaler's lower render size when it is on.
    targetSize() {
        const up = this.game.upscaler;
        if (up && up.active) return up.inSize();
        const v = new THREE.Vector2();
        this.game.renderer.getDrawingBufferSize(v);
        v.x = Math.max(2, Math.floor(v.x * this.resScale));
        v.y = Math.max(2, Math.floor(v.y * this.resScale));
        return v;
    }

    syncSize() {
        if (!this.composer) return;
        const s = this.targetSize();
        this.composer.setSize(s.x, s.y);
    }

    setSize() { this.computeBaseScale(); this.syncSize(); }

    // Golden-hour sun + sky/ground bounce. Runs after the day-cycle code, only by day/sunset.
    adjustLights() {
        const g = this.game, sl = g.sunLight;
        if (!sl || sl.intensity < 0.3 || !this.part('sun')) return;
        const t = sl.target.position;
        const dx = sl.position.x - t.x, dz = sl.position.z - t.z;
        const horiz = Math.hypot(dx, dz) || 1;
        sl.position.y = t.y + horiz * Math.tan(this.cfg.sunElevation * Math.PI / 180);   // low sun -> long shadows
        sl.color.setHex(0xffc785);
        sl.intensity = this.cfg.sunIntensity;
        if (g.hemiLight) {
            g.hemiLight.color.setHex(0x8cbcff);        // sky-blue top bounce
            g.hemiLight.groundColor.setHex(0x4a3720);  // dirt/grass bottom bounce
            g.hemiLight.intensity = 0.55;
        }
        if (g.ambientLight) g.ambientLight.intensity *= 0.5;   // deeper shadows, fill comes from the hemisphere
    }

    // Water meshes within SSR range (visible = inside the view frustum, see Game.performFrustumAndOcclusionCulling).
    // SSR re-renders the scene several times, so it is only enabled while some water is actually near the camera.
    updateWaterMeshes() {
        const out = [];
        const g = this.game, chunks = g.world && g.world.chunks;
        const cp = g.camera ? g.camera.position : null;
        if (chunks && cp) {
            const S = window.CHUNK_SIZE_X || 16;
            for (const k in chunks) {
                const c = chunks[k], m = c && c.waterMesh;
                if (!m || m.visible === false) continue;
                const dx = (c.cx + 0.5) * S - cp.x, dz = (c.cz + 0.5) * S - cp.z;
                if (dx * dx + dz * dz < 52 * 52) out.push(m);
            }
        }
        this.waterMeshes = out;
        this.waterNear = out.length > 0 && !(g.player && g.player.isSubmerged);
        if (this.ssr) {
            this.ssr.selects = out;
            this.ssr.enabled = this.quality >= 3 && this.part('ssr') && this.waterNear;
        }
    }

    // Returns true if it rendered the frame.
    render(dtMs) {
        if (!this.active) return false;
        const g = this.game, r = g.renderer;
        const fg = !!(this.cfg.frameGen && this.composer && this.scenePass);
        if (fg && this.fgPhase === 1 && this.fgCam) {      // generated frame: no scene render at all, just warp the last real one
            this.fgPhase = 0;
            this.presentFG(true);
            this.adapt(dtMs, !!(g.upscaler && g.upscaler.active));
            return true;
        }
        this.adjustLights();
        if (!this.composer) { return false; }       // lights-only fallback: normal renderer path
        this.frame++;
        if (this.frame % 8 === 1) this.updateWaterMeshes();
        this.throttleShadows(dtMs);

        // render the scene in linear HDR, tone-map/encode in the final pass
        r.toneMapping = THREE.NoToneMapping;
        if (this.final && g.scene.background && g.scene.background.isColor) this.final.uniforms.skyColor.value.copy(g.scene.background);
        if (this.godrays) this.updateGodRays();
        const up = g.upscaler && g.upscaler.active ? g.upscaler : null;
        this.composer.renderToScreen = !up && !fg;     // with the upscaler / frame generation the stack ends in a texture, not the canvas
        if (this.smaa) this.smaa.enabled = !up && this.quality >= 2 && this.part('smaa'); // the upscaler does its own edge reconstruction
        const hidden = this.updateSky(dtMs);
        this.composer.render();
        for (const [o, v] of hidden) o.visible = v;
        if (fg) { this.fgPhase = 1; this.presentFG(false); }
        else if (up) up.present(this.composer.readBuffer.texture);

        this.adapt(dtMs, !!up);
        return true;
    }

    // ---- frame generation (camera reprojection) ----
    // Real frame N is rendered and kept (colour + depth + camera pose). The next vsync is a "generated" frame: every pixel looks up
    // where its world point was in frame N (3 fixed-point iterations over the depth buffer), using the CURRENT camera. Camera
    // motion therefore stays smooth at twice the rendered rate and adds no latency (it extrapolates, it never waits for N+1).
    // Pixels closer than ~1.3 blocks (hands / held item) stay screen-locked. Moving mobs advance on real frames only.
    ensureFG() {
        const size = this.composer.renderTarget1;
        if (!this.fgMat) {
            this.fgMat = new THREE.ShaderMaterial({
                uniforms: { tColor: { value: null }, tDepth: { value: null }, oldWorld: { value: new THREE.Matrix4() }, newView: { value: new THREE.Matrix4() }, newProj: { value: new THREE.Matrix4() },
                    oldScale: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: 0.1 }, cameraFar: { value: 500 }, warp: { value: 1 } },
                vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
                depthTest: false, depthWrite: false,
                fragmentShader: `
                    uniform sampler2D tColor, tDepth; uniform mat4 oldWorld, newView, newProj; uniform vec2 oldScale; uniform float cameraNear, cameraFar, warp;
                    varying vec2 vUv;
                    float viewZ(float d) { return (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar); }
                    void main() {
                        vec2 s = vUv;
                        if (warp > 0.5) {
                            for (int i = 0; i < 4; i++) {
                                float d = texture2D(tDepth, s).x;
                                float z = d >= 0.99999 ? -cameraFar : viewZ(d);
                                if (-z < 1.3) { s = vUv; break; }
                                vec3 pw = (oldWorld * vec4((s * 2.0 - 1.0) / oldScale * -z, z, 1.0)).xyz;
                                vec4 pc = newProj * (newView * vec4(pw, 1.0));
                                s += vUv - (pc.xy / pc.w * 0.5 + 0.5);
                            }
                        }
                        gl_FragColor = vec4(texture2D(tColor, clamp(s, 0.001, 0.999)).rgb, 1.0);
                    }`
            });
            this.fgQuad = new THREE.FullScreenQuad(this.fgMat);
        }
        const w = size.width, h = size.height, up = this.game.upscaler && this.game.upscaler.active;
        if (up && (!this.fgRT || this.fgRT.width !== w || this.fgRT.height !== h)) {
            if (this.fgRT) this.fgRT.dispose();
            this.fgRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
            this.fgRT.texture.encoding = THREE.sRGBEncoding;
        }
    }

    // generated = warp with the current camera; otherwise (a real frame) show the image as rendered and remember its pose.
    presentFG(generated) {
        const g = this.game, r = g.renderer, cam = g.camera, c = this.composer, u = this.fgMat ? this.fgMat.uniforms : null;
        this.ensureFG();
        const mu = this.fgMat.uniforms;
        if (!generated) {
            // SMAA does not swap buffers: when it is the last enabled pass its output sits in the write buffer
            this.fgTex = (this.smaa && this.smaa.enabled) ? c.writeBuffer.texture : c.readBuffer.texture;
            cam.updateMatrixWorld();
            if (!this.fgCam) this.fgCam = new THREE.Matrix4();
            this.fgCam.copy(cam.matrixWorld);
            mu.oldScale.value.set(cam.projectionMatrix.elements[0], cam.projectionMatrix.elements[5]);
            mu.cameraNear.value = cam.near; mu.cameraFar.value = cam.far;
        } else {
            cam.updateMatrixWorld();
            mu.newView.value.copy(cam.matrixWorldInverse);
            mu.newProj.value.copy(cam.projectionMatrix);
        }
        mu.oldWorld.value.copy(this.fgCam);
        mu.tColor.value = this.fgTex;
        mu.tDepth.value = this.scenePass.sceneRT.depthTexture;
        mu.warp.value = generated ? 1 : 0;
        const up = g.upscaler && g.upscaler.active ? g.upscaler : null;
        r.toneMapping = THREE.NoToneMapping;
        r.setRenderTarget(up ? this.fgRT : null);
        this.fgQuad.render(r);
        if (up) up.present(this.fgRT.texture);
    }

    disposeFG() {
        if (this.fgRT) { this.fgRT.dispose(); this.fgRT = null; }
        this.fgCam = null; this.fgTex = null;
    }

    // The shadow map is a second full geometry pass. Refresh it every frame while the frame is cheap, every 2nd/3rd when it is not.
    throttleShadows(dtMs) {
        const sm = this.game.renderer.shadowMap;
        if (!sm.enabled) return;
        sm.autoUpdate = false;
        const interval = this.ema > 34 ? 3 : this.ema > 24 ? 2 : 1;
        if (++this._shadowTick >= interval) { this._shadowTick = 0; sm.needsUpdate = true; }
    }

    // Frame-time controller (target >= 30 fps). Order of sacrifice: internal resolution (cheapest to the eye) -> effect tiers.
    // Recovery runs the other way round, with wide hysteresis (38 ms down / 22 ms up) so it does not oscillate.
    adapt(dtMs, upscalerOn) {
        const dt = Math.min(dtMs, 250);
        this.ema = this.ema ? this.ema * 0.9 + dt * 0.1 : dt;
        if (this.cool > 0) { this.cool--; return; }
        if (this.cfg.dynRes === false) return;
        const slowAt = 1150 / this.cfg.targetFps, fastAt = 660 / this.cfg.targetFps;     // 30 fps -> 38 ms / 22 ms
        if (this.ema > slowAt) { this.slowFrames++; this.fastFrames = 0; }
        else if (this.ema < fastAt) { this.fastFrames++; this.slowFrames = 0; }
        else { this.slowFrames = 0; this.fastFrames = 0; }
        if (this.slowFrames > 24) {
            this.slowFrames = 0; this.cool = 45;
            const step = this.ema > 60 ? 0.15 : 0.08;
            if (upscalerOn || !this.setResScale(this.resScale - step)) {
                if (this.quality > 0) { this.quality--; this.applyQuality(); }
            }
        } else if (this.fastFrames > 240) {
            this.fastFrames = 0; this.cool = 45;
            if (this.quality < 3) { this.quality++; this.applyQuality(); }
            else if (!upscalerOn && this.resScale < this.baseScale - 0.01) this.setResScale(this.resScale + 0.05);
        }
    }

    // RTX sky + clouds (rtx_sky.js): feed the final pass the view/sun/moon state and hide the legacy sky objects while it is on.
    // Returns [object, previousVisibility] pairs to restore after the frame is drawn.
    updateSky(dtMs) {
        const g = this.game, u = this.final && this.final.uniforms;
        if (!u || !window.RTX_SKY_GLSL) return [];
        const dim = (g.world && g.world.dimension) || 'overworld';
        const on = this.part('sky') && !(g.player && g.player.isSubmerged) && !!(g.scene.background && g.scene.background.isColor);
        u.skyOn.value = on ? 1 : 0;
        u.skyMode.value = dim === 'nether' ? 1 : dim === 'the_end' ? 2 : 0;
        this.godrays.enabled = on || this.godrays.enabled;   // the god-ray pass also writes the sky mask the final pass reads
        if (!on) return [];
        const cam = g.camera;
        cam.updateMatrixWorld();
        u.skyInvProj.value.copy(cam.projectionMatrixInverse);
        u.skyCamWorld.value.copy(cam.matrixWorld);
        u.skyCamPos.value.setFromMatrixPosition(cam.matrixWorld);
        const a = (g.timeOfDay || 0) * Math.PI * 2;
        const aim = (sprite, x, y, z, out) => {
            if (sprite) out.copy(sprite.position).sub(u.skyCamPos.value); else out.set(x, y, z);
            if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
            out.normalize();
        };
        aim(g.sunSprite, Math.cos(a), Math.sin(a), 0.3, u.skySun.value);
        aim(g.moonSprite, -Math.cos(a), -Math.sin(a), -0.3, u.skyMoon.value);
        u.skyTime.value += (dtMs || 16) / 1000;
        u.skyClouds.value = g.cloudsEnabled === false ? 0 : 1;
        const hidden = [];
        for (const o of [g.sunSprite, g.moonSprite, g.starfield, g.cloudMesh]) if (o) { hidden.push([o, o.visible]); o.visible = false; }
        return hidden;
    }

    updateGodRays() {
        const g = this.game, u = this.godrays.uniforms;
        const sun = g.sunSprite;
        if (g.scene.background && g.scene.background.isColor) u.skyColor.value.copy(g.scene.background);   // also feeds the sky mask
        let on = 0;
        const dimension = (g.world && g.world.dimension) || 'overworld';
        if (this.part('godrays') && sun && g.sunLight && g.sunLight.intensity > 0.3 && dimension !== 'nether' && dimension !== 'the_end' && g.scene.background && g.scene.background.isColor && !(g.player && g.player.isSubmerged)) {
            this._sunNdc.copy(sun.position).project(g.camera);
            if (this._sunNdc.z < 1) {
                u.sunPos.value.set(this._sunNdc.x * 0.5 + 0.5, this._sunNdc.y * 0.5 + 0.5);
                u.skyColor.value.copy(g.scene.background);
                on = 1;
            }
        }
        u.strength.value = on ? 0.14 * this.cfg.godrayStrength : 0.0;
        this.godrays.enabled = !!on;
    }

    // ---- shaders ----
    static GodRayShader() {
        return {
            uniforms: {
                tDiffuse: { value: null },
                sunPos: { value: new THREE.Vector2(0.5, 0.5) },
                skyColor: { value: new THREE.Color(0.5, 0.7, 1) },
                strength: { value: 0.35 }
            },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `
                uniform sampler2D tDiffuse; uniform vec2 sunPos; uniform vec3 skyColor; uniform float strength;
                varying vec2 vUv;
                // "sky-ness": the clear colour (+ sun disc / fog haze) counts as light, blocks/trees occlude it
                float sky(vec3 c) { float d = distance(c, skyColor); return 1.0 - smoothstep(0.015, 0.09, d); }
                void main() {
                    vec4 base = texture2D(tDiffuse, vUv);
                    vec3 shaft = vec3(0.0);
                    if (strength > 0.001) {
                        vec2 delta = (vUv - sunPos) / 20.0 * 0.85;
                        vec2 uv = vUv;
                        float illum = 1.0, acc = 0.0;
                        for (int i = 0; i < 20; i++) {
                            uv -= delta;
                            acc += sky(texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb) * illum;
                            illum *= 0.91;
                        }
                        float fall = smoothstep(1.4, 0.0, distance(vUv, sunPos));
                        shaft = vec3(1.0, 0.78, 0.5) * acc / 20.0 * fall * strength * 2.2;
                    }
                    // alpha = sky mask, read by the final pass (RTX sky replaces exactly these pixels)
                    gl_FragColor = vec4(base.rgb + shaft, sky(base.rgb));
                }`
        };
    }

    static FinalShader() {
        return {
            defines: window.RTX_SKY_GLSL ? { RTX_SKY: '' } : {},
            uniforms: {
                tDiffuse: { value: null }, skyColor: { value: new THREE.Color(0.5, 0.7, 1) }, exposure: { value: 1.05 }, contrast: { value: 1.08 }, vibrance: { value: 0.22 },
                skyInvProj: { value: new THREE.Matrix4() }, skyCamWorld: { value: new THREE.Matrix4() }, skyCamPos: { value: new THREE.Vector3() },
                skySun: { value: new THREE.Vector3(0, 1, 0) }, skyMoon: { value: new THREE.Vector3(0, -1, 0) },
                skyTime: { value: 0 }, skyOn: { value: 0 }, skyClouds: { value: 1 }, skyMode: { value: 0 },
                useAces: { value: 1 }, useGrade: { value: 1 }
            },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `
                uniform sampler2D tDiffuse; uniform vec3 skyColor; uniform float exposure, contrast, vibrance, useAces, useGrade;
                varying vec2 vUv;
                ${window.RTX_SKY_GLSL || 'uniform float skyOn;'}
                // three.js' own ACES Filmic curve (identical look to renderer.toneMapping = ACESFilmicToneMapping)
                vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
                vec3 aces(vec3 color) {
                    const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
                    const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
                    color *= exposure / 0.6;
                    color = ACESOutputMat * RRTAndODTFit(ACESInputMat * color);
                    return clamp(color, 0.0, 1.0);
                }
                vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
                void main() {
                    vec3 c = texture2D(tDiffuse, vUv).rgb * exposure;
                    vec3 raw = texture2D(tDiffuse, vUv).rgb;
                    // the clear colour (sky) is never tone-mapped/encoded by the stock renderer: keep it exactly as authored
                    float skyMask = 1.0 - smoothstep(0.004, 0.03, distance(raw, skyColor));
                    vec3 lit = toSRGB(useAces > 0.5 ? aces(max(c, 0.0)) : clamp(c, 0.0, 1.0));           // ACES Filmic tone mapping + sRGB output
                    vec3 skyOut = clamp(raw, 0.0, 1.0);
                    #ifdef RTX_SKY
                    float skyA = texture2D(tDiffuse, vUv).a;      // sky mask from the god-ray pass
                    if (skyOn > 0.5) {
                        skyMask = skyA;
                        if (skyA > 0.002) {
                            // horizon colour = the fog colour as the terrain shows it (tone-mapped), so far hills blend in
                            vec3 horizon = toSRGB(aces(max(skyColor, 0.0)));
                            skyOut = clamp(sk_shade(vUv, horizon) + max(raw - skyColor, 0.0), 0.0, 1.0);
                        }
                    }
                    #endif
                    c = mix(lit, skyOut, skyMask);
                    // colour grade (LUT-style): vibrance, contrast, cool shadows / warm highlights
                    if (useGrade < 0.5) { gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); return; }
                    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
                    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
                    c = mix(vec3(l), c, 1.0 + vibrance * (1.0 - sat));
                    c = (c - 0.5) * contrast + 0.5;
                    c *= mix(vec3(0.95, 0.99, 1.05), vec3(1.04, 1.0, 0.95), smoothstep(0.15, 0.85, l));
                    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
                }`
        };
    }
}
// Every RTX effect is an independent "part" the player can toggle in the RTX tab of the pause menu.
// (master switch = textureManager.textureX64: 64px textures; the parts below only matter while it is on)
RTXPipeline.PARTS = [
    { id: 'pbr',      group: 'mat',   icon: '🪨', name: 'PBR-матеріали',        note: 'Нормалі, шорсткість, метал, AO, свічення блоків' },
    { id: 'pom',      group: 'mat',   icon: '🕳️', name: 'Паралакс (POM)',       note: 'Справжня глибина борозен у текстурах' },
    { id: 'sun',      group: 'light', icon: '🌇', name: 'Золоте сонце',         note: 'Низьке тепле сонце, довгі тіні, відблиск неба' },
    { id: 'shadows',  group: 'light', icon: '🌑', name: 'М’які тіні 2K',        note: 'Тіні 2048 з м’яким краєм і більшою дальністю' },
    { id: 'env',      group: 'light', icon: '🔮', name: 'Відбиття неба',        note: 'Метал і лак відбивають небо та сонце' },
    { id: 'fog',      group: 'light', icon: '🌫️', name: 'Атмосферна імла',      note: 'Експоненційний туман кольору горизонту' },
    { id: 'ssao',     group: 'post',  icon: '🧊', name: 'SSAO',                 note: 'Контактні тіні в кутах і під листям' },
    { id: 'ssr',      group: 'post',  icon: '🌊', name: 'Відбиття у воді (SSR)', note: 'Екранні відбиття на воді' },
    { id: 'bloom',    group: 'post',  icon: '✨', name: 'Bloom',                note: 'Сяйво яскравих пікселів: сонце, лава, емісія' },
    { id: 'godrays',  group: 'post',  icon: '🌅', name: 'Промені сонця',        note: 'Об’ємні промені крізь дерева й гори' },
    { id: 'sky',      group: 'post',  icon: '☁️', name: 'RTX небо і хмари',     note: 'Процедурна атмосфера, зорі, хмари' },
    { id: 'aces',     group: 'post',  icon: '🎞️', name: 'ACES тонмепінг',       note: 'Кінематографічний HDR → екран' },
    { id: 'grade',    group: 'post',  icon: '🎨', name: 'Кольорокорекція',      note: 'Контраст, соковитість, тепло-холодне тонування' },
    { id: 'smaa',     group: 'post',  icon: '📐', name: 'SMAA згладжування',    note: 'Прибирає «драбинки» на краях' }
];
RTXPipeline.GROUPS = { mat: '🧱 Матеріали', light: '💡 Світло і довкілля', post: '🎬 Постобробка' };
RTXPipeline.loadParts = function () {
    const o = {};
    for (const p of RTXPipeline.PARTS) o[p.id] = true;
    try { Object.assign(o, JSON.parse(localStorage.getItem('eblankraft_rtx_parts') || '{}')); } catch (e) {}
    return o;
};

RTXPipeline.CFG_DEFAULTS = {
    exposure: 1.05, contrast: 1.08, vibrance: 0.22,
    bloomStrength: 0.6, bloomRadius: 0.55, bloomThreshold: 2.2,
    godrayStrength: 1, sunElevation: 21, sunIntensity: 1.2, shadowBias: -0.0005,
    aoRadius: 1.1, aoIntensity: 1.25, ssrOpacity: 0.55, ssrDistance: 40, pomDepth: 1,
    dynRes: true, targetFps: 30, minScale: 0.5, frameGen: false
};
RTXPipeline.loadCfg = function () {
    const o = Object.assign({}, RTXPipeline.CFG_DEFAULTS);
    try { Object.assign(o, JSON.parse(localStorage.getItem('eblankraft_rtx_cfg') || '{}')); } catch (e) {}
    return o;
};
window.RTX_POM = window.RTX_POM || { value: 1 };

RTXPipeline.depthSupported = function (r) {
    try { return !!(r.capabilities.isWebGL2 || r.extensions.has('WEBGL_depth_texture')); } catch (e) { return false; }
};

// One scene render into an HDR target that keeps a depth texture, then (optionally) a half-res depth-only ambient
// occlusion + depth-aware 4x4 blur, written to the composer's write buffer. Replaces RenderPass + SSAOPass (which draws the
// whole scene a second time just to get normals): normals are rebuilt from depth derivatives, which is exact for flat voxel faces.
RTXPipeline.makeScenePass = function (scene, camera, w, h) {
    const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const DEPTH = `
        uniform float cameraNear, cameraFar;
        float viewZ(float d) { return (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar); }`;
    class RTXScenePass extends THREE.Pass {
        constructor() {
            super();
            this.needsSwap = true;
            this.aoOn = true;
            this.renderPass = new THREE.RenderPass(scene, camera);
            this.w = 0; this.h = 0;
            this.quad = new THREE.FullScreenQuad(null);
            this.aoMat = new THREE.ShaderMaterial({
                extensions: { derivatives: true },
                uniforms: { tDepth: { value: null }, cameraNear: { value: 0.1 }, cameraFar: { value: 500 }, projScale: { value: new THREE.Vector2(1, 1) }, radius: { value: 1.1 }, intensity: { value: 1.25 } },
                vertexShader: VS, depthTest: false, depthWrite: false,
                fragmentShader: `
                    uniform sampler2D tDepth; uniform vec2 projScale; uniform float radius, intensity;
                    ${DEPTH}
                    varying vec2 vUv;
                    vec3 viewPos(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) / projScale * -z, z); }
                    void main() {
                        float d = texture2D(tDepth, vUv).x;
                        if (d >= 0.99999) { gl_FragColor = vec4(1.0, -cameraFar, 0.0, 1.0); return; }
                        float z = viewZ(d);
                        float dist = -z;
                        if (dist > 70.0) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }
                        vec3 P = viewPos(vUv, z);
                        vec3 N = normalize(cross(dFdx(P), dFdy(P)));
                        vec2 fc = mod(floor(gl_FragCoord.xy), 4.0);
                        float rot = fract(52.9829189 * fract(dot(fc + 0.5, vec2(0.06711056, 0.00583715)))) * 6.2831853;
                        vec2 rad = clamp(radius / dist * projScale * 0.5, vec2(0.0015), vec2(0.09));
                        float occ = 0.0;
                        for (int i = 0; i < 12; i++) {
                            float fi = float(i) + 0.5;
                            float a = fi * 2.399963 + rot;
                            vec2 su = vUv + vec2(cos(a), sin(a)) * sqrt(fi / 12.0) * rad;
                            float sz = viewZ(texture2D(tDepth, su).x);
                            vec3 v = viewPos(su, sz) - P;
                            float len = length(v);
                            occ += max(0.0, dot(N, v) / max(len, 1e-4) - 0.2) * (1.0 - smoothstep(radius * 0.6, radius * 1.6, len));
                        }
                        float ao = clamp(1.0 - occ / 12.0 * intensity * 1.8, 0.0, 1.0);
                        ao = mix(ao, 1.0, smoothstep(40.0, 70.0, dist));
                        gl_FragColor = vec4(ao, z, 0.0, 1.0);
                    }`
            });
            this.compMat = new THREE.ShaderMaterial({
                uniforms: { tColor: { value: null }, tAO: { value: null }, tDepth: { value: null }, aoSize: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: 0.1 }, cameraFar: { value: 500 }, aoOn: { value: 1 } },
                vertexShader: VS, depthTest: false, depthWrite: false,
                fragmentShader: `
                    uniform sampler2D tColor, tAO, tDepth; uniform vec2 aoSize; uniform float aoOn;
                    ${DEPTH}
                    varying vec2 vUv;
                    void main() {
                        vec4 c = texture2D(tColor, vUv);
                        if (aoOn > 0.5) {
                            float d = texture2D(tDepth, vUv).x;
                            if (d < 0.99999) {
                                float z0 = viewZ(d);
                                vec2 i0 = floor(vUv * aoSize - 0.5);
                                float sum = 0.0, wsum = 0.0;
                                // the AO noise tile is 4x4 texels: averaging exactly one tile cancels it
                                for (int y = -1; y < 3; y++) {
                                    for (int x = -1; x < 3; x++) {
                                        vec2 a = texture2D(tAO, (i0 + vec2(float(x), float(y)) + 0.5) / aoSize).rg;
                                        float wt = exp(-abs(a.y - z0) / max(-z0, 0.1) * 60.0);
                                        sum += a.x * wt; wsum += wt;
                                    }
                                }
                                if (wsum > 1e-4) c.rgb *= sum / wsum;
                            }
                        }
                        gl_FragColor = c;
                    }`
            });
            this.build(w, h);
        }
        build(w, h) {
            this.disposeTargets();
            this.w = w; this.h = h;
            const dt = new THREE.DepthTexture(w, h);
            dt.type = THREE.UnsignedIntType;
            dt.minFilter = dt.magFilter = THREE.NearestFilter;
            this.sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
            this.sceneRT.depthTexture = dt;
            const aw = Math.max(2, w >> 1), ah = Math.max(2, h >> 1);
            this.aoRT = new THREE.WebGLRenderTarget(aw, ah, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
            this.compMat.uniforms.aoSize.value.set(aw, ah);
        }
        disposeTargets() {
            if (this.sceneRT) { if (this.sceneRT.depthTexture) this.sceneRT.depthTexture.dispose(); this.sceneRT.dispose(); }
            if (this.aoRT) this.aoRT.dispose();
        }
        setSize(w, h) { if (w !== this.w || h !== this.h) this.build(w, h); }
        dispose() { this.disposeTargets(); this.aoMat.dispose(); this.compMat.dispose(); this.quad.dispose(); }
        render(renderer, writeBuffer) {
            const sceneRT = this.sceneRT;
            this.renderPass.render(renderer, null, sceneRT);               // the only full scene draw of the stack
            const cu = this.aoMat.uniforms, mu = this.compMat.uniforms;
            const aoOn = this.aoOn;
            if (aoOn) {
                cu.tDepth.value = sceneRT.depthTexture;
                cu.cameraNear.value = camera.near; cu.cameraFar.value = camera.far;
                cu.projScale.value.set(camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]);
                this.quad.material = this.aoMat;
                renderer.setRenderTarget(this.aoRT);
                this.quad.render(renderer);
            }
            mu.tColor.value = sceneRT.texture; mu.tDepth.value = sceneRT.depthTexture; mu.tAO.value = this.aoRT.texture;
            mu.cameraNear.value = camera.near; mu.cameraFar.value = camera.far; mu.aoOn.value = aoOn ? 1 : 0;
            this.quad.material = this.compMat;
            renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
            this.quad.render(renderer);
        }
    }
    return new RTXScenePass();
};

window.RTXPipeline = RTXPipeline;

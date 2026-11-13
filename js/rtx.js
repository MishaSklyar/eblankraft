// RTX ON — cinematic render pipeline layered on top of the 64px PBR textures (textures.js).
//
//  scene.environment      procedural HDR sky (PMREM) so metal/clearcoat maps have something to reflect
//  ACES Filmic + sRGB     applied in the final HDR pass (scene is rendered to a half-float target)
//  PCFSoftShadowMap sun   low-angle golden-hour DirectionalLight, 2048 map, wide frustum -> long shadows
//  HemisphereLight        sky-blue top bounce / dirt-brown bottom bounce
//  SSAOPass               contact shadows in block corners & under foliage
//  SSRPass                screen-space reflections on water
//  UnrealBloomPass        HDR selective bloom (threshold > 1.0; 2.2 here because lit white blocks already reach ~2): sun glints + emissive pixels only
//  God rays               screen-space radial blur from the sun, occluded by trees/hills
//  FogExp2                horizon-tinted atmospheric haze (colour already follows the sky)
//  Colour grading         contrast / vibrance / warm-cool split toning (LUT-style, in the final pass)
//  SMAAPass               anti-aliasing of the final image
//  POM                    parallax occlusion mapping lives in textures.js (makePomHook)
//
// The post stack is loaded lazily (rtx_vendor.js = three r128 example passes) the first time RTX is switched on.
class RTXPipeline {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.loading = false;
        this.composer = null;
        this.saved = null;
        this.quality = 3;          // 3 = everything, 2 = no SSR, 1 = no SSAO/SSR, 0 = lights only
        this.slowFrames = 0;
        this.fastFrames = 0;
        this.waterMeshes = [];
        this.frame = 0;
        this._sunNdc = new THREE.Vector3();
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
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        const env = g.textureManager && g.textureManager.ensureEnvironment();
        if (env) scene.environment = env;
        if (!scene.fog) scene.fog = new THREE.FogExp2(0x80bfff, 0.018);
        const sl = g.sunLight;
        if (sl) {
            sl.shadow.mapSize.set(2048, 2048);
            if (sl.shadow.map) { sl.shadow.map.dispose(); sl.shadow.map = null; }
            const d = 56;
            const c = sl.shadow.camera;
            c.left = -d; c.right = d; c.top = d; c.bottom = -d; c.far = 260;
            c.updateProjectionMatrix();
            sl.shadow.radius = 2.5;
        }
        this.active = true;
    }

    startLightsOnly() {
        this.applySceneSetup();
        this.composer = null;
    }

    start() {
        this.applySceneSetup();
        const g = this.game, r = g.renderer;
        const size = this.targetSize();
        const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
            type: THREE.HalfFloatType, format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
        });
        const composer = new THREE.EffectComposer(r, rt);
        composer.setPixelRatio(1);
        composer.setSize(size.x, size.y);
        const w = size.x, h = size.y;

        composer.addPass(new THREE.RenderPass(g.scene, g.camera));

        this.ssao = new THREE.SSAOPass(g.scene, g.camera, w, h);
        this.ssao.kernelRadius = 0.9;
        this.ssao.minDistance = 0.0006;
        this.ssao.maxDistance = 0.012;
        composer.addPass(this.ssao);

        this.ssr = null;
        try {
            this.ssr = new THREE.SSRPass({ renderer: r, scene: g.scene, camera: g.camera, width: w, height: h, selects: [], groundReflector: null });
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
        if (this.ssao) this.ssao.enabled = q >= 1;
        if (this.ssr) this.ssr.enabled = q >= 3;
    }

    // Internal resolution: the drawing buffer, or the upscaler's lower render size when it is on.
    targetSize() {
        const up = this.game.upscaler;
        if (up && up.active) return up.inSize();
        const v = new THREE.Vector2();
        this.game.renderer.getDrawingBufferSize(v);
        return v;
    }

    syncSize() {
        if (!this.composer) return;
        const s = this.targetSize();
        this.composer.setSize(s.x, s.y);
    }

    setSize() { this.syncSize(); }

    // Golden-hour sun + sky/ground bounce. Runs after the day-cycle code, only by day/sunset.
    adjustLights() {
        const g = this.game, sl = g.sunLight;
        if (!sl || sl.intensity < 0.3) return;
        const t = sl.target.position;
        const dx = sl.position.x - t.x, dz = sl.position.z - t.z;
        const horiz = Math.hypot(dx, dz) || 1;
        sl.position.y = t.y + horiz * Math.tan(21 * Math.PI / 180);   // low sun -> long shadows
        sl.color.setHex(0xffc785);
        sl.intensity = 1.2;
        if (g.hemiLight) {
            g.hemiLight.color.setHex(0x8cbcff);        // sky-blue top bounce
            g.hemiLight.groundColor.setHex(0x4a3720);  // dirt/grass bottom bounce
            g.hemiLight.intensity = 0.55;
        }
        if (g.ambientLight) g.ambientLight.intensity *= 0.5;   // deeper shadows, fill comes from the hemisphere
    }

    updateWaterMeshes() {
        const out = [];
        const chunks = this.game.world && this.game.world.chunks;
        if (chunks) for (const k in chunks) { const m = chunks[k] && chunks[k].waterMesh; if (m && m.visible !== false) out.push(m); }
        this.waterMeshes = out;
        if (this.ssr) this.ssr.selects = out;
    }

    // Returns true if it rendered the frame.
    render(dtMs) {
        if (!this.active) return false;
        const g = this.game, r = g.renderer;
        this.adjustLights();
        if (!this.composer) { return false; }       // lights-only fallback: normal renderer path
        this.frame++;
        if (this.ssr && this.quality >= 3 && this.frame % 45 === 1) this.updateWaterMeshes();

        // render the scene in linear HDR, tone-map/encode in the final pass
        r.toneMapping = THREE.NoToneMapping;
        if (this.final && g.scene.background && g.scene.background.isColor) this.final.uniforms.skyColor.value.copy(g.scene.background);
        if (this.godrays) this.updateGodRays();
        const up = g.upscaler && g.upscaler.active ? g.upscaler : null;
        this.composer.renderToScreen = !up;     // with the upscaler the stack ends in a texture, not the canvas
        if (this.smaa) this.smaa.enabled = !up; // the upscaler does its own edge reconstruction
        this.composer.render();
        if (up) up.present(this.composer.readBuffer.texture);

        // adaptive quality: drop the heaviest effects when the frame time is bad, restore when it recovers
        if (dtMs > 40) { this.slowFrames++; this.fastFrames = 0; } else if (dtMs < 20) { this.fastFrames++; this.slowFrames = 0; }
        if (this.slowFrames > 90 && this.quality > 0) { this.quality--; this.slowFrames = 0; this.applyQuality(); }
        else if (this.fastFrames > 600 && this.quality < 3) { this.quality++; this.fastFrames = 0; this.applyQuality(); }
        return true;
    }

    updateGodRays() {
        const g = this.game, u = this.godrays.uniforms;
        const sun = g.sunSprite;
        let on = 0;
        if (sun && g.sunLight && g.sunLight.intensity > 0.3 && g.scene.background && g.scene.background.isColor && !(g.player && g.player.isSubmerged)) {
            this._sunNdc.copy(sun.position).project(g.camera);
            if (this._sunNdc.z < 1) {
                u.sunPos.value.set(this._sunNdc.x * 0.5 + 0.5, this._sunNdc.y * 0.5 + 0.5);
                u.skyColor.value.copy(g.scene.background);
                on = 1;
            }
        }
        u.strength.value = on ? 0.14 : 0.0;
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
                    vec2 delta = (vUv - sunPos) / 40.0 * 0.85;
                    vec2 uv = vUv;
                    float illum = 1.0, acc = 0.0;
                    for (int i = 0; i < 40; i++) {
                        uv -= delta;
                        acc += sky(texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb) * illum;
                        illum *= 0.955;
                    }
                    float fall = smoothstep(1.4, 0.0, distance(vUv, sunPos));
                    vec3 shaft = vec3(1.0, 0.78, 0.5) * acc / 40.0 * fall * strength * 2.2;
                    gl_FragColor = vec4(base.rgb + shaft, base.a);
                }`
        };
    }

    static FinalShader() {
        return {
            uniforms: { tDiffuse: { value: null }, skyColor: { value: new THREE.Color(0.5, 0.7, 1) }, exposure: { value: 1.05 }, contrast: { value: 1.08 }, vibrance: { value: 0.22 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `
                uniform sampler2D tDiffuse; uniform vec3 skyColor; uniform float exposure, contrast, vibrance;
                varying vec2 vUv;
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
                    vec3 lit = toSRGB(aces(max(c, 0.0)));           // ACES Filmic tone mapping + sRGB output
                    c = mix(lit, clamp(raw, 0.0, 1.0), skyMask);
                    // colour grade (LUT-style): vibrance, contrast, cool shadows / warm highlights
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
window.RTXPipeline = RTXPipeline;

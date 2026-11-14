// WebGPU path tracer — the "Cinematic" tier of RTX mode. Everything below runs in WebGPU compute shaders.
//
//  Geometry      Voxels: 256 x 32 x 256 window around the camera in an r8uint 3D texture (toroidal addressing, only new chunks upload),
//                4^3 occupancy bricks so rays skip empty air in big jumps. Full cubes, slabs / panels / pillars / beams, cross plants, leaves.
//                Meshes: mobs, players, item drops, mod vehicles and the first-person hand / weapon are ray traced through a two-level BVH
//                (per-geometry BLAS built once and cached, TLAS over the instances rebuilt every frame) — like hardware RTX, in compute.
//  Materials     the game's own block textures (mip-mapped, sRGB) + per-texel normal maps (the baked neural maps when present, else relief
//                from luminance) with cavity AO; GGX metals, glossy dielectrics, translucent leaves / plants; mesh textures + material colours.
//  Water         dielectric: Fresnel reflect / refract, animated wave normals, Beer-Lambert absorption. Glass / ice: thin dielectrics.
//  Lighting      sun / moon cone NEE with soft shadows, physically based sky (Rayleigh + Mie) with volumetric-looking lit clouds and their
//                shadows on the ground, emissive blocks as lights (RIS), HDRI environments with importance sampling + MIS.
//  Atmosphere    haze with single-scattered volumetric sun shafts.
//  Camera        thin-lens depth of field with auto focus, optional 2.39:1 letterbox.
//  Denoiser      SVGF-style: albedo demodulation, temporal reprojection (camera-locked for the first-person weapon) with luminance
//                moments, edge-aware a-trous wavelet filter. Standing still converges to a noise-free image.
//  Post          HDR bloom (13-tap down / tent up chain), centre-weighted auto exposure with eye adaptation, AgX or ACES tone mapping,
//                contrast-adaptive sharpening, chromatic aberration, vignette, film grain.
//  Performance   GPU timer (timestamp queries), dynamic resolution to a target fps, max 2 frames in flight, quality presets.
//
// Toggle: Alt+P, the "Path tracing (WebGPU)" folder of the RTX panel (Alt+X), or the Cinematic preset.
class WebGPUPathTracer {
    static isAvailable() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

    constructor(game) {
        this.game = game;
        this.cfg = WebGPUPathTracer.loadCfg();
        this.active = false;
        this.starting = null;
        this.device = null;
        this.status = WebGPUPathTracer.isAvailable() ? 'off' : 'WebGPU not supported by this browser';
        this.frame = 0;
        this.accum = 0;
        this.gpuMs = 0;
        this.fps = 0;
        this.hdri = null;
        this.hdriName = 'procedural';
        this._skyKey = '';
        this._prevVP = null;
        this._lastCamKey = '';
        this._resetPending = true;
        this._slotChunk = new Array(256).fill(null);
        this._slotCopy = new Array(256).fill(null);
        this._slotEmit = new Array(256).fill(null);
        this._slotKey = new Array(256).fill('');
        this._rr = 0;
        this._world = null;
        this._emitDirty = true;
        this._focus = 8;
        this._focusPending = false;
        this._snap = null;
        this._time = 0;
        this._dynScale = 1;
        this._dynT = 0;
        this._fpsEma = 0;
        this.meshStats = { instances: 0, overlay: 0, tris: 0, blas: 0 };
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'KeyP' && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); this.toggle(); }
        }, true);
    }

    static loadCfg() {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem('eblankraft_pt_cfg') || '{}') || {}; } catch (e) {}
        return Object.assign({}, WebGPUPathTracer.CFG_DEFAULTS, saved);
    }

    setCfg(k, v) {
        this.cfg[k] = v;
        try { localStorage.setItem('eblankraft_pt_cfg', JSON.stringify(this.cfg)); } catch (e) {}
        if (k === 'scale' || k === 'dynRes') { this._dynScale = 1; this._sizeKey = ''; }
        if (k === 'hdri') { this.loadHdriPreset(v); return; }
        if (k === 'clouds' || k === 'cloudDrift') this._skyKey = '';
        // post-process only settings do not restart the accumulation
        if (WebGPUPathTracer.POST_KEYS.includes(k)) return;
        this.resetAccumulation();
    }

    applyPreset(name) {
        const p = WebGPUPathTracer.PRESETS[name];
        if (!p) return;
        for (const k in p) this.setCfg(k, p[k]);
    }

    resetAccumulation() { this._resetPending = true; }

    toggle() { if (this.active || this.starting) this.disable(); else this.enable(); }

    async enable() {
        if (this.active) return true;
        if (this.starting) return this.starting;
        if (!WebGPUPathTracer.isAvailable()) { this.status = 'WebGPU not supported by this browser'; this.toast(this.status); return false; }
        this.starting = (async () => {
            try {
                this.status = 'starting...';
                if (!this.device) await this.initDevice();
                this.ensureCanvas();
                this.canvas.style.display = '';
                this.active = true;
                this._sizeKey = '';
                this._skyKey = '';
                this._atlasKey = '';
                this.resetAccumulation();
                for (let i = 0; i < 256; i++) { this._slotChunk[i] = null; this._slotKey[i] = ''; }
                if (this.cfg.hdri && this.cfg.hdri !== 'procedural' && !this.hdri) this.loadHdriPreset(this.cfg.hdri);
                this.status = 'running';
                this.toast('Path tracing ON (WebGPU) — Alt+P to exit');
                return true;
            } catch (e) {
                console.warn('[PT] WebGPU path tracer failed to start:', e);
                this.status = 'failed: ' + (e && e.message ? e.message : e);
                this.toast('Path tracing unavailable: ' + this.status);
                this.active = false;
                return false;
            } finally { this.starting = null; }
        })();
        return this.starting;
    }

    disable() {
        this.active = false;
        if (this.canvas) this.canvas.style.display = 'none';
        if (this.device) this.status = 'off';
    }

    toast(msg) {
        try {
            const ui = this.game && this.game.ui;
            if (ui && typeof ui.showToast === 'function') { ui.showToast(msg); return; }
        } catch (e) {}
        console.log('[PT] ' + msg);
    }

    // ------------------------------------------------------------------ device + pipelines
    async initDevice() {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) throw new Error('no WebGPU adapter');
        const features = [];
        if (adapter.features.has('timestamp-query')) features.push('timestamp-query');
        const want = (k, v) => Math.min(adapter.limits[k] || v, v);
        const device = await adapter.requestDevice({
            requiredFeatures: features,
            requiredLimits: { maxStorageBufferBindingSize: want('maxStorageBufferBindingSize', 256 << 20), maxBufferSize: want('maxBufferSize', 256 << 20) }
        });
        this.adapter = adapter;
        this.device = device;
        this.hasTimestamps = features.includes('timestamp-query');
        try { const i = adapter.info || {}; this.gpuName = [i.vendor, i.architecture, i.description].filter(Boolean).join(' ') || 'GPU'; } catch (e) { this.gpuName = 'GPU'; }
        device.lost.then((info) => {
            console.warn('[PT] device lost:', info && info.message);
            this.device = null; this.active = false; this.status = 'GPU device lost (' + ((info && info.reason) || 'unknown') + ')';
            if (this.canvas) this.canvas.style.display = 'none';
            this._pipelines = null;
            this._blasCache = null;
        });
        device.onuncapturederror = (ev) => { console.warn('[PT] WebGPU error:', ev.error && ev.error.message); this.lastError = ev.error && ev.error.message; };
        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.createStaticResources();
        await this.createPipelines();
    }

    createStaticResources() {
        const d = this.device;
        this.uniformBuf = d.createBuffer({ size: WebGPUPathTracer.U_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.uData = new ArrayBuffer(WebGPUPathTracer.U_FLOATS * 4);
        this.uF = new Float32Array(this.uData);
        this.uI = new Int32Array(this.uData);
        this.uU = new Uint32Array(this.uData);
        this.voxTex = d.createTexture({ size: [256, 32, 256], dimension: '3d', format: 'r8uint', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        this.brickTex = d.createTexture({ size: [64, 8, 64], dimension: '3d', format: 'r32uint', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING });
        this.matBuf = d.createBuffer({ size: 256 * WebGPUPathTracer.MAT_FLOATS * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.maxEmitters = 16384;
        this.emitBuf = d.createBuffer({ size: this.maxEmitters * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.skyTex = d.createTexture({ size: [1024, 512], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING });
        this.dummyCdf = d.createBuffer({ size: 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.expoBuf = d.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
        d.queue.writeBuffer(this.expoBuf, 0, new Float32Array([0, 0, 0, 0]));
        this.nearestSamp = d.createSampler({ magFilter: 'nearest', minFilter: 'nearest', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat' });
        this.linRepSamp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat' });
        this.linearSamp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'clamp-to-edge' });
        this.clampSamp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
        this.focusBuf = d.createBuffer({ size: 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        this.atrousBufs = [];
        for (let i = 0; i < 6; i++) {
            const b = d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            d.queue.writeBuffer(b, 0, new Int32Array([1 << i, i, 0, 0]));
            this.atrousBufs.push(b);
        }
        const one = (format, px) => { const t = d.createTexture({ size: [1, 1, 1], format, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST }); d.queue.writeTexture({ texture: t }, new Uint8Array(px), { bytesPerRow: 4 }, [1, 1, 1]); return t; };
        this.atlasTex = one('rgba8unorm-srgb', [200, 200, 200, 255]);
        this.normTex = one('rgba8unorm', [128, 128, 255, 255]);
        // mesh ray tracing buffers (grow on demand)
        this.triCap = 0; this.blasCap = 0; this.sceneCap = 0;
        this.ensureMeshBuffers(4096, 4096, 4096);
        this.meshAtlasCap = 0;
        this.meshLayers = [];          // [{ key, version, data (128x128 rgba) }]
        this.meshLayerOf = new Map();  // image -> index
        this.ensureMeshAtlas(8);
        if (this.hasTimestamps) {
            this.tsQuery = d.createQuerySet({ type: 'timestamp', count: 2 });
            this.tsResolve = d.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
            this.tsRead = d.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        }
    }

    ensureMeshBuffers(tris, nodes, sceneVec4) {
        const d = this.device;
        let changed = false;
        if (tris > this.triCap) {
            if (this.triBuf) this.triBuf.destroy();
            this.triCap = Math.max(tris, Math.ceil(this.triCap * 1.5));
            this.triBuf = d.createBuffer({ size: this.triCap * 80, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            this._triUploaded = 0; changed = true;
        }
        if (nodes > this.blasCap) {
            if (this.blasBuf) this.blasBuf.destroy();
            this.blasCap = Math.max(nodes, Math.ceil(this.blasCap * 1.5));
            this.blasBuf = d.createBuffer({ size: this.blasCap * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            this._blasUploaded = 0; changed = true;
        }
        if (sceneVec4 > this.sceneCap) {
            if (this.sceneBuf) this.sceneBuf.destroy();
            this.sceneCap = Math.max(sceneVec4, Math.ceil(this.sceneCap * 1.5));
            this.sceneBuf = d.createBuffer({ size: this.sceneCap * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
            changed = true;
        }
        if (changed) { this._meshGen = (this._meshGen || 0) + 1; this._bgKey = ''; }
        return changed;
    }

    ensureMeshAtlas(layers) {
        if (layers <= this.meshAtlasCap) return;
        const d = this.device;
        const cap = Math.min(256, Math.max(layers, this.meshAtlasCap * 2));
        if (this.meshAtlas) this.meshAtlas.destroy();
        this.meshAtlasCap = cap;
        this.meshAtlas = d.createTexture({ size: [128, 128, cap], format: 'rgba8unorm-srgb', mipLevelCount: 8, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        for (let i = 0; i < this.meshLayers.length; i++) this.writeLayer(this.meshAtlas, i, this.meshLayers[i].data, 128, 8);
        this._meshGen = (this._meshGen || 0) + 1; this._bgKey = '';
    }

    writeLayer(tex, layer, data, S, mips) {
        const d = this.device;
        let src = data, sz = S;
        for (let mip = 0; mip < mips; mip++) {
            d.queue.writeTexture({ texture: tex, mipLevel: mip, origin: [0, 0, layer] }, src, { bytesPerRow: sz * 4, rowsPerImage: sz }, [sz, sz, 1]);
            if (sz === 1) break;
            src = WebGPUPathTracer.downsample(src, sz, tex.format === 'rgba8unorm');
            sz >>= 1;
        }
    }

    // premultiplied 2x2 box (colour) or plain average + renormalise (normal maps)
    static downsample(src, sz, normals) {
        const nz = sz >> 1, dst = new Uint8Array(nz * nz * 4);
        for (let y = 0; y < nz; y++) for (let x = 0; x < nz; x++) {
            const o = (y * nz + x) * 4;
            let ar = 0, ag = 0, ab = 0, aa = 0;
            for (let k = 0; k < 4; k++) {
                const i = ((y * 2 + (k >> 1)) * sz + x * 2 + (k & 1)) * 4, a = normals ? 255 : src[i + 3];
                ar += src[i] * a; ag += src[i + 1] * a; ab += src[i + 2] * a; aa += a;
                if (normals) aa += 0;
            }
            if (normals) {
                let nx = ar / aa / 127.5 - 1, ny = ag / aa / 127.5 - 1, nzv = ab / aa / 127.5 - 1;
                const l = Math.hypot(nx, ny, nzv) || 1;
                dst[o] = (nx / l * 0.5 + 0.5) * 255; dst[o + 1] = (ny / l * 0.5 + 0.5) * 255; dst[o + 2] = (nzv / l * 0.5 + 0.5) * 255;
                let ao = 0; for (let k = 0; k < 4; k++) ao += src[((y * 2 + (k >> 1)) * sz + x * 2 + (k & 1)) * 4 + 3];
                dst[o + 3] = ao / 4;
            } else {
                if (aa > 0) { dst[o] = ar / aa; dst[o + 1] = ag / aa; dst[o + 2] = ab / aa; }
                dst[o + 3] = aa / 4;
            }
        }
        return dst;
    }

    async createPipelines() {
        const d = this.device;
        const mk = async (code, label) => {
            const m = d.createShaderModule({ code, label });
            if (m.getCompilationInfo) {
                const info = await m.getCompilationInfo();
                const errs = info.messages.filter(x => x.type === 'error');
                if (errs.length) throw new Error(label + ' WGSL: ' + errs.map(e => e.lineNum + ':' + e.linePos + ' ' + e.message).join(' | '));
            }
            return m;
        };
        const W = WebGPUPathTracer, C = W.WGSL_COMMON;
        const mods = await Promise.all([
            mk(C + W.WGSL_TRACE, 'pathtrace'), mk(W.WGSL_BRICKS, 'bricks'), mk(C + W.WGSL_SKY, 'sky'),
            mk(C + W.WGSL_TEMPORAL, 'temporal'), mk(C + W.WGSL_ATROUS, 'atrous'), mk(C + W.WGSL_RESOLVE, 'resolve'),
            mk(C + W.WGSL_EXPOSURE, 'exposure'), mk(W.WGSL_BLOOM_DOWN, 'bloomDown'), mk(W.WGSL_BLOOM_UP, 'bloomUp'),
            mk(C + W.WGSL_COMPOSITE, 'composite')
        ]);
        const [ptM, brM, skM, tpM, atM, rsM, exM, bdM, buM, cpM] = mods;
        const cp = (module, label) => d.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' }, label });
        const rp = (format) => d.createRenderPipelineAsync({
            layout: 'auto', vertex: { module: cpM, entryPoint: 'vs' },
            fragment: { module: cpM, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' }
        });
        const [pt, br, sk, tp, at, rs, ex, bd, bu, comp, compRGBA] = await Promise.all([
            cp(ptM, 'pathtrace'), cp(brM, 'bricks'), cp(skM, 'sky'), cp(tpM, 'temporal'), cp(atM, 'atrous'),
            cp(rsM, 'resolve'), cp(exM, 'exposure'), cp(bdM, 'bloomDown'), cp(buM, 'bloomUp'),
            rp(this.format), this.format === 'rgba8unorm' ? null : rp('rgba8unorm')
        ]);
        this._pipelines = { pt, br, sk, tp, at, rs, ex, bd, bu, comp, compRGBA: compRGBA || comp };
        this.brickBG = d.createBindGroup({ layout: br.getBindGroupLayout(0), entries: [
            { binding: 0, resource: this.voxTex.createView() }, { binding: 1, resource: this.brickTex.createView() }] });
        this.skyBG = d.createBindGroup({ layout: sk.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: this.uniformBuf } }, { binding: 1, resource: this.skyTex.createView() }] });
    }

    ensureCanvas() {
        if (this.canvas) return;
        const src = this.game.renderer.domElement;
        const c = document.createElement('canvas');
        c.id = 'pt-webgpu-canvas';
        c.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:1;display:none;';
        if (src.parentNode) src.parentNode.insertBefore(c, src.nextSibling); else document.body.appendChild(c);
        this.canvas = c;
        if (this.headless) return;
        this.ctx = c.getContext('webgpu');
        this.ctx.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
    }

    // ------------------------------------------------------------------ size dependent targets
    ensureTargets() {
        const src = this.game.renderer.domElement;
        const r = src.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const outW = Math.max(2, Math.round((r.width || src.width) * dpr)), outH = Math.max(2, Math.round((r.height || src.height) * dpr));
        const budget = Math.sqrt(3.7e6 / (outW * outH));
        const base = Math.max(0.2, Math.min(1, +this.cfg.scale || 1, budget));
        const s = Math.max(0.2, base * (this.cfg.dynRes ? this._dynScale : 1));
        const w = Math.max(8, Math.round(outW * s)), h = Math.max(8, Math.round(outH * s));
        const cs = this.canvas.style, pos = `${r.left},${r.top},${r.width},${r.height}`;
        if (this._posKey !== pos) { this._posKey = pos; cs.left = r.left + 'px'; cs.top = r.top + 'px'; cs.width = r.width + 'px'; cs.height = r.height + 'px'; }
        const key = w + 'x' + h + '/' + outW + 'x' + outH;
        if (this._sizeKey === key) return;
        this._sizeKey = key;
        this.canvas.width = outW; this.canvas.height = outH;
        this.w = w; this.h = h; this.outW = outW; this.outH = outH;
        const d = this.device;
        if (this.targets) for (const k in this.targets) { const t = this.targets[k]; (Array.isArray(t) ? t : [t]).forEach(x => x.destroy && x.destroy()); }
        const T = (format, ww = w, hh = h) => d.createTexture({ size: [ww, hh], format, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC });
        const levels = [];
        for (let i = 0; i < 6; i++) levels.push([Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1))]);
        this.targets = {
            illum: T('rgba16float'), albedo: T('rgba8unorm'),
            normal: [T('rgba16float'), T('rgba16float')], pos: [T('rgba32float'), T('rgba32float')],
            hist: [T('rgba16float'), T('rgba16float')], mom: [T('rgba16float'), T('rgba16float')],
            filt: T('rgba16float'), ping: [T('rgba16float'), T('rgba16float')],
            hdr: T('rgba16float'),
            down: levels.map(([a, b]) => T('rgba16float', a, b)),
            up: levels.slice(0, 5).map(([a, b]) => T('rgba16float', a, b))
        };
        this.wg16 = [Math.ceil(w / 16), Math.ceil(h / 16)];
        this.lumBuf = d.createBuffer({ size: Math.max(16, this.wg16[0] * this.wg16[1] * 8), usage: GPUBufferUsage.STORAGE });
        this.targets.lumBuf = this.lumBuf;
        this.bloomLevels = levels;
        this._bgKey = '';
        this.resetAccumulation();
    }

    buildBindGroups() {
        const d = this.device, P = this._pipelines, T = this.targets;
        const envTex = this.hdri ? this.hdri.tex : this.skyTex;
        const cdf = this.hdri ? this.hdri.cdf : this.dummyCdf;
        const key = this._sizeKey + '|' + (this.hdri ? this.hdri.name : 'sky') + '|' + this._atlasKey + '|' + this._meshGen;
        if (this._bgKey === key) return;
        this._bgKey = key;
        const U = { buffer: this.uniformBuf };
        this.ptBG = [0, 1].map(p => d.createBindGroup({ layout: P.pt.getBindGroupLayout(0), entries: [
            { binding: 0, resource: U },
            { binding: 1, resource: this.voxTex.createView() },
            { binding: 2, resource: this.brickTex.createView() },
            { binding: 3, resource: this.atlasTex.createView({ dimension: '2d-array' }) },
            { binding: 4, resource: this.nearestSamp },
            { binding: 5, resource: { buffer: this.matBuf } },
            { binding: 6, resource: { buffer: this.emitBuf } },
            { binding: 7, resource: envTex.createView() },
            { binding: 8, resource: this.linearSamp },
            { binding: 9, resource: { buffer: cdf } },
            { binding: 10, resource: T.illum.createView() },
            { binding: 11, resource: T.albedo.createView() },
            { binding: 12, resource: T.normal[p].createView() },
            { binding: 13, resource: T.pos[p].createView() },
            { binding: 14, resource: { buffer: this.triBuf } },
            { binding: 15, resource: { buffer: this.blasBuf } },
            { binding: 16, resource: { buffer: this.sceneBuf } },
            { binding: 17, resource: this.meshAtlas.createView({ dimension: '2d-array' }) },
            { binding: 18, resource: this.normTex.createView({ dimension: '2d-array' }) },
            { binding: 19, resource: this.linRepSamp }
        ] }));
        this.tpBG = [0, 1].map(p => d.createBindGroup({ layout: P.tp.getBindGroupLayout(0), entries: [
            { binding: 0, resource: U },
            { binding: 1, resource: T.illum.createView() },
            { binding: 2, resource: T.normal[p].createView() },
            { binding: 3, resource: T.pos[p].createView() },
            { binding: 4, resource: T.normal[1 - p].createView() },
            { binding: 5, resource: T.pos[1 - p].createView() },
            { binding: 6, resource: T.hist[1 - p].createView() },
            { binding: 7, resource: T.mom[1 - p].createView() },
            { binding: 8, resource: T.hist[p].createView() },
            { binding: 9, resource: T.mom[p].createView() },
            { binding: 10, resource: T.filt.createView() }
        ] }));
        this.atBG = [0, 1].map(p => {
            const list = [];
            for (let i = 0; i < 6; i++) {
                const src = i === 0 ? T.filt : T.ping[(i - 1) & 1];
                list.push(d.createBindGroup({ layout: P.at.getBindGroupLayout(0), entries: [
                    { binding: 0, resource: U },
                    { binding: 1, resource: { buffer: this.atrousBufs[i] } },
                    { binding: 2, resource: src.createView() },
                    { binding: 3, resource: T.normal[p].createView() },
                    { binding: 4, resource: T.pos[p].createView() },
                    { binding: 5, resource: T.albedo.createView() },
                    { binding: 6, resource: T.ping[i & 1].createView() }
                ] }));
            }
            return list;
        });
        this.rsBG = {};
        for (const [k, tex] of [['filt', T.filt], ['ping0', T.ping[0]], ['ping1', T.ping[1]]]) {
            this.rsBG[k] = d.createBindGroup({ layout: P.rs.getBindGroupLayout(0), entries: [
                { binding: 0, resource: U },
                { binding: 1, resource: tex.createView() },
                { binding: 2, resource: T.albedo.createView() },
                { binding: 3, resource: T.hdr.createView() },
                { binding: 4, resource: { buffer: this.lumBuf } }
            ] });
        }
        this.exBG = d.createBindGroup({ layout: P.ex.getBindGroupLayout(0), entries: [
            { binding: 0, resource: U }, { binding: 1, resource: { buffer: this.lumBuf } }, { binding: 2, resource: { buffer: this.expoBuf } }] });
        this.bdBG = T.down.map((dst, i) => d.createBindGroup({ layout: P.bd.getBindGroupLayout(0), entries: [
            { binding: 0, resource: (i === 0 ? T.hdr : T.down[i - 1]).createView() },
            { binding: 1, resource: this.clampSamp },
            { binding: 2, resource: dst.createView() }] }));
        this.buBG = [];
        for (let i = 4; i >= 0; i--) {
            this.buBG[i] = d.createBindGroup({ layout: P.bu.getBindGroupLayout(0), entries: [
                { binding: 0, resource: (i === 4 ? T.down[5] : T.up[i + 1]).createView() },
                { binding: 1, resource: T.down[i].createView() },
                { binding: 2, resource: this.clampSamp },
                { binding: 3, resource: T.up[i].createView() }] });
        }
        const compFor = (pipe) => d.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [
            { binding: 0, resource: U },
            { binding: 1, resource: T.hdr.createView() },
            { binding: 2, resource: T.up[0].createView() },
            { binding: 3, resource: this.clampSamp },
            { binding: 4, resource: { buffer: this.expoBuf } }
        ] });
        this.compBG = compFor(P.comp);
        this.compBGx = compFor(P.compRGBA);
    }

    // ------------------------------------------------------------------ voxel materials, texture + normal atlas
    buildAtlas() {
        const tm = this.game.textureManager;
        if (!tm || !tm.materials) return false;
        const key = (tm.textureX64 ? 'x64' : 'x16') + ':' + Object.keys(tm.materials).length + ':' + (tm.bakedPbr ? 'b' : 'n');
        if (this._atlasKey === key) return true;
        const BT = window.BLOCK_TYPES || {}, BI = window.BLOCK_INFO || {};
        const S = 64, MIPS = 7;
        const layers = [], normals = [], layerOf = new Map();
        const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        const avgOf = new Map();
        const keyOf = new Map();
        if (tm.canvasCache) for (const k in tm.canvasCache) keyOf.set(tm.canvasCache[k], k);
        const addImage = (img) => {
            if (!img) return 0;
            if (layerOf.has(img)) return layerOf.get(img);
            cx.clearRect(0, 0, S, S);
            cx.imageSmoothingEnabled = false;
            try { cx.drawImage(img, 0, 0, S, S); } catch (e) { return 0; }
            const data = cx.getImageData(0, 0, S, S).data;
            let r = 0, g = 0, b = 0, n = 0;
            for (let i = 0; i < data.length; i += 4) { const a = data[i + 3] / 255; if (a < 0.3) continue; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
            const idx = layers.length + 1;
            const px = new Uint8Array(data.buffer.slice(0));
            layers.push(px);
            normals.push(WebGPUPathTracer.reliefMap(px, S, tm.bakedPbr, keyOf.get(img)));
            layerOf.set(img, idx);
            avgOf.set(idx, n ? [r / n / 255, g / n / 255, b / n / 255] : [0.8, 0.8, 0.8]);
            return idx;
        };
        const imgOfMat = (m) => (m && m.map && m.map.image) || null;
        const mats = new Float32Array(256 * WebGPUPathTracer.MAT_FLOATS);
        const matU = new Uint32Array(mats.buffer);
        const name = {}; for (const k in BT) name[BT[k]] = k;
        const srgb = (c) => Math.pow(c, 2.2);
        this._emissive = new Uint8Array(256);
        for (let t = 1; t < 256; t++) {
            const info = BI[t];
            if (!info && !tm.materials[t]) continue;
            const base = (info && info.baseType != null) ? info.baseType : t;
            const n = name[base] || '';
            const mat = tm.materials[base] || tm.materials[BT.STONE];
            const faces = [];
            for (let f = 0; f < 6; f++) faces.push(addImage(imgOfMat(Array.isArray(mat) ? mat[f] : mat)));
            const m0 = Array.isArray(mat) ? mat[2] || mat[0] : mat;
            const P = WebGPUPathTracer.blockPbr(n, info);
            const o = t * WebGPUPathTracer.MAT_FLOATS;
            for (let f = 0; f < 6; f++) { if (f < 4) matU[o + f] = faces[f]; else matU[o + 4 + (f - 4)] = faces[f]; }
            matU[o + 6] = P.kind;
            const b = (info && info.bounds) || null;
            const hasBounds = b && !(b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 1 && b[4] === 1 && b[5] === 1);
            matU[o + 7] = (hasBounds ? 1 : 0) | (P.trans ? 2 : 0);
            mats[o + 8] = P.rough; mats[o + 9] = P.metal; mats[o + 10] = P.emit; mats[o + 11] = P.ior || 1.5;
            const col = (m0 && m0.color) ? [m0.color.r, m0.color.g, m0.color.b] : [1, 1, 1];
            mats[o + 12] = col[0]; mats[o + 13] = col[1]; mats[o + 14] = col[2]; mats[o + 15] = P.opacity != null ? P.opacity : 1;
            const bb = hasBounds ? b : [0, 0, 0, 1, 1, 1];
            mats[o + 16] = bb[0]; mats[o + 17] = bb[1]; mats[o + 18] = bb[2]; mats[o + 19] = P.trans || 0;
            mats[o + 20] = bb[3]; mats[o + 21] = bb[4]; mats[o + 22] = bb[5]; mats[o + 23] = P.relief != null ? P.relief : 1;
            const avg = avgOf.get(faces[2]) || avgOf.get(faces[0]) || [0.8, 0.8, 0.8];
            const ec = P.emitColor || [srgb(avg[0]) * col[0], srgb(avg[1]) * col[1], srgb(avg[2]) * col[2]];
            const el = Math.max(1e-3, 0.2126 * ec[0] + 0.7152 * ec[1] + 0.0722 * ec[2]);
            mats[o + 24] = ec[0] * P.emit; mats[o + 25] = ec[1] * P.emit; mats[o + 26] = ec[2] * P.emit; mats[o + 27] = el * P.emit;
            if (P.emit > 0) this._emissive[t] = 1;
        }
        const d = this.device, L = layers.length + 1;
        if (this.atlasTex) this.atlasTex.destroy();
        if (this.normTex) this.normTex.destroy();
        this.atlasTex = d.createTexture({ size: [S, S, L], format: 'rgba8unorm-srgb', mipLevelCount: MIPS, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        this.normTex = d.createTexture({ size: [S, S, L], format: 'rgba8unorm', mipLevelCount: MIPS, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        const white = new Uint8Array(S * S * 4).fill(255);
        const flat = new Uint8Array(S * S * 4); for (let i = 0; i < flat.length; i += 4) { flat[i] = 128; flat[i + 1] = 128; flat[i + 2] = 255; flat[i + 3] = 255; }
        const all = [white, ...layers], allN = [flat, ...normals];
        for (let l = 0; l < L; l++) { this.writeLayer(this.atlasTex, l, all[l], S, MIPS); this.writeLayer(this.normTex, l, allN[l], S, MIPS); }
        d.queue.writeBuffer(this.matBuf, 0, mats);
        this._atlasKey = key;
        this._emitDirty = true;
        for (let i = 0; i < 256; i++) this._slotKey[i] = '';
        return true;
    }

    // tangent-space normal (rgb) + cavity occlusion (a) for one 64x64 texture: the baked neural maps when available, else relief
    // from a blurred luminance height field (same slope convention as textures.js: +x = right, +y = up in the image)
    static reliefMap(px, S, baked, key) {
        const n = S * S, out = new Uint8Array(n * 4);
        const lum = new Float32Array(n), h = new Float32Array(n);
        for (let i = 0; i < n; i++) lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
        const at = (a, x, y) => a[((y + S) % S) * S + ((x + S) % S)];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            h[y * S + x] = (4 * at(lum, x, y) + 2 * (at(lum, x - 1, y) + at(lum, x + 1, y) + at(lum, x, y - 1) + at(lum, x, y + 1))
                + at(lum, x - 1, y - 1) + at(lum, x + 1, y - 1) + at(lum, x - 1, y + 1) + at(lum, x + 1, y + 1)) / 16;
        }
        const bi = baked && baked.size === S && key != null ? baked.index[key] : undefined;
        const calm = /^(grass_top|grass_side|dirt|sand|snow|clay|leaves|birch_leaves|jungle_leaves|spruce_leaves|wood_side|wood_top|birch_wood_side|birch_wood_top|jungle_wood_side|jungle_wood_top|spruce_wood_side|spruce_wood_top|planks|birch_planks|spruce_planks|cactus_side|cactus_top|water|lava)$/.test(String(key || ''));
        const strength = calm ? 0.9 : 2.4;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const p = y * S + x, o = p * 4;
            let sx, sy;
            if (bi !== undefined) {
                const x0 = (bi % baked.cols) * S * 2, y0 = ((bi / baked.cols) | 0) * S;
                const a = ((y0 + y) * baked.width + x0 + x) * 4;
                const nz = Math.max(0.2, baked.data[a + 2] / 127.5 - 1);
                sx = (baked.data[a] / 127.5 - 1) / nz * strength / 3; sy = (baked.data[a + 1] / 127.5 - 1) / nz * strength / 3;
            } else {
                const dx = (at(h, x + 1, y - 1) + 2 * at(h, x + 1, y) + at(h, x + 1, y + 1)) - (at(h, x - 1, y - 1) + 2 * at(h, x - 1, y) + at(h, x - 1, y + 1));
                const dy = (at(h, x - 1, y + 1) + 2 * at(h, x, y + 1) + at(h, x + 1, y + 1)) - (at(h, x - 1, y - 1) + 2 * at(h, x, y - 1) + at(h, x + 1, y - 1));
                sx = -dx * strength; sy = dy * strength;
            }
            const l = Math.hypot(sx, sy, 1);
            out[o] = (sx / l * 0.5 + 0.5) * 255; out[o + 1] = (sy / l * 0.5 + 0.5) * 255; out[o + 2] = (1 / l * 0.5 + 0.5) * 255;
            const avg = (at(h, x - 1, y) + at(h, x + 1, y) + at(h, x, y - 1) + at(h, x, y + 1)) / 4;
            out[o + 3] = Math.max(0.35, Math.min(1, 1 - (avg - h[p]) * (calm ? 1.2 : 3.0))) * 255;
        }
        return out;
    }

    // PBR + light-transport class per block (kind: 1 opaque, 2 alpha-cutout, 3 water, 4 thin dielectric, 5 cross plant)
    static blockPbr(n, info) {
        const P = { kind: 1, rough: 0.85, metal: 0, emit: 0, ior: 1.5 };
        if (!n) return P;
        if (n === 'WATER') return { kind: 3, rough: 0.02, metal: 0, emit: 0, ior: 1.333 };
        if (n === 'GLASS') return { kind: 4, rough: 0.02, metal: 0, emit: 0, ior: 1.5, relief: 0 };
        if (n === 'ICE') return { kind: 4, rough: 0.05, metal: 0, emit: 0, ior: 1.31, opacity: 0.35, relief: 0.3 };
        if (n === 'PORTAL_NETHER') return { kind: 4, rough: 0.1, metal: 0, emit: 2.5, ior: 1.0, emitColor: [0.55, 0.12, 1.0], relief: 0 };
        if (n === 'PORTAL_END') return { kind: 4, rough: 0.1, metal: 0, emit: 1.5, ior: 1.0, emitColor: [0.15, 0.6, 0.55], relief: 0 };
        if (/LEAVES/.test(n)) return { kind: 2, rough: 0.6, metal: 0, emit: 0, trans: 0.55 };
        if (/FLOWER|MUSHROOM/.test(n)) return { kind: 5, rough: 0.7, metal: 0, emit: 0, trans: 0.5 };
        if (n === 'CACTUS') return { kind: 1, rough: 0.7, metal: 0, emit: 0, trans: 0.15 };
        if (n === 'REDSTONE_TORCH') return { kind: 5, rough: 0.7, metal: 0, emit: 4, emitColor: [1.0, 0.18, 0.08] };
        if (n === 'GLOWSTONE') return { kind: 1, rough: 0.6, metal: 0, emit: 4, emitColor: [1.0, 0.78, 0.45] };
        if (n === 'LAVA') return { kind: 1, rough: 0.9, metal: 0, emit: 7, emitColor: [1.0, 0.36, 0.06] };
        if (n === 'REDSTONE_LAMP_ON') return { kind: 1, rough: 0.5, metal: 0, emit: 5, emitColor: [1.0, 0.72, 0.42] };
        if (n === 'REDSTONE_BLOCK') return { kind: 1, rough: 0.4, metal: 0, emit: 0.6, emitColor: [0.9, 0.05, 0.02] };
        if (n === 'GOLD_BLOCK') return { kind: 1, rough: 0.22, metal: 1, emit: 0 };
        if (n === 'IRON_BLOCK') return { kind: 1, rough: 0.3, metal: 1, emit: 0 };
        if (n === 'COPPER_BLOCK') return { kind: 1, rough: 0.35, metal: 1, emit: 0 };
        if (n === 'NETHERITE_BLOCK') return { kind: 1, rough: 0.3, metal: 0.9, emit: 0 };
        if (n === 'DIAMOND_BLOCK') return { kind: 1, rough: 0.08, metal: 0, emit: 0, ior: 2.4 };
        if (n === 'PACKED_ICE') return { kind: 1, rough: 0.06, metal: 0, emit: 0, ior: 1.31, relief: 0.4 };
        if (n === 'OBSIDIAN') return { kind: 1, rough: 0.12, metal: 0, emit: 0 };
        if (n === 'QUARTZ_BLOCK' || n === 'NETHER_QUARTZ') return { kind: 1, rough: 0.25, metal: 0, emit: 0 };
        if (/CONCRETE/.test(n)) return { kind: 1, rough: 0.55, metal: 0, emit: 0, relief: 0.4 };
        if (n === 'SMOOTH_STONE' || n === 'TERRACOTTA') return { kind: 1, rough: 0.55, metal: 0, emit: 0 };
        if (n === 'COMPUTER') return { kind: 1, rough: 0.3, metal: 0.2, emit: 0.4 };
        if (n === 'SNOW') return { kind: 1, rough: 0.7, metal: 0, emit: 0, trans: 0.1 };
        if (/SAND|DIRT|GRAVEL|GRASS|CLAY|SOUL/.test(n)) return { kind: 1, rough: 0.95, metal: 0, emit: 0 };
        if (/PLANKS|WOOD|BOOKSHELF|CRAFTING/.test(n)) return { kind: 1, rough: 0.75, metal: 0, emit: 0 };
        return P;
    }

    // ------------------------------------------------------------------ voxel window (16 x 16 chunks around the camera)
    updateVoxels(enc) {
        const world = this.game.world;
        if (!world || !world.chunks) return false;
        if (world !== this._world) {
            this._world = world;
            for (let i = 0; i < 256; i++) { this._slotChunk[i] = null; this._slotKey[i] = ''; }
            this.resetAccumulation();
        }
        const cam = this.game.camera;
        const pcx = Math.floor(cam.position.x / 16), pcz = Math.floor(cam.position.z / 16);
        const rcx = pcx - 8, rcz = pcz - 8;
        this.regionMin = [rcx * 16, rcz * 16];
        const d = this.device;
        let uploaded = 0, changed = false;
        const zero = this._zero || (this._zero = new Uint8Array(16 * 32 * 16));
        const upload = (slot, cx, cz, chunk) => {
            const data = chunk && chunk.voxels && chunk.voxels.length === 8192 ? chunk.voxels : zero;
            d.queue.writeTexture({ texture: this.voxTex, origin: [(cx & 15) * 16, 0, (cz & 15) * 16] }, data, { bytesPerRow: 16, rowsPerImage: 32 }, [16, 32, 16]);
            let copy = this._slotCopy[slot];
            if (!copy) copy = this._slotCopy[slot] = new Uint8Array(8192);
            copy.set(data);
            this._slotEmit[slot] = this.scanEmitters(data, cx, cz);
            uploaded++;
        };
        for (let dz = 0; dz < 16; dz++) for (let dx = 0; dx < 16; dx++) {
            const cx = rcx + dx, cz = rcz + dz, slot = (cx & 15) + 16 * (cz & 15);
            const chunk = world.chunks[cx + ',' + cz] || null;
            const key = cx + ',' + cz;
            if (this._slotKey[slot] !== key || this._slotChunk[slot] !== chunk) {
                this._slotKey[slot] = key; this._slotChunk[slot] = chunk;
                upload(slot, cx, cz, chunk);
                changed = true;
            }
        }
        // round-robin content check: block edits, fluids, TNT... (cheap compare, re-upload only on a real change)
        for (let k = 0; k < 24; k++) {
            const i = this._rr = (this._rr + 1) & 255;
            const cx = rcx + (i & 15), cz = rcz + (i >> 4), slot = (cx & 15) + 16 * (cz & 15);
            const chunk = this._slotChunk[slot];
            if (!chunk || !chunk.voxels) continue;
            const a = chunk.voxels, b = this._slotCopy[slot];
            if (!b) continue;
            let diff = false;
            for (let j = 0; j < 8192; j++) if (a[j] !== b[j]) { diff = true; break; }
            if (diff) { upload(slot, cx, cz, chunk); this._worldEdit = true; }
        }
        if (uploaded) {
            this._emitDirty = true;
            const p = enc.beginComputePass();
            p.setPipeline(this._pipelines.br);
            p.setBindGroup(0, this.brickBG);
            p.dispatchWorkgroups(16, 2, 16);
            p.end();
        }
        if (this._emitDirty) {
            this._emitDirty = false;
            const list = new Float32Array(this.maxEmitters * 4);
            let n = 0;
            for (let s = 0; s < 256 && n < this.maxEmitters; s++) {
                const e = this._slotEmit[s];
                if (!e) continue;
                const take = Math.min(e.length >> 2, this.maxEmitters - n);
                list.set(e.subarray(0, take * 4), n * 4);
                n += take;
            }
            this.numEmitters = n;
            if (n) d.queue.writeBuffer(this.emitBuf, 0, list, 0, n * 4);
        }
        return changed;
    }

    scanEmitters(v, cx, cz) {
        const E = this._emissive;
        if (!E) return null;
        let out = null, n = 0;
        for (let i = 0; i < 8192; i++) {
            const t = v[i];
            if (!E[t]) continue;
            const x = i & 15, y = (i >> 4) & 31, z = i >> 9;
            const exposed = x === 0 || x === 15 || z === 0 || z === 15 || y === 0 || y === 31 ||
                !v[i - 1] || !v[i + 1] || !v[i - 16] || !v[i + 16] || !v[i - 512] || !v[i + 512] ||
                !E[v[i - 1]] || !E[v[i + 1]] || !E[v[i + 16]] || !E[v[i - 512]] || !E[v[i + 512]];
            if (!exposed) continue;
            if (!out) out = new Float32Array(1024 * 4);
            if (n * 4 >= out.length) { const g = new Float32Array(out.length * 2); g.set(out); out = g; }
            out[n * 4] = cx * 16 + x; out[n * 4 + 1] = y; out[n * 4 + 2] = cz * 16 + z; out[n * 4 + 3] = t;
            n++;
        }
        return out ? out.subarray(0, n * 4) : null;
    }

    // ------------------------------------------------------------------ mesh ray tracing: BLAS cache + per-frame TLAS
    // Generic median-split BVH over `count` primitives. bounds(i, out6) fills [minx,miny,minz,maxx,maxy,maxz].
    // Returns nodes as 8 floats (min, leftOrFirst bits, max, count bits) and the primitive order.
    static buildBVH(count, bounds, leafSize) {
        const bb = new Float32Array(count * 6), cen = new Float32Array(count * 3), tmp = [0, 0, 0, 0, 0, 0];
        for (let i = 0; i < count; i++) {
            bounds(i, tmp);
            for (let k = 0; k < 6; k++) bb[i * 6 + k] = tmp[k];
            cen[i * 3] = (tmp[0] + tmp[3]) * 0.5; cen[i * 3 + 1] = (tmp[1] + tmp[4]) * 0.5; cen[i * 3 + 2] = (tmp[2] + tmp[5]) * 0.5;
        }
        const order = new Uint32Array(count); for (let i = 0; i < count; i++) order[i] = i;
        const maxNodes = Math.max(1, 2 * count);
        const nodes = new Float32Array(maxNodes * 8), nu = new Uint32Array(nodes.buffer);
        let used = 1;
        const stack = [[0, 0, count]];
        while (stack.length) {
            const [ni, start, end] = stack.pop();
            let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
            let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
            for (let k = start; k < end; k++) {
                const i = order[k], o = i * 6;
                if (bb[o] < x0) x0 = bb[o]; if (bb[o + 1] < y0) y0 = bb[o + 1]; if (bb[o + 2] < z0) z0 = bb[o + 2];
                if (bb[o + 3] > x1) x1 = bb[o + 3]; if (bb[o + 4] > y1) y1 = bb[o + 4]; if (bb[o + 5] > z1) z1 = bb[o + 5];
                const c = i * 3;
                if (cen[c] < cx0) cx0 = cen[c]; if (cen[c] > cx1) cx1 = cen[c];
                if (cen[c + 1] < cy0) cy0 = cen[c + 1]; if (cen[c + 1] > cy1) cy1 = cen[c + 1];
                if (cen[c + 2] < cz0) cz0 = cen[c + 2]; if (cen[c + 2] > cz1) cz1 = cen[c + 2];
            }
            const o = ni * 8;
            nodes[o] = x0; nodes[o + 1] = y0; nodes[o + 2] = z0; nodes[o + 4] = x1; nodes[o + 5] = y1; nodes[o + 6] = z1;
            const n = end - start;
            const ex = cx1 - cx0, ey = cy1 - cy0, ez = cz1 - cz0;
            if (n <= leafSize || Math.max(ex, ey, ez) < 1e-7) { nu[o + 3] = start; nu[o + 7] = n; continue; }
            const axis = ex >= ey && ex >= ez ? 0 : (ey >= ez ? 1 : 2);
            const sub = order.subarray(start, end);
            sub.sort((a, b) => cen[a * 3 + axis] - cen[b * 3 + axis]);
            const mid = start + (n >> 1);
            const left = used; used += 2;
            nu[o + 3] = left; nu[o + 7] = 0;
            stack.push([left, start, mid], [left + 1, mid, end]);
        }
        return { nodes: nodes.subarray(0, used * 8), order, count: used };
    }

    blasFor(geom) {
        const pos = geom.attributes && geom.attributes.position;
        if (!pos) return null;
        const idx = geom.index;
        const ver = pos.version + ':' + (idx ? idx.version : -1) + ':' + pos.count;
        const cache = this._blasCache || (this._blasCache = new Map());
        const hit = cache.get(geom);
        if (hit && hit.ver === ver) return hit;
        if (this._blasBudget <= 0) return hit || null;
        const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
        if (triCount === 0 || triCount > 30000) return null;
        this._blasBudget -= Math.max(1, triCount / 500);
        const uv = geom.attributes.uv;
        const vi = (t, k) => idx ? idx.getX(t * 3 + k) : t * 3 + k;
        const P = new Float32Array(triCount * 9), UV = new Float32Array(triCount * 6), G = new Uint32Array(triCount);
        for (let t = 0; t < triCount; t++) {
            for (let k = 0; k < 3; k++) {
                const v = vi(t, k);
                P[t * 9 + k * 3] = pos.getX(v); P[t * 9 + k * 3 + 1] = pos.getY(v); P[t * 9 + k * 3 + 2] = pos.getZ(v);
                if (uv) { UV[t * 6 + k * 2] = uv.getX(v); UV[t * 6 + k * 2 + 1] = uv.getY(v); }
            }
        }
        if (geom.groups && geom.groups.length) {
            for (const g of geom.groups) {
                const t0 = Math.floor(g.start / 3), t1 = Math.min(triCount, Math.floor((g.start + g.count) / 3));
                for (let t = t0; t < t1; t++) G[t] = g.materialIndex || 0;
            }
        }
        const bvh = WebGPUPathTracer.buildBVH(triCount, (i, o) => {
            const b = i * 9;
            o[0] = Math.min(P[b], P[b + 3], P[b + 6]); o[1] = Math.min(P[b + 1], P[b + 4], P[b + 7]); o[2] = Math.min(P[b + 2], P[b + 5], P[b + 8]);
            o[3] = Math.max(P[b], P[b + 3], P[b + 6]); o[4] = Math.max(P[b + 1], P[b + 4], P[b + 7]); o[5] = Math.max(P[b + 2], P[b + 5], P[b + 8]);
        }, 4);
        // append triangles (in BVH order) + nodes (with global offsets) to the CPU mirrors
        const triBase = this._triCount, nodeBase = this._nodeCount;
        this.growMirror('_triData', (triBase + triCount) * 20);
        this.growMirror('_nodeData', (nodeBase + bvh.count) * 8);
        const tf = this._triData, tu = new Uint32Array(tf.buffer);
        for (let k = 0; k < triCount; k++) {
            const t = bvh.order[k], o = (triBase + k) * 20, b = t * 9;
            tf[o] = P[b]; tf[o + 1] = P[b + 1]; tf[o + 2] = P[b + 2]; tu[o + 3] = G[t];
            tf[o + 4] = P[b + 3]; tf[o + 5] = P[b + 4]; tf[o + 6] = P[b + 5]; tf[o + 7] = 0;
            tf[o + 8] = P[b + 6]; tf[o + 9] = P[b + 7]; tf[o + 10] = P[b + 8]; tf[o + 11] = 0;
            tf[o + 12] = UV[t * 6]; tf[o + 13] = UV[t * 6 + 1]; tf[o + 14] = UV[t * 6 + 2]; tf[o + 15] = UV[t * 6 + 3];
            tf[o + 16] = UV[t * 6 + 4]; tf[o + 17] = UV[t * 6 + 5]; tf[o + 18] = 0; tf[o + 19] = 0;
        }
        const nf = this._nodeData, nu = new Uint32Array(nf.buffer), bu = new Uint32Array(bvh.nodes.buffer, bvh.nodes.byteOffset, bvh.nodes.length);
        for (let k = 0; k < bvh.count; k++) {
            const o = (nodeBase + k) * 8, s = k * 8;
            for (let j = 0; j < 8; j++) nf[o + j] = bvh.nodes[s + j];
            if (bu[s + 7] > 0) nu[o + 3] = bu[s + 3] + triBase; else nu[o + 3] = bu[s + 3] + nodeBase;
            nu[o + 7] = bu[s + 7];
        }
        this._triCount += triCount; this._nodeCount += bvh.count;
        const e = { ver, root: nodeBase, tris: triCount, bmin: [bvh.nodes[0], bvh.nodes[1], bvh.nodes[2]], bmax: [bvh.nodes[4], bvh.nodes[5], bvh.nodes[6]] };
        cache.set(geom, e);
        return e;
    }

    growMirror(name, floats) {
        const cur = this[name];
        if (cur && cur.length >= floats) return;
        const n = new Float32Array(Math.max(floats, cur ? cur.length * 2 : 65536));
        if (cur) n.set(cur);
        this[name] = n;
    }

    meshLayer(map) {
        const img = map && map.image;
        if (!img) return -1;
        const w = img.width || img.videoWidth || 0, h = img.height || img.videoHeight || 0;
        if (!w || !h || (img.complete === false)) return -1;
        let i = this.meshLayerOf.get(img);
        if (i !== undefined && this.meshLayers[i].version === map.version) return i;
        if (i === undefined && this.meshLayers.length >= 256) return -1;
        const cv = this._mcv || (this._mcv = document.createElement('canvas'));
        cv.width = 128; cv.height = 128;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.clearRect(0, 0, 128, 128);
        cx.imageSmoothingEnabled = false;
        try { cx.drawImage(img, 0, 0, 128, 128); } catch (e) { return -1; }
        let data;
        try { data = new Uint8Array(cx.getImageData(0, 0, 128, 128).data.buffer.slice(0)); } catch (e) { return -1; }
        if (i === undefined) { i = this.meshLayers.length; this.meshLayers.push({ data, version: map.version }); this.meshLayerOf.set(img, i); }
        else { this.meshLayers[i].data = data; this.meshLayers[i].version = map.version; }
        this.ensureMeshAtlas(this.meshLayers.length);
        this.writeLayer(this.meshAtlas, i, data, 128, 8);
        this._meshTexDirty = true;
        return i;
    }

    updateMeshes() {
        const g = this.game, scene = g.scene, cam = g.camera;
        if (!this.cfg.meshes || !scene || !scene.traverseVisible) { this.meshStats = { instances: 0, overlay: 0, tris: 0, blas: 0 }; this._meshCounts = [0, 0, 0, 0]; return; }
        if (!this._triData) { this._triCount = 0; this._nodeCount = 0; }
        // rebuild the whole BLAS pool when it grew too large (disposed geometries leave garbage behind)
        if (this._triCount > 400000) { this._blasCache = new Map(); this._triCount = 0; this._nodeCount = 0; this._triUploaded = 0; this._blasUploaded = 0; }
        this._blasBudget = 64;
        scene.updateMatrixWorld();    // the WebGL renderer is skipped while path tracing, so nobody else updates them
        const excl = this._excl || (this._excl = new Set());
        excl.clear();
        const ch = g.world && g.world.chunks;
        if (ch) for (const k in ch) { const c = ch[k]; if (c.mesh) excl.add(c.mesh); if (c.waterMesh) excl.add(c.waterMesh); }
        if (g.cloudMesh) excl.add(g.cloudMesh);
        if (g.player && g.player.wireframeBox) excl.add(g.player.wireframeBox);
        const world = [], overlay = [];
        const isOverlay = (o) => { for (let p = o.parent; p; p = p.parent) if (p === cam) return true; return false; };
        const okMat = (m) => m && m.visible !== false && !m.wireframe && !m.isShaderMaterial && !m.isRawShaderMaterial && !m.isPointsMaterial && !m.isLineBasicMaterial &&
            m.blending !== THREE.AdditiveBlending && !(m.transparent && m.opacity < 0.35);
        scene.traverseVisible((o) => {
            if (!o.isMesh || o.isInstancedMesh || excl.has(o) || (o.userData && o.userData.ptIgnore)) return;
            const m = o.material;
            if (Array.isArray(m) ? !m.some(okMat) : !okMat(m)) return;
            const geom = o.geometry;
            if (!geom || !geom.attributes || !geom.attributes.position) return;
            if (!geom.boundingSphere) geom.computeBoundingSphere();
            const s = o.matrixWorld.getMaxScaleOnAxis();
            if (!geom.boundingSphere || geom.boundingSphere.radius * s > 48) return;   // sky domes, water planes, huge helpers
            (isOverlay(o) ? overlay : world).push(o);
        });
        const all = world.concat(overlay);
        const inst = [];
        const matIndex = new Map();
        const matData = [];
        const mtmp = this._mtmp || (this._mtmp = new THREE.Matrix4());
        const v3 = this._v3 || (this._v3 = new THREE.Vector3());
        for (let k = 0; k < all.length && inst.length < 4096; k++) {
            const o = all[k];
            const b = this.blasFor(o.geometry);
            if (!b) continue;
            const mm = o.material;
            let base = matIndex.get(mm);
            if (base === undefined) {
                base = matData.length / 16;
                const list = Array.isArray(mm) ? mm : [mm];
                for (const m of list) matData.push(...this.meshMaterial(m));
                matIndex.set(mm, base);
            }
            const first = Array.isArray(mm) ? mm.find(okMat) : mm;
            mtmp.copy(o.matrixWorld).invert();
            // world AABB from the 8 transformed corners of the BLAS root box
            let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
            for (let c = 0; c < 8; c++) {
                v3.set(c & 1 ? b.bmax[0] : b.bmin[0], c & 2 ? b.bmax[1] : b.bmin[1], c & 4 ? b.bmax[2] : b.bmin[2]).applyMatrix4(o.matrixWorld);
                if (v3.x < x0) x0 = v3.x; if (v3.y < y0) y0 = v3.y; if (v3.z < z0) z0 = v3.z;
                if (v3.x > x1) x1 = v3.x; if (v3.y > y1) y1 = v3.y; if (v3.z > z1) z1 = v3.z;
            }
            const side = first ? first.side : THREE.FrontSide;
            const hasAlpha = (Array.isArray(mm) ? mm : [mm]).some(m => m && m.map && (m.alphaTest > 0 || m.transparent));
            const flags = (k >= world.length ? 1 : 0) | (o.matrixWorld.determinant() < 0 ? 2 : 0) |
                (side === THREE.DoubleSide ? 4 : 0) | (side === THREE.BackSide ? 8 : 0) | (hasAlpha ? 16 : 0);
            const ie = mtmp.elements;
            inst.push({ inv: [ie[0], ie[4], ie[8], ie[12], ie[1], ie[5], ie[9], ie[13], ie[2], ie[6], ie[10], ie[14]], root: b.root, base, flags,
                box: [x0, y0, z0, x1, y1, z1], overlay: k >= world.length, tris: b.tris });
        }
        const wInst = inst.filter(i => !i.overlay), oInst = inst.filter(i => i.overlay);
        const tlas = wInst.length ? WebGPUPathTracer.buildBVH(wInst.length, (i, o) => { const b = wInst[i].box; for (let k = 0; k < 6; k++) o[k] = b[k]; }, 2) : null;
        const ordered = tlas ? Array.from(tlas.order, i => wInst[i]) : [];
        const finalInst = ordered.concat(oInst);
        const nI = finalInst.length, nM = matData.length / 16, nT = tlas ? tlas.count : 0;
        const matOff = nI * 4, tlasOff = matOff + nM * 4;
        const total = Math.max(4, tlasOff + nT * 2);
        this.ensureMeshBuffers(this._triCount + 1, this._nodeCount + 1, total);
        const buf = new Float32Array(total * 4), bu = new Uint32Array(buf.buffer);
        let trisVisible = 0;
        finalInst.forEach((it, i) => {
            const o = i * 16;
            for (let k = 0; k < 12; k++) buf[o + k] = it.inv[k];
            bu[o + 12] = it.root; bu[o + 13] = it.base; bu[o + 14] = it.flags; bu[o + 15] = it.tris;
            trisVisible += it.tris;
        });
        buf.set(matData, matOff * 4);
        if (tlas) buf.set(tlas.nodes, tlasOff * 4);
        const d = this.device;
        d.queue.writeBuffer(this.sceneBuf, 0, buf);
        if (this._triUploaded < this._triCount) {
            d.queue.writeBuffer(this.triBuf, this._triUploaded * 80, this._triData, this._triUploaded * 20, (this._triCount - this._triUploaded) * 20);
            this._triUploaded = this._triCount;
        }
        if (this._blasUploaded < this._nodeCount) {
            d.queue.writeBuffer(this.blasBuf, this._blasUploaded * 32, this._nodeData, this._blasUploaded * 8, (this._nodeCount - this._blasUploaded) * 8);
            this._blasUploaded = this._nodeCount;
        }
        this._meshCounts = [tlasOff, matOff, ordered.length, oInst.length];
        this.meshStats = { instances: ordered.length, overlay: oInst.length, tris: trisVisible, blas: this._blasCache ? this._blasCache.size : 0 };
    }

    meshMaterial(m) {
        const out = new Array(16).fill(0);
        if (!m) { out[0] = out[1] = out[2] = 0.7; out[4] = -1; out[5] = 0.8; return out; }
        const c = m.color || { r: 1, g: 1, b: 1 };
        out[0] = c.r; out[1] = c.g; out[2] = c.b;
        out[3] = m.alphaTest > 0 ? m.alphaTest : (m.transparent ? 0.5 : 0);
        out[4] = m.map ? this.meshLayer(m.map) : -1;
        out[5] = m.roughness != null ? m.roughness : (m.shininess != null ? Math.max(0.15, 1 - m.shininess / 120) : 0.8);
        out[6] = m.metalness != null ? m.metalness : 0;
        out[7] = (m.map && m.map.flipY !== false) ? 1 : 0;
        const e = m.emissive, ei = m.emissiveIntensity != null ? m.emissiveIntensity : 1;
        if (e) { out[8] = e.r * ei; out[9] = e.g * ei; out[10] = e.b * ei; }
        out[11] = m.opacity != null ? m.opacity : 1;
        return out;
    }

    // ------------------------------------------------------------------ sun / sky / HDRI
    sunState() {
        const g = this.game;
        const s = new THREE.Vector3(0.4, 0.8, 0.3);
        if (g.sunLight) { s.copy(g.sunLight.position); if (g.sunLight.target) s.sub(g.sunLight.target.position); }
        if (s.lengthSq() < 1e-6) s.set(0.4, 0.8, 0.3);
        s.normalize();
        if (this.cfg.sunOverride) {
            const el = this.cfg.sunElevation * Math.PI / 180, az = this.cfg.sunAzimuth * Math.PI / 180;
            s.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
        }
        return s;
    }

    static atmosphereTransmittance(dirY) {
        const R = 6360e3, Ra = 6420e3, y = Math.max(-0.05, dirY);
        const h0 = R + 200;
        const b = h0 * y, c = h0 * h0 - Ra * Ra, tA = -b + Math.sqrt(b * b - c);
        const N = 32, ds = tA / N;
        let odR = 0, odM = 0;
        const cosT = Math.sqrt(Math.max(0, 1 - y * y));
        for (let i = 0; i < N; i++) {
            const t = (i + 0.5) * ds;
            const px = t * cosT, py = h0 + t * y;
            const h = Math.sqrt(px * px + py * py) - R;
            if (h < 0) return [0, 0, 0];
            odR += Math.exp(-h / 8000) * ds; odM += Math.exp(-h / 1200) * ds;
        }
        const bR = [5.8e-6, 13.5e-6, 33.1e-6], bM = 21e-6 * 1.1;
        return bR.map(br => Math.exp(-(br * odR + bM * odM)));
    }

    async loadHdriPreset(name) {
        this.hdriName = name || 'procedural';
        if (!name || name === 'procedural') { this.setHdri(null); return; }
        const p = WebGPUPathTracer.HDRI_PRESETS[name];
        if (!p) { this.setHdri(null); return; }
        await this.loadHdriUrl(p, name);
    }

    async loadHdriUrl(url, name) {
        this.status = 'downloading HDRI...';
        try {
            const r = await fetch(url, { mode: 'cors' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            this.loadHdriBuffer(await r.arrayBuffer(), name || url);
        } catch (e) {
            console.warn('[PT] HDRI download failed:', e);
            this.status = 'HDRI failed: ' + e.message + ' (using procedural sky)';
            this.setHdri(null);
        }
    }

    async loadHdriFile(file) { this.loadHdriBuffer(await file.arrayBuffer(), file.name); }

    loadHdriBuffer(buf, name) {
        const img = WebGPUPathTracer.parseRGBE(new Uint8Array(buf));
        if (!this.device) { this._pendingHdri = { img, name }; return; }
        this.uploadHdri(img, name);
    }

    uploadHdri(img, name) {
        const d = this.device;
        let { w, h, data } = img;
        while (w > 2048) { const r = WebGPUPathTracer.halve(data, w, h); data = r.data; w = r.w; h = r.h; }
        const half = new Uint16Array(w * h * 4);
        for (let i = 0, j = 0; i < w * h; i++, j += 3) {
            half[i * 4] = WebGPUPathTracer.f2h(data[j]); half[i * 4 + 1] = WebGPUPathTracer.f2h(data[j + 1]); half[i * 4 + 2] = WebGPUPathTracer.f2h(data[j + 2]); half[i * 4 + 3] = 0x3c00;
        }
        const tex = d.createTexture({ size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        d.queue.writeTexture({ texture: tex }, half, { bytesPerRow: w * 8 }, [w, h]);
        let cw = w, ch = h, cd = data;
        while (cw > 512) { const r = WebGPUPathTracer.halve(cd, cw, ch); cd = r.data; cw = r.w; ch = r.h; }
        const func = new Float32Array(cw * ch);
        for (let y = 0; y < ch; y++) {
            const st = Math.sin(Math.PI * (y + 0.5) / ch);
            for (let x = 0; x < cw; x++) { const i = (y * cw + x) * 3; func[y * cw + x] = (0.2126 * cd[i] + 0.7152 * cd[i + 1] + 0.0722 * cd[i + 2]) * st + 1e-6; }
        }
        const cond = new Float32Array((cw + 1) * ch), rowInt = new Float32Array(ch);
        for (let y = 0; y < ch; y++) {
            let acc = 0; cond[y * (cw + 1)] = 0;
            for (let x = 0; x < cw; x++) { acc += func[y * cw + x]; cond[y * (cw + 1) + x + 1] = acc; }
            rowInt[y] = acc;
            for (let x = 1; x <= cw; x++) cond[y * (cw + 1) + x] /= acc;
        }
        const marg = new Float32Array(ch + 1);
        let tot = 0;
        for (let y = 0; y < ch; y++) { tot += rowInt[y]; marg[y + 1] = tot; }
        for (let y = 1; y <= ch; y++) marg[y] /= tot;
        const funcAvg = tot / (cw * ch);
        const all = new Float32Array(marg.length + cond.length + func.length);
        all.set(marg, 0); all.set(cond, marg.length); all.set(func, marg.length + cond.length);
        const cdf = d.createBuffer({ size: all.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        d.queue.writeBuffer(cdf, 0, all);
        this.setHdri({ name, w, h, tex, cdf, cw, ch, funcAvg });
    }

    setHdri(h) {
        if (this.hdri && this.hdri !== h) {
            const old = this.hdri;
            setTimeout(() => { try { old.tex.destroy(); old.cdf.destroy(); } catch (e) {} }, 500);
        }
        this.hdri = h;
        this._bgKey = '';
        this.resetAccumulation();
        if (this.active) this.status = h ? 'running (HDRI: ' + h.name + ')' : 'running';
    }

    static halve(data, w, h) {
        const nw = w >> 1, nh = Math.max(1, h >> 1), out = new Float32Array(nw * nh * 3);
        for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 3; c++) {
            const y0 = Math.min(h - 1, y * 2), y1 = Math.min(h - 1, y * 2 + 1);
            out[(y * nw + x) * 3 + c] = 0.25 * (data[(y0 * w + x * 2) * 3 + c] + data[(y0 * w + x * 2 + 1) * 3 + c] + data[(y1 * w + x * 2) * 3 + c] + data[(y1 * w + x * 2 + 1) * 3 + c]);
        }
        return { data: out, w: nw, h: nh };
    }

    static f2h(v) {
        const f = WebGPUPathTracer._f32 || (WebGPUPathTracer._f32 = new Float32Array(1)), u = WebGPUPathTracer._u32 || (WebGPUPathTracer._u32 = new Uint32Array(f.buffer));
        if (!(v > 0)) return 0;
        if (v > 65000) v = 65000;
        f[0] = v; const x = u[0];
        const e = ((x >>> 23) & 0xff) - 127 + 15, m = x & 0x7fffff;
        if (e <= 0) { if (e < -10) return 0; return ((m | 0x800000) >> (1 - e + 13)); }
        return (e << 10) | (m >> 13);
    }

    static parseRGBE(bytes) {
        let pos = 0;
        const line = () => { let s = ''; while (pos < bytes.length && bytes[pos] !== 10) s += String.fromCharCode(bytes[pos++]); pos++; return s; };
        const first = line();
        if (!/^#\?(RADIANCE|RGBE)/.test(first)) throw new Error('not a Radiance .hdr file');
        let l;
        while ((l = line()) !== '') { if (pos >= bytes.length) throw new Error('bad header'); }
        const res = line().trim().split(/\s+/);
        if (res.length < 4) throw new Error('bad resolution line');
        const h = parseInt(res[1], 10), w = parseInt(res[3], 10);
        const flipY = res[0] === '+Y';
        const out = new Float32Array(w * h * 3);
        const scan = new Uint8Array(w * 4);
        for (let y = 0; y < h; y++) {
            if (w >= 8 && w < 32768 && bytes[pos] === 2 && bytes[pos + 1] === 2 && !(bytes[pos + 2] & 0x80)) {
                pos += 4;
                for (let c = 0; c < 4; c++) {
                    let x = 0;
                    while (x < w) {
                        let n = bytes[pos++];
                        if (n > 128) { n -= 128; const v = bytes[pos++]; for (let k = 0; k < n; k++) scan[(x++) * 4 + c] = v; }
                        else { for (let k = 0; k < n; k++) scan[(x++) * 4 + c] = bytes[pos++]; }
                    }
                }
            } else {
                for (let x = 0; x < w; x++) { scan[x * 4] = bytes[pos++]; scan[x * 4 + 1] = bytes[pos++]; scan[x * 4 + 2] = bytes[pos++]; scan[x * 4 + 3] = bytes[pos++]; }
            }
            const row = flipY ? h - 1 - y : y;
            for (let x = 0; x < w; x++) {
                const e = scan[x * 4 + 3], o = (row * w + x) * 3;
                if (e) { const f = Math.pow(2, e - 136); out[o] = scan[x * 4] * f; out[o + 1] = scan[x * 4 + 1] * f; out[o + 2] = scan[x * 4 + 2] * f; }
            }
        }
        return { w, h, data: out };
    }

    // ------------------------------------------------------------------ per frame
    updateDynamicResolution(dtMs, moving) {
        const cfg = this.cfg;
        if (dtMs > 0 && dtMs < 1000) this._fpsEma = this._fpsEma ? this._fpsEma * 0.9 + (1000 / dtMs) * 0.1 : 1000 / dtMs;
        this.fps = this._fpsEma;
        if (!cfg.dynRes || !moving) return;
        this._dynT += dtMs;
        if (this._dynT < 700) return;
        this._dynT = 0;
        const tgt = cfg.targetFps || 30;
        let s = this._dynScale;
        if (this._fpsEma < tgt * 0.9) s = Math.max(0.35, s - 0.07);
        else if (this._fpsEma > tgt * 1.2) s = Math.min(1, s + 0.05);
        if (Math.abs(s - this._dynScale) > 1e-3) { this._dynScale = s; }
    }

    render(dtMs) {
        if (!this.active || !this.device || !this._pipelines || !this.game.camera) return false;
        if ((this._inflight || 0) >= 2) return true;
        if (this._pendingHdri) { const p = this._pendingHdri; this._pendingHdri = null; this.uploadHdri(p.img, p.name); }
        const d = this.device, g = this.game, cfg = this.cfg;
        if (!this.buildAtlas()) return false;

        const cam = g.camera;
        cam.updateMatrixWorld();
        const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        const camKey = Array.from(vp.elements, x => x.toFixed(5)).join(',');
        const moving = camKey !== this._lastCamKey;
        this._lastCamKey = camKey;
        this.updateDynamicResolution(dtMs, moving);

        this.ensureTargets();
        this.updateMeshes();
        this.buildBindGroups();
        const enc = d.createCommandEncoder();
        this._worldEdit = false;
        if (this.updateVoxels(enc) || this._worldEdit) this._softReset = Math.min(this._softReset || 1e9, 2);
        const dt = Math.min(0.1, (dtMs || 16) / 1000);
        this._time += dt;

        const inv = new THREE.Matrix4().copy(vp).invert();
        const e = cam.matrixWorld.elements;
        if (!this._prevVP) this._prevVP = vp.clone();

        // sun / sky
        const sun = this.sunState();
        const dim = (g.world && g.world.dimension) || 'overworld';
        const dimId = dim === 'nether' ? 1 : dim === 'end' ? 2 : 0;
        const night = sun.y < -0.08;
        const L = night ? sun.clone().negate() : sun.clone();
        if (L.y < 0.02) { L.y = 0.02; L.normalize(); }
        if (cfg.cloudDrift) { this._cloudT = (this._cloudT || 0) + dt; if (Math.abs(this._cloudT - (this._cloudBaked || 0)) > 3) this._cloudBaked = this._cloudT; }
        const cloudTime = this._cloudBaked || 0;
        const skyKey = [Math.round(sun.x * 400), Math.round(sun.y * 400), Math.round(sun.z * 400), dimId, cfg.sunSize, cfg.sunIntensity, cfg.skyIntensity, cfg.clouds, cloudTime].join(',');
        const skyChanged = skyKey !== this._skyKey;
        if (skyChanged && this._skyKey) this._softReset = Math.min(this._softReset || 1e9, 6);
        let sunCol;
        if (dimId === 0) {
            const T = WebGPUPathTracer.atmosphereTransmittance(sun.y);
            const k = 5.0 * cfg.sunIntensity;
            sunCol = night ? [0.035 * cfg.sunIntensity, 0.045 * cfg.sunIntensity, 0.07 * cfg.sunIntensity] : T.map(x => x * k);
            const fade = night ? 1 : Math.min(1, Math.max(0, (sun.y + 0.06) / 0.12));
            sunCol = sunCol.map(x => x * fade);
        } else if (dimId === 1) sunCol = [0, 0, 0];
        else sunCol = [0.25, 0.18, 0.4];
        if (this.hdri) sunCol = [0, 0, 0];

        let histCap = cfg.maxFrames;
        if (this._resetPending) { histCap = 0; this._resetPending = false; this.accum = 0; }
        if (this._softReset !== undefined && this._softReset !== null) { histCap = Math.min(histCap, this._softReset); this.accum = Math.min(this.accum, this._softReset); this._softReset = null; }
        const alphaMin = moving ? cfg.temporalAlpha : (cfg.accumulate ? 0 : cfg.temporalAlpha);
        if (moving) this.accum = Math.min(this.accum, Math.round(1 / Math.max(0.01, cfg.temporalAlpha)));
        this.accum = Math.min(cfg.maxFrames, this.accum + 1);

        const F = this.uF, I = this.uI, Uu = this.uU, mc = this._meshCounts || [0, 0, 0, 0];
        F.set(inv.elements, 0);
        F.set(this._prevVP.elements, 16);
        F[32] = cam.position.x; F[33] = cam.position.y; F[34] = cam.position.z; F[35] = this.frame;
        const cosMax = Math.cos(Math.max(0.1, cfg.sunSize) * Math.PI / 180);
        F[36] = L.x; F[37] = L.y; F[38] = L.z; F[39] = cosMax;
        F[40] = sunCol[0]; F[41] = sunCol[1]; F[42] = sunCol[2]; F[43] = cfg.skyIntensity;
        I[44] = this.regionMin ? this.regionMin[0] : 0; I[45] = 0; I[46] = this.regionMin ? this.regionMin[1] : 0; I[47] = this.hdri ? 1 : 0;
        Uu[48] = this.w; Uu[49] = this.h; Uu[50] = this.frame >>> 0;
        Uu[51] = (cfg.denoise ? 1 : 0) | (cfg.dof ? 2 : 0) | (moving ? 4 : 0) | (cfg.volumetrics ? 8 : 0) | (night ? 16 : 0) | (cfg.waves ? 32 : 0) |
            (cfg.meshes ? 64 : 0) | (cfg.letterbox ? 128 : 0) | (cfg.autoExposure ? 256 : 0);
        F[52] = cfg.exposure * (night && dimId === 0 && !this.hdri && !cfg.autoExposure ? cfg.nightBoost : 1); F[53] = cfg.emissive; F[54] = cfg.clamp; F[55] = cfg.bounces;
        if (cfg.dof && !cfg.autoFocus) this._focus = cfg.focusDistance;
        F[56] = cfg.dof ? cfg.aperture : 0; F[57] = this._focus; F[58] = this._time; F[59] = (cfg.hdriRotation || 0) * Math.PI / 180;
        F[60] = alphaMin; F[61] = histCap; F[62] = cfg.hdriIntensity; F[63] = this.numEmitters || 0;
        Uu[64] = this.hdri ? this.hdri.cw : 1; Uu[65] = this.hdri ? this.hdri.ch : 1; Uu[66] = this.hdri ? 1 : 0; Uu[67] = dimId;
        const fovY = (cam.fov || 70) * Math.PI / 180;
        F[68] = this.hdri ? this.hdri.funcAvg : 1; F[69] = cfg.waves ? 1 : 0; F[70] = 2 * Math.tan(fovY / 2) / this.h; F[71] = Math.max(1, Math.min(16, cfg.spp | 0));
        F[72] = e[0]; F[73] = e[1]; F[74] = e[2]; F[75] = 0;
        F[76] = e[4]; F[77] = e[5]; F[78] = e[6]; F[79] = 0;
        F[80] = -e[8]; F[81] = -e[9]; F[82] = -e[10]; F[83] = 0;
        F[84] = dimId === 1 ? cfg.fog * 4 : cfg.fog; F[85] = cfg.normalStrength; F[86] = this.outW; F[87] = this.outH;
        Uu[88] = mc[0]; Uu[89] = mc[1]; Uu[90] = mc[2]; Uu[91] = mc[3];
        F[92] = dimId === 0 && !this.hdri ? cfg.clouds : 0; F[93] = cloudTime; F[94] = cfg.cloudShadows ? 1 : 0; F[95] = cfg.translucency ? 1 : 0;
        F[96] = cfg.bloom; F[97] = cfg.chromatic; F[98] = cfg.grain; F[99] = cfg.sharpen;
        F[100] = cfg.vignette; F[101] = cfg.tonemap === 'aces' ? 1 : 0; F[102] = cfg.autoExposure ? 1 : 0; F[103] = cfg.exposureComp;
        F[104] = dt; F[105] = this.wg16 ? this.wg16[0] * this.wg16[1] : 1; F[106] = cfg.adaptSpeed; F[107] = this.wg16 ? this.wg16[0] : 1;
        d.queue.writeBuffer(this.uniformBuf, 0, this.uData);

        const P = this._pipelines, par = this.frame & 1;
        const ts = this.hasTimestamps && !this._tsBusy && (this.frame % 20) === 0;
        if (skyChanged && !this.hdri) {
            this._skyKey = skyKey;
            const p = enc.beginComputePass(); p.setPipeline(P.sk); p.setBindGroup(0, this.skyBG); p.dispatchWorkgroups(128, 64); p.end();
        } else if (skyChanged) this._skyKey = skyKey;

        const gx = Math.ceil(this.w / 8), gy = Math.ceil(this.h / 8);
        let pass = enc.beginComputePass(ts ? { timestampWrites: { querySet: this.tsQuery, beginningOfPassWriteIndex: 0 } } : undefined);
        pass.setPipeline(P.pt); pass.setBindGroup(0, this.ptBG[par]); pass.dispatchWorkgroups(gx, gy);
        pass.setPipeline(P.tp); pass.setBindGroup(0, this.tpBG[par]); pass.dispatchWorkgroups(gx, gy);
        const iters = cfg.denoise ? Math.max(0, Math.min(6, cfg.atrous | 0)) : 0;
        for (let i = 0; i < iters; i++) { pass.setPipeline(P.at); pass.setBindGroup(0, this.atBG[par][i]); pass.dispatchWorkgroups(gx, gy); }
        const finalKey = iters === 0 ? 'filt' : (((iters - 1) & 1) ? 'ping1' : 'ping0');
        pass.setPipeline(P.rs); pass.setBindGroup(0, this.rsBG[finalKey]); pass.dispatchWorkgroups(this.wg16[0], this.wg16[1]);
        pass.setPipeline(P.ex); pass.setBindGroup(0, this.exBG); pass.dispatchWorkgroups(1);
        for (let i = 0; i < 6; i++) { const [lw, lh] = this.bloomLevels[i]; pass.setPipeline(P.bd); pass.setBindGroup(0, this.bdBG[i]); pass.dispatchWorkgroups(Math.ceil(lw / 8), Math.ceil(lh / 8)); }
        for (let i = 4; i >= 0; i--) { const [lw, lh] = this.bloomLevels[i]; pass.setPipeline(P.bu); pass.setBindGroup(0, this.buBG[i]); pass.dispatchWorkgroups(Math.ceil(lw / 8), Math.ceil(lh / 8)); }
        pass.end();

        if (cfg.dof && cfg.autoFocus && !this._focusPending && (this.frame & 7) === 0 && this.focusBuf.mapState === 'unmapped') {
            enc.copyTextureToBuffer({ texture: this.targets.pos[par], origin: [this.w >> 1, this.h >> 1, 0] }, { buffer: this.focusBuf, bytesPerRow: 256 }, [1, 1, 1]);
            this._focusPending = true;
            this._focusRead = true;
        }

        const tsEnd = ts ? { querySet: this.tsQuery, endOfPassWriteIndex: 1 } : undefined;
        if (!this.headless) {
            const view = this.ctx.getCurrentTexture().createView();
            const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }], timestampWrites: tsEnd });
            rp.setPipeline(P.comp); rp.setBindGroup(0, this.compBG); rp.draw(3); rp.end();
        } else if (ts) {
            const p2 = enc.beginComputePass({ timestampWrites: tsEnd }); p2.end();
        }
        if (ts) {
            enc.resolveQuerySet(this.tsQuery, 0, 2, this.tsResolve, 0);
            if (this.tsRead.mapState === 'unmapped') { enc.copyBufferToBuffer(this.tsResolve, 0, this.tsRead, 0, 16); this._tsBusy = true; }
        }
        let snap = null;
        if (this._snap && !this._snapBusy) {
            const W = this.outW, H = this.outH, bpr = Math.ceil(W * 4 / 256) * 256;
            const tex = d.createTexture({ size: [W, H], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
            const buf = d.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
            const rp = enc.beginRenderPass({ colorAttachments: [{ view: tex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
            rp.setPipeline(P.compRGBA); rp.setBindGroup(0, this.compBGx); rp.draw(3); rp.end();
            enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [W, H]);
            snap = { cb: this._snap, tex, buf, W, H, bpr };
            this._snap = null; this._snapBusy = true;
        }
        d.queue.submit([enc.finish()]);
        this._inflight = (this._inflight || 0) + 1;
        d.queue.onSubmittedWorkDone().then(() => { this._inflight--; }, () => { this._inflight = 0; });

        if (this._tsBusy && ts) {
            this.tsRead.mapAsync(GPUMapMode.READ).then(() => {
                const t = new BigInt64Array(this.tsRead.getMappedRange().slice(0, 16));
                this.tsRead.unmap();
                const ms = Number(t[1] - t[0]) / 1e6;
                if (ms > 0 && ms < 10000) this.gpuMs = this.gpuMs ? this.gpuMs * 0.6 + ms * 0.4 : ms;
                this._tsBusy = false;
            }).catch(() => { this._tsBusy = false; });
        }
        if (snap) {
            snap.buf.mapAsync(GPUMapMode.READ).then(() => {
                const src = new Uint8Array(snap.buf.getMappedRange());
                const px = new Uint8ClampedArray(snap.W * snap.H * 4);
                for (let y = 0; y < snap.H; y++) px.set(src.subarray(y * snap.bpr, y * snap.bpr + snap.W * 4), y * snap.W * 4);
                snap.buf.unmap(); snap.buf.destroy(); snap.tex.destroy();
                const c = document.createElement('canvas'); c.width = snap.W; c.height = snap.H;
                c.getContext('2d').putImageData(new ImageData(px, snap.W, snap.H), 0, 0);
                this._snapBusy = false;
                snap.cb(c);
            }).catch((err) => { this._snapBusy = false; console.warn('[PT] screenshot failed:', err); });
        }
        if (this._focusRead) {
            this._focusRead = false;
            const cp = cam.position.clone();
            this.focusBuf.mapAsync(GPUMapMode.READ).then(() => {
                const f = new Float32Array(this.focusBuf.getMappedRange().slice(0, 16));
                this.focusBuf.unmap();
                if (f[3] > 0.5 && f[3] < 1.5) { const dist = Math.hypot(f[0] - cp.x, f[1] - cp.y, f[2] - cp.z); this._focus += (dist - this._focus) * 0.5; }
                else if (f[3] > 1.5) this._focus += (Math.max(0.3, f[2]) - this._focus) * 0.5;
                else this._focus += (200 - this._focus) * 0.3;
                this._focusPending = false;
            }).catch(() => { this._focusPending = false; });
        }

        this._prevVP.copy(vp);
        this.frame++;
        return true;
    }

    screenshot() {
        if (!this.active) { this.toast('Path tracing is off'); return; }
        this._snap = (canvas) => canvas.toBlob((blob) => {
            if (!blob) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'eblankraft_pathtraced_' + Date.now() + '.png';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }, 'image/png');
    }
}

WebGPUPathTracer.U_FLOATS = 108;
WebGPUPathTracer.MAT_FLOATS = 28;
WebGPUPathTracer.CFG_DEFAULTS = {
    scale: 1, spp: 1, bounces: 4, denoise: true, atrous: 5, accumulate: true, maxFrames: 4096, temporalAlpha: 0.12,
    exposure: 1.0, nightBoost: 5, emissive: 1.0, clamp: 12, sunIntensity: 1.0, skyIntensity: 1.0, sunSize: 1.2,
    sunOverride: false, sunElevation: 25, sunAzimuth: 135,
    hdri: 'procedural', hdriIntensity: 1.0, hdriRotation: 0,
    fog: 0.003, volumetrics: true, waves: true,
    clouds: 0.45, cloudShadows: true, cloudDrift: false,
    meshes: true, normalStrength: 1.0, translucency: true,
    dof: false, autoFocus: true, aperture: 0.06, focusDistance: 8, letterbox: false,
    autoExposure: true, exposureComp: 0, adaptSpeed: 2.5, tonemap: 'agx', bloom: 0.05, chromatic: 0.0004, grain: 0.025, sharpen: 0.35, vignette: 0.22,
    dynRes: false, targetFps: 40
};
// settings that only change the post-processing (no accumulation restart)
WebGPUPathTracer.POST_KEYS = ['exposure', 'nightBoost', 'autoExposure', 'exposureComp', 'adaptSpeed', 'tonemap', 'bloom', 'chromatic', 'grain', 'sharpen', 'vignette', 'letterbox', 'dynRes', 'targetFps'];
WebGPUPathTracer.PRESETS = {
    'Fast (RTX 3060 @ 1080p)': { scale: 0.67, spp: 1, bounces: 2, atrous: 4, volumetrics: true, meshes: true, dynRes: true, targetFps: 45, temporalAlpha: 0.15 },
    'Balanced': { scale: 0.85, spp: 1, bounces: 3, atrous: 5, volumetrics: true, meshes: true, dynRes: true, targetFps: 30, temporalAlpha: 0.12 },
    'Ultra': { scale: 1, spp: 1, bounces: 5, atrous: 5, volumetrics: true, meshes: true, dynRes: false, temporalAlpha: 0.1 },
    'Offline photo (stand still)': { scale: 1, spp: 4, bounces: 8, atrous: 3, volumetrics: true, meshes: true, dynRes: false, maxFrames: 16384, temporalAlpha: 0.1 }
};
WebGPUPathTracer.HDRI_PRESETS = {
    'Venice sunset': 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/equirectangular/venice_sunset_1k.hdr',
    'Blouberg sunrise': 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/equirectangular/blouberg_sunrise_2_1k.hdr',
    'Quarry (overcast)': 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/equirectangular/quarry_01_1k.hdr',
    'Royal esplanade': 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/equirectangular/royal_esplanade_1k.hdr',
    'Pedestrian overpass': 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/equirectangular/pedestrian_overpass_1k.hdr',
    'Moonless golf (night)': 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/equirectangular/moonless_golf_1k.hdr',
    'San Giuseppe bridge 2k': 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/equirectangular/san_giuseppe_bridge_2k.hdr'
};

// ====================================================================== WGSL
WebGPUPathTracer.WGSL_COMMON = /* wgsl */`
struct U {
    invViewProj: mat4x4f,
    prevViewProj: mat4x4f,
    camPos: vec4f,        // w = frame
    sunDir: vec4f,        // w = cos of the sun cone half angle
    sunColor: vec4f,      // rgb irradiance, w = sky intensity
    regionMin: vec4i,     // x, -, z, envMode (1 = HDRI)
    res: vec4u,           // w, h, frame, flags
    p0: vec4f,            // exposure, emissive scale, firefly clamp, bounces
    p1: vec4f,            // aperture, focus distance, time, env rotation
    p2: vec4f,            // temporal alpha min, history cap, hdri intensity, emitter count
    env: vec4u,           // cdf w, cdf h, importance, dimension
    p3: vec4f,            // func avg, waves, pixel angle, spp
    camRight: vec4f,
    camUp: vec4f,
    camFwd: vec4f,
    p4: vec4f,            // fog density, normal strength, out w, out h
    mesh: vec4u,          // tlas offset, material offset, world instances, overlay instances (vec4 units in the scene buffer)
    p6: vec4f,            // cloud cover, cloud time, cloud shadows, translucency
    p7: vec4f,            // bloom, chromatic aberration, grain, sharpen
    p8: vec4f,            // vignette, tonemap (1 = ACES, 0 = AgX), auto exposure, exposure compensation (EV)
    p9: vec4f,            // dt, luminance workgroups, adaptation speed, workgroups per row
};
const PI: f32 = 3.14159265;
const F_DENOISE: u32 = 1u;
const F_DOF: u32 = 2u;
const F_MOVING: u32 = 4u;
const F_VOL: u32 = 8u;
const F_NIGHT: u32 = 16u;
const F_WAVES: u32 = 32u;
const F_MESHES: u32 = 64u;
const F_LETTERBOX: u32 = 128u;
fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
fn dirToUv(d: vec3f, rot: f32) -> vec2f {
    let u = atan2(d.x, -d.z) / (2.0 * PI) + 0.5 + rot / (2.0 * PI);
    let v = acos(clamp(d.y, -1.0, 1.0)) / PI;
    return vec2f(fract(u), v);
}
fn uvToDir(uv: vec2f, rot: f32) -> vec3f {
    let phi = (uv.x - 0.5) * 2.0 * PI - rot;
    let th = uv.y * PI;
    return vec3f(sin(th) * sin(phi), cos(th), -sin(th) * cos(phi));
}
// cloud field shared by the sky bake and the cloud shadows
fn cl_h21(p: vec2f) -> f32 { var q = fract(p * vec2f(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
fn cl_vn(p: vec2f) -> f32 {
    let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cl_h21(i), cl_h21(i + vec2f(1.0, 0.0)), f.x), mix(cl_h21(i + vec2f(0.0, 1.0)), cl_h21(i + vec2f(1.0, 1.0)), f.x), f.y);
}
fn cloudDensity(p: vec2f, cover: f32, oct: i32) -> f32 {
    var a = 0.5; var s = 0.0; var q = p;
    for (var i = 0; i < oct; i++) { s += a * cl_vn(q); q = q * 2.03 + vec2f(17.1, 9.3); a *= 0.5; }
    return smoothstep(1.0 - cover - 0.08, 1.0 - cover + 0.32, s);
}
`;

WebGPUPathTracer.WGSL_BRICKS = /* wgsl */`
@group(0) @binding(0) var vox: texture_3d<u32>;
@group(0) @binding(1) var bricks: texture_storage_3d<r32uint, write>;
@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= 64u || id.y >= 8u || id.z >= 64u) { return; }
    var occ = 0u;
    for (var z = 0u; z < 4u; z++) {
        for (var y = 0u; y < 4u; y++) {
            for (var x = 0u; x < 4u; x++) {
                occ = occ | textureLoad(vox, id * 4u + vec3u(x, y, z), 0).r;
            }
        }
    }
    textureStore(bricks, id, vec4u(select(0u, 1u, occ != 0u), 0u, 0u, 0u));
}
`;

WebGPUPathTracer.WGSL_SKY = /* wgsl */`
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var skyOut: texture_storage_2d<rgba16float, write>;

fn hash3(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(12.9898, 78.233, 37.719))) * 43758.5453); }
fn raySphere(ro: vec3f, rd: vec3f, r: f32) -> vec2f {
    let b = dot(ro, rd); let c = dot(ro, ro) - r * r; let h = b * b - c;
    if (h < 0.0) { return vec2f(1e9, -1e9); }
    let s = sqrt(h); return vec2f(-b - s, -b + s);
}
fn atmosphere(rd: vec3f, sd: vec3f) -> vec3f {
    let R = 6360e3; let Ra = 6420e3;
    let bR = vec3f(5.8e-6, 13.5e-6, 33.1e-6); let bM = vec3f(21e-6);
    let ro = vec3f(0.0, R + 200.0, 0.0);
    let ta = raySphere(ro, rd, Ra);
    var tMax = ta.y;
    let tg = raySphere(ro, rd, R);
    if (tg.x > 0.0) { tMax = min(tMax, tg.x); }
    let N = 16; let NL = 8;
    let ds = tMax / f32(N);
    var odR = 0.0; var odM = 0.0;
    var sR = vec3f(0.0); var sM = vec3f(0.0);
    let mu = dot(rd, sd);
    let pR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
    let g = 0.76;
    let pM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
    for (var i = 0; i < N; i++) {
        let p = ro + rd * (f32(i) + 0.5) * ds;
        let h = length(p) - R;
        let hr = exp(-h / 8000.0) * ds; let hm = exp(-h / 1200.0) * ds;
        odR += hr; odM += hm;
        let tl = raySphere(p, sd, Ra).y;
        let dl = tl / f32(NL);
        var lR = 0.0; var lM = 0.0; var ok = true;
        for (var j = 0; j < NL; j++) {
            let q = p + sd * (f32(j) + 0.5) * dl;
            let hq = length(q) - R;
            if (hq < 0.0) { ok = false; break; }
            lR += exp(-hq / 8000.0) * dl; lM += exp(-hq / 1200.0) * dl;
        }
        if (ok) {
            let tau = bR * (odR + lR) + bM * 1.1 * (odM + lM);
            let att = exp(-tau);
            sR += att * hr; sM += att * hm;
        }
    }
    return sR * bR * pR + sM * bM * pM;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= 1024u || id.y >= 512u) { return; }
    let uv = (vec2f(id.xy) + 0.5) / vec2f(1024.0, 512.0);
    let d = uvToDir(uv, 0.0);
    let dim = u.env.w;
    var col = vec3f(0.0);
    let si = u.sunColor.w;
    if (dim == 0u) {
        let night = (u.res.w & F_NIGHT) != 0u;
        let sd = normalize(u.sunDir.xyz);
        let dn = normalize(vec3f(d.x, max(d.y, 0.0), d.z) + vec3f(0.0, 0.0001, 0.0));
        let lightI = select(22.0, 0.35, night);
        if (night) {
            col = atmosphere(dn, sd) * 0.35 + vec3f(0.004, 0.006, 0.012);
            let sp = d * 220.0; let ip = floor(sp);
            let h = hash3(ip);
            let f = fract(sp) - 0.5;
            let star = step(0.985, h) * smoothstep(0.35, 0.0, length(f)) * (0.5 + 0.5 * hash3(ip + 3.7));
            col += vec3f(0.9, 0.95, 1.0) * star * 0.8 * smoothstep(-0.02, 0.15, d.y);
        } else {
            col = atmosphere(dn, sd) * 22.0;
        }
        // lit cloud layer: projected onto a plane, self-shadowed by marching toward the light through the density field
        let cover = u.p6.x;
        if (cover > 0.0 && d.y > 0.01) {
            let wind = vec2f(u.p6.y * 0.02, u.p6.y * 0.007);
            let cp = d.xz / (d.y + 0.08) * 1.6 + wind;
            let dens = cloudDensity(cp, cover, 6);
            if (dens > 0.001) {
                var od = 0.0;
                let sx = sd.xz / max(sd.y, 0.08) * 0.06;
                for (var k = 1; k <= 6; k++) { od += cloudDensity(cp + sx * f32(k), cover, 4); }
                let tr = exp(-od * 0.9);
                let mu = dot(d, sd);
                let silver = 1.0 + 2.5 * pow(max(mu, 0.0), 12.0);
                let sunC = vec3f(1.0, 0.95, 0.88);
                let skyAmb = atmosphere(normalize(vec3f(0.0, 1.0, 0.0)), sd) * lightI;
                var tint = vec3f(1.0);
                if (sd.y < 0.25) { tint = mix(vec3f(1.0, 0.55, 0.3), vec3f(1.0), sd.y / 0.25); }
                let lit = sunC * tint * tr * silver * lightI * 0.06 * max(sd.y + 0.15, 0.0) + skyAmb * (0.55 + 0.45 * dens);
                let a = clamp(dens * 1.4, 0.0, 1.0) * smoothstep(0.01, 0.12, d.y);
                col = mix(col, lit, a);
            }
        }
        if (d.y < 0.0) {
            let k = smoothstep(0.0, -0.15, d.y);
            col = mix(col, col * 0.25 + vec3f(0.02, 0.018, 0.015) * select(1.0, 0.1, night), k);
        }
        col *= si;
    } else if (dim == 1u) {
        let below = clamp(-d.y * 0.5 + 0.5, 0.0, 1.0);
        col = mix(vec3f(0.06, 0.012, 0.008), vec3f(0.35, 0.07, 0.02), pow(below, 2.0)) * si;
    } else {
        let up = d.y * 0.5 + 0.5;
        col = mix(vec3f(0.01, 0.005, 0.02), vec3f(0.06, 0.025, 0.1), up) * si;
        let sp = d * 160.0; let ip = floor(sp);
        let star = step(0.975, hash3(ip)) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5));
        col += vec3f(0.9, 0.85, 1.0) * star * 0.6;
    }
    textureStore(skyOut, id.xy, vec4f(col, 1.0));
}
`;

WebGPUPathTracer.WGSL_TRACE = /* wgsl */`
struct Mat { faceA: vec4u, faceB: vec4u, params: vec4f, tint: vec4f, bmin: vec4f, bmax: vec4f, emit: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var vox: texture_3d<u32>;
@group(0) @binding(2) var bricks: texture_3d<u32>;
@group(0) @binding(3) var atlas: texture_2d_array<f32>;
@group(0) @binding(4) var atlasSamp: sampler;
@group(0) @binding(5) var<storage, read> mats: array<Mat>;
@group(0) @binding(6) var<storage, read> emitters: array<vec4f>;
@group(0) @binding(7) var envTex: texture_2d<f32>;
@group(0) @binding(8) var envSamp: sampler;
@group(0) @binding(9) var<storage, read> envCdf: array<f32>;
@group(0) @binding(10) var outIllum: texture_storage_2d<rgba16float, write>;
@group(0) @binding(11) var outAlbedo: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(12) var outNormal: texture_storage_2d<rgba16float, write>;
@group(0) @binding(13) var outPos: texture_storage_2d<rgba32float, write>;
@group(0) @binding(14) var<storage, read> tris: array<vec4f>;
@group(0) @binding(15) var<storage, read> blas: array<vec4f>;
@group(0) @binding(16) var<storage, read> scene: array<vec4f>;
@group(0) @binding(17) var meshAtlas: texture_2d_array<f32>;
@group(0) @binding(18) var normAtlas: texture_2d_array<f32>;
@group(0) @binding(19) var linSamp: sampler;

const K_OPAQUE: u32 = 1u;
const K_CUTOUT: u32 = 2u;
const K_WATER: u32 = 3u;
const K_GLASS: u32 = 4u;
const K_CROSS: u32 = 5u;
const WATER_ID: u32 = 19u;

var<private> rngState: u32;
fn pcg(v: u32) -> u32 { let s = v * 747796405u + 2891336453u; let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
fn rnd() -> f32 { rngState = pcg(rngState); return f32(rngState >> 8u) / 16777216.0; }
fn rnd2() -> vec2f { return vec2f(rnd(), rnd()); }

fn voxelAt(c: vec3i) -> u32 {
    return textureLoad(vox, vec3u(bitcast<u32>(c.x) & 255u, u32(c.y), bitcast<u32>(c.z) & 255u), 0).r;
}
fn brickAt(c: vec3i) -> u32 {
    return textureLoad(bricks, vec3u((bitcast<u32>(c.x) >> 2u) & 63u, u32(c.y) >> 2u, (bitcast<u32>(c.z) >> 2u) & 63u), 0).r;
}
fn layerOf(m: Mat, f: u32) -> u32 {
    if (f == 0u) { return m.faceA.x; } if (f == 1u) { return m.faceA.y; } if (f == 2u) { return m.faceA.z; }
    if (f == 3u) { return m.faceA.w; } if (f == 4u) { return m.faceB.x; } return m.faceB.y;
}
fn faceOf(n: vec3f) -> u32 {
    if (n.x > 0.5) { return 0u; } if (n.x < -0.5) { return 1u; } if (n.y > 0.5) { return 2u; }
    if (n.y < -0.5) { return 3u; } if (n.z > 0.5) { return 4u; } return 5u;
}
fn faceUv(f: vec3f, n: vec3f) -> vec2f {
    if (abs(n.x) > 0.5) { return vec2f(select(f.z, 1.0 - f.z, n.x > 0.0), 1.0 - f.y); }
    if (abs(n.y) > 0.5) { return vec2f(f.x, select(1.0 - f.z, f.z, n.y > 0.0)); }
    return vec2f(select(1.0 - f.x, f.x, n.z > 0.0), 1.0 - f.y);
}
// world directions of +u and of "image up" for each face (matches faceUv)
fn faceT(n: vec3f) -> vec3f {
    if (n.x > 0.5) { return vec3f(0.0, 0.0, -1.0); } if (n.x < -0.5) { return vec3f(0.0, 0.0, 1.0); }
    if (n.z < -0.5) { return vec3f(-1.0, 0.0, 0.0); } return vec3f(1.0, 0.0, 0.0);
}
fn faceB(n: vec3f) -> vec3f {
    if (n.y > 0.5) { return vec3f(0.0, 0.0, -1.0); } if (n.y < -0.5) { return vec3f(0.0, 0.0, 1.0); }
    return vec3f(0.0, 1.0, 0.0);
}
fn texSample(m: Mat, face: u32, uv: vec2f, lod: f32) -> vec4f {
    let l = layerOf(m, face);
    let c = textureSampleLevel(atlas, atlasSamp, uv, l, lod);
    return vec4f(c.rgb * m.tint.rgb, c.a);
}

struct Hit { t: f32, n: vec3f, typ: u32, cell: vec3i, uv: vec2f, face: u32, ok: bool, trans: vec3f, waterDist: f32 };

fn boxT(ro: vec3f, inv: vec3f, bmin: vec3f, bmax: vec3f) -> vec2f {
    let t1 = (bmin - ro) * inv; let t2 = (bmax - ro) * inv;
    let tn = min(t1, t2); let tf = max(t1, t2);
    return vec2f(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
fn boxNormal(ro: vec3f, inv: vec3f, rd: vec3f, bmin: vec3f, bmax: vec3f) -> vec3f {
    let t1 = (bmin - ro) * inv; let t2 = (bmax - ro) * inv;
    let tn = min(t1, t2);
    if (tn.x >= tn.y && tn.x >= tn.z) { return vec3f(-sign(rd.x), 0.0, 0.0); }
    if (tn.y >= tn.z) { return vec3f(0.0, -sign(rd.y), 0.0); }
    return vec3f(0.0, 0.0, -sign(rd.z));
}
fn safeDir(d: vec3f) -> vec3f {
    var r = select(d, sign(d) * 1e-6 + d, abs(d) < vec3f(1e-6));
    return select(r, vec3f(1e-6), r == vec3f(0.0));
}

// ------------------------------------------------------------------ voxel DDA
// mode 0: ray in air, 1: ray inside water, 2: shadow ray (transmittance in trans, ok = fully blocked)
fn march(ro: vec3f, rdIn: vec3f, tMax: f32, mode: u32, lod: f32) -> Hit {
    var h: Hit; h.ok = false; h.t = tMax; h.trans = vec3f(1.0); h.waterDist = 0.0; h.typ = 0u;
    let rd = safeDir(rdIn);
    let inv = 1.0 / rd;
    let rmin = vec3f(f32(u.regionMin.x), 0.0, f32(u.regionMin.z));
    let rmax = rmin + vec3f(256.0, 32.0, 256.0);
    let tb = boxT(ro, inv, rmin, rmax);
    if (tb.x > tb.y || tb.y < 0.0) { return h; }
    var t = max(tb.x, 0.0);
    let tEnd = min(tb.y, tMax);
    let stepI = vec3i(select(vec3i(-1), vec3i(1), rd > vec3f(0.0)));
    let tDelta = abs(inv);
    var cell = vec3i(floor(ro + rd * (t + 1e-4)));
    cell = clamp(cell, vec3i(rmin), vec3i(rmax) - vec3i(1));
    var tNext = (vec3f(cell) + max(vec3f(stepI), vec3f(0.0)) - ro) * inv;
    var axis: i32 = -1;
    if (tb.x > 0.0) {
        let t1 = (rmin - ro) * inv; let t2 = (rmax - ro) * inv; let tn = min(t1, t2);
        if (tn.x >= tn.y && tn.x >= tn.z) { axis = 0; } else if (tn.y >= tn.z) { axis = 1; } else { axis = 2; }
    }
    let inWater = mode == 1u;
    for (var i = 0; i < 900; i++) {
        if (t > tEnd) { break; }
        if (any(cell < vec3i(rmin)) || any(cell >= vec3i(rmax))) { break; }
        let tCellExit = min(min(tNext.x, tNext.y), tNext.z);
        if (!inWater && brickAt(cell) == 0u) {
            let bmin = vec3f(cell & vec3i(-4));
            let bmax = bmin + vec3f(4.0);
            let tf = (select(bmin, bmax, rd > vec3f(0.0)) - ro) * inv;
            var ax = 2;
            if (tf.x <= tf.y && tf.x <= tf.z) { ax = 0; } else if (tf.y <= tf.z) { ax = 1; }
            let tx = min(min(tf.x, tf.y), tf.z);
            let p = ro + rd * tx;
            var nc = vec3i(floor(p));
            if (ax == 0) { nc.x = select(i32(bmin.x) - 1, i32(bmax.x), stepI.x > 0); }
            else if (ax == 1) { nc.y = select(i32(bmin.y) - 1, i32(bmax.y), stepI.y > 0); }
            else { nc.z = select(i32(bmin.z) - 1, i32(bmax.z), stepI.z > 0); }
            if (ax != 0) { nc.x = clamp(nc.x, i32(bmin.x), i32(bmax.x) - 1); }
            if (ax != 1) { nc.y = clamp(nc.y, i32(bmin.y), i32(bmax.y) - 1); }
            if (ax != 2) { nc.z = clamp(nc.z, i32(bmin.z), i32(bmax.z) - 1); }
            cell = nc; t = tx; axis = ax;
            tNext = (vec3f(cell) + max(vec3f(stepI), vec3f(0.0)) - ro) * inv;
            continue;
        }
        let v = voxelAt(cell);
        var hitHere = false;
        var hn = vec3f(0.0);
        var ht = t;
        var huv = vec2f(0.0);
        var hface = 0u;
        if (axis == 0) { hn.x = -f32(stepI.x); } else if (axis == 1) { hn.y = -f32(stepI.y); } else if (axis == 2) { hn.z = -f32(stepI.z); }
        if (mode == 2u) {
            if (v == WATER_ID) { h.waterDist += max(0.0, min(tCellExit, tEnd) - t); }
            else if (v != 0u) {
                let m = mats[v];
                let kind = m.faceB.z;
                if (kind == K_GLASS) {
                    h.trans *= vec3f(0.85, 0.9, 0.88) * (1.0 - m.tint.a * 0.35);
                } else if ((m.faceB.w & 1u) != 0u) {
                    let bt = boxT(ro, inv, vec3f(cell) + m.bmin.xyz, vec3f(cell) + m.bmax.xyz);
                    if (bt.x <= bt.y && bt.y > t - 1e-4 && bt.x < tCellExit + 1e-4) { h.ok = true; h.trans = vec3f(0.0); return h; }
                } else if (kind == K_CUTOUT && axis >= 0) {
                    let p = ro + rd * t; let f = p - vec3f(cell);
                    let a = texSample(m, faceOf(hn), faceUv(f, hn), lod).a;
                    if (a > 0.5) {
                        // translucent foliage lets a little light through
                        if (m.bmin.w > 0.0) { h.trans *= mix(vec3f(0.0), vec3f(0.25, 0.4, 0.12), m.bmin.w * u.p6.w); if (all(h.trans < vec3f(0.01))) { h.ok = true; return h; } }
                        else { h.ok = true; h.trans = vec3f(0.0); return h; }
                    }
                } else if (kind == K_CROSS) {
                    h.trans *= 0.55;
                } else if (axis >= 0 || t > 0.0) {
                    h.ok = true; h.trans = vec3f(0.0); return h;
                }
            }
        } else if (inWater) {
            if (v != WATER_ID && axis >= 0) {
                hitHere = true; ht = t;
                hface = faceOf(hn); huv = faceUv(ro + rd * t - vec3f(cell), hn);
            }
        } else if (v != 0u && axis >= 0) {
            let m = mats[v];
            let kind = m.faceB.z;
            let f = ro + rd * t - vec3f(cell);
            if (kind == K_WATER) {
                hitHere = true;
            } else if (kind == K_CROSS) {
                let o = ro - vec3f(cell);
                var best = 1e9; var bn = vec3f(0.0); var buv = vec2f(0.0);
                let dA = rd.x - rd.z;
                if (abs(dA) > 1e-6) {
                    let ta = -(o.x - o.z) / dA;
                    if (ta >= t && ta <= tCellExit) {
                        let q = o + rd * ta;
                        if (all(q >= vec3f(-1e-3)) && all(q <= vec3f(1.001))) {
                            let a = texSample(m, 0u, vec2f(q.x, 1.0 - q.y), lod).a;
                            if (a > 0.5) { best = ta; bn = normalize(vec3f(1.0, 0.0, -1.0)); buv = vec2f(q.x, 1.0 - q.y); }
                        }
                    }
                }
                let dB = rd.x + rd.z;
                if (abs(dB) > 1e-6) {
                    let tb2 = (1.0 - o.x - o.z) / dB;
                    if (tb2 >= t && tb2 <= tCellExit && tb2 < best) {
                        let q = o + rd * tb2;
                        if (all(q >= vec3f(-1e-3)) && all(q <= vec3f(1.001))) {
                            let a = texSample(m, 0u, vec2f(q.x, 1.0 - q.y), lod).a;
                            if (a > 0.5) { best = tb2; bn = normalize(vec3f(1.0, 0.0, 1.0)); buv = vec2f(q.x, 1.0 - q.y); }
                        }
                    }
                }
                if (best < 1e8) { hitHere = true; ht = best; hn = select(bn, -bn, dot(bn, rd) > 0.0); huv = buv; hface = 0u; }
            } else if ((m.faceB.w & 1u) != 0u) {
                let bmn = vec3f(cell) + m.bmin.xyz; let bmx = vec3f(cell) + m.bmax.xyz;
                let bt = boxT(ro, inv, bmn, bmx);
                if (bt.x <= bt.y && bt.x >= t - 1e-4 && bt.x <= tCellExit + 1e-4) {
                    hitHere = true; ht = max(bt.x, t);
                    hn = boxNormal(ro, inv, rd, bmn, bmx);
                    huv = faceUv(ro + rd * ht - vec3f(cell), hn); hface = faceOf(hn);
                }
            } else {
                hface = faceOf(hn); huv = faceUv(f, hn);
                if (kind == K_CUTOUT) { hitHere = texSample(m, hface, huv, lod).a > 0.5; }
                else { hitHere = true; }
            }
        }
        if (hitHere) {
            h.ok = true; h.t = ht; h.n = hn; h.typ = v; h.cell = cell; h.uv = huv; h.face = hface;
            return h;
        }
        if (tNext.x < tNext.y && tNext.x < tNext.z) { cell.x += stepI.x; t = tNext.x; tNext.x += tDelta.x; axis = 0; }
        else if (tNext.y < tNext.z) { cell.y += stepI.y; t = tNext.y; tNext.y += tDelta.y; axis = 1; }
        else { cell.z += stepI.z; t = tNext.z; tNext.z += tDelta.z; axis = 2; }
    }
    return h;
}

// ------------------------------------------------------------------ mesh BVH (TLAS over instances -> BLAS over triangles)
struct MHit { t: f32, inst: u32, tri: u32, b: vec2f, ok: bool };

fn nodeHit(bmin: vec3f, bmax: vec3f, o: vec3f, inv: vec3f, tMax: f32) -> f32 {
    let t1 = (bmin - o) * inv; let t2 = (bmax - o) * inv;
    let tn = max(max(min(t1.x, t2.x), min(t1.y, t2.y)), min(t1.z, t2.z));
    let tf = min(min(max(t1.x, t2.x), max(t1.y, t2.y)), max(t1.z, t2.z));
    if (tf >= max(tn, 0.0) && tn < tMax) { return max(tn, 0.0); }
    return 1e30;
}
fn instMeta(i: u32) -> vec4u { return bitcast<vec4u>(scene[i * 4u + 3u]); }
fn meshMat(i: u32) -> array<vec4f, 4> {
    let o = u.mesh.y + i * 4u;
    return array<vec4f, 4>(scene[o], scene[o + 1u], scene[o + 2u], scene[o + 3u]);
}
fn triUv(tri: u32, b: vec2f) -> vec2f {
    let a = tris[tri * 5u + 3u]; let c = tris[tri * 5u + 4u];
    return a.xy * (1.0 - b.x - b.y) + a.zw * b.x + c.xy * b.y;
}
fn meshAlphaPass(inst: u32, tri: u32, b: vec2f) -> bool {
    let mt = instMeta(inst);
    let g = bitcast<u32>(tris[tri * 5u].w);
    let m = meshMat(mt.y + g);
    if (m[0].w <= 0.0 || m[1].x < 0.0) { return true; }
    var uv = triUv(tri, b);
    if (m[1].w > 0.5) { uv.y = 1.0 - uv.y; }
    let a = textureSampleLevel(meshAtlas, atlasSamp, fract(uv), i32(m[1].x), 0.0).a;
    return a >= m[0].w;
}
// one instance: closest (or any) hit along the local-space ray
fn traceInstance(i: u32, ro: vec3f, rd: vec3f, best: ptr<function, MHit>, anyHit: bool) {
    let r0 = scene[i * 4u]; let r1 = scene[i * 4u + 1u]; let r2 = scene[i * 4u + 2u];
    let mt = instMeta(i);
    let lo = vec3f(dot(r0.xyz, ro) + r0.w, dot(r1.xyz, ro) + r1.w, dot(r2.xyz, ro) + r2.w);
    let ld = safeDir(vec3f(dot(r0.xyz, rd), dot(r1.xyz, rd), dot(r2.xyz, rd)));
    let inv = 1.0 / ld;
    let mirrored = (mt.z & 2u) != 0u;
    let dbl = (mt.z & 4u) != 0u; let back = (mt.z & 8u) != 0u; let alpha = (mt.z & 16u) != 0u;
    var stack: array<u32, 32>;
    var sp = 0;
    var node = mt.x;
    for (var it = 0; it < 512; it++) {
        let a = blas[node * 2u]; let bb = blas[node * 2u + 1u];
        let cnt = bitcast<u32>(bb.w);
        if (cnt > 0u) {
            let first = bitcast<u32>(a.w);
            for (var k = 0u; k < cnt; k++) {
                let tri = first + k;
                let p0 = tris[tri * 5u].xyz; let p1 = tris[tri * 5u + 1u].xyz; let p2 = tris[tri * 5u + 2u].xyz;
                let e1 = p1 - p0; let e2 = p2 - p0;
                let pv = cross(ld, e2);
                let det = dot(e1, pv);
                if (abs(det) < 1e-12) { continue; }
                let front = (det > 0.0) != mirrored;
                if (!dbl && (front == back)) { continue; }
                let id = 1.0 / det;
                let tv = lo - p0;
                let bu = dot(tv, pv) * id;
                if (bu < 0.0 || bu > 1.0) { continue; }
                let qv = cross(tv, e1);
                let bv = dot(ld, qv) * id;
                if (bv < 0.0 || bu + bv > 1.0) { continue; }
                let t = dot(e2, qv) * id;
                if (t <= 1e-4 || t >= (*best).t) { continue; }
                if (alpha && !meshAlphaPass(i, tri, vec2f(bu, bv))) { continue; }
                (*best).t = t; (*best).inst = i; (*best).tri = tri; (*best).b = vec2f(bu, bv); (*best).ok = true;
                if (anyHit) { return; }
            }
        } else {
            let l = bitcast<u32>(a.w);
            let la = blas[l * 2u]; let lb = blas[l * 2u + 1u];
            let ra = blas[(l + 1u) * 2u]; let rb = blas[(l + 1u) * 2u + 1u];
            let tl = nodeHit(la.xyz, lb.xyz, lo, inv, (*best).t);
            let tr = nodeHit(ra.xyz, rb.xyz, lo, inv, (*best).t);
            if (tl < 1e29 && tr < 1e29) {
                let nearL = tl <= tr;
                if (sp < 32) { stack[sp] = select(l, l + 1u, nearL); sp++; }
                node = select(l + 1u, l, nearL);
                continue;
            } else if (tl < 1e29) { node = l; continue; }
            else if (tr < 1e29) { node = l + 1u; continue; }
        }
        if (sp == 0) { break; }
        sp--; node = stack[sp];
    }
}
fn traceMeshes(ro: vec3f, rd: vec3f, tMax: f32, overlay: bool, anyHit: bool) -> MHit {
    var h: MHit; h.ok = false; h.t = tMax;
    if ((u.res.w & F_MESHES) == 0u) { return h; }
    let nW = u.mesh.z;
    if (nW > 0u) {
        let rdS = safeDir(rd);
        let inv = 1.0 / rdS;
        let toff = u.mesh.x;
        var stack: array<u32, 32>;
        var sp = 0;
        var node = 0u;
        for (var it = 0; it < 256; it++) {
            let a = scene[toff + node * 2u]; let bb = scene[toff + node * 2u + 1u];
            let cnt = bitcast<u32>(bb.w);
            if (cnt > 0u) {
                let first = bitcast<u32>(a.w);
                for (var k = 0u; k < cnt; k++) {
                    traceInstance(first + k, ro, rd, &h, anyHit);
                    if (anyHit && h.ok) { return h; }
                }
            } else {
                let l = bitcast<u32>(a.w);
                let la = scene[toff + l * 2u]; let lb = scene[toff + l * 2u + 1u];
                let ra = scene[toff + (l + 1u) * 2u]; let rb = scene[toff + (l + 1u) * 2u + 1u];
                let tl = nodeHit(la.xyz, lb.xyz, ro, inv, h.t);
                let tr = nodeHit(ra.xyz, rb.xyz, ro, inv, h.t);
                if (tl < 1e29 && tr < 1e29) {
                    let nearL = tl <= tr;
                    if (sp < 32) { stack[sp] = select(l, l + 1u, nearL); sp++; }
                    node = select(l + 1u, l, nearL);
                    continue;
                } else if (tl < 1e29) { node = l; continue; }
                else if (tr < 1e29) { node = l + 1u; continue; }
            }
            if (sp == 0) { break; }
            sp--; node = stack[sp];
        }
    }
    // first-person hand / weapon: drawn on top of the world (never clipped by walls), only for rays that are allowed to see it
    if (overlay && u.mesh.w > 0u) {
        var ho: MHit; ho.ok = false; ho.t = 1e4;
        for (var k = 0u; k < u.mesh.w; k++) { traceInstance(nW + k, ro, rd, &ho, anyHit); }
        if (ho.ok) { return ho; }
    }
    return h;
}

fn shadowRay(p: vec3f, d: vec3f, tMax: f32, ov: bool) -> vec3f {
    let h = march(p, d, tMax, 2u, 3.0);
    if (h.ok) { return vec3f(0.0); }
    let T = h.trans * exp(-vec3f(0.45, 0.09, 0.06) * h.waterDist);
    if (all(T < vec3f(1e-3))) { return vec3f(0.0); }
    if (traceMeshes(p, d, tMax, ov, true).ok) { return vec3f(0.0); }
    return T;
}
fn cloudShadow(p: vec3f, sd: vec3f) -> f32 {
    if (u.p6.x <= 0.0 || u.p6.z <= 0.0 || u.env.w != 0u) { return 1.0; }
    let hgt = 220.0;
    let q = p.xz + sd.xz / max(sd.y, 0.1) * (hgt - p.y);
    let dens = cloudDensity(q * 0.004 + vec2f(u.p6.y * 0.02, u.p6.y * 0.007), u.p6.x, 4);
    return mix(1.0, 0.18, clamp(dens * 1.3, 0.0, 1.0));
}

// ------------------------------------------------------------------ environment
fn envRadiance(d: vec3f) -> vec3f {
    let hdri = u.regionMin.w == 1;
    let uv = dirToUv(d, select(0.0, u.p1.w, hdri));
    let c = textureSampleLevel(envTex, envSamp, uv, 0.0).rgb;
    return select(c, c * u.p2.z, hdri);
}
fn sunDisc(d: vec3f) -> vec3f {
    let cosT = dot(d, normalize(u.sunDir.xyz));
    if (cosT < u.sunDir.w) { return vec3f(0.0); }
    let solid = 2.0 * PI * (1.0 - u.sunDir.w);
    return u.sunColor.rgb / solid;
}
fn findInterval(off: u32, n: u32, x: f32) -> u32 {
    var lo = 0u; var hi = n;
    for (var k = 0; k < 16; k++) {
        if (hi - lo <= 1u) { break; }
        let mid = (lo + hi) / 2u;
        if (envCdf[off + mid] <= x) { lo = mid; } else { hi = mid; }
    }
    return lo;
}
fn envPdf(d: vec3f) -> f32 {
    let w = u.env.x; let hh = u.env.y;
    let uv = dirToUv(d, u.p1.w);
    let x = min(u32(uv.x * f32(w)), w - 1u); let y = min(u32(uv.y * f32(hh)), hh - 1u);
    let fOff = (hh + 1u) + (w + 1u) * hh;
    let st = sin(PI * (f32(y) + 0.5) / f32(hh));
    if (st <= 0.0) { return 0.0; }
    return (envCdf[fOff + y * w + x] / u.p3.x) / (2.0 * PI * PI * st);
}
fn sampleEnv() -> vec4f {
    let w = u.env.x; let hh = u.env.y;
    let r = rnd2();
    let y = findInterval(0u, hh, r.y);
    let cOff = (hh + 1u) + y * (w + 1u);
    let x = findInterval(cOff, w, r.x);
    let c0 = envCdf[cOff + x]; let c1 = envCdf[cOff + x + 1u];
    let fx = (f32(x) + clamp((r.x - c0) / max(c1 - c0, 1e-9), 0.0, 1.0)) / f32(w);
    let m0 = envCdf[y]; let m1 = envCdf[y + 1u];
    let fy = (f32(y) + clamp((r.y - m0) / max(m1 - m0, 1e-9), 0.0, 1.0)) / f32(hh);
    let d = uvToDir(vec2f(fx, fy), u.p1.w);
    return vec4f(d, envPdf(d));
}

// ------------------------------------------------------------------ BSDF: Lambert + GGX (VNDF) + diffuse transmission
fn onb(n: vec3f) -> mat3x3f {
    let s = select(-1.0, 1.0, n.z >= 0.0);
    let a = -1.0 / (s + n.z); let b = n.x * n.y * a;
    return mat3x3f(vec3f(1.0 + s * n.x * n.x * a, s * b, -s * n.x), vec3f(b, s + n.y * n.y * a, -n.y), n);
}
fn cosineSample(n: vec3f) -> vec3f {
    let r = rnd2(); let phi = 2.0 * PI * r.x; let sr = sqrt(r.y);
    return normalize(onb(n) * vec3f(cos(phi) * sr, sin(phi) * sr, sqrt(max(0.0, 1.0 - r.y))));
}
fn D_ggx(nh: f32, a2: f32) -> f32 { let d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
fn G1(nx: f32, a2: f32) -> f32 { return 2.0 * nx / (nx + sqrt(a2 + (1.0 - a2) * nx * nx)); }
fn fresnel(f0: vec3f, c: f32) -> vec3f { return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
fn sampleVndf(Ve: vec3f, alpha: f32, r: vec2f) -> vec3f {
    let Vh = normalize(vec3f(alpha * Ve.x, alpha * Ve.y, Ve.z));
    let lensq = Vh.x * Vh.x + Vh.y * Vh.y;
    let T1 = select(vec3f(1.0, 0.0, 0.0), vec3f(-Vh.y, Vh.x, 0.0) / sqrt(lensq), lensq > 0.0);
    let T2 = cross(Vh, T1);
    let rr = sqrt(r.x); let phi = 2.0 * PI * r.y;
    let t1 = rr * cos(phi); var t2 = rr * sin(phi);
    let s = 0.5 * (1.0 + Vh.z);
    t2 = (1.0 - s) * sqrt(max(0.0, 1.0 - t1 * t1)) + s * t2;
    let Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * Vh;
    return normalize(vec3f(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
}
struct Surf { albedo: vec3f, rough: f32, metal: f32, n: vec3f, ng: vec3f, trans: f32 };
fn specProb(s: Surf, nv: f32) -> f32 {
    let f0 = mix(vec3f(0.04), s.albedo, s.metal);
    let F = lum(fresnel(f0, nv));
    let dw = lum(s.albedo) * (1.0 - s.metal);
    return clamp(F / max(F + dw * (1.0 - F), 1e-4), 0.08, 0.95);
}
// f * |cos| (rgb) and the pdf of sampleBsdf (w)
fn evalBsdf(s: Surf, V: vec3f, L: vec3f) -> vec4f {
    let n = s.n;
    let nl = dot(n, L); let nv = max(dot(n, V), 1e-4);
    let pT = s.trans * 0.5;
    if (nl <= 0.0 || dot(s.ng, L) <= 0.0) {
        if (pT > 0.0 && dot(s.ng, L) < 0.0) {
            let c = abs(dot(s.ng, L));
            return vec4f(s.albedo * s.trans / PI * c, pT * c / PI);
        }
        return vec4f(0.0);
    }
    let H = normalize(V + L);
    let nh = max(dot(n, H), 0.0); let vh = max(dot(V, H), 1e-4);
    let a = max(s.rough * s.rough, 0.002); let a2 = a * a;
    let f0 = mix(vec3f(0.04), s.albedo, s.metal);
    let F = fresnel(f0, vh);
    let D = D_ggx(nh, a2);
    let G = G1(nl, a2) * G1(nv, a2);
    let spec = F * D * G / (4.0 * nv * nl);
    let diff = (1.0 - s.metal) * (1.0 - F) * s.albedo * (1.0 - s.trans) / PI;
    let ps = specProb(s, nv);
    let pdfSpec = D * G1(nv, a2) / (4.0 * nv);
    let pdf = (1.0 - pT) * ((1.0 - ps) * nl / PI + ps * pdfSpec);
    return vec4f((diff + spec) * nl, pdf);
}
fn sampleBsdf(s: Surf, V: vec3f) -> vec3f {
    if (s.trans > 0.0 && rnd() < s.trans * 0.5) { return cosineSample(-s.ng); }
    let nv = max(dot(s.n, V), 1e-4);
    if (rnd() < specProb(s, nv)) {
        let B = onb(s.n);
        let Vl = transpose(B) * V;
        let a = max(s.rough * s.rough, 0.002);
        let Hl = sampleVndf(Vl, a, rnd2());
        return reflect(-V, B * Hl);
    }
    return cosineSample(s.n);
}
fn misW(a: f32, b: f32) -> f32 { let a2 = a * a; return a2 / max(a2 + b * b, 1e-12); }

fn waveNormal(p: vec3f, t: f32) -> vec3f {
    var dx = 0.0; var dz = 0.0;
    var dirs = array<vec2f, 4>(vec2f(0.8, 0.6), vec2f(-0.4, 0.9), vec2f(0.95, -0.3), vec2f(-0.7, -0.7));
    var fr = array<f32, 4>(1.3, 2.1, 3.7, 5.3);
    var am = array<f32, 4>(0.035, 0.022, 0.012, 0.007);
    for (var i = 0; i < 4; i++) {
        let ph = dot(dirs[i], p.xz) * fr[i] + t * (1.0 + f32(i) * 0.6);
        let c = cos(ph) * am[i] * fr[i];
        dx += dirs[i].x * c; dz += dirs[i].y * c;
    }
    return normalize(vec3f(-dx, 1.0, -dz));
}

fn sampleEmitters(p: vec3f, pBack: vec3f, s: Surf, V: vec3f) -> vec3f {
    let cnt = u32(u.p2.w);
    if (cnt == 0u || u.p0.y <= 0.0) { return vec3f(0.0); }
    var wSum = 0.0; var chosen = vec4f(0.0); var chosenW = 0.0;
    for (var k = 0; k < 4; k++) {
        let e = emitters[min(u32(rnd() * f32(cnt)), cnt - 1u)];
        let c = e.xyz + vec3f(0.5);
        let dv = c - p; let d2 = max(dot(dv, dv), 0.25);
        let m = mats[u32(e.w)];
        let cosv = max(dot(s.n, dv * inverseSqrt(d2)), 0.0) + 0.05;
        let w = m.emit.w * cosv / d2;
        wSum += w;
        if (rnd() * wSum < w) { chosen = e; chosenW = w; }
    }
    if (chosenW <= 0.0) { return vec3f(0.0); }
    let m = mats[u32(chosen.w)];
    let tp = chosen.xyz + vec3f(0.15) + rnd2().xyx * 0.7;
    let dv = tp - p; let dist = length(dv); let L = dv / dist;
    let fb = evalBsdf(s, V, L);
    if (fb.w <= 0.0) { return vec3f(0.0); }
    let o = select(p, pBack, dot(L, s.ng) < 0.0);
    let vis = shadowRay(o, L, max(0.0, dist - 0.9), false);
    if (all(vis == vec3f(0.0))) { return vec3f(0.0); }
    let solid = min(2.0 * PI, 0.9 / max(dist * dist, 0.25));
    return m.emit.rgb * u.p0.y * solid * fb.rgb * vis * (wSum * f32(cnt) / (4.0 * chosenW));
}

fn viewSpace(d: vec3f) -> vec3f { return vec3f(dot(d, normalize(u.camRight.xyz)), dot(d, normalize(u.camUp.xyz)), dot(d, normalize(u.camFwd.xyz))); }

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let W = u.res.x; let H = u.res.y;
    if (id.x >= W || id.y >= H) { return; }
    rngState = pcg(id.x + id.y * 9781u + u.res.z * 6271933u);
    rngState = pcg(rngState ^ (u.res.z * 26699u));
    let flags = u.res.w;
    let spp = u32(u.p3.w);
    let maxB = i32(u.p0.w);
    let hdri = u.regionMin.w == 1;
    let fogD = u.p4.x;

    var sumRad = vec3f(0.0);
    var gAlb = vec3f(1.0); var gN = vec3f(0.0); var gPos = vec3f(0.0); var gHit = 0.0; var gDepth = 1e4; var gSpec = 0.0;

    for (var sIdx = 0u; sIdx < spp; sIdx++) {
        let jit = rnd2();
        let ndc = vec2f((f32(id.x) + jit.x) / f32(W) * 2.0 - 1.0, 1.0 - (f32(id.y) + jit.y) / f32(H) * 2.0);
        let pn = u.invViewProj * vec4f(ndc, -1.0, 1.0);
        let pf = u.invViewProj * vec4f(ndc, 1.0, 1.0);
        var rd = normalize(pf.xyz / pf.w - pn.xyz / pn.w);
        var ro = u.camPos.xyz;
        let rdPin = rd;
        if ((flags & F_DOF) != 0u && u.p1.x > 0.0) {
            let fwd = normalize(u.camFwd.xyz);
            let fp = ro + rd * (u.p1.y / max(dot(rd, fwd), 0.05));
            let r = rnd2(); let ang = 2.0 * PI * r.x; let rr = sqrt(r.y) * u.p1.x;
            ro = ro + normalize(u.camRight.xyz) * cos(ang) * rr + normalize(u.camUp.xyz) * sin(ang) * rr;
            rd = normalize(fp - ro);
        }
        var inWater = voxelAt(vec3i(floor(ro))) == WATER_ID && ro.y >= 0.0 && ro.y < 32.0;
        var thr = vec3f(1.0);
        var rad = vec3f(0.0);
        var prevPdf = 0.0;
        var coneW = 0.0;
        var onOverlay = true;      // the camera ray may see the first-person weapon; afterwards only rays leaving it can
        for (var b = 0; b <= maxB; b++) {
            let lod0 = log2(max(1e-4, coneW) * 64.0);
            // the pinhole primary ray sees the weapon in focus even with DOF on
            var mh = traceMeshes(select(ro, u.camPos.xyz, b == 0), select(rd, rdPin, b == 0), 1e4, onOverlay, false);
            let ovHit = mh.ok && mh.inst >= u.mesh.z;
            if (ovHit && b == 0) { ro = u.camPos.xyz; rd = rdPin; }
            let hit = march(ro, rd, select(mh.t, 1e4, ovHit || !mh.ok), select(0u, 1u, inWater), lod0);
            let useMesh = mh.ok && (ovHit || !hit.ok || mh.t < hit.t);
            let segT = select(select(140.0, hit.t, hit.ok), mh.t, useMesh);
            if (inWater) { thr *= exp(-vec3f(0.45, 0.09, 0.06) * segT); }
            else if (fogD > 0.0 && u.env.w != 2u && !ovHit) {
                let tr = exp(-fogD * segT);
                if ((flags & F_VOL) != 0u && b < 2 && !hdri) {
                    let s = -log(1.0 - rnd() * (1.0 - tr)) / fogD;
                    let q = ro + rd * s;
                    let ld = normalize(u.sunDir.xyz);
                    let g = 0.6; let mu = dot(rd, ld);
                    let ph = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
                    let vis = shadowRay(q, ld, 1e4, false) * cloudShadow(q, ld);
                    let amb = envRadiance(vec3f(0.0, 1.0, 0.0)) * 0.25;
                    rad += thr * (1.0 - tr) * (u.sunColor.rgb * ph * vis + amb);
                } else {
                    rad += thr * (1.0 - tr) * envRadiance(normalize(vec3f(rd.x, max(rd.y, 0.02), rd.z))) * 0.6;
                }
                thr *= tr;
            }
            if (!useMesh && !hit.ok) {
                var Le = envRadiance(rd);
                if (hdri) { if (prevPdf > 0.0) { Le *= misW(prevPdf, envPdf(rd)); } }
                else if (prevPdf == 0.0) { Le += sunDisc(rd); }
                if (b == 0) { gAlb = vec3f(1.0); gN = vec3f(0.0); gHit = 0.0; gDepth = 1e4; gPos = ro + rd * 1e4; }
                var c = thr * Le;
                if (b > 0) { let l = lum(c); if (l > u.p0.z) { c *= u.p0.z / l; } }
                rad += c;
                break;
            }
            let V = -rd;
            var s: Surf;
            var p: vec3f;
            var emission = vec3f(0.0);
            var texAlbedo = vec3f(1.0);
            if (useMesh) {
                // ---------------- mesh surface
                p = ro + rd * mh.t;
                let i = mh.inst;
                let r0 = scene[i * 4u]; let r1 = scene[i * 4u + 1u]; let r2 = scene[i * 4u + 2u];
                let mt = instMeta(i);
                let tri = mh.tri;
                let p0 = tris[tri * 5u].xyz; let p1 = tris[tri * 5u + 1u].xyz; let p2 = tris[tri * 5u + 2u].xyz;
                let nl = cross(p1 - p0, p2 - p0);
                var ng = normalize(r0.xyz * nl.x + r1.xyz * nl.y + r2.xyz * nl.z);
                if (dot(ng, rd) > 0.0) { ng = -ng; }
                let g = bitcast<u32>(tris[tri * 5u].w);
                let m = meshMat(mt.y + g);
                var alb = m[0].rgb;
                if (m[1].x >= 0.0) {
                    var uv = triUv(tri, mh.b);
                    if (m[1].w > 0.5) { uv.y = 1.0 - uv.y; }
                    let lodm = log2(max(1e-4, coneW + mh.t * u.p3.z) * 128.0);
                    alb *= textureSampleLevel(meshAtlas, atlasSamp, fract(uv), i32(m[1].x), select(lodm, 0.0, ovHit)).rgb;
                }
                s.albedo = alb; s.rough = clamp(m[1].y, 0.05, 1.0); s.metal = clamp(m[1].z, 0.0, 1.0); s.n = ng; s.ng = ng; s.trans = 0.0;
                emission = m[2].rgb * alb;
                texAlbedo = alb;
                if (b == 0) {
                    gAlb = select(alb, max(alb, vec3f(0.04)), s.metal > 0.5); gHit = select(1.0, 2.0, ovHit);
                    gDepth = mh.t;
                    if (ovHit) { gPos = viewSpace(p - u.camPos.xyz); gN = viewSpace(ng); } else { gPos = p; gN = ng; }
                    gSpec = select(0.0, 1.0, s.rough < 0.15);
                }
                onOverlay = ovHit;
                if (b > 0 || !ovHit) { coneW += mh.t * u.p3.z; }
            } else {
                p = ro + rd * hit.t;
                if (b == 0) { coneW = 0.0; }
                coneW += hit.t * u.p3.z;
                onOverlay = false;
                // ---------------- water / dielectric interfaces
                let exitingWater = inWater && hit.typ != WATER_ID;
                if (hit.typ == WATER_ID || (exitingWater && hit.typ == 0u)) {
                    var n = hit.n;
                    if ((flags & F_WAVES) != 0u && abs(n.y) > 0.5) { let wn = waveNormal(p, u.p1.z); n = select(-wn, wn, n.y > 0.0); }
                    let eta = select(1.0 / 1.333, 1.333, exitingWater);
                    let ci = clamp(dot(V, n), 0.0, 1.0);
                    let F = fresnel(vec3f(0.02), ci).x;
                    let refr = refract(rd, n, eta);
                    let tir = all(refr == vec3f(0.0));
                    if (b == 0) { gAlb = vec3f(1.0); gN = hit.n; gHit = 1.0; gDepth = hit.t; gPos = p; gSpec = 1.0; }
                    if (tir || rnd() < F) { rd = reflect(rd, n); ro = p + hit.n * 1e-3; }
                    else { rd = refr; ro = p - hit.n * 1e-3; inWater = !inWater; }
                    prevPdf = 0.0;
                    continue;
                }
                let m = mats[hit.typ];
                let kind = m.faceB.z;
                let lod = log2(max(1e-4, coneW) * 64.0 / max(abs(dot(hit.n, rd)), 0.25));
                let tx = texSample(m, hit.face, hit.uv, lod);
                var albedo = tx.rgb;
                // ---------------- glass / ice / portals: thin dielectric
                if (kind == K_GLASS && tx.a < 0.75) {
                    let ci = clamp(dot(V, hit.n), 0.0, 1.0);
                    let F = fresnel(vec3f(0.04), ci).x;
                    if (m.params.z > 0.0 && prevPdf == 0.0) { rad += thr * albedo * m.params.z * u.p0.y * 0.5; }
                    if (b == 0) { gAlb = vec3f(1.0); gN = hit.n; gHit = 1.0; gDepth = hit.t; gPos = p; gSpec = 1.0; }
                    if (rnd() < F) { rd = reflect(rd, hit.n); ro = p + hit.n * 1e-3; }
                    else {
                        thr *= mix(vec3f(1.0), albedo, clamp(tx.a + m.tint.a * 0.5, 0.0, 1.0) * 0.6);
                        let inv = 1.0 / safeDir(rd);
                        let bt = boxT(p - rd * 1e-3, inv, vec3f(hit.cell), vec3f(hit.cell) + vec3f(1.0));
                        ro = p - rd * 1e-3 + rd * (bt.y + 1e-3);
                    }
                    prevPdf = 0.0;
                    continue;
                }
                // ---------------- normal map + cavity
                var ns = hit.n;
                if (kind != K_CROSS && m.bmax.w > 0.0 && u.p4.y > 0.0) {
                    let nm = textureSampleLevel(normAtlas, linSamp, hit.uv, layerOf(m, hit.face), max(lod, 0.0));
                    var tn = nm.xyz * 2.0 - 1.0;
                    tn = vec3f(tn.xy * u.p4.y * m.bmax.w, max(tn.z, 0.05));
                    let cand = normalize(hit.n * tn.z + faceT(hit.n) * tn.x + faceB(hit.n) * tn.y);
                    if (dot(cand, V) > 0.02) { ns = cand; }
                    albedo *= mix(1.0, nm.a, 0.55 * min(1.0, u.p4.y));
                }
                var ng = hit.n;
                if (dot(ng, V) < 0.0) { ng = -ng; ns = -ns; }
                s.albedo = albedo; s.rough = m.params.x; s.metal = m.params.y; s.n = ns; s.ng = ng;
                s.trans = select(0.0, m.bmin.w, u.p6.w > 0.0);
                if (m.params.z > 0.0) { emission = albedo * m.params.z * u.p0.y; }
                texAlbedo = albedo;
                if (b == 0) {
                    gAlb = select(albedo, max(albedo, vec3f(0.04)), s.metal > 0.5);
                    gN = ng; gHit = 1.0; gDepth = hit.t; gPos = p; gSpec = select(0.0, 1.0, s.rough < 0.15);
                }
            }
            // ---------------- emission
            if (any(emission > vec3f(0.0)) && (prevPdf == 0.0 || u.p2.w < 0.5 || useMesh)) {
                var c = thr * emission;
                if (b > 0) { let l = lum(c); if (l > u.p0.z * 4.0) { c *= u.p0.z * 4.0 / l; } }
                rad += c;
            }
            let po = p + s.ng * 2e-3;
            let pb = p - s.ng * 2e-3;
            // ---------------- next event estimation
            var direct = vec3f(0.0);
            let ov = useMesh && onOverlay;
            if (!hdri) {
                if (any(u.sunColor.rgb > vec3f(0.0))) {
                    let sd = normalize(u.sunDir.xyz);
                    let B = onb(sd);
                    let r = rnd2();
                    let ct = 1.0 - r.x * (1.0 - u.sunDir.w); let st = sqrt(max(0.0, 1.0 - ct * ct)); let ph = 2.0 * PI * r.y;
                    let L = normalize(B * vec3f(cos(ph) * st, sin(ph) * st, ct));
                    let fb = evalBsdf(s, V, L);
                    if (fb.w > 0.0) {
                        let o = select(po, pb, dot(L, s.ng) < 0.0);
                        let vis = shadowRay(o, L, 1e4, ov) * cloudShadow(p, L);
                        direct += fb.rgb * u.sunColor.rgb * vis * select(1.0, 0.6, inWater);
                    }
                }
            } else {
                let es = sampleEnv();
                if (es.w > 0.0) {
                    let fb = evalBsdf(s, V, es.xyz);
                    if (fb.w > 0.0) {
                        let o = select(po, pb, dot(es.xyz, s.ng) < 0.0);
                        let vis = shadowRay(o, es.xyz, 1e4, ov);
                        direct += fb.rgb * envRadiance(es.xyz) * vis * misW(es.w, fb.w) / es.w;
                    }
                }
            }
            direct += sampleEmitters(po, pb, s, V);
            var dc = thr * direct;
            if (b > 0) { let l = lum(dc); if (l > u.p0.z) { dc *= u.p0.z / l; } }
            rad += dc;
            if (b == maxB) { break; }
            // ---------------- continue the path
            let L = sampleBsdf(s, V);
            let fb = evalBsdf(s, V, L);
            if (fb.w <= 1e-6) { break; }
            thr *= fb.rgb / fb.w;
            prevPdf = fb.w;
            ro = select(po, pb, dot(L, s.ng) < 0.0); rd = L;
            if (b >= 2) {
                let q = clamp(max(thr.x, max(thr.y, thr.z)), 0.05, 0.95);
                if (rnd() > q) { break; }
                thr /= q;
            }
            _ = texAlbedo;
        }
        sumRad += rad;
    }
    let radiance = sumRad / f32(spp);
    let alb = max(gAlb, vec3f(0.03));
    var illum = radiance / alb;
    illum = select(illum, vec3f(0.0), illum != illum);
    let px = vec2i(id.xy);
    textureStore(outIllum, px, vec4f(min(illum, vec3f(60000.0)), 1.0));
    textureStore(outAlbedo, px, vec4f(alb, 1.0 - gSpec));
    textureStore(outNormal, px, vec4f(gN, gDepth));
    textureStore(outPos, px, vec4f(gPos, gHit));
}
`;

WebGPUPathTracer.WGSL_TEMPORAL = /* wgsl */`
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var curIllum: texture_2d<f32>;
@group(0) @binding(2) var curNormal: texture_2d<f32>;
@group(0) @binding(3) var curPos: texture_2d<f32>;
@group(0) @binding(4) var prevNormal: texture_2d<f32>;
@group(0) @binding(5) var prevPos: texture_2d<f32>;
@group(0) @binding(6) var prevHist: texture_2d<f32>;
@group(0) @binding(7) var prevMom: texture_2d<f32>;
@group(0) @binding(8) var outHist: texture_storage_2d<rgba16float, write>;
@group(0) @binding(9) var outMom: texture_storage_2d<rgba16float, write>;
@group(0) @binding(10) var outFilt: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let W = u.res.x; let H = u.res.y;
    if (id.x >= W || id.y >= H) { return; }
    let px = vec2i(id.xy);
    let c = textureLoad(curIllum, px, 0).rgb;
    let nd = textureLoad(curNormal, px, 0);
    let pos = textureLoad(curPos, px, 0);
    let l = lum(c);
    var hist = vec3f(0.0); var m1 = 0.0; var m2 = 0.0; var count = 0.0;
    let cap = u.p2.y;
    let cat = round(pos.w);       // 0 sky, 1 world, 2 first-person weapon (camera space)
    if (cap > 0.0) {
        var pp = vec2f(px);
        var valid = true;
        if (cat < 1.5) {
            var wp = pos.xyz;
            if (cat < 0.5) { wp = u.camPos.xyz + normalize(pos.xyz - u.camPos.xyz) * 1e4; }
            let clip = u.prevViewProj * vec4f(wp, 1.0);
            if (clip.w <= 0.0) { valid = false; }
            let ndc = clip.xy / clip.w;
            pp = vec2f((ndc.x * 0.5 + 0.5) * f32(W), (0.5 - ndc.y * 0.5) * f32(H)) - 0.5;
        }
        if (valid) {
            let base = vec2i(floor(pp)); let fr = pp - floor(pp);
            var wsum = 0.0;
            for (var k = 0; k < 4; k++) {
                let o = vec2i(k & 1, k >> 1);
                let q = base + o;
                if (q.x < 0 || q.y < 0 || q.x >= i32(W) || q.y >= i32(H)) { continue; }
                let bw = select(1.0 - fr.x, fr.x, o.x == 1) * select(1.0 - fr.y, fr.y, o.y == 1);
                if (bw <= 1e-4) { continue; }
                let ppos = textureLoad(prevPos, q, 0);
                let pnd = textureLoad(prevNormal, q, 0);
                if (abs(round(ppos.w) - cat) > 0.5) { continue; }
                var ok = cat < 0.5;
                if (cat > 0.5) {
                    let dist = length(ppos.xyz - pos.xyz);
                    ok = dist < select(0.05 + 0.02 * nd.w, 0.02, cat > 1.5) && dot(pnd.xyz, nd.xyz) > 0.8;
                }
                if (!ok) { continue; }
                let hv = textureLoad(prevHist, q, 0);
                let mv = textureLoad(prevMom, q, 0);
                hist += hv.rgb * bw; count += hv.a * bw; m1 += mv.x * bw; m2 += mv.y * bw; wsum += bw;
            }
            if (wsum > 0.01) { hist /= wsum; count /= wsum; m1 /= wsum; m2 /= wsum; } else { count = 0.0; }
        }
    }
    count = min(count, cap);
    count = count + 1.0;
    let a = max(1.0 / count, u.p2.x);
    let outC = mix(hist, c, a);
    m1 = mix(m1, l, a); m2 = mix(m2, l * l, a);
    var n = count;
    if (u.p2.x > 0.0) { n = min(count, 2.0 / u.p2.x - 1.0); }
    var variance = max(m2 - m1 * m1, 0.0) / max(n, 1.0);
    if (count < 4.0) { variance = max(variance, l * l * 0.5 + 0.05); }
    textureStore(outHist, px, vec4f(outC, count));
    textureStore(outMom, px, vec4f(m1, m2, 0.0, 0.0));
    textureStore(outFilt, px, vec4f(outC, variance));
}
`;

WebGPUPathTracer.WGSL_ATROUS = /* wgsl */`
struct AU { step: i32, iter: i32, pad0: i32, pad1: i32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<uniform> au: AU;
@group(0) @binding(2) var src: texture_2d<f32>;
@group(0) @binding(3) var nrm: texture_2d<f32>;
@group(0) @binding(4) var pos: texture_2d<f32>;
@group(0) @binding(5) var alb: texture_2d<f32>;
@group(0) @binding(6) var dst: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let W = i32(u.res.x); let H = i32(u.res.y);
    let px = vec2i(id.xy);
    if (px.x >= W || px.y >= H) { return; }
    let c = textureLoad(src, px, 0);
    let n = textureLoad(nrm, px, 0);
    let p = textureLoad(pos, px, 0);
    let cat = round(p.w);
    let spec = 1.0 - textureLoad(alb, px, 0).a;
    var vsum = 0.0; var vw = 0.0;
    for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
        let q = clamp(px + vec2i(x, y), vec2i(0), vec2i(W - 1, H - 1));
        let k = select(0.25, 0.5, x == 0) * select(0.25, 0.5, y == 0);
        vsum += textureLoad(src, q, 0).a * k; vw += k;
    } }
    let sig = 4.0 * sqrt(max(vsum / vw, 0.0)) * mix(1.0, 0.3, spec) + 1e-5;
    let lc = lum(c.rgb);
    var kern = array<f32, 3>(0.375, 0.25, 0.0625);
    var sum = vec4f(c.rgb * kern[0] * kern[0], c.a * kern[0] * kern[0] * kern[0] * kern[0]);
    var wsum = kern[0] * kern[0];
    let planeTol = select(0.06 + 0.004 * n.w * f32(au.step), 0.01 * f32(au.step), cat > 1.5);
    for (var y = -2; y <= 2; y++) {
        for (var x = -2; x <= 2; x++) {
            if (x == 0 && y == 0) { continue; }
            let q = px + vec2i(x, y) * au.step;
            if (q.x < 0 || q.y < 0 || q.x >= W || q.y >= H) { continue; }
            let pq = textureLoad(pos, q, 0);
            if (abs(round(pq.w) - cat) > 0.5) { continue; }
            let cq = textureLoad(src, q, 0);
            let nq = textureLoad(nrm, q, 0);
            var w = kern[abs(x)] * kern[abs(y)];
            if (cat > 0.5) {
                let wn = pow(max(dot(n.xyz, nq.xyz), 0.0), 32.0);
                let dp = abs(dot(n.xyz, pq.xyz - p.xyz));
                w *= wn * exp(-dp / planeTol);
            }
            w *= exp(-abs(lum(cq.rgb) - lc) / sig);
            sum += vec4f(cq.rgb * w, cq.a * w * w);
            wsum += w;
        }
    }
    textureStore(dst, px, vec4f(sum.rgb / wsum, sum.a / (wsum * wsum)));
}
`;

// final HDR colour (denoised lighting x albedo) + per-workgroup centre-weighted log luminance for auto exposure
WebGPUPathTracer.WGSL_RESOLVE = /* wgsl */`
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var illum: texture_2d<f32>;
@group(0) @binding(2) var alb: texture_2d<f32>;
@group(0) @binding(3) var hdrOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var<storage, read_write> lumOut: array<vec2f>;
var<workgroup> sh: array<vec2f, 256>;
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(local_invocation_index) li: u32, @builtin(workgroup_id) wg: vec3u) {
    let W = u.res.x; let H = u.res.y;
    let inside = id.x < W && id.y < H;
    var v = vec2f(0.0);
    if (inside) {
        let c = textureLoad(illum, vec2i(id.xy), 0).rgb * textureLoad(alb, vec2i(id.xy), 0).rgb;
        textureStore(hdrOut, vec2i(id.xy), vec4f(c, 1.0));
        let uv = (vec2f(id.xy) + 0.5) / vec2f(f32(W), f32(H)) - 0.5;
        let w = 0.35 + exp(-dot(uv, uv) * 10.0);
        v = vec2f(log2(max(lum(c), 1e-4)) * w, w);
    }
    sh[li] = v;
    workgroupBarrier();
    for (var s = 128u; s > 0u; s = s >> 1u) {
        if (li < s) { sh[li] += sh[li + s]; }
        workgroupBarrier();
    }
    if (li == 0u) { lumOut[wg.x + wg.y * u32(u.p9.w)] = sh[0]; }
}
`;

WebGPUPathTracer.WGSL_EXPOSURE = /* wgsl */`
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> lumIn: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> expo: array<f32>;
var<workgroup> sh: array<vec2f, 256>;
@compute @workgroup_size(256)
fn main(@builtin(local_invocation_index) li: u32) {
    let n = u32(u.p9.y);
    var s = vec2f(0.0);
    for (var i = li; i < n; i += 256u) { s += lumIn[i]; }
    sh[li] = s;
    workgroupBarrier();
    for (var k = 128u; k > 0u; k = k >> 1u) {
        if (li < k) { sh[li] += sh[li + k]; }
        workgroupBarrier();
    }
    if (li == 0u) {
        let avg = exp2(sh[0].x / max(sh[0].y, 1e-6));
        let tgt = clamp(0.16 / max(avg, 1e-4), 0.04, 24.0);
        var cur = expo[0];
        if (!(cur > 0.0) || cur > 1e6) { cur = tgt; }
        let k = 1.0 - exp(-u.p9.x * u.p9.z);
        expo[0] = exp2(mix(log2(cur), log2(tgt), k));
        expo[1] = avg;
    }
}
`;

WebGPUPathTracer.WGSL_BLOOM_DOWN = /* wgsl */`
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var dst: texture_storage_2d<rgba16float, write>;
fn s(uv: vec2f, o: vec2f, t: vec2f) -> vec3f { let c = textureSampleLevel(src, samp, uv + o * t, 0.0).rgb; return c / (1.0 + max(max(c.r, c.g), c.b) * 0.02); }
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let ds = textureDimensions(dst);
    if (id.x >= ds.x || id.y >= ds.y) { return; }
    let t = 1.0 / vec2f(textureDimensions(src));
    let uv = (vec2f(id.xy) + 0.5) / vec2f(ds);
    let e = s(uv, vec2f(0.0), t);
    let a = s(uv, vec2f(-2.0, 2.0), t); let b = s(uv, vec2f(0.0, 2.0), t); let c = s(uv, vec2f(2.0, 2.0), t);
    let d = s(uv, vec2f(-2.0, 0.0), t); let f = s(uv, vec2f(2.0, 0.0), t);
    let g = s(uv, vec2f(-2.0, -2.0), t); let h = s(uv, vec2f(0.0, -2.0), t); let i = s(uv, vec2f(2.0, -2.0), t);
    let j = s(uv, vec2f(-1.0, 1.0), t); let k = s(uv, vec2f(1.0, 1.0), t); let l = s(uv, vec2f(-1.0, -1.0), t); let m = s(uv, vec2f(1.0, -1.0), t);
    let o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    textureStore(dst, vec2i(id.xy), vec4f(o, 1.0));
}
`;

WebGPUPathTracer.WGSL_BLOOM_UP = /* wgsl */`
@group(0) @binding(0) var low: texture_2d<f32>;
@group(0) @binding(1) var cur: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var dst: texture_storage_2d<rgba16float, write>;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let ds = textureDimensions(dst);
    if (id.x >= ds.x || id.y >= ds.y) { return; }
    let uv = (vec2f(id.xy) + 0.5) / vec2f(ds);
    let t = 1.0 / vec2f(textureDimensions(low));
    var acc = textureSampleLevel(low, samp, uv, 0.0).rgb * 4.0;
    acc += (textureSampleLevel(low, samp, uv + vec2f(-t.x, 0.0), 0.0).rgb + textureSampleLevel(low, samp, uv + vec2f(t.x, 0.0), 0.0).rgb +
            textureSampleLevel(low, samp, uv + vec2f(0.0, -t.y), 0.0).rgb + textureSampleLevel(low, samp, uv + vec2f(0.0, t.y), 0.0).rgb) * 2.0;
    acc += textureSampleLevel(low, samp, uv + vec2f(-t.x, -t.y), 0.0).rgb + textureSampleLevel(low, samp, uv + vec2f(t.x, -t.y), 0.0).rgb +
           textureSampleLevel(low, samp, uv + vec2f(-t.x, t.y), 0.0).rgb + textureSampleLevel(low, samp, uv + vec2f(t.x, t.y), 0.0).rgb;
    let c = textureLoad(cur, vec2i(id.xy), 0).rgb;
    textureStore(dst, vec2i(id.xy), vec4f(c + acc / 16.0, 1.0));
}
`;

WebGPUPathTracer.WGSL_COMPOSITE = /* wgsl */`
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var hdr: texture_2d<f32>;
@group(0) @binding(2) var bloomTex: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
@group(0) @binding(4) var<storage, read> expo: array<f32>;
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
    let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
    var o: VO; o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0); o.uv = vec2f(p.x, 1.0 - p.y); return o;
}
fn aces(x: vec3f) -> vec3f {
    let m1 = mat3x3f(vec3f(0.59719, 0.07600, 0.02840), vec3f(0.35458, 0.90834, 0.13383), vec3f(0.04823, 0.01566, 0.83777));
    let m2 = mat3x3f(vec3f(1.60475, -0.10208, -0.00327), vec3f(-0.53108, 1.10813, -0.07276), vec3f(-0.07367, -0.00605, 1.07602));
    let v = m1 * x;
    let a = v * (v + 0.0245786) - 0.000090537;
    let b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return clamp(m2 * (a / b), vec3f(0.0), vec3f(1.0));
}
// AgX (Troy Sobotka) with a gentle "punchy" look
fn agxContrast(x: vec3f) -> vec3f {
    let x2 = x * x; let x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
fn agx(c: vec3f) -> vec3f {
    let m = mat3x3f(vec3f(0.842479062253094, 0.0423282422610123, 0.0423756549057051),
                    vec3f(0.0784335999999992, 0.878468636469772, 0.0784336),
                    vec3f(0.0792237451477643, 0.0791661274605434, 0.879142973793104));
    let mi = mat3x3f(vec3f(1.19687900512017, -0.0528968517574562, -0.0529716355144438),
                     vec3f(-0.0980208811401368, 1.15190312990417, -0.0980434501171241),
                     vec3f(-0.0990297440797205, -0.0989611768448433, 1.15107367264116));
    let minEv = -12.47393; let maxEv = 4.026069;
    var v = m * max(c, vec3f(1e-10));
    v = clamp(log2(v), vec3f(minEv), vec3f(maxEv));
    v = (v - minEv) / (maxEv - minEv);
    v = agxContrast(v);
    v = pow(max(v, vec3f(0.0)), vec3f(1.12));
    let l = dot(v, vec3f(0.2126, 0.7152, 0.0722));
    v = l + 1.25 * (v - l);
    v = mi * v;
    return clamp(pow(max(v, vec3f(0.0)), vec3f(2.2)), vec3f(0.0), vec3f(1.0));
}
fn toSrgb(c: vec3f) -> vec3f { return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3f(0.0031308)); }
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233)) + u.camPos.w * 0.618) * 43758.5453); }
@fragment fn fs(i: VO) -> @location(0) vec4f {
    let uv = i.uv;
    // letterbox 2.39:1
    if ((u.res.w & F_LETTERBOX) != 0u) {
        let aspect = u.p4.z / u.p4.w;
        let bar = max(0.0, (1.0 - aspect / 2.39) * 0.5);
        if (uv.y < bar || uv.y > 1.0 - bar) { return vec4f(0.0, 0.0, 0.0, 1.0); }
    }
    let t = 1.0 / vec2f(textureDimensions(hdr));
    let cdir = uv - 0.5;
    let ca = u.p7.y * length(cdir) * 2.0;
    var col = vec3f(textureSampleLevel(hdr, samp, uv - cdir * ca, 0.0).r,
                    textureSampleLevel(hdr, samp, uv, 0.0).g,
                    textureSampleLevel(hdr, samp, uv + cdir * ca, 0.0).b);
    // contrast-adaptive sharpening (on the upscaled HDR image)
    if (u.p7.w > 0.0) {
        let n = textureSampleLevel(hdr, samp, uv + vec2f(0.0, -t.y), 0.0).rgb;
        let s = textureSampleLevel(hdr, samp, uv + vec2f(0.0, t.y), 0.0).rgb;
        let e = textureSampleLevel(hdr, samp, uv + vec2f(t.x, 0.0), 0.0).rgb;
        let w = textureSampleLevel(hdr, samp, uv + vec2f(-t.x, 0.0), 0.0).rgb;
        let mn = min(min(min(n, s), min(e, w)), col); let mx = max(max(max(n, s), max(e, w)), col);
        let amp = clamp(min(mn, 2.0 * mx - mx) / max(mx, vec3f(1e-4)), vec3f(0.0), vec3f(1.0));
        let wgt = -sqrt(amp) * mix(0.125, 0.2, u.p7.w);
        col = max((col + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt), vec3f(0.0));
    }
    let bloom = textureSampleLevel(bloomTex, samp, uv, 0.0).rgb / 6.0;
    col = mix(col, bloom, clamp(u.p7.x, 0.0, 1.0));
    var e = u.p0.x * exp2(u.p8.w);
    if (u.p8.z > 0.5) { e *= max(expo[0], 1e-4); }
    col *= e;
    col = select(agx(col), aces(col), u.p8.y > 0.5);
    let vig = 1.0 - u.p8.x * pow(length(cdir) * 1.35, 2.5);
    col *= vig;
    var o = toSrgb(col);
    o += (hash(i.pos.xy) - 0.5) * u.p7.z;
    return vec4f(clamp(o, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

window.WebGPUPathTracer = WebGPUPathTracer;

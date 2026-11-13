// RTX Remix-style control panel (lil-gui). Alt + X toggles it in-game.
//   * every RTX effect + its parameters, live
//   * presets (Performance / Balanced / Quality / Cinematic)
//   * performance governor (target fps, dynamic resolution) with live readouts
//   * "DLSS" slot: spatial FSR-style + neural (CNN) upscalers, and an optional ONNX super-resolution model (rtx_onnx.js)
//   * "Frame Generation": camera reprojection (rtx.js presentFG)
class RTXGui {
    constructor(game) {
        this.game = game;
        this.gui = null;
        this.open = false;
        this.stats = { fps: '-', frameMs: '-', internal: '-', tier: '-', mode: '-' };
        this.onnx = { url: '', provider: 'auto', inputHeight: 270, live: false, status: 'no model' };
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'KeyX' && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); this.toggle(); }
        }, true);
        this._tick = setInterval(() => { if (this.open) this.refresh(); }, 400);
    }

    toggle(force) {
        const want = force === undefined ? !this.open : !!force;
        if (want && !this.gui) this.build();
        this.open = want;
        if (this.gui) this.gui.domElement.style.display = want ? '' : 'none';
        if (want) { try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {} this.refresh(); }
    }

    get rtx() { return this.game.rtx; }

    refresh() {
        const g = this.game, r = this.rtx;
        if (!this.gui) return;
        const tm = g.textureManager;
        this.master.on = !!(tm && tm.textureX64);
        const fps = (g.fpsCounter && g.fpsCounter.fps) || (g.recentFps) || 0;
        this.stats.fps = r && r.ema ? (1000 / r.ema).toFixed(0) + (r.cfg.frameGen ? ' (displayed)' : '') : '-';
        this.stats.frameMs = r && r.ema ? r.ema.toFixed(1) : '-';
        const v = new THREE.Vector2(); g.renderer.getDrawingBufferSize(v);
        const s = r && r.composer ? r.targetSize() : v;
        this.stats.internal = Math.round(s.x) + 'x' + Math.round(s.y) + (r && r.composer ? ' (' + Math.round(r.resScale * 100) + '%)' : '');
        this.stats.tier = r && r.composer ? ['lights only', 'no SSR/AO', 'no SSR', 'full'][r.quality] : '-';
        this.stats.mode = r && r.composer ? (r.scenePass ? 'depth AO' : 'legacy AO') : 'off';
        if (window.game && window.game.rtxOnnx) this.onnx.status = window.game.rtxOnnx.status;
        this.gui.controllersRecursive().forEach(c => { if (c._listen) c.updateDisplay(); });
    }

    applyPreset(name) {
        const r = this.rtx; if (!r) return;
        const P = RTXGui.PRESETS[name]; if (!P) return;
        for (const k in P.cfg) r.setCfg(k, P.cfg[k]);
        for (const p of RTXPipeline.PARTS) r.setPart(p.id, P.parts === 'all' ? true : P.parts.includes(p.id));
        this.gui.controllersRecursive().forEach(c => c.updateDisplay());
    }

    build() {
        const g = this.game, r = this.rtx, tm = g.textureManager;
        const GUI = window.lil && window.lil.GUI;
        if (!GUI || !r) return;
        const gui = this.gui = new GUI({ title: 'RTX Remix  (Alt+X)', width: 330 });
        gui.domElement.style.cssText += ';position:fixed;top:8px;right:8px;z-index:100000;max-height:96vh;overflow:auto;';
        gui.domElement.addEventListener('keydown', e => e.stopPropagation());
        gui.domElement.addEventListener('keyup', e => e.stopPropagation());
        gui.domElement.addEventListener('wheel', e => e.stopPropagation());
        const listen = (c) => { c._listen = true; return c; };
        const cfgCtl = (folder, key, min, max, step, name) => folder.add(r.cfg, key, min, max, step).name(name || key).onChange(v => r.setCfg(key, v));
        const partCtl = (folder, id, name) => {
            this.parts = this.parts || {};
            const o = { v: r.part(id) }; this.parts[id] = o;
            const info = RTXPipeline.PARTS.find(p => p.id === id);
            return folder.add(o, 'v').name(name || (info && info.name) || id).onChange(v => r.setPart(id, v));
        };

        // master + presets
        this.master = { on: !!(tm && tm.textureX64), preset: 'Balanced' };
        gui.add(this.master, 'on').name('RTX ON').onChange(v => { if (tm && tm.setTextureX64) tm.setTextureX64(v); });
        listen(gui.controllers[0]);
        gui.add(this.master, 'preset', Object.keys(RTXGui.PRESETS)).name('Preset').onChange(v => this.applyPreset(v));

        // live readouts
        const st = gui.addFolder('Live stats');
        for (const [k, n] of [['fps', 'FPS'], ['frameMs', 'Frame ms (avg)'], ['internal', 'Internal res'], ['tier', 'Effect tier'], ['mode', 'AO path']]) listen(st.add(this.stats, k).name(n).disable());

        const mat = gui.addFolder('Materials');
        partCtl(mat, 'pbr'); partCtl(mat, 'pom'); cfgCtl(mat, 'pomDepth', 0, 2, 0.05, 'Parallax depth');

        const lit = gui.addFolder('Lighting');
        partCtl(lit, 'sun'); cfgCtl(lit, 'sunElevation', 5, 80, 1, 'Sun elevation °'); cfgCtl(lit, 'sunIntensity', 0, 3, 0.05, 'Sun intensity');
        partCtl(lit, 'shadows'); partCtl(lit, 'env'); partCtl(lit, 'fog');

        const ao = gui.addFolder('Ambient occlusion');
        partCtl(ao, 'ssao'); cfgCtl(ao, 'aoRadius', 0.3, 3, 0.05, 'Radius'); cfgCtl(ao, 'aoIntensity', 0, 3, 0.05, 'Intensity');

        const rf = gui.addFolder('Reflections');
        partCtl(rf, 'ssr'); cfgCtl(rf, 'ssrOpacity', 0, 1, 0.01, 'Strength'); cfgCtl(rf, 'ssrDistance', 10, 100, 1, 'Max distance');

        const post = gui.addFolder('Post-processing');
        partCtl(post, 'bloom'); cfgCtl(post, 'bloomStrength', 0, 3, 0.05, 'Bloom strength'); cfgCtl(post, 'bloomRadius', 0, 1.5, 0.05, 'Bloom radius'); cfgCtl(post, 'bloomThreshold', 0.5, 4, 0.05, 'Bloom threshold');
        partCtl(post, 'godrays'); cfgCtl(post, 'godrayStrength', 0, 3, 0.05, 'God-ray strength');
        partCtl(post, 'sky'); partCtl(post, 'aces'); cfgCtl(post, 'exposure', 0.3, 2.5, 0.01, 'Exposure');
        partCtl(post, 'grade'); cfgCtl(post, 'contrast', 0.7, 1.6, 0.01, 'Contrast'); cfgCtl(post, 'vibrance', 0, 1, 0.01, 'Vibrance');
        partCtl(post, 'smaa');

        const img = gui.addFolder('Image quality');
        img.add(r.cfg, 'texFilter', { 'Sharp (bilinear + 16x aniso)': 'sharp', 'Pixel (crisp texels)': 'pixel' }).name('Texture filter').onChange(v => r.setCfg('texFilter', v));
        cfgCtl(img, 'sharpen', 0, 1, 0.01, 'Sharpen');

        const perf = gui.addFolder('Performance governor');
        cfgCtl(perf, 'dynRes', undefined, undefined, undefined, 'Dynamic resolution');
        cfgCtl(perf, 'targetFps', 15, 144, 1, 'Target FPS');
        cfgCtl(perf, 'minScale', 0.25, 1, 0.05, 'Min resolution scale');

        // DLSS slot
        const up = g.upscaler;
        const dl = gui.addFolder('Upscaler  (DLSS slot)');
        if (up) {
            this.up = { mode: up.mode, sharpness: up.sharpness };
            dl.add(this.up, 'mode', { 'Off (native)': 'off', 'Quality 77%': 'quality', 'Balanced 67%': 'balanced', 'Performance 50%': 'performance', 'Ultra perf 40%': 'ultra', 'Neural CNN 2x': 'neural', 'Neural CNN 4x': 'neural4', 'Neural CNN 8x': 'neural8' })
                .name('Mode').onChange(v => { up.setMode(v); g.applyViewport && g.applyViewport(); });
            dl.add(this.up, 'sharpness', 0, 1, 0.01).name('Sharpness').onChange(v => { up.sharpness = v; if (up.rcas) up.rcas.uniforms.sharp.value = v; });
        }

        const fgF = gui.addFolder('Frame generation');
        cfgCtl(fgF, 'frameGen', undefined, undefined, undefined, 'Reprojection 2x');
        fgF.add({ i: 'Renders every 2nd frame, warps the other with depth + camera pose. Mobs update on real frames only.' }, 'i').name('Note').disable();

        // ONNX
        const ox = gui.addFolder('AI model (ONNX)');
        const O = this.onnx;
        const getOnnx = () => { if (!g.rtxOnnx) g.rtxOnnx = new RTXOnnx(g); return g.rtxOnnx; };
        ox.add(O, 'url').name('Model URL (.onnx)');
        ox.add(O, 'provider', ['auto', 'webgpu', 'wasm']).name('Runtime');
        ox.add(O, 'inputHeight', 90, 1080, 10).name('Input height').onChange(v => { getOnnx().inputHeight = v; });
        ox.add({ load: () => { const o = getOnnx(); o.provider = O.provider; o.inputHeight = O.inputHeight; if (O.url) o.loadModel(O.url); else o.status = 'enter a URL or use Load file'; } }, 'load').name('Load from URL');
        ox.add({ file: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.onnx'; i.onchange = () => { if (i.files[0]) { const o = getOnnx(); o.provider = O.provider; o.inputHeight = O.inputHeight; o.loadModel(i.files[0]); } }; i.click(); } }, 'file').name('Load file...');
        ox.add(O, 'live').name('Live overlay (async)').onChange(v => getOnnx().setLive(v));
        ox.add({ snap: () => getOnnx().snapshot(Math.min(1080, O.inputHeight * 2)) }, 'snap').name('AI snapshot -> PNG');
        listen(ox.add(O, 'status').name('Status').disable());
        ox.close();

        gui.add({ reset: () => { Object.assign(r.cfg, RTXPipeline.CFG_DEFAULTS); for (const k in RTXPipeline.CFG_DEFAULTS) r.setCfg(k, RTXPipeline.CFG_DEFAULTS[k]); r.setAllParts(true); gui.controllersRecursive().forEach(c => c.updateDisplay()); } }, 'reset').name('Reset everything');
        for (const f of [mat, ao, rf, post, perf, dl, fgF]) f.close();
        img.open();
    }
}
RTXGui.PRESETS = {
    Performance: { parts: ['pbr', 'sun', 'fog', 'env', 'aces', 'grade', 'sky'], cfg: { pomDepth: 0.6, targetFps: 60, bloomStrength: 0.45, aoRadius: 0.9 } },
    Balanced:    { parts: ['pbr', 'pom', 'sun', 'shadows', 'env', 'fog', 'ssao', 'bloom', 'godrays', 'sky', 'aces', 'grade', 'smaa'], cfg: { pomDepth: 1, targetFps: 30 } },
    Quality:     { parts: 'all', cfg: { pomDepth: 1.1, targetFps: 24, aoRadius: 1.3, bloomStrength: 0.7 } },
    Cinematic:   { parts: 'all', cfg: { pomDepth: 1.3, targetFps: 20, aoRadius: 1.6, aoIntensity: 1.5, bloomStrength: 0.95, godrayStrength: 1.6, contrast: 1.14, vibrance: 0.3, sunElevation: 14 } }
};
window.RTXGui = RTXGui;

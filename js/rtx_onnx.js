// Optional AI upscaler: runs any image super-resolution ONNX model (Real-ESRGAN / ESPCN / FSRCNN / SwinIR exports from GitHub)
// through onnxruntime-web (WebGPU when available, WASM otherwise). onnxruntime-web is only downloaded when a model is loaded.
//
// Contract: input  = float32 [1,3,H,W] RGB in 0..1, output = float32 [1,3,sH,sW] (0..1, or 0..255 - detected).
//           Models that need a fixed input size are fed exactly that size (read from the model metadata when exposed).
// "Live" mode is asynchronous: the model works on a downscaled copy of the latest frame and the result is shown as an overlay as soon as
// it is ready (a few frames of lag, so it suits slow camera / screenshots best). "Snapshot" runs once at a higher input size and saves a PNG.
class RTXOnnx {
    constructor(game) {
        this.game = game;
        this.session = null;
        this.live = false;
        this.busy = false;
        this.status = 'no model';
        this.provider = 'auto';
        this.inputHeight = 270;
        this.minInterval = 0;
        this.last = 0;
        this.ms = 0;
        this.cap = document.createElement('canvas');
        this.capCtx = this.cap.getContext('2d', { willReadFrequently: true });
        this.overlay = null;
    }

    static get BASE() { return window.RTX_ORT_BASE || 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/'; }

    loadRuntime() {
        if (window.ort) return Promise.resolve();
        if (!RTXOnnx._rt) RTXOnnx._rt = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = RTXOnnx.BASE + 'ort.all.min.js';
            s.onload = () => resolve();
            s.onerror = () => { RTXOnnx._rt = null; reject(new Error('onnxruntime-web could not be downloaded')); };
            document.head.appendChild(s);
        });
        return RTXOnnx._rt;
    }

    // src: URL string or File
    async loadModel(src) {
        this.live = false; this.hideOverlay();
        try {
            this.status = 'loading runtime...';
            await this.loadRuntime();
            ort.env.wasm.wasmPaths = RTXOnnx.BASE;
            ort.env.wasm.numThreads = window.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
            this.status = 'downloading model...';
            const buf = src instanceof File ? await src.arrayBuffer() : await (await fetch(src)).arrayBuffer();
            const eps = this.provider === 'auto' ? ['webgpu', 'wasm'] : [this.provider];
            this.status = 'compiling model (' + eps.join('>') + ')...';
            this.session = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: eps, graphOptimizationLevel: 'all' });
            this.inName = this.session.inputNames[0];
            this.outName = this.session.outputNames[0];
            this.fixed = null;
            const md = this.session.inputMetadata && this.session.inputMetadata[this.inName];
            const dims = md && md.shape || md && md.dimensions;
            if (dims && dims.length === 4 && typeof dims[2] === 'number' && typeof dims[3] === 'number' && dims[2] > 0) this.fixed = [dims[3], dims[2]];
            this.status = 'ready: ' + this.inName + (this.fixed ? ' fixed ' + this.fixed.join('x') : '');
            return true;
        } catch (e) {
            this.session = null;
            this.status = 'error: ' + String(e && e.message || e).slice(0, 120);
            return false;
        }
    }

    // draws `canvas` into the capture canvas at the model's input size and returns the output as { w, h, rgba }
    async infer(canvas, inputHeight) {
        let w, h;
        if (this.fixed) { w = this.fixed[0]; h = this.fixed[1]; }
        else { h = Math.max(16, Math.round(inputHeight)); w = Math.max(16, Math.round(h * canvas.width / canvas.height)); }
        this.cap.width = w; this.cap.height = h;
        this.capCtx.drawImage(canvas, 0, 0, w, h);
        const px = this.capCtx.getImageData(0, 0, w, h).data;
        const n = w * h, f = new Float32Array(3 * n);
        for (let i = 0; i < n; i++) { f[i] = px[i * 4] / 255; f[n + i] = px[i * 4 + 1] / 255; f[2 * n + i] = px[i * 4 + 2] / 255; }
        const t0 = performance.now();
        const out = (await this.session.run({ [this.inName]: new ort.Tensor('float32', f, [1, 3, h, w]) }))[this.outName];
        this.ms = performance.now() - t0;
        const d = out.dims, oh = d[d.length - 2], ow = d[d.length - 1], on = oh * ow, o = out.data;
        if (d.length < 3 || d[d.length - 3] !== 3) throw new Error('model output is not 3-channel NCHW');
        let mx = 0; for (let i = 0; i < Math.min(on * 3, 4096); i++) if (o[i] > mx) mx = o[i];
        const k = mx > 1.6 ? 1 : 255;                                 // 0..255 models vs 0..1 models
        const rgba = new Uint8ClampedArray(on * 4);
        for (let i = 0; i < on; i++) {
            rgba[i * 4] = o[i] * k; rgba[i * 4 + 1] = o[on + i] * k; rgba[i * 4 + 2] = o[2 * on + i] * k; rgba[i * 4 + 3] = 255;
        }
        return { w: ow, h: oh, rgba };
    }

    ensureOverlay() {
        if (this.overlay) return this.overlay;
        const c = document.createElement('canvas');
        c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;image-rendering:auto;display:none';
        (this.game.container || document.body).appendChild(c);
        this.overlay = c;
        return c;
    }
    hideOverlay() { if (this.overlay) this.overlay.style.display = 'none'; }

    setLive(on) {
        this.live = !!on && !!this.session;
        if (!this.live) this.hideOverlay();
    }

    // called by Game.animate right after the frame is drawn (the WebGL canvas can only be read back in that same task)
    onFrame(canvas) {
        if (!this.live || !this.session || this.busy) return;
        const now = performance.now();
        if (now - this.last < this.minInterval) return;
        this.last = now;
        this.busy = true;
        this.infer(canvas, this.inputHeight).then(r => {
            const o = this.ensureOverlay();
            if (o.width !== r.w || o.height !== r.h) { o.width = r.w; o.height = r.h; }
            o.getContext('2d').putImageData(new ImageData(r.rgba, r.w, r.h), 0, 0);
            o.style.display = 'block';
            this.status = 'live ' + r.w + 'x' + r.h + ' - ' + this.ms.toFixed(0) + ' ms/frame';
        }).catch(e => { this.live = false; this.hideOverlay(); this.status = 'error: ' + String(e && e.message || e).slice(0, 120); })
            .finally(() => { this.busy = false; });
    }

    // one high-quality pass over a fresh frame -> PNG download
    snapshot(inputHeight) {
        if (!this.session) { this.status = 'load a model first'; return Promise.resolve(false); }
        const g = this.game;
        return new Promise(resolve => {
            const prev = this.live; this.live = false; this.hideOverlay();
            g.__onnxSnap = async (canvas) => {
                g.__onnxSnap = null;
                try {
                    this.status = 'upscaling snapshot...';
                    const r = await this.infer(canvas, inputHeight);
                    const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
                    c.getContext('2d').putImageData(new ImageData(r.rgba, r.w, r.h), 0, 0);
                    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'eblankraft_ai_' + r.w + 'x' + r.h + '.png';
                    a.click();
                    this.status = 'saved ' + r.w + 'x' + r.h + ' (' + this.ms.toFixed(0) + ' ms)';
                    resolve(true);
                } catch (e) { this.status = 'error: ' + String(e && e.message || e).slice(0, 120); resolve(false); }
                this.live = prev;
            };
        });
    }
}
window.RTXOnnx = RTXOnnx;

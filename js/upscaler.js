// FSR-style spatial upscaler for the browser (a free "DLSS alternative" that runs on any GPU / any browser).
//
// The scene is rendered at a fraction of the screen resolution (4x MSAA where WebGL2 allows it), then two cheap
// fragment passes rebuild a full-resolution image:
//   1. EASU-like edge-adaptive upscale: a 4x4 Lanczos2 kernel that is rotated/stretched along the local edge
//      direction (from a luma structure tensor), with anti-ringing clamp  -> clean diagonals instead of blur.
//   2. CAS/RCAS-like contrast-adaptive sharpening                           -> restores texture detail.
// No motion vectors, no history buffer, no vendor hardware: plain WebGL1/2 fragment shaders.
// Works standalone, and also after the RTX ON post stack (rtx.js renders at the lower resolution and hands over its result).
class FSRUpscaler {
    constructor(game) {
        this.game = game;
        this.mode = 'off';
        this.active = false;
        this.scale = 1;
        this.sharpness = 0.4;
        this.rt = null;       // low-res scene target (non-RTX path)
        this.mid = null;      // full-res EASU output
        this.quad = null;
        this.cam = null;
        this.scene = null;
    }

    static get MODES() { return { off: 1, quality: 0.77, balanced: 0.67, performance: 0.5, ultra: 0.4 }; }

    supported() { return !!(this.game && this.game.renderer); }

    setMode(mode) {
        if (!(mode in FSRUpscaler.MODES)) mode = 'off';
        this.mode = mode;
        this.scale = FSRUpscaler.MODES[mode];
        this.active = mode !== 'off' && this.supported();
        try { localStorage.setItem('eblankraft_upscaler', mode); } catch (e) {}
        this.dispose();
        if (this.active) this.build();
        if (this.game.rtx) this.game.rtx.syncSize();
    }

    outSize() {
        const v = new THREE.Vector2();
        this.game.renderer.getDrawingBufferSize(v);
        return v;
    }

    inSize() {
        const o = this.outSize();
        return new THREE.Vector2(Math.max(2, Math.floor(o.x * this.scale)), Math.max(2, Math.floor(o.y * this.scale)));
    }

    resize() {
        if (!this.active) return;
        this.dispose();
        this.build();
        if (this.game.rtx) this.game.rtx.syncSize();
    }

    build() {
        const r = this.game.renderer;
        const o = this.outSize(), i = this.inSize();
        const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: true };
        try {
            if (r.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) {
                this.rt = new THREE.WebGLMultisampleRenderTarget(i.x, i.y, opts);
                this.rt.samples = 4;
            }
        } catch (e) { this.rt = null; }
        if (!this.rt) this.rt = new THREE.WebGLRenderTarget(i.x, i.y, opts);
        this.rt.texture.encoding = THREE.sRGBEncoding;   // renderer writes tone-mapped sRGB values, like the canvas would
        this.mid = new THREE.WebGLRenderTarget(o.x, o.y, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false });

        const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
        this.easu = new THREE.ShaderMaterial({
            uniforms: { tSrc: { value: null }, srcSize: { value: new THREE.Vector2(i.x, i.y) } },
            vertexShader: vs, fragmentShader: FSRUpscaler.EASU, depthTest: false, depthWrite: false
        });
        this.rcas = new THREE.ShaderMaterial({
            uniforms: { tSrc: { value: null }, texel: { value: new THREE.Vector2(1 / o.x, 1 / o.y) }, sharp: { value: this.sharpness } },
            vertexShader: vs, fragmentShader: FSRUpscaler.RCAS, depthTest: false, depthWrite: false
        });
        this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.scene = new THREE.Scene();
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.easu);
        this.quad.frustumCulled = false;
        this.scene.add(this.quad);
    }

    dispose() {
        for (const k of ['rt', 'mid']) { if (this[k]) { this[k].dispose(); this[k] = null; } }
        for (const k of ['easu', 'rcas']) { if (this[k]) { this[k].dispose(); this[k] = null; } }
        if (this.quad) { this.quad.geometry.dispose(); this.quad = null; }
        this.scene = null; this.cam = null;
    }

    // Non-RTX path: draw the game at the low resolution, then upscale to the canvas.
    renderScene() {
        const g = this.game, r = g.renderer;
        if (!this.rt) this.build();
        r.setRenderTarget(this.rt);
        r.clear();
        r.render(g.scene, g.camera);
        r.setRenderTarget(null);
        this.present(this.rt.texture);
    }

    // texture = any sRGB-encoded image at the internal resolution.
    present(tex) {
        const r = this.game.renderer;
        if (!this.quad) this.build();
        const i = this.inSize();
        this.easu.uniforms.tSrc.value = tex;
        this.easu.uniforms.srcSize.value.set(i.x, i.y);
        this.quad.material = this.easu;
        r.setRenderTarget(this.mid);
        r.render(this.scene, this.cam);
        this.rcas.uniforms.tSrc.value = this.mid.texture;
        this.rcas.uniforms.sharp.value = this.sharpness;
        this.quad.material = this.rcas;
        r.setRenderTarget(null);
        r.render(this.scene, this.cam);
    }
}

FSRUpscaler.EASU = `
    precision highp float;
    uniform sampler2D tSrc; uniform vec2 srcSize;
    varying vec2 vUv;
    vec3 tap(vec2 p) { return texture2D(tSrc, clamp((p + 0.5) / srcSize, vec2(0.0), vec2(1.0))).rgb; }
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    float lanczos2(float x) {
        x = max(x, 1e-4);
        if (x >= 2.0) return 0.0;
        float px = 3.14159265 * x;
        return 2.0 * sin(px) * sin(px * 0.5) / (px * px);
    }
    void main() {
        vec2 pp = vUv * srcSize - 0.5;
        vec2 ip = floor(pp);
        vec2 fp = pp - ip;
        vec3 C[16]; float L[16];
        for (int j = 0; j < 4; j++) {
            for (int i = 0; i < 4; i++) {
                vec3 c = tap(ip + vec2(float(i) - 1.0, float(j) - 1.0));
                C[j * 4 + i] = c; L[j * 4 + i] = luma(c);
            }
        }
        // luma structure tensor over the 4 centre texels, bilinearly weighted
        float jxx = 0.0, jxy = 0.0, jyy = 0.0;
        for (int b = 1; b < 3; b++) {
            for (int a = 1; a < 3; a++) {
                float gx = (L[b * 4 + a + 1] - L[b * 4 + a - 1]) * 0.5;
                float gy = (L[(b + 1) * 4 + a] - L[(b - 1) * 4 + a]) * 0.5;
                float wx = (a == 1) ? 1.0 - fp.x : fp.x;
                float wy = (b == 1) ? 1.0 - fp.y : fp.y;
                float w = wx * wy;
                jxx += w * gx * gx; jxy += w * gx * gy; jyy += w * gy * gy;
            }
        }
        float tr = jxx + jyy;
        float disc = sqrt((jxx - jyy) * (jxx - jyy) + 4.0 * jxy * jxy);
        float l1 = 0.5 * (tr + disc), l2 = 0.5 * (tr - disc);
        float theta = 0.5 * atan(2.0 * jxy, jxx - jyy);
        vec2 g = vec2(cos(theta), sin(theta));          // dominant gradient (across the edge)
        vec2 t = vec2(-g.y, g.x);                        // along the edge
        float coh = (l1 - l2) / (l1 + l2 + 1e-6);
        float strength = smoothstep(0.0004, 0.01, l1);
        float a = coh * strength;
        float stretch = mix(1.0, 0.5, a);                // wider kernel along edges -> smooth diagonals
        float squeeze = mix(1.0, 1.15, a);               // slightly tighter across -> crisp edge
        vec3 sum = vec3(0.0); float wsum = 0.0;
        for (int j = 0; j < 4; j++) {
            for (int i = 0; i < 4; i++) {
                vec2 d = vec2(float(i) - 1.0, float(j) - 1.0) - fp;
                float u = dot(d, g) * squeeze, v = dot(d, t) * stretch;
                float w = lanczos2(sqrt(u * u + v * v));
                sum += C[j * 4 + i] * w; wsum += w;
            }
        }
        vec3 col = sum / max(wsum, 1e-4);
        // anti-ringing: stay inside the range of the 4 nearest texels
        vec3 mn = min(min(C[5], C[6]), min(C[9], C[10]));
        vec3 mx = max(max(C[5], C[6]), max(C[9], C[10]));
        gl_FragColor = vec4(clamp(col, mn, mx), 1.0);
    }`;

FSRUpscaler.RCAS = `
    precision highp float;
    uniform sampler2D tSrc; uniform vec2 texel; uniform float sharp;
    varying vec2 vUv;
    void main() {
        vec3 e = texture2D(tSrc, vUv).rgb;
        vec3 b = texture2D(tSrc, vUv + vec2(0.0, -texel.y)).rgb;
        vec3 d = texture2D(tSrc, vUv + vec2(-texel.x, 0.0)).rgb;
        vec3 f = texture2D(tSrc, vUv + vec2(texel.x, 0.0)).rgb;
        vec3 h = texture2D(tSrc, vUv + vec2(0.0, texel.y)).rgb;
        vec3 mn = min(min(min(d, e), min(f, b)), h);
        vec3 mx = max(max(max(d, e), max(f, b)), h);
        vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-3)), 0.0, 1.0));
        float peak = -1.0 / mix(8.0, 5.0, sharp);
        vec3 w = amp * peak;
        vec3 rcp = 1.0 / (1.0 + 4.0 * w);
        gl_FragColor = vec4(clamp((b * w + d * w + f * w + h * w + e) * rcp, 0.0, 1.0), 1.0);
    }`;
window.FSRUpscaler = FSRUpscaler;

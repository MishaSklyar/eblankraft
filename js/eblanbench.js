// EBLANbench — hidden PC strength benchmark.
// Activate: click the main-menu title "ЕБЛАНКРАФТ" 7 times, type "eblanbench"
// anywhere outside an input field, or call EBLANbench.open() from the console.
(function () {
    'use strict';

    const W = 960, H = 540;
    const TEST_SECONDS = 4;

    // Final score -> label. Thresholds are total points.
    const TIERS = [
        { min: 0,     label: 'ГОВНОЕБЛАН',         color: '#8b5a2b', note: 'Твій ПК — це калькулятор з амбіціями.' },
        { min: 1500,  label: 'КАРТОПЛЕЕБЛАН',      color: '#c9a227', note: 'Картопля, але тепла і своя.' },
        { min: 4000,  label: 'ЗВИЧАЙНИЙ ЕБЛАН',    color: '#9e9e9e', note: 'Грає. Не питай як.' },
        { min: 8000,  label: 'ТУРБОЕБЛАН',         color: '#4caf50', note: 'Тягне RTX і не плаче.' },
        { min: 15000, label: 'ЕБЛАН-ТИТАН',        color: '#2196f3', note: 'Path tracing на сніданок.' },
        { min: 28000, label: 'ГІГАЕБЛАН',          color: '#e040fb', note: 'NASA хоче твій ПК.' },
        { min: 60000, label: 'БОГОЕБЛАН',          color: '#ff1744', note: 'Ти взагалі легальний?' }
    ];

    function tierFor(score) {
        let t = TIERS[0];
        for (const x of TIERS) if (score >= x.min) t = x;
        return t;
    }

    // ---------- shaders ----------
    const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

    const SCENE_GLSL = `
        uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
        struct Hit { float t; vec3 n; vec3 col; float refl; float emit; };
        void sph(vec3 ro, vec3 rd, vec3 c, float r, vec3 col, float refl, float emit, inout Hit h){
            vec3 oc = ro - c; float b = dot(oc, rd); float k = dot(oc, oc) - r*r; float d = b*b - k;
            if (d < 0.0) return; float t = -b - sqrt(d);
            if (t > 0.001 && t < h.t) { h.t = t; h.n = normalize(ro + rd*t - c); h.col = col; h.refl = refl; h.emit = emit; }
        }
        void boxv(vec3 ro, vec3 rd, vec3 c, vec3 s, vec3 col, inout Hit h){
            vec3 m = 1.0/rd; vec3 n = m*(ro-c); vec3 k = abs(m)*s;
            vec3 t1 = -n-k; vec3 t2 = -n+k; float tn = max(max(t1.x,t1.y),t1.z); float tf = min(min(t2.x,t2.y),t2.z);
            if (tn > tf || tf < 0.0 || tn < 0.001 || tn > h.t) return;
            h.t = tn; h.n = -sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz); h.col = col; h.refl = 0.0; h.emit = 0.0;
        }
        Hit trace(vec3 ro, vec3 rd){
            Hit h; h.t = 1e9; h.n = vec3(0.0); h.col = vec3(0.0); h.refl = 0.0; h.emit = 0.0;
            if (rd.y < 0.0) { float t = -ro.y/rd.y; if (t < h.t) { vec3 p = ro + rd*t;
                float ch = mod(floor(p.x)+floor(p.z), 2.0);
                h.t = t; h.n = vec3(0,1,0); h.col = mix(vec3(0.35,0.6,0.25), vec3(0.45,0.3,0.15), ch); h.refl = 0.0; h.emit = 0.0; } }
            for (int i = 0; i < 6; i++) {
                float fi = float(i); float a = uTime*0.4 + fi*1.047;
                sph(ro, rd, vec3(cos(a)*3.0, 0.8 + 0.3*sin(uTime+fi), sin(a)*3.0), 0.8,
                    0.5+0.5*cos(vec3(0,2,4)+fi), mod(fi,2.0)*0.8, 0.0, h);
            }
            boxv(ro, rd, vec3(0,0.75,0), vec3(0.75), vec3(0.6,0.6,0.65), h);
            sph(ro, rd, vec3(0,5.0,0), 1.0, vec3(1.0,0.9,0.7), 0.0, 6.0, h);
            return h;
        }
        vec3 sky(vec3 rd){ return mix(vec3(0.9,0.8,0.7), vec3(0.3,0.5,0.9), clamp(rd.y*1.5,0.0,1.0)); }
        vec3 camRay(vec2 jitter, out vec3 ro){
            vec2 p = (vUv*uRes + jitter - 0.5*uRes)/uRes.y;
            float a = uTime*0.15; ro = vec3(sin(a)*8.0, 3.5, cos(a)*8.0);
            vec3 f = normalize(vec3(0,1,0)-ro); vec3 r = normalize(cross(f, vec3(0,1,0))); vec3 u = cross(r,f);
            return normalize(f*1.6 + r*p.x + u*p.y);
        }
    `;

    const RT_FRAG = SCENE_GLSL + `
        void main(){
            vec3 ro; vec3 rd = camRay(vec2(0.0), ro);
            vec3 col = vec3(0.0); vec3 thr = vec3(1.0);
            vec3 L = normalize(vec3(0.6,1.0,0.4));
            for (int b = 0; b < 4; b++) {
                Hit h = trace(ro, rd);
                if (h.t > 1e8) { col += thr*sky(rd); break; }
                if (h.emit > 0.0) { col += thr*h.col*h.emit*0.3; break; }
                vec3 p = ro + rd*h.t + h.n*0.002;
                Hit sh = trace(p, L); float shadow = sh.t > 1e8 ? 1.0 : 0.25;
                float dif = max(dot(h.n, L), 0.0)*shadow;
                float spec = pow(max(dot(reflect(rd,h.n), L), 0.0), 40.0)*shadow;
                col += thr*(1.0-h.refl)*(h.col*(dif+0.15) + spec*0.5);
                thr *= h.refl*h.col; if (h.refl < 0.01) break;
                ro = p; rd = reflect(rd, h.n);
            }
            gl_FragColor = vec4(pow(col, vec3(0.4545)), 1.0);
        }
    `;

    const PT_FRAG = SCENE_GLSL + `
        float seed;
        float rnd(){ seed = fract(sin(seed*91.3458 + 47.233)*43758.5453); return seed; }
        vec3 cosDir(vec3 n){
            float u = rnd(), v = rnd(); float a = 6.2831853*v; float b = 2.0*u-1.0;
            return normalize(n + vec3(sqrt(1.0-b*b)*vec2(cos(a),sin(a)), b));
        }
        void main(){
            seed = dot(vUv, vec2(12.9898,78.233)) + fract(uTime)*1000.0;
            vec3 acc = vec3(0.0);
            for (int s = 0; s < 8; s++) {
                vec3 ro; vec3 rd = camRay(vec2(rnd(),rnd())-0.5, ro);
                vec3 col = vec3(0.0); vec3 thr = vec3(1.0);
                for (int b = 0; b < 5; b++) {
                    Hit h = trace(ro, rd);
                    if (h.t > 1e8) { col += thr*sky(rd)*0.6; break; }
                    if (h.emit > 0.0) { col += thr*h.col*h.emit; break; }
                    ro = ro + rd*h.t + h.n*0.002;
                    if (rnd() < h.refl) { rd = reflect(rd, h.n); thr *= h.col; }
                    else { rd = cosDir(h.n); thr *= h.col; }
                }
                acc += col;
            }
            acc /= 8.0;
            gl_FragColor = vec4(pow(acc/(acc+1.0)*1.6, vec3(0.4545)), 1.0);
        }
    `;

    // ---------- tests ----------
    // Each test: setup(renderer) -> { frame(t), dispose() }, weight converts fps to points.
    const TESTS = [
        {
            id: 'cpu', name: 'Генерація світу (CPU)', weight: 0, cpu: true,
            run() {
                // Terrain noise over many chunks; score = chunks/sec.
                const start = performance.now(); let chunks = 0; let sink = 0;
                const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
                const noise = (x, z) => {
                    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
                    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
                    const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
                    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
                };
                const vox = new Uint8Array(16 * 16 * 64);
                while (performance.now() - start < 2000) {
                    const cx = chunks % 64, cz = (chunks / 64) | 0;
                    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
                        const wx = cx * 16 + x, wz = cz * 16 + z;
                        let h = 0, amp = 24, f = 0.01;
                        for (let o = 0; o < 4; o++) { h += noise(wx * f, wz * f) * amp; amp *= 0.5; f *= 2; }
                        h = Math.min(63, h | 0);
                        for (let y = 0; y < 64; y++) vox[(y * 16 + z) * 16 + x] = y < h ? (y < h - 3 ? 1 : 2) : 0;
                    }
                    sink += vox[chunks & 4095]; chunks++;
                }
                const secs = (performance.now() - start) / 1000;
                const rate = chunks / secs;
                return { value: rate, unit: 'чанків/с', points: Math.round(rate * 0.11), sink };
            }
        },
        {
            id: 'chunks', name: 'Рендер чанків', weight: 9, unit: 'FPS',
            setup(r) {
                const scene = new THREE.Scene(); scene.background = new THREE.Color(0x87ceeb); scene.fog = new THREE.Fog(0x87ceeb, 60, 180);
                const cam = new THREE.PerspectiveCamera(70, W / H, 0.1, 400);
                scene.add(new THREE.AmbientLight(0xffffff, 0.5));
                const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(1, 2, 1); scene.add(sun);
                const geo = new THREE.BoxGeometry(1, 1, 1);
                const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
                const R = 96, cubes = [];
                for (let x = -R; x < R; x++) for (let z = -R; z < R; z++) {
                    const h = Math.floor(6 + 4 * Math.sin(x * 0.11) + 4 * Math.cos(z * 0.09) + 2 * Math.sin((x + z) * 0.3));
                    for (let y = Math.max(0, h - 2); y <= h; y++) cubes.push(x, y, z, h);
                }
                const n = cubes.length / 4;
                const mesh = new THREE.InstancedMesh(geo, mat, n);
                const m = new THREE.Matrix4(), c = new THREE.Color();
                for (let i = 0; i < n; i++) {
                    m.makeTranslation(cubes[i * 4], cubes[i * 4 + 1], cubes[i * 4 + 2]); mesh.setMatrixAt(i, m);
                    const top = cubes[i * 4 + 1] === cubes[i * 4 + 3];
                    c.setHex(top ? 0x4caf50 : 0x8d6e63).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08); mesh.setColorAt(i, c);
                }
                scene.add(mesh);
                this.extra = n.toLocaleString() + ' блоків';
                return {
                    frame(t) { const a = t * 0.25; cam.position.set(Math.sin(a) * 50, 28, Math.cos(a) * 50); cam.lookAt(0, 6, 0); r.render(scene, cam); },
                    dispose() { geo.dispose(); mat.dispose(); mesh.dispose && mesh.dispose(); }
                };
            }
        },
        {
            id: 'textures', name: 'Текстури', weight: 12, unit: 'FPS',
            setup(r) {
                const scene = new THREE.Scene(); scene.background = new THREE.Color(0x202020);
                const cam = new THREE.PerspectiveCamera(70, W / H, 0.1, 200); cam.position.set(0, 0, 14);
                const texs = [], mats = [];
                for (let i = 0; i < 24; i++) {
                    const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
                    const g = cv.getContext('2d');
                    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
                        g.fillStyle = 'hsl(' + ((i * 37 + x * 3 + y * 5) % 360) + ',60%,' + (30 + ((x ^ y) & 15) * 2) + '%)';
                        g.fillRect(x * 16, y * 16, 16, 16);
                    }
                    const tx = new THREE.CanvasTexture(cv); tx.anisotropy = r.capabilities.getMaxAnisotropy(); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(4, 4);
                    texs.push(tx); mats.push(new THREE.MeshBasicMaterial({ map: tx }));
                }
                const geo = new THREE.PlaneGeometry(4, 4); const meshes = [];
                for (let i = 0; i < 1200; i++) {
                    const ms = new THREE.Mesh(geo, mats[i % mats.length]);
                    ms.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, -Math.random() * 60);
                    ms.rotation.set(Math.random() * 6, Math.random() * 6, 0); scene.add(ms); meshes.push(ms);
                }
                this.extra = '24 × 1024² + анізотропія';
                return {
                    frame(t) { for (let i = 0; i < meshes.length; i++) meshes[i].rotation.y += 0.01; cam.position.x = Math.sin(t) * 4; r.render(scene, cam); },
                    dispose() { geo.dispose(); mats.forEach(m => m.dispose()); texs.forEach(x => x.dispose()); }
                };
            }
        },
        { id: 'rt', name: 'Ray Tracing', weight: 5.5, unit: 'FPS', frag: RT_FRAG, extra: '4 відбиття + тіні' },
        { id: 'pt', name: 'Path Tracing', weight: 18, unit: 'FPS', frag: PT_FRAG, extra: '8 семплів × 5 відскоків' }
    ];

    function shaderTest(def, r) {
        const scene = new THREE.Scene(); const cam = new THREE.Camera();
        const mat = new THREE.ShaderMaterial({
            vertexShader: FS_VERT, fragmentShader: def.frag,
            uniforms: { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } }, depthTest: false
        });
        const geo = new THREE.PlaneGeometry(2, 2); scene.add(new THREE.Mesh(geo, mat));
        return {
            frame(t) { mat.uniforms.uTime.value = t; r.render(scene, cam); },
            dispose() { geo.dispose(); mat.dispose(); }
        };
    }

    // ---------- UI ----------
    let overlay = null, running = false, cancelled = false;

    function el(tag, css, html) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }

    function gpuName(r) {
        try {
            const gl = r.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
            return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        } catch (e) { return 'невідомо'; }
    }

    function open() {
        if (overlay) return;
        try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
        overlay = el('div', 'position:fixed;inset:0;z-index:2147483000;background:rgba(5,5,10,0.97);color:#eee;font-family:monospace,system-ui;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow:auto;padding:16px;box-sizing:border-box;');
        overlay.id = 'eblanbench-overlay';
        overlay.innerHTML =
            '<div style="font-size:34px;font-weight:900;letter-spacing:2px;margin:8px 0 2px;background:linear-gradient(90deg,#ff1744,#e040fb,#2196f3);-webkit-background-clip:text;background-clip:text;color:transparent;">EBLANbench</div>' +
            '<div style="opacity:.6;margin-bottom:12px;font-size:12px;">секретний тест сили твого ПК · v1</div>';
        const stage = el('div', 'position:relative;width:min(960px,100%);aspect-ratio:16/9;background:#000;border:2px solid #333;border-radius:8px;overflow:hidden;');
        const label = el('div', 'position:absolute;left:10px;top:8px;font-size:14px;text-shadow:0 0 4px #000;z-index:2;', 'Готовий до тесту');
        const fpsLbl = el('div', 'position:absolute;right:10px;top:8px;font-size:14px;color:#0f0;text-shadow:0 0 4px #000;z-index:2;');
        stage.append(label, fpsLbl);
        const table = el('div', 'width:min(960px,100%);margin-top:12px;font-size:14px;');
        const result = el('div', 'margin-top:12px;text-align:center;min-height:40px;');
        const btns = el('div', 'margin-top:12px;display:flex;gap:10px;');
        const bs = 'padding:10px 22px;font:bold 15px monospace;border:none;border-radius:6px;cursor:pointer;';
        const startBtn = el('button', bs + 'background:#e040fb;color:#000;', '▶ ПОЧАТИ ТЕСТ');
        const closeBtn = el('button', bs + 'background:#444;color:#fff;', '✕ Закрити');
        btns.append(startBtn, closeBtn);
        [stage, table, result, btns].forEach(n => n.style.flexShrink = '0');
        overlay.append(stage, table, result, btns);
        document.body.appendChild(overlay);

        const rows = {};
        const mkRow = (id, name) => {
            const row = el('div', 'display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #222;');
            row.innerHTML = '<span>' + name + ' <span style="opacity:.45;font-size:11px" data-x></span></span><span data-v style="opacity:.5">—</span>';
            table.appendChild(row); rows[id] = row;
        };
        TESTS.forEach(t => mkRow(t.id, t.name));

        closeBtn.onclick = () => { cancelled = true; if (!running) close(); };
        startBtn.onclick = () => {
            if (running) return;
            startBtn.disabled = true; startBtn.style.opacity = '0.4';
            runAll(stage, label, fpsLbl, rows, result).finally(() => { startBtn.disabled = false; startBtn.style.opacity = '1'; startBtn.textContent = '↻ ЩЕ РАЗ'; if (cancelled) close(); });
        };
    }

    function close() {
        if (overlay) overlay.remove();
        overlay = null; cancelled = false;
    }

    const wait = ms => new Promise(res => setTimeout(res, ms));

    async function runAll(stage, label, fpsLbl, rows, result) {
        running = true; cancelled = false;
        result.innerHTML = '';
        let r;
        try {
            r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
        } catch (e) {
            result.innerHTML = '<div style="color:#f44">WebGL не працює. Автоматично: <b style="font-size:28px;color:#8b5a2b">ГОВНОЕБЛАН</b></div>';
            running = false; return;
        }
        r.setPixelRatio(1); r.setSize(W, H, false);
        r.domElement.style.cssText = 'width:100%;height:100%;display:block;';
        stage.appendChild(r.domElement);
        const gl = r.getContext(); const px = new Uint8Array(4);
        const gpu = gpuName(r);

        let total = 0; const parts = [];
        for (const def of TESTS) {
            if (cancelled) break;
            const row = rows[def.id]; const v = row.querySelector('[data-v]'); const x = row.querySelector('[data-x]');
            v.style.opacity = '1'; v.style.color = '#ff0'; v.textContent = 'тест...';
            label.textContent = '▶ ' + def.name;
            await wait(50);
            let pts = 0, shown = '';
            try {
                if (def.cpu) {
                    fpsLbl.textContent = 'CPU...';
                    const res = def.run();
                    pts = res.points; shown = res.value.toFixed(0) + ' ' + res.unit;
                } else {
                    const ctx = { extra: def.extra };
                    const t = def.frag ? shaderTest(def, r) : def.setup.call(ctx, r);
                    if (ctx.extra) x.textContent = '(' + ctx.extra + ')';
                    // warmup: shader compile + uploads
                    t.frame(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                    let frames = 0; const t0 = performance.now(); let last = t0;
                    while (!cancelled) {
                        const now = performance.now(); const el2 = (now - t0) / 1000;
                        if (el2 >= TEST_SECONDS) break;
                        t.frame(el2);
                        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // GPU sync
                        frames++;
                        if (now - last > 250) {
                            fpsLbl.textContent = (frames / Math.max(el2, 0.001)).toFixed(1) + ' FPS';
                            last = now;
                            await new Promise(requestAnimationFrame);
                        }
                    }
                    const fps = frames / ((performance.now() - t0) / 1000);
                    t.dispose();
                    pts = Math.round(fps * def.weight); shown = fps.toFixed(1) + ' FPS';
                }
            } catch (e) {
                console.warn('[EBLANbench]', def.id, e); shown = 'впав 💀'; pts = 0;
            }
            total += pts; parts.push({ name: def.name, pts });
            v.style.color = '#0f0'; v.textContent = shown + '  ·  ' + pts.toLocaleString() + ' балів';
        }

        r.dispose(); try { r.forceContextLoss(); } catch (e) {}
        r.domElement.remove();
        fpsLbl.textContent = ''; label.textContent = cancelled ? 'Скасовано' : 'Готово';
        running = false;
        if (cancelled) return;

        const tier = tierFor(total);
        let best = null;
        try { best = JSON.parse(localStorage.getItem('eblanbench_best') || 'null'); } catch (e) {}
        const isBest = !best || total > best.score;
        if (isBest) { try { localStorage.setItem('eblanbench_best', JSON.stringify({ score: total, label: tier.label, date: Date.now() })); } catch (e) {} }
        result.innerHTML =
            '<div style="opacity:.6;font-size:12px">' + escapeHtml(gpu) + ' · ' + (navigator.hardwareConcurrency || '?') + ' потоків CPU</div>' +
            '<div style="font-size:52px;font-weight:900;margin-top:6px">' + total.toLocaleString() + '</div>' +
            '<div style="font-size:36px;font-weight:900;color:' + tier.color + ';text-shadow:0 0 18px ' + tier.color + '">' + tier.label + '</div>' +
            '<div style="opacity:.75;margin-top:4px">' + tier.note + '</div>' +
            '<div style="opacity:.5;font-size:12px;margin-top:6px">' + (isBest ? '🏆 Новий особистий рекорд!' : 'Рекорд: ' + best.score.toLocaleString() + ' (' + best.label + ')') + '</div>';
        console.log('[EBLANbench]', total, tier.label, parts);
    }

    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // ---------- hidden activation ----------
    const SECRET = 'eblanbench'; let typed = '';
    document.addEventListener('keydown', (e) => {
        const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
        if (e.key === 'Escape' && overlay && !running) { close(); return; }
        if (!e.key || e.key.length !== 1) return;
        typed = (typed + e.key.toLowerCase()).slice(-SECRET.length);
        if (typed === SECRET) { typed = ''; open(); }
    });
    let clicks = 0, clickTimer = 0;
    document.addEventListener('click', (e) => {
        if (!e.target || !e.target.closest || !e.target.closest('.mm-title-text')) return;
        clicks++; clearTimeout(clickTimer); clickTimer = setTimeout(() => { clicks = 0; }, 1500);
        if (clicks >= 7) { clicks = 0; open(); }
    });

    window.EBLANbench = { open, close, tierFor, TIERS, TESTS };
})();

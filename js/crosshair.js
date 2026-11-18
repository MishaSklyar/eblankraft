// Custom crosshair: a small style model (shape, colour, size, gap, outline, centre dot, spread ring),
// drawn as SVG over the screen, saved per browser, and shareable as a short code.
// Exposed as window.CrosshairStyle. The pause menu's "Crosshair" tab is built by mount().
(function (global) {
    'use strict';

    const STORAGE_KEY = 'eblankraft_crosshair';
    const CODE_PREFIX = 'EBCH1.';
    const STYLES = ['plus', 'tshape', 'x', 'circle', 'dot'];
    const STYLE_LABELS = { plus: 'Plus', tshape: 'T', x: 'X', circle: 'Circle', dot: 'Dot' };
    const HEX = /^#[0-9a-f]{6}$/i;
    const INTEGER_FIELDS = ['size', 'thickness', 'gap', 'dotSize'];
    // [min, max] for every numeric field.
    const RANGES = {
        size: [2, 24], thickness: [1, 6], gap: [0, 16], dotSize: [1, 8], opacity: [0.2, 1], ringOpacity: [0, 1],
    };
    const DEFAULTS = {
        style: 'plus', color: '#ffffff', outline: true, centerDot: false, spreadRing: true,
        size: 6, thickness: 2, gap: 4, dotSize: 2, opacity: 0.95, ringOpacity: 0.45,
    };
    const PRESETS = {
        classic: { label: 'Classic', values: {} },
        tight: { label: 'Tight', values: { color: '#00e5ff', size: 4, thickness: 1, gap: 2 } },
        dot: { label: 'Green dot', values: { style: 'dot', color: '#7dff6b', dotSize: 3 } },
        circle: { label: 'Circle', values: { style: 'circle', size: 7, thickness: 1, centerDot: true } },
        redx: { label: 'Red X', values: { style: 'x', color: '#ff4d4d', size: 5, gap: 3 } },
    };
    const SWATCHES = ['#ffffff', '#00e5ff', '#7dff6b', '#ffd54a', '#ff4d4d', '#ff00ff'];
    const SLIDERS = [
        ['size', 'Size (px)'], ['thickness', 'Thickness (px)'], ['gap', 'Gap (px)'], ['dotSize', 'Centre dot size (px)'],
        ['opacity', 'Opacity'], ['ringOpacity', 'Spread ring opacity'],
    ];
    const TOGGLES = [['outline', 'Black outline'], ['centerDot', 'Centre dot'], ['spreadRing', 'Spread ring (shows bullet spread)']];

    const storage = () => { try { return global.localStorage || null; } catch (e) { return null; } };

    function clampNumber(value, [min, max], fallback, integer) {
        if (value === null || value === undefined || value === '' || typeof value === 'boolean') return fallback;
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        const clamped = Math.min(max, Math.max(min, n));
        return integer ? Math.round(clamped) : Math.round(clamped * 100) / 100;
    }

    // Any input (saved JSON, a share code, a form) becomes a complete, valid config.
    function normalize(input) {
        const src = input && typeof input === 'object' ? input : {};
        const out = {
            style: STYLES.includes(src.style) ? src.style : DEFAULTS.style,
            color: typeof src.color === 'string' && HEX.test(src.color) ? src.color.toLowerCase() : DEFAULTS.color,
            outline: typeof src.outline === 'boolean' ? src.outline : DEFAULTS.outline,
            centerDot: typeof src.centerDot === 'boolean' ? src.centerDot : DEFAULTS.centerDot,
            spreadRing: typeof src.spreadRing === 'boolean' ? src.spreadRing : DEFAULTS.spreadRing,
        };
        for (const key of Object.keys(RANGES)) {
            out[key] = clampNumber(src[key], RANGES[key], DEFAULTS[key], INTEGER_FIELDS.includes(key));
        }
        return out;
    }

    // Shape geometry in pixels around the centre (0, 0). Arms start `gap` away from the centre and are `size` long.
    function geometry(input) {
        const c = normalize(input);
        const lines = [], circles = [];
        const g = c.gap, L = c.size;
        const arm = (x1, y1, x2, y2) => lines.push([x1, y1, x2, y2]);
        if (c.style === 'plus' || c.style === 'tshape') {
            arm(0, g, 0, g + L);
            arm(-g, 0, -(g + L), 0);
            arm(g, 0, g + L, 0);
            if (c.style === 'plus') arm(0, -g, 0, -(g + L));
        } else if (c.style === 'x') {
            const k = Math.SQRT1_2;
            for (const sx of [-1, 1]) for (const sy of [-1, 1]) arm(sx * g * k, sy * g * k, sx * (g + L) * k, sy * (g + L) * k);
        } else if (c.style === 'circle') {
            circles.push({ cx: 0, cy: 0, r: L, dot: false });
        }
        if (c.style === 'dot' || c.centerDot) circles.push({ cx: 0, cy: 0, r: c.dotSize, dot: true });
        return { lines, circles };
    }

    function layer(geo, cls, color, width, grow) {
        const ls = geo.lines.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('');
        const cs = geo.circles.map(c => c.dot
            ? `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r + grow}" fill="${color}" stroke="none"/>`
            : `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none"/>`).join('');
        return `<g class="${cls}" stroke="${color}" stroke-width="${width}">${ls}${cs}</g>`;
    }

    // The crosshair as SVG markup: 100x100 px, centred on (0, 0). Foreground uses currentColor so CSS sets the colour.
    function buildSvg(input) {
        const c = normalize(input), geo = geometry(c);
        const outline = c.outline ? layer(geo, 'ch-outline', '#000000', c.thickness + 2, 1) : '';
        return `<svg viewBox="-50 -50 100 100" width="100" height="100" aria-hidden="true" focusable="false">`
            + `${outline}${layer(geo, 'ch-fg', 'currentColor', c.thickness, 0)}</svg>`;
    }

    function load(store = storage()) {
        try {
            const raw = store ? store.getItem(STORAGE_KEY) : null;
            return normalize(raw ? JSON.parse(raw) : null);
        } catch (e) {
            return normalize(null);
        }
    }

    function save(input, store = storage()) {
        const cfg = normalize(input);
        try { if (store) store.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) { /* storage blocked: keep it for this session only */ }
        return cfg;
    }

    // Share code: "EBCH1." + base64url(JSON). Plain ASCII, so btoa/atob are safe.
    function encode(input) {
        const b64 = global.btoa(JSON.stringify(normalize(input)));
        return CODE_PREFIX + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function decode(code) {
        if (typeof code !== 'string') return null;
        const text = code.trim();
        if (!text.startsWith(CODE_PREFIX) || text.length > 2000) return null;
        let b64 = text.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
        if (b64.length % 4 === 1) return null;   // not valid base64 length; padding cannot fix it
        while (b64.length % 4) b64 += '=';
        try {
            const parsed = JSON.parse(global.atob(b64));
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? normalize(parsed) : null;
        } catch (e) {
            return null;
        }
    }

    // Writes the colour and opacity variables and the SVG into the live HUD. Called on load and on every change.
    function applyToDom(input) {
        const doc = global.document;
        if (!doc) return;
        const cfg = normalize(input);
        const root = doc.documentElement;
        if (root && root.style) {
            root.style.setProperty('--ch-color', cfg.color);
            root.style.setProperty('--ch-opacity', String(cfg.opacity));
            root.style.setProperty('--ring-opacity', String(cfg.ringOpacity));
        }
        const cross = doc.getElementById('crosshair');
        if (cross) cross.innerHTML = buildSvg(cfg);
    }

    let current = load();
    applyToDom(current);

    function setCurrent(input) {
        current = save(input);
        applyToDom(current);
        return current;
    }

    function presetConfig(key) {
        const preset = PRESETS[key];
        if (!preset) return null;
        // Presets change the shape and colour only; the player's spread-ring choice stays.
        return normalize({ ...DEFAULTS, ...preset.values, spreadRing: current.spreadRing, ringOpacity: current.ringOpacity });
    }

    // Builds the customizer into `root` (the pause menu's Crosshair tab). Returns the API, or null without a DOM.
    function mount(root) {
        const doc = global.document;
        if (!root || !doc) return null;
        const h = (tag, props = {}, ...children) => {
            const node = doc.createElement(tag);
            for (const [key, value] of Object.entries(props)) {
                if (key === 'text') node.textContent = value;
                else if (key === 'on') for (const [type, fn] of Object.entries(value)) node.addEventListener(type, fn);
                else if (key === 'checked' || key === 'value') node[key] = value;
                else node.setAttribute(key, value);
            }
            for (const child of children) if (child) node.append(child);
            return node;
        };
        const update = patch => { setCurrent({ ...current, ...patch }); refresh(); };
        const status = h('p', { class: 'menu-setting-note ch-status', text: '' });

        const preview = h('div', { class: 'ch-preview' });
        const previewRing = h('div', { class: 'ch-preview-ring' });
        const previewCross = h('div', { class: 'ch-preview-cross' });
        preview.append(previewRing, previewCross);

        const presetButtons = Object.entries(PRESETS).map(([key, preset]) =>
            h('button', { class: 'menu-btn btn-secondary ch-chip', type: 'button', 'data-preset': key, text: preset.label,
                on: { click: () => { const cfg = presetConfig(key); if (cfg) { setCurrent(cfg); refresh(); } } } }));

        const styleButtons = STYLES.map(style =>
            h('button', { class: 'menu-btn btn-secondary ch-chip', type: 'button', 'data-style': style, text: STYLE_LABELS[style],
                on: { click: () => update({ style }) } }));

        const colorInput = h('input', { type: 'color', id: 'ch-color-input', value: current.color,
            on: { input: e => update({ color: e.target.value }) } });
        const swatches = SWATCHES.map(color =>
            h('button', { class: 'ch-swatch', type: 'button', 'data-color': color, title: color,
                style: `background:${color}`, on: { click: () => update({ color }) } }));

        const sliderRefs = {};
        const sliders = SLIDERS.map(([key, label]) => {
            const isPercent = key === 'opacity' || key === 'ringOpacity';
            const [min, max] = RANGES[key];
            const value = h('b', { class: 'ch-value' });
            const input = h('input', { type: 'range', id: `ch-${key}`, min, max, step: isPercent ? 0.05 : 1, value: current[key],
                on: { input: e => update({ [key]: Number(e.target.value) }) } });
            sliderRefs[key] = { input, value, isPercent };
            return h('div', { class: 'menu-row menu-row-stack' }, h('label', { for: `ch-${key}` }, `${label} `, value), input);
        });

        const toggles = TOGGLES.map(([key, label]) => {
            const input = h('input', { type: 'checkbox', id: `ch-${key}`, on: { change: e => update({ [key]: e.target.checked }) } });
            sliderRefs[`toggle:${key}`] = input;
            return h('label', { class: 'toggle-item' }, input, ` ${label}`);
        });

        const codeBox = h('textarea', { class: 'ch-code', rows: 2, spellcheck: 'false', 'aria-label': 'Crosshair share code' });
        const copyCode = () => {
            codeBox.value = encode(current);
            codeBox.select();
            const done = () => { status.textContent = 'Code copied. Paste it in Apply to use it on another browser.'; };
            try {
                if (global.navigator && global.navigator.clipboard) global.navigator.clipboard.writeText(codeBox.value).then(done, () => { status.textContent = 'Code selected: copy it with Ctrl+C.'; });
                else { doc.execCommand && doc.execCommand('copy'); status.textContent = 'Code selected: copy it with Ctrl+C.'; }
            } catch (e) { status.textContent = 'Code selected: copy it with Ctrl+C.'; }
        };
        const applyCode = () => {
            const cfg = decode(codeBox.value);
            if (!cfg) { status.textContent = 'That code is not a valid crosshair code.'; return; }
            setCurrent(cfg); refresh();
            status.textContent = 'Crosshair code applied.';
        };
        const reset = () => { setCurrent(DEFAULTS); refresh(); status.textContent = 'Reset to the default crosshair.'; };

        root.textContent = '';
        root.append(
            h('div', { class: 'menu-card ch-card' },
                preview,
                h('div', { class: 'menu-section-label' }, 'Presets'),
                h('div', { class: 'ch-chips' }, ...presetButtons),
                h('div', { class: 'menu-section-label' }, 'Shape'),
                h('div', { class: 'ch-chips' }, ...styleButtons),
                h('div', { class: 'menu-row' }, h('label', { for: 'ch-color-input' }, '🎨 Colour'), colorInput),
                h('div', { class: 'ch-swatches' }, ...swatches),
                ...sliders,
                h('div', { class: 'ch-toggles' }, ...toggles),
            ),
            h('div', { class: 'menu-card' },
                h('div', { class: 'menu-section-label' }, 'Share'),
                h('div', { class: 'menu-buttons-grid' },
                    h('button', { class: 'menu-btn btn-secondary', type: 'button', text: 'Copy code', on: { click: copyCode } }),
                    h('button', { class: 'menu-btn btn-primary', type: 'button', text: 'Apply code', on: { click: applyCode } }),
                    h('button', { class: 'menu-btn btn-danger', type: 'button', text: 'Reset', on: { click: reset } })),
                codeBox,
                status),
        );

        function refresh() {
            previewCross.innerHTML = buildSvg(current);
            previewCross.style.color = current.color;
            previewCross.style.opacity = String(current.opacity);
            previewRing.style.display = current.spreadRing ? 'block' : 'none';
            previewRing.style.borderColor = current.color;
            previewRing.style.opacity = String(current.ringOpacity);
            for (const btn of presetButtons) btn.classList.remove('active');
            for (const btn of styleButtons) btn.classList.toggle('active', btn.dataset.style === current.style);
            for (const btn of swatches) btn.classList.toggle('active', btn.dataset.color === current.color);
            colorInput.value = current.color;
            for (const [key, ref] of Object.entries(sliderRefs)) {
                if (key.startsWith('toggle:')) continue;
                ref.input.value = current[key];
                ref.value.textContent = ref.isPercent ? `${Math.round(current[key] * 100)}%` : String(current[key]);
            }
            for (const key of TOGGLES.map(([k]) => k)) sliderRefs[`toggle:${key}`].checked = !!current[key];
        }
        refresh();
        return api;
    }

    const api = {
        STYLES, STYLE_LABELS, DEFAULTS, RANGES, PRESETS,
        normalize, geometry, buildSvg, load, save, encode, decode, applyToDom, mount,
        get config() { return current; },
        isRingEnabled() { return current.spreadRing; },
        update(patch) { return setCurrent({ ...current, ...patch }); },
        reset() { return setCurrent(DEFAULTS); },
        applyPreset(key) { const cfg = presetConfig(key); return cfg ? setCurrent(cfg) : current; },
    };
    global.CrosshairStyle = api;
})(typeof window !== 'undefined' ? window : globalThis);

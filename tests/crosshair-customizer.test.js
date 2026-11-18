const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function memoryStorage(initial = null) {
    const data = new Map(initial ? [['eblankraft_crosshair', initial]] : []);
    return { data, getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)) };
}

function loadModule({ storage = memoryStorage(), document } = {}) {
    const context = vm.createContext({
        console, localStorage: storage, document,
        btoa: text => Buffer.from(text, 'binary').toString('base64'),
        atob: text => Buffer.from(text, 'base64').toString('binary'),
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/crosshair.js'), 'utf8'), context);
    return context.CrosshairStyle;
}

const count = (markup, tag) => (markup.match(new RegExp(`<${tag} `, 'g')) || []).length;
// Objects made inside a vm context have another realm's prototypes, so compare plain JSON copies.
const plain = value => JSON.parse(JSON.stringify(value));

test('normalize clamps numbers, rejects junk and keeps a complete config', () => {
    const C = loadModule();
    const n = C.normalize({ style: 'star', color: 'red', size: 999, thickness: -3, gap: 'x', opacity: 5, outline: 'yes', dotSize: 2.7 });
    assert.equal(n.style, 'plus');
    assert.equal(n.color, '#ffffff');
    assert.equal(n.size, 24);
    assert.equal(n.thickness, 1);
    assert.equal(n.gap, C.DEFAULTS.gap, 'a non-numeric value falls back to the default');
    assert.equal(n.opacity, 1);
    assert.equal(n.outline, C.DEFAULTS.outline, 'a non-boolean falls back to the default');
    assert.equal(n.dotSize, 3, 'integer fields are rounded');
    assert.deepEqual(Object.keys(n).sort(), Object.keys(C.DEFAULTS).sort());
    assert.equal(C.normalize({ color: '#00E5FF' }).color, '#00e5ff', 'colours are stored lower case');
    assert.deepEqual(C.normalize(null), C.DEFAULTS);
});

test('each shape draws its own geometry, and the outline doubles it underneath', () => {
    const C = loadModule();
    const base = { outline: false, centerDot: false };
    assert.equal(count(C.buildSvg({ ...base, style: 'plus' }), 'line'), 4);
    assert.equal(count(C.buildSvg({ ...base, style: 'tshape' }), 'line'), 3, 'T has no top arm');
    assert.equal(count(C.buildSvg({ ...base, style: 'x' }), 'line'), 4);
    assert.equal(count(C.buildSvg({ ...base, style: 'circle' }), 'circle'), 1);
    assert.equal(count(C.buildSvg({ ...base, style: 'dot' }), 'circle'), 1);
    assert.equal(count(C.buildSvg({ ...base, style: 'dot' }), 'line'), 0);
    assert.equal(count(C.buildSvg({ ...base, style: 'plus', centerDot: true }), 'circle'), 1, 'centre dot adds one circle');
    assert.equal(count(C.buildSvg({ outline: true, style: 'plus' }), 'line'), 8, 'outline layer repeats the arms');
    assert.ok(C.buildSvg({ style: 'plus' }).includes('class="ch-outline"'));
    assert.ok(C.buildSvg({ style: 'plus', outline: false }).includes('currentColor'), 'foreground follows the CSS colour');
});

test('arms start at the gap and run for the size', () => {
    const C = loadModule();
    const lines = C.geometry({ style: 'plus', gap: 5, size: 9 }).lines;
    assert.deepEqual(plain(lines[0]), [0, 5, 0, 14], 'bottom arm: from the gap out to gap + size');
    assert.deepEqual(plain(lines[1]), [-5, 0, -14, 0], 'left arm');
});

test('share codes round-trip, and invalid codes are rejected without hanging', () => {
    const C = loadModule();
    const cfg = C.normalize({ style: 'x', color: '#7dff6b', size: 9, gap: 1, outline: false, centerDot: true, ringOpacity: 0.2 });
    const code = C.encode(cfg);
    assert.ok(code.startsWith('EBCH1.'));
    assert.deepEqual(C.decode(code), cfg);
    assert.deepEqual(C.decode(`  ${code}  `), cfg, 'surrounding spaces are ignored');
    assert.equal(C.decode('hello'), null, 'no prefix');
    assert.equal(C.decode('EBCH1.A'), null, 'a base64 length of 1 mod 4 is never valid');
    assert.equal(C.decode('EBCH1.AAAAA'), null, 'length 5 returns instead of looping forever');
    assert.equal(C.decode(`EBCH1.${Buffer.from('[1,2]').toString('base64')}`), null, 'JSON that is not a config object');
    assert.equal(C.decode(`EBCH1.${Buffer.from('not json').toString('base64')}`), null, 'not JSON at all');
    assert.equal(C.decode('EBCH1.' + 'A'.repeat(3000)), null, 'oversized input is refused');
    assert.equal(C.decode(42), null);
});

test('saved settings survive a reload, and broken storage falls back to defaults', () => {
    const storage = memoryStorage();
    const first = loadModule({ storage });
    first.update({ color: '#ff4d4d', style: 'circle' });
    const reloaded = loadModule({ storage });
    assert.equal(reloaded.config.color, '#ff4d4d');
    assert.equal(reloaded.config.style, 'circle');

    assert.deepEqual(plain(loadModule({ storage: memoryStorage('{not json') }).config), plain(loadModule().config), 'corrupt JSON is ignored');
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    const blocked = loadModule({ storage: throwing });
    assert.deepEqual(blocked.config, blocked.normalize(null), 'blocked storage still gives a working crosshair');
    assert.equal(blocked.update({ size: 10 }).size, 10, 'blocked writes keep the change for this session');
});

test('presets change the shape and colour but keep the spread-ring choice', () => {
    const C = loadModule();
    C.update({ spreadRing: false, ringOpacity: 0.9 });
    C.applyPreset('redx');
    assert.equal(C.config.style, 'x');
    assert.equal(C.config.color, '#ff4d4d');
    assert.equal(C.config.spreadRing, false);
    assert.equal(C.config.ringOpacity, 0.9);
    assert.equal(C.isRingEnabled(), false);
});

test('applyToDom writes the colour variables and the SVG into the HUD', () => {
    const vars = {};
    const crosshair = { innerHTML: '' };
    const document = {
        documentElement: { style: { setProperty: (k, v) => { vars[k] = v; } } },
        getElementById: id => (id === 'crosshair' ? crosshair : null),
    };
    const C = loadModule({ document });
    C.applyToDom({ color: '#00e5ff', opacity: 0.5, ringOpacity: 0.3, style: 'dot' });
    assert.equal(vars['--ch-color'], '#00e5ff');
    assert.equal(vars['--ch-opacity'], '0.5');
    assert.equal(vars['--ring-opacity'], '0.3');
    assert.ok(crosshair.innerHTML.startsWith('<svg'), 'the crosshair holds the SVG');
});

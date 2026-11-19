const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

// Loads the real engine bundle (fengari + crosshair_lua.js + the generated examples) without a browser.
function load() {
    const context = vm.createContext({
        console,
        btoa: text => Buffer.from(text, 'binary').toString('base64'),
        atob: text => Buffer.from(text, 'base64').toString('binary'),
    });
    context.window = context;
    for (const file of ['js/fengari-web.js', 'js/crosshair_lua.js', 'js/crosshair_examples.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context);
    }
    return context;
}

const plain = value => JSON.parse(JSON.stringify(value));

const STATE = {
    time: 1, width: 1280, height: 720, fov: 72, hasGun: true, gun: 'ak47', ammo: 30, reloading: false,
    spread: 0.02, spreadPx: 12, bloom: 0.1, recoil: 0, recoilPx: 0, moving: true, speed: 4.5, airborne: false, aiming: false,
    scoped: false, targetLocked: false, blockTarget: false, hitMarker: false, hitType: '',
    health: 100, maxHealth: 100, dead: false, menuOpen: false,
};

// Loads a script and runs one frame of it.
function run(ctx, src, values = {}, state = STATE) {
    const engine = ctx.CrosshairLua.createEngine(ctx.fengari);
    const params = engine.load(src);
    const ops = engine.frame(state, values);
    return { params: plain(params), ops: plain(ops) };
}

const ONE_DRAW = name => `function draw(c, s) if ${name} ~= nil then c:circle(0, 0, 1, "#ffffff") end end`;
const ABSENT = name => `function draw(c, s) if ${name} == nil then c:circle(0, 0, 1, "#ffffff") end end`;

test('the sandbox has only the safe standard library', () => {
    const ctx = load();
    for (const name of ['os', 'io', 'debug', 'package', 'require', 'load', 'loadfile', 'dofile', 'print', 'collectgarbage']) {
        assert.equal(run(ctx, ABSENT(name)).ops.length, 1, `${name} must not exist`);
    }
    assert.equal(run(ctx, ABSENT('string.rep')).ops.length, 1, 'string.rep can allocate gigabytes in one call, so it is removed');
    for (const name of ['math', 'table', 'string', 'pairs', 'ipairs', 'pcall', 'tostring']) {
        assert.equal(run(ctx, ONE_DRAW(name)).ops.length, 1, `${name} must exist`);
    }
});

test('a loop that never ends is stopped with a readable error', () => {
    const ctx = load();
    assert.throws(() => run(ctx, 'function draw(c, s) while true do end end'), /ran too long in one frame/);
    assert.throws(() => run(ctx, 'function draw(c, s) for i = 1, 1e9 do end end'), /ran too long in one frame/);
});

test('ordinary work inside the step budget runs to the end', () => {
    const ctx = load();
    const out = run(ctx, 'function draw(c, s) local n = 0 for i = 1, 3000 do n = n + i end c:circle(0, 0, 2, "#ffffff") end');
    assert.equal(out.ops.length, 1);
});

test('every draw call records a clean operation', () => {
    const ctx = load();
    const out = run(ctx, `function draw(c, s)
  c:line(0, 1, 0, 9, 2, "#fff")
  c:rect(1, 2, 3, 4, "#ffffff80")
  c:frame(0, 0, 10, 10, 1, "#123456")
  c:circle(0, 0, 3, "#abcdef")
  c:ring(0, 0, 8, 1, "#ff0000")
  c:poly({0, -5, 4, 4, -4, 4}, "#00ff00")
  c:outline({0, 0, 3, 3, 0, 6}, 1, "#0000ff")
  c:text(0, 20, "hello", 11, "#ffffff")
end`);
    assert.deepEqual(out.ops.map(op => op.t), ['line', 'rect', 'frame', 'circle', 'ring', 'poly', 'outline', 'text']);
    assert.equal(out.ops[0].color, 'rgba(255, 255, 255, 1.000)', '#rgb colours expand to full colours');
    assert.equal(out.ops[1].color, 'rgba(255, 255, 255, 0.502)', '#rrggbbaa colours keep their alpha');
    assert.equal(out.ops[7].text, 'hello');
    assert.equal(out.ops[7].size, 11);
});

test('rotate applies to the calls after it, until reset', () => {
    const ctx = load();
    const out = run(ctx, 'function draw(c, s) c:circle(0, 0, 1, "#fff") c:rotate(0.5) c:circle(5, 0, 1, "#fff") c:reset() c:circle(9, 0, 1, "#fff") end');
    assert.deepEqual(out.ops.map(op => op.rot), [0, 0.5, 0]);
});

test('coordinates and sizes are clamped to the canvas', () => {
    const ctx = load();
    const out = run(ctx, 'function draw(c, s) c:circle(9999, -9999, 9999, "#fff") c:line(0, 0, 1, 1, 9999, "#fff") end');
    assert.equal(out.ops[0].x, 240);
    assert.equal(out.ops[0].y, -240);
    assert.equal(out.ops[0].r, 240);
    assert.equal(out.ops[1].w, 64);
});

test('the script reads live state and settings', () => {
    const ctx = load();
    const src = `params = { size = { type = "number", min = 2, max = 40, default = 6 } }
function draw(c, s) c:circle(0, 0, s.spreadPx + param.size, "#ffffff") end`;
    const out = run(ctx, src, { size: 10 });
    assert.equal(out.ops[0].r, 22, 'spreadPx 12 plus the size setting 10');
    assert.equal(run(ctx, src, { size: 999 }, { ...STATE, spreadPx: 0 }).ops[0].r, 40, 'settings are clamped to their range');
});

test('the live state carries the camera kick in radians and pixels, with or without a gun', () => {
    const ctx = load();
    // A player with no gun in hand: the recoil must still reach the script, because it is the camera kick.
    const player = { camera: { fov: 72 }, velocity: { x: 0, y: 0, z: 0 }, timeSinceGrounded: 0, gunRecoilPitch: 0, getSelectedItem: () => null };
    const drawn = [];
    // Records every canvas call, so the test sees where the crosshair was drawn.
    const canvas2d = new Proxy({}, {
        get: (target, prop) => {
            if (!(prop in target)) target[prop] = (...args) => drawn.push([prop, ...args]);
            return target[prop];
        },
        set: (target, prop, value) => { target[prop] = value; return true; },
    });
    let nextFrame = null;
    Object.assign(ctx, {
        game: { player }, innerWidth: 1000, innerHeight: 800,
        localStorage: { getItem: () => null, setItem() {} },
        requestAnimationFrame: cb => { nextFrame = cb; return 1; },
        cancelAnimationFrame() {},
        document: {
            body: { classList: { toggle() {} }, appendChild(el) { el.isConnected = true; } },
            createElement: () => ({ isConnected: false, setAttribute() {}, getContext: () => canvas2d }),
        },
    });
    const src = `function draw(c, s)
  c:circle(0, -s.recoilPx, 1, "#ffffff")
  c:text(0, 0, string.format("%.4f", s.recoil), 12, "#ffffff")
end`;
    ctx.CrosshairLua.apply({ name: 'Kick', author: '', src, values: {} }, true);
    const frame = () => {
        drawn.length = 0;
        nextFrame(1000);
        return { y: drawn.find(d => d[0] === 'arc')[2], radians: drawn.find(d => d[0] === 'fillText')[1] };
    };
    // The same conversion the engine uses for spreadPx: an angle at the camera's FOV, as a distance on a 800 px high screen.
    const pixels = radians => Math.tan(radians) / Math.tan(72 * Math.PI / 360) * 800 / 2;

    player.gunRecoilPitch = 0.02;
    const kicked = frame();
    assert.ok(Math.abs(kicked.y + pixels(0.02)) < 1e-9, `the crosshair is drawn up by the kick in pixels (y ${kicked.y.toFixed(3)})`);
    assert.equal(kicked.radians, '0.0200', 'the script reads the same kick in radians');

    player.gunRecoilPitch = 0.005;
    assert.ok(Math.abs(frame().y + pixels(0.005)) < 1e-9, 'the crosshair settles back as the kick recovers');

    player.gunRecoilPitch = 0;
    const settled = frame();
    assert.equal(Math.abs(settled.y), 0, 'the crosshair is back on the centre once the kick has recovered');
    assert.equal(settled.radians, '0.0000');
});

test('invalid calls fail with a message that names the problem', () => {
    const ctx = load();
    assert.throws(() => run(ctx, 'function draw(c, s) c:circle(0, 0, 2, "red") end'), /invalid colour "red"/);
    assert.throws(() => run(ctx, 'function draw(c, s) c:circle(0, 0, 2, "#ffff") end'), /invalid colour/);
    assert.throws(() => run(ctx, 'function draw(c, s) c:line("a", 0, 0, 0, 1, "#fff") end'), /number expected/);
    assert.throws(() => run(ctx, 'function draw(c, s) c:circle(0/0, 0, 2, "#fff") end'), /finite number/);
    assert.throws(() => run(ctx, 'function draw(c, s) c:poly({0, 0, 1}, "#fff") end'), /needs 3 to 32 points/);
    assert.throws(() => run(ctx, 'function draw(c, s) c:poly({0, 0, "x", 1, 2, 2}, "#fff") end'), /points must be numbers/);
});

test('too many draw calls in one frame are refused', () => {
    const ctx = load();
    assert.throws(() => run(ctx, 'function draw(c, s) for i = 1, 500 do c:circle(0, 0, 1, "#fff") end end'), /too many draw calls/);
});

test('scripts without draw() and syntax errors are reported with line numbers', () => {
    const ctx = load();
    assert.throws(() => run(ctx, 'x = 1'), /define function draw\(c, s\)/);
    assert.throws(() => run(ctx, 'function draw(c, s)\n  c:circle(0, 0, 2, "#fff"\nend'), /:3: .*expected/);
    assert.throws(() => run(ctx, 'function draw(c, s)\n  local t = nil\n  return t.x\nend'), /:3: .*index a nil value/);
});

test('scripts larger than 16 KB are refused', () => {
    const ctx = load();
    assert.throws(() => run(ctx, '-- ' + 'a'.repeat(16 * 1024) + '\nfunction draw(c, s) end'), /larger than 16 KB/);
});

test('settings are parsed, sorted and checked', () => {
    const ctx = load();
    const C = ctx.CrosshairLua;
    const params = plain(C.parseSchema('size\tnumber\tArm\t2\t40\t6\t1\nfill\tcolor\tColour\t\t\t#abc\t2\nrounded\tbool\tRounded\t\t\ttrue\t3'));
    assert.deepEqual(params.map(p => p.key), ['size', 'fill', 'rounded'], 'sorted by order');
    assert.deepEqual([params[0].min, params[0].max, params[0].default], [2, 40, 6]);
    assert.equal(params[1].default, '#aabbcc', '#rgb defaults are expanded');
    assert.equal(params[2].default, true);
    assert.equal(C.paramValue(params[0], 99), 40, 'numbers are clamped');
    assert.equal(C.paramValue(params[0], 'x'), 6, 'bad numbers fall back to the default');
    assert.equal(C.paramValue(params[1], 'nope'), '#aabbcc', 'bad colours fall back to the default');
    assert.equal(C.paramValue(params[2], 'yes'), true, 'bad booleans fall back to the default');
    assert.throws(() => C.parseSchema('x\ttext\tX\t\t\t\t'), /type must be/);
    assert.throws(() => C.parseSchema('1bad\tnumber\tX\t\t\t\t'), /not a valid name/);
    const many = Array.from({ length: 17 }, (_, i) => `p${i}\tnumber\tP\t0\t1\t0\t${i}`).join('\n');
    assert.throws(() => C.parseSchema(many), /at most 16 settings/);
});

test('every example compiles and draws in an idle and in a scoped, hitting state', () => {
    const ctx = load();
    const idle = STATE;
    const scoped = { ...STATE, scoped: true, targetLocked: true, hitMarker: true, spreadPx: 45, recoil: 0.05, recoilPx: 30, hasGun: true, gun: 'awp' };
    const none = { ...STATE, hasGun: false, gun: '', spreadPx: 0, recoil: 0, recoilPx: 0 };
    for (const example of ctx.CROSSHAIR_EXAMPLES) {
        const engine = ctx.CrosshairLua.createEngine(ctx.fengari);
        engine.load(example.src);
        for (const state of [idle, scoped, none]) {
            const ops = engine.frame(state, {});
            assert.ok(ops.length >= 1, `${example.id} draws something`);
        }
    }
});

test('the generated examples bundle matches crosshairs/examples on disk', () => {
    const ctx = load();
    const dir = path.join(ROOT, 'crosshairs', 'examples');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.lua')).sort();
    assert.equal(ctx.CROSSHAIR_EXAMPLES.length, files.length);
    for (const ex of ctx.CROSSHAIR_EXAMPLES) {
        const text = fs.readFileSync(path.join(dir, `${ex.id}.lua`), 'utf8');
        assert.equal(ex.src, text, `${ex.id} is in sync (run python3 tools/build_crosshair_examples.py)`);
        assert.match(text, /^-- @name /m, `${ex.id} has a name header`);
    }
});

test('share codes round-trip any text and keep only valid settings', () => {
    const ctx = load();
    const C = ctx.CrosshairLua;
    const entry = { name: 'Прицел 🎯', author: 'Eblankraft', src: 'function draw(c, s) end -- сделано', values: { size: 4, col: '#fff', on: true, 'bad key!': 1 } };
    const decoded = C.decodeShare(C.encodeShare(entry));
    assert.equal(decoded.name, 'Прицел 🎯');
    assert.equal(decoded.src, entry.src);
    assert.deepEqual(plain(decoded.values), { size: 4, col: '#fff', on: true }, 'invalid setting names are dropped');
    assert.throws(() => C.decodeShare('hello'), /EBCHL1/);
    assert.throws(() => C.decodeShare('EBCHL1.A'), /damaged/);
    assert.throws(() => C.decodeShare(`EBCHL1.${Buffer.from('[1,2]').toString('base64')}`), /does not hold a crosshair script/);
    assert.throws(() => C.decodeShare(`EBCHL1.${Buffer.from('not json').toString('base64')}`), /damaged/);
    assert.throws(() => C.decodeShare('EBCHL1.' + 'A'.repeat(70000)), /too long/);
});

test('.lua files keep their name and author through export and import', () => {
    const ctx = load();
    const C = ctx.CrosshairLua;
    const text = C.exportFile({ name: 'Hit X', author: 'Ann', src: 'function draw(c, s) end' });
    const back = plain(C.parseFile(text));
    assert.equal(back.name, 'Hit X');
    assert.equal(back.author, 'Ann');
    assert.equal(run(ctx, back.src).ops.length, 0, 'the imported file still compiles');
    assert.equal(plain(C.parseFile('function draw(c, s) end', 'Fallback')).name, 'Fallback');
});

test('applying a script runs it; a broken one keeps the working crosshair and the text for fixing', () => {
    const ctx = load();
    const C = ctx.CrosshairLua;
    const good = { name: 'Good', author: '', src: 'function draw(c, s) c:circle(0, 0, 2, "#fff") end', values: {} };
    assert.equal(C.apply(good, true).ok, true);
    assert.equal(C.running, true);
    const bad = { name: 'Broken', author: '', src: 'function draw(c, s) c:circle(0, 0, 2, "red") end', values: {} };
    const result = C.apply(bad, true);
    assert.equal(result.ok, false);
    assert.match(result.error, /invalid colour/);
    assert.equal(C.running, true, 'the working crosshair keeps running');
    assert.equal(C.entry.src, bad.src, 'the broken text stays in the editor');
    C.setEnabled(false);
    assert.equal(C.running, false);
});

test('restore starts from the first example when nothing is saved', () => {
    const ctx = load();
    const entry = ctx.CrosshairLua.restore();
    assert.equal(entry.name, 'Classic plus');
    assert.equal(entry.enabled, false);
    assert.equal(ctx.CrosshairLua.params.length, 5);
});

test('a new script uses its own defaults, not the values of the script before it', () => {
    const ctx = load();
    const C = ctx.CrosshairLua;
    const classicSrc = ctx.CROSSHAIR_EXAMPLES.find(e => e.id === 'classic').src;
    C.apply({ name: 'Classic', author: '', src: classicSrc, values: {} }, false);
    C.setValue('color', '#ff0000');
    C.setValue('size', 9);
    const userSrc = `params = {
  size    = { label = "Arm length", type = "number", min = 1, max = 20, default = 2, order = 1 },
  color   = { label = "Colour", type = "color", default = "#00ffff", order = 2 },
  outCol  = { label = "Outline colour", type = "color", default = "#000000", order = 3 },
}
function draw(c, s) c:circle(0, 0, param.size, param.color) end`;
    const result = C.apply({ name: 'Mine', author: '', src: userSrc, values: {} }, false);
    assert.equal(result.ok, true);
    assert.equal(C.entry.values.size, 2, 'the default of the new script, not 9 from the old one');
    assert.equal(C.entry.values.color, '#00ffff', 'the new colour default, not red from the old script');
    assert.equal(C.entry.values.outCol, '#000000');
});

test('settings the player changed carry over when the new script has the same setting', () => {
    const ctx = load();
    const C = ctx.CrosshairLua;
    const a = 'params = { size = { type = "number", min = 1, max = 20, default = 2 } }\nfunction draw(c, s) c:circle(0, 0, param.size, "#fff") end';
    const sameRange = 'params = { size = { type = "number", min = 1, max = 20, default = 2 } }\nfunction draw(c, s) c:circle(0, 0, param.size, "#fff") end';
    const otherRange = 'params = { size = { type = "number", min = 1, max = 40, default = 5 } }\nfunction draw(c, s) c:circle(0, 0, param.size, "#fff") end';
    C.apply({ name: 'A', author: '', src: a, values: {} }, false);
    C.setValue('size', 7);
    C.apply({ name: 'B', author: '', src: sameRange, values: {} }, false);
    assert.equal(C.entry.values.size, 7, 'same type, range and default: the tweak stays');
    C.apply({ name: 'C', author: '', src: otherRange, values: {} }, false);
    assert.equal(C.entry.values.size, 5, 'a different range starts from the new default');
    C.setValue('size', 3);
    C.apply({ name: 'D', author: '', src: a.replace('default = 2', 'default = 4'), values: {} }, false);
    assert.equal(C.entry.values.size, 4, 'a changed default is the new script\'s default, not the old tweak');
});

test('values that come with a share code are used as they are', () => {
    const ctx = load();
    const C = ctx.CrosshairLua;
    const src = 'params = { size = { type = "number", min = 1, max = 20, default = 2 } }\nfunction draw(c, s) c:circle(0, 0, param.size, "#fff") end';
    C.apply({ name: 'Shared', author: '', src, values: { size: 9 } }, false);
    assert.equal(C.entry.values.size, 9);
});

test('a pasted -- @name line is what the editor applies under', () => {
    const ctx = load();
    const C = ctx.CrosshairLua;
    C.apply({ name: 'Before', author: '', src: 'function draw(c, s) end', values: {} }, false);
    assert.equal(C.entry.name, 'Before');
});

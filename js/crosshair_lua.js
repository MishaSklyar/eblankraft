// Lua crosshairs. A sandboxed Lua script draws the crosshair every frame through a small canvas API
// (c:line, c:circle, c:text, ...) and reads live gun state from a read-only table (s.spreadPx, s.scoped, ...).
// Lua runs in fengari, the engine the Lua mods use, in its own VM with a reduced standard library, a step
// limit per frame and a draw-call limit. A script can only draw: it cannot reach the page or the game.
// Reference for people and AI agents: docs/crosshair-lua.md
(function (global) {
    'use strict';

    const LIMITS = {
        sourceBytes: 16 * 1024,   // size of one script
        opsPerFrame: 400,         // draw calls per frame
        stepsPerFrame: 300000,    // approximate Lua instructions per draw() call
        pointsPerShape: 32,       // points in c:outline / c:poly
        textChars: 48,            // characters per c:text
        maxWidth: 64,             // line and ring thickness, px
        params: 16,               // settings a script can declare
        canvasSize: 480,          // px square, centred on the screen
        coord: 240,               // draw coordinates are clamped to +-coord px from the centre
        shareChars: 64 * 1024,    // longest share code accepted on import
    };
    const HOOK_EVERY = 1000;      // the step counter fires every this many Lua instructions
    const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    const KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/;
    const CODE_PREFIX = 'EBCHL1.';
    const STORAGE_KEY = 'eblankraft_crosshair_lua';
    const PARAM_TYPES = ['number', 'color', 'bool'];

    // Reads a declared `params` table into lines of "key<TAB>type<TAB>label<TAB>min<TAB>max<TAB>default<TAB>order".
    const SCHEMA_LUA = `local out = {}
if type(params) == 'table' then
  for k, v in pairs(params) do
    if type(k) == 'string' and type(v) == 'table' then
      local label = tostring(v.label or k):gsub('[\\t\\n]', ' ')
      out[#out + 1] = table.concat({k, tostring(v.type or 'number'), label, tostring(v.min or ''),
        tostring(v.max or ''), tostring(v.default or ''), tostring(v.order or '')}, '\\t')
    end
  end
end
return table.concat(out, '\\n')`;

    class CrosshairLuaError extends Error {
        constructor(message) { super(message); this.name = 'CrosshairLuaError'; }
    }
    const fail = message => { throw new CrosshairLuaError(message); };
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

    function cssColor(text) {
        const m = COLOR_RE.exec(typeof text === 'string' ? text : '');
        if (!m) fail(`invalid colour "${text}": use #rgb, #rrggbb or #rrggbbaa`);
        let hex = m[1];
        if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    }

    function normalizeColor(text) {
        return COLOR_RE.test(text) ? (text.length === 4 ? '#' + text.slice(1).split('').map(ch => ch + ch).join('') : text).toLowerCase() : null;
    }

    // Turns the schema lines into a validated list of settings. Errors name the setting, so scripts are easy to fix.
    function parseSchema(text) {
        const params = [];
        for (const line of String(text || '').split('\n')) {
            if (!line) continue;
            const [key, type, label, min, max, def, order] = line.split('\t');
            if (!KEY_RE.test(key)) fail(`params: "${key}" is not a valid name (letters, digits and _, starting with a letter)`);
            if (!PARAM_TYPES.includes(type)) fail(`params.${key}: type must be "number", "color" or "bool"`);
            const p = { key, type, label: label || key, order: Number(order) || 1000 };
            if (type === 'number') {
                p.min = min === '' ? 0 : Number(min);
                p.max = max === '' ? 100 : Number(max);
                if (!Number.isFinite(p.min) || !Number.isFinite(p.max) || p.max < p.min) fail(`params.${key}: min and max must be numbers with min <= max`);
                const d = def === '' ? p.min : Number(def);
                p.default = Number.isFinite(d) ? clamp(d, p.min, p.max) : p.min;
            } else if (type === 'color') {
                p.default = normalizeColor(def || '#ffffff');
                if (!p.default) fail(`params.${key}: default must be a colour such as "#ffffff"`);
            } else {
                p.default = def === 'true';
            }
            params.push(p);
        }
        if (params.length > LIMITS.params) fail(`at most ${LIMITS.params} settings (params) per script`);
        return params.sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : 1));
    }

    // A value from the UI or a share code, forced into the setting's type and range.
    function paramValue(p, raw) {
        if (p.type === 'number') {
            const n = Number(raw);
            return Number.isFinite(n) && raw !== '' && raw !== null ? clamp(n, p.min, p.max) : p.default;
        }
        if (p.type === 'color') return typeof raw === 'string' && normalizeColor(raw) ? normalizeColor(raw) : p.default;
        return typeof raw === 'boolean' ? raw : p.default;
    }

    const utf8Length = text => encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, 'x').length;

    // One Lua VM with one script loaded. Create a new one for every script version.
    class LuaCrosshair {
        constructor(fengari) {
            if (!fengari || !fengari.lua) fail('the Lua engine (fengari) is not loaded');
            const { lua, lauxlib, lualib, to_luastring } = fengari;
            this.fe = fengari;
            this.L = lauxlib.luaL_newstate();
            const L = this.L;
            // Only the parts of the standard library a crosshair needs. No os, io, debug, package, require or load.
            for (const [name, open] of [['_G', lualib.luaopen_base], ['math', lualib.luaopen_math],
                ['table', lualib.luaopen_table], ['string', lualib.luaopen_string]]) {
                lauxlib.luaL_requiref(L, to_luastring(name), open, 1);
                lua.lua_pop(L, 1);
            }
            for (const name of ['dofile', 'loadfile', 'load', 'print', 'collectgarbage']) {
                lua.lua_pushnil(L);
                lua.lua_setglobal(L, to_luastring(name));
            }
            // string.rep can allocate gigabytes in one call, which the step counter cannot see.
            lua.lua_getglobal(L, to_luastring('string'));
            lua.lua_pushnil(L);
            lua.lua_setfield(L, -2, to_luastring('rep'));
            lua.lua_pop(L, 1);
            this.steps = 0;
            this.ops = [];
            this.rot = 0;
            this.params = [];
            this.hasDraw = false;
            // Stops loops that never end: the hook raises a Lua error once the step budget for this frame is spent.
            lua.lua_sethook(L, () => {
                this.steps++;
                if (this.steps > LIMITS.stepsPerFrame / HOOK_EVERY) {
                    lauxlib.luaL_error(L, to_luastring('the crosshair ran too long in one frame (a loop that never ends?)'));
                }
            }, lua.LUA_MASKCOUNT, HOOK_EVERY);
        }

        takeError() {
            const { lua, to_jsstring } = this.fe, L = this.L;
            const bytes = lua.lua_tostring(L, -1);
            const message = bytes ? to_jsstring(bytes) : 'unknown Lua error';
            lua.lua_settop(L, 0);
            return message;
        }

        // Compiles and runs the script once (top level only), checks for draw(), and reads its params table.
        load(source) {
            const { lua, lauxlib, to_luastring } = this.fe, L = this.L;
            if (typeof source !== 'string') fail('the script must be text');
            if (utf8Length(source) > LIMITS.sourceBytes) fail(`the script is larger than ${LIMITS.sourceBytes / 1024} KB`);
            this.steps = 0;
            const bytes = to_luastring(source);
            let status = lauxlib.luaL_loadbufferx(L, bytes, bytes.length, to_luastring('crosshair'), null);
            if (status !== lua.LUA_OK) fail(this.takeError());
            status = lua.lua_pcall(L, 0, 0, 0);
            if (status !== lua.LUA_OK) fail(this.takeError());
            lua.lua_getglobal(L, to_luastring('draw'));
            this.hasDraw = lua.lua_type(L, -1) === lua.LUA_TFUNCTION;
            lua.lua_settop(L, 0);
            if (!this.hasDraw) fail('define function draw(c, s): it runs every frame and draws the crosshair');
            this.params = this.readParams();
            return this.params;
        }

        readParams() {
            const { lua, lauxlib, to_luastring, to_jsstring } = this.fe, L = this.L;
            const bytes = to_luastring(SCHEMA_LUA);
            let status = lauxlib.luaL_loadbufferx(L, bytes, bytes.length, to_luastring('crosshair params'), null);
            if (status === lua.LUA_OK) status = lua.lua_pcall(L, 0, 1, 0);
            if (status !== lua.LUA_OK) fail(this.takeError());
            const text = to_jsstring(lua.lua_tostring(L, -1) || new Uint8Array());
            lua.lua_settop(L, 0);
            return parseSchema(text);
        }

        // Runs draw(c, s) for one frame and returns the recorded draw calls.
        frame(state, values = {}) {
            const { lua, to_luastring } = this.fe, L = this.L;
            this.ops = [];
            this.rot = 0;
            this.steps = 0;
            lua.lua_newtable(L);
            for (const p of this.params) {
                this.pushRaw(paramValue(p, values[p.key]));
                lua.lua_setfield(L, -2, to_luastring(p.key));
            }
            lua.lua_setglobal(L, to_luastring('param'));
            lua.lua_getglobal(L, to_luastring('draw'));
            this.pushCanvas();
            lua.lua_newtable(L);
            for (const key of Object.keys(state || {})) {
                this.pushRaw(state[key]);
                lua.lua_setfield(L, -2, to_luastring(key));
            }
            const status = lua.lua_pcall(L, 2, 0, 0);
            if (status !== lua.LUA_OK) fail(this.takeError());
            return this.ops;
        }

        pushRaw(value) {
            const { lua, to_luastring } = this.fe, L = this.L;
            if (typeof value === 'boolean') lua.lua_pushboolean(L, value);
            else if (typeof value === 'number') lua.lua_pushnumber(L, Number.isFinite(value) ? value : 0);
            else lua.lua_pushstring(L, to_luastring(String(value ?? '')));
        }

        // The canvas object c. Methods are rebuilt each frame so a script cannot keep a stale one between frames.
        pushCanvas() {
            const { lua, to_luastring } = this.fe, L = this.L;
            lua.lua_newtable(L);
            const method = (name, fn) => {
                lua.lua_pushjsfunction(L, () => this.guard(fn));
                lua.lua_setfield(L, -2, to_luastring(name));
            };
            method('line', () => this.opLine());
            method('rect', () => this.opRect());
            method('frame', () => this.opFrame());
            method('circle', () => this.opCircle());
            method('ring', () => this.opRing());
            method('poly', () => this.opPoly());
            method('outline', () => this.opOutline());
            method('text', () => this.opText());
            method('rotate', () => { this.rot = this.number(this.argBase(), 'angle'); });
            method('reset', () => { this.rot = 0; });
        }

        // Errors raised by the canvas become Lua errors, so the script sees them with its own line numbers.
        guard(fn) {
            const { lauxlib, to_luastring } = this.fe, L = this.L;
            try {
                fn();
                return 0;
            } catch (e) {
                if (e instanceof CrosshairLuaError) lauxlib.luaL_error(L, to_luastring(e.message));
                throw e;
            }
        }

        // Method calls pass the canvas first (c:line(...)); plain calls (c.line(...)) do not.
        argBase() { return this.fe.lua.lua_type(this.L, 1) === this.fe.lua.LUA_TTABLE ? 2 : 1; }

        number(i, name) {
            const { lauxlib, to_luastring } = this.fe, L = this.L;
            const n = lauxlib.luaL_checknumber(L, i);
            if (!Number.isFinite(n)) lauxlib.luaL_argerror(L, i, to_luastring(`${name} must be a finite number`));
            return n;
        }

        optNumber(i, def) {
            const { lua } = this.fe;
            return lua.lua_type(this.L, i) <= 0 ? def : this.number(i, 'value');
        }

        readText(i) {
            const { lauxlib, to_jsstring } = this.fe;
            return to_jsstring(lauxlib.luaL_checkstring(this.L, i));
        }

        coord(i, name) { return clamp(this.number(i, name), -LIMITS.coord, LIMITS.coord); }

        emit(op) {
            if (this.ops.length >= LIMITS.opsPerFrame) fail(`too many draw calls in one frame (the limit is ${LIMITS.opsPerFrame})`);
            op.rot = this.rot;
            this.ops.push(op);
        }

        opLine() {
            const b = this.argBase();
            const op = { t: 'line', x1: this.coord(b, 'x1'), y1: this.coord(b + 1, 'y1'), x2: this.coord(b + 2, 'x2'), y2: this.coord(b + 3, 'y2') };
            op.w = clamp(this.optNumber(b + 4, 1), 0, LIMITS.maxWidth);
            op.color = cssColor(this.readText(b + 5));
            this.emit(op);
        }

        opRect() {
            const b = this.argBase();
            const op = { t: 'rect', x: this.coord(b, 'x'), y: this.coord(b + 1, 'y') };
            op.w = clamp(this.number(b + 2, 'w'), 0, 2 * LIMITS.coord);
            op.h = clamp(this.number(b + 3, 'h'), 0, 2 * LIMITS.coord);
            op.color = cssColor(this.readText(b + 4));
            this.emit(op);
        }

        opFrame() {
            const b = this.argBase();
            const op = { t: 'frame', x: this.coord(b, 'x'), y: this.coord(b + 1, 'y') };
            op.w = clamp(this.number(b + 2, 'w'), 0, 2 * LIMITS.coord);
            op.h = clamp(this.number(b + 3, 'h'), 0, 2 * LIMITS.coord);
            op.thick = clamp(this.number(b + 4, 'thickness'), 0, LIMITS.maxWidth);
            op.color = cssColor(this.readText(b + 5));
            this.emit(op);
        }

        opCircle() {
            const b = this.argBase();
            const op = { t: 'circle', x: this.coord(b, 'x'), y: this.coord(b + 1, 'y') };
            op.r = clamp(this.number(b + 2, 'radius'), 0, LIMITS.coord);
            op.color = cssColor(this.readText(b + 3));
            this.emit(op);
        }

        opRing() {
            const b = this.argBase();
            const op = { t: 'ring', x: this.coord(b, 'x'), y: this.coord(b + 1, 'y') };
            op.r = clamp(this.number(b + 2, 'radius'), 0, LIMITS.coord);
            op.w = clamp(this.number(b + 3, 'thickness'), 0, LIMITS.maxWidth);
            op.color = cssColor(this.readText(b + 4));
            this.emit(op);
        }

        // Reads {x1, y1, x2, y2, ...} from a Lua table at stack index i.
        points(i) {
            const { lua } = this.fe, L = this.L;
            if (lua.lua_type(L, i) !== lua.LUA_TTABLE) fail('expected a list of points: {x1, y1, x2, y2, ...}');
            const n = lua.lua_rawlen(L, i);
            if (n < 6 || n % 2 !== 0 || n > LIMITS.pointsPerShape * 2) {
                fail(`a shape needs 3 to ${LIMITS.pointsPerShape} points as {x1, y1, x2, y2, ...}`);
            }
            const out = [];
            for (let k = 1; k <= n; k++) {
                lua.lua_rawgeti(L, i, k);
                const v = lua.lua_isnumber(L, -1) ? lua.lua_tonumber(L, -1) : NaN;
                lua.lua_pop(L, 1);
                if (!Number.isFinite(v)) fail('points must be numbers');
                out.push(clamp(v, -LIMITS.coord, LIMITS.coord));
            }
            return out;
        }

        opPoly() {
            const b = this.argBase();
            const op = { t: 'poly', pts: this.points(b) };
            op.color = cssColor(this.readText(b + 1));
            this.emit(op);
        }

        opOutline() {
            const b = this.argBase();
            const op = { t: 'outline', pts: this.points(b) };
            op.w = clamp(this.number(b + 1, 'width'), 0, LIMITS.maxWidth);
            op.color = cssColor(this.readText(b + 2));
            this.emit(op);
        }

        opText() {
            const b = this.argBase();
            const op = { t: 'text', x: this.coord(b, 'x'), y: this.coord(b + 1, 'y') };
            op.text = this.readText(b + 2).slice(0, LIMITS.textChars);
            op.size = clamp(this.optNumber(b + 3, 12), 4, 96);
            op.color = cssColor(this.readText(b + 4));
            this.emit(op);
        }
    }

    // Starts a VM for one script version. Throws CrosshairLuaError with a readable message on any problem.
    function createEngine(fengari) {
        return new LuaCrosshair(fengari);
    }

    // Share codes: "EBCHL1." + base64url(UTF-8 JSON). Names and sources can contain any text.
    function encodeShare(entry) {
        const json = JSON.stringify({ v: 1, name: entry.name || '', author: entry.author || '', src: entry.src || '', values: entry.values || {} });
        const b64 = global.btoa(unescape(encodeURIComponent(json)));
        return CODE_PREFIX + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function decodeShare(code) {
        if (typeof code !== 'string') fail('paste a share code that starts with EBCHL1.');
        const text = code.trim();
        if (!text.startsWith(CODE_PREFIX)) fail('that is not a Lua crosshair code (it should start with EBCHL1.)');
        if (text.length > LIMITS.shareChars) fail('that code is too long');
        let b64 = text.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
        if (b64.length % 4 === 1) fail('that code is damaged');
        while (b64.length % 4) b64 += '=';
        let data;
        try {
            data = JSON.parse(decodeURIComponent(escape(global.atob(b64))));
        } catch (e) {
            fail('that code is damaged');
        }
        if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.src !== 'string') fail('that code does not hold a crosshair script');
        return sanitizeEntry(data);
    }

    function sanitizeEntry(data) {
        const values = {};
        if (data.values && typeof data.values === 'object' && !Array.isArray(data.values)) {
            for (const [k, v] of Object.entries(data.values)) {
                if (KEY_RE.test(k) && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) values[k] = v;
            }
        }
        return {
            name: String(data.name || 'My crosshair').slice(0, 40),
            author: String(data.author || '').slice(0, 40),
            src: String(data.src || '').slice(0, LIMITS.sourceBytes * 2),
            values,
        };
    }

    // .lua files carry their name and author in the first comment lines, so they stay readable and importable.
    function exportFile(entry) {
        return `-- @name ${entry.name || 'My crosshair'}\n-- @author ${entry.author || ''}\n`
            + `-- Lua crosshair for Eblankraft. Docs: docs/crosshair-lua.md\n\n${entry.src || ''}`;
    }

    function parseFile(text, fallbackName = 'Imported crosshair') {
        const lines = String(text || '').split('\n');
        let name = '', author = '';
        for (const line of lines.slice(0, 8)) {
            const n = /^--\s*@name\s+(.*)$/.exec(line.trim());
            const a = /^--\s*@author\s+(.*)$/.exec(line.trim());
            if (n) name = n[1].trim();
            if (a) author = a[1].trim();
        }
        return sanitizeEntry({ name: name || fallbackName, author, src: String(text || '') });
    }

    // ---- Browser runtime: canvas, live state, saved script ----

    const runtime = {
        entry: null,          // { name, author, src, values, enabled } as saved
        engine: null,         // the working LuaCrosshair, or null
        params: [],
        error: '',
        raf: 0,
        startedAt: 0,
        canvas: null,
        ctx: null,
        dpr: 1,
        listeners: new Set(),
    };
    const store = () => { try { return global.localStorage || null; } catch (e) { return null; } };

    function readSaved() {
        try {
            const raw = store() ? store().getItem(STORAGE_KEY) : null;
            if (!raw) return null;
            const data = JSON.parse(raw);
            return { ...sanitizeEntry(data), enabled: data.enabled === true };
        } catch (e) {
            return null;
        }
    }

    function writeSaved() {
        try { if (store() && runtime.entry) store().setItem(STORAGE_KEY, JSON.stringify({ ...runtime.entry, enabled: !!runtime.enabled })); } catch (e) { /* storage blocked */ }
    }

    function notify() { for (const fn of runtime.listeners) fn(); }
    function onChange(fn) { runtime.listeners.add(fn); return () => runtime.listeners.delete(fn); }

    function defaultEntry() {
        const examples = global.CROSSHAIR_EXAMPLES || [];
        const first = examples.find(e => e.id === 'classic') || examples[0];
        return { name: first ? first.name : 'My crosshair', author: first ? first.author : '', src: first ? first.src : 'function draw(c, s)\n  c:circle(0, 0, 2, "#ffffff")\nend\n', values: {}, enabled: false };
    }

    // The state table with every field present and idle values. Scripts see the same fields in every frame.
    function blankState(time = 0, W = 1280, H = 720) {
        return {
            time, width: W, height: H, fov: 72,
            hasGun: false, gun: '', ammo: 0, reloading: false, spread: 0, spreadPx: 0, bloom: 0,
            moving: false, speed: 0, airborne: false, aiming: false, scoped: false,
            targetLocked: false, blockTarget: false, hitMarker: false, hitType: '',
            health: 0, maxHealth: 100, dead: false, menuOpen: false,
        };
    }

    // Runs draw() once with and once without a gun, so runtime errors show up when the script is applied.
    function probe(engine, values) {
        const base = blankState(0);
        engine.frame({ ...base, hasGun: true, gun: 'ak47', spreadPx: 12, spread: 0.02, moving: true, speed: 4.5 }, values);
        engine.frame({ ...base, hasGun: false, gun: '' }, values);
    }

    function collectState(now) {
        const game = global.game, p = game && game.player, ui = game && game.ui;
        const W = global.innerWidth || 1280, H = global.innerHeight || 720;
        const state = blankState((now - runtime.startedAt) / 1000, W, H);
        if (!p) return state;
        state.fov = (p.camera && p.camera.fov) || 72;
        state.speed = Math.hypot(p.velocity.x, p.velocity.z);
        state.moving = state.speed > 0.3;
        state.airborne = (p.timeSinceGrounded || 0) > (global.ACCURACY ? global.ACCURACY.airGrace : 0.15);
        state.aiming = !!p.isAiming;
        state.scoped = !!p.isScoped;
        state.targetLocked = !!p.isTargetLocked;
        state.blockTarget = !!p.targetBlock;
        state.health = p.health || 0;
        state.maxHealth = p.maxHealth || 100;
        state.dead = !!p.isDead;
        state.menuOpen = !!(ui && (ui.menuOpen || ui.mainMenuOpen || ui.inventoryOpen));
        state.hitMarker = now < (p.gunHitUntil || 0);
        state.hitType = state.hitMarker ? String(p.gunHitType || '') : '';
        const item = p.getSelectedItem ? p.getSelectedItem() : null;
        const reg = item && global.ITEM_REGISTRY ? global.ITEM_REGISTRY[item.itemId] : null;
        const arena = !!(game.arenaClient && game.arenaClient.isActive);
        if (reg && reg.isGun && !arena) {
            state.hasGun = true;
            state.gun = reg.gunType || '';
            state.ammo = item.gunAmmo || 0;
            state.reloading = !!p.gunReload;
            state.bloom = global.ACCURACY ? (p.gunBloom || 0) / global.ACCURACY.bloomCap : 0;
            state.spread = p.gunSpreadFor(reg, p.getGunSpec(reg), p.gunBloom || 0);
            const tanHalf = Math.tan(state.fov * Math.PI / 360);
            state.spreadPx = Math.min(2000, Math.tan(state.spread) / tanHalf * H / 2);
        }
        return state;
    }

    function ensureCanvas() {
        const doc = global.document;
        if (!doc) return false;
        if (runtime.canvas && runtime.canvas.isConnected) return true;
        const canvas = doc.createElement('canvas');
        canvas.id = 'crosshair-lua';
        canvas.setAttribute('aria-hidden', 'true');
        runtime.dpr = Math.min(2, global.devicePixelRatio || 1);
        canvas.width = LIMITS.canvasSize * runtime.dpr;
        canvas.height = LIMITS.canvasSize * runtime.dpr;
        doc.body.appendChild(canvas);
        runtime.canvas = canvas;
        runtime.ctx = canvas.getContext('2d');
        return true;
    }

    // Draws the recorded calls. Coordinates are relative to the screen centre; y grows downwards.
    function render(ops) {
        const ctx = runtime.ctx, S = LIMITS.canvasSize, dpr = runtime.dpr;
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, S * dpr, S * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, S / 2 * dpr, S / 2 * dpr);
        ctx.lineCap = 'butt';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const op of ops) {
            ctx.save();
            if (op.rot) ctx.rotate(op.rot);
            ctx.strokeStyle = op.color || '#ffffff';
            ctx.fillStyle = op.color || '#ffffff';
            switch (op.t) {
                case 'line':
                    ctx.lineWidth = op.w;
                    ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
                    break;
                case 'rect': ctx.fillRect(op.x - op.w / 2, op.y - op.h / 2, op.w, op.h); break;
                case 'frame':
                    ctx.lineWidth = op.thick;
                    ctx.strokeRect(op.x - op.w / 2, op.y - op.h / 2, op.w, op.h);
                    break;
                case 'circle': ctx.beginPath(); ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2); ctx.fill(); break;
                case 'ring':
                    ctx.lineWidth = op.w;
                    ctx.beginPath(); ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2); ctx.stroke();
                    break;
                case 'poly':
                case 'outline': {
                    ctx.beginPath();
                    for (let i = 0; i < op.pts.length; i += 2) {
                        if (i === 0) ctx.moveTo(op.pts[i], op.pts[i + 1]); else ctx.lineTo(op.pts[i], op.pts[i + 1]);
                    }
                    ctx.closePath();
                    if (op.t === 'poly') ctx.fill(); else { ctx.lineWidth = op.w; ctx.stroke(); }
                    break;
                }
                case 'text':
                    ctx.font = `${op.size}px monospace`;
                    ctx.fillText(op.text, op.x, op.y);
                    break;
                default: break;
            }
            ctx.restore();
        }
    }

    function setBodyMode(on) {
        const body = global.document && global.document.body;
        if (body) body.classList.toggle('lua-crosshair', !!on);
    }

    function frame(now) {
        runtime.raf = global.requestAnimationFrame(frame);
        if (!runtime.engine) return;
        try {
            const ops = runtime.engine.frame(collectState(now), runtime.entry ? runtime.entry.values : {});
            if (ensureCanvas()) render(ops);
        } catch (e) {
            // A script that fails at run time is switched off, so the player is never left without a crosshair.
            runtime.error = e.message || String(e);
            runtime.engine = null;
            runtime.entry.enabled = false;
            writeSaved();
            stop();
            notify();
        }
    }

    function start() {
        if (!runtime.engine) return;
        if (!runtime.startedAt) runtime.startedAt = global.performance ? global.performance.now() : 0;
        if (!runtime.raf && global.requestAnimationFrame) runtime.raf = global.requestAnimationFrame(frame);
        ensureCanvas();
        setBodyMode(true);
    }

    function stop() {
        if (runtime.raf && global.cancelAnimationFrame) global.cancelAnimationFrame(runtime.raf);
        runtime.raf = 0;
        if (runtime.ctx && runtime.canvas) {
            runtime.ctx.setTransform(1, 0, 0, 1, 0, 0);
            runtime.ctx.clearRect(0, 0, runtime.canvas.width, runtime.canvas.height);
        }
        setBodyMode(false);
    }

    // Compiles a script. On success it replaces the running crosshair. On failure the running crosshair keeps
    // running, and the text is kept in the editor so it can be fixed.
    function apply(entry, enabled) {
        const next = sanitizeEntry(entry);
        const keepEnabled = typeof enabled === 'boolean' ? enabled : !!(runtime.entry && runtime.entry.enabled);
        try {
            const engine = createEngine(global.fengari);
            const params = engine.load(next.src);
            const values = {};
            for (const p of params) values[p.key] = paramValue(p, next.values[p.key]);
            probe(engine, values);
            runtime.entry = { ...next, values, enabled: keepEnabled };
            runtime.engine = engine;
            runtime.params = params;
            runtime.error = '';
            if (keepEnabled) start();
            writeSaved();
            notify();
            return { ok: true, params };
        } catch (e) {
            runtime.error = e.message || String(e);
            runtime.entry = { ...next, values: runtime.entry ? runtime.entry.values : {}, enabled: runtime.entry ? runtime.entry.enabled : false };
            notify();
            return { ok: false, error: runtime.error };
        }
    }

    function setEnabled(on) {
        if (!runtime.entry) return false;
        if (on && !runtime.engine) {
            if (!apply(runtime.entry, true).ok) return false;
        }
        runtime.entry.enabled = !!on;
        if (on) start(); else stop();
        writeSaved();
        notify();
        return true;
    }

    function setValue(key, value) {
        if (!runtime.entry) return;
        const p = runtime.params.find(x => x.key === key);
        if (!p) return;
        runtime.entry.values = { ...runtime.entry.values, [key]: paramValue(p, value) };
        writeSaved();
    }

    // Loads the saved script at startup. A saved crosshair that was switched on starts again.
    function restore() {
        const saved = readSaved() || defaultEntry();
        const wasOn = saved.enabled === true;
        apply(saved, false);
        if (wasOn) setEnabled(true);
        return runtime.entry;
    }

    // ---- Advanced tab: script editor, examples, settings from params, sharing ----

    const slug = text => (String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'crosshair');

    function mountAdvanced(root) {
        const doc = global.document;
        if (!root || !doc) return null;
        if (!runtime.entry) restore();
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
        const status = h('p', { class: 'menu-setting-note ch-status', text: '' });
        const say = (text, bad) => { status.textContent = text; status.style.color = bad ? '#ff8a8a' : ''; };
        const examples = global.CROSSHAIR_EXAMPLES || [];

        const enableBox = h('input', { type: 'checkbox', id: 'lua-enable', checked: !!(runtime.entry && runtime.entry.enabled),
            on: { change: e => {
                if (!setEnabled(e.target.checked)) { e.target.checked = false; say(`Not switched on: ${runtime.error}`, true); }
                else say(e.target.checked ? 'Lua crosshair is on.' : 'Back to the built-in crosshair.');
            } } });
        const exampleSelect = h('select', { class: 'ch-select', id: 'lua-example', 'aria-label': 'Example scripts' },
            ...examples.map(ex => h('option', { value: ex.id, text: ex.name })));
        const nameInput = h('input', { type: 'text', id: 'lua-name', maxlength: 40, placeholder: 'Name', value: runtime.entry ? runtime.entry.name : '' });
        const authorInput = h('input', { type: 'text', id: 'lua-author', maxlength: 40, placeholder: 'Author', value: runtime.entry ? runtime.entry.author : '' });
        const editor = h('textarea', { class: 'ch-code ch-editor', rows: 16, spellcheck: 'false', wrap: 'off', 'aria-label': 'Lua crosshair script' });
        editor.value = runtime.entry ? runtime.entry.src : '';

        const loadExample = () => {
            const ex = examples.find(e => e.id === exampleSelect.value);
            if (!ex) return;
            editor.value = ex.src;
            nameInput.value = ex.name;
            authorInput.value = ex.author;
            say('Example loaded. Press Apply to run it.');
        };
        const applyEditor = () => {
            const result = apply({ name: nameInput.value || 'My crosshair', author: authorInput.value, src: editor.value,
                values: runtime.entry ? runtime.entry.values : {} }, true);
            if (!result.ok) { say(`Not applied: ${result.error}`, true); return; }
            enableBox.checked = true;
            renderParams();
            say(`Applied and switched on. ${result.params.length} setting${result.params.length === 1 ? '' : 's'}.`);
        };

        const paramBox = h('div', { class: 'ch-params' });
        const renderParams = () => {
            paramBox.textContent = '';
            const params = runtime.params || [];
            if (!params.length) {
                paramBox.append(h('p', { class: 'menu-setting-note', text: 'No settings yet. Add a params table to the script and it appears here as sliders and colour pickers.' }));
                return;
            }
            for (const p of params) {
                const value = runtime.entry.values[p.key];
                if (p.type === 'number') {
                    const out = h('b', { class: 'ch-value', text: String(value) });
                    const input = h('input', { type: 'range', min: p.min, max: p.max, step: 'any', value, 'aria-label': p.label,
                        on: { input: e => { const v = Number(e.target.value); setValue(p.key, v); out.textContent = String(paramValue(p, v)); } } });
                    paramBox.append(h('div', { class: 'menu-row menu-row-stack' }, h('label', {}, `${p.label} `, out), input));
                } else if (p.type === 'color') {
                    paramBox.append(h('div', { class: 'menu-row' }, h('label', {}, p.label),
                        h('input', { type: 'color', value, on: { input: e => setValue(p.key, e.target.value) } })));
                } else {
                    paramBox.append(h('label', { class: 'toggle-item' },
                        h('input', { type: 'checkbox', checked: value, on: { change: e => setValue(p.key, e.target.checked) } }), ` ${p.label}`));
                }
            }
        };

        const shareBox = h('textarea', { class: 'ch-code', rows: 2, spellcheck: 'false', 'aria-label': 'Share code',
            placeholder: 'EBCHL1.… paste a share code here, then press Apply code' });
        const currentEntry = () => ({ name: nameInput.value || 'My crosshair', author: authorInput.value, src: editor.value,
            values: runtime.entry ? runtime.entry.values : {} });
        const copyCode = () => {
            shareBox.value = encodeShare(currentEntry());
            shareBox.select();
            try {
                if (global.navigator && global.navigator.clipboard) {
                    global.navigator.clipboard.writeText(shareBox.value).then(
                        () => say('Code copied. Anyone can paste it into Apply code.'),
                        () => say('Code selected: copy it with Ctrl+C.'));
                } else say('Code selected: copy it with Ctrl+C.');
            } catch (e) { say('Code selected: copy it with Ctrl+C.'); }
        };
        const applyCode = () => {
            try {
                const entry = decodeShare(shareBox.value);
                editor.value = entry.src;
                nameInput.value = entry.name;
                authorInput.value = entry.author;
                const result = apply({ ...entry, enabled: true }, true);
                if (!result.ok) { say(`Not applied: ${result.error}`, true); return; }
                enableBox.checked = true;
                renderParams();
                say(`Shared crosshair "${entry.name}" applied.`);
            } catch (e) {
                say(e.message || String(e), true);
            }
        };
        const exportLua = () => {
            const blob = new Blob([exportFile(currentEntry())], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = h('a', { href: url, download: `${slug(nameInput.value)}.lua` });
            doc.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            say('Saved as a .lua file. Send it to a friend or put it in your project.');
        };
        const fileInput = h('input', { type: 'file', accept: '.lua,.txt,text/plain', 'aria-label': 'Import a .lua file',
            on: { change: e => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    const entry = parseFile(String(reader.result), file.name.replace(/\.[^.]+$/, ''));
                    editor.value = entry.src;
                    nameInput.value = entry.name;
                    authorInput.value = entry.author;
                    say('Imported. Press Apply to run it.');
                };
                reader.readAsText(file);
                e.target.value = '';
            } } });

        root.textContent = '';
        root.append(
            h('div', { class: 'menu-card ch-card' },
                h('p', { class: 'menu-setting-note', text: 'Write a Lua script that draws your crosshair every frame. It runs in a sandbox and can only draw. Full reference: docs/crosshair-lua.md' }),
                h('div', { class: 'toggle-item' }, enableBox, ' Use Lua crosshair (replaces the built-in one)'),
                h('div', { class: 'menu-row' }, h('label', { for: 'lua-example' }, 'Start from'),
                    exampleSelect, h('button', { class: 'menu-btn btn-secondary', type: 'button', text: 'Load', on: { click: loadExample } })),
                h('div', { class: 'menu-row' }, h('label', { for: 'lua-name' }, 'Name'), nameInput),
                h('div', { class: 'menu-row' }, h('label', { for: 'lua-author' }, 'Author'), authorInput),
                editor,
                h('div', { class: 'menu-buttons-grid' },
                    h('button', { class: 'menu-btn btn-primary', type: 'button', text: 'Apply and switch on', on: { click: applyEditor } }),
                    h('button', { class: 'menu-btn btn-secondary', type: 'button', text: 'Load example', on: { click: loadExample } })),
                h('div', { class: 'menu-section-label' }, 'Settings from params'),
                paramBox,
            ),
            h('div', { class: 'menu-card' },
                h('div', { class: 'menu-section-label' }, 'Share'),
                shareBox,
                h('div', { class: 'menu-buttons-grid' },
                    h('button', { class: 'menu-btn btn-secondary', type: 'button', text: 'Copy code', on: { click: copyCode } }),
                    h('button', { class: 'menu-btn btn-primary', type: 'button', text: 'Apply code', on: { click: applyCode } }),
                    h('button', { class: 'menu-btn btn-secondary', type: 'button', text: 'Export .lua', on: { click: exportLua } })),
                h('div', { class: 'menu-row' }, h('label', {}, 'Import .lua'), fileInput),
                status),
        );
        renderParams();
        if (runtime.error) say(`Last error: ${runtime.error}`, true);
        onChange(() => {
            enableBox.checked = !!(runtime.entry && runtime.entry.enabled);
            if (runtime.error) say(`Switched off: ${runtime.error}`, true);
        });
        return root;
    }

    const api = {
        mountAdvanced,
        LIMITS, CrosshairLuaError, LuaCrosshair,
        createEngine, parseSchema, paramValue, cssColor,
        encodeShare, decodeShare, exportFile, parseFile, sanitizeEntry,
        apply, setEnabled, setValue, restore, start, stop, render,
        get entry() { return runtime.entry; },
        get params() { return runtime.params; },
        get error() { return runtime.error; },
        get running() { return !!runtime.engine && !!runtime.entry && runtime.entry.enabled; },
        onChange,
    };
    global.CrosshairLua = api;
})(typeof window !== 'undefined' ? window : globalThis);

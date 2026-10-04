/* EBLANKRAFT BLOCKLY — головний застосунок ч.1 */
(function () {
'use strict';
var LS_MODS = 'eblankraft_lua_mods';
var LS_WORK = 'eblan_blockly_work';
var statusEl, luaEl, checkEl, workspace;

function status(msg, ok) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = ok === false ? '#f88' : '#8f8';
    clearTimeout(status._t);
    status._t = setTimeout(function () { statusEl.textContent = ''; }, 4000);
}
function header() {
    return '-- ===========================================\n' +
        '-- BLOCKLY-мод для Eblankraft (Google Blockly)\n' +
        '-- ===========================================\n\n';
}
function generateLua() {
    if (!workspace || !Blockly || !Blockly.Lua) return '';
    try {
        Blockly.Lua.init(workspace);
        var out = '';
        workspace.getTopBlocks(true).forEach(function (b) {
            out += Blockly.Lua.blockToCode(b);
        });
        return out;
    } catch (e) {
        try { return Blockly.Lua.workspaceToCode(workspace); }
        catch (e2) { return ''; }
    }
}
function refresh() {
    var code = generateLua();
    luaEl.value = code ? header() + code : '';
}
function checkLua() {
    var code = luaEl.value;
    if (!code.trim()) {
        checkEl.className = 'check err';
        checkEl.textContent = 'Поле порожнє — збери блоки.';
        return false;
    }
    try {
        if (typeof fengari === 'undefined') {
            checkEl.className = 'check err';
            checkEl.textContent = 'Fengari не завантажився. Збереження все одно працює.';
            return true;
        }
        var lua = fengari.lua, laux = fengari.lauxlib;
        var L = laux.luaL_newstate();
        fengari.lualib.luaL_openlibs(L);
        var st = laux.luaL_loadstring(L, fengari.to_luastring(code));
        if (st === lua.LUA_OK) {
            checkEl.className = 'check ok';
            checkEl.textContent = '✔ Синтаксис Lua — OK';
            return true;
        }
        var err = fengari.to_jsstring(lua.lua_tostring(L, -1));
        checkEl.className = 'check err';
        checkEl.textContent = 'Помилка синтаксису: ' + err;
        return false;
    } catch (e) {
        checkEl.className = 'check err';
        checkEl.textContent = String(e.message || e);
        return false;
    }
}
function parseModId(code) {
    var m = code.match(/id\s*=\s*["']([^"']+)["']/);
    return m ? m[1].trim().replace(/\s+/g, '_').toLowerCase() : null;
}
window.EBLAN_CORE = {
    get workspace() { return workspace; },
    set workspace(w) { workspace = w; },
    els: function (s, l, c) { statusEl = s; luaEl = l; checkEl = c; },
    status: status, header: header, generateLua: generateLua,
    refresh: refresh, checkLua: checkLua, parseModId: parseModId,
    LS_MODS: LS_MODS, LS_WORK: LS_WORK
};
})();

/* EBLANKRAFT BLOCKLY — шим Lua-генератора (браузер UMD + npm-модуль) */
(function () {
'use strict';
function gen() {
    if (typeof Blockly !== 'undefined' && Blockly.Lua) return Blockly.Lua;
    if (typeof luaGenerator !== 'undefined' && luaGenerator) return luaGenerator;
    if (typeof window !== 'undefined' && window.__EBLAN_LUA) return window.__EBLAN_LUA;
    return null;
}
function luaCode(ws) {
    var g = gen();
    if (!g || !ws) return '';
    try { return g.workspaceToCode(ws) || ''; }
    catch (e) { return ''; }
}
if (typeof window !== 'undefined') {
    window.EBLAN_GEN = gen;
    window.EBLAN_LUACODE = luaCode;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { gen: gen, luaCode: luaCode };
}
})();

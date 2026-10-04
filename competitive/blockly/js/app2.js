/* EBLANKRAFT BLOCKLY — ч.2а: збереження в гру / файли / поділитись */
(function () {
'use strict';
var CORE = window.EBLAN_CORE;
function saveToGame() {
    var code = document.getElementById('luaCode').value;
    if (!code.trim()) { CORE.status('Нема чого зберігати', false); return; }
    var id = CORE.parseModId(code);
    if (!id) { CORE.status('Додай блок Мод з полем id', false); return; }
    var entry = { id: Date.now(), code: code, enabled: true };
    try {
        var raw = null;
        try { raw = localStorage.getItem(CORE.LS_MODS); } catch (e) { raw = null; }
        var arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) arr = [];
        var found = false;
        for (var i = 0; i < arr.length; i++) {
            var oldId = arr[i] && arr[i].code ? CORE.parseModId(arr[i].code) : null;
            if (oldId === id) { arr[i] = entry; found = true; break; }
        }
        if (!found) arr.push(entry);
        try {
            localStorage.setItem(CORE.LS_MODS, JSON.stringify(arr));
        } catch (e) {
            // file:// або переповнення: віддаємо .lua файл замість мовчазної втрати
            CORE.status('localStorage недоступний — завантажую .lua файл', false);
            downloadLua();
            return;
        }
        CORE.status(found ? 'Мод оновлено в грі!' : 'Мод збережено в гру!');
        var c = document.getElementById('checkResult');
        c.className = 'check ok';
        c.textContent = 'Збережено. Гра → Моди → увімкни «' + id + '».';

        // Сповіщаємо батьківське вікно гри (якщо відкрито в модалці/iframe)
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'eblankraft_blockly_save', id: id, code: code }, '*');
            }
        } catch (postErr) {}
    } catch (e) { CORE.status('localStorage: ' + e.message, false); }
}
function downloadLua() {
    var code = document.getElementById('luaCode').value;
    if (!code.trim()) { CORE.status('Нема коду', false); return; }
    var id = CORE.parseModId(code) || 'blocky_mod';
    var a = document.createElement('a');
    var blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    a.href = URL.createObjectURL(blob);
    a.download = id + '.lua';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    CORE.status('Завантажено ' + id + '.lua');
}
function exportXml() {
    var dom = Blockly.Xml.workspaceToDom(CORE.workspace);
    var text = Blockly.Xml.domToText(dom);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/xml' }));
    a.download = 'blocky_blocks.xml';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}
function importXmlFile(file) {
    var r = new FileReader();
    r.onload = function () {
        try {
            CORE.workspace.clear();
            var dom = Blockly.Xml.textToDom(r.result);
            Blockly.Xml.domToWorkspace(dom, CORE.workspace);
            CORE.refresh();
            CORE.status('Блоки імпортовано');
        } catch (e) { CORE.status('Битий XML: ' + e.message, false); }
    };
    r.readAsText(file);
}
/* --- 🔗 Поділитись: блоки пакуються в URL (#xml=base64) --- */
function utf8ToB64(s) {
    return btoa(unescape(encodeURIComponent(s)));
}
function b64ToUtf8(b) {
    return decodeURIComponent(escape(atob(b)));
}
function shareLink() {
    try {
        var dom = Blockly.Xml.workspaceToDom(CORE.workspace);
        var text = Blockly.Xml.domToText(dom);
        if (text.length > 6000) {
            CORE.status('Забагато блоків для посилання — скористайся Експортом', false);
            return;
        }
        var url = location.pathname + '#xml=' + utf8ToB64(text);
        var full = location.origin && location.origin !== 'null'
            ? location.origin + url : url;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(full).then(function () {
                CORE.status('Посилання скопійовано!');
            }, function () { prompt('Скопіюй посилання:', full); });
        } else { prompt('Скопіюй посилання:', full); }
        try { location.hash = 'xml=' + utf8ToB64(text); } catch (e) {}
    } catch (e) { CORE.status('Не вийшло: ' + e.message, false); }
}
function restoreFromHash() {
    try {
        var h = location.hash || '';
        var m = h.match(/#xml=(.+)/);
        if (!m) return false;
        var dom = Blockly.Xml.textToDom(b64ToUtf8(m[1]));
        CORE.workspace.clear();
        Blockly.Xml.domToWorkspace(dom, CORE.workspace);
        CORE.refresh();
        CORE.status('Мод завантажено з посилання!');
        return true;
    } catch (e) { return false; }
}
window.EBLAN_IO = {
    saveToGame: saveToGame, downloadLua: downloadLua,
    exportXml: exportXml, importXmlFile: importXmlFile,
    shareLink: shareLink, restoreFromHash: restoreFromHash
};
})();

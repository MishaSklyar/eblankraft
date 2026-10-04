/* EBLANKRAFT BLOCKLY — ч.2б: ініціалізація робочого поля */
(function () {
'use strict';
var CORE = window.EBLAN_CORE;
function autosave() {
    try {
        var dom = Blockly.Xml.workspaceToDom(CORE.workspace);
        localStorage.setItem(CORE.LS_WORK, Blockly.Xml.domToText(dom));
    } catch (e) {}
}
function autorestore() {
    try {
        var t = localStorage.getItem(CORE.LS_WORK);
        if (!t) return false;
        var dom = Blockly.Xml.textToDom(t);
        Blockly.Xml.domToWorkspace(dom, CORE.workspace);
        return true;
    } catch (e) { return false; }
}
function init() {
    CORE.els(document.getElementById('statusMsg'),
        document.getElementById('luaCode'),
        document.getElementById('checkResult'));
    if (typeof Blockly === 'undefined' || !Blockly.Lua) {
        document.getElementById('blocklyDiv').innerHTML =
            '<div style="padding:30px;color:#f88">' +
            'Blockly не завантажився: нема vendor/ і нема інтернету для CDN.<br>' +
            'Запусти через <code>python3 server.py</code> або увімкни інтернет.</div>';
        return;
    }
    CORE.workspace = Blockly.inject('blocklyDiv', {
        toolbox: window.EBLAN_TOOLBOX,
        trashcan: true,
        media: 'vendor/media/',
        // Zelos — округлі «скретчівські» блоки (з Scratch: палітра + капелюхи)
        renderer: 'zelos',
        grid: { spacing: 20, length: 3, colour: '#333', snap: true },
        zoom: { controls: true, startScale: 0.9, maxScale: 2, minScale: 0.4 }
    });
    // 1) мод з посилання (?#xml=...), 2) автозбереження, 3) стартовий приклад
    var fromLink = false;
    try { fromLink = window.EBLAN_IO.restoreFromHash(); } catch (e) {}
    if (!autorestore() && !fromLink) {
        var start = '<xml xmlns="https://developers.google.com/blockly/xml">' +
            '<block type="eblan_mod" x="30" y="30">' +
            '<field name="ID">my_first_mod</field>' +
            '<field name="NAME">Мій перший мод</field>' +
            '<field name="AUTHOR">Я</field><field name="VERSION">1.0</field>' +
            '<statement name="ONENABLE">' +
            '<block type="eblan_toast"><value name="TEXT">' +
            '<block type="text"><field name="TEXT">Привіт!</field></block>' +
            '</value></block></statement></block></xml>';
        try {
            var dom = Blockly.Xml.textToDom(start);
            Blockly.Xml.domToWorkspace(dom, CORE.workspace);
        } catch (e) {}
    }
    CORE.workspace.addChangeListener(function (e) {
        if (e.isUiEvent) return;
        CORE.refresh();
        autosave();
    });
    CORE.refresh();
    var IO = window.EBLAN_IO;
    var btnBack = document.getElementById('btnBackToGame');
    if (btnBack) {
        btnBack.onclick = function (e) {
            if (window.parent && window.parent !== window) {
                e.preventDefault();
                window.parent.postMessage({ type: 'eblankraft_blockly_close' }, '*');
            } else {
                window.location.href = '../index.html';
            }
        };
    }
    document.getElementById('btnSend').onclick = IO.saveToGame;
    document.getElementById('btnShare').onclick = IO.shareLink;
    document.getElementById('btnCheck').onclick = CORE.checkLua;
    document.getElementById('btnCopy').onclick = function () {
        var el = document.getElementById('luaCode');
        el.select();
        try { document.execCommand('copy'); CORE.status('Скопійовано'); }
        catch (e) {
            if (navigator.clipboard) navigator.clipboard.writeText(el.value)
                .then(function () { CORE.status('Скопійовано'); });
        }
    };
    document.getElementById('btnDownload').onclick = IO.downloadLua;
    document.getElementById('btnExportXml').onclick = IO.exportXml;
    document.getElementById('btnImportXml').onclick = function () {
        document.getElementById('fileXml').click();
    };
    var fx = document.getElementById('fileXml');
    fx.onchange = function (e) {
        if (e.target.files[0]) IO.importXmlFile(e.target.files[0]);
        e.target.value = '';
    };
    var se = document.getElementById('selExample');
    se.onchange = function (e) {
        var k = e.target.value;
        if (!k || !window.EBLAN_EXAMPLES[k]) return;
        try {
            CORE.workspace.clear();
            var dom = Blockly.Xml.textToDom(window.EBLAN_EXAMPLES[k]);
            Blockly.Xml.domToWorkspace(dom, CORE.workspace);
            CORE.refresh();
            CORE.status('Приклад завантажено');
        } catch (err) { CORE.status(String(err.message || err), false); }
        e.target.value = '';
    };
    document.getElementById('btnClear').onclick = function () {
        if (confirm('Очистити всі блоки?')) {
            CORE.workspace.clear();
            CORE.refresh();
        }
    };
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else { init(); }
})();

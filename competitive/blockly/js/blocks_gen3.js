/* EBLANKRAFT BLOCKLY — Lua-генератори ч.3: звук / таймери / економіка / утиліти */
(function () {
'use strict';
var V = window.EBLAN_V, ST = window.EBLAN_ST, Q = window.EBLAN_Q;

EBLAN_GEN()['eblan_sound'] = function (block) {
    var s = block.getFieldValue('S') || 'beep';
    if (s === 'gunshot') return 'Sound.gunshot()\n';
    if (s === 'horn') return 'Sound.horn()\n';
    if (s === 'engine') return 'Sound.engine(1200, 0.15)\n';
    if (s === 'screech') return 'Sound.screech(0.4)\n';
    if (s === 'speak') return 'Game.speak("Еблан!")\n';
    return 'Sound.beep(600, 0.15)\n';
};

EBLAN_GEN()['eblan_timer_once'] = function (block) {
    return 'Timer.simple(' + V(block, 'SEC', '3') +
        ', function()\n' + ST(block, 'DO') + 'end)\n';
};

EBLAN_GEN()['eblan_timer_loop'] = function (block) {
    var id = block.getFieldValue('ID') || 'my_timer';
    return 'Timer.create(' + Q(id) + ', ' + V(block, 'SEC', '5') +
        ', 0, function()\n' + ST(block, 'DO') + 'end)\n';
};

EBLAN_GEN()['eblan_money'] = function (block) {
    var op = block.getFieldValue('OP') || 'add';
    var code = 'Economy.add(' + V(block, 'V', '100') + ')\n';
    if (op === 'take') code = 'Economy.take(' + V(block, 'V', '100') + ')\n';
    if (op === 'set') code = 'Economy.set(' + V(block, 'V', '100') + ')\n';
    return code;
};

EBLAN_GEN()['eblan_print'] = function (block) {
    return 'print(' + V(block, 'TEXT', '""') + ')\n';
};

EBLAN_GEN()['eblan_lua'] = function (block) {
    return (block.getFieldValue('CODE') || '') + '\n';
};
})();

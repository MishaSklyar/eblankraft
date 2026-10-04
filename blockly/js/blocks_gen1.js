/* EBLANKRAFT BLOCKLY — Lua-генератори ч.1: хелпери / Мод / Події / Команди / Гра */
(function () {
'use strict';
function Q(s) {
    return '"' + String(s == null ? '' : s)
        .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}
function V(block, name, def) {
    var c = EBLAN_GEN().valueToCode(block, name, EBLAN_GEN().ORDER_ATOMIC);
    return (c === '' || c == null) ? def : c;
}
function ST(block, name) { return EBLAN_GEN().statementToCode(block, name); }
window.EBLAN_Q = Q; window.EBLAN_V = V; window.EBLAN_ST = ST;

EBLAN_GEN()['eblan_mod'] = function (block) {
    var id = block.getFieldValue('ID') || 'my_mod';
    var name = block.getFieldValue('NAME') || id;
    var author = block.getFieldValue('AUTHOR') || '';
    var ver = block.getFieldValue('VERSION') || '1.0';
    var body = ST(block, 'ONENABLE');
    // рівний, читабельний відступ — «легкий» Lua
    body = body.replace(/^/gm, '        ').replace(/[ \t]+$/gm, ''); // тіло onEnable (8 пробілів)
    return 'Mod.register({\n' +
        '    id = ' + Q(id) + ',\n' +
        '    name = ' + Q(name) + ',\n' +
        '    version = ' + Q(ver) + ',\n' +
        '    author = ' + Q(author) + ',\n' +
        '    description = ' + Q('Зроблено в Blockly-конструкторі') + ',\n' +
        '    onEnable = function()\n' + body + '    end\n' +
        '})\n';
};

var EV_ARGS = {
    onTick: 'dt', onChat: 'text, sender', onKey: 'code, down',
    onBlockBreak: 'x, y, z, blockType', onBlockPlace: 'x, y, z, blockType',
    onPlayerDamage: 'amount, reason', onAttack: 'result, damage',
    onVehicleEnter: 'vehicleId', onVehicleExit: 'vehicleId',
    onFlyToggle: 'flying', onGameModeChange: 'mode',
    onNetMessage: 'ch, data, sender'
};
EBLAN_GEN()['eblan_event'] = function (block) {
    var ev = block.getFieldValue('EV') || 'onTick';
    var body = ST(block, 'DO').replace(/^/gm, '    ').replace(/[ \t]+$/gm, '');
    return 'Events.on(' + Q(ev) + ', function(' + (EV_ARGS[ev] || '') + ')\n' + body + 'end)\n';
};

EBLAN_GEN()['eblan_on_enable'] = function (block) {
    return ST(block, 'DO');
};

EBLAN_GEN()['eblan_command'] = function (block) {
    var cmd = block.getFieldValue('CMD') || '/hello';
    var body = ST(block, 'DO');
    return 'Chat.addCommand(' + Q(cmd) + ', function(text, sender)\n' + body + 'end)\n';
};

EBLAN_GEN()['eblan_chat_say'] = function (block) {
    var t = V(block, 'TEXT', '""');
    var s = block.getFieldValue('SENDER') || 'МОД';
    return 'Chat.say(' + t + ', ' + Q(s) + ')\n';
};

EBLAN_GEN()['eblan_toast'] = function (block) {
    return 'Game.toast(' + V(block, 'TEXT', '""') + ')\n';
};

EBLAN_GEN()['eblan_chat_msg'] = function (block) {
    return 'Game.chat(' + V(block, 'TEXT', '""') + ')\n';
};

EBLAN_GEN()['eblan_gamemode'] = function (block) {
    var m = block.getFieldValue('MODE') || 'creative';
    return 'Player.setCreative(' + (m === 'creative' ? 'true' : 'false') + ')\n';
};

EBLAN_GEN()['eblan_particles'] = function (block) {
    var x = V(block, 'X', '0'), y = V(block, 'Y', '0'), z = V(block, 'Z', '0');
    var bt = V(block, 'BT', '1'), n = V(block, 'N', '10');
    return 'Game.spawnParticles(' + x + ', ' + y + ', ' + z + ', ' + bt + ', ' + n + ')\n';
};
})();

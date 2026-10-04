/* EBLANKRAFT BLOCKLY — Lua-генератори ч.2: Гравець / Світ */
(function () {
'use strict';
var V = window.EBLAN_V;

EBLAN_GEN()['eblan_pos_vars'] = function (block) {
    var px = 'px', py = 'py', pz = 'pz';
    try {
        px = EBLAN_GEN().nameDB_.getName(block.getFieldValue('PX'), 'VARIABLE');
        py = EBLAN_GEN().nameDB_.getName(block.getFieldValue('PY'), 'VARIABLE');
        pz = EBLAN_GEN().nameDB_.getName(block.getFieldValue('PZ'), 'VARIABLE');
    } catch (e) {
        var f1 = block.getField('PX'), f2 = block.getField('PY'), f3 = block.getField('PZ');
        if (f1 && f1.getText) px = f1.getText();
        if (f2 && f2.getText) py = f2.getText();
        if (f3 && f3.getText) pz = f3.getText();
    }
    return 'local ' + px + ', ' + py + ', ' + pz + ' = Player.getPos()\n';
};

EBLAN_GEN()['eblan_player_pos'] = function (block) {
    var part = block.getFieldValue('PART') || 'px';
    var idx = part === 'py' ? 2 : (part === 'pz' ? 3 : 1);
    // компактно: {fun.} розгортає всі return значення, [1]/[2]/[3] — потрібна координата
    return ['({Player.getPos()})[' + idx + ']', EBLAN_GEN().ORDER_ATOMIC];
};

EBLAN_GEN()['eblan_give'] = function (block) {
    var item = block.getFieldValue('ITEM') || 'dirt';
    var n = V(block, 'COUNT', '1');
    return 'Player.giveItem("' + item + '", ' + n + ')\n';
};

EBLAN_GEN()['eblan_give_custom'] = function (block) {
    var id = V(block, 'ID', '"dirt"');
    var n = V(block, 'COUNT', '1');
    return 'Player.giveItem(' + id + ', ' + n + ')\n';
};

EBLAN_GEN()['eblan_set_hp'] = function (block) {
    return 'Player.setHealth(' + V(block, 'V', '100') + ')\n';
};

EBLAN_GEN()['eblan_heal'] = function (block) {
    return 'Player.heal(' + V(block, 'V', '20') + ')\n';
};

EBLAN_GEN()['eblan_fly'] = function (block) {
    return 'Player.setFlying(' + (block.getFieldValue('VAL') || 'true') + ')\n';
};

EBLAN_GEN()['eblan_teleport'] = function (block) {
    return 'Player.setPos(' + V(block, 'X', '0') + ', ' + V(block, 'Y', '0') +
        ', ' + V(block, 'Z', '0') + ')\n';
};

EBLAN_GEN()['eblan_set_block'] = function (block) {
    var b = block.getFieldValue('B') || 'STONE';
    return 'World.setBlock(' + V(block, 'X', '0') + ', ' + V(block, 'Y', '0') +
        ', ' + V(block, 'Z', '0') + ', World.BLOCKS.' + b + ')\n';
};

EBLAN_GEN()['eblan_fill'] = function (block) {
    var b = block.getFieldValue('B') || 'STONE';
    return 'World.setBlocks(' + V(block, 'X1', '0') + ', ' + V(block, 'Y1', '0') +
        ', ' + V(block, 'Z1', '0') + ', ' + V(block, 'X2', '0') + ', ' +
        V(block, 'Y2', '0') + ', ' + V(block, 'Z2', '0') +
        ', World.BLOCKS.' + b + ')\n';
};

EBLAN_GEN()['eblan_get_block'] = function (block) {
    var code = 'World.getBlock(' + V(block, 'X', '0') + ', ' + V(block, 'Y', '0') +
        ', ' + V(block, 'Z', '0') + ')';
    return [code, EBLAN_GEN().ORDER_HIGH];
};

EBLAN_GEN()['eblan_tnt'] = function (block) {
    return 'World.spawnTNT(' + V(block, 'X', '0') + ', ' + V(block, 'Y', '0') +
        ', ' + V(block, 'Z', '0') + ', ' + V(block, 'VX', '0') + ', ' +
        V(block, 'VY', '8') + ', ' + V(block, 'VZ', '0') + ')\n';
};

EBLAN_GEN()['eblan_explode'] = function (block) {
    return 'World.explode(' + V(block, 'X', '0') + ', ' + V(block, 'Y', '0') +
        ', ' + V(block, 'Z', '0') + ', ' + V(block, 'R', '3') + ')\n';
};

EBLAN_GEN()['eblan_time'] = function (block) {
    return 'World.setTime(' + (block.getFieldValue('T') || '0.25') + ')\n';
};
})();

/* EBLANKRAFT BLOCKLY — Lua-генератори ч.5: 🧱 Блоки та Регіони / 🎨 Кастомні Блоки / 🌐 Мережа */
(function () {
'use strict';
var V = window.EBLAN_V, ST = window.EBLAN_ST, Q = window.EBLAN_Q;
var ORDER_ATOMIC = EBLAN_GEN().ORDER_ATOMIC;

/* ---------- 🧱 Блоки та Відкат ---------- */
EBLAN_GEN()['eblan_blocks_restore'] = function (block) {
    var x = V(block, 'X', '0');
    var y = V(block, 'Y', '0');
    var z = V(block, 'Z', '0');
    return 'Blocks.restore(' + x + ', ' + y + ', ' + z + ')\n';
};

EBLAN_GEN()['eblan_blocks_get_prev'] = function (block) {
    var x = V(block, 'X', '0');
    var y = V(block, 'Y', '0');
    var z = V(block, 'Z', '0');
    return ['Blocks.getPrevious(' + x + ', ' + y + ', ' + z + ')', ORDER_ATOMIC];
};

EBLAN_GEN()['eblan_blocks_break'] = function (block) {
    var x = V(block, 'X', '0');
    var y = V(block, 'Y', '0');
    var z = V(block, 'Z', '0');
    var drop = block.getFieldValue('DROP') === 'TRUE';
    return 'Blocks.breakBlock(' + x + ', ' + y + ', ' + z + ', ' + (drop ? 'true' : 'false') + ')\n';
};

EBLAN_GEN()['eblan_blocks_save_region'] = function (block) {
    var name = block.getFieldValue('NAME') || 'region1';
    var x1 = V(block, 'X1', '0');
    var y1 = V(block, 'Y1', '0');
    var z1 = V(block, 'Z1', '0');
    var x2 = V(block, 'X2', '0');
    var y2 = V(block, 'Y2', '0');
    var z2 = V(block, 'Z2', '0');
    return 'Blocks.saveRegion(' + Q(name) + ', ' + x1 + ', ' + y1 + ', ' + z1 + ', ' + x2 + ', ' + y2 + ', ' + z2 + ')\n';
};

EBLAN_GEN()['eblan_blocks_restore_region'] = function (block) {
    var name = block.getFieldValue('NAME') || 'region1';
    return 'Blocks.restoreRegion(' + Q(name) + ')\n';
};

/* ---------- 🛡️ Регіони ---------- */
EBLAN_GEN()['eblan_regions_protect'] = function (block) {
    var id = block.getFieldValue('ID') || 'zone';
    var x1 = V(block, 'X1', '0');
    var y1 = V(block, 'Y1', '0');
    var z1 = V(block, 'Z1', '0');
    var x2 = V(block, 'X2', '0');
    var y2 = V(block, 'Y2', '0');
    var z2 = V(block, 'Z2', '0');
    var owner = block.getFieldValue('OWNER') || 'admin';
    var msg = block.getFieldValue('MSG') || '§c[Регіон] Тут захищена зона!';
    return 'Regions.protect(' + Q(id) + ', ' + x1 + ', ' + y1 + ', ' + z1 + ', ' + x2 + ', ' + y2 + ', ' + z2 + ', ' + Q(owner) + ', ' + Q(msg) + ')\n';
};

EBLAN_GEN()['eblan_regions_is_allowed'] = function (block) {
    var act = block.getFieldValue('ACTION') || 'break';
    var x = V(block, 'X', '0');
    var y = V(block, 'Y', '0');
    var z = V(block, 'Z', '0');
    return ['Regions.isAllowed(' + Q(act) + ', ' + x + ', ' + y + ', ' + z + ')', ORDER_ATOMIC];
};

/* ---------- 🎨 Кастомні Блоки ---------- */
EBLAN_GEN()['eblan_custom_block'] = function (block) {
    var id = block.getFieldValue('ID') || 'my_custom_block';
    var name = block.getFieldValue('NAME') || id;
    var tex = block.getFieldValue('TEXTURE') || '#ffffff';
    var solid = block.getFieldValue('SOLID') === 'TRUE';
    var transparent = block.getFieldValue('TRANSPARENT') === 'TRUE';
    var emissive = block.getFieldValue('EMISSIVE') || '#000000';
    var onInteract = ST(block, 'ONINTERACT').replace(/^/gm, '    ').replace(/[ \t]+$/gm, '');

    var code = 'Blocks.register({\n' +
        '    id = ' + Q(id) + ',\n' +
        '    name = ' + Q(name) + ',\n' +
        '    texture = ' + Q(tex) + ',\n' +
        '    solid = ' + (solid ? 'true' : 'false') + ',\n' +
        '    transparent = ' + (transparent ? 'true' : 'false') + ',\n' +
        '    emissive = ' + Q(emissive) + ',\n' +
        '    onInteract = function(x, y, z)\n' +
        onInteract +
        '    end\n' +
        '})\n';
    return code;
};

EBLAN_GEN()['eblan_texture_override'] = function (block) {
    var name = block.getFieldValue('NAME') || 'stone';
    var spec = V(block, 'SPEC', '""');
    return 'Textures.override(' + Q(name) + ', ' + spec + ')\n';
};

/* ---------- 🌐 Мережа ---------- */
EBLAN_GEN()['eblan_net_hook_send'] = function (block) {
    var type = block.getFieldValue('TYPE') || '*';
    var body = ST(block, 'DO').replace(/^/gm, '    ').replace(/[ \t]+$/gm, '');
    if (type === '*') {
        return 'Net.hookSend(function(packet)\n' + body + 'end)\n';
    } else {
        return 'Net.hookSend(' + Q(type) + ', function(packet)\n' + body + 'end)\n';
    }
};

EBLAN_GEN()['eblan_net_hook_receive'] = function (block) {
    var type = block.getFieldValue('TYPE') || '*';
    var body = ST(block, 'DO').replace(/^/gm, '    ').replace(/[ \t]+$/gm, '');
    if (type === '*') {
        return 'Net.hookReceive(function(packet, senderPeerId)\n' + body + 'end)\n';
    } else {
        return 'Net.hookReceive(' + Q(type) + ', function(packet, senderPeerId)\n' + body + 'end)\n';
    }
};

EBLAN_GEN()['eblan_net_cancel_packet'] = function (block) {
    return 'return false\n';
};

EBLAN_GEN()['eblan_net_is_connected'] = function (block) {
    return ['Net.isConnected()', ORDER_ATOMIC];
};

EBLAN_GEN()['eblan_net_is_host'] = function (block) {
    return ['Net.isHost()', ORDER_ATOMIC];
};

EBLAN_GEN()['eblan_net_kick'] = function (block) {
    var peer = V(block, 'PEER', '""');
    var reason = V(block, 'REASON', '""');
    return 'Net.kick(' + peer + ', ' + reason + ')\n';
};

})();

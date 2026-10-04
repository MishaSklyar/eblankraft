/* EBLANKRAFT BLOCKLY — Lua-генератори ч.4: UI / Движение / Предмети / 3D-моделі */
(function () {
'use strict';
var V = window.EBLAN_V, ST = window.EBLAN_ST, Q = window.EBLAN_Q;
var ORDER_ATOMIC = EBLAN_GEN().ORDER_ATOMIC;

/* ---------- 🖥 UI ---------- */
EBLAN_GEN()['eblan_ui_panel'] = function (block) {
    var id = block.getFieldValue('ID') || 'panel1';
    var title = block.getFieldValue('TITLE') || '';
    var body = ST(block, 'DO').replace(/[ \t]+$/gm, '');
    var opts = 'id = ' + Q(id) + ',\n        title = ' + Q(title) +
        ',\n        x = ' + V(block, 'X', '0') +
        ', y = ' + V(block, 'Y', '0') +
        ', width = ' + V(block, 'W', '240') +
        ', height = ' + V(block, 'H', '160');
    return 'UI.createPanel({\n        ' + opts + '\n    })\n' + body;
};

EBLAN_GEN()['eblan_ui_subheader'] = function (block) {
    var id = block.getFieldValue('ID') || 'panel2';
    // Header + Subheader через <br /> (внутрішній HTML заголовка панелі)
    var sub = 'UI.createPanel({ id = ' + Q(id) +
        ', title = tostring(' + V(block, 'TITLE', '""') + ') .. \"<br />\" .. tostring(' +
        V(block, 'SUB', '""') + ') })\n';
    return sub;
};

EBLAN_GEN()['eblan_ui_button'] = function (block) {
    var id = block.getFieldValue('ID') || 'btn1';
    var text = V(block, 'TEXT', '\"Кнопка\"');
    var click = ST(block, 'CLICK').replace(/^/gm, '    ').replace(/[ \t]+$/gm, '');
    return 'UI.createButton({ id = ' + Q(id) + ', text = ' + text +
        ', x = ' + V(block, 'X', '0') + ', y = ' + V(block, 'Y', '0') +
        ' }, function()\n' + click + 'end)\n';
};

EBLAN_GEN()['eblan_ui_label'] = function (block) {
    var id = block.getFieldValue('ID') || 'label1';
    return 'UI.createLabel({ id = ' + Q(id) + ', text = ' + V(block, 'TEXT', '\"\"') +
        ', fontSize = ' + V(block, 'SIZE', '16') +
        ', x = ' + V(block, 'X', '0') + ', y = ' + V(block, 'Y', '0') + ' })\n';
};

EBLAN_GEN()['eblan_ui_settext'] = function (block) {
    return 'UI.setText(' + Q(block.getFieldValue('ID') || 'label1') +
        ', ' + V(block, 'TEXT', '""') + ')\n';
};

EBLAN_GEN()['eblan_ui_showhide'] = function (block) {
    var act = block.getFieldValue('ACTION') || 'show';
    var api = act === 'hide' ? 'hide' : 'show';
    return 'UI.' + api + '(' + Q(block.getFieldValue('ID') || 'panel1') + ')\n';
};

EBLAN_GEN()['eblan_ui_style'] = function (block) {
    return 'UI.setStyle(' + Q(block.getFieldValue('ID') || 'label1') +
        ', ' + Q(block.getFieldValue('PROP') || 'color') +
        ', ' + V(block, 'VAL', '""') + ')\n';
};

EBLAN_GEN()['eblan_ui_clear'] = function () {
    return 'UI.clear()\n';
};

/* ---------- 🧍 Движение ---------- */
EBLAN_GEN()['eblan_move_speed'] = function (block) {
    return 'Player.setSpeed(' + V(block, 'V', '12') + ')\n';
};

EBLAN_GEN()['eblan_move_velocity'] = function (block) {
    return 'Player.setVelocity(' + V(block, 'X', '0') + ', ' + V(block, 'Y', '0') +
        ', ' + V(block, 'Z', '0') + ')\n';
};

EBLAN_GEN()['eblan_move_getvel'] = function (block) {
    var part = block.getFieldValue('PART') || 'x';
    return ['Player.getVelocity().' + part, ORDER_ATOMIC];
};

EBLAN_GEN()['eblan_physics'] = function (block) {
    return 'Physics.set(' + Q(block.getFieldValue('FIELD') || 'jumpPower') +
        ', ' + V(block, 'V', '1') + ')\n';
};

EBLAN_GEN()['eblan_physics_nofall'] = function (block) {
    return 'Physics.set("noFallDamage", ' + (block.getFieldValue('VAL') || 'true') + ')\n';
};

EBLAN_GEN()['eblan_physics_reset'] = function () {
    return 'Physics.reset()\n';
};

/* ---------- 📦 Предмети ---------- */
EBLAN_GEN()['eblan_items_register'] = function (block) {
    var cat = block.getFieldValue('CATEGORY') || 'weapon';
    var col = block.getFieldValue('COLOR') || '#e33';
    return 'Items.register({\n    id = ' + Q(block.getFieldValue('ID') || 'my_item') +
        ',\n    name = ' + Q(block.getFieldValue('NAME') || 'Мій предмет') +
        ',\n    category = ' + Q(cat) +
        ',\n    attackDamage = ' + V(block, 'DMG', '35') +
        ',\n    color = ' + Q(col) + '\n})\n';
};

EBLAN_GEN()['eblan_items_getid'] = function (block) {
    return [Q(block.getFieldValue('ITEM') || 'diamond_sword'), ORDER_ATOMIC];
};

/* ---------- 🧊 3D-моделі ---------- */
EBLAN_GEN()['eblan_models_load'] = function (block) {
    var id = block.getFieldValue('ID') || 'ak47';
    var onload = ST(block, 'ONLOAD').replace(/^/gm, '    ').replace(/[ \t]+$/gm, '');
    return 'Models.load(' + Q(id) + ', ' + V(block, 'URL', '""') + ', function()\n' +
        onload + 'end)\n';
};

EBLAN_GEN()['eblan_models_spawn'] = function (block) {
    var id = block.getFieldValue('ID') || 'ak47';
    return 'Models.spawn(' + Q(id) + ', ' + V(block, 'X', '0') + ', ' +
        V(block, 'Y', '16') + ', ' + V(block, 'Z', '0') +
        ', { scale = ' + V(block, 'SCALE', '1') + ', yaw = ' + V(block, 'YAW', '0') + ' })\n';
};

EBLAN_GEN()['eblan_models_setpos'] = function (block) {
    return 'Models.setPos(' + Q(block.getFieldValue('ID') || 'ak47') + ', ' +
        V(block, 'X', '0') + ', ' + V(block, 'Y', '0') + ', ' + V(block, 'Z', '0') + ')\n';
};

EBLAN_GEN()['eblan_models_setrot'] = function (block) {
    return 'Models.setRot(' + Q(block.getFieldValue('ID') || 'ak47') + ', ' +
        V(block, 'X', '0') + ', ' + V(block, 'Y', '0') + ', ' + V(block, 'Z', '0') + ')\n';
};

EBLAN_GEN()['eblan_models_setscale'] = function (block) {
    return 'Models.setScale(' + Q(block.getFieldValue('ID') || 'ak47') + ', ' +
        V(block, 'X', '1') + ', ' + V(block, 'Y', '1') + ', ' + V(block, 'Z', '1') + ')\n';
};

EBLAN_GEN()['eblan_models_remove'] = function (block) {
    return 'Models.remove(' + Q(block.getFieldValue('ID') || 'ak47') + ')\n';
};
})();
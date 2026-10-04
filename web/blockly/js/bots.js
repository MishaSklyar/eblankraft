/* Programmable bots: the same Bots API used by handwritten Lua mods. */
(function () {
'use strict';
var Q = window.EBLAN_Q, V = window.EBLAN_V, gen = EBLAN_GEN();
var definitions = [], toolbox = [];
function add(type, message, args, output, tooltip, generator, defaults) {
    var definition = { type: type, message0: message, args0: args, colour: 210, tooltip: tooltip };
    if (output) definition.output = output;
    else { definition.previousStatement = null; definition.nextStatement = null; }
    definitions.push(definition);
    var entry = { kind: 'block', type: type };
    if (defaults) {
        entry.inputs = {};
        Object.keys(defaults).forEach(function (key) {
            entry.inputs[key] = { shadow: { type: 'math_number', fields: { NUM: defaults[key] } } };
        });
    }
    toolbox.push(entry);
    gen[type] = generator;
}
function idField() { return { type: 'field_input', name: 'ID', text: 'guard' }; }
function number(name) { return { type: 'input_value', name: name, check: 'Number' }; }
function id(block) { return Q(block.getFieldValue('ID') || 'guard'); }
['spawn', 'moveTo'].forEach(function (action) {
    add('eblan_bot_' + action, '🤖 ' + (action === 'spawn' ? 'створити бота' : 'бот іде до') + ' %1 X: %2 Y: %3 Z: %4',
        [idField(), number('X'), number('Y'), number('Z')], null,
        action === 'spawn' ? 'Bots.spawn(id, x, y, z): до 32 ботів, створюйте над вільною поверхнею.' : 'Bots.moveTo: рух по поверхні, колізії та підйом на 1 блок; складний маршрут задайте точками.',
        function (block) { return 'Bots.' + action + '(' + id(block) + ', ' + V(block, 'X', '0') + ', ' + V(block, 'Y', '5') + ', ' + V(block, 'Z', '0') + ')\n'; },
        { X: 1, Y: 5, Z: 1 });
});
[['followPlayer', 'слідувати за гравцем'], ['stop', 'зупинити'], ['jump', 'стрибнути'], ['remove', 'видалити']].forEach(function (pair) {
    add('eblan_bot_' + pair[0], '🤖 ' + pair[1] + ' бота %1', [idField()], null, 'Bots.' + pair[0] + '(id)',
        function (block) { return 'Bots.' + pair[0] + '(' + id(block) + ')\n'; });
});
add('eblan_bot_speed', '🤖 швидкість бота %1 = %2', [idField(), number('SPEED')], null, 'Bots.setSpeed(id, speed): 0–8 блоків/сек.',
    function (block) { return 'Bots.setSpeed(' + id(block) + ', ' + V(block, 'SPEED', '3') + ')\n'; }, { SPEED: 3 });
add('eblan_bot_attack', '🤖 бот %1 атакує %2', [idField(), { type: 'field_input', name: 'TARGET', text: 'player' }], null,
    'Bots.attack(id, target): player або ім’я іншого бота. Ближній удар до 2,2 блока, пауза 1,3 с, стіни блокують удар.',
    function (block) { return 'Bots.attack(' + id(block) + ', ' + Q(block.getFieldValue('TARGET')) + ')\n'; });
add('eblan_bot_exists', '🤖 бот %1 існує', [idField()], 'Boolean', 'Bots.exists(id)',
    function (block) { return ['Bots.exists(' + id(block) + ')', gen.ORDER_ATOMIC]; });
add('eblan_bot_health', '🤖 здоров’я бота %1', [idField()], 'Number', 'Bots.getHealth(id): 0 якщо бота немає.',
    function (block) { return ['Bots.getHealth(' + id(block) + ')', gen.ORDER_ATOMIC]; });
add('eblan_bot_position', '🤖 координата бота %1 %2', [idField(), { type: 'field_dropdown', name: 'AXIS', options: [['X', 'x'], ['Y', 'y'], ['Z', 'z']] }], 'Number',
    'Bots.getPosition(id): координати бота, 0 якщо бота немає.',
    function (block) { return ['(Bots.getPosition(' + id(block) + ') or {x=0,y=0,z=0}).' + block.getFieldValue('AXIS'), gen.ORDER_ATOMIC]; });
Blockly.defineBlocksWithJsonArray(definitions);
window.EBLAN_TOOLBOX.contents.push({ kind: 'category', name: '🤖 Боти', colour: '210', contents: toolbox });
})();

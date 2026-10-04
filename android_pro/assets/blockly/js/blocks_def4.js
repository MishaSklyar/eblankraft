/* EBLANKRAFT BLOCKLY — ч.3: звук / таймери / економіка / утиліти + тулбокс */
(function () {
'use strict';
var S = 300, M = 0, E = 45;
Blockly.defineBlocksWithJsonArray([
{
    "type": "eblan_sound",
    "message0": "🔊 звук: %1",
    "args0": [{ "type": "field_dropdown", "name": "S", "options": [
        ["постріл", "gunshot"], ["біп", "beep"], ["клаксон", "horn"],
        ["двигун", "engine"], ["вереск гальм", "screech"], ["озвучка", "speak"] ]}],
    "previousStatement": null, "nextStatement": null,
    "colour": S, "tooltip": "Sound.*"
},
{
    "type": "eblan_timer_once",
    "message0": "⏱ через %1 сек зробити %2",
    "args0": [
        { "type": "input_value", "name": "SEC" },
        { "type": "input_statement", "name": "DO" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": M, "tooltip": "Timer.simple(sec, fn)"
},
{
    "type": "eblan_timer_loop",
    "message0": "🔁 кожні %1 сек (id %2 ) %3",
    "args0": [
        { "type": "input_value", "name": "SEC" },
        { "type": "field_input", "name": "ID", "text": "my_timer" },
        { "type": "input_statement", "name": "DO" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": M, "tooltip": "Timer.create(id, sec, 0, fn)"
},
{
    "type": "eblan_money",
    "message0": "💰 гроші: %1 %2",
    "args0": [
        { "type": "field_dropdown", "name": "OP", "options": [
            ["дати", "add"], ["забрати", "take"], ["встановити", "set"] ]},
        { "type": "input_value", "name": "V" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": E, "tooltip": "Economy.add / take / set"
},
{
    "type": "eblan_print",
    "message0": "🖨 в консоль %1",
    "args0": [{ "type": "input_value", "name": "TEXT" }],
    "previousStatement": null, "nextStatement": null,
    "colour": M, "tooltip": "print(...) — у консоль модів."
},
{
    "type": "eblan_lua",
    "message0": "📝 свій Lua-код: %1",
    "args0": [{ "type": "field_input", "name": "CODE", "text": "Game.toast(\"привіт!\")" }],
    "previousStatement": null, "nextStatement": null,
    "colour": M, "tooltip": "Вставка чистого Lua."
}
]);
window.EBLAN_TOOLBOX = { "kind": "categoryToolbox", "contents": [
    { "kind": "category", "name": "🧩 Мод", "colour": "160", "contents": [
        { "kind": "block", "type": "eblan_mod" },
        { "kind": "block", "type": "eblan_on_enable" } ]},
    { "kind": "category", "name": "⚡ Події", "colour": "20", "contents": [
        { "kind": "block", "type": "eblan_event" } ]},
    { "kind": "category", "name": "💬 Команди", "colour": "260", "contents": [
        { "kind": "block", "type": "eblan_command" },
        { "kind": "block", "type": "eblan_chat_say" } ]},
    { "kind": "category", "name": "🎮 Гра", "colour": "60", "contents": [
        { "kind": "block", "type": "eblan_toast" },
        { "kind": "block", "type": "eblan_chat_msg" },
        { "kind": "block", "type": "eblan_gamemode" },
        { "kind": "block", "type": "eblan_particles" } ]},
    { "kind": "category", "name": "🧍 Гравець", "colour": "200", "contents": [
        { "kind": "block", "type": "eblan_pos_vars" },
        { "kind": "block", "type": "eblan_player_pos" },
        { "kind": "block", "type": "eblan_give" },
        { "kind": "block", "type": "eblan_give_custom" },
        { "kind": "block", "type": "eblan_set_hp" },
        { "kind": "block", "type": "eblan_heal" },
        { "kind": "block", "type": "eblan_fly" },
        { "kind": "block", "type": "eblan_teleport" } ]},
    { "kind": "category", "name": "🌍 Світ", "colour": "100", "contents": [
        { "kind": "block", "type": "eblan_set_block" },
        { "kind": "block", "type": "eblan_fill" },
        { "kind": "block", "type": "eblan_get_block" },
        { "kind": "block", "type": "eblan_tnt" },
        { "kind": "block", "type": "eblan_explode" },
        { "kind": "block", "type": "eblan_time" } ]},
    { "kind": "category", "name": "🔊⏱💰", "colour": "300", "contents": [
        { "kind": "block", "type": "eblan_sound" },
        { "kind": "block", "type": "eblan_timer_once" },
        { "kind": "block", "type": "eblan_timer_loop" },
        { "kind": "block", "type": "eblan_money" } ]},
    { "kind": "category", "name": "🧰 Утиліти", "colour": "0", "contents": [
        { "kind": "block", "type": "eblan_print" },
        { "kind": "block", "type": "eblan_lua" } ]},
    { "kind": "category", "name": "🔢 Логіка", "colour": "210", "contents": [
        { "kind": "block", "type": "controls_if" },
        { "kind": "block", "type": "logic_compare" },
        { "kind": "block", "type": "logic_operation" },
        { "kind": "block", "type": "logic_negate" },
        { "kind": "block", "type": "logic_boolean" } ]},
    { "kind": "category", "name": "🔁 Цикли", "colour": "120", "contents": [
        { "kind": "block", "type": "controls_repeat_ext" },
        { "kind": "block", "type": "controls_whileUntil" },
        { "kind": "block", "type": "controls_for" },
        { "kind": "block", "type": "controls_flow_statements" } ]},
    { "kind": "category", "name": "➕ Математика", "colour": "230", "contents": [
        { "kind": "block", "type": "math_number" },
        { "kind": "block", "type": "math_arithmetic" },
        { "kind": "block", "type": "math_single" },
        { "kind": "block", "type": "math_random_int" } ]},
    { "kind": "category", "name": "🔤 Текст", "colour": "160", "contents": [
        { "kind": "block", "type": "text" },
        { "kind": "block", "type": "text_join" },
        { "kind": "block", "type": "text_print" } ]},
    { "kind": "category", "name": "📦 Змінні", "colour": "330", "custom": "VARIABLE" }
]};
})();

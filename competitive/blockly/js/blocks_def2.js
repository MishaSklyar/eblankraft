/* EBLANKRAFT BLOCKLY — ч.2а: Гравець */
(function () {
'use strict';
var P = 200;
Blockly.defineBlocksWithJsonArray([
{
    "type": "eblan_pos_vars",
    "message0": "📍 координати гравця → в %1 %2 %3",
    "args0": [
        { "type": "field_variable", "name": "PX", "variable": "px" },
        { "type": "field_variable", "name": "PY", "variable": "py" },
        { "type": "field_variable", "name": "PZ", "variable": "pz" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": P, "tooltip": "local px, py, pz = Player.getPos()"
},
{
    "type": "eblan_player_pos",
    "message0": "📍 позиція гравця %1",
    "args0": [{ "type": "field_dropdown", "name": "PART",
        "options": [["X", "px"], ["Y", "py"], ["Z", "pz"]] }],
    "output": "Number", "colour": P,
    "tooltip": "Одна координата гравця (число)."
},
{
    "type": "eblan_give",
    "message0": "🎒 видати %1 × %2",
    "args0": [
        { "type": "field_dropdown", "name": "ITEM", "options": [
            ["Земля (dirt)", "dirt"], ["Дерево (wood)", "wood"],
            ["Дошки (planks)", "planks"], ["Камінь (stone)", "stone"],
            ["Цегла (bricks)", "bricks"], ["ТНТ (tnt)", "tnt"],
            ["Алмаз (diamond_item)", "diamond_item"],
            ["Золото (gold_ingot)", "gold_ingot"],
            ["Яблуко (apple)", "apple"], ["Стейк (cooked_steak)", "cooked_steak"],
            ["Палка (stick)", "stick"], ["Вугілля (coal)", "coal"],
            ["Стрижень блейза (blaze_rod)", "blaze_rod"] ]},
        { "type": "input_value", "name": "COUNT" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": P, "tooltip": "Player.giveItem(id, count)"
},
{
    "type": "eblan_give_custom",
    "message0": "🎒 видати свій id %1 × %2",
    "args0": [
        { "type": "input_value", "name": "ID" },
        { "type": "input_value", "name": "COUNT" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": P, "tooltip": "Player.giveItem(customId, count)"
},
{
    "type": "eblan_set_hp",
    "message0": "❤ встановити здоровʼя %1",
    "args0": [{ "type": "input_value", "name": "V" }],
    "previousStatement": null, "nextStatement": null,
    "colour": P, "tooltip": "Player.setHealth(v)"
},
{
    "type": "eblan_heal",
    "message0": "💚 вилікувати +%1 HP",
    "args0": [{ "type": "input_value", "name": "V" }],
    "previousStatement": null, "nextStatement": null,
    "colour": P, "tooltip": "Player.heal(v)"
},
{
    "type": "eblan_fly",
    "message0": "🕊 політ %1",
    "args0": [{ "type": "field_dropdown", "name": "VAL",
        "options": [["УВІМКНУТИ", "true"], ["ВИМКНУТИ", "false"]] }],
    "previousStatement": null, "nextStatement": null,
    "colour": P, "tooltip": "Player.setFlying(true/false)"
},
{
    "type": "eblan_teleport",
    "message0": "🌀 телепорт гравця x %1 y %2 z %3",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": P, "tooltip": "Player.setPos(x, y, z)"
}
]);
})();

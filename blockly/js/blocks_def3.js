/* EBLANKRAFT BLOCKLY — ч.2б: Світ */
(function () {
'use strict';
var W = 100;
Blockly.defineBlocksWithJsonArray([
{
    "type": "eblan_set_block",
    "message0": "🧱 поставити блок %1 на x %2 y %3 z %4",
    "args0": [
        { "type": "field_dropdown", "name": "B", "options": [
            ["Трава", "GRASS"], ["Земля", "DIRT"], ["Камінь", "STONE"],
            ["Цегла", "BRICKS"], ["Дошки", "PLANKS"], ["ТНТ", "TNT"],
            ["Алмаз-блок", "DIAMOND_BLOCK"], ["Золото-блок", "GOLD_BLOCK"],
            ["Світлокамінь", "GLOWSTONE"], ["Обсидіан", "OBSIDIAN"],
            ["Незеррак", "NETHERRACK"], ["Енд-камінь", "END_STONE"],
            ["Вода", "WATER"], ["Лава", "LAVA"], ["Бедрок", "BEDROCK"],
            ["Повітря", "AIR"] ]},
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": W, "tooltip": "World.setBlock(x, y, z, World.BLOCKS.*)"
},
{
    "type": "eblan_fill",
    "message0": "🏗 заповнити %1 від x %2 y %3 z %4 до x %5 y %6 z %7",
    "args0": [
        { "type": "field_dropdown", "name": "B", "options": [
            ["Трава", "GRASS"], ["Земля", "DIRT"], ["Камінь", "STONE"],
            ["Цегла", "BRICKS"], ["Дошки", "PLANKS"], ["ТНТ", "TNT"],
            ["Алмаз-блок", "DIAMOND_BLOCK"], ["Світлокамінь", "GLOWSTONE"],
            ["Повітря (очистити)", "AIR"] ]},
        { "type": "input_value", "name": "X1" },
        { "type": "input_value", "name": "Y1" },
        { "type": "input_value", "name": "Z1" },
        { "type": "input_value", "name": "X2" },
        { "type": "input_value", "name": "Y2" },
        { "type": "input_value", "name": "Z2" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": W, "tooltip": "World.setBlocks(...)"
},
{
    "type": "eblan_get_block",
    "message0": "🔍 блок на x %1 y %2 z %3",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "output": "Number", "colour": W,
    "tooltip": "World.getBlock(x, y, z) — id блока."
},
{
    "type": "eblan_tnt",
    "message0": "💥 ТНТ x %1 y %2 z %3 vx %4 vy %5 vz %6",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" },
        { "type": "input_value", "name": "VX" },
        { "type": "input_value", "name": "VY" },
        { "type": "input_value", "name": "VZ" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": W, "tooltip": "World.spawnTNT(x, y, z, vx, vy, vz)"
},
{
    "type": "eblan_explode",
    "message0": "💣 вибух x %1 y %2 z %3 радіус %4",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" },
        { "type": "input_value", "name": "R" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": W, "tooltip": "World.explode(x, y, z, r)"
},
{
    "type": "eblan_time",
    "message0": "🕐 час доби: %1 %2",
    "args0": [
        { "type": "field_dropdown", "name": "T", "options": [
            ["ранок (0.0)", "0.0"], ["день (0.25)", "0.25"],
            ["вечір (0.55)", "0.55"], ["ніч (0.9)", "0.9"] ]},
        { "type": "input_dummy" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": W, "tooltip": "World.setTime(v)"
}
]);
})();

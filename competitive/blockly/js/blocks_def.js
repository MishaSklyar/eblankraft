/* 🧩 EBLANKRAFT BLOCKLY — блоки ч.1: Мод / Події / Команди / Гра */
(function () {
'use strict';
var C = { MOD: 160, EVENT: 20, CMD: 260, GAME: 60 };
Blockly.defineBlocksWithJsonArray([
{
    "type": "eblan_mod",
    "message0": "🧩 Мод id %1 назва %2 %3 автор %4 версія %5 %6 при старті %7",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "my_blocky_mod" },
        { "type": "field_input", "name": "NAME", "text": "Мій блоковий мод" },
        { "type": "input_dummy" },
        { "type": "field_input", "name": "AUTHOR", "text": "Я" },
        { "type": "field_input", "name": "VERSION", "text": "1.0" },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "ONENABLE" }
    ],
    "colour": C.MOD,
    "tooltip": "Корінь мода. Сюди кладуться події та команди."
},
{
    "type": "eblan_event",
    "message0": "⚡ Подія %1 %2 робити %3",
    "args0": [
        {
            "type": "field_dropdown", "name": "EV",
            "options": [
                ["⏱ кожен тік (onTick dt)", "onTick"],
                ["💬 чат (onChat text)", "onChat"],
                ["⌨ клавіша (onKey code, down)", "onKey"],
                ["🧱 зламав блок (onBlockBreak x,y,z)", "onBlockBreak"],
                ["🧱 поставив блок (onBlockPlace x,y,z)", "onBlockPlace"],
                ["💔 отримав урон (onPlayerDamage amount)", "onPlayerDamage"],
                ["🔫 постріл (onAttack result)", "onAttack"],
                ["🚗 сів у транспорт (onVehicleEnter id)", "onVehicleEnter"],
                ["🚗 вийшов (onVehicleExit id)", "onVehicleExit"],
                ["🕊 політ вкл/викл (onFlyToggle flying)", "onFlyToggle"],
                ["🎮 зміна режиму (onGameModeChange mode)", "onGameModeChange"],
                ["🌐 мережа (onNetMessage ch, data)", "onNetMessage"]
            ]
        },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "DO" }
    ],
    "colour": C.EVENT,
    "tooltip": "Events.on(...) — змінні події доступні в тілі.",
    "previousStatement": null, "nextStatement": null
},
{
    "type": "eblan_on_enable",
    "message0": "🚀 При старті мода %1",
    "args0": [{ "type": "input_statement", "name": "DO" }],
    "colour": C.EVENT,
    "tooltip": "Код всередині onEnable в Mod.register.",
    "previousStatement": null, "nextStatement": null
},
{
    "type": "eblan_command",
    "message0": "💬 Команда %1 %2 робити з (текст, гравець) %3",
    "args0": [
        { "type": "field_input", "name": "CMD", "text": "/hello" },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "DO" }
    ],
    "colour": C.CMD,
    "tooltip": "Chat.addCommand — своя /команда. Всередині доступні text і sender.",
    "previousStatement": null, "nextStatement": null
},
{
    "type": "eblan_chat_say",
    "message0": "📣 сказати в чат %1 від %2",
    "args0": [
        { "type": "input_value", "name": "TEXT" },
        { "type": "field_input", "name": "SENDER", "text": "МОД" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": C.CMD,
    "tooltip": "Chat.say(text, sender)"
},
{
    "type": "eblan_toast",
    "message0": "🎮 тост-повідомлення %1",
    "args0": [{ "type": "input_value", "name": "TEXT" }],
    "previousStatement": null, "nextStatement": null,
    "colour": C.GAME,
    "tooltip": "Game.toast(text)"
},
{
    "type": "eblan_chat_msg",
    "message0": "💬 чат-повідомлення %1",
    "args0": [{ "type": "input_value", "name": "TEXT" }],
    "previousStatement": null, "nextStatement": null,
    "colour": C.GAME,
    "tooltip": "Game.chat(text)"
},
{
    "type": "eblan_gamemode",
    "message0": "🎮 режим гри: %1",
    "args0": [{
        "type": "field_dropdown", "name": "MODE",
        "options": [["✨ креатив (creative)", "creative"], ["🏕 виживання (survival)", "survival"]]
    }],
    "previousStatement": null, "nextStatement": null,
    "colour": C.GAME,
    "tooltip": "Player.setCreative(true/false)"
},
{
    "type": "eblan_particles",
    "message0": "✨ частинки x %1 y %2 z %3 блок %4 кількість %5",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" },
        { "type": "input_value", "name": "BT" },
        { "type": "input_value", "name": "N" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": C.GAME,
    "tooltip": "Game.spawnParticles(x, y, z, blockType, count)"
}
]);
window.EBLAN_COLORS = { MOD: 160, EVENT: 20, CMD: 260, GAME: 60, PLAYER: 200, WORLD: 100, SOUND: 300, MISC: 0, ECON: 45 };
})();

/* EBLANKRAFT BLOCKLY — ч.5: 🧱 Блоки та Регіони / 🎨 Кастомні Блоки / 🌐 Мережа (Networking) */
(function () {
'use strict';
var BLOCKS = 110, REGIONS = 160, NET = 190, CUST = 330;

Blockly.defineBlocksWithJsonArray([
/* ---------- 🧱 Блоки та Відкат (Rollback) ---------- */
{
    "type": "eblan_blocks_restore",
    "message0": "🧱 повернути блок на X: %1 Y: %2 Z: %3",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": BLOCKS,
    "tooltip": "Blocks.restore(x, y, z) — повертає попередній блок з історії (відкат руйнування/зміни)."
},
{
    "type": "eblan_blocks_get_prev",
    "message0": "🧱 попередній блок на X: %1 Y: %2 Z: %3",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "output": "Number",
    "colour": BLOCKS,
    "tooltip": "Blocks.getPrevious(x, y, z) — отримати ID блоку до останньої зміни."
},
{
    "type": "eblan_blocks_break",
    "message0": "🔨 зламати блок на X: %1 Y: %2 Z: %3 випадає предмет: %4",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" },
        { "type": "field_checkbox", "name": "DROP", "checked": true }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": BLOCKS,
    "tooltip": "Blocks.breakBlock(x, y, z, drop) — зламати блок з частинками та дропом."
},
{
    "type": "eblan_blocks_save_region",
    "message0": "💾 зберегти зліпок блоків назва: %1 %2 від X1: %3 Y1: %4 Z1: %5 %6 до X2: %7 Y2: %8 Z2: %9",
    "args0": [
        { "type": "field_input", "name": "NAME", "text": "arena" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "X1" },
        { "type": "input_value", "name": "Y1" },
        { "type": "input_value", "name": "Z1" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "X2" },
        { "type": "input_value", "name": "Y2" },
        { "type": "input_value", "name": "Z2" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": REGIONS,
    "tooltip": "Blocks.saveRegion(name, x1, y1, z1, x2, y2, z2) — зберегти стан зони в пам'ять."
},
{
    "type": "eblan_blocks_restore_region",
    "message0": "⏪ відновити зліпок блоків назва: %1",
    "args0": [
        { "type": "field_input", "name": "NAME", "text": "arena" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": REGIONS,
    "tooltip": "Blocks.restoreRegion(name) — миттєво відновити всі блоки у збереженій зоні."
},

/* ---------- 🛡️ Регіони та Привати ---------- */
{
    "type": "eblan_regions_protect",
    "message0": "🛡️ захистити регіон id: %1 %2 від X1: %3 Y1: %4 Z1: %5 %6 до X2: %7 Y2: %8 Z2: %9 %10 власник: %11 повідомлення: %12",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "spawn" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "X1" },
        { "type": "input_value", "name": "Y1" },
        { "type": "input_value", "name": "Z1" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "X2" },
        { "type": "input_value", "name": "Y2" },
        { "type": "input_value", "name": "Z2" },
        { "type": "input_dummy" },
        { "type": "field_input", "name": "OWNER", "text": "admin" },
        { "type": "field_input", "name": "MSG", "text": "§c[Регіон] Тут захищена зона!" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": REGIONS,
    "tooltip": "Regions.protect(...) — створити приват, захищений від руйнувань, встановлення та вибухів."
},
{
    "type": "eblan_regions_is_allowed",
    "message0": "чи дозволено %1 на X: %2 Y: %3 Z: %4",
    "args0": [
        { "type": "field_dropdown", "name": "ACTION", "options": [
            ["ламати (break)", "break"],
            ["ставити (place)", "place"],
            ["вибух (explode)", "explode"],
            ["взаємодію (interact)", "interact"],
            ["битву (pvp)", "pvp"]
        ]},
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "output": "Boolean",
    "colour": REGIONS,
    "tooltip": "Regions.isAllowed(action, x, y, z) — перевірити, чи дія дозволена в цій точці регіону."
},

/* ---------- 🎨 Кастомні Блоки ---------- */
{
    "type": "eblan_custom_block",
    "message0": "🎨 зареєструвати блок id: %1 назва: %2 %3 колір/текстура: %4 %5 твердий: %6 прозорий: %7 свічення: %8 %9 при взаємодії (ПКМ) %10",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "lucky_block" },
        { "type": "field_input", "name": "NAME", "text": "Лаки Блок" },
        { "type": "input_dummy" },
        { "type": "field_input", "name": "TEXTURE", "text": "#f1c40f" },
        { "type": "input_dummy" },
        { "type": "field_checkbox", "name": "SOLID", "checked": true },
        { "type": "field_checkbox", "name": "TRANSPARENT", "checked": false },
        { "type": "field_input", "name": "EMISSIVE", "text": "#000000" },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "ONINTERACT" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": CUST,
    "tooltip": "Blocks.register(...) — зареєструвати новий кастомний блок із текстурою/кольором та реакцією на ПКМ."
},
{
    "type": "eblan_texture_override",
    "message0": "🎨 замінити текстуру гри назва: %1 колір/URL: %2",
    "args0": [
        { "type": "field_input", "name": "NAME", "text": "glass" },
        { "type": "input_value", "name": "SPEC" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": CUST,
    "tooltip": "Textures.override(name, spec) — підмінити текстуру гри на новий колір, генератор або URL."
},

/* ---------- 🌐 Мережа (Networking Hooks) ---------- */
{
    "type": "eblan_net_hook_send",
    "message0": "🌐 при відправці пакету %1 %2 робити %3",
    "args0": [
        { "type": "field_dropdown", "name": "TYPE", "options": [
            ["будь-який (*)", "*"],
            ["атака (pvp_hit)", "pvp_hit"],
            ["злам блоку (block_break)", "block_break"],
            ["встановлення блоку (block_place)", "block_place"],
            ["вибух TNT (tnt_explode)", "tnt_explode"],
            ["чат (chat)", "chat"]
        ]},
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "DO" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": NET,
    "tooltip": "Net.hookSend(type, function(packet) ... end) — перехоплення вихідного пакету. Повернення 'СКАСУВАТИ ПАКЕТ' блокує дію!"
},
{
    "type": "eblan_net_hook_receive",
    "message0": "🌐 при отриманні пакету %1 %2 робити %3",
    "args0": [
        { "type": "field_dropdown", "name": "TYPE", "options": [
            ["будь-який (*)", "*"],
            ["атака (pvp_hit)", "pvp_hit"],
            ["злам блоку (block_break)", "block_break"],
            ["встановлення блоку (block_place)", "block_place"],
            ["вибух TNT (tnt_explode)", "tnt_explode"],
            ["чат (chat)", "chat"]
        ]},
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "DO" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": NET,
    "tooltip": "Net.hookReceive(type, function(packet, sender) ... end) — перехоплення вхідного пакету. 'СКАСУВАТИ ПАКЕТ' ігнорує урон/дію!"
},
{
    "type": "eblan_net_cancel_packet",
    "message0": "🚫 СКАСУВАТИ ПАКЕТ (відмінити дію/урон)",
    "previousStatement": null, "nextStatement": null,
    "colour": 0,
    "tooltip": "Повертає false — відміняє відправку або отримання поточного мережевого пакету."
},
{
    "type": "eblan_net_is_connected",
    "message0": "🌐 чи підключено до мультиплеєра",
    "output": "Boolean",
    "colour": NET,
    "tooltip": "Net.isConnected() — повертає true, якщо гравець у мультиплеєрі."
},
{
    "type": "eblan_net_is_host",
    "message0": "🌐 чи я сервер (хост)",
    "output": "Boolean",
    "colour": NET,
    "tooltip": "Net.isHost() — чи поточний клієнт є сервером."
},
{
    "type": "eblan_net_kick",
    "message0": "🚪 кікнути гравця peerId: %1 причина: %2",
    "args0": [
        { "type": "input_value", "name": "PEER" },
        { "type": "input_value", "name": "REASON" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": NET,
    "tooltip": "Net.kick(peerId, reason) — вигнати гравця з серверу (тільки хост)."
}
]);

// Додаємо нові категорії в тулбокс
window.EBLAN_TOOLBOX.contents.push(
    { "kind": "category", "name": "🧱 Регіони та Відкат", "colour": String(REGIONS), "contents": [
        { "kind": "block", "type": "eblan_blocks_restore" },
        { "kind": "block", "type": "eblan_blocks_get_prev" },
        { "kind": "block", "type": "eblan_blocks_break" },
        { "kind": "block", "type": "eblan_regions_protect" },
        { "kind": "block", "type": "eblan_regions_is_allowed" },
        { "kind": "block", "type": "eblan_blocks_save_region" },
        { "kind": "block", "type": "eblan_blocks_restore_region" }
    ]},
    { "kind": "category", "name": "🎨 Кастомні Блоки", "colour": String(CUST), "contents": [
        { "kind": "block", "type": "eblan_custom_block" },
        { "kind": "block", "type": "eblan_texture_override" }
    ]},
    { "kind": "category", "name": "🌐 Мережа (Networking)", "colour": String(NET), "contents": [
        { "kind": "block", "type": "eblan_net_hook_send" },
        { "kind": "block", "type": "eblan_net_hook_receive" },
        { "kind": "block", "type": "eblan_net_cancel_packet" },
        { "kind": "block", "type": "eblan_net_is_connected" },
        { "kind": "block", "type": "eblan_net_is_host" },
        { "kind": "block", "type": "eblan_net_kick" }
    ]}
);
})();

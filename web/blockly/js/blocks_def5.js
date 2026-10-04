/* EBLANKRAFT BLOCKLY — ч.4: 🖥 UI / 🧍 Движение / 📦 Предмети / 🧊 3D-моделі */
(function () {
'use strict';
// Колірні палітри в стилі Scratch:
// UI — фіолетово-синій, рух — синій (#4C97FF),
// предмети — рожевий (#FF6680), 3D-моделі — бірюзовий
var UI = 285, MOVE = 230, ITEMS = 350, MDL = 145;

Blockly.defineBlocksWithJsonArray([
/* ---------- 🖥 UI (міні-інтерфейс: заголовок / підзаголовок / текст) ---------- */
{
    "type": "eblan_ui_panel",
    "message0": "📺 панель id %1 заголовок %2 %3 x %4 y %5 ширина %6 висота %7 %8 додати %9",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "panel1" },
        { "type": "field_input", "name": "TITLE", "text": "🎩 Header" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "W" },
        { "type": "input_value", "name": "H" },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "DO" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": UI,
    "tooltip": "UI.createPanel — заголовок (Header) + панель."
},
{
    "type": "eblan_ui_subheader",
    "message0": "📺 панель з підзаголовком id %1 %2 заголовок %3 підзаголовок %4",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "panel2" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "TITLE" },
        { "type": "input_value", "name": "SUB" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": UI,
    "tooltip": "Панель, заголовок якої містить Header і Subheader через розрив рядка."
},
{
    "type": "eblan_ui_button",
    "message0": "📱 кнопка id %1 текст %2 %3 x %4 y %5 %6 по кліку %7",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "btn1" },
        { "type": "input_value", "name": "TEXT" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "CLICK" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": UI,
    "tooltip": "UI.createButton(id, text, function() ... end) — клік по кнопці викликає блоки всередині."
},
{
    "type": "eblan_ui_label",
    "message0": "🏷 текст id %1 %2 текст %3 розмір %4 %5 x %6 y %7",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "label1" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "TEXT" },
        { "type": "input_value", "name": "SIZE" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": UI,
    "tooltip": "UI.createLabel — рядок тексту (Subheader/контент) з розміром шрифту."
},
{
    "type": "eblan_ui_settext",
    "message0": "✏️ текст елемента %1 = %2",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "label1" },
        { "type": "input_value", "name": "TEXT" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": UI,
    "tooltip": "UI.setText(id, text) — оновити текст будь-якого елемента."
},
{
    "type": "eblan_ui_showhide",
    "message0": "👁 елемент %1 → %2",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "panel1" },
        { "type": "field_dropdown", "name": "ACTION",
            "options": [["показати", "show"], ["сховати", "hide"]] }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": UI,
    "tooltip": "UI.show(id) / UI.hide(id)."
},
{
    "type": "eblan_ui_style",
    "message0": "🎨 стиль елемента %1 %2 = %3",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "label1" },
        { "type": "field_dropdown", "name": "PROP",
            "options": [
                ["🎨 колір", "color"], ["⬛ фон", "background"],
                ["🔠 розмір шрифту", "fontSize"], ["⬅ позиція зліва", "left"],
                ["⬆ позиція зверху", "top"], ["↔ ширина", "width"],
                ["↕ висота", "height"]] },
        { "type": "input_value", "name": "VAL" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": UI,
    "tooltip": "UI.setStyle(id, prop, val) — змінити одну CSS-властивість."
},
{
    "type": "eblan_ui_clear",
    "message0": "🧹 очистити весь UI",
    "previousStatement": null, "nextStatement": null,
    "colour": UI,
    "tooltip": "UI.clear() — видалити всі панелі, кнопки і текст."
},
/* ---------- 🧍 Движение (рух гравця) ---------- */
{
    "type": "eblan_move_speed",
    "message0": "🏃 швидкість гравця %1",
    "args0": [{ "type": "input_value", "name": "V" }],
    "previousStatement": null, "nextStatement": null,
    "colour": MOVE,
    "tooltip": "Player.setSpeed(v) — швидкість ходьби (за замовч. 12)."
},
{
    "type": "eblan_move_velocity",
    "message0": "💨 імпульс швидкості x %1 y %2 z %3",
    "args0": [
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": MOVE,
    "tooltip": "Player.setVelocity(x, y, z) — толчок (напр. 0, 15, 0 = високий стрибок)."
},
{
    "type": "eblan_move_getvel",
    "message0": "⚡ швидкість (компонент %1)",
    "args0": [{ "type": "field_dropdown", "name": "PART",
        "options": [["X", "x"], ["Y", "y"], ["Z", "z"]] }],
    "output": "Number",
    "colour": MOVE,
    "tooltip": "Player.getVelocity().x/.y/.z — поточна швидкість по осі."
},
{
    "type": "eblan_physics",
    "message0": "⚙️ фізика %1 = %2",
    "args0": [
        { "type": "field_dropdown", "name": "FIELD",
            "options": [
                ["🦘 сила стрибка (jumpPower)", "jumpPower"],
                ["🌍 гравітація (gravity)", "gravity"],
                ["🚶 швидкість ходьби (walkSpeed)", "walkSpeed"],
                ["🏃 спринт (sprintSpeed)", "sprintSpeed"]] },
        { "type": "input_value", "name": "V" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": MOVE,
    "tooltip": "Physics.set(field, val) — змінює фізику гравця."
},
{
    "type": "eblan_physics_nofall",
    "message0": "🛡 без шкоди від падіння %1",
    "args0": [{ "type": "field_dropdown", "name": "VAL",
        "options": [["УВІМКНУТИ", "true"], ["ВИМКНУТИ", "false"]] }],
    "previousStatement": null, "nextStatement": null,
    "colour": MOVE,
    "tooltip": "Physics.set(\"noFallDamage\", true/false)."
},
{
    "type": "eblan_physics_reset",
    "message0": "♻️ скинути фізику до стандарту",
    "previousStatement": null, "nextStatement": null,
    "colour": MOVE,
    "tooltip": "Physics.reset() — повертає стандартні значення."
},

/* ---------- 📦 Предмети ---------- */
{
    "type": "eblan_items_register",
    "message0": "📦 новий предмет id %1 назва %2 %3 категорія %4 урон %5 колір %6",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "mega_sword" },
        { "type": "field_input", "name": "NAME", "text": "Мега-меч" },
        { "type": "input_dummy" },
        { "type": "field_dropdown", "name": "CATEGORY",
            "options": [
                ["⚔️ зброя", "weapon"], ["🔨 інструмент", "tool"],
                ["🍞 їжа", "food"], ["🧱 блок", "block"], ["📦 інше", "misc"]] },
        { "type": "input_value", "name": "DMG" },
        { "type": "field_dropdown", "name": "COLOR",
            "options": [
                ["🔴 червоний", "#e33"], ["🟠 помаранчевий", "#e83"],
                ["🟡 жовтий", "#ee3"], ["🟢 зелений", "#3c5"],
                ["🔵 синій", "#38e"], ["🟣 фіолетовий", "#94e"],
                ["⚪ сірий", "#888"], ["⚫ чорний", "#222"]] }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": ITEMS,
    "tooltip": "Items.register({id, name, category, attackDamage, color}) — реєструє предмет з піксельною іконкою."
},
{
    "type": "eblan_items_getid",
    "message0": "🔑 id предмета %1",
    "args0": [{ "type": "field_dropdown", "name": "ITEM",
        "options": [
            ["Земля (dirt)", "dirt"], ["Дерево (wood)", "wood"],
            ["Дошки (planks)", "planks"], ["Камінь (stone)", "stone"],
            ["Цегла (bricks)", "bricks"], ["ТНТ (tnt)", "tnt"],
            ["Алмазний блок (diamond_block)", "diamond_block"],
            ["Золотий блок (gold_block)", "gold_block"],
            ["Скло (glass)", "glass"], ["Пісок (sand)", "sand"],
            ["Світлокамінь (glowstone)", "glowstone"],
            ["Обсидіан (obsidian)", "obsidian"],
            ["Незеррак (netherrack)", "netherrack"],
            ["Енд-камінь (end_stone)", "end_stone"],
            ["Діамант (diamond_item)", "diamond_item"],
            ["Золото (gold_ingot)", "gold_ingot"],
            ["Слиток заліза (iron_ingot)", "iron_ingot"],
            ["Вугілля (coal)", "coal"], ["Палка (stick)", "stick"],
            ["Стрижень блейза (blaze_rod)", "blaze_rod"],
            ["Яблуко (apple)", "apple"], ["Стейк (cooked_steak)", "cooked_steak"],
            ["Порох (gunpowder)", "gunpowder"],
            ["Діамантовий меч (diamond_sword)", "diamond_sword"],
            ["Діамантова кирка (diamond_pickaxe)", "diamond_pickaxe"]] }],
    "output": "String",
    "colour": ITEMS,
    "tooltip": "Повертає рядок-id предмета для World.setBlock / Player.giveItem."
},

/* ---------- 🧊 3D-моделі (GLB/GLTF, як у паці ak47) ---------- */
{
    "type": "eblan_models_load",
    "message0": "🧊 завантажити 3D-модель id %1 %2 з URL %3 %4 завантажено %5",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "ak47" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "URL" },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "ONLOAD" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": MDL,
    "tooltip": "Models.load(id, url, cb) — завантажує .glb/.gltf. URL може бути https://... або ключ з .eblan-паку."
},
{
    "type": "eblan_models_spawn",
    "message0": "🧊 спавн моделі id %1 на x %2 y %3 z %4 %5 масштаб %6 поворот %7",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "ak47" },
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" },
        { "type": "input_dummy" },
        { "type": "input_value", "name": "SCALE" },
        { "type": "input_value", "name": "YAW" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": MDL,
    "tooltip": "Models.spawn(\"ak47\", x, y, z, {scale=..., yaw=...}) — модель має бути завантажена (пак .eblan або Models.load)."
},
{
    "type": "eblan_models_setpos",
    "message0": "📍 модель %1 → x %2 y %3 z %4",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "ak47" },
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": MDL,
    "tooltip": "Models.setPos(id, x, y, z) — пересунути модель по світу."
},
{
    "type": "eblan_models_setrot",
    "message0": "🔄 модель %1 обертання x %2 y %3 z %4",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "ak47" },
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": MDL,
    "tooltip": "Models.setRot(id, rx, ry, rz) — обертання в радіанах, yaw — це ry."
},
{
    "type": "eblan_models_setscale",
    "message0": "🔍 модель %1 масштаб x %2 y %3 z %4",
    "args0": [
        { "type": "field_input", "name": "ID", "text": "ak47" },
        { "type": "input_value", "name": "X" },
        { "type": "input_value", "name": "Y" },
        { "type": "input_value", "name": "Z" }
    ],
    "previousStatement": null, "nextStatement": null,
    "colour": MDL,
    "tooltip": "Models.setScale(id, sx, sy, sz) — масштаб по осях."
},
{
    "type": "eblan_models_remove",
    "message0": "🗑 видалити модель %1",
    "args0": [{ "type": "field_input", "name": "ID", "text": "ak47" }],
    "previousStatement": null, "nextStatement": null,
    "colour": MDL,
    "tooltip": "Models.remove(id) — прибрати модель зі світу."
}
]);

// Додаємо нові категорії в тулбокс (після існуючих)
window.EBLAN_TOOLBOX.contents.push(
    { "kind": "category", "name": "🖥 UI", "colour": String(UI), "contents": [
        { "kind": "block", "type": "eblan_ui_panel" },
        { "kind": "block", "type": "eblan_ui_subheader" },
        { "kind": "block", "type": "eblan_ui_button" },
        { "kind": "block", "type": "eblan_ui_label" },
        { "kind": "block", "type": "eblan_ui_settext" },
        { "kind": "block", "type": "eblan_ui_showhide" },
        { "kind": "block", "type": "eblan_ui_style" },
        { "kind": "block", "type": "eblan_ui_clear" } ] },
    { "kind": "category", "name": "🧍 Двигун", "colour": String(MOVE), "contents": [
        { "kind": "block", "type": "eblan_fly" },
        { "kind": "block", "type": "eblan_move_speed" },
        { "kind": "block", "type": "eblan_move_velocity" },
        { "kind": "block", "type": "eblan_move_getvel" },
        { "kind": "block", "type": "eblan_physics" },
        { "kind": "block", "type": "eblan_physics_nofall" },
        { "kind": "block", "type": "eblan_physics_reset" } ] },
    { "kind": "category", "name": "📦 Предмети", "colour": String(ITEMS), "contents": [
        { "kind": "block", "type": "eblan_items_register" },
        { "kind": "block", "type": "eblan_items_getid" },
        { "kind": "block", "type": "eblan_give" },
        { "kind": "block", "type": "eblan_give_custom" } ] },
    { "kind": "category", "name": "🧊 3D-моделі", "colour": String(MDL), "contents": [
        { "kind": "block", "type": "eblan_models_load" },
        { "kind": "block", "type": "eblan_models_spawn" },
        { "kind": "block", "type": "eblan_models_setpos" },
        { "kind": "block", "type": "eblan_models_setrot" },
        { "kind": "block", "type": "eblan_models_setscale" },
        { "kind": "block", "type": "eblan_models_remove" } ] }
);
})();
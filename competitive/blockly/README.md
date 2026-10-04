# 🧩 Eblankraft Blockly — конструктор Lua-модів

Окремий сайт на **Google Blockly** (як MakeCode): збираєш мод блоками →
отримуєш готовий **Lua-код** для Eblankraft.

## Запуск

```bash
python3 server.py        # з кореня гри, порт 8080
```

- 🎮 Гра: http://localhost:8080/
- 🧩 Конструктор: http://localhost:8080/blockly/

> ✅ Blockly лежить **локально** в `vendor/` (9.3.0) — інтернет **не потрібен**.
> Якщо `vendor/` видалено — спрацює CDN-fallback на `unpkg.com`.

## Зовнішній вигляд

- Блоки рендеряться **Zelos-рендерером Blockly** — округлі, «скретчівські»
  капелюшки й кольорова палітра як у Scratch (фірмовий синій `#4C97FF`).
- Тулбокс і робоче поле — світлі (Scratch-стиль), текст на блоках темний —
  жодних «біле на білому».
- Блоки знову скруглені й різнокольорові, як в scratch-blocks
  (github.com/scratchfoundation/scratch-blocks). Повноцінний scratch-blocks —
  це ESM-бандл без Lua-генератора; тут використано його візуальний стиль на
  стабільному Blockly 9.3.0 + власний Lua-генератор.

## Як зробити мод блоками

1. Зліва вибери категорію (🧩 Мод → ⚡ Події → 💬 Команди → 🎮/🧍/🌍…).
2. Почни з блоку **🧩 Мод** (поле `id` — латиницею, без пробілів).
3. Всередину поклади **⚡ Подію** (`onChat`, `onTick`…) або **💬 Команду** (`/hello`).
4. Додай дії: тост, видати предмет, блоки, ТНТ, таймери…
5. Lua-код справа генерується **автоматично** при кожній зміні.
6. Тисни **💾 Зберегти в гру** → відкрий гру → **🧩 Моди** → увімкни свій мод.

Той самий браузер = той самий `localStorage` (`eblankraft_lua_mods`) —
гра підхопить мод одразу, без копіпасти. На `file://` localStorage може бути
недоступний — тоді конструктор сам запропонує скачати `.lua` файл.

Додатково: **🔗 Поділитись** (посилання з блоками в `#xml=`),
**⬇ .lua**, **🧱 Експорт/📂 Імпорт блоків (.xml)**, **✔ Перевірити**
(синтаксис через Fengari Lua 5.3 з гри), **📦 Приклади**.

## Що всередині

| Файл | Призначення |
|---|---|
| `index.html` | сторінка конструктора (локальний vendor + CDN-fallback) |
| `vendor/` | Blockly 9.3.0 локально: blockly/blocks/lua + `msg/en` + media |
| `css/style.css` | Scratch-тема: світлий тулбокс, Zelos-блоки, нормальні шрифти |
| `js/lua_shim.js` | `EBLAN_GEN()` — єдиний доступ до Lua-генератора |
| `js/blocks_def*.js` | 51 блок: Мод / Події / Команди / Гра / Гравець / Світ / Звук / Таймер / Економіка **+ UI / Двигун / Предмети / 3D-моделі** |
| `js/blocks_gen*.js` | Lua-генератори (`gen[type] = fn`, API Blockly 9+: `workspaceToCode`) |
| `js/examples.js` | 4 приклади: `/nuke`, `/kit`, `/platform`, `/hud` |
| `js/app*.js` | генерація, перевірка (Fengari), збереження в гру, XML, share-link |
| `examples/*.lua` | ті самі приклади готовим Lua-кодом |

## API-мапінг (блок → Lua)

- 🧩 Мод → `Mod.register({id, name, version, author, onEnable})`
- ⚡ Подія → `Events.on("onChat|onTick|onKey|onBlockBreak|…", function(…) … end)`
- 💬 Команда → `Chat.addCommand("/x", function(text, sender) … end)`
- 🎮 тост / чат / частинки → `Game.toast / Game.chat / Game.spawnParticles`
- 🧍 координати → `local px, py, pz = Player.getPos()`; одна координата генерується
  компактно: `({Player.getPos()})[1]`, `[2]`, `[3]` (без IIFE-обгорток)
- 🧍 видати / HP / політ / телепорт → `Player.giveItem / setHealth / heal / setFlying / setPos`
- 🌍 блоки → `World.setBlock / setBlocks / getBlock / spawnTNT / explode / setTime`
- 🔊 звук → `Sound.gunshot / beep / horn / engine / screech`, озвучка → `Game.speak`
- 🏃 рух → `Player.setSpeed / setVelocity`, компонент швидкості через `Player.getVelocity().x/y/z`
- ⚙️ фізика → `Physics.set("jumpPower|gravity|walkSpeed|sprintSpeed|noFallDamage", v)` та `Physics.reset()`
- 📦 предмети → `Items.register({id, name, category, attackDamage, color})`, `Items.ITEMS.*`, `Player.giveItem`
- 🖥 міні-UI (Header/Subheader/текст) → `UI.createPanel / createButton(text, fn) / createLabel / setText / setStyle / show / hide / clear`
- 🧊 3D-моделі (GLB як `ak47`) → `Models.load(id, url, fn) / spawn(id, x, y, z, {scale, yaw}) / setPos / setRot / setScale / remove`

## Перевірено

- `node --check` всіх JS — OK
- Headless-тест (Blockly 9.3.0 npm + jsdom): 51 блок + 4 приклади → `workspaceToCode` — OK
- Lua-синтаксис прикладів через `lua5.3 loadfile` — OK

## Обмеження

- Стандартні блоки `text_print` генерують `print(...)` — у грі це консоль модів, ок.
- `vehicles`, `prop_hunt` — лише через блок «📝 свій Lua-код»
  (скопіюй приклад з `mods/readme.md`).

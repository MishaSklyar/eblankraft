# 🎮 EBLANKRAFT 2.0 - LUA MOD & SERVER API ДОКУМЕНТАЦІЯ

Мод-система Ебланкрафт 2.0 працює на повноцінному рушії **Lua 5.3** (Fengari Web).
Ви можете створювати власні сервери та ігрові режими, такі як **Prop Hunt** або **BlackRP (DarkRP)**, імпортувати 3D моделі (.glb/.gltf), налаштовувати економіку, роботу поліції, машини та мережеву синхронізацію!

---

## 🎭 1. `Models` — Імпорт та Спавн 3D Моделей (GLTF / GLB)
Дозволяє завантажувати тривимірні об'єкти формату `.glb` / `.gltf` з інтернету, локальних файлів або через вікно вибору файлів на комп'ютері:
- `Models.openPicker(callback)` — відкриває вікно вибору файлу `.glb` / `.gltf` з комп'ютера гравця та кешує під ім'ям файлу!
- `Models.load(name, url, callback)` — завантажити модель за URL-посиланням або DataURI/Base64.
- `Models.spawn(name, x, y, z, options)` — заспавнити модель у світі (`scale`, `yaw`, `pitch`, `animate`). Повертає `instanceId`.
- `Models.remove(instanceId)` — видалити заспавнену модель зі сцени.
- `Models.setPos(instanceId, x, y, z)` — перемістити екземпляр моделі.
- `Models.setRot(instanceId, yaw, pitch, roll)` — повернути екземпляр моделі.
- `Models.setScale(instanceId, sx, sy, sz)` — змінити масштаб моделі.
- `Models.playAnim(instanceId, animIndexOrName)` — запустити анімацію 3D моделі (Three.js AnimationMixer).
- `Models.attachCamera(instanceId, x, y, z, rx, ry, rz)` — прицепить модель к камере (FPS вьюмодель: не плавает).
- `Models.clear()` — видалити всі заспавнені моделі зі світу.

---

## 🎭 2. `Prop` — Система Prop Hunt (Маскування під блоки та моделі)
- `Prop.disguise(typeOrName, options)` — замаскувати гравця у блок (`"tnt"`, `"bookshelf"`, `12`) або в завантажену 3D модель (`"chair"`).
- `Prop.undisguise()` — зняти маскування та повернути скін гравця.
- `Prop.isDisguised()` — перевірити, чи гравець зараз замаскований.
- `Prop.lock(state)` — зафіксувати поворот предмета в просторі (щоб не крутився слідом за камерою).
- `Prop.isLocked()` — перевірити, чи заблоковано поворот.
- `Prop.taunt(soundName)` — видати звуковий сигнал (`"whistle"`, `"horn"`, `"beep"`), сповістити мисливців і створити ефект частинок!
- `Prop.blindHunters(seconds)` — увімкнути екран осліплення з таймером зворотного відліку для мисливців.
- `Prop.unblind()` — достроково прибрати екран осліплення.
- `Prop.getEyeTrace(maxDistance)` — визначити, на що дивиться гравець: відрізняє справжні блоки світу від замаскованих гравців-предметів!

---

## 🏙️ 3. `Economy` & `Jobs` — Економіка та Професії (BlackRP / DarkRP)
- `Economy.get()` — отримати поточний баланс гравця в доларах ($).
- `Economy.set(amount)` — встановити баланс.
- `Economy.add(amount)` — нарахувати гроші (відтворює звук дзвіночка).
- `Economy.take(amount)` — списати гроші.
- `Economy.canAfford(amount)` — перевірити, чи вистачає коштів.
- `Economy.drop(amount, x, y, z)` — скинути готівку у 3D світі, яку може підібрати будь-який гравець!
- `Jobs.register(jobId, data)` — зареєструвати професію (`name`, `salary`, `color`, `weapons`, `description`).
- `Jobs.set(jobId)` — змінити професію локального гравця (наприклад `"police"`, `"dealer"`, `"mayor"`, `"citizen"`).
- `Jobs.get()` — отримати поточну професію гравця.
- Зарплата нараховується щохвилини автоматично з повідомленням у HUD!

---

## 🚪 4. `Doors` & `Draw3D` — Двері та 3D Написи над Об'єктами
- `Doors.setOwner(x, y, z, ownerName)` — встановити власника дверей (з'являється 3D табличка над дверима).
- `Doors.lock(x, y, z)` — зачинити двері на замок.
- `Doors.unlock(x, y, z)` — відчинити двері.
- `Doors.isLocked(x, y, z)` — перевірити статус замка.
- `Draw3D.addText(id, text, x, y, z, options)` — розмістити тривимірний плаваючий білборд-текст у світі (`size`, `color`, `bgColor`, `borderColor`).
- `Draw3D.updateText(id, newText)` — динамічно оновити текст у реальному часі.
- `Draw3D.removeText(id)` — видалити напис.
- `Draw3D.clear()` — очистити всі 3D написи.

---

## 🖨️ 5. `Entities` — Інтерактивні сутності
- `Entities.spawnPrinter(x, y, z, options)` — заспавнити грошовий принтер, який періодично генерує гроші з плаваючим 3D індикатором балансу.
- `Entities.dropMoney(amount, x, y, z)` — заспавнити пачку грошей.
- `Entities.remove(entityId)` — видалити сутність.

---

## ⏱️ 6. `Timer` & `Teams` — Таймери та Команди
- `Timer.simple(delaySeconds, callback)` — одноразовий таймер через X секунд.
- `Timer.create(id, intervalSeconds, repeats, callback)` — періодичний таймер (`repeats = 0` для нескінченного).
- `Timer.remove(id)` — скасувати таймер.
- `Teams.create(teamId, { name, color, score })` — створити команду (наприклад `"hunters"`, `"props"`).
- `Teams.set(player, teamId)` — призначити гравця в команду.
- `Teams.get(player)` — дізнатися команду гравця.
- `Teams.setScore(teamId, score)` / `Teams.getScore(teamId)` — очки команди.

---

## 💬 7. `Chat` & `Net` — Чат-команди та Мережа (Multiplayer)
- `Chat.addCommand(cmd, function(argsStr, argsList) ... end)` — реєстрація слеш-команд для чату (наприклад `/job`, `/buy`, `/prop`, `/taunt`).
- `Chat.say(text, sender)` — надіслати повідомлення всім гравцям у мультиплеєрі.
- `Net.send(channel, dataTable)` — надіслати кастомний мережевий пакет усім підключеним клієнтам.
- `Net.receive(channel, function(payload, senderPeerId) ... end)` — обробка отриманого мережевого пакету.

---

## 👤 8. Розширення `Player`
Всі ключові функції тепер доступні прямо через об'єкт `Player`:
- `Player.disguise(type)` / `Player.undisguise()` / `Player.isDisguised()`
- `Player.lockProp(state)` / `Player.taunt(sound)` / `Player.getEyeTrace()`
- `Player.getMoney()` / `Player.setMoney(val)` / `Player.addMoney(val)` / `Player.takeMoney(val)` / `Player.canAfford(val)`
- `Player.setJob(jobId)` / `Player.getJob()`
- `Player.arrest(durationSeconds)` / `Player.unarrest()` / `Player.isArrested()`
- `Player.setWanted(true/false, reason)` / `Player.isWanted()`
- `Player.setFOV(fov)` / `Player.getFOV()` — керування кутом огляду камери (наприклад для прицілювання через мушку/оптику).
- `Player.isThirdPerson()` — чи вид від 3-ї особи.
- `Player.setHandVisible(bool)` — сховати/показати руку с предметом (под вьюмодель).
- `Player.isMouseDown(button)` — перевірка затискання кнопок миші (0 - ЛКМ, 1 - СКМ, 2 - ПКМ).
- `Player.shoot(options)` — швидкий виклик стрільби.

---

## 🔫 9. `Items` & `Weapons` — Реєстрація Предметів, Вогнепальної Зброї та Балістика
- `Items.register({ id, name, category, maxStack, attackDamage, pixels, colors, color, draw })`:
  - Дозволяє реєструвати кастомні предмети та зброю безпосередньо з Lua!
  - `pixels` — масив з 16 рядків для створення 16x16 ретро піксель-арту.
  - `colors` — таблиця відповідності символів кольорам (наприклад `["#"] = "#222", ["W"] = "#8b4513"`).
  - Автоматично генерує текстуру, CanvasTexture, іконку для інвентаря/хотбару та 3D модель у руці гравця.
- `Weapons.shoot(options)`:
  - Прораховує рейкаст-постріл кулі з фізичним розсіюванням (`spread`), віддачею камери (`recoilPitch`, `recoilYaw`), кольоровими трасерами куль (`tracerColor`), звуком та ефектом частинок при влучанні!
  - Вражає Ендер Дракона, мобів (зомбі, скелети, павуки тощо), гравців у PvP та блоки світу.
  - Повертає таблицю з результатом влучання `{ hit = true/false, type = "mob"|"dragon"|"player"|"block", distance = ... }`.

---

## 🔊 10. `Sound` — Процедурний Аудіо-Синтезатор (Web Audio API)
- `Sound.gunshot(pitch, volume)` — потужний звук пострілу з відлунням та ударом.
- `Sound.reload(stage)` — клацання затвору та магазину (`"mag_out"`, `"mag_in"`, `"bolt"`, `"click"`).
- `Sound.dryFire()` — клацання спускового гачка при порожньому магазині.
- `Sound.horn(duration)` / `Sound.screech(duration)` — автомобільний клаксон та вереск гальм.
- `Sound.engine(rpm, volume)` / `Sound.stopEngine()` — ревіння двигуна.
- `Sound.beep(freq, duration)` / `Sound.tone(freq, duration, type)` — тональні сигнали.

---

## 👾 11. `Mobs` — Пошук та урон мобам (для турелей)
- `Mobs.getNearby(x, y, z, r)` — список мобів і дракона в радіусі: `{ id, type, x, y, z, dist, hp }`.
- `Mobs.damage(id, dmg, kx, kz)` — завдати шкоди (`kx, kz` — напрямок відкидання).
- `Player.getRotation()` — повертає `yaw, pitch` камери (для вьюмоделей/прицілів).

## 🐇 12. `Physics` — Физика игрока (гравитация, прыжки, бхоп)
- `Physics.get()` — `{ gravity, jumpPower, walkSpeed, sprintSpeed, jumpCooldown, noFallDamage, onGround }` (дефолты 22.0 / 8.5 / 4.5 / 7.5 / 0.18).
- `Physics.set("gravity", 9)` / `("jumpPower", 11)` / `("walkSpeed", 6)` / `("sprintSpeed", 9)` / `("jumpCooldown", 0.1)` / `("noFallDamage", true)` — `nil` сбрасывает поле.
- `Physics.reset()` — обычная физика. Те же поля крутят слайдеры паузы (ESC → Фізика).
- ⚠️ Lua-таблицы не доезжают до JS (особенность fengari) — только скалярные вызовы! Держать ПРОБЕЛ = автобхоп (jump-buffer в движке).

## 📦 13. Готові моди в папці `mods/`
- `bhop.lua` — бхоп + пресеты физики: `/bhop on|off|classic|lunar|surf|quake`.
- `automation.lua` — редстоун-проще: рычаг `/lever`, провод, лампа, NOT/AND, конвейер `/belt n|s|e|w`, турель (бьёт мобов в радиусе 12 при питании), бур (копает руду 3×3×5 вниз, дроп в инвентарь). Набор: `/auto kit`.
- `mounts.lua` — маунты: `/tame dragon|beetle|mecha [имя]` (дань + шанс), `/stable`, `/call <номер>`, `/whistle`. Модели `dragon.glb`/`beetle.glb`/`mecha.glb` из .eblan садятся сами.
- `ak47.lua` v2.1 — при импорте `ak47.eblan` в руках 3D-модель (Sketchfab) вместо плоской.
- `no_pvp.lua` — мирный режим (отключение PvP): блокирует исходящие и входящие пакеты атак через Networking API. Команда `/pvp on|off|toggle`.

---

## 🧱 14. `Blocks` — Керування Блоками, Історія та Відкат (Rollback)
Рушій веде стек історії кожного блоку світу. Якщо блок зламано або замінено, його можна миттєво повернути назад без перезавантаження світу або чанків:

- `Blocks.get(x, y, z)` — отримати числовий ID типу блоку за координатами.
- `Blocks.getName(x, y, z)` — отримати назву блоку (наприклад `"stone"`, `"diamond_block"`).
- `Blocks.getInfo(blockType)` — отримати повну інформацію про блок (`name`, `solid`, `transparent`, `dropItem`, `dropCount`, `isCustom`).
- `Blocks.set(x, y, z, blockType)` — встановити блок у координатах.
- `Blocks.restore(x, y, z)` (або `Blocks.revert(x, y, z)`) — **повернути попередній блок** із історії змін (відновлює зруйнований блок, оновлює геометрію чанка та синхронізує у мультиплеєрі).
- `Blocks.getPrevious(x, y, z)` — дізнатися, який блок був на цьому місці до останньої зміни.
- `Blocks.breakBlock(x, y, z, dropItem)` — програмно зламати блок із спавном частинок руйнування та предмету.
- `Blocks.fill(x1, y1, z1, x2, y2, z2, blockType)` — заповнити паралелепіпед блоками заданого типу.
- `Blocks.isSolid(blockType)` / `Blocks.isTransparent(blockType)` — перевірка фізичної твердості та прозорості.
- `Blocks.createSnapshot(name, x1, y1, z1, x2, y2, z2)` / `Blocks.saveRegion(...)` — зберегти зліпок зони у пам'ять.
- `Blocks.restoreSnapshot(name)` / `Blocks.restoreRegion(...)` — миттєво відновити всі блоки у збереженій зоні.
- `Blocks.TYPES` — таблиця стандартних та зареєстрованих ID блоків (`Blocks.TYPES.DIAMOND_BLOCK`, `Blocks.TYPES.GRASS` тощо).

### Приклад 1: Миттєве повернення зламаного блоку (Grief-Protection)
```lua
Events.on("block_break", function(e)
    -- e: { x = x, y = y, z = z, type = type, player = player }
    if Regions.isAllowed("break", e.x, e.y, e.z, e.player) == false then
        Blocks.restore(e.x, e.y, e.z) -- повертаємо блок назад!
        Game.toast("§c[Захист] Цей блок не можна ламати!")
        return false -- блокуємо подію
    end
end)
```

---

## 🛡️ 15. `Regions` — Привати, Захищені Зони та Регіони
Система регіонів захищає будівлі від руйнування, встановлення блоків, вибухів TNT та кріперів, а також взаємодій:

- `Regions.create(options)` — створити повноцінний регіон із прапорцями:
  - `id` — унікальний текстовий ідентифікатор.
  - `min = { x, y, z }`, `max = { x, y, z }` — координати меж регіону.
  - `owner` — ім'я власника.
  - `allowBreak`, `allowPlace`, `allowExplosion`, `allowInteract` — булеві прапорці дозволу дій (`true`/`false`).
  - `message` — сповіщення, якщо дія заборонена.
  - `onBreak(x, y, z, type, player)`, `onPlace(...)`, `onInteract(...)` — кастомні Lua-колбеки.
- `Regions.protect(id, x1, y1, z1, x2, y2, z2, owner, message)` — швидке створення повністю захищеного привату.
- `Regions.remove(id)` — видалити захищений регіон.
- `Regions.get(x, y, z)` — знайти регіон у цій точці світу.
- `Regions.list()` — отримати список усіх зареєстрованих регіонів.
- `Regions.isAllowed(action, x, y, z, player)` — перевірити правомірність дії (`"break"`, `"place"`, `"explode"`, `"interact"`).
- `Regions.saveBlocks(name, x1, y1, z1, x2, y2, z2)` / `Regions.restoreBlocks(name)` — збереження та відновлення стану блоків для арени або міні-ігор.

### Приклад 2: Створення привату Спавну через команду
```lua
Chat.addCommand("protect_spawn", function()
    Regions.protect("spawn", -30, 0, -30, 30, 128, 30, "admin", "§c[Спавн] Зона захищена від руйнувань!")
    Game.toast("§aРегіон спавну захищено!")
end)
```

---

## 🎨 16. `Custom Blocks` & `Textures` — Кастомні Блоки, Текстури та Піксель-Арт
Дозволяє додавати власні унікальні блоки в гру, задавати їм різні текстури на кожну грань куба, кольори свічення, прозорість, фізику та колбеки взаємодії:

- `Blocks.register(options)` — реєстрація нового блоку:
  - `id` — рядковий ключ (наприклад `"cyber_box"`).
  - `name` — ім'я блоку в інвентарі.
  - `texture` — єдина текстура для всіх 6 граней куба (HEX-колір, URL, base64, генератор або таблиця пікселів).
  - `textures` — окремі текстури для граней:
    - `{ top = ..., bottom = ..., side = ... }` (стиль трави / кактуса / печі).
    - Або для кожної з 6 сторін окремо: `{ posX, negX, posY, negY, posZ, negZ }`.
  - `transparent` — чи прозорий блок (як скло або листя).
  - `solid` — чи твердий блок (якщо `false`, гравець проходить крізь нього).
  - `emissive` — колір світіння у темряві (наприклад `"#00ffff"`).
  - `dropItem` — ID предмету, що випадає при руйнуванні.
  - `dropCount` — кількість предметів, що випадає.
  - `onInteract(x, y, z)` — виклик при кліку ПКМ по блоку.
  - `onBreak(x, y, z)` — виклик при руйнуванні блоку.
  - `onPlace(x, y, z)` — виклик при встановленні блоку.
  - `onStep(x, y, z)` — виклик, коли гравець наступає на блок.

- `Textures.register(name, spec, opts)` — зареєструвати перевикористовувану текстуру в менеджері текстур.
- `Textures.override(targetName, spec)` — замінити стандартну текстуру гри (наприклад замінити текстуру скла чи трави).

### Формати текстур (`spec`):
1. **Звичайний колір**: `"#ff0055"` або `"rgb(255, 0, 100)"`.
2. **Зовнішнє посилання / Base64**: `"https://example.com/texture.png"` або `"data:image/png;base64,..."`. Текстура завантажується та автоматично оновлює куби в сцені!
3. **Процедурні патерни**: `{ type = "hazard", base = "#ffcc00", stripe = "#111111" }`, `{ type = "noise", base = "#222" }`, `{ type = "grid", color = "#444" }`.
4. **Ретро Піксель-Арт (16x16 або 8x8)**:
```lua
Blocks.register({
    id = "lucky_block",
    name = "Лаки Блок",
    textures = {
        top = "#f1c40f",
        bottom = "#d4ac0d",
        side = {
            pixels = {
                "################",
                "#YYYYYYYYYYYYYY#",
                "#YY....??....YY#",
                "#YY...????...YY#",
                "#YY..??..??..YY#",
                "#YY......??..YY#",
                "#YY.....??...YY#",
                "#YY....??....YY#",
                "#YY....??....YY#",
                "#YY..........YY#",
                "#YY....??....YY#",
                "#YY....??....YY#",
                "#YYYYYYYYYYYYYY#",
                "################"
            },
            colors = {
                ["#"] = "#b7950b",
                ["Y"] = "#f1c40f",
                ["?"] = "#ffffff",
                ["."] = "#f39c12"
            }
        }
    },
    emissive = "#f1c40f",
    onInteract = function(x, y, z)
        Game.toast("§eВам випав Лаки-приз!")
        Sound.beep(1200, 0.2)
        Blocks.set(x, y, z, Blocks.TYPES.DIAMOND_BLOCK)
    end
})
```

---

## 🌐 17. `Net` — Повний Networking API: Перехоплення, Фільтрація та Скасування Пакетів
Тепер моди мають повний низькорівневий та високорівневий доступ до всієї мережевої підсистеми мультиплеєра. Можна перехоплювати як вихідні пакети (до їх відправлення в мережу), так і вхідні пакети (до їх обробки грою):

### Методи перехоплення (Hooks):
- `Net.hookSend([packetType], callback)` — перехопити **вихідний пакет** перед відправкою.
  - Якщо колбек повертає `false` — **відправка пакету скасовується (packet drop)**!
  - Якщо повертає змінену таблицю — пакет підміняється новими даними прямо «на льоту».
  - Якщо `packetType` не вказано — перехоплює взагалі всі вихідні пакети.
- `Net.hookReceive([packetType], callback)` — перехопити **вхідний пакет** перед виконанням грою.
  - Якщо колбек повертає `false` — **пакет ігнорується грою (не наносить урон, не ламає блоки тощо)**.
  - Якщо повертає таблицю — гра отримує модифікований пакет.
- `Events.on("packet_send", function(packet, targetPeerId) ... end)` — подія перед відправкою (повернення `false` скасовує пакет).
- `Events.on("packet_receive", function(packet, senderPeerId) ... end)` — подія при отриманні пакету.

### Методи керування та відправки:
- `Net.send(channel, payload)` — відправити повідомлення у кастомний канал (для модів).
- `Net.sendTo(peerId, channel, payload)` — надіслати повідомлення конкретному гравцю.
- `Net.receive(channel, callback)` — підписатися на повідомлення з каналу.
- `Net.sendRaw(packet, [targetPeerId])` — відправити будь-який низькорівневий мережевий пакет.
- `Net.broadcastRaw(packet)` — транслювати низькорівневий пакет усім підключеним клієнтам.
- `Net.simulatePacket(packet, [senderPeerId])` — зімітувати отримання пакету локальним клієнтом.
- `Net.isConnected()` / `Net.isHost()` — перевірка статусу підключення та чи є клієнт хостом (сервером).
- `Net.getPeerId()` / `Net.getHostPeerId()` — отримати локальний ID та ID хоста.
- `Net.getPeers()` — список підключених вузлів `{ id, name, open }`.
- `Net.getPlayers()` — список усіх гравців на сервері `{ peerId, name, isLocal, isHost, health, x, y, z }`.
- `Net.kick(peerId, reason)` — вигнати гравця з сервера (тільки хост).
- `Net.disconnect()` — від'єднатися від мультиплеєра.
- `Net.PACKETS` — константи типів пакетів (`PVP_HIT`, `BLOCK_PLACE`, `BLOCK_BREAK`, `TNT_EXPLODE`, `CHAT`, `PLAYER_STATE`, `SKIN_CHANGE`, `PLAYER_LEAVE`, `WORLD_INIT`, `MOD_NET`).

---

### Приклади використання Networking API

#### Приклад 1: Відміна пакету атаки (якщо гравець б'є ворога)
```lua
-- Забороняємо атакувати взагалі (або в мирній зоні)
Net.hookSend(Net.PACKETS.PVP_HIT, function(packet)
    -- packet = { type = "pvp_hit", targetId = "...", damage = 15, attackerName = "..." }
    Game.toast("§c[PvP] Атака заборонена правилами сервера!")
    return false -- ВІДМІНЯЄ ПАКЕТ АТАКИ! Куля/удар не пройде
end)
```

#### Приклад 2: Захист від вхідного урону (Безсмертя в безпечній зоні)
```lua
-- Якщо інший гравець атакує нас у приваті або спавні:
Net.hookReceive(Net.PACKETS.PVP_HIT, function(packet, senderPeerId)
    local px, py, pz = Player.getX(), Player.getY(), Player.getZ()
    if Regions.isAllowed("pvp", px, py, pz) == false then
        Game.toast("§aРегіон заблокував урон від " .. (packet.attackerName or "гравця") .. "!")
        return false -- ВІДМІНЯЄ ПАКЕТ УРОНУ! Гравець не отримає ушкоджень
    end
end)
```

#### Приклад 3: Модифікація пакету (Критичний урон)
```lua
Net.hookSend("pvp_hit", function(packet)
    -- Збільшуємо урон у 2.5 рази і додаємо повідомлення
    packet.damage = packet.damage * 2.5
    Game.toast("§6[КРИТИЧНИЙ УДАР] Урон: " .. math.floor(packet.damage))
    return packet -- відправляємо модифікований пакет!
end)
```

#### Приклад 4: Заборона відправки пакетів руйнування блоків на висоті нижче 5
```lua
Net.hookSend("block_break", function(packet)
    if packet.y < 5 then
        Game.toast("§cНе можна руйнувати блоки на такій глибині!")
        return false -- блокуємо мережевий пакет ломання блоку
    end
end)
```


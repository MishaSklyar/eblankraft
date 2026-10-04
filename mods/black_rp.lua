-- =========================================================
-- 🏙️ BLACKRP / DARKRP GAME MODE FOR EBLANKRAFT 2.0
-- Рольовий міський режим з економікою, професіями та дверима
-- =========================================================

Mod.register({
    id = "black_rp",
    name = "🏙️ BlackRP (DarkRP Місто & Економіка)",
    version = "1.0",
    author = "Eblankraft Server Systems",
    description = "Повноцінний DarkRP сервер: професії (Поліція, Мер, Торговець зброєю, Громадянин), купівля та замикання дверей, грошові принтери, зарплата та розшук!",

    onEnable = function()
        Game.toast("🏙️ BlackRP активовано! Введіть /rp для команд")
        Game.chat("🏙️ Ласкаво просимо на BlackRP сервер! Початковий капітал: $500. Введіть /rp для довідки.", "СИСТЕМА")
    end,

    onDisable = function()
        Draw3D.clear()
        Game.toast("🏙️ BlackRP вимкнено.")
    end
})

-- 1. Реєстрація професій
Jobs.register("citizen", {
    name = "Громадянин",
    color = "#4caf50",
    salary = 50,
    description = "Звичайний мешканець міста. Може заробляти гроші та купувати нерухомість."
})

Jobs.register("police", {
    name = "Поліцейський",
    color = "#2196f3",
    salary = 120,
    weapons = {"iron_sword"},
    description = "Охороняє місто, арештовує злочинців (/arrest) та захищає закон."
})

Jobs.register("dealer", {
    name = "Торговець Зброєю",
    color = "#ff9800",
    salary = 90,
    weapons = {"diamond_sword"},
    description = "Продає зброю та амуніцію жителям міста."
})

Jobs.register("mayor", {
    name = "Мер Міста",
    color = "#e91e63",
    salary = 250,
    description = "Керує містом, оголошує надзвичайний стан та подає гравців у розшук (/wanted)."
})

-- 2. Довідка по командах
Chat.addCommand("/rp", function()
    Game.chat("📋 BLACKRP КОМАНДИ:", "СИСТЕМА")
    Game.chat("  /job <citizen|police|dealer|mayor> - змінити професію", "СИСТЕМА")
    Game.chat("  /buy - купити двері перед вами ($100)", "СИСТЕМА")
    Game.chat("  /sell - продати свої двері", "СИСТЕМА")
    Game.chat("  /lock або /unlock - зачинити/відчинити свої двері", "СИСТЕМА")
    Game.chat("  /buyprinter - купити грошовий принтер ($200)", "СИСТЕМА")
    Game.chat("  /dropmoney <сума> - скинути готівку на землю", "СИСТЕМА")
    Game.chat("  /money - перевірити свій баланс", "СИСТЕМА")
    Game.chat("  /wanted <причина> - оголосити розшук (Мер/Поліція)", "СИСТЕМА")
end)

-- 3. Баланс та зміна професії
Chat.addCommand("/money", function()
    local bal = Economy.get()
    Game.chat("💵 Ваш поточний баланс: $" .. bal, "БАНК")
    Game.toast("💵 Баланс: $" .. bal)
end)

Chat.addCommand("/job", function(args)
    local j = string.lower(args or "")
    if j == "police" or j == "cop" then
        Player.setJob("police")
        Game.chat("👮 Ви влаштувалися в Поліцію! Зарплата: $120/хв.", "РОБОТА")
    elseif j == "dealer" or j == "gun" then
        Player.setJob("dealer")
        Game.chat("🔫 Ви тепер Торговець Зброєю! Зарплата: $90/хв.", "РОБОТА")
    elseif j == "mayor" then
        Player.setJob("mayor")
        Game.chat("🏛️ Ви обрані Мером Міста! Зарплата: $250/хв.", "РОБОТА")
    else
        Player.setJob("citizen")
        Game.chat("👤 Ви повернулися до цивільного життя як Громадянин. Зарплата: $50/хв.", "РОБОТА")
    end
end)

-- 4. Система дверей (Купівля, продаж, замикання)
Chat.addCommand("/buy", function()
    local px, py, pz = Player.getPos()
    local dx, dy, dz = math.floor(px), math.floor(py), math.floor(pz) + 2
    
    if Economy.canAfford(100) then
        Economy.take(100)
        Doors.setOwner(dx, dy, dz, "Ви")
        Sound.beep(700, 0.1)
        Game.toast("🔑 Двері успішно куплено за $100!")
        Game.chat("🔑 Ви придбали ці двері. Використовуйте /lock та /unlock для керування.", "НЕРУХОМІСТЬ")
    else
        Game.toast("❌ Недостатньо коштів! Двері коштують $100.")
    end
end)

Chat.addCommand("/sell", function()
    local px, py, pz = Player.getPos()
    local dx, dy, dz = math.floor(px), math.floor(py), math.floor(pz) + 2
    Doors.setOwner(dx, dy, dz, nil)
    Economy.add(80)
    Sound.beep(500, 0.1)
    Game.toast("💵 Двері продано за $80 (80% вартості)!")
end)

Chat.addCommand("/lock", function()
    local px, py, pz = Player.getPos()
    local dx, dy, dz = math.floor(px), math.floor(py), math.floor(pz) + 2
    Doors.lock(dx, dy, dz, true)
    Game.toast("🔒 Двері зачинено на замок!")
end)

Chat.addCommand("/unlock", function()
    local px, py, pz = Player.getPos()
    local dx, dy, dz = math.floor(px), math.floor(py), math.floor(pz) + 2
    Doors.unlock(dx, dy, dz)
    Game.toast("🔓 Двері відчинено!")
end)

-- 5. Грошовий принтер та скидання готівки
Chat.addCommand("/buyprinter", function()
    if Economy.canAfford(200) then
        Economy.take(200)
        local px, py, pz = Player.getPos()
        Entities.spawnPrinter(px + 1, py, pz + 1, { max = 1000, rate = 25 })
        Sound.beep(950, 0.15)
        Game.toast("🖨️ Грошовий принтер встановлено! Він друкує $25 кожні 8 сек.")
        Game.chat("🖨️ Ви встановили принтер. Підходьте і забирайте накопичену готівку!", "БІЗНЕС")
    else
        Game.toast("❌ Принтер коштує $200! У вас недостатньо коштів.")
    end
end)

Chat.addCommand("/dropmoney", function(args)
    local amount = tonumber(args) or 50
    if amount <= 0 then return end

    if Economy.canAfford(amount) then
        Economy.take(amount)
        local px, py, pz = Player.getPos()
        Entities.dropMoney(amount, px + 1, py, pz)
        Sound.beep(600, 0.08)
        Game.toast("💵 Ви скинули $" .. amount .. " на землю!")
    else
        Game.toast("❌ У вас немає стільки грошей для скидання!")
    end
end)

-- 6. Поліція та розшук
Chat.addCommand("/wanted", function(args)
    local job = Player.getJob()
    if not job or (job.id ~= "police" and job.id ~= "mayor") then
        Game.toast("❌ Тільки Поліція або Мер можуть оголошувати розшук!")
        return
    end
    local reason = args ~= "" and args or "Порушення громадського порядку"
    Player.setWanted(true, reason)
    Game.chat("🚨 УВАГА ВСІМ! Оголошено розшук: " .. reason, "ПОЛІЦІЯ")
end)

Chat.addCommand("/arrest", function()
    local job = Player.getJob()
    if not job or job.id ~= "police" then
        Game.toast("❌ Тільки Поліція може арештовувати!")
        return
    end
    Player.arrest(45)
    Game.chat("👮 Поліція заарештувала правопорушника на 45 секунд!", "ПОЛІЦІЯ")
end)

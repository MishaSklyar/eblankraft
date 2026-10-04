-- =========================================================
-- 🎭 PROP HUNT GAME MODE FOR EBLANKRAFT 2.0
-- Режим хованок: Мисливці проти Предметів (Prop Hunt)
-- =========================================================

Mod.register({
    id = "prop_hunt",
    name = "🎭 Prop Hunt (Хованки: Предмети проти Мисливців)",
    version = "1.0",
    author = "Eblankraft Server Systems",
    description = "Повноцінний режим Prop Hunt: маскування в блоки та 3D GLTF/GLB моделі, свист (/taunt або T), блокування повороту (F), осліплення мисливців та покарання за промахи!",

    onEnable = function()
        Game.toast("🎭 Режим Prop Hunt УВІМКНЕНО! Введіть /ph для довідки")
        Game.chat("🎭 Ласкаво просимо в Prop Hunt! Команди: /join hunters, /join props, /taunt, /prop <блок>, /lock", "СИСТЕМА")
    end,

    onDisable = function()
        Prop.undisguise()
        Prop.unblind()
        Teams.clear()
        Game.toast("🎭 Prop Hunt вимкнено.")
    end
})

-- Створення команд
Teams.create("hunters", { name = "Мисливці", color = "#ff4444" })
Teams.create("props", { name = "Предмети", color = "#44ff44" })

-- Стан локального гравця
local currentTeam = "props"
local lastTauntTime = 0
local tauntCooldown = 5.0 -- секунд

-- Допоміжна функція оновлення команди
local function setPlayerTeam(teamId)
    currentTeam = teamId
    if teamId == "hunters" then
        Prop.undisguise()
        Player.giveItem("diamond_sword", 1)
        Player.setSpeed(1.15)
        Game.toast("🏹 Ви тепер МИСЛИВЕЦЬ! Знайдіть та знищіть усі предмети!")
        Game.chat("🏹 Ви стали Мисливцем. Якщо стріляти в звичайні блоки - втрачаєте 5 HP!", "PROP HUNT")
    else
        Prop.undisguise()
        Player.setSpeed(1.0)
        Game.toast("🎭 Ви тепер ПРЕДМЕТ! Вдарте будь-який блок, щоб замаскуватися!")
        Game.chat("🎭 Ви стали Предметом. Клавіша [T] - свистіти, [F] - зафіксувати поворот.", "PROP HUNT")
    end
end

-- Встановлюємо стартову команду
setPlayerTeam("props")

-- 1. Чат команди
Chat.addCommand("/ph", function()
    Game.chat("📋 PROP HUNT КОМАНДИ:", "СИСТЕМА")
    Game.chat("  /join <hunters|props> - обрати команду", "СИСТЕМА")
    Game.chat("  /prop <назва> - маскування (tnt, bookshelf, melon, dirt)", "СИСТЕМА")
    Game.chat("  /model <id> - маскування в завантажену 3D модель", "СИСТЕМА")
    Game.chat("  /importmodel - завантажити свій .glb/.gltf файл з ПК", "СИСТЕМА")
    Game.chat("  /taunt [whistle|horn|beep] - подати звуковий сигнал", "СИСТЕМА")
    Game.chat("  /lock - зафіксувати положення маскування", "СИСТЕМА")
    Game.chat("  /blind <секунди> - осліпити мисливців на час підготовки", "СИСТЕМА")
end)

Chat.addCommand("/join", function(args)
    local t = string.lower(args or "")
    if t == "hunters" or t == "hunter" or t == "1" then
        setPlayerTeam("hunters")
    elseif t == "props" or t == "prop" or t == "2" then
        setPlayerTeam("props")
    else
        Game.chat("Використання: /join hunters або /join props", "СИСТЕМА")
    end
end)

Chat.addCommand("/prop", function(args)
    if currentTeam ~= "props" then
        Game.toast("❌ Тільки команда Предметів може маскуватися!")
        return
    end
    local propType = args ~= "" and args or "crafting_table"
    Prop.disguise(propType)
    Sound.play("pop")
end)

Chat.addCommand("/taunt", function(args)
    local now = os.time()
    if now - lastTauntTime < tauntCooldown then
        Game.toast("⏳ Зачекайте " .. math.ceil(tauntCooldown - (now - lastTauntTime)) .. " сек. перед наступним сигналом!")
        return
    end
    lastTauntTime = now
    local snd = args ~= "" and args or "whistle"
    Prop.taunt(snd)
    Game.toast("📣 Ви подали звуковий сигнал [" .. snd .. "]!")
end)

Chat.addCommand("/lock", function()
    if not Prop.isDisguised() then
        Game.toast("❌ Спочатку замаскуйтесь у предмет!")
        return
    end
    local locked = not Prop.isLocked()
    Prop.lock(locked)
end)

Chat.addCommand("/blind", function(args)
    local sec = tonumber(args) or 25
    Prop.blindHunters(sec)
    Game.chat("🙈 Мисливці осліплені на " .. sec .. " секунд! Предмети ховаються!", "PROP HUNT")
end)

Chat.addCommand("/importmodel", function()
    Models.openPicker(function(modelId)
        Game.toast("✔ 3D модель [" .. tostring(modelId) .. "] готова! Використовуйте /model " .. tostring(modelId))
        Game.chat("📦 Модель імпортована: " .. tostring(modelId) .. ". Тепер можна маскуватися: /model " .. tostring(modelId), "3D МОДЕЛЬ")
    end)
end)

Chat.addCommand("/model", function(args)
    if currentTeam ~= "props" then
        Game.toast("❌ Тільки команда Предметів може маскуватися!")
        return
    end
    if args == "" then
        Game.toast("❌ Вкажіть ім'я моделі або імпортуйте через /importmodel")
        return
    end
    Prop.disguise(args)
end)

-- 2. Гарячі клавіші: T - свист, F - заморозка повороту
Events.on("onKey", function(key, isDown)
    if not isDown then return end

    if key == "KeyT" then
        if currentTeam == "props" then
            local now = os.time()
            if now - lastTauntTime >= tauntCooldown then
                lastTauntTime = now
                Prop.taunt("whistle")
                Game.toast("📣 Свист відправлено!")
            else
                Game.toast("⏳ Перезарядка сигналу...")
            end
        end
    elseif key == "KeyF" then
        if currentTeam == "props" and Prop.isDisguised() then
            Prop.lock(not Prop.isLocked())
        end
    end
end)

-- 3. Маскування при ударі по блоку (для команди Props)
Events.on("onBlockBreak", function(x, y, z, blockType)
    if currentTeam == "props" then
        -- Якщо гравець предмет, він маскується у вдарений блок!
        Prop.disguise(blockType)
        Sound.beep(850, 0.1)
        Game.toast("🎭 Замасковано в новий блок!")
        return false -- блокуємо руйнування блоку предметом
    end
    return true
end)

-- 4. Механіка полювання мисливців (Штраф за промах по фальшивих блоках)
Events.on("onKey", function(key, isDown)
    -- Якщо мисливець клікає мишею (атака)
    if key == "Mouse0" and isDown and currentTeam == "hunters" then
        local trace = Prop.getEyeTrace(20)
        if trace and trace.hit then
            if trace.isProp then
                -- Влучили у замаскованого гравця!
                Sound.play("orb")
                Game.toast("🎯 ВЛУЧАННЯ! Ви знайшли предмет!")
                Game.chat("🎯 Мисливець виявив предмет!", "PROP HUNT")
            elseif trace.block then
                -- Промах по звичайному блоку: штраф -5 HP!
                Player.damage(5, "Помилковий постріл у звичайний блок!")
                Sound.play("bass")
                Game.toast("❌ Промах! -5 HP штрафу за фальшивий постріл!")
            end
        end
    end
end)

-- =========================================================
-- 🚗 CAR MOD (Мод на машини) для Eblankraft 2.0
-- Чистий Lua 5.3 мод, що використовує офіційний Mod API
-- =========================================================

Mod.register({
    id = "car_mod",
    name = "🚗 Мод на Машини (Vehicles & Roads)",
    version = "1.0",
    author = "Eblankraft Modding Community",
    description = "Додає автомобілі, асфальт, розмітку, звук клаксону, фари та швидкісні дороги! Спавн: /car або блок-спавнер.",

    onEnable = function()
        Game.toast("🚗 Мод на Машини успішно підключено! Введіть /car в чаті")
        Game.chat("🚗 Мод на Машини активовано! Команди: /car, /road 20, клавіша H - сигнал, L - фари.", "СИСТЕМА")
    end,

    onDisable = function()
        Vehicles.clear()
        Game.toast("🚗 Мод на Машини вимкнено.")
    end
})

-- 1. Реєстрація кастомних блоків для доріг
local asphaltId = World.registerBlock({
    name = "asphalt",
    title = "🛣️ Асфальт",
    color = "#282a32",
    pattern = "noise",
    hardness = 2.0,
    sound = "stone"
})

local roadLineId = World.registerBlock({
    name = "road_line",
    title = "🟨 Дорожня Розмітка",
    color = "#282a32",
    pattern = "road_line",
    hardness = 2.0,
    sound = "stone"
})

local carSpawnerBlockId = World.registerBlock({
    name = "car_spawner",
    title = "🚗 Спавнер Авто",
    color = "#d32f2f",
    pattern = "hazard",
    hardness = 1.0,
    sound = "stone"
})

-- 2. Обробка чат-команд (/car, /siren, /repair, /road, /horn)
Events.on("onChat", function(text, sender)
    local parts = {}
    for word in string.gmatch(text, "%S+") do
        table.insert(parts, word)
    end
    local cmd = string.lower(parts[1] or "")

    -- Спавн авто прямо під гравцем та миттєва посадка
    if cmd == "/car" or cmd == "/spawncar" then
        local modelArg = string.lower(parts[2] or "sport")
        local modelType = "sports_car"
        local carColor = parts[3] or "#ff1744"

        if modelArg == "police" or modelArg == "cop" then
            modelType = "police_car"
            carColor = "#111111"
        elseif modelArg == "cyber" or modelArg == "cybertruck" then
            modelType = "cyber_truck"
            carColor = "#b0bec5"
        elseif modelArg == "truck" or modelArg == "jeep" then
            modelType = "truck"
            carColor = parts[3] or "#2e7d32"
        elseif modelArg == "sport" or modelArg == "sports" then
            modelType = "sports_car"
            carColor = parts[3] or "#ff1744"
        else
            -- Color or generic car
            carColor = modelArg
        end

        local px, py, pz = Player.getPos()
        
        -- Створюємо авто
        local carId = Vehicles.spawn(modelType, px, py, pz, {
            color = carColor,
            name = modelType
        })

        if carId then
            Vehicles.mount(carId)
            Sound.horn(0.3)
            Game.toast("🚗 Сіли в авто! [WASD - їзда, Shift - НІТРО, Пробіл - ДРИФТ, G - сирена]")
            Game.chat("🚗 Авто (" .. modelType .. ") заспавнено! Команди: /car [sport|police|cyber|truck], /siren, /repair", "АВТО")
        end
        return false

    elseif cmd == "/siren" then
        if Player.isMounted() then
            local veh = Player.getVehicle()
            if veh and veh.toggleSiren then
                veh.toggleSiren()
            end
        else
            Game.toast("⚠️ Ви повинні сидіти в авто, щоб увімкнути сирену!")
        end
        return false

    elseif cmd == "/repair" or cmd == "/fix" then
        if Player.isMounted() then
            local veh = Player.getVehicle()
            if veh and veh.repair then
                veh.repair()
            end
        else
            Game.toast("⚠️ Ви повинні сидіти в авто, щоб відремонтувати його!")
        end
        return false

    -- Побудова 3-смугової асфальтованої траси
    elseif cmd == "/road" then
        local length = tonumber(parts[2]) or 20
        length = math.min(100, math.max(3, length))
        local px, py, pz = Player.getPos()
        local floorX = math.floor(px)
        local floorY = math.floor(py) - 1
        local floorZ = math.floor(pz)

        -- Смуга 1 (ліва)
        World.setBlocks(floorX - 1, floorY, floorZ, floorX - 1, floorY, floorZ + length, asphaltId)
        -- Смуга 2 (центральна з розміткою)
        World.setBlocks(floorX, floorY, floorZ, floorX, floorY, floorZ + length, roadLineId)
        -- Смуга 3 (права)
        World.setBlocks(floorX + 1, floorY, floorZ, floorX + 1, floorY, floorZ + length, asphaltId)

        -- Очистити повітря над дорогою для проїзду
        World.setBlocks(floorX - 1, floorY + 1, floorZ, floorX + 1, floorY + 3, floorZ + length, World.BLOCKS.AIR)

        Game.toast("🛣️ Трасу довжиною " .. length .. " блоків збудовано!")
        return false

    elseif cmd == "/horn" or cmd == "/honk" then
        Sound.horn(0.4)
        return false
    end
end)

-- 3. Гарячі клавіші H (клаксон), L (фари), G (сирена)
Events.on("onKey", function(keyCode, isDown)
    if not isDown then return end

    if keyCode == "KeyH" then
        if Player.isMounted() then
            local veh = Player.getVehicle()
            if veh and veh.honk then veh.honk() else Sound.horn(0.35) end
        end
    elseif keyCode == "KeyL" then
        if Player.isMounted() then
            local veh = Player.getVehicle()
            if veh and veh.toggleHeadlights then
                local on = veh.toggleHeadlights()
                Game.toast(on and "💡 Фари: УВІМКНЕНО" or "💡 Фари: ВИМКНЕНО")
            end
        end
    elseif keyCode == "KeyG" then
        if Player.isMounted() then
            local veh = Player.getVehicle()
            if veh and veh.toggleSiren then
                veh.toggleSiren()
            end
        end
    end
end)

-- 4. Спавн авто при встановленні блоку "car_spawner"
Events.on("onBlockPlace", function(x, y, z, blockType)
    if blockType == carSpawnerBlockId then
        World.setBlock(x, y, z, asphaltId)
        local carId = Vehicles.spawn("sports_car", x + 0.5, y + 1.0, z + 0.5, {
            color = "#d32f2f"
        })
        Sound.beep(600, 0.15)
        Game.toast("✨ Спортивне авто зʼявилося на спавнері!")
    end
end)

-- 5. Показувати спідометр при водінні
Events.on("onTick", function(dt)
    if Player.isMounted() then
        UI.showSpeedometer()
    else
        UI.hideSpeedometer()
    end
end)

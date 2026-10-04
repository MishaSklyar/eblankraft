-- ==========================================================
-- 🔫 МОД: АК-47 (АВТОМАТ КАЛАШНИКОВА) ДЛЯ EBLANKRAFT 2.0
-- Повністю модульний Lua-мод без хардкоду в ядрі рушія!
-- Використовує Items.register, Weapons.shoot, Sound та UI API.
-- ==========================================================

Mod.register({
    id = "ak47",
    name = "🔫 АК-47 (Автомат Калашникова)",
    version = "2.3",
    author = "Eblankraft Modding Community",
    description = "Легендарний автомат АК-47: 30 патронів 7.62x39мм, режими AUTO/BURST/SEMI, прицілювання ПКМ (FOV Zoom), перезарядка на F, тактичний HUD, віддача + 3D-модель из ak47.eblan! Отримати: /ak або /ak47.",

    onEnable = function()
        Game.toast("🔫 АК-47 готовий до бою! Введіть /ak у чаті")
        Game.chat("🔫 Мод АК-47 активовано! Команди: /ak (взяти зброю), /ak ammo (патрони), F - перезарядка, B - перемикач вогню, ПКМ - приціл.", "СИСТЕМА")
        if not (Models.has and Models.has("ak47")) then
            Game.chat("💡 Киньте ak47.eblan через Моды → Імпорт .eblan — и в руках будет 3D-модель!", "СИСТЕМА")
        end
    end,

    onDisable = function()
        if UI and UI.hide then
            UI.hide("ak_hud_panel")
        end
        if Player and Player.setFOV then
            Player.setFOV(72)
        end
        if akvmHide then akvmHide() end
        if akTouchVisible then akTouchVisible(false) end
        Game.toast("🔫 АК-47 вимкнено")
    end
})

-- ==========================================================
-- 1. РЕЄСТРАЦІЯ КАСТОМНИХ ПРЕДМЕТІВ ТА ПІКСЕЛЬ-АРТ ТЕКСТУР
-- ==========================================================

-- 1.1 Текстура та реєстрація АК-47 (16x16 Pixel Art)
local akPixelColors = {
    ["."] = "transparent",
    ["K"] = "#161618", -- чорний метал / тінь
    ["M"] = "#3c3f4a", -- збройова сталь
    ["L"] = "#727788", -- сталевий відблиск
    ["W"] = "#874116", -- дерево (приклад, цівка, руків'я)
    ["D"] = "#542409", -- темне дерево
    ["B"] = "#b55e24", -- світле лаковане дерево
    ["O"] = "#222328"  -- метал ріжка (магазину)
}

local akPixelGrid = {
    "................",
    "............M...",
    ".......LLMMMMMMM",
    "....MMMMMMWWWWMM",
    "DDDDMMLLMWWWWMM.",
    "WDDDMMMMMWWWWM..",
    "WWDDMMMMMK......",
    ".WWDD.W.OO......",
    "..WD.DW.OOO.....",
    "...W..D.KOOO....",
    "........KOOO....",
    ".........KOO....",
    "................",
    "................",
    "................",
    "................"
}

Items.register({
    id = "ak47",
    name = "АК-47",
    category = "weapon",
    maxStack = 1,
    attackDamage = 45,
    miningSpeed = 1.0,
    durability = 3000,
    pixels = akPixelGrid,
    colors = akPixelColors
})

-- 1.2 Текстура та реєстрація патронів 7.62x39мм (16x16 Pixel Art)
local ammoPixelColors = {
    ["."] = "transparent",
    ["G"] = "#cfa832", -- латунь гільзи
    ["Y"] = "#f2cf5b", -- світла латунь
    ["B"] = "#7a5c18", -- тінь гільзи
    ["C"] = "#b85d18", -- мідна куля FMJ
    ["P"] = "#e07b34", -- відблиск міді
    ["K"] = "#1f1d18"  -- капсуль / канавка
}

local ammoPixelGrid = {
    "................",
    "................",
    ".......C........",
    "......CCC.......",
    ".....CYYP....C..",
    "....BYYYGB..CCC.",
    "....BYYYGB.CYYP.",
    "...CBYYYGBBYYYGB",
    "..CCCYYYGBBYYYGB",
    ".CYYPYYYGBBYYYGB",
    "BYYYGYYYGBBYYYGB",
    "BYYYGYYYGBBYYYGB",
    "BYYYGYYYGBBYYYGB",
    "BKKKGBKKKGBKKKGB",
    "................",
    "................"
}

Items.register({
    id = "ak47_ammo",
    name = "Патрони 7.62×39мм",
    category = "item",
    maxStack = 120,
    pixels = ammoPixelGrid,
    colors = ammoPixelColors
})

-- ==========================================================
-- 2. СТАН ТА БАЛІСТИКА АК-47
-- ==========================================================

local AK = {
    magSize = 30,
    ammoInMag = 30,
    fireRate = 0.10,       -- 600 пострілів на хвилину (як справжній АК-47)
    damage = 42,           -- висока зупиняюча сила
    range = 85,            -- дальність ураження
    spreadHip = 0.024,     -- розсіювання від стегна
    spreadADS = 0.005,     -- висока точність при прицілюванні
    recoilPitch = 0.042,   -- підкидання ствола
    recoilYaw = 0.016,     -- бічне коливання
    reloadDuration = 2.1,  -- тривалість перезарядки у секундах

    -- Режими вогню
    modes = { "AUTO", "BURST", "SEMI" },
    modeIndex = 1,

    -- Динамічні змінні стану
    fireTimer = 0,
    isReloading = false,
    reloadTimer = 0,
    burstCount = 0,
    burstDelay = 0,
    isAiming = false,
    hudVisible = false
}

-- ==========================================================
-- 3. ТАКТИЧНИЙ HUD (Анімований інтерфейс боєприпасів)
-- ==========================================================

local function initHUD()
    UI.createPanel({
        id = "ak_hud_panel",
        x = 0,
        y = 0,
        width = 240,
        height = 72,
        background = "linear-gradient(135deg, rgba(16, 20, 28, 0.92), rgba(28, 34, 46, 0.88))",
        border = "2px solid rgba(255, 170, 0, 0.55)",
        borderRadius = "10px",
        boxShadow = "0 8px 24px rgba(0,0,0,0.7), inset 0 0 12px rgba(255,170,0,0.15)",
        zIndex = 9999
    })

    UI.setStyle("ak_hud_panel", "position", "fixed")
    UI.setStyle("ak_hud_panel", "bottom", "75px")
    UI.setStyle("ak_hud_panel", "right", "24px")
    UI.setStyle("ak_hud_panel", "padding", "8px 14px")
    UI.setStyle("ak_hud_panel", "fontFamily", "'Segoe UI', Tahoma, monospace, sans-serif")
    UI.setStyle("ak_hud_panel", "pointerEvents", "none")
    UI.setStyle("ak_hud_panel", "backdropFilter", "blur(4px)")

    UI.createLabel({
        id = "ak_hud_title",
        text = "🔫 АК-47 7.62mm  [AUTO]",
        size = 13,
        color = "#ffb300"
    })
    UI.setStyle("ak_hud_title", "fontWeight", "bold")
    UI.setStyle("ak_hud_title", "letterSpacing", "1px")
    UI.setStyle("ak_hud_title", "marginBottom", "4px")

    UI.createLabel({
        id = "ak_hud_ammo",
        text = "30 / 120",
        size = 24,
        color = "#ffffff"
    })
    UI.setStyle("ak_hud_ammo", "fontWeight", "900")
    UI.setStyle("ak_hud_ammo", "letterSpacing", "2px")

    UI.hide("ak_hud_panel")
    AK.hudVisible = false
end

initHUD()

local function updateHUD()
    local held = Player.getHeldItem()
    local isHoldingAK = (held and held.id == "ak47")

    if not isHoldingAK then
        if AK.hudVisible then
            UI.hide("ak_hud_panel")
            AK.hudVisible = false
            if akTouchVisible then akTouchVisible(false) end
        end
        return
    end

    if not AK.hudVisible then
        UI.show("ak_hud_panel")
        AK.hudVisible = true
        if akBuildTouch then akBuildTouch() end
        if akTouchVisible then akTouchVisible(true) end
    end

    local currentMode = AK.modes[AK.modeIndex]
    local modeColor = "#ffb300"
    if currentMode == "SEMI" then modeColor = "#64b5f6" end
    if currentMode == "BURST" then modeColor = "#81c784" end

    UI.setText("ak_hud_title", "🔫 АК-47 7.62mm  [" .. currentMode .. "]")
    UI.setStyle("ak_hud_title", "color", modeColor)

    if AK.isReloading then
        local pct = math.floor((AK.reloadTimer / AK.reloadDuration) * 100)
        UI.setText("ak_hud_ammo", "ПЕРЕЗАРЯДКА " .. pct .. "%")
        UI.setStyle("ak_hud_ammo", "color", "#ff9100")
    else
        local reserve = Player.getItemCount("ak47_ammo")
        if Player.isCreative() then reserve = "∞" end

        UI.setText("ak_hud_ammo", AK.ammoInMag .. " / " .. reserve)

        if AK.ammoInMag <= 0 then
            UI.setStyle("ak_hud_ammo", "color", "#ff3d00")
            UI.setText("ak_hud_ammo", "0 / " .. reserve .. "  [F]")
        elseif AK.ammoInMag <= 8 then
            UI.setStyle("ak_hud_ammo", "color", "#ff9100")
        else
            UI.setStyle("ak_hud_ammo", "color", "#ffffff")
        end
    end
end

-- ==========================================================
-- 4. МЕХАНІКА СТРІЛЬБИ ТА БАЛІСТИКА
-- ==========================================================

local function doShoot()
    if AK.isReloading then return false end

    if AK.ammoInMag <= 0 then
        Sound.dryFire()
        Game.toast("⚠️ Магазин пустий! Натисніть [F] для перезарядки")
        return false
    end

    AK.ammoInMag = AK.ammoInMag - 1

    local spread = AK.isAiming and AK.spreadADS or AK.spreadHip
    local recPitch = AK.isAiming and (AK.recoilPitch * 0.4) or AK.recoilPitch
    local recYaw = AK.isAiming and (AK.recoilYaw * 0.4) or AK.recoilYaw

    -- Виклик движкового Raycast бою з трасерами та віддачею
    local result = Weapons.shoot({
        damage = AK.damage,
        range = AK.range,
        spread = spread,
        recoilPitch = recPitch,
        recoilYaw = recYaw,
        tracerColor = 0xffe259,
        sound = true,
        pitch = 0.96 + math.random() * 0.08,
        volume = 0.42
    })

    updateHUD()
    return true
end

local function startReload()
    if AK.isReloading then return end
    if AK.ammoInMag >= AK.magSize then
        Game.toast("ℹ️ Магазин АК-47 уже повний (30/30)")
        return
    end

    local reserve = Player.getItemCount("ak47_ammo")
    if not Player.isCreative() and reserve <= 0 then
        Sound.dryFire()
        Game.toast("❌ Немає патронів 7.62x39мм! Напишіть /ak ammo")
        return
    end

    AK.isReloading = true
    AK.reloadTimer = 0

    -- Ступінь 1: Викид порожнього магазину
    Sound.reload("mag_out")
    Game.toast("⏳ Перезарядка АК-47...")
    updateHUD()
end

-- ==========================================================
-- 5. ОБРОБНИКИ ПОДІЙ (Events API)
-- ==========================================================

-- 5.1 Обробка натискань миші (ПКМ - приціл, ЛКМ - вогонь)
Events.on("onMouseDown", function(button)
    local held = Player.getHeldItem()
    if not held or held.id ~= "ak47" then return end

    if button == 2 then
        -- ПКМ: Прицілювання (Aim Down Sights). Блокуємо встановлення блоків!
        return false
    elseif button == 0 then
        -- ЛКМ: Постріл
        local currentMode = AK.modes[AK.modeIndex]
        if currentMode == "SEMI" then
            if AK.fireTimer <= 0 then
                doShoot()
                AK.fireTimer = AK.fireRate * 1.5
            end
            return false
        elseif currentMode == "BURST" then
            if AK.fireTimer <= 0 and AK.burstCount == 0 then
                AK.burstCount = 3
                AK.burstDelay = 0
            end
            return false
        elseif currentMode == "AUTO" then
            -- Для авто-режиму стрільба обробляється у циклі onTick
            return false
        end
    end
end)

Events.on("onMouseUp", function(button)
    local held = Player.getHeldItem()
    if not held or held.id ~= "ak47" then return end
    -- Відпускання кнопок обробляється плавно
end)

-- 5.2 Обробка клавіатури (F - перезарядка, B - режим вогню)
Events.on("onKey", function(code, isDown)
    if not isDown then return end
    local held = Player.getHeldItem()
    if not held or held.id ~= "ak47" then return end

    if code == "KeyF" then
        if Player.isFlying() then return end -- в польоті F лишаємо движку (вкл/викл політ)
        startReload()
    elseif code == "KeyB" then
        akCycleMode()
    end
end)

function akCycleMode()
    local held = Player.getHeldItem()
    if not held or held.id ~= "ak47" then return end
    AK.modeIndex = AK.modeIndex + 1
    if AK.modeIndex > #AK.modes then AK.modeIndex = 1 end
    local m = AK.modes[AK.modeIndex]
    Sound.reload("click")
    Game.toast("🔧 Режим вогню АК-47: " .. m)
    updateHUD()
end

-- 5.3 Головний ігровий цикл (onTick)
Events.on("onTick", function(dt)
    local held = Player.getHeldItem()
    local isHoldingAK = (held and held.id == "ak47")

    if not isHoldingAK then
        if AK.isAiming then
            AK.isAiming = false
            Player.setFOV(72)
        end
        if AK.hudVisible then
            updateHUD()
        end
        return
    end

    -- 1. Перевірка прицілювання (ПКМ = button 2, на телефоні — кнопка 🎯)
    local isRMBDown = Player.isMouseDown(2) or AK.touchAim
    if isRMBDown and not AK.isAiming then
        AK.isAiming = true
        Player.setFOV(48) -- Плавне наближення оптичного прицілу
    elseif not isRMBDown and AK.isAiming then
        AK.isAiming = false
        Player.setFOV(72) -- Повернення до стандартного кута огляду
    end

    -- 2. Перезарядка
    if AK.isReloading then
        local prev = AK.reloadTimer
        AK.reloadTimer = AK.reloadTimer + dt

        -- Стадія 2 (0.9с): Вставляння нового магазину
        if prev < 0.9 and AK.reloadTimer >= 0.9 then
            Sound.reload("mag_in")
        end
        -- Стадія 3 (1.6с): Зведення затвору (bolt pull)
        if prev < 1.6 and AK.reloadTimer >= 1.6 then
            Sound.reload("bolt")
        end

        -- Завершення перезарядки
        if AK.reloadTimer >= AK.reloadDuration then
            local needed = AK.magSize - AK.ammoInMag
            local reserve = Player.getItemCount("ak47_ammo")
            if Player.isCreative() then reserve = 999 end

            local toLoad = math.min(needed, reserve)
            if not Player.isCreative() then
                Player.removeItem("ak47_ammo", toLoad)
            end

            AK.ammoInMag = AK.ammoInMag + toLoad
            AK.isReloading = false
            AK.reloadTimer = 0
            Game.toast("✅ АК-47 споряджено (" .. AK.ammoInMag .. "/30)!")
        end
        updateHUD()
        return
    end

    -- 3. Таймер відкату одиночного/авто пострілу
    if AK.fireTimer > 0 then
        AK.fireTimer = AK.fireTimer - dt
    end

    -- 4. Стрільба чергою (BURST)
    if AK.burstCount > 0 then
        AK.burstDelay = AK.burstDelay - dt
        if AK.burstDelay <= 0 then
            local shotOk = doShoot()
            if shotOk then
                AK.burstCount = AK.burstCount - 1
                AK.burstDelay = 0.08
            else
                AK.burstCount = 0
            end
        end
    end

    -- 5. Автоматична стрільба при затисканні ЛКМ (AUTO)
    local currentMode = AK.modes[AK.modeIndex]
    if currentMode == "AUTO" and Player.isMouseDown(0) then
        if AK.fireTimer <= 0 then
            doShoot()
            AK.fireTimer = AK.fireRate
        end
    end

    updateHUD()
end)

-- ==========================================================
-- 6. ЧАТ-КОМАНДИ (/ak, /ak47, /ak ammo, /ak mode)
-- ==========================================================

Events.on("onChat", function(text, sender)
    local parts = {}
    for word in string.gmatch(text, "%S+") do
        table.insert(parts, word)
    end
    local cmd = string.lower(parts[1] or "")

    if cmd == "/ak" or cmd == "/ak47" then
        local sub = string.lower(parts[2] or "")

        if sub == "ammo" then
            local count = tonumber(parts[3]) or 60
            Player.giveItem("ak47_ammo", count)
            Sound.reload("mag_in")
            Game.toast("📦 Отримано " .. count .. " патронів 7.62x39мм!")
            return false
        elseif sub == "reload" then
            startReload()
            return false
        elseif sub == "mode" then
            AK.modeIndex = AK.modeIndex + 1
            if AK.modeIndex > #AK.modes then AK.modeIndex = 1 end
            local m = AK.modes[AK.modeIndex]
            Sound.reload("click")
            Game.toast("🔧 Режим вогню АК-47: " .. m)
            updateHUD()
            return false
        elseif sub == "help" or sub == "inspect" then
            Game.chat("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "СИСТЕМА")
            Game.chat("🔫 АК-47 (Автомат Калашникова):", "СИСТЕМА")
            Game.chat("• Патрони: 7.62x39мм | Магазин: 30 раундів", "СИСТЕМА")
            Game.chat("• Шкода: 42 HP за постріл | Дальність: 85 блоків", "СИСТЕМА")
            Game.chat("• Керування: ЛКМ - вогонь, ПКМ - приціл (ADS)", "СИСТЕМА")
            Game.chat("• Клавіша [F] - перезарядка, [B] - перемикач режимів", "СИСТЕМА")
            Game.chat("• Команди: /ak (зброя), /ak ammo (набої), /ak mode", "СИСТЕМА")
            Game.chat("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "СИСТЕМА")
            return false
        else
            -- Видати АК-47 та 120 патронів
            Player.giveItem("ak47", 1)
            Player.giveItem("ak47_ammo", 120)
            Sound.reload("bolt")
            Game.toast("🔫 Отримано АК-47 та 120 патронів 7.62x39мм!")
            Game.chat("🔫 АК-47 додано до вашого інвентарю! Натисніть [F] для перезарядки, [B] для зміни режиму.", "СИСТЕМА")
            return false
        end
    end
end)

-- ==========================================================
-- 7. СЕНСОРНІ КНОПКИ (тільки телефони): перезарядка / режим / приціл.
-- Стрільба — звичайною кнопкою атаки (вона тисне ЛКМ).
-- ==========================================================

AK.touchAim = false
local touchBuilt = false

local function akTouchBtn(id, text, y, cb)
    UI.createButton({ id = id, text = text, x = 12, y = y }, cb)
    UI.setStyle(id, "position", "fixed")
    UI.setStyle(id, "fontSize", "22px")
    UI.setStyle(id, "padding", "10px 14px")
    UI.setStyle(id, "zIndex", "60")
    UI.hide(id)
end

function akBuildTouch()
    if touchBuilt then return end
    if not (UI.isTouch and UI.isTouch()) then return end
    touchBuilt = true
    akTouchBtn("ak_t_reload", "⟳", 300, function() startReload() end)
    akTouchBtn("ak_t_mode", "🔧", 370, function() akCycleMode() end)
    akTouchBtn("ak_t_aim", "🎯", 440, function()
        AK.touchAim = not AK.touchAim
        UI.setText("ak_t_aim", AK.touchAim and "🎯•" or "🎯")
    end)
end

function akTouchVisible(v)
    if not touchBuilt then return end
    if not v then AK.touchAim = false UI.setText("ak_t_aim", "🎯") end
    for _, id in ipairs({ "ak_t_reload", "ak_t_mode", "ak_t_aim" }) do
        if v then UI.show(id) else UI.hide(id) end
    end
end

-- ==========================================================
-- 8. 3D ВЬЮМОДЕЛЬ из .eblan (models/ak47.glb → id "ak47")
-- Модель — ребёнок камеры: сидит мёртво (боб/тряска/FOV наследуются).
-- Рука с пиксельной текстурой прячется, при ADS ствол идёт к центру.
-- Без пака — тихо не работает, пиксельный вид остаётся.
-- ==========================================================

AKVM = { inst = nil, scale = 0.0075, side = 0.24, hidHand = false }

function akvmHide()
    if AKVM.inst then Models.remove(AKVM.inst) AKVM.inst = nil end
    if AKVM.hidHand then Player.setHandVisible(true) AKVM.hidHand = false end
end

local function akvmPlace()
    -- ствол модели смотрит +X с перекосом ~16° → доворачиваем на -Z (взгляд камеры)
    Models.attachCamera(AKVM.inst, AKVM.side, -0.26, -0.65, -0.04, 1.86, 0)
end

-- старый движок без Models.attachCamera: тихо сидим на пиксельном виде
local hasAttach = Models.attachCamera ~= nil
if not hasAttach then
    Game.chat("⚠️ Обнови файлы игры (старый mods.js): 3D-модель АК требует свежий движок.", "СИСТЕМА")
end

Events.on("onTick", function(dt)
    local held = Player.getHeldItem()
    local want = held and held.id == "ak47" and Models.has and Models.has("ak47")
        and hasAttach and not Player.isThirdPerson()
    if want then
        if not AKVM.inst then
            local px, py, pz = Player.getPos()
            AKVM.side = AK.isAiming and 0.0 or 0.24
            AKVM.inst = Models.spawn("ak47", px, py, pz, { scale = AKVM.scale })
            if AKVM.inst then akvmPlace() else return end
        else
            local side = AK.isAiming and 0.0 or 0.24
            if side ~= AKVM.side then AKVM.side = side akvmPlace() end
        end
        if not AKVM.hidHand then Player.setHandVisible(false) AKVM.hidHand = true end
    elseif AKVM.inst or AKVM.hidHand then
        akvmHide()
    end
end)

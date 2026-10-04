-- ==========================================================
-- 🔫 ALL WEAPONS ARSENAL MOD ДЛЯ EBLANKRAFT 2.0
-- Повний арсенал зброї: AK-47, M4A1, AWP, SPAS-12, Deagle,
-- Glock-18, MP5, RPG-7 та бойові гранати!
-- ==========================================================

Mod.register({
    id = "all_weapons",
    name = "🔫 Повний Арсенал Зброї (All Weapons Arsenal)",
    version = "3.0",
    author = "Eblankraft Modding Community",
    description = "Повний набір сучасної зброї: АК-47, M4A1, снайперка AWP з оптичним прицілом, дробовик SPAS-12, Desert Eagle .50, Glock-18, MP5, гранатомет RPG-7 та бойові гранати! Отримати: /guns або /weapon <назва>.",

    onEnable = function()
        Game.toast("🔫 Повний арсенал зброї активовано! Введіть /guns")
        Game.chat("🔫 Арсенал підключено! Команди: /guns (отримати все), /weapon <ak|m4|awp|shotgun|deagle|glock|mp5|rpg|grenade>, /ammo, R - перезарядка, ПКМ - приціл.", "СИСТЕМА")
    end,
    
    onDisable = function()
        if UI and UI.hide then
            UI.hide("guns_hud_ammo")
        end
        if Player and Player.setFOV then
            Player.setFOV(72)
        end
        Game.toast("🔫 Арсенал зброї вимкнено")
    end
})

-- ==========================================================
-- 1. СТАТИСТИКА ЗБРОЇ ТА МАГАЗИНИ
-- ==========================================================
local WEAPONS_DATA = {
    ["ak47"] = {
        name = "АК-47",
        magSize = 30,
        damage = 38,
        range = 75,
        spread = 0.03,
        recoilPitch = 0.035,
        recoilYaw = 0.015,
        fireDelay = 0.1,
        bulletCount = 1,
        soundPitch = 1.0,
        soundVol = 0.35,
        ammoType = "ammo_rifle",
        isRocket = false,
        isGrenade = false
    },
    ["m4a1"] = {
        name = "M4A1",
        magSize = 30,
        damage = 34,
        range = 80,
        spread = 0.02,
        recoilPitch = 0.024,
        recoilYaw = 0.01,
        fireDelay = 0.085,
        bulletCount = 1,
        soundPitch = 1.25,
        soundVol = 0.32,
        ammoType = "ammo_rifle",
        isRocket = false,
        isGrenade = false
    },
    ["awp"] = {
        name = "AWP Снайперка",
        magSize = 10,
        damage = 135,
        range = 160,
        spread = 0.002,
        recoilPitch = 0.09,
        recoilYaw = 0.02,
        fireDelay = 1.25,
        bulletCount = 1,
        soundPitch = 0.65,
        soundVol = 0.5,
        ammoType = "ammo_sniper",
        hasScope = true,
        isRocket = false,
        isGrenade = false
    },
    ["shotgun"] = {
        name = "SPAS-12 Дробовик",
        magSize = 8,
        damage = 18,
        range = 35,
        spread = 0.09,
        recoilPitch = 0.075,
        recoilYaw = 0.025,
        fireDelay = 0.75,
        bulletCount = 8,
        soundPitch = 0.75,
        soundVol = 0.45,
        ammoType = "ammo_shotgun",
        isRocket = false,
        isGrenade = false
    },
    ["deagle"] = {
        name = "Desert Eagle .50",
        magSize = 7,
        damage = 72,
        range = 65,
        spread = 0.025,
        recoilPitch = 0.065,
        recoilYaw = 0.02,
        fireDelay = 0.35,
        bulletCount = 1,
        soundPitch = 0.85,
        soundVol = 0.4,
        ammoType = "ammo_pistol",
        isRocket = false,
        isGrenade = false
    },
    ["glock"] = {
        name = "Glock-18",
        magSize = 20,
        damage = 22,
        range = 50,
        spread = 0.04,
        recoilPitch = 0.02,
        recoilYaw = 0.012,
        fireDelay = 0.09,
        bulletCount = 1,
        soundPitch = 1.4,
        soundVol = 0.28,
        ammoType = "ammo_pistol",
        isRocket = false,
        isGrenade = false
    },
    ["mp5"] = {
        name = "MP5 Пістолет-кулемет",
        magSize = 30,
        damage = 28,
        range = 60,
        spread = 0.028,
        recoilPitch = 0.022,
        recoilYaw = 0.012,
        fireDelay = 0.075,
        bulletCount = 1,
        soundPitch = 1.3,
        soundVol = 0.3,
        ammoType = "ammo_pistol",
        isRocket = false,
        isGrenade = false
    },
    ["rpg"] = {
        name = "РПГ-7 Гранатомет",
        magSize = 1,
        damage = 250,
        range = 100,
        spread = 0.01,
        recoilPitch = 0.12,
        recoilYaw = 0.02,
        fireDelay = 2.0,
        bulletCount = 1,
        soundPitch = 0.4,
        soundVol = 0.6,
        ammoType = "ammo_rocket",
        isRocket = true,
        isGrenade = false
    },
    ["grenade"] = {
        name = "Бойова Граната",
        magSize = 1,
        damage = 160,
        fireDelay = 1.0,
        isRocket = false,
        isGrenade = true
    }
}

local currentMag = {
    ["ak47"] = 30,
    ["m4a1"] = 30,
    ["awp"] = 10,
    ["shotgun"] = 8,
    ["deagle"] = 7,
    ["glock"] = 20,
    ["mp5"] = 30,
    ["rpg"] = 1,
    ["grenade"] = 1
}

local lastShotTime = 0
local isReloading = false
local isScoped = false

local function updateWeaponHUD(gunId)
    local cfg = WEAPONS_DATA[gunId]
    if not cfg or not UI then return end

    local invCount = 0
    if Player.getItemCount and cfg.ammoType then
        invCount = Player.getItemCount(cfg.ammoType)
    end

    local text = string.format("🔫 %s | %d / %d  (Сумка: %d)",
        cfg.name,
        currentMag[gunId] or 0,
        cfg.magSize,
        invCount
    )

    UI.text("guns_hud_ammo", text, {
        top = "18px",
        left = "50%",
        transform = "translateX(-50%)",
        color = "#ffff55",
        fontSize = "15px",
        fontWeight = "bold",
        backgroundColor = "rgba(0,0,0,0.7)",
        padding = "6px 16px",
        borderRadius = "8px",
        border = "1px solid #ffd700",
        zIndex = "500",
        textShadow = "1px 1px 2px #000"
    })
end

local function doShoot(gunId)
    local cfg = WEAPONS_DATA[gunId]
    if not cfg then return end

    if isReloading then
        Game.toast("⏳ Перезарядка...")
        return
    end

    local now = os.clock()
    if (now - lastShotTime) < cfg.fireDelay then
        return
    end

    if cfg.isGrenade then
        lastShotTime = now
        local wm = window and window.game and window.game.modManager and window.game.modManager.weaponManager
        if wm and wm.throwGrenade then
            wm:throwGrenade({ damage = cfg.damage, radius = 3.2 })
        end
        if Player.removeItem then
            Player.removeItem("grenade", 1)
        end
        Game.toast("💣 Гранату кинуто! (2.5с до вибуху)")
        return
    end

    if currentMag[gunId] <= 0 then
        Sound.click()
        Game.toast("⚠️ Магазин порожній! [R - перезарядка]")
        return
    end

    lastShotTime = now
    currentMag[gunId] = currentMag[gunId] - 1

    if cfg.isRocket then
        local wm = window and window.game and window.game.modManager and window.game.modManager.weaponManager
        if wm and wm.launchRocket then
            wm:launchRocket({ damage = cfg.damage, radius = 3.6 })
        end
        Game.toast("🚀 Ракета випущена!")
    else
        local spread = cfg.spread
        if isScoped then
            spread = spread * 0.2
        end

        Weapons.shoot({
            damage = cfg.damage,
            range = cfg.range,
            spread = spread,
            recoilPitch = cfg.recoilPitch,
            recoilYaw = cfg.recoilYaw,
            bulletCount = cfg.bulletCount or 1,
            pitch = cfg.soundPitch,
            volume = cfg.soundVol,
            tracerColor = (gunId == "awp" and 0x00e5ff) or 0xffd700
        })
    end

    updateWeaponHUD(gunId)
end

local function doReload(gunId)
    local cfg = WEAPONS_DATA[gunId]
    if not cfg or isReloading or cfg.isGrenade then return end

    if currentMag[gunId] >= cfg.magSize then
        Game.toast("Магазин уже повний!")
        return
    end

    local invAmmo = 999
    if Player.getItemCount and cfg.ammoType then
        invAmmo = Player.getItemCount(cfg.ammoType)
    end

    if invAmmo <= 0 then
        Game.toast("❌ Немає патронів (" .. cfg.ammoType .. ") в інвентарі!")
        return
    end

    isReloading = true
    Game.toast("🔄 Перезарядка " .. cfg.name .. "...")
    Sound.beep(400, 0.1)

    Timer.after(1.4, function()
        local needed = cfg.magSize - currentMag[gunId]
        local toLoad = math.min(needed, invAmmo)

        if Player.removeItem and cfg.ammoType then
            Player.removeItem(cfg.ammoType, toLoad)
        end

        currentMag[gunId] = currentMag[gunId] + toLoad
        isReloading = false
        Sound.beep(800, 0.15)
        Game.toast("✅ " .. cfg.name .. " перезаряджено! [" .. currentMag[gunId] .. "/" .. cfg.magSize .. "]")
        updateWeaponHUD(gunId)
    end)
end

local function toggleScope(gunId)
    local cfg = WEAPONS_DATA[gunId]
    if not cfg then return end

    isScoped = not isScoped
    if isScoped then
        local fov = (gunId == "awp") and 22 or 48
        if Player.setFOV then Player.setFOV(fov) end
        Game.toast("🎯 Приціл УВІМКНЕНО")
    else
        if Player.setFOV then Player.setFOV(72) end
        Game.toast("Приціл ВИМКНЕНО")
    end
end

Events.on("onMouseDown", function(btn)
    local held = Player.getHeldItem and Player.getHeldItem()
    if not held then return end
    local gunId = held.id

    if WEAPONS_DATA[gunId] then
        if btn == 0 then
            doShoot(gunId)
        elseif btn == 2 then
            toggleScope(gunId)
        end
    end
end)

Events.on("onKey", function(key, isDown)
    if not isDown then return end

    local held = Player.getHeldItem and Player.getHeldItem()
    if not held then return end
    local gunId = held.id

    if WEAPONS_DATA[gunId] then
        if key == "KeyR" then
            doReload(gunId)
        end
    end
end)

Events.on("onChat", function(text, sender)
    local parts = {}
    for w in string.gmatch(text, "%S+") do table.insert(parts, w) end
    local cmd = string.lower(parts[1] or "")

    if cmd == "/guns" or cmd == "/allguns" then
        if Player.addItem then
            Player.addItem("ak47", 1)
            Player.addItem("m4a1", 1)
            Player.addItem("awp", 1)
            Player.addItem("shotgun", 1)
            Player.addItem("deagle", 1)
            Player.addItem("glock", 1)
            Player.addItem("mp5", 1)
            Player.addItem("rpg", 1)
            Player.addItem("grenade", 10)
            Player.addItem("ammo_pistol", 120)
            Player.addItem("ammo_rifle", 180)
            Player.addItem("ammo_sniper", 40)
            Player.addItem("ammo_shotgun", 48)
            Player.addItem("ammo_rocket", 10)
        end
        Game.toast("🔫 Повний арсенал зброї видано в інвентар!")
        Game.chat("🔫 Ви отримали: АК-47, M4A1, AWP, SPAS-12, Deagle, Glock-18, MP5, RPG-7, Гранати та набої!", "АРСЕНАЛ")
        return false

    elseif cmd == "/weapon" or cmd == "/gun" then
        local sub = string.lower(parts[2] or "ak47")
        if WEAPONS_DATA[sub] and Player.addItem then
            Player.addItem(sub, 1)
            local cfg = WEAPONS_DATA[sub]
            if cfg.ammoType then
                Player.addItem(cfg.ammoType, cfg.magSize * 3)
            end
            Game.toast("🔫 Отримано: " .. cfg.name)
        else
            Game.chat("Доступна зброя: ak47, m4a1, awp, shotgun, deagle, glock, mp5, rpg, grenade", "СИСТЕМА")
        end
        return false

    elseif cmd == "/ammo" then
        if Player.addItem then
            Player.addItem("ammo_pistol", 60)
            Player.addItem("ammo_rifle", 90)
            Player.addItem("ammo_sniper", 20)
            Player.addItem("ammo_shotgun", 24)
            Player.addItem("ammo_rocket", 5)
        end
        Game.toast("📦 Набої всіх калібрів поповнено!")
        return false
    end
end)

Events.on("onTick", function(dt)
    local held = Player.getHeldItem and Player.getHeldItem()
    if held and WEAPONS_DATA[held.id] then
        updateWeaponHUD(held.id)
    else
        if UI and UI.hide then
            UI.hide("guns_hud_ammo")
        end
        if isScoped then
            isScoped = false
            if Player.setFOV then Player.setFOV(72) end
        end
    end
end)

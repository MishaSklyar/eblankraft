-- ==========================================================
-- 🐇 МОД: BHOP ФИЗИКА (баннихоп + пресеты физики)
-- Держишь ПРОБЕЛ — прыжки сами цепочкой (движковый jump-buffer).
-- Мод даёт скорость, лунную гравитацию и защиту от падения.
-- Команды: /bhop [on|off|classic|lunar|surf|quake]
-- API для своих модов: Physics.set/get/reset (см. readme).
-- ==========================================================

Mod.register({
    id = "bhop",
    name = "🐇 Bhop Физика",
    version = "1.0",
    author = "Eblankraft Modding Community",
    description = "Автобхоп на пробеле + пресеты: classic, lunar, surf, quake. /bhop",

    onEnable = function()
        Game.toast("🐇 Bhop включён! Держи ПРОБЕЛ и стрейфись (A/D)")
    end,

    onDisable = function()
        Physics.reset()
        Player.setSpeed(1.0)
        Game.toast("🐇 Bhop выключен, физика обычная")
    end
})

local PRESETS = {
    classic = { gravity = 22.0, jumpPower = 8.5,  speed = 1.0,  noFall = false, hint = "обычная физика" },
    bhop    = { gravity = 19.0, jumpPower = 9.0,  speed = 1.35, noFall = true,  hint = "баннихоп: держи ПРОБЕЛ" },
    lunar   = { gravity = 8.0,  jumpPower = 9.5,  speed = 1.1,  noFall = true,  hint = "лунная гравитация" },
    surf    = { gravity = 14.0, jumpPower = 8.0,  speed = 1.6,  noFall = true,  hint = "сёрф: разгон + стрейфы" },
    quake   = { gravity = 22.0, jumpPower = 8.5,  speed = 2.0,  noFall = true,  hint = "квака: дикая скорость" },
}

local current = "bhop"

local function apply(name)
    local p = PRESETS[name]
    if not p then return false end
    current = name
    if name == "classic" then
        Physics.reset()
        Player.setSpeed(1.0)
    else
        Physics.set("gravity", p.gravity)
        Physics.set("jumpPower", p.jumpPower)
        Physics.set("noFallDamage", p.noFall)
        Player.setSpeed(p.speed)
    end
    Game.toast("🐇 Пресет: " .. name .. " — " .. p.hint)
    return true
end

apply("bhop")

-- скорость в воздухе для фана: тост-рекорд сессии
local topSpeed, wasAir = 0, false

Events.on("onTick", function(dt)
    local ph = Physics.get()
    local v = Player.getVelocity()
    local hspeed = math.sqrt(v.x * v.x + v.z * v.z)
    local air = not ph.onGround
    if air and hspeed > topSpeed then topSpeed = hspeed end
    if wasAir and not air and topSpeed > 12 then
        Game.toast(string.format("🐇 Приземление на %.1f м/с! (рекорд %.1f)", hspeed, topSpeed))
    end
    if not air then topSpeed = 0 end
    wasAir = air
end)

Events.on("onChat", function(text, sender)
    local parts = {}
    for w in string.gmatch(text, "%S+") do parts[#parts + 1] = w end
    if string.lower(parts[1] or "") ~= "/bhop" then return end
    local sub = string.lower(parts[2] or "")
    if sub == "" or sub == "help" then
        Game.chat("🐇 /bhop on|off — вкл/выкл | classic|lunar|surf|quake|bhop — пресет", "БХОП")
    elseif sub == "on" then
        apply("bhop")
    elseif sub == "off" then
        apply("classic")
    elseif not apply(sub) then
        Game.toast("🐇 Нет пресета '" .. sub .. "'. /bhop help")
    end
    return false
end)

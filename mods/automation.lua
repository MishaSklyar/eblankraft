-- ==========================================================
-- ⚙️ МОД: АВТОМАТИЗАЦИЯ (простой редстоун, конвейеры,
-- турели и буры). Питание: рычаг → провод → механизмы.
-- Петель из провода не делать (будет мигать)!
-- Команды: /auto help | kit | scan, /lever, /belt n|s|e|w
-- ==========================================================

Mod.register({
    id = "automation",
    name = "⚙️ Автоматизация и Механизмы",
    version = "1.0",
    author = "Eblankraft Modding Community",
    description = "Логика (рычаг/провод/лампа/NOT/AND), конвейер, турель ПВО и бур для руды. /auto kit — набор.",

    onEnable = function()
        Game.toast("⚙️ Автоматизация включена! /auto kit — взять набор")
    end,

    onDisable = function()
        if Timer.exists("auto_power") then Timer.remove("auto_power") end
        if Timer.exists("auto_turret") then Timer.remove("auto_turret") end
        if Timer.exists("auto_drill") then Timer.remove("auto_drill") end
    end
})

-- ---------- блоки ----------
local BL = {}
BL.lever_off = World.registerBlock({ name = "lever_off", title = "🔌 Рычаг (ВЫКЛ)", color = "#5a1f1f", pattern = "hazard", hardness = 1.0, sound = "stone" })
BL.lever_on  = World.registerBlock({ name = "lever_on",  title = "🔌 Рычаг (ВКЛ)",  color = "#c8901a", pattern = "hazard", hardness = 1.0, sound = "stone" })
BL.wire      = World.registerBlock({ name = "wire",      title = "🟧 Медный провод", color = "#b56a28", pattern = "noise", hardness = 0.8, sound = "stone" })
BL.lamp_off  = World.registerBlock({ name = "lamp_off",  title = "💡 Лампа (ВЫКЛ)", color = "#3a3a3a", pattern = "noise", hardness = 0.6, sound = "glass" })
BL.lamp_on   = World.registerBlock({ name = "lamp_on",   title = "💡 Лампа (ВКЛ)",  color = "#ffe27a", pattern = "noise", hardness = 0.6, sound = "glass" })
BL.not_off   = World.registerBlock({ name = "not_off",   title = "🚫 NOT (ВЫКЛ)", color = "#27436b", pattern = "grid", hardness = 1.0, sound = "stone" })
BL.not_on    = World.registerBlock({ name = "not_on",    title = "🚫 NOT (ВКЛ)",  color = "#4f9cf0", pattern = "grid", hardness = 1.0, sound = "stone" })
BL.and_off   = World.registerBlock({ name = "and_off",   title = "🔀 AND (ВЫКЛ)", color = "#3d5a2e", pattern = "grid", hardness = 1.0, sound = "stone" })
BL.and_on    = World.registerBlock({ name = "and_on",    title = "🔀 AND (ВКЛ)",  color = "#7ddf5e", pattern = "grid", hardness = 1.0, sound = "stone" })
BL.belt      = World.registerBlock({ name = "belt",      title = "➡️ Конвейер", color = "#444a55", pattern = "road_line", hardness = 1.2, sound = "stone" })
BL.turret    = World.registerBlock({ name = "turret",    title = "🎯 Турель ПВО", color = "#7a1f2b", pattern = "hazard", hardness = 2.5, sound = "stone" })
BL.drill     = World.registerBlock({ name = "drill",     title = "⛏️ Автобур", color = "#2e4a4a", pattern = "hazard", hardness = 2.5, sound = "stone" })

local function key(x, y, z) return x .. "," .. y .. "," .. z end

-- множества координат: источники питания и механизмы
local src = {}      -- рычаги ВКЛ + гейты ВКЛ (питают сеть)
local lamps, nots, ands = {}, {}, {}
local turrets, drills, belts = {}, {}, {}

local function isOurs(id)
    for _, v in pairs(BL) do if v == id then return true end end
    return false
end

local function track(x, y, z, id)
    local k = key(x, y, z)
    if id == BL.lever_on or id == BL.not_on or id == BL.and_on then src[k] = true end
    if id == BL.lamp_off or id == BL.lamp_on then lamps[k] = true end
    if id == BL.not_off or id == BL.not_on then nots[k] = true end
    if id == BL.and_off or id == BL.and_on then ands[k] = true end
    if id == BL.turret then turrets[k] = true end
    if id == BL.drill then drills[k] = true end
    if id == BL.belt then belts[k] = belts[k] or { dx = 0, dz = -1 } end
end

local function untrack(x, y, z)
    local k = key(x, y, z)
    src[k] = nil lamps[k] = nil nots[k] = nil ands[k] = nil
    turrets[k] = nil drills[k] = nil belts[k] = nil
end

Events.on("onBlockPlace", function(x, y, z, bt)
    if isOurs(bt) then track(x, y, z, bt) end
end)
Events.on("onBlockBreak", function(x, y, z, bt)
    untrack(x, y, z)
end)

-- первичное сканирование вокруг игрока (после реинита модов состояние сбрысывается)
local function rescan(r)
    local px, py, pz = Player.getPos()
    px, py, pz = math.floor(px), math.floor(py), math.floor(pz)
    r = r or 14
    for x = px - r, px + r do for y = py - r, py + r do for z = pz - r, pz + r do
        local b = World.getBlock(x, y, z)
        if isOurs(b) then track(x, y, z, b) end
    end end end
end
rescan(14)

-- ---------- электросеть ----------
local DIRS = { {1,0,0}, {-1,0,0}, {0,1,0}, {0,-1,0}, {0,0,1}, {0,0,-1} }
local poweredWire = {}

local function computePower()
    poweredWire = {}
    local queue = {}
    for k in pairs(src) do
        local x, y, z = string.match(k, "(-?%d+),(-?%d+),(-?%d+)")
        x, y, z = tonumber(x), tonumber(y), tonumber(z)
        for _, d in ipairs(DIRS) do
            local nk = key(x + d[1], y + d[2], z + d[3])
            if not poweredWire[nk] and World.getBlock(x + d[1], y + d[2], z + d[3]) == BL.wire then
                poweredWire[nk] = true
                queue[#queue + 1] = nk
            end
        end
    end
    local head, cap = 1, 3000
    while head <= #queue and head <= cap do
        local k = queue[head] head = head + 1
        local x, y, z = string.match(k, "(-?%d+),(-?%d+),(-?%d+)")
        x, y, z = tonumber(x), tonumber(y), tonumber(z)
        for _, d in ipairs(DIRS) do
            local nk = key(x + d[1], y + d[2], z + d[3])
            if not poweredWire[nk] and World.getBlock(x + d[1], y + d[2], z + d[3]) == BL.wire then
                poweredWire[nk] = true
                queue[#queue + 1] = nk
            end
        end
    end
end

local function isPowered(x, y, z)
    for _, d in ipairs(DIRS) do
        local k = key(x + d[1], y + d[2], z + d[3])
        if src[k] or poweredWire[k] then return true end
    end
    return false
end

local function countPoweredNeighbors(x, y, z)
    local n = 0
    for _, d in ipairs(DIRS) do
        local k = key(x + d[1], y + d[2], z + d[3])
        if src[k] or poweredWire[k] then n = n + 1 end
    end
    return n
end

-- переключить блок off<->on; isSource=true только для рычагов и гейтов (лампа источником быть не должна!)
local function swap(x, y, z, offId, onId, want, isSource)
    local cur = World.getBlock(x, y, z)
    if want and cur == offId then
        World.setBlock(x, y, z, onId)
        if isSource then src[key(x, y, z)] = true end
        return true
    elseif not want and cur == onId then
        World.setBlock(x, y, z, offId)
        if isSource then src[key(x, y, z)] = nil end
        return true
    end
    return false
end

Timer.create("auto_power", 0.5, 0, function()
    computePower()
    for k in pairs(lamps) do
        local x, y, z = string.match(k, "(-?%d+),(-?%d+),(-?%d+)")
        swap(tonumber(x), tonumber(y), tonumber(z), BL.lamp_off, BL.lamp_on, isPowered(tonumber(x), tonumber(y), tonumber(z)))
    end
    for k in pairs(nots) do
        local x, y, z = string.match(k, "(-?%d+),(-?%d+),(-?%d+)")
        x, y, z = tonumber(x), tonumber(y), tonumber(z)
        swap(x, y, z, BL.not_off, BL.not_on, not isPowered(x, y, z), true)
    end
    for k in pairs(ands) do
        local x, y, z = string.match(k, "(-?%d+),(-?%d+),(-?%d+)")
        x, y, z = tonumber(x), tonumber(y), tonumber(z)
        swap(x, y, z, BL.and_off, BL.and_on, countPoweredNeighbors(x, y, z) >= 2, true)
    end
end)

-- ---------- турель ----------
Timer.create("auto_turret", 1.0, 0, function()
    for k in pairs(turrets) do
        local x, y, z = string.match(k, "(-?%d+),(-?%d+),(-?%d+)")
        x, y, z = tonumber(x) + 0.5, tonumber(y) + 1.0, tonumber(z) + 0.5
        local bx, by, bz = math.floor(x), math.floor(y - 1.0), math.floor(z)
        if isPowered(bx, by, bz) then
            local tg = Mobs.getNearby(x, y, z, 12)
            local best = nil
            for _, m in ipairs(tg) do
                if not best or m.dist < best.dist then best = m end
            end
            if best then
                local dx, dz = best.x - x, best.z - z
                local l = math.sqrt(dx * dx + dz * dz) + 0.001
                Mobs.damage(best.id, 20, dx / l, dz / l)
                Game.spawnParticles(best.x, best.y + 1.0, best.z, 20, 6)
                Sound.beep(880, 0.08)
            end
        end
    end
end)

-- ---------- бур ----------
local ORE_DROP = {
    [World.BLOCKS.COAL_ORE] = "coal",
    [World.BLOCKS.IRON_ORE] = "iron_ingot",
    [World.BLOCKS.DIAMOND_BLOCK] = "diamond_item",
    [World.BLOCKS.GOLD_BLOCK] = "gold_ingot",
    [World.BLOCKS.NETHER_QUARTZ] = "netherite_scrap",
}
Timer.create("auto_drill", 3.0, 0, function()
    for k in pairs(drills) do
        local x, y, z = string.match(k, "(-?%d+),(-?%d+),(-?%d+)")
        x, y, z = tonumber(x), tonumber(y), tonumber(z)
        if isPowered(x, y, z) then
            local done = false
            for dy = 1, 5 do for dx = -1, 1 do for dz = -1, 1 do
                if not done then
                    local b = World.getBlock(x + dx, y - dy, z + dz)
                    local drop = ORE_DROP[b]
                    if drop then
                        World.setBlock(x + dx, y - dy, z + dz, World.BLOCKS.AIR)
                        Player.giveItem(drop, 1)
                        Game.spawnParticles(x + dx + 0.5, y - dy + 0.5, z + dz + 0.5, b, 8)
                        Sound.beep(220, 0.15)
                        Game.toast("⛏️ Бур добыл: " .. drop)
                        done = true
                    end
                end
            end end end
        end
    end
end)

-- ---------- конвейер (везёт игрока) ----------
local beltDir = { dx = 0, dz = -1 }
Events.on("onTick", function(dt)
    if Player.isMounted() then return end
    local px, py, pz = Player.getPos()
    local fx, fz = math.floor(px), math.floor(pz)
    local b = World.getBlock(fx, math.floor(py), fz)
    if b ~= BL.belt then b = World.getBlock(fx, math.floor(py) - 1, fz) end
    if b == BL.belt then
        local d = belts[key(fx, math.floor(py), fz)] or belts[key(fx, math.floor(py) - 1, fz)] or beltDir
        local v = Player.getVelocity()
        Player.setVelocity(d.dx * 5.5, v.y, d.dz * 5.5)
    end
end)

-- ---------- команды ----------

Events.on("onChat", function(text, sender)
    local parts = {}
    for w in string.gmatch(text, "%S+") do parts[#parts + 1] = w end
    local cmd = string.lower(parts[1] or "")

    if cmd == "/lever" then
        -- ищем ближайший рычаг напрямую вокруг игрока
        local px, py, pz = Player.getPos()
        px, py, pz = math.floor(px), math.floor(py), math.floor(pz)
        local found = nil
        for x = px - 6, px + 6 do for y = py - 6, py + 6 do for z = pz - 6, pz + 6 do
            if not found then
                local b = World.getBlock(x, y, z)
                if b == BL.lever_off or b == BL.lever_on then found = { x = x, y = y, z = z, on = (b == BL.lever_on) } end
            end
        end end end
        if found then
            swap(found.x, found.y, found.z, BL.lever_off, BL.lever_on, not found.on, true)
            Sound.beep(found.on and 330 or 660, 0.1)
            Game.toast(found.on and "🔌 Рычаг ВЫКЛ" or "🔌 Рычаг ВКЛ")
        else
            Game.toast("🔌 Рядом нет рычага (радиус 6)")
        end
        return false
    elseif cmd == "/belt" then
        local d = string.lower(parts[2] or "")
        local map = { n = { dx = 0, dz = -1 }, s = { dx = 0, dz = 1 }, e = { dx = 1, dz = 0 }, w = { dx = -1, dz = 0 } }
        if map[d] then
            beltDir = map[d]
            local px, py, pz = Player.getPos()
            px, py, pz = math.floor(px), math.floor(py), math.floor(pz)
            local hit = 0
            for x = px - 6, px + 6 do for y = py - 4, py + 4 do for z = pz - 6, pz + 6 do
                if World.getBlock(x, y, z) == BL.belt then belts[key(x, y, z)] = { dx = beltDir.dx, dz = beltDir.dz } hit = hit + 1 end
            end end end
            Game.toast("➡️ Конвейеры (" .. hit .. ") теперь везут: " .. string.upper(d))
        else
            Game.toast("➡️ Использование: /belt n|s|e|w")
        end
        return false
    elseif cmd == "/auto" then
        local sub = string.lower(parts[2] or "help")
        if sub == "kit" then
            Player.giveItem("lever_off", 4)
            Player.giveItem("wire", 32)
            Player.giveItem("lamp_off", 4)
            Player.giveItem("not_off", 2)
            Player.giveItem("and_off", 2)
            Player.giveItem("belt", 8)
            Player.giveItem("turret", 2)
            Player.giveItem("drill", 1)
            Game.toast("⚙️ Набор автоматизатора выдан!")
        elseif sub == "scan" then
            rescan(24)
            Game.toast("⚙️ Сеть пересканирована")
        else
            Game.chat("⚙️ /auto kit — набор | /auto scan — перескан | /lever — щёлкнуть рычаг | /belt n|s|e|w — направление", "СИСТЕМА")
        end
        return false
    end
end)

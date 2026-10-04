-- ==========================================================
-- 🐲 МОД: МАУНТЫ И ПИТОМЦЫ (приручение ездовых зверей)
-- /tame dragon|beetle|mecha [имя] — скормить дань и попытать удачу.
-- Если в models/ лежит dragon.glb / beetle.glb / mecha.glb
-- (например из .eblan пака) — модель сядет на маунта сама.
-- Команды: /tame, /stable, /call <имя>, /whistle
-- ==========================================================

Mod.register({
    id = "mounts",
    name = "🐲 Маунты и Питомцы",
    version = "1.0",
    author = "Eblankraft Modding Community",
    description = "Приручение: 🐲 дракон (быстрый), 🪲 жук-носорог (танк), 🤖 меха (универсал).",

    onEnable = function()
        Game.toast("🐲 Маунты готовы! /tame dragon — приручить дракона")
    end,

    onDisable = function()
        for vid, inst in pairs(active) do
            if inst.model then Models.remove(inst.model) end
            Vehicles.remove(vid)
        end
        active = {}
    end
})

local MOUNTS = {
    dragon = { title = "🐲 Дракон",       maxSpeed = 34, acceleration = 24, color = "#7b1fa2",
               price = { diamond_item = 6, cooked_steak = 4 }, chance = 0.55,
               trail = 20, hint = "любит алмазы и стейки" },
    beetle = { title = "🪲 Жук-носорог",  maxSpeed = 14, acceleration = 12, color = "#33691e",
               price = { apple = 8, planks = 0 }, chance = 0.9,
               trail = 7, hint = "хрумкает яблоки" },
    mecha  = { title = "🤖 Меха-вездеход", maxSpeed = 24, acceleration = 18, color = "#546e7a",
               price = { iron_ingot = 10, coal = 6 }, chance = 0.75,
               trail = 16, hint = "ест железо и уголь" },
}

active = {}   -- vehicleId -> { type, name, model }
-- коллекция строкой "type|name;..." (storage держит только строки/числа)
collection = {}
local saved = Mod.storage.get("mounts_collection", "")
for mtype, mname in string.gmatch(saved or "", "([^|;]+)|([^;]*);") do
    if MOUNTS[mtype] then collection[#collection + 1] = { type = mtype, name = mname } end
end
local function saveCollection()
    local t = {}
    for _, m in ipairs(collection) do t[#t + 1] = m.type .. "|" .. m.name .. ";" end
    Mod.storage.set("mounts_collection", table.concat(t))
end

local function pay(price)
    for id, n in pairs(price) do
        if n > 0 and Player.getItemCount(id) < n then
            return false, id
        end
    end
    if not Player.isCreative() then
        for id, n in pairs(price) do
            if n > 0 then Player.removeItem(id, n) end
        end
    end
    return true
end

local function priceText(price)
    local t = {}
    for id, n in pairs(price) do
        if n > 0 then t[#t + 1] = id .. " x" .. n end
    end
    return table.concat(t, ", ")
end

local function spawnMount(mtype, name)
    local M = MOUNTS[mtype]
    local px, py, pz = Player.getPos()
    local vid = Vehicles.spawn("mount_" .. mtype, px + 1.5, py + 1.0, pz, {
        maxSpeed = M.maxSpeed, acceleration = M.acceleration, color = M.color,
    })
    if not vid then return nil end
    local inst = { type = mtype, name = name, model = nil }
    if Models.has and Models.has(mtype) then
        inst.model = Models.spawn(mtype, px + 1.5, py + 1.0, pz, { scale = mtype == "dragon" and 1.6 or 1.0 })
    end
    active[vid] = inst
    Vehicles.mount(vid)
    return vid
end

-- модель едет на маунте + огненный след дракона
Events.on("onTick", function(dt)
    for vid, inst in pairs(active) do
        local v = Vehicles.get(vid)
        if not v then
            if inst.model then Models.remove(inst.model) end
            active[vid] = nil
        else
            if inst.model then
                Models.setPos(inst.model, v.x, v.y + 0.6, v.z)
                Models.setRot(inst.model, v.yaw, 0, 0)
            elseif inst.type == "dragon" and math.abs(v.speed) > 4 and math.random() < 0.35 then
                Game.spawnParticles(v.x, v.y + 0.5, v.z, MOUNTS.dragon.trail, 2)
            end
        end
    end
end)

Events.on("onChat", function(text, sender)
    local parts = {}
    for w in string.gmatch(text, "%S+") do parts[#parts + 1] = w end
    local cmd = string.lower(parts[1] or "")

    if cmd == "/tame" then
        local mtype = string.lower(parts[2] or "")
        local M = MOUNTS[mtype]
        if not M then
            Game.chat("🐲 Кого приручаем? /tame dragon|beetle|mecha [имя]", "СТАЙНЯ")
            for k, v in pairs(MOUNTS) do
                Game.chat("• " .. v.title .. " (" .. k .. "): " .. priceText(v.price) .. " — " .. v.hint, "СТАЙНЯ")
            end
            return false
        end
        local name = parts[3] or M.title
        local ok, lack = pay(M.price)
        if not ok then
            Game.toast("🍖 Не хватает дани: нужно " .. lack .. " (" .. priceText(M.price) .. ")")
            return false
        end
        if math.random() > M.chance then
            Sound.screech(0.4)
            Game.toast("💨 " .. M.title .. " вырвался и убежал! Дань съедена. Попробуй ещё.")
            return false
        end
        local vid = spawnMount(mtype, name)
        if vid then
            collection[#collection + 1] = { type = mtype, name = name }
            saveCollection()
            Sound.horn(0.4)
            Game.toast(M.title .. " «" .. name .. "» приручен! W/S — газ, E/Shift — слезть")
            Game.chat("🎉 Приручен " .. M.title .. " по имени «" .. name .. "»!", "СТАЙНЯ")
        end
        return false
    elseif cmd == "/stable" then
        local n = 0
        for vid in pairs(active) do Vehicles.remove(vid) n = n + 1 end
        active = {}
        Game.toast("🐴 Активные маунты отпущены (" .. n .. "). Коллекция: " .. #collection)
        for i, m in ipairs(collection) do
            Game.chat(i .. ". " .. (MOUNTS[m.type] and MOUNTS[m.type].title or m.type) .. " «" .. m.name .. "» — /call " .. i, "СТАЙНЯ")
        end
        return false
    elseif cmd == "/call" then
        local i = tonumber(parts[2] or 0) or 0
        local m = collection[i]
        if m and MOUNTS[m.type] then
            local vid = spawnMount(m.type, m.name)
            if vid then Game.toast("📯 " .. m.name .. " прибежал!") end
        else
            Game.toast("📯 Кого звать? /stable — список коллекции")
        end
        return false
    elseif cmd == "/whistle" then
        if Player.isMounted() then
            local v = Player.getVehicle()
            if v and v.honk then v.honk() else Sound.horn(0.35) end
            Game.toast("📯 Свист! Маунт отзывается")
        else
            Game.toast("📯 Ты не верхом (сядь: подойди к маунту и нажми E)")
        end
        return false
    end
end)

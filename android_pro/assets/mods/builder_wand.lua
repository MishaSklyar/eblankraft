-- ==========================================================
-- 🔨 МОД: ІНСТРУМЕНТИ БУДІВЕЛЬНИКА (BUILDER WAND)
-- Версія: 1.5
-- Автор: Eblankraft Team
-- ==========================================================

Mod.register({
    id = "builder_wand",
    name = "🔨 Інструменти Будівельника (Builder Tools)",
    version = "1.5",
    author = "Eblankraft Team",
    description = "Швидке будівництво: /platform <розмір> [блок], /wall <довжина> <висота> [блок], /cube <розмір> [блок], /cleararea <радіус>.",

    onEnable = function()
        Game.toast("🔨 Builder Tools готові! Напишіть /platform 5 або /cube 3")
    end
})

Events.on("onChat", function(text, sender)
    local parts = {}
    for word in string.gmatch(text, "%S+") do
        table.insert(parts, word)
    end
    local cmd = string.lower(parts[1] or "")

    if cmd == "/platform" then
        local size = tonumber(parts[2]) or 5
        local blockName = string.upper(parts[3] or "PLANKS")
        local blockId = World.BLOCKS[blockName] or World.BLOCKS.PLANKS
        local px, py, pz = Player.getPos()
        local half = math.floor(size / 2)
        World.setBlocks(math.floor(px) - half, math.floor(py) - 1, math.floor(pz) - half,
                        math.floor(px) + half, math.floor(py) - 1, math.floor(pz) + half, blockId)
        Game.toast("🔨 Платформу " .. size .. "x" .. size .. " побудовано!")
        return false
    elseif cmd == "/wall" then
        local len = tonumber(parts[2]) or 6
        local h = tonumber(parts[3]) or 4
        local blockName = string.upper(parts[4] or "BRICKS")
        local blockId = World.BLOCKS[blockName] or World.BLOCKS.BRICKS
        local px, py, pz = Player.getPos()
        World.setBlocks(math.floor(px), math.floor(py), math.floor(pz) + 2,
                        math.floor(px) + len - 1, math.floor(py) + h - 1, math.floor(pz) + 2, blockId)
        Game.toast("🧱 Стіну " .. len .. "x" .. h .. " побудовано!")
        return false
    elseif cmd == "/cube" then
        local size = tonumber(parts[2]) or 4
        local blockName = string.upper(parts[3] or "DIAMOND_BLOCK")
        local blockId = World.BLOCKS[blockName] or World.BLOCKS.DIAMOND_BLOCK
        local px, py, pz = Player.getPos()
        World.setBlocks(math.floor(px) + 2, math.floor(py), math.floor(pz) + 2,
                        math.floor(px) + 2 + size - 1, math.floor(py) + size - 1, math.floor(pz) + 2 + size - 1, blockId)
        Game.toast("📦 Куб " .. size .. "x" .. size .. "x" .. size .. " створено!")
        return false
    elseif cmd == "/cleararea" then
        local rad = tonumber(parts[2]) or 5
        local px, py, pz = Player.getPos()
        World.setBlocks(math.floor(px) - rad, math.floor(py), math.floor(pz) - rad,
                        math.floor(px) + rad, math.floor(py) + rad * 2, math.floor(pz) + rad, World.BLOCKS.AIR)
        Game.toast("🧹 Територію очищено в радіусі " .. rad .. "!")
        return false
    end
end)

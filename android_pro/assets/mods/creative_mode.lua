-- ==========================================================
-- ✨ ОФІЦІЙНИЙ МОД: КРЕАТИВНИЙ РЕЖИМ (CREATIVE MODE)
-- Версія: 2.0
-- Автор: Eblankraft Team
-- Опис: Додає повноцінний творчий режим у Eblankraft 2.0.
-- ==========================================================

Mod.register({
    id = "creative_mode",
    name = "✨ Креативний Режим (Creative Mode)",
    version = "2.0",
    author = "Eblankraft Team",
    description = "Політ (F / подвійний пробіл), Режим Бога, миттєве ламання блоків, нескінченні блоки в руках, дальність 10 блоків, команди /gamemode creative, /gmc, /fly та кнопки на екрані.",

    onEnable = function()
        -- 1. Увімкнути повний креатив
        Player.setCreative(true)
        Player.setGodMode(true)
        Player.setInstantBreak(true)
        Player.setInfiniteBlocks(true)
        Player.setReach(10.0)
        Player.setFlySpeed(12.0)
        Player.setHealth(100)
        Player.setHunger(100)

        Game.toast("✨ Режим Креативу УВІМКНЕНО! [F - Політ]")
        Game.chat("✨ Режим Креативу активовано! [F] - політ, /gamemode survival для вимкнення", "КРЕАТИВ")
    end,

    onDisable = function()
        Player.setCreative(false)
        Player.setFlying(false)
        Player.setGodMode(false)
        Player.setInstantBreak(false)
        Player.setInfiniteBlocks(false)
        Player.setReach(5.2)

        Game.toast("🏕️ Режим Креативу ВИМКНЕНО")
        Game.chat("Режим Креативу вимкнено. Повернення до виживання.", "КРЕАТИВ")
    end
})

-- Перемикання польоту клавішею F (на ПК)
Events.on("onKey", function(keyCode, isDown)
    if not isDown then return end
    if keyCode == "KeyF" then
        if Player.isCreative() or Player.isGodMode() then
            local flying = not Player.isFlying()
            Player.setFlying(flying)
            if flying then
                Game.toast("🕊️ Політ: УВІМКНЕНО [Пробіл - вгору, Shift - вниз]")
            else
                Game.toast("🕊️ Політ: ВИМКНЕНО")
            end
        end
    end
end)

-- Підтримка чат-команд
Events.on("onChat", function(text, sender)
    local cmd = string.lower(text)
    if cmd == "/gmc" or cmd == "/gamemode creative" or cmd == "/gamemode 1" then
        Player.setCreative(true)
        Game.toast("✨ Креативний режим активовано!")
    elseif cmd == "/gms" or cmd == "/gamemode survival" or cmd == "/gamemode 0" then
        Player.setCreative(false)
        Player.setFlying(false)
        Game.toast("🏕️ Режим виживання активовано!")
    elseif cmd == "/fly" then
        local flying = not Player.isFlying()
        Player.setFlying(flying)
        Game.toast(flying and "🕊️ Політ: УВІМКНЕНО" or "🕊️ Політ: ВИМКНЕНО")
    end
end)

-- Підтримання максимуму здоров'я та ситості
Events.on("onTick", function(dt)
    if Player.isCreative() then
        if Player.getHealth() < 100 then Player.setHealth(100) end
        if Player.getHunger() < 100 then Player.setHunger(100) end
    end
end)

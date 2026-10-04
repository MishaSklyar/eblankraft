-- ==========================================================
-- 💣 МОД: СУПЕР ТНТ САЛЮТ (NUKE BLAST)
-- ==========================================================

Mod.register({
    id = "super_tnt",
    name = "💣 Супер ТНТ Салют (Nuke Blast)",
    version = "1.0",
    author = "Eblankraft Team",
    description = "Команда /nuke запускає кільце з динаміту в небо для потужного салюту!",

    onEnable = function()
        Game.toast("💣 Супер ТНТ підключено! Введіть /nuke в чаті")
    end
})

Events.on("onChat", function(text, sender)
    if string.lower(text) == "/nuke" then
        local px, py, pz = Player.getPos()
        for i = 1, 8 do
            local angle = (i / 8) * math.pi * 2
            local vx = math.cos(angle) * 10
            local vz = math.sin(angle) * 10
            World.spawnTNT(px + math.cos(angle) * 1.5, py + 2.5, pz + math.sin(angle) * 1.5, vx, 9, vz)
        end
        Game.toast("💥 NUKE LAUNCHED!")
        return false
    end
end)

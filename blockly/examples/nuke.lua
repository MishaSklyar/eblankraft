-- ==================================================
-- 💣 Блоковий Нюк (приклад Blockly-конструктора)
-- Команда /nuke: кільце ТНТ в небо
-- ==================================================

Mod.register({
    id = "blocky_nuke",
    name = "💣 Блоковий Нюк",
    version = "1.0",
    author = "Blockly",
    description = "Зроблено в Blockly-конструкторі",
    onEnable = function()
        Game.toast("💣 Нюк готовий! Напиши /nuke")
        Chat.addCommand("/nuke", function(text, sender)
            local px, py, pz = Player.getPos()
            for i = 1, 8 do
                local angle = (i / 8) * math.pi * 2
                World.spawnTNT(
                    px + math.cos(angle) * 1.5, py + 2.5, pz + math.sin(angle) * 1.5,
                    math.cos(angle) * 10, 9, math.sin(angle) * 10)
            end
            Game.toast("💥 NUKE LAUNCHED!")
        end)
    end
})

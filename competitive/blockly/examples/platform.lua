-- ==================================================
-- 🔨 Блокова Платформа (приклад Blockly-конструктора)
-- Команда /platform: платформа 7x7 з дощок під ногами
-- ==================================================

Mod.register({
    id = "blocky_platform",
    name = "🔨 Блокова Платформа",
    version = "1.0",
    author = "Blockly",
    description = "Зроблено в Blockly-конструкторі",
    onEnable = function()
        Chat.addCommand("/platform", function(text, sender)
            local px, py, pz = Player.getPos()
            px, py, pz = math.floor(px), math.floor(py), math.floor(pz)
            World.setBlocks(px - 3, py - 1, pz - 3,
                            px + 3, py - 1, pz + 3, World.BLOCKS.PLANKS)
            Game.toast("🔨 Платформу побудовано!")
        end)
    end
})

-- ==================================================
-- 🎒 Блоковий Кіт (приклад Blockly-конструктора)
-- Команда /kit: земля + яблука + лікування
-- ==================================================

Mod.register({
    id = "blocky_kit",
    name = "🎒 Блоковий Кіт",
    version = "1.0",
    author = "Blockly",
    description = "Зроблено в Blockly-конструкторі",
    onEnable = function()
        Chat.addCommand("/kit", function(text, sender)
            Player.giveItem("stone", 32)
            Player.giveItem("apple", 5)
            Player.heal(50)
            Game.toast("🎒 Набір видано!")
        end)
    end
})

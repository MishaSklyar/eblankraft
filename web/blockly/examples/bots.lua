-- Enable this mod, then type /bot in game chat. Walk away: guard follows you.
Mod.register({
    id = "script_bots", name = "Програмований бот", version = "1.0",
    onEnable = function()
        Chat.addCommand("bot", function()
            local p = Player.getPosition()
            Bots.remove("guard")
            if Bots.spawn("guard", p.x + 1, p.y + 0.1, p.z + 1) then
                Bots.setSpeed("guard", 3)
                Bots.followPlayer("guard")
                Game.toast("Бот guard слідує за вами")
            else
                Game.toast("Немає місця для бота: станьте на відкритій поверхні")
            end
        end)
        Chat.addCommand("stopbot", function() Bots.stop("guard") end)
        Chat.addCommand("removebot", function() Bots.remove("guard") end)
    end
})

Mod.register({
    id = "eblan_demo_hello",
    name = "Demo hello",
    version = "1.0",
    author = "eblan",
    description = "Проверка lua из .eblan пака",
    onEnable = function()
        Game.toast("Demo pack: lua работает!")
    end
})

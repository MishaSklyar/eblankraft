-- ==========================================================
-- 🛡️ МОД: NO PVP (МИРНЫЙ РЕЖИМ)
-- ==========================================================
-- Полностью отключает PvP урон между игроками через Networking API.
-- Блокирует как исходящие атаки (удары, выстрелы), так и входящий урон.
-- Команды:
--   /pvp off    - включить режим "No PvP" (мирный)
--   /pvp on     - включить PvP (битвы разрешены)
--   /pvp toggle - переключить режим
--   /pvp        - статус режима
-- ==========================================================

local pvpEnabled = false

local function updateStatus()
    if pvpEnabled then
        Game.toast("⚔️ PvP ВКЛЮЧЕНО! Игроки могут атаковать друг друга.")
        Sound.beep(880, 0.15)
    else
        Game.toast("🛡️ PvP ВЫКЛЮЧЕНО (Мирный режим)! Урон между игроками заблокирован.")
        Sound.beep(440, 0.2)
    end
end

Mod.register({
    id = "no_pvp",
    name = "🛡️ No PvP (Мирный режим)",
    version = "1.0",
    author = "Eblankraft Modding Community",
    description = "Отключает PvP урон: блокирует исходящие и входящие атаки через Networking API. /pvp on|off",

    onEnable = function()
        pvpEnabled = false
        Game.toast("🛡️ Мод 'No PvP' активирован! Введите /pvp для управления.")
    end,

    onDisable = function()
        pvpEnabled = true
        Game.toast("⚔️ Мод 'No PvP' отключен. Обычный режим PvP активен.")
    end
})

-- 1. Перехват исходящего пакета атаки (когда мы бьем другого игрока)
Net.hookSend(Net.PACKETS.PVP_HIT, function(packet)
    if not pvpEnabled then
        Game.toast("🛡️ [No PvP] Урон по игрокам отключен! Введите /pvp on")
        Sound.dryFire()
        return false -- ОТМЕНЯЕТ ПАКЕТ АТАКИ (урон и пакет не отправляются)
    end
end)

-- 2. Перехват входящего пакета атаки (когда другой игрок пытается ударить нас)
Net.hookReceive(Net.PACKETS.PVP_HIT, function(packet, senderPeerId)
    if not pvpEnabled then
        local attacker = packet.attackerName or "Игрок"
        Game.toast("🛡️ [No PvP] Заблокирована атака от " .. attacker .. "!")
        Sound.tone(520, 0.1, "sine")
        return false -- ОТМЕНЯЕТ ВХОДЯЩИЙ ПАКЕТ УРОНА (здоровье не тратится)
    end
end)

-- 3. Регистрация команды /pvp
local function handlePvPCommand(arg)
    arg = string.lower(arg or "")
    if arg == "on" or arg == "1" or arg == "true" then
        pvpEnabled = true
        updateStatus()
    elseif arg == "off" or arg == "0" or arg == "false" then
        pvpEnabled = false
        updateStatus()
    elseif arg == "toggle" then
        pvpEnabled = not pvpEnabled
        updateStatus()
    else
        if pvpEnabled then
            Game.toast("⚔️ PvP сейчас ВКЛЮЧЕНО (/pvp off для выключения)")
        else
            Game.toast("🛡️ PvP сейчас ВЫКЛЮЧЕНО (/pvp on для включения)")
        end
    end
end

Chat.addCommand("pvp", function(argsStr)
    handlePvPCommand(argsStr)
end)

-- Резервный перехват через событие onChat (для совместимости)
Events.on("onChat", function(text, sender)
    if not text then return end
    local lower = string.lower(text)
    if lower:sub(1, 4) == "/pvp" then
        local arg = lower:match("^/pvp%s+(%S+)")
        handlePvPCommand(arg or "")
        return false
    end
end)

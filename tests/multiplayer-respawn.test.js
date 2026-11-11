const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

for (const prefix of ['js', 'web/js']) {
    const load = (file, extra = []) => {
        const c = vm.createContext({ THREE, console, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout, document: { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) } });
        c.window = c;
        for (const f of [...extra, file]) vm.runInContext(fs.readFileSync(`${prefix}/${f}.js`, 'utf8'), c);
        return c;
    };

    test(`${prefix}: Player.die exists so the server's death_event cannot crash the client`, () => {
        const c = load('player', ['textures', 'items']);
        const p = { health: 40, isDead: false, iq: 100, soundManager: null };
        c.Player.prototype.die.call(p, 'killed');
        assert.deepEqual([p.health, p.isDead, p.deathReason, p.iq], [0, true, 'killed', 50]);
        c.Player.prototype.die.call(p, 'again');           // idempotent
        assert.equal(p.iq, 50);
    });

    test(`${prefix}: respawn in a shared room asks the server and only falls back locally when it stays silent`, async () => {
        const c = load('ui', ['textures', 'items']);
        const respawn = c.UIManager ? c.UIManager.prototype.respawnPlayer : null;
        assert.ok(respawn, 'UIManager.respawnPlayer exists');
        const mk = (online) => {
            const sent = []; let spawned = 0, hidden = 0;
            const ui = { isDuelActive: false, hideDeathScreen: () => hidden++,
                player: { isDead: true, spawnSafe() { spawned++; this.isDead = false; } },
                game: { arenaClient: null, serverClient: { isConnected: online, currentRoom: online ? 'pvp_arena' : null, loadingRoom: false, requestRespawn: () => sent.push(1) } } };
            return { ui, sent, get spawned() { return spawned; }, get hidden() { return hidden; } };
        };
        // offline: local respawn immediately, nothing sent
        let t = mk(false); respawn.call(t.ui); assert.deepEqual([t.sent.length, t.spawned, t.hidden], [0, 1, 1]);
        // online: request sent, no local teleport yet (server must revive the player)
        t = mk(true); respawn.call(t.ui);
        assert.deepEqual([t.sent.length, t.spawned], [1, 0]);
        clearTimeout(t.ui._respawnRetry);
        // revived by player_respawned -> pending retry does nothing
        t = mk(true); respawn.call(t.ui); t.ui.player.isDead = false; clearTimeout(t.ui._respawnRetry);
        assert.equal(t.spawned, 0);
    });
}

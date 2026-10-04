'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

class Vector3 {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
    clone() { return new Vector3(this.x, this.y, this.z); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    addScaledVector(v, scale) { this.x += v.x * scale; this.y += v.y * scale; this.z += v.z * scale; return this; }
    normalize() {
        const length = Math.hypot(this.x, this.y, this.z) || 1;
        this.x /= length; this.y /= length; this.z /= length;
        return this;
    }
}

function harness(gunType = 'ak47', reserve = 40) {
    let now = 0;
    const saved = [];
    const item = { itemId: gunType, count: 1 };
    const registry = {
        [gunType]: { isGun: true, gunType, ammoType: 'ammo', attackDamage: 40 },
        ammo: { name: 'Ammo' }, sword: { category: 'weapon' },
    };
    const context = vm.createContext({
        window: { ITEM_REGISTRY: registry }, ITEM_REGISTRY: registry,
        THREE: { Vector3 }, performance: { now: () => now },
        localStorage: { setItem: (key, value) => saved.push([key, value]) },
        setTimeout: () => 1, clearTimeout() {},
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/player.js'), 'utf8'), context);
    const player = Object.create(context.window.Player.prototype);
    const shots = [];
    Object.assign(player, {
        inventory: [item, reserve ? { itemId: 'ammo', count: reserve } : null],
        selectedHotbarIndex: 0, isCreative: false, isDead: false,
        position: new Vector3(), velocity: new Vector3(), onGround: true,
        yaw: 0, pitch: 0, eyeHeight: 1.62, gunTriggerHeld: false, gunBurst: 0,
        game: { ui: { initHotbar() {}, showToast() {} }, soundManager: { playClick() {} },
            modManager: { soundSynth: { reload() {} }, weaponManager: {
                shoot: opts => { shots.push(opts); return { hit: false }; },
                launchRocket: opts => shots.push(opts),
            } } },
        updateHeldBlock() {},
    });
    return { player, item, context, shots, saved, time: value => { now = value; } };
}

test('first magazine uses reserve once; firing misses cannot create ammunition', () => {
    const h = harness();
    assert.equal(h.player.getGunState().ammo, 30);
    assert.equal(h.player.getGunState().reserve, 10);
    assert.equal(h.item.gunAmmo + h.player.getItemCount('ammo'), 40);
    h.player.tryShootGun();
    h.time(50);
    h.player.tryShootGun();
    assert.equal(h.shots.length, 1, 'cooldown must reject the second shot even when the first was at time zero');
    assert.equal(h.item.gunAmmo, 29);
    assert.equal(h.player.getItemCount('ammo'), 10);
    h.player.saveInventory();
    assert.equal(JSON.parse(h.saved[0][1])[0].gunAmmo, 29);
});

test('reload transfers partial reserve only at its deadline and repeated R does not restart it', () => {
    const h = harness('ak47', 33);
    h.player.getGunState();
    h.item.gunAmmo = 20;
    assert.equal(h.player.reloadGun(), true);
    const deadline = h.player.gunReload.until;
    h.time(1000);
    assert.equal(h.player.reloadGun(), false);
    assert.equal(h.player.gunReload.until, deadline);
    h.player.tryShootGun();
    assert.equal(h.shots.length, 0);
    assert.equal(h.player.getItemCount('ammo'), 3);
    h.time(deadline - 1);
    h.player.updateGunReload();
    assert.equal(h.item.gunAmmo, 20);
    h.time(deadline);
    h.player.updateGunReload();
    assert.equal(h.item.gunAmmo, 23);
    assert.equal(h.player.getItemCount('ammo'), 0);
    assert.equal(h.player.gunReload, null);
});

test('switching weapons cancels reload without consuming reserve; magazines remain per item', () => {
    const h = harness();
    h.player.getGunState();
    h.item.gunAmmo = 15;
    h.player.inventory[2] = { itemId: 'ak47', count: 1 };
    h.player.reloadGun();
    h.player.selectedHotbarIndex = 2;
    h.time(3000);
    h.player.updateGunReload();
    assert.equal(h.player.gunReload, null);
    assert.equal(h.item.gunAmmo, 15);
    assert.equal(h.player.getItemCount('ammo'), 10);
    assert.equal(h.player.getGunState().ammo, 10);
    h.player.selectedHotbarIndex = 0;
    assert.equal(h.player.getGunState().ammo, 15);
});

test('pistols require release, rifles repeat; a rejected fast pistol press cannot fire later while held', () => {
    const h = harness('glock', 40);
    h.player.tryShootGun();
    h.time(200);
    h.player.tryShootGun();
    assert.equal(h.shots.length, 1);
    h.player.releaseGunTrigger();
    h.player.tryShootGun();
    assert.equal(h.shots.length, 2);
    h.player.releaseGunTrigger();
    h.time(220);
    h.player.tryShootGun();
    h.time(500);
    h.player.tryShootGun();
    assert.equal(h.shots.length, 2);
    const automatic = harness();
    automatic.player.tryShootGun();
    automatic.time(110);
    automatic.player.tryShootGun();
    assert.equal(automatic.shots.length, 2);
});

test('empty automatic starts reload; no reserve and missing weapon manager cannot fire', () => {
    const h = harness();
    h.player.getGunState();
    h.item.gunAmmo = 0;
    h.player.tryShootGun();
    assert.ok(h.player.gunReload);
    assert.equal(h.shots.length, 0);
    h.time(2500);
    h.player.tryShootGun();
    assert.equal(h.shots.length, 1);
    assert.equal(h.item.gunAmmo, 9);
    const empty = harness('ak47', 0);
    assert.equal(empty.player.tryShootGun(), true, 'a dry weapon still suppresses block mining');
    assert.equal(empty.shots.length, 0);
    assert.equal(empty.player.gunReload, undefined);
    const missing = harness();
    missing.player.getGunState();
    missing.player.game.modManager.weaponManager = null;
    assert.equal(missing.player.tryShootGun(), true);
    assert.equal(missing.item.gunAmmo, 30);
});

test('creative firing never creates survival ammunition; melee remains outside gun path', () => {
    const h = harness('glock', 5);
    h.player.isCreative = true;
    h.player.tryShootGun();
    assert.equal(h.player.getItemCount('ammo'), 5);
    assert.equal(h.item.gunAmmo, 0);
    h.player.isCreative = false;
    assert.equal(h.player.getGunState().ammo, 0);
    h.player.inventory[0] = { itemId: 'sword', count: 1 };
    assert.equal(h.player.tryShootGun(), false);
});

test('Dust2 firing reaches authoritative attack before sandbox inventory checks', () => {
    const h = harness('glock', 0);
    let attacks = 0;
    h.player.game.arenaClient = { isActive: true, attack: () => { attacks++; return true; } };
    assert.equal(h.player.tryShootGun(), true);
    assert.equal(attacks, 1);
    assert.equal(h.item.gunAmmo, undefined);
    assert.equal(h.player.getGunState(), null);
    assert.equal(h.player.reloadGun(), false);
});

test('duel countdown prevents damage and movement; duel kit is never persisted', () => {
    const h = harness();
    Object.assign(h.player.game.ui, { isDuelActive: true, duelCountdown: 3, duelSavedSession: {} });
    let views = 0;
    h.player.updateView = () => views++;
    h.player.velocity.set(7, 8, 9);
    assert.equal(h.player.tryShootGun(), true);
    assert.equal(h.player.attackMob(), false);
    h.player.detonateTNT();
    h.player.updatePhysics(0.1, { x: 1, y: 1 }, true, false, false);
    assert.equal(h.player.velocity.x, 0);
    assert.equal(h.player.position.x, 0);
    assert.equal(views, 1);
    assert.equal(h.shots.length, 0);
    h.player.saveInventory();
    assert.equal(h.saved.length, 0);
});

test('movement and automatic bursts widen spread, resting resets the burst', () => {
    const h = harness();
    h.player.tryShootGun();
    const resting = h.shots[0].spread;
    h.time(110);
    h.player.tryShootGun();
    assert.ok(h.shots[1].spread > resting);
    h.time(600);
    h.player.tryShootGun();
    assert.equal(h.shots[2].spread, resting);
    h.player.velocity.x = 7;
    h.player.onGround = false;
    h.time(1000);
    h.player.tryShootGun();
    assert.ok(h.shots[3].spread > resting);
});

test('bullet follows aim before camera recoil, and explicit zero recoil is respected', () => {
    const h = harness();
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/mods.js'), 'utf8'), h.context);
    const Manager = vm.runInContext('WeaponCombatManager', h.context);
    const manager = new Manager({ player: h.player, scene: {} });
    let direction;
    manager._raycastBullet = (origin, dir, range) => { direction = dir; return { hit: false, distance: range }; };
    manager._spawnTracer = () => {};
    manager._spawnMuzzleFlash = () => {};
    manager.shoot({ spread: 0, recoilPitch: 0.08, recoilYaw: 0, sound: false });
    assert.equal(direction.y, 0);
    assert.equal(direction.z, -1);
    assert.equal(h.player.pitch, 0.08);
    assert.equal(h.player.gunRecoilPitch, 0.08);
    manager.shoot({ spread: 0, recoilPitch: 0, recoilYaw: 0, sound: false });
    assert.equal(h.player.pitch, 0.08);
    assert.equal(h.player.yaw, 0);
});

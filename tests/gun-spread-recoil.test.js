const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');

// Built-in guns only (the sandbox path through Player.tryShootGun), with the real three.js.
function harness(gunType = 'ak47') {
    let now = 0;
    const registry = {
        [gunType]: { isGun: true, gunType, ammoType: 'ammo', attackDamage: 40 },
        ammo: { name: 'Ammo' },
    };
    const elements = {
        crosshair: { isConnected: true, classList: { toggle() {} } },
        'crosshair-spread': { isConnected: true, style: {} },
    };
    const context = vm.createContext({
        THREE, performance: { now: () => now }, innerHeight: 1000, console,
        ITEM_TYPES: {}, ITEM_REGISTRY: registry,
        localStorage: { getItem: () => null, setItem() {} },
        setTimeout: () => 1, clearTimeout() {},
        document: { getElementById: id => elements[id] || null },
    });
    context.window = context;
    for (const file of ['upgrader_skins', 'player']) vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), context);
    const player = Object.create(context.Player.prototype);
    const shots = [], rockets = [];
    Object.assign(player, {
        camera: new THREE.PerspectiveCamera(72, 1.5, .05, 100),
        inventory: [{ itemId: gunType, gunAmmo: 99 }, { itemId: 'ammo', count: 200 }],
        selectedHotbarIndex: 0, isCreative: false, isDead: false, isDuelLocked: () => false,
        position: new THREE.Vector3(), velocity: new THREE.Vector3(), onGround: true,
        yaw: 0, pitch: 0, eyeHeight: 1.62, gunTriggerHeld: false, gunBurst: 0,
        saveInventoryDebounced() {}, updateHeldBlock() {},
        game: {
            ui: { initHotbar() {}, showToast() {} }, soundManager: { playClick() {} },
            modManager: { soundSynth: { reload() {} }, weaponManager: {
                shoot: opts => { shots.push(opts); return { hit: false }; },
                launchRocket: opts => rockets.push(opts),
            } },
        },
    });
    return {
        player, shots, rockets, elements,
        reg: registry[gunType],
        time: value => { now = value; },
    };
}

const ringPx = h => parseFloat(h.elements['crosshair-spread'].style.width) / 2;

test('movement, airborne and sustained fire widen built-in spread; the shot uses exactly that spread', () => {
    const h = harness('ak47');
    const p = h.player, spec = p.getGunSpec(h.reg);
    const resting = p.gunSpreadFor(h.reg, spec, 0);

    p.velocity.x = 7;
    const moving = p.gunSpreadFor(h.reg, spec, 0);
    p.onGround = false;
    const airborne = p.gunSpreadFor(h.reg, spec, 0);
    assert.ok(resting < moving && moving < airborne, 'running and jumping each widen the cone');

    h.time(1000);
    p.tryShootGun();
    assert.equal(h.shots[0].spread, airborne, 'the bullet is fired with the spread the ring shows');

    p.velocity.x = 0; p.onGround = true;
    h.time(1110);
    p.tryShootGun();
    assert.ok(h.shots[1].spread > resting, 'automatic fire builds a burst');
    assert.equal(h.shots[1].spread, p.gunSpreadFor(h.reg, spec, p.gunBurst));

    h.time(1800);
    p.tryShootGun();
    assert.equal(h.shots[2].spread, resting, 'a pause longer than 320 ms resets the burst');
});

test('spread ring: grows with the real cone, shrinks while aiming, hidden without a gun', () => {
    const h = harness('ak47');
    const p = h.player;
    p.updateGunSpreadRing(0);
    const resting = ringPx(h);
    assert.ok(resting > 1, 'resting AK-47 shows a ring');
    assert.equal(h.elements['crosshair-spread'].style.display, 'block');

    p.velocity.x = 7; p.onGround = false;
    p.updateGunSpreadRing(0);
    const airborne = ringPx(h);
    assert.ok(airborne > resting * 1.5, 'airborne movement visibly widens the ring');

    p.isAiming = true;
    p.updateGunSpreadRing(0);
    assert.ok(ringPx(h) < airborne, 'aiming tightens the ring');

    p.game.arenaClient = { isActive: true };
    p.updateGunSpreadRing(0);
    assert.equal(h.elements['crosshair-spread'].style.display, 'none', 'arena weapons keep their server-side accuracy');
    p.game.arenaClient = null;

    p.inventory[0] = { itemId: 'sword' };
    p.updateGunSpreadRing(0);
    assert.equal(h.elements['crosshair-spread'].style.display, 'none', 'no ring without a gun in hand');
});

test('RPG rockets kick the camera and viewmodel like the other guns', () => {
    const h = harness('rpg');
    const p = h.player, spec = p.getGunSpec(h.reg);
    assert.equal(spec.recoil > 0, true);
    p.tryShootGun();
    assert.equal(h.rockets.length, 1, 'the rocket still launches');
    assert.ok(Math.abs(p.pitch - spec.recoil) < 1e-9, 'camera pitch kicks by the RPG recoil');
    assert.ok(Math.abs(p.gunRecoilPitch - spec.recoil) < 1e-9, 'the kick recovers through the shared view path');
    assert.ok(p.weaponKick > 0, 'the viewmodel kicks');
    p.updateGunSpreadRing(5000);
    assert.equal(h.elements['crosshair-spread'].style.display, 'none', 'rockets have no bullet spread ring');
});

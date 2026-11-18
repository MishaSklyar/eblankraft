const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
        crosshair: { isConnected: true, classList: { toggle() {} }, innerHTML: '' },
        'crosshair-spread': { isConnected: true, style: {} },
    };
    const context = vm.createContext({
        THREE, performance: { now: () => now }, innerHeight: 1000, console,
        ITEM_TYPES: {}, ITEM_REGISTRY: registry,
        localStorage: { getItem: () => null, setItem() {} },
        setTimeout: () => 1, clearTimeout() {},
        document: { documentElement: { style: { setProperty() {} } }, getElementById: id => elements[id] || null },
    });
    context.window = context;
    for (const file of ['upgrader_skins', 'crosshair', 'player']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', `${file}.js`), 'utf8'), context);
    }
    const player = Object.create(context.Player.prototype);
    const shots = [], rockets = [];
    Object.assign(player, {
        camera: new THREE.PerspectiveCamera(72, 1.5, .05, 100),
        inventory: [{ itemId: gunType, gunAmmo: 99 }, { itemId: 'ammo', count: 200 }],
        selectedHotbarIndex: 0, isCreative: false, isDead: false, isDuelLocked: () => false,
        position: new THREE.Vector3(), velocity: new THREE.Vector3(), onGround: true,
        yaw: 0, pitch: 0, eyeHeight: 1.62, gunTriggerHeld: false,
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
        player, shots, rockets, elements, context,
        reg: registry[gunType],
        time: value => { now = value; },
    };
}

// Runs the per-frame update the game loop runs, so the smoothed accuracy state can ramp.
const settle = (p, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) p.updateWeaponView(1 / 60); };
const ringPx = h => parseFloat(h.elements['crosshair-spread'].style.width) / 2;

test('running and jumping widen built-in spread, ramping in rather than stepping', () => {
    const h = harness('ak47');
    const p = h.player, spec = p.getGunSpec(h.reg);
    settle(p, 0.5);
    const resting = p.gunSpreadFor(h.reg, spec, 0);

    p.velocity.x = 7.5;   // sprint
    settle(p, 0.6);
    const sprinting = p.gunSpreadFor(h.reg, spec, 0);
    assert.ok(sprinting > resting + 0.04, `sprinting adds a real cone (${resting.toFixed(4)} -> ${sprinting.toFixed(4)})`);

    p.timeSinceGrounded = 1;   // airborne for real
    settle(p, 0.6);
    const airborne = p.gunSpreadFor(h.reg, spec, 0);
    assert.ok(airborne > sprinting + 0.05, 'jumping adds on top of running');

    h.time(1000);
    p.tryShootGun();
    assert.equal(h.shots[0].spread, airborne, 'the bullet is fired with the spread the ring shows');
});

test('brief ground contacts do not flicker the airborne penalty', () => {
    const h = harness('ak47');
    const p = h.player, spec = p.getGunSpec(h.reg);
    p.velocity.x = 7.5;
    settle(p, 0.6);
    let prev = p.gunSpreadFor(h.reg, spec, 0), maxStep = 0, maxAir = 0;
    for (let i = 0; i < 240; i++) {
        // Stair steps and ledges: one frame off the ground every seventh frame.
        p.timeSinceGrounded = i % 7 === 0 ? 1 / 60 : 0;
        p.updateWeaponView(1 / 60);
        const s = p.gunSpreadFor(h.reg, spec, 0);
        maxStep = Math.max(maxStep, Math.abs(s - prev));
        maxAir = Math.max(maxAir, p.accAir);
        prev = s;
    }
    assert.ok(maxAir < 0.05, `a one-frame lift does not count as airborne (accAir peaked at ${maxAir.toFixed(3)})`);
    assert.ok(maxStep < 0.002, `spread does not jump frame to frame (largest step ${maxStep.toFixed(4)})`);
});

test('sustained fire blooms each shot, and the bloom fades smoothly after the trigger is released', () => {
    const h = harness('ak47');
    const p = h.player, spec = p.getGunSpec(h.reg);
    settle(p, 0.3);
    const resting = p.gunSpreadFor(h.reg, spec, 0);
    for (let i = 0; i < 12; i++) {
        h.time(1000 + i * 110);
        p.tryShootGun();
        settle(p, 0.11);
    }
    const spreads = h.shots.map(s => s.spread);
    assert.equal(spreads[0], resting, 'the first bullet has no bloom yet');
    for (let i = 1; i < spreads.length; i++) assert.ok(spreads[i] >= spreads[i - 1] - 1e-12, 'bloom only grows while firing');
    assert.ok(spreads[1] > resting, 'the second bullet is blooming');
    assert.ok(spreads[spreads.length - 1] <= resting + 0.10 + 1e-9, 'bloom is capped');

    const peak = p.gunBloom;
    let prev = p.gunSpreadFor(h.reg, spec, p.gunBloom), maxStep = 0;
    for (let i = 0; i < 60; i++) {
        settle(p, 1 / 60);
        const s = p.gunSpreadFor(h.reg, spec, p.gunBloom);
        maxStep = Math.max(maxStep, Math.abs(s - prev));
        prev = s;
    }
    assert.ok(maxStep < 0.004, `bloom fades a little each frame, never a step (largest step ${maxStep.toFixed(4)})`);
    assert.ok(p.gunBloom < peak * 0.1, 'bloom is mostly gone a second after the trigger is released');
});

test('spread ring: tracks the real cone, shrinks when aiming, hidden without a gun or in the arena', () => {
    const h = harness('ak47');
    const p = h.player;
    settle(p, 0.3);
    const resting = ringPx(h);
    assert.ok(resting > 1, 'resting AK-47 shows a ring');
    assert.equal(h.elements['crosshair-spread'].style.display, 'block');

    p.velocity.x = 7.5;
    settle(p, 0.6);
    const sprinting = ringPx(h);
    assert.ok(sprinting > resting * 2, 'sprinting visibly widens the ring');

    p.isAiming = true;
    settle(p, 0.3);
    assert.ok(ringPx(h) < sprinting, 'aiming tightens the ring');
    p.isAiming = false;

    p.game.arenaClient = { isActive: true };
    settle(p, 0.05);
    assert.equal(h.elements['crosshair-spread'].style.display, 'none', 'arena weapons keep their server-side accuracy');
    p.game.arenaClient = null;

    p.inventory[0] = { itemId: 'sword' };
    settle(p, 0.05);
    assert.equal(h.elements['crosshair-spread'].style.display, 'none', 'no ring without a gun in hand');
});

test('the spread ring can be turned off in the crosshair customizer', () => {
    const h = harness('ak47');
    const p = h.player;
    settle(p, 0.3);
    assert.equal(h.elements['crosshair-spread'].style.display, 'block');
    h.context.CrosshairStyle.update({ spreadRing: false });
    settle(p, 0.05);
    assert.equal(h.elements['crosshair-spread'].style.display, 'none', 'the customizer switch hides the ring');
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
    p.updateGunSpreadRing();
    assert.equal(h.elements['crosshair-spread'].style.display, 'none', 'rockets have no bullet spread ring');
});

test('bullet spread is a round disc: no shot leaves the cone, and its outer edge is reached', () => {
    const context = vm.createContext({
        THREE, console, performance: { now: () => 0 }, ITEM_REGISTRY: {},
        localStorage: { getItem: () => null, setItem() {} }, setTimeout: () => 1, clearTimeout() {},
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/mods.js'), 'utf8'), context);
    const Manager = vm.runInContext('WeaponCombatManager', context);
    const manager = new Manager({ player: {}, scene: {} });
    const aim = new THREE.Vector3(0.3, 0.2, -0.93).normalize();
    const spread = 0.05;
    let maxAngle = 0, outer = 0;
    for (let i = 0; i < 4000; i++) {
        const dir = manager._spreadDirection(aim, spread);
        assert.ok(Math.abs(dir.length() - 1) < 1e-9, 'shot directions stay unit length');
        const angle = Math.acos(Math.min(1, dir.dot(aim)));
        maxAngle = Math.max(maxAngle, angle);
        if (angle > 0.75 * spread) outer++;
    }
    assert.ok(maxAngle <= spread + 1e-9, 'no bullet leaves the spread cone');
    // The old cube-shaped pattern could never put a bullet past 0.71x its radius; a uniform disc puts ~44% past 0.75x.
    assert.ok(outer > 4000 * 0.3, `the outer part of the disc is reached (${outer} of 4000 past 0.75x)`);
});

test('scoping the AWP pulls the whole cone in, including while moving', () => {
    const h = harness('awp');
    const p = h.player, reg = h.reg, spec = p.getGunSpec(reg);
    settle(p, 0.5);
    p.velocity.x = 7.5;
    settle(p, 0.6);
    const hip = p.gunSpreadFor(reg, spec, 0);
    p.isAiming = true;
    const aimed = p.gunSpreadFor(reg, spec, 0);
    p.isScoped = true;
    const scoped = p.gunSpreadFor(reg, spec, 0);
    assert.ok(scoped < aimed * 0.4, `scoped is far tighter than aimed (${aimed.toFixed(4)} aimed, ${scoped.toFixed(4)} scoped)`);
    assert.ok(scoped < hip * 0.4, `scoped is far tighter than hip-fire (${hip.toFixed(4)} hip, ${scoped.toFixed(4)} scoped)`);
});

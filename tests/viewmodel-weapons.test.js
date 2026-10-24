const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../js/three.min.js');
function setup() {
    const context = vm.createContext({ THREE, performance, console, ITEM_TYPES: {}, ITEM_REGISTRY: {
        ak47: { isGun: true, gunType: 'ak47' }, awp: { isGun: true, gunType: 'awp' }, sword: { isSword: true }
    }, localStorage: { getItem: () => null }, document: { getElementById: () => null } });
    context.window = context;
    for (const file of ['upgrader_skins', 'player']) vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), context);
    context.skinManager = null;
    const p = Object.create(context.Player.prototype);
    Object.assign(p, { camera: new THREE.PerspectiveCamera(90, 1.5, .05, 100), scene: new THREE.Scene(),
        game: {}, inventory: [{ itemId: 'ak47' }], selectedHotbarIndex: 0,
        position: new THREE.Vector3(), velocity: new THREE.Vector3(), eyeHeight: 1.62, yaw: 0, pitch: 0,
        walkCycle: 0, armSwing: 0, onGround: true,
        syncInventoryWithServer() {}, updateRaycast() {}, updateTargetLock() {} });
    return { context, p };
}
test('skin front faces -Z and panels are not horizontally mirrored', () => {
    const { context } = setup();
    const geometry = context.createMinecraftBoxGeometry(.5, .5, .5, 0, 0, 8, 8, 8);
    const uv = geometry.getAttribute('uv');
    assert.equal(uv.getX(20), 8 / 64, 'front uses the face panel, not back-of-head hair');
    assert.equal(uv.getX(16), 24 / 64, 'back uses the back panel');
    for (let f = 0; f < 6; f++) assert.ok(uv.getX(f * 4) < uv.getX(f * 4 + 1));
});
test('each firearm has a distinct volumetric model, with an unobstructed aimed center', () => {
    const { context } = setup();
    const signatures = new Set();
    for (const type of ['ak47', 'm4a1', 'awp', 'shotgun', 'deagle', 'glock', 'mp5', 'rpg']) {
        const gun = context.createVoxelGunModel(type);
        assert.ok(gun.children.length >= 7);
        assert.ok(gun.children.every(m => m.geometry.type === 'BoxGeometry'));
        const bounds = new THREE.Box3().setFromObject(gun);
        assert.ok(bounds.min.z < -.3);
        signatures.add(JSON.stringify([gun.children.length, bounds.min.z, gun.children[0].material.color.getHex()]));
        gun.position.set(0, -(type === 'awp' ? .17 : type === 'rpg' ? .245 : .13), -.54);
        gun.updateMatrixWorld(true);
        const hits = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1)).intersectObjects(gun.children);
        assert.equal(hits.length, 0, `${type} sights leave the center visible`);
    }
    assert.ok(signatures.size >= 6);
});
test('ADS smoothly zooms, restores custom FOV, and cancels on reload, death, or switching items', () => {
    const { p } = setup();
    assert.equal(p.setAiming(true), true);
    for (let i = 0; i < 90; i++) p.updateWeaponView(1 / 60);
    assert.ok(Math.abs(p.camera.fov - 90 * .78) < .01);
    p.setAiming(false);
    for (let i = 0; i < 90; i++) p.updateWeaponView(1 / 60);
    assert.equal(p.camera.fov, 90);
    p.inventory[0] = { itemId: 'awp' }; p.setAiming(true);
    for (let i = 0; i < 90; i++) p.updateWeaponView(1 / 60);
    assert.ok(Math.abs(p.camera.fov - 28) < .01); assert.equal(p.isScoped, true);
    p.gunReload = { item: p.inventory[0] }; p.updateWeaponView(1 / 60);
    assert.equal(p.isAiming, false);
    p.gunReload = null; p.setAiming(true); p.isDead = true; p.updateWeaponView(1 / 60);
    assert.equal(p.isAiming, false);
    p.isDead = false; p.setAiming(true); p.inventory[0] = { itemId: 'sword' }; p.updateWeaponView(1 / 60);
    assert.equal(p.isAiming, false); assert.equal(p.isScoped, false);
});
test('viewmodel recoil recovers in the shared view path, including Dust2', () => {
    const { p } = setup();
    p.game.arenaClient = { isActive: true };
    p.gunRecoilPitch = p.pitch = .1; p.weaponKick = 1;
    p.updateView(1 / 60);
    assert.ok(p.pitch > 0 && p.pitch < .1); assert.ok(p.weaponKick < 1);
    for (let i = 0; i < 120; i++) p.updateView(1 / 60);
    assert.ok(p.pitch < .0001); assert.ok(p.weaponKick < .0001);
});
test('switching guns or clearing a slot replaces first- and third-person meshes cleanly', () => {
    const { p } = setup();
    p.initThirdPersonModel(); p.initFirstPersonHand();
    assert.equal(p.heldGunMesh.name, 'gun_ak47');
    assert.equal(p.mcModel.itemContainer.children[0].name, 'gun_ak47');
    p.inventory[0] = { itemId: 'awp' }; p.updateHeldBlock();
    assert.equal(p.heldGunMesh.name, 'gun_awp'); assert.equal(p.mcModel.itemContainer.children.length, 1);
    p.inventory[0] = null; p.updateHeldBlock();
    assert.equal(p.heldGunMesh, null); assert.equal(p.mcModel.itemContainer.children.length, 0);
    assert.equal(p.heldToolMesh.visible, false); assert.equal(p.armMesh.visible, true);
});

test('Dust2 applies ADS spread on the authority and accepts only boolean aim intent', () => {
    const { ArenaService } = require('../server/arena');
    const arena = new ArenaService();
    const p = { id: 'shooter', name: 'shooter', is_bot: false };
    arena.newDust(p, 'T', 100); arena.spawnDust(p, 100, 0);
    p.y = 40;
    const shots = [], room = { phase: 'live', players: new Map([[p.id, p]]), broadcast: m => shots.push(m) };
    p.attack_pending = true; arena.fire(room, p, 100);
    p.arena_input.aim = true; p.attack_pending = true; p.last_input_time = 101;
    arena.fire(room, p, 101);
    assert.ok(shots[1].spread < shots[0].spread);
    assert.equal(p.ammo, 18, 'both shots consume server ammunition');
    const { AuthoritativeGameServer, WSClient } = require('../server');
    const game = new AuthoritativeGameServer({ clock: () => 100 });
    try {
        const client = new WSClient(null, game); client.send_json = () => {};
        game.process_message(client, { type: 'arena_join', room: 'aim-test', mode: 'dust2' });
        const input = { type: 'arena_input', seq: 1, strafe: 0, forward: 0, yaw: 0, pitch: 0, jump: false, sprint: false, use: false, aim: 'yes' };
        game.process_message(client, input); assert.equal(client.input_seq, -1);
        game.process_message(client, { ...input, aim: true }); assert.equal(client.arena_input.aim, true);
        game.process_message(client, { ...input, seq: 2, aim: false }); assert.equal(client.arena_input.aim, false);
    } finally { game.stop(); }
});

test('buying a new Dust2 weapon in the same slot refreshes its model', () => {
    const { context, p } = setup();
    vm.runInContext(fs.readFileSync('js/arena_client.js', 'utf8'), context);
    p.initFirstPersonHand();
    const game = { player: p, ui: { initHotbar() {} } }, client = new context.ArenaClient(game, { remotePlayers: new Map(), updatePlayerCount() {} });
    Object.assign(client, { clientId: 'me', mode: 'dust2', reconcile() {}, releaseTrigger() {}, renderDustHud() {} });
    client.applySnapshot([{ id: 'me', primary: 'awp', secondary: 'glock', heldItem: 'awp', health: 100, alive: true, spawn: 1 }]);
    assert.equal(p.heldGunMesh.name, 'gun_awp');
});

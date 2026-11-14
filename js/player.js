/**
 * Eblankraft 2.0 - Player Controller, Survival Mechanics, Mining Speed, Combat & Skins
 */

function isPassThroughBlock(b) {
    if (b === 0 || b === undefined || b === null) return true;
    if (window.BLOCK_INFO && window.BLOCK_INFO[b] && window.BLOCK_INFO[b].solid === false) {
        return true;
    }
    const bt = window.BLOCK_TYPES || (typeof BLOCK_TYPES !== 'undefined' ? BLOCK_TYPES : {});
    return b === bt.AIR ||
           b === bt.WATER ||
           b === bt.PORTAL_NETHER ||
           b === bt.PORTAL_END ||
           b === bt.RED_FLOWER ||
           b === bt.YELLOW_FLOWER ||
           b === bt.RED_MUSHROOM ||
           b === bt.BROWN_MUSHROOM ||
           b === bt.REDSTONE_WIRE ||
           b === bt.REDSTONE_TORCH ||
           b === bt.LEVER ||
           b === bt.STONE_BUTTON ||
           b === bt.PRESSURE_PLATE;
}
window.isPassThroughBlock = isPassThroughBlock;

// Pixel-sized cuboids, aligned with the camera's -Z aiming direction.
function createVoxelGunModel(type, skin) {
    const root = new THREE.Group(); root.name = 'gun_' + type;
    const pistol = type === 'glock' || type === 'deagle';
    const metal = new THREE.MeshLambertMaterial({ color: type === 'deagle' ? 0x9ba1a3 : 0x30383b });
    const dark = new THREE.MeshLambertMaterial({ color: 0x161b1d });
    const furniture = new THREE.MeshLambertMaterial({ color: type === 'ak47' ? 0x9a5930 : type === 'awp' || type === 'rpg' ? 0x647348 : 0x41494b });
    const sight = new THREE.MeshLambertMaterial({ color: 0xb6c7b0 });
    const box = (name, w, h, d, x, y, z, material = metal) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.name = name; mesh.position.set(x, y, z); root.add(mesh); return mesh;
    };
    const length = pistol ? .34 : type === 'awp' ? .94 : type === 'mp5' ? .58 : .78;
    box('receiver', pistol ? .10 : .13, .12, pistol ? .24 : .34, 0, 0, -.1);
    box('barrel', .055, .055, length - .16, 0, .025, -.16 - (length - .16) / 2, dark);
    box('muzzle', .075, .075, .045, 0, .025, -length, dark);
    box('grip', .085, .20, .10, 0, -.12, pistol ? -.015 : .015, furniture).rotation.x = -.22;
    if (!pistol) {
        box('stock', .105, .15, .25, 0, -.015, .17, furniture);
        box('handguard', .14, .105, length * .36, 0, -.015, -.3 - length * .12, furniture);
        box('magazine', .085, type === 'shotgun' ? .08 : .22, .12, 0, -.15, -.18, dark).rotation.x = type === 'ak47' ? -.26 : .08;
    }
    // A separated rear notch keeps the center of the sight picture open.
    const sightY = type === 'rpg' ? .21 : .095;
    for (const x of [-.035, .035]) box('rear_sight', .018, .045, .025, x, sightY, pistol ? -.025 : .025, dark);
    box('front_sight', .014, .05, .024, 0, sightY + .005, -length + .07, sight);
    if (type === 'awp') {
        box('scope_mount', .06, .07, .14, 0, .10, -.10, dark);
        for (const x of [-.05, .05]) box('scope_side', .02, .12, .32, x, .17, -.14, dark);
        for (const y of [.12, .22]) box('scope_rim', .08, .02, .32, 0, y, -.14, dark);
    }
    if (type === 'm4a1') {
        for (const x of [-.05, .05]) box('handle_mount', .02, .08, .17, x, .12, -.12, dark);
        box('carry_handle', .12, .02, .17, 0, .17, -.12, dark);
    }
    if (type === 'shotgun') box('pump', .17, .12, .20, 0, -.025, -.49, furniture);
    if (type === 'rpg') box('launcher_tube', .20, .20, 1.02, 0, .03, -.25, furniture);

    // Skins recolor the receiver/furniture and add decals (names start with `skin_`).
    if (skin === 'dragon_lore') {
        const gold = new THREE.MeshLambertMaterial({ color: 0xc9a227, emissive: 0x2a2000 });
        const red = new THREE.MeshLambertMaterial({ color: 0xb02a1a });
        metal.color.setHex(0x365a30);                      // receiver: dragon-scale green
        furniture.color.setHex(0x1d3320);                  // stock / grip
        for (const m of root.children) {
            if (m.name === 'muzzle' || m.name.startsWith('scope_rim') || m.name === 'scope_mount') m.material = gold;
        }
        box('skin_band', .14, .03, .05, 0, .0, -.02, gold);
        box('skin_tag', .10, .012, .10, 0, -.067, -.05, gold);                      // souvenir plate
        for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) {                       // gold scales along the receiver
            box('skin_scale', .006, .03, .032, sx * .068, .02 - (i % 2) * .032, -.30 + i * .05, gold);
        }
        for (const sx of [-1, 1]) {
            box('skin_dragon', .006, .07, .09, sx * .056, -.012, .17, red);           // dragon on the stock
            box('skin_eye', .008, .016, .016, sx * .058, .012, .20, gold);
            for (let i = 0; i < 4; i++) box('skin_sticker', .005, .026, .026, sx * .058, .035 - (i % 2) * .03, .09 + Math.floor(i / 2) * .035, gold);   // souvenir stickers
        }
    }
    return root;
}
window.createVoxelGunModel = createVoxelGunModel;

// --- 3D CS-style knives (voxel cuboids; blade points to -Z, origin = middle of the handle) ---
const KNIFE_STYLES = {
    default:  { blade: 0x9aa3ad, edge: 0xd5dbe0, spine: 0x6c747c, handle: 0x2b2b2b, dark: 0x161616, guard: 0x555b61 },
    bayonet:  { blade: 0xaab6c4, edge: 0xe8f0f8, spine: 0x7a8794, handle: 0x8a6a3c, dark: 0x4a3820, guard: 0x6b7078 },
    huntsman: { blade: 0xa8b0b8, edge: 0xe0e6ea, spine: 0x737b83, handle: 0x6b4426, dark: 0x3a2412, guard: 0xb08a4a },
    m9:       { blade: 0xb8c0c9, edge: 0xf2f6fa, spine: 0x7e868f, handle: 0x1f1f24, dark: 0x0c0c10, guard: 0x7b8189 },
    butterfly:{ blade: 0x4b8bd6, edge: 0xb8d8ff, spine: 0x2f66a8, handle: 0x8e44ad, dark: 0x4a2260, guard: 0xd0d0d0 },
    karambit: { blade: 0xc0392b, edge: 0xff8a7a, spine: 0x8a2418, handle: 0x222222, dark: 0x101010, guard: 0xe0b020 },
    gold:     { blade: 0xf5c518, edge: 0xfff3a0, spine: 0xc9961a, handle: 0x7a4a10, dark: 0x3d2408, guard: 0xffe066, shine: 0x2a1f00 },
};
// Blade outline: n slices from the guard to the tip. low/high = edge/spine y at slice t (0..1).
const KNIFE_BLADES = {
    default:  { L: .24, n: 8, th: .010, low: t => -.024 * (1 - .85 * t ** 3), high: t => .018 * (1 - Math.max(0, (t - .55) / .45) ** 1.5) },
    bayonet:  { L: .27, n: 9, th: .012, low: t => -.024 * (1 - .5 * t ** 3), high: t => .020 * (t < .5 ? 1 : 1 - ((t - .5) / .5) * .85), fuller: true },
    huntsman: { L: .25, n: 9, th: .011, low: t => -.030 * (1 - .8 * t ** 2.2), high: t => .014 * (1 - (t > .5 ? ((t - .5) / .5) ** 1.3 : 0)) },
    m9:       { L: .29, n: 10, th: .016, low: t => -.030 * (1 - .55 * t ** 3), high: t => .026 * (t < .5 ? 1 : 1 - ((t - .5) / .5) * .8), fuller: true, saw: true },
    gold:     { L: .29, n: 10, th: .016, low: t => -.030 * (1 - .55 * t ** 3), high: t => .026 * (t < .5 ? 1 : 1 - ((t - .5) / .5) * .8), fuller: true, saw: true },
    butterfly:{ L: .21, n: 8, th: .009, low: t => -.026 * (1 - .8 * t ** 3), high: t => .016 * (1 - (t > .5 ? ((t - .5) / .5) ** 1.4 : 0)) },
};

function _buildVoxelKnifeModel(type) {
    const style = KNIFE_STYLES[type] || KNIFE_STYLES.default;
    const root = new THREE.Group(); root.name = 'knife_' + type;
    const inner = new THREE.Group(); inner.position.z = -.085; root.add(inner);   // origin in the middle of the handle
    const mats = {};
    const mat = (key) => mats[key] || (mats[key] = new THREE.MeshLambertMaterial({ color: new THREE.Color(style[key]).multiplyScalar(.78), emissive: style.shine && (key === 'blade' || key === 'edge') ? style.shine : 0x000000 }));
    const box = (name, w, h, d, x, y, z, key, rx = 0, ry = 0, rz = 0) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(key));
        m.name = name; m.position.set(x, y, z); m.rotation.set(rx, ry, rz); inner.add(m); return m;
    };

    if (type === 'karambit') {
        // curved claw blade: arc of tilted slices, edge on the inside of the curve
        const R = .17, n = 10, span = 1.25;
        for (let i = 0; i < n; i++) {
            const a0 = span * i / n, a1 = span * (i + 1) / n, am = (a0 + a1) / 2;
            const h = .034 * (1 - .93 * (i / n) ** 1.6) + .004;
            const len = R * (a1 - a0) * 1.08;
            const cy = -R + R * Math.cos(am), cz = -R * Math.sin(am);
            box('blade', .009, h, len, 0, cy + h * .35, cz, 'blade', -am);
            box('edge', .011, .006, len, 0, cy - h * .15, cz, 'edge', -am);
        }
        box('spine', .011, .006, .09, 0, .018, -.035, 'spine', -.12);
        box('guard', .018, .05, .012, 0, 0, 0, 'guard');
        // curved handle + finger ring
        box('handle', .026, .042, .13, 0, -.002, .075, 'handle');
        for (const z of [.04, .08, .12]) box('grip_band', .028, .044, .012, 0, -.002, z, 'dark');
        const rr = .03;
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            box('ring', .010, .012, .026, 0, -.012 + Math.sin(a) * rr, .175 + Math.cos(a) * rr, 'guard', a);
        }
        return root;
    }

    const bl = KNIFE_BLADES[type] || KNIFE_BLADES.default;
    const slice = bl.L / bl.n;
    for (let i = 0; i < bl.n; i++) {
        const t = (i + .5) / bl.n, lo = bl.low(t), hi = Math.max(lo + .006, bl.high(t));
        const z = -(i + .5) * slice;
        box('blade', bl.th, hi - lo, slice * 1.02, 0, (lo + hi) / 2, z, 'blade');
        box('edge', bl.th + .002, .005, slice * 1.02, 0, lo + .0025, z, 'edge');
        box('spine', bl.th + .002, .004, slice * 1.02, 0, hi - .002, z, 'spine');
    }
    if (bl.fuller) box('fuller', bl.th + .003, .006, bl.L * .6, 0, .003, -bl.L * .45, 'dark');
    if (bl.saw) for (let i = 0; i < 6; i++) box('saw_tooth', bl.th, .008, .012, 0, .029, -.06 - i * .022, 'dark');

    if (type === 'butterfly') {
        // two handle halves flanking the tang, with pivot pins
        // each handle half swings around the pin at the blade end (animated by the viewmodel)
        const halves = [-1, 1].map(sx => {
            const g = new THREE.Group(); g.name = 'handle_group'; g.position.set(0, 0, .02); inner.add(g);
            for (const m of [box('handle_half', .011, .038, .17, sx * .0105, 0, .09, 'handle'), box('handle_rail', .013, .01, .17, sx * .0105, -.02, .09, 'guard')]) { m.position.z -= .02; g.add(m); }
            if (sx > 0) { const l = box('latch', .03, .02, .02, 0, .0, .185, 'dark'); l.position.z -= .02; g.add(l); }
            return g;
        });
        root.userData.halves = halves;
        for (const z of [.02, .12]) box('pivot_pin', .036, .012, .012, 0, 0, z, 'guard');
        return root;
    }

    // guard
    const heavy = type === 'm9' || type === 'gold' || type === 'bayonet';
    box('guard', heavy ? .026 : .02, heavy ? .072 : .06, .014, 0, 0, .004, type === 'huntsman' ? 'guard' : 'guard');
    if (type === 'huntsman') box('bolster', .03, .046, .02, 0, -.001, .018, 'guard');
    // handle
    const hLen = .16, hz = .01 + hLen / 2 + .006;
    box('handle', .028, .040, hLen, 0, -.002, hz, 'handle');
    for (let i = 0; i < 4; i++) box('grip_band', .03, .042, .01, 0, -.002, .04 + i * .034, 'dark');
    if (type === 'huntsman') for (const z of [.05, .13]) box('rivet', .032, .01, .01, 0, .006, z, 'guard');
    if (type === 'bayonet') box('muzzle_ring', .036, .05, .014, 0, 0, .185, 'guard');
    box('pommel', .034, .044, .016, 0, -.002, .178, type === 'default' ? 'guard' : 'dark');
    if (type === 'm9' || type === 'gold') box('lanyard_hole', .006, .014, .01, 0, .01, .178, 'guard');
    return root;
}
function createVoxelKnifeModel(type) {
    const root = _buildVoxelKnifeModel(type);
    const style = KNIFE_STYLES[type] || KNIFE_STYLES.default, bl = KNIFE_BLADES[type] || KNIFE_BLADES.default;
    // blade tip and a point halfway down the blade (knife space), used by the slash trail
    if (type === 'karambit') { root.userData.tip = new THREE.Vector3(0, -.112, -.246); root.userData.mid = new THREE.Vector3(0, -.035, -.17); }
    else { root.userData.tip = new THREE.Vector3(0, -.004, -.085 - bl.L); root.userData.mid = new THREE.Vector3(0, -.004, -.085 - bl.L * .42); }
    const c = new THREE.Color(style.edge);
    root.userData.trailColor = [c.r * .6 + .4, c.g * .6 + .4, c.b * .6 + .4];
    return root;
}
window.createVoxelKnifeModel = createVoxelKnifeModel;

// --- Knife viewmodel v2 ----------------------------------------------------------------------------
// Rig (all in camera space, under handGroup):
//   itemPivot (wrist / grip) ─┬─ knifeHand  gloved fist wrapped around the handle
//                             └─ knife      spins / tosses inside the hand (mx my mz, kx ky kz)
//   knifeForearm              sleeve + glove cuff, stretched every frame from the wrist to a lagging elbow (2-bone-ish IK)
//   knifeTrail                additive ribbon behind the blade tip during the strike of an attack
// Every action (pickup, 3 attacks, inspect) is a keyframed clip sampled with Catmull-Rom splines, layered on top of
// spring-driven procedural motion (mouse sway, walk figure-8, strafe roll, jump / landing, sprint, block, breathing).
// Channels: px py pz wrist offset · rx ry rz wrist rotation · mx my mz knife spin · kx ky kz knife toss · hA hB balisong · open fingers
const TAU = Math.PI * 2;
const KNIFE_CHANNELS = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'mx', 'my', 'mz', 'kx', 'ky', 'kz', 'hA', 'hB', 'open'];
const _clamp01 = t => Math.max(0, Math.min(1, t));
const _ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const _wrapPi = a => a - TAU * Math.round(a / TAU);

// keys: [[time in seconds, {channel: value}], ...]. A channel starts and ends at 0 unless a key at 0 / dur says otherwise.
function knifeClip(dur, keys, extra = {}) {
    const tracks = {};
    for (const [t, vals] of keys) for (const ch in vals) (tracks[ch] || (tracks[ch] = [])).push([Math.min(dur, Math.max(0, t)), vals[ch]]);
    for (const ch in tracks) {
        const tr = tracks[ch].sort((a, b) => a[0] - b[0]);
        if (tr[0][0] > 0) tr.unshift([0, 0]);
        if (tr[tr.length - 1][0] < dur) tr.push([dur, 0]);
    }
    return { dur, tracks, ...extra };
}
function sampleKnifeTrack(tr, t) {   // cubic Hermite with Catmull-Rom tangents (flat at both ends)
    const n = tr.length;
    if (t <= tr[0][0]) return tr[0][1];
    if (t >= tr[n - 1][0]) return tr[n - 1][1];
    let i = 0; while (i < n - 2 && t > tr[i + 1][0]) i++;
    const [t0, v0] = tr[i], [t1, v1] = tr[i + 1], h = t1 - t0;
    if (h <= 1e-9) return v1;
    const tan = j => (j <= 0 || j >= n - 1) ? 0 : (tr[j + 1][1] - tr[j - 1][1]) / (tr[j + 1][0] - tr[j - 1][0]);
    const s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * tan(i) * h + (3 * s2 - 2 * s3) * v1 + (s3 - s2) * tan(i + 1) * h;
}
function applyKnifeClip(clip, t, o, w = 1) {
    for (const ch in clip.tracks) o[ch] += sampleKnifeTrack(clip.tracks[ch], t) * w;
}
function _kSpring(s, target, dt, w = 14, z = .55) {   // damped spring, s = {x, v}
    const a = w * w * (target - s.x) - 2 * z * w * s.v;
    s.v += a * dt; s.x += s.v * dt;
    return s.x;
}
// bring the knife up toward the centre of the screen, blade turned to the camera (used by every inspect)
const _lift = (pose, k, add = {}) => {
    const o = { px: (.11 - pose.px) * k, py: .075 * k, pz: .06 * k, rx: .16 * k, ry: .42 * k, rz: 0 };
    for (const c in add) o[c] = (o[c] || 0) + add[c];
    return o;
};
// attack builders: u = normalised time. s overrides / extends the keys (wind = anticipation, mid = through the centre,
// end = follow-through, hang = recovery start), s.keys adds extra channel keys (flips, rolls).
const _atk = (d, keys, s, hit, trail) => knifeClip(d, keys.concat((s.keys || []).map(([u, v]) => [u, v])).map(([u, v]) => [u * d, v]), { hit, trail, swish: s.swish || 1 });
function _slash(pose, s = {}) {      // forehand: right -> left, slightly downward
    const a = s.amp || 1;
    return _atk(s.dur || .46, [
        [.15, { px: .07 * a, py: .065, pz: .035, rx: .28, ry: -.55, rz: -.22, open: .15, ...s.wind }],
        [.29, { px: -.08 * a, py: .0, pz: -.13, rx: -.04, ry: .25 * a, rz: .2, open: 0, ...s.mid }],
        [.41, { px: -.27 * a, py: -.09, pz: -.06, rx: -.36, ry: .85 * a, rz: .42, ...s.end }],
        [.6, { px: -.23 * a, py: -.09, pz: -.03, rx: -.28, ry: .7 * a, rz: .32, ...s.hang }],
    ], s, .26, [.19, .46]);
}
function _backslash(pose, s = {}) {  // backhand: left -> right, rising
    const a = s.amp || 1;
    return _atk(s.dur || .46, [
        [.15, { px: -.12 * a, py: -.06, pz: .03, rx: -.3, ry: .6, rz: .32, open: .15, ...s.wind }],
        [.29, { px: -.01, py: .04, pz: -.14, rx: .0, ry: -.05, rz: -.1, open: 0, ...s.mid }],
        [.41, { px: .10 * a, py: .13, pz: -.07, rx: .32, ry: -.6 * a, rz: -.45, ...s.end }],
        [.6, { px: .08 * a, py: .10, pz: -.04, rx: .25, ry: -.48 * a, rz: -.36, ...s.hang }],
    ], s, .26, [.19, .46]);
}
function _knifeAim(pose) {   // camera-space yaw / pitch that turn the blade from its rest direction toward the crosshair
    const d = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pose.rx, pose.ry, pose.rz));
    const yaw = Math.atan2(-d.x, -d.z), pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
    return { y: Math.atan2(pose.px - .08, 1) - yaw, p: Math.atan2(-pose.py + .02, 1) - pitch };
}
function _stab(pose, s = {}) {       // pull back, thrust at the crosshair, twist, pull out
    const aim = _knifeAim(pose), reach = s.reach || 1;
    return _atk(s.dur || .5, [
        [.18, { px: .04, py: -.035, pz: .10, rx: -.12, ry: -.1, rz: .12, ...s.wind }],
        [.31, { px: -.08, py: .04, pz: -.28 * reach, rx: aim.p * .95, ry: aim.y * .95, rz: -.1, ...s.mid }],
        [.39, { px: -.1, py: .045, pz: -.35 * reach, rx: aim.p, ry: aim.y, rz: -.35, ...s.end }],
        [.58, { px: -.08, py: .03, pz: -.27 * reach, rx: aim.p * .85, ry: aim.y * .85, rz: -.3, ...s.hang }],
    ], s, .29, [.24, .42]);
}

const KNIFE_ANIMS = {};

// Gun pickup / draw: the weapon swings up from below the screen, muzzle rising, settles with a small overshoot, then the
// charging handle is racked (pull back + release). Heavier guns take longer (see GUN_DRAW_TIME). Same clip system as the knives.
const GUN_DRAW_CLIP = knifeClip(.7, [
    [0, { py: -.46, pz: .12, px: .12, rx: -1.3, ry: .55, rz: .4 }],
    [.26, { py: .035, pz: -.035, px: -.015, rx: .17, ry: -.12, rz: -.07 }],
    [.38, { py: -.018, pz: .0, rx: -.045, ry: .02, rz: .02 }],
    [.47, { py: -.01, pz: .075, rx: .07, ry: 0, rz: -.03 }],    // rack the charging handle back...
    [.55, { py: 0, pz: .075, rx: .07 }],
    [.64, { pz: -.012, rx: -.015 }],                              // ...and let it slam forward
]);
const GUN_DRAW_TIME = { default: .7, awp: 1.0, rpg: 1.05, shotgun: .85, ak47: .8, m4a1: .75, mp5: .62, deagle: .6, glock: .5 };
const _defKnife = (name, def) => {
    const p = def.pose;
    def.attacks = def.attacks(p);
    def.inspect = def.inspect(p);
    def.drawTime = def.draw.dur; def.inspectTime = def.inspect.dur;
    def.forearm = def.forearm || [.62, -.5, .6];
    def.wrist = def.wrist || [.022, -.012, .06];
    KNIFE_ANIMS[name] = def;
};

_defKnife('default', {   // classic CT knife: relaxed forward grip, clean swipes, flat roll to show both sides
    pose: { px: .18, py: -.18, pz: -.36, rx: .5, ry: .65, rz: -.9, scale: 1.1 },
    draw: knifeClip(.6, [[0, { py: -.34, px: .12, pz: .08, rx: -1.0, ry: -.35, rz: .85, open: .4 }], [.28, { py: .025, px: -.01, rx: .14, rz: -.1 }], [.42, { py: -.008, rx: -.03 }]]),
    attacks: p => [_slash(p), _backslash(p), _stab(p)],
    inspect: p => knifeClip(2.3, [
        [.38, _lift(p, 1, { rz: .1 })],
        [.85, _lift(p, 1, { rz: -1.15, ry: .15, mz: .15 })],
        [1.3, _lift(p, 1.02, { rz: -1.05, ry: .1, mz: Math.PI })],
        [1.75, _lift(p, .9, { rz: -.3, mz: TAU })],
        [2.3, { mz: TAU }],
    ]),
});

_defKnife('bayonet', {   // heavy combat knife: upright, hacking chops, flipped and caught by the handle
    pose: { px: .18, py: -.175, pz: -.38, rx: .4, ry: .55, rz: -.7, scale: 1.12 },
    draw: knifeClip(.8, [[0, { py: -.38, px: .2, pz: .1, ry: -.9, mz: -1.6, open: .5 }], [.36, { py: .03, ry: .1, mz: .12, open: 0 }], [.52, { py: -.012, ry: -.02, mz: -.03 }]]),
    attacks: p => [
        _slash(p, { dur: .54, wind: { py: .14, rx: .6, ry: -.25, rz: -.15 }, mid: { py: .02, rx: -.1 }, end: { py: -.15, rx: -.62, px: -.18, ry: .45, rz: .35 }, hang: { py: -.12, rx: -.5, px: -.16, ry: .38, rz: .28 }, swish: .8 }),
        _backslash(p, { dur: .5, amp: 1.05, swish: .85 }),
        _stab(p, { dur: .56, reach: 1.15, swish: .8 }),
    ],
    inspect: p => knifeClip(2.4, [
        [.35, _lift(p, 1.1, { rz: .25 })],
        [.62, _lift(p, 1.15, { ky: .07, mx: -Math.PI * .6, open: 1, ry: .2 })],
        [.9, _lift(p, 1.1, { ky: .02, mx: -TAU, open: .3, ry: .3 })],
        [1.05, _lift(p, 1.1, { mx: -TAU, ry: .35, rz: -.2 })],
        [1.55, _lift(p, 1.05, { mx: -TAU, ry: .75, rz: -.75, my: .3 })],
        [1.95, _lift(p, .8, { mx: -TAU, rz: -.2 })],
        [2.4, { mx: -TAU }],
    ]),
});

_defKnife('huntsman', {   // low, tilted hunting grip: hooking cuts that roll the blade through the target
    pose: { px: .19, py: -.19, pz: -.35, rx: .6, ry: .75, rz: -1.05, scale: 1.08 },
    draw: knifeClip(.75, [[0, { py: -.38, px: .1, mx: -TAU, ky: 0, open: .8 }], [.18, { py: -.12, ky: .08, mx: -TAU * .6 }], [.42, { py: .025, ky: .0, mx: .1, open: 0 }], [.56, { py: -.01, mx: -.02 }]]),
    attacks: p => [
        _slash(p, { dur: .48, keys: [[.36, { mz: .55 }], [.62, { mz: .35 }]] }),
        _backslash(p, { dur: .48, keys: [[.36, { mz: -.6 }], [.62, { mz: -.3 }]] }),
        _stab(p, { wind: { rz: .3 }, end: { rz: -.6 } }),
    ],
    inspect: p => knifeClip(2.4, [
        [.35, _lift(p, 1, { rz: .2 })],
        [.8, _lift(p, 1, { rz: -.9, mz: .1 })],
        [1.0, _lift(p, 1.05, { rz: -.9, ky: .06, mx: -Math.PI, open: 1 })],
        [1.22, _lift(p, 1, { rz: -.8, ky: 0, mx: -TAU, open: 0 })],
        [1.7, _lift(p, 1, { rz: -.25, ry: .3, mx: -TAU, my: .35 })],
        [2.4, { mx: -TAU }],
    ]),
});

_defKnife('m9', {   // big bayonet blade: wide sweeping arcs, spun in from the holster, slow admiring roll
    pose: { px: .18, py: -.18, pz: -.37, rx: .48, ry: .62, rz: -.85, scale: 1.14 },
    draw: knifeClip(.72, [[0, { py: -.4, px: .12, rx: -.8, mz: TAU, open: .4 }], [.36, { py: .03, rx: .1, mz: -.1, open: 0 }], [.52, { py: -.01, rx: -.02, mz: .02 }]]),
    attacks: p => [
        _slash(p, { dur: .5, amp: 1.3, keys: [[.4, { mz: .4 }]], swish: .9 }),
        _backslash(p, { dur: .5, amp: 1.25, keys: [[.4, { mz: -.45 }]], swish: .9 }),
        _stab(p, { dur: .52, reach: 1.1, swish: .9 }),
    ],
    inspect: p => knifeClip(2.6, [
        [.4, _lift(p, 1.05)],
        [1.0, _lift(p, 1.1, { rz: -1.0, mz: .2, ry: .15 })],
        [1.45, _lift(p, 1.1, { rz: -1.0, mz: Math.PI, mx: .35 })],
        [1.95, _lift(p, 1, { rz: -.4, mz: TAU, mx: -.2 })],
        [2.6, { mz: TAU }],
    ]),
});

_defKnife('butterfly', {   // balisong: handles flick open, flips mid-swing, full fan routine on inspect
    pose: { px: .175, py: -.175, pz: -.35, rx: .55, ry: .6, rz: -.8, scale: 1.2 },
    draw: knifeClip(1.05, [
        [0, { py: -.36, px: .1, mx: TAU * 2, mz: .6, hA: Math.PI, hB: Math.PI, open: .6 }],
        [.3, { py: -.04, hA: Math.PI * .65, hB: Math.PI }],
        [.5, { py: .03, hA: -.25, hB: Math.PI * .5 }],
        [.7, { hA: .06, hB: -.2, open: 0 }],
        [.82, { py: -.008, hB: .05 }],
    ]),
    attacks: p => [
        _slash(p, { dur: .42, keys: [[.12, { mx: 0, ky: 0 }], [.3, { mx: Math.PI, ky: .035, hA: .9, hB: .45 }], [.48, { mx: TAU, ky: 0, hA: 0, hB: 0 }], [1, { mx: TAU }]] }),
        _backslash(p, { dur: .42, keys: [[.12, { mz: 0 }], [.45, { mz: -TAU, hB: .8, hA: .35 }], [.6, { hA: 0, hB: 0 }], [1, { mz: -TAU }]] }),
        _stab(p, { dur: .46, keys: [[.15, { mx: 0 }], [.32, { mx: -TAU }], [1, { mx: -TAU }]] }),
    ],
    inspect: p => knifeClip(3.4, [
        [.3, _lift(p, 1.1)],
        [.6, _lift(p, 1.15, { hA: Math.PI, hB: .3, open: .6 })],                       // first handle swings around the blade
        [.85, _lift(p, 1.15, { hA: Math.PI, hB: Math.PI, mx: 0 })],                      // fully closed
        [1.35, _lift(p, 1.2, { hA: Math.PI, hB: Math.PI, mx: TAU, ky: .04 })],           // double flip closed
        [1.8, _lift(p, 1.2, { hA: Math.PI, hB: Math.PI, mx: TAU * 2, ky: 0 })],
        [2.15, _lift(p, 1.15, { hA: .0, hB: Math.PI * .8, mx: TAU * 2 })],               // fan open again
        [2.45, _lift(p, 1.1, { hA: 0, hB: 0, mx: TAU * 2, rz: -.6, open: 0 })],
        [2.9, _lift(p, 1, { mx: TAU * 2, mz: TAU, rz: -.3 })],
        [3.4, { mx: TAU * 2, mz: TAU }],
    ]),
});

_defKnife('karambit', {   // reverse grip, finger through the ring: twirls on the ring, wrist-roll slashes
    pose: { px: .2, py: -.07, pz: -.4, rx: 1.75, ry: -.4, rz: -.6, scale: 1.25 },
    pivot: [0, -.012, .09],   // the finger ring
    mount: { rot: [0, Math.PI, 0], pos: [0, 0, .03] },   // reverse grip: ring at the index finger, blade out of the pinky side
    forearm: [.85, -.3, .45], wrist: [.03, .0, .03],
    draw: knifeClip(.95, [[0, { py: -.38, px: .15, rz: .5, mx: -TAU * 2, mz: .5, open: .3 }], [.45, { py: .03, rz: -.06, mx: -.15, open: 0 }], [.65, { py: -.01, mx: .03 }]]),
    attacks: p => [
        _slash(p, { dur: .46, keys: [[.12, { mx: 0 }], [.5, { mx: -TAU }], [1, { mx: -TAU }]] }),
        _backslash(p, { dur: .46, end: { rz: -.75, ry: -.5 }, keys: [[.4, { mz: -.85 }]] }),
        _stab(p, { dur: .5, keys: [[.15, { mx: 0 }], [.55, { mx: -TAU * 2 }], [1, { mx: -TAU * 2 }]] }),
    ],
    inspect: p => knifeClip(3.1, [
        [.3, _lift(p, 1.25)],
        [.95, _lift(p, 1.3, { mx: -TAU * 2, mz: .3 })],                // two fast ring spins
        [1.3, _lift(p, 1.3, { mx: -TAU * 2, my: .55, mz: .4 })],       // hold to show the curve
        [1.6, _lift(p, 1.3, { mx: -TAU * 2 + .9, my: .5, mz: .4 })],   // reverse flick
        [2.15, _lift(p, 1.2, { mx: -TAU * 3, my: 0, mz: .2 })],        // final spin
        [2.55, _lift(p, .7, { mx: -TAU * 3 })],
        [3.1, { mx: -TAU * 3 }],
    ]),
});

_defKnife('gold', {   // slow, showy rotations so the shine catches the light
    pose: { px: .18, py: -.18, pz: -.37, rx: .5, ry: .68, rz: -.95, scale: 1.14 },
    draw: knifeClip(.85, [[0, { py: -.44, px: .1, rx: -.7, my: TAU, mz: .5, open: .4 }], [.42, { py: .03, rx: .1, my: -.12, open: 0 }], [.6, { py: -.01, my: .03 }]]),
    attacks: p => [
        _slash(p, { dur: .5, amp: 1.25, keys: [[.42, { my: .3 }]] }),
        _backslash(p, { dur: .5, amp: 1.2, keys: [[.42, { my: -.3 }]] }),
        _stab(p, { dur: .52, keys: [[.45, { mz: -.8 }]] }),
    ],
    inspect: p => knifeClip(2.9, [
        [.45, _lift(p, 1.25, { rz: .2 })],
        [1.25, _lift(p, 1.35, { my: Math.PI, mz: .5, mx: -.3 })],
        [2.0, _lift(p, 1.3, { my: TAU, mz: .2, rz: -.7 })],
        [2.4, _lift(p, .8, { my: TAU, rz: -.2 })],
        [2.9, { my: TAU }],
    ]),
});
window.KNIFE_ANIMS = KNIFE_ANIMS;
window.knifeClip = knifeClip; window.sampleKnifeTrack = sampleKnifeTrack;

// Gloved fist wrapped around a knife handle (knife-root units: handle along Z, blade toward -Z, edge down).
const KNIFE_GLOVE = { glove: 0x30343a, dark: 0x1d2024, pad: 0x4b525b, tip: 0x3a3f46, skin: 0xd2a27c };
function createKnifeHandModel(type) {
    const root = new THREE.Group(); root.name = 'knife_hand';
    const fingers = new THREE.Group(); fingers.name = 'knife_fingers'; root.add(fingers);
    const thumb = new THREE.Group(); thumb.name = 'knife_thumb'; root.add(thumb);
    const mats = {};
    const mat = k => mats[k] || (mats[k] = new THREE.MeshLambertMaterial({ color: KNIFE_GLOVE[k] }));
    const box = (parent, w, h, d, x, y, z, k) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(k)); m.position.set(x, y, z); parent.add(m); return m; };
    const zc = .022;   // fist centre along the handle
    box(root, .02, .058, .092, .027, -.002, zc, 'glove');           // back of the hand
    box(root, .006, .03, .06, .038, .004, zc + .006, 'dark');       // strap
    box(root, .03, .02, .05, .02, -.022, zc + .055, 'glove');       // heel of the palm
    fingers.position.set(.03, -.034, 0);                            // fingers curl around this hinge (knuckle line)
    for (let i = 0; i < 4; i++) {
        const z = zc - .033 + i * .0225, len = i === 3 ? .017 : .0205;
        box(fingers, .054, .016, len, -.028, 0, z, 'glove');                  // under the handle
        box(fingers, .016, .042, len, -.055, .019, z, 'glove');               // up the far side
        box(fingers, .013, .013, len * .9, -.05, .043, z, 'tip');            // fingertip
        box(fingers, .016, .016, len, .0, -.002, z, 'pad');                  // knuckle pad
    }
    thumb.position.set(.03, .026, zc - .03);
    box(thumb, .05, .017, .022, -.022, 0, 0, 'glove');
    box(thumb, .016, .015, .02, -.052, -.002, -.002, 'skin');
    root.userData.fingers = fingers; root.userData.thumb = thumb;
    return root;
}
window.createKnifeHandModel = createKnifeHandModel;
function disposeHeldModel(model) {
    if (!model) return;
    const materials = new Set();
    model.traverse(node => {
        node.geometry?.dispose();
        for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) materials.add(material);
    });
    for (const material of materials) material.dispose();
    model.parent?.remove(model);
}

const FIREARM_SPECS = {
    ak47: { magazine: 30, reload: 2500, fireDelay: 110, automatic: true, damage: 48, range: 85, spread: 0.012, recoil: 0.038, pitch: 0.95 },
    m4a1: { magazine: 30, reload: 2300, fireDelay: 90, automatic: true, damage: 40, range: 90, spread: 0.008, recoil: 0.025, pitch: 1.25 },
    awp: { magazine: 10, reload: 3500, fireDelay: 1200, automatic: false, damage: 150, range: 180, spread: 0.045, recoil: 0.095, pitch: 0.65 },
    shotgun: { magazine: 8, reload: 2800, fireDelay: 800, automatic: false, damage: 22, range: 38, spread: 0.085, recoil: 0.075, bulletCount: 8, pitch: 0.75 },
    deagle: { magazine: 7, reload: 2200, fireDelay: 350, automatic: false, damage: 65, range: 65, spread: 0.006, recoil: 0.065, pitch: 0.82 },
    glock: { magazine: 20, reload: 1800, fireDelay: 180, automatic: false, damage: 28, range: 55, spread: 0.012, recoil: 0.02, pitch: 1.4 },
    mp5: { magazine: 30, reload: 2200, fireDelay: 95, automatic: true, damage: 32, range: 60, spread: 0.014, recoil: 0.022, pitch: 1.3 },
    rpg: { magazine: 1, reload: 3200, fireDelay: 1500, automatic: false, damage: 250, range: 80, spread: 0, recoil: 0.1, pitch: 0.4 },
};
window.FIREARM_SPECS = FIREARM_SPECS;

class Player {
    get world() {
        return (this.game && this.game.world) ? this.game.world : this._world;
    }
    set world(w) {
        this._world = w;
    }

    constructor(scene, camera, world, soundManager, particleSystem, game) {
        this.scene = scene;
        this.camera = camera;
        this._world = world;
        this.soundManager = soundManager;
        this.particleSystem = particleSystem;
        this.game = game;

        // Reusable scratch vectors for raycasting & physics (0 heap allocations per frame)
        this._rayOrigin = new THREE.Vector3();
        this._rayDir = new THREE.Vector3();
        this._rayPrevPos = new THREE.Vector3();
        this._rayCurrentPos = new THREE.Vector3();
        this._scratchNextPos = new THREE.Vector3();
        this._scratchStepPos = new THREE.Vector3();

        // Position & Movement
        this.position = new THREE.Vector3(0, 16, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;   // Left/Right rotation
        this.pitch = 0; // Up/Down rotation

        // Dimensions
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;
        this.eyeHeight = 1.62;

        // Survival Stats
        this.health = 100;
        this.maxHealth = 100;
        this.hunger = 100;
        this.maxHunger = 100;
        this.iq = 0;
        this.isDead = false;
        this.deathReason = "";
        this.hungerTimer = 0;
        this.regenTimer = 0;
        this.portalTimer = 0;

        // States
        this.onGround = false;
        this.timeSinceGrounded = 0;
        this.jumpBufferTimer = 0;
        // Source-style bunny hop: auto-hop on held jump + air-strafe acceleration (toggle: /bunnyhop)
        try { this.bunnyhop = localStorage.getItem('eblankraft_bunnyhop') !== '0'; } catch (e) { this.bunnyhop = true; }
        this.jumpCooldown = 0;
        this.isFlying = false;
        this.canFly = false;
        this.flySpeed = 11.0;
        this.godMode = false;
        this.isCreative = false;
        this.creativeBreakIntervalMs = 0;
        this._creativeBreakCooldown = 0;
        try {
            const saved = Number(localStorage.getItem('eblankraft_creative_break_interval'));
            if (Number.isFinite(saved)) this.creativeBreakIntervalMs = Math.max(0, Math.min(1000, saved));
        } catch {}
        this.instantBreak = false;
        this.infiniteBlocks = false;
        this.customReach = 5.2;
        this.speedMultiplier = 1.0;
        this.noclip = false;
        this.isSprinting = false;
        this.mountedVehicle = null;
        this.walkCycle = 0;
        this.armSwing = 0;
        this.isThirdPerson = false;

        // Modern Combat System (Minecraft 1.9+ Java Combat & Tactical PvP)
        this.attackCooldown = 1.0; // 0.0 to 1.0 (1.0 = fully charged)
        this.isBlocking = false;
        this.blockStartTime = 0;
        this.parryCounterBonus = 1.0;
        this.comboCounter = 0;
        this.comboTimer = 0;
        this.comboStep = 0; // 0=jab, 1=slash, 2=finisher
        this.lastAttackHitTime = 0;
        this.whiffLagTimer = 0; // miss penalty delay
        this.totemInvulnerableTimer = 0;
        this.isTargetLocked = false;
        this.gunReload = null;
        this.gunTriggerHeld = false;
        this.gunBurst = 0;
        this.gunRecoilPitch = 0;
        this.lastGunShotTime = -Infinity;

        // Underwater & Breathing System (дихання & плавання)
        this.oxygen = 100;
        this.maxOxygen = 100;
        this.drownTimer = 0;
        this.bubbleParticleTimer = 0;
        this.swimSoundTimer = 0;
        this.isInWater = false;
        this.isSubmerged = false;
        this.wasInWater = false;
        this.swimBobbingTimer = 0;
        this.waterExitBoostTimer = 0;

        // 🌋 Molten Lava Interaction State
        this.isInLava = false;
        this.isLavaSubmerged = false;
        this.wasInLava = false;
        this.lavaSizzleTimer = 0;

        // Inventory System (27 slots: 0..8 hotbar, 9..26 backpack)
        this.inventory = new Array(27).fill(null);
        this.selectedHotbarIndex = 0;
        this.initDefaultInventory();
        // Equipment: 4 armor slots + 1 totem slot, and the 3x3 crafting grid (transient, returned on close)
        this.armor = { helmet: null, chestplate: null, leggings: null, boots: null };
        this.totemSlot = null;
        this.craftGrid = new Array(9).fill(null);
        this.loadEquipment();

        // Mining State & Speed
        this.targetBlock = null; // { hit, x, y, z, nx, ny, nz, type }
        this.miningProgress = 0.0; // 0 to 1
        this.isMining = false;
        this.miningSoundTimer = 0;

        // Target Wireframe Box
        const wireGeom = new THREE.BoxGeometry(1.005, 1.005, 1.005);
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            wireframe: true,
            wireframeLinewidth: 2,
            transparent: true,
            opacity: 0.45
        });
        this.wireframeBox = new THREE.Mesh(wireGeom, wireMat);
        this.wireframeBox.visible = false;
        this.scene.add(this.wireframeBox);

        // 3D First Person Hand & Third Person Model
        this.initFirstPersonHand();
        this.initThirdPersonModel();

        // Spawn player on safe terrain
        this.spawnSafe();
    }

    initDefaultInventory() {
        // Load from localStorage if saved
        try {
            const saved = localStorage.getItem(this.getInventoryStorageKey());
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length === 27) {
                    // drop the removed junk items from old saves
                    this.inventory = parsed.map(st => (st && ITEM_REGISTRY[st.itemId]) ? st : null);
                    return;
                }
            }
        } catch (e) {}

        // Default starting survival kit:
        this.inventory[0] = { itemId: ITEM_TYPES.WOOD_PICKAXE, count: 1 };
        this.inventory[1] = { itemId: ITEM_TYPES.WOOD_SWORD, count: 1 };
        this.inventory[2] = { itemId: ITEM_TYPES.PLANKS, count: 32 };
        this.inventory[3] = { itemId: ITEM_TYPES.APPLE, count: 16 };
        this.inventory[4] = { itemId: ITEM_TYPES.COBBLESTONE, count: 16 };
        this.inventory[5] = { itemId: ITEM_TYPES.GLOWSTONE, count: 8 };
        this.inventory[6] = { itemId: ITEM_TYPES.TNT, count: 4 };
        this.inventory[7] = { itemId: ITEM_TYPES.CRAFTING_TABLE, count: 1 };
        this.inventory[8] = { itemId: ITEM_TYPES.EBLAN_BLOCK, count: 2 };
    }

    getInventoryStorageKey() {
        return this.inventoryWorldId ? 'eblankraft_inventory_' + this.inventoryWorldId : 'eblankraft_inventory';
    }

    loadInventoryForWorld(worldId) {
        if (this._saveInvTimer) {
            clearTimeout(this._saveInvTimer);
            this._saveInvTimer = null;
        }
        if (this.inventoryWorldId) this.saveInventory();
        const previousId = localStorage.getItem('eblankraft_active_world_id');
        const migrateLegacy = !this.inventoryWorldId && (worldId === previousId || (!previousId && worldId === 'world_main'));
        this.inventoryWorldId = worldId;
        if (migrateLegacy && localStorage.getItem(this.getInventoryStorageKey()) === null) {
            const legacy = localStorage.getItem('eblankraft_inventory');
            if (legacy) localStorage.setItem(this.getInventoryStorageKey(), legacy);
        }
        this.inventory = new Array(27).fill(null);
        this.selectedHotbarIndex = 0;
        this.initDefaultInventory();
        this.craftGrid = new Array(9).fill(null);
        this.loadEquipment();
        this.saveInventory();
        this.updateHeldBlock();
    }

    saveInventory() {
        if (this.game?.arenaClient?.isActive || this.game?.ui?.duelSavedSession) { return; }
        try {
            localStorage.setItem(this.getInventoryStorageKey(), JSON.stringify(this.inventory));
            localStorage.setItem(this.getInventoryStorageKey() + '_equip', JSON.stringify({ armor: this.armor, totem: this.totemSlot }));
        } catch (e) {}
    }

    // --- Equipment (armor + totem) ---
    loadEquipment() {
        this.armor = { helmet: null, chestplate: null, leggings: null, boots: null };
        this.totemSlot = null;
        try {
            const saved = JSON.parse(localStorage.getItem(this.getInventoryStorageKey() + '_equip') || 'null');
            if (saved && saved.armor) {
                for (const slot of Object.keys(this.armor)) {
                    const reg = ITEM_REGISTRY[saved.armor[slot]];
                    if (reg && reg.armorSlot === slot) this.armor[slot] = reg.id;
                }
            }
            if (saved && saved.totem && ITEM_REGISTRY[saved.totem]?.isTotem) this.totemSlot = saved.totem;
        } catch (e) {}
    }

    getArmorDefense() {
        let pts = 0;
        for (const slot of Object.keys(this.armor)) {
            const reg = this.armor[slot] && ITEM_REGISTRY[this.armor[slot]];
            if (reg) pts += reg.defense || 0;
        }
        return pts;
    }

    // 3% less damage per armor point, never more than 70%
    getArmorReduction() {
        return Math.min(0.7, this.getArmorDefense() * 0.03);
    }

    // Puts any leftover crafting-grid items back into the backpack (or drops them if it is full)
    returnCraftGrid() {
        for (let i = 0; i < 9; i++) {
            const st = this.craftGrid[i];
            if (!st) continue;
            this.craftGrid[i] = null;
            if (!this.addItem(st.itemId, st.count) && this.game?.mobManager) {
                this.game.mobManager.spawnItemDrop(this.position.x, this.position.y + 1, this.position.z, st.itemId, st.count);
            }
        }
    }

    syncInventoryWithServer() {
        const held = this.getSelectedItem();
        const reg = (held && window.ITEM_REGISTRY) ? ITEM_REGISTRY[held.itemId] : null;
        const heldItemKey = reg ? reg.name : null;

        // Extract hotbar items (slots 0-8)
        const hotbar = this.inventory.slice(0, 9).map(slot => {
            if (!slot) return null;
            const r = window.ITEM_REGISTRY ? ITEM_REGISTRY[slot.itemId] : null;
            return {
                itemId: slot.itemId,
                name: r ? r.name : 'item',
                count: slot.count
            };
        });

        // 1. Authoritative WebSocket Server Client
        if (this.game && this.game.serverClient && this.game.serverClient.isConnected && this.game.serverClient.currentRoom) {
            this.game.serverClient.sendInventorySync(this.inventory.map(slot => {
                if (!slot) return null;
                const r = window.ITEM_REGISTRY ? ITEM_REGISTRY[slot.itemId] : null;
                return { itemId: slot.itemId, count: slot.count, name: r ? r.name : '', ...(slot.design ? { design: slot.design } : {}) };
            }), heldItemKey, this.selectedHotbarIndex);
        }

        // 2. PeerJS P2P Multiplayer
        if (this.game && this.game.multiplayer && this.game.multiplayer.isConnected) {
            this.game.multiplayer.broadcast({
                type: 'inventory_sync',
                peerId: this.game.multiplayer.peerId,
                held_item: heldItemKey,
                hotbar: hotbar
            });
        }
    }

    saveInventoryDebounced() {
        if (this._saveInvTimer) clearTimeout(this._saveInvTimer);
        this._saveInvTimer = setTimeout(() => {
            this.saveInventory();
            this._saveInvTimer = null;
        }, 250);
    }

    resetToStarterInventory() {
        this.inventory = new Array(27).fill(null);
        this.inventory[0] = { itemId: ITEM_TYPES.WOOD_PICKAXE, count: 1 };
        this.inventory[1] = { itemId: ITEM_TYPES.WOOD_SWORD, count: 1 };
        this.inventory[2] = { itemId: ITEM_TYPES.PLANKS, count: 32 };
        this.inventory[3] = { itemId: ITEM_TYPES.APPLE, count: 16 };
        this.inventory[4] = { itemId: ITEM_TYPES.COBBLESTONE, count: 16 };
        this.inventory[5] = { itemId: ITEM_TYPES.GLOWSTONE, count: 8 };
        this.inventory[6] = { itemId: ITEM_TYPES.TNT, count: 4 };
        this.inventory[7] = { itemId: ITEM_TYPES.CRAFTING_TABLE, count: 1 };
        this.inventory[8] = { itemId: ITEM_TYPES.EBLAN_BLOCK, count: 2 };
        this.selectedHotbarIndex = 0;
        this.saveInventory();
        this.updateHeldBlock();
    }

    clearInventory() {
        this.inventory = new Array(27).fill(null);
        this.armor = { helmet: null, chestplate: null, leggings: null, boots: null };
        this.totemSlot = null;
        this.craftGrid = new Array(9).fill(null);
        this.selectedHotbarIndex = 0;
        this.saveInventory();
        this.updateHeldBlock();
    }

    // Inventory Helpers
    getSelectedItem() {
        return this.inventory[this.selectedHotbarIndex] || null;
    }

    getSelectedBlockType() {
        const it = this.getSelectedItem();
        if (!it) return null;
        const reg = ITEM_REGISTRY[it.itemId];
        if (reg && reg.category === 'block') return reg.blockType;
        return null;
    }

    addItem(itemId, count = 1) {
        if (!itemId || count <= 0) return false;
        const reg = ITEM_REGISTRY[itemId];
        const maxStack = reg ? reg.maxStack : 64;

        // 1. Try stacking into existing slots
        if (maxStack > 1) {
            for (let i = 0; i < this.inventory.length; i++) {
                const slot = this.inventory[i];
                if (slot && slot.itemId === itemId && slot.count < maxStack) {
                    const space = maxStack - slot.count;
                    const add = Math.min(space, count);
                    slot.count += add;
                    count -= add;
                    if (count <= 0) {
                        this.saveInventoryDebounced();
                        this.updateHeldBlock();
                        if (this.game.ui) this.game.ui.initHotbar();
                        return true;
                    }
                }
            }
        }

        // 2. Place into empty slots
        for (let i = 0; i < this.inventory.length; i++) {
            if (!this.inventory[i]) {
                const add = Math.min(maxStack, count);
                this.inventory[i] = { itemId, count: add };
                count -= add;
                if (count <= 0) {
                    this.saveInventoryDebounced();
                    this.updateHeldBlock();
                    if (this.game.ui) this.game.ui.initHotbar();
                    return true;
                }
            }
        }

        this.saveInventoryDebounced();
        this.updateHeldBlock();
        if (this.game.ui) this.game.ui.initHotbar();
        return false; // full
    }

    removeItem(itemId, count = 1) {
        let remaining = count;
        for (let i = 0; i < this.inventory.length; i++) {
            const slot = this.inventory[i];
            if (slot && slot.itemId === itemId) {
                if (slot.count > remaining) {
                    slot.count -= remaining;
                    remaining = 0;
                    break;
                } else {
                    remaining -= slot.count;
                    this.inventory[i] = null;
                }
            }
        }
        this.saveInventoryDebounced();
        this.updateHeldBlock();
        if (this.game.ui) this.game.ui.initHotbar();
        return remaining === 0;
    }

    getItemCount(itemId) {
        let total = 0;
        for (let slot of this.inventory) {
            if (slot && slot.itemId === itemId) total += slot.count;
        }
        return total;
    }

    hasItem(itemId, count = 1) {
        return this.getItemCount(itemId) >= count;
    }

    dropItem(slotIndex = this.selectedHotbarIndex, count = 1) {
        if (this.game?.arenaClient?.isActive) { return; }
        const slot = this.inventory[slotIndex];
        if (!slot) return;

        const dropCount = Math.min(slot.count, count);
        slot.count -= dropCount;
        const droppedId = slot.itemId;

        if (slot.count <= 0) {
            this.inventory[slotIndex] = null;
        }

        this.saveInventoryDebounced();
        this.updateHeldBlock();
        if (this.game.ui) this.game.ui.initHotbar();

        // Spawn item drop thrown forward with 1.2s pickup delay so player doesn't instantly re-vacuum it
        if (this.game.mobManager) {
            const origin = this.position.clone().add(new THREE.Vector3(0, this.eyeHeight - 0.2, 0));
            const lookDir = new THREE.Vector3(
                -Math.sin(this.yaw) * Math.cos(this.pitch),
                Math.sin(this.pitch),
                -Math.cos(this.yaw) * Math.cos(this.pitch)
            ).normalize();

            const spawnPos = origin.clone().addScaledVector(lookDir, 0.8);
            const throwVelocity = lookDir.clone().multiplyScalar(4.5).add(new THREE.Vector3(0, 2.0, 0));
            this.game.mobManager.spawnItemDrop(spawnPos.x, spawnPos.y, spawnPos.z, droppedId, dropCount, 1.2, throwVelocity);
        }

        if (this.soundManager) this.soundManager.playClick();
    }

    spawnSafe() {
        if (this.game?.arenaClient?.isActive) { this.game.arenaClient.requestRespawn(); return; }
        const dim = (this.world && this.world.dimension) ? this.world.dimension : 'overworld';
        const wType = (this.world && this.world.worldType) ? this.world.worldType : 'normal';
        const map = this.world?.getBuiltinMap?.();
        if (map) {
            const [x, y, z] = map.spawn;
            this.position.set(x, y, z);
            // Respect saved edits around the original spawn.
            for (let i = 0; i < 24 && this.checkCollision(this.position); i++) this.position.y += 1;
            this.velocity.set(0, 0, 0);
            this.yaw = this.pitch = 0;
            this.onGround = false;
            return;
        }


        if (wType === 'race_track' || dim === 'race_track') {
            this.position.set(0.5, 5.05, 12.0);
            this.velocity.set(0, 0, 0);
            this.yaw = 0;
            this.pitch = 0;
            this.onGround = true;
            return;
        }

        if (wType === 'highway_city' || dim === 'highway_city') {
            this.position.set(24.5, 5.05, 4.0);
            this.velocity.set(0, 0, 0);
            this.yaw = 0;
            this.pitch = 0;
            this.onGround = true;
            return;
        }

        let spawnX = 0.5;
        let spawnY = 18.05;
        let spawnZ = 0.5;

        if (dim === 'nether') {
            // Nether: Safe spawn inside cavern in front of portal on Nether Bricks
            spawnX = 1.5;
            spawnZ = 2.5;
            spawnY = 7.05; // Floor is at y=6, air at y=7..13
            this.yaw = 0; // Look forward into the Nether cavern
            this.pitch = 0;
        } else if (dim === 'the_end') {
            // The End: Safe spawn on the Obsidian Platform at (0, 14, 18)
            spawnX = 0.5;
            spawnZ = 18.0;
            spawnY = 14.05; // Platform is at y=13, air at y=14..17
            this.yaw = Math.PI; // Face towards the center island (0, 0)
            this.pitch = 0;
        } else {
            // Overworld: Search from top down for solid surface with clear air
            let foundSpawn = false;
            const searchCoords = [
                [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
                [1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2],
                [2, 2], [-2, -2], [3, 3], [-3, -3], [4, 4], [-4, -4]
            ];
            for (const [sx, sz] of searchCoords) {
                for (let y = CHUNK_SIZE_Y - 2; y >= 2; y--) {
                    const bFloor = this.world.getBlock(sx, y, sz);
                    const bLegs = this.world.getBlock(sx, y + 1, sz);
                    const bHead = this.world.getBlock(sx, y + 2, sz);
                    if (!isPassThroughBlock(bFloor) &&
                        bFloor !== BLOCK_TYPES.WATER && bFloor !== BLOCK_TYPES.LAVA &&
                        bFloor !== BLOCK_TYPES.PORTAL_NETHER && bFloor !== BLOCK_TYPES.PORTAL_END &&
                        isPassThroughBlock(bLegs) && bLegs !== BLOCK_TYPES.LAVA &&
                        isPassThroughBlock(bHead) && bHead !== BLOCK_TYPES.LAVA) {
                        spawnX = sx + 0.5;
                        spawnZ = sz + 0.5;
                        spawnY = y + 1.05;
                        foundSpawn = true;
                        break;
                    }
                }
                if (foundSpawn) break;
            }
            if (!foundSpawn) {
                spawnX = 0.5;
                spawnZ = 0.5;
                spawnY = 18.05;
            }
        }

        this.position.set(spawnX, spawnY, spawnZ);
        this.velocity.set(0, 0, 0);
        this.onGround = true;
        this.timeSinceGrounded = 0;
        this.jumpBufferTimer = 0;
        this.jumpCooldown = 0;
        this.portalTimer = -3.0; // 3 seconds portal immunity on spawn
        this.health = this.maxHealth;
        this.hunger = 100;
        this.isDead = false;
        this.miningProgress = 0;
        this.isMining = false;
    }

    initFirstPersonHand() {
        this.handGroup = new THREE.Group();
        this.camera.add(this.handGroup);

        // Unified item pivot in bottom-right corner of screen
        this.itemPivot = new THREE.Group();
        this.itemPivot.position.set(0.50, -0.50, -0.60);
        this.handGroup.add(this.itemPivot);

        // 1. Arm box (Minecraft right arm extending forward with equipped skin texture)
        const armGeom = createMinecraftBoxGeometry(0.25, 0.75, 0.25, 40, 16, 4, 12, 4);
        armGeom.translate(0, .375, 0);
        const curSkinId = (this.game && this.game.upgrader) ? this.game.upgrader.equippedSkin : 'classic';
        const initTex = window.skinManager ? window.skinManager.getSkinTexture(curSkinId) : null;
        this.armMat = new THREE.MeshLambertMaterial({ map: initTex, color: 0xffffff });
        this.armMesh = new THREE.Mesh(armGeom, this.armMat);
        this.armMesh.rotation.set(2.8, .2, -.2);
        this.itemPivot.add(this.armMesh);

        // 2. Held Block Mesh (3D isometric block held in hand)
        const blockGeom = new THREE.BoxGeometry(0.36, 0.36, 0.36);
        this.heldItemMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        this.heldBlockMesh = new THREE.Mesh(blockGeom, this.heldItemMat);
        this.heldBlockMesh.position.set(-0.02, 0.12, -0.16);
        this.heldBlockMesh.rotation.set(0.35, 0.75, -0.15);
        this.itemPivot.add(this.heldBlockMesh);

        // 3. Held Tool / Weapon / Item Mesh (Minecraft-style angled weapon)
        const toolGeom = new THREE.PlaneGeometry(0.55, 0.55);
        this.heldToolMat = new THREE.MeshLambertMaterial({ transparent: true, side: THREE.DoubleSide });
        this.heldToolMesh = new THREE.Mesh(toolGeom, this.heldToolMat);
        this.heldToolMesh.position.set(-0.04, 0.20, -0.18);
        this.heldToolMesh.rotation.set(-0.35, 0.75, -0.42);
        this.itemPivot.add(this.heldToolMesh);

        this.applySkinVisuals();
        this.updateHeldBlock();
    }

    initThirdPersonModel() {
        const curSkinId = (this.game && this.game.upgrader) ? this.game.upgrader.equippedSkin : 'classic';
        const tex = window.skinManager ? window.skinManager.getSkinTexture(curSkinId) : null;

        this.mcModel = createMinecraftPlayerHierarchy(tex);
        this.playerBodyGroup = this.mcModel.root;
        this.playerBodyGroup.visible = false;
        this.scene.add(this.playerBodyGroup);
    }

    applySkinVisuals() {
        const skinId = (this.game && this.game.upgrader) ? this.game.upgrader.equippedSkin : 'classic';
        if (!window.skinManager) return;
        const tex = window.skinManager.getSkinTexture(skinId);

        if (this.armMat) {
            this.armMat.map = tex;
            this.armMat.needsUpdate = true;
        }
        if (this.mcModel) {
            this.mcModel.setSkinTexture(tex);
        }
    }

    updateHeldBlock() {
        this.syncInventoryWithServer();
        const it = this.getSelectedItem();
        this.setAiming(false);
        const heldReg = it && ITEM_REGISTRY[it.itemId];
        if (typeof document !== 'undefined' && document.body?.classList) {
            document.body.classList.toggle('hold-gun', !!heldReg?.isGun);
            document.body.classList.toggle('hold-knife', !!heldReg?.isKnife);
            document.getElementById?.('btn-scope')?.classList?.remove('active');
        }
        disposeHeldModel(this.heldGunMesh); this.heldGunMesh = null;
        disposeHeldModel(this.heldKnifeMesh); this.heldKnifeMesh = null;
        this.disposeKnifeRig();
        if (this.gunReload && this.gunReload.item !== it) this.gunReload = null;
        if (this.isScoped && ITEM_REGISTRY[it?.itemId]?.gunType !== 'awp') {
            this.isScoped = false;
            this.setFOV(this.game?.fovSetting || 72);
        }
        if (!this.itemPivot) return;
        if (this.mcModel?.itemContainer) {
            while (this.mcModel.itemContainer.children.length > 0) {
                const child = this.mcModel.itemContainer.children[0];
                if (child.name.startsWith('gun_') || child.name.startsWith('knife_')) disposeHeldModel(child);
                else this.mcModel.itemContainer.remove(child);
            }
        }

        if (!it) {
            // Bare hand (fist)
            if (this.heldBlockMesh) this.heldBlockMesh.visible = false;
            if (this.heldToolMesh) this.heldToolMesh.visible = false;
            if (this.armMesh) {
                this.armMesh.visible = true;
                this.armMesh.position.set(-0.02, 0, 0);
                this.armMesh.rotation.set(2.8, .2, -.2);
            }
            return;
        }

        const reg = ITEM_REGISTRY[it.itemId];
        if (!reg?.isKnife) this._knifeKey = null;
        if (!reg?.isGun) { this._gunKey = null; this.gunDraw = 0; }
        if (this.armMesh) {
            this.armMesh.visible = true;
            this.armMesh.rotation.set(2.8, .2, -.2);
            this.armMesh.position.set(0, 0, 0);
        }

        if (reg && reg.category === 'block') {
            if (this.heldBlockMesh) {
                this.heldBlockMesh.visible = true;
                this.heldBlockMesh.material = this.game.textureManager.getDesignMaterial(reg.blockType, it.design);
                const boxes = window.blockDesignBoxes(reg.blockType, it.design);
                const bounds = [0, 1, 2].map(a => Math.min(...boxes.map(b => b[a]))).concat([3, 4, 5].map(a => Math.max(...boxes.map(b => b[a]))));
                this.heldBlockMesh.scale.set(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]);
            }
            if (this.heldToolMesh) this.heldToolMesh.visible = false;
        } else if (reg?.isKnife) {
            this.heldBlockMesh.visible = this.heldToolMesh.visible = false;
            this._knifeType = String(reg.icon).replace('knife_', '');
            this.heldKnifeMesh = createVoxelKnifeModel(this._knifeType);
            this.heldKnifeMesh.scale.setScalar((KNIFE_ANIMS[this._knifeType] || KNIFE_ANIMS.default).pose.scale);
            this.itemPivot.add(this.heldKnifeMesh);
            this.armMesh.visible = false;   // the knife has its own gloved hand and forearm
            this.buildKnifeRig(this._knifeType);
            if (this._knifeKey !== it) { this._knifeKey = it; this.knifeDraw = 1; this.knifeInspect = 0; this._kv = null; }   // draw animation only when the knife is (re)selected
        } else if (reg?.isGun) {
            this.heldBlockMesh.visible = this.heldToolMesh.visible = false;
            this.heldGunMesh = createVoxelGunModel(reg.gunType, reg.skin);
            this.itemPivot.add(this.heldGunMesh);
            if (this._gunKey !== it) { this._gunKey = it; this.gunDraw = 1; this._gunDrawSfx = false; }   // pickup animation only when the gun is (re)selected
            this.armMesh.position.set(.025, -.12, .16);
            this.armMesh.rotation.set(2.1, 0, -.10);
        } else {
            // Weapon, tool, food, or item
            if (this.heldBlockMesh) this.heldBlockMesh.visible = false;
            if (this.heldToolMesh) {
                this.heldToolMesh.visible = true;
                const iconName = reg ? reg.icon : 'stone';
                const tex = this.game.textureManager.getTexture(iconName);
                if (this.heldToolMat.map !== tex) {
                    this.heldToolMat.map = tex;
                    this.heldToolMat.needsUpdate = true;
                }

                if (reg && (reg.category === 'weapon' || reg.category === 'tool')) {
                    // Sword / pickaxe: angled forward ready to slash
                    this.heldToolMesh.scale.set(0.78, 0.78, 1.0);
                    this.heldToolMesh.position.set(-0.04, 0.17, -0.18);
                    this.heldToolMesh.rotation.set(-0.35, 0.75, -0.42);
                } else {
                    // Food, material: held in hand
                    this.heldToolMesh.scale.set(0.85, 0.85, 1.0);
                    this.heldToolMesh.position.set(-0.02, 0.12, -0.14);
                    this.heldToolMesh.rotation.set(-0.15, 0.45, -0.15);
                }
            }
        }

        // Also update held item in 3rd person model
        if (this.mcModel && this.mcModel.itemContainer) {
            if (it && reg) {
                if (reg.category === 'block') {
                    const bounds = window.getBlockBounds(reg.blockType);
                    const bMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.24 * (bounds[3] - bounds[0]), 0.24 * (bounds[4] - bounds[1]), 0.24 * (bounds[5] - bounds[2])),
                        this.game.textureManager.getBlockMaterial(reg.blockType)
                    );
                    bMesh.position.set(0, -0.1, 0.1);
                    this.mcModel.itemContainer.add(bMesh);
                } else if (reg.isKnife) {
                    const knife = createVoxelKnifeModel(String(reg.icon).replace('knife_', ''));
                    knife.scale.setScalar(.85); knife.rotation.set(.5, 0, 0); knife.position.set(0, -.05, .05);
                    this.mcModel.itemContainer.add(knife);
                } else if (reg.isGun) {
                    const gun = createVoxelGunModel(reg.gunType, reg.skin);
                    gun.scale.setScalar(.65); gun.rotation.x = Math.PI / 2;
                    this.mcModel.itemContainer.add(gun);
                } else {
                    const iconName = reg.icon || 'stone';
                    const tex = this.game.textureManager.getTexture(iconName);
                    const tMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
                    const tMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), tMat);
                    tMesh.position.set(0, -0.08, 0.12);
                    tMesh.rotation.set(-0.35, 0.75, -0.42);
                    this.mcModel.itemContainer.add(tMesh);
                }
            }
        }
    }

    toggleThirdPerson() {
        this.isThirdPerson = !this.isThirdPerson;
        if (this.playerBodyGroup) this.playerBodyGroup.visible = this.isThirdPerson;
        if (this.handGroup) this.handGroup.visible = !this.isThirdPerson;
        if (this.soundManager) this.soundManager.playClick();
    }

    // --- COMBAT WEAPON STATS & BLOCKING ---
    getWeaponAttackSpeed() {
        const item = this.getSelectedItem();
        if (!item) return 4.0; // Bare fists: very fast (0.25s)
        const reg = window.ITEM_REGISTRY ? ITEM_REGISTRY[item.itemId] : null;
        if (!reg) return 4.0;
        if (reg.attackSpeed) return reg.attackSpeed;
        if (reg.isGun) return 6.0;
        return 2.5;
    }

    getAttackDamageMultiplier() {
        const progress = Math.min(1.0, Math.max(0.0, this.attackCooldown));
        return 0.2 + 0.8 * (progress * progress);
    }

    setBlocking(blocking) {
        if (blocking && !this.isBlocking) {
            this.blockStartTime = performance.now();
        }
        this.isBlocking = !!blocking;
    }

    // Health, Hunger, Damage & Food
    takeDamage(amount, reason = "Ти здох!") {
        if (this.game?.arenaClient?.isActive) { return; }
        if (this.godMode || this.isCreative || this.isDead) return;

        // 1. Divine Shield from Totem of Undying
        if (this.totemInvulnerableTimer > 0) return;

        if (window.modManager) {
            const res = window.modManager.triggerEvent("onPlayerDamage", amount, reason);
            if (res === false) return;
        }

        // 2. Check Shield & Sword Blocking / Perfect Parry
        if (this.isBlocking) {
            const held = this.getSelectedItem();
            const reg = (held && window.ITEM_REGISTRY) ? ITEM_REGISTRY[held.itemId] : null;
            const isShield = reg && reg.isShield;
            const isSword = reg && reg.isSword;
            if (isShield || isSword) {
                const blockDuration = (performance.now() - (this.blockStartTime || 0)) / 1000;
                // Perfect Parry window: block pressed within 0.28 seconds of hit!
                const isParry = blockDuration <= 0.28;

                if (isParry) {
                    if (this.soundManager) this.soundManager.playParry();
                    if (this.particleSystem) {
                        this.particleSystem.spawnCritParticles(this.position.x, this.position.y + 1.2, this.position.z, 28);
                    }
                    if (this.game && this.game.triggerCameraShake) this.game.triggerCameraShake(0.35);
                    if (this.game && this.game.ui) {
                        this.game.ui.showToast("⚡ ІДЕАЛЬНЕ ПАРУВАННЯ! 100% захист + Контратака!");
                    }
                    this.parryCounterBonus = 2.0; // Next strike does 2x damage!
                    return; // 100% damage blocked!
                }

                const blockPct = isShield ? 0.90 : 0.55; // Shield 90% block, Sword parry 55% block
                const blockedDmg = Math.round(amount * blockPct);
                amount = Math.max(0, amount - blockedDmg);

                if (this.soundManager) this.soundManager.playShieldBlock();
                if (this.particleSystem) {
                    this.particleSystem.spawnShieldBlockParticles(this.position.x, this.position.y + 1.2, this.position.z, 14);
                }
                if (this.game && this.game.ui) {
                    this.game.ui.showToast(isShield ? "🛡️ Заблоковано щитом (-90%)" : "⚔️ Спаровано мечем (-55%)");
                }
                if (amount <= 0) return;
            }
        }

        // Apply Upgrader Defense reduction
        if (this.game.upgrader) {
            const red = this.game.upgrader.getDamageReduction();
            amount = Math.max(1, Math.round(amount * (1 - red)));
        }

        // Apply armor reduction
        const armorRed = this.getArmorReduction();
        if (armorRed > 0) amount = Math.max(1, Math.round(amount * (1 - armorRed)));

        // --- 3. CHECK TOTEM OF UNDYING (Lethal damage prevention) ---
        if (this.health - amount <= 0) {
            let totemSlot = -1;
            const held = this.getSelectedItem();
            if (this.totemSlot === ITEM_TYPES.TOTEM_OF_UNDYING) {
                totemSlot = 'equip'; // the dedicated totem slot is used first
            } else if (held && held.itemId === ITEM_TYPES.TOTEM_OF_UNDYING) {
                totemSlot = this.selectedHotbarIndex;
            } else {
                for (let i = 0; i < this.inventory.length; i++) {
                    if (this.inventory[i] && this.inventory[i].itemId === ITEM_TYPES.TOTEM_OF_UNDYING) {
                        totemSlot = i;
                        break;
                    }
                }
            }

            if (totemSlot !== -1) {
                this.consumeTotem(totemSlot);
                return; // Death prevented by totem!
            }
        }

        this.health = Math.max(0, this.health - amount);
        this.soundManager.playHurt();

        if (this.game && this.game.flashDamageScreen) {
            this.game.flashDamageScreen();
        }

        if (this.health <= 0) this.die(reason);
    }

    // Marks the player dead (also called when the authoritative server confirms a kill).
    die(reason) {
        if (this.isDead) return;
        this.health = 0;
        this.isDead = true;
        this.deathReason = reason;
        this.iq -= 50;
        this.soundManager?.speakRandomMeme?.(["Ой бля, ти здох!", "Ну все, приїхали!", "Єблан розбився!"]);
    }

    // Consume Totem of Undying upon lethal damage
    consumeTotem(slot) {
        if (slot === 'equip') {
            this.totemSlot = null;
            this.saveInventory();
            if (this.game?.ui?.inventoryOpen) this.game.ui.renderCurrentTab();
        } else if (this.inventory[slot]) {
            this.inventory[slot].count -= 1;
            if (this.inventory[slot].count <= 0) {
                this.inventory[slot] = null;
            }
        }
        // Resurrect with 75% max HP and full food
        this.health = Math.max(this.health, Math.round(this.maxHealth * 0.75));
        this.hunger = 100;
        this.totemInvulnerableTimer = 3.5;
        this.isLavaSubmerged = false;

        if (this.soundManager) {
            this.soundManager.playTotemActivate();
        }
        if (this.particleSystem && this.particleSystem.spawnTotemParticles) {
            this.particleSystem.spawnTotemParticles(this.position.x, this.position.y + 1.0, this.position.z);
        }
        if (this.game && this.game.triggerCameraShake) {
            this.game.triggerCameraShake(0.5);
        }
        if (this.game && this.game.ui && this.game.ui.triggerTotemAnimation) {
            this.game.ui.triggerTotemAnimation();
        }
        if (this.game && this.game.ui) {
            this.game.ui.showToast("✨ ТОТЕМ БЕЗСМЕРТЯ ВРЯТУВАВ ВАС ВІД ЗАГИБЕЛІ!");
        }
    }

    heal(amount) {
        if (this.game?.arenaClient?.isActive) { return; }
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    eatFood() {
        if (this.game?.arenaClient?.isActive) { return false; }
        const item = this.getSelectedItem();
        if (!item) return false;
        const reg = ITEM_REGISTRY[item.itemId];
        if (!reg || reg.category !== 'food') return false;

        if (this.hunger >= 100 && this.health >= this.maxHealth) return false;

        this.hunger = Math.min(this.maxHunger, this.hunger + (reg.foodRestore || 20));
        if (reg.hpRestore) this.heal(reg.hpRestore);

        this.soundManager.playEat();
        this.armSwing = 1.0;

        // Consume 1 food
        item.count -= 1;
        if (item.count <= 0) {
            this.inventory[this.selectedHotbarIndex] = null;
        }

        this.saveInventory();
        this.updateHeldBlock();
        if (this.game.ui) this.game.ui.initHotbar();
        return true;
    }

    // Raycast for Blocks & Mobs
    updateRaycast() {
        const maxDist = this.customReach || (this.isCreative ? 10.0 : 5.2);
        const origin = this._rayOrigin.set(
            this.position.x,
            this.position.y + this.eyeHeight,
            this.position.z
        );

        const dir = this._rayDir.set(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        this.targetBlock = null;
        // Traverse voxel boundaries directly instead of sampling every 0.05 block.
        const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
        let bx = Math.floor(origin.x), by = Math.floor(origin.y), bz = Math.floor(origin.z);
        const onXBoundary = origin.x === bx, onYBoundary = origin.y === by, onZBoundary = origin.z === bz;
        if (sx < 0 && onXBoundary) bx--;
        if (sy < 0 && onYBoundary) by--;
        if (sz < 0 && onZBoundary) bz--;
        const dx = sx ? Math.abs(1 / dir.x) : Infinity;
        const dy = sy ? Math.abs(1 / dir.y) : Infinity;
        const dz = sz ? Math.abs(1 / dir.z) : Infinity;
        let tx = sx ? (bx + (sx > 0 ? 1 : 0) - origin.x) / dir.x : Infinity;
        let ty = sy ? (by + (sy > 0 ? 1 : 0) - origin.y) / dir.y : Infinity;
        let tz = sz ? (bz + (sz > 0 ? 1 : 0) - origin.z) / dir.z : Infinity;
        let distance = 0;
        let nx = sx && onXBoundary ? -sx : 0;
        let ny = nx === 0 && sy && onYBoundary ? -sy : 0;
        let nz = nx === 0 && ny === 0 && sz && onZBoundary ? -sz : 0;
        while (distance <= maxDist) {
            const block = this.world.getBlock(bx, by, bz);
            let shapeHit = true;
            const design = this.world.getBlockDesign?.(bx, by, bz);
            if (window.BLOCK_INFO?.[block]?.bounds || design) {
                let nearest = Infinity, nearestAxis = 0, nearestSign = 0;
                for (const bounds of window.blockDesignBoxes(block, design)) {
                    let enter = -Infinity, exit = Infinity, faceAxis = 0, faceSign = 0;
                    for (let axis = 0; axis < 3; axis++) {
                        const key = ['x', 'y', 'z'][axis];
                        const cell = [bx, by, bz][axis];
                        const low = cell + bounds[axis], high = cell + bounds[axis + 3];
                        if (Math.abs(dir[key]) < 1e-12) {
                            if (origin[key] < low || origin[key] > high) { exit = -Infinity; break; }
                        } else {
                            const first = (low - origin[key]) / dir[key];
                            const last = (high - origin[key]) / dir[key];
                            const near = Math.min(first, last);
                            if (near > enter) { enter = near; faceAxis = axis; faceSign = -Math.sign(dir[key]); }
                            exit = Math.min(exit, Math.max(first, last));
                        }
                    }
                    if (exit >= Math.max(enter, distance, 0) && enter <= Math.min(tx, ty, tz, maxDist) && enter < nearest) {
                        nearest = enter; nearestAxis = faceAxis; nearestSign = faceSign;
                    }
                }
                shapeHit = nearest !== Infinity;
                if (shapeHit && nearest >= 0) {
                    nx = nearestAxis === 0 ? nearestSign : 0;
                    ny = nearestAxis === 1 ? nearestSign : 0;
                    nz = nearestAxis === 2 ? nearestSign : 0;
                }
            }
            if (shapeHit && block !== BLOCK_TYPES.AIR && (block !== BLOCK_TYPES.WATER || design)) {
                this.targetBlock = {
                    hit: true,
                    x: bx,
                    y: by,
                    z: bz,
                    nx: nx || 0,
                    ny: ny || 0,
                    nz: nz || 0,
                    type: block
                };
                break;
            }
            distance = Math.min(tx, ty, tz);
            if (!Number.isFinite(distance) || distance > maxDist) break;
            // At an edge or corner, enter all crossed axes but keep one placement face.
            nx = tx === distance ? -sx : 0;
            ny = nx === 0 && ty === distance ? -sy : 0;
            nz = nx === 0 && ny === 0 ? -sz : 0;
            if (tx === distance) { bx += sx; tx += dx; }
            if (ty === distance) { by += sy; ty += dy; }
            if (tz === distance) { bz += sz; tz += dz; }
        }

        // Update wireframe box outline
        if (this.targetBlock) {
            const target = this.targetBlock;
            const boxes = window.blockBoxesAt?.(this.world, target.x, target.y, target.z, target.type) || [[0, 0, 0, 1, 1, 1]];
            const bounds = [0, 1, 2].map(axis => Math.min(...boxes.map(box => box[axis]))).concat(
                [3, 4, 5].map(axis => Math.max(...boxes.map(box => box[axis]))));
            this.wireframeBox.scale.set(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]);
            this.wireframeBox.visible = true;
            this.wireframeBox.position.set(
                this.targetBlock.x + (bounds[0] + bounds[3]) / 2,
                this.targetBlock.y + (bounds[1] + bounds[4]) / 2,
                this.targetBlock.z + (bounds[2] + bounds[5]) / 2
            );
        } else {
            this.wireframeBox.visible = false;
        }
    }

    // Combat Attack check against Mobs, Boss Dragon, or Remote Players (Modern Skill-Based Tactical Combat)
    isDuelLocked() {
        const ui = this.game?.ui;
        return !!(ui?.isDuelActive && (ui.duelLoading || ui.duelCountdown > 0 || ui.duelFinished));
    }

    attackMob() {
        if (this.game?.arenaClient?.isActive) { return this.game.arenaClient.attack(); }
        if (this.isDuelLocked()) return false;
        // Whiff lag recovery check (cannot attack during miss recovery)
        if (this.whiffLagTimer > 0) return false;

        const origin = new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
        const dir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        this.armSwing = 1.0;

        // Base damage from equipped tool/weapon (bare fists = 12 dmg)
        const heldItem = this.getSelectedItem();
        const reg = (heldItem && window.ITEM_REGISTRY) ? ITEM_REGISTRY[heldItem.itemId] : null;
        let rawBaseDmg = reg ? (reg.attackDamage || 12) : 12;

        // Apply Upgrader damage multiplier
        if (this.game.upgrader) {
            rawBaseDmg = this.game.upgrader.getEffectiveDamage(rawBaseDmg);
        }

        // --- ATTACK COOLDOWN ---
        const cooldown = Math.min(1.0, Math.max(0.0, this.attackCooldown));
        this.attackCooldown = 0.0; // Reset attack charge

        // --- 3-HIT RHYTHMIC COMBO SYSTEM ---
        const now = performance.now();
        const deltaSinceLastHit = (now - (this.lastAttackHitTime || 0)) / 1000;
        let comboMult = 1.0;
        let isFinisher = false;

        if (this.lastAttackHitTime > 0 && deltaSinceLastHit >= 0.22 && deltaSinceLastHit <= 0.85) {
            this.comboStep = ((this.comboStep || 0) + 1) % 3;
            if (this.comboStep === 1) {
                comboMult = 1.35; // Strike 2: Slash (+35%)
            } else if (this.comboStep === 2) {
                comboMult = 1.95; // Strike 3: Heavy Finisher (+95%)
                isFinisher = true;
            }
        } else if (this.lastAttackHitTime > 0 && deltaSinceLastHit < 0.22) {
            // Mashing too fast before weapon recovery -> glancing blow!
            comboMult = 0.45;
            this.comboStep = 0;
            if (this.game && this.game.ui) {
                this.game.ui.showToast("⚠️ Занадто швидкий спам! Удар ковзний (-55%)");
            }
        } else {
            this.comboStep = 0; // Strike 1: Jab
        }

        // Apply Parry Counterattack Bonus
        if (this.parryCounterBonus && this.parryCounterBonus > 1.0) {
            comboMult *= this.parryCounterBonus;
            this.parryCounterBonus = 1.0;
            if (this.game && this.game.ui) {
                this.game.ui.showToast("💥 КОНТРАТАКА ПІСЛЯ ПАРУВАННЯ (x2)!");
            }
        }

        const cooldownMult = 0.2 + 0.8 * (cooldown * cooldown);
        const isFullCharge = (cooldown >= 0.85);

        // --- CRITICAL HIT (КРИТ) ---
        const isFalling = (this.velocity.y < -0.05) && !this.onGround;
        const notSubmerged = !this.isInWater && !this.isInLava && !this.isFlying;
        const isCrit = isFalling && notSubmerged && isFullCharge;

        // --- SWEEPING ATTACK (СВИП МЕЧОМ) ---
        const isSword = reg && reg.isSword;
        const isSweep = isSword && (cooldown >= 0.95) && !isCrit;

        // --- SPRINT KNOCKBACK (W-TAP) ---
        const isSprintHit = this.isSprinting && (cooldown >= 0.7);
        const knockbackPower = (isSprintHit ? 2.2 : (0.6 + 0.4 * cooldown)) * (isCrit ? 1.4 : 1.0) * (isFinisher ? 2.4 : 1.0);
        if (isSprintHit) {
            this.isSprinting = false;
        }

        let baseDmg = Math.round(rawBaseDmg * cooldownMult * (isCrit ? 1.6 : 1.0) * comboMult);
        baseDmg = Math.max(1, baseDmg);

        let hitAny = false;
        const reach = this.customReach || (this.isCreative ? 8.0 : 4.8);
        const kbDir = new THREE.Vector3(dir.x, 0.38, dir.z).normalize().multiplyScalar(knockbackPower);

        // 0. Check Multiplayer PvP (Precise Hitbox)
        if (this.game.multiplayer) {
            if (this.game.multiplayer.checkPvPHit(origin, dir, reach, baseDmg, isCrit, isSweep, kbDir)) {
                hitAny = true;
            }
        }

        // 1. Check End Crystals
        if (this.game.mobManager && !this.game.mobManager.creativeMobsDisabled) {
            for (let c of this.game.mobManager.crystals) {
                if (!c.isDestroyed && c.group) {
                    if (this.position.distanceTo(c.group.position) < reach + 1.2) {
                        c.takeDamage(10);
                        hitAny = true;
                    }
                }
            }

            // 2. Check Dragon Boss
            const dragon = this.game.mobManager.dragon;
            if (dragon && !dragon.isDead && dragon.mesh) {
                const dist = this.position.distanceTo(dragon.mesh.position);
                if (dist < 14.0) {
                    let dragonDmg = baseDmg;
                    const skin = (this.game.upgrader && window.SKINS_REGISTRY) ? SKINS_REGISTRY[this.game.upgrader.equippedSkin] : null;
                    if (skin && skin.buffs && skin.buffs.bossDamageMult) dragonDmg *= skin.buffs.bossDamageMult;

                    dragon.takeDamage(dragonDmg);
                    if (this.particleSystem) {
                        if (isCrit || isFinisher) {
                            this.particleSystem.spawnCritParticles(dragon.mesh.position.x, dragon.mesh.position.y + 1.5, dragon.mesh.position.z, 28);
                        } else {
                            this.particleSystem.spawnBlockBreakParticles(dragon.mesh.position.x, dragon.mesh.position.y, dragon.mesh.position.z, BLOCK_TYPES.DRAGON_EGG, 14);
                        }
                    }
                    if (this.game.ui && this.game.ui.spawnFloatingDamage) {
                        this.game.ui.spawnFloatingDamage(dragon.mesh.position.x, dragon.mesh.position.y + 2.0, dragon.mesh.position.z, dragonDmg, isCrit || isFinisher, false);
                    }
                    hitAny = true;
                }
            }

            // 3. Check Normal Mobs (Strict Crosshair Raycast to Cylinder Hitbox)
            let primaryMob = null;
            let closestDist = 999;

            for (let mob of this.game.mobManager.mobs) {
                if (!mob.isDead && mob.group && !this.game.mobManager.creativeMobsDisabled) {
                    const mobCenter = mob.position.clone().add(new THREE.Vector3(0, (mob.height || 1.8) * 0.5, 0));
                    const toMob = mobCenter.sub(origin);
                    const distAlongRay = toMob.dot(dir);

                    if (distAlongRay > 0 && distAlongRay < reach) {
                        const perpDist = toMob.sub(dir.clone().multiplyScalar(distAlongRay)).length();
                        const hitboxRadius = (mob.width || 0.65) * 0.95 + 0.18; // Precise cylinder

                        if (perpDist <= hitboxRadius && distAlongRay < closestDist) {
                            closestDist = distAlongRay;
                            primaryMob = mob;
                        }
                    }
                }
            }

            if (primaryMob) {
                primaryMob.takeDamage(baseDmg, kbDir);
                hitAny = true;

                if (this.particleSystem && (isCrit || isFinisher)) {
                    this.particleSystem.spawnCritParticles(primaryMob.position.x, primaryMob.position.y + 0.9, primaryMob.position.z, isFinisher ? 32 : 22);
                }
                if (this.game.ui && this.game.ui.spawnFloatingDamage) {
                    this.game.ui.spawnFloatingDamage(primaryMob.position.x, primaryMob.position.y + 1.1, primaryMob.position.z, baseDmg, isCrit || isFinisher, false);
                }

                // Sweeping Edge: secondary mobs in cone receive 50% sweep damage and knockback
                if (isSweep) {
                    const sweepDmg = Math.max(1, Math.round(baseDmg * 0.5));
                    for (let other of this.game.mobManager.mobs) {
                        if (other !== primaryMob && !other.isDead && other.group) {
                            const toOther = other.position.clone().sub(this.position);
                            const d = toOther.length();
                            if (d < reach) {
                                const dot = dir.dot(toOther.normalize());
                                if (dot > 0.35) {
                                    const sweepKb = toOther.normalize().multiplyScalar(0.7);
                                    other.takeDamage(sweepDmg, sweepKb);
                                    if (this.game.ui && this.game.ui.spawnFloatingDamage) {
                                        this.game.ui.spawnFloatingDamage(other.position.x, other.position.y + 1.0, other.position.z, sweepDmg, false, true);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- WHIFF / MISS PENALTY (Anti-Spam / Anti-Tap) ---
        if (!hitAny) {
            this.whiffLagTimer = 0.38; // 0.38s recovery lag
            this.attackCooldown = 0.0; // Reset charge
            this.comboStep = 0; // Break combo
            if (this.soundManager) this.soundManager.playWhiff();
            return false;
        }

        // Combat Audio, Visual Effects & Combos
        this.lastAttackHitTime = performance.now();
        if (isFinisher) {
            if (this.soundManager) this.soundManager.playFinisherHit();
            if (this.game && this.game.triggerCameraShake) this.game.triggerCameraShake(0.45);
            if (this.game && this.game.ui) {
                this.game.ui.showToast("💥 КОМБО-ФІНІШЕР x3! (+95% урону)");
            }
        } else if (this.comboStep === 1) {
            if (this.soundManager) this.soundManager.playStrongHit();
            if (this.game && this.game.ui) {
                this.game.ui.showToast("⚡ СЕРІЙНИЙ УДАР x2 (+35% урону)");
            }
        } else if (isCrit) {
            if (this.soundManager) this.soundManager.playCritHit();
            if (this.game && this.game.triggerCameraShake) this.game.triggerCameraShake(0.35);
        } else if (isSprintHit) {
            if (this.soundManager) this.soundManager.playStrongHit();
            if (this.game && this.game.triggerCameraShake) this.game.triggerCameraShake(0.25);
        } else if (isSweep) {
            if (this.soundManager) this.soundManager.playSweep();
        } else {
            if (this.soundManager) this.soundManager.playStrongHit();
        }

        if (isSweep && this.particleSystem) {
            this.particleSystem.spawnSweepParticles(origin, dir);
        }

        // Combo counter
        this.comboCounter = (this.comboTimer > 0 ? this.comboCounter + 1 : 1);
        this.comboTimer = 2.5;
        if (this.comboCounter >= 3 && this.game.ui) {
            this.game.ui.showToast(`🔥 КОМБО x${this.comboCounter}!`);
        }

        if (window.modManager) {
            window.modManager.triggerEvent("onAttack", hitAny ? "hit" : "miss", baseDmg);
        }
        return hitAny;
    }

    setCreativeBreakInterval(value) {
        const interval = Number(value);
        this.creativeBreakIntervalMs = Number.isFinite(interval) ? Math.max(0, Math.min(1000, interval)) : 0;
        this._creativeBreakCooldown = 0;
        try { localStorage.setItem('eblankraft_creative_break_interval', String(this.creativeBreakIntervalMs)); } catch {}
    }

    // Update Mining Progress & Speed
    updateMining(dt) {
        this._creativeBreakCooldown = Math.max(0, (this._creativeBreakCooldown || 0) - dt);
        if (this.game?.arenaClient?.isActive) { this.isMining = false; this.miningProgress = 0; return; }
        if (!this.isMining || !this.targetBlock) {
            this.miningProgress = 0.0;
            return;
        }

        const { x, y, z, type } = this.targetBlock;

        if (type === BLOCK_TYPES.BEDROCK && !this.isCreative) {
            this.soundManager.speakRandomMeme(["Бедрок не ламається, єблан!"]);
            this.miningProgress = 0;
            this.isMining = false;
            return;
        }

        if (this.isCreative && this._creativeBreakCooldown > 0.000001) return;

        // Special: Instant ignite TNT
        if (type === BLOCK_TYPES.TNT) {
            if (window.modManager && !window.modManager.canBreakBlock(x, y, z, type, this)) {
                this.miningProgress = 0;
                this.isMining = false;
                return;
            }
            this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
            this.world.updateMeshes();
            new TNTEntity(x, y, z, this.scene, this.game.textureManager, this.soundManager, this.world, this.particleSystem, this.game);
            this.iq += 15;
            if (this.isCreative) this._creativeBreakCooldown = (this.creativeBreakIntervalMs || 0) / 1000;
            this.miningProgress = 0;
            this.isMining = false;
            return;
        }

        // Creative / Godmode / Instant Break
        if (this.godMode || this.isCreative || this.instantBreak) {
            this.finishBreakingBlock();
            if (this.isCreative) this._creativeBreakCooldown = (this.creativeBreakIntervalMs || 0) / 1000;
            return;
        }

        // Calculate break speed for survival
        const info = BLOCK_INFO[type] || { hardness: 1.0 };
        const hardness = info.hardness || 1.0;
        const heldItem = this.getSelectedItem();
        const reg = heldItem ? ITEM_REGISTRY[heldItem.itemId] : null;
        let toolSpeed = reg ? (reg.miningSpeed || 1.0) : 1.0;
        let effectiveSpeed = (this.game.upgrader) ? this.game.upgrader.getEffectiveMiningSpeed(toolSpeed) : toolSpeed;

        // Time to break in seconds
        const breakDuration = Math.max(0.08, (hardness / effectiveSpeed) * 0.9);
        this.miningProgress += dt / breakDuration;

        // Rhythmic arm swing and chipping sounds
        this.armSwing = 1.0;
        this.miningSoundTimer += dt;
        if (this.miningSoundTimer > 0.22) {
            this.miningSoundTimer = 0;
            this.soundManager.playChip();
            this.particleSystem.spawnBlockBreakParticles(x, y, z, type, 3);
            // Drain small hunger while digging
            this.hunger = Math.max(0, this.hunger - 0.15);
        }

        // Completed breaking
        if (this.miningProgress >= 1.0) {
            this.finishBreakingBlock();
        }
    }

    finishBreakingBlock() {
        if (!this.targetBlock) return;
        const { x, y, z, type } = this.targetBlock;

        if (window.modManager) {
            const canBreak = window.modManager.canBreakBlock(x, y, z, type, this);
            if (!canBreak) {
                this.miningProgress = 0.0;
                return;
            }
        }

        this.soundManager.playBreak(BLOCK_INFO[type]?.sound || 'stone');
        this.particleSystem.spawnBlockBreakParticles(x, y, z, type, 16);
        this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        this.world.updateMeshes();

        if (this.game.multiplayer) {
            this.game.multiplayer.broadcastBlockBreak(x, y, z, type);
        }

        // 3D Item Drops in World (Only in survival)
        if (this.game.mobManager && !this.isCreative) {
            const blockDef = (window.BLOCK_INFO) ? window.BLOCK_INFO[type] : null;
            const dropItemId = (blockDef && blockDef.dropItem !== undefined) ? blockDef.dropItem : BLOCK_DROP_MAP[type];
            if (dropItemId) {
                let dropCount = (blockDef && blockDef.dropCount) ? Number(blockDef.dropCount) : 1;
                // Fortune double drop check
                const fortuneChance = (this.game.upgrader) ? this.game.upgrader.getFortuneChance() : 0;
                if (Math.random() < fortuneChance) dropCount *= 2;

                this.game.mobManager.spawnItemDrop(x + 0.5, y + 0.5, z + 0.5, dropItemId, dropCount, 0.35);
            }
        }

        // IQ updates
        if (type === BLOCK_TYPES.DIAMOND_BLOCK || type === BLOCK_TYPES.NETHERITE_BLOCK) {
            this.iq += 100;
            this.soundManager.speakRandomMeme(["Алмази знайшов!", "Оце скарб!"]);
        } else if (type === BLOCK_TYPES.EBLAN_BLOCK) {
            this.iq -= 25;
            this.soundManager.speakRandomMeme(["Навіщо ти зламав єблана?!"]);
        } else {
            this.iq += 2;
        }

        this.miningProgress = 0.0;
    }

    // Place Block Action
    placeBlock() {
        if (this.game?.arenaClient?.isActive) { return; }
        // If holding a vehicle item, spawn and mount vehicle!
        const heldItem = this.getSelectedItem();
        const heldReg = heldItem ? ITEM_REGISTRY[heldItem.itemId] : null;
        if (heldReg && (heldReg.isVehicle || heldReg.category === 'vehicle')) {
            const vMgr = (window.modManager && window.modManager.vehicleManager) || (this.game && this.game.modManager && this.game.modManager.vehicleManager);
            if (vMgr) {
                const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
                const spawnPos = this.position.clone().add(forward.multiplyScalar(2.6));
                spawnPos.y += 0.6;
                const vId = vMgr.spawn(heldReg.vehicleType || 'sport', spawnPos.x, spawnPos.y, spawnPos.z, { yaw: this.yaw });
                const veh = vMgr.vehicles.get(vId);
                if (veh) {
                    if (!this.isCreative) {
                        this.removeItem(heldItem.itemId, 1);
                    }
                    this.mountVehicle(veh);
                    if (this.game && this.game.soundManager) this.game.soundManager.playDoor();
                    if (this.game && this.game.ui) this.game.ui.showToast(`🚗 Ви сіли в ${heldReg.name}! [W/A/S/D] - Їзда, [F] - Вийти, [H] - Сигнал, [L] - Фари`);
                }
                return;
            }
        }

        // If clicking near a parked vehicle, mount it!
        const vMgr = (window.modManager && window.modManager.vehicleManager) ||
                     (this.game && this.game.vehicleManager) ||
                     (this.game && this.game.modManager && this.game.modManager.vehicleManager);
        if (vMgr && !this.mountedVehicle) {
            const nearbyV = vMgr.getNearbyVehicles(this.position, 4.2);
            if (nearbyV.length > 0 && !nearbyV[0].driver) {
                this.mountVehicle(nearbyV[0]);
                if (this.game && this.game.soundManager) this.game.soundManager.playDoor();
                return;
            }
        }

        // If holding grenade, throw grenade!
        if (heldReg && heldReg.isThrowable) {
            this.tryThrowGrenade();
            return;
        }

        // If holding sniper rifle (AWP), toggle scope!
        if (heldReg?.isGun) {
            this.setAiming(true);
            return;
        }

        // If right-clicking a mob (e.g. Villager for trading)
        const origin = new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
        const lookDir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();
        if (this.game && this.game.mobManager) {
            for (let mob of this.game.mobManager.mobs) {
                if (!mob.isDead && mob.group && !this.game.mobManager.creativeMobsDisabled && mob.type === 'villager' && !mob.isScriptBot) {
                    const toMob = mob.position.clone().sub(this.position);
                    if (toMob.length() < 4.8) {
                        const dot = lookDir.dot(toMob.clone().normalize());
                        if (dot > 0.55) {
                            mob.interact(this);
                            return;
                        }
                    }
                }
            }
        }

        // If holding food, try eating instead!
        const item = this.getSelectedItem();
        if (item && ITEM_REGISTRY[item.itemId]?.category === 'food') {
            this.eatFood();
            return;
        }

        // If holding portal activation item
        if (item && item.itemId === ITEM_TYPES.PORTAL_END) {
            this.world.switchDimension('the_end');
            return;
        }

        if (!this.targetBlock) return;

        const { x, y, z, nx, ny, nz, type } = this.targetBlock;

        // ⚡ Interactive Block Click Check (Lever, Button, Computer)
        if (type === BLOCK_TYPES.LEVER) {
            const redstone = (this.game && this.game.redstoneEngine) || (window.game && window.game.redstoneEngine);
            if (redstone) {
                redstone.toggleLever(x, y, z);
                this.armSwing = 0.5;
                return;
            }
        }
        if (type === BLOCK_TYPES.STONE_BUTTON) {
            const redstone = (this.game && this.game.redstoneEngine) || (window.game && window.game.redstoneEngine);
            if (redstone) {
                redstone.pressButton(x, y, z);
                this.armSwing = 0.5;
                return;
            }
        }
        if (type === BLOCK_TYPES.COMPUTER) {
            if (this.game && this.game.ui && this.game.ui.openEmuOSModal) {
                this.game.ui.openEmuOSModal();
                this.armSwing = 0.5;
                return;
            }
        }

        // Interactive check on clicked block
        if (window.modManager) {
            const canInteract = window.modManager.canInteractBlock(x, y, z, type, this);
            if (canInteract === false) return;
        }

        // Placement cooldown to prevent double-tap lag and duplicate events
        const now = performance.now();
        if (this._lastPlaceTime && (now - this._lastPlaceTime < 160)) {
            return;
        }
        this._lastPlaceTime = now;

        const px = x + nx;
        const py = y + ny;
        const pz = z + nz;

        if (py < 0 || py >= CHUNK_SIZE_Y) return;

        // Collision check with player
        const playerMinX = this.position.x - this.width / 2;
        const playerMaxX = this.position.x + this.width / 2;
        const playerMinY = this.position.y;
        const playerMaxY = this.position.y + this.height;
        const playerMinZ = this.position.z - this.depth / 2;
        const playerMaxZ = this.position.z + this.depth / 2;

        const placementDesign = item?.design ? window.normalizeBlockDesign(item.design) : null;
        const placementType = this.getSelectedBlockType();
        const placementBoxes = window.blockDesignBoxes(placementType, placementDesign);
        const intersectsPlayer = (placementDesign ? placementDesign.solid : !isPassThroughBlock(placementType)) && placementBoxes.some(bounds => (
            playerMinX < px + bounds[3] && playerMaxX > px + bounds[0] &&
            playerMinY < py + bounds[4] && playerMaxY > py + bounds[1] &&
            playerMinZ < pz + bounds[5] && playerMaxZ > pz + bounds[2]
        ));
        if (intersectsPlayer) return;

        if (item?.itemId === ITEM_TYPES.C4) {
            if (this.world.getBlock(px, py, pz) !== BLOCK_TYPES.AIR) return;
            const charges = this.game.tntEntities.filter(t => t.isC4 && !t.exploded);
            if (charges.length >= 16 || charges.some(t => Math.floor(t.x) === px && t.y === py && Math.floor(t.z) === pz)) return;
            if (window.modManager && !window.modManager.canPlaceBlock(px, py, pz, BLOCK_TYPES.TNT, this)) return;
            new C4Entity(px, py, pz, this.scene, this.game.textureManager, this.soundManager, this.world, this.particleSystem, this.game);
            if (!this.godMode && !this.isCreative && !this.infiniteBlocks) this.removeItem(ITEM_TYPES.C4, 1);
            this.armSwing = 1;
            this.game.ui?.showToast('C4 встановлено! T / 💣 — підірвати');
            return;
        }

        const blockType = this.getSelectedBlockType();
        if (!blockType) return;

        if (window.modManager) {
            const canPlace = window.modManager.canPlaceBlock(px, py, pz, blockType, this);
            if (canPlace === false) return;
        }

        this.armSwing = 1.0;
        this.world.setBlock(px, py, pz, blockType, placementDesign);
        this.world.updateMeshes();

        if (this.game.multiplayer) {
            this.game.multiplayer.broadcastBlockPlace(px, py, pz, blockType, undefined, placementDesign);
        }

        this.soundManager.playPlace(BLOCK_INFO[blockType]?.sound || 'stone');

        // Consume block from inventory in survival
        if (!this.godMode && !this.isCreative && !this.infiniteBlocks) {
            item.count -= 1;
            if (item.count <= 0) {
                this.inventory[this.selectedHotbarIndex] = null;
            }
            this.saveInventoryDebounced();
            this.updateHeldBlock();
            if (this.game.ui) this.game.ui.initHotbar();
        }

        if (blockType === BLOCK_TYPES.EBLAN_BLOCK) {
            this.iq += 50;
            this.soundManager.speakRandomMeme(["О, ще один єблан!"]);
        }
    }

    // Detonate TNT / Bomb throw
    detonateTNT() {
        if (this.game?.arenaClient?.isActive) { return; }
        if (this.isDuelLocked()) return;
        const charges = this.game.tntEntities.filter(t => t.isC4 && !t.exploded);
        if (charges.length) {
            for (const charge of charges) charge.explode();
            this.armSwing = 1;
            return;
        }
        if (this.getSelectedItem()?.itemId === ITEM_TYPES.C4) {
            this.game.ui?.showToast('Спочатку встановіть C4: ПКМ / кнопка встановлення');
            return;
        }
        if (!this.hasItem(ITEM_TYPES.TNT, 1) && !this.godMode) {
            this.soundManager.speakRandomMeme(["Немає ТНТ в руках!"]);
            return;
        }

        if (!this.godMode) this.removeItem(ITEM_TYPES.TNT, 1);

        this.armSwing = 1.0;
        const origin = this.position.clone().add(new THREE.Vector3(0, this.eyeHeight - 0.2, 0));
        const dir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        const spawnPos = origin.clone().addScaledVector(dir, 1.2);
        const tnt = new TNTEntity(
            spawnPos.x - 0.5,
            spawnPos.y - 0.5,
            spawnPos.z - 0.5,
            this.scene,
            this.game.textureManager,
            this.soundManager,
            this.world,
            this.particleSystem,
            this.game
        );
        tnt.vx = dir.x * 14;
        tnt.vy = dir.y * 14 + 3.5;
        tnt.vz = dir.z * 14;

        if (this.game.multiplayer) {
            this.game.multiplayer.broadcastTNTExplode(spawnPos.x, spawnPos.y, spawnPos.z);
        }

        this.iq += 5;
    }

    checkCollision(pos) {
        if (this.noclip) return false;
        const minX = Math.floor(pos.x - this.width / 2 + 0.001);
        const maxX = Math.floor(pos.x + this.width / 2 - 0.001);
        const minY = Math.floor(pos.y + 0.001);
        const maxY = Math.floor(pos.y + this.height - 0.001);
        const minZ = Math.floor(pos.z - this.depth / 2 + 0.001);
        const maxZ = Math.floor(pos.z + this.depth / 2 - 0.001);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const b = this.world.getBlock(x, y, z);
                    const design = this.world.getBlockDesign?.(x, y, z);
                    if (design ? design.solid : !isPassThroughBlock(b)) {
                        if (!design && !window.BLOCK_INFO?.[b]?.bounds) return true;
                        for (const bounds of window.blockDesignBoxes(b, design)) {
                            if (pos.x + this.width / 2 - .001 > x + bounds[0] && pos.x - this.width / 2 + .001 < x + bounds[3] &&
                                pos.y + this.height - .001 > y + bounds[1] && pos.y + .001 < y + bounds[4] &&
                                pos.z + this.depth / 2 - .001 > z + bounds[2] && pos.z - this.depth / 2 + .001 < z + bounds[5]) return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    checkIsGrounded() {
        if (this.onGround) return true;
        const minX = Math.floor(this.position.x - this.width / 2 + 0.05);
        const maxX = Math.floor(this.position.x + this.width / 2 - 0.05);
        const testY = Math.floor(this.position.y - 0.15);
        const minZ = Math.floor(this.position.z - this.depth / 2 + 0.05);
        const maxZ = Math.floor(this.position.z + this.depth / 2 - 0.05);

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const b = this.world.getBlock(x, testY, z);
                const design = this.world.getBlockDesign?.(x, testY, z);
                if (design ? design.solid : !isPassThroughBlock(b)) {
                    for (const bounds of window.blockDesignBoxes(b, design)) {
                        if (this.position.y - .15 < testY + bounds[4] && this.position.y >= testY + bounds[1] &&
                            this.position.x + this.width / 2 > x + bounds[0] && this.position.x - this.width / 2 < x + bounds[3] &&
                            this.position.z + this.depth / 2 > z + bounds[2] && this.position.z - this.depth / 2 < z + bounds[5]) return true;
                    }
                }
            }
        }
        return false;
    }

    checkPortals() {
        this.portalTimer += 0.016;
        if (this.portalTimer < 1.0) return;

        const bx = Math.floor(this.position.x);
        const by = Math.floor(this.position.y + 0.5);
        const bz = Math.floor(this.position.z);
        const b = this.world.getBlock(bx, by, bz);

        if (b === BLOCK_TYPES.PORTAL_NETHER) {
            this.portalTimer = 0;
            const target = this.world.dimension === 'nether' ? 'overworld' : 'nether';
            this.world.switchDimension(target);
        } else if (b === BLOCK_TYPES.PORTAL_END) {
            this.portalTimer = 0;
            const target = this.world.dimension === 'the_end' ? 'overworld' : 'the_end';
            this.world.switchDimension(target);
        }
    }

    // Source-engine style air acceleration: only the speed *along the wish direction* is capped,
    // so turning the camera while strafing (A/D + mouse) adds speed every hop.
    airAccelerate(moveX, moveZ, baseSpeed, dt) {
        const mag = Math.hypot(moveX, moveZ);
        if (mag > 0.001) {
            const wx = moveX / mag, wz = moveZ / mag;
            const frames = Math.min(Math.max(dt * 60, 0.25), 4);   // keep the gain frame-rate independent
            const wishCap = 1.0 * Math.sqrt(frames);
            const add = wishCap - (this.velocity.x * wx + this.velocity.z * wz);
            if (add > 0) {
                const acc = Math.min(add, 10 * baseSpeed * dt * Math.min(1, mag));
                this.velocity.x += wx * acc;
                this.velocity.z += wz * acc;
            }
        }
        const maxSpeed = 16;
        const speed = Math.hypot(this.velocity.x, this.velocity.z);
        if (speed > maxSpeed) {
            this.velocity.x *= maxSpeed / speed;
            this.velocity.z *= maxSpeed / speed;
        }
    }

    updatePhysics(dt, inputVector, jumpPressed, flyUpPressed, flyDownPressed) {
        if (this.game?.arenaClient?.isActive) {
            this.game.arenaClient.updatePlayer(dt, inputVector, jumpPressed);
            return;
        }
        if (this.isDuelLocked()) {
            this.velocity.set(0, 0, 0);
            this.gunReload = null;
            this.updateView(dt);
            return;
        }
        this.updateGunReload();
        const controls = this.game?.controls;
        if (controls && !controls.mouseLeftDown && !controls.attackBtnPressed && !controls.breakBtnPressed) {
            this.releaseGunTrigger();
        }
        if (this.isDead) return;

        // Anti-stuck safety clearance: if player somehow ended up inside solid blocks
        if (this.checkCollision(this.position)) {
            for (let dy = 0.05; dy <= 2.5; dy += 0.1) {
                this._scratchNextPos.copy(this.position);
                this._scratchNextPos.y += dy;
                if (!this.checkCollision(this._scratchNextPos)) {
                    this.position.y += dy;
                    this.velocity.y = 0;
                    break;
                }
            }
        }

        // Modern Combat Attack Cooldown & Combo Timers
        if (this.attackCooldown < 1.0) {
            this.attackCooldown = Math.min(1.0, this.attackCooldown + dt * this.getWeaponAttackSpeed());
        }
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.comboCounter = 0;
        }
        if (this.whiffLagTimer > 0) {
            this.whiffLagTimer -= dt;
        }
        if (this.totemInvulnerableTimer > 0) {
            this.totemInvulnerableTimer -= dt;
        }
        if (this.parryCounterBonus && performance.now() - (this.lastAttackHitTime || 0) > 2000) {
            this.parryCounterBonus = 1.0;
        }

        // Survival Hunger & Regeneration loop
        if (!this.godMode && !this.isCreative) {
            this.hungerTimer += dt;
            if (this.hungerTimer > 3.0) {
                this.hungerTimer = 0;
                // Drain hunger faster if sprinting
                const drain = this.isSprinting ? 1.5 : 0.4;
                this.hunger = Math.max(0, this.hunger - drain);

                // Natural regen if hunger > 80
                if (this.hunger > 80 && this.health < this.maxHealth) {
                    this.heal(3);
                }
                // Starvation damage if hunger is 0
                if (this.hunger <= 0) {
                    this.takeDamage(4, "Помер з голоду як справжній єблан!");
                }
            }
        }

        // Check Portal Stepping
        this.checkPortals();

        // Update Mining Progress
        this.updateMining(dt);

        // --- LIQUIDS (WATER & LAVA) & BREATHING CHECKS ---
        const px = Math.floor(this.position.x);
        const pyFeet = Math.floor(this.position.y);
        const pyWaist = Math.floor(this.position.y + 0.8);
        const pyHead = Math.floor(this.position.y + 1.55);
        const pz = Math.floor(this.position.z);
        const blockFeet = this.world.getBlock(px, pyFeet, pz);
        const blockWaist = this.world.getBlock(px, pyWaist, pz);
        const blockHead = this.world.getBlock(px, pyHead, pz);

        let blockEye = blockHead;
        if (this.camera) {
            blockEye = this.world.getBlock(
                Math.floor(this.camera.position.x),
                Math.floor(this.camera.position.y),
                Math.floor(this.camera.position.z)
            );
        }

        // 🌋 Molten Lava State Checks
        this.isInLava = (blockFeet === BLOCK_TYPES.LAVA || blockWaist === BLOCK_TYPES.LAVA || blockHead === BLOCK_TYPES.LAVA || blockEye === BLOCK_TYPES.LAVA);
        this.isLavaSubmerged = (blockHead === BLOCK_TYPES.LAVA || blockEye === BLOCK_TYPES.LAVA);

        if (this.isInLava) {
            // Lava damage
            const hasFireImmunity = (this.game.upgrader) ? this.game.upgrader.hasFireImmunity() : false;
            if (!this.godMode && !this.isCreative && !hasFireImmunity) {
                this.takeDamage(16 * dt, "Згорів у розпеченій лаві!");
            }

            // Sizzle audio and sparks
            this.lavaSizzleTimer = (this.lavaSizzleTimer || 0) - dt;
            if (this.lavaSizzleTimer <= 0) {
                this.lavaSizzleTimer = 0.45;
                if (this.soundManager && this.soundManager.playSizzle) this.soundManager.playSizzle();
                if (this.game && this.game.particleSystem && this.game.particleSystem.spawnLavaPopParticles) {
                    this.game.particleSystem.spawnLavaPopParticles(this.position.x, this.position.y + 0.4, this.position.z, 3);
                }
            }
        }

        // Lava splash entry/exit
        if (this.isInLava && !this.wasInLava) {
            if (this.soundManager && this.soundManager.playSizzle) this.soundManager.playSizzle();
            if (this.game && this.game.particleSystem && this.game.particleSystem.spawnLavaPopParticles) {
                this.game.particleSystem.spawnLavaPopParticles(this.position.x, this.position.y + 0.2, this.position.z, 6);
            }
        }
        this.wasInLava = this.isInLava;

        this.isInWater = (blockFeet === BLOCK_TYPES.WATER || blockWaist === BLOCK_TYPES.WATER || blockHead === BLOCK_TYPES.WATER || blockEye === BLOCK_TYPES.WATER);
        this.isSubmerged = (blockHead === BLOCK_TYPES.WATER || blockEye === BLOCK_TYPES.WATER);

        // Splash entry/exit
        this.splashCooldown = (this.splashCooldown || 0) - dt;
        if (this.isInWater && !this.wasInWater) {
            if (this.splashCooldown <= 0) {
                this.splashCooldown = 0.35;
                if (this.soundManager && this.soundManager.playSplash) this.soundManager.playSplash();
                if (this.game && this.game.particleSystem && this.game.particleSystem.spawnBubbleParticles) {
                    this.game.particleSystem.spawnBubbleParticles(this.position.x, this.position.y + 0.5, this.position.z, 10);
                }
            }
        } else if (!this.isInWater && this.wasInWater) {
            if (this.splashCooldown <= 0) {
                this.splashCooldown = 0.35;
                if (this.soundManager && this.soundManager.playSplash) this.soundManager.playSplash();
            }
            // 🐬 Feature-Bug: Waterclip Dolphin Boost (імпульс при виході з води)
            this.waterExitBoostTimer = 0.35;
            this.velocity.y = Math.max(this.velocity.y, 3.9);
            if (this.game && this.game.particleSystem && this.game.particleSystem.spawnBubbleParticles) {
                this.game.particleSystem.spawnBubbleParticles(this.position.x, this.position.y + 0.2, this.position.z, 6);
            }
        }
        this.wasInWater = this.isInWater;

        // Underwater Breathing & Drowning System (controlled by toggle)
        const underwaterEnabled = !this.game || this.game.underwaterEffectsEnabled !== false;
        if (underwaterEnabled && !this.godMode && !this.isCreative) {
            if (this.isSubmerged) {
                // Drain oxygen (100 over ~20s)
                this.oxygen = Math.max(0, this.oxygen - dt * 5.0);
                if (this.oxygen <= 0) {
                    this.drownTimer += dt;
                    if (this.drownTimer >= 1.2) {
                        this.drownTimer = 0;
                        this.takeDamage(4, "Потонув у воді як справжній єблан!");
                    }
                }
                // Periodic rising breath bubbles
                this.bubbleParticleTimer += dt;
                if (this.bubbleParticleTimer >= 0.55) {
                    this.bubbleParticleTimer = 0;
                    if (this.game && this.game.particleSystem && this.game.particleSystem.spawnBubbleParticles) {
                        this.game.particleSystem.spawnBubbleParticles(
                            this.position.x + (Math.random() - 0.5) * 0.3,
                            this.position.y + 1.4,
                            this.position.z + (Math.random() - 0.5) * 0.3,
                            2
                        );
                    }
                }
            } else {
                // Quick oxygen recovery when surfacing
                this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 35.0);
                this.drownTimer = 0;
            }
        } else {
            this.oxygen = this.maxOxygen;
            this.drownTimer = 0;
        }

        // --- VEHICLE DRIVING PHYSICS ---
        if (this.mountedVehicle) {
            this.mountedVehicle.updateDriver(dt, inputVector, jumpPressed, this.isSprinting);
            this.position.copy(this.mountedVehicle.position);
            this.position.y += 0.35;
            this.velocity.set(0, 0, 0);
            this.onGround = true;
            this.timeSinceGrounded = 0;
        } else if (this.isFlying) {
            let baseSpeed = (this.isSprinting ? 7.5 : 4.5);
            if (this.speedMultiplier) baseSpeed *= this.speedMultiplier;
            if (this.game.upgrader) baseSpeed *= this.game.upgrader.getSpeedMultiplier();
            const sinYaw = Math.sin(this.yaw);
            const cosYaw = Math.cos(this.yaw);
            const moveX = inputVector.x * cosYaw - inputVector.y * sinYaw;
            const moveZ = -inputVector.x * sinYaw - inputVector.y * cosYaw;

            const flySpeed = (this.flySpeed || 11.0) * (this.isSprinting ? 1.6 : 1.0);
            this.velocity.x = moveX * flySpeed;
            this.velocity.z = moveZ * flySpeed;

            if (flyUpPressed || jumpPressed) {
                this.velocity.y = flySpeed;
            } else if (flyDownPressed) {
                this.velocity.y = -flySpeed;
            } else {
                this.velocity.y = 0;
            }

            // Move X
            const nextPosX = this._scratchNextPos.copy(this.position);
            nextPosX.x += this.velocity.x * dt;
            if (this.noclip || !this.checkCollision(nextPosX)) {
                this.position.x = nextPosX.x;
            }

            // Move Z
            const nextPosZ = this._scratchNextPos.copy(this.position);
            nextPosZ.z += this.velocity.z * dt;
            if (this.noclip || !this.checkCollision(nextPosZ)) {
                this.position.z = nextPosZ.z;
            }

            // Move Y
            const nextPosY = this._scratchNextPos.copy(this.position);
            nextPosY.y += this.velocity.y * dt;
            if (this.noclip || !this.checkCollision(nextPosY)) {
                this.position.y = nextPosY.y;
            }

            this.onGround = false;
            this.timeSinceGrounded = 0;
        } else {
            // Movement Speed with Skin and Mod modifier (phys* = Lua Physics API overrides)
            let baseSpeed = (this.isSprinting ? (this.physSprintSpeed ?? 7.5) : (this.physWalkSpeed ?? 4.5));
            if (this.speedMultiplier) baseSpeed *= this.speedMultiplier;
            if (this.game.upgrader) baseSpeed *= this.game.upgrader.getSpeedMultiplier();
            if (this.isBlocking) baseSpeed *= 0.45; // Shield/Sword blocking slowdown like in Minecraft

            // 🐬 Waterclip Dolphin Speed Boost (+30% boost for 0.35s upon water exit)
            if (this.waterExitBoostTimer > 0) {
                this.waterExitBoostTimer = Math.max(0, this.waterExitBoostTimer - dt);
                baseSpeed *= 1.30;
            }
            const sinYaw = Math.sin(this.yaw);
            const cosYaw = Math.cos(this.yaw);
            const moveX = inputVector.x * cosYaw - inputVector.y * sinYaw;
            const moveZ = -inputVector.x * sinYaw - inputVector.y * cosYaw;

            let isGroundedNow = false;

        if (this.isInLava) {
            baseSpeed *= 0.42; // Thick viscous molten magma drag
            this.velocity.x = moveX * baseSpeed;
            this.velocity.z = moveZ * baseSpeed;

            // Heavy molten buoyancy & struggle swim
            if (jumpPressed || flyUpPressed) {
                this.velocity.y = 2.4; // Struggling upward
                this.lavaSoundTimer = (this.lavaSoundTimer || 0) + dt;
                if (this.lavaSoundTimer > 0.4) {
                    this.lavaSoundTimer = 0;
                    if (this.soundManager && this.soundManager.playLavaPop) this.soundManager.playLavaPop();
                }
            } else if (flyDownPressed) {
                this.velocity.y = -2.8;
            } else {
                // Sinks slowly in dense molten rock
                this.velocity.y -= 2.0 * dt;
                if (this.velocity.y < -1.8) this.velocity.y = -1.8;
                this.velocity.y *= Math.pow(0.82, dt * 60);
            }
        } else if (this.isInWater) {
            baseSpeed *= 0.72; // Smooth water swimming speed
            this.velocity.x = moveX * baseSpeed;
            this.velocity.z = moveZ * baseSpeed;

            // Waterfall downward pull only if directly above an empty drop
            if (this.world) {
                const bx = Math.floor(this.position.x);
                const by = Math.floor(this.position.y);
                const bz = Math.floor(this.position.z);
                const blockUnder = this.world.getBlock(bx, by - 1, bz);
                if (blockUnder === BLOCK_TYPES.AIR) {
                    this.velocity.y -= 3.5 * dt;
                }
            }

            // Swimming upward/downward & buoyancy
            if (jumpPressed || flyUpPressed) {
                this.velocity.y = 3.6;
                this.swimSoundTimer += dt;
                if (this.swimSoundTimer > 0.45) {
                    this.swimSoundTimer = 0;
                    if (this.soundManager && this.soundManager.playSwim) this.soundManager.playSwim();
                }
            } else if (flyDownPressed) {
                this.velocity.y = -3.4;
            } else {
                // Slower sinking + gentle buoyancy bobbing
                this.velocity.y -= 4.0 * dt;
                if (this.velocity.y < -3.5) this.velocity.y = -3.5;
                this.velocity.y *= Math.pow(0.88, dt * 60);

                this.swimBobbingTimer += dt * 2.2;
                this.velocity.y += Math.sin(this.swimBobbingTimer) * 0.08 * dt;
            }

            const isMoving = Math.abs(inputVector.x) > 0.1 || Math.abs(inputVector.y) > 0.1;
            if (isMoving && !jumpPressed && !flyUpPressed) {
                this.swimSoundTimer += dt;
                if (this.swimSoundTimer > 0.65) {
                    this.swimSoundTimer = 0;
                    if (this.soundManager && this.soundManager.playSwim) this.soundManager.playSwim();
                }
            }

            this.onGround = false;
            this.timeSinceGrounded = 999;
            isGroundedNow = false;
        } else {
            // Gravity
            this.velocity.y -= (this.physGravity ?? 22.0) * dt;
            if (this.velocity.y < -30) this.velocity.y = -30;

            // Jump buffer & cooldown timers
            if (jumpPressed) {
                this.jumpBufferTimer = 0.18;
            } else if (this.jumpBufferTimer > 0) {
                this.jumpBufferTimer -= dt;
            }
            if (this.jumpCooldown > 0) {
                this.jumpCooldown -= dt;
            }

            isGroundedNow = this.onGround || this.checkIsGrounded();
            if (isGroundedNow) {
                this.timeSinceGrounded = 0;
                this.onGround = true;
                this.bhopGroundTimer = (this.bhopGroundTimer || 0) + dt;
            } else {
                this.bhopGroundTimer = 0;
                this.timeSinceGrounded += dt;
            }

            // Jump execution (Responsive with coyote time & buffer)
            const canJump = (this.timeSinceGrounded < 0.16);
            let jumpedThisFrame = false;
            if (this.jumpBufferTimer > 0 && canJump && this.jumpCooldown <= 0) {
                jumpedThisFrame = true;
                let jumpPower = (this.physJumpPower ?? 8.5);
                const skin = (window.SKINS_REGISTRY && this.game.upgrader) ? window.SKINS_REGISTRY[this.game.upgrader.equippedSkin] : null;
                if (skin && skin.buffs && skin.buffs.jumpMult) jumpPower *= skin.buffs.jumpMult;
                // Anti-bhop #2: the first jump is full, chained hops (re-jumping right after landing) are lower
                if (this.bunnyhop) {
                    this.bhopChain = (this.bhopGroundTimer || 0) < 0.12 ? (this.bhopChain || 0) + 1 : 0;
                    if (this.bhopChain >= 1) jumpPower *= (this.bhopChainJumpMult ?? 0.75);
                } else this.bhopChain = 0;

                this.velocity.y = jumpPower;
                this.onGround = false;
                this.timeSinceGrounded = 999;
                this.jumpBufferTimer = 0;
                this.jumpCooldown = (this.physJumpCooldown ?? 0.18);
                this.soundManager.playJump();
                this.hunger = Math.max(0, this.hunger - 0.2);
            }

            // With bunny hop a jump on the landing frame keeps the horizontal speed (no ground snap)
            // CS 1.6 style anti-bhop: touching the ground above the speed limit drops you to run/walk speed
            if (this.bunnyhop && jumpedThisFrame && isGroundedNow && !this.isFlying) {
                const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
                const limit = (this.bhopSpeedLimit ?? 8.5);
                if (hSpeed > limit) {
                    const cap = (baseSpeed * (this.bhopPenaltySpeedMult ?? 0.92)) / hSpeed;   // a bit under sprint/walk speed
                    this.velocity.x *= cap;
                    this.velocity.z *= cap;
                }
            }

            const isAirborne = !isGroundedNow || (this.bunnyhop && jumpedThisFrame);
            if (isAirborne && !this.isFlying && this.bunnyhop) {
                this.airAccelerate(moveX, moveZ, baseSpeed, dt);
            } else if (isAirborne && !this.isFlying) {
                // Normal in-air steering & momentum
                this.velocity.x += moveX * 0.28;
                this.velocity.z += moveZ * 0.28;
                const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
                if (currentSpeed > baseSpeed) {
                    const f = baseSpeed / currentSpeed;
                    this.velocity.x *= f;
                    this.velocity.z *= f;
                }
            } else if (this.bunnyhop && !this.isFlying) {
                // Bunnyhop mode: Source-style ground friction + acceleration instead of snapping the velocity to the
                // input. Landing no longer wipes the air-strafe momentum or yanks you toward the held key, and
                // walking without jumping ramps up/down in ~0.1s instead of being instant.
                const vx = this.velocity.x, vz = this.velocity.z;
                const speed = Math.hypot(vx, vz);
                if (speed > 0.001) {
                    const control = Math.max(speed, 2.0);                 // stop-speed: low speeds still brake quickly
                    const newSpeed = Math.max(0, speed - control * 9 * dt);
                    const k = newSpeed / speed;
                    this.velocity.x *= k;
                    this.velocity.z *= k;
                }
                const mag = Math.hypot(moveX, moveZ);
                if (mag > 0.001) {
                    const wx = moveX / mag, wz = moveZ / mag;
                    const wishSpeed = baseSpeed * Math.min(1, mag);
                    const add = wishSpeed - (this.velocity.x * wx + this.velocity.z * wz);
                    if (add > 0) {
                        const acc = Math.min(add, 12 * baseSpeed * dt);
                        this.velocity.x += wx * acc;
                        this.velocity.z += wz * acc;
                    }
                }
            } else {
                // Crisp Ground Movement (Instant responsive deceleration)
                this.velocity.x = moveX * baseSpeed;
                this.velocity.z = moveZ * baseSpeed;
            }
        }

        // Move X
        const nextPosX = this._scratchNextPos.copy(this.position);
        nextPosX.x += this.velocity.x * dt;
        if (!this.checkCollision(nextPosX)) {
            this.position.x = nextPosX.x;
        } else {
            this.velocity.x = 0;
        }

        // Move Z
        const nextPosZ = this._scratchNextPos.copy(this.position);
        nextPosZ.z += this.velocity.z * dt;
        if (!this.checkCollision(nextPosZ)) {
            this.position.z = nextPosZ.z;
        } else {
            this.velocity.z = 0;
        }

        // Move Y
        const nextPosY = this._scratchNextPos.copy(this.position);
        const prevVy = this.velocity.y;
        nextPosY.y += this.velocity.y * dt;

        if (!this.checkCollision(nextPosY)) {
            this.position.y = nextPosY.y;
            this.onGround = false;
        } else {
            if (this.velocity.y < 0) {
                // Falling: find the highest solid surface under the player's feet
                const minX = Math.floor(this.position.x - this.width / 2 + 0.001);
                const maxX = Math.floor(this.position.x + this.width / 2 - 0.001);
                const minZ = Math.floor(this.position.z - this.depth / 2 + 0.001);
                const maxZ = Math.floor(this.position.z + this.depth / 2 - 0.001);

                const startY = Math.floor(this.position.y);
                const endY = Math.floor(nextPosY.y);
                let landedSurface = null;
                for (let y = startY; y >= endY; y--) {
                    for (let x = minX; x <= maxX; x++) {
                        for (let z = minZ; z <= maxZ; z++) {
                            const b = this.world.getBlock(x, y, z);
                            const design = this.world.getBlockDesign?.(x, y, z);
                            if (design ? !design.solid : isPassThroughBlock(b)) continue;
                            for (const bounds of window.blockDesignBoxes(b, design)) {
                            const surface = y + bounds[4];
                            if (this.position.x + this.width / 2 - .001 <= x + bounds[0] ||
                                this.position.x - this.width / 2 + .001 >= x + bounds[3] ||
                                this.position.z + this.depth / 2 - .001 <= z + bounds[2] ||
                                this.position.z - this.depth / 2 + .001 >= z + bounds[5]) continue;
                            if (surface <= this.position.y + .001 && surface >= nextPosY.y &&
                                (landedSurface === null || surface > landedSurface)) landedSurface = surface;
                            }
                        }
                    }
                    if (landedSurface !== null) break;
                }
                this.position.y = landedSurface ?? (Math.floor(nextPosY.y) + 1.0);
                this.onGround = true;
                this.timeSinceGrounded = 0;

                // Fall damage (negated if landing in water or lava)
                if (prevVy < -16 && !this.godMode && !this.isCreative && !this.isFlying && !this.isInWater && !this.isInLava && !this.physNoFallDamage) {
                    const fallDamage = Math.floor((-prevVy - 14) * 4);
                    this.takeDamage(fallDamage, "Розбився об землю як єблан!");
                }
            } else if (this.velocity.y > 0) {
                // Head hit ceiling: snap head cleanly below the ceiling block
                // Find the last clear position below the actual shape's underside.
                let clearY = this.position.y, blockedY = nextPosY.y;
                const probe = this._scratchNextPos.clone();
                for (let i = 0; i < 20; i++) {
                    probe.y = (clearY + blockedY) / 2;
                    if (this.checkCollision(probe)) blockedY = probe.y;
                    else clearY = probe.y;
                }
                this.position.y = clearY;
            }
            this.velocity.y = 0;
        }

            // Void fall check
            if (this.position.y < -15) {
                if (this.godMode || this.isCreative || this.isFlying) {
                    this.position.y = 30;
                    this.velocity.set(0, 0, 0);
                } else {
                    this.takeDamage(100, "Впав у бездну!");
                }
            }

            // Footsteps (only on ground and not in water)
            const isMoving = Math.abs(inputVector.x) > 0.1 || Math.abs(inputVector.y) > 0.1;
            if (isMoving && this.onGround && !this.isInWater) {
                this.walkCycle += dt * (this.isSprinting ? 14 : 9);
                {
                    const fb = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y - 0.1), Math.floor(this.position.z));
                    this.soundManager.playStep((window.BLOCK_INFO && BLOCK_INFO[fb]?.sound) || 'stone');
                }
            } else {
                this.walkCycle = 0;
            }
        }

        this.updateView(dt);
    }

    updateView(dt) {
        this.updateWeaponView(dt);
        // Vehicle camera
        if (this.mountedVehicle) {
            this.updateVehicleCamera();
            this.updateRaycast();
            return;
        }

        // Camera setup (1st vs 3rd person)
        if (this.isThirdPerson) {
            const dist = 3.5;
            const camX = this.position.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
            const camY = this.position.y + this.eyeHeight + Math.sin(-this.pitch) * dist + 0.4;
            const camZ = this.position.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist;

            this.camera.position.set(camX, camY, camZ);
            this.camera.lookAt(this.position.x, this.position.y + this.eyeHeight, this.position.z);

            // Third person body orientation & animation
            this.playerBodyGroup.position.copy(this.position);
            this.playerBodyGroup.rotation.y = this.yaw;

            if (this.mcModel) {
                // Head pitch tilting
                if (this.mcModel.headPivot) {
                    this.mcModel.headPivot.rotation.x = this.pitch;
                }

                // Limbs walking / swimming swing
                const isMoving = this.velocity && (Math.abs(this.velocity.x) > 0.15 || Math.abs(this.velocity.z) > 0.15);
                if (this.isInWater) {
                    const swimCycle = (this.swimBobbingTimer || 0) * 3.5;
                    const legAngle = Math.sin(swimCycle) * 0.45;
                    this.mcModel.leftLegPivot.rotation.x = legAngle;
                    this.mcModel.rightLegPivot.rotation.x = -legAngle;
                    this.mcModel.leftArmPivot.rotation.x = -legAngle * 0.5;
                    if (this.armSwing <= 0) {
                        this.mcModel.rightArmPivot.rotation.x = legAngle * 0.5;
                    }
                } else if (isMoving && this.onGround) {
                    const legAngle = Math.sin(this.walkCycle) * 0.65;
                    this.mcModel.leftLegPivot.rotation.x = legAngle;
                    this.mcModel.rightLegPivot.rotation.x = -legAngle;
                    this.mcModel.leftArmPivot.rotation.x = -legAngle * 0.7;
                    if (this.armSwing <= 0) {
                        this.mcModel.rightArmPivot.rotation.x = legAngle * 0.7;
                    }
                } else {
                    this.mcModel.leftLegPivot.rotation.x *= 0.8;
                    this.mcModel.rightLegPivot.rotation.x *= 0.8;
                    this.mcModel.leftArmPivot.rotation.x *= 0.8;
                    if (this.armSwing <= 0) {
                        this.mcModel.rightArmPivot.rotation.x *= 0.8;
                    }
                }

                if (ITEM_REGISTRY[this.getSelectedItem()?.itemId]?.isGun) {
                    this.mcModel.rightArmPivot.rotation.x = -Math.PI / 2 + this.pitch;
                    this.mcModel.leftArmPivot.rotation.x = -1.15;
                }
                // 3rd Person Arm swing punch / mining attack
                if (this.armSwing > 0) {
                    this.mcModel.rightArmPivot.rotation.x = -Math.sin(this.armSwing * Math.PI) * 1.35;
                    this.mcModel.rightArmPivot.rotation.y = Math.sin(this.armSwing * Math.PI) * 0.35;
                } else {
                    this.mcModel.rightArmPivot.rotation.y *= 0.8;
                }
            }
        } else {
            const verticalBob = this.onGround
                ? Math.sin(this.walkCycle) * 0.04 * (1 - .85 * (this.aimBlend || 0))
                : (this.isInWater ? Math.sin(this.swimBobbingTimer) * 0.04 : 0);
            this.camera.position.set(
                this.position.x,
                this.position.y + this.eyeHeight + verticalBob,
                this.position.z
            );
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.y = this.yaw;
            this.camera.rotation.x = this.pitch;
        }

        // First-person hand & held item swing animation (Minecraft-style slash/chop arc & shield blocking pose)
        if (this.itemPivot) {
            const bobX = Math.cos(this.walkCycle * 0.5) * 0.025;
            const bobY = Math.abs(Math.sin(this.walkCycle)) * 0.025;

            if (this.armSwing > 0) {
                this.armSwing = Math.max(0, this.armSwing - dt * 6.5);
            }
            const swingOffset = Math.sin(this.armSwing * Math.PI);
            const held = this.getSelectedItem();
            const heldGun = held && ITEM_REGISTRY[held.itemId]?.isGun;
            const heldKnife = held && ITEM_REGISTRY[held.itemId]?.isKnife;

            if (heldGun) {
                const arenaReload = this.game?.arenaClient?.isActive && this.game.arenaClient.localState?.reloadRemaining > 0;
                const reloading = arenaReload || this.gunReload?.item === held;
                const aim = this.aimBlend || 0, kick = this.weaponKick || 0;
                const type = ITEM_REGISTRY[held.itemId]?.gunType;
                const aimHeight = type === 'awp' ? .17 : type === 'rpg' ? .245 : .13;
                this.itemPivot.position.set(.34 * (1 - aim) + bobX * (1 - aim),
                    -.31 * (1 - aim) - aimHeight * aim + bobY * (1 - aim) - (reloading ? .14 : 0),
                    -.48 - aim * .06 + kick * .10);
                this.itemPivot.rotation.set(kick * .16, -.045 * (1 - aim), reloading ? -.45 : -kick * .035);
                if (this.gunDraw > 0) {
                    const dur = GUN_DRAW_TIME[type] || GUN_DRAW_TIME.default;
                    if (!this._gunDrawSfx) { this._gunDrawSfx = true; this.soundManager?.playGunDraw?.(type); }
                    this.gunDraw = Math.max(0, this.gunDraw - dt / dur);
                    const o = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 };
                    applyKnifeClip(GUN_DRAW_CLIP, (1 - this.gunDraw) * GUN_DRAW_CLIP.dur, o, 1 - aim * .8);
                    this.itemPivot.position.x += o.px; this.itemPivot.position.y += o.py; this.itemPivot.position.z += o.pz;
                    this.itemPivot.rotation.x += o.rx; this.itemPivot.rotation.y += o.ry; this.itemPivot.rotation.z += o.rz;
                }
            } else if (heldKnife) {
                this.updateKnifeView(dt, bobX, bobY, swingOffset);
            } else if (this.isBlocking) {
                // Minecraft-style Shield / Sword blocking pose (raised in front of chest)
                this.itemPivot.position.set(0.12, -0.22, -0.44);
                this.itemPivot.rotation.set(-0.35, 0.45, -0.65);
            } else {
                this.itemPivot.position.set(
                    (held ? .50 : .35) + bobX - swingOffset * .16,
                    (held ? -.50 : -.24) + bobY - swingOffset * .20,
                    (held ? -.60 : -.62) - swingOffset * .16
                );
                // quick downward chop arc
                this.itemPivot.rotation.set(
                    -swingOffset * 1.25,
                    swingOffset * 0.45,
                    -swingOffset * 0.55
                );
            }
        }

        // Raycasting
        this.updateRaycast();
        this.updateTargetLock();
    }

    updateTargetLock() {
        if (!this.camera || this.isDead) {
            this.isTargetLocked = false;
            const ch = document.getElementById('crosshair');
            if (ch) ch.classList.remove('target-locked');
            return;
        }

        const origin = new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
        const dir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        const reach = this.customReach || (this.isCreative ? 8.0 : 4.8);
        let locked = false;

        // Check Mobs
        if (this.game && this.game.mobManager) {
            for (let mob of this.game.mobManager.mobs) {
                if (!mob.isDead && mob.group && !this.game.mobManager.creativeMobsDisabled) {
                    const mobCenter = mob.position.clone().add(new THREE.Vector3(0, (mob.height || 1.8) * 0.5, 0));
                    const toMob = mobCenter.sub(origin);
                    const distAlongRay = toMob.dot(dir);
                    if (distAlongRay > 0 && distAlongRay < reach) {
                        const perpDist = toMob.sub(dir.clone().multiplyScalar(distAlongRay)).length();
                        const hitboxRadius = (mob.width || 0.65) * 0.95 + 0.18;
                        if (perpDist <= hitboxRadius) {
                            locked = true;
                            break;
                        }
                    }
                }
            }
            if (!locked && this.game.mobManager.dragon && !this.game.mobManager.dragon.isDead && this.game.mobManager.dragon.mesh) {
                if (this.position.distanceTo(this.game.mobManager.dragon.mesh.position) < 14.0) {
                    locked = true;
                }
            }
        }

        // Check remote multiplayer players
        if (!locked && this.game && this.game.multiplayer && this.game.multiplayer.players) {
            for (let [id, remote] of this.game.multiplayer.players.entries()) {
                if (remote && remote.mesh) {
                    const pCenter = remote.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
                    const toP = pCenter.sub(origin);
                    const distAlongRay = toP.dot(dir);
                    if (distAlongRay > 0 && distAlongRay < reach) {
                        const perpDist = toP.sub(dir.clone().multiplyScalar(distAlongRay)).length();
                        if (perpDist <= 0.65) {
                            locked = true;
                            break;
                        }
                    }
                }
            }
        }

        this.isTargetLocked = locked;
        const crosshair = document.getElementById('crosshair');
        if (crosshair) {
            if (locked) {
                crosshair.classList.add('target-locked');
            } else {
                crosshair.classList.remove('target-locked');
            }
            crosshair.classList.toggle('block-target', !locked && !!this.targetBlock);
        }
    }

    updateVehicleCamera() {
        if (!this.mountedVehicle) return;
        const v = this.mountedVehicle;
        const dist = 5.2;
        const camHeight = 2.0;
        const camPitch = Math.max(-0.6, Math.min(0.5, this.pitch));
        let camX = v.position.x + Math.sin(this.yaw) * Math.cos(camPitch) * dist;
        let camY = v.position.y + camHeight + Math.sin(-camPitch) * dist;
        let camZ = v.position.z + Math.cos(this.yaw) * Math.cos(camPitch) * dist;

        if (this.world) {
            const targetX = v.position.x;
            const targetY = v.position.y + 0.9;
            const targetZ = v.position.z;
            const steps = 8;
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const testX = targetX + (camX - targetX) * t;
                const testY = targetY + (camY - targetY) * t;
                const testZ = targetZ + (camZ - targetZ) * t;
                const b = this.world.getBlock(Math.floor(testX), Math.floor(testY), Math.floor(testZ));
                if (b !== 0 && b !== 19 && b !== 13) {
                    const safeT = Math.max(0.2, (i - 1) / steps);
                    camX = targetX + (camX - targetX) * safeT;
                    camY = targetY + (camY - targetY) * safeT;
                    camZ = targetZ + (camZ - targetZ) * safeT;
                    break;
                }
            }
        }

        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(v.position.x, v.position.y + 0.8, v.position.z);

        if (this.playerBodyGroup) {
            this.playerBodyGroup.position.copy(v.position);
            this.playerBodyGroup.position.y += 0.35;
            this.playerBodyGroup.rotation.y = v.yaw;
            this.playerBodyGroup.visible = true;
        }
        if (this.itemPivot) this.itemPivot.visible = false;
        if (this.handGroup) this.handGroup.visible = false;
    }

    mountVehicle(vehicle) {
        if (!vehicle) return;
        if (this.mountedVehicle) this.dismountVehicle();
        this.mountedVehicle = vehicle;
        vehicle.driver = this;
        this.isThirdPerson = true;
        this.yaw = vehicle.yaw;
        this.pitch = 0.15;
        if (this.playerBodyGroup) this.playerBodyGroup.visible = true;
        if (this.handGroup) this.handGroup.visible = false;
        if (this.itemPivot) this.itemPivot.visible = false;
        this.updateVehicleCamera();
        if (window.modManager) {
            window.modManager.showVehicleHud(vehicle);
            window.modManager.triggerEvent("onVehicleEnter", vehicle.id, this);
        }
        if (this.game.ui) this.game.ui.showToast("🚗 Ви сіли в авто! [WASD] Рух, [Space] Гальма, [H] Сигнал, [L] Фари, [E] Вийти");
    }

    dismountVehicle() {
        if (!this.mountedVehicle) return;
        const v = this.mountedVehicle;
        this.position.x = v.position.x + Math.sin(v.yaw + Math.PI / 2) * 1.8;
        this.position.y = v.position.y + 0.3;
        this.position.z = v.position.z + Math.cos(v.yaw + Math.PI / 2) * 1.8;
        v.driver = null;
        this.mountedVehicle = null;
        this.isThirdPerson = false;
        if (this.playerBodyGroup) this.playerBodyGroup.visible = false;
        if (this.handGroup) this.handGroup.visible = true;
        if (this.itemPivot) this.itemPivot.visible = true;
        if (window.modManager) {
            window.modManager.hideVehicleHud();
            window.modManager.triggerEvent("onVehicleExit", v.id, this);
        }
        if (this.game.ui) this.game.ui.showToast("Ви вийшли з авто");
    }

    getVehicle() {
        return this.mountedVehicle || null;
    }

    getVehicleId() {
        return this.mountedVehicle ? this.mountedVehicle.id : null;
    }

    isMounted() {
        return !!this.mountedVehicle;
    }

    setAiming(active) {
        const held = this.getSelectedItem();
        const reg = held && ITEM_REGISTRY[held.itemId];
        const arena = this.game?.arenaClient;
        const reloading = arena?.isActive ? !!arena.localState?.reloading : this.gunReload?.item === held;
        const allowed = !!reg?.isGun && !this.isDead && !this.isThirdPerson && !this.mountedVehicle && !reloading &&
            !this.game?.ui?.menuOpen && !this.game?.ui?.mainMenuOpen && !arena?.buyOpen;
        const aiming = !!active && allowed;
        if (aiming && !this.isAiming) this.aimBaseFov = this.camera?.fov || 72;
        this.isAiming = aiming;
        this.isScoped = aiming && reg?.gunType === 'awp';
        return !!reg?.isGun;
    }

    updateWeaponView(dt) {
        const time = Math.max(0, Math.min(dt || 0, .1));
        if (this.isAiming) this.setAiming(true);
        const blend = 1 - Math.exp(-16 * time);
        this.aimBlend = (this.aimBlend || 0) + ((this.isAiming ? 1 : 0) - (this.aimBlend || 0)) * blend;
        if (this.aimBaseFov && this.camera) {
            const target = this.isAiming ? (this.isScoped ? 28 : this.aimBaseFov * .78) : this.aimBaseFov;
            this.setFOV(this.camera.fov + (target - this.camera.fov) * blend);
            if (!this.isAiming && Math.abs(this.camera.fov - target) < .02) { this.setFOV(target); this.aimBaseFov = null; }
        }
        if (this.gunRecoilPitch > 0) {
            const recovery = this.gunRecoilPitch * (1 - Math.exp(-9 * time));
            this.pitch = Math.max(-Math.PI / 2.05, this.pitch - recovery);
            this.gunRecoilPitch -= recovery;
        }
        this.weaponKick = (this.weaponKick || 0) * Math.exp(-13 * time);
    }


    // --- Knife viewmodel: gloved hand + IK forearm, per-knife pickup / 3-hit combo / inspect clips, springy sway ---
    inspectKnife() {
        const held = this.getSelectedItem();
        if (!held || !ITEM_REGISTRY[held.itemId]?.isKnife || this.isDead || this.isThirdPerson) return false;
        if (this.knifeInspect > 0 || this.knifeDraw > 0.2 || this._kv?.atk) return false;
        this._knifeCrossfade();
        this.knifeInspect = 1;
        this.soundManager?.playClick?.();
        return true;
    }

    _knifeCrossfade(time = .1) {   // freeze the current pose and blend out of it, so cancelled clips never pop
        const st = this._kv;
        if (!st?.last) return;
        st.from = { ...st.last };
        for (const c of ['mx', 'my', 'mz']) st.from[c] = _wrapPi(st.from[c]);
        st.blend = 1; st.blendTime = time;
    }

    buildKnifeRig(type) {   // gloved fist on the handle + forearm sleeve with the player's skin
        const anim = KNIFE_ANIMS[type] || KNIFE_ANIMS.default, s = anim.pose.scale;
        this.knifeHand = createKnifeHandModel(type);
        this.knifeHand.scale.setScalar(s);
        this.itemPivot.add(this.knifeHand);
        if (!this.handGroup || typeof createMinecraftBoxGeometry !== 'function') return;
        const fa = new THREE.Group(); fa.name = 'knife_forearm';
        const geo = createMinecraftBoxGeometry(0.25, 0.75, 0.25, 40, 16, 4, 12, 4);
        geo.translate(0, .375, 0);
        const sleeve = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.armMat?.map || null, color: 0xffffff }));
        sleeve.scale.set(.38, 1, .38);
        fa.add(sleeve);
        const cuff = new THREE.Mesh(new THREE.BoxGeometry(.1, .06, .1), new THREE.MeshLambertMaterial({ color: KNIFE_GLOVE.dark }));
        cuff.position.y = .03;
        fa.add(cuff);
        fa.userData.sleeve = sleeve;
        this.handGroup.add(fa);
        this.knifeForearm = fa;
        if (!this._knifeTrail) this._knifeTrail = this.buildKnifeTrail();
    }

    buildKnifeTrail() {
        const N = 18, geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
        const idx = [];
        for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        geo.setIndex(idx);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 10; mesh.name = 'knife_trail';
        mesh.userData = { N, pts: [], tip: new THREE.Vector3(), mid: new THREE.Vector3() };
        this.handGroup?.add(mesh);
        return mesh;
    }

    disposeKnifeRig() {
        disposeHeldModel(this.knifeHand); this.knifeHand = null;
        disposeHeldModel(this.knifeForearm); this.knifeForearm = null;
        if (this._knifeTrail) { this._knifeTrail.userData.pts.length = 0; this._knifeTrail.visible = false; }
    }

    updateKnifeView(dt) {
        dt = Math.min(Math.max(+dt || 0, 0), .05);
        const anim = KNIFE_ANIMS[this._knifeType] || KNIFE_ANIMS.default, base = anim.pose;
        const st = this._kv || (this._kv = {
            prevSwing: 0, atk: null, combo: 0, sinceAtk: 9, blend: 0, from: null, last: null, time: 0,
            swX: { x: 0, v: 0 }, swY: { x: 0, v: 0 }, swR: { x: 0, v: 0 }, vy: { x: 0, v: 0 }, land: { x: 0, v: 0 },
            sprint: 0, block: 0, move: 0, lastYaw: this.yaw || 0, lastPitch: this.pitch || 0, wasGround: true, airVy: 0, drawSfx: false,
        });
        st.time += dt; st.sinceAtk += dt;

        // --- triggers: a fresh attack starts whenever armSwing jumps back up ---
        const sw = this.armSwing || 0;
        if (sw > st.prevSwing + .25) {
            if (st.atk || this.knifeInspect > 0) this._knifeCrossfade(st.atk ? .07 : .12);
            st.combo = st.sinceAtk > .75 ? 0 : (st.combo + 1) % anim.attacks.length;
            st.atk = { clip: anim.attacks[st.combo], t: 0, sfx: false };
            st.sinceAtk = 0;
            this.knifeSwingIdx = st.combo;
            this.knifeInspect = 0;
            if (this._knifeTrail) this._knifeTrail.userData.pts.length = 0;
        }
        st.prevSwing = sw;
        if (this.knifeDraw >= 1 && !st.drawSfx) { st.drawSfx = true; this.soundManager?.playKnifeDeploy?.(); }
        this.knifeDraw = Math.max(0, (this.knifeDraw || 0) - dt / anim.drawTime);
        if (this.knifeDraw <= 0) st.drawSfx = false;
        if (this.knifeInspect > 0) this.knifeInspect = Math.max(0, this.knifeInspect - dt / anim.inspectTime);

        // --- keyframed layers ---
        const o = {}; for (const c of KNIFE_CHANNELS) o[c] = 0;
        if (this.knifeDraw > 0) applyKnifeClip(anim.draw, (1 - this.knifeDraw) * anim.draw.dur, o);
        if (this.knifeInspect > 0) applyKnifeClip(anim.inspect, (1 - this.knifeInspect) * anim.inspect.dur, o);
        let trailOn = false;
        if (st.atk) {
            const a = st.atk, c = a.clip;
            a.t += dt;
            if (!a.sfx && a.t >= c.hit * c.dur) { a.sfx = true; this.soundManager?.playKnifeSwish?.(c.swish * (.94 + Math.random() * .12)); }
            trailOn = a.t >= c.trail[0] * c.dur && a.t <= c.trail[1] * c.dur;
            if (a.t >= c.dur) st.atk = null; else applyKnifeClip(c, a.t, o);
        }
        if (st.blend > 0) {
            st.blend = Math.max(0, st.blend - dt / st.blendTime);
            const w = _ease(st.blend);
            for (const c of KNIFE_CHANNELS) o[c] += (st.from[c] - o[c]) * w;
        }
        st.last = { ...o };

        // --- procedural layers (springs) ---
        const busy = Math.max(this.knifeInspect > 0 ? 1 : 0, this.knifeDraw > 0 ? this.knifeDraw : 0);
        const dYaw = _wrapPi((this.yaw || 0) - st.lastYaw), dPitch = (this.pitch || 0) - st.lastPitch;
        st.lastYaw = this.yaw || 0; st.lastPitch = this.pitch || 0;
        const inv = dt > 0 ? 1 / dt : 0;
        const yawRate = Math.max(-9, Math.min(9, dYaw * inv)), pitchRate = Math.max(-9, Math.min(9, dPitch * inv));
        const sx = _kSpring(st.swX, yawRate * .009, dt, 13, .5), sy = _kSpring(st.swY, -pitchRate * .008, dt, 13, .5);
        const sr = _kSpring(st.swR, yawRate * .035, dt, 10, .45);

        const v = this.velocity || { x: 0, y: 0, z: 0 };
        const yaw = this.yaw || 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // camera forward / right on the ground plane
        const side = v.x * -fz + v.z * fx;
        const speed = Math.hypot(v.x, v.z);
        st.move += (Math.min(1.3, this.onGround ? speed / 4.3 : 0) - st.move) * (1 - Math.exp(-8 * dt));
        const sprinting = this.isSprinting && this.onGround && !this.isAiming && !st.atk && !busy;
        st.sprint += ((sprinting ? 1 : 0) - st.sprint) * (1 - Math.exp(-9 * dt));
        st.block += ((this.isBlocking ? 1 : 0) - st.block) * (1 - Math.exp(-14 * dt));

        // jump / landing
        if (!this.onGround) st.airVy = v.y || 0;
        if (this.onGround && !st.wasGround) st.land.v -= Math.min(1.6, Math.max(0, -st.airVy) * .09);
        st.wasGround = !!this.onGround;
        const land = _kSpring(st.land, 0, dt, 16, .42);
        const air = _kSpring(st.vy, this.onGround ? 0 : Math.max(-.04, Math.min(.03, -(v.y || 0) * .004)), dt, 9, .7);

        const th = (this.walkCycle || 0) * .5, m = st.move * (1 - busy * .7), sp = st.sprint;
        const bobAmp = 1 + sp * .8;
        let px = base.px + o.px + sx + Math.sin(th) * .017 * m * bobAmp + sp * .045 - side * .004;
        let py = base.py + o.py + sy + (Math.cos(2 * th) - 1) * .009 * m * bobAmp + Math.sin(st.time * 1.7) * .0035 + air + land * .06 - sp * .06;
        let pz = base.pz + o.pz + sp * .03 + land * .02;
        let rx = base.rx + o.rx + sy * 2.2 + Math.sin(st.time * 1.7 + 1) * .008 - sp * .42 + land * .35 - air * 2;
        let ry = base.ry + o.ry + sx * 2.5 + sp * .25;
        let rz = base.rz + o.rz + sr + Math.sin(th) * .045 * m + Math.sin(st.time * 1.1) * .01 - side * .025 - sp * .2;
        if (st.block > .001) {   // guard: blade across the body
            const b = _ease(st.block);
            px += -.08 * b; py += .05 * b; pz += .03 * b; rx += .1 * b; ry += .55 * b; rz += 1.05 * b;
        }

        // --- apply ---
        const km = this.heldKnifeMesh;
        if (km) {
            km.rotation.set(o.mx, o.my, o.mz);
            const off = new THREE.Vector3();
            if (anim.pivot && (o.mx || o.my || o.mz)) {   // spin around a point (e.g. the karambit ring) instead of the handle
                const c = new THREE.Vector3(...anim.pivot);
                off.copy(c).sub(c.clone().applyEuler(km.rotation)).multiplyScalar(km.scale.x);
            }
            if (anim.mount) {   // how the knife sits in the fist (e.g. reverse grip), applied outside the spin
                const mq = anim._mountQ || (anim._mountQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...anim.mount.rot)));
                km.quaternion.premultiply(mq);
                off.applyQuaternion(mq).add(new THREE.Vector3(...anim.mount.pos).multiplyScalar(km.scale.x));
            }
            km.position.set(o.kx, o.ky, o.kz).add(off);
            const h = km.userData.halves;
            if (h) { h[0].rotation.x = o.hA; h[1].rotation.x = o.hB; }
        }
        const hand = this.knifeHand;
        if (hand) {
            const op = _clamp01(o.open);
            hand.userData.fingers.rotation.z = op * .95;
            hand.userData.thumb.rotation.z = -op * .7;
        }
        // rotation offsets are camera-space (pitch, yaw, roll) layered on top of the knife's rest orientation
        const bq = anim._baseQ || (anim._baseQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(base.rx, base.ry, base.rz)));
        const tq = st.tq || (st.tq = { e: new THREE.Euler(0, 0, 0, 'XYZ'), q: new THREE.Quaternion() });
        tq.e.set(rx - base.rx, ry - base.ry, rz - base.rz);
        this.itemPivot.position.set(px, py, pz);
        this.itemPivot.quaternion.setFromEuler(tq.e).multiply(bq);
        this.updateKnifeForearm(anim, base);
        this.updateKnifeTrail(trailOn, dt);
    }

    updateKnifeForearm(anim, base) {
        const fa = this.knifeForearm;
        if (!fa) return;
        const st = this._kv, s = base.scale;
        if (!st.rest || st.rest.type !== anim) {   // rest wrist / elbow for this knife's hold pose
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(base.rx, base.ry, base.rz));
            const wrist = new THREE.Vector3(...anim.wrist).multiplyScalar(s).applyQuaternion(q).add(new THREE.Vector3(base.px, base.py, base.pz));
            st.rest = { type: anim, wrist, elbow: wrist.clone().add(new THREE.Vector3(...anim.forearm).normalize().multiplyScalar(.5)) };
            st.tmp = { w: new THREE.Vector3(), e: new THREE.Vector3(), d: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
        }
        const t = st.tmp;
        this.itemPivot.updateMatrix();
        t.w.set(...anim.wrist).multiplyScalar(s).applyMatrix4(this.itemPivot.matrix);
        t.e.copy(t.w).sub(st.rest.wrist).multiplyScalar(.45).add(st.rest.elbow);   // the elbow follows the hand only partly
        t.d.copy(t.e).sub(t.w);
        const len = Math.max(.2, t.d.length());
        fa.position.copy(t.w);
        fa.quaternion.setFromUnitVectors(t.up, t.d.normalize());
        fa.userData.sleeve.scale.y = len * 1.8 / .75;   // runs past the elbow and off the screen
    }

    updateKnifeTrail(on, dt) {
        const tr = this._knifeTrail, km = this.heldKnifeMesh;
        if (!tr || !km || !this.handGroup) return;
        const u = tr.userData, pts = u.pts;
        for (const p of pts) p.age += dt;
        while (pts.length && pts[0].age > .11) pts.shift();
        if (on && km.userData.tip) {
            this.handGroup.updateMatrixWorld(true);
            const toHand = this.handGroup.matrixWorld.clone().invert();
            const a = km.localToWorld(u.tip.copy(km.userData.tip)).applyMatrix4(toHand);
            const b = km.localToWorld(u.mid.copy(km.userData.mid)).applyMatrix4(toHand);
            pts.push({ a: a.clone(), b: b.clone(), age: 0 });
            while (pts.length > u.N) pts.shift();
        }
        tr.visible = pts.length > 1;
        if (!tr.visible) return;
        const pos = tr.geometry.attributes.position, col = tr.geometry.attributes.color;
        const c = km.userData.trailColor || [1, 1, 1];
        for (let i = 0; i < u.N; i++) {
            const p = pts[Math.min(i, pts.length - 1)];
            const k = i < pts.length ? Math.max(0, 1 - p.age / .11) * (i + 1) / pts.length : 0;
            pos.setXYZ(i * 2, p.a.x, p.a.y, p.a.z); pos.setXYZ(i * 2 + 1, p.b.x, p.b.y, p.b.z);
            col.setXYZ(i * 2, c[0] * k * .55, c[1] * k * .55, c[2] * k * .55); col.setXYZ(i * 2 + 1, 0, 0, 0);
        }
        pos.needsUpdate = col.needsUpdate = true;
    }

    toggleScope() { this.setAiming(!this.isAiming); }

    tryThrowGrenade() {
        const item = this.getSelectedItem();
        if (!item) return false;
        const reg = ITEM_REGISTRY[item.itemId];
        if (!reg || !reg.isThrowable) return false;

        const wMgr = (window.modManager && window.modManager.weaponManager) || (this.game && this.game.modManager && this.game.modManager.weaponManager);
        if (wMgr && wMgr.throwGrenade) {
            wMgr.throwGrenade({
                damage: reg.attackDamage || 120,
                blastRadius: 4.2
            });
            if (!this.isCreative) {
                this.removeItem(item.itemId, 1);
            }
            if (this.game && this.game.ui) this.game.ui.showToast("💣 Гранату кинуто!");
            return true;
        }
        return false;
    }

    getGunSpec(reg) {
        return FIREARM_SPECS[reg.gunType] || {
            magazine: Math.max(1, reg.magazine || 20), reload: reg.reloadTime || 2200,
            fireDelay: reg.fireDelay || 150, automatic: reg.automatic !== false,
            damage: reg.attackDamage || 40, range: reg.range || 80,
            spread: 0.02, recoil: 0.035, pitch: 1,
        };
    }

    getGunState(now = performance.now()) {
        if (this.game?.arenaClient?.isActive) return null;
        this.updateGunReload(now);
        const item = this.getSelectedItem();
        const reg = item && ITEM_REGISTRY[item.itemId];
        if (!reg?.isGun) return null;
        const spec = this.getGunSpec(reg);
        // A newly acquired weapon loads its first magazine from real inventory ammunition.
        // The magazine travels with its inventory slot and survives saving/loading.
        if (!Number.isFinite(item.gunAmmo)) {
            item.gunAmmo = 0;
            if (!this.isCreative && reg.ammoType) {
                const loaded = Math.min(spec.magazine, this.getItemCount(reg.ammoType));
                item.gunAmmo = loaded;
                if (loaded) this.removeItem(reg.ammoType, loaded);
            }
            this.saveInventoryDebounced();
        }
        item.gunAmmo = Math.max(0, Math.min(spec.magazine, Math.floor(item.gunAmmo)));
        const reload = this.gunReload?.item === item ? this.gunReload : null;
        return {
            gunType: reg.gunType, automatic: spec.automatic, capacity: spec.magazine,
            ammo: this.isCreative ? spec.magazine : item.gunAmmo,
            reserve: this.isCreative ? Infinity : this.getItemCount(reg.ammoType),
            reloading: !!reload, reloadRemaining: reload ? Math.max(0, reload.until - now) / 1000 : 0,
        };
    }

    reloadGun(now = performance.now()) {
        if (this.game?.arenaClient?.isActive || this.isDead || this.isDuelLocked()) return false;
        const state = this.getGunState(now);
        if (!state || state.reloading || state.ammo >= state.capacity || state.reserve <= 0) return false;
        const item = this.getSelectedItem(), reg = ITEM_REGISTRY[item.itemId];
        const spec = this.getGunSpec(reg);
        this.gunReload = { item, reg, spec, until: now + spec.reload };
        this.game?.modManager?.soundSynth?.reload('mag_out');
        return true;
    }

    updateGunReload(now = performance.now()) {
        const reload = this.gunReload;
        if (!reload) return;
        if (this.game?.arenaClient?.isActive || this.isDead || this.getSelectedItem() !== reload.item) {
            this.gunReload = null;
            return;
        }
        if (now < reload.until) return;
        this.gunReload = null;
        const amount = Math.min(reload.spec.magazine - reload.item.gunAmmo, this.getItemCount(reload.reg.ammoType));
        if (amount > 0) {
            reload.item.gunAmmo += amount;
            this.removeItem(reload.reg.ammoType, amount);
            this.saveInventoryDebounced();
        }
        this.game?.modManager?.soundSynth?.reload('mag_in');
    }

    releaseGunTrigger() {
        this.gunTriggerHeld = false;
    }

    tryShootGun() {
        // Arena weapons use server magazines and damage, never sandbox inventory ammunition.
        if (this.game?.arenaClient?.isActive) return this.game.arenaClient.attack();
        const item = this.getSelectedItem();
        if (!item) return false;
        const reg = ITEM_REGISTRY[item.itemId];
        if (!reg?.isGun) return false;
        if (this.isDead || this.isDuelLocked()) return true;

        const now = performance.now(), spec = this.getGunSpec(reg);
        if (!spec.automatic && this.gunTriggerHeld) return true;
        this.gunTriggerHeld = true;
        const state = this.getGunState(now);
        if (state.reloading) return true;
        if (now - (this.lastGunShotTime ?? -Infinity) < spec.fireDelay) return true;
        if (state.ammo <= 0) {
            if (!this.reloadGun(now) && now - (this.lastDryFireTime ?? -Infinity) > 400) {
                this.lastDryFireTime = now;
                this.game?.soundManager?.playClick();
                const ammoReg = ITEM_REGISTRY[reg.ammoType];
                this.game?.ui?.showToast(`⚠️ Немає патронів! Потрібно: ${ammoReg ? ammoReg.name : reg.ammoType}`);
            }
            return true;
        }
        const manager = (window.modManager && window.modManager.weaponManager) || this.game?.modManager?.weaponManager;
        if (!manager || (reg.gunType === 'rpg' ? !manager.launchRocket : !manager.shoot)) return true;

        const interval = now - (this.lastGunShotTime ?? -Infinity);
        this.gunBurst = interval > 320 ? 0 : Math.min(8, (this.gunBurst || 0) + 1);
        this.lastGunShotTime = now;
        if (!this.isCreative) {
            item.gunAmmo--;
            this.saveInventoryDebounced();
        }
        this.weaponKick = Math.min(2, (this.weaponKick || 0) + Math.max(.4, spec.recoil * 14));
        if (reg.gunType === 'rpg') {
            manager.launchRocket({ damage: spec.damage, blastRadius: 4.8, speed: 36 });
            return true;
        }
        const speed = Math.hypot(this.velocity.x, this.velocity.z);
        const movement = Math.min(0.04, speed * 0.0025) + (this.onGround ? 0 : 0.025);
        const spread = (reg.gunType === 'awp' && this.isScoped ? 0.0005 : spec.spread * (this.isAiming ? .55 : 1))
            + movement + (spec.automatic ? this.gunBurst * 0.003 : 0);
        const result = manager.shoot({
            damage: spec.damage, range: spec.range, spread,
            recoilPitch: spec.recoil, recoilYaw: spec.recoil * 0.45,
            bulletCount: spec.bulletCount || 1, pitch: spec.pitch, volume: 0.95,
            shake: Math.min(0.5, 0.14 + spec.recoil * 3.2),
        });
        // Haptic thump on phones: heavier guns hit harder
        try { navigator.vibrate?.(Math.round(Math.min(70, 14 + spec.recoil * 380))); } catch (e) {}
        if (result?.hit && result.type !== 'block') {
            this.gunHitUntil = now + 150;
            this.gunHitType = result.type;
        }
        return true;
    }

    setFOV(fov) {
        if (this.camera && typeof fov === 'number' && fov >= 15 && fov <= 140) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }

    getFOV() {
        return this.camera ? this.camera.fov : 72;
    }
}

window.Player = Player;

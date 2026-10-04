#!/usr/bin/env python3
"""
Eblankraft Master Asset Exporter
Generates and exports:
1. ALL TEXTURES (Blocks, Items, Armor, Skins, UI, Mobs, Atlas) -> PNG
2. ALL SOUNDS (Blocks, Combat, Entities, Environment, Player, UI) -> WAV
3. ALL 3D MODELS (Player, Armor, Mobs, Weapons, Vehicle, Blocks) -> OBJ + MTL & GLB
"""

import os
import sys
import json
import math
import struct
import random
import shutil
import wave
import subprocess
from PIL import Image

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, "ALL_ASSETS")

# Subdirectories
TEX_DIR = os.path.join(ASSETS_DIR, "TEXTURES")
SND_DIR = os.path.join(ASSETS_DIR, "SOUNDS")
MDL_DIR = os.path.join(ASSETS_DIR, "MODELS")

def ensure_dirs():
    dirs = [
        ASSETS_DIR,
        os.path.join(TEX_DIR, "blocks"),
        os.path.join(TEX_DIR, "items"),
        os.path.join(TEX_DIR, "armor"),
        os.path.join(TEX_DIR, "skins"),
        os.path.join(TEX_DIR, "mobs"),
        os.path.join(TEX_DIR, "ui"),
        os.path.join(TEX_DIR, "all_textures"),
        os.path.join(SND_DIR, "blocks"),
        os.path.join(SND_DIR, "combat"),
        os.path.join(SND_DIR, "entities"),
        os.path.join(SND_DIR, "environment"),
        os.path.join(SND_DIR, "player"),
        os.path.join(SND_DIR, "ui"),
        os.path.join(SND_DIR, "all_sounds"),
        os.path.join(MDL_DIR, "obj"),
        os.path.join(MDL_DIR, "glb"),
        os.path.join(MDL_DIR, "all_models"),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

# ==============================================================================
# 1. TEXTURE EXTRACTION & EXPORT
# ==============================================================================
def extract_textures():
    print("=== [1/3] Extracting and Exporting ALL TEXTURES ===")
    node_script = """
const fs = require('fs');

class MockContext {
    constructor(w, h) {
        this.width = w; this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
        this._fill = '#000000'; this._stroke = '#000000';
    }
    set fillStyle(v) { this._fill = v; }
    get fillStyle() { return this._fill; }
    set strokeStyle(v) { this._stroke = v; }
    get strokeStyle() { return this._stroke; }
    set lineWidth(v) { this._lw = v; }
    get lineWidth() { return this._lw || 1; }
    _parseColor(c) {
        if (typeof c !== 'string') return [0, 0, 0, 255];
        if (c.startsWith('#')) {
            let hex = c.slice(1);
            if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
            const num = parseInt(hex, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
        } else if (c.startsWith('rgb')) {
            const m = c.match(/[\\d.]+/g);
            if (m) return [parseInt(m[0]), parseInt(m[1]), parseInt(m[2]), m[3] ? Math.floor(parseFloat(m[3]) * 255) : 255];
        }
        return [0, 0, 0, 255];
    }
    clearRect(x, y, w, h) {
        for (let py = y; py < y + h; py++) {
            if (py < 0 || py >= this.height) continue;
            for (let px = x; px < x + w; px++) {
                if (px < 0 || px >= this.width) continue;
                const idx = (py * this.width + px) * 4;
                this.data[idx] = 0; this.data[idx+1] = 0; this.data[idx+2] = 0; this.data[idx+3] = 0;
            }
        }
    }
    fillRect(x, y, w, h) {
        x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
        const [r, g, b, a] = this._parseColor(this._fill);
        for (let py = y; py < y + h; py++) {
            if (py < 0 || py >= this.height) continue;
            for (let px = x; px < x + w; px++) {
                if (px < 0 || px >= this.width) continue;
                const idx = (py * this.width + px) * 4;
                this.data[idx] = r; this.data[idx+1] = g; this.data[idx+2] = b; this.data[idx+3] = a;
            }
        }
    }
    strokeRect(x, y, w, h) {
        this.fillRect(x, y, w, 1);
        this.fillRect(x, y + h - 1, w, 1);
        this.fillRect(x, y, 1, h);
        this.fillRect(x + w - 1, y, 1, h);
    }
    drawImage(img, dx, dy) {
        if (!img || !img._ctx) return;
        const src = img._ctx.data;
        for (let y = 0; y < img.height; y++) {
            const ty = dy + y;
            if (ty < 0 || ty >= this.height) continue;
            for (let x = 0; x < img.width; x++) {
                const tx = dx + x;
                if (tx < 0 || tx >= this.width) continue;
                const sIdx = (y * img.width + x) * 4;
                const dIdx = (ty * this.width + tx) * 4;
                this.data[dIdx] = src[sIdx];
                this.data[dIdx+1] = src[sIdx+1];
                this.data[dIdx+2] = src[sIdx+2];
                this.data[dIdx+3] = src[sIdx+3];
            }
        }
    }
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(this.data) }; }
    putImageData(imgData, x, y) { this.data.set(imgData.data); }
    beginPath() { this._path = []; }
    moveTo(x, y) { this._path = [{x, y}]; }
    lineTo(x, y) { if (!this._path) this._path = []; this._path.push({x, y}); }
    stroke() {
        if (!this._path) return;
        const [r, g, b, a] = this._parseColor(this._stroke);
        for (let i = 0; i < this._path.length; i++) {
            const p = this._path[i];
            const px = Math.floor(p.x);
            const py = Math.floor(p.y);
            if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                const idx = (py * this.width + px) * 4;
                this.data[idx] = r; this.data[idx+1] = g; this.data[idx+2] = b; this.data[idx+3] = a;
            }
        }
    }
    arc(cx, cy, r, sa, ea) { this._arc = { cx, cy, r }; }
    fill() {
        if (this._arc) {
            const { cx, cy, r } = this._arc;
            const [cr, cg, cb, ca] = this._parseColor(this._fill);
            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) {
                    if (x*x + y*y <= r*r) {
                        const px = Math.floor(cx + x);
                        const py = Math.floor(cy + y);
                        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                            const idx = (py * this.width + px) * 4;
                            this.data[idx] = cr; this.data[idx+1] = cg; this.data[idx+2] = cb; this.data[idx+3] = ca;
                        }
                    }
                }
            }
            this._arc = null;
        }
    }
}

class MockCanvas {
    constructor(w = 16, h = 16) {
        this._w = w; this._h = h;
        this._ctx = new MockContext(w, h);
    }
    get width() { return this._w; }
    set width(v) {
        this._w = v;
        if (this._ctx && (this._ctx.width !== this._w || this._ctx.height !== this._h)) {
            this._ctx = new MockContext(this._w, this._h);
        }
    }
    get height() { return this._h; }
    set height(v) {
        this._h = v;
        if (this._ctx && (this._ctx.width !== this._w || this._ctx.height !== this._h)) {
            this._ctx = new MockContext(this._w, this._h);
        }
    }
    getContext() { return this._ctx; }
}

global.document = {
    createElement(t) { return new MockCanvas(16, 16); }
};
global.window = global;
global.THREE = {
    CanvasTexture: function(c) { this.image = c; },
    NearestFilter: 1, RepeatWrapping: 1, BoxGeometry: function() {},
    MeshLambertMaterial: function() { this.userData = {}; },
    MeshBasicMaterial: function() { this.userData = {}; },
    MeshPhongMaterial: function() { this.userData = {}; },
    MeshStandardMaterial: function() { this.userData = {}; },
    Color: function() {}, Vector3: function() {}, Vector2: function() {}
};

eval(fs.readFileSync('competitive/js/items.js', 'utf8'));
eval(fs.readFileSync('competitive/js/textures.js', 'utf8'));
eval(fs.readFileSync('competitive/js/upgrader_skins.js', 'utf8'));

const tm = new TextureManager();
const sm = new MinecraftSkinManager();

const out = {};
for (const [k, cv] of Object.entries(tm.canvasCache)) {
    if (cv && cv._ctx) {
        out['tex_' + k] = {
            name: k,
            width: cv.width,
            height: cv.height,
            data: Buffer.from(cv._ctx.data).toString('base64')
        };
    }
}

const skinIds = ['classic', 'alex', 'gopnik', 'rich', 'cyber', 'demon', 'military', 'eblan', 'ukraine', 'popcat', 'gigachad'];
for (const sid of skinIds) {
    const cv = sm.createProceduralSkinCanvas(sid);
    if (cv && cv._ctx) {
        out['skin_' + sid] = {
            name: sid,
            width: cv.width,
            height: cv.height,
            data: Buffer.from(cv._ctx.data).toString('base64')
        };
    }
}

fs.writeFileSync('/tmp/eblan_extracted_textures.json', JSON.stringify(out));
"""
    subprocess.run(["node", "-e", node_script], check=True, cwd=BASE_DIR)

    with open('/tmp/eblan_extracted_textures.json', 'r') as f:
        textures_data = json.load(f)

    # Classification categories
    armor_keys = {
        'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots',
        'netherite_chestplate', 'iron_chestplate'
    }

    ui_keys = {
        'crack_0', 'crack_1', 'crack_2', 'crack_3', 'crack_4'
    }

    item_keys = {
        'diamond_sword', 'iron_sword', 'stone_sword', 'wood_sword', 'eblan_sword',
        'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wood_pickaxe', 'netherite_pickaxe', 'eblan_pickaxe',
        'apple', 'cooked_steak', 'bread', 'raw_meat', 'shawarma', 'beer', 'vodka',
        'totem_of_undying', 'ak47', 'm4a1', 'awp', 'shotgun', 'deagle', 'glock', 'mp5', 'rpg', 'grenade',
        'ammo_pistol', 'ammo_rifle', 'ammo_sniper', 'ammo_shotgun', 'ammo_rocket',
        'coal', 'iron_ingot', 'gold_ingot', 'diamond_item', 'emerald', 'blaze_rod', 'ender_eye', 'gunpowder',
        'string', 'bone', 'slimeball', 'junk_sock', 'junk_cig', 'junk_beer', 'junk_nut', 'junk_token',
        'case_hobo', 'case_nether', 'case_diamond', 'case_dragon', 'meme_doner', 'bicycle',
        'car_sport', 'car_truck', 'car_police', 'car_f1', 'car_cyber', 'lever', 'shield'
    }

    count = 0
    tile_images = []

    import base64
    for tag, info in textures_data.items():
        w = info['width']
        h = info['height']
        raw = base64.b64decode(info['data'])
        img = Image.frombytes('RGBA', (w, h), raw)

        name = info['name']
        if tag.startswith('skin_'):
            dest_cat = "skins"
            filename = f"skin_{name}.png"
        elif name in armor_keys:
            dest_cat = "armor"
            filename = f"{name}.png"
        elif name in ui_keys:
            dest_cat = "ui"
            filename = f"{name}.png"
        elif name in item_keys:
            dest_cat = "items"
            filename = f"{name}.png"
        else:
            dest_cat = "blocks"
            filename = f"{name}.png"

        # Save to category dir
        cat_path = os.path.join(TEX_DIR, dest_cat, filename)
        img.save(cat_path)

        # Save copy to all_textures flat dir
        flat_path = os.path.join(TEX_DIR, "all_textures", filename)
        img.save(flat_path)

        count += 1
        if dest_cat in ["blocks", "items"] and w == 16 and h == 16:
            tile_images.append((name, img))

    # Copy external asset images if found
    extra_sources = [
        ("competitive/textures/waternormals.jpg", os.path.join(TEX_DIR, "mobs", "waternormals.jpg")),
        ("competitive/assets/icon-512.png", os.path.join(TEX_DIR, "ui", "icon-512.png")),
        ("competitive/assets/icon-192.png", os.path.join(TEX_DIR, "ui", "icon-192.png")),
        ("packs/ak47/textures/ak47.png", os.path.join(TEX_DIR, "items", "ak47_texture.png")),
        ("packs/ak47/textures/ak47_ammo.png", os.path.join(TEX_DIR, "items", "ak47_ammo_texture.png")),
        ("blockly/vendor/media/sprites.png", os.path.join(TEX_DIR, "ui", "sprites.png")),
    ]
    for src_rel, dst_path in extra_sources:
        src = os.path.join(BASE_DIR, src_rel)
        if os.path.exists(src):
            shutil.copy2(src, dst_path)
            shutil.copy2(src, os.path.join(TEX_DIR, "all_textures", os.path.basename(dst_path)))
            count += 1

    # Build Master Texture Atlas (512x512 = 32x32 tiles of 16x16)
    atlas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    for idx, (tname, timg) in enumerate(tile_images[:1024]):
        col = (idx % 32) * 16
        row = (idx // 32) * 16
        atlas.paste(timg, (col, row))
    atlas.save(os.path.join(TEX_DIR, "atlas.png"))
    atlas.save(os.path.join(TEX_DIR, "all_textures", "atlas.png"))

    print(f"✓ Total Textures & Skins Exported: {count} PNGs + atlas.png")


# ==============================================================================
# 2. AUDIO SYNTHESIS & EXPORT
# ==============================================================================
class AudioSynth:
    def __init__(self, sample_rate=44100):
        self.sr = sample_rate

    def write_wav(self, path, samples):
        with wave.open(path, 'w') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(self.sr)
            # Clip and pack
            frames = bytearray()
            for s in samples:
                val = max(-1.0, min(1.0, s))
                ival = int(val * 32767)
                frames.extend(struct.pack('<h', ival))
            w.writeframes(frames)

    def lowpass(self, samples, cutoff):
        dt = 1.0 / self.sr
        rc = 1.0 / (2.0 * math.pi * cutoff)
        alpha = dt / (rc + dt)
        out = [0.0] * len(samples)
        last = 0.0
        for i, s in enumerate(samples):
            last = last + alpha * (s - last)
            out[i] = last
        return out

    def bandpass(self, samples, center_freq, bw=200):
        low = self.lowpass(samples, center_freq + bw/2)
        alpha = 0.85
        out = [0.0] * len(low)
        last_in = 0.0
        last_out = 0.0
        for i, s in enumerate(low):
            last_out = alpha * (last_out + s - last_in)
            last_in = s
            out[i] = last_out
        return out

    def make_break(self, base_freq=800, click_start=150, dur=0.15):
        n = int(dur * self.sr)
        noise = [random.uniform(-1, 1) * math.exp(-t / (dur * 0.4)) for t in [i / self.sr for i in range(n)]]
        filtered = self.lowpass(noise, base_freq)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = click_start * (1.0 - t / dur) + 30
            click = math.sin(2 * math.pi * f * t) * math.exp(-t * 25) * 0.4
            samples.append(filtered[i] * 0.7 + click)
        return samples

    def make_place(self, start_f=220, end_f=60, dur=0.11):
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = start_f * (1.0 - t / dur) + end_f
            env = math.exp(-t * 28)
            s = math.sin(2 * math.pi * f * t) * env * 0.6
            samples.append(s)
        return samples

    def make_step(self):
        dur = 0.07
        n = int(dur * self.sr)
        noise = [random.uniform(-1, 1) * math.exp(-i / (self.sr * 0.02)) for i in range(n)]
        return self.bandpass(noise, 700, 300)

    def make_jump(self):
        dur = 0.16
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 140 + (360 - 140) * (t / dur)
            env = math.exp(-t * 12)
            samples.append(math.sin(2 * math.pi * f * t) * env * 0.5)
        return samples

    def make_hurt(self):
        dur = 0.22
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 200 * math.exp(-t * 8) + 65
            tri = 2.0 * abs(2.0 * ((f * t) % 1.0) - 1.0) - 1.0
            punch = random.uniform(-1, 1) * math.exp(-t * 40) * 0.3
            env = math.exp(-t * 14)
            samples.append((tri * 0.6 + punch) * env)
        return samples

    def make_crit(self):
        dur = 0.35
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            env = math.exp(-t * 10)
            chime = (math.sin(2 * math.pi * 440 * t) +
                     0.7 * math.sin(2 * math.pi * 880 * t) +
                     0.5 * math.sin(2 * math.pi * 1320 * t) +
                     0.3 * math.sin(2 * math.pi * 1760 * t)) * 0.25 * env
            samples.append(chime)
        return samples

    def make_strong_hit(self):
        dur = 0.25
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 120 * math.exp(-t * 12) + 40
            bass = math.sin(2 * math.pi * f * t) * math.exp(-t * 10) * 0.7
            crack = random.uniform(-1, 1) * math.exp(-t * 35) * 0.4
            samples.append(bass + crack)
        return samples

    def make_parry(self):
        dur = 0.45
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            env = math.exp(-t * 8)
            bell = (math.sin(2 * math.pi * 1200 * t) * 0.5 +
                    math.sin(2 * math.pi * 2400 * t) * 0.35 +
                    math.sin(2 * math.pi * 3600 * t) * 0.15) * env
            samples.append(bell)
        return samples

    def make_shield_block(self):
        dur = 0.22
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 160 * math.exp(-t * 15) + 50
            thud = math.sin(2 * math.pi * f * t) * math.exp(-t * 15) * 0.6
            clack = random.uniform(-1, 1) * math.exp(-t * 45) * 0.3
            samples.append(thud + clack)
        return samples

    def make_whiff(self):
        dur = 0.18
        n = int(dur * self.sr)
        noise = [random.uniform(-1, 1) * math.sin(math.pi * i / n) for i in range(n)]
        return self.bandpass(noise, 650, 400)

    def make_dodge_roll(self):
        dur = 0.28
        n = int(dur * self.sr)
        noise = [random.uniform(-1, 1) * math.sin(math.pi * i / n) * 0.7 for i in range(n)]
        return self.lowpass(noise, 500)

    def make_explosion(self):
        dur = 1.2
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 85 * math.exp(-t * 3) + 20
            bass = math.sin(2 * math.pi * f * t) * math.exp(-t * 2.5) * 0.6
            noise = random.uniform(-1, 1) * math.exp(-t * 3.5) * 0.5
            dist = math.tanh(bass + noise)
            samples.append(dist * 0.8)
        return samples

    def make_fuse(self):
        dur = 2.2
        n = int(dur * self.sr)
        noise = [random.uniform(-1, 1) * (0.15 + 0.25 * (i / n)) for i in range(n)]
        return self.bandpass(noise, 3200, 800)

    def make_click(self):
        dur = 0.03
        n = int(dur * self.sr)
        return [math.sin(2 * math.pi * 1000 * (i / self.sr)) * math.exp(-i / (self.sr * 0.005)) * 0.4 for i in range(n)]

    def make_lever_click(self):
        dur = 0.06
        n = int(dur * self.sr)
        s1 = [math.sin(2 * math.pi * 750 * (i / self.sr)) * math.exp(-i / (self.sr * 0.008)) * 0.35 for i in range(n)]
        return s1

    def make_eat(self):
        dur = 0.4
        n = int(dur * self.sr)
        samples = [0.0] * n
        for bite in range(4):
            offset = int(bite * 0.09 * self.sr)
            for j in range(int(0.04 * self.sr)):
                if offset + j < n:
                    samples[offset + j] += random.uniform(-1, 1) * math.exp(-j / (self.sr * 0.008)) * 0.35
        return self.bandpass(samples, 1100, 500)

    def make_splash(self):
        dur = 0.45
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            bubble = math.sin(2 * math.pi * 180 * math.exp(-t * 6) * t) * math.exp(-t * 6) * 0.4
            noise = random.uniform(-1, 1) * math.exp(-t * 8) * 0.4
            samples.append(bubble + noise)
        return samples

    def make_swim(self):
        dur = 0.25
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            s = math.sin(2 * math.pi * 120 * t) * math.exp(-t * 8) * 0.3
            noise = random.uniform(-1, 1) * math.exp(-t * 12) * 0.2
            samples.append(s + noise)
        return samples

    def make_sizzle(self):
        dur = 0.6
        n = int(dur * self.sr)
        noise = [random.uniform(-1, 1) * math.exp(-i / (self.sr * 0.2)) for i in range(n)]
        return self.bandpass(noise, 3800, 1000)

    def make_lava_pop(self):
        dur = 0.18
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 80 + 200 * math.sin(math.pi * t / dur)
            s = math.sin(2 * math.pi * f * t) * math.exp(-t * 14) * 0.5
            samples.append(s)
        return samples

    def make_villager_hrmm(self):
        dur = 0.38
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 135 - 15 * (t / dur)
            saw = 2.0 * ((f * t) % 1.0) - 1.0
            formant = math.sin(2 * math.pi * 680 * t) * 0.4
            env = math.sin(math.pi * (t / dur)) * 0.5
            samples.append((saw * 0.6 + formant) * env)
        return samples

    def make_zombie_groan(self):
        dur = 0.75
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 75 - 18 * (t / dur) + 4 * math.sin(2 * math.pi * 5 * t)
            saw = 2.0 * ((f * t) % 1.0) - 1.0
            env = math.sin(math.pi * (t / dur)) * 0.6
            samples.append(saw * env)
        return samples

    def make_creeper_hiss(self):
        dur = 1.4
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            env = 0.1 + 0.6 * (t / dur) ** 2
            samples.append(random.uniform(-1, 1) * env)
        return self.bandpass(samples, 3500, 1200)

    def make_dragon_roar(self):
        dur = 1.1
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f = 55 - 15 * (t / dur)
            saw = 2.0 * ((f * t) % 1.0) - 1.0
            noise = random.uniform(-1, 1) * 0.6
            env = math.sin(math.pi * (t / dur)) * 0.8
            dist = math.tanh((saw + noise) * 1.5)
            samples.append(dist * env)
        return samples

    def make_portal_warp(self):
        dur = 1.6
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            f1 = 90 + 25 * math.sin(2 * math.pi * 0.8 * t)
            f2 = 180 + 35 * math.cos(2 * math.pi * 1.2 * t)
            drone = (math.sin(2 * math.pi * f1 * t) + 0.6 * math.sin(2 * math.pi * f2 * t)) * 0.35
            env = math.sin(math.pi * (t / dur))
            samples.append(drone * env)
        return samples

    def make_totem_activate(self):
        dur = 1.8
        n = int(dur * self.sr)
        samples = []
        notes = [523.25, 659.25, 783.99, 1046.50]
        for i in range(n):
            t = i / self.sr
            val = 0.0
            for k, freq in enumerate(notes):
                delay = k * 0.12
                if t >= delay:
                    lt = t - delay
                    env = math.exp(-lt * 2.8)
                    val += math.sin(2 * math.pi * freq * lt) * env * 0.25
            samples.append(val)
        return samples

    def make_thunder(self):
        dur = 2.0
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            crack = random.uniform(-1, 1) * math.exp(-t * 12) * 0.8
            rumble = random.uniform(-1, 1) * math.exp(-t * 1.5) * 0.5
            dist = math.tanh((crack + rumble) * 2.0)
            samples.append(dist * 0.7)
        return self.lowpass(samples, 600)

    def make_pc_startup(self):
        dur = 0.8
        n = int(dur * self.sr)
        samples = []
        for i in range(n):
            t = i / self.sr
            s = 0.0
            if 0.05 <= t < 0.25:
                s = math.sin(2 * math.pi * 880 * t) * 0.35
            elif 0.30 <= t < 0.65:
                s = (math.sin(2 * math.pi * 587.33 * t) + math.sin(2 * math.pi * 880 * t)) * 0.25
            samples.append(s)
        return samples

    def make_win_fanfare(self):
        dur = 1.5
        n = int(dur * self.sr)
        samples = [0.0] * n
        chords = [(0.0, 0.25, 392.0), (0.25, 0.5, 523.25), (0.5, 0.75, 659.25), (0.75, 1.45, 783.99)]
        for start, end, freq in chords:
            s_idx = int(start * self.sr)
            e_idx = int(end * self.sr)
            for i in range(s_idx, min(n, e_idx)):
                lt = (i - s_idx) / self.sr
                env = math.exp(-lt * 2.5) if (end - start > 0.5) else 0.8
                sq = 1.0 if math.sin(2 * math.pi * freq * lt) > 0 else -1.0
                samples[i] += sq * env * 0.25
        return self.lowpass(samples, 2000)

    def make_super_eblan_fanfare(self):
        dur = 2.2
        n = int(dur * self.sr)
        samples = [0.0] * n
        notes = [(0.0, 0.2, 440), (0.2, 0.4, 554.37), (0.4, 0.6, 659.25), (0.6, 1.8, 880)]
        for start, end, freq in notes:
            s_idx = int(start * self.sr)
            e_idx = int(end * self.sr)
            for i in range(s_idx, min(n, e_idx)):
                lt = (i - s_idx) / self.sr
                env = math.exp(-lt * 1.8) if (end - start > 0.5) else 0.75
                tone = math.sin(2 * math.pi * freq * lt) + 0.5 * math.sin(2 * math.pi * freq * 2 * lt)
                samples[i] += tone * env * 0.25
        return samples

def export_sounds():
    print("=== [2/3] Synthesizing and Exporting ALL SOUNDS ===")
    synth = AudioSynth()

    sound_map = {
        # Blocks
        ("blocks", "break_stone.wav"): synth.make_break(800, 150),
        ("blocks", "break_wood.wav"): synth.make_break(600, 100),
        ("blocks", "break_grass.wav"): synth.make_break(1200, 200),
        ("blocks", "break_glass.wav"): synth.make_break(2500, 800),
        ("blocks", "break_snow.wav"): synth.make_break(950, 90),
        ("blocks", "place_stone.wav"): synth.make_place(220, 60),
        ("blocks", "place_wood.wav"): synth.make_place(180, 60),
        ("blocks", "place_grass.wav"): synth.make_place(320, 70),

        # Combat
        ("combat", "hurt.wav"): synth.make_hurt(),
        ("combat", "crit_hit.wav"): synth.make_crit(),
        ("combat", "strong_hit.wav"): synth.make_strong_hit(),
        ("combat", "finisher_hit.wav"): synth.make_parry(),
        ("combat", "parry.wav"): synth.make_parry(),
        ("combat", "shield_block.wav"): synth.make_shield_block(),
        ("combat", "whiff.wav"): synth.make_whiff(),
        ("combat", "dodge_roll.wav"): synth.make_dodge_roll(),

        # Entities
        ("entities", "villager_hrmm.wav"): synth.make_villager_hrmm(),
        ("entities", "zombie_groan.wav"): synth.make_zombie_groan(),
        ("entities", "creeper_hiss.wav"): synth.make_creeper_hiss(),
        ("entities", "dragon_roar.wav"): synth.make_dragon_roar(),

        # Environment
        ("environment", "explosion.wav"): synth.make_explosion(),
        ("environment", "tnt_fuse.wav"): synth.make_fuse(),
        ("environment", "thunder.wav"): synth.make_thunder(),
        ("environment", "portal_warp.wav"): synth.make_portal_warp(),
        ("environment", "splash.wav"): synth.make_splash(),
        ("environment", "swim.wav"): synth.make_swim(),
        ("environment", "sizzle.wav"): synth.make_sizzle(),
        ("environment", "lava_pop.wav"): synth.make_lava_pop(),

        # Player
        ("player", "step.wav"): synth.make_step(),
        ("player", "jump.wav"): synth.make_jump(),
        ("player", "eat.wav"): synth.make_eat(),

        # UI & Music
        ("ui", "click.wav"): synth.make_click(),
        ("ui", "lever_click.wav"): synth.make_lever_click(),
        ("ui", "totem_activate.wav"): synth.make_totem_activate(),
        ("ui", "pc_startup.wav"): synth.make_pc_startup(),
        ("ui", "win_fanfare.wav"): synth.make_win_fanfare(),
        ("ui", "super_eblan_fanfare.wav"): synth.make_super_eblan_fanfare(),
    }

    count = 0
    for (category, filename), samples in sound_map.items():
        cat_file = os.path.join(SND_DIR, category, filename)
        flat_file = os.path.join(SND_DIR, "all_sounds", filename)
        synth.write_wav(cat_file, samples)
        synth.write_wav(flat_file, samples)
        count += 1

    # Copy external mp3s
    mp3_sources = [
        ("competitive/blockly/vendor/media/click.mp3", os.path.join(SND_DIR, "ui", "blockly_click.mp3")),
        ("competitive/blockly/vendor/media/delete.mp3", os.path.join(SND_DIR, "ui", "blockly_delete.mp3")),
        ("competitive/blockly/vendor/media/disconnect.mp3", os.path.join(SND_DIR, "ui", "blockly_disconnect.mp3")),
    ]
    for src_rel, dst_path in mp3_sources:
        src = os.path.join(BASE_DIR, src_rel)
        if os.path.exists(src):
            shutil.copy2(src, dst_path)
            shutil.copy2(src, os.path.join(SND_DIR, "all_sounds", os.path.basename(dst_path)))
            count += 1

    print(f"✓ Total Sounds Exported: {count} Audio Files (WAV / MP3)")


# ==============================================================================
# 3. 3D MODEL GENERATION & EXPORT (.OBJ + .MTL)
# ==============================================================================
class ModelBuilder:
    def __init__(self, name):
        self.name = name
        self.vertices = []
        self.normals = []
        self.faces = []
        self.materials = {}

    def define_material(self, mat_name, r, g, b):
        self.materials[mat_name] = (r, g, b)

    def add_box(self, x0, y0, z0, x1, y1, z1, mat_name):
        if mat_name not in self.materials:
            self.define_material(mat_name, 0.7, 0.7, 0.7)

        base_v = len(self.vertices) + 1
        corners = [
            (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
            (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
        ]
        self.vertices.extend(corners)

        base_vn = len(self.normals) + 1
        norms = [
            (0, 0, 1),
            (0, 0, -1),
            (0, 1, 0),
            (0, -1, 0),
            (1, 0, 0),
            (-1, 0, 0),
        ]
        self.normals.extend(norms)

        f_idx = base_vn + 0
        self.faces.append((mat_name, [(base_v+4, f_idx), (base_v+5, f_idx), (base_v+6, f_idx)]))
        self.faces.append((mat_name, [(base_v+4, f_idx), (base_v+6, f_idx), (base_v+7, f_idx)]))

        b_idx = base_vn + 1
        self.faces.append((mat_name, [(base_v+1, b_idx), (base_v+0, b_idx), (base_v+3, b_idx)]))
        self.faces.append((mat_name, [(base_v+1, b_idx), (base_v+3, b_idx), (base_v+2, b_idx)]))

        t_idx = base_vn + 2
        self.faces.append((mat_name, [(base_v+3, t_idx), (base_v+2, t_idx), (base_v+6, t_idx)]))
        self.faces.append((mat_name, [(base_v+3, t_idx), (base_v+6, t_idx), (base_v+7, t_idx)]))

        dn_idx = base_vn + 3
        self.faces.append((mat_name, [(base_v+0, dn_idx), (base_v+1, dn_idx), (base_v+5, dn_idx)]))
        self.faces.append((mat_name, [(base_v+0, dn_idx), (base_v+5, dn_idx), (base_v+4, dn_idx)]))

        r_idx = base_vn + 4
        self.faces.append((mat_name, [(base_v+5, r_idx), (base_v+1, r_idx), (base_v+2, r_idx)]))
        self.faces.append((mat_name, [(base_v+5, r_idx), (base_v+2, r_idx), (base_v+6, r_idx)]))

        l_idx = base_vn + 5
        self.faces.append((mat_name, [(base_v+0, l_idx), (base_v+4, l_idx), (base_v+7, l_idx)]))
        self.faces.append((mat_name, [(base_v+0, l_idx), (base_v+7, l_idx), (base_v+3, l_idx)]))

    def save(self, out_dir):
        obj_file = os.path.join(out_dir, f"{self.name}.obj")
        mtl_file = os.path.join(out_dir, f"{self.name}.mtl")

        with open(mtl_file, "w") as m:
            m.write(f"# Materials for {self.name}\n")
            for mname, (r, g, b) in self.materials.items():
                m.write(f"newmtl {mname}\n")
                m.write(f"Ka {r*0.3:.3f} {g*0.3:.3f} {b*0.3:.3f}\n")
                m.write(f"Kd {r:.3f} {g:.3f} {b:.3f}\n")
                m.write(f"Ks 0.2 0.2 0.2\n")
                m.write(f"Ns 10.0\n")
                m.write(f"d 1.0\n")
                m.write("illum 2\n\n")

        with open(obj_file, "w") as o:
            o.write(f"# Wavefront OBJ: {self.name} (Eblankraft 3.0 Model)\n")
            o.write(f"mtllib {self.name}.mtl\n\n")

            for x, y, z in self.vertices:
                o.write(f"v {x:.4f} {y:.4f} {z:.4f}\n")
            o.write("\n")

            for nx, ny, nz in self.normals:
                o.write(f"vn {nx:.4f} {ny:.4f} {nz:.4f}\n")
            o.write("\n")

            cur_mat = None
            for mat, tri in self.faces:
                if mat != cur_mat:
                    cur_mat = mat
                    o.write(f"usemtl {cur_mat}\n")
                o.write(f"f {tri[0][0]}//{tri[0][1]} {tri[1][0]}//{tri[1][1]} {tri[2][0]}//{tri[2][1]}\n")

        flat_obj = os.path.join(MDL_DIR, "all_models", f"{self.name}.obj")
        flat_mtl = os.path.join(MDL_DIR, "all_models", f"{self.name}.mtl")
        shutil.copy2(obj_file, flat_obj)
        shutil.copy2(mtl_file, flat_mtl)

def export_models():
    print("=== [3/3] Generating and Exporting ALL 3D MODELS ===")
    obj_dir = os.path.join(MDL_DIR, "obj")

    # 1. Player Steve
    p = ModelBuilder("player_steve")
    p.define_material("steve_skin", 0.85, 0.63, 0.45)
    p.define_material("steve_hair", 0.29, 0.18, 0.09)
    p.define_material("steve_shirt", 0.0, 0.66, 0.66)
    p.define_material("steve_pants", 0.17, 0.22, 0.48)
    p.define_material("steve_shoes", 0.33, 0.33, 0.33)
    p.add_box(-0.25, 1.25, -0.25, 0.25, 1.75, 0.25, "steve_skin")
    p.add_box(-0.26, 1.50, -0.26, 0.26, 1.76, 0.26, "steve_hair")
    p.add_box(-0.25, 0.55, -0.14, 0.25, 1.25, 0.14, "steve_shirt")
    p.add_box(-0.45, 0.55, -0.10, -0.25, 1.20, 0.10, "steve_shirt")
    p.add_box(-0.45, 0.20, -0.10, -0.25, 0.55, 0.10, "steve_skin")
    p.add_box(0.25, 0.55, -0.10, 0.45, 1.20, 0.10, "steve_shirt")
    p.add_box(0.25, 0.20, -0.10, 0.45, 0.55, 0.10, "steve_skin")
    p.add_box(-0.24, 0.15, -0.11, -0.02, 0.55, 0.11, "steve_pants")
    p.add_box(-0.24, 0.00, -0.11, -0.02, 0.15, 0.11, "steve_shoes")
    p.add_box(0.02, 0.15, -0.11, 0.24, 0.55, 0.11, "steve_pants")
    p.add_box(0.02, 0.00, -0.11, 0.24, 0.15, 0.11, "steve_shoes")
    p.save(obj_dir)

    # 2. Player Diamond Armor
    da = ModelBuilder("player_diamond_armor")
    da.define_material("steve_skin", 0.85, 0.63, 0.45)
    da.define_material("steve_shirt", 0.0, 0.66, 0.66)
    da.define_material("steve_pants", 0.17, 0.22, 0.48)
    da.define_material("diamond_armor", 0.13, 0.83, 0.93)
    da.define_material("diamond_trim", 0.03, 0.57, 0.70)
    da.add_box(-0.25, 1.25, -0.25, 0.25, 1.75, 0.25, "steve_skin")
    da.add_box(-0.25, 0.55, -0.14, 0.25, 1.25, 0.14, "steve_shirt")
    da.add_box(-0.45, 0.20, -0.10, -0.25, 1.20, 0.10, "steve_skin")
    da.add_box(0.25, 0.20, -0.10, 0.45, 1.20, 0.10, "steve_skin")
    da.add_box(-0.24, 0.00, -0.11, -0.02, 0.55, 0.11, "steve_pants")
    da.add_box(0.02, 0.00, -0.11, 0.24, 0.55, 0.11, "steve_pants")
    # Diamond Armor Pieces
    da.add_box(-0.28, 1.23, -0.28, 0.28, 1.78, 0.28, "diamond_armor")
    da.add_box(-0.27, 0.53, -0.16, 0.27, 1.27, 0.16, "diamond_trim")
    da.add_box(-0.48, 0.90, -0.14, -0.26, 1.24, 0.14, "diamond_armor")
    da.add_box(0.26, 0.90, -0.14, 0.48, 1.24, 0.14, "diamond_armor")
    da.add_box(-0.26, 0.12, -0.13, -0.01, 0.57, 0.13, "diamond_trim")
    da.add_box(0.01, 0.12, -0.13, 0.26, 0.57, 0.13, "diamond_trim")
    da.add_box(-0.27, -0.02, -0.15, -0.01, 0.18, 0.15, "diamond_armor")
    da.add_box(0.01, -0.02, -0.15, 0.27, 0.18, 0.15, "diamond_armor")
    da.save(obj_dir)

    # 3. Duelist Bot
    db = ModelBuilder("duelist_bot")
    db.define_material("steve_skin", 0.82, 0.59, 0.46)
    db.define_material("diamond_armor", 0.13, 0.83, 0.93)
    db.define_material("diamond_sword", 0.15, 0.90, 0.95)
    db.define_material("shield_wood", 0.47, 0.21, 0.06)
    db.define_material("shield_iron", 0.82, 0.84, 0.86)
    db.add_box(-0.24, 1.25, -0.24, 0.24, 1.73, 0.24, "steve_skin")
    db.add_box(-0.26, 1.24, -0.26, 0.26, 1.76, 0.26, "diamond_armor")
    db.add_box(-0.26, 0.55, -0.15, 0.26, 1.25, 0.15, "diamond_armor")
    db.add_box(-0.46, 0.55, -0.10, -0.26, 1.20, 0.10, "diamond_armor")
    db.add_box(0.26, 0.55, -0.10, 0.46, 1.20, 0.10, "diamond_armor")
    db.add_box(-0.24, 0.00, -0.11, -0.02, 0.55, 0.11, "diamond_armor")
    db.add_box(0.02, 0.00, -0.11, 0.24, 0.55, 0.11, "diamond_armor")
    db.add_box(0.33, 0.35, 0.15, 0.39, 1.10, 0.21, "diamond_sword")
    db.add_box(-0.52, 0.45, 0.05, -0.50, 1.05, 0.45, "shield_wood")
    db.add_box(-0.53, 0.43, 0.03, -0.49, 1.07, 0.47, "shield_iron")
    db.save(obj_dir)

    # 4. Zombie
    z = ModelBuilder("zombie")
    z.define_material("zombie_green", 0.31, 0.66, 0.27)
    z.define_material("zombie_shirt", 0.12, 0.47, 0.71)
    z.define_material("zombie_pants", 0.13, 0.20, 0.40)
    z.add_box(-0.24, 1.25, -0.24, 0.24, 1.73, 0.24, "zombie_green")
    z.add_box(-0.24, 0.55, -0.14, 0.24, 1.25, 0.14, "zombie_shirt")
    z.add_box(-0.45, 0.85, 0.00, -0.25, 1.05, 0.60, "zombie_green")
    z.add_box(0.25, 0.85, 0.00, 0.45, 1.05, 0.60, "zombie_green")
    z.add_box(-0.22, 0.00, -0.11, -0.02, 0.55, 0.11, "zombie_pants")
    z.add_box(0.02, 0.00, -0.11, 0.22, 0.55, 0.11, "zombie_pants")
    z.save(obj_dir)

    # 5. Creeper
    c = ModelBuilder("creeper")
    c.define_material("creeper_green", 0.24, 0.69, 0.26)
    c.define_material("creeper_dark", 0.18, 0.55, 0.34)
    c.add_box(-0.23, 1.10, -0.23, 0.23, 1.56, 0.23, "creeper_green")
    c.add_box(-0.22, 0.45, -0.13, 0.22, 1.10, 0.13, "creeper_dark")
    c.add_box(-0.22, 0.00, 0.05, -0.04, 0.45, 0.23, "creeper_green")
    c.add_box(0.04, 0.00, 0.05, 0.22, 0.45, 0.23, "creeper_green")
    c.add_box(-0.22, 0.00, -0.23, -0.04, 0.45, -0.05, "creeper_dark")
    c.add_box(0.04, 0.00, -0.23, 0.22, 0.45, -0.05, "creeper_dark")
    c.save(obj_dir)

    # 6. Skeleton
    sk = ModelBuilder("skeleton")
    sk.define_material("bone_white", 0.90, 0.90, 0.88)
    sk.define_material("bow_wood", 0.55, 0.35, 0.17)
    sk.add_box(-0.24, 1.25, -0.24, 0.24, 1.73, 0.24, "bone_white")
    sk.add_box(-0.16, 0.55, -0.08, 0.16, 1.25, 0.08, "bone_white")
    sk.add_box(-0.35, 0.55, -0.06, -0.22, 1.20, 0.06, "bone_white")
    sk.add_box(0.22, 0.55, -0.06, 0.35, 1.20, 0.06, "bone_white")
    sk.add_box(-0.18, 0.00, -0.06, -0.06, 0.55, 0.06, "bone_white")
    sk.add_box(0.06, 0.00, -0.06, 0.18, 0.55, 0.06, "bone_white")
    sk.add_box(0.28, 0.60, 0.15, 0.32, 1.25, 0.18, "bow_wood")
    sk.save(obj_dir)

    # 7. Spider
    sp = ModelBuilder("spider")
    sp.define_material("spider_black", 0.15, 0.15, 0.15)
    sp.define_material("spider_eyes", 0.95, 0.10, 0.10)
    sp.add_box(-0.25, 0.25, 0.15, 0.25, 0.65, 0.55, "spider_black")
    sp.add_box(-0.08, 0.42, 0.54, -0.02, 0.48, 0.56, "spider_eyes")
    sp.add_box(0.02, 0.42, 0.54, 0.08, 0.48, 0.56, "spider_eyes")
    sp.add_box(-0.35, 0.30, -0.45, 0.35, 0.75, 0.15, "spider_black")
    for side in [-1, 1]:
        for idx in range(4):
            z_pos = -0.3 + idx * 0.22
            sp.add_box(side * 0.30, 0.35, z_pos, side * 0.75, 0.45, z_pos + 0.08, "spider_black")
            sp.add_box(side * 0.70, 0.00, z_pos, side * 0.80, 0.40, z_pos + 0.08, "spider_black")
    sp.save(obj_dir)

    # 8. Villager
    vl = ModelBuilder("villager")
    vl.define_material("villager_skin", 0.80, 0.58, 0.44)
    vl.define_material("villager_robe", 0.45, 0.28, 0.16)
    vl.define_material("villager_nose", 0.75, 0.50, 0.38)
    vl.add_box(-0.24, 1.25, -0.24, 0.24, 1.73, 0.24, "villager_skin")
    vl.add_box(-0.06, 1.20, 0.24, 0.06, 1.48, 0.38, "villager_nose")
    vl.add_box(-0.28, 0.35, -0.18, 0.28, 1.25, 0.18, "villager_robe")
    vl.add_box(-0.35, 0.65, 0.05, 0.35, 0.95, 0.28, "villager_robe")
    vl.add_box(-0.22, 0.00, -0.11, -0.02, 0.35, 0.11, "villager_robe")
    vl.add_box(0.02, 0.00, -0.11, 0.22, 0.35, 0.11, "villager_robe")
    vl.save(obj_dir)

    # 9. Ender Dragon
    ed = ModelBuilder("ender_dragon")
    ed.define_material("dragon_black", 0.08, 0.08, 0.10)
    ed.define_material("dragon_purple", 0.66, 0.20, 0.85)
    ed.define_material("dragon_gray", 0.30, 0.30, 0.35)
    ed.add_box(-0.4, 0.8, 1.6, 0.4, 1.4, 2.6, "dragon_black")
    ed.add_box(-0.3, 0.6, 1.7, 0.3, 0.8, 2.5, "dragon_gray")
    ed.add_box(-0.35, 1.4, 1.5, -0.25, 1.8, 1.9, "dragon_purple")
    ed.add_box(0.25, 1.4, 1.5, 0.35, 1.8, 1.9, "dragon_purple")
    ed.add_box(-0.25, 0.8, 0.8, 0.25, 1.3, 1.6, "dragon_black")
    ed.add_box(-0.7, 0.4, -1.2, 0.7, 1.5, 0.8, "dragon_black")
    ed.add_box(-0.1, 1.5, -1.1, 0.1, 1.8, 0.7, "dragon_gray")
    ed.add_box(-2.8, 1.2, -0.4, -0.7, 1.35, 0.6, "dragon_purple")
    ed.add_box(0.7, 1.2, -0.4, 2.8, 1.35, 0.6, "dragon_purple")
    ed.add_box(-0.2, 0.6, -2.5, 0.2, 1.0, -1.2, "dragon_black")
    ed.save(obj_dir)

    # 10. Car Zhiguli
    car = ModelBuilder("car_zhiguli")
    car.define_material("zhiguli_blue", 0.11, 0.31, 0.85)
    car.define_material("car_glass", 0.58, 0.77, 0.99)
    car.define_material("chrome", 0.88, 0.90, 0.92)
    car.define_material("tire_rubber", 0.12, 0.14, 0.18)
    car.define_material("headlight", 0.98, 0.95, 0.60)
    car.add_box(-0.9, 0.25, -2.0, 0.9, 0.75, 2.0, "zhiguli_blue")
    car.add_box(-0.8, 0.75, -1.1, 0.8, 1.35, 0.9, "car_glass")
    car.add_box(-0.85, 1.35, -1.15, 0.85, 1.42, 0.95, "zhiguli_blue")
    car.add_box(-0.95, 0.20, 1.98, 0.95, 0.35, 2.10, "chrome")
    car.add_box(-0.95, 0.20, -2.10, 0.95, 0.35, -1.98, "chrome")
    car.add_box(-0.75, 0.45, 2.01, -0.45, 0.65, 2.05, "headlight")
    car.add_box(0.45, 0.45, 2.01, 0.75, 0.65, 2.05, "headlight")
    for wx in [-1.02, 0.90]:
        for wz in [-1.2, 1.2]:
            car.add_box(wx, 0.0, wz - 0.35, wx + 0.12, 0.55, wz + 0.35, "tire_rubber")
    car.save(obj_dir)

    # 11. Diamond Sword
    sw = ModelBuilder("diamond_sword")
    sw.define_material("diamond_gem", 0.13, 0.83, 0.93)
    sw.define_material("sword_trim", 0.03, 0.57, 0.70)
    sw.define_material("sword_hilt", 0.55, 0.35, 0.17)
    sw.add_box(-0.06, 0.45, -0.03, 0.06, 1.65, 0.03, "diamond_gem")
    sw.add_box(-0.02, 0.45, -0.04, 0.02, 1.55, 0.04, "diamond_trim")
    sw.add_box(-0.25, 0.35, -0.06, 0.25, 0.45, 0.06, "diamond_trim")
    sw.add_box(-0.04, 0.10, -0.03, 0.04, 0.35, 0.03, "sword_hilt")
    sw.add_box(-0.07, 0.02, -0.05, 0.07, 0.10, 0.05, "diamond_gem")
    sw.save(obj_dir)

    # 12. Diamond Pickaxe
    pk = ModelBuilder("diamond_pickaxe")
    pk.define_material("diamond_gem", 0.13, 0.83, 0.93)
    pk.define_material("pick_wood", 0.55, 0.35, 0.17)
    pk.add_box(-0.04, 0.0, -0.04, 0.04, 1.20, 0.04, "pick_wood")
    pk.add_box(-0.45, 1.10, -0.06, 0.45, 1.25, 0.06, "diamond_gem")
    pk.add_box(-0.55, 0.95, -0.05, -0.42, 1.12, 0.05, "diamond_gem")
    pk.add_box(0.42, 0.95, -0.05, 0.55, 1.12, 0.05, "diamond_gem")
    pk.save(obj_dir)

    # 13. Shield
    sh = ModelBuilder("shield")
    sh.define_material("shield_wood", 0.52, 0.32, 0.15)
    sh.define_material("shield_iron", 0.82, 0.84, 0.86)
    sh.define_material("shield_grip", 0.25, 0.25, 0.25)
    sh.add_box(-0.35, -0.50, -0.04, 0.35, 0.50, 0.00, "shield_wood")
    sh.add_box(-0.38, -0.53, -0.05, 0.38, 0.53, -0.01, "shield_iron")
    sh.add_box(-0.10, -0.10, -0.06, 0.10, 0.10, -0.03, "shield_iron")
    sh.add_box(-0.12, -0.08, 0.00, 0.12, 0.08, 0.08, "shield_grip")
    sh.save(obj_dir)

    # 14. AK-47
    ak = ModelBuilder("ak47")
    ak.define_material("gun_steel", 0.22, 0.24, 0.28)
    ak.define_material("gun_wood", 0.58, 0.28, 0.14)
    ak.add_box(-0.04, 0.10, -0.30, 0.04, 0.22, 0.35, "gun_steel")
    ak.add_box(-0.035, 0.05, -0.80, 0.035, 0.20, -0.30, "gun_wood")
    ak.add_box(-0.045, 0.10, 0.35, 0.045, 0.22, 0.70, "gun_wood")
    ak.add_box(-0.02, 0.13, 0.70, 0.02, 0.20, 1.25, "gun_steel")
    ak.add_box(-0.01, 0.20, 1.20, 0.01, 0.27, 1.24, "gun_steel")
    ak.add_box(-0.03, -0.15, -0.22, 0.03, 0.10, -0.10, "gun_wood")
    ak.add_box(-0.025, -0.28, 0.08, 0.025, 0.10, 0.22, "gun_steel")
    ak.save(obj_dir)

    # 15. Block Cube
    cube = ModelBuilder("block_cube")
    cube.define_material("block_mat", 0.75, 0.75, 0.75)
    cube.add_box(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, "block_mat")
    cube.save(obj_dir)

    # 16. TNT Block
    tnt = ModelBuilder("tnt_block")
    tnt.define_material("tnt_red", 0.85, 0.15, 0.15)
    tnt.define_material("tnt_band", 0.95, 0.95, 0.95)
    tnt.define_material("tnt_fuse", 0.30, 0.30, 0.30)
    tnt.add_box(-0.5, -0.5, -0.5, 0.5, -0.15, 0.5, "tnt_red")
    tnt.add_box(-0.5, -0.15, -0.5, 0.5, 0.15, 0.5, "tnt_band")
    tnt.add_box(-0.5, 0.15, -0.5, 0.5, 0.5, 0.5, "tnt_red")
    tnt.add_box(-0.04, 0.50, -0.04, 0.04, 0.65, 0.04, "tnt_fuse")
    tnt.save(obj_dir)

    # Copy binary GLB model
    glb_src = os.path.join(BASE_DIR, "packs/ak47/models/ak47.glb")
    if os.path.exists(glb_src):
        glb_dst = os.path.join(MDL_DIR, "glb", "ak47.glb")
        shutil.copy2(glb_src, glb_dst)
        shutil.copy2(glb_src, os.path.join(MDL_DIR, "all_models", "ak47.glb"))

    print("✓ Total 3D Models Exported: 16 OBJ+MTL models + GLB")


# ==============================================================================
# 4. MASTER README GENERATOR
# ==============================================================================
def generate_readme():
    readme_content = """# 📦 ALL_ASSETS — Повна база ресурсів Єбланкрафт (Eblankraft 3.0)

Ця папка містить **абсолютно всі текстури, звуки та 3D-моделі** гри Єбланкрафт, експортовані у стандартних універсальних форматах:
- **Текстури**: `.png` (Pixel-Art 16x16, 32x32, 64x64 та повний атлас `atlas.png`)
- **Звуки**: `.wav` (PCM 44.1 kHz, 16-bit моно) та `.mp3`
- **3D-моделі**: `.obj` + `.mtl` (Wavefront 3D з кольоровими матеріалами) та `.glb` (Binary glTF)

---

## 📁 Структура папки

### 🎨 1. TEXTURES/ (Всі Текстури)
- `blocks/` — Текстури блоків (трава, земля, камінь, бедрок, обсидіан, алмазний блок, TNT, пісок, вода, лава, цегла, руди тощо).
- `items/` — Текстури предметів та зброї (алмазний меч, кайло, їжа, шаурма, пиво, тотем безсмертя, АК-47, AWP, патрони, кейси, жигулі).
- `armor/` — Текстури броні (алмазний, незеритовий та залізний шоломи, нагрудники, поножі, черевики).
- `skins/` — Офіційні 64x64 скіни гравця у форматі Minecraft (Steve, Alex, Гопнік, Багатій, Кібер, Демон, Військовий, Єблан, Україна, Popcat, GigaChad).
- `mobs/` — Карти нормалей води (`waternormals.jpg`) та текстури істот.
- `ui/` — Іконки, тріщини ламання блоків (`crack_0`..`crack_4`), приціли, спрайти.
- `all_textures/` — Всі 150+ текстур в одній загальній папці без підпапок.
- `atlas.png` — Повний зведений атлас текстур (512x512).

---

### 🔊 2. SOUNDS/ (Всі Звуки)
- `blocks/` — Звуки взаємодії з блоками (`break_stone.wav`, `break_wood.wav`, `break_grass.wav`, `break_glass.wav`, `place_stone.wav` тощо).
- `combat/` — Бойові звуки (`hurt.wav`, `crit_hit.wav`, `strong_hit.wav`, `parry.wav` — дзвін меча, `shield_block.wav` — удар щита, `whiff.wav`, `dodge_roll.wav`).
- `entities/` — Звуки мобів (`villager_hrmm.wav`, `zombie_groan.wav`, `creeper_hiss.wav`, `dragon_roar.wav`).
- `environment/` — Оточення (`explosion.wav`, `tnt_fuse.wav`, `thunder.wav`, `portal_warp.wav`, `splash.wav`, `swim.wav`, `lava_pop.wav`, `sizzle.wav`).
- `player/` — Звуки гравця (`step.wav`, `jump.wav`, `eat.wav` — хрускіт їжі).
- `ui/` — Інтерфейс та фанфари (`click.wav`, `lever_click.wav`, `totem_activate.wav`, `pc_startup.wav`, `win_fanfare.wav`, `super_eblan_fanfare.wav`).
- `all_sounds/` — Всі 35+ аудіофайлів в одній загальній папці.

---

### 🗿 3. MODELS/ (Всі 3D-моделі)
- `obj/` — 3D-моделі у відкритому форматі Wavefront OBJ (з окремими файлами матеріалів `.mtl`):
  1. `player_steve.obj` — Стандартна 3D-модель гравця Стіва.
  2. `player_diamond_armor.obj` — Гравець у повному алмазному сеті броні.
  3. `duelist_bot.obj` — Бот-Дуелянт в алмазній броні з мечем і щитом.
  4. `zombie.obj` — Зомбі з витягнутими вперед руками.
  5. `creeper.obj` — 4-ногий Кріпер.
  6. `skeleton.obj` — Скелет з луком.
  7. `spider.obj` — 8-ногий павук.
  8. `villager.obj` — Житель зі схрещеними руками та носом.
  9. `ender_dragon.obj` — Дракон Краю з крилами, хвостом та рогами.
  10. `car_zhiguli.obj` — Автомобіль ВАЗ-2101 «Жигулі» (кузов, скло, колеса, бампери, фари).
  11. `diamond_sword.obj` — Об'ємний 3D алмазний меч.
  12. `diamond_pickaxe.obj` — 3D алмазне кайло.
  13. `shield.obj` — 3D щит із залізною оправою та ручкою.
  14. `ak47.obj` — Автомат Калашникова АК-47.
  15. `block_cube.obj` — Універсальний воксельний блок 1x1x1.
  16. `tnt_block.obj` — Блок динаміту TNT з гнітом.
- `glb/` — Бінарні моделі glTF (`ak47.glb`).
- `all_models/` — Усі 3D-моделі в одній папці.

---

## 🛠️ Як відкривати та використовувати:
- **Текстури**: Будь-який переглядач зображень, Photoshop, Aseprite, GIMP, Paint.NET.
- **Звуки**: Будь-який медіаплеєр (VLC, mpv, Audacity).
- **3D-моделі**: Будь-який 3D-редактор або рушій: **Blender**, **Unity**, **Unreal Engine**, **Godot**, Windows 3D Viewer.
"""
    with open(os.path.join(ASSETS_DIR, "README.md"), "w", encoding="utf-8") as f:
        f.write(readme_content)

    sym_path = os.path.join(BASE_DIR, "GAME_ASSETS")
    if os.path.islink(sym_path) or os.path.exists(sym_path):
        try:
            if os.path.islink(sym_path):
                os.unlink(sym_path)
            elif os.path.isdir(sym_path):
                shutil.rmtree(sym_path)
            else:
                os.remove(sym_path)
        except Exception:
            pass
    try:
        os.symlink("ALL_ASSETS", sym_path)
    except Exception:
        pass


def main():
    ensure_dirs()
    extract_textures()
    export_sounds()
    export_models()
    generate_readme()
    print("\n🎉 ALL ASSETS EXPORTED SUCCESSFULLY!")
    print(f"📁 Destination Folder: {ASSETS_DIR}")

if __name__ == "__main__":
    main()

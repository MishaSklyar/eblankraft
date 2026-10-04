const fs = require('fs');

class MockContext {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
        this._fillStyle = '#000000';
        this._strokeStyle = '#000000';
        this._lineWidth = 1;
    }

    set fillStyle(val) { this._fillStyle = val; }
    get fillStyle() { return this._fillStyle; }
    set strokeStyle(val) { this._strokeStyle = val; }
    get strokeStyle() { return this._strokeStyle; }
    set lineWidth(val) { this._lineWidth = val; }
    get lineWidth() { return this._lineWidth; }

    _parseColor(c) {
        if (typeof c !== 'string') return [0, 0, 0, 255];
        if (c.startsWith('#')) {
            let hex = c.slice(1);
            if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
            const num = parseInt(hex, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
        } else if (c.startsWith('rgb')) {
            const m = c.match(/[\d.]+/g);
            if (m) {
                return [parseInt(m[0]), parseInt(m[1]), parseInt(m[2]), m[3] ? Math.floor(parseFloat(m[3]) * 255) : 255];
            }
        }
        return [0, 0, 0, 255];
    }

    clearRect(x, y, w, h) {
        for (let py = y; py < y + h; py++) {
            if (py < 0 || py >= this.height) continue;
            for (let px = x; px < x + w; px++) {
                if (px < 0 || px >= this.width) continue;
                const idx = (py * this.width + px) * 4;
                this.data[idx] = 0;
                this.data[idx+1] = 0;
                this.data[idx+2] = 0;
                this.data[idx+3] = 0;
            }
        }
    }

    fillRect(x, y, w, h) {
        x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
        const [r, g, b, a] = this._parseColor(this._fillStyle);
        for (let py = y; py < y + h; py++) {
            if (py < 0 || py >= this.height) continue;
            for (let px = x; px < x + w; px++) {
                if (px < 0 || px >= this.width) continue;
                const idx = (py * this.width + px) * 4;
                this.data[idx] = r;
                this.data[idx+1] = g;
                this.data[idx+2] = b;
                this.data[idx+3] = a;
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

    createImageData(w, h) {
        return { data: new Uint8ClampedArray(w * h * 4) };
    }
    getImageData(x, y, w, h) {
        return { data: new Uint8ClampedArray(this.data) };
    }
    putImageData(imgData, x, y) {
        this.data.set(imgData.data);
    }

    beginPath() { this._path = []; }
    moveTo(x, y) { this._path = [{x, y}]; }
    lineTo(x, y) { if (!this._path) this._path = []; this._path.push({x, y}); }
    stroke() {
        if (!this._path) return;
        const [r, g, b, a] = this._parseColor(this._strokeStyle);
        for (let i = 0; i < this._path.length; i++) {
            const p = this._path[i];
            const px = Math.floor(p.x);
            const py = Math.floor(p.y);
            if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                const idx = (py * this.width + px) * 4;
                this.data[idx] = r;
                this.data[idx+1] = g;
                this.data[idx+2] = b;
                this.data[idx+3] = a;
            }
        }
    }
    arc(cx, cy, r, sa, ea) { this._arc = { cx, cy, r }; }
    fill() {
        if (this._arc) {
            const { cx, cy, r } = this._arc;
            const [cr, cg, cb, ca] = this._parseColor(this._fillStyle);
            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) {
                    if (x*x + y*y <= r*r) {
                        const px = Math.floor(cx + x);
                        const py = Math.floor(cy + y);
                        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                            const idx = (py * this.width + px) * 4;
                            this.data[idx] = cr;
                            this.data[idx+1] = cg;
                            this.data[idx+2] = cb;
                            this.data[idx+3] = ca;
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
        this.width = w;
        this.height = h;
        this._ctx = new MockContext(w, h);
    }
    getContext(type) { return this._ctx; }
}

global.document = {
    createElement(tag) {
        if (tag === 'canvas') return new MockCanvas(16, 16);
        return {};
    }
};
global.window = global;
global.THREE = {
    CanvasTexture: function(c) { this.image = c; },
    NearestFilter: 1,
    RepeatWrapping: 1,
    BoxGeometry: function() {},
    MeshLambertMaterial: function() { this.userData = {}; },
    MeshBasicMaterial: function() { this.userData = {}; },
    MeshPhongMaterial: function() { this.userData = {}; },
    MeshStandardMaterial: function() { this.userData = {}; },
    Color: function() {},
    Vector3: function() {},
    Vector2: function() {}
};

let code = fs.readFileSync('js/textures.js', 'utf8');
eval(code);

const tm = new TextureManager();

// Build a 256x256 Texture Atlas (16x16 grid of 16x16 tiles = 256 tiles total!)
const ATLAS_SIZE = 256;
const TILE_SIZE = 16;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE; // 16
const atlasData = new Uint32Array(ATLAS_SIZE * ATLAS_SIZE);

// Mapping of tile index to Eblankraft canvasCache key
const tileMapping = {
    0: 'grass_top',
    1: 'grass_side',
    2: 'dirt',
    3: 'stone',
    4: 'bedrock',
    5: 'wood_side',
    6: 'wood_top',
    7: 'leaves',
    8: 'sand',
    9: 'water',
    10: 'netherrack',
    11: 'lava',
    12: 'end_stone',
    13: 'obsidian',
    14: 'coal_ore',
    15: 'iron_ore',
    16: 'gold',
    17: 'diamond',
    18: 'netherite_block',
    19: 'cat',          // POPCAT!
    20: 'tnt_top',
    21: 'tnt_side',
    22: 'craft_top',
    23: 'craft_side',
    24: 'glowstone',
    25: 'glass',
    26: 'bricks',
    27: 'eblan',        // EBLAN-BLOCK!
    28: 'cobblestone',
    29: 'planks',
    30: 'bookshelf',
    31: 'soul_sand',
    32: 'nether_bricks',
    33: 'nether_quartz',
    34: 'dragon_egg',
    35: 'portal_nether',
    36: 'portal_end',
    37: 'sponge',
    38: 'snow',
    39: 'ice',
    40: 'sandstone',
    41: 'cactus',
    42: 'terracotta'
};

for (const [tileIdxStr, key] of Object.entries(tileMapping)) {
    const tileIdx = parseInt(tileIdxStr);
    const canvas = tm.canvasCache[key];
    if (!canvas || !canvas._ctx) {
        console.warn(`Warning: texture not found for key: ${key}`);
        continue;
    }
    const tileX = (tileIdx % TILES_PER_ROW) * TILE_SIZE;
    const tileY = Math.floor(tileIdx / TILES_PER_ROW) * TILE_SIZE;
    const raw = canvas._ctx.data;

    for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
            const sIdx = (py * TILE_SIZE + px) * 4;
            const r = raw[sIdx];
            const g = raw[sIdx + 1];
            const b = raw[sIdx + 2];
            const a = raw[sIdx + 3];

            // PSP RGBA format: (a << 24) | (b << 16) | (g << 8) | r
            const pspColor = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
            const aIdx = (tileY + py) * ATLAS_SIZE + (tileX + px);
            atlasData[aIdx] = pspColor;
        }
    }
}

// Write out binary file: psp/src/atlas_data.bin
const buffer = Buffer.from(atlasData.buffer);
fs.writeFileSync('psp/src/atlas_data.bin', buffer);
console.log(`Saved atlas_data.bin (${buffer.length} bytes)!`);

// Also write a C source file embedding this data directly into the binary
let cCode = '#include <stdint.h>\n#include <stddef.h>\n\n';
cCode += '// 256x256 32-bit RGBA texture atlas ripped directly from Eblankraft 2.0!\n';
cCode += 'const uint32_t g_ripped_atlas[256 * 256] __attribute__((aligned(16))) = {\n';
for (let i = 0; i < atlasData.length; i += 8) {
    cCode += '    ';
    for (let j = 0; j < 8 && i + j < atlasData.length; j++) {
        cCode += '0x' + atlasData[i + j].toString(16).padStart(8, '0') + 'u, ';
    }
    cCode += '\n';
}
cCode += '};\n';
fs.writeFileSync('psp/src/ripped_atlas.c', cCode);
console.log('Saved psp/src/ripped_atlas.c successfully!');

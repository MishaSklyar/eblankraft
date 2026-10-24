'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const THREE = require('../js/three.min.js');
const wasmModule = new WebAssembly.Module(fs.readFileSync(path.join(ROOT, 'js/eblan_core.wasm')));

// Each room gets its own globals and Wasm memory. These are the browser's actual
// world and engine sources; rendering alone is disabled in the headless host.
class AuthorityWorld {
    constructor(seed, options = {}) {
        const context = vm.createContext({ THREE, console, WebAssembly, atob, performance });
        context.window = context;
        for (const name of ['textures', 'noise', 'eblan_eng', 'de_eblan2', 'world', 'player', 'particles']) {
            vm.runInContext(fs.readFileSync(path.join(ROOT, `js/${name}.js`), 'utf8'), context, { filename: `js/${name}.js` });
        }
        const core = context.EblanEng;
        core.wasmInstance = new WebAssembly.Instance(wasmModule, {});
        core.exports = core.wasmInstance.exports;
        core.wasmMemory = core.exports.memory;
        core.exports.eblan_init(seed);
        core.currentSeed = seed;
        core.ready = true;
        context.VoxelWorld.prototype.updateMeshes = function () {};
        this.world = new context.VoxelWorld(new THREE.Scene(), null, { seed, ...options });
        this.blocks = context.BLOCK_TYPES;
        this.info = context.BLOCK_INFO;
        this.context = context;
    }

    chunk(cx, cz) { return this.world.generateSingleChunk(cx, cz).voxels; }
    getBlock(x, y, z) {
        if (y < 0 || y >= 32) return 0;
        this.chunk(Math.floor(x / 16), Math.floor(z / 16));
        return this.world.getBlock(x, y, z);
    }
    getBlockDesign(x, y, z) { return this.world.getBlockDesign(x, y, z); }
    setBlock(x, y, z, type, design = null) {
        this.chunk(Math.floor(x / 16), Math.floor(z / 16));
        this.world.setBlock(x, y, z, type, design);
    }
    spawn() {
        for (let y = 30; y >= 0; y--) {
            const block = this.getBlock(0, y, 0);
            if (block && block !== this.blocks.WATER && block !== this.blocks.LEAVES) return { x: .5, y: y + 1, z: .5 };
        }
        return { x: .5, y: 32, z: .5 };
    }
    collides(x, y, z) {
        // Reuse the actual player collision implementation (water, portals,
        // plants, redstone and exact boundary tolerances included).
        return this.context.Player.prototype.checkCollision.call({
            world: this, width: .6, height: 1.8, depth: .6, noclip: false
        }, { x, y, z });
    }
    solid(block) { return !this.context.isPassThroughBlock(block); }
    visible(from, to) {
        const start = [from.x, from.y, from.z], end = [to.x, to.y, to.z];
        const cell = start.map(Math.floor), target = end.map(Math.floor);
        const delta = end.map((v, i) => v - start[i]), step = delta.map(Math.sign);
        const stride = delta.map(v => v ? Math.abs(1 / v) : Infinity);
        const next = delta.map((v, i) => v ? ((cell[i] + (v > 0 ? 1 : 0)) - start[i]) / v : Infinity);
        for (let visited = 0; visited < 128; visited++) {
            if (cell.every((v, i) => v === target[i])) return true;
            const block = this.getBlock(...cell);
            const design = this.getBlockDesign(...cell);
            if (visited && (design ? design.solid : this.solid(block))) {
                if (!design && !this.info[block]?.bounds) return false;
                for (const bounds of this.context.blockDesignBoxes(block, design)) {
                    let enter = 0, exit = 1;
                    for (let axis = 0; axis < 3; axis++) {
                        const low = cell[axis] + bounds[axis], high = cell[axis] + bounds[axis + 3];
                        if (Math.abs(delta[axis]) < 1e-12) {
                            if (start[axis] < low || start[axis] > high) { exit = -1; break; }
                        } else {
                            const a = (low - start[axis]) / delta[axis];
                            const b = (high - start[axis]) / delta[axis];
                            enter = Math.max(enter, Math.min(a, b));
                            exit = Math.min(exit, Math.max(a, b));
                        }
                    }
                    if (enter <= exit) return false;
                }
            }
            const axis = next[0] <= next[1] && next[0] <= next[2] ? 0 : next[1] <= next[2] ? 1 : 2;
            cell[axis] += step[axis]; next[axis] += stride[axis];
        }
        return false;
    }
    pathClear(from, to) {
        const sweep = (a, b) => {
            const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / .2));
            for (let i = 1; i <= steps; i++) {
                const f = i / steps;
                if (this.collides(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f)) return false;
            }
            return true;
        };
        if (sweep(from, to)) return true;
        // Browser movement resolves axes separately; several frames in one
        // packet can rise before clearing a ledge rather than follow a straight
        // chord. Each alternative still sweeps every intervening position.
        for (const order of [['x', 'z', 'y'], ['y', 'x', 'z']]) {
            let a = { x: from.x, y: from.y, z: from.z }, clear = true;
            for (const axis of order) {
                const b = { ...a, [axis]: to[axis] };
                if (!sweep(a, b)) { clear = false; break; }
                a = b;
            }
            if (clear) return true;
        }
        return false;
    }
    tnt(state, explode) {
        const entity = Object.create(this.context.TNTEntity.prototype);
        Object.assign(entity, state, { world: this, mesh: new THREE.Object3D(), exploded: false,
            explode() { if (!this.exploded) { this.exploded = true; explode(this); } } });
        return entity;
    }
}

module.exports = { AuthorityWorld };

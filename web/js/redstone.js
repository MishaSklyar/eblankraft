/**
 * Eblankraft 2.0 - Full Redstone & Wire Simulation Engine
 * Breadth-First-Search signal propagation up to 15 blocks.
 * Controls wires, levers, buttons, pressure plates, torches, lamps & TNT.
 */

class RedstoneEngine {
    constructor(game) {
        this.game = game;
        this.world = null;

        // Tracks power levels of wire blocks: "x,y,z" -> integer (0 to 15)
        this.wirePower = new Map();
        // Tracks levers: "x,y,z" -> boolean (active)
        this.levers = new Map();
        // Tracks buttons: "x,y,z" -> { active: boolean, timer: number }
        this.buttons = new Map();
        // Tracks pressure plates: "x,y,z" -> boolean
        this.pressurePlates = new Map();

        this._recalcScheduled = false;
    }

    init(world) {
        this.world = world;
        this.scanInitialBlocks();
    }

    getKey(x, y, z) {
        return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    }

    parseKey(key) {
        const [x, y, z] = key.split(',').map(Number);
        return { x, y, z };
    }

    scanInitialBlocks() {
        this.scheduleRecalculate();
    }

    scheduleRecalculate() {
        if (this._recalcScheduled) return;
        this._recalcScheduled = true;
        requestAnimationFrame(() => {
            this._recalcScheduled = false;
            this.recalculate();
        });
    }

    onBlockPlaced(x, y, z, type) {
        const key = this.getKey(x, y, z);
        if (type === BLOCK_TYPES.REDSTONE_WIRE) {
            this.wirePower.set(key, 0);
        } else if (type === BLOCK_TYPES.LEVER) {
            this.levers.set(key, false);
        } else if (type === BLOCK_TYPES.STONE_BUTTON) {
            this.buttons.set(key, { active: false, timer: 0 });
        } else if (type === BLOCK_TYPES.PRESSURE_PLATE) {
            this.pressurePlates.set(key, false);
        }
        this.scheduleRecalculate();
    }

    onBlockBroken(x, y, z, type) {
        const key = this.getKey(x, y, z);
        this.wirePower.delete(key);
        this.levers.delete(key);
        this.buttons.delete(key);
        this.pressurePlates.delete(key);
        this.scheduleRecalculate();
    }

    toggleLever(x, y, z) {
        const key = this.getKey(x, y, z);
        const current = !!this.levers.get(key);
        const newState = !current;
        this.levers.set(key, newState);

        if (this.game.soundManager) {
            if (this.game.soundManager.playLeverClick) {
                this.game.soundManager.playLeverClick(newState);
            } else {
                this.game.soundManager.playClick();
            }
        }

        if (this.game.ui) {
            this.game.ui.showToast(newState ? "⚡ Важіль: УВІМКНЕНО [15]" : "⚡ Важіль: ВИМКНЕНО [0]");
        }

        this.scheduleRecalculate();
        return newState;
    }

    pressButton(x, y, z) {
        const key = this.getKey(x, y, z);
        let btn = this.buttons.get(key);
        if (!btn) {
            btn = { active: false, timer: 0 };
            this.buttons.set(key, btn);
        }

        if (btn.active) return false;
        btn.active = true;
        btn.timer = 1.0; // 1 second pulse

        if (this.game.soundManager) {
            if (this.game.soundManager.playLeverClick) {
                this.game.soundManager.playLeverClick(true);
            } else {
                this.game.soundManager.playClick();
            }
        }

        if (this.game.ui) {
            this.game.ui.showToast("⚡ Кнопка: ІМПУЛЬС [1s]");
        }

        this.scheduleRecalculate();
        return true;
    }

    update(dt) {
        if (!this.world) return;

        // 1. Update button timers
        let buttonStateChanged = false;
        for (const [key, btn] of this.buttons.entries()) {
            if (btn.active) {
                btn.timer -= dt;
                if (btn.timer <= 0) {
                    btn.active = false;
                    buttonStateChanged = true;
                    if (this.game.soundManager && this.game.soundManager.playLeverClick) {
                        this.game.soundManager.playLeverClick(false);
                    }
                }
            }
        }

        // 2. Check pressure plates trigger (player and mobs)
        let plateChanged = false;
        const player = this.game.player;
        for (const [key, wasActive] of this.pressurePlates.entries()) {
            const { x, y, z } = this.parseKey(key);
            let isActive = false;

            // Player on plate
            if (player && !player.isDead) {
                const px = player.position.x;
                const py = player.position.y;
                const pz = player.position.z;
                if (px >= x - 0.2 && px <= x + 1.2 &&
                    pz >= z - 0.2 && pz <= z + 1.2 &&
                    Math.abs(py - (y + 1.0)) < 0.6) {
                    isActive = true;
                }
            }

            // Mobs on plate
            if (!isActive && this.game.mobManager && this.game.mobManager.mobs) {
                for (const mob of this.game.mobManager.mobs) {
                    if (mob.isDead) continue;
                    const mx = mob.position.x;
                    const my = mob.position.y;
                    const mz = mob.position.z;
                    if (mx >= x - 0.2 && mx <= x + 1.2 &&
                        mz >= z - 0.2 && mz <= z + 1.2 &&
                        Math.abs(my - (y + 1.0)) < 0.6) {
                        isActive = true;
                        break;
                    }
                }
            }

            if (isActive !== wasActive) {
                this.pressurePlates.set(key, isActive);
                plateChanged = true;
                if (this.game.soundManager) {
                    this.game.soundManager.playClick();
                }
            }
        }

        if (buttonStateChanged || plateChanged) {
            this.scheduleRecalculate();
        }
    }

    recalculate() {
        if (!this.world) return;

        // Reset all wires to 0 power
        for (const key of this.wirePower.keys()) {
            this.wirePower.set(key, 0);
        }

        const queue = [];
        const visitedWires = new Map();

        // 1. Gather all active power sources in the world
        const enqueueAdjacent = (sx, sy, sz, sourcePower) => {
            const offsets = [
                [1, 0, 0], [-1, 0, 0],
                [0, 1, 0], [0, -1, 0],
                [0, 0, 1], [0, 0, -1]
            ];
            for (const [dx, dy, dz] of offsets) {
                const nx = sx + dx;
                const ny = sy + dy;
                const nz = sz + dz;
                const block = this.world.getBlock(nx, ny, nz);

                if (block === BLOCK_TYPES.REDSTONE_WIRE) {
                    const k = this.getKey(nx, ny, nz);
                    if (!visitedWires.has(k) || visitedWires.get(k) < sourcePower) {
                        visitedWires.set(k, sourcePower);
                        this.wirePower.set(k, sourcePower);
                        queue.push({ x: nx, y: ny, z: nz, power: sourcePower });
                    }
                }
            }
        };

        // 1.1 Active Levers
        for (const [key, active] of this.levers.entries()) {
            if (active) {
                const { x, y, z } = this.parseKey(key);
                if (this.world.getBlock(x, y, z) === BLOCK_TYPES.LEVER) {
                    enqueueAdjacent(x, y, z, 15);
                }
            }
        }

        // 1.2 Active Buttons
        for (const [key, btn] of this.buttons.entries()) {
            if (btn.active) {
                const { x, y, z } = this.parseKey(key);
                if (this.world.getBlock(x, y, z) === BLOCK_TYPES.STONE_BUTTON) {
                    enqueueAdjacent(x, y, z, 15);
                }
            }
        }

        // 1.3 Active Pressure Plates
        for (const [key, active] of this.pressurePlates.entries()) {
            if (active) {
                const { x, y, z } = this.parseKey(key);
                if (this.world.getBlock(x, y, z) === BLOCK_TYPES.PRESSURE_PLATE) {
                    enqueueAdjacent(x, y, z, 15);
                }
            }
        }

        // 1.4 Redstone Torches & Redstone Blocks around loaded chunks
        if (this.game.player) {
            const px = Math.floor(this.game.player.position.x);
            const py = Math.floor(this.game.player.position.y);
            const pz = Math.floor(this.game.player.position.z);
            const radius = 32;

            for (let x = px - radius; x <= px + radius; x++) {
                for (let z = pz - radius; z <= pz + radius; z++) {
                    for (let y = Math.max(1, py - 12); y <= Math.min(30, py + 12); y++) {
                        const b = this.world.getBlock(x, y, z);
                        if (b === BLOCK_TYPES.REDSTONE_TORCH || b === BLOCK_TYPES.REDSTONE_BLOCK) {
                            enqueueAdjacent(x, y, z, 15);
                        } else if (b === BLOCK_TYPES.REDSTONE_WIRE) {
                            const k = this.getKey(x, y, z);
                            if (!this.wirePower.has(k)) {
                                this.wirePower.set(k, 0);
                            }
                        } else if (b === BLOCK_TYPES.LEVER && !this.levers.has(this.getKey(x, y, z))) {
                            this.levers.set(this.getKey(x, y, z), false);
                        }
                    }
                }
            }
        }

        // 2. BFS Signal Propagation along wires (15 -> 0)
        while (queue.length > 0) {
            const current = queue.shift();
            const { x, y, z, power } = current;
            if (power <= 1) continue;

            const nextPower = power - 1;

            const neighbors = [
                // Direct horizontal
                [x + 1, y, z], [x - 1, y, z],
                [x, y, z + 1], [x, y, z - 1],
                // 1 block slope up
                [x + 1, y + 1, z], [x - 1, y + 1, z],
                [x, y + 1, z + 1], [x, y + 1, z - 1],
                // 1 block slope down
                [x + 1, y - 1, z], [x - 1, y - 1, z],
                [x, y - 1, z + 1], [x, y - 1, z - 1]
            ];

            for (const [nx, ny, nz] of neighbors) {
                if (ny < 0 || ny >= 32) continue;
                const b = this.world.getBlock(nx, ny, nz);
                if (b === BLOCK_TYPES.REDSTONE_WIRE) {
                    const nk = this.getKey(nx, ny, nz);
                    const prevPower = visitedWires.get(nk) || 0;
                    if (nextPower > prevPower) {
                        visitedWires.set(nk, nextPower);
                        this.wirePower.set(nk, nextPower);
                        queue.push({ x: nx, y: ny, z: nz, power: nextPower });
                    }
                }
            }
        }

        // 3. Trigger Activators & Receivers (Redstone Lamps & TNT)
        this.updateReceivers();
    }

    isBlockPowered(bx, by, bz) {
        const adjacent = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1]
        ];

        for (const [dx, dy, dz] of adjacent) {
            const x = bx + dx;
            const y = by + dy;
            const z = bz + dz;
            const b = this.world.getBlock(x, y, z);
            const key = this.getKey(x, y, z);

            if (b === BLOCK_TYPES.REDSTONE_BLOCK || b === BLOCK_TYPES.REDSTONE_TORCH) {
                return true;
            }
            if (b === BLOCK_TYPES.LEVER && this.levers.get(key)) {
                return true;
            }
            if (b === BLOCK_TYPES.STONE_BUTTON && this.buttons.get(key)?.active) {
                return true;
            }
            if (b === BLOCK_TYPES.PRESSURE_PLATE && this.pressurePlates.get(key)) {
                return true;
            }
            if (b === BLOCK_TYPES.REDSTONE_WIRE && (this.wirePower.get(key) || 0) > 0) {
                return true;
            }
        }
        return false;
    }

    updateReceivers() {
        if (!this.game.player || !this.world) return;
        const px = Math.floor(this.game.player.position.x);
        const py = Math.floor(this.game.player.position.y);
        const pz = Math.floor(this.game.player.position.z);
        const radius = 32;

        let needMeshRebuild = false;

        for (let x = px - radius; x <= px + radius; x++) {
            for (let z = pz - radius; z <= pz + radius; z++) {
                for (let y = Math.max(1, py - 12); y <= Math.min(30, py + 12); y++) {
                    const block = this.world.getBlock(x, y, z);

                    // Redstone Lamp: ON / OFF
                    if (block === BLOCK_TYPES.REDSTONE_LAMP || block === BLOCK_TYPES.REDSTONE_LAMP_ON) {
                        const powered = this.isBlockPowered(x, y, z);
                        if (powered && block === BLOCK_TYPES.REDSTONE_LAMP) {
                            this.world.setBlock(x, y, z, BLOCK_TYPES.REDSTONE_LAMP_ON);
                            needMeshRebuild = true;
                            if (this.game.particleSystem) {
                                this.game.particleSystem.spawnBlockBreakParticles(x + 0.5, y + 0.5, z + 0.5, BLOCK_TYPES.GLOWSTONE, 4);
                            }
                        } else if (!powered && block === BLOCK_TYPES.REDSTONE_LAMP_ON) {
                            this.world.setBlock(x, y, z, BLOCK_TYPES.REDSTONE_LAMP);
                            needMeshRebuild = true;
                        }
                    }

                    // TNT Detonation on Redstone Signal
                    else if (block === BLOCK_TYPES.TNT) {
                        if (this.isBlockPowered(x, y, z)) {
                            this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
                            needMeshRebuild = true;
                            if (typeof TNTEntity !== 'undefined') {
                                new TNTEntity(x, y, z, this.game.scene, this.game.textureManager, this.game.soundManager, this.world, this.game.particleSystem, this.game);
                            }
                        }
                    }
                }
            }
        }

        if (needMeshRebuild) {
            this.world.updateMeshes();
        }
    }
}

// Attach globally
window.RedstoneEngine = RedstoneEngine;

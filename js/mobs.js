/**
 * Eblankraft 2.0 - Mobs Engine, 3D Item Drops, End Crystals & Eblan Dragon Boss
 */

// --- 3D ITEM DROP IN WORLD ---
class ItemDrop {
    constructor(x, y, z, itemId, count, scene, textureManager, soundManager, options = {}) {
        this.itemId = itemId;
        this.count = count || 1;
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.position = new THREE.Vector3(x, y, z);
        this.pickupDelay = options.pickupDelay !== undefined ? options.pickupDelay : 0.35;
        this.velocity = options.velocity ? options.velocity.clone() : new THREE.Vector3(
            (Math.random() - 0.5) * 2.0,
            Math.random() * 2.2 + 1.2,
            (Math.random() - 0.5) * 2.0
        );
        this.onGround = false;
        this.age = 0;
        this.maxAge = 300; // 5 minutes
        this.pickedUp = false;

        // Visual mesh using SHARED geometry and CACHED material (Zero allocation lag!)
        const geom = textureManager.getItemDropGeometry();
        const mat = textureManager.getItemDropMaterial(itemId);
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = false;
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    update(dt, player, world) {
        if (this.pickedUp || !this.mesh) return;

        this.age += dt;
        if (this.pickupDelay > 0) {
            this.pickupDelay -= dt;
        }

        // Despawn if too old or fell into void
        if (this.age > this.maxAge || this.position.y < -30) {
            this.destroy();
            return;
        }

        // Physics
        if (!this.onGround) {
            this.velocity.y -= 14 * dt;
            this.position.x += this.velocity.x * dt;
            this.position.y += this.velocity.y * dt;
            this.position.z += this.velocity.z * dt;

            // Floor collision
            const bx = Math.floor(this.position.x);
            const by = Math.floor(this.position.y);
            const bz = Math.floor(this.position.z);
            const block = world.getBlock(bx, by, bz);
            if (block === BLOCK_TYPES.WATER) {
                // Buoyancy: float up to water surface and drift with current
                this.velocity.y = Math.min(this.velocity.y + 16.0 * dt, 1.8);
                let fx = 0, fz = 0;
                if (world.getBlock(bx + 1, by, bz) === BLOCK_TYPES.AIR) fx += 1.6;
                if (world.getBlock(bx - 1, by, bz) === BLOCK_TYPES.AIR) fx -= 1.6;
                if (world.getBlock(bx, by, bz + 1) === BLOCK_TYPES.AIR) fz += 1.6;
                if (world.getBlock(bx, by, bz - 1) === BLOCK_TYPES.AIR) fz -= 1.6;
                this.position.x += fx * dt;
                this.position.z += fz * dt;
                this.onGround = false;
            } else if (block !== BLOCK_TYPES.AIR) {
                this.position.y = by + 1.0;
                this.velocity.set(0, 0, 0);
                this.onGround = true;
            }
        }

        // Bobbing & Rotation
        this.mesh.rotation.y += dt * 2.2;
        const bob = Math.sin(this.age * 3.5) * 0.06;
        this.mesh.position.set(this.position.x, this.position.y + bob, this.position.z);

        // Magnet pickup towards player (Only after pickup cooldown!)
        if (this.pickupDelay <= 0 && player && !player.isDead) {
            const dist = this.position.distanceTo(player.position);
            const magnetRadius = (player.game && player.game.upgrader) ? player.game.upgrader.getPickupMagnetRadius() : 2.5;

            if (dist < magnetRadius) {
                const targetY = player.position.y + 0.9;
                const dx = player.position.x - this.position.x;
                const dy = targetY - this.position.y;
                const dz = player.position.z - this.position.z;
                const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
                const pullSpeed = Math.max(6, (magnetRadius - dist) * 9);
                const step = (pullSpeed * dt) / len;
                this.position.x += dx * step;
                this.position.y += dy * step;
                this.position.z += dz * step;
                this.mesh.position.copy(this.position);

                // Pickup reach
                if (dist < 0.95) {
                    const added = player.addItem(this.itemId, this.count);
                    if (added) {
                        this.pickedUp = true;
                        // Shared room: tell the others this drop is gone so it cannot be picked up twice.
                        if (this.netId) player.game?.serverClient?.sendRaw({ type: 'item_pickup', id: this.netId });
                        if (this.soundManager) this.soundManager.playPickup();
                        if (player.game && player.game.ui) {
                            const itInfo = ITEM_REGISTRY[this.itemId] || { name: this.itemId };
                            player.game.ui.showToast(`+${this.count} ${itInfo.name}`);
                        }
                        this.destroy();
                    }
                }
            }
        }
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            // DO NOT dispose shared geometry and materials!
            this.mesh = null;
        }
    }
}

// --- END CRYSTAL (HEALS DRAGON) ---
class EndCrystal {
    constructor(x, y, z, scene, textureManager, soundManager, game) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.game = game;
        this.health = 1;
        this.isDestroyed = false;
        this.age = 0;

        // Crystal Mesh: outer glass cube + inner rotating magenta cube
        this.group = new THREE.Group();
        this.group.position.set(x + 0.5, y + 0.5, z + 0.5);

        // Inner core
        const coreGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xda22ff });
        this.coreMesh = new THREE.Mesh(coreGeom, coreMat);
        this.group.add(this.coreMesh);

        // Outer glass cage
        const cageGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const cageMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.55
        });
        this.cageMesh = new THREE.Mesh(cageGeom, cageMat);
        this.group.add(this.cageMesh);

        // Base bedrock plate
        const baseGeom = new THREE.BoxGeometry(1.0, 0.2, 1.0);
        const baseMat = textureManager.getBlockMaterial(BLOCK_TYPES.BEDROCK);
        this.baseMesh = new THREE.Mesh(baseGeom, baseMat);
        this.baseMesh.position.y = -0.4;
        this.group.add(this.baseMesh);

        this.scene.add(this.group);

        // Healing Beam line to dragon
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 3 });
        this.beamLine = new THREE.Line(lineGeom, lineMat);
        this.beamLine.visible = false;
        this.scene.add(this.beamLine);
    }

    update(dt, dragon) {
        if (this.isDestroyed) return;
        this.age += dt;

        // Spin crystal
        this.coreMesh.rotation.x += dt * 2.0;
        this.coreMesh.rotation.y += dt * 3.0;
        this.cageMesh.rotation.y -= dt * 1.2;

        // Link healing beam to dragon if within 50 blocks
        if (dragon && !dragon.isDead && dragon.mesh) {
            const dragonPos = dragon.mesh.position;
            const dist = this.group.position.distanceTo(dragonPos);
            if (dist < 60) {
                this.beamLine.visible = true;
                const posArr = new Float32Array([
                    this.group.position.x, this.group.position.y, this.group.position.z,
                    dragonPos.x, dragonPos.y, dragonPos.z
                ]);
                this.beamLine.geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
                this.beamLine.geometry.attributes.position.needsUpdate = true;

                // Heal dragon
                dragon.heal(15 * dt);
                return;
            }
        }
        this.beamLine.visible = false;
    }

    takeDamage(amount) {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        // Big explosion!
        if (this.game && this.game.particleSystem) {
            this.game.particleSystem.spawnExplosionParticles(this.group.position.x, this.group.position.y, this.group.position.z, 40);
        }
        if (this.soundManager) {
            this.soundManager.playExplosion();
        }

        // Deal damage to nearby dragon if close
        if (this.game.mobManager && this.game.mobManager.dragon) {
            const dist = this.group.position.distanceTo(this.game.mobManager.dragon.mesh.position);
            if (dist < 15) {
                this.game.mobManager.dragon.takeDamage(100);
            }
        }

        this.destroy();
    }

    destroy() {
        if (this.beamLine) {
            this.scene.remove(this.beamLine);
            this.beamLine.geometry.dispose();
            this.beamLine.material.dispose();
            this.beamLine = null;
        }
        if (this.group) {
            this.scene.remove(this.group);
            this.group = null;
        }
    }
}

// --- MOB DEFINITIONS (data-driven: add a new mob = add one entry here) ---
// ai: 'melee' | 'creeper' | 'enderman' | 'villager' | 'animal' | 'ranged' | 'slime'
// hostile mobs count towards the hostile spawn cap, everything else towards the passive one.
const _boxGeoCache = new Map();
function _boxGeo(w, h, d) {
    const key = w + 'x' + h + 'x' + d;
    let g = _boxGeoCache.get(key);
    if (!g) {
        g = new THREE.BoxGeometry(w, h, d);
        _boxGeoCache.set(key, g);
    }
    return g;
}

const _rnd = (n) => Math.floor(Math.random() * n);

// Shared by all mob attacks: applies the player's armour/upgrade damage reduction.
function _mobDamage(game, dmg) {
    if (game && game.upgrader) {
        return Math.max(1, Math.round(dmg * (1 - game.upgrader.getDamageReduction())));
    }
    return dmg;
}

// Builds a 4-legged body (pig / cow / sheep share it)
function _buildQuadruped(mob, box, o) {
    mob.torso = box(o.bw, o.bh, o.bl, o.body, 0, o.legH + o.bh / 2, 0);
    mob.head = box(o.hw, o.hh, o.hl, o.headColor || o.body, 0, o.legH + o.bh * 0.8, o.bl / 2 + o.hl / 2 - 0.05);
    const lx = o.bw / 2 - o.lw / 2, lz = o.bl / 2 - o.lw / 2 - 0.02;
    mob.leftLeg = box(o.lw, o.legH, o.lw, o.legColor || o.body, -lx, o.legH / 2, lz);
    mob.rightLeg = box(o.lw, o.legH, o.lw, o.legColor || o.body, lx, o.legH / 2, lz);
    mob.backLeftLeg = box(o.lw, o.legH, o.lw, o.legColor || o.body, -lx, o.legH / 2, -lz);
    mob.backRightLeg = box(o.lw, o.legH, o.lw, o.legColor || o.body, lx, o.legH / 2, -lz);
}

const MOB_DEFS = {
    zombie: {
        name: 'Зомбі-Єблан', ai: 'melee', hostile: true, burnsInDay: true, groan: true,
        height: 1.95, hp: 28, speed: 2.0, damage: 5, reach: 1.5, exp: 20,
        build(m, box) {
            m.head = box(0.48, 0.48, 0.48, 0x4fa846, 0, 1.48, 0);
            m.torso = box(0.48, 0.68, 0.28, 0x1f78b4, 0, 0.9, 0);
            m.leftArm = box(0.2, 0.6, 0.2, 0x4fa846, -0.35, 0.85, 0.2);
            m.leftArm.rotation.x = -Math.PI / 2.5; // zombie hands forward!
            m.rightArm = box(0.2, 0.6, 0.2, 0x4fa846, 0.35, 0.85, 0.2);
            m.rightArm.rotation.x = -Math.PI / 2.5;
            m.leftLeg = box(0.22, 0.65, 0.22, 0x223366, -0.14, 0.32, 0);
            m.rightLeg = box(0.22, 0.65, 0.22, 0x223366, 0.14, 0.32, 0);
        },
        loot(g, x, y, z) {
            g.spawnItemDrop(x, y, z, ITEM_TYPES.ROTTEN_FLESH, _rnd(2) + 1);
            if (Math.random() < 0.5) g.spawnItemDrop(x, y, z, ITEM_TYPES.LEATHER, _rnd(2) + 1);
            if (Math.random() < 0.35) g.spawnItemDrop(x, y, z, ITEM_TYPES.IRON_INGOT, 1);
            if (Math.random() < 0.4) g.spawnItemDrop(x, y, z, JUNK_ITEMS_POOL[_rnd(JUNK_ITEMS_POOL.length)], 1);
        }
    },
    skeleton: {
        name: 'Скелет-Єблан', ai: 'ranged', hostile: true, burnsInDay: true,
        height: 1.95, hp: 20, speed: 2.1, damage: 7, reach: 14, exp: 28,
        build(m, box) {
            const bone = 0xe6e6da, dark = 0x2b2b2b;
            m.head = box(0.46, 0.46, 0.46, bone, 0, 1.5, 0);
            box(0.1, 0.08, 0.02, dark, -0.1, 1.53, 0.24);
            box(0.1, 0.08, 0.02, dark, 0.1, 1.53, 0.24);
            m.torso = box(0.4, 0.66, 0.2, bone, 0, 0.92, 0);
            box(0.42, 0.06, 0.22, dark, 0, 0.98, 0); // ribs
            box(0.42, 0.06, 0.22, dark, 0, 0.86, 0);
            m.leftArm = box(0.1, 0.62, 0.1, bone, -0.3, 0.9, 0.1);
            m.leftArm.rotation.x = -Math.PI / 3;
            m.rightArm = box(0.1, 0.62, 0.1, bone, 0.3, 0.9, 0.1);
            m.rightArm.rotation.x = -Math.PI / 3;
            box(0.05, 0.7, 0.05, 0x8a5a2b, 0, 0.95, 0.38); // bow
            m.leftLeg = box(0.11, 0.65, 0.11, bone, -0.11, 0.32, 0);
            m.rightLeg = box(0.11, 0.65, 0.11, bone, 0.11, 0.32, 0);
        },
        loot(g, x, y, z) {
            g.spawnItemDrop(x, y, z, ITEM_TYPES.REDSTONE_DUST, _rnd(2) + 1);
            if (Math.random() < 0.3) g.spawnItemDrop(x, y, z, ITEM_TYPES.IRON_INGOT, 1);
        }
    },
    spider: {
        name: 'Павук-Єблан', ai: 'melee', hostile: true, neutralByDay: true,
        height: 0.9, hp: 18, speed: 3.3, damage: 4, reach: 1.5, exp: 25, width: 0.9,
        build(m, box) {
            const fur = 0x3b2f2f, dark = 0x1a1414;
            m.torso = box(0.7, 0.4, 0.9, fur, 0, 0.55, -0.15);
            m.head = box(0.5, 0.4, 0.5, dark, 0, 0.55, 0.5);
            box(0.1, 0.1, 0.02, 0xff2222, -0.12, 0.6, 0.76);
            box(0.1, 0.1, 0.02, 0xff2222, 0.12, 0.6, 0.76);
            m.leftLeg = box(0.8, 0.08, 0.08, dark, -0.7, 0.45, 0.25);
            m.rightLeg = box(0.8, 0.08, 0.08, dark, 0.7, 0.45, 0.25);
            m.backLeftLeg = box(0.8, 0.08, 0.08, dark, -0.7, 0.45, -0.4);
            m.backRightLeg = box(0.8, 0.08, 0.08, dark, 0.7, 0.45, -0.4);
            m.legRollAxis = 'z';
        },
        loot(g, x, y, z) {
            g.spawnItemDrop(x, y, z, ITEM_TYPES.ROTTEN_FLESH, _rnd(2) + 1);
            if (Math.random() < 0.25) g.spawnItemDrop(x, y, z, ITEM_TYPES.GUNPOWDER, 1);
        }
    },
    slime: {
        name: 'Слиз-Єблан', ai: 'slime', hostile: true,
        height: 1.0, hp: 16, speed: 3.0, damage: 6, reach: 1.1, exp: 18, width: 1.0,
        build(m, box) {
            m.torso = box(0.9, 0.9, 0.9, 0x5fd45f, 0, 0.5, 0);
            m.head = m.torso;
            box(0.14, 0.14, 0.02, 0x143d14, -0.2, 0.62, 0.46);
            box(0.14, 0.14, 0.02, 0x143d14, 0.2, 0.62, 0.46);
        },
        onDeath(m, g) { // splits into two small slimes
            for (let i = 0; i < 2; i++) {
                const s = g.spawnMob('slime_small', m.position.x + (i ? 0.4 : -0.4), m.position.y + 0.1, m.position.z);
                s.velocity.set((i ? 1 : -1) * 3, 5, 0);
            }
        },
        loot(g, x, y, z) {
            if (Math.random() < 0.3) g.spawnItemDrop(x, y, z, ITEM_TYPES.EMERALD, 1);
        }
    },
    slime_small: {
        name: 'Малий слиз', ai: 'slime', hostile: true,
        height: 0.5, hp: 5, speed: 2.6, damage: 3, reach: 0.8, exp: 6, width: 0.5,
        build(m, box) {
            m.torso = box(0.45, 0.45, 0.45, 0x7be87b, 0, 0.25, 0);
            m.head = m.torso;
            box(0.07, 0.07, 0.02, 0x143d14, -0.1, 0.3, 0.23);
            box(0.07, 0.07, 0.02, 0x143d14, 0.1, 0.3, 0.23);
        },
        loot(g, x, y, z) {
            if (Math.random() < 0.4) g.spawnItemDrop(x, y, z, JUNK_ITEMS_POOL[_rnd(JUNK_ITEMS_POOL.length)], 1);
        }
    },
    creeper: {
        name: 'Кріпер-Єблан', ai: 'creeper', hostile: true,
        height: 1.7, hp: 24, speed: 2.3, damage: 22, reach: 1.8, exp: 30,
        build(m, box) {
            m.head = box(0.46, 0.46, 0.46, 0x3cb043, 0, 1.35, 0);
            m.torso = box(0.44, 0.66, 0.26, 0x2e8b57, 0, 0.8, 0);
            m.leftLeg = box(0.2, 0.45, 0.2, 0x3cb043, -0.14, 0.22, 0.12);
            m.rightLeg = box(0.2, 0.45, 0.2, 0x3cb043, 0.14, 0.22, 0.12);
            m.backLeftLeg = box(0.2, 0.45, 0.2, 0x2e8b57, -0.14, 0.22, -0.12);
            m.backRightLeg = box(0.2, 0.45, 0.2, 0x2e8b57, 0.14, 0.22, -0.12);
        },
        loot(g, x, y, z) {
            g.spawnItemDrop(x, y, z, ITEM_TYPES.GUNPOWDER, _rnd(3) + 1);
            if (Math.random() < 0.25) g.spawnItemDrop(x, y, z, ITEM_TYPES.TNT, 1);
        }
    },
    piglin: {
        name: 'Незерський Піглін', ai: 'melee', hostile: true,
        height: 1.95, hp: 36, speed: 2.8, damage: 8, reach: 1.6, exp: 35,
        build(m, box) {
            m.head = box(0.55, 0.48, 0.5, 0xeea5a5, 0, 1.48, 0);
            m.torso = box(0.48, 0.68, 0.28, 0x8a4b23, 0, 0.9, 0);
            m.leftArm = box(0.2, 0.6, 0.2, 0xeea5a5, -0.35, 0.85, 0);
            m.rightArm = box(0.2, 0.6, 0.2, 0xeea5a5, 0.35, 0.85, 0);
            m.leftLeg = box(0.22, 0.65, 0.22, 0x5a2d12, -0.14, 0.32, 0);
            m.rightLeg = box(0.22, 0.65, 0.22, 0x5a2d12, 0.14, 0.32, 0);
            const sword = box(0.08, 0.45, 0.08, 0xf5c518, 0.35, 0.55, 0.2); // gold sword
            sword.rotation.x = -Math.PI / 4;
        },
        loot(g, x, y, z) {
            g.spawnItemDrop(x, y, z, ITEM_TYPES.GOLD_INGOT, _rnd(2) + 1);
            if (Math.random() < 0.4) g.spawnItemDrop(x, y, z, ITEM_TYPES.BLAZE_ROD, 1);
        }
    },
    enderman: {
        name: 'Ендер-Єблан', ai: 'enderman', hostile: true,
        height: 2.9, hp: 55, speed: 4.0, damage: 12, reach: 2.2, exp: 60,
        build(m, box) {
            m.head = box(0.38, 0.38, 0.38, 0x111111, 0, 2.65, 0);
            m.torso = box(0.36, 0.85, 0.2, 0x0a0a0a, 0, 2.05, 0);
            m.leftArm = box(0.12, 1.2, 0.12, 0x0a0a0a, -0.28, 1.7, 0);
            m.rightArm = box(0.12, 1.2, 0.12, 0x0a0a0a, 0.28, 1.7, 0);
            m.leftLeg = box(0.12, 1.45, 0.12, 0x0a0a0a, -0.12, 0.72, 0);
            m.rightLeg = box(0.12, 1.45, 0.12, 0x0a0a0a, 0.12, 0.72, 0);
            box(0.08, 0.04, 0.02, 0xda22ff, -0.09, 2.68, 0.2, true); // glowing eyes
            box(0.08, 0.04, 0.02, 0xda22ff, 0.09, 2.68, 0.2, true);
        },
        loot(g, x, y, z) {
            g.spawnItemDrop(x, y, z, ITEM_TYPES.ENDER_EYE, _rnd(2) + 1);
            if (Math.random() < 0.5) g.spawnItemDrop(x, y, z, ITEM_TYPES.END_STONE, 2);
        }
    },
    villager: {
        name: 'Житель села (Торгівець)', ai: 'villager', hostile: false,
        height: 1.95, hp: 30, speed: 1.6, damage: 0, reach: 1.5, exp: 15,
        build(m, box) {
            m.head = box(0.48, 0.52, 0.48, 0xd29676, 0, 1.5, 0);
            box(0.36, 0.08, 0.04, 0x4a2a16, 0, 1.58, 0.25); // unibrow
            m.nose = box(0.12, 0.22, 0.16, 0xb87b58, 0, 1.42, 0.3);
            box(0.08, 0.06, 0.02, 0x1f9933, -0.12, 1.52, 0.25, true);
            box(0.08, 0.06, 0.02, 0x1f9933, 0.12, 1.52, 0.25, true);
            m.torso = box(0.52, 0.72, 0.36, 0x8a5533, 0, 0.88, 0);
            m.foldedArms = box(0.60, 0.24, 0.28, 0x6e4024, 0, 0.86, 0.16);
            m.skirt = box(0.54, 0.38, 0.38, 0x7a4829, 0, 0.48, 0);
            m.leftLeg = box(0.2, 0.4, 0.2, 0x4e2c16, -0.13, 0.2, 0);
            m.rightLeg = box(0.2, 0.4, 0.2, 0x4e2c16, 0.13, 0.2, 0);
        },
        loot(g, x, y, z) {
            g.spawnItemDrop(x, y, z, ITEM_TYPES.EMERALD, _rnd(2) + 1);
            g.spawnItemDrop(x, y, z, ITEM_TYPES.APPLE, 2);
        }
    },
    // --- Passive farm animals ---
    pig: {
        name: 'Свиня', ai: 'animal', hostile: false, animal: true,
        height: 0.9, hp: 10, speed: 1.4, damage: 0, reach: 1, exp: 4, width: 0.7,
        build(m, box) {
            _buildQuadruped(m, box, { bw: 0.55, bh: 0.5, bl: 0.9, body: 0xf0a8a8, hw: 0.45, hh: 0.4, hl: 0.4, lw: 0.2, legH: 0.3 });
            box(0.22, 0.16, 0.06, 0xd98080, 0, 0.66, 0.83); // snout
        },
        loot(g, x, y, z) { g.spawnItemDrop(x, y, z, ITEM_TYPES.COOKED_STEAK, _rnd(2) + 1); }
    },
    cow: {
        name: 'Корова', ai: 'animal', hostile: false, animal: true,
        height: 1.4, hp: 14, speed: 1.2, damage: 0, reach: 1, exp: 5, width: 0.8,
        build(m, box) {
            _buildQuadruped(m, box, { bw: 0.65, bh: 0.65, bl: 1.1, body: 0x4a3a2c, hw: 0.5, hh: 0.5, hl: 0.4, lw: 0.2, legH: 0.55, headColor: 0x5a4636 });
            box(0.52, 0.3, 0.05, 0xf2f2f2, 0, 1.0, 0.91); // white muzzle
            box(0.02, 0.3, 0.3, 0xf2f2f2, -0.33, 0.95, 0.1); // patch
        },
        loot(g, x, y, z) { g.spawnItemDrop(x, y, z, ITEM_TYPES.COOKED_STEAK, _rnd(2) + 1); }
    },
    sheep: {
        name: 'Вівця', ai: 'animal', hostile: false, animal: true,
        height: 1.2, hp: 10, speed: 1.2, damage: 0, reach: 1, exp: 4, width: 0.7,
        build(m, box) {
            _buildQuadruped(m, box, { bw: 0.7, bh: 0.65, bl: 0.95, body: 0xf1f1f1, hw: 0.4, hh: 0.4, hl: 0.4, lw: 0.16, legH: 0.45, headColor: 0xc9b79a, legColor: 0xc9b79a });
        },
        loot(g, x, y, z) { g.spawnItemDrop(x, y, z, ITEM_TYPES.COOKED_STEAK, 1); }
    },
    chicken: {
        name: 'Курка', ai: 'animal', hostile: false, animal: true,
        height: 0.7, hp: 4, speed: 1.5, damage: 0, reach: 1, exp: 2, width: 0.4,
        build(m, box) {
            m.torso = box(0.3, 0.3, 0.4, 0xf4f4f4, 0, 0.4, 0);
            m.head = box(0.18, 0.28, 0.18, 0xf4f4f4, 0, 0.65, 0.2);
            box(0.1, 0.06, 0.1, 0xf0a020, 0, 0.62, 0.32); // beak
            box(0.06, 0.1, 0.06, 0xd22020, 0, 0.82, 0.2); // comb
            m.leftLeg = box(0.05, 0.25, 0.05, 0xf0a020, -0.08, 0.125, 0);
            m.rightLeg = box(0.05, 0.25, 0.05, 0xf0a020, 0.08, 0.125, 0);
        },
        loot(g, x, y, z) { g.spawnItemDrop(x, y, z, ITEM_TYPES.COOKED_STEAK, 1); }
    }
};
window.MOB_DEFS = MOB_DEFS;

// --- SKELETON ARROW (lives in MobManager.fireballs so it is updated/hidden/cleared with them) ---
const _arrowMat = new THREE.MeshBasicMaterial({ color: 0xd8d0b8 });
const _arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 0.6);
const _arrowTarget = new THREE.Vector3();
class MobArrow {
    constructor(x, y, z, dir, damage, scene, game) {
        this.scene = scene;
        this.game = game;
        this.damage = damage;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = dir.clone().multiplyScalar(22);
        this.age = 0;
        this.exploded = false;
        this.mesh = new THREE.Mesh(_arrowGeo, _arrowMat);
        this.mesh.position.copy(this.position);
        this.mesh.lookAt(_arrowTarget.copy(this.position).add(this.velocity));
        scene.add(this.mesh);
    }

    update(dt, player, world) {
        if (this.exploded) return;
        this.age += dt;
        if (this.age > 6) { this.destroy(); return; }
        this.velocity.y -= 4 * dt;
        this.position.addScaledVector(this.velocity, dt);
        this.mesh.position.copy(this.position);
        this.mesh.lookAt(_arrowTarget.copy(this.position).add(this.velocity));

        const dx = this.position.x - player.position.x;
        const dy = this.position.y - (player.position.y + 0.9);
        const dz = this.position.z - player.position.z;
        if (dx * dx + dy * dy + dz * dz < 0.64) {
            player.takeDamage(_mobDamage(this.game, this.damage), 'Тебе підстрелив Скелет-Єблан!');
            this.destroy();
            return;
        }
        const b = world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
        if (b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER) this.destroy();
    }

    destroy() {
        this.exploded = true;
        if (this.mesh) {
            this.scene.remove(this.mesh); // geometry/material are shared, never disposed
            this.mesh = null;
        }
    }
}
window.MobArrow = MobArrow;

// --- BASE MOB ENTITY ---
const _vToPlayer = new THREE.Vector3();
const _vPlayerLook = new THREE.Vector3();
const _vToMobNorm = new THREE.Vector3();
const _vTry = new THREE.Vector3();
const _vShot = new THREE.Vector3();

class MobEntity {
    constructor(type, x, y, z, scene, textureManager, soundManager, game) {
        this.type = type; // key of MOB_DEFS
        this.def = MOB_DEFS[type] || MOB_DEFS.zombie;
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.game = game;

        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;
        this.onGround = false;
        this.isDead = false;
        this.walkCycle = 0;
        this.hurtTimer = 0;
        this.attackCooldown = 0;
        this._tint = 0; // 0 normal, 1 red, 2 white
        this._sunTimer = Math.random() * 0.5;
        this._exposed = false;
        this.panicTimer = 0;
        this.hopTimer = 0.5 + Math.random();
        this.shootTimer = 1 + Math.random() * 1.5;

        this.setupStats();
        this.createMesh();
    }

    setupStats() {
        const d = this.def;
        this.width = d.width || 0.6;
        this.depth = this.width;
        this.height = d.height;
        this.maxHealth = d.hp;
        this.health = d.hp;
        this.speed = d.speed;
        this.damage = d.damage;
        this.reach = d.reach;
        this.expReward = d.exp;
        this.isPassive = !d.hostile;
        this.wanderTimer = Math.random() * 3;
        this.wanderDir = new THREE.Vector3();
        this.isAngry = false;
        if (d.ai === 'creeper') { this.fuseTimer = 0; this.isFusing = false; }
        if (d.ai === 'enderman') this.teleportCooldown = 0;
    }

    checkCollision(pos, world) {
        if (!world) return false;
        const hw = this.width / 2 - 0.02, hd = this.depth / 2 - 0.02;
        const minX = Math.floor(pos.x - hw), maxX = Math.floor(pos.x + hw);
        const minY = Math.floor(pos.y + 0.02), maxY = Math.floor(pos.y + this.height - 0.02);
        const minZ = Math.floor(pos.z - hd), maxZ = Math.floor(pos.z + hd);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const b = world.getBlock(x, y, z);
                    if (b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER && b !== BLOCK_TYPES.PORTAL_NETHER && b !== BLOCK_TYPES.PORTAL_END) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    createMesh() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this._meshes = [];

        // box(w,h,d,color,x,y,z[,unlit]) -> mesh already attached to the group
        const box = (w, h, d, color, x, y, z, unlit) => {
            const mat = unlit ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color });
            const mesh = new THREE.Mesh(_boxGeo(w, h, d), mat);
            mesh.position.set(x, y, z);
            mesh.castShadow = !unlit;
            mesh.receiveShadow = !unlit;
            if (!unlit) mesh.userData.origColor = color; // restored after hurt / fuse flashes
            this.group.add(mesh);
            if (!unlit) this._meshes.push(mesh);
            return mesh;
        };
        this.def.build(this, box);
        this.scene.add(this.group);
    }

    // Tint all lit parts. Cheap no-op when the state does not change.
    _setTint(mode) {
        if (this._tint === mode) return;
        this._tint = mode;
        const meshes = this._meshes;
        if (!meshes) return;
        for (let i = 0; i < meshes.length; i++) {
            const m = meshes[i];
            m.material.color.setHex(mode === 1 ? 0xff3333 : mode === 2 ? 0xffffff : m.userData.origColor);
        }
    }

    // Simple wander used by passive mobs; returns true while moving.
    _wander(dt, speed, idleChance) {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 2.5 + Math.random() * 4;
            if (Math.random() >= idleChance) {
                const a = Math.random() * Math.PI * 2;
                this.wanderDir.set(Math.sin(a), 0, Math.cos(a));
            } else {
                this.wanderDir.set(0, 0, 0);
            }
        }
        this.velocity.x = this.wanderDir.x * speed;
        this.velocity.z = this.wanderDir.z * speed;
        const moving = this.velocity.x !== 0 || this.velocity.z !== 0;
        if (moving) {
            this.yaw = Math.atan2(this.velocity.x, this.velocity.z);
            this.walkCycle += dt * (speed > 2 ? 8 : 5);
        }
        return moving;
    }

    update(dt, player, world) {
        if (this.isDead) return;

        // Hurt flash cooldown
        if (this.hurtTimer > 0) {
            this.hurtTimer -= dt;
            if (this.hurtTimer <= 0) this.resetColor();
        }
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.panicTimer > 0) this.panicTimer -= dt;

        const ai = this.def.ai;
        const toPlayer = _vToPlayer.subVectors(player.position, this.position);
        const dist = toPlayer.length();

        // Enderman player gaze / eye contact detection
        if (ai === 'enderman' && !this.isAngry && dist < 26 && player.camera) {
            player.camera.getWorldDirection(_vPlayerLook);
            const toMobNorm = _vToMobNorm.copy(toPlayer).negate().normalize();
            if (_vPlayerLook.dot(toMobNorm) > 0.95) {
                this.isAngry = true;
                if (this.soundManager) this.soundManager.playHurt();
            }
        }

        // Creeper swelling & explosion
        if (ai === 'creeper') {
            if (dist < 3.2) {
                if (!this.isFusing) {
                    this.isFusing = true;
                    if (this.soundManager) this.soundManager.playCreeperHiss();
                }
                this.fuseTimer += dt;
                this._setTint(Math.sin(this.fuseTimer * 20) > 0 ? 2 : 0);
                if (this.fuseTimer >= 1.5) {
                    this.explode(world, player);
                    return;
                }
            } else {
                this.isFusing = false;
                this.fuseTimer = Math.max(0, this.fuseTimer - dt * 1.5);
                if (this._tint === 2) this._setTint(0);
            }
        }

        // ---------------- AI ----------------
        // Spiders are neutral during the day until provoked.
        const dayCalm = this.def.neutralByDay && !this.isAngry && this._isDay();
        const hunts = (ai === 'enderman') ? (this.isAngry && dist < 38)
            : (ai === 'villager' || ai === 'animal') ? false
            : !dayCalm && dist < 34;

        if (this.isScriptBot) {
            const target = this.botFollowPlayer ? player.position : this.botTarget;
            this.velocity.x = this.velocity.z = 0;
            if (target) {
                const dx = target.x - this.position.x, dz = target.z - this.position.z;
                const distance = Math.hypot(dx, dz);
                const stopDistance = this.botFollowPlayer ? 2 : 0.25;
                if (distance > stopDistance) {
                    this.yaw = Math.atan2(dx, dz);
                    const speed = Math.min(this.speed, (distance - stopDistance) / Math.max(dt, 0.001));
                    this.velocity.x = dx / distance * speed;
                    this.velocity.z = dz / distance * speed;
                    this.walkCycle += dt * 8;
                } else if (!this.botFollowPlayer) {
                    this.botTarget = null;
                }
            }
        } else if (ai === 'ranged') {
            this._aiRanged(dt, player, world, toPlayer, dist, hunts);
        } else if (ai === 'slime') {
            this._aiSlime(dt, player, toPlayer, dist, hunts);
        } else if (hunts && dist > this.reach) {
            this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
            this.velocity.x = Math.sin(this.yaw) * this.speed;
            this.velocity.z = Math.cos(this.yaw) * this.speed;
            this.walkCycle += dt * 8;

            // Angry Enderman occasional flanking teleport if stuck
            if (ai === 'enderman') {
                this.teleportCooldown += dt;
                if (this.teleportCooldown > 12 && Math.random() < 0.04) this.teleportRandomly(player.position);
            }
        } else if (ai === 'villager') {
            // peaceful: watch player if close, or wander safely
            if (dist < 5.0) {
                this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
                this.velocity.x = this.velocity.z = 0;
            } else {
                this._wander(dt, this.speed, 0.4);
            }
        } else if (ai === 'animal') {
            if (this.panicTimer > 0) { // flee from the player
                this.yaw = Math.atan2(-toPlayer.x, -toPlayer.z);
                this.velocity.x = Math.sin(this.yaw) * this.speed * 2.2;
                this.velocity.z = Math.cos(this.yaw) * this.speed * 2.2;
                this.walkCycle += dt * 11;
            } else {
                this._wander(dt, this.speed, 0.55);
            }
        } else if (ai === 'enderman' && !this.isAngry) {
            this._wander(dt, 1.2, 0.5);
        } else if (dayCalm) {
            this._wander(dt, this.speed * 0.5, 0.5);
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
            if (dist <= this.reach && this.attackCooldown <= 0 && this.damage > 0 && ai !== 'creeper' && ai !== 'villager') {
                if (ai !== 'enderman' || this.isAngry) this.attackPlayer(player);
            }
        }

        // Leg walk animation (quadrupeds swing diagonal pairs, spiders roll legs)
        if (this.leftLeg && this.rightLeg) {
            const a = Math.sin(this.walkCycle) * 0.45;
            const axis = this.legRollAxis === 'z' ? 'z' : 'x';
            this.leftLeg.rotation[axis] = a;
            this.rightLeg.rotation[axis] = -a;
            if (this.backLeftLeg) {
                this.backLeftLeg.rotation[axis] = -a;
                this.backRightLeg.rotation[axis] = a;
            }
        }

        // Water reaction
        const footBlock = world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.1), Math.floor(this.position.z));
        const inWater = (footBlock === BLOCK_TYPES.WATER);
        if (inWater) {
            if (ai === 'enderman') {
                this.takeDamage(4);
                this.teleportRandomly(this.position);
                if (this.isDead) return;
            } else {
                this.velocity.y = Math.min(this.velocity.y + 14 * dt, 1.8);
                this.onGround = false;
            }
        }

        // --- HORIZONTAL MOVEMENT WITH AABB COLLISION & 1-BLOCK STEP-CLIMBING ---
        const pos = this.position;
        if (this.velocity.x !== 0) {
            const nx = pos.x + this.velocity.x * dt;
            _vTry.set(nx, pos.y, pos.z);
            if (!this.checkCollision(_vTry, world)) {
                pos.x = nx;
            } else if (this.onGround && (_vTry.y += 1.05, !this.checkCollision(_vTry, world))) {
                pos.x = nx;
                pos.y += 1.05;
            } else {
                this.velocity.x = 0;
            }
        }
        if (this.velocity.z !== 0) {
            const nz = pos.z + this.velocity.z * dt;
            _vTry.set(pos.x, pos.y, nz);
            if (!this.checkCollision(_vTry, world)) {
                pos.z = nz;
            } else if (this.onGround && (_vTry.y += 1.05, !this.checkCollision(_vTry, world))) {
                pos.z = nz;
                pos.y += 1.05;
            } else {
                this.velocity.z = 0;
            }
        }

        // --- VERTICAL MOVEMENT (GRAVITY & FLOOR/CEILING COLLISION) ---
        if (!inWater) {
            this.velocity.y -= 24 * dt;
            if (this.velocity.y < -30) this.velocity.y = -30;
        }
        const ny = pos.y + this.velocity.y * dt;
        _vTry.set(pos.x, ny, pos.z);
        if (!this.checkCollision(_vTry, world)) {
            pos.y = ny;
            this.onGround = false;
        } else {
            if (this.velocity.y < 0) {
                this.onGround = true;
                pos.y = Math.floor(ny) + 1.0; // land on the floor block without sinking
            }
            this.velocity.y = 0;
        }

        // Update mesh position & rotation
        this.group.position.copy(pos);
        this.group.rotation.y = this.yaw;

        // Void check & distance despawn
        if (pos.y < -15 || dist > 55) {
            this.die(false);
            return;
        }

        // Sunlight burn (zombies and skeletons, overworld daytime)
        if (this.def.burnsInDay && world.dimension === 'overworld') this._sunBurn(dt, world);
    }

    _isDay() {
        const t = this.game.timeOfDay;
        return t >= 0.15 && t <= 0.6;
    }

    _sunBurn(dt, world) {
        this._sunTimer -= dt;
        if (this._sunTimer <= 0) { // the sky scan only needs to run a couple of times per second
            this._sunTimer = 0.5;
            this._exposed = false;
            if (this._isDay()) {
                const bx = Math.floor(this.position.x), by = Math.floor(this.position.y), bz = Math.floor(this.position.z);
                this._exposed = true;
                for (let y = by + 2; y < 32; y++) {
                    if (world.getBlock(bx, y, bz) !== BLOCK_TYPES.AIR) { this._exposed = false; break; }
                }
            }
        }
        if (this._exposed) {
            this.health -= dt * 8;
            this._setTint(1);
            if (this.game.particleSystem && Math.random() < 0.3) {
                this.game.particleSystem.spawnBlockBreakParticles(this.position.x, this.position.y + 1, this.position.z, BLOCK_TYPES.LAVA, 2);
            }
            if (this.health <= 0) this.die(true);
        } else if (this._tint === 1 && this.hurtTimer <= 0) {
            this._setTint(0);
        }
    }

    // Skeleton: keeps its distance and shoots arrows.
    _aiRanged(dt, player, world, toPlayer, dist, hunts) {
        this.velocity.x = this.velocity.z = 0;
        if (!hunts || dist > 20) {
            this._wander(dt, this.speed * 0.5, 0.5);
            return;
        }
        this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
        const dirX = toPlayer.x / (dist || 1), dirZ = toPlayer.z / (dist || 1);
        let move = 0;
        if (dist < 6) move = -1;           // too close: back off
        else if (dist > 12) move = 1;      // too far: close in
        this.velocity.x = dirX * this.speed * move;
        this.velocity.z = dirZ * this.speed * move;
        if (move) this.walkCycle += dt * 8;

        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && dist < 18) {
            this.shootTimer = 1.8 + Math.random() * 0.8;
            const mgr = this.game.mobManager;
            if (mgr && this._hasLineOfSight(player, world)) {
                _vShot.set(player.position.x - this.position.x,
                    player.position.y + 1.1 - (this.position.y + 1.4),
                    player.position.z - this.position.z).normalize();
                mgr.fireballs.push(new MobArrow(this.position.x, this.position.y + 1.4, this.position.z,
                    _vShot, this.damage, this.scene, this.game));
            }
        }
    }

    _hasLineOfSight(player, world) {
        const ox = this.position.x, oy = this.position.y + 1.4, oz = this.position.z;
        const dx = player.position.x - ox, dy = player.position.y + 1.1 - oy, dz = player.position.z - oz;
        const steps = Math.ceil(Math.hypot(dx, dy, dz) / 0.8);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const b = world.getBlock(Math.floor(ox + dx * t), Math.floor(oy + dy * t), Math.floor(oz + dz * t));
            if (b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER) return false;
        }
        return true;
    }

    // Slime: only moves in hops, hurts on contact.
    _aiSlime(dt, player, toPlayer, dist, hunts) {
        if (this.onGround) {
            this.velocity.x = this.velocity.z = 0;
            this.hopTimer -= dt;
            if (this.hopTimer <= 0) {
                this.hopTimer = 0.7 + Math.random() * 0.7;
                this.velocity.y = 8;
                this.onGround = false;
                if (hunts) this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
                else this.yaw = Math.random() * Math.PI * 2;
                const s = hunts ? this.speed : this.speed * 0.5;
                this.velocity.x = Math.sin(this.yaw) * s;
                this.velocity.z = Math.cos(this.yaw) * s;
            }
        }
        // squash & stretch
        this.group.scale.y = 1 + Math.max(-0.3, Math.min(0.3, this.velocity.y * 0.03));
        if (hunts && dist <= this.reach && this.attackCooldown <= 0) this.attackPlayer(player);
    }

    attackPlayer(player) {
        this.attackCooldown = 1.3;
        player.takeDamage(_mobDamage(this.game, this.damage), `Тебе вбив ${this.getMobDisplayName()}!`);
        if (this.soundManager) {
            if (this.def.groan) this.soundManager.playZombieGroan();
            else this.soundManager.playHurt();
        }
    }

    takeDamage(amount, knockbackDir) {
        if (this.isDead) return;
        this.health -= amount;
        this.hurtTimer = 0.18;
        this._setTint(1);

        const ai = this.def.ai;
        if (ai === 'enderman' || this.def.neutralByDay) this.isAngry = true;
        if (ai === 'animal') this.panicTimer = 4;

        if (knockbackDir) {
            this.velocity.x = knockbackDir.x * 11;
            this.velocity.y = 5.2;
            this.velocity.z = knockbackDir.z * 11;
        }

        if (this.soundManager) this.soundManager.playHurt();

        // Enderman teleports away when hurt
        if (ai === 'enderman' && Math.random() < 0.75) this.teleportRandomly(this.position);

        if (this.health <= 0) this.die(true);
    }

    findSafeTeleportSpot(aroundPos) {
        const world = this.game.world;
        if (!world) return null;

        const dim = world.dimension || 'overworld';
        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 6 + Math.random() * 12;
            const tx = Math.floor(aroundPos.x + Math.cos(angle) * radius);
            const tz = Math.floor(aroundPos.z + Math.sin(angle) * radius);

            // Chunk must be present and generated!
            const chunk = world.getChunk(Math.floor(tx / 16), Math.floor(tz / 16));
            if (!chunk || !chunk.isGenerated) continue;

            let startY, minY;
            if (dim === 'nether') {
                startY = Math.min(20, Math.floor(aroundPos.y) + 6);
                minY = 5;
            } else if (dim === 'the_end') {
                startY = 24;
                minY = 8;
            } else {
                startY = Math.min(28, Math.max(Math.floor(aroundPos.y) + 6, 14));
                minY = Math.max(2, Math.floor(aroundPos.y) - 6);
            }

            for (let y = startY; y >= minY; y--) {
                const floorBlock = world.getBlock(tx, y, tz);
                if (floorBlock === BLOCK_TYPES.AIR || floorBlock === BLOCK_TYPES.WATER || floorBlock === BLOCK_TYPES.LAVA) continue;

                // Headroom check: 3 blocks of AIR required for Enderman!
                if (world.getBlock(tx, y + 1, tz) === BLOCK_TYPES.AIR &&
                    world.getBlock(tx, y + 2, tz) === BLOCK_TYPES.AIR &&
                    world.getBlock(tx, y + 3, tz) === BLOCK_TYPES.AIR) {
                    const candidatePos = new THREE.Vector3(tx + 0.5, y + 1.0, tz + 0.5);
                    if (!this.checkCollision(candidatePos, world)) return candidatePos;
                }
            }
        }
        return null;
    }

    teleportRandomly(aroundPos) {
        const spot = this.findSafeTeleportSpot(aroundPos || this.position);
        if (!spot) return false;

        const ps = this.game.particleSystem;
        if (ps) ps.spawnBlockBreakParticles(this.position.x, this.position.y + 1, this.position.z, BLOCK_TYPES.PORTAL_END, 8);

        this.position.copy(spot);
        this.velocity.set(0, 0, 0);
        this.group.position.copy(this.position);
        this.teleportCooldown = 0;

        if (ps) ps.spawnBlockBreakParticles(spot.x, spot.y + 1, spot.z, BLOCK_TYPES.PORTAL_END, 12);
        if (this.soundManager) this.soundManager.playPortalWarp();
        return true;
    }

    explode(world, player) {
        const cx = Math.floor(this.position.x);
        const cy = Math.floor(this.position.y);
        const cz = Math.floor(this.position.z);

        // Shared room: the server owns the blast (terrain, damage to every player), we only show it.
        const net = this.game.serverClient;
        if (net?.engineAuthority) {
            net.sendRaw({ type: 'mob_explode', x: this.position.x, y: this.position.y, z: this.position.z });
            this.die(false);
            return;
        }
        this.game.multiplayer?.broadcastExplosion?.(this.position.x, this.position.y, this.position.z, 2.4, true);
        // Break blocks around creeper
        const r = 2;
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (dx * dx + dy * dy + dz * dz <= r * r + 1) {
                        const bx = cx + dx, by = cy + dy, bz = cz + dz;
                        const b = world.getBlock(bx, by, bz);
                        if (b !== BLOCK_TYPES.BEDROCK && b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER) {
                            if (window.modManager && !window.modManager.canExplodeBlock(bx, by, bz, b)) continue;
                            world.setBlock(bx, by, bz, BLOCK_TYPES.AIR);
                        }
                    }
                }
            }
        }
        world.updateMeshes();

        // Deal damage to player
        const dist = player.position.distanceTo(this.position);
        if (dist < 5.0) {
            const dmg = Math.max(10, Math.floor((5.0 - dist) * 14));
            player.takeDamage(dmg, "Підірвався на Кріпері-Єблані!");
        }

        if (this.game.particleSystem) this.game.particleSystem.spawnExplosionParticles(this.position.x, this.position.y, this.position.z, 50);
        if (this.soundManager) this.soundManager.playExplosion();

        this.die(false);
    }

    die(dropLoot = true) {
        if (this.isDead) return;
        this.isDead = true;

        if (this.game.particleSystem) {
            this.game.particleSystem.spawnExplosionParticles(this.position.x, this.position.y + 0.8, this.position.z, 15);
        }

        if (dropLoot && !this.isScriptBot && this.game.mobManager) {
            this.dropMobLoot();
            if (this.def.onDeath) this.def.onDeath(this, this.game.mobManager);
            if (this.game.player) this.game.player.iq += this.expReward;
        }

        if (this.group) {
            this.scene.remove(this.group);
            // geometries are shared (cached); only the per-mob materials are released
            this.group.traverse((c) => { if (c.isMesh && c.material) c.material.dispose(); });
            this.group = null;
        }
    }

    dropMobLoot() {
        if (!this.def.loot) return;
        const net = _coopMobs(this.game);
        const drop = () => this.def.loot(this.game.mobManager, this.position.x, this.position.y + 0.5, this.position.z);
        // Shared room: loot is dropped for everyone through the server, not just at the mob owner's feet.
        if (net) net.shareLoot(this.game.mobManager, drop); else drop();
    }

    interact(player) {
        if (this.type === 'villager' && !this.isDead) {
            if (this.soundManager) {
                if (this.soundManager.playVillagerHrmm) this.soundManager.playVillagerHrmm();
                else this.soundManager.playClick();
            }
            if (this.game.ui && this.game.ui.openVillagerTrading) {
                this.game.ui.openVillagerTrading(this);
            }
        }
    }

    // Kept for mods / older callers
    setFlashRed(flash) { this._setTint(flash ? 1 : 0); }
    setFlashWhite(flash) { this._setTint(flash ? 2 : 0); }
    resetColor() { if (this._tint === 1) this._setTint(0); }

    getMobDisplayName() {
        return this.def.name || 'Моб';
    }
}

// --- EBLAN DRAGON FIREBALL ---
class DragonFireball {
    constructor(x, y, z, targetDir, scene, game) {
        this.scene = scene;
        this.game = game;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = targetDir.clone().multiplyScalar(14);
        this.age = 0;
        this.exploded = false;

        const geom = new THREE.SphereGeometry(0.4, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xc422ff });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    update(dt, player, world) {
        if (this.exploded) return;
        // Mirrored from the host: just follow its position, damage is the host's business.
        if (this.isPuppet) {
            if (this.target) this.position.lerp(this.target, Math.min(1, dt * 20));
            if (this.mesh) this.mesh.position.copy(this.position);
            return;
        }
        this.age += dt;
        if (this.age > 8) {
            this.destroy();
            return;
        }

        this.position.addScaledVector(this.velocity, dt);
        this.mesh.position.copy(this.position);

        // Check impact with player
        const dist = this.position.distanceTo(player.position);
        if (dist < 1.4) {
            player.takeDamage(35, "Знищений вогняним шаром Єблан Дракона!");
            this.explode();
            return;
        }

        // Check block collision
        const bx = Math.floor(this.position.x);
        const by = Math.floor(this.position.y);
        const bz = Math.floor(this.position.z);
        const b = world.getBlock(bx, by, bz);
        if (b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER) {
            this.explode();
        }
    }

    explode() {
        if (this.exploded) return;
        this.exploded = true;
        if (this.game.particleSystem) {
            this.game.particleSystem.spawnExplosionParticles(this.position.x, this.position.y, this.position.z, 30);
        }
        if (this.game.soundManager) {
            this.game.soundManager.playExplosion();
        }
        this.destroy();
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}

// --- EBLAN DRAGON BOSS ---
class EblanDragonBoss {
    constructor(scene, textureManager, soundManager, game) {
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.game = game;

        this.maxHealth = 1000;
        this.health = 1000;
        this.isDead = false;

        this.center = new THREE.Vector3(0, 24, 0);
        this.angle = 0;
        this.orbitRadius = 24;
        this.orbitSpeed = 0.55;
        this.verticalOffset = 0;
        this.diveTimer = 0;
        this.isDiving = false;
        this.fireballTimer = 0;
        this.wingFlap = 0;

        this.createDragonMesh();
        this.soundManager.speakRandomMeme(["Увага, Єблан Дракон прокинувся!", "Зараз тобі буде гаплик!"]);
    }

    createDragonMesh() {
        this.mesh = new THREE.Group();
        const createPart = (w, h, d, color) => {
            const geom = new THREE.BoxGeometry(w, h, d);
            const mat = new THREE.MeshLambertMaterial({ color });
            return new THREE.Mesh(geom, mat);
        };

        // 1. Massive Body
        this.body = createPart(2.2, 1.6, 4.2, 0x160a22); // dark purple-black
        this.mesh.add(this.body);

        // 2. Neck & Head
        this.neck = createPart(1.0, 1.0, 2.0, 0x1d0d2e);
        this.neck.position.set(0, 0.4, 2.8);
        this.head = createPart(1.4, 1.1, 1.8, 0x27103d);
        this.head.position.set(0, 0.5, 4.2);

        // Glowing purple eyes
        const eyeGeom = new THREE.BoxGeometry(0.2, 0.15, 0.08);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xda22ff });
        const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
        eyeL.position.set(-0.55, 0.7, 4.9);
        const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
        eyeR.position.set(0.55, 0.7, 4.9);

        // Dragon Horns
        const hornL = createPart(0.2, 0.8, 0.2, 0x8a1db5);
        hornL.position.set(-0.45, 1.2, 3.8);
        hornL.rotation.x = -0.4;
        const hornR = createPart(0.2, 0.8, 0.2, 0x8a1db5);
        hornR.position.set(0.45, 1.2, 3.8);
        hornR.rotation.x = -0.4;

        this.mesh.add(this.neck, this.head, eyeL, eyeR, hornL, hornR);

        // 3. Flapping Wings (Left & Right)
        this.leftWingGroup = new THREE.Group();
        this.leftWingGroup.position.set(-1.1, 0.5, 0);
        this.leftWing = createPart(3.8, 0.12, 2.4, 0x3d1259);
        this.leftWing.position.set(-1.9, 0, 0);
        this.leftWingGroup.add(this.leftWing);

        this.rightWingGroup = new THREE.Group();
        this.rightWingGroup.position.set(1.1, 0.5, 0);
        this.rightWing = createPart(3.8, 0.12, 2.4, 0x3d1259);
        this.rightWing.position.set(1.9, 0, 0);
        this.rightWingGroup.add(this.rightWing);

        this.mesh.add(this.leftWingGroup, this.rightWingGroup);

        // 4. Tail
        this.tail = createPart(0.8, 0.7, 3.2, 0x1d0d2e);
        this.tail.position.set(0, 0.1, -3.2);
        this.mesh.add(this.tail);

        this.mesh.position.set(0, 24, 0);
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });
        this.scene.add(this.mesh);
    }

    // Shared world guest: follow the host's dragon, no AI, no attacks.
    updatePuppet(dt) {
        if (this.isDead || !this.mesh) return;
        this.wingFlap += dt * 5.0;
        const flap = Math.sin(this.wingFlap) * 0.45;
        this.leftWingGroup.rotation.z = flap;
        this.rightWingGroup.rotation.z = -flap;
        const t = this.target;
        if (t) {
            const k = 1 - Math.exp(-10 * dt);
            this.mesh.position.lerp(new THREE.Vector3(t.x, t.y, t.z), k);
            this.mesh.quaternion.slerp(new THREE.Quaternion(t.q[0], t.q[1], t.q[2], t.q[3]), k);
        }
    }

    update(dt, player, fireballsList) {
        if (this.isPuppet) return this.updatePuppet(dt);
        if (this.isDead) return;

        // Wing flapping
        this.wingFlap += dt * 5.0;
        const flapAngle = Math.sin(this.wingFlap) * 0.45;
        this.leftWingGroup.rotation.z = flapAngle;
        this.rightWingGroup.rotation.z = -flapAngle;

        // Boss AI: State machine (Circling or Swoop Dive)
        this.diveTimer += dt;
        this.fireballTimer += dt;

        if (this.diveTimer > 16) {
            this.isDiving = true;
            if (this.diveTimer > 22) {
                this.isDiving = false;
                this.diveTimer = 0;
            }
        }

        if (this.isDiving) {
            // Swoop dive straight towards player!
            const target = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            const dir = new THREE.Vector3().subVectors(target, this.mesh.position).normalize();
            this.mesh.position.addScaledVector(dir, 16 * dt);
            this.mesh.lookAt(target);

            // Collide with player
            if (this.mesh.position.distanceTo(player.position) < 3.5) {
                player.takeDamage(45, "Збитий з ніг тушею Єблан Дракона!");
                this.isDiving = false;
                this.diveTimer = 0;
                if (this.soundManager) this.soundManager.speakRandomMeme(["На, отримуй!", "Куди лізеш, єблан?"]);
            }
        } else {
            // Circling orbit above End Island
            this.angle += dt * this.orbitSpeed;
            this.verticalOffset = Math.sin(this.angle * 1.5) * 3.5;

            const nextX = Math.cos(this.angle) * this.orbitRadius;
            const nextZ = Math.sin(this.angle) * this.orbitRadius;
            const targetPos = new THREE.Vector3(nextX, 22 + this.verticalOffset, nextZ);

            this.mesh.lookAt(targetPos);
            this.mesh.position.lerp(targetPos, 0.08);
        }

        // Shoot explosive fireballs towards player periodically
        if (this.fireballTimer > 4.5 && !this.isDiving) {
            this.fireballTimer = 0;
            const headPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 2.0));
            const dir = new THREE.Vector3().subVectors(player.position, headPos).normalize();
            fireballsList.push(new DragonFireball(headPos.x, headPos.y, headPos.z, dir, this.scene, this.game));
            if (this.soundManager) this.soundManager.playDragonRoar();
        }
    }

    heal(amount) {
        if (this.isDead) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;

        if (this.soundManager) this.soundManager.playDragonRoar();

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;

        if (this.soundManager) {
            this.soundManager.playExplosion();
            this.soundManager.speakRandomMeme([
                "ЄБЛАН ДРАКОН ПОВЕРЖЕНИЙ!",
                "ТАК! ТИ ПЕРЕМІГ ДРАКОНА!",
                "ТИ ТЕПЕР СПРАВЖНІЙ ГІГА-ЄБЛАН ВСЕСВІТУ!"
            ]);
        }

        // Spawn Dragon drops at island center
        const mgr = this.game.mobManager;
        if (mgr) {
            const drops = () => {
                mgr.spawnItemDrop(0, 16, 0, ITEM_TYPES.DRAGON_EGG, 1);
                mgr.spawnItemDrop(1, 16, 0, ITEM_TYPES.CASE_DRAGON, 1);
                mgr.spawnItemDrop(-1, 16, 0, ITEM_TYPES.NETHERITE_BLOCK, 4);
                mgr.spawnItemDrop(0, 16, 1, ITEM_TYPES.EBLAN_BLOCK, 8);
            };
            const net = _coopMobs(this.game);
            if (net) net.shareLoot(mgr, drops); else drops();   // shared world: the whole room gets the rewards
        }

        // Activate End Exit Portal in fountain
        if (this.game.world && this.game.world.activateEndExitPortal) {
            this.game.world.activateEndExitPortal(0, 14, 0);
        }

        // Reward player IQ
        if (this.game.player) {
            this.game.player.iq += 1000;
        }

        // Remove mesh after grand explosion
        if (this.game.particleSystem) {
            for (let i = 0; i < 6; i++) {
                setTimeout(() => {
                    if (this.mesh) {
                        this.game.particleSystem.spawnExplosionParticles(
                            this.mesh.position.x + (Math.random() - 0.5) * 6,
                            this.mesh.position.y + (Math.random() - 0.5) * 4,
                            this.mesh.position.z + (Math.random() - 0.5) * 6,
                            60
                        );
                    }
                }, i * 350);
            }
        }

        setTimeout(() => {
            if (this.mesh) {
                this.scene.remove(this.mesh);
                this.mesh = null;
            }
            // Spawn Victory Portal to Overworld at center!
            if (this.game.world) {
                this.game.world.setBlock(0, 13, 0, BLOCK_TYPES.PORTAL_END);
                this.game.world.updateMeshes();
            }
        }, 2200);
    }
}

// --- MOB MANAGER (MANAGES ALL MOBS, DROPS & BOSSES) ---
// The shared-world mob link for this session: a server room, a P2P shared world, or none.
function _coopMobs(game) {
    const sc = game.serverClient;
    if (sc?.engineAuthority) return sc.coopMobs;
    return game.multiplayer?.netSyncActive ? game.multiplayer.mobs : null;
}

class MobManager {
    constructor(scene, textureManager, soundManager, game) {
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.game = game;

        this.mobs = [];
        this.itemDrops = [];
        this.crystals = [];
        this.crystalSeq = 0;
        this.fireballs = [];
        this.dragon = null;
        this.spawnTimer = 0;
    }

    // Remove the dragon and its fireballs (not the crystals, which are part of the End terrain).
    clearBoss() {
        for (const f of this.fireballs) f.destroy();
        this.fireballs = [];
        if (this.dragon?.mesh) this.scene.remove(this.dragon.mesh);
        this.dragon = null;
    }

    clearAll() {
        this.crystalSeq = 0;
        for (let m of this.mobs) m.die(false);
        this.mobs = [];
        for (let d of this.itemDrops) d.destroy();
        this.itemDrops = [];
        for (let c of this.crystals) c.destroy();
        this.crystals = [];
        for (let f of this.fireballs) f.destroy();
        this.fireballs = [];
        if (this.dragon && this.dragon.mesh) {
            this.scene.remove(this.dragon.mesh);
            this.dragon = null;
        }
    }

    spawnItemDrop(x, y, z, itemId, count = 1, pickupDelay = 0.35, velocity = null) {
        if (!itemId || count <= 0) return null;
        // Co-op: loot from a mob killed by another player is dropped for the whole room via the server.
        if (this._lootSink && this._lootSink(x, y, z, itemId, count)) return null;

        // Try merging with existing nearby drop of same item (eliminates mesh clutter and lag)
        const maxStack = (window.ITEM_REGISTRY && window.ITEM_REGISTRY[itemId] && window.ITEM_REGISTRY[itemId].maxStack) || 64;
        for (let i = 0; i < this.itemDrops.length; i++) {
            const d = this.itemDrops[i];
            if (!d.pickedUp && d.mesh && d.itemId === itemId && d.count < maxStack) {
                const dx = d.position.x - x;
                const dy = d.position.y - y;
                const dz = d.position.z - z;
                if (dx * dx + dy * dy + dz * dz < 2.5) { // within ~1.5 blocks
                    const space = maxStack - d.count;
                    const toAdd = Math.min(space, count);
                    d.count += toAdd;
                    d.age = 0;
                    d.pickupDelay = Math.max(d.pickupDelay, pickupDelay);
                    count -= toAdd;
                    if (count <= 0) return d;
                }
            }
        }

        // Hard cap active item drops in world to prevent any lag
        if (this.itemDrops.length >= 60) {
            const oldest = this.itemDrops.shift();
            if (oldest) oldest.destroy();
        }

        const drop = new ItemDrop(x, y, z, itemId, count, this.scene, this.textureManager, this.soundManager, {
            pickupDelay,
            velocity
        });
        this.itemDrops.push(drop);
        return drop;
    }

    spawnMob(type, x, y, z) {
        const mob = new MobEntity(type, x, y, z, this.scene, this.textureManager, this.soundManager, this.game);
        this.mobs.push(mob);
        return mob;
    }

    getBot(id) {
        return this.mobs.find(m => m.isScriptBot && m.botId === String(id) && !m.isDead) || null;
    }

    spawnBot(id, x, y, z) {
        id = String(id || '').trim();
        const coordinates = [x, y, z].map(Number);
        if (this.game.arenaClient?.isActive || !id || id.length > 64 ||
            !coordinates.every(Number.isFinite) || this.getBot(id) ||
            this.mobs.filter(m => m.isScriptBot && !m.isDead).length >= 32) return false;
        if (coordinates[1] < 1 || coordinates[1] > 30) return false;
        const mob = this.spawnMob('villager', ...coordinates);
        if (mob.checkCollision(mob.position, this.game.world)) {
            mob.die(false);
            this.mobs.splice(this.mobs.indexOf(mob), 1);
            return false;
        }
        mob.isScriptBot = true;
        mob.botId = id;
        mob.speed = 3;
        mob.damage = 8;
        return id;
    }

    commandBot(id, action, ...args) {
        if (this.game.arenaClient?.isActive) return false;
        const bot = this.getBot(id);
        if (!bot) return false;
        if (action === 'moveTo') {
            const coords = args.slice(0, 3).map(Number);
            if (coords.length !== 3 || !coords.every(Number.isFinite) || coords[1] < 1 || coords[1] > 30) return false;
            bot.botTarget = new THREE.Vector3(...coords);
            bot.botFollowPlayer = false;
        } else if (action === 'followPlayer' || action === 'stop') {
            bot.botFollowPlayer = action === 'followPlayer';
            bot.botTarget = null;
            bot.velocity.x = bot.velocity.z = 0;
        } else if (action === 'setSpeed') {
            const speed = Number(args[0]);
            if (!Number.isFinite(speed)) return false;
            bot.speed = Math.max(0, Math.min(8, speed));
        } else if (action === 'jump') {
            if (!bot.onGround) return false;
            bot.velocity.y = 7;
            bot.onGround = false;
        } else if (action === 'attack') {
            const target = String(args[0]) === 'player' ? this.game.player : this.getBot(args[0]);
            if (!target || target === bot || target.isDead || bot.attackCooldown > 0 ||
                bot.position.distanceTo(target.position) > 2.2) return false;
            const regions = this.game.modManager?.regionManager;
            if (regions && !regions.isAllowed(null, target.position.x, target.position.y, target.position.z, 'pvp')) return false;
            // A melee attack cannot pass through a wall.
            const origin = bot.position.clone().add(new THREE.Vector3(0, 1, 0));
            const destination = target.position.clone().add(new THREE.Vector3(0, 1, 0));
            for (let t = 0.1; t < 1; t += 0.1) {
                const point = origin.clone().lerp(destination, t);
                const block = this.game.world.getBlock(Math.floor(point.x), Math.floor(point.y), Math.floor(point.z));
                if (block !== BLOCK_TYPES.AIR && block !== BLOCK_TYPES.WATER) return false;
            }
            bot.attackCooldown = 1.3;
            target.takeDamage(bot.damage, target === this.game.player ? 'Атака програмованого бота' : undefined);
        } else if (action === 'remove') {
            bot.die(false);
            this.mobs.splice(this.mobs.indexOf(bot), 1);
        } else {
            return false;
        }
        return true;
    }

    clearBots() {
        for (const bot of this.mobs.filter(m => m.isScriptBot)) {
            if (!bot.isDead) bot.die(false);
        }
        this.mobs = this.mobs.filter(m => !m.isScriptBot);
    }

    spawnEndCrystal(x, y, z) {
        const cr = new EndCrystal(x, y, z, this.scene, this.textureManager, this.soundManager, this.game);
        cr.netId = this.crystalSeq++;
        this.crystals.push(cr);
        return cr;
    }

    spawnDragon() {
        if (this.dragon && this.dragon.mesh) return;
        if (this.game.serverClient?.engineAuthority) return; // server rooms do not run the boss
        // A guest in a shared world mirrors the host's dragon instead of running a second one.
        const net = _coopMobs(this.game);
        if (net && net.role() === 'puppet') return;
        this.dragon = new EblanDragonBoss(this.scene, this.textureManager, this.soundManager, this.game);
    }

    spawnPuppetDragon() {
        this.dragon = new EblanDragonBoss(this.scene, this.textureManager, this.soundManager, this.game);
        this.dragon.isPuppet = true;
        return this.dragon;
    }

    applyCreativeMobSetting(player = this.game.player) {
        const disabled = !!player?.isCreative && this.game.creativeMobsEnabled !== true;
        this.creativeMobsDisabled = disabled;
        for (const entity of [...this.mobs, ...this.crystals, ...this.fireballs, ...(this.dragon ? [this.dragon] : [])]) {
            const object = entity.group || entity.mesh;
            if (!object) continue;
            if (disabled) {
                if (entity._creativeWasVisible === undefined) entity._creativeWasVisible = object.visible;
                object.visible = false;
            } else if (entity._creativeWasVisible !== undefined) {
                object.visible = entity._creativeWasVisible;
                delete entity._creativeWasVisible;
            }
        }
        return disabled;
    }

    update(dt, player, world) {
        const disabled = this.applyCreativeMobSetting(player);
        // Co-op rooms share mobs: one client per dimension simulates them, the rest show puppets.
        const net = _coopMobs(this.game);
        const role = net ? net.role() : 'solo';
        // Spawn mobs periodically based on dimension (controlled mob cap)
        const canSpawn = !disabled && role !== 'puppet' && role !== 'pending';
        if (canSpawn) this.spawnTimer += dt;
        if (canSpawn && this.spawnTimer > 9) {
            this.spawnTimer = 0;
            this.handlePeriodicSpawns(role === 'owner' ? net.randomTarget(player) : player, world);
        }

        // Update mobs with distance throttling (Optimization)
        const px = player ? player.position.x : 0;
        const pz = player ? player.position.z : 0;

        for (let i = this.mobs.length - 1; !disabled && i >= 0; i--) {
            const m = this.mobs[i];
            let target = player;
            if (role !== 'solo' && !m.isScriptBot) {
                if (role === 'owner' && !m.isPuppet) target = net.nearestTarget(m.position, player);
                else if (role === 'puppet' && m.isPuppet) { net.updatePuppet(m, dt); if (m.isDead) this.mobs.splice(i, 1); continue; }
                else { m.die(false); this.mobs.splice(i, 1); continue; } // stray local mob: the owner's copy is the real one
            }
            const distSq = (m.position.x - px) ** 2 + (m.position.z - pz) ** 2;
            if (distSq > 3600) { // > 60 blocks away
                m.tickCounter = (m.tickCounter || 0) + 1;
                if (m.tickCounter % 5 !== 0) continue;
            } else if (distSq > 1024) { // > 32 blocks away
                m.tickCounter = (m.tickCounter || 0) + 1;
                if (m.tickCounter % 2 !== 0) continue;
            }
            m.update(dt, target, world);
            if (m.isDead) {
                this.mobs.splice(i, 1);
            }
        }
        if (role === 'owner' && !disabled) net.tickOwner(this, dt);

        // Update item drops with distance throttling
        for (let i = this.itemDrops.length - 1; i >= 0; i--) {
            const d = this.itemDrops[i];
            const distSq = (d.position.x - px) ** 2 + (d.position.z - pz) ** 2;
            if (distSq > 1600) { // > 40 blocks away
                d.tickCounter = (d.tickCounter || 0) + 1;
                if (d.tickCounter % 4 !== 0) continue;
            }
            d.update(dt, player, world);
            if (d.pickedUp || d.age > d.maxAge) {
                this.itemDrops.splice(i, 1);
            }
        }

        if (disabled) return;

        // Update End crystals
        for (let i = this.crystals.length - 1; i >= 0; i--) {
            const c = this.crystals[i];
            c.update(dt, this.dragon);
            if (c.isDestroyed) {
                this.crystals.splice(i, 1);
            }
        }

        // Update fireballs
        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const f = this.fireballs[i];
            f.update(dt, role === 'owner' && !f.isPuppet ? net.nearestTarget(f.position, player) : player, world);
            if (f.exploded || f.age > 8) {
                this.fireballs.splice(i, 1);
            }
        }

        // Update dragon
        if (this.dragon) {
            const bossTarget = role === 'owner' && this.dragon.mesh && !this.dragon.isPuppet
                ? net.nearestTarget(this.dragon.mesh.position, player) : player;
            this.dragon.update(dt, bossTarget, this.fireballs);
            if (this.dragon.isDead && !this.dragon.mesh) {
                this.dragon = null;
            }
        }
    }

    handlePeriodicSpawns(player, world) {
        const dim = world.dimension || 'overworld';
        const angle = Math.random() * Math.PI * 2;
        const radius = 16 + Math.random() * 14;
        const sx = Math.floor(player.position.x + Math.cos(angle) * radius);
        const sz = Math.floor(player.position.z + Math.sin(angle) * radius);

        // Check if chunk is loaded and generated!
        const cx = Math.floor(sx / 16);
        const cz = Math.floor(sz / 16);
        const chunk = world.getChunk(cx, cz);
        if (!chunk || !chunk.isGenerated) return;

        let sy = -1;
        let startY = 28;
        let minY = 2;

        if (dim === 'nether') {
            startY = 20;
            minY = 5;
        } else if (dim === 'the_end') {
            startY = 24;
            minY = 8;
        } else {
            startY = 28;
            minY = 2;
        }

        // Search for solid floor with at least 3 blocks of clear air headroom
        for (let y = startY; y >= minY; y--) {
            const b = world.getBlock(sx, y, sz);
            if (b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER && b !== BLOCK_TYPES.LAVA) {
                const b1 = world.getBlock(sx, y + 1, sz);
                const b2 = world.getBlock(sx, y + 2, sz);
                const b3 = world.getBlock(sx, y + 3, sz);
                if (b1 === BLOCK_TYPES.AIR && b2 === BLOCK_TYPES.AIR && b3 === BLOCK_TYPES.AIR) {
                    sy = y + 1;
                    break;
                }
            }
        }

        if (sy === -1) return; // No safe floor found! Do not spawn inside stone or void!

        // Separate caps: scripted bots / villagers never block natural spawns
        let hostile = 0, animals = 0;
        for (let i = 0; i < this.mobs.length; i++) {
            const m = this.mobs[i];
            if (m.isScriptBot || m.isDead) continue;
            if (m.def.hostile) hostile++;
            else if (m.def.animal) animals++;
        }
        const pick = (table) => {
            let r = Math.random() * table.reduce((a, e) => a + e[1], 0);
            for (const [type, w] of table) { if ((r -= w) <= 0) return type; }
            return table[0][0];
        };

        if (dim === 'overworld') {
            const isNight = (this.game.timeOfDay > 0.6 || this.game.timeOfDay < 0.15);
            if (!isNight) {
                // Peaceful day: animals graze on the grass, only rare cave mobs below the surface
                if (sy >= 10) {
                    if (animals < 8 && world.getBlock(sx, sy - 1, sz) === BLOCK_TYPES.GRASS && Math.random() < 0.7) {
                        const type = pick([['pig', 3], ['cow', 3], ['sheep', 3], ['chicken', 2]]);
                        const n = type === 'chicken' ? 3 : 2;
                        for (let k = 0; k < n && animals + k < 8; k++) {
                            this.spawnMob(type, sx + 0.5 + (Math.random() - 0.5) * 3, sy, sz + 0.5 + (Math.random() - 0.5) * 3);
                        }
                    }
                } else if (hostile < 3 && Math.random() < 0.3) {
                    this.spawnMob(pick([['zombie', 4], ['skeleton', 3], ['spider', 3], ['slime', 2]]), sx + 0.5, sy, sz + 0.5);
                }
                return;
            }

            // Night: a bit more variety, still capped
            if (hostile < 6 && Math.random() < 0.7) {
                this.spawnMob(pick([['zombie', 35], ['skeleton', 22], ['spider', 20], ['creeper', 13], ['slime', 6], ['enderman', 4]]),
                    sx + 0.5, sy, sz + 0.5);
            }
        } else if (dim === 'nether') {
            if (hostile < 6 && Math.random() < 0.6) this.spawnMob('piglin', sx + 0.5, sy, sz + 0.5);
        } else if (dim === 'the_end') {
            if (hostile < 6 && Math.random() < 0.5) this.spawnMob('enderman', sx + 0.5, sy, sz + 0.5);
        }
    }
}

window.ItemDrop = ItemDrop;
window.EndCrystal = EndCrystal;
window.MobEntity = MobEntity;
window.DragonFireball = DragonFireball;
window.EblanDragonBoss = EblanDragonBoss;
window.MobManager = MobManager;

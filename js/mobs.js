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

// --- BASE MOB ENTITY ---
const _vToPlayer = new THREE.Vector3();
const _vPlayerLook = new THREE.Vector3();
const _vToMobNorm = new THREE.Vector3();

class MobEntity {
    constructor(type, x, y, z, scene, textureManager, soundManager, game) {
        this.type = type; // 'zombie' | 'creeper' | 'piglin' | 'enderman'
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

        // Stats by mob type
        this.setupStats();
        this.createMesh();
    }

    setupStats() {
        this.width = 0.6;
        this.depth = 0.6;
        this.wanderTimer = Math.random() * 3;
        this.wanderDir = new THREE.Vector3();
        this.isAngry = false;

        switch (this.type) {
            case 'zombie':
                this.height = 1.95;
                this.maxHealth = 28;
                this.health = 28;
                this.speed = 2.0;
                this.damage = 5;
                this.reach = 1.5;
                this.expReward = 20;
                break;
            case 'creeper':
                this.height = 1.7;
                this.maxHealth = 24;
                this.health = 24;
                this.speed = 2.3;
                this.damage = 22;
                this.reach = 1.8;
                this.fuseTimer = 0;
                this.isFusing = false;
                this.expReward = 30;
                break;
            case 'piglin':
                this.height = 1.95;
                this.maxHealth = 36;
                this.health = 36;
                this.speed = 2.8;
                this.damage = 8;
                this.reach = 1.6;
                this.expReward = 35;
                break;
            case 'enderman':
                this.height = 2.9;
                this.maxHealth = 55;
                this.health = 55;
                this.speed = 4.0;
                this.damage = 12;
                this.reach = 2.2;
                this.teleportCooldown = 0;
                this.expReward = 60;
                break;
            case 'villager':
                this.height = 1.95;
                this.maxHealth = 30;
                this.health = 30;
                this.speed = 1.6;
                this.damage = 0;
                this.reach = 1.5;
                this.expReward = 15;
                this.isPassive = true;
                break;
        }
    }

    checkCollision(pos, world) {
        if (!world) return false;
        const minX = Math.floor(pos.x - this.width / 2 + 0.02);
        const maxX = Math.floor(pos.x + this.width / 2 - 0.02);
        const minY = Math.floor(pos.y + 0.02);
        const maxY = Math.floor(pos.y + this.height - 0.02);
        const minZ = Math.floor(pos.z - this.depth / 2 + 0.02);
        const maxZ = Math.floor(pos.z + this.depth / 2 - 0.02);

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

        const createBox = (w, h, d, color) => {
            const geom = new THREE.BoxGeometry(w, h, d);
            const mat = new THREE.MeshLambertMaterial({ color });
            return new THREE.Mesh(geom, mat);
        };

        if (this.type === 'zombie') {
            // Green head, blue shirt, dark pants
            this.head = createBox(0.48, 0.48, 0.48, 0x4fa846);
            this.head.position.y = 1.48;
            this.torso = createBox(0.48, 0.68, 0.28, 0x1f78b4);
            this.torso.position.y = 0.9;
            this.leftArm = createBox(0.2, 0.6, 0.2, 0x4fa846);
            this.leftArm.position.set(-0.35, 0.85, 0.2);
            this.leftArm.rotation.x = -Math.PI / 2.5; // zombie hands forward!
            this.rightArm = createBox(0.2, 0.6, 0.2, 0x4fa846);
            this.rightArm.position.set(0.35, 0.85, 0.2);
            this.rightArm.rotation.x = -Math.PI / 2.5;
            this.leftLeg = createBox(0.22, 0.65, 0.22, 0x223366);
            this.leftLeg.position.set(-0.14, 0.32, 0);
            this.rightLeg = createBox(0.22, 0.65, 0.22, 0x223366);
            this.rightLeg.position.set(0.14, 0.32, 0);

            this.group.add(this.head, this.torso, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);
        } else if (this.type === 'creeper') {
            // Mottled green body, 4 legs
            this.head = createBox(0.46, 0.46, 0.46, 0x3cb043);
            this.head.position.y = 1.35;
            this.torso = createBox(0.44, 0.66, 0.26, 0x2e8b57);
            this.torso.position.y = 0.8;
            this.leftLeg = createBox(0.2, 0.45, 0.2, 0x3cb043);
            this.leftLeg.position.set(-0.14, 0.22, 0.12);
            this.rightLeg = createBox(0.2, 0.45, 0.2, 0x3cb043);
            this.rightLeg.position.set(0.14, 0.22, 0.12);
            this.backLeftLeg = createBox(0.2, 0.45, 0.2, 0x2e8b57);
            this.backLeftLeg.position.set(-0.14, 0.22, -0.12);
            this.backRightLeg = createBox(0.2, 0.45, 0.2, 0x2e8b57);
            this.backRightLeg.position.set(0.14, 0.22, -0.12);

            this.group.add(this.head, this.torso, this.leftLeg, this.rightLeg, this.backLeftLeg, this.backRightLeg);
        } else if (this.type === 'piglin') {
            // Pig head, brown tunic, sword in hand
            this.head = createBox(0.55, 0.48, 0.5, 0xeea5a5);
            this.head.position.y = 1.48;
            this.torso = createBox(0.48, 0.68, 0.28, 0x8a4b23);
            this.torso.position.y = 0.9;
            this.leftArm = createBox(0.2, 0.6, 0.2, 0xeea5a5);
            this.leftArm.position.set(-0.35, 0.85, 0);
            this.rightArm = createBox(0.2, 0.6, 0.2, 0xeea5a5);
            this.rightArm.position.set(0.35, 0.85, 0);
            this.leftLeg = createBox(0.22, 0.65, 0.22, 0x5a2d12);
            this.leftLeg.position.set(-0.14, 0.32, 0);
            this.rightLeg = createBox(0.22, 0.65, 0.22, 0x5a2d12);
            this.rightLeg.position.set(0.14, 0.32, 0);

            // Gold sword in right hand
            const sword = createBox(0.08, 0.45, 0.08, 0xf5c518);
            sword.position.set(0.35, 0.55, 0.2);
            sword.rotation.x = -Math.PI / 4;
            this.group.add(sword);

            this.group.add(this.head, this.torso, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);
        } else if (this.type === 'enderman') {
            // Tall, sleek black body, glowing purple eyes
            this.head = createBox(0.38, 0.38, 0.38, 0x111111);
            this.head.position.y = 2.65;
            this.torso = createBox(0.36, 0.85, 0.2, 0x0a0a0a);
            this.torso.position.y = 2.05;
            this.leftArm = createBox(0.12, 1.2, 0.12, 0x0a0a0a);
            this.leftArm.position.set(-0.28, 1.7, 0);
            this.rightArm = createBox(0.12, 1.2, 0.12, 0x0a0a0a);
            this.rightArm.position.set(0.28, 1.7, 0);
            this.leftLeg = createBox(0.12, 1.45, 0.12, 0x0a0a0a);
            this.leftLeg.position.set(-0.12, 0.72, 0);
            this.rightLeg = createBox(0.12, 1.45, 0.12, 0x0a0a0a);
            this.rightLeg.position.set(0.12, 0.72, 0);

            // Glowing purple eyes
            const eyeGeom = new THREE.BoxGeometry(0.08, 0.04, 0.02);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xda22ff });
            const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
            eyeL.position.set(-0.09, 2.68, 0.2);
            const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
            eyeR.position.set(0.09, 2.68, 0.2);

            this.group.add(this.head, this.torso, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg, eyeL, eyeR);
        } else if (this.type === 'villager') {
            // Classic Minecraft Villager (head, prominent nose, brown robe, folded arms, skirt, legs)
            this.head = createBox(0.48, 0.52, 0.48, 0xd29676);
            this.head.position.y = 1.5;

            const unibrow = createBox(0.36, 0.08, 0.04, 0x4a2a16);
            unibrow.position.set(0, 1.58, 0.25);

            this.nose = createBox(0.12, 0.22, 0.16, 0xb87b58);
            this.nose.position.set(0, 1.42, 0.3);

            const eyeGeom = new THREE.BoxGeometry(0.08, 0.06, 0.02);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1f9933 });
            const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
            eyeL.position.set(-0.12, 1.52, 0.25);
            const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
            eyeR.position.set(0.12, 1.52, 0.25);

            this.torso = createBox(0.52, 0.72, 0.36, 0x8a5533);
            this.torso.position.y = 0.88;

            this.foldedArms = createBox(0.60, 0.24, 0.28, 0x6e4024);
            this.foldedArms.position.set(0, 0.86, 0.16);

            this.skirt = createBox(0.54, 0.38, 0.38, 0x7a4829);
            this.skirt.position.set(0, 0.48, 0);

            this.leftLeg = createBox(0.2, 0.4, 0.2, 0x4e2c16);
            this.leftLeg.position.set(-0.13, 0.2, 0);
            this.rightLeg = createBox(0.2, 0.4, 0.2, 0x4e2c16);
            this.rightLeg.position.set(0.13, 0.2, 0);

            this.group.add(this.head, unibrow, this.nose, eyeL, eyeR, this.torso, this.foldedArms, this.skirt, this.leftLeg, this.rightLeg);
        }

        this.group.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.scene.add(this.group);
    }

    update(dt, player, world) {
        if (this.isDead) return;

        // Hurt flash cooldown
        if (this.hurtTimer > 0) {
            this.hurtTimer -= dt;
            if (this.hurtTimer <= 0) {
                this.resetColor();
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // Vector and distance to player
        const toPlayer = _vToPlayer.subVectors(player.position, this.position);
        const dist = toPlayer.length();

        // Enderman player gaze / eye contact detection
        if (this.type === 'enderman' && !this.isAngry && dist < 26 && player.camera) {
            player.camera.getWorldDirection(_vPlayerLook);
            const toMobNorm = _vToMobNorm.copy(toPlayer).negate().normalize();
            if (_vPlayerLook.dot(toMobNorm) > 0.95) {
                this.isAngry = true;
                if (this.soundManager) this.soundManager.playHurt();
            }
        }

        // Creeper swelling & explosion
        if (this.type === 'creeper') {
            if (dist < 3.2) {
                if (!this.isFusing) {
                    this.isFusing = true;
                    if (this.soundManager) this.soundManager.playCreeperHiss();
                }
                this.fuseTimer += dt;
                const flash = Math.sin(this.fuseTimer * 20) > 0;
                this.setFlashWhite(flash);

                if (this.fuseTimer >= 1.5) {
                    this.explode(world, player);
                    return;
                }
            } else {
                this.isFusing = false;
                this.fuseTimer = Math.max(0, this.fuseTimer - dt * 1.5);
                this.setFlashWhite(false);
            }
        }

        // AI Movement Decision
        const shouldChase = (this.type !== 'enderman' && this.type !== 'villager')
            ? (dist > this.reach && dist < 34)
            : (this.isAngry && dist > this.reach && dist < 38);

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
        } else if (shouldChase) {
            this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
            this.velocity.x = Math.sin(this.yaw) * this.speed;
            this.velocity.z = Math.cos(this.yaw) * this.speed;
            this.walkCycle += dt * 8;

            // Angry Enderman occasional flanking teleport if stuck
            if (this.type === 'enderman') {
                this.teleportCooldown += dt;
                if (this.teleportCooldown > 12 && Math.random() < 0.04) {
                    this.teleportRandomly(player.position);
                }
            }
        } else if (this.type === 'villager') {
            // Villager peaceful AI: watch player if close, or wander safely
            if (dist < 5.0) {
                this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
                this.velocity.x = 0;
                this.velocity.z = 0;
            } else {
                this.wanderTimer -= dt;
                if (this.wanderTimer <= 0) {
                    this.wanderTimer = 2.5 + Math.random() * 4.0;
                    if (Math.random() < 0.6) {
                        const wAngle = Math.random() * Math.PI * 2;
                        this.wanderDir.set(Math.sin(wAngle), 0, Math.cos(wAngle));
                    } else {
                        this.wanderDir.set(0, 0, 0);
                    }
                }
                this.velocity.x = this.wanderDir.x * this.speed;
                this.velocity.z = this.wanderDir.z * this.speed;
                if (this.velocity.x !== 0 || this.velocity.z !== 0) {
                    this.yaw = Math.atan2(this.velocity.x, this.velocity.z);
                    this.walkCycle += dt * 5.0;
                }
            }
        } else if (this.type === 'enderman' && !this.isAngry) {
            // Calm wandering / idle looking around (does not rush into terrain)
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.5 + Math.random() * 4;
                if (Math.random() < 0.5) {
                    const wAngle = Math.random() * Math.PI * 2;
                    this.wanderDir.set(Math.sin(wAngle), 0, Math.cos(wAngle));
                } else {
                    this.wanderDir.set(0, 0, 0);
                }
            }
            this.velocity.x = this.wanderDir.x * 1.2;
            this.velocity.z = this.wanderDir.z * 1.2;
            if (this.velocity.x !== 0 || this.velocity.z !== 0) {
                this.yaw = Math.atan2(this.velocity.x, this.velocity.z);
                this.walkCycle += dt * 4.5;
            }
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;

            // Attack player
            if (dist <= this.reach && this.attackCooldown <= 0 && this.type !== 'creeper' && this.type !== 'villager') {
                if (this.type !== 'enderman' || this.isAngry) {
                    this.attackPlayer(player);
                }
            }
        }

        // Leg walk animation
        if (this.leftLeg && this.rightLeg) {
            const legAngle = Math.sin(this.walkCycle) * 0.45;
            this.leftLeg.rotation.x = legAngle;
            this.rightLeg.rotation.x = -legAngle;
        }

        // Water reaction
        const footBlock = world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.1), Math.floor(this.position.z));
        const inWater = (footBlock === BLOCK_TYPES.WATER);

        if (inWater) {
            if (this.type === 'enderman') {
                // Enderman takes damage in water and teleports out!
                this.takeDamage(4);
                this.teleportRandomly(this.position);
            } else {
                this.velocity.y = Math.min(this.velocity.y + 14 * dt, 1.8);
                this.onGround = false;
            }
        }

        // --- HORIZONTAL MOVEMENT WITH AABB COLLISION & 1-BLOCK STEP-CLIMBING ---
        // Prevents mobs from running through hills/mountains into underground caves!
        const isGrounded = this.onGround;

        // Move X
        const nextPosX = this.position.clone();
        nextPosX.x += this.velocity.x * dt;
        if (!this.checkCollision(nextPosX, world)) {
            this.position.x = nextPosX.x;
        } else if (isGrounded) {
            const stepUpX = nextPosX.clone();
            stepUpX.y += 1.05;
            if (!this.checkCollision(stepUpX, world)) {
                this.position.x = nextPosX.x;
                this.position.y += 1.05;
            } else {
                this.velocity.x = 0;
            }
        } else {
            this.velocity.x = 0;
        }

        // Move Z
        const nextPosZ = this.position.clone();
        nextPosZ.z += this.velocity.z * dt;
        if (!this.checkCollision(nextPosZ, world)) {
            this.position.z = nextPosZ.z;
        } else if (isGrounded) {
            const stepUpZ = nextPosZ.clone();
            stepUpZ.y += 1.05;
            if (!this.checkCollision(stepUpZ, world)) {
                this.position.z = nextPosZ.z;
                this.position.y += 1.05;
            } else {
                this.velocity.z = 0;
            }
        } else {
            this.velocity.z = 0;
        }

        // --- VERTICAL MOVEMENT (GRAVITY & FLOOR/CEILING COLLISION) ---
        if (!inWater) {
            this.velocity.y -= 24 * dt;
            if (this.velocity.y < -30) this.velocity.y = -30;
        }

        const nextPosY = this.position.clone();
        nextPosY.y += this.velocity.y * dt;

        if (!this.checkCollision(nextPosY, world)) {
            this.position.y = nextPosY.y;
            this.onGround = false;
        } else {
            if (this.velocity.y < 0) {
                // Land safely on floor block without sinking
                this.onGround = true;
                this.position.y = Math.floor(nextPosY.y) + 1.0;
            } else if (this.velocity.y > 0) {
                // Hit ceiling
                this.velocity.y = 0;
            }
            this.velocity.y = 0;
        }

        // Update mesh position & rotation
        this.group.position.copy(this.position);
        this.group.rotation.y = this.yaw;

        // Void check & Distance despawn
        if (this.position.y < -15 || dist > 55) {
            this.die(false);
            return;
        }

        // Zombie sunlight burn check during daytime in overworld
        if (this.type === 'zombie' && world.dimension === 'overworld') {
            const isDay = (this.game.timeOfDay >= 0.15 && this.game.timeOfDay <= 0.6);
            if (isDay) {
                const bx = Math.floor(this.position.x);
                const by = Math.floor(this.position.y);
                const bz = Math.floor(this.position.z);
                let exposed = true;
                for (let y = by + 2; y < 32; y++) {
                    const b = world.getBlock(bx, y, bz);
                    if (b !== BLOCK_TYPES.AIR) {
                        exposed = false;
                        break;
                    }
                }
                if (exposed) {
                    this.health -= dt * 8;
                    this.setFlashRed(true);
                    if (this.game.particleSystem && Math.random() < 0.3) {
                        this.game.particleSystem.spawnBlockBreakParticles(this.position.x, this.position.y + 1, this.position.z, BLOCK_TYPES.LAVA, 2);
                    }
                    if (this.health <= 0) {
                        this.die(true);
                        return;
                    }
                }
            }
        }
    }

    attackPlayer(player) {
        this.attackCooldown = 1.3;
        let dmg = this.damage;
        if (this.game.upgrader) {
            const red = this.game.upgrader.getDamageReduction();
            dmg = Math.max(1, Math.round(dmg * (1 - red)));
        }

        player.takeDamage(dmg, `Тебе вбив ${this.getMobDisplayName()}!`);
        if (this.soundManager) {
            if (this.type === 'zombie') this.soundManager.playZombieGroan();
            else this.soundManager.playHurt();
        }
    }

    takeDamage(amount, knockbackDir) {
        if (this.isDead) return;
        this.health -= amount;
        this.hurtTimer = 0.18;
        this.setFlashRed(true);

        if (this.type === 'enderman') {
            this.isAngry = true;
        }

        if (knockbackDir) {
            this.velocity.x = knockbackDir.x * 11;
            this.velocity.y = 5.2;
            this.velocity.z = knockbackDir.z * 11;
        }

        if (this.soundManager) this.soundManager.playHurt();

        // Enderman teleports away when hurt
        if (this.type === 'enderman' && Math.random() < 0.75) {
            this.teleportRandomly(this.position);
        }

        if (this.health <= 0) {
            this.die(true);
        }
    }

    findSafeTeleportSpot(aroundPos) {
        const world = this.game.world;
        if (!world) return null;

        const dim = world.dimension || 'overworld';
        const attempts = 16;

        for (let i = 0; i < attempts; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 6 + Math.random() * 12;
            const tx = Math.floor(aroundPos.x + Math.cos(angle) * radius);
            const tz = Math.floor(aroundPos.z + Math.sin(angle) * radius);

            // Chunk must be present and generated!
            const cx = Math.floor(tx / 16);
            const cz = Math.floor(tz / 16);
            const chunk = world.getChunk(cx, cz);
            if (!chunk || !chunk.isGenerated) continue;

            let startY = 28;
            let minY = 2;

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
                if (floorBlock === BLOCK_TYPES.AIR || floorBlock === BLOCK_TYPES.WATER || floorBlock === BLOCK_TYPES.LAVA) {
                    continue;
                }

                // Headroom check: 3 blocks of AIR required for Enderman!
                const b1 = world.getBlock(tx, y + 1, tz);
                const b2 = world.getBlock(tx, y + 2, tz);
                const b3 = world.getBlock(tx, y + 3, tz);

                if (b1 === BLOCK_TYPES.AIR && b2 === BLOCK_TYPES.AIR && b3 === BLOCK_TYPES.AIR) {
                    const candidatePos = new THREE.Vector3(tx + 0.5, y + 1.0, tz + 0.5);
                    if (!this.checkCollision(candidatePos, world)) {
                        return candidatePos;
                    }
                }
            }
        }
        return null;
    }

    teleportRandomly(aroundPos) {
        const spot = this.findSafeTeleportSpot(aroundPos || this.position);
        if (!spot) return false;

        // Old position portal particles
        if (this.game.particleSystem) {
            this.game.particleSystem.spawnBlockBreakParticles(this.position.x, this.position.y + 1, this.position.z, BLOCK_TYPES.PORTAL_END, 8);
        }

        this.position.copy(spot);
        this.velocity.set(0, 0, 0);
        this.group.position.copy(this.position);
        this.teleportCooldown = 0;

        // New position portal particles & sound
        if (this.game.particleSystem) {
            this.game.particleSystem.spawnBlockBreakParticles(spot.x, spot.y + 1, spot.z, BLOCK_TYPES.PORTAL_END, 12);
        }
        if (this.soundManager) {
            this.soundManager.playPortalWarp();
        }
        return true;
    }

    explode(world, player) {
        const cx = Math.floor(this.position.x);
        const cy = Math.floor(this.position.y);
        const cz = Math.floor(this.position.z);

        // Break blocks around creeper
        const r = 2;
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (dx*dx + dy*dy + dz*dz <= r*r + 1) {
                        const bx = cx + dx;
                        const by = cy + dy;
                        const bz = cz + dz;
                        const b = world.getBlock(bx, by, bz);
                        if (b !== BLOCK_TYPES.BEDROCK && b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER) {
                            if (window.modManager && !window.modManager.canExplodeBlock(bx, by, bz, b)) {
                                continue;
                            }
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

        if (this.game.particleSystem) {
            this.game.particleSystem.spawnExplosionParticles(this.position.x, this.position.y, this.position.z, 50);
        }
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
            if (this.game.player) {
                this.game.player.iq += this.expReward;
            }
        }

        if (this.group) {
            this.scene.remove(this.group);
            this.group = null;
        }
    }

    dropMobLoot() {
        const mgr = this.game.mobManager;
        const x = this.position.x;
        const y = this.position.y + 0.5;
        const z = this.position.z;

        // Drops per mob type
        switch (this.type) {
            case 'zombie':
                mgr.spawnItemDrop(x, y, z, ITEM_TYPES.ROTTEN_FLESH, Math.floor(Math.random() * 2) + 1);
                if (Math.random() < 0.35) mgr.spawnItemDrop(x, y, z, ITEM_TYPES.IRON_INGOT, 1);
                if (Math.random() < 0.4) mgr.spawnItemDrop(x, y, z, JUNK_ITEMS_POOL[Math.floor(Math.random() * JUNK_ITEMS_POOL.length)], 1);
                break;
            case 'creeper':
                mgr.spawnItemDrop(x, y, z, ITEM_TYPES.GUNPOWDER, Math.floor(Math.random() * 3) + 1);
                if (Math.random() < 0.25) mgr.spawnItemDrop(x, y, z, ITEM_TYPES.TNT, 1);
                break;
            case 'piglin':
                mgr.spawnItemDrop(x, y, z, ITEM_TYPES.GOLD_INGOT, Math.floor(Math.random() * 2) + 1);
                if (Math.random() < 0.4) mgr.spawnItemDrop(x, y, z, ITEM_TYPES.BLAZE_ROD, 1);
                break;
            case 'enderman':
                mgr.spawnItemDrop(x, y, z, ITEM_TYPES.ENDER_EYE, Math.floor(Math.random() * 2) + 1);
                if (Math.random() < 0.5) mgr.spawnItemDrop(x, y, z, ITEM_TYPES.END_STONE, 2);
                break;
            case 'villager':
                mgr.spawnItemDrop(x, y, z, ITEM_TYPES.EMERALD, Math.floor(Math.random() * 2) + 1);
                mgr.spawnItemDrop(x, y, z, ITEM_TYPES.APPLE, 2);
                break;
        }
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

    setFlashRed(flash) {
        if (!this.group) return;
        this.group.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.color.set(flash ? 0xff3333 : child.userData.origColor || 0xffffff);
            }
        });
    }

    setFlashWhite(flash) {
        if (!this.group) return;
        this.group.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.color.set(flash ? 0xffffff : child.userData.origColor || 0xffffff);
            }
        });
    }

    resetColor() {
        this.setFlashRed(false);
    }

    getMobDisplayName() {
        switch (this.type) {
            case 'zombie': return "Зомбі-Єблан";
            case 'creeper': return "Кріпер-Єблан";
            case 'piglin': return "Незерський Піглін";
            case 'enderman': return "Ендер-Єблан";
            case 'villager': return "Житель села (Торгівець)";
            default: return "Моб";
        }
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

    update(dt, player, fireballsList) {
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
            mgr.spawnItemDrop(0, 16, 0, ITEM_TYPES.DRAGON_EGG, 1);
            mgr.spawnItemDrop(1, 16, 0, ITEM_TYPES.CASE_DRAGON, 1);
            mgr.spawnItemDrop(-1, 16, 0, ITEM_TYPES.NETHERITE_BLOCK, 4);
            mgr.spawnItemDrop(0, 16, 1, ITEM_TYPES.EBLAN_BLOCK, 8);
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
class MobManager {
    constructor(scene, textureManager, soundManager, game) {
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.game = game;

        this.mobs = [];
        this.itemDrops = [];
        this.crystals = [];
        this.fireballs = [];
        this.dragon = null;
        this.spawnTimer = 0;
    }

    clearAll() {
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
        this.crystals.push(cr);
        return cr;
    }

    spawnDragon() {
        if (this.dragon && this.dragon.mesh) return;
        this.dragon = new EblanDragonBoss(this.scene, this.textureManager, this.soundManager, this.game);
    }

    update(dt, player, world) {
        // Spawn mobs periodically based on dimension (controlled mob cap)
        this.spawnTimer += dt;
        if (this.spawnTimer > 13 && this.mobs.length < 5) {
            this.spawnTimer = 0;
            this.handlePeriodicSpawns(player, world);
        }

        // Update mobs with distance throttling (Optimization)
        const px = player ? player.position.x : 0;
        const pz = player ? player.position.z : 0;

        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const m = this.mobs[i];
            const distSq = (m.position.x - px) ** 2 + (m.position.z - pz) ** 2;
            if (distSq > 3600) { // > 60 blocks away
                m.tickCounter = (m.tickCounter || 0) + 1;
                if (m.tickCounter % 5 !== 0) continue;
            } else if (distSq > 1024) { // > 32 blocks away
                m.tickCounter = (m.tickCounter || 0) + 1;
                if (m.tickCounter % 2 !== 0) continue;
            }
            m.update(dt, player, world);
            if (m.isDead) {
                this.mobs.splice(i, 1);
            }
        }

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
            f.update(dt, player, world);
            if (f.exploded || f.age > 8) {
                this.fireballs.splice(i, 1);
            }
        }

        // Update dragon
        if (this.dragon) {
            this.dragon.update(dt, player, this.fireballs);
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

        if (dim === 'overworld') {
            const isNight = (this.game.timeOfDay > 0.6 || this.game.timeOfDay < 0.15);
            // In daytime: NEVER spawn mobs on the surface! Peaceful day!
            if (!isNight) {
                // Rare cave mob only deep below y < 10
                if (sy < 10 && Math.random() < 0.15 && this.mobs.length < 3) {
                    this.spawnMob('zombie', sx + 0.5, sy, sz + 0.5);
                }
                return;
            }

            // Nighttime: moderate, non-overwhelming spawn
            if (this.mobs.length < 5 && Math.random() < 0.6) {
                const mobType = Math.random() < 0.65 ? 'zombie' : (Math.random() < 0.85 ? 'creeper' : 'enderman');
                this.spawnMob(mobType, sx + 0.5, sy, sz + 0.5);
            }
        } else if (dim === 'nether') {
            if (this.mobs.length < 5 && Math.random() < 0.5) {
                this.spawnMob('piglin', sx + 0.5, sy, sz + 0.5);
            }
        } else if (dim === 'the_end') {
            if (this.mobs.length < 5 && Math.random() < 0.4) {
                this.spawnMob('enderman', sx + 0.5, sy, sz + 0.5);
            }
        }
    }
}

window.ItemDrop = ItemDrop;
window.EndCrystal = EndCrystal;
window.MobEntity = MobEntity;
window.DragonFireball = DragonFireball;
window.EblanDragonBoss = EblanDragonBoss;
window.MobManager = MobManager;

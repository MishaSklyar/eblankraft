/**
 * Eblankraft - Particle Effects & TNT Explosion Physics
 */

class ParticleSystem {
    constructor(scene, textureManager) {
        this.scene = scene;
        this.textureManager = textureManager;
        this.particles = [];
        this.particleGeom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        this.blockBreakMaterials = {};
        this.explosionGeoms = [
            new THREE.BoxGeometry(0.15, 0.15, 0.15),
            new THREE.BoxGeometry(0.24, 0.24, 0.24),
            new THREE.BoxGeometry(0.32, 0.32, 0.32)
        ];
        this.explosionMaterials = [
            0xff2200, 0xff7700, 0xffcc00, 0x333333, 0x555555, 0xffffff
        ].map(c => new THREE.MeshBasicMaterial({ color: c }));
    }

    // Spawn digging / breaking chips
    spawnBlockBreakParticles(x, y, z, blockType, count = 10) {
        if (window.game && (window.game.turboFPS || window.game.isA02Mode)) {
            count = Math.min(count, 2);
        }

        // Enforce particle cap to avoid lag spikes
        while (this.particles.length + count > 70) {
            const old = this.particles.shift();
            if (old && old.mesh) this.scene.remove(old.mesh);
        }

        if (!this.blockBreakMaterials[blockType]) {
            const iconName = (
                blockType === BLOCK_TYPES.GRASS ? 'grass_top' :
                blockType === BLOCK_TYPES.DIRT ? 'dirt' :
                blockType === BLOCK_TYPES.STONE ? 'stone' :
                blockType === BLOCK_TYPES.WOOD ? 'wood_side' :
                blockType === BLOCK_TYPES.TNT ? 'tnt_side' :
                blockType === BLOCK_TYPES.DIAMOND_BLOCK ? 'diamond' :
                blockType === BLOCK_TYPES.GOLD_BLOCK ? 'gold' :
                blockType === BLOCK_TYPES.EBLAN_BLOCK ? 'eblan' : 'stone'
            );
            const tex = this.textureManager.getTexture(iconName);
            this.blockBreakMaterials[blockType] = new THREE.MeshLambertMaterial({ map: tex });
        }
        const mat = this.blockBreakMaterials[blockType];

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.particleGeom, mat);
            mesh.position.set(
                x + 0.5 + (Math.random() - 0.5) * 0.5,
                y + 0.5 + (Math.random() - 0.5) * 0.5,
                z + 0.5 + (Math.random() - 0.5) * 0.5
            );

            const p = {
                mesh,
                vx: (Math.random() - 0.5) * 3.5,
                vy: Math.random() * 2.5 + 1.2,
                vz: (Math.random() - 0.5) * 3.5,
                rx: Math.random() * 8,
                ry: Math.random() * 8,
                scale: 1.0,
                life: 1.0,
                decay: 2.2 + Math.random() * 0.8
            };

            this.scene.add(mesh);
            this.particles.push(p);
        }
    }

    // Spawn massive explosion shockwave and flying smoke / fire cubes
    spawnExplosionParticles(x, y, z, count = 36) {
        if (window.game && (window.game.turboFPS || window.game.isA02Mode)) {
            count = Math.min(count, 8);
        }
        while (this.particles.length + count > 80) {
            const old = this.particles.shift();
            if (old && old.mesh) this.scene.remove(old.mesh);
        }

        for (let i = 0; i < count; i++) {
            const mat = this.explosionMaterials[i % this.explosionMaterials.length];
            const geom = this.explosionGeoms[i % this.explosionGeoms.length];
            const mesh = new THREE.Mesh(geom, mat);

            mesh.position.set(x, y, z);

            const speed = 4 + Math.random() * 10;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            const p = {
                mesh,
                vx: Math.sin(phi) * Math.cos(theta) * speed,
                vy: Math.cos(phi) * speed + 2.5,
                vz: Math.sin(phi) * Math.sin(theta) * speed,
                rx: Math.random() * 10,
                ry: Math.random() * 10,
                scale: 1.0,
                life: 1.0,
                decay: 1.3 + Math.random() * 0.7
            };

            this.scene.add(mesh);
            this.particles.push(p);
        }
    }

    spawnBubbleParticles(x, y, z, count = 2) {
        if (window.game && window.game.underwaterEffectsEnabled === false) return;
        if (!this.bubbleGeom) {
            this.bubbleGeom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
            this.bubbleMat = new THREE.MeshBasicMaterial({ color: 0x99ddff, transparent: true, opacity: 0.75 });
        }

        const maxBubbles = 20;
        const addCount = Math.min(count, 3);
        while (this.particles.length + addCount > maxBubbles) {
            const old = this.particles.shift();
            if (old && old.mesh) this.scene.remove(old.mesh);
        }

        for (let i = 0; i < addCount; i++) {
            const mesh = new THREE.Mesh(this.bubbleGeom, this.bubbleMat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.4,
                y + (Math.random() - 0.5) * 0.3,
                z + (Math.random() - 0.5) * 0.4
            );

            const p = {
                mesh,
                vx: (Math.random() - 0.5) * 0.3,
                vy: Math.random() * 0.8 + 1.2, // Floats UP
                vz: (Math.random() - 0.5) * 0.3,
                rx: Math.random() * 4,
                ry: Math.random() * 4,
                gravity: -1.5, // Floats upward against gravity!
                scale: 1.0,
                life: 1.0,
                decay: 0.8 + Math.random() * 0.5,
                isBubble: true
            };

            this.scene.add(mesh);
            this.particles.push(p);
        }
    }

    spawnLavaPopParticles(x, y, z, count = 2) {
        if (!this.lavaSparkGeom) {
            this.lavaSparkGeom = new THREE.BoxGeometry(0.09, 0.09, 0.09);
            this.lavaSparkMats = [
                new THREE.MeshBasicMaterial({ color: 0xffe600 }),
                new THREE.MeshBasicMaterial({ color: 0xff6600 }),
                new THREE.MeshBasicMaterial({ color: 0xff2200 }),
                new THREE.MeshBasicMaterial({ color: 0x444444 })
            ];
        }

        const maxParticles = 40;
        const addCount = Math.min(count, 4);
        while (this.particles.length + addCount > maxParticles) {
            const old = this.particles.shift();
            if (old && old.mesh) this.scene.remove(old.mesh);
        }

        for (let i = 0; i < addCount; i++) {
            const mat = this.lavaSparkMats[Math.floor(Math.random() * this.lavaSparkMats.length)];
            const mesh = new THREE.Mesh(this.lavaSparkGeom, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.8,
                y + 0.1,
                z + (Math.random() - 0.5) * 0.8
            );

            const p = {
                mesh,
                vx: (Math.random() - 0.5) * 1.2,
                vy: Math.random() * 2.2 + 1.5,
                vz: (Math.random() - 0.5) * 1.2,
                rx: Math.random() * 6,
                ry: Math.random() * 6,
                gravity: 2.8,
                scale: 1.0,
                life: 1.0,
                decay: 1.4 + Math.random() * 0.6
            };

            this.scene.add(mesh);
            this.particles.push(p);
        }
    }

    spawnFallingLeaves(x, y, z, count = 1) {
        if (!this.leafGeom) {
            this.leafGeom = new THREE.BoxGeometry(0.14, 0.02, 0.14);
            this.leafMat1 = new THREE.MeshLambertMaterial({ color: 0x3d7e26 });
            this.leafMat2 = new THREE.MeshLambertMaterial({ color: 0x589635 });
        }

        while (this.particles.length + count > 80) {
            const old = this.particles.shift();
            if (old && old.mesh) this.scene.remove(old.mesh);
        }

        for (let i = 0; i < count; i++) {
            const mat = Math.random() > 0.5 ? this.leafMat1 : this.leafMat2;
            const mesh = new THREE.Mesh(this.leafGeom, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.8,
                y,
                z + (Math.random() - 0.5) * 0.8
            );

            const p = {
                mesh,
                vx: (Math.random() - 0.5) * 0.5 + 0.15, // Wind drift
                vy: -0.4 - Math.random() * 0.3,
                vz: (Math.random() - 0.5) * 0.5,
                rx: Math.random() * 2,
                ry: Math.random() * 3,
                gravity: 0.6, // Very slow gravity
                wobble: Math.random() * Math.PI * 2,
                scale: 1.0,
                life: 1.0,
                decay: 0.25 + Math.random() * 0.15,
                isLeaf: true
            };

            this.scene.add(mesh);
            this.particles.push(p);
        }
    }

    update(dt, world) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= p.decay * dt;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            const grav = (p.gravity !== undefined) ? p.gravity : 15.0;
            p.vy -= grav * dt;

            if (p.isBubble) {
                if (p.vy > 2.5) p.vy = 2.5;
                const bx = Math.floor(p.mesh.position.x);
                const by = Math.floor(p.mesh.position.y);
                const bz = Math.floor(p.mesh.position.z);
                if (world && world.getBlock(bx, by, bz) === BLOCK_TYPES.AIR) {
                    p.life = 0; // Bubble pops when reaching air surface
                }
            } else if (p.isLeaf) {
                p.wobble += dt * 3.5;
                p.vx += Math.sin(p.wobble) * 0.3 * dt;
                p.vz += Math.cos(p.wobble * 0.7) * 0.3 * dt;
                if (p.vy < -0.9) p.vy = -0.9;
            }

            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;

            p.mesh.rotation.x += p.rx * dt;
            p.mesh.rotation.y += p.ry * dt;

            p.scale = Math.max(0, p.life);
            p.mesh.scale.set(p.scale, p.scale, p.scale);

            // Floor bounce (only for standard solid particles)
            if (!p.isBubble) {
                const bx = Math.floor(p.mesh.position.x);
                const by = Math.floor(p.mesh.position.y);
                const bz = Math.floor(p.mesh.position.z);
                if (world && world.getBlock(bx, by, bz) !== BLOCK_TYPES.AIR) {
                    if (p.isLeaf) {
                        p.life = 0; // leaf lands on ground
                    } else {
                        p.vy = -p.vy * 0.4;
                        p.vx *= 0.7;
                        p.vz *= 0.7;
                    }
                }
            }
        }
    }
}

let SHARED_TNT_GEOMETRY = null;
function getSharedTNTGeometry() {
    if (!SHARED_TNT_GEOMETRY) {
        SHARED_TNT_GEOMETRY = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    }
    return SHARED_TNT_GEOMETRY;
}

const MAX_ACTIVE_TNT = 48;

class TNTEntity {
    constructor(x, y, z, scene, textureManager, soundManager, world, particleSystem, game) {
        this.x = x + 0.5;
        this.y = y;
        this.z = z + 0.5;
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.world = world;
        this.particleSystem = particleSystem;
        this.game = game;

        this.fuse = 2.2; // seconds
        this.exploded = false;
        this.vy = 3.0; // initial hop
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vz = (Math.random() - 0.5) * 1.5;

        // Visual mesh using shared geometry (prevents heap bloat and GC stutters)
        this.mat = this.textureManager.getBlockMaterial(BLOCK_TYPES.TNT);
        this.mesh = new THREE.Mesh(getSharedTNTGeometry(), this.mat);
        this.mesh.position.set(this.x, this.y + 0.5, this.z);
        this.scene.add(this.mesh);

        // Auto-register in game's update list
        if (this.game && Array.isArray(this.game.tntEntities)) {
            this.game.tntEntities.push(this);
        }

        this.soundManager.playFuse();
    }

    update(dt) {
        if (this.exploded) return;
        this.fuse -= dt;

        // Flashing and pulsating animation
        const flashRate = 8 + (2.2 - this.fuse) * 7;
        const scaleMod = 1.0 + Math.sin(performance.now() * 0.01 * flashRate) * 0.1;
        this.mesh.scale.set(scaleMod, scaleMod, scaleMod);

        // Physics
        this.vy -= 18.0 * dt; // Gravity
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z += this.vz * dt;

        // Ground collision
        const bx = Math.floor(this.x);
        const by = Math.floor(this.y);
        const bz = Math.floor(this.z);

        if (this.world && this.world.getBlock(bx, by, bz) !== BLOCK_TYPES.AIR) {
            this.y = by + 1.0;
            this.vy = -this.vy * 0.35; // bouncy
            this.vx *= 0.8;
            this.vz *= 0.8;
        }

        this.mesh.position.set(this.x, this.y + 0.5, this.z);

        if (this.fuse <= 0) {
            this.explode();
        }
    }

    explode() {
        if (this.exploded) return;
        this.exploded = true;
        this.scene.remove(this.mesh);

        this.soundManager.playExplosion();
        const particleCount = (this.particleSystem && this.particleSystem.particles.length > 50) ? 14 : 36;
        this.particleSystem.spawnExplosionParticles(this.x, this.y + 0.5, this.z, particleCount);

        // Screen shake (clamped)
        if (this.game && this.game.triggerCameraShake) {
            this.game.triggerCameraShake(0.6, 12);
        }

        // Blast radius & block destruction
        const radius = 3.8;
        const cx = Math.floor(this.x);
        const cy = Math.floor(this.y + 0.5);
        const cz = Math.floor(this.z);

        const rInt = Math.ceil(radius);
        const destroyedBlocks = [];
        const chainTNTs = [];

        for (let ox = -rInt; ox <= rInt; ox++) {
            for (let oy = -rInt; oy <= rInt; oy++) {
                for (let oz = -rInt; oz <= rInt; oz++) {
                    const distSq = ox * ox + oy * oy + oz * oz;
                    if (distSq <= radius * radius) {
                        const bx = cx + ox;
                        const by = cy + oy;
                        const bz = cz + oz;
                        const block = this.world.getBlock(bx, by, bz);

                        if (block !== BLOCK_TYPES.AIR && block !== BLOCK_TYPES.BEDROCK) {
                            if (window.modManager && !window.modManager.canExplodeBlock(bx, by, bz, block)) {
                                continue;
                            }
                            this.world.setBlock(bx, by, bz, BLOCK_TYPES.AIR);
                            if (block === BLOCK_TYPES.TNT) {
                                chainTNTs.push({ x: bx, y: by, z: bz });
                            } else {
                                destroyedBlocks.push({ x: bx, y: by, z: bz, type: block });
                            }
                        }
                    }
                }
            }
        }

        // Spawn debris particles for a small subset of destroyed blocks
        const maxDebris = (this.particleSystem && this.particleSystem.particles.length > 50) ? 4 : 12;
        for (let i = 0; i < Math.min(maxDebris, destroyedBlocks.length); i++) {
            const b = destroyedBlocks[i];
            this.particleSystem.spawnBlockBreakParticles(b.x, b.y, b.z, b.type, 2);
        }

        // Optimized Chain Reaction TNTs
        const currentActive = (this.game && Array.isArray(this.game.tntEntities)) ? this.game.tntEntities.length : 0;
        const availableSlots = Math.max(0, MAX_ACTIVE_TNT - currentActive);
        const spawnPhysicalCount = Math.min(chainTNTs.length, availableSlots);

        for (let i = 0; i < spawnPhysicalCount; i++) {
            const t = chainTNTs[i];
            const chainTNT = new TNTEntity(
                t.x, t.y, t.z,
                this.scene,
                this.textureManager,
                this.soundManager,
                this.world,
                this.particleSystem,
                this.game
            );
            chainTNT.fuse = 0.2 + Math.random() * 0.35; // fast chain explosion
            chainTNT.vx = (Math.random() - 0.5) * 5;
            chainTNT.vy = Math.random() * 4 + 2;
            chainTNT.vz = (Math.random() - 0.5) * 5;
        }

        // For remaining chain TNTs, trigger cascading shockwave without spawning hundreds of heavy meshes
        const extraLimit = Math.min(chainTNTs.length, spawnPhysicalCount + 36);
        for (let i = spawnPhysicalCount; i < extraLimit; i++) {
            const t = chainTNTs[i];
            const delay = 120 + Math.random() * 280;
            setTimeout(() => {
                if (this.world) {
                    this.world.setBlock(t.x, t.y, t.z, BLOCK_TYPES.AIR);
                }
                if (this.soundManager) {
                    this.soundManager.playExplosion();
                }
                if (this.particleSystem) {
                    this.particleSystem.spawnExplosionParticles(t.x + 0.5, t.y + 0.5, t.z + 0.5, 10);
                }
            }, delay);
        }

        // Rebuild meshes of affected chunks (DEBOUNCED: prevents freezing the browser when 50+ TNTs explode in chain!)
        if (this.world) {
            if (!this.world._tntMeshTimeout) {
                this.world._tntMeshTimeout = setTimeout(() => {
                    this.world._tntMeshTimeout = null;
                    if (this.world && this.world.updateMeshes) {
                        this.world.updateMeshes();
                    }
                }, 35);
            }
        }

        // Push player if within blast radius
        if (this.game && this.game.player) {
            const p = this.game.player;
            const dx = p.position.x - this.x;
            const dy = p.position.y - this.y;
            const dz = p.position.z - this.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < 8.0) {
                const force = (1.0 - dist / 8.0) * 22.0;
                p.velocity.x += (dx / (dist || 1)) * force;
                p.velocity.y += Math.max(6.0, (dy / (dist || 1)) * force + 6.0);
                p.velocity.z += (dz / (dist || 1)) * force;

                const damage = Math.floor((1.0 - dist / 8.0) * 75);
                p.takeDamage(damage, "Підірвався на власному ТНТ як справжній єблан!");
            }
        }
    }
}

window.ParticleSystem = ParticleSystem;
window.TNTEntity = TNTEntity;

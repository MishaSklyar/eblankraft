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
        this.bulletHoles = [];
        this.tracers = [];
        this._bulletHoleTexture = null;
    }

    _getBulletHoleTexture() {
        if (this._bulletHoleTexture) return this._bulletHoleTexture;
        try {
            if (typeof document !== 'undefined' && document.createElement) {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext ? canvas.getContext('2d') : null;
                if (ctx) {
                    // Outer scorched smoke gradient
                    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
                    grad.addColorStop(0, 'rgba(8, 8, 10, 0.98)');
                    grad.addColorStop(0.35, 'rgba(20, 20, 24, 0.92)');
                    grad.addColorStop(0.7, 'rgba(40, 36, 32, 0.65)');
                    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(32, 32, 30, 0, Math.PI * 2);
                    ctx.fill();

                    // Deep center cavity
                    ctx.fillStyle = '#050507';
                    ctx.beginPath();
                    for (let i = 0; i < 12; i++) {
                        const angle = (i / 12) * Math.PI * 2;
                        const r = 10 + (Math.sin(i * 4.2) * 3);
                        const x = 32 + Math.cos(angle) * r;
                        const y = 32 + Math.sin(angle) * r;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.fill();

                    // Radiating fracture cracks
                    ctx.strokeStyle = '#18181c';
                    ctx.lineWidth = 1.6;
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2 + (i % 2 ? 0.25 : -0.2);
                        ctx.beginPath();
                        ctx.moveTo(32 + Math.cos(angle) * 8, 32 + Math.sin(angle) * 8);
                        ctx.lineTo(32 + Math.cos(angle) * (20 + (i % 3) * 4), 32 + Math.sin(angle) * (20 + (i % 3) * 4));
                        ctx.stroke();
                    }

                    if (typeof THREE !== 'undefined' && THREE.CanvasTexture) {
                        this._bulletHoleTexture = new THREE.CanvasTexture(canvas);
                        return this._bulletHoleTexture;
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    spawnBulletHole(x, y, z, normal, blockType = null) {
        if (!this.scene || typeof THREE === 'undefined' || !THREE.PlaneGeometry || !THREE.MeshBasicMaterial || !THREE.Mesh) return;
        if (!this.bulletHoles) this.bulletHoles = [];

        // Cap decal count at 60 for 60fps performance
        while (this.bulletHoles.length >= 60) {
            const old = this.bulletHoles.shift();
            if (old && old.mesh) {
                this.scene.remove(old.mesh);
                old.mesh.geometry?.dispose();
                if (old.mesh.material) {
                    if (Array.isArray(old.mesh.material)) old.mesh.material.forEach(m => m.dispose());
                    else old.mesh.material.dispose();
                }
            }
        }

        const texture = this._getBulletHoleTexture();
        const mat = texture
            ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.94, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
            : new THREE.MeshBasicMaterial({ color: 0x111116, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });

        const geom = new THREE.PlaneGeometry(0.18, 0.18);
        const mesh = new THREE.Mesh(geom, mat);

        const nx = normal?.x || 0, ny = normal?.y || 0, nz = normal?.z || 1;
        mesh.position.set(
            x + nx * 0.008,
            y + ny * 0.008,
            z + nz * 0.008
        );

        mesh.lookAt(new THREE.Vector3(x + nx, y + ny, z + nz));
        mesh.rotateZ(Math.random() * Math.PI * 2);

        this.scene.add(mesh);
        this.bulletHoles.push({ mesh, createdAt: performance.now() });
    }

    spawnBulletImpact(x, y, z, normal) {
        if (!this.scene || typeof THREE === 'undefined' || !THREE.BoxGeometry || !THREE.MeshBasicMaterial || !THREE.Mesh) return;
        const sparkCount = 6;
        while (this.particles.length + sparkCount > 80) {
            const old = this.particles.shift();
            if (old && old.mesh) this.scene.remove(old.mesh);
        }

        const sparkColors = [0xfff066, 0xffaa00, 0xff4400, 0xffffff];
        const nx = normal?.x || 0, ny = normal?.y || 1, nz = normal?.z || 0;

        for (let i = 0; i < sparkCount; i++) {
            const geom = new THREE.BoxGeometry(0.04, 0.04, 0.04);
            const mat = new THREE.MeshBasicMaterial({ color: sparkColors[i % sparkColors.length] });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(x, y, z);

            const spread = 2.2;
            const vx = nx * (2.0 + Math.random() * 2.0) + (Math.random() - 0.5) * spread;
            const vy = ny * (2.0 + Math.random() * 2.0) + (Math.random() - 0.5) * spread;
            const vz = nz * (2.0 + Math.random() * 2.0) + (Math.random() - 0.5) * spread;

            this.scene.add(mesh);
            this.particles.push({
                mesh,
                vx, vy, vz,
                rx: Math.random() * 12,
                ry: Math.random() * 12,
                gravity: 14.0,
                scale: 1.0,
                life: 0.45,
                decay: 2.2 + Math.random() * 1.5
            });
        }
    }

    spawnTracer(start, end, color = 0xffe066) {
        if (!this.scene || typeof THREE === 'undefined' || !THREE.BufferGeometry || !THREE.LineBasicMaterial || !THREE.Line) return;

        const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2,
            transparent: true,
            opacity: 0.95
        });
        const line = new THREE.Line(geom, mat);
        this.scene.add(line);

        if (!this.tracers) this.tracers = [];
        this.tracers.push({
            line,
            startTime: performance.now(),
            duration: 130,
            startOpacity: 0.95
        });
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

    // Minecraft-style Crit Sparkles (Golden, Cyan & White Stars/Cubes)
    spawnCritParticles(x, y, z, count = 18) {
        if (window.game && (window.game.turboFPS || window.game.isA02Mode)) {
            count = Math.min(count, 6);
        }
        if (!this.critGeom) {
            this.critGeom = new THREE.BoxGeometry(0.11, 0.11, 0.11);
            this.critMats = [
                new THREE.MeshBasicMaterial({ color: 0xffd700 }), // Gold
                new THREE.MeshBasicMaterial({ color: 0xffaa00 }), // Amber
                new THREE.MeshBasicMaterial({ color: 0x55ffff }), // Cyan/Diamond
                new THREE.MeshBasicMaterial({ color: 0xffffff })  // White
            ];
        }

        while (this.particles.length + count > 110) {
            const old = this.particles.shift();
            if (old && old.mesh) this.scene.remove(old.mesh);
        }

        for (let i = 0; i < count; i++) {
            const mat = this.critMats[i % this.critMats.length];
            const mesh = new THREE.Mesh(this.critGeom, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.5,
                y + (Math.random() - 0.5) * 0.5,
                z + (Math.random() - 0.5) * 0.5
            );

            const speed = 2.8 + Math.random() * 4.2;
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI;

            const p = {
                mesh,
                vx: Math.cos(phi) * Math.cos(theta) * speed,
                vy: Math.sin(phi) * speed + 1.8,
                vz: Math.cos(phi) * Math.sin(theta) * speed,
                rx: Math.random() * 8,
                ry: Math.random() * 8,
                gravity: 6.5,
                scale: 1.0,
                life: 1.0,
                decay: 2.0 + Math.random() * 1.2
            };

            this.scene.add(mesh);
            this.particles.push(p);
        }
    }

    // ✨ Totem of Undying Angelic Fountain Particles (Golden & Emerald Vortex)
    spawnTotemParticles(x, y, z, count = 42) {
        if (!this.totemGeom) {
            this.totemGeom = new THREE.BoxGeometry(0.14, 0.14, 0.14);
            this.totemMats = [
                new THREE.MeshBasicMaterial({ color: 0xffd700 }), // Pure Gold
                new THREE.MeshBasicMaterial({ color: 0x00e676 }), // Emerald Green
                new THREE.MeshBasicMaterial({ color: 0x69f0ae }), // Light Mint
                new THREE.MeshBasicMaterial({ color: 0xffeb3b }), // Lemon Sun
                new THREE.MeshBasicMaterial({ color: 0xffffff })  // Divine White
            ];
        }

        while (this.particles.length + count > 140) {
            const old = this.particles.shift();
            if (old && old.mesh) this.scene.remove(old.mesh);
        }

        for (let i = 0; i < count; i++) {
            const mat = this.totemMats[i % this.totemMats.length];
            const mesh = new THREE.Mesh(this.totemGeom, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 1.2,
                y + (Math.random() - 0.5) * 0.8,
                z + (Math.random() - 0.5) * 1.2
            );

            const speed = 1.5 + Math.random() * 3.5;
            const angle = (i / count) * Math.PI * 4;

            const p = {
                mesh,
                vx: Math.cos(angle) * speed * 0.8,
                vy: 3.5 + Math.random() * 4.5, // Erupts upwards!
                vz: Math.sin(angle) * speed * 0.8,
                rx: Math.random() * 10,
                ry: Math.random() * 10,
                gravity: 1.5, // Low gravity float
                scale: 1.2,
                life: 1.0,
                decay: 0.9 + Math.random() * 0.6
            };

            this.scene.add(mesh);
            this.particles.push(p);
        }
    }

    // Minecraft Sweeping Edge Arc Wave (Horizontal crescent blade arc)
    spawnSweepParticles(origin, dir) {
        if (!this.sweepGeom) {
            this.sweepGeom = new THREE.BoxGeometry(0.38, 0.05, 0.16);
            this.sweepMat = new THREE.MeshBasicMaterial({
                color: 0xf0f8ff,
                transparent: true,
                opacity: 0.9
            });
        }

        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(dir, up).normalize();
        const count = 9;

        for (let i = 0; i < count; i++) {
            const t = (i / (count - 1)) - 0.5; // -0.5 to 0.5
            const angle = t * 1.4;
            const arcDir = dir.clone().multiplyScalar(Math.cos(angle)).add(right.clone().multiplyScalar(Math.sin(angle))).normalize();

            const mesh = new THREE.Mesh(this.sweepGeom, this.sweepMat.clone());
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), arcDir);

            const startPos = origin.clone().add(arcDir.clone().multiplyScalar(1.2 + Math.abs(t) * 0.4));
            mesh.position.copy(startPos);

            const p = {
                mesh,
                vx: arcDir.x * 4.2,
                vy: 0.15,
                vz: arcDir.z * 4.2,
                rx: 0,
                ry: 0,
                gravity: 0,
                scale: 1.0,
                life: 1.0,
                decay: 3.8,
                isSweep: true
            };

            this.scene.add(mesh);
            this.particles.push(p);
        }
    }

    // Shield Deflection Sparks
    spawnShieldBlockParticles(x, y, z, count = 12) {
        if (!this.shieldSparkGeom) {
            this.shieldSparkGeom = new THREE.BoxGeometry(0.09, 0.09, 0.09);
            this.shieldSparkMats = [
                new THREE.MeshBasicMaterial({ color: 0xffea00 }),
                new THREE.MeshBasicMaterial({ color: 0xffffff }),
                new THREE.MeshBasicMaterial({ color: 0x90caf9 })
            ];
        }

        for (let i = 0; i < count; i++) {
            const mat = this.shieldSparkMats[i % this.shieldSparkMats.length];
            const mesh = new THREE.Mesh(this.shieldSparkGeom, mat);
            mesh.position.set(x, y, z);

            const p = {
                mesh,
                vx: (Math.random() - 0.5) * 5.5,
                vy: Math.random() * 3.5 + 1.2,
                vz: (Math.random() - 0.5) * 5.5,
                rx: Math.random() * 10,
                ry: Math.random() * 10,
                gravity: 8.5,
                scale: 1.0,
                life: 1.0,
                decay: 3.2 + Math.random() * 1.5
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

            if (p.isSweep && p.mesh && p.mesh.material) {
                p.mesh.material.opacity = Math.max(0, p.life * 0.9);
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

        // Update bullet tracers (smooth fadeout)
        if (this.tracers && this.tracers.length > 0) {
            const now = performance.now();
            for (let i = this.tracers.length - 1; i >= 0; i--) {
                const tr = this.tracers[i];
                const elapsed = now - tr.startTime;
                if (elapsed >= tr.duration) {
                    if (this.scene) this.scene.remove(tr.line);
                    tr.line.geometry?.dispose();
                    if (tr.line.material) {
                        if (Array.isArray(tr.line.material)) tr.line.material.forEach(m => m.dispose());
                        else tr.line.material.dispose();
                    }
                    this.tracers.splice(i, 1);
                } else {
                    const alpha = 1.0 - (elapsed / tr.duration);
                    if (tr.line.material) {
                        tr.line.material.opacity = alpha * (tr.startOpacity || 0.95);
                    }
                }
            }
        }

        // Update bullet holes (slow fadeout after 25 seconds)
        if (this.bulletHoles && this.bulletHoles.length > 0) {
            const now = performance.now();
            for (let i = this.bulletHoles.length - 1; i >= 0; i--) {
                const bh = this.bulletHoles[i];
                const elapsed = now - bh.createdAt;
                if (elapsed > 25000) {
                    const fade = (elapsed - 25000) / 5000;
                    if (fade >= 1.0) {
                        if (this.scene) this.scene.remove(bh.mesh);
                        bh.mesh.geometry?.dispose();
                        if (bh.mesh.material) {
                            if (Array.isArray(bh.mesh.material)) bh.mesh.material.forEach(m => m.dispose());
                            else bh.mesh.material.dispose();
                        }
                        this.bulletHoles.splice(i, 1);
                    } else if (bh.mesh.material) {
                        bh.mesh.material.opacity = (1.0 - fade) * 0.92;
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
    constructor(x, y, z, scene, textureManager, soundManager, world, particleSystem, game, options = {}) {
        this.x = x + 0.5;
        this.y = y;
        this.z = z + 0.5;
        this.scene = scene;
        this.textureManager = textureManager;
        this.soundManager = soundManager;
        this.world = world;
        this.particleSystem = particleSystem;
        this.game = game;

        this.isRemote = !!options.isRemote;
        this.blastRadius = options.blastRadius || 3.8;
        this.fuse = options.fuse || 2.2; // seconds
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
        const radius = this.blastRadius;
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

        // Shared-room remote explosives cannot damage other players.
        const coop = this.game && this.game.serverClient && this.game.serverClient.currentRoom?.startsWith('coop_');
        // Push player if within blast radius
        if (this.game && this.game.player && !(coop && this.isRemote)) {
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

// Planted charges stay still until the player uses the detonator.
class C4Entity extends TNTEntity {
    constructor(...args) {
        super(...args, { fuse: Infinity, blastRadius: 5.5 });
        this.isC4 = true;
        this.vx = this.vy = this.vz = 0;
        this.mat = this.textureManager.getItemDropMaterial('c4');
        this.mesh.material = this.mat;
        this.mesh.scale.set(0.7, 0.3, 0.7);
        this.mesh.position.y = this.y + 0.2;
    }

    update() {}

}

window.C4Entity = C4Entity;
window.ParticleSystem = ParticleSystem;
window.TNTEntity = TNTEntity;

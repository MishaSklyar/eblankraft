/**
 * Eblankraft - Dynamic Weather & Precipitation Engine
 * Rain, Snow, Thunderstorms, Biome-Aware Weather & Atmospheric Shading
 */
class WeatherManager {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.type = 'clear'; // 'clear' | 'rain' | 'thunder' | 'snow'
        this.intensity = 0.0;
        this.targetIntensity = 0.0;
        this.cycleEnabled = true;
        this.timer = 0;
        this.nextChangeTime = 240 + Math.random() * 180; // 4 to 7 minutes
        this.lightningTimer = 0;
        this.isFlashing = false;
        this.flashDuration = 0;

        // Base lighting presets to restore
        this.baseSunIntensity = 0.85;
        this.baseAmbientIntensity = 0.65;
        this.baseCloudColor = new THREE.Color(0xffffff);
        this.stormCloudColor = new THREE.Color(0x4a4e5d);

        this.initRainParticles();
        this.initSnowParticles();
    }

    initRainParticles() {
        const count = 1200;
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 36;
            positions[i * 3 + 1] = Math.random() * 22;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 36;
            velocities[i] = 38 + Math.random() * 12;
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.rainVelocities = velocities;

        // Rain streak points material
        this.rainMat = new THREE.PointsMaterial({
            color: 0x82b2e8,
            size: 0.28,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

        this.rainPoints = new THREE.Points(geom, this.rainMat);
        this.rainPoints.frustumCulled = false;
        this.rainPoints.visible = false;
        this.scene.add(this.rainPoints);
    }

    initSnowParticles() {
        const count = 900;
        const positions = new Float32Array(count * 3);
        const speeds = new Float32Array(count);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 36;
            positions[i * 3 + 1] = Math.random() * 20;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 36;
            speeds[i] = 3.5 + Math.random() * 2.5;
            phases[i] = Math.random() * Math.PI * 2;
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.snowSpeeds = speeds;
        this.snowPhases = phases;

        this.snowMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.38,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

        this.snowPoints = new THREE.Points(geom, this.snowMat);
        this.snowPoints.frustumCulled = false;
        this.snowPoints.visible = false;
        this.scene.add(this.snowPoints);
    }

    setWeather(type, showToast = true) {
        const valid = ['clear', 'rain', 'thunder', 'snow'];
        if (!valid.includes(type)) type = 'clear';
        this.type = type;
        this.targetIntensity = (type === 'clear') ? 0.0 : 1.0;
        this.timer = 0;
        this.nextChangeTime = (type === 'clear') ? (300 + Math.random() * 200) : (180 + Math.random() * 120);

        if (this.game && this.game.soundManager) {
            if (type === 'rain' || type === 'thunder') {
                this.game.soundManager.startRainAmbient();
            } else if (type === 'clear' || type === 'snow') {
                this.game.soundManager.stopRainAmbient();
            }
        }

        if (showToast && this.game && this.game.ui) {
            const labels = {
                clear: '☀️ Погода: Ясно та сонячно!',
                rain: '🌧️ Погода: Почався дощ!',
                thunder: '⛈️ Погода: Насувається гроза та блискавки!',
                snow: '❄️ Погода: Пішов пухнастий сніг!'
            };
            this.game.ui.showToast(labels[type] || 'Погода змінена');
        }
    }

    update(dt) {
        // Only active in Overworld
        if (!this.game.world || this.game.world.dimension !== 'overworld') {
            if (this.rainPoints) this.rainPoints.visible = false;
            if (this.snowPoints) this.snowPoints.visible = false;
            if (this.game.soundManager) this.game.soundManager.stopRainAmbient();
            return;
        }

        const player = this.game.player;
        if (!player) return;

        // Auto weather cycle progression
        if (this.cycleEnabled) {
            this.timer += dt;
            if (this.timer >= this.nextChangeTime) {
                this.timer = 0;
                if (this.type === 'clear') {
                    const rnd = Math.random();
                    if (rnd < 0.60) this.setWeather('rain');
                    else if (rnd < 0.85) this.setWeather('thunder');
                    else this.setWeather('snow');
                } else {
                    this.setWeather('clear');
                }
            }
        }

        // Smoothly lerp weather intensity
        if (this.intensity < this.targetIntensity) {
            this.intensity = Math.min(this.targetIntensity, this.intensity + dt * 0.4);
        } else if (this.intensity > this.targetIntensity) {
            this.intensity = Math.max(this.targetIntensity, this.intensity - dt * 0.4);
        }

        // Biome detection at player location
        const biome = this.game.world.getBiomeAt(player.position.x, player.position.z);
        let activePrecip = 'none';

        if (this.intensity > 0.05) {
            if (this.type === 'snow') {
                activePrecip = 'snow';
            } else if (this.type === 'rain' || this.type === 'thunder') {
                if (biome.precipitation === 'snow') {
                    activePrecip = 'snow';
                } else if (biome.precipitation === 'none') {
                    activePrecip = 'none'; // dry desert
                } else {
                    activePrecip = 'rain';
                }
            }
        }

        // Update audio volume based on intensity
        if (this.game.soundManager) {
            if (activePrecip === 'rain') {
                this.game.soundManager.setRainVolume(0.22 * this.intensity);
            } else if (this.type === 'clear') {
                this.game.soundManager.stopRainAmbient();
            }
        }

        // Skip weather particles in Turbo or A02 mode to save 2000+ Float32Array updates per frame!
        if (this.game && (this.game.turboFPS || this.game.isA02Mode)) {
            if (this.rainPoints) this.rainPoints.visible = false;
            if (this.snowPoints) this.snowPoints.visible = false;
            return;
        }

        // Rain Particles Update
        if (this.rainPoints) {
            if (activePrecip === 'rain' && this.intensity > 0.02) {
                this.rainPoints.visible = true;
                this.rainMat.opacity = Math.min(0.75, this.intensity * 0.75);
                this.rainPoints.position.set(player.position.x, player.position.y, player.position.z);

                const pos = this.rainPoints.geometry.attributes.position.array;
                const vels = this.rainVelocities;
                const count = vels.length;

                for (let i = 0; i < count; i++) {
                    const idx = i * 3;
                    pos[idx + 1] -= vels[i] * dt;
                    if (pos[idx + 1] < -4) {
                        pos[idx] = (Math.random() - 0.5) * 36;
                        pos[idx + 1] = 16 + Math.random() * 6;
                        pos[idx + 2] = (Math.random() - 0.5) * 36;
                    }
                }
                this.rainPoints.geometry.attributes.position.needsUpdate = true;
            } else {
                this.rainPoints.visible = false;
            }
        }

        // Snow Particles Update
        if (this.snowPoints) {
            if (activePrecip === 'snow' && this.intensity > 0.02) {
                this.snowPoints.visible = true;
                this.snowMat.opacity = Math.min(0.85, this.intensity * 0.85);
                this.snowPoints.position.set(player.position.x, player.position.y, player.position.z);

                const pos = this.snowPoints.geometry.attributes.position.array;
                const spds = this.snowSpeeds;
                const phs = this.snowPhases;
                const count = spds.length;
                const now = performance.now() * 0.001;

                for (let i = 0; i < count; i++) {
                    const idx = i * 3;
                    pos[idx + 1] -= spds[i] * dt;
                    pos[idx] += Math.sin(now + phs[i]) * 1.5 * dt;
                    pos[idx + 2] += Math.cos(now * 0.8 + phs[i]) * 1.5 * dt;

                    if (pos[idx + 1] < -4) {
                        pos[idx] = (Math.random() - 0.5) * 36;
                        pos[idx + 1] = 14 + Math.random() * 6;
                        pos[idx + 2] = (Math.random() - 0.5) * 36;
                    }
                }
                this.snowPoints.geometry.attributes.position.needsUpdate = true;
            } else {
                this.snowPoints.visible = false;
            }
        }

        // Thunderstorm lightning flashes
        if (this.type === 'thunder' && this.intensity > 0.5) {
            this.lightningTimer += dt;
            if (this.lightningTimer > 9.0 + Math.random() * 8.0) {
                this.lightningTimer = 0;
                this.triggerLightning();
            }
        }

        // Handle active flash
        if (this.isFlashing) {
            this.flashDuration -= dt;
            if (this.flashDuration <= 0) {
                this.isFlashing = false;
                if (this.game.sunLight) {
                    this.game.sunLight.color.setHex(0xfffaed);
                }
            }
        }

        // Atmospheric Sky, Sun & Cloud Tinting
        if (this.game.cloudMesh && this.game.cloudMesh.material) {
            const targetColor = (this.intensity > 0) ?
                this.baseCloudColor.clone().lerp(this.stormCloudColor, this.intensity) :
                this.baseCloudColor;
            this.game.cloudMesh.material.color.copy(targetColor);
        }

        // Sun light dimming during bad weather
        if (this.game.sunLight && !this.isFlashing) {
            const dimMult = 1.0 - (this.type === 'thunder' ? 0.65 : 0.45) * this.intensity;
            this.game.sunLight.intensity = this.baseSunIntensity * dimMult;
        }
        if (this.game.ambientLight) {
            const dimMult = 1.0 - (this.type === 'thunder' ? 0.50 : 0.30) * this.intensity;
            this.game.ambientLight.intensity = this.baseAmbientIntensity * dimMult;
        }
    }

    triggerLightning() {
        this.isFlashing = true;
        this.flashDuration = 0.09;

        if (this.game.sunLight) {
            this.game.sunLight.color.setHex(0xffffff);
            this.game.sunLight.intensity = 2.5;
        }

        // Play thunder sound
        if (this.game.soundManager) {
            this.game.soundManager.playThunder();
        }
    }
}

window.WeatherManager = WeatherManager;

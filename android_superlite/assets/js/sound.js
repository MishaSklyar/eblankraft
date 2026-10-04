/**
 * Eblankraft - Procedural Web Audio Synthesizer & Meme Voice Engine
 * 100% self-contained audio generation (no external mp3 files required)
 */

class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.voiceEnabled = true;
        this.lastStepTime = 0;
        this.memePhrases = [
            "Опа!",
            "Бабах!",
            "Красава!",
            "Ну всё, приехали!",
            "Ебланкрафт топ!",
            "Алмазы сюда!",
            "Шо ты делаешь?",
            "Ой бля!",
            "Ай больно в ноге!",
            "Не трогай динамит!"
        ];
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
                // Anti-clipping Master Dynamics Compressor to protect PipeWire and speakers
                try {
                    this.compressor = this.ctx.createDynamicsCompressor();
                    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
                    this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
                    this.compressor.ratio.setValueAtTime(14, this.ctx.currentTime);
                    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
                    this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

                    this.outNode = this.ctx.createGain();
                    this.outNode.gain.setValueAtTime(0.85, this.ctx.currentTime);

                    this.outNode.connect(this.compressor);
                    this.compressor.connect(this.ctx.destination);
                } catch (e) {
                    this.outNode = this.ctx.destination;
                }
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    getDestination() {
        return this.outNode || (this.ctx ? this.ctx.destination : null);
    }

    // White noise buffer generator (cached to prevent garbage collection freezes)
    createNoiseBuffer(duration = 0.5) {
        if (!this.ctx) return null;
        if (!this.sharedNoiseBuffer || this.sharedNoiseBuffer.duration < duration) {
            const bufLen = Math.max(duration, 3.0);
            const bufferSize = Math.floor(this.ctx.sampleRate * bufLen);
            this.sharedNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = this.sharedNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        return this.sharedNoiseBuffer;
    }

    playBreak(soundType = "stone") {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.15);

        const filter = this.ctx.createBiquadFilter();
        if (soundType === 'grass' || soundType === 'leaves') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1200, now);
            filter.Q.setValueAtTime(1.5, now);
        } else if (soundType === 'snow') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(950, now);
            filter.Q.setValueAtTime(2.0, now);
        } else if (soundType === 'wood') {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, now);
        } else if (soundType === 'glass') {
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(3000, now);
        } else {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
        }

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(soundType === 'snow' ? 0.28 : 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());

        noise.start(now);
        noise.stop(now + 0.15);

        // Sub click
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(soundType === 'glass' ? 800 : (soundType === 'snow' ? 100 : 150), now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

        oscGain.gain.setValueAtTime(0.3, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(oscGain);
        oscGain.connect(this.getDestination());

        osc.start(now);
        osc.stop(now + 0.09);
    }

    playPlace(soundType = "stone") {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        const startFreq = soundType === 'wood' ? 180 : (soundType === 'grass' ? 320 : (soundType === 'snow' ? 130 : 220));
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.getDestination());

        osc.start(now);
        osc.stop(now + 0.11);
    }

    playStep() {
        if (!this.enabled) return;
        const nowMs = performance.now();
        if (nowMs - this.lastStepTime < 320) return;
        this.lastStepTime = nowMs;

        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.06);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600 + Math.random() * 200, now);
        filter.Q.setValueAtTime(2.0, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());

        noise.start(now);
        noise.stop(now + 0.06);
    }

    playJump() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.15);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.getDestination());

        osc.start(now);
        osc.stop(now + 0.16);
    }

    playFuse() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        if (this.lastFuseTime && (now - this.lastFuseTime) < 0.08) return;
        this.lastFuseTime = now;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(2.4);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2500, now);
        filter.frequency.linearRampToValueAtTime(5000, now + 2.4);
        filter.Q.setValueAtTime(4.0, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 2.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.outNode || this.getDestination());

        noise.start(now);
        noise.stop(now + 2.4);
    }

    playExplosion() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Rate limiter: prevent PipeWire audio buffer saturation
        if (this.lastExplosionTime && (now - this.lastExplosionTime) < 0.07) {
            return;
        }
        this.lastExplosionTime = now;

        // 1. Massive noise blast
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(1.2);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 1.0);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.9, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.outNode || this.getDestination());

        noise.start(now);
        noise.stop(now + 1.2);

        // 2. Sub-bass boom oscillator
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.9);

        oscGain.gain.setValueAtTime(0.7, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        osc.connect(oscGain);
        oscGain.connect(this.outNode || this.getDestination());

        osc.start(now);
        osc.stop(now + 0.9);

        // 3. Meme voice line after explosion (throttled to at most once per 3.5 seconds)
        const timeNow = performance.now();
        if (!this.lastMemeTime || (timeNow - this.lastMemeTime) > 3500) {
            this.lastMemeTime = timeNow;
            setTimeout(() => {
                this.speakRandomMeme(["Бабах!", "Ну всё нахрен!", "Вот это ебануло!", "Красиво горит!"]);
            }, 300);
        }
    }

    playHurt() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(70, now + 0.18);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.getDestination());

        osc.start(now);
        osc.stop(now + 0.19);

        if (Math.random() > 0.4) {
            this.speakRandomMeme(["Ай!", "Ой бля!", "Больно!", "Сука!", "Ебать!"]);
        }
    }

    playClick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(350, now + 0.04);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.getDestination());

        osc.start(now);
        osc.stop(now + 0.05);
    }

    playChip() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320 + Math.random() * 80, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        osc.connect(gain);
        gain.connect(this.getDestination());
        osc.start(now);
        osc.stop(now + 0.05);
    }

    playPickup() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1300, now + 0.09);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        osc.connect(gain);
        gain.connect(this.getDestination());
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playSplash() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.35);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
        filter.Q.setValueAtTime(2.0, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());

        noise.start(now);
        noise.stop(now + 0.35);

        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
        oscGain.gain.setValueAtTime(0.3, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(oscGain);
        oscGain.connect(this.getDestination());
        osc.start(now);
        osc.stop(now + 0.26);
    }

    playSwim() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.2);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.18);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());

        noise.start(now);
        noise.stop(now + 0.2);
    }

    playSizzle() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.6);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(700, now + 0.5);
        filter.Q.setValueAtTime(1.5, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());

        noise.start(now);
        noise.stop(now + 0.6);
    }

    playEat() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 3; i++) {
            const t = now + i * 0.08;
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(0.06);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, t);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.getDestination());
            noise.start(t);
            noise.stop(t + 0.06);
        }
    }

    playZombieGroan() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(85, now);
        osc.frequency.linearRampToValueAtTime(65, now + 0.6);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, now);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());
        osc.start(now);
        osc.stop(now + 0.6);
    }

    playCreeperHiss() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(1.4);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());
        noise.start(now);
        noise.stop(now + 1.4);
    }

    playDragonRoar() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());
        osc.start(now);
        osc.stop(now + 1.2);
    }

    playPortalWarp() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(620, now + 0.4);
        osc.frequency.linearRampToValueAtTime(280, now + 0.8);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.connect(gain);
        gain.connect(this.getDestination());
        osc.start(now);
        osc.stop(now + 0.8);
    }

    playRouletteTick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1100, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        osc.connect(gain);
        gain.connect(this.getDestination());
        osc.start(now);
        osc.stop(now + 0.025);
    }

    playWinFanfare() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const now = this.ctx.currentTime;
        notes.forEach((freq, idx) => {
            const t = now + idx * 0.12;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
            osc.connect(gain);
            gain.connect(this.getDestination());
            osc.start(t);
            osc.stop(t + 0.3);
        });
    }

    startRainAmbient() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx || this.rainAmbientNode) return;
        try {
            const buffer = this.createNoiseBuffer(3.0);
            if (!buffer) return;
            this.rainSource = this.ctx.createBufferSource();
            this.rainSource.buffer = buffer;
            this.rainSource.loop = true;

            this.rainFilter = this.ctx.createBiquadFilter();
            this.rainFilter.type = 'lowpass';
            this.rainFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);

            this.rainGain = this.ctx.createGain();
            this.rainGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
            this.rainGain.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 1.5);

            this.rainSource.connect(this.rainFilter);
            this.rainFilter.connect(this.rainGain);
            this.rainGain.connect(this.getDestination());
            this.rainSource.start();
            this.rainAmbientNode = this.rainSource;
        } catch (e) {}
    }

    setRainVolume(vol = 0.22) {
        if (this.rainGain && this.ctx) {
            try {
                this.rainGain.gain.cancelScheduledValues(this.ctx.currentTime);
                this.rainGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(vol, 0.4)), this.ctx.currentTime + 0.3);
            } catch (e) {}
        }
    }

    stopRainAmbient() {
        if (this.rainAmbientNode && this.ctx) {
            try {
                if (this.rainGain) {
                    this.rainGain.gain.cancelScheduledValues(this.ctx.currentTime);
                    this.rainGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
                }
                const src = this.rainSource;
                setTimeout(() => {
                    try {
                        if (src) {
                            src.stop();
                            src.disconnect();
                        }
                    } catch (e) {}
                    if (this.rainSource === src) {
                        this.rainSource = null;
                        this.rainAmbientNode = null;
                    }
                }, 850);
            } catch (e) {
                this.rainAmbientNode = null;
            }
        }
    }

    playThunder() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        try {
            // Low rumble oscillator
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(70, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 2.0);

            oscGain.gain.setValueAtTime(0.4, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

            // Filtered thunder crack
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.createNoiseBuffer(2.6);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, now);
            filter.frequency.linearRampToValueAtTime(120, now + 2.2);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.55, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.005, now + 2.6);

            osc.connect(oscGain);
            oscGain.connect(this.getDestination());
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.getDestination());

            osc.start(now);
            osc.stop(now + 2.2);
            noise.start(now);
            noise.stop(now + 2.6);
        } catch (e) {}
    }

    speakRandomMeme(customList = null) {
        if (!this.voiceEnabled || !window.speechSynthesis) return;
        const list = customList || this.memePhrases;
        const phrase = list[Math.floor(Math.random() * list.length)];
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(phrase);
            utterance.lang = 'uk-UA';
            utterance.rate = 1.15 + (Math.random() * 0.3 - 0.15);
            utterance.pitch = 1.1 + (Math.random() * 0.4 - 0.2);
            window.speechSynthesis.speak(utterance);
        } catch (e) {}
    }
}

window.SoundManager = SoundManager;


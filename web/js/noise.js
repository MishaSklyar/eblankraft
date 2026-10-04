/**
 * Eblankraft - Procedural Noise Generator
 * Fast, lightweight 2D & 3D Perlin / Simplex Noise
 */
class PerlinNoise {
    constructor(seed = 1337) {
        this.seed = seed;
        this.p = new Uint8Array(512);
        this.permutation = new Uint8Array(256);
        this.init(seed);
    }

    init(seed) {
        let s = seed % 2147483647;
        if (s <= 0) s += 2147483646;
        const random = () => {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };

        for (let i = 0; i < 256; i++) {
            this.permutation[i] = i;
        }
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const tmp = this.permutation[i];
            this.permutation[i] = this.permutation[j];
            this.permutation[j] = tmp;
        }
        for (let i = 0; i < 512; i++) {
            this.p[i] = this.permutation[i & 255];
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad2D(hash, x, y) {
        const h = hash & 7;
        const u = h < 4 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
    }

    grad3D(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }

    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);

        const u = this.fade(xf);
        const v = this.fade(yf);

        const aa = this.p[this.p[X] + Y];
        const ab = this.p[this.p[X] + Y + 1];
        const ba = this.p[this.p[X + 1] + Y];
        const bb = this.p[this.p[X + 1] + Y + 1];

        const x1 = this.lerp(u, this.grad2D(aa, xf, yf), this.grad2D(ba, xf - 1, yf));
        const x2 = this.lerp(u, this.grad2D(ab, xf, yf - 1), this.grad2D(bb, xf - 1, yf - 1));

        return this.lerp(v, x1, x2);
    }

    noise3D(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const zf = z - Math.floor(z);

        const u = this.fade(xf);
        const v = this.fade(yf);
        const w = this.fade(zf);

        const a  = this.p[X] + Y;
        const aa = this.p[a] + Z;
        const ab = this.p[a + 1] + Z;
        const b  = this.p[X + 1] + Y;
        const ba = this.p[b] + Z;
        const bb = this.p[b + 1] + Z;

        const c1 = this.grad3D(this.p[aa], xf, yf, zf);
        const c2 = this.grad3D(this.p[ba], xf - 1, yf, zf);
        const c3 = this.grad3D(this.p[ab], xf, yf - 1, zf);
        const c4 = this.grad3D(this.p[bb], xf - 1, yf - 1, zf);
        const c5 = this.grad3D(this.p[aa + 1], xf, yf, zf - 1);
        const c6 = this.grad3D(this.p[ba + 1], xf - 1, yf, zf - 1);
        const c7 = this.grad3D(this.p[ab + 1], xf, yf - 1, zf - 1);
        const c8 = this.grad3D(this.p[bb + 1], xf - 1, yf - 1, zf - 1);

        const x1 = this.lerp(u, c1, c2);
        const x2 = this.lerp(u, c3, c4);
        const y1 = this.lerp(v, x1, x2);

        const x3 = this.lerp(u, c5, c6);
        const x4 = this.lerp(u, c7, c8);
        const y2 = this.lerp(v, x3, x4);

        return this.lerp(w, y1, y2);
    }

    fbm2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return total / maxValue;
    }
}

window.PerlinNoise = PerlinNoise;

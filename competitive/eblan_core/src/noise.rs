/// EblanEng - High-performance procedural noise in Rust
pub struct PerlinNoise {
    p: [u8; 512],
}

impl PerlinNoise {
    pub fn new(seed: i32) -> Self {
        let mut p = [0u8; 512];
        let mut permutation = [0u8; 256];
        for i in 0..256 {
            permutation[i] = i as u8;
        }

        let mut s: i64 = seed as i64 % 2147483647;
        if s <= 0 {
            s += 2147483646;
        }

        for i in (1..256).rev() {
            s = (s * 16807) % 2147483647;
            let rnd = (s - 1) as f64 / 2147483646.0;
            let j = (rnd * (i + 1) as f64) as usize;
            permutation.swap(i, j);
        }

        for i in 0..512 {
            p[i] = permutation[i & 255];
        }

        Self { p }
    }

    #[inline(always)]
    fn fade(t: f64) -> f64 {
        t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
    }

    #[inline(always)]
    fn lerp(t: f64, a: f64, b: f64) -> f64 {
        a + t * (b - a)
    }

    #[inline(always)]
    fn grad2d(hash: u8, x: f64, y: f64) -> f64 {
        let h = hash & 7;
        let u = if h < 4 { x } else { y };
        let v = if h < 4 { y } else { x };
        (if (h & 1) != 0 { -u } else { u }) + (if (h & 2) != 0 { -2.0 * v } else { 2.0 * v })
    }

    #[inline(always)]
    fn grad3d(hash: u8, x: f64, y: f64, z: f64) -> f64 {
        let h = hash & 15;
        let u = if h < 8 { x } else { y };
        let v = if h < 4 { y } else if h == 12 || h == 14 { x } else { z };
        (if (h & 1) != 0 { -u } else { u }) + (if (h & 2) != 0 { -v } else { v })
    }

    pub fn noise2d(&self, x: f64, y: f64) -> f64 {
        let xi = x.floor() as i64;
        let yi = y.floor() as i64;
        let x_idx = (xi & 255) as usize;
        let y_idx = (yi & 255) as usize;

        let xf = x - x.floor();
        let yf = y - y.floor();

        let u = Self::fade(xf);
        let v = Self::fade(yf);

        let aa = self.p[self.p[x_idx] as usize + y_idx];
        let ab = self.p[self.p[x_idx] as usize + y_idx + 1];
        let ba = self.p[self.p[x_idx + 1] as usize + y_idx];
        let bb = self.p[self.p[x_idx + 1] as usize + y_idx + 1];

        let x1 = Self::lerp(u, Self::grad2d(aa, xf, yf), Self::grad2d(ba, xf - 1.0, yf));
        let x2 = Self::lerp(u, Self::grad2d(ab, xf, yf - 1.0), Self::grad2d(bb, xf - 1.0, yf - 1.0));

        Self::lerp(v, x1, x2)
    }

    pub fn noise3d(&self, x: f64, y: f64, z: f64) -> f64 {
        let xi = x.floor() as i64;
        let yi = y.floor() as i64;
        let zi = z.floor() as i64;
        let x_idx = (xi & 255) as usize;
        let y_idx = (yi & 255) as usize;
        let z_idx = (zi & 255) as usize;

        let xf = x - x.floor();
        let yf = y - y.floor();
        let zf = z - z.floor();

        let u = Self::fade(xf);
        let v = Self::fade(yf);
        let w = Self::fade(zf);

        let a = self.p[x_idx] as usize + y_idx;
        let aa = self.p[a] as usize + z_idx;
        let ab = self.p[a + 1] as usize + z_idx;
        let b = self.p[x_idx + 1] as usize + y_idx;
        let ba = self.p[b] as usize + z_idx;
        let bb = self.p[b + 1] as usize + z_idx;

        let c1 = Self::grad3d(self.p[aa], xf, yf, zf);
        let c2 = Self::grad3d(self.p[ba], xf - 1.0, yf, zf);
        let c3 = Self::grad3d(self.p[ab], xf, yf - 1.0, zf);
        let c4 = Self::grad3d(self.p[bb], xf - 1.0, yf - 1.0, zf);
        let c5 = Self::grad3d(self.p[aa + 1], xf, yf, zf - 1.0);
        let c6 = Self::grad3d(self.p[ba + 1], xf - 1.0, yf, zf - 1.0);
        let c7 = Self::grad3d(self.p[ab + 1], xf, yf - 1.0, zf - 1.0);
        let c8 = Self::grad3d(self.p[bb + 1], xf - 1.0, yf - 1.0, zf - 1.0);

        let x1 = Self::lerp(u, c1, c2);
        let x2 = Self::lerp(u, c3, c4);
        let y1 = Self::lerp(v, x1, x2);

        let x3 = Self::lerp(u, c5, c6);
        let x4 = Self::lerp(u, c7, c8);
        let y2 = Self::lerp(v, x3, x4);

        Self::lerp(w, y1, y2)
    }

    pub fn fbm2d(&self, x: f64, y: f64, octaves: i32, persistence: f64, lacunarity: f64) -> f64 {
        let mut total = 0.0;
        let mut frequency = 1.0;
        let mut amplitude = 1.0;
        let mut max_value = 0.0;

        for _ in 0..octaves {
            total += self.noise2d(x * frequency, y * frequency) * amplitude;
            max_value += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        total / max_value
    }
}

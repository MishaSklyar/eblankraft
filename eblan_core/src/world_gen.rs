use crate::noise::PerlinNoise;
use crate::mesher::{CHUNK_X, CHUNK_Y, CHUNK_Z};

pub const AIR: u8 = 0;
pub const GRASS: u8 = 1;
pub const DIRT: u8 = 2;
pub const STONE: u8 = 3;
pub const COBBLESTONE: u8 = 4;
pub const WOOD: u8 = 5;
pub const PLANKS: u8 = 6;
pub const LEAVES: u8 = 7;
pub const GLASS: u8 = 9;
pub const SAND: u8 = 10;
pub const TNT: u8 = 11;
pub const DIAMOND_BLOCK: u8 = 12;
pub const GOLD_BLOCK: u8 = 13;
pub const EBLAN_BLOCK: u8 = 14;
pub const BEDROCK: u8 = 15;
pub const GLOWSTONE: u8 = 16;
pub const WATER: u8 = 19;
pub const LAVA: u8 = 20;
pub const MEME_CAT: u8 = 22;
pub const COAL_ORE: u8 = 23;
pub const IRON_ORE: u8 = 24;
pub const OBSIDIAN: u8 = 25;
pub const NETHERRACK: u8 = 26;
pub const SOUL_SAND: u8 = 27;
pub const NETHER_BRICKS: u8 = 28;
pub const NETHER_QUARTZ: u8 = 29;
pub const NETHERITE_BLOCK: u8 = 30;
pub const END_STONE: u8 = 31;
pub const SNOW: u8 = 35;
pub const ICE: u8 = 36;
pub const PACKED_ICE: u8 = 37;
pub const SANDSTONE: u8 = 38;
pub const CACTUS: u8 = 39;
pub const BIRCH_WOOD: u8 = 40;
pub const BIRCH_LEAVES: u8 = 41;
pub const SPRUCE_WOOD: u8 = 43;
pub const SPRUCE_LEAVES: u8 = 44;
pub const JUNGLE_WOOD: u8 = 46;
pub const JUNGLE_LEAVES: u8 = 47;
pub const RED_FLOWER: u8 = 48;
pub const YELLOW_FLOWER: u8 = 49;
pub const RED_MUSHROOM: u8 = 50;
pub const BROWN_MUSHROOM: u8 = 51;
pub const CLAY: u8 = 52;
pub const MOSSY_COBBLESTONE: u8 = 54;
pub const TERRACOTTA: u8 = 56;

#[inline(always)]
fn idx(x: usize, y: usize, z: usize) -> usize {
    x + CHUNK_X * (y + CHUNK_Y * z)
}

pub struct BiomeInfo {
    pub is_snow: bool,
    pub is_desert: bool,
    pub is_badlands: bool,
    pub is_jungle: bool,
    pub is_swamp: bool,
    pub is_taiga: bool,
    pub is_forest: bool,
    pub is_birch: bool,
    pub is_mountains: bool,
}

pub fn get_biome(noise: &PerlinNoise, wx: f64, wz: f64) -> BiomeInfo {
    let temp_noise = noise.noise2d(wx * 0.005 + 500.0, wz * 0.005 + 500.0);
    let moist_noise = noise.noise2d(wx * 0.005 - 500.0, wz * 0.005 - 500.0);
    let cont = noise.noise2d(wx * 0.013, wz * 0.013);

    let mut is_snow = false;
    let mut is_desert = false;
    let mut is_badlands = false;
    let mut is_jungle = false;
    let mut is_swamp = false;
    let mut is_taiga = false;
    let mut is_forest = false;
    let mut is_birch = false;
    let mut is_mountains = false;

    if temp_noise < -0.30 {
        is_snow = true;
    } else if temp_noise > 0.32 && moist_noise < -0.05 {
        if moist_noise < -0.30 {
            is_badlands = true;
        } else {
            is_desert = true;
        }
    } else if temp_noise > 0.16 && moist_noise > 0.30 {
        is_jungle = true;
    } else if moist_noise > 0.20 && cont < -0.05 {
        is_swamp = true;
    } else if temp_noise < 0.05 && moist_noise > 0.05 {
        is_taiga = true;
    } else if moist_noise > 0.10 && temp_noise > 0.0 {
        if noise.noise2d(wx * 0.02, wz * 0.02) > 0.18 {
            is_birch = true;
        } else {
            is_forest = true;
        }
    } else if cont > 0.26 {
        is_mountains = true;
    }

    BiomeInfo {
        is_snow,
        is_desert,
        is_badlands,
        is_jungle,
        is_swamp,
        is_taiga,
        is_forest,
        is_birch,
        is_mountains,
    }
}

pub fn generate_overworld_chunk(
    cx: i32,
    cz: i32,
    noise: &PerlinNoise,
    world_type: i32, // 0 = normal, 1 = flat, 2 = mountains, 3 = tnt
    water_level: i32,
    voxels: &mut [u8],
) {
    voxels.fill(AIR);

    let world_x0 = (cx * CHUNK_X as i32) as f64;
    let world_z0 = (cz * CHUNK_Z as i32) as f64;

    let mut height_map = [0i32; CHUNK_X * CHUNK_Z];

    for x in 0..CHUNK_X {
        for z in 0..CHUNK_Z {
            let wx = world_x0 + x as f64;
            let wz = world_z0 + z as f64;

            if world_type == 1 || world_type == 3 {
                height_map[x + z * CHUNK_X] = 4;
                continue;
            }

            let cont = noise.noise2d(wx * 0.013, wz * 0.013);
            let hills = noise.fbm2d(wx * 0.038, wz * 0.038, 3, 0.5, 2.0);
            let detail = noise.noise2d(wx * 0.08, wz * 0.08);

            let h = if world_type == 2 || cont > 0.16 {
                let mountain_elev = ((cont - 0.16) / 0.84).max(0.0);
                14.0 + hills * 8.0 + mountain_elev * 10.0 + detail * 2.0
            } else if cont < -0.22 {
                let valley_depth = ((-cont - 0.22) / 0.78).max(0.0);
                6.0 + hills * 3.0 - valley_depth * 4.0 + detail
            } else {
                8.0 + hills * 6.0 + detail * 1.5
            };

            height_map[x + z * CHUNK_X] = (h.floor() as i32).max(2).min(CHUNK_Y as i32 - 4);
        }
    }

    for x in 0..CHUNK_X {
        for z in 0..CHUNK_Z {
            let wx = world_x0 + x as f64;
            let wz = world_z0 + z as f64;
            let height = height_map[x + z * CHUNK_X];
            let biome = get_biome(noise, wx, wz);

            voxels[idx(x, 0, z)] = BEDROCK;

            if world_type == 1 {
                for y in 1..4 {
                    voxels[idx(x, y, z)] = DIRT;
                }
                voxels[idx(x, 4, z)] = GRASS;
                continue;
            }
            if world_type == 3 {
                for y in 1..4 {
                    voxels[idx(x, y, z)] = TNT;
                }
                voxels[idx(x, 4, z)] = EBLAN_BLOCK;
                continue;
            }

            // Fill solid column
            for y in 1..=height {
                let yu = y as usize;
                let block = if y == height {
                    if height <= water_level + 1 {
                        if biome.is_snow {
                            if height <= water_level { ICE } else { SNOW }
                        } else if biome.is_desert || biome.is_badlands {
                            SAND
                        } else if biome.is_swamp {
                            if noise.noise2d(wx * 0.4, wz * 0.4) > 0.1 { CLAY } else { GRASS }
                        } else {
                            SAND
                        }
                    } else if height >= 20 && (biome.is_mountains || biome.is_snow) {
                        if biome.is_snow || y % 3 == 0 {
                            SNOW
                        } else if y % 2 == 0 {
                            STONE
                        } else {
                            COBBLESTONE
                        }
                    } else if biome.is_desert {
                        SAND
                    } else if biome.is_badlands {
                        if height % 3 == 0 { TERRACOTTA } else if height % 2 == 0 { SAND } else { SANDSTONE }
                    } else if biome.is_snow {
                        SNOW
                    } else if biome.is_mountains {
                        if height >= 18 { STONE } else { GRASS }
                    } else {
                        GRASS
                    }
                } else if y >= height - 3 && height > water_level + 1 {
                    if biome.is_desert {
                        SANDSTONE
                    } else if biome.is_badlands {
                        TERRACOTTA
                    } else if biome.is_swamp && y <= water_level + 2 {
                        if y % 2 == 0 { CLAY } else { DIRT }
                    } else if biome.is_snow {
                        if height >= 18 { STONE } else { DIRT }
                    } else {
                        if height >= 21 { STONE } else { DIRT }
                    }
                } else {
                    let ore_noise = noise.noise3d(wx * 0.22, y as f64 * 0.22, wz * 0.22);
                    if ore_noise > 0.70 && y <= 6 {
                        DIAMOND_BLOCK
                    } else if ore_noise > 0.60 && y <= 12 {
                        GOLD_BLOCK
                    } else if ore_noise > 0.44 && y <= 20 {
                        IRON_ORE
                    } else if ore_noise < -0.46 && y <= 24 {
                        COAL_ORE
                    } else if ore_noise < -0.68 {
                        if biome.is_swamp || biome.is_taiga { MOSSY_COBBLESTONE } else { COBBLESTONE }
                    } else {
                        STONE
                    }
                };
                voxels[idx(x, yu, z)] = block;
            }

            // Fill water/ice in lakes
            for y in (height + 1)..=water_level {
                let yu = y as usize;
                if biome.is_snow {
                    voxels[idx(x, yu, z)] = if y == water_level { ICE } else { PACKED_ICE };
                } else {
                    voxels[idx(x, yu, z)] = WATER;
                }
            }

            // 3D Caves
            let max_cave_y = if height <= water_level + 1 {
                (height - 3).min(26)
            } else {
                (height - 1).min(26)
            };

            for y in 1..=max_cave_y {
                let yu = y as usize;
                let c1 = noise.noise3d(wx * 0.045, y as f64 * 0.065, wz * 0.045);
                let c2 = noise.noise3d(wx * 0.045 + 100.0, y as f64 * 0.065 + 100.0, wz * 0.045 + 100.0);
                if c1 * c1 + c2 * c2 < 0.036 {
                    if y <= 2 {
                        voxels[idx(x, yu, z)] = LAVA;
                    } else if y <= 4 && noise.noise2d(wx * 0.12, wz * 0.12) > 0.38 {
                        voxels[idx(x, yu, z)] = WATER;
                    } else {
                        voxels[idx(x, yu, z)] = AIR;
                    }
                }
            }

            // Surface details (plants, memes, cactus)
            let mut top_solid_y = -1i32;
            let mut top_b = AIR;
            for y in (1..=(CHUNK_Y as i32 - 2)).rev() {
                let b = voxels[idx(x, y as usize, z)];
                if b != AIR && b != WATER && b != ICE && b != PACKED_ICE {
                    top_solid_y = y;
                    top_b = b;
                    break;
                }
            }

            if top_solid_y > water_level {
                let plant_noise = noise.noise2d(wx * 0.85, wz * 0.85);
                let place_y = (top_solid_y + 1) as usize;

                if plant_noise > 0.94 {
                    voxels[idx(x, place_y, z)] = EBLAN_BLOCK;
                } else if plant_noise > 0.90 {
                    voxels[idx(x, place_y, z)] = MEME_CAT;
                } else if biome.is_desert && top_b == SAND {
                    if plant_noise > 0.78 && voxels[idx(x, place_y, z)] == AIR {
                        let cac_h = 2 + (plant_noise * 10.0).floor().abs() as usize % 2;
                        for cy in 1..=cac_h {
                            if (top_solid_y as usize) + cy < CHUNK_Y - 2 {
                                voxels[idx(x, (top_solid_y as usize) + cy, z)] = CACTUS;
                            }
                        }
                    }
                } else if top_b == GRASS {
                    let is_plains = !biome.is_snow && !biome.is_desert && !biome.is_badlands && !biome.is_jungle && !biome.is_swamp && !biome.is_taiga && !biome.is_forest && !biome.is_birch && !biome.is_mountains;
                    if is_plains {
                        if plant_noise > 0.82 {
                            voxels[idx(x, place_y, z)] = YELLOW_FLOWER;
                        } else if plant_noise > 0.72 {
                            voxels[idx(x, place_y, z)] = RED_FLOWER;
                        }
                    } else if biome.is_forest || biome.is_birch {
                        if plant_noise > 0.84 {
                            voxels[idx(x, place_y, z)] = RED_MUSHROOM;
                        } else if plant_noise > 0.74 {
                            voxels[idx(x, place_y, z)] = RED_FLOWER;
                        }
                    } else if biome.is_swamp {
                        if plant_noise > 0.80 {
                            voxels[idx(x, place_y, z)] = BROWN_MUSHROOM;
                        } else if plant_noise > 0.70 {
                            voxels[idx(x, place_y, z)] = RED_MUSHROOM;
                        }
                    } else if biome.is_taiga {
                        if plant_noise > 0.85 {
                            voxels[idx(x, place_y, z)] = MOSSY_COBBLESTONE;
                        }
                    }
                }
            }
        }
    }
}

pub fn generate_nether_chunk(cx: i32, cz: i32, noise: &PerlinNoise, voxels: &mut [u8]) {
    voxels.fill(AIR);
    let world_x0 = (cx * CHUNK_X as i32) as f64;
    let world_z0 = (cz * CHUNK_Z as i32) as f64;

    for x in 0..CHUNK_X {
        for z in 0..CHUNK_Z {
            let wx = world_x0 + x as f64;
            let wz = world_z0 + z as f64;

            voxels[idx(x, 0, z)] = BEDROCK;
            voxels[idx(x, CHUNK_Y - 1, z)] = BEDROCK;

            for y in 1..=4 {
                voxels[idx(x, y, z)] = LAVA;
            }

            let n_bottom = noise.fbm2d(wx * 0.035, wz * 0.035, 3, 0.5, 2.0);
            let bottom_height = (5.0 + n_bottom * 12.0).floor() as usize;

            let n_top = noise.fbm2d(wx * 0.035 + 60.0, wz * 0.035 + 60.0, 3, 0.5, 2.0);
            let top_ceil = (CHUNK_Y as f64 - 2.0 - n_top * 10.0).floor() as usize;

            for y in 1..=bottom_height.min(CHUNK_Y - 2) {
                let ore_n = noise.noise3d(wx * 0.22, y as f64 * 0.22, wz * 0.22);
                let b = if ore_n > 0.76 && y <= 9 {
                    NETHERITE_BLOCK
                } else if ore_n > 0.48 {
                    NETHER_QUARTZ
                } else if ore_n < -0.52 && y <= 6 {
                    SOUL_SAND
                } else {
                    NETHERRACK
                };
                voxels[idx(x, y, z)] = b;
            }

            for y in top_ceil..CHUNK_Y - 1 {
                let gs_n = noise.noise3d(wx * 0.25, y as f64 * 0.25, wz * 0.25);
                let b = if gs_n > 0.52 && y == top_ceil {
                    GLOWSTONE
                } else {
                    NETHERRACK
                };
                voxels[idx(x, y, z)] = b;
            }
        }
    }
}

pub fn generate_end_chunk(cx: i32, cz: i32, noise: &PerlinNoise, voxels: &mut [u8]) {
    voxels.fill(AIR);
    let world_x0 = (cx * CHUNK_X as i32) as f64;
    let world_z0 = (cz * CHUNK_Z as i32) as f64;

    for x in 0..CHUNK_X {
        for z in 0..CHUNK_Z {
            let wx = world_x0 + x as f64;
            let wz = world_z0 + z as f64;
            let dist = (wx * wx + wz * wz).sqrt();

            if dist < 45.0 {
                let island_noise = noise.noise2d(wx * 0.08, wz * 0.08);
                let max_h = (14.0 + island_noise * 4.0).floor() as usize;
                let min_h = (10.0 - island_noise * 3.0).floor() as usize;

                for y in min_h..=max_h.min(CHUNK_Y - 1) {
                    voxels[idx(x, y, z)] = END_STONE;
                }
            }
        }
    }
}

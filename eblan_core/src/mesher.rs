/// EblanEng - Blazing Fast Rust Greedy Mesher

pub const CHUNK_X: usize = 16;
pub const CHUNK_Y: usize = 32;
pub const CHUNK_Z: usize = 16;
pub const CHUNK_VOXELS: usize = CHUNK_X * CHUNK_Y * CHUNK_Z;

#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct MeshGroup {
    pub start: u32,
    pub count: u32,
    pub material_id: u32,
}

pub struct MeshOutput {
    pub positions: Vec<f32>,
    pub normals: Vec<f32>,
    pub uvs: Vec<f32>,
    pub groups: Vec<MeshGroup>,
}

impl MeshOutput {
    pub fn new() -> Self {
        Self {
            positions: Vec::with_capacity(32768),
            normals: Vec::with_capacity(32768),
            uvs: Vec::with_capacity(21845),
            groups: Vec::with_capacity(64),
        }
    }

    pub fn clear(&mut self) {
        self.positions.clear();
        self.normals.clear();
        self.uvs.clear();
        self.groups.clear();
    }
}

#[inline(always)]
fn get_voxel_index(x: usize, y: usize, z: usize) -> usize {
    x + CHUNK_X * (y + CHUNK_Y * z)
}

#[inline(always)]
fn get_neighbor(
    voxels: &[u8],
    left: Option<&[u8]>,
    right: Option<&[u8]>,
    back: Option<&[u8]>,
    front: Option<&[u8]>,
    x: usize,
    y: usize,
    z: usize,
    f: usize,
) -> u8 {
    match f {
        0 => { // +X
            if x < 15 {
                voxels[(x + 1) + 16 * (y + 32 * z)]
            } else if let Some(r) = right {
                r[16 * (y + 32 * z)]
            } else {
                0
            }
        }
        1 => { // -X
            if x > 0 {
                voxels[(x - 1) + 16 * (y + 32 * z)]
            } else if let Some(l) = left {
                l[15 + 16 * (y + 32 * z)]
            } else {
                0
            }
        }
        2 => { // +Y
            if y < 31 {
                voxels[x + 16 * ((y + 1) + 32 * z)]
            } else {
                0
            }
        }
        3 => { // -Y
            if y > 0 {
                voxels[x + 16 * ((y - 1) + 32 * z)]
            } else {
                0
            }
        }
        4 => { // +Z
            if z < 15 {
                voxels[x + 16 * (y + 32 * (z + 1))]
            } else if let Some(fr) = front {
                fr[x + 16 * y]
            } else {
                0
            }
        }
        5 => { // -Z
            if z > 0 {
                voxels[x + 16 * (y + 32 * (z - 1))]
            } else if let Some(b) = back {
                b[x + 16 * (y + 32 * 15)]
            } else {
                0
            }
        }
        _ => 0,
    }
}

pub fn greedy_mesh_chunk(
    voxels: &[u8],
    left: Option<&[u8]>,
    right: Option<&[u8]>,
    back: Option<&[u8]>,
    front: Option<&[u8]>,
    block_mat_map: &[u32], // [block * 6 + face] -> material_id
    is_opaque_table: &[u8; 256],
    cx: i32,
    cz: i32,
    output: &mut MeshOutput,
) {
    output.clear();

    let world_x0 = (cx * CHUNK_X as i32) as f32;
    let world_z0 = (cz * CHUNK_Z as i32) as f32;

    // Temporary storage for material buckets
    // Map material_id -> (positions, normals, uvs)
    // To keep it 0-heap allocation, we use an array or small hash
    // We will collect per-face quads into intermediate buffer
    struct IntermediateQuad {
        mat_id: u32,
        pos: [f32; 18],
        norm: [f32; 18],
        uvs: [f32; 12],
    }

    let mut quads: Vec<IntermediateQuad> = Vec::with_capacity(1024);
    let mut slice_mask = [0u32; 512]; // 0 = empty, >0 = mat_id + 1

    // --- Faces 0 (+X) and 1 (-X) ---
    for f in 0..2 {
        let normal = if f == 0 { [1.0f32, 0.0, 0.0] } else { [-1.0f32, 0.0, 0.0] };
        for x in 0..16 {
            // Fill slice mask (Z: 0..15, Y: 0..31)
            for y in 0..32 {
                let row_offset = y << 4;
                for z in 0..16 {
                    let idx = z + row_offset;
                    let block = voxels[x + 16 * (y + 32 * z)];
                    if block == 0 || block == 19 || (block >= 48 && block <= 51) {
                        slice_mask[idx] = 0;
                        continue;
                    }
                    let neighbor = get_neighbor(voxels, left, right, back, front, x, y, z, f);
                    let is_missing_chunk = match f {
                        0 => x == 15 && right.is_none(),
                        1 => x == 0 && left.is_none(),
                        _ => false,
                    };
                    let should_render = if is_missing_chunk && is_opaque_table[block as usize] == 0 {
                        false
                    } else if neighbor == 0 || neighbor == 19 {
                        true
                    } else {
                        is_opaque_table[neighbor as usize] == 0 && neighbor != block
                    };

                    if should_render {
                        let mat_id = block_mat_map[block as usize * 6 + f];
                        slice_mask[idx] = mat_id + 1;
                    } else {
                        slice_mask[idx] = 0;
                    }
                }
            }

            // 2D Greedy Merge over (z, y)
            for j in 0..32 {
                let mut i = 0;
                while i < 16 {
                    let m = slice_mask[i + (j << 4)];
                    if m == 0 {
                        i += 1;
                        continue;
                    }
                    let mut w = 1;
                    while i + w < 16 && slice_mask[(i + w) + (j << 4)] == m {
                        w += 1;
                    }
                    let mut h = 1;
                    let mut can_extend = true;
                    while j + h < 32 {
                        let next_row = (j + h) << 4;
                        for k in 0..w {
                            if slice_mask[(i + k) + next_row] != m {
                                can_extend = false;
                                break;
                            }
                        }
                        if !can_extend {
                            break;
                        }
                        h += 1;
                    }

                    for dy in 0..h {
                        let clear_row = (j + dy) << 4;
                        for dx in 0..w {
                            slice_mask[(i + dx) + clear_row] = 0;
                        }
                    }

                    let mat_id = m - 1;
                    let wx = world_x0 + x as f32;
                    let wy = j as f32;
                    let wz = world_z0 + i as f32;
                    let wf = w as f32;
                    let hf = h as f32;

                    let pos = if f == 0 {
                        [
                            wx + 1.0, wy, wz + wf,
                            wx + 1.0, wy, wz,
                            wx + 1.0, wy + hf, wz,
                            wx + 1.0, wy, wz + wf,
                            wx + 1.0, wy + hf, wz,
                            wx + 1.0, wy + hf, wz + wf,
                        ]
                    } else {
                        [
                            wx, wy, wz,
                            wx, wy, wz + wf,
                            wx, wy + hf, wz + wf,
                            wx, wy, wz,
                            wx, wy + hf, wz + wf,
                            wx, wy + hf, wz,
                        ]
                    };

                    let norm = [
                        normal[0], normal[1], normal[2], normal[0], normal[1], normal[2], normal[0], normal[1], normal[2],
                        normal[0], normal[1], normal[2], normal[0], normal[1], normal[2], normal[0], normal[1], normal[2],
                    ];

                    let uvs = [
                        0.0, 0.0, wf, 0.0, wf, hf,
                        0.0, 0.0, wf, hf, 0.0, hf,
                    ];

                    quads.push(IntermediateQuad { mat_id, pos, norm, uvs });
                    i += w;
                }
            }
        }
    }

    // --- Faces 2 (+Y) and 3 (-Y) ---
    for f in 2..=3 {
        let normal = if f == 2 { [0.0f32, 1.0, 0.0] } else { [0.0f32, -1.0, 0.0] };
        for y in 0..32 {
            // Fill slice mask (X: 0..15, Z: 0..15)
            for z in 0..16 {
                let z_offset = z << 4;
                for x in 0..16 {
                    let idx = x + z_offset;
                    let block = voxels[x + 16 * (y + 32 * z)];
                    if block == 0 || block == 19 || (block >= 48 && block <= 51) {
                        slice_mask[idx] = 0;
                        continue;
                    }
                    let neighbor = get_neighbor(voxels, left, right, back, front, x, y, z, f);
                    let should_render = if neighbor == 0 || neighbor == 19 {
                        true
                    } else {
                        is_opaque_table[neighbor as usize] == 0 && neighbor != block
                    };

                    if should_render {
                        let mat_id = block_mat_map[block as usize * 6 + f];
                        slice_mask[idx] = mat_id + 1;
                    } else {
                        slice_mask[idx] = 0;
                    }
                }
            }

            // 2D Greedy Merge over (x, z)
            for j in 0..16 {
                let mut i = 0;
                while i < 16 {
                    let m = slice_mask[i + (j << 4)];
                    if m == 0 {
                        i += 1;
                        continue;
                    }
                    let mut w = 1;
                    while i + w < 16 && slice_mask[(i + w) + (j << 4)] == m {
                        w += 1;
                    }
                    let mut d = 1;
                    let mut can_extend = true;
                    while j + d < 16 {
                        let next_row = (j + d) << 4;
                        for k in 0..w {
                            if slice_mask[(i + k) + next_row] != m {
                                can_extend = false;
                                break;
                            }
                        }
                        if !can_extend {
                            break;
                        }
                        d += 1;
                    }

                    for dz in 0..d {
                        let clear_row = (j + dz) << 4;
                        for dx in 0..w {
                            slice_mask[(i + dx) + clear_row] = 0;
                        }
                    }

                    let mat_id = m - 1;
                    let wx = world_x0 + i as f32;
                    let wy = y as f32;
                    let wz = world_z0 + j as f32;
                    let wf = w as f32;
                    let df = d as f32;

                    let pos = if f == 2 {
                        [
                            wx, wy + 1.0, wz + df,
                            wx + wf, wy + 1.0, wz + df,
                            wx + wf, wy + 1.0, wz,
                            wx, wy + 1.0, wz + df,
                            wx + wf, wy + 1.0, wz,
                            wx, wy + 1.0, wz,
                        ]
                    } else {
                        [
                            wx, wy, wz,
                            wx + wf, wy, wz,
                            wx + wf, wy, wz + df,
                            wx, wy, wz,
                            wx + wf, wy, wz + df,
                            wx, wy, wz + df,
                        ]
                    };

                    let norm = [
                        normal[0], normal[1], normal[2], normal[0], normal[1], normal[2], normal[0], normal[1], normal[2],
                        normal[0], normal[1], normal[2], normal[0], normal[1], normal[2], normal[0], normal[1], normal[2],
                    ];

                    let uvs = [
                        0.0, 0.0, wf, 0.0, wf, df,
                        0.0, 0.0, wf, df, 0.0, df,
                    ];

                    quads.push(IntermediateQuad { mat_id, pos, norm, uvs });
                    i += w;
                }
            }
        }
    }

    // --- Faces 4 (+Z) and 5 (-Z) ---
    for f in 4..=5 {
        let normal = if f == 4 { [0.0f32, 0.0, 1.0] } else { [0.0f32, 0.0, -1.0] };
        for z in 0..16 {
            // Fill slice mask (X: 0..15, Y: 0..31)
            for y in 0..32 {
                let row_offset = y << 4;
                for x in 0..16 {
                    let idx = x + row_offset;
                    let block = voxels[x + 16 * (y + 32 * z)];
                    if block == 0 || block == 19 || (block >= 48 && block <= 51) {
                        slice_mask[idx] = 0;
                        continue;
                    }
                    let neighbor = get_neighbor(voxels, left, right, back, front, x, y, z, f);
                    let is_missing_chunk = match f {
                        4 => z == 15 && front.is_none(),
                        5 => z == 0 && back.is_none(),
                        _ => false,
                    };
                    let should_render = if is_missing_chunk && is_opaque_table[block as usize] == 0 {
                        false
                    } else if neighbor == 0 || neighbor == 19 {
                        true
                    } else {
                        is_opaque_table[neighbor as usize] == 0 && neighbor != block
                    };

                    if should_render {
                        let mat_id = block_mat_map[block as usize * 6 + f];
                        slice_mask[idx] = mat_id + 1;
                    } else {
                        slice_mask[idx] = 0;
                    }
                }
            }

            // 2D Greedy Merge over (x, y)
            for j in 0..32 {
                let mut i = 0;
                while i < 16 {
                    let m = slice_mask[i + (j << 4)];
                    if m == 0 {
                        i += 1;
                        continue;
                    }
                    let mut w = 1;
                    while i + w < 16 && slice_mask[(i + w) + (j << 4)] == m {
                        w += 1;
                    }
                    let mut h = 1;
                    let mut can_extend = true;
                    while j + h < 32 {
                        let next_row = (j + h) << 4;
                        for k in 0..w {
                            if slice_mask[(i + k) + next_row] != m {
                                can_extend = false;
                                break;
                            }
                        }
                        if !can_extend {
                            break;
                        }
                        h += 1;
                    }

                    for dy in 0..h {
                        let clear_row = (j + dy) << 4;
                        for dx in 0..w {
                            slice_mask[(i + dx) + clear_row] = 0;
                        }
                    }

                    let mat_id = m - 1;
                    let wx = world_x0 + i as f32;
                    let wy = j as f32;
                    let wz = world_z0 + z as f32;
                    let wf = w as f32;
                    let hf = h as f32;

                    let pos = if f == 4 {
                        [
                            wx, wy, wz + 1.0,
                            wx + wf, wy, wz + 1.0,
                            wx + wf, wy + hf, wz + 1.0,
                            wx, wy, wz + 1.0,
                            wx + wf, wy + hf, wz + 1.0,
                            wx, wy + hf, wz + 1.0,
                        ]
                    } else {
                        [
                            wx + wf, wy, wz,
                            wx, wy, wz,
                            wx, wy + hf, wz,
                            wx + wf, wy, wz,
                            wx, wy + hf, wz,
                            wx + wf, wy + hf, wz,
                        ]
                    };

                    let norm = [
                        normal[0], normal[1], normal[2], normal[0], normal[1], normal[2], normal[0], normal[1], normal[2],
                        normal[0], normal[1], normal[2], normal[0], normal[1], normal[2], normal[0], normal[1], normal[2],
                    ];

                    let uvs = [
                        0.0, 0.0, wf, 0.0, wf, hf,
                        0.0, 0.0, wf, hf, 0.0, hf,
                    ];

                    quads.push(IntermediateQuad { mat_id, pos, norm, uvs });
                    i += w;
                }
            }
        }
    }

    // Sort quads by material_id to group them into continuous draw calls
    quads.sort_unstable_by_key(|q| q.mat_id);

    let mut current_mat: Option<u32> = None;
    let mut group_start = 0u32;
    let mut group_count = 0u32;

    for q in &quads {
        if Some(q.mat_id) != current_mat {
            if let Some(prev_mat) = current_mat {
                output.groups.push(MeshGroup {
                    start: group_start,
                    count: group_count,
                    material_id: prev_mat,
                });
                group_start += group_count;
                group_count = 0;
            }
            current_mat = Some(q.mat_id);
        }

        output.positions.extend_from_slice(&q.pos);
        output.normals.extend_from_slice(&q.norm);
        output.uvs.extend_from_slice(&q.uvs);
        group_count += 6;
    }

    if let Some(last_mat) = current_mat {
        output.groups.push(MeshGroup {
            start: group_start,
            count: group_count,
            material_id: last_mat,
        });
    }
}

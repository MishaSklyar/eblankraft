pub mod noise;
pub mod mesher;
pub mod world_gen;

use noise::PerlinNoise;
use mesher::{MeshOutput, MeshGroup, greedy_mesh_chunk, CHUNK_VOXELS};
use std::sync::Mutex;

struct EblanEngineState {
    noise: PerlinNoise,
    mesh_output: MeshOutput,
    current_voxels: Vec<u8>,
    left_voxels: Vec<u8>,
    right_voxels: Vec<u8>,
    back_voxels: Vec<u8>,
    front_voxels: Vec<u8>,
    has_left: bool,
    has_right: bool,
    has_back: bool,
    has_front: bool,
    block_mat_map: Vec<u32>,
    is_opaque_table: [u8; 256],
}

static ENGINE: Mutex<Option<EblanEngineState>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn eblan_init(seed: i32) {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        engine.noise = PerlinNoise::new(seed);
        return;
    }

    let mut opaque = [0u8; 256];
    for i in 1..256 {
        opaque[i] = 1;
    }
    // Transparent blocks in eblankraft
    opaque[0] = 0;   // AIR
    opaque[7] = 0;   // LEAVES
    opaque[9] = 0;   // GLASS
    opaque[19] = 0;  // WATER
    opaque[33] = 0;  // PORTAL_NETHER
    opaque[34] = 0;  // PORTAL_END
    opaque[36] = 0;  // ICE
    opaque[41] = 0;  // BIRCH_LEAVES
    opaque[44] = 0;  // SPRUCE_LEAVES
    opaque[47] = 0;  // JUNGLE_LEAVES
    opaque[48] = 0;  // RED_FLOWER
    opaque[49] = 0;  // YELLOW_FLOWER
    opaque[50] = 0;  // RED_MUSHROOM
    opaque[51] = 0;  // BROWN_MUSHROOM

    let state = EblanEngineState {
        noise: PerlinNoise::new(seed),
        mesh_output: MeshOutput::new(),
        current_voxels: vec![0u8; CHUNK_VOXELS],
        left_voxels: vec![0u8; CHUNK_VOXELS],
        right_voxels: vec![0u8; CHUNK_VOXELS],
        back_voxels: vec![0u8; CHUNK_VOXELS],
        front_voxels: vec![0u8; CHUNK_VOXELS],
        has_left: false,
        has_right: false,
        has_back: false,
        has_front: false,
        block_mat_map: vec![0u32; 256 * 6],
        is_opaque_table: opaque,
    };

    *lock = Some(state);
}

#[no_mangle]
pub extern "C" fn eblan_set_seed(seed: i32) {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        engine.noise = PerlinNoise::new(seed);
    } else {
        drop(lock);
        eblan_init(seed);
    }
}

#[no_mangle]
pub extern "C" fn eblan_noise2d(x: f64, y: f64) -> f64 {
    let lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_ref() {
        engine.noise.noise2d(x, y)
    } else {
        0.0
    }
}

#[no_mangle]
pub extern "C" fn eblan_noise3d(x: f64, y: f64, z: f64) -> f64 {
    let lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_ref() {
        engine.noise.noise3d(x, y, z)
    } else {
        0.0
    }
}

#[no_mangle]
pub extern "C" fn eblan_fbm2d(x: f64, y: f64, octaves: i32, persistence: f64, lacunarity: f64) -> f64 {
    let lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_ref() {
        engine.noise.fbm2d(x, y, octaves, persistence, lacunarity)
    } else {
        0.0
    }
}

// Procedural Terrain Generation in Rust
#[no_mangle]
pub extern "C" fn eblan_generate_chunk(cx: i32, cz: i32, dimension: i32, world_type: i32, water_level: i32) {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        match dimension {
            1 => world_gen::generate_nether_chunk(cx, cz, &engine.noise, &mut engine.current_voxels),
            2 => world_gen::generate_end_chunk(cx, cz, &engine.noise, &mut engine.current_voxels),
            _ => world_gen::generate_overworld_chunk(cx, cz, &engine.noise, world_type, water_level, &mut engine.current_voxels),
        }
    }
}

#[no_mangle]
pub extern "C" fn eblan_generate_and_mesh(
    cx: i32,
    cz: i32,
    dimension: i32,
    world_type: i32,
    water_level: i32,
) -> u32 {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        // 1. Generate chunk voxels in Rust
        match dimension {
            1 => world_gen::generate_nether_chunk(cx, cz, &engine.noise, &mut engine.current_voxels),
            2 => world_gen::generate_end_chunk(cx, cz, &engine.noise, &mut engine.current_voxels),
            _ => world_gen::generate_overworld_chunk(cx, cz, &engine.noise, world_type, water_level, &mut engine.current_voxels),
        }

        // 2. Greedy Mesh in Rust
        let left = if engine.has_left { Some(engine.left_voxels.as_slice()) } else { None };
        let right = if engine.has_right { Some(engine.right_voxels.as_slice()) } else { None };
        let back = if engine.has_back { Some(engine.back_voxels.as_slice()) } else { None };
        let front = if engine.has_front { Some(engine.front_voxels.as_slice()) } else { None };

        greedy_mesh_chunk(
            &engine.current_voxels,
            left,
            right,
            back,
            front,
            &engine.block_mat_map,
            &engine.is_opaque_table,
            cx,
            cz,
            &mut engine.mesh_output,
        );

        (engine.mesh_output.positions.len() / 3) as u32
    } else {
        0
    }
}

// Memory buffer access for zero-copy transfers
#[no_mangle]
pub extern "C" fn eblan_get_chunk_voxels_ptr() -> *mut u8 {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        engine.current_voxels.as_mut_ptr()
    } else {
        std::ptr::null_mut()
    }
}

#[no_mangle]
pub extern "C" fn eblan_get_neighbor_voxels_ptr(dir: i32) -> *mut u8 {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        match dir {
            0 => { engine.has_right = true; engine.right_voxels.as_mut_ptr() }
            1 => { engine.has_left = true; engine.left_voxels.as_mut_ptr() }
            4 => { engine.has_front = true; engine.front_voxels.as_mut_ptr() }
            5 => { engine.has_back = true; engine.back_voxels.as_mut_ptr() }
            _ => std::ptr::null_mut(),
        }
    } else {
        std::ptr::null_mut()
    }
}

#[no_mangle]
pub extern "C" fn eblan_set_neighbor_present(dir: i32, present: i32) {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        let is_pres = present != 0;
        match dir {
            0 => engine.has_right = is_pres,
            1 => engine.has_left = is_pres,
            4 => engine.has_front = is_pres,
            5 => engine.has_back = is_pres,
            _ => {}
        }
    }
}

#[no_mangle]
pub extern "C" fn eblan_set_block_material(block: i32, face: i32, mat_id: u32) {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        if block >= 0 && block < 256 && face >= 0 && face < 6 {
            let idx = (block as usize) * 6 + (face as usize);
            if idx < engine.block_mat_map.len() {
                engine.block_mat_map[idx] = mat_id;
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn eblan_mesh_chunk(cx: i32, cz: i32) -> u32 {
    let mut lock = ENGINE.lock().unwrap();
    if let Some(engine) = lock.as_mut() {
        let left = if engine.has_left { Some(engine.left_voxels.as_slice()) } else { None };
        let right = if engine.has_right { Some(engine.right_voxels.as_slice()) } else { None };
        let back = if engine.has_back { Some(engine.back_voxels.as_slice()) } else { None };
        let front = if engine.has_front { Some(engine.front_voxels.as_slice()) } else { None };

        greedy_mesh_chunk(
            &engine.current_voxels,
            left,
            right,
            back,
            front,
            &engine.block_mat_map,
            &engine.is_opaque_table,
            cx,
            cz,
            &mut engine.mesh_output,
        );

        (engine.mesh_output.positions.len() / 3) as u32
    } else {
        0
    }
}

// Zero-copy getters for WebGL BufferAttribute
#[no_mangle]
pub extern "C" fn eblan_get_positions_ptr() -> *const f32 {
    let lock = ENGINE.lock().unwrap();
    lock.as_ref().map(|e| e.mesh_output.positions.as_ptr()).unwrap_or(std::ptr::null())
}

#[no_mangle]
pub extern "C" fn eblan_get_normals_ptr() -> *const f32 {
    let lock = ENGINE.lock().unwrap();
    lock.as_ref().map(|e| e.mesh_output.normals.as_ptr()).unwrap_or(std::ptr::null())
}

#[no_mangle]
pub extern "C" fn eblan_get_uvs_ptr() -> *const f32 {
    let lock = ENGINE.lock().unwrap();
    lock.as_ref().map(|e| e.mesh_output.uvs.as_ptr()).unwrap_or(std::ptr::null())
}

#[no_mangle]
pub extern "C" fn eblan_get_groups_ptr() -> *const MeshGroup {
    let lock = ENGINE.lock().unwrap();
    lock.as_ref().map(|e| e.mesh_output.groups.as_ptr()).unwrap_or(std::ptr::null())
}

#[no_mangle]
pub extern "C" fn eblan_get_group_count() -> u32 {
    let lock = ENGINE.lock().unwrap();
    lock.as_ref().map(|e| e.mesh_output.groups.len() as u32).unwrap_or(0)
}

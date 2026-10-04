/**
 * Eblankraft - Optimized Voxel World Engine
 * Chunk-based voxel storage, procedural generation, face-culling meshing
 */

const CHUNK_SIZE_X = 16;
const CHUNK_SIZE_Y = 32;
const CHUNK_SIZE_Z = 16;

const CHUNK_FACES = [
    { // +X (Right)
        dir: [1, 0, 0],
        corners: [
            [1, 0, 1], [1, 0, 0], [1, 1, 0],
            [1, 0, 1], [1, 1, 0], [1, 1, 1]
        ],
        normal: [1, 0, 0],
        faceIdx: 0
    },
    { // -X (Left)
        dir: [-1, 0, 0],
        corners: [
            [0, 0, 0], [0, 0, 1], [0, 1, 1],
            [0, 0, 0], [0, 1, 1], [0, 1, 0]
        ],
        normal: [-1, 0, 0],
        faceIdx: 1
    },
    { // +Y (Top)
        dir: [0, 1, 0],
        corners: [
            [0, 1, 1], [1, 1, 1], [1, 1, 0],
            [0, 1, 1], [1, 1, 0], [0, 1, 0]
        ],
        normal: [0, 1, 0],
        faceIdx: 2
    },
    { // -Y (Bottom)
        dir: [0, -1, 0],
        corners: [
            [0, 0, 0], [1, 0, 0], [1, 0, 1],
            [0, 0, 0], [1, 0, 1], [0, 0, 1]
        ],
        normal: [0, -1, 0],
        faceIdx: 3
    },
    { // +Z (Front)
        dir: [0, 0, 1],
        corners: [
            [0, 0, 1], [1, 0, 1], [1, 1, 1],
            [0, 0, 1], [1, 1, 1], [0, 1, 1]
        ],
        normal: [0, 0, 1],
        faceIdx: 4
    },
    { // -Z (Back)
        dir: [0, 0, -1],
        corners: [
            [1, 0, 0], [0, 0, 0], [0, 1, 0],
            [1, 0, 0], [0, 1, 0], [1, 1, 0]
        ],
        normal: [0, 0, -1],
        faceIdx: 5
    }
];

const CHUNK_FACE_UVS = [
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1
];

// Preallocated slice mask for greedy meshing to avoid GC pauses
const REUSABLE_SLICE_MASK = new Array(512);

class Chunk {
    constructor(cx, cz, world) {
        this.cx = cx;
        this.cz = cz;
        this.world = world;
        this.voxels = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
        this.mesh = null;
        this.waterMesh = null;
        this.isDirty = true;
        this.isGenerated = false;
        this.bounds = new THREE.Box3(
            new THREE.Vector3(cx * CHUNK_SIZE_X, 0, cz * CHUNK_SIZE_Z),
            new THREE.Vector3((cx + 1) * CHUNK_SIZE_X, CHUNK_SIZE_Y, (cz + 1) * CHUNK_SIZE_Z)
        );
    }

    getIndex(x, y, z) {
        return x + CHUNK_SIZE_X * (y + CHUNK_SIZE_Y * z);
    }

    getBlock(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE_X || y < 0 || y >= CHUNK_SIZE_Y || z < 0 || z >= CHUNK_SIZE_Z) {
            return BLOCK_TYPES.AIR;
        }
        return this.voxels[this.getIndex(x, y, z)];
    }

    setBlock(x, y, z, type) {
        if (x < 0 || x >= CHUNK_SIZE_X || y < 0 || y >= CHUNK_SIZE_Y || z < 0 || z >= CHUNK_SIZE_Z) {
            return;
        }
        this.voxels[this.getIndex(x, y, z)] = type;
        this.isDirty = true;
    }

    dispose() {
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.waterMesh) {
            this.world.scene.remove(this.waterMesh);
            if (this.waterMesh.geometry) this.waterMesh.geometry.dispose();
            this.waterMesh = null;
        }
    }

    rebuildMesh(textureManager) {
        if (!this.isGenerated || !this.isDirty) return;
        this.isDirty = false;

        // Pre-fetch 4 neighbor chunks once (0 object/string allocations in the voxel loop)
        const chunkLeft = this.world.getChunk(this.cx - 1, this.cz);
        const chunkRight = this.world.getChunk(this.cx + 1, this.cz);
        const chunkBack = this.world.getChunk(this.cx, this.cz - 1);
        const chunkFront = this.world.getChunk(this.cx, this.cz + 1);

        const hasLeft = !!(chunkLeft && chunkLeft.isGenerated);
        const hasRight = !!(chunkRight && chunkRight.isGenerated);
        const hasBack = !!(chunkBack && chunkBack.isGenerated);
        const hasFront = !!(chunkFront && chunkFront.isGenerated);

        const voxels = this.voxels;
        const leftVoxels = hasLeft ? chunkLeft.voxels : null;
        const rightVoxels = hasRight ? chunkRight.voxels : null;
        const backVoxels = hasBack ? chunkBack.voxels : null;
        const frontVoxels = hasFront ? chunkFront.voxels : null;

        // Fast neighbor getter (0 heap allocations)
        const getVoxelNeighbor = (x, y, z, f) => {
            switch (f) {
                case 0: // +X
                    if (x < 15) return voxels[(x + 1) + 16 * (y + 32 * z)];
                    return rightVoxels ? rightVoxels[16 * (y + 32 * z)] : BLOCK_TYPES.AIR;
                case 1: // -X
                    if (x > 0) return voxels[(x - 1) + 16 * (y + 32 * z)];
                    return leftVoxels ? leftVoxels[15 + 16 * (y + 32 * z)] : BLOCK_TYPES.AIR;
                case 2: // +Y
                    if (y < 31) return voxels[x + 16 * ((y + 1) + 32 * z)];
                    return BLOCK_TYPES.AIR;
                case 3: // -Y
                    if (y > 0) return voxels[x + 16 * ((y - 1) + 32 * z)];
                    return BLOCK_TYPES.AIR;
                case 4: // +Z
                    if (z < 15) return voxels[x + 16 * (y + 32 * (z + 1))];
                    return frontVoxels ? frontVoxels[x + 16 * y] : BLOCK_TYPES.AIR;
                case 5: // -Z
                    if (z > 0) return voxels[x + 16 * (y + 32 * (z - 1))];
                    return backVoxels ? backVoxels[x + 16 * (y + 32 * 15)] : BLOCK_TYPES.AIR;
                default:
                    return BLOCK_TYPES.AIR;
            }
        };

        const isOpaque = (b) => {
            if (window.BLOCK_INFO && window.BLOCK_INFO[b] && window.BLOCK_INFO[b].transparent) {
                return false;
            }
            return b !== BLOCK_TYPES.AIR &&
                   b !== BLOCK_TYPES.WATER &&
                   b !== BLOCK_TYPES.ICE &&
                   b !== BLOCK_TYPES.GLASS &&
                   b !== BLOCK_TYPES.LEAVES &&
                   b !== BLOCK_TYPES.BIRCH_LEAVES &&
                   b !== BLOCK_TYPES.SPRUCE_LEAVES &&
                   b !== BLOCK_TYPES.JUNGLE_LEAVES &&
                   b !== BLOCK_TYPES.PORTAL_NETHER &&
                   b !== BLOCK_TYPES.PORTAL_END &&
                   b !== BLOCK_TYPES.RED_FLOWER &&
                   b !== BLOCK_TYPES.YELLOW_FLOWER &&
                   b !== BLOCK_TYPES.RED_MUSHROOM &&
                   b !== BLOCK_TYPES.BROWN_MUSHROOM;
        };

        const isCrossPlant = (b) => (
            b === BLOCK_TYPES.RED_FLOWER ||
            b === BLOCK_TYPES.YELLOW_FLOWER ||
            b === BLOCK_TYPES.RED_MUSHROOM ||
            b === BLOCK_TYPES.BROWN_MUSHROOM
        );

        const solidGroups = new Map(); // materialInstance -> { material, positions, normals, uvs }
        const plantGroups = new Map(); // materialInstance -> { material, positions, normals, uvs } (cross plants)
        const waterPositions = [];
        const waterNormals = [];
        const waterUVs = [];

        const getGroup = (mat) => {
            let grp = solidGroups.get(mat);
            if (!grp) {
                grp = {
                    material: mat,
                    positions: [],
                    normals: [],
                    uvs: []
                };
                solidGroups.set(mat, grp);
            }
            return grp;
        };

        const getPlantGroup = (mat) => {
            let grp = plantGroups.get(mat);
            if (!grp) {
                grp = {
                    material: mat,
                    positions: [],
                    normals: [],
                    uvs: []
                };
                plantGroups.set(mat, grp);
            }
            return grp;
        };

        const worldX0 = this.cx * CHUNK_SIZE_X;
        const worldZ0 = this.cz * CHUNK_SIZE_Z;

        // 1. Fast Pass for Water and Cross-Plants (Flowers & Mushrooms)
        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
            const wy = y;
            for (let z = 0; z < CHUNK_SIZE_Z; z++) {
                const wz = worldZ0 + z;
                for (let x = 0; x < CHUNK_SIZE_X; x++) {
                    const block = voxels[x + 16 * (y + 32 * z)];
                    if (block === BLOCK_TYPES.AIR) continue;

                    const wx = worldX0 + x;

                    if (block === BLOCK_TYPES.WATER) {
                        for (let f = 0; f < 6; f++) {
                            // Do not render water faces into ungenerated/missing chunks!
                            if (f === 0 && !hasRight) continue;
                            if (f === 1 && !hasLeft) continue;
                            if (f === 4 && !hasFront) continue;
                            if (f === 5 && !hasBack) continue;

                            const neighbor = getVoxelNeighbor(x, y, z, f);
                            if (neighbor === BLOCK_TYPES.AIR) {
                                const face = CHUNK_FACES[f];
                                const nx = face.normal[0], ny = face.normal[1], nz = face.normal[2];
                                const yMult = (f === 2 ? 0.85 : 1.0);
                                const c = face.corners;
                                waterPositions.push(
                                    wx + c[0][0], wy + yMult * c[0][1], wz + c[0][2],
                                    wx + c[1][0], wy + yMult * c[1][1], wz + c[1][2],
                                    wx + c[2][0], wy + yMult * c[2][1], wz + c[2][2],
                                    wx + c[3][0], wy + yMult * c[3][1], wz + c[3][2],
                                    wx + c[4][0], wy + yMult * c[4][1], wz + c[4][2],
                                    wx + c[5][0], wy + yMult * c[5][1], wz + c[5][2]
                                );
                                waterNormals.push(
                                    nx, ny, nz, nx, ny, nz,
                                    nx, ny, nz, nx, ny, nz,
                                    nx, ny, nz, nx, ny, nz
                                );
                                waterUVs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
                            }
                        }
                        continue;
                    }

                    if (isCrossPlant(block)) {
                        const blockMat = textureManager.getBlockMaterial(block);
                        const mat = Array.isArray(blockMat) ? blockMat[0] : blockMat;
                        const group = getPlantGroup(mat);

                        // Cross-quad 1: from (0, 0, 0) to (1, 1, 1)
                        group.positions.push(
                            wx, wy, wz,
                            wx + 1, wy, wz + 1,
                            wx + 1, wy + 1, wz + 1,
                            wx, wy, wz,
                            wx + 1, wy + 1, wz + 1,
                            wx, wy + 1, wz
                        );
                        // Cross-quad 2: from (0, 0, 1) to (1, 1, 0)
                        group.positions.push(
                            wx, wy, wz + 1,
                            wx + 1, wy, wz,
                            wx + 1, wy + 1, wz,
                            wx, wy, wz + 1,
                            wx + 1, wy + 1, wz,
                            wx, wy + 1, wz + 1
                        );

                        const invSqrt2 = 0.7071;
                        group.normals.push(
                            -invSqrt2, 0, invSqrt2, -invSqrt2, 0, invSqrt2, -invSqrt2, 0, invSqrt2,
                            -invSqrt2, 0, invSqrt2, -invSqrt2, 0, invSqrt2, -invSqrt2, 0, invSqrt2,
                            invSqrt2, 0, invSqrt2, invSqrt2, 0, invSqrt2, invSqrt2, 0, invSqrt2,
                            invSqrt2, 0, invSqrt2, invSqrt2, 0, invSqrt2, invSqrt2, 0, invSqrt2
                        );
                        group.uvs.push(
                            0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
                            0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1
                        );
                    }
                }
            }
        }

        // 2. Greedy Meshing for Solid & Transparent blocks (Zero-bypass Rust WASM Greedy Mesher)
        let wasmMesh = null;
        if (window.EblanEng && window.EblanEng.ready) {
            wasmMesh = window.EblanEng.meshChunk(this, {
                left: chunkLeft,
                right: chunkRight,
                back: chunkBack,
                front: chunkFront
            }, textureManager);
        }

        if (!wasmMesh) {
            const sliceMask = REUSABLE_SLICE_MASK;
            sliceMask.fill(null);

            // --- Faces 0 (+X) and 1 (-X) ---
            for (let f = 0; f < 2; f++) {
                for (let x = 0; x < 16; x++) {
                    // Fill slice mask (Z: 0..15, Y: 0..31)
                    for (let y = 0; y < 32; y++) {
                        const rowOffset = y << 4;
                        for (let z = 0; z < 16; z++) {
                            const idx = z + rowOffset;
                            const block = voxels[x + 16 * (y + 32 * z)];
                            if (block === BLOCK_TYPES.AIR || block === BLOCK_TYPES.WATER || isCrossPlant(block)) {
                                sliceMask[idx] = null;
                                continue;
                            }
                            const isMissingChunk = (f === 0 && x === 15 && !hasRight) || (f === 1 && x === 0 && !hasLeft);
                            let shouldRender = false;
                            if (isMissingChunk && (block === BLOCK_TYPES.ICE || !isOpaque(block))) {
                                shouldRender = false;
                            } else {
                                const neighbor = getVoxelNeighbor(x, y, z, f);
                                if (neighbor === BLOCK_TYPES.AIR || neighbor === BLOCK_TYPES.WATER) {
                                    shouldRender = true;
                                } else if (!isOpaque(neighbor) && neighbor !== block) {
                                    shouldRender = true;
                                }
                            }
                            if (shouldRender) {
                                const blockMat = textureManager.getBlockMaterial(block);
                                sliceMask[idx] = Array.isArray(blockMat) ? blockMat[f] : blockMat;
                            } else {
                                sliceMask[idx] = null;
                            }
                        }
                    }

                    // Greedy 2D merge over (z, y)
                    for (let j = 0; j < 32; j++) {
                        for (let i = 0; i < 16; ) {
                            const mat = sliceMask[i + (j << 4)];
                            if (!mat) {
                                i++;
                                continue;
                            }
                            let w = 1;
                            while (i + w < 16 && sliceMask[(i + w) + (j << 4)] === mat) {
                                w++;
                            }
                            let h = 1;
                            let canExtend = true;
                            while (j + h < 32) {
                                const nextRow = (j + h) << 4;
                                for (let k = 0; k < w; k++) {
                                    if (sliceMask[(i + k) + nextRow] !== mat) {
                                        canExtend = false;
                                        break;
                                    }
                                }
                                if (!canExtend) break;
                                h++;
                            }
                            for (let dy = 0; dy < h; dy++) {
                                const clearOffset = (j + dy) << 4;
                                for (let dx = 0; dx < w; dx++) {
                                    sliceMask[(i + dx) + clearOffset] = null;
                                }
                            }

                            const grp = getGroup(mat);
                            const wx = worldX0 + x;
                            const wy = j;
                            const wz = worldZ0 + i;

                            if (f === 0) { // +X (Right)
                                grp.positions.push(
                                    wx + 1, wy, wz + w,
                                    wx + 1, wy, wz,
                                    wx + 1, wy + h, wz,
                                    wx + 1, wy, wz + w,
                                    wx + 1, wy + h, wz,
                                    wx + 1, wy + h, wz + w
                                );
                                grp.normals.push(
                                    1, 0, 0,  1, 0, 0,  1, 0, 0,
                                    1, 0, 0,  1, 0, 0,  1, 0, 0
                                );
                            } else { // -X (Left, f === 1)
                                grp.positions.push(
                                    wx, wy, wz,
                                    wx, wy, wz + w,
                                    wx, wy + h, wz + w,
                                    wx, wy, wz,
                                    wx, wy + h, wz + w,
                                    wx, wy + h, wz
                                );
                                grp.normals.push(
                                    -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
                                    -1, 0, 0,  -1, 0, 0,  -1, 0, 0
                                );
                            }
                            grp.uvs.push(
                                0, 0,  w, 0,  w, h,
                                0, 0,  w, h,  0, h
                            );

                            i += w;
                        }
                    }
                }
            }

            // --- Faces 2 (+Y) and 3 (-Y) ---
            for (let f = 2; f <= 3; f++) {
                for (let y = 0; y < 32; y++) {
                    // Fill slice mask (X: 0..15, Z: 0..15)
                    for (let z = 0; z < 16; z++) {
                        const zOffset = z << 4;
                        for (let x = 0; x < 16; x++) {
                            const idx = x + zOffset;
                            const block = voxels[x + 16 * (y + 32 * z)];
                            if (block === BLOCK_TYPES.AIR || block === BLOCK_TYPES.WATER || isCrossPlant(block)) {
                                sliceMask[idx] = null;
                                continue;
                            }
                            const neighbor = getVoxelNeighbor(x, y, z, f);
                            let shouldRender = false;
                            if (neighbor === BLOCK_TYPES.AIR || neighbor === BLOCK_TYPES.WATER) {
                                shouldRender = true;
                            } else if (!isOpaque(neighbor) && neighbor !== block) {
                                shouldRender = true;
                            }
                            if (shouldRender) {
                                const blockMat = textureManager.getBlockMaterial(block);
                                sliceMask[idx] = Array.isArray(blockMat) ? blockMat[f] : blockMat;
                            } else {
                                sliceMask[idx] = null;
                            }
                        }
                    }

                    // Greedy 2D merge over (x, z)
                    for (let j = 0; j < 16; j++) {
                        for (let i = 0; i < 16; ) {
                            const mat = sliceMask[i + (j << 4)];
                            if (!mat) {
                                i++;
                                continue;
                            }
                            let w = 1;
                            while (i + w < 16 && sliceMask[(i + w) + (j << 4)] === mat) {
                                w++;
                            }
                            let d = 1;
                            let canExtend = true;
                            while (j + d < 16) {
                                const nextRow = (j + d) << 4;
                                for (let k = 0; k < w; k++) {
                                    if (sliceMask[(i + k) + nextRow] !== mat) {
                                        canExtend = false;
                                        break;
                                    }
                                }
                                if (!canExtend) break;
                                d++;
                            }
                            for (let dz = 0; dz < d; dz++) {
                                const clearOffset = (j + dz) << 4;
                                for (let dx = 0; dx < w; dx++) {
                                    sliceMask[(i + dx) + clearOffset] = null;
                                }
                            }

                            const grp = getGroup(mat);
                            const wx = worldX0 + i;
                            const wy = y;
                            const wz = worldZ0 + j;

                            if (f === 2) { // +Y (Top)
                                grp.positions.push(
                                    wx, wy + 1, wz + d,
                                    wx + w, wy + 1, wz + d,
                                    wx + w, wy + 1, wz,
                                    wx, wy + 1, wz + d,
                                    wx + w, wy + 1, wz,
                                    wx, wy + 1, wz
                                );
                                grp.normals.push(
                                    0, 1, 0,  0, 1, 0,  0, 1, 0,
                                    0, 1, 0,  0, 1, 0,  0, 1, 0
                                );
                            } else { // -Y (Bottom, f === 3)
                                grp.positions.push(
                                    wx, wy, wz,
                                    wx + w, wy, wz,
                                    wx + w, wy, wz + d,
                                    wx, wy, wz,
                                    wx + w, wy, wz + d,
                                    wx, wy, wz + d
                                );
                                grp.normals.push(
                                    0, -1, 0,  0, -1, 0,  0, -1, 0,
                                    0, -1, 0,  0, -1, 0,  0, -1, 0
                                );
                            }
                            grp.uvs.push(
                                0, 0,  w, 0,  w, d,
                                0, 0,  w, d,  0, d
                            );

                            i += w;
                        }
                    }
                }
            }

            // --- Faces 4 (+Z) and 5 (-Z) ---
            for (let f = 4; f <= 5; f++) {
                for (let z = 0; z < 16; z++) {
                    // Fill slice mask (X: 0..15, Y: 0..31)
                    for (let y = 0; y < 32; y++) {
                        const rowOffset = y << 4;
                        for (let x = 0; x < 16; x++) {
                            const idx = x + rowOffset;
                            const block = voxels[x + 16 * (y + 32 * z)];
                            if (block === BLOCK_TYPES.AIR || block === BLOCK_TYPES.WATER || isCrossPlant(block)) {
                                sliceMask[idx] = null;
                                continue;
                            }
                            const isMissingChunk = (f === 4 && z === 15 && !hasFront) || (f === 5 && z === 0 && !hasBack);
                            let shouldRender = false;
                            if (isMissingChunk && (block === BLOCK_TYPES.ICE || !isOpaque(block))) {
                                shouldRender = false;
                            } else {
                                const neighbor = getVoxelNeighbor(x, y, z, f);
                                if (neighbor === BLOCK_TYPES.AIR || neighbor === BLOCK_TYPES.WATER) {
                                    shouldRender = true;
                                } else if (!isOpaque(neighbor) && neighbor !== block) {
                                    shouldRender = true;
                                }
                            }
                            if (shouldRender) {
                                const blockMat = textureManager.getBlockMaterial(block);
                                sliceMask[idx] = Array.isArray(blockMat) ? blockMat[f] : blockMat;
                            } else {
                                sliceMask[idx] = null;
                            }
                        }
                    }

                    // Greedy 2D merge over (x, y)
                    for (let j = 0; j < 32; j++) {
                        for (let i = 0; i < 16; ) {
                            const mat = sliceMask[i + (j << 4)];
                            if (!mat) {
                                i++;
                                continue;
                            }
                            let w = 1;
                            while (i + w < 16 && sliceMask[(i + w) + (j << 4)] === mat) {
                                w++;
                            }
                            let h = 1;
                            let canExtend = true;
                            while (j + h < 32) {
                                const nextRow = (j + h) << 4;
                                for (let k = 0; k < w; k++) {
                                    if (sliceMask[(i + k) + nextRow] !== mat) {
                                        canExtend = false;
                                        break;
                                    }
                                }
                                if (!canExtend) break;
                                h++;
                            }
                            for (let dy = 0; dy < h; dy++) {
                                const clearOffset = (j + dy) << 4;
                                for (let dx = 0; dx < w; dx++) {
                                    sliceMask[(i + dx) + clearOffset] = null;
                                }
                            }

                            const grp = getGroup(mat);
                            const wx = worldX0 + i;
                            const wy = j;
                            const wz = worldZ0 + z;

                            if (f === 4) { // +Z (Front)
                                grp.positions.push(
                                    wx, wy, wz + 1,
                                    wx + w, wy, wz + 1,
                                    wx + w, wy + h, wz + 1,
                                    wx, wy, wz + 1,
                                    wx + w, wy + h, wz + 1,
                                    wx, wy + h, wz + 1
                                );
                                grp.normals.push(
                                    0, 0, 1,  0, 0, 1,  0, 0, 1,
                                    0, 0, 1,  0, 0, 1,  0, 0, 1
                                );
                            } else { // -Z (Back, f === 5)
                                grp.positions.push(
                                    wx + w, wy, wz,
                                    wx, wy, wz,
                                    wx, wy + h, wz,
                                    wx + w, wy, wz,
                                    wx, wy + h, wz,
                                    wx + w, wy + h, wz
                                );
                                grp.normals.push(
                                    0, 0, -1,  0, 0, -1,  0, 0, -1,
                                    0, 0, -1,  0, 0, -1,  0, 0, -1
                                );
                            }
                            grp.uvs.push(
                                0, 0,  w, 0,  w, h,
                                0, 0,  w, h,  0, h
                            );

                            i += w;
                        }
                    }
                }
            }
        }

        // Build Solid Multi-Material Mesh with unified material groups (reducing draw calls drastically)
        let materials = [];
        let groups = [];
        let combinedPositions = null;
        let combinedNormals = null;
        let combinedUVs = null;
        const shadowsOn = (window.game && window.game.shadowsEnabled !== undefined) ? window.game.shadowsEnabled : false;

        if (wasmMesh) {
            let plantPosCount = 0;
            let plantUvCount = 0;
            for (const data of plantGroups.values()) {
                plantPosCount += data.positions.length;
                plantUvCount += data.uvs.length;
            }

            if (plantPosCount === 0) {
                combinedPositions = wasmMesh.positions;
                combinedNormals = wasmMesh.normals;
                combinedUVs = wasmMesh.uvs;
                groups = wasmMesh.groups;
                materials = wasmMesh.materials;
            } else {
                const totalPos = wasmMesh.positions.length + plantPosCount;
                const totalUv = wasmMesh.uvs.length + plantUvCount;
                combinedPositions = new Float32Array(totalPos);
                combinedNormals = new Float32Array(totalPos);
                combinedUVs = new Float32Array(totalUv);

                combinedPositions.set(wasmMesh.positions, 0);
                combinedNormals.set(wasmMesh.normals, 0);
                combinedUVs.set(wasmMesh.uvs, 0);

                groups = wasmMesh.groups.slice();
                materials = wasmMesh.materials.slice();

                let currentPosOffset = wasmMesh.positions.length;
                let currentUvOffset = wasmMesh.uvs.length;
                let currentVertexOffset = wasmMesh.positions.length / 3;

                for (const data of plantGroups.values()) {
                    if (data.positions.length === 0) continue;
                    const count = data.positions.length / 3;
                    let matIndex = materials.indexOf(data.material);
                    if (matIndex === -1) {
                        matIndex = materials.length;
                        materials.push(data.material);
                    }
                    groups.push({
                        start: currentVertexOffset,
                        count: count,
                        materialIndex: matIndex
                    });

                    combinedPositions.set(data.positions, currentPosOffset);
                    combinedNormals.set(data.normals, currentPosOffset);
                    combinedUVs.set(data.uvs, currentUvOffset);

                    currentPosOffset += data.positions.length;
                    currentUvOffset += data.uvs.length;
                    currentVertexOffset += count;
                }
            }
        } else {
            // Merge plantGroups into solidGroups for pure JS greedy mesher fallback
            for (const [mat, pData] of plantGroups.entries()) {
                if (pData.positions.length === 0) continue;
                const sData = getGroup(mat);
                for (let i = 0; i < pData.positions.length; i++) sData.positions.push(pData.positions[i]);
                for (let i = 0; i < pData.normals.length; i++) sData.normals.push(pData.normals[i]);
                for (let i = 0; i < pData.uvs.length; i++) sData.uvs.push(pData.uvs[i]);
            }

            let totalPositions = 0;
            let totalUVs = 0;
            for (const data of solidGroups.values()) {
                totalPositions += data.positions.length;
                totalUVs += data.uvs.length;
            }

            if (totalPositions > 0) {
                combinedPositions = new Float32Array(totalPositions);
                combinedNormals = new Float32Array(totalPositions);
                combinedUVs = new Float32Array(totalUVs);

                let currentPosOffset = 0;
                let currentUvOffset = 0;
                let currentVertexOffset = 0;
                let matIndex = 0;

                for (const data of solidGroups.values()) {
                    if (data.positions.length === 0) continue;

                    const count = data.positions.length / 3;
                    groups.push({
                        start: currentVertexOffset,
                        count: count,
                        materialIndex: matIndex
                    });

                    combinedPositions.set(data.positions, currentPosOffset);
                    combinedNormals.set(data.normals, currentPosOffset);
                    combinedUVs.set(data.uvs, currentUvOffset);

                    currentPosOffset += data.positions.length;
                    currentUvOffset += data.uvs.length;
                    currentVertexOffset += count;

                    materials.push(data.material);
                    matIndex++;
                }
            }
        }

        const isTurboOrA02 = (window.game && (window.game.turboFPS || window.game.isA02Mode));
        const finalMaterials = isTurboOrA02 ? materials.map(m => (m && m.basicCounterpart) ? m.basicCounterpart : m) : materials;

        if (combinedPositions && combinedPositions.length > 0) {
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(combinedPositions, 3));
            geom.setAttribute('normal', new THREE.BufferAttribute(combinedNormals, 3));
            geom.setAttribute('uv', new THREE.BufferAttribute(combinedUVs, 2));

            for (let g of groups) {
                geom.addGroup(g.start, g.count, g.materialIndex);
            }

            // Precompute bounds for instantaneous frustum culling
            geom.computeBoundingBox();
            geom.computeBoundingSphere();

            if (this.mesh) {
                if (this.mesh.geometry) this.mesh.geometry.dispose();
                this.mesh.geometry = geom;
                this.mesh.material = finalMaterials;
                this.mesh.visible = true;
                this.mesh.castShadow = shadowsOn && !isTurboOrA02;
                this.mesh.receiveShadow = shadowsOn && !isTurboOrA02;
            } else {
                this.mesh = new THREE.Mesh(geom, finalMaterials);
                this.mesh.castShadow = shadowsOn && !isTurboOrA02;
                this.mesh.receiveShadow = shadowsOn && !isTurboOrA02;
                this.mesh.frustumCulled = true;
                this.world.scene.add(this.mesh);
            }
        } else if (this.mesh) {
            this.mesh.visible = false;
        }

        // Build Water Mesh
        if (waterPositions.length > 0) {
            const waterGeom = new THREE.BufferGeometry();
            waterGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(waterPositions), 3));
            waterGeom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(waterNormals), 3));
            waterGeom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(waterUVs), 2));
            waterGeom.computeBoundingBox();
            waterGeom.computeBoundingSphere();

            const origWaterMat = textureManager.getBlockMaterial(BLOCK_TYPES.WATER);
            const waterMat = isTurboOrA02 ? (origWaterMat.basicCounterpart || origWaterMat) : origWaterMat;

            if (this.waterMesh) {
                if (this.waterMesh.geometry) this.waterMesh.geometry.dispose();
                this.waterMesh.geometry = waterGeom;
                this.waterMesh.material = waterMat;
                this.waterMesh.visible = true;
                this.waterMesh.receiveShadow = false;
            } else {
                this.waterMesh = new THREE.Mesh(waterGeom, waterMat);
                this.waterMesh.castShadow = false;
                this.waterMesh.receiveShadow = false;
                this.waterMesh.frustumCulled = true;
                this.world.scene.add(this.waterMesh);
            }
        } else if (this.waterMesh) {
            this.waterMesh.visible = false;
        }
    }
}

class VoxelWorld {
    constructor(scene, textureManager, options = {}) {
        this.scene = scene;
        this.textureManager = textureManager;
        this.game = options.game || window.game || null;
        this.chunkRadius = options.chunkRadius || 2; // e.g. 2 means 5x5 chunks (-2 to +2)
        this.dimension = 'overworld';
        this.dimensionStates = new Map();
        this.arenaMap = options.arenaMap || null;
        this.worldType = options.worldType || 'normal'; // 'normal', 'flat', 'mountains', 'tnt_paradise'
        if (this.worldType === 'de_eblan2' && !window.EBLAN_MAPS?.de_eblan2) throw new Error('de_eblan2 map data is not loaded');
        this.seed = options.seed || Math.floor(Math.random() * 1000000);
        if (window.EblanEng) {
            window.EblanEng.setSeed(this.seed);
        }
        this.noise = new PerlinNoise(this.seed);
        this.chunks = {};
        this.waterLevel = 6;
        this.modifiedBlocks = new Map();
        this.blockHistory = new Map(); // key: "x,y,z" -> [prevType1, prevType2, ...]
        this.snapshots = new Map(); // name -> [{x,y,z,type}]
        this.activeWaterBlocks = new Map();
        this.chunkGenQueue = [];
        this.waterTickTimer = 0;
        this.generatedVillages = new Set();
        this.generatedOutposts = new Set();
        this.generatedWildCars = new Set();
        this.starterVillageBuilt = false;
        this.worldPreloaded = false;
        this._lastCx = NaN;
        this._lastCz = NaN;
        this._lastChunk = null;
        this.isGeneratingTerrain = true;
        this.trackModifications = false;
        this.initWorld();
        this.isGeneratingTerrain = false;
        this.trackModifications = true;
    }

    invalidateChunkCache() {
        this._lastCx = NaN;
        this._lastCz = NaN;
        this._lastChunk = null;
    }

    updateChunkMaterials() {
        if (!this.textureManager) return;
        const waterMat = this.textureManager.getBlockMaterial(BLOCK_TYPES.WATER);
        for (const key in this.chunks) {
            const chunk = this.chunks[key];
            if (chunk && chunk.waterMesh) {
                chunk.waterMesh.material = waterMat;
            }
        }
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    getChunk(cx, cz) {
        if (cx === this._lastCx && cz === this._lastCz) {
            return this._lastChunk;
        }
        this._lastCx = cx;
        this._lastCz = cz;
        this._lastChunk = this.chunks[`${cx},${cz}`] || null;
        return this._lastChunk;
    }

    getOrCreateChunk(cx, cz) {
        let chunk;
        if (cx === this._lastCx && cz === this._lastCz && this._lastChunk) {
            chunk = this._lastChunk;
        } else {
            const key = `${cx},${cz}`;
            chunk = this.chunks[key];
            if (!chunk) {
                chunk = new Chunk(cx, cz, this);
                this.chunks[key] = chunk;
            }
            this._lastCx = cx;
            this._lastCz = cz;
            this._lastChunk = chunk;
        }
        return chunk;
    }

    worldToChunkCoords(wx, wy, wz) {
        const ix = Math.floor(wx);
        const iz = Math.floor(wz);
        return {
            cx: ix >> 4,
            cz: iz >> 4,
            lx: ix & 15,
            ly: Math.floor(wy),
            lz: iz & 15
        };
    }

    getBlock(wx, wy, wz) {
        const iy = Math.floor(wy);
        if (iy < 0 || iy >= 32) return BLOCK_TYPES.AIR;
        const ix = Math.floor(wx);
        const iz = Math.floor(wz);

        const cx = ix >> 4;
        const cz = iz >> 4;
        let chunk;
        if (cx === this._lastCx && cz === this._lastCz) {
            chunk = this._lastChunk;
        } else {
            this._lastCx = cx;
            this._lastCz = cz;
            chunk = this.chunks[`${cx},${cz}`] || null;
            this._lastChunk = chunk;
        }
        if (!chunk) return BLOCK_TYPES.AIR;
        return chunk.voxels[(ix & 15) + 16 * (iy + 32 * (iz & 15))];
    }

    setBlock(wx, wy, wz, type) {
        if (this.arenaMap) return;
        const iy = Math.floor(wy);
        if (iy < 0 || iy >= 32) return;
        const ix = Math.floor(wx);
        const iz = Math.floor(wz);
        const cx = ix >> 4;
        const cz = iz >> 4;
        const lx = ix & 15;
        const lz = iz & 15;
        const ly = iy;

        const chunk = this.getOrCreateChunk(cx, cz);
        const prevType = chunk.getBlock(lx, ly, lz);
        if (prevType === type) return;

        chunk.setBlock(lx, ly, lz, type);

        // Mark neighbor chunks dirty if block is on border
        if (lx === 0) {
            const left = this.getChunk(cx - 1, cz);
            if (left) left.isDirty = true;
        }
        if (lx === CHUNK_SIZE_X - 1) {
            const right = this.getChunk(cx + 1, cz);
            if (right) right.isDirty = true;
        }
        if (lz === 0) {
            const back = this.getChunk(cx, cz - 1);
            if (back) back.isDirty = true;
        }
        if (lz === CHUNK_SIZE_Z - 1) {
            const front = this.getChunk(cx, cz + 1);
            if (front) front.isDirty = true;
        }
        if (this.trackModifications) {
            this.modifiedBlocks.set(`${wx},${wy},${wz}`, type);
        }
        if (!this.isGeneratingTerrain && this.blockHistory) {
            const key = `${wx},${wy},${wz}`;
            let hist = this.blockHistory.get(key);
            if (!hist) {
                hist = [];
                this.blockHistory.set(key, hist);
            }
            hist.push(prevType);
            if (hist.length > 50) hist.shift();
        }

        // --- WATER & FLUID DYNAMICS HOOKS ---
        if (!this.isGeneratingTerrain && !this.isUpdatingWaterPhysics) {
            if (type === BLOCK_TYPES.WATER) {
                this.scheduleWaterUpdate(wx, wy, wz, 0);
            } else if (type === BLOCK_TYPES.SPONGE) {
                this.drainWaterRadius(wx, wy, wz, 4);
            } else if (type === BLOCK_TYPES.AIR) {
                // Check if any neighbor is water - wake it up to flow into this new empty space!
                const dirs = [
                    [wx, wy + 1, wz], [wx, wy - 1, wz],
                    [wx + 1, wy, wz], [wx - 1, wy, wz],
                    [wx, wy, wz + 1], [wx, wy, wz - 1]
                ];
                for (const [nx, ny, nz] of dirs) {
                    if (this.getBlock(nx, ny, nz) === BLOCK_TYPES.WATER) {
                        this.scheduleWaterUpdate(nx, ny, nz, 0);
                        break; // Only wake up 1 neighbor water block to prevent cascading floods
                    }
                }
            } else if (type === BLOCK_TYPES.LAVA) {
                // If lava placed next to water -> reaction!
                if (this.getBlock(wx, wy + 1, wz) === BLOCK_TYPES.WATER) {
                    chunk.setBlock(lx, ly, lz, BLOCK_TYPES.OBSIDIAN);
                    this.triggerSteamReaction(wx + 0.5, wy + 0.5, wz + 0.5);
                } else {
                    const sideNeighbors = [
                        [wx + 1, wy, wz], [wx - 1, wy, wz],
                        [wx, wy, wz + 1], [wx, wy, wz - 1]
                    ];
                    for (const [nx, ny, nz] of sideNeighbors) {
                        if (this.getBlock(nx, ny, nz) === BLOCK_TYPES.WATER) {
                            chunk.setBlock(lx, ly, lz, BLOCK_TYPES.COBBLESTONE);
                            this.triggerSteamReaction(wx + 0.5, wy + 0.5, wz + 0.5);
                            break;
                        }
                    }
                }
            }
        }

        // --- ⚡ REDSTONE ENGINE HOOKS ---
        if (!this.isGeneratingTerrain) {
            const redstone = (this.game && this.game.redstoneEngine) || (window.game && window.game.redstoneEngine);
            if (redstone) {
                if (type === BLOCK_TYPES.AIR) {
                    redstone.onBlockBroken(wx, wy, wz, prevType);
                } else {
                    redstone.onBlockPlaced(wx, wy, wz, type);
                }
            }
        }
    }

    restoreBlock(wx, wy, wz) {
        if (!this.blockHistory) return null;
        const key = `${wx},${wy},${wz}`;
        const hist = this.blockHistory.get(key);
        if (!hist || hist.length === 0) return null;
        const prevType = hist.pop();
        this.setBlock(wx, wy, wz, prevType);
        this.updateMeshes();
        return prevType;
    }

    getPreviousBlock(wx, wy, wz) {
        if (!this.blockHistory) return null;
        const hist = this.blockHistory.get(`${wx},${wy},${wz}`);
        if (!hist || hist.length === 0) return null;
        return hist[hist.length - 1];
    }

    createSnapshot(name, x1, y1, z1, x2, y2, z2) {
        const minX = Math.min(Math.floor(x1), Math.floor(x2));
        const maxX = Math.max(Math.floor(x1), Math.floor(x2));
        const minY = Math.max(0, Math.min(Math.floor(y1), Math.floor(y2)));
        const maxY = Math.min(CHUNK_SIZE_Y - 1, Math.max(Math.floor(y1), Math.floor(y2)));
        const minZ = Math.min(Math.floor(z1), Math.floor(z2));
        const maxZ = Math.max(Math.floor(z1), Math.floor(z2));

        const data = [];
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    data.push({ x, y, z, type: this.getBlock(x, y, z) });
                }
            }
        }
        this.snapshots.set(String(name), data);
        return data.length;
    }

    restoreSnapshot(name) {
        const data = this.snapshots.get(String(name));
        if (!data) return false;
        for (let i = 0; i < data.length; i++) {
            const b = data[i];
            this.setBlock(b.x, b.y, b.z, b.type);
        }
        this.updateMeshes();
        return true;
    }

    scheduleWaterUpdate(wx, wy, wz, depth = 0) {
        if (wy < 0 || wy >= CHUNK_SIZE_Y) return;
        if (this.activeWaterBlocks.size > 30) return; // Strict safety cap against cascade floods
        const key = `${wx},${wy},${wz}`;
        if (!this.activeWaterBlocks.has(key)) {
            this.activeWaterBlocks.set(key, { x: wx, y: wy, z: wz, depth });
        }
    }

    isNearSponge(wx, wy, wz, radius = 3) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (this.getBlock(wx + dx, wy + dy, wz + dz) === BLOCK_TYPES.SPONGE) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    drainWaterRadius(sx, sy, sz, radius = 4) {
        let drained = 0;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= radius + 1) {
                        const wx = sx + dx;
                        const wy = sy + dy;
                        const wz = sz + dz;
                        if (this.getBlock(wx, wy, wz) === BLOCK_TYPES.WATER) {
                            this.setBlock(wx, wy, wz, BLOCK_TYPES.AIR);
                            this.markChunkDirtyAt(wx, wz);
                            drained++;
                        }
                    }
                }
            }
        }
        if (drained > 0) {
            if (window.game && window.game.soundManager && window.game.soundManager.playSplash) {
                window.game.soundManager.playSplash();
            }
            if (window.game && window.game.particleSystem && window.game.particleSystem.spawnBubbleParticles) {
                window.game.particleSystem.spawnBubbleParticles(sx + 0.5, sy + 0.5, sz + 0.5, 14);
            }
        }
    }

    triggerSteamReaction(x, y, z) {
        if (window.game && window.game.soundManager && window.game.soundManager.playSizzle) {
            window.game.soundManager.playSizzle();
        }
        if (window.game && window.game.particleSystem) {
            if (window.game.particleSystem.spawnBlockBreakParticles) {
                window.game.particleSystem.spawnBlockBreakParticles(x, y, z, BLOCK_TYPES.STONE, 8);
            }
            if (window.game.particleSystem.spawnBubbleParticles) {
                window.game.particleSystem.spawnBubbleParticles(x, y, z, 8);
            }
        }
    }

    markChunkDirtyAt(wx, wz) {
        const { cx, cz, lx, lz } = this.worldToChunkCoords(wx, 0, wz);
        const chunk = this.getChunk(cx, cz);
        if (chunk) chunk.isDirty = true;
        if (lx === 0) { const c = this.getChunk(cx - 1, cz); if (c) c.isDirty = true; }
        if (lx === CHUNK_SIZE_X - 1) { const c = this.getChunk(cx + 1, cz); if (c) c.isDirty = true; }
        if (lz === 0) { const c = this.getChunk(cx, cz - 1); if (c) c.isDirty = true; }
        if (lz === CHUNK_SIZE_Z - 1) { const c = this.getChunk(cx, cz + 1); if (c) c.isDirty = true; }
    }

    updateWaterPhysics(dt) {
        if (window.game && window.game.underwaterEffectsEnabled === false) {
            if (this.activeWaterBlocks && this.activeWaterBlocks.size > 0) this.activeWaterBlocks.clear();
            return;
        }
        if (!this.activeWaterBlocks || this.activeWaterBlocks.size === 0) return;

        this.waterTickTimer = (this.waterTickTimer || 0) + dt;
        if (this.waterTickTimer < 0.2) return;
        this.waterTickTimer = 0;

        this.isUpdatingWaterPhysics = true;
        const maxSteps = 6;
        let steps = 0;

        // Iterate Map directly (0 array heap allocations)
        for (const [key, data] of this.activeWaterBlocks) {
            this.activeWaterBlocks.delete(key);
            if (!data) continue;
            if (steps >= maxSteps) break;
            steps++;

            const { x, y, z, depth } = data;
            if (this.getBlock(x, y, z) !== BLOCK_TYPES.WATER) continue;

            if (this.isNearSponge(x, y, z, 3)) {
                this.setBlock(x, y, z, BLOCK_TYPES.AIR);
                continue;
            }

            // 1. Flow Downwards (Priority #1)
            if (y > 0) {
                const below = this.getBlock(x, y - 1, z);
                if (below === BLOCK_TYPES.AIR) {
                    this.setBlock(x, y - 1, z, BLOCK_TYPES.WATER);
                    // Retain depth to prevent infinite cascade flood loops!
                    this.scheduleWaterUpdate(x, y - 1, z, Math.max(depth, 1));
                    continue;
                } else if (below === BLOCK_TYPES.LAVA) {
                    this.setBlock(x, y - 1, z, BLOCK_TYPES.OBSIDIAN);
                    this.triggerSteamReaction(x + 0.5, y - 0.5, z + 0.5);
                    continue;
                }
            }

            // 2. Horizontal Spread (only when sitting on solid floor and within max spread depth)
            const MAX_SPREAD_DEPTH = 2; // Strict 2-block limit from source
            if (depth < MAX_SPREAD_DEPTH) {
                const dirs = [
                    [1, 0], [-1, 0], [0, 1], [0, -1]
                ];
                for (const [dx, dz] of dirs) {
                    const nx = x + dx;
                    const nz = z + dz;
                    const adj = this.getBlock(nx, y, nz);
                    if (adj === BLOCK_TYPES.AIR) {
                        if (!this.isNearSponge(nx, y, nz, 3)) {
                            this.setBlock(nx, y, nz, BLOCK_TYPES.WATER);
                            this.scheduleWaterUpdate(nx, y, nz, depth + 1);
                        }
                    } else if (adj === BLOCK_TYPES.LAVA) {
                        this.setBlock(nx, y, nz, BLOCK_TYPES.COBBLESTONE);
                        this.triggerSteamReaction(nx + 0.5, y + 0.5, nz + 0.5);
                    }
                }
            }
        }
        this.isUpdatingWaterPhysics = false;
    }

    rememberDimension() {
        if (!this.dimensionStates) this.dimensionStates = new Map();
        this.dimensionStates.set(this.dimension || 'overworld', {
            worldType: this.worldType,
            modifiedBlocks: this.modifiedBlocks
        });
    }

    restoreChunkEdits(chunk) {
        for (const [key, type] of this.modifiedBlocks) {
            const [x, y, z] = key.split(',').map(Number);
            const coords = this.worldToChunkCoords(x, y, z);
            if (coords.cx === chunk.cx && coords.cz === chunk.cz) {
                chunk.setBlock(coords.lx, coords.ly, coords.lz, type);
            }
        }
    }

    restoreLoadedEdits() {
        for (const chunk of Object.values(this.chunks)) {
            this.restoreChunkEdits(chunk);
        }
    }

    getModifiedBlocksArray() {
        const arr = [];
        for (let [key, type] of this.modifiedBlocks.entries()) {
            const [x, y, z] = key.split(',').map(Number);
            arr.push({ x, y, z, type });
        }
        return arr;
    }

    applyModifiedBlocks(arr) {
        if (!arr || !Array.isArray(arr)) return;
        const prevTrack = this.trackModifications;
        this.trackModifications = false;
        for (let b of arr) {
            this.setBlock(b.x, b.y, b.z, b.type);
            this.modifiedBlocks.set(`${b.x},${b.y},${b.z}`, b.type);
        }
        this.updateMeshes();
        this.trackModifications = prevTrack;
    }

    clearWorld() {
        for (let key in this.chunks) {
            this.chunks[key].dispose();
        }
        this.chunks = {};
        this.invalidateChunkCache();
    }

    reseedWorld(seed, worldType = 'normal', dimension = 'overworld') {
        if (this.arenaMap) return;
        this.clearWorld();
        this.seed = seed;
        this.worldType = worldType;
        this.dimension = dimension;
        this.dimensionStates = new Map();
        if (window.EblanEng) {
            window.EblanEng.setSeed(this.seed);
        }
        this.noise = new PerlinNoise(this.seed);
        this.modifiedBlocks = new Map();
        this.trackModifications = false;
        this.initWorld();
        this.trackModifications = true;
    }

    getBiomeAt(wx, wz) {
        if (this.dimension === 'nether') {
            return { id: 'nether', name: 'Незер (Пекло) 🔥', temp: 2.0, moist: 0.0, precipitation: 'none', fogColor: 0x330808, skyColor: 0x220505 };
        }
        if (this.dimension === 'the_end') {
            return { id: 'the_end', name: 'Край (The End) 🌌', temp: 0.5, moist: 0.5, precipitation: 'none', fogColor: 0x0c0617, skyColor: 0x080410 };
        }
        if (!this.noise) return { id: 'plains', name: 'Квітучі рівнини 🌾', temp: 0.7, moist: 0.4, precipitation: 'rain', fogColor: 0x95c5eb, skyColor: 0x87ceeb };

        const tempNoise = this.noise.noise2D(wx * 0.005 + 500, wz * 0.005 + 500);
        const moistNoise = this.noise.noise2D(wx * 0.005 - 500, wz * 0.005 - 500);
        const cont = this.noise.noise2D(wx * 0.013, wz * 0.013);

        if (tempNoise < -0.30) {
            if (cont > 0.20) {
                return { id: 'snowy_mountains', name: 'Засніжені гори 🏔️', temp: -0.6, moist: 0.8, precipitation: 'snow', fogColor: 0xcde0f0, skyColor: 0xaecce8 };
            }
            if (moistNoise > 0.0) {
                return { id: 'snowy_taiga', name: 'Засніжена тайга 🌲❄️', temp: -0.35, moist: 0.7, precipitation: 'snow', fogColor: 0xd8e8f8, skyColor: 0xb5d4f0 };
            }
            return { id: 'snowy_tundra', name: 'Снігова тундра ❄️', temp: -0.45, moist: 0.3, precipitation: 'snow', fogColor: 0xe0ecf8, skyColor: 0xbed8f4 };
        }
        if (tempNoise > 0.32 && moistNoise < -0.05) {
            if (moistNoise < -0.30) {
                return { id: 'badlands', name: 'Меса / Каньйони 🏜️', temp: 1.5, moist: -0.5, precipitation: 'none', fogColor: 0xdeb08a, skyColor: 0xf5caa0 };
            }
            return { id: 'desert', name: 'Пустеля 🌵', temp: 1.4, moist: -0.4, precipitation: 'none', fogColor: 0xf5dfa0, skyColor: 0xffeaaf };
        }
        if (tempNoise > 0.16 && moistNoise > 0.30) {
            return { id: 'jungle', name: 'Тропічні джунглі 🌴', temp: 0.95, moist: 0.95, precipitation: 'rain', fogColor: 0x88c070, skyColor: 0x76c480 };
        }
        if (moistNoise > 0.20 && cont < -0.05) {
            return { id: 'swamp', name: 'Болото 🌿', temp: 0.7, moist: 0.85, precipitation: 'rain', fogColor: 0x5a7550, skyColor: 0x507048 };
        }
        if (tempNoise < 0.05 && moistNoise > 0.05) {
            return { id: 'taiga', name: 'Хвойна тайга 🌲', temp: 0.25, moist: 0.6, precipitation: 'rain', fogColor: 0x9cb8a5, skyColor: 0x8ab2a0 };
        }
        if (moistNoise > 0.10 && tempNoise > 0.0) {
            if (this.noise.noise2D(wx * 0.02, wz * 0.02) > 0.18) {
                return { id: 'birch_forest', name: 'Березовий гай 🌳', temp: 0.6, moist: 0.6, precipitation: 'rain', fogColor: 0xafcf90, skyColor: 0x8ec878 };
            }
            return { id: 'forest', name: 'Густий ліс 🌲🌳', temp: 0.65, moist: 0.7, precipitation: 'rain', fogColor: 0x8fb870, skyColor: 0x80b868 };
        }
        if (cont > 0.26) {
            return { id: 'mountains', name: 'Скелясті гори ⛰️', temp: 0.2, moist: 0.4, precipitation: 'rain', fogColor: 0xa8b8c8, skyColor: 0x90a8c8 };
        }
        return { id: 'plains', name: 'Квітучі рівнини 🌾', temp: 0.7, moist: 0.4, precipitation: 'rain', fogColor: 0x95c5eb, skyColor: 0x87ceeb };
    }

    generateSingleOverworldChunk(chunk, cx, cz) {
        const worldX0 = cx * CHUNK_SIZE_X;
        const worldZ0 = cz * CHUNK_SIZE_Z;

        // Heights array for column heights
        const heightMap = new Int32Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);

        for (let x = 0; x < CHUNK_SIZE_X; x++) {
            for (let z = 0; z < CHUNK_SIZE_Z; z++) {
                const wx = worldX0 + x;
                const wz = worldZ0 + z;

                if (this.worldType === 'flat' || this.worldType === 'tnt_paradise' || this.worldType === 'race_track' || this.worldType === 'highway_city') {
                    heightMap[x + z * CHUNK_SIZE_X] = 4;
                    continue;
                }

                // Continental macro noise: separates mountains, valleys/lakes, and plains
                const cont = this.noise.noise2D(wx * 0.013, wz * 0.013);
                // Regional hills & ridges
                const hills = this.noise.fbm2D(wx * 0.038, wz * 0.038, 3, 0.5, 2.0);
                const detail = this.noise.noise2D(wx * 0.08, wz * 0.08);

                let h;
                if (this.worldType === 'mountains' || cont > 0.16) {
                    // Dramatic high alpine mountains reaching Y = 16 to 28
                    const mountainElev = Math.max(0, (cont - 0.16) / 0.84);
                    h = 14 + hills * 8 + mountainElev * 10 + detail * 2;
                } else if (cont < -0.22) {
                    // Low river valleys and deep lakes carving down to Y = 2 to 5 (below waterLevel 6)
                    const valleyDepth = Math.max(0, (-cont - 0.22) / 0.78);
                    h = 6 + hills * 3 - valleyDepth * 4 + detail;
                } else {
                    // Rolling green plains and meadows (Y = 8 to 15)
                    h = 8 + hills * 6 + detail * 1.5;
                }

                heightMap[x + z * CHUNK_SIZE_X] = Math.max(2, Math.min(CHUNK_SIZE_Y - 4, Math.floor(h)));
            }
        }

        // Fill blocks column by column
        for (let x = 0; x < CHUNK_SIZE_X; x++) {
            for (let z = 0; z < CHUNK_SIZE_Z; z++) {
                const wx = worldX0 + x;
                const wz = worldZ0 + z;
                const height = heightMap[x + z * CHUNK_SIZE_X];
                const biome = this.getBiomeAt(wx, wz);

                // Bedrock at Y = 0
                chunk.setBlock(x, 0, z, BLOCK_TYPES.BEDROCK);

                if (this.worldType === 'flat') {
                    for (let y = 1; y < 4; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.DIRT);
                    chunk.setBlock(x, 4, z, BLOCK_TYPES.GRASS);
                    continue;
                }
                if (this.worldType === 'tnt_paradise') {
                    for (let y = 1; y < 4; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.TNT);
                    chunk.setBlock(x, 4, z, BLOCK_TYPES.EBLAN_BLOCK);
                    continue;
                }
                if (this.worldType === 'race_track') {
                    for (let y = 1; y < 4; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.DIRT);
                    const trackBlock = this.getRaceTrackBlock(wx, wz);
                    chunk.setBlock(x, 4, z, trackBlock);
                    this.decorateRaceTrack(chunk, x, z, wx, wz);
                    continue;
                }
                if (this.worldType === 'highway_city') {
                    for (let y = 1; y < 4; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.DIRT);
                    this.generateHighwayCityColumn(chunk, x, z, wx, wz);
                    continue;
                }

                // Fill solid column up to height
                for (let y = 1; y <= height; y++) {
                    let block;
                    if (y === height) {
                        // Top surface block depending on elevation and biome
                        if (height <= this.waterLevel + 1) {
                            if (biome.precipitation === 'snow') {
                                block = (height <= this.waterLevel) ? BLOCK_TYPES.ICE : BLOCK_TYPES.SNOW;
                            } else if (biome.id === 'desert' || biome.id === 'badlands') {
                                block = BLOCK_TYPES.SAND;
                            } else if (biome.id === 'swamp') {
                                block = (this.noise.noise2D(wx * 0.4, wz * 0.4) > 0.1) ? BLOCK_TYPES.CLAY : BLOCK_TYPES.GRASS;
                            } else {
                                block = BLOCK_TYPES.SAND;
                            }
                        } else if (height >= 20 && (biome.id === 'mountains' || biome.id === 'snowy_mountains')) {
                            block = (biome.id === 'snowy_mountains' || y % 3 === 0) ? BLOCK_TYPES.SNOW : ((y % 2 === 0) ? BLOCK_TYPES.STONE : BLOCK_TYPES.COBBLESTONE);
                        } else if (biome.id === 'desert') {
                            block = BLOCK_TYPES.SAND;
                        } else if (biome.id === 'badlands') {
                            block = (height % 3 === 0) ? BLOCK_TYPES.TERRACOTTA : ((height % 2 === 0) ? BLOCK_TYPES.SAND : BLOCK_TYPES.SANDSTONE);
                        } else if (biome.precipitation === 'snow') {
                            block = BLOCK_TYPES.SNOW;
                        } else if (biome.id === 'mountains') {
                            block = (height >= 18) ? BLOCK_TYPES.STONE : BLOCK_TYPES.GRASS;
                        } else {
                            block = BLOCK_TYPES.GRASS;
                        }
                    } else if (y >= height - 3 && height > this.waterLevel + 1) {
                        // Subsurface 2-3 layers
                        if (biome.id === 'desert') {
                            block = BLOCK_TYPES.SANDSTONE;
                        } else if (biome.id === 'badlands') {
                            block = BLOCK_TYPES.TERRACOTTA;
                        } else if (biome.id === 'swamp' && y <= this.waterLevel + 2) {
                            block = (y % 2 === 0) ? BLOCK_TYPES.CLAY : BLOCK_TYPES.DIRT;
                        } else if (biome.precipitation === 'snow') {
                            block = (height >= 18) ? BLOCK_TYPES.STONE : BLOCK_TYPES.DIRT;
                        } else {
                            block = (height >= 21) ? BLOCK_TYPES.STONE : BLOCK_TYPES.DIRT;
                        }
                    } else {
                        // Deep rock & ores
                        const oreNoise = this.noise.noise3D(wx * 0.22, y * 0.22, wz * 0.22);
                        if (oreNoise > 0.70 && y <= 6) {
                            block = BLOCK_TYPES.DIAMOND_BLOCK;
                        } else if (oreNoise > 0.60 && y <= 12) {
                            block = BLOCK_TYPES.GOLD_BLOCK;
                        } else if (oreNoise > 0.44 && y <= 20) {
                            block = BLOCK_TYPES.IRON_ORE;
                        } else if (oreNoise < -0.46 && y <= 24) {
                            block = BLOCK_TYPES.COAL_ORE;
                        } else if (oreNoise < -0.68) {
                            block = (biome.id === 'swamp' || biome.id === 'taiga') ? BLOCK_TYPES.MOSSY_COBBLESTONE : BLOCK_TYPES.COBBLESTONE;
                        } else {
                            block = BLOCK_TYPES.STONE;
                        }
                    }
                    chunk.setBlock(x, y, z, block);
                }

                // Fill water or ice in lakes / depressions
                for (let y = height + 1; y <= this.waterLevel; y++) {
                    if (biome.precipitation === 'snow') {
                        chunk.setBlock(x, y, z, (y === this.waterLevel) ? BLOCK_TYPES.ICE : BLOCK_TYPES.PACKED_ICE);
                    } else {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.WATER);
                    }
                }

                // 3D Caves (Worm tunnels cutting through stone and mountain bodies)
                const maxCaveY = (height <= this.waterLevel + 1) ? Math.min(height - 3, 26) : Math.min(height - 1, 26);
                for (let y = 1; y <= maxCaveY; y++) {
                    const c1 = this.noise.noise3D(wx * 0.045, y * 0.065, wz * 0.045);
                    const c2 = this.noise.noise3D(wx * 0.045 + 100, y * 0.065 + 100, wz * 0.045 + 100);
                    if (c1 * c1 + c2 * c2 < 0.036) {
                        if (y <= 2) {
                            chunk.setBlock(x, y, z, BLOCK_TYPES.LAVA); // Underground lava pool
                        } else if (y <= 4 && this.noise.noise2D(wx * 0.12, wz * 0.12) > 0.38) {
                            chunk.setBlock(x, y, z, BLOCK_TYPES.WATER); // Underground aquifer
                        } else {
                            chunk.setBlock(x, y, z, BLOCK_TYPES.AIR);
                        }
                    }
                }

                // Surface decorations (Flora, Cacti, Flowers, Mushrooms, Memes)
                let topSolidY = -1;
                for (let y = CHUNK_SIZE_Y - 2; y >= 1; y--) {
                    const b = chunk.getBlock(x, y, z);
                    if (b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER && b !== BLOCK_TYPES.ICE) {
                        topSolidY = y;
                        break;
                    }
                }

                if (topSolidY > this.waterLevel) {
                    const topB = chunk.getBlock(x, topSolidY, z);
                    const plantNoise = this.noise.noise2D(wx * 0.85, wz * 0.85);

                    // Memes (rare)
                    if (plantNoise > 0.94) {
                        chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.EBLAN_BLOCK);
                    } else if (plantNoise > 0.90) {
                        chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.MEME_CAT);
                    }
                    // Biome-specific vegetation
                    else if (biome.id === 'desert' && topB === BLOCK_TYPES.SAND) {
                        if (plantNoise > 0.78 && chunk.getBlock(x, topSolidY + 1, z) === BLOCK_TYPES.AIR) {
                            const cacH = 2 + (Math.abs(Math.floor(plantNoise * 10)) % 2);
                            for (let cy = 1; cy <= cacH; cy++) {
                                if (topSolidY + cy < CHUNK_SIZE_Y - 2) {
                                    chunk.setBlock(x, topSolidY + cy, z, BLOCK_TYPES.CACTUS);
                                }
                            }
                        }
                    } else if (topB === BLOCK_TYPES.GRASS) {
                        if (biome.id === 'plains') {
                            if (plantNoise > 0.82) {
                                chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.YELLOW_FLOWER);
                            } else if (plantNoise > 0.72) {
                                chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.RED_FLOWER);
                            }
                        } else if (biome.id === 'forest' || biome.id === 'birch_forest') {
                            if (plantNoise > 0.84) {
                                chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.RED_MUSHROOM);
                            } else if (plantNoise > 0.74) {
                                chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.RED_FLOWER);
                            }
                        } else if (biome.id === 'swamp') {
                            if (plantNoise > 0.80) {
                                chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.BROWN_MUSHROOM);
                            } else if (plantNoise > 0.70) {
                                chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.RED_MUSHROOM);
                            }
                        } else if (biome.id === 'taiga') {
                            if (plantNoise > 0.85) {
                                chunk.setBlock(x, topSolidY + 1, z, BLOCK_TYPES.MOSSY_COBBLESTONE);
                            }
                        }
                    }
                }
            }
        }

        // Trees in this chunk (biome-specific species: Oak, Birch, Spruce, Snowy Spruce, Jungle, Swamp)
        if (this.worldType === 'normal' || this.worldType === 'mountains') {
            for (let x = 3; x < CHUNK_SIZE_X - 3; x += 4) {
                for (let z = 3; z < CHUNK_SIZE_Z - 3; z += 4) {
                    const wx = worldX0 + x;
                    const wz = worldZ0 + z;
                    const biome = this.getBiomeAt(wx, wz);
                    if (biome.id === 'desert' || biome.id === 'badlands') continue;

                    const treeThreshold = (biome.id === 'forest' || biome.id === 'birch_forest' || biome.id === 'jungle') ? 0.22 :
                                          (biome.id === 'taiga' || biome.id === 'snowy_taiga') ? 0.26 :
                                          (biome.id === 'swamp') ? 0.32 : 0.40;

                    const treeProb = this.noise.noise2D(wx * 0.35 + 120, wz * 0.35 + 120);
                    if (treeProb > treeThreshold) {
                        for (let y = CHUNK_SIZE_Y - 9; y >= this.waterLevel + 1; y--) {
                            const ground = chunk.getBlock(x, y, z);
                            const above = chunk.getBlock(x, y + 1, z);
                            if ((ground === BLOCK_TYPES.GRASS || ground === BLOCK_TYPES.SNOW || ground === BLOCK_TYPES.DIRT) && above === BLOCK_TYPES.AIR) {
                                let treeType = 'oak';
                                if (biome.id === 'birch_forest') {
                                    treeType = 'birch';
                                } else if (biome.id === 'forest') {
                                    treeType = (treeProb > 0.38) ? 'birch' : 'oak';
                                } else if (biome.id === 'taiga') {
                                    treeType = 'spruce';
                                } else if (biome.id === 'snowy_taiga') {
                                    treeType = 'snowy_spruce';
                                } else if (biome.id === 'jungle') {
                                    treeType = 'jungle';
                                } else if (biome.id === 'swamp') {
                                    treeType = 'swamp';
                                }
                                this.plantTreeInChunk(chunk, x, y + 1, z, treeType);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // 🏎️ Formula 1 Race Circuit generator
    getRaceTrackBlock(wx, wz) {
        // Grand Prix Circuit Centerline Waypoints
        const waypoints = [
            { x: 0, z: -180 },
            { x: 0, z: 180 },
            { x: 30, z: 230 },
            { x: 80, z: 245 },
            { x: 130, z: 215 },
            { x: 140, z: 130 },
            { x: 140, z: 40 },
            { x: 100, z: -10 },
            { x: 75, z: -40 },
            { x: 110, z: -75 },
            { x: 130, z: -130 },
            { x: 105, z: -190 },
            { x: 50, z: -215 },
            { x: 0, z: -180 }
        ];

        let minDist = 9999;
        let bestS = 0;
        let currentS = 0;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const A = waypoints[i];
            const B = waypoints[i + 1];
            const dx = B.x - A.x;
            const dz = B.z - A.z;
            const segLenSq = dx * dx + dz * dz;
            const segLen = Math.sqrt(segLenSq);

            const u = ((wx - A.x) * dx + (wz - A.z) * dz) / segLenSq;
            const t = Math.max(0, Math.min(1, u));
            const projX = A.x + t * dx;
            const projZ = A.z + t * dz;

            const d = Math.hypot(wx - projX, wz - projZ);
            if (d < minDist) {
                minDist = d;
                bestS = currentS + t * segLen;
            }
            currentS += segLen;
        }

        // Pit lane parallel straight: X = -10, Z between -120 and 120
        const isPitLane = (wx >= -13 && wx <= -7 && wz >= -130 && wz <= 130);

        // Start / Finish Line at Z = 0, X between -4 and 4
        if (Math.abs(wz) <= 1 && Math.abs(wx) <= 4.2) {
            return ((Math.floor(wx) + Math.floor(wz)) % 2 === 0) ? BLOCK_TYPES.SNOW : BLOCK_TYPES.OBSIDIAN;
        }

        if (minDist <= 4.0 || isPitLane) {
            // Smooth dark asphalt
            if (!isPitLane && minDist <= 0.4 && (Math.floor(bestS / 4) % 2 === 0)) {
                return BLOCK_TYPES.SNOW; // Center dashed line
            }
            return BLOCK_TYPES.OBSIDIAN;
        }

        // Curbs (Kerbs) on track edges (alternating red & white)
        if (minDist <= 5.4) {
            const kerbPhase = Math.floor(bestS / 2.2);
            return (kerbPhase % 2 === 0) ? BLOCK_TYPES.REDSTONE_BLOCK : BLOCK_TYPES.SNOW;
        }

        // Gravel runoff trap
        if (minDist <= 6.8) {
            return BLOCK_TYPES.GRAVEL;
        }

        return BLOCK_TYPES.GRASS;
    }

    // Add 3D track structures (starting gantry, pit wall, grandstands, lights)
    decorateRaceTrack(chunk, x, z, wx, wz) {
        // 1. Overhead Gantry Start/Finish Lights at wz = 0
        if (wz === 0 && wx >= -6 && wx <= 6) {
            if (wx === -6 || wx === 6) {
                for (let y = 5; y <= 8; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.IRON_ORE);
            } else {
                chunk.setBlock(x, 8, z, BLOCK_TYPES.STONE);
                if (Math.abs(wx) <= 3) {
                    chunk.setBlock(x, 7, z, (Math.abs(wx) % 2 === 0) ? BLOCK_TYPES.REDSTONE_BLOCK : BLOCK_TYPES.GLOWSTONE);
                }
            }
        }

        // 2. Pit Wall at wx = -5
        if (wx === -5 && wz >= -120 && wz <= 120) {
            chunk.setBlock(x, 5, z, BLOCK_TYPES.STONE);
        }

        // 3. Grandstands at wx between 12 and 16, wz between -90 and 90
        if (wx >= 12 && wx <= 16 && wz >= -90 && wz <= 90) {
            const tier = wx - 12; // 0..4
            for (let y = 5; y <= 5 + tier; y++) {
                chunk.setBlock(x, y, z, (y === 5 + tier) ? BLOCK_TYPES.PLANKS : BLOCK_TYPES.WOOD);
            }
            if (wx <= 15) {
                chunk.setBlock(x, 10, z, BLOCK_TYPES.GLASS);
            }
        }

        // 4. Floodlights every 40 blocks
        if (Math.abs(wz) % 40 === 0 && (wx === 9 || wx === -16)) {
            for (let y = 5; y <= 8; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.IRON_ORE);
            chunk.setBlock(x, 9, z, BLOCK_TYPES.GLOWSTONE);
        }
    }

    // 🏙️ Highway & City Grid generator (Realistic urban planning & solid architecture)
    generateHighwayCityColumn(chunk, x, z, wx, wz) {
        const P = 48; // City block size
        const mx = ((wx % P) + P) % P;
        const mz = ((wz % P) + P) % P;

        const isRoadX = (mx >= 0 && mx <= 10);
        const isRoadZ = (mz >= 0 && mz <= 10);

        // 1. ROADS, INTERSECTIONS, CROSSWALKS & SIDEWALKS
        if (isRoadX || isRoadZ) {
            for (let y = 1; y < 4; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.DIRT);

            const isIntersection = isRoadX && isRoadZ;

            if (isIntersection) {
                const isCrosswalk = (mx === 1 || mx === 9 || mz === 1 || mz === 9) && ((wx + wz) % 2 === 0);
                chunk.setBlock(x, 4, z, isCrosswalk ? BLOCK_TYPES.SNOW : BLOCK_TYPES.OBSIDIAN);
                return;
            }

            if (isRoadX) {
                if (mx === 0 || mx === 10) {
                    chunk.setBlock(x, 4, z, BLOCK_TYPES.STONE);
                    if (wz % 16 === 0) {
                        for (let y = 5; y <= 7; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.IRON_ORE);
                        chunk.setBlock(x, 8, z, BLOCK_TYPES.GLOWSTONE);
                    }
                } else if (mx === 5 && (Math.floor(wz / 3) % 2 === 0)) {
                    chunk.setBlock(x, 4, z, BLOCK_TYPES.GOLD_BLOCK);
                } else {
                    chunk.setBlock(x, 4, z, BLOCK_TYPES.OBSIDIAN);
                }
                return;
            }

            if (isRoadZ) {
                if (mz === 0 || mz === 10) {
                    chunk.setBlock(x, 4, z, BLOCK_TYPES.STONE);
                    if (wx % 16 === 0) {
                        for (let y = 5; y <= 7; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.IRON_ORE);
                        chunk.setBlock(x, 8, z, BLOCK_TYPES.GLOWSTONE);
                    }
                } else if (mz === 5 && (Math.floor(wx / 3) % 2 === 0)) {
                    chunk.setBlock(x, 4, z, BLOCK_TYPES.GOLD_BLOCK);
                } else {
                    chunk.setBlock(x, 4, z, BLOCK_TYPES.OBSIDIAN);
                }
                return;
            }
        }

        // 2. CITY PLOT (mx in 11..47, mz in 11..47)
        for (let y = 1; y < 4; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.DIRT);

        // Sidewalk perimeter & central alleys
        if (mx === 11 || mx === 47 || mz === 11 || mz === 47 || mx === 28 || mx === 29 || mz === 28 || mz === 29) {
            chunk.setBlock(x, 4, z, BLOCK_TYPES.STONE);
            if ((mx === 28 || mx === 29) && (mz === 28 || mz === 29)) {
                chunk.setBlock(x, 5, z, BLOCK_TYPES.WOOD);
                chunk.setBlock(x, 6, z, BLOCK_TYPES.LEAVES);
            }
            return;
        }

        // 4 Distinct Building Lots per city block
        let lot = -1;
        let lx0 = 0, lx1 = 0, lz0 = 0, lz1 = 0;

        if (mx >= 13 && mx <= 26) {
            lx0 = 13; lx1 = 26;
            if (mz >= 13 && mz <= 26) { lot = 0; lz0 = 13; lz1 = 26; }
            else if (mz >= 31 && mz <= 44) { lot = 2; lz0 = 31; lz1 = 44; }
        } else if (mx >= 31 && mx <= 44) {
            lx0 = 31; lx1 = 44;
            if (mz >= 13 && mz <= 26) { lot = 1; lz0 = 13; lz1 = 26; }
            else if (mz >= 31 && mz <= 44) { lot = 3; lz0 = 31; lz1 = 44; }
        }

        if (lot === -1) {
            chunk.setBlock(x, 4, z, BLOCK_TYPES.STONE);
            return;
        }

        const plotX = Math.floor(wx / P);
        const plotZ = Math.floor(wz / P);
        const hash = Math.sin((plotX * 31.7 + plotZ * 73.1 + lot * 17.3)) * 43758.5453;
        const rand = Math.abs(hash) % 1.0;

        const FLOOR_H = 4;
        const numFloors = 3 + Math.floor(rand * 5); // 3 to 7 stories
        const bHeight = 4 + numFloors * FLOOR_H;     // 16, 20, 24, 28, 32 blocks tall
        const theme = Math.floor(rand * 10) % 4;

        let wallMat = BLOCK_TYPES.STONE;
        let trimMat = BLOCK_TYPES.COBBLESTONE;
        let floorMat = BLOCK_TYPES.PLANKS;

        if (theme === 0) {
            wallMat = BLOCK_TYPES.NETHER_QUARTZ;
            trimMat = BLOCK_TYPES.STONE;
            floorMat = BLOCK_TYPES.BIRCH_PLANKS;
        } else if (theme === 1) {
            wallMat = BLOCK_TYPES.BRICKS;
            trimMat = BLOCK_TYPES.STONE;
            floorMat = BLOCK_TYPES.PLANKS;
        } else if (theme === 2) {
            wallMat = BLOCK_TYPES.TERRACOTTA;
            trimMat = BLOCK_TYPES.COBBLESTONE;
            floorMat = BLOCK_TYPES.SPRUCE_PLANKS;
        } else {
            wallMat = BLOCK_TYPES.STONE;
            trimMat = BLOCK_TYPES.NETHERITE_BLOCK;
            floorMat = BLOCK_TYPES.PLANKS;
        }

        const isEdgeX = (mx === lx0 || mx === lx1);
        const isEdgeZ = (mz === lz0 || mz === lz1);
        const isWall = isEdgeX || isEdgeZ;
        const isCorner = isEdgeX && isEdgeZ;

        const localX = mx - lx0; // 0..13
        const localZ = mz - lz0; // 0..13

        // Front street entrance: facing outside avenues
        const isFrontEdge = (lot <= 1) ? (mz === lz0) : (mz === lz1);
        const isDoorX = (localX === 6 || localX === 7);

        // Ground slab
        chunk.setBlock(x, 4, z, floorMat);

        if (isWall) {
            const offset = isEdgeX ? localZ : localX;
            const isWindowCol = (offset === 2 || offset === 3 || offset === 6 || offset === 7 || offset === 10 || offset === 11);

            for (let y = 5; y <= bHeight; y++) {
                const relY = (y - 5) % FLOOR_H;

                // Front entrance doorway at ground floor
                if (isFrontEdge && isDoorX && y <= 7) {
                    if (y === 5 || y === 6) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.AIR);
                        continue;
                    } else if (y === 7) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.GLOWSTONE); // Lantern above door
                        continue;
                    }
                }

                if (isCorner) {
                    chunk.setBlock(x, y, z, trimMat);
                } else if (relY === 3) {
                    // Floor band / cornice
                    chunk.setBlock(x, y, z, trimMat);
                } else if (relY === 0) {
                    // Window sill / lower wall
                    chunk.setBlock(x, y, z, wallMat);
                } else if (isWindowCol) {
                    // Elegant double-pane windows at relY === 1 and relY === 2
                    chunk.setBlock(x, y, z, BLOCK_TYPES.GLASS);
                } else {
                    chunk.setBlock(x, y, z, wallMat);
                }
            }

            // Parapet roof railing
            chunk.setBlock(x, bHeight + 1, z, trimMat);
        } else {
            // Interior space
            const isStairWell = (localX >= 2 && localX <= 3 && localZ >= 2 && localZ <= 3);

            for (let y = 5; y <= bHeight; y++) {
                const relY = (y - 5) % FLOOR_H;

                if (relY === 3) {
                    // Ceiling / upper floor slab
                    if (y === bHeight) {
                        // Roof slab
                        chunk.setBlock(x, y, z, floorMat);
                    } else if (isStairWell) {
                        // Keep stairwell open between floors
                        chunk.setBlock(x, y, z, BLOCK_TYPES.AIR);
                    } else {
                        // Floor slab with central ceiling lamp
                        if (localX === 7 && localZ === 7) {
                            chunk.setBlock(x, y, z, BLOCK_TYPES.GLOWSTONE);
                        } else {
                            chunk.setBlock(x, y, z, floorMat);
                        }
                    }
                } else {
                    // Air room clearance with spiral jumping staircase
                    if (isStairWell) {
                        if (relY === 0 && localX === 2 && localZ === 2) chunk.setBlock(x, y, z, trimMat);
                        else if (relY === 1 && localX === 3 && localZ === 2) chunk.setBlock(x, y, z, trimMat);
                        else if (relY === 2 && localX === 3 && localZ === 3) chunk.setBlock(x, y, z, trimMat);
                        else chunk.setBlock(x, y, z, BLOCK_TYPES.AIR);
                    } else if (y === 5) {
                        // Ground floor lobby furniture
                        if (localX === 10 && localZ === 10) chunk.setBlock(x, y, z, BLOCK_TYPES.BOOKSHELF);
                        else if (localX === 10 && localZ === 9) chunk.setBlock(x, y, z, BLOCK_TYPES.CRAFTING_TABLE);
                        else chunk.setBlock(x, y, z, BLOCK_TYPES.AIR);
                    } else {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.AIR);
                    }
                }
            }

            // Roof antenna beacon
            if (localX === 7 && localZ === 7) {
                chunk.setBlock(x, bHeight + 1, z, BLOCK_TYPES.IRON_ORE);
                chunk.setBlock(x, bHeight + 2, z, BLOCK_TYPES.IRON_ORE);
                chunk.setBlock(x, bHeight + 3, z, BLOCK_TYPES.GLOWSTONE);
            }
        }
    }

    generateSingleNetherChunk(chunk, cx, cz) {
        const worldX0 = cx * CHUNK_SIZE_X;
        const worldZ0 = cz * CHUNK_SIZE_Z;

        for (let x = 0; x < CHUNK_SIZE_X; x++) {
            for (let z = 0; z < CHUNK_SIZE_Z; z++) {
                const wx = worldX0 + x;
                const wz = worldZ0 + z;

                // 1. Bedrock floor & ceiling
                chunk.setBlock(x, 0, z, BLOCK_TYPES.BEDROCK);
                chunk.setBlock(x, CHUNK_SIZE_Y - 1, z, BLOCK_TYPES.BEDROCK);

                // 2. Lava ocean at bottom (y = 1 to 4)
                for (let y = 1; y <= 4; y++) {
                    chunk.setBlock(x, y, z, BLOCK_TYPES.LAVA);
                }

                // 3. Dynamic cavern floor & ceiling terrain
                const nBottom = this.noise.fbm2D(wx * 0.035, wz * 0.035, 3, 0.5, 2.0);
                const bottomHeight = Math.floor(5 + nBottom * 12);

                const nTop = this.noise.fbm2D(wx * 0.035 + 60, wz * 0.035 + 60, 3, 0.5, 2.0);
                const topCeil = Math.floor(CHUNK_SIZE_Y - 2 - nTop * 10);

                // Floor-to-ceiling pillar noise
                const pillarNoise = this.noise.noise2D(wx * 0.09 + 300, wz * 0.09 + 300);
                const isPillar = (pillarNoise > 0.58);

                // Fill floor
                for (let y = 1; y <= bottomHeight; y++) {
                    const oreN = this.noise.noise3D(wx * 0.22, y * 0.22, wz * 0.22);
                    if (oreN > 0.76 && y <= 9) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.NETHERITE_BLOCK);
                    } else if (oreN > 0.48) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.NETHER_QUARTZ);
                    } else if (oreN < -0.52 && y <= 6) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.SOUL_SAND);
                    } else {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.NETHERRACK);
                    }
                }

                // Fill ceiling & stalactites & glowstone
                for (let y = topCeil; y < CHUNK_SIZE_Y - 1; y++) {
                    const gsN = this.noise.noise3D(wx * 0.25, y * 0.25, wz * 0.25);
                    if (gsN > 0.52 && y === topCeil) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.GLOWSTONE);
                    } else {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.NETHERRACK);
                    }
                }

                // Hanging stalactite spikes
                const stalactiteN = this.noise.noise2D(wx * 0.35 + 500, wz * 0.35 + 500);
                if (stalactiteN > 0.45 && topCeil > 6) {
                    chunk.setBlock(x, topCeil - 1, z, BLOCK_TYPES.NETHERRACK);
                    if (stalactiteN > 0.65 && topCeil > 7) {
                        chunk.setBlock(x, topCeil - 2, z, (stalactiteN > 0.75) ? BLOCK_TYPES.GLOWSTONE : BLOCK_TYPES.NETHERRACK);
                    }
                }

                // Colossal Floor-to-Ceiling Pillars
                if (isPillar) {
                    for (let y = 5; y <= topCeil; y++) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.NETHERRACK);
                    }
                }

                // Mid-air floating arches / bridges
                for (let y = 9; y <= 16; y++) {
                    const bridgeN = this.noise.noise3D(wx * 0.05 + 15, y * 0.08 + 15, wz * 0.05 + 15);
                    if (bridgeN > 0.48 && chunk.getBlock(x, y, z) === BLOCK_TYPES.AIR) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.NETHERRACK);
                    }
                }

                // 3D Nether Caverns (carves open tunnels through the netherrack mass)
                for (let y = 5; y < CHUNK_SIZE_Y - 1; y++) {
                    const netherCave = this.noise.noise3D(wx * 0.045 + 80, y * 0.065 + 80, wz * 0.045 + 80);
                    if (netherCave * netherCave < 0.032) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.AIR);
                    }
                }

                // Nether fortress brick ruins
                if (Math.abs(wx - 8) <= 2 && Math.abs(wz - 8) <= 2 && bottomHeight >= 5) {
                    chunk.setBlock(x, bottomHeight + 1, z, BLOCK_TYPES.NETHER_BRICKS);
                }
            }
        }
    }

    generateSingleEndChunk(chunk, cx, cz) {
        const worldX0 = cx * CHUNK_SIZE_X;
        const worldZ0 = cz * CHUNK_SIZE_Z;

        for (let x = 0; x < CHUNK_SIZE_X; x++) {
            for (let z = 0; z < CHUNK_SIZE_Z; z++) {
                const wx = worldX0 + x;
                const wz = worldZ0 + z;
                const distToCenter = Math.sqrt(wx * wx + wz * wz);

                // Central floating island of End Stone
                const islandRadius = 26;
                if (distToCenter < islandRadius) {
                    const n = this.noise.noise2D(wx * 0.08, wz * 0.08);
                    const edgeFalloff = 1 - (distToCenter / islandRadius);
                    const thickness = Math.max(0, Math.floor((5 + n * 4) * edgeFalloff));
                    const topY = 14 + Math.floor(n * 2);

                    for (let y = Math.max(1, topY - thickness); y <= topY; y++) {
                        chunk.setBlock(x, y, z, BLOCK_TYPES.END_STONE);
                    }
                }
            }
        }
    }

    populateChunkTrees(chunk, cx, cz) {
        const worldX0 = cx * CHUNK_SIZE_X;
        const worldZ0 = cz * CHUNK_SIZE_Z;
        for (let x = 3; x < CHUNK_SIZE_X - 3; x += 4) {
            for (let z = 3; z < CHUNK_SIZE_Z - 3; z += 4) {
                const wx = worldX0 + x;
                const wz = worldZ0 + z;
                const biome = this.getBiomeAt(wx, wz);
                if (biome.id === 'desert' || biome.id === 'badlands') continue;

                const treeThreshold = (biome.id === 'forest' || biome.id === 'birch_forest' || biome.id === 'jungle') ? 0.22 :
                                      (biome.id === 'taiga' || biome.id === 'snowy_taiga') ? 0.26 :
                                      (biome.id === 'swamp') ? 0.32 : 0.40;

                const treeProb = (window.EblanEng && window.EblanEng.ready)
                    ? window.EblanEng.noise2D(wx * 0.35 + 120, wz * 0.35 + 120)
                    : (this.noise ? this.noise.noise2D(wx * 0.35 + 120, wz * 0.35 + 120) : 0);

                if (treeProb > treeThreshold) {
                    for (let y = CHUNK_SIZE_Y - 9; y >= this.waterLevel + 1; y--) {
                        const ground = chunk.getBlock(x, y, z);
                        const above = chunk.getBlock(x, y + 1, z);
                        if ((ground === BLOCK_TYPES.GRASS || ground === BLOCK_TYPES.SNOW || ground === BLOCK_TYPES.DIRT) && above === BLOCK_TYPES.AIR) {
                            let treeType = 'oak';
                            if (biome.id === 'birch_forest') {
                                treeType = 'birch';
                            } else if (biome.id === 'forest') {
                                treeType = (treeProb > 0.38) ? 'birch' : 'oak';
                            } else if (biome.id === 'taiga') {
                                treeType = 'spruce';
                            } else if (biome.id === 'snowy_taiga') {
                                treeType = 'snowy_spruce';
                            } else if (biome.id === 'jungle') {
                                treeType = 'jungle';
                            } else if (biome.id === 'swamp') {
                                treeType = 'swamp';
                            }
                            this.plantTreeInChunk(chunk, x, y + 1, z, treeType);
                            break;
                        }
                    }
                }
            }
        }
    }

    getBuiltinMap() {
        return this.dimension === 'overworld' ? window.EBLAN_MAPS?.[this.worldType] || null : null;
    }

    generateSingleChunk(cx, cz) {
        const key = this.getChunkKey(cx, cz);
        let chunk = this.chunks[key];
        if (!chunk) {
            chunk = new Chunk(cx, cz, this);
            this.chunks[key] = chunk;
        }
        if (chunk.isGenerated) return chunk;
        chunk.isGenerated = true;

        const builtinMap = this.getBuiltinMap();
        if (builtinMap) {
            const pairs = builtinMap.chunks[key] || [];
            for (let i = 0; i < pairs.length; i += 2) chunk.voxels[pairs[i]] = pairs[i + 1];
            this.restoreChunkEdits(chunk);
            return chunk;
        }

        if (this.arenaMap) {
            const map = this.arenaMap;
            for (let x = 0; x < CHUNK_SIZE_X; x++) {
                for (let z = 0; z < CHUNK_SIZE_Z; z++) {
                    const wx = cx * CHUNK_SIZE_X + x, wz = cz * CHUNK_SIZE_Z + z;
                    if (wx < map.min || wx > map.max || wz < map.min || wz > map.max) continue;
                    chunk.setBlock(x, map.floorY - 1, z, BLOCK_TYPES.STONE);
                    if (wx === map.min || wx === map.max || wz === map.min || wz === map.max) {
                        for (let y = map.floorY; y < map.floorY + map.wallHeight; y++) {
                            chunk.setBlock(x, y, z, BLOCK_TYPES.BEDROCK);
                        }
                    }
                    for (const [a, b, c, d, e, f] of map.obstacles) {
                        if (wx >= a && wx < d && wz >= c && wz < f) {
                            for (let y = b; y < e; y++) chunk.setBlock(x, y, z, BLOCK_TYPES.STONE);
                        }
                    }
                }
            }
            return chunk;
        }

        // EblanEng Rust Wasm Fast Path (bypassed for custom JS worlds like race_track and highway_city)!
        if (window.EblanEng && window.EblanEng.ready && this.worldType !== 'race_track' && this.worldType !== 'highway_city') {
            if (window.EblanEng.currentSeed !== this.seed) {
                window.EblanEng.setSeed(this.seed);
            }
            const dimId = (this.dimension === 'nether') ? 1 : ((this.dimension === 'the_end') ? 2 : 0);
            const wTypeId = (this.worldType === 'flat') ? 1 : ((this.worldType === 'mountains') ? 2 : ((this.worldType === 'tnt_paradise') ? 3 : 0));
            const wasmVoxels = window.EblanEng.generateChunk(cx, cz, dimId, wTypeId, this.waterLevel);
            if (wasmVoxels) {
                chunk.voxels.set(wasmVoxels);
                if (dimId === 0 && (this.worldType === 'normal' || this.worldType === 'mountains')) {
                    this.populateChunkTrees(chunk, cx, cz);
                    this.checkNaturalStructures(chunk, cx, cz);
                }
                this.restoreChunkEdits(chunk);
                return chunk;
            }
        }

        if (this.dimension === 'nether') {
            this.generateSingleNetherChunk(chunk, cx, cz);
        } else if (this.dimension === 'the_end') {
            this.generateSingleEndChunk(chunk, cx, cz);
        } else {
            this.generateSingleOverworldChunk(chunk, cx, cz);
            if (this.worldType === 'normal' || this.worldType === 'mountains') {
                this.checkNaturalStructures(chunk, cx, cz);
            }
        }
        this.restoreChunkEdits(chunk);
        return chunk;
    }

    generateTerrain() {
        const r = this.chunkRadius;
        for (let cx = -r; cx <= r; cx++) {
            for (let cz = -r; cz <= r; cz++) {
                this.generateSingleChunk(cx, cz);
            }
        }

        if (this.arenaMap || this.getBuiltinMap()) return;
        if (this.dimension === 'nether') {
            // Build Nether Portal room and spawn
            for (let dx = -3; dx <= 5; dx++) {
                for (let dz = -3; dz <= 5; dz++) {
                    this.setBlock(dx, 6, dz, BLOCK_TYPES.NETHER_BRICKS);
                    for (let y = 7; y <= 13; y++) this.setBlock(dx, y, dz, BLOCK_TYPES.AIR);
                    if ((dx === -3 || dx === 5) && (dz === -3 || dz === 5)) {
                        this.setBlock(dx, 7, dz, BLOCK_TYPES.GLOWSTONE);
                    }
                }
            }
            this.buildNetherPortal(0, 7, 0);
        } else if (this.dimension === 'the_end') {
            const pillarPositions = [
                [15, 0], [-15, 0], [0, 15], [0, -15],
                [11, 11], [-11, -11], [11, -11], [-11, 11]
            ];
            for (let pos of pillarPositions) this.buildObsidianPillar(pos[0], pos[1]);
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    this.setBlock(dx, 13, 18 + dz, BLOCK_TYPES.OBSIDIAN);
                    for (let dy = 1; dy <= 4; dy++) this.setBlock(dx, 13 + dy, 18 + dz, BLOCK_TYPES.AIR);
                }
            }
            this.buildEndExitFountain(0, 14, 0);
        } else {
            // Overworld Nether Portal at (8, y, 8)
            let portalY = 12;
            for (let y = CHUNK_SIZE_Y - 4; y >= 2; y--) {
                if (this.getBlock(8, y, 8) !== BLOCK_TYPES.AIR) {
                    portalY = y + 1;
                    break;
                }
            }
            this.buildNetherPortal(8, portalY, 8);

            // Guaranteed Natural Starter Village near Spawn with Parked Car & Computer Lab!
            this.buildStarterVillage();
        }
    }

    buildStarterVillage() {
        if (this.starterVillageBuilt) return;
        if (this.dimension !== 'overworld') return;
        if (this.worldType !== 'normal' && this.worldType !== 'mountains') return;

        const sx = 20, sz = 20;
        let sGroundY = 14;
        for (let y = CHUNK_SIZE_Y - 4; y >= 4; y--) {
            const b = this.getBlock(sx, y, sz);
            if (b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.LEAVES && b !== BLOCK_TYPES.WATER) {
                sGroundY = y;
                break;
            }
        }
        this.generatedVillages.add('1,1');
        this.buildVillage(sx, sGroundY, sz, true);
        this.starterVillageBuilt = true;
    }

    async preloadChunksAsync(onProgress = null) {
        this.isGeneratingTerrain = true;
        this.trackModifications = false;
        this.chunkGenQueue = [];

        const curCX = 0;
        const curCZ = 0;
        const r = Math.max(2, this.chunkRadius || 2);

        // Collect all chunks in radius, concentric from center outward
        const chunksToPreload = [];
        for (let cx = curCX - r; cx <= curCX + r; cx++) {
            for (let cz = curCZ - r; cz <= curCZ + r; cz++) {
                const distSq = (cx - curCX) * (cx - curCX) + (cz - curCZ) * (cz - curCZ);
                chunksToPreload.push({ cx, cz, distSq });
            }
        }
        chunksToPreload.sort((a, b) => a.distSq - b.distSq);

        const totalChunks = chunksToPreload.length;
        let processed = 0;

        // Stage 1: Generate and mesh all radius chunks
        for (const item of chunksToPreload) {
            let chunk = this.getChunk(item.cx, item.cz);
            if (!chunk || !chunk.isGenerated) {
                chunk = this.generateSingleChunk(item.cx, item.cz);
            }
            if (chunk) {
                chunk.rebuildMesh(this.textureManager);
                chunk.isDirty = false;
            }
            processed++;
            const pct = Math.round((processed / totalChunks) * 75);
            if (onProgress) {
                onProgress({
                    percent: pct,
                    current: processed,
                    total: totalChunks,
                    stage: `Генерація чанка [${item.cx}, ${item.cz}] (${processed}/${totalChunks})...`
                });
            }
            await new Promise(res => setTimeout(res, 8));
        }

        // Stage 2: Dimension structures & Guaranteed Starter Village
        if (onProgress) {
            onProgress({
                percent: 85,
                current: totalChunks,
                total: totalChunks,
                stage: "Створення стартових структур, поселення та транспорту..."
            });
        }

        if (this.dimension === 'nether') {
            for (let dx = -3; dx <= 5; dx++) {
                for (let dz = -3; dz <= 5; dz++) {
                    this.setBlock(dx, 6, dz, BLOCK_TYPES.NETHER_BRICKS);
                    for (let y = 7; y <= 13; y++) this.setBlock(dx, y, dz, BLOCK_TYPES.AIR);
                    if ((dx === -3 || dx === 5) && (dz === -3 || dz === 5)) {
                        this.setBlock(dx, 7, dz, BLOCK_TYPES.GLOWSTONE);
                    }
                }
            }
            this.buildNetherPortal(0, 7, 0);
        } else if (this.dimension === 'the_end') {
            const pillarPositions = [
                [15, 0], [-15, 0], [0, 15], [0, -15],
                [11, 11], [-11, -11], [11, -11], [-11, 11]
            ];
            for (let pos of pillarPositions) this.buildObsidianPillar(pos[0], pos[1]);
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    this.setBlock(dx, 13, 18 + dz, BLOCK_TYPES.OBSIDIAN);
                    for (let dy = 1; dy <= 4; dy++) this.setBlock(dx, 13 + dy, 18 + dz, BLOCK_TYPES.AIR);
                }
            }
            this.buildEndExitFountain(0, 14, 0);
        } else {
            if (!this.arenaMap && !this.getBuiltinMap() && this.worldType !== 'race_track' && this.worldType !== 'highway_city') {
                let portalY = 12;
                for (let y = CHUNK_SIZE_Y - 4; y >= 2; y--) {
                    if (this.getBlock(8, y, 8) !== BLOCK_TYPES.AIR) {
                        portalY = y + 1;
                        break;
                    }
                }
                this.buildNetherPortal(8, portalY, 8);
                this.buildStarterVillage();
            }
        }

        await new Promise(res => setTimeout(res, 15));

        this.restoreLoadedEdits();

        // Stage 3: Rebuild all dirty meshes (including chunks modified by structures)
        if (onProgress) {
            onProgress({
                percent: 95,
                current: totalChunks,
                total: totalChunks,
                stage: "Побудова мешів та оптимізація освітлення..."
            });
        }
        for (let key in this.chunks) {
            const chunk = this.chunks[key];
            if (chunk && chunk.isDirty && chunk.isGenerated) {
                chunk.rebuildMesh(this.textureManager);
                chunk.isDirty = false;
            }
        }

        this.isGeneratingTerrain = false;
        this.trackModifications = true;
        this.worldPreloaded = true;

        // Stage 4: 100% Ready!
        if (onProgress) {
            onProgress({
                percent: 100,
                current: totalChunks,
                total: totalChunks,
                stage: "100% — Світ готовий! Заходимо у гру..."
            });
        }
        await new Promise(res => setTimeout(res, 160));
    }

    update(playerX, playerZ, dt = 0.016) {
        // Run cellular automaton water physics
        this.updateWaterPhysics(dt);

        if (this.dimension === 'the_end') return; // Focused boss arena

        const curCX = Math.floor(playerX / CHUNK_SIZE_X);
        const curCZ = Math.floor(playerZ / CHUNK_SIZE_Z);

        const r = this.chunkRadius;

        // 1. Center chunk shift detection
        if (this.lastCenterCX !== curCX || this.lastCenterCZ !== curCZ) {
            this.lastCenterCX = curCX;
            this.lastCenterCZ = curCZ;

            // Enqueue missing chunks around player sorted by distance to player
            this.chunkGenQueue = [];
            for (let cx = curCX - r; cx <= curCX + r; cx++) {
                for (let cz = curCZ - r; cz <= curCZ + r; cz++) {
                    const key = this.getChunkKey(cx, cz);
                    const ch = this.chunks[key];
                    if (!ch || !ch.isGenerated) {
                        const distSq = (cx - curCX) * (cx - curCX) + (cz - curCZ) * (cz - curCZ);
                        this.chunkGenQueue.push({ cx, cz, distSq });
                    }
                }
            }
            this.chunkGenQueue.sort((a, b) => a.distSq - b.distSq);

            // 2. Unload far chunks with HYSTERESIS (r + 2) to eliminate boundary thrashing and stutter
            const maxDist = r + 2;
            let unloadsLeft = 3; // Smooth disposal budget to prevent GC pauses
            for (let key in this.chunks) {
                const chunk = this.chunks[key];
                if (Math.abs(chunk.cx - curCX) > maxDist || Math.abs(chunk.cz - curCZ) > maxDist) {
                    chunk.dispose();
                    delete this.chunks[key];
                    if (--unloadsLeft <= 0) break;
                }
            }
        }

        // 3. Strict Frame-Budgeted Chunk Generation & Meshing:
        // Priority 1: Mesh 1 dirty chunk closest to player (if generated)
        let closestDirty = null;
        let closestDistSq = Infinity;
        for (let key in this.chunks) {
            const chunk = this.chunks[key];
            if (chunk.isDirty && chunk.isGenerated) {
                const distSq = (chunk.cx - curCX) * (chunk.cx - curCX) + (chunk.cz - curCZ) * (chunk.cz - curCZ);
                if (distSq < closestDistSq) {
                    closestDistSq = distSq;
                    closestDirty = chunk;
                }
            }
        }

        if (closestDirty) {
            closestDirty.rebuildMesh(this.textureManager);
            return; // Frame budget satisfied, meshing completed
        }

        // Priority 2: Generate at most 1 chunk from queue and mark it dirty
        while (this.chunkGenQueue && this.chunkGenQueue.length > 0) {
            const nextItem = this.chunkGenQueue.shift();
            const key = this.getChunkKey(nextItem.cx, nextItem.cz);
            let chunk = this.chunks[key];
            if (!chunk || !chunk.isGenerated) {
                chunk = this.generateSingleChunk(nextItem.cx, nextItem.cz);
                chunk.isDirty = true;
                break;
            }
        }
    }

    generateEndTerrain() {
        const r = this.chunkRadius;
        for (let cx = -r; cx <= r; cx++) {
            for (let cz = -r; cz <= r; cz++) {
                const chunk = this.getOrCreateChunk(cx, cz);
                const worldX0 = cx * CHUNK_SIZE_X;
                const worldZ0 = cz * CHUNK_SIZE_Z;

                for (let x = 0; x < CHUNK_SIZE_X; x++) {
                    for (let z = 0; z < CHUNK_SIZE_Z; z++) {
                        const wx = worldX0 + x;
                        const wz = worldZ0 + z;
                        const distToCenter = Math.sqrt(wx * wx + wz * wz);

                        // Central floating island of End Stone
                        const islandRadius = 26;
                        if (distToCenter < islandRadius) {
                            const n = this.noise.noise2D(wx * 0.08, wz * 0.08);
                            const edgeFalloff = 1 - (distToCenter / islandRadius);
                            const thickness = Math.max(0, Math.floor((5 + n * 4) * edgeFalloff));
                            const topY = 14 + Math.floor(n * 2);

                            for (let y = Math.max(1, topY - thickness); y <= topY; y++) {
                                chunk.setBlock(x, y, z, BLOCK_TYPES.END_STONE);
                            }
                        }
                    }
                }
            }
        }

        // Build Obsidian Pillars with End Crystals on top
        const pillarPositions = [
            [15, 0], [-15, 0], [0, 15], [0, -15],
            [11, 11], [-11, -11], [11, -11], [-11, 11]
        ];

        for (let pos of pillarPositions) {
            this.buildObsidianPillar(pos[0], pos[1]);
        }

        // Dedicated Safe Obsidian Spawn Platform in The End at (0, 14, 18)
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                this.setBlock(dx, 13, 18 + dz, BLOCK_TYPES.OBSIDIAN);
                for (let dy = 1; dy <= 4; dy++) {
                    this.setBlock(dx, 13 + dy, 18 + dz, BLOCK_TYPES.AIR);
                }
            }
        }

        // Center Exit Portal Fountain
        this.buildEndExitFountain(0, 14, 0);
    }

    buildNetherPortal(px, py, pz) {
        // 4 wide, 5 high obsidian frame
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 5; y++) {
                const isBorder = (x === 0 || x === 3 || y === 0 || y === 4);
                this.setBlock(px + x, py + y, pz, isBorder ? BLOCK_TYPES.OBSIDIAN : BLOCK_TYPES.PORTAL_NETHER);
            }
        }
    }

    buildObsidianPillar(px, pz) {
        const pillarHeight = 10 + Math.floor(Math.random() * 5);
        for (let y = 10; y <= 10 + pillarHeight; y++) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    this.setBlock(px + dx, y, pz + dz, BLOCK_TYPES.OBSIDIAN);
                }
            }
        }
        // Spawn End Crystal on top
        if (window.game && window.game.mobManager) {
            window.game.mobManager.spawnEndCrystal(px, 11 + pillarHeight, pz);
        }
    }

    buildEndExitFountain(px, py, pz) {
        // Bedrock basin under the entire fountain (prevents falling through into void)
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                this.setBlock(px + dx, py - 1, pz + dz, BLOCK_TYPES.BEDROCK);
            }
        }
        // Bedrock rim and center egg pedestal
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                const isBorder = (Math.abs(dx) === 2 || Math.abs(dz) === 2);
                if (isBorder) {
                    this.setBlock(px + dx, py, pz + dz, BLOCK_TYPES.BEDROCK);
                } else if (dx === 0 && dz === 0) {
                    this.setBlock(px, py, pz, BLOCK_TYPES.BEDROCK);
                    this.setBlock(px, py + 1, pz, BLOCK_TYPES.BEDROCK);
                    this.setBlock(px, py + 2, pz, BLOCK_TYPES.DRAGON_EGG);
                } else {
                    // Open portal
                    this.setBlock(px + dx, py, pz + dz, BLOCK_TYPES.PORTAL_END);
                }
            }
        }
    }

    activateEndExitPortal(px = 0, py = 14, pz = 0) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx !== 0 || dz !== 0) {
                    this.setBlock(px + dx, py, pz + dz, BLOCK_TYPES.PORTAL_END);
                }
            }
        }
        this.updateMeshes();
    }

    switchDimension(newDimension) {
        const sc = this.game && this.game.serverClient;
        if (sc && sc.currentRoom && sc.currentRoom.startsWith('coop_') && newDimension !== 'overworld') {
            sc.leaveRoom();
            if (this.game.ui) this.game.ui.showToast('Вихід зі спільної кімнати для подорожі в інший вимір.');
        }
        if (this.arenaMap) return Promise.resolve();
        if ((this.dimension || 'overworld') === newDimension) return Promise.resolve();
        this.rememberDimension();
        this.dimension = newDimension;
        const savedState = this.dimensionStates.get(newDimension);
        this.modifiedBlocks = savedState ? savedState.modifiedBlocks : new Map();
        this.activeWaterBlocks.clear();
        this.blockHistory.clear();
        this.chunkGenQueue = [];
        this.starterVillageBuilt = false;
        this.worldPreloaded = false;
        if (newDimension === 'race_track' || newDimension === 'highway_city') {
            this.worldType = newDimension;
        } else if (newDimension === 'overworld' && (this.worldType === 'race_track' || this.worldType === 'highway_city')) {
            this.worldType = 'normal';
        }

        if (savedState) this.worldType = savedState.worldType;

        // Dispose the previous dimension before regenerating the destination.
        this.clearWorld();

        // Clear mobs and drops
        if (window.game && window.game.mobManager) {
            window.game.mobManager.clearAll();
        }

        // Update sky and fog in Game
        if (window.game) {
            const scene = window.game.scene;
            if (newDimension === 'nether') {
                const col = new THREE.Color(0x350606);
                scene.background = col;
                scene.fog.color = col;
                scene.fog.density = 0.035;
                if (window.game.ambientLight) window.game.ambientLight.color.setHex(0xff4422);
            } else if (newDimension === 'the_end') {
                const col = new THREE.Color(0x080410);
                scene.background = col;
                scene.fog.color = col;
                scene.fog.density = 0.018;
                if (window.game.ambientLight) window.game.ambientLight.color.setHex(0x9955cc);
            } else if (newDimension === 'race_track') {
                const col = new THREE.Color(0x6eb7ff);
                scene.background = col;
                scene.fog.color = col;
                scene.fog.density = 0.008;
                if (window.game.ambientLight) window.game.ambientLight.color.setHex(0xffffff);
            } else if (newDimension === 'highway_city') {
                const col = new THREE.Color(0x8cb5d9);
                scene.background = col;
                scene.fog.color = col;
                scene.fog.density = 0.012;
                if (window.game.ambientLight) window.game.ambientLight.color.setHex(0xf0f0f0);
            } else {
                const col = new THREE.Color(0x80bfff);
                scene.background = col;
                scene.fog.color = col;
                scene.fog.density = 0.018;
                if (window.game.ambientLight) window.game.ambientLight.color.setHex(0xffffff);
            }
        }

        // Regenerate terrain with preloader if available
        const ui = (this.game && this.game.ui) || (window.game && window.game.ui);
        let loading = Promise.resolve();
        if (ui && ui.showPreloader) {
            const title = newDimension === 'nether' ? "ПЕРЕХІД У НЕЗЕР" :
                          newDimension === 'the_end' ? "ПЕРЕХІД В ЕНД" :
                          newDimension === 'race_track' ? "🏎️ ГОНОЧНИЙ ТРЕК F1" :
                          newDimension === 'highway_city' ? "🏙️ ШОСЕ ТА МІСТО" : "ВЕРХНІЙ СВІТ";
            ui.showPreloader(title, "Preloading dimension chunks...");
            loading = this.preloadChunksAsync((info) => ui.updatePreloader(info)).then(async () => {
                if (window.game && window.game.player) {
                    window.game.player.spawnSafe();
                }
                this.spawnCarMapVehicles(newDimension);
                await ui.hidePreloader();
            });
        } else {
            const prevTrack = this.trackModifications;
            const prevGenerating = this.isGeneratingTerrain;
            this.trackModifications = false;
            this.isGeneratingTerrain = true;
            try {
                this.generateTerrain();
                this.restoreLoadedEdits();
                this.updateMeshes();
            } finally {
                this.trackModifications = prevTrack;
                this.isGeneratingTerrain = prevGenerating;
            }
            if (window.game && window.game.player) {
                window.game.player.spawnSafe();
            }
            this.spawnCarMapVehicles(newDimension);
        }

        // Spawn Eblan Dragon Boss if entering End!
        if (newDimension === 'the_end' && window.game && window.game.mobManager) {
            window.game.mobManager.spawnDragon();
        }

        // Toast and meme speech
        if (window.game && window.game.soundManager) {
            window.game.soundManager.playPortalWarp();
            const speech = newDimension === 'nether' ? "Ласкаво просимо в Незер, тут гаряче!" :
                           newDimension === 'the_end' ? "Це Енд! Бережи сраку від дракона!" :
                           newDimension === 'race_track' ? "Газ до відказу! Формула 1 чекає!" :
                           newDimension === 'highway_city' ? "Міські гонки починаються!" :
                           "Повернення у Верхній Світ!";
            window.game.soundManager.speakRandomMeme([speech]);
        }
        if (window.game && window.game.ui) {
            window.game.ui.showToast(newDimension === 'nether' ? "🔥 ПЕРЕХІД У НЕЗЕР" :
                                     newDimension === 'the_end' ? "🌌 ПЕРЕХІД В ЕНД (ДРАКОН!)" :
                                     newDimension === 'race_track' ? "🏎️ ГОНОЧНИЙ ТРЕК F1" :
                                     newDimension === 'highway_city' ? "🏙️ ШОСЕ ТА МІСТО" :
                                     "🌲 ПЕРЕХІД У ВЕРХНІЙ СВІТ");
        }
        return loading;
    }

    spawnCarMapVehicles(dimension) {
        const vMgr = (window.modManager && window.modManager.vehicleManager) ||
                     (this.game && this.game.vehicleManager) ||
                     (window.game && window.game.vehicleManager);
        if (!vMgr) return;

        if (dimension === 'race_track' || this.worldType === 'race_track') {
            setTimeout(() => {
                vMgr.spawnVehicle('f1', 2, 5.0, 0);
                vMgr.spawnVehicle('f1', -2, 5.0, 0);
                vMgr.spawnVehicle('bicycle', 4, 5.0, -4);
                vMgr.spawnVehicle('car', -4, 5.0, -4);
                if (this.game && this.game.ui) {
                    this.game.ui.showToast("🏎️ Боліди F1 та велосипеди припарковані на старті!");
                }
            }, 350);
        } else if (dimension === 'highway_city' || this.worldType === 'highway_city') {
            setTimeout(() => {
                vMgr.spawnVehicle('car', 0, 5.0, 2);
                vMgr.spawnVehicle('f1', 3, 5.0, -5);
                vMgr.spawnVehicle('bicycle', -3, 5.0, 4);
                if (this.game && this.game.ui) {
                    this.game.ui.showToast("🏙️ Машини та велосипеди готові на шосе!");
                }
            }, 350);
        }
    }

    generateTrees() {
        const r = this.chunkRadius;
        for (let cx = -r; cx <= r; cx++) {
            for (let cz = -r; cz <= r; cz++) {
                const worldX0 = cx * CHUNK_SIZE_X;
                const worldZ0 = cz * CHUNK_SIZE_Z;

                for (let x = 3; x < CHUNK_SIZE_X - 3; x += 4) {
                    for (let z = 3; z < CHUNK_SIZE_Z - 3; z += 4) {
                        const wx = worldX0 + x;
                        const wz = worldZ0 + z;
                        const treeProb = this.noise.noise2D(wx * 0.3 + 100, wz * 0.3 + 100);

                        if (treeProb > 0.35) {
                            // Find ground height
                            for (let y = CHUNK_SIZE_Y - 8; y >= this.waterLevel + 2; y--) {
                                if (this.getBlock(wx, y, wz) === BLOCK_TYPES.GRASS) {
                                    this.plantTree(wx, y + 1, wz);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    plantTreeInChunk(chunk, cx_local, wy, cz_local, treeType = 'oak') {
        let trunkBlock = BLOCK_TYPES.WOOD;
        let leafBlock = BLOCK_TYPES.LEAVES;
        let treeHeight = 4 + Math.floor(((cx_local * 31 + cz_local * 17) % 2));

        if (treeType === 'birch') {
            trunkBlock = BLOCK_TYPES.BIRCH_WOOD;
            leafBlock = BLOCK_TYPES.BIRCH_LEAVES;
            treeHeight = 5 + Math.floor(((cx_local * 23 + cz_local * 19) % 2));
        } else if (treeType === 'spruce' || treeType === 'snowy_spruce') {
            trunkBlock = BLOCK_TYPES.SPRUCE_WOOD;
            leafBlock = BLOCK_TYPES.SPRUCE_LEAVES;
            treeHeight = 6 + Math.floor(((cx_local * 19 + cz_local * 29) % 3));
        } else if (treeType === 'jungle') {
            trunkBlock = BLOCK_TYPES.JUNGLE_WOOD;
            leafBlock = BLOCK_TYPES.JUNGLE_LEAVES;
            treeHeight = 7 + Math.floor(((cx_local * 13 + cz_local * 37) % 3));
        }

        if (wy + treeHeight + 2 >= CHUNK_SIZE_Y) return;

        // Trunk
        for (let y = 0; y < treeHeight; y++) {
            chunk.setBlock(cx_local, wy + y, cz_local, trunkBlock);
        }

        if (treeType === 'spruce' || treeType === 'snowy_spruce') {
            // Conical pine/spruce shape: wide at bottom, tapering to a pointed tip
            for (let ly = wy + 2; ly <= wy + treeHeight + 1; ly++) {
                const distFromTop = (wy + treeHeight + 1) - ly;
                const rad = distFromTop === 0 ? 0 : (distFromTop % 2 === 1 ? 2 : 1);
                for (let dx = -rad; dx <= rad; dx++) {
                    const lx = cx_local + dx;
                    if (lx < 0 || lx >= CHUNK_SIZE_X) continue;
                    for (let dz = -rad; dz <= rad; dz++) {
                        const lz = cz_local + dz;
                        if (lz < 0 || lz >= CHUNK_SIZE_Z) continue;
                        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                        if (chunk.getBlock(lx, ly, lz) === BLOCK_TYPES.AIR) {
                            chunk.setBlock(lx, ly, lz, leafBlock);
                            if (treeType === 'snowy_spruce' && ly + 1 < CHUNK_SIZE_Y && chunk.getBlock(lx, ly + 1, lz) === BLOCK_TYPES.AIR) {
                                chunk.setBlock(lx, ly + 1, lz, BLOCK_TYPES.SNOW);
                            }
                        }
                    }
                }
            }
            if (wy + treeHeight + 2 < CHUNK_SIZE_Y && chunk.getBlock(cx_local, wy + treeHeight + 2, cz_local) === BLOCK_TYPES.AIR) {
                chunk.setBlock(cx_local, wy + treeHeight + 2, cz_local, leafBlock);
                if (treeType === 'snowy_spruce' && wy + treeHeight + 3 < CHUNK_SIZE_Y) {
                    chunk.setBlock(cx_local, wy + treeHeight + 3, cz_local, BLOCK_TYPES.SNOW);
                }
            }
            return;
        }

        // Standard / Rounded canopy (Oak, Birch, Jungle, Swamp)
        const leafBase = wy + treeHeight - 2;
        const maxRad = (treeType === 'jungle' || treeType === 'swamp') ? 3 : 2;
        for (let ly = leafBase; ly <= wy + treeHeight + 1; ly++) {
            const rad = (ly >= wy + treeHeight) ? 1 : maxRad;
            for (let dx = -rad; dx <= rad; dx++) {
                const lx = cx_local + dx;
                if (lx < 0 || lx >= CHUNK_SIZE_X) continue;
                for (let dz = -rad; dz <= rad; dz++) {
                    const lz = cz_local + dz;
                    if (lz < 0 || lz >= CHUNK_SIZE_Z) continue;
                    if (rad >= 2 && Math.abs(dx) === rad && Math.abs(dz) === rad && ((lx * 13 + lz * 7 + ly) % 3 === 0)) continue;
                    if (chunk.getBlock(lx, ly, lz) === BLOCK_TYPES.AIR) {
                        chunk.setBlock(lx, ly, lz, leafBlock);
                    }
                }
            }
        }
    }

    plantTree(wx, wy, wz) {
        const treeHeight = 4 + Math.floor(Math.random() * 2);
        if (wy + treeHeight + 2 >= CHUNK_SIZE_Y) return;

        // Trunk
        for (let y = 0; y < treeHeight; y++) {
            this.setBlock(wx, wy + y, wz, BLOCK_TYPES.WOOD);
        }

        // Leaves canopy
        const leafBase = wy + treeHeight - 2;
        for (let ly = leafBase; ly <= wy + treeHeight + 1; ly++) {
            const rad = ly >= wy + treeHeight ? 1 : 2;
            for (let lx = -rad; lx <= rad; lx++) {
                for (let lz = -rad; lz <= rad; lz++) {
                    if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && Math.random() > 0.4) continue;
                    if (this.getBlock(wx + lx, ly, wz + lz) === BLOCK_TYPES.AIR) {
                        this.setBlock(wx + lx, ly, wz + lz, BLOCK_TYPES.LEAVES);
                    }
                }
            }
        }
    }

    initWorld() {
        this.invalidateChunkCache();
        this.isGeneratingTerrain = true;
        this.generateTerrain();
        this.updateMeshes(true);
        this.isGeneratingTerrain = false;
    }

    updateMeshes(forceAll = false) {
        for (let key in this.chunks) {
            const chunk = this.chunks[key];
            if (forceAll) chunk.isDirty = true;
            if (chunk.isDirty && chunk.isGenerated) {
                chunk.rebuildMesh(this.textureManager);
            }
        }
    }

    // Save world state to JSON string
    exportJSON() {
        if (this.arenaMap && this.game?.arenaClient?.savedSession) {
            return this.game.arenaClient.savedSession.world.exportJSON();
        }
        this.rememberDimension();
        const dimensionStates = {};
        for (const [dimension, state] of this.dimensionStates) {
            dimensionStates[dimension] = {
                worldType: state.worldType,
                modifiedBlocks: Array.from(state.modifiedBlocks, ([key, type]) => {
                    const [x, y, z] = key.split(',').map(Number);
                    return { x, y, z, type };
                })
            };
        }
        const data = {
            dimension: this.dimension || 'overworld',
            dimensionStates,
            seed: this.seed,
            worldType: this.worldType,
            chunkRadius: this.chunkRadius,
            modifiedBlocks: this.getModifiedBlocksArray(),
            customBlocks: []
        };
        // Save modified blocks
        for (let key in this.chunks) {
            const chunk = this.chunks[key];
            for (let i = 0; i < chunk.voxels.length; i++) {
                const b = chunk.voxels[i];
                if (b !== BLOCK_TYPES.AIR) {
                    const x = i % CHUNK_SIZE_X;
                    const y = Math.floor(i / CHUNK_SIZE_X) % CHUNK_SIZE_Y;
                    const z = Math.floor(i / (CHUNK_SIZE_X * CHUNK_SIZE_Y));
                    const wx = chunk.cx * CHUNK_SIZE_X + x;
                    const wz = chunk.cz * CHUNK_SIZE_Z + z;
                    data.customBlocks.push([wx, y, wz, b]);
                }
            }
        }
        return JSON.stringify(data);
    }

    // Load world state from JSON
    importJSON(jsonString) {
        if (this.arenaMap) return;
        try {
            const data = JSON.parse(jsonString);
            this.seed = data.seed || 1337;
            this.worldType = data.worldType || 'normal';
            this.dimension = data.dimension || 'overworld';
            this.dimensionStates = new Map();
            for (const [dimension, state] of Object.entries(data.dimensionStates || {})) {
                if (!Array.isArray(state.modifiedBlocks)) continue;
                this.dimensionStates.set(dimension, {
                    worldType: state.worldType || 'normal',
                    modifiedBlocks: new Map(state.modifiedBlocks.map(b => [`${b.x},${b.y},${b.z}`, b.type]))
                });
            }
            this.noise = new PerlinNoise(this.seed);
            if (window.EblanEng) window.EblanEng.setSeed(this.seed);
            this.clearWorld();
            this.modifiedBlocks = new Map();
            this.blockHistory.clear();
            this.activeWaterBlocks.clear();
            this.chunkGenQueue = [];
            this.starterVillageBuilt = false;
            this.worldPreloaded = false;

            const prevTrack = this.trackModifications;
            const prevGenerating = this.isGeneratingTerrain;
            this.trackModifications = false;
            this.isGeneratingTerrain = true;
            try {
                this.generateTerrain();

                // Keep loading legacy snapshots; newer saves also preserve AIR edits.
                if (data.customBlocks && Array.isArray(data.customBlocks)) {
                    for (let b of data.customBlocks) {
                        const previous = this.getBlock(b[0], b[1], b[2]);
                        this.setBlock(b[0], b[1], b[2], b[3]);
                        if (previous !== b[3]) this.modifiedBlocks.set(`${b[0]},${b[1]},${b[2]}`, b[3]);
                    }
                }
                this.applyModifiedBlocks(data.modifiedBlocks);
                this.rememberDimension();
                this.updateMeshes();
            } finally {
                this.trackModifications = prevTrack;
                this.isGeneratingTerrain = prevGenerating;
            }
        } catch (e) {
            console.error("Failed to import world:", e);
        }
    }

    // Generate a complete procedural village with houses, well, farm, tech lab and villagers
    buildVillage(centerX, centerY, centerZ, spawnVillagers = true) {
        const cx = Math.floor(centerX);
        const cy = Math.floor(centerY);
        const cz = Math.floor(centerZ);

        const prevGen = this.isGeneratingTerrain;
        const prevTrack = this.trackModifications;
        this.isGeneratingTerrain = true;
        this.trackModifications = false;

        const safeSet = (x, y, z, type) => {
            if (y < 0 || y >= CHUNK_SIZE_Y) return;
            this.setBlock(x, y, z, type);
        };

        const safeFill = (x1, y1, z1, x2, y2, z2, type) => {
            const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
            const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    for (let z = minZ; z <= maxZ; z++) {
                        safeSet(x, y, z, type);
                    }
                }
            }
        };

        const px = cx - 7, pz = cz;
        try {
            // 1. Gravel Pathways
            safeFill(cx - 12, cy, cz - 1, cx + 12, cy, cz + 1, BLOCK_TYPES.GRAVEL);
            safeFill(cx - 1, cy, cz - 12, cx + 1, cy, cz + 1, BLOCK_TYPES.GRAVEL);
            // Clear air above roads
            safeFill(cx - 12, cy + 1, cz - 1, cx + 12, cy + 4, cz + 1, BLOCK_TYPES.AIR);
            safeFill(cx - 1, cy + 1, cz - 12, cx + 1, cy + 4, cz + 12, BLOCK_TYPES.AIR);

            // 2. Village Well (Center)
            safeFill(cx - 2, cy, cz - 2, cx + 2, cy, cz + 2, BLOCK_TYPES.COBBLESTONE);
            safeFill(cx - 1, cy - 1, cz - 1, cx + 1, cy, cz + 1, BLOCK_TYPES.WATER);
            // Well posts
            for (let dy = 1; dy <= 3; dy++) {
                safeSet(cx - 2, cy + dy, cz - 2, BLOCK_TYPES.WOOD);
                safeSet(cx + 2, cy + dy, cz - 2, BLOCK_TYPES.WOOD);
                safeSet(cx - 2, cy + dy, cz + 2, BLOCK_TYPES.WOOD);
                safeSet(cx + 2, cy + dy, cz + 2, BLOCK_TYPES.WOOD);
            }
            // Well roof
            safeFill(cx - 2, cy + 4, cz - 2, cx + 2, cy + 4, cz + 2, BLOCK_TYPES.PLANKS);
            safeSet(cx, cy + 5, cz, BLOCK_TYPES.COBBLESTONE);

            // 3. Cottage House (East: cx + 6)
            const h1x = cx + 6, h1z = cz;
            safeFill(h1x - 3, cy, h1z - 3, h1x + 3, cy, h1z + 3, BLOCK_TYPES.COBBLESTONE);
            safeFill(h1x - 2, cy, h1z - 2, h1x + 2, cy, h1z + 2, BLOCK_TYPES.PLANKS);
            safeFill(h1x - 2, cy + 1, h1z - 2, h1x + 2, cy + 3, h1z + 2, BLOCK_TYPES.AIR);
            for (let y = cy + 1; y <= cy + 3; y++) {
                safeSet(h1x - 3, y, h1z - 3, BLOCK_TYPES.WOOD);
                safeSet(h1x + 3, y, h1z - 3, BLOCK_TYPES.WOOD);
                safeSet(h1x - 3, y, h1z + 3, BLOCK_TYPES.WOOD);
                safeSet(h1x + 3, y, h1z + 3, BLOCK_TYPES.WOOD);
                for (let x = h1x - 2; x <= h1x + 2; x++) {
                    safeSet(x, y, h1z - 3, BLOCK_TYPES.PLANKS);
                    safeSet(x, y, h1z + 3, BLOCK_TYPES.PLANKS);
                }
                for (let z = h1z - 2; z <= h1z + 2; z++) {
                    safeSet(h1x - 3, y, z, BLOCK_TYPES.PLANKS);
                    safeSet(h1x + 3, y, z, BLOCK_TYPES.PLANKS);
                }
            }
            safeSet(h1x + 3, cy + 2, h1z - 1, BLOCK_TYPES.GLASS);
            safeSet(h1x + 3, cy + 2, h1z + 1, BLOCK_TYPES.GLASS);
            safeSet(h1x, cy + 2, h1z + 3, BLOCK_TYPES.GLASS);
            safeSet(h1x - 3, cy + 1, h1z, BLOCK_TYPES.AIR);
            safeSet(h1x - 3, cy + 2, h1z, BLOCK_TYPES.AIR);
            safeFill(h1x - 3, cy + 4, h1z - 3, h1x + 3, cy + 4, h1z + 3, BLOCK_TYPES.PLANKS);
            safeFill(h1x - 2, cy + 5, h1z - 2, h1x + 2, cy + 5, h1z + 2, BLOCK_TYPES.WOOD);
            safeSet(h1x + 2, cy + 1, h1z - 2, BLOCK_TYPES.CRAFTING_TABLE);
            safeSet(h1x + 2, cy + 1, h1z - 1, BLOCK_TYPES.BOOKSHELF);
            safeSet(h1x, cy + 3, h1z, BLOCK_TYPES.REDSTONE_LAMP_ON);

            // 4. Tech House with Computer (North: cz + 6)
            const h2x = cx, h2z = cz + 6;
            safeFill(h2x - 3, cy, h2z - 3, h2x + 3, cy, h2z + 3, BLOCK_TYPES.COBBLESTONE);
            safeFill(h2x - 2, cy, h2z - 2, h2x + 2, cy, h2z + 2, BLOCK_TYPES.PLANKS);
            safeFill(h2x - 2, cy + 1, h2z - 2, h2x + 2, cy + 3, h2z + 2, BLOCK_TYPES.AIR);
            for (let y = cy + 1; y <= cy + 3; y++) {
                safeSet(h2x - 3, y, h2z - 3, BLOCK_TYPES.WOOD);
                safeSet(h2x + 3, y, h2z - 3, BLOCK_TYPES.WOOD);
                safeSet(h2x - 3, y, h2z + 3, BLOCK_TYPES.WOOD);
                safeSet(h2x + 3, y, h2z + 3, BLOCK_TYPES.WOOD);
                for (let x = h2x - 2; x <= h2x + 2; x++) {
                    safeSet(x, y, h2z - 3, BLOCK_TYPES.PLANKS);
                    safeSet(x, y, h2z + 3, BLOCK_TYPES.PLANKS);
                }
                for (let z = h2z - 2; z <= h2z + 2; z++) {
                    safeSet(h2x - 3, y, z, BLOCK_TYPES.PLANKS);
                    safeSet(h2x + 3, y, z, BLOCK_TYPES.PLANKS);
                }
            }
            safeSet(h2x + 3, cy + 2, h2z, BLOCK_TYPES.GLASS);
            safeSet(h2x - 3, cy + 2, h2z, BLOCK_TYPES.GLASS);
            safeSet(h2x, cy + 1, h2z - 3, BLOCK_TYPES.AIR);
            safeSet(h2x, cy + 2, h2z - 3, BLOCK_TYPES.AIR);
            safeFill(h2x - 3, cy + 4, h2z - 3, h2x + 3, cy + 4, h2z + 3, BLOCK_TYPES.PLANKS);
            safeFill(h2x - 2, cy + 5, h2z - 2, h2x + 2, cy + 5, h2z + 2, BLOCK_TYPES.WOOD);

            // Computer Lab Setup
            safeSet(h2x, cy + 1, h2z + 2, BLOCK_TYPES.PLANKS);
            safeSet(h2x, cy + 2, h2z + 2, BLOCK_TYPES.COMPUTER);
            safeSet(h2x - 1, cy + 1, h2z + 2, BLOCK_TYPES.BOOKSHELF);
            safeSet(h2x + 1, cy + 1, h2z + 2, BLOCK_TYPES.BOOKSHELF);
            safeSet(h2x + 2, cy + 1, h2z - 2, BLOCK_TYPES.LEVER);
            safeSet(h2x + 2, cy + 1, h2z - 1, BLOCK_TYPES.REDSTONE_WIRE);
            safeSet(h2x, cy + 3, h2z, BLOCK_TYPES.REDSTONE_LAMP_ON);

            // 5. Farm Plot (South: cz - 6)
            const fz = cz - 6;
            safeFill(cx - 3, cy, fz - 3, cx + 3, cy, fz + 3, BLOCK_TYPES.WOOD);
            safeFill(cx - 2, cy, fz - 2, cx + 2, cy, fz + 2, BLOCK_TYPES.DIRT);
            safeFill(cx - 2, cy + 1, fz - 2, cx + 2, cy + 2, fz + 2, BLOCK_TYPES.AIR);
            safeSet(cx, cy, fz, BLOCK_TYPES.WATER);
            safeSet(cx - 1, cy + 1, fz - 1, BLOCK_TYPES.YELLOW_FLOWER);
            safeSet(cx + 1, cy + 1, fz - 1, BLOCK_TYPES.RED_FLOWER);
            safeSet(cx - 1, cy + 1, fz + 1, BLOCK_TYPES.YELLOW_FLOWER);
            safeSet(cx + 1, cy + 1, fz + 1, BLOCK_TYPES.RED_FLOWER);

            // 6. Street Lamp Posts
            const makeLamp = (lx, lz) => {
                safeSet(lx, cy + 1, lz, BLOCK_TYPES.COBBLESTONE);
                safeSet(lx, cy + 2, lz, BLOCK_TYPES.WOOD);
                safeSet(lx, cy + 3, lz, BLOCK_TYPES.WOOD);
                safeSet(lx, cy + 4, lz, BLOCK_TYPES.REDSTONE_LAMP_ON);
            };
            makeLamp(cx + 4, cz + 2);
            makeLamp(cx - 4, cz - 2);

            // 7. Village Parking Lot & Naturally Parked Car (West: cx - 7)
            safeFill(px - 3, cy, pz - 2, px + 3, cy, pz + 2, BLOCK_TYPES.GRAVEL);
            safeFill(px - 3, cy + 1, pz - 2, px + 3, cy + 3, pz + 2, BLOCK_TYPES.AIR);
            safeSet(px - 3, cy + 1, pz + 2, BLOCK_TYPES.COBBLESTONE);
            safeSet(px - 3, cy + 2, pz + 2, BLOCK_TYPES.REDSTONE_TORCH);
        } finally {
            this.isGeneratingTerrain = prevGen;
            this.trackModifications = prevTrack;
        }

        // Mark only overlapping chunks dirty for smooth budgeted meshing
        const minCX = (cx - 14) >> 4, maxCX = (cx + 14) >> 4;
        const minCZ = (cz - 14) >> 4, maxCZ = (cz + 14) >> 4;
        for (let cxx = minCX; cxx <= maxCX; cxx++) {
            for (let czz = minCZ; czz <= maxCZ; czz++) {
                const c = this.getChunk(cxx, czz);
                if (c) c.isDirty = true;
            }
        }

        // Spawn parked vehicle in the village!
        const villageCarTypes = ['sport', 'police', 'cyber', 'truck'];
        const chosenCar = villageCarTypes[Math.abs(Math.floor(cx + cz)) % villageCarTypes.length];
        this.spawnWorldVehicle(px, cy + 1.2, pz, chosenCar, 0);

        // 8. Spawn Villagers
        const mobMgr = (this.game && this.game.mobManager) || (window.game && window.game.mobManager);
        if (spawnVillagers && mobMgr) {
            setTimeout(() => {
                mobMgr.spawnMob('villager', cx + 6, cy + 1, cz);
                mobMgr.spawnMob('villager', cx, cy + 1, cz + 6);
                mobMgr.spawnMob('villager', cx - 2, cy + 1, cz - 5);
                mobMgr.spawnMob('villager', cx + 1, cy + 1, cz + 2);
            }, 300);
        }
    }

    spawnWorldVehicle(x, y, z, modelType = 'sport', yaw = 0) {
        const vMgr = (this.game && this.game.vehicleManager) ||
                     (this.game && this.game.modManager && this.game.modManager.vehicleManager) ||
                     (window.modManager && window.modManager.vehicleManager);
        if (vMgr) {
            vMgr.spawn(modelType, x, y, z, { yaw: yaw });
        }
    }

    // Natural Generation Check for Villages, Outposts with Computers, and Wild Cars
    checkNaturalStructures(chunk, cx, cz) {
        // Disabled dynamic repetitive structure/car generation during chunk streaming to eliminate lag!
        // Only the guaranteed starter village near spawn is generated at world initialization.
        return;
    }

        // Build a natural retro computer lab / hacker outpost in the wilderness
    buildComputerOutpost(centerX, centerY, centerZ) {
        const cx = Math.floor(centerX);
        const cy = Math.floor(centerY);
        const cz = Math.floor(centerZ);

        const prevGen = this.isGeneratingTerrain;
        const prevTrack = this.trackModifications;
        this.isGeneratingTerrain = true;
        this.trackModifications = false;

        const safeSet = (x, y, z, type) => {
            if (y < 0 || y >= CHUNK_SIZE_Y) return;
            this.setBlock(x, y, z, type);
        };
        const safeFill = (x1, y1, z1, x2, y2, z2, type) => {
            const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
            const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    for (let z = minZ; z <= maxZ; z++) {
                        safeSet(x, y, z, type);
                    }
                }
            }
        };

        try {
            // Foundation & Floor
            safeFill(cx - 3, cy, cz - 3, cx + 3, cy, cz + 3, BLOCK_TYPES.COBBLESTONE);
            safeFill(cx - 2, cy, cz - 2, cx + 2, cy, cz + 2, BLOCK_TYPES.PLANKS);
            safeFill(cx - 2, cy + 1, cz - 2, cx + 2, cy + 3, cz + 2, BLOCK_TYPES.AIR);

            // Walls (Wood corners, Planks walls)
            for (let y = cy + 1; y <= cy + 3; y++) {
                safeSet(cx - 3, y, cz - 3, BLOCK_TYPES.WOOD);
                safeSet(cx + 3, y, cz - 3, BLOCK_TYPES.WOOD);
                safeSet(cx - 3, y, cz + 3, BLOCK_TYPES.WOOD);
                safeSet(cx + 3, y, cz + 3, BLOCK_TYPES.WOOD);
                for (let x = cx - 2; x <= cx + 2; x++) {
                    safeSet(x, y, cz - 3, BLOCK_TYPES.PLANKS);
                    safeSet(x, y, cz + 3, BLOCK_TYPES.PLANKS);
                }
                for (let z = cz - 2; z <= cz + 2; z++) {
                    safeSet(cx - 3, y, z, BLOCK_TYPES.PLANKS);
                    safeSet(cx + 3, y, z, BLOCK_TYPES.PLANKS);
                }
            }

            // Doorway
            safeSet(cx, cy + 1, cz - 3, BLOCK_TYPES.AIR);
            safeSet(cx, cy + 2, cz - 3, BLOCK_TYPES.AIR);

            // Glass Windows
            safeSet(cx - 3, cy + 2, cz, BLOCK_TYPES.GLASS);
            safeSet(cx + 3, cy + 2, cz, BLOCK_TYPES.GLASS);

            // Roof
            safeFill(cx - 3, cy + 4, cz - 3, cx + 3, cy + 4, cz + 3, BLOCK_TYPES.COBBLESTONE);

            // Tech setup inside: COMPUTER, Bookshelves, Lever, Redstone Wire, Lamp
            safeSet(cx, cy + 1, cz + 2, BLOCK_TYPES.PLANKS); // Desk
            safeSet(cx, cy + 2, cz + 2, BLOCK_TYPES.COMPUTER); // Working Retro Computer!
            safeSet(cx - 1, cy + 1, cz + 2, BLOCK_TYPES.BOOKSHELF);
            safeSet(cx + 1, cy + 1, cz + 2, BLOCK_TYPES.BOOKSHELF);
            safeSet(cx + 2, cy + 1, cz, BLOCK_TYPES.LEVER);
            safeSet(cx + 2, cy + 1, cz + 1, BLOCK_TYPES.REDSTONE_WIRE);
            safeSet(cx, cy + 3, cz, BLOCK_TYPES.REDSTONE_LAMP_ON);
            safeSet(cx - 2, cy + 1, cz - 2, BLOCK_TYPES.CRAFTING_TABLE);

            // Outside parking pad with vehicle!
            safeFill(cx + 4, cy, cz - 2, cx + 7, cy, cz + 2, BLOCK_TYPES.GRAVEL);
            safeFill(cx + 4, cy + 1, cz - 2, cx + 7, cy + 3, cz + 2, BLOCK_TYPES.AIR);
        } finally {
            this.isGeneratingTerrain = prevGen;
            this.trackModifications = prevTrack;
        }

        // Mark chunks overlapping outpost dirty for budgeted meshing
        const minCX = (cx - 5) >> 4, maxCX = (cx + 8) >> 4;
        const minCZ = (cz - 5) >> 4, maxCZ = (cz + 5) >> 4;
        for (let cxx = minCX; cxx <= maxCX; cxx++) {
            for (let czz = minCZ; czz <= maxCZ; czz++) {
                const c = this.getChunk(cxx, czz);
                if (c) c.isDirty = true;
            }
        }

        const vTypes = ['truck', 'cyber', 'police', 'sport'];
        const vType = vTypes[Math.abs(cx + cz) % vTypes.length];
        this.spawnWorldVehicle(cx + 5.5, cy + 1.2, cz, vType, 0);
    }

    // Spawn a natural parked/abandoned car in the wild
    spawnNaturalWildCar(wx, groundY, wz, cx, cz) {
        const prevGen = this.isGeneratingTerrain;
        const prevTrack = this.trackModifications;
        this.isGeneratingTerrain = true;
        this.trackModifications = false;

        const safeSet = (x, y, z, type) => {
            if (y < 0 || y >= CHUNK_SIZE_Y) return;
            this.setBlock(x, y, z, type);
        };
        try {
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    safeSet(wx + dx, groundY, wz + dz, (dx === -2 || dx === 2 || dz === -2 || dz === 2) ? BLOCK_TYPES.GRAVEL : BLOCK_TYPES.COBBLESTONE);
                    safeSet(wx + dx, groundY + 1, wz + dz, BLOCK_TYPES.AIR);
                    safeSet(wx + dx, groundY + 2, wz + dz, BLOCK_TYPES.AIR);
                }
            }
            safeSet(wx - 2, groundY + 1, wz - 2, BLOCK_TYPES.REDSTONE_TORCH);
        } finally {
            this.isGeneratingTerrain = prevGen;
            this.trackModifications = prevTrack;
        }

        // Mark chunk dirty for budgeted meshing
        const minCX = (wx - 3) >> 4, maxCX = (wx + 3) >> 4;
        const minCZ = (wz - 3) >> 4, maxCZ = (wz + 3) >> 4;
        for (let cxx = minCX; cxx <= maxCX; cxx++) {
            for (let czz = minCZ; czz <= maxCZ; czz++) {
                const c = this.getChunk(cxx, czz);
                if (c) c.isDirty = true;
            }
        }

        const vTypes = ['sport', 'police', 'cyber', 'truck'];
        const vType = vTypes[Math.abs(cx * 3 + cz * 5) % vTypes.length];
        const yaw = ((Math.abs(cx + cz) % 4) * Math.PI) / 2;
        this.spawnWorldVehicle(wx + 0.5, groundY + 1.2, wz + 0.5, vType, yaw);
    }

}

window.VoxelWorld = VoxelWorld;
window.CHUNK_SIZE_X = CHUNK_SIZE_X;
window.CHUNK_SIZE_Y = CHUNK_SIZE_Y;
window.CHUNK_SIZE_Z = CHUNK_SIZE_Z;

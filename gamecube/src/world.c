#include "world.h"
#include "textures.h"
#include <math.h>
#include <malloc.h>

World g_world;

#define BLOCK_IDX(cx, cz, cy) (((cy) * CHUNK_SIZE_Z + (cz)) * CHUNK_SIZE_X + (cx))

static uint32_t world_hash(int x, int z) {
    uint32_t n = (uint32_t)x * 374761393u + (uint32_t)z * 668265263u;
    n = (n ^ (n >> 13)) * 1274126177u;
    return n ^ (n >> 16);
}

static float noise2d(float x, float z) {
    int ix = (int)floorf(x);
    int iz = (int)floorf(z);
    float fx = x - ix;
    float fz = z - iz;

    float sx = fx * fx * (3.0f - 2.0f * fx);
    float sz = fz * fz * (3.0f - 2.0f * fz);

    float h00 = (float)(world_hash(ix, iz) & 0xFF) / 255.0f;
    float h10 = (float)(world_hash(ix + 1, iz) & 0xFF) / 255.0f;
    float h01 = (float)(world_hash(ix, iz + 1) & 0xFF) / 255.0f;
    float h11 = (float)(world_hash(ix + 1, iz + 1) & 0xFF) / 255.0f;

    float nx0 = h00 + sx * (h10 - h00);
    float nx1 = h01 + sx * (h11 - h01);
    return nx0 + sz * (nx1 - nx0);
}

static void generate_chunk_overworld(Chunk* c) {
    int base_wx = c->chunk_x * CHUNK_SIZE_X;
    int base_wz = c->chunk_z * CHUNK_SIZE_Z;

    for (int cz = 0; cz < CHUNK_SIZE_Z; cz++) {
        for (int cx = 0; cx < CHUNK_SIZE_X; cx++) {
            int wx = base_wx + cx;
            int wz = base_wz + cz;

            float n1 = noise2d(wx * 0.03f, wz * 0.03f);
            float n2 = noise2d(wx * 0.08f, wz * 0.08f) * 0.5f;
            int height = 14 + (int)((n1 + n2) * 16.0f);
            if (height >= CHUNK_HEIGHT - 6) height = CHUNK_HEIGHT - 6;

            for (int y = 0; y < CHUNK_HEIGHT; y++) {
                BlockType b = BLOCK_AIR;
                if (y == 0) {
                    b = BLOCK_BEDROCK;
                } else if (y < height - 3) {
                    b = BLOCK_STONE;
                    // Random ores
                    uint32_t h = world_hash(wx + y * 7, wz + y * 13);
                    if ((h % 45) == 0) b = BLOCK_COAL_ORE;
                    else if ((h % 75) == 0) b = BLOCK_IRON_ORE;
                    else if ((h % 140) == 0 && y < 14) b = BLOCK_GOLD_ORE;
                    else if ((h % 180) == 0 && y < 10) b = BLOCK_DIAMOND_ORE;
                    else if ((h % 300) == 0 && y < 6) b = BLOCK_NETHERITE;
                } else if (y < height) {
                    b = BLOCK_DIRT;
                } else if (y == height) {
                    if (height <= 17) {
                        b = BLOCK_SAND;
                    } else {
                        b = BLOCK_GRASS;
                    }
                } else if (y <= 16) {
                    b = BLOCK_WATER;
                }

                c->blocks[BLOCK_IDX(cx, cz, y)] = (uint8_t)b;
            }

            // Spawn Popcat & Eblan-Block memes!
            uint32_t mh = world_hash(wx, wz);
            if ((mh % 150) == 7 && height > 17) {
                c->blocks[BLOCK_IDX(cx, cz, height + 1)] = BLOCK_POPCAT;
            } else if ((mh % 150) == 23 && height > 17) {
                c->blocks[BLOCK_IDX(cx, cz, height + 1)] = BLOCK_EBLAN;
            }
        }
    }

    // Trees
    for (int cz = 2; cz < CHUNK_SIZE_Z - 2; cz++) {
        for (int cx = 2; cx < CHUNK_SIZE_X - 2; cx++) {
            int wx = base_wx + cx;
            int wz = base_wz + cz;
            if ((world_hash(wx * 3, wz * 7) % 65) == 42) {
                int sy = 0;
                for (int y = CHUNK_HEIGHT - 10; y >= 1; y--) {
                    if (c->blocks[BLOCK_IDX(cx, cz, y)] == BLOCK_GRASS) {
                        sy = y;
                        break;
                    }
                }
                if (sy > 17 && sy < CHUNK_HEIGHT - 8) {
                    for (int ty = 1; ty <= 4; ty++) {
                        c->blocks[BLOCK_IDX(cx, cz, sy + ty)] = BLOCK_WOOD;
                    }
                    for (int ly = 3; ly <= 5; ly++) {
                        for (int lz = -1; lz <= 1; lz++) {
                            for (int lx = -1; lx <= 1; lx++) {
                                int tc_x = cx + lx;
                                int tc_z = cz + lz;
                                if (tc_x >= 0 && tc_x < CHUNK_SIZE_X && tc_z >= 0 && tc_z < CHUNK_SIZE_Z) {
                                    int idx = BLOCK_IDX(tc_x, tc_z, sy + ly);
                                    if (c->blocks[idx] == BLOCK_AIR) {
                                        c->blocks[idx] = BLOCK_LEAVES;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

static void generate_chunk_nether(Chunk* c) {
    int base_wx = c->chunk_x * CHUNK_SIZE_X;
    int base_wz = c->chunk_z * CHUNK_SIZE_Z;

    for (int cz = 0; cz < CHUNK_SIZE_Z; cz++) {
        for (int cx = 0; cx < CHUNK_SIZE_X; cx++) {
            int wx = base_wx + cx;
            int wz = base_wz + cz;

            for (int y = 0; y < CHUNK_HEIGHT; y++) {
                BlockType b = BLOCK_AIR;
                if (y == 0 || y == CHUNK_HEIGHT - 1) {
                    b = BLOCK_BEDROCK;
                } else if (y <= 8) {
                    b = BLOCK_LAVA;
                } else {
                    float n = noise2d(wx * 0.06f, wz * 0.06f);
                    float n_vert = fabsf((float)y - (CHUNK_HEIGHT / 2.0f)) / (CHUNK_HEIGHT / 2.0f);
                    if (n_vert > (0.4f + n * 0.3f)) {
                        b = BLOCK_NETHERRACK;
                        uint32_t h = world_hash(wx * 11 + y, wz * 13);
                        if ((h % 80) == 0) b = BLOCK_GLOWSTONE;
                        else if ((h % 95) == 0) b = BLOCK_NETHER_QUARTZ;
                        else if ((h % 150) == 0) b = BLOCK_NETHERITE;
                    }
                }
                c->blocks[BLOCK_IDX(cx, cz, y)] = (uint8_t)b;
            }
        }
    }
}

static void generate_chunk_end(Chunk* c) {
    int base_wx = c->chunk_x * CHUNK_SIZE_X;
    int base_wz = c->chunk_z * CHUNK_SIZE_Z;
    float center_x = (WORLD_SIZE_X / 2.0f);
    float center_z = (WORLD_SIZE_Z / 2.0f);

    for (int cz = 0; cz < CHUNK_SIZE_Z; cz++) {
        for (int cx = 0; cx < CHUNK_SIZE_X; cx++) {
            int wx = base_wx + cx;
            int wz = base_wz + cz;

            float dist = sqrtf((wx - center_x)*(wx - center_x) + (wz - center_z)*(wz - center_z));
            float max_radius = 26.0f;

            for (int y = 0; y < CHUNK_HEIGHT; y++) {
                BlockType b = BLOCK_AIR;
                if (dist < max_radius) {
                    float n = noise2d(wx * 0.1f, wz * 0.1f) * 4.0f;
                    int island_top = 26 + (int)n;
                    int island_bottom = 18 - (int)(dist * 0.3f);
                    if (y >= island_bottom && y <= island_top) {
                        b = BLOCK_ENDSTONE;
                    }
                }
                c->blocks[BLOCK_IDX(cx, cz, y)] = (uint8_t)b;
            }
        }
    }

    // 4 Obsidian Pillars on the End Island
    int pillar_coords[4][2] = {
        {(int)center_x - 12, (int)center_z - 12},
        {(int)center_x + 12, (int)center_z - 12},
        {(int)center_x - 12, (int)center_z + 12},
        {(int)center_x + 12, (int)center_z + 12}
    };

    for (int p = 0; p < 4; p++) {
        int px = pillar_coords[p][0];
        int pz = pillar_coords[p][1];

        if (px >= base_wx && px < base_wx + CHUNK_SIZE_X &&
            pz >= base_wz && pz < base_wz + CHUNK_SIZE_Z) {
            int l_cx = px - base_wx;
            int l_cz = pz - base_wz;

            for (int dx = 0; dx <= 1; dx++) {
                for (int dz = 0; dz <= 1; dz++) {
                    int tc_x = l_cx + dx;
                    int tc_z = l_cz + dz;
                    if (tc_x < CHUNK_SIZE_X && tc_z < CHUNK_SIZE_Z) {
                        for (int y = 20; y <= 40; y++) {
                            c->blocks[BLOCK_IDX(tc_x, tc_z, y)] = BLOCK_OBSIDIAN;
                        }
                    }
                }
            }
        }
    }
}

static void chunk_rebuild_mesh(Chunk* c) {
    if (!c->vertices) {
        c->vertex_capacity = 10240;
        c->vertices = (Vertex3D*)memalign(16, c->vertex_capacity * sizeof(Vertex3D));
    }
    if (!c->vertices) return;
    c->vertex_count = 0;

    int base_wx = c->chunk_x * CHUNK_SIZE_X;
    int base_wz = c->chunk_z * CHUNK_SIZE_Z;

    for (int y = 0; y < CHUNK_HEIGHT; y++) {
        for (int cz = 0; cz < CHUNK_SIZE_Z; cz++) {
            for (int cx = 0; cx < CHUNK_SIZE_X; cx++) {
                BlockType bt = (BlockType)c->blocks[BLOCK_IDX(cx, cz, y)];
                if (bt == BLOCK_AIR) continue;

                const BlockDef* def = block_get_def(bt);
                float x0 = (float)(base_wx + cx);
                float y0 = (float)y;
                float z0 = (float)(base_wz + cz);
                float x1 = x0 + 1.0f;
                float y1 = y0 + 1.0f;
                float z1 = z0 + 1.0f;

                // 1. TOP (+Y)
                BlockType top_b = (y + 1 < CHUNK_HEIGHT) ? (BlockType)c->blocks[BLOCK_IDX(cx, cz, y + 1)] : world_get_block(base_wx + cx, y + 1, base_wz + cz);
                if (block_is_transparent(top_b) && (top_b != bt || !def->is_transparent)) {
                    if (c->vertex_count + 6 < c->vertex_capacity) {
                        float u0, v0, u1, v1;
                        textures_get_uv(def->tex_top, &u0, &v0, &u1, &v1);
                        uint32_t col = RGBA(255, 255, 255, 255);

                        Vertex3D* v = &c->vertices[c->vertex_count];
                        v[0] = (Vertex3D){u0, v0, col, x0, y1, z0};
                        v[1] = (Vertex3D){u1, v0, col, x1, y1, z0};
                        v[2] = (Vertex3D){u1, v1, col, x1, y1, z1};
                        v[3] = (Vertex3D){u0, v0, col, x0, y1, z0};
                        v[4] = (Vertex3D){u1, v1, col, x1, y1, z1};
                        v[5] = (Vertex3D){u0, v1, col, x0, y1, z1};
                        c->vertex_count += 6;
                    }
                }

                // 2. BOTTOM (-Y)
                BlockType bot_b = (y > 0) ? (BlockType)c->blocks[BLOCK_IDX(cx, cz, y - 1)] : BLOCK_BEDROCK;
                if (block_is_transparent(bot_b) && (bot_b != bt || !def->is_transparent)) {
                    if (c->vertex_count + 6 < c->vertex_capacity) {
                        float u0, v0, u1, v1;
                        textures_get_uv(def->tex_bottom, &u0, &v0, &u1, &v1);
                        uint32_t col = RGBA(96, 96, 96, 255);

                        Vertex3D* v = &c->vertices[c->vertex_count];
                        v[0] = (Vertex3D){u0, v0, col, x0, y0, z1};
                        v[1] = (Vertex3D){u1, v0, col, x1, y0, z1};
                        v[2] = (Vertex3D){u1, v1, col, x1, y0, z0};
                        v[3] = (Vertex3D){u0, v0, col, x0, y0, z1};
                        v[4] = (Vertex3D){u1, v1, col, x1, y0, z0};
                        v[5] = (Vertex3D){u0, v1, col, x0, y0, z0};
                        c->vertex_count += 6;
                    }
                }

                // 3. NORTH (-Z)
                BlockType n_b = (cz > 0) ? (BlockType)c->blocks[BLOCK_IDX(cx, cz - 1, y)] : world_get_block(base_wx + cx, y, base_wz + cz - 1);
                if (block_is_transparent(n_b) && (n_b != bt || !def->is_transparent)) {
                    if (c->vertex_count + 6 < c->vertex_capacity) {
                        float u0, v0, u1, v1;
                        textures_get_uv(def->tex_side, &u0, &v0, &u1, &v1);
                        uint32_t col = RGBA(160, 160, 160, 255);

                        Vertex3D* v = &c->vertices[c->vertex_count];
                        v[0] = (Vertex3D){u0, v0, col, x0, y1, z0};
                        v[1] = (Vertex3D){u1, v0, col, x1, y1, z0};
                        v[2] = (Vertex3D){u1, v1, col, x1, y0, z0};
                        v[3] = (Vertex3D){u0, v0, col, x0, y1, z0};
                        v[4] = (Vertex3D){u1, v1, col, x1, y0, z0};
                        v[5] = (Vertex3D){u0, v1, col, x0, y0, z0};
                        c->vertex_count += 6;
                    }
                }

                // 4. SOUTH (+Z)
                BlockType s_b = (cz + 1 < CHUNK_SIZE_Z) ? (BlockType)c->blocks[BLOCK_IDX(cx, cz + 1, y)] : world_get_block(base_wx + cx, y, base_wz + cz + 1);
                if (block_is_transparent(s_b) && (s_b != bt || !def->is_transparent)) {
                    if (c->vertex_count + 6 < c->vertex_capacity) {
                        float u0, v0, u1, v1;
                        textures_get_uv(def->tex_side, &u0, &v0, &u1, &v1);
                        uint32_t col = RGBA(160, 160, 160, 255);

                        Vertex3D* v = &c->vertices[c->vertex_count];
                        v[0] = (Vertex3D){u0, v0, col, x1, y1, z1};
                        v[1] = (Vertex3D){u1, v0, col, x0, y1, z1};
                        v[2] = (Vertex3D){u1, v1, col, x0, y0, z1};
                        v[3] = (Vertex3D){u0, v0, col, x1, y1, z1};
                        v[4] = (Vertex3D){u1, v1, col, x0, y0, z1};
                        v[5] = (Vertex3D){u0, v1, col, x1, y0, z1};
                        c->vertex_count += 6;
                    }
                }

                // 5. WEST (-X)
                BlockType w_b = (cx > 0) ? (BlockType)c->blocks[BLOCK_IDX(cx - 1, cz, y)] : world_get_block(base_wx + cx - 1, y, base_wz + cz);
                if (block_is_transparent(w_b) && (w_b != bt || !def->is_transparent)) {
                    if (c->vertex_count + 6 < c->vertex_capacity) {
                        float u0, v0, u1, v1;
                        textures_get_uv(def->tex_side, &u0, &v0, &u1, &v1);
                        uint32_t col = RGBA(204, 204, 204, 255);

                        Vertex3D* v = &c->vertices[c->vertex_count];
                        v[0] = (Vertex3D){u0, v0, col, x0, y1, z1};
                        v[1] = (Vertex3D){u1, v0, col, x0, y1, z0};
                        v[2] = (Vertex3D){u1, v1, col, x0, y0, z0};
                        v[3] = (Vertex3D){u0, v0, col, x0, y1, z1};
                        v[4] = (Vertex3D){u1, v1, col, x0, y0, z0};
                        v[5] = (Vertex3D){u0, v1, col, x0, y0, z1};
                        c->vertex_count += 6;
                    }
                }

                // 6. EAST (+X)
                BlockType e_b = (cx + 1 < CHUNK_SIZE_X) ? (BlockType)c->blocks[BLOCK_IDX(cx + 1, cz, y)] : world_get_block(base_wx + cx + 1, y, base_wz + cz);
                if (block_is_transparent(e_b) && (e_b != bt || !def->is_transparent)) {
                    if (c->vertex_count + 6 < c->vertex_capacity) {
                        float u0, v0, u1, v1;
                        textures_get_uv(def->tex_side, &u0, &v0, &u1, &v1);
                        uint32_t col = RGBA(204, 204, 204, 255);

                        Vertex3D* v = &c->vertices[c->vertex_count];
                        v[0] = (Vertex3D){u0, v0, col, x1, y1, z0};
                        v[1] = (Vertex3D){u1, v0, col, x1, y1, z1};
                        v[2] = (Vertex3D){u1, v1, col, x1, y0, z1};
                        v[3] = (Vertex3D){u0, v0, col, x1, y1, z0};
                        v[4] = (Vertex3D){u1, v1, col, x1, y0, z1};
                        v[5] = (Vertex3D){u0, v1, col, x1, y0, z0};
                        c->vertex_count += 6;
                    }
                }
            }
        }
    }

    c->is_dirty = false;
}

void world_init(DimensionType dim) {
    g_world.current_dimension = dim;

    if (dim == DIMENSION_OVERWORLD) {
        g_world.sky_color = RGB(120, 180, 255);
        g_world.fog_color = RGB(160, 210, 255);
        g_world.fog_near = 35.0f;
        g_world.fog_far = 70.0f;
    } else if (dim == DIMENSION_NETHER) {
        g_world.sky_color = RGB(40, 10, 10);
        g_world.fog_color = RGB(80, 20, 20);
        g_world.fog_near = 20.0f;
        g_world.fog_far = 50.0f;
    } else { // THE END
        g_world.sky_color = RGB(15, 8, 25);
        g_world.fog_color = RGB(25, 12, 40);
        g_world.fog_near = 40.0f;
        g_world.fog_far = 80.0f;
    }

    for (int cz = 0; cz < WORLD_CHUNKS_Z; cz++) {
        for (int cx = 0; cx < WORLD_CHUNKS_X; cx++) {
            int idx = cz * WORLD_CHUNKS_X + cx;
            Chunk* c = &g_world.chunks[idx];
            c->chunk_x = cx;
            c->chunk_z = cz;
            c->is_dirty = true;

            if (dim == DIMENSION_OVERWORLD) {
                generate_chunk_overworld(c);
            } else if (dim == DIMENSION_NETHER) {
                generate_chunk_nether(c);
            } else {
                generate_chunk_end(c);
            }
        }
    }

    for (int i = 0; i < WORLD_TOTAL_CHUNKS; i++) {
        chunk_rebuild_mesh(&g_world.chunks[i]);
    }
}

void world_switch_dimension(DimensionType dim) {
    world_init(dim);
}

BlockType world_get_block(int x, int y, int z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK_AIR;
    if (x < 0 || x >= WORLD_SIZE_X || z < 0 || z >= WORLD_SIZE_Z) return BLOCK_AIR;

    int cx = x / CHUNK_SIZE_X;
    int cz = z / CHUNK_SIZE_Z;
    int lx = x % CHUNK_SIZE_X;
    int lz = z % CHUNK_SIZE_Z;

    int c_idx = cz * WORLD_CHUNKS_X + cx;
    return (BlockType)g_world.chunks[c_idx].blocks[BLOCK_IDX(lx, lz, y)];
}

void world_set_block(int x, int y, int z, BlockType type) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    if (x < 0 || x >= WORLD_SIZE_X || z < 0 || z >= WORLD_SIZE_Z) return;

    int cx = x / CHUNK_SIZE_X;
    int cz = z / CHUNK_SIZE_Z;
    int lx = x % CHUNK_SIZE_X;
    int lz = z % CHUNK_SIZE_Z;

    int c_idx = cz * WORLD_CHUNKS_X + cx;
    g_world.chunks[c_idx].blocks[BLOCK_IDX(lx, lz, y)] = (uint8_t)type;
    g_world.chunks[c_idx].is_dirty = true;

    // Check edges
    if (lx == 0 && cx > 0) g_world.chunks[cz * WORLD_CHUNKS_X + (cx - 1)].is_dirty = true;
    if (lx == CHUNK_SIZE_X - 1 && cx < WORLD_CHUNKS_X - 1) g_world.chunks[cz * WORLD_CHUNKS_X + (cx + 1)].is_dirty = true;
    if (lz == 0 && cz > 0) g_world.chunks[(cz - 1) * WORLD_CHUNKS_X + cx].is_dirty = true;
    if (lz == CHUNK_SIZE_Z - 1 && cz < WORLD_CHUNKS_Z - 1) g_world.chunks[(cz + 1) * WORLD_CHUNKS_X + cx].is_dirty = true;
}

void world_render(Vec3 player_pos) {
    textures_bind();
    renderer_setup_fog(g_world.fog_color, g_world.fog_near, g_world.fog_far);

    for (int i = 0; i < WORLD_TOTAL_CHUNKS; i++) {
        Chunk* c = &g_world.chunks[i];
        if (c->is_dirty) {
            chunk_rebuild_mesh(c);
        }

        if (c->vertex_count > 0) {
            renderer_draw_vertices_3d(c->vertices, c->vertex_count);
        }
    }
}

int world_get_height(int x, int z) {
    for (int y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        if (world_get_block(x, y, z) != BLOCK_AIR) {
            return y;
        }
    }
    return 1;
}

bool world_raycast(Vec3 origin, Vec3 dir, float max_dist, BlockPos* hit_pos, BlockPos* place_pos, BlockFace* hit_face) {
    float step = 0.05f;
    Vec3 cur = origin;
    BlockPos last_p = {(int)floorf(origin.x), (int)floorf(origin.y), (int)floorf(origin.z)};

    for (float d = 0.0f; d < max_dist; d += step) {
        cur.x += dir.x * step;
        cur.y += dir.y * step;
        cur.z += dir.z * step;

        BlockPos p = {(int)floorf(cur.x), (int)floorf(cur.y), (int)floorf(cur.z)};
        BlockType b = world_get_block(p.x, p.y, p.z);

        if (b != BLOCK_AIR && b != BLOCK_WATER && b != BLOCK_LAVA) {
            if (hit_pos) *hit_pos = p;
            if (place_pos) *place_pos = last_p;
            if (hit_face) {
                if (last_p.y > p.y) *hit_face = FACE_TOP;
                else if (last_p.y < p.y) *hit_face = FACE_BOTTOM;
                else if (last_p.z < p.z) *hit_face = FACE_NORTH;
                else if (last_p.z > p.z) *hit_face = FACE_SOUTH;
                else if (last_p.x < p.x) *hit_face = FACE_WEST;
                else *hit_face = FACE_EAST;
            }
            return true;
        }
        last_p = p;
    }
    return false;
}

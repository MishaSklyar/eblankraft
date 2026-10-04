#ifndef EBLANKRAFT_WORLD_H
#define EBLANKRAFT_WORLD_H

#include "common.h"
#include "blocks.h"
#include "renderer.h"

#define CHUNK_SIZE_X 16
#define CHUNK_SIZE_Z 16
#define CHUNK_HEIGHT 64

#define WORLD_CHUNKS_X 5
#define WORLD_CHUNKS_Z 5
#define WORLD_TOTAL_CHUNKS (WORLD_CHUNKS_X * WORLD_CHUNKS_Z)

#define WORLD_SIZE_X (WORLD_CHUNKS_X * CHUNK_SIZE_X)
#define WORLD_SIZE_Z (WORLD_CHUNKS_Z * CHUNK_SIZE_Z)

typedef enum {
    DIMENSION_OVERWORLD = 0,
    DIMENSION_NETHER,
    DIMENSION_END
} DimensionType;

typedef struct {
    int chunk_x;
    int chunk_z;
    uint8_t blocks[CHUNK_SIZE_X * CHUNK_SIZE_Z * CHUNK_HEIGHT];
    Vertex3D* vertices;
    int vertex_count;
    int vertex_capacity;
    bool is_dirty;
} Chunk;

typedef struct {
    DimensionType current_dimension;
    Chunk chunks[WORLD_TOTAL_CHUNKS];
    uint32_t sky_color;
    uint32_t fog_color;
    float fog_near;
    float fog_far;
} World;

extern World g_world;

void world_init(DimensionType dim);
void world_switch_dimension(DimensionType dim);
BlockType world_get_block(int x, int y, int z);
void world_set_block(int x, int y, int z, BlockType type);
void world_render(Vec3 player_pos);
bool world_raycast(Vec3 origin, Vec3 dir, float max_dist, BlockPos* hit_pos, BlockPos* place_pos, BlockFace* hit_face);
int  world_get_height(int x, int z);

#endif // EBLANKRAFT_WORLD_H

#ifndef EBLANKRAFT_TEXTURES_H
#define EBLANKRAFT_TEXTURES_H

#include "common.h"

#define ATLAS_SIZE 256
#define TILE_SIZE  16
#define TILES_PER_ROW (ATLAS_SIZE / TILE_SIZE)

extern const uint32_t g_ripped_atlas[ATLAS_SIZE * ATLAS_SIZE];

void textures_init(void);
void textures_bind(void);
void textures_get_uv(uint8_t tile_index, float* u0, float* v0, float* u1, float* v1);

#endif // EBLANKRAFT_TEXTURES_H

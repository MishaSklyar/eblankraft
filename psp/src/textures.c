#include "textures.h"
#include "common.h"

void textures_init(void) {
    // Texture atlas was ripped directly from Eblankraft 2.0 (js/textures.js)
    sceKernelDcacheWritebackAll();
    sceGuTexFlush();
}

void textures_bind(void) {
    sceGuTexMode(GU_PSM_8888, 0, 0, 0);
    sceGuTexImage(0, ATLAS_SIZE, ATLAS_SIZE, ATLAS_SIZE, g_ripped_atlas);
    sceGuTexFunc(GU_TFX_MODULATE, GU_TCC_RGBA);
    sceGuTexFilter(GU_NEAREST, GU_NEAREST);
    sceGuTexWrap(GU_REPEAT, GU_REPEAT);
    sceGuTexScale(1.0f, 1.0f);
    sceGuTexOffset(0.0f, 0.0f);
}

void textures_get_uv(uint8_t tile_index, float* u0, float* v0, float* u1, float* v1) {
    int tx = tile_index % TILES_PER_ROW;
    int ty = tile_index / TILES_PER_ROW;
    const float step = (float)TILE_SIZE / (float)ATLAS_SIZE;
    *u0 = (float)tx * step;
    *v0 = (float)ty * step;
    *u1 = *u0 + step;
    *v1 = *v0 + step;
}

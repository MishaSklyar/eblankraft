#include "textures.h"
#include "common.h"

static GXTexObj s_tex_obj;
static uint8_t s_tiled_texture[ATLAS_SIZE * ATLAS_SIZE * 4] __attribute__((aligned(32)));

void textures_init(void) {
    // Convert linear 256x256 RGBA atlas into GameCube GX 4x4 tiled RGBA8 format
    uint8_t* dst = s_tiled_texture;

    for (int ty = 0; ty < (ATLAS_SIZE / 4); ty++) {
        for (int tx = 0; tx < (ATLAS_SIZE / 4); tx++) {
            uint8_t* tile_ptr = dst + (ty * (ATLAS_SIZE / 4) + tx) * 64;
            uint8_t* ar_ptr = tile_ptr;
            uint8_t* gb_ptr = tile_ptr + 32;

            for (int py = 0; py < 4; py++) {
                for (int px = 0; px < 4; px++) {
                    int img_x = tx * 4 + px;
                    int img_y = ty * 4 + py;
                    uint32_t c = g_ripped_atlas[img_y * ATLAS_SIZE + img_x];

                    uint8_t r = (uint8_t)(c & 0xFF);
                    uint8_t g = (uint8_t)((c >> 8) & 0xFF);
                    uint8_t b = (uint8_t)((c >> 16) & 0xFF);
                    uint8_t a = (uint8_t)((c >> 24) & 0xFF);

                    *ar_ptr++ = a;
                    *ar_ptr++ = r;
                    *gb_ptr++ = g;
                    *gb_ptr++ = b;
                }
            }
        }
    }

    DCStoreRange(s_tiled_texture, sizeof(s_tiled_texture));

    GX_InitTexObj(&s_tex_obj, s_tiled_texture, ATLAS_SIZE, ATLAS_SIZE, GX_TF_RGBA8, GX_REPEAT, GX_REPEAT, GX_FALSE);
    GX_InitTexObjFilterMode(&s_tex_obj, GX_NEAR, GX_NEAR);
}

void textures_bind(void) {
    GX_LoadTexObj(&s_tex_obj, GX_TEXMAP0);
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

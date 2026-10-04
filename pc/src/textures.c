#include "textures.h"

static GLuint s_atlas_tex = 0;

void textures_init(void) {
    glGenTextures(1, &s_atlas_tex);
    glBindTexture(GL_TEXTURE_2D, s_atlas_tex);

    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

    glTexImage2D(
        GL_TEXTURE_2D, 0, GL_RGBA,
        ATLAS_SIZE, ATLAS_SIZE, 0,
        GL_RGBA, GL_UNSIGNED_BYTE,
        g_ripped_atlas
    );
}

void textures_bind(void) {
    glBindTexture(GL_TEXTURE_2D, s_atlas_tex);
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

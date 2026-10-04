#ifndef EBLANKRAFT_COMMON_H
#define EBLANKRAFT_COMMON_H

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <math.h>

#define SDL_MAIN_HANDLED
#include <SDL2/SDL.h>
#include <GL/gl.h>
#include <GL/glu.h>

#include <malloc.h>

#if defined(_WIN32) || defined(_WIN64)
#define memalign(align, size) malloc(size)
#endif

#ifndef M_PI
#define M_PI 3.14159265358979323846f
#endif

#define DEG_TO_RAD (M_PI / 180.0f)
#define RAD_TO_DEG (180.0f / M_PI)

static inline float fclampf(float v, float min, float max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
}

#define WINDOW_WIDTH  1280
#define WINDOW_HEIGHT 720

#define SCREEN_WIDTH  640
#define SCREEN_HEIGHT 480

// Little-Endian RGBA (OpenGL GL_RGBA8 memory order: R, G, B, A)
#define RGBA(r, g, b, a) (((uint32_t)(uint8_t)(r)) | (((uint32_t)(uint8_t)(g)) << 8) | (((uint32_t)(uint8_t)(b)) << 16) | (((uint32_t)(uint8_t)(a)) << 24))

#ifdef RGB
#undef RGB
#endif
#define RGB(r, g, b) RGBA(r, g, b, 255)

typedef struct {
    float x, y, z;
} Vec3;

typedef struct {
    int x, y, z;
} BlockPos;

#endif // EBLANKRAFT_COMMON_H

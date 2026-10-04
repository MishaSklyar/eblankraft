#ifndef EBLANKRAFT_COMMON_H
#define EBLANKRAFT_COMMON_H

#include <pspkernel.h>
#include <pspdisplay.h>
#include <pspdebug.h>
#include <pspctrl.h>
#include <psppower.h>
#include <pspgu.h>
#include <pspgum.h>
#include <psprtc.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>
#include <stdbool.h>

#define SCREEN_WIDTH  480
#define SCREEN_HEIGHT 272
#define BUFFER_WIDTH  512

#define VRAM_DRAW_BUFFER    0
#define VRAM_DISP_BUFFER    (512 * 272 * 4)
#define VRAM_DEPTH_BUFFER   (VRAM_DISP_BUFFER + (512 * 272 * 4))

#define PI 3.14159265358979323846f
#define DEG_TO_RAD (PI / 180.0f)
#define RAD_TO_DEG (180.0f / PI)

#define RGBA(r, g, b, a) ((uint32_t)(((a) << 24) | ((b) << 16) | ((g) << 8) | (r)))
#define RGB(r, g, b)     RGBA(r, g, b, 255)

typedef struct {
    float x, y, z;
} Vec3;

typedef struct {
    int x, y, z;
} BlockPos;

typedef struct {
    float min_x, min_y, min_z;
    float max_x, max_y, max_z;
} AABB;

static inline float fclampf(float v, float min, float max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
}

static inline int iclamp(int v, int min, int max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
}

#endif // EBLANKRAFT_COMMON_H

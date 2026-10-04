#ifndef EBLANKRAFT_COMMON_H
#define EBLANKRAFT_COMMON_H

#include <gccore.h>
#include <ogc/gx.h>
#include <ogc/pad.h>
#include <ogc/audio.h>
#include <ogc/lwp_watchdog.h>
#include <asndlib.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>
#include <stdbool.h>
#include <malloc.h>

#define SCREEN_WIDTH  640
#define SCREEN_HEIGHT 480

#define PI 3.14159265358979323846f
#define DEG_TO_RAD (PI / 180.0f)
#define RAD_TO_DEG (180.0f / PI)

// GameCube is Big-Endian (PowerPC)
// RGBA in memory: byte 0=R, 1=G, 2=B, 3=A
#define RGBA(r, g, b, a) (((uint32_t)(r) << 24) | ((uint32_t)(g) << 16) | ((uint32_t)(b) << 8) | (uint32_t)(a))
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

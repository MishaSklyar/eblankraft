#ifndef EBLANKRAFT_RENDERER_H
#define EBLANKRAFT_RENDERER_H

#include "common.h"

typedef struct {
    float u, v;
    uint32_t color;
    float x, y, z;
} Vertex3D;

typedef struct {
    float u, v;
    uint32_t color;
    float x, y, z;
} Vertex2D;

typedef struct {
    uint32_t color;
    float x, y, z;
} ColorVertex3D;

typedef struct {
    uint32_t color;
    float x, y, z;
} ColorVertex2D;

void renderer_init(void);
void renderer_start_frame(uint32_t clear_color);
void renderer_setup_3d(float fov, float aspect, float near_z, float far_z);
void renderer_setup_camera(Vec3 pos, float yaw, float pitch);
void renderer_setup_fog(uint32_t fog_color, float near_dist, float far_dist);
void renderer_disable_fog(void);

// Matrix stack for hierarchical / entity transforms
void renderer_push_matrix(void);
void renderer_pop_matrix(void);
void renderer_translate(float x, float y, float z);
void renderer_rotate_x(float rad);
void renderer_rotate_y(float rad);
void renderer_rotate_z(float rad);
void renderer_scale(float sx, float sy, float sz);

// Drawing functions
void renderer_draw_vertices_3d(const Vertex3D* verts, int count);
void renderer_draw_box(float sx, float sy, float sz, uint32_t color);
void renderer_draw_line_3d(Vec3 p1, Vec3 p2, uint32_t color);
void renderer_draw_cube_wireframe(float x, float y, float z, float size, uint32_t color);

// 2D functions
void renderer_setup_2d(void);
void renderer_draw_rect_2d(int x1, int y1, int x2, int y2, uint32_t color);
void renderer_draw_sprite_2d(int x, int y, int w, int h, float u0, float v0, float u1, float v1, uint32_t color);

void renderer_end_frame(void);

#endif // EBLANKRAFT_RENDERER_H

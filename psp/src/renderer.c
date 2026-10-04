#include "renderer.h"
#include "textures.h"

#define BUF_WIDTH (512)
#define SCR_WIDTH (480)
#define SCR_HEIGHT (272)

static unsigned int __attribute__((aligned(16))) dlist[262144];

void renderer_init(void) {
    sceGuInit();

    void* fbp0 = guGetStaticVramBuffer(BUF_WIDTH, SCR_HEIGHT, GU_PSM_8888);
    void* fbp1 = guGetStaticVramBuffer(BUF_WIDTH, SCR_HEIGHT, GU_PSM_8888);
    void* zbp  = guGetStaticVramBuffer(BUF_WIDTH, SCR_HEIGHT, GU_PSM_4444);

    sceGuStart(GU_DIRECT, dlist);
    sceGuDrawBuffer(GU_PSM_8888, fbp0, BUF_WIDTH);
    sceGuDispBuffer(SCR_WIDTH, SCR_HEIGHT, fbp1, BUF_WIDTH);
    sceGuDepthBuffer(zbp, BUF_WIDTH);

    sceGuOffset(2048 - (SCR_WIDTH / 2), 2048 - (SCR_HEIGHT / 2));
    sceGuViewport(2048, 2048, SCR_WIDTH, SCR_HEIGHT);
    sceGuDepthRange(65535, 0);

    sceGuScissor(0, 0, SCR_WIDTH, SCR_HEIGHT);
    sceGuEnable(GU_SCISSOR_TEST);

    sceGuDepthFunc(GU_GEQUAL);
    sceGuEnable(GU_DEPTH_TEST);

    sceGuFrontFace(GU_CW);
    sceGuShadeModel(GU_SMOOTH);

    sceGuDisable(GU_CULL_FACE);
    sceGuEnable(GU_TEXTURE_2D);
    sceGuEnable(GU_CLIP_PLANES);

    // Alpha test for transparent textures (e.g. leaves cutouts)
    sceGuAlphaFunc(GU_GREATER, 0x10, 0xFF);
    sceGuEnable(GU_ALPHA_TEST);

    // Alpha blend for water and UI
    sceGuBlendFunc(GU_ADD, GU_SRC_ALPHA, GU_ONE_MINUS_SRC_ALPHA, 0, 0);
    sceGuEnable(GU_BLEND);

    sceGuTexScale(1.0f, 1.0f);
    sceGuTexOffset(0.0f, 0.0f);

    sceGuFinish();
    sceGuSync(0, 0);

    sceDisplayWaitVblankStart();
    sceGuDisplay(GU_TRUE);
}

void renderer_start_frame(uint32_t clear_color) {
    sceGuStart(GU_DIRECT, dlist);
    sceGuClearColor(clear_color);
    sceGuClearDepth(0);
    sceGuClear(GU_COLOR_BUFFER_BIT | GU_DEPTH_BUFFER_BIT);
}

void renderer_setup_3d(float fov, float aspect, float near_z, float far_z) {
    sceGuEnable(GU_DEPTH_TEST);
    sceGuDisable(GU_CULL_FACE);
    sceGuEnable(GU_TEXTURE_2D);

    sceGumMatrixMode(GU_PROJECTION);
    sceGumLoadIdentity();
    sceGumPerspective(fov, aspect, near_z, far_z);
}

void renderer_setup_camera(Vec3 pos, float yaw, float pitch) {
    sceGumMatrixMode(GU_VIEW);
    sceGumLoadIdentity();

    // Rotate pitch (look up/down)
    sceGumRotateX(pitch * DEG_TO_RAD);
    // Rotate yaw (look left/right)
    sceGumRotateY(yaw * DEG_TO_RAD);

    // Translate to -pos
    ScePspFVector3 cam_pos = { -pos.x, -pos.y, -pos.z };
    sceGumTranslate(&cam_pos);

    sceGumMatrixMode(GU_MODEL);
    sceGumLoadIdentity();
}

void renderer_setup_fog(uint32_t fog_color, float near_dist, float far_dist) {
    sceGuFog(near_dist, far_dist, fog_color);
    sceGuEnable(GU_FOG);
}

void renderer_disable_fog(void) {
    sceGuDisable(GU_FOG);
}

void renderer_setup_2d(void) {
    sceGuDisable(GU_DEPTH_TEST);
    sceGuDisable(GU_CULL_FACE);
    sceGuDisable(GU_FOG);
}

void renderer_draw_rect_2d(int x1, int y1, int x2, int y2, uint32_t color) {
    sceGuDisable(GU_TEXTURE_2D);

    ColorVertex3D* v = (ColorVertex3D*)sceGuGetMemory(2 * sizeof(ColorVertex3D));
    if (!v) return;

    v[0].color = color;
    v[0].x = (float)x1;
    v[0].y = (float)y1;
    v[0].z = 0.0f;

    v[1].color = color;
    v[1].x = (float)x2;
    v[1].y = (float)y2;
    v[1].z = 0.0f;

    sceGuDrawArray(GU_SPRITES, GU_COLOR_8888 | GU_VERTEX_32BITF | GU_TRANSFORM_2D, 2, NULL, v);
    sceGuEnable(GU_TEXTURE_2D);
}

void renderer_draw_sprite_2d(int x, int y, int w, int h, float u0, float v0, float u1, float v1, uint32_t color) {
    textures_bind();

    Vertex2D* v = (Vertex2D*)sceGuGetMemory(2 * sizeof(Vertex2D));
    if (!v) return;

    v[0].u = u0;
    v[0].v = v0;
    v[0].color = color;
    v[0].x = (float)x;
    v[0].y = (float)y;
    v[0].z = 0.0f;

    v[1].u = u1;
    v[1].v = v1;
    v[1].color = color;
    v[1].x = (float)(x + w);
    v[1].y = (float)(y + h);
    v[1].z = 0.0f;

    sceGuDrawArray(GU_SPRITES, GU_TEXTURE_32BITF | GU_COLOR_8888 | GU_VERTEX_32BITF | GU_TRANSFORM_2D, 2, NULL, v);
}

void renderer_draw_cube_wireframe(float x, float y, float z, float size, uint32_t color) {
    sceGuDisable(GU_TEXTURE_2D);
    sceGuDisable(GU_DEPTH_TEST);

    ColorVertex3D* v = (ColorVertex3D*)sceGuGetMemory(24 * sizeof(ColorVertex3D));
    if (!v) return;

    float s = size;
    float x1 = x, y1 = y, z1 = z;
    float x2 = x + s, y2 = y + s, z2 = z + s;

    // 12 lines = 24 vertices
    ColorVertex3D lines[24] = {
        // Bottom 4
        {color, x1, y1, z1}, {color, x2, y1, z1},
        {color, x2, y1, z1}, {color, x2, y1, z2},
        {color, x2, y1, z2}, {color, x1, y1, z2},
        {color, x1, y1, z2}, {color, x1, y1, z1},
        // Top 4
        {color, x1, y2, z1}, {color, x2, y2, z1},
        {color, x2, y2, z1}, {color, x2, y2, z2},
        {color, x2, y2, z2}, {color, x1, y2, z2},
        {color, x1, y2, z2}, {color, x1, y2, z1},
        // Verticals 4
        {color, x1, y1, z1}, {color, x1, y2, z1},
        {color, x2, y1, z1}, {color, x2, y2, z1},
        {color, x2, y1, z2}, {color, x2, y2, z2},
        {color, x1, y1, z2}, {color, x1, y2, z2},
    };

    memcpy(v, lines, sizeof(lines));
    sceGumDrawArray(GU_LINES, GU_COLOR_8888 | GU_VERTEX_32BITF | GU_TRANSFORM_3D, 24, 0, v);

    sceGuEnable(GU_DEPTH_TEST);
    sceGuEnable(GU_TEXTURE_2D);
}

void renderer_end_frame(void) {
    sceGuFinish();
    sceGuSync(0, 0);

    sceDisplayWaitVblankStart();
    sceGuSwapBuffers();
}

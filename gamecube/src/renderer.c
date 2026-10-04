#include "renderer.h"
#include "textures.h"

#define FIFO_SIZE (256 * 1024)
#define MAX_MATRIX_STACK 16

static void* s_xfb[2] = { NULL, NULL };
static int s_which_fb = 0;
static GXRModeObj* s_rmode = NULL;

static Mtx s_view_matrix;
static Mtx s_model_stack[MAX_MATRIX_STACK];
static int s_matrix_top = 0;

static void update_modelview(void) {
    Mtx mv;
    guMtxConcat(s_view_matrix, s_model_stack[s_matrix_top], mv);
    GX_LoadPosMtxImm(mv, GX_PNMTX0);
}

void renderer_init(void) {
    VIDEO_Init();

    s_rmode = VIDEO_GetPreferredMode(NULL);

    s_xfb[0] = MEM_K0_TO_K1(SYS_AllocateFramebuffer(s_rmode));
    s_xfb[1] = MEM_K0_TO_K1(SYS_AllocateFramebuffer(s_rmode));
    s_which_fb = 0;

    VIDEO_Configure(s_rmode);
    VIDEO_SetNextFramebuffer(s_xfb[s_which_fb]);
    VIDEO_SetBlack(FALSE);
    VIDEO_Flush();
    VIDEO_WaitVSync();
    if (s_rmode->viTVMode & VI_NON_INTERLACE) VIDEO_WaitVSync();

    void* gp_fifo = MEM_K0_TO_K1(memalign(32, FIFO_SIZE));
    memset(gp_fifo, 0, FIFO_SIZE);
    GX_Init(gp_fifo, FIFO_SIZE);

    GXColor bg = { 110, 165, 235, 255 };
    GX_SetCopyClear(bg, 0x00FFFFFF);

    GX_SetViewport(0, 0, s_rmode->fbWidth, s_rmode->efbHeight, 0.0f, 1.0f);
    GX_SetDispCopyYScale((f32)s_rmode->xfbHeight / (f32)s_rmode->efbHeight);
    GX_SetScissor(0, 0, s_rmode->fbWidth, s_rmode->efbHeight);
    GX_SetDispCopySrc(0, 0, s_rmode->fbWidth, s_rmode->efbHeight);
    GX_SetDispCopyDst(s_rmode->fbWidth, s_rmode->xfbHeight);
    GX_SetCopyFilter(s_rmode->aa, s_rmode->sample_pattern, GX_TRUE, s_rmode->vfilter);
    GX_SetFieldMode(s_rmode->field_rendering, ((s_rmode->viHeight == 2 * s_rmode->xfbHeight) ? GX_ENABLE : GX_DISABLE));

    GX_SetPixelFmt(GX_PF_RGB8_Z24, GX_ZC_LINEAR);
    GX_SetCullMode(GX_CULL_NONE);
    GX_CopyDisp(s_xfb[s_which_fb], GX_TRUE);
    GX_SetDispCopyGamma(GX_GM_1_0);

    // Alpha test for transparent cutouts (leaves, flowers, etc.)
    GX_SetAlphaCompare(GX_GREATER, 0x10, GX_AOP_AND, GX_ALWAYS, 0);

    // Alpha blending for water and 2D UI
    GX_SetBlendMode(GX_BM_BLEND, GX_BL_SRCALPHA, GX_BL_INVSRCALPHA, GX_LO_CLEAR);

    // Setup vertex descriptors
    GX_ClearVtxDesc();
    GX_SetVtxDesc(GX_VA_POS, GX_DIRECT);
    GX_SetVtxDesc(GX_VA_CLR0, GX_DIRECT);
    GX_SetVtxDesc(GX_VA_TEX0, GX_DIRECT);

    // VTXFMT0: Textured 3D / 2D (POS + COLOR + TEX0)
    GX_SetVtxAttrFmt(GX_VTXFMT0, GX_VA_POS, GX_POS_XYZ, GX_F32, 0);
    GX_SetVtxAttrFmt(GX_VTXFMT0, GX_VA_CLR0, GX_CLR_RGBA, GX_RGBA8, 0);
    GX_SetVtxAttrFmt(GX_VTXFMT0, GX_VA_TEX0, GX_TEX_ST, GX_F32, 0);

    // VTXFMT1: Untextured color-only (POS + COLOR)
    GX_SetVtxAttrFmt(GX_VTXFMT1, GX_VA_POS, GX_POS_XYZ, GX_F32, 0);
    GX_SetVtxAttrFmt(GX_VTXFMT1, GX_VA_CLR0, GX_CLR_RGBA, GX_RGBA8, 0);

    GX_SetNumChans(1);
    GX_SetChanCtrl(GX_COLOR0A0, GX_DISABLE, GX_SRC_VTX, GX_SRC_VTX, 0, GX_DF_NONE, GX_AF_NONE);

    GX_SetNumTexGens(1);
    GX_SetTexCoordGen(GX_TEXCOORD0, GX_TG_MTX2x4, GX_TG_TEX0, GX_IDENTITY);

    GX_InvVtxCache();
    GX_InvalidateTexAll();
}

void renderer_start_frame(uint32_t clear_color) {
    GXColor bg = { (u8)(clear_color >> 24), (u8)(clear_color >> 16), (u8)(clear_color >> 8), (u8)clear_color };
    GX_SetCopyClear(bg, 0x00FFFFFF);
    GX_InvVtxCache();
}

void renderer_setup_3d(float fov, float aspect, float near_z, float far_z) {
    Mtx44 proj;
    guPerspective(proj, fov, aspect, near_z, far_z);
    GX_LoadProjectionMtx(proj, GX_PERSPECTIVE);

    GX_SetZMode(GX_TRUE, GX_LEQUAL, GX_TRUE);
    GX_SetCullMode(GX_CULL_NONE);
    GX_SetColorUpdate(GX_TRUE);

    GX_SetAlphaCompare(GX_ALWAYS, 0, GX_AOP_AND, GX_ALWAYS, 0);

    GX_SetVtxDesc(GX_VA_POS, GX_DIRECT);
    GX_SetVtxDesc(GX_VA_CLR0, GX_DIRECT);
    GX_SetVtxDesc(GX_VA_TEX0, GX_DIRECT);

    GX_SetNumTexGens(1);
    GX_SetTexCoordGen(GX_TEXCOORD0, GX_TG_MTX2x4, GX_TG_TEX0, GX_IDENTITY);

    GX_SetNumTevStages(1);
    GX_SetTevOp(GX_TEVSTAGE0, GX_MODULATE);
    GX_SetTevOrder(GX_TEVSTAGE0, GX_TEXCOORD0, GX_TEXMAP0, GX_COLOR0A0);

    renderer_disable_fog();
}

void renderer_setup_camera(Vec3 pos, float yaw, float pitch) {
    float rad = yaw * DEG_TO_RAD;
    float pitch_rad = pitch * DEG_TO_RAD;

    guVector cam = { pos.x, pos.y, pos.z };
    guVector up = { 0.0f, 1.0f, 0.0f };
    guVector look = {
        pos.x + sinf(rad) * cosf(pitch_rad),
        pos.y - sinf(pitch_rad),
        pos.z - cosf(rad) * cosf(pitch_rad)
    };

    guLookAt(s_view_matrix, &cam, &up, &look);

    s_matrix_top = 0;
    guMtxIdentity(s_model_stack[0]);
    update_modelview();
}

void renderer_setup_fog(uint32_t fog_color, float near_dist, float far_dist) {
    // Disabled to prevent fog washing out voxel geometry
    renderer_disable_fog();
}

void renderer_disable_fog(void) {
    GXColor col = { 0, 0, 0, 0 };
    GX_SetFog(GX_FOG_NONE, 0.0f, 0.0f, 0.1f, 140.0f, col);
}

void renderer_push_matrix(void) {
    if (s_matrix_top < MAX_MATRIX_STACK - 1) {
        memcpy(s_model_stack[s_matrix_top + 1], s_model_stack[s_matrix_top], sizeof(Mtx));
        s_matrix_top++;
    }
}

void renderer_pop_matrix(void) {
    if (s_matrix_top > 0) {
        s_matrix_top--;
        update_modelview();
    }
}

void renderer_translate(float x, float y, float z) {
    guMtxTransApply(s_model_stack[s_matrix_top], s_model_stack[s_matrix_top], x, y, z);
    update_modelview();
}

void renderer_rotate_x(float rad) {
    Mtx rot;
    guMtxRotRad(rot, 'X', rad);
    guMtxConcat(s_model_stack[s_matrix_top], rot, s_model_stack[s_matrix_top]);
    update_modelview();
}

void renderer_rotate_y(float rad) {
    Mtx rot;
    guMtxRotRad(rot, 'Y', rad);
    guMtxConcat(s_model_stack[s_matrix_top], rot, s_model_stack[s_matrix_top]);
    update_modelview();
}

void renderer_rotate_z(float rad) {
    Mtx rot;
    guMtxRotRad(rot, 'Z', rad);
    guMtxConcat(s_model_stack[s_matrix_top], rot, s_model_stack[s_matrix_top]);
    update_modelview();
}

void renderer_scale(float sx, float sy, float sz) {
    guMtxScaleApply(s_model_stack[s_matrix_top], s_model_stack[s_matrix_top], sx, sy, sz);
    update_modelview();
}

void renderer_draw_vertices_3d(const Vertex3D* verts, int count) {
    if (!verts || count <= 0) return;

    GX_SetVtxDesc(GX_VA_TEX0, GX_DIRECT);
    GX_SetNumTevStages(1);
    GX_SetTevOp(GX_TEVSTAGE0, GX_MODULATE);
    GX_SetTevOrder(GX_TEVSTAGE0, GX_TEXCOORD0, GX_TEXMAP0, GX_COLOR0A0);

    int offset = 0;
    while (offset < count) {
        int batch = count - offset;
        if (batch > 300) batch = 300;

        GX_Begin(GX_TRIANGLES, GX_VTXFMT0, batch);
        for (int i = 0; i < batch; i++) {
            const Vertex3D* v = &verts[offset + i];
            GX_Position3f32(v->x, v->y, v->z);
            GX_Color1u32(v->color);
            GX_TexCoord2f32(v->u, v->v);
        }
        GX_End();
        offset += batch;
    }
}

void renderer_draw_box(float sx, float sy, float sz, uint32_t color) {
    GX_SetVtxDesc(GX_VA_TEX0, GX_NONE);
    GX_SetNumTevStages(1);
    GX_SetTevOp(GX_TEVSTAGE0, GX_PASSCLR);
    GX_SetTevOrder(GX_TEVSTAGE0, GX_TEXCOORDNULL, GX_TEXMAP_NULL, GX_COLOR0A0);

    float x1 = -sx / 2.0f, x2 = sx / 2.0f;
    float y1 = -sy / 2.0f, y2 = sy / 2.0f;
    float z1 = -sz / 2.0f, z2 = sz / 2.0f;

    GX_Begin(GX_QUADS, GX_VTXFMT1, 24);
    // Front
    GX_Position3f32(x1, y1, z2); GX_Color1u32(color);
    GX_Position3f32(x2, y1, z2); GX_Color1u32(color);
    GX_Position3f32(x2, y2, z2); GX_Color1u32(color);
    GX_Position3f32(x1, y2, z2); GX_Color1u32(color);
    // Back
    GX_Position3f32(x2, y1, z1); GX_Color1u32(color);
    GX_Position3f32(x1, y1, z1); GX_Color1u32(color);
    GX_Position3f32(x1, y2, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y2, z1); GX_Color1u32(color);
    // Top
    GX_Position3f32(x1, y2, z2); GX_Color1u32(color);
    GX_Position3f32(x2, y2, z2); GX_Color1u32(color);
    GX_Position3f32(x2, y2, z1); GX_Color1u32(color);
    GX_Position3f32(x1, y2, z1); GX_Color1u32(color);
    // Bottom
    GX_Position3f32(x1, y1, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y1, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y1, z2); GX_Color1u32(color);
    GX_Position3f32(x1, y1, z2); GX_Color1u32(color);
    // Left
    GX_Position3f32(x1, y1, z1); GX_Color1u32(color);
    GX_Position3f32(x1, y1, z2); GX_Color1u32(color);
    GX_Position3f32(x1, y2, z2); GX_Color1u32(color);
    GX_Position3f32(x1, y2, z1); GX_Color1u32(color);
    // Right
    GX_Position3f32(x2, y1, z2); GX_Color1u32(color);
    GX_Position3f32(x2, y1, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y2, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y2, z2); GX_Color1u32(color);
    GX_End();
}

void renderer_draw_line_3d(Vec3 p1, Vec3 p2, uint32_t color) {
    GX_SetVtxDesc(GX_VA_TEX0, GX_NONE);
    GX_SetNumTevStages(1);
    GX_SetTevOp(GX_TEVSTAGE0, GX_PASSCLR);
    GX_SetTevOrder(GX_TEVSTAGE0, GX_TEXCOORDNULL, GX_TEXMAP_NULL, GX_COLOR0A0);

    GX_LoadPosMtxImm(s_view_matrix, GX_PNMTX0);

    GX_Begin(GX_LINES, GX_VTXFMT1, 2);
    GX_Position3f32(p1.x, p1.y, p1.z); GX_Color1u32(color);
    GX_Position3f32(p2.x, p2.y, p2.z); GX_Color1u32(color);
    GX_End();

    update_modelview();
}

void renderer_draw_cube_wireframe(float x, float y, float z, float size, uint32_t color) {
    GX_SetVtxDesc(GX_VA_TEX0, GX_NONE);
    GX_SetNumTevStages(1);
    GX_SetTevOp(GX_TEVSTAGE0, GX_PASSCLR);
    GX_SetTevOrder(GX_TEVSTAGE0, GX_TEXCOORDNULL, GX_TEXMAP_NULL, GX_COLOR0A0);

    GX_LoadPosMtxImm(s_view_matrix, GX_PNMTX0);

    float x1 = x, y1 = y, z1 = z;
    float x2 = x + size, y2 = y + size, z2 = z + size;

    GX_Begin(GX_LINES, GX_VTXFMT1, 24);
    // Bottom
    GX_Position3f32(x1, y1, z1); GX_Color1u32(color); GX_Position3f32(x2, y1, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y1, z1); GX_Color1u32(color); GX_Position3f32(x2, y1, z2); GX_Color1u32(color);
    GX_Position3f32(x2, y1, z2); GX_Color1u32(color); GX_Position3f32(x1, y1, z2); GX_Color1u32(color);
    GX_Position3f32(x1, y1, z2); GX_Color1u32(color); GX_Position3f32(x1, y1, z1); GX_Color1u32(color);
    // Top
    GX_Position3f32(x1, y2, z1); GX_Color1u32(color); GX_Position3f32(x2, y2, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y2, z1); GX_Color1u32(color); GX_Position3f32(x2, y2, z2); GX_Color1u32(color);
    GX_Position3f32(x2, y2, z2); GX_Color1u32(color); GX_Position3f32(x1, y2, z2); GX_Color1u32(color);
    GX_Position3f32(x1, y2, z2); GX_Color1u32(color); GX_Position3f32(x1, y2, z1); GX_Color1u32(color);
    // Verticals
    GX_Position3f32(x1, y1, z1); GX_Color1u32(color); GX_Position3f32(x1, y2, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y1, z1); GX_Color1u32(color); GX_Position3f32(x2, y2, z1); GX_Color1u32(color);
    GX_Position3f32(x2, y1, z2); GX_Color1u32(color); GX_Position3f32(x2, y2, z2); GX_Color1u32(color);
    GX_Position3f32(x1, y1, z2); GX_Color1u32(color); GX_Position3f32(x1, y2, z2); GX_Color1u32(color);
    GX_End();

    update_modelview();
}

void renderer_setup_2d(void) {
    Mtx44 ortho;
    guOrtho(ortho, 0.0f, (float)SCREEN_HEIGHT, 0.0f, (float)SCREEN_WIDTH, 0.0f, 1000.0f);
    GX_LoadProjectionMtx(ortho, GX_ORTHOGRAPHIC);

    Mtx identity;
    guMtxIdentity(identity);
    GX_LoadPosMtxImm(identity, GX_PNMTX0);

    GX_SetZMode(GX_FALSE, GX_ALWAYS, GX_FALSE);
    GX_SetCullMode(GX_CULL_NONE);
    renderer_disable_fog();
}

void renderer_draw_rect_2d(int x1, int y1, int x2, int y2, uint32_t color) {
    GX_SetVtxDesc(GX_VA_TEX0, GX_NONE);
    GX_SetNumTevStages(1);
    GX_SetTevOp(GX_TEVSTAGE0, GX_PASSCLR);
    GX_SetTevOrder(GX_TEVSTAGE0, GX_TEXCOORDNULL, GX_TEXMAP_NULL, GX_COLOR0A0);

    GX_Begin(GX_QUADS, GX_VTXFMT1, 4);
    GX_Position3f32((float)x1, (float)y1, 0.0f); GX_Color1u32(color);
    GX_Position3f32((float)x2, (float)y1, 0.0f); GX_Color1u32(color);
    GX_Position3f32((float)x2, (float)y2, 0.0f); GX_Color1u32(color);
    GX_Position3f32((float)x1, (float)y2, 0.0f); GX_Color1u32(color);
    GX_End();
}

void renderer_draw_sprite_2d(int x, int y, int w, int h, float u0, float v0, float u1, float v1, uint32_t color) {
    textures_bind();
    GX_SetVtxDesc(GX_VA_TEX0, GX_DIRECT);
    GX_SetNumTevStages(1);
    GX_SetTevOp(GX_TEVSTAGE0, GX_MODULATE);
    GX_SetTevOrder(GX_TEVSTAGE0, GX_TEXCOORD0, GX_TEXMAP0, GX_COLOR0A0);

    GX_Begin(GX_QUADS, GX_VTXFMT0, 4);
    GX_Position3f32((float)x, (float)y, 0.0f);         GX_Color1u32(color); GX_TexCoord2f32(u0, v0);
    GX_Position3f32((float)(x + w), (float)y, 0.0f);   GX_Color1u32(color); GX_TexCoord2f32(u1, v0);
    GX_Position3f32((float)(x + w), (float)(y + h), 0.0f); GX_Color1u32(color); GX_TexCoord2f32(u1, v1);
    GX_Position3f32((float)x, (float)(y + h), 0.0f);   GX_Color1u32(color); GX_TexCoord2f32(u0, v1);
    GX_End();
}

void renderer_end_frame(void) {
    GX_SetZMode(GX_TRUE, GX_LEQUAL, GX_TRUE);
    GX_SetColorUpdate(GX_TRUE);
    GX_CopyDisp(s_xfb[s_which_fb], GX_TRUE);
    GX_DrawDone();

    VIDEO_SetNextFramebuffer(s_xfb[s_which_fb]);
    VIDEO_Flush();
    VIDEO_WaitVSync();
    s_which_fb ^= 1;
}

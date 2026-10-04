#include "renderer.h"
#include "textures.h"

SDL_Window* g_window = NULL;
static SDL_GLContext s_gl_context = NULL;
int g_win_width = WINDOW_WIDTH;
int g_win_height = WINDOW_HEIGHT;

void renderer_init(void) {
    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_AUDIO | SDL_INIT_GAMECONTROLLER | SDL_INIT_TIMER) < 0) {
        fprintf(stderr, "SDL_Init failed: %s\n", SDL_GetError());
        exit(1);
    }

    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 24);
    SDL_GL_SetAttribute(SDL_GL_RED_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_GREEN_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_BLUE_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_ALPHA_SIZE, 8);

    g_window = SDL_CreateWindow(
        "Eblankraft 2.0 (PC Native)",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        WINDOW_WIDTH, WINDOW_HEIGHT,
        SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_SHOWN
    );

    if (!g_window) {
        fprintf(stderr, "SDL_CreateWindow failed: %s\n", SDL_GetError());
        exit(1);
    }

    s_gl_context = SDL_GL_CreateContext(g_window);
    if (!s_gl_context) {
        fprintf(stderr, "SDL_GL_CreateContext failed: %s\n", SDL_GetError());
        exit(1);
    }

    // Enable VSync
    SDL_GL_SetSwapInterval(1);

    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LEQUAL);

    glEnable(GL_ALPHA_TEST);
    glAlphaFunc(GL_GREATER, 0.1f);

    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

    glShadeModel(GL_FLAT);

    textures_init();
}

void renderer_start_frame(uint32_t clear_color) {
    SDL_GetWindowSize(g_window, &g_win_width, &g_win_height);
    glViewport(0, 0, g_win_width, g_win_height);

    float r = (float)(clear_color & 0xFF) / 255.0f;
    float g = (float)((clear_color >> 8) & 0xFF) / 255.0f;
    float b = (float)((clear_color >> 16) & 0xFF) / 255.0f;
    float a = (float)((clear_color >> 24) & 0xFF) / 255.0f;

    glClearColor(r, g, b, a);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
}

void renderer_setup_3d(float fov, float aspect, float near_z, float far_z) {
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluPerspective(fov, aspect, near_z, far_z);

    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();

    glEnable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE);
    glEnable(GL_TEXTURE_2D);
}

void renderer_setup_camera(Vec3 pos, float yaw, float pitch) {
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();

    // Pitch (look up/down)
    glRotatef(pitch, 1.0f, 0.0f, 0.0f);
    // Yaw (look left/right)
    glRotatef(yaw, 0.0f, 1.0f, 0.0f);
    // Position
    glTranslatef(-pos.x, -pos.y, -pos.z);
}

void renderer_setup_fog(uint32_t fog_color, float near_dist, float far_dist) {
    glEnable(GL_FOG);
    glFogi(GL_FOG_MODE, GL_LINEAR);
    glFogf(GL_FOG_START, near_dist);
    glFogf(GL_FOG_END, far_dist);

    GLfloat col[4] = {
        (float)(fog_color & 0xFF) / 255.0f,
        (float)((fog_color >> 8) & 0xFF) / 255.0f,
        (float)((fog_color >> 16) & 0xFF) / 255.0f,
        (float)((fog_color >> 24) & 0xFF) / 255.0f
    };
    glFogfv(GL_FOG_COLOR, col);
}

void renderer_disable_fog(void) {
    glDisable(GL_FOG);
}

void renderer_push_matrix(void) {
    glPushMatrix();
}

void renderer_pop_matrix(void) {
    glPopMatrix();
}

void renderer_translate(float x, float y, float z) {
    glTranslatef(x, y, z);
}

void renderer_rotate_x(float rad) {
    glRotatef(rad * RAD_TO_DEG, 1.0f, 0.0f, 0.0f);
}

void renderer_rotate_y(float rad) {
    glRotatef(rad * RAD_TO_DEG, 0.0f, 1.0f, 0.0f);
}

void renderer_rotate_z(float rad) {
    glRotatef(rad * RAD_TO_DEG, 0.0f, 0.0f, 1.0f);
}

void renderer_scale(float sx, float sy, float sz) {
    glScalef(sx, sy, sz);
}

void renderer_draw_vertices_3d(const Vertex3D* verts, int count) {
    if (!verts || count <= 0) return;

    glEnable(GL_TEXTURE_2D);
    glBegin(GL_TRIANGLES);
    for (int i = 0; i < count; i++) {
        glColor4ubv((const GLubyte*)&verts[i].color);
        glTexCoord2f(verts[i].u, verts[i].v);
        glVertex3f(verts[i].x, verts[i].y, verts[i].z);
    }
    glEnd();
}

void renderer_draw_box(float sx, float sy, float sz, uint32_t color) {
    glDisable(GL_TEXTURE_2D);
    glColor4ubv((const GLubyte*)&color);

    float x1 = -sx / 2.0f, x2 = sx / 2.0f;
    float y1 = -sy / 2.0f, y2 = sy / 2.0f;
    float z1 = -sz / 2.0f, z2 = sz / 2.0f;

    glBegin(GL_QUADS);
    // Front
    glVertex3f(x1, y1, z2); glVertex3f(x2, y1, z2);
    glVertex3f(x2, y2, z2); glVertex3f(x1, y2, z2);
    // Back
    glVertex3f(x2, y1, z1); glVertex3f(x1, y1, z1);
    glVertex3f(x1, y2, z1); glVertex3f(x2, y2, z1);
    // Top
    glVertex3f(x1, y2, z2); glVertex3f(x2, y2, z2);
    glVertex3f(x2, y2, z1); glVertex3f(x1, y2, z1);
    // Bottom
    glVertex3f(x1, y1, z1); glVertex3f(x2, y1, z1);
    glVertex3f(x2, y1, z2); glVertex3f(x1, y1, z2);
    // Left
    glVertex3f(x1, y1, z1); glVertex3f(x1, y1, z2);
    glVertex3f(x1, y2, z2); glVertex3f(x1, y2, z1);
    // Right
    glVertex3f(x2, y1, z2); glVertex3f(x2, y1, z1);
    glVertex3f(x2, y2, z1); glVertex3f(x2, y2, z2);
    glEnd();

    glEnable(GL_TEXTURE_2D);
}

void renderer_draw_line_3d(Vec3 p1, Vec3 p2, uint32_t color) {
    glDisable(GL_TEXTURE_2D);
    glColor4ubv((const GLubyte*)&color);
    glLineWidth(2.5f);

    glBegin(GL_LINES);
    glVertex3f(p1.x, p1.y, p1.z);
    glVertex3f(p2.x, p2.y, p2.z);
    glEnd();

    glLineWidth(1.0f);
    glEnable(GL_TEXTURE_2D);
}

void renderer_draw_cube_wireframe(float x, float y, float z, float size, uint32_t color) {
    glDisable(GL_TEXTURE_2D);
    glColor4ubv((const GLubyte*)&color);
    glLineWidth(2.0f);

    float x1 = x, y1 = y, z1 = z;
    float x2 = x + size, y2 = y + size, z2 = z + size;

    glBegin(GL_LINES);
    // Bottom
    glVertex3f(x1, y1, z1); glVertex3f(x2, y1, z1);
    glVertex3f(x2, y1, z1); glVertex3f(x2, y1, z2);
    glVertex3f(x2, y1, z2); glVertex3f(x1, y1, z2);
    glVertex3f(x1, y1, z2); glVertex3f(x1, y1, z1);
    // Top
    glVertex3f(x1, y2, z1); glVertex3f(x2, y2, z1);
    glVertex3f(x2, y2, z1); glVertex3f(x2, y2, z2);
    glVertex3f(x2, y2, z2); glVertex3f(x1, y2, z2);
    glVertex3f(x1, y2, z2); glVertex3f(x1, y2, z1);
    // Verticals
    glVertex3f(x1, y1, z1); glVertex3f(x1, y2, z1);
    glVertex3f(x2, y1, z1); glVertex3f(x2, y2, z1);
    glVertex3f(x2, y1, z2); glVertex3f(x2, y2, z2);
    glVertex3f(x1, y1, z2); glVertex3f(x1, y2, z2);
    glEnd();

    glLineWidth(1.0f);
    glEnable(GL_TEXTURE_2D);
}

void renderer_setup_2d(void) {
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(0.0, (double)SCREEN_WIDTH, (double)SCREEN_HEIGHT, 0.0);

    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();

    glDisable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE);
    glDisable(GL_FOG);
}

void renderer_draw_rect_2d(int x1, int y1, int x2, int y2, uint32_t color) {
    glDisable(GL_TEXTURE_2D);
    glColor4ubv((const GLubyte*)&color);

    glBegin(GL_QUADS);
    glVertex2i(x1, y1);
    glVertex2i(x2, y1);
    glVertex2i(x2, y2);
    glVertex2i(x1, y2);
    glEnd();
}

void renderer_draw_sprite_2d(int x, int y, int w, int h, float u0, float v0, float u1, float v1, uint32_t color) {
    textures_bind();
    glEnable(GL_TEXTURE_2D);
    glColor4ubv((const GLubyte*)&color);

    glBegin(GL_QUADS);
    glTexCoord2f(u0, v0); glVertex2i(x, y);
    glTexCoord2f(u1, v0); glVertex2i(x + w, y);
    glTexCoord2f(u1, v1); glVertex2i(x + w, y + h);
    glTexCoord2f(u0, v1); glVertex2i(x, y + h);
    glEnd();
}

void renderer_end_frame(void) {
    SDL_GL_SwapWindow(g_window);
}

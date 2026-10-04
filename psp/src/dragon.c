#include "dragon.h"
#include "renderer.h"
#include "world.h"
#include "player.h"
#include "audio.h"
#include <math.h>

Dragon g_dragon;

static void draw_box(float sx, float sy, float sz, uint32_t color) {
    if (g_dragon.hurt_time > 0.0f) {
        color = RGB(245, 45, 45);
    }
    sceGuDisable(GU_TEXTURE_2D);

    ColorVertex3D* v = (ColorVertex3D*)sceGuGetMemory(36 * sizeof(ColorVertex3D));
    if (!v) return;

    float x1 = -sx / 2.0f, x2 = sx / 2.0f;
    float y1 = -sy / 2.0f, y2 = sy / 2.0f;
    float z1 = -sz / 2.0f, z2 = sz / 2.0f;

    ColorVertex3D box_verts[36] = {
        // Front
        {color, x1, y1, z2}, {color, x2, y1, z2}, {color, x2, y2, z2},
        {color, x1, y1, z2}, {color, x2, y2, z2}, {color, x1, y2, z2},
        // Back
        {color, x2, y1, z1}, {color, x1, y1, z1}, {color, x1, y2, z1},
        {color, x2, y1, z1}, {color, x1, y2, z1}, {color, x2, y2, z1},
        // Top
        {color, x1, y2, z2}, {color, x2, y2, z2}, {color, x2, y2, z1},
        {color, x1, y2, z2}, {color, x2, y2, z1}, {color, x1, y2, z1},
        // Bottom
        {color, x1, y1, z1}, {color, x2, y1, z1}, {color, x2, y1, z2},
        {color, x1, y1, z1}, {color, x2, y1, z2}, {color, x1, y1, z2},
        // Left
        {color, x1, y1, z1}, {color, x1, y1, z2}, {color, x1, y2, z2},
        {color, x1, y1, z1}, {color, x1, y2, z2}, {color, x1, y2, z1},
        // Right
        {color, x2, y1, z2}, {color, x2, y1, z1}, {color, x2, y2, z1},
        {color, x2, y1, z2}, {color, x2, y2, z1}, {color, x2, y2, z2},
    };

    memcpy(v, box_verts, sizeof(box_verts));
    sceGumDrawArray(GU_TRIANGLES, GU_COLOR_8888 | GU_VERTEX_32BITF | GU_TRANSFORM_3D, 36, 0, v);
    sceGuEnable(GU_TEXTURE_2D);
}

void dragon_init(void) {
    g_dragon.max_hp = 1000;
    g_dragon.hp = 1000;
    g_dragon.is_alive = true;
    g_dragon.pos = (Vec3){ WORLD_SIZE_X / 2.0f, 40.0f, WORLD_SIZE_Z / 2.0f };
    g_dragon.vel = (Vec3){0, 0, 0};
    g_dragon.yaw = 0.0f;
    g_dragon.pitch = 0.0f;
    g_dragon.wing_angle = 0.0f;
    g_dragon.wing_speed = 6.0f;
    g_dragon.is_swooping = false;
    g_dragon.state_timer = 0.0f;
    g_dragon.fireball_active = false;
}

void dragon_update(float dt, Vec3 player_pos) {
    if (!g_dragon.is_alive) return;

    g_dragon.wing_angle += g_dragon.wing_speed * dt;
    g_dragon.state_timer += dt;
    if (g_dragon.hurt_time > 0.0f) g_dragon.hurt_time -= dt;

    float center_x = WORLD_SIZE_X / 2.0f;
    float center_z = WORLD_SIZE_Z / 2.0f;

    // AI State machine
    if (!g_dragon.is_swooping) {
        // Circle around the center of the End island
        float radius = 22.0f;
        float angle = g_dragon.state_timer * 0.4f;
        float target_x = center_x + cosf(angle) * radius;
        float target_z = center_z + sinf(angle) * radius;
        float target_y = 38.0f + sinf(angle * 2.0f) * 4.0f;

        g_dragon.pos.x += (target_x - g_dragon.pos.x) * dt * 1.5f;
        g_dragon.pos.y += (target_y - g_dragon.pos.y) * dt * 1.5f;
        g_dragon.pos.z += (target_z - g_dragon.pos.z) * dt * 1.5f;

        // Yaw points along flight path
        g_dragon.yaw = (-angle * RAD_TO_DEG) + 90.0f;

        // Switch to swoop every 12 seconds
        if (g_dragon.state_timer > 12.0f) {
            g_dragon.is_swooping = true;
            g_dragon.state_timer = 0.0f;

            // Launch fireball towards player!
            g_dragon.fireball_active = true;
            g_dragon.fireball_pos = g_dragon.pos;
            float dx = player_pos.x - g_dragon.pos.x;
            float dy = (player_pos.y + 1.0f) - g_dragon.pos.y;
            float dz = player_pos.z - g_dragon.pos.z;
            float dist = sqrtf(dx*dx + dy*dy + dz*dz);
            if (dist > 0.1f) {
                float fspeed = 14.0f;
                g_dragon.fireball_vel = (Vec3){ (dx/dist)*fspeed, (dy/dist)*fspeed, (dz/dist)*fspeed };
            }
        }
    } else {
        // Swoop down towards player
        Vec3 target = player_pos;
        target.y += 2.0f;

        g_dragon.pos.x += (target.x - g_dragon.pos.x) * dt * 2.2f;
        g_dragon.pos.y += (target.y - g_dragon.pos.y) * dt * 2.2f;
        g_dragon.pos.z += (target.z - g_dragon.pos.z) * dt * 2.2f;

        // Check if hit player
        float dx = player_pos.x - g_dragon.pos.x;
        float dy = player_pos.y - g_dragon.pos.y;
        float dz = player_pos.z - g_dragon.pos.z;
        if (sqrtf(dx*dx + dy*dy + dz*dz) < 3.5f) {
            player_damage(35); // Dragon swoop bite!
            g_dragon.is_swooping = false;
            g_dragon.state_timer = 0.0f;
        }

        if (g_dragon.state_timer > 6.0f) {
            g_dragon.is_swooping = false;
            g_dragon.state_timer = 0.0f;
        }
    }

    // Update Fireball
    if (g_dragon.fireball_active) {
        g_dragon.fireball_pos.x += g_dragon.fireball_vel.x * dt;
        g_dragon.fireball_pos.y += g_dragon.fireball_vel.y * dt;
        g_dragon.fireball_pos.z += g_dragon.fireball_vel.z * dt;

        // Check player collision with fireball
        float fdx = player_pos.x - g_dragon.fireball_pos.x;
        float fdy = (player_pos.y + 1.0f) - g_dragon.fireball_pos.y;
        float fdz = player_pos.z - g_dragon.fireball_pos.z;
        if (sqrtf(fdx*fdx + fdy*fdy + fdz*fdz) < 1.8f) {
            audio_play(SOUND_EXPLOSION);
            player_damage(40); // Explosive damage!
            g_dragon.fireball_active = false;
        }

        // Fireball hits ground or expires
        if (g_dragon.fireball_pos.y <= 10.0f || g_dragon.fireball_pos.y >= 70.0f) {
            g_dragon.fireball_active = false;
        }
    }
}

void dragon_damage(int amount) {
    if (!g_dragon.is_alive) return;
    g_dragon.hp -= amount;
    g_dragon.hurt_time = 0.35f;
    audio_play(SOUND_HURT);
    if (g_dragon.hp <= 0) {
        g_dragon.hp = 0;
        g_dragon.is_alive = false;
        audio_play(SOUND_EXPLOSION);
        // Victory drops!
        g_player.hotbar[7] = (ItemStack){ ITEM_CASE_DRAGON, 5 };
        g_player.hotbar[8] = (ItemStack){ ITEM_DRAGON_EGG, 1 };
    }
}

void dragon_render(void) {
    if (!g_dragon.is_alive) return;

    sceGumPushMatrix();

    ScePspFVector3 pos = { g_dragon.pos.x, g_dragon.pos.y, g_dragon.pos.z };
    sceGumTranslate(&pos);
    sceGumRotateY(g_dragon.yaw * DEG_TO_RAD);

    // 1. Dragon Body (Dark purple/black)
    uint32_t body_col = RGB(35, 15, 45);
    draw_box(2.2f, 1.6f, 4.2f, body_col);

    // 2. Dragon Neck & Head
    sceGumPushMatrix();
    ScePspFVector3 head_offset = { 0.0f, 0.8f, 2.8f };
    sceGumTranslate(&head_offset);
    uint32_t head_col = RGB(45, 20, 55);
    draw_box(1.4f, 1.4f, 1.8f, head_col);

    // Glowing purple eyes
    sceGumPushMatrix();
    ScePspFVector3 eye1_offset = { -0.5f, 0.3f, 0.9f };
    sceGumTranslate(&eye1_offset);
    draw_box(0.25f, 0.25f, 0.1f, RGB(220, 50, 255));
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 eye2_offset = { 0.5f, 0.3f, 0.9f };
    sceGumTranslate(&eye2_offset);
    draw_box(0.25f, 0.25f, 0.1f, RGB(220, 50, 255));
    sceGumPopMatrix();

    // Horns
    sceGumPushMatrix();
    ScePspFVector3 horn_offset = { 0.0f, 0.9f, -0.4f };
    sceGumTranslate(&horn_offset);
    draw_box(1.2f, 0.4f, 0.8f, RGB(20, 10, 25));
    sceGumPopMatrix();

    sceGumPopMatrix();

    // 3. Left Wing (Flapping)
    float wing_rot = sinf(g_dragon.wing_angle) * 35.0f;

    sceGumPushMatrix();
    ScePspFVector3 lwing_offset = { -1.4f, 0.5f, 0.2f };
    sceGumTranslate(&lwing_offset);
    sceGumRotateZ(-wing_rot * DEG_TO_RAD);
    ScePspFVector3 lwing_box_off = { -2.0f, 0.0f, 0.0f };
    sceGumTranslate(&lwing_box_off);
    draw_box(4.0f, 0.15f, 2.5f, RGB(30, 10, 40));
    sceGumPopMatrix();

    // 4. Right Wing (Flapping)
    sceGumPushMatrix();
    ScePspFVector3 rwing_offset = { 1.4f, 0.5f, 0.2f };
    sceGumTranslate(&rwing_offset);
    sceGumRotateZ(wing_rot * DEG_TO_RAD);
    ScePspFVector3 rwing_box_off = { 2.0f, 0.0f, 0.0f };
    sceGumTranslate(&rwing_box_off);
    draw_box(4.0f, 0.15f, 2.5f, RGB(30, 10, 40));
    sceGumPopMatrix();

    // 5. Tail
    for (int t = 1; t <= 3; t++) {
        sceGumPushMatrix();
        ScePspFVector3 tail_offset = { 0.0f, 0.0f, -2.0f - (float)t * 1.2f };
        sceGumTranslate(&tail_offset);
        draw_box(1.0f - t * 0.2f, 0.8f - t * 0.15f, 1.2f, body_col);
        sceGumPopMatrix();
    }

    sceGumPopMatrix();

    // Render Fireball if active
    if (g_dragon.fireball_active) {
        sceGumPushMatrix();
        ScePspFVector3 fb_pos = { g_dragon.fireball_pos.x, g_dragon.fireball_pos.y, g_dragon.fireball_pos.z };
        sceGumTranslate(&fb_pos);
        draw_box(0.8f, 0.8f, 0.8f, RGB(255, 80, 220));
        sceGumPopMatrix();
    }
}

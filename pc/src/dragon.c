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
    renderer_draw_box(sx, sy, sz, color);
}

void dragon_init(void) {
    g_dragon.max_hp = 1000;
    g_dragon.hp = 1000;
    g_dragon.is_alive = true;
    g_dragon.pos = (Vec3){ WORLD_SIZE_X / 2.0f, 40.0f, WORLD_SIZE_Z / 2.0f };
    g_dragon.vel = (Vec3){ 0, 0, 0 };
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

    // Flight AI: Circle arena and swoop down at player
    if (!g_dragon.is_swooping) {
        float circle_radius = 28.0f;
        float circle_speed = 0.45f;
        float target_x = center_x + cosf(g_dragon.state_timer * circle_speed) * circle_radius;
        float target_z = center_z + sinf(g_dragon.state_timer * circle_speed) * circle_radius;
        float target_y = 38.0f + sinf(g_dragon.state_timer * 1.5f) * 4.0f;

        float dx = target_x - g_dragon.pos.x;
        float dy = target_y - g_dragon.pos.y;
        float dz = target_z - g_dragon.pos.z;

        g_dragon.pos.x += dx * dt * 1.8f;
        g_dragon.pos.y += dy * dt * 1.8f;
        g_dragon.pos.z += dz * dt * 1.8f;

        g_dragon.yaw = atan2f(dx, dz) * RAD_TO_DEG;

        // Swoop every 12 seconds
        if (g_dragon.state_timer > 12.0f) {
            g_dragon.is_swooping = true;
            g_dragon.state_timer = 0.0f;

            // Shoot Fireball!
            g_dragon.fireball_active = true;
            g_dragon.fireball_pos = g_dragon.pos;
            float fdx = player_pos.x - g_dragon.pos.x;
            float fdy = (player_pos.y + 1.0f) - g_dragon.pos.y;
            float fdz = player_pos.z - g_dragon.pos.z;
            float fdist = sqrtf(fdx * fdx + fdy * fdy + fdz * fdz);
            if (fdist > 0.1f) {
                g_dragon.fireball_vel.x = (fdx / fdist) * 14.0f;
                g_dragon.fireball_vel.y = (fdy / fdist) * 14.0f;
                g_dragon.fireball_vel.z = (fdz / fdist) * 14.0f;
            }
        }
    } else {
        // Swooping towards player
        float dx = player_pos.x - g_dragon.pos.x;
        float dy = (player_pos.y + 2.0f) - g_dragon.pos.y;
        float dz = player_pos.z - g_dragon.pos.z;
        float dist = sqrtf(dx * dx + dy * dy + dz * dz);

        if (dist > 2.0f) {
            g_dragon.pos.x += (dx / dist) * 16.0f * dt;
            g_dragon.pos.y += (dy / dist) * 16.0f * dt;
            g_dragon.pos.z += (dz / dist) * 16.0f * dt;
            g_dragon.yaw = atan2f(dx, dz) * RAD_TO_DEG;
        }

        // Damage player on close pass
        if (dist < 3.5f) {
            player_damage(35);
        }

        // End swoop after 4 seconds
        if (g_dragon.state_timer > 4.0f) {
            g_dragon.is_swooping = false;
            g_dragon.state_timer = 0.0f;
        }
    }

    // Update Fireball
    if (g_dragon.fireball_active) {
        g_dragon.fireball_pos.x += g_dragon.fireball_vel.x * dt;
        g_dragon.fireball_pos.y += g_dragon.fireball_vel.y * dt;
        g_dragon.fireball_pos.z += g_dragon.fireball_vel.z * dt;

        float fdx = player_pos.x - g_dragon.fireball_pos.x;
        float fdy = (player_pos.y + 1.0f) - g_dragon.fireball_pos.y;
        float fdz = player_pos.z - g_dragon.fireball_pos.z;
        float fdist = sqrtf(fdx * fdx + fdy * fdy + fdz * fdz);

        if (fdist < 1.8f) {
            player_damage(40);
            audio_play(SOUND_EXPLOSION);
            g_dragon.fireball_active = false;
        } else if (g_dragon.fireball_pos.y < 1.0f) {
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
        g_player.hotbar[7] = (ItemStack){ ITEM_CASE_DRAGON, 5 };
        g_player.hotbar[8] = (ItemStack){ ITEM_DRAGON_EGG, 1 };
    }
}

void dragon_render(void) {
    if (!g_dragon.is_alive) return;

    renderer_push_matrix();
    renderer_translate(g_dragon.pos.x, g_dragon.pos.y, g_dragon.pos.z);
    renderer_rotate_y(g_dragon.yaw * DEG_TO_RAD);

    // 1. Dragon Body
    uint32_t body_col = RGB(35, 15, 45);
    draw_box(2.2f, 1.6f, 4.2f, body_col);

    // 2. Dragon Neck & Head
    renderer_push_matrix();
    renderer_translate(0.0f, 0.8f, 2.8f);
    uint32_t head_col = RGB(45, 20, 55);
    draw_box(1.4f, 1.4f, 1.8f, head_col);

    // Glowing purple eyes
    renderer_push_matrix();
    renderer_translate(-0.5f, 0.3f, 0.9f);
    draw_box(0.25f, 0.25f, 0.1f, RGB(220, 50, 255));
    renderer_pop_matrix();

    renderer_push_matrix();
    renderer_translate(0.5f, 0.3f, 0.9f);
    draw_box(0.25f, 0.25f, 0.1f, RGB(220, 50, 255));
    renderer_pop_matrix();

    // Horns
    renderer_push_matrix();
    renderer_translate(0.0f, 0.9f, -0.4f);
    draw_box(1.2f, 0.4f, 0.8f, RGB(20, 10, 25));
    renderer_pop_matrix();

    renderer_pop_matrix();

    // 3. Left Wing
    float wing_rot = sinf(g_dragon.wing_angle) * 35.0f;

    renderer_push_matrix();
    renderer_translate(-1.4f, 0.5f, 0.2f);
    renderer_rotate_z(-wing_rot * DEG_TO_RAD);
    renderer_translate(-2.0f, 0.0f, 0.0f);
    draw_box(4.0f, 0.15f, 2.5f, RGB(30, 10, 40));
    renderer_pop_matrix();

    // 4. Right Wing
    renderer_push_matrix();
    renderer_translate(1.4f, 0.5f, 0.2f);
    renderer_rotate_z(wing_rot * DEG_TO_RAD);
    renderer_translate(2.0f, 0.0f, 0.0f);
    draw_box(4.0f, 0.15f, 2.5f, RGB(30, 10, 40));
    renderer_pop_matrix();

    // 5. Tail
    for (int t = 1; t <= 3; t++) {
        renderer_push_matrix();
        renderer_translate(0.0f, 0.0f, -2.0f - (float)t * 1.2f);
        draw_box(1.0f - t * 0.2f, 0.8f - t * 0.15f, 1.2f, body_col);
        renderer_pop_matrix();
    }

    renderer_pop_matrix();

    // Fireball
    if (g_dragon.fireball_active) {
        renderer_push_matrix();
        renderer_translate(g_dragon.fireball_pos.x, g_dragon.fireball_pos.y, g_dragon.fireball_pos.z);
        draw_box(0.8f, 0.8f, 0.8f, RGB(255, 80, 220));
        renderer_pop_matrix();
    }
}

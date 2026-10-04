#include "common.h"
#include "renderer.h"
#include "pad.h"
#include "textures.h"
#include "font.h"
#include "blocks.h"
#include "items.h"
#include "world.h"
#include "player.h"
#include "dragon.h"
#include "mobs.h"
#include "cases.h"
#include "ui.h"
#include "audio.h"

int main(int argc, char* argv[]) {
    srand(1337);

    // Initialize subsystems
    renderer_init();
    pad_init();
    audio_init();
    font_init();
    textures_init();
    world_init(DIMENSION_OVERWORLD);
    player_init();
    dragon_init();
    mobs_init(DIMENSION_OVERWORLD);
    cases_init();
    ui_init();

    u64 last_tick = gettime();

    while (1) {
        u64 cur_tick = gettime();
        u64 diff = diff_ticks(last_tick, cur_tick);
        float dt = (float)ticks_to_microsecs(diff) / 1000000.0f;
        if (dt > 0.1f) dt = 0.1f;
        if (dt < 0.001f) dt = 0.001f;
        last_tick = cur_tick;

        pad_update();

        // 1. Update UI and menus
        ui_update(dt, &g_pad);

        // 2. Update gameplay
        if (g_ui.state == UI_STATE_GAME) {
            player_update(dt, &g_pad);
            mobs_update(dt, g_player.pos);

            if (g_world.current_dimension == DIMENSION_END) {
                dragon_update(dt, g_player.pos);
            }
        }

        // 3. Render 3D Scene
        renderer_start_frame(g_world.sky_color);

        renderer_setup_3d(60.0f, (float)SCREEN_WIDTH / (float)SCREEN_HEIGHT, 0.1f, 140.0f);
        Vec3 cam_pos = g_player.pos;
        cam_pos.y += 1.62f;
        renderer_setup_camera(cam_pos, g_player.yaw, g_player.pitch);

        // Render Voxel World
        world_render(cam_pos);

        // Render Mobs & Drops
        mobs_render();

        // Render Dragon & Crystals in The End
        if (g_world.current_dimension == DIMENSION_END) {
            dragon_render();
            mobs_render_crystals_and_beam(g_dragon.pos);
        }

        // Render target block outline wireframe
        if (g_player.has_target) {
            renderer_draw_cube_wireframe(
                (float)g_player.target_block.x,
                (float)g_player.target_block.y,
                (float)g_player.target_block.z,
                1.002f, RGB(255, 255, 255)
            );
        }

        // 4. Render 2D HUD / Menus
        ui_render();

        renderer_end_frame();
    }

    audio_term();
    return 0;
}

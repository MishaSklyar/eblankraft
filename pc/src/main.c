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
    (void)argc;
    (void)argv;
    srand(1337);

    // Initialize subsystems
    renderer_init();
    pad_init();
    audio_init();
    font_init();
    world_init(DIMENSION_OVERWORLD);
    player_init();
    dragon_init();
    mobs_init(DIMENSION_OVERWORLD);
    cases_init();
    ui_init();

    printf("=========================================\n");
    printf("  Eblankraft 2.0 (PC Native Edition)\n");
    printf("  OpenGL + SDL2 Engine Running!\n");
    printf("=========================================\n");

    Uint64 perf_freq = SDL_GetPerformanceFrequency();
    Uint64 last_counter = SDL_GetPerformanceCounter();

    while (1) {
        Uint64 cur_counter = SDL_GetPerformanceCounter();
        float dt = (float)(cur_counter - last_counter) / (float)perf_freq;
        if (dt > 0.1f) dt = 0.1f;
        if (dt < 0.001f) dt = 0.001f;
        last_counter = cur_counter;

        pad_update();
        if (g_pad.quit_requested) {
            break;
        }

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

        float aspect = (float)g_win_width / (float)g_win_height;
        renderer_setup_3d(60.0f, aspect, 0.1f, 160.0f);

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
    SDL_Quit();
    return 0;
}

#include "common.h"
#include "renderer.h"
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

PSP_MODULE_INFO("Eblankraft", 0, 1, 0);
PSP_MAIN_THREAD_ATTR(THREAD_ATTR_USER | THREAD_ATTR_VFPU);

static int g_running = 1;

static int exit_callback(int arg1, int arg2, void *common) {
    g_running = 0;
    sceKernelExitGame();
    return 0;
}

static int callback_thread(SceSize args, void *argp) {
    int cbid = sceKernelCreateCallback("Exit Callback", exit_callback, NULL);
    sceKernelRegisterExitCallback(cbid);
    sceKernelSleepThreadCB();
    return 0;
}

static int setup_callbacks(void) {
    int thid = sceKernelCreateThread("update_thread", callback_thread, 0x11, 0xFA0, 0, 0);
    if (thid >= 0) {
        sceKernelStartThread(thid, 0, 0);
    }
    return thid;
}

int main(int argc, char* argv[]) {
    setup_callbacks();

    // 333MHz native clock speed
    scePowerSetClockFrequency(333, 333, 166);

    // PSP Controls
    sceCtrlSetSamplingCycle(0);
    sceCtrlSetSamplingMode(PSP_CTRL_MODE_ANALOG);

    srand(1337);

    // Subsystems initialization
    renderer_init();
    font_init();
    textures_init();
    world_init(DIMENSION_OVERWORLD);
    player_init();
    dragon_init();
    mobs_init(DIMENSION_OVERWORLD);
    cases_init();
    ui_init();
    audio_init();

    u64 last_tick = 0;
    u64 tick_res = sceRtcGetTickResolution();
    sceRtcGetCurrentTick(&last_tick);

    SceCtrlData pad;

    while (g_running) {
        u64 cur_tick;
        sceRtcGetCurrentTick(&cur_tick);
        float dt = (float)(cur_tick - last_tick) / (float)tick_res;
        if (dt > 0.1f) dt = 0.1f;
        if (dt < 0.001f) dt = 0.001f;
        last_tick = cur_tick;

        sceCtrlReadBufferPositive(&pad, 1);

        // 1. Update UI and menus
        ui_update(dt, &pad);

        // 2. Update gameplay
        if (g_ui.state == UI_STATE_GAME) {
            player_update(dt, &pad);
            mobs_update(dt, g_player.pos);

            if (g_world.current_dimension == DIMENSION_END) {
                dragon_update(dt, g_player.pos);
            }
        }

        // 3. Render 3D scene
        renderer_start_frame(g_world.sky_color);

        renderer_setup_3d(60.0f, (float)SCREEN_WIDTH / (float)SCREEN_HEIGHT, 0.1f, 140.0f);
        Vec3 cam_pos = g_player.pos;
        cam_pos.y += 1.62f;
        renderer_setup_camera(cam_pos, g_player.yaw, g_player.pitch);

        // Render Voxel World with 100% visible faces
        world_render(cam_pos);

        // Render 3D Mobs & Drops ripped from Eblankraft
        mobs_render();

        // Render Boss & Crystals in End
        if (g_world.current_dimension == DIMENSION_END) {
            dragon_render();
            mobs_render_crystals_and_beam(g_dragon.pos);
        }

        // Render target block wireframe outline
        if (g_player.has_target) {
            renderer_draw_cube_wireframe(
                (float)g_player.target_block.x,
                (float)g_player.target_block.y,
                (float)g_player.target_block.z,
                1.002f, RGB(255, 255, 255)
            );
        }

        // 4. Render 2D HUD
        ui_render();

        renderer_end_frame();
    }

    audio_term();
    sceKernelExitGame();
    return 0;
}

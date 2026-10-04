#include "ui.h"
#include "renderer.h"
#include "font.h"
#include "player.h"
#include "dragon.h"
#include "mobs.h"
#include "cases.h"
#include "world.h"
#include "audio.h"

UI g_ui;

static const char* g_skins[] = {
    "Klasychnyj Yeblan",
    "Chotkyj Gopnyk (+20% Speed)",
    "Oligarkh (+Gold)",
    "Gigachad (Max Kharyzma)"
};
#define SKIN_COUNT 4

static const char* g_menu_items[] = {
    "Prodovzhyty Gru",
    "Vidkryty Bomzh-Keys",
    "Vidkryty Keys Drakona",
    "Warp: Overworld",
    "Warp: Nether",
    "Warp: The End",
    "Zminyty Skin",
    "Vykhid v XMB"
};
#define MENU_ITEM_COUNT 8

void ui_init(void) {
    g_ui.state = UI_STATE_GAME;
    g_ui.menu_cursor = 0;
    g_ui.selected_skin = 0;
}

static uint32_t ui_last_buttons = 0;

void ui_update(float dt, SceCtrlData* pad) {
    uint32_t pressed = pad->Buttons & ~ui_last_buttons;
    ui_last_buttons = pad->Buttons;

    if (g_case_roulette.is_open) {
        cases_update(dt, pad);
        if (!g_case_roulette.is_open) {
            g_ui.state = UI_STATE_GAME;
        }
        return;
    }

    if (pressed & PSP_CTRL_START) {
        if (g_ui.state == UI_STATE_GAME) {
            g_ui.state = UI_STATE_PAUSE_MENU;
        } else {
            g_ui.state = UI_STATE_GAME;
        }
    }

    if (g_ui.state == UI_STATE_PAUSE_MENU) {
        if (pressed & PSP_CTRL_UP) {
            g_ui.menu_cursor = (g_ui.menu_cursor + MENU_ITEM_COUNT - 1) % MENU_ITEM_COUNT;
            audio_play(SOUND_CLICK);
        }
        if (pressed & PSP_CTRL_DOWN) {
            g_ui.menu_cursor = (g_ui.menu_cursor + 1) % MENU_ITEM_COUNT;
            audio_play(SOUND_CLICK);
        }

        if (pressed & PSP_CTRL_CROSS) {
            audio_play(SOUND_CLICK);
            switch (g_ui.menu_cursor) {
                case 0: // Resume
                    g_ui.state = UI_STATE_GAME;
                    break;
                case 1: // Bomzh-Case
                    cases_start_opening(ITEM_CASE_BOMZH);
                    g_ui.state = UI_STATE_CASE_ROULETTE;
                    break;
                case 2: // Dragon Case
                    cases_start_opening(ITEM_CASE_DRAGON);
                    g_ui.state = UI_STATE_CASE_ROULETTE;
                    break;
                case 3: // Overworld
                    world_switch_dimension(DIMENSION_OVERWORLD);
                    mobs_init(DIMENSION_OVERWORLD);
                    player_spawn(WORLD_SIZE_X / 2.0f, WORLD_SIZE_Z / 2.0f);
                    g_ui.state = UI_STATE_GAME;
                    break;
                case 4: // Nether
                    world_switch_dimension(DIMENSION_NETHER);
                    mobs_init(DIMENSION_NETHER);
                    player_spawn(WORLD_SIZE_X / 2.0f, WORLD_SIZE_Z / 2.0f);
                    g_ui.state = UI_STATE_GAME;
                    break;
                case 5: // The End
                    world_switch_dimension(DIMENSION_END);
                    dragon_init();
                    mobs_init(DIMENSION_END);
                    player_spawn(WORLD_SIZE_X / 2.0f, WORLD_SIZE_Z / 2.0f);
                    g_ui.state = UI_STATE_GAME;
                    break;
                case 6: // Switch skin
                    g_ui.selected_skin = (g_ui.selected_skin + 1) % SKIN_COUNT;
                    break;
                case 7: // Exit
                    sceKernelExitGame();
                    break;
            }
        }
        if (pressed & PSP_CTRL_CIRCLE) {
            audio_play(SOUND_CLICK);
            g_ui.state = UI_STATE_GAME;
        }
    }
}

static void render_hud(void) {
    renderer_setup_2d();

    // 1. Crosshair (+) in center
    int cx = SCREEN_WIDTH / 2;
    int cy = SCREEN_HEIGHT / 2;
    renderer_draw_rect_2d(cx - 5, cy, cx + 6, cy + 1, RGBA(255, 255, 255, 200));
    renderer_draw_rect_2d(cx, cy - 5, cx + 1, cy + 6, RGBA(255, 255, 255, 200));

    // 2. Health Bar (Left bottom)
    // 10 hearts (each heart = 10 HP)
    int hp_x = 135;
    int hp_y = 230;
    int hearts = (g_player.hp + 9) / 10;
    for (int i = 0; i < 10; i++) {
        uint32_t col = (i < hearts) ? RGB(220, 30, 30) : RGB(60, 20, 20);
        renderer_draw_rect_2d(hp_x + i * 8, hp_y, hp_x + i * 8 + 6, hp_y + 6, col);
    }

    // 3. Hunger Bar (Right bottom)
    // 10 drumsticks (each = 10 hunger)
    int hg_x = 265;
    int hg_y = 230;
    int drumsticks = (g_player.hunger + 9) / 10;
    for (int i = 0; i < 10; i++) {
        uint32_t col = (i < drumsticks) ? RGB(220, 140, 20) : RGB(60, 40, 10);
        renderer_draw_rect_2d(hg_x + i * 8, hg_y, hg_x + i * 8 + 6, hg_y + 6, col);
    }

    // 4. Hotbar (9 slots at bottom center)
    int hb_w = 20;
    int hb_pad = 2;
    int total_hb_w = HOTBAR_SIZE * (hb_w + hb_pad);
    int start_hb_x = (SCREEN_WIDTH - total_hb_w) / 2;
    int hb_y = 244;

    for (int i = 0; i < HOTBAR_SIZE; i++) {
        int slot_x = start_hb_x + i * (hb_w + hb_pad);

        // Selection highlight
        if (i == g_player.selected_slot) {
            renderer_draw_rect_2d(slot_x - 2, hb_y - 2, slot_x + hb_w + 2, hb_y + hb_w + 2, RGB(255, 255, 255));
        }

        // Slot bg
        renderer_draw_rect_2d(slot_x, hb_y, slot_x + hb_w, hb_y + hb_w, RGBA(30, 30, 40, 200));

        // Item icon / block color
        ItemStack* stack = &g_player.hotbar[i];
        if (stack->id != ITEM_NONE && stack->count > 0) {
            const ItemDef* idef = item_get_def(stack->id);
            renderer_draw_rect_2d(slot_x + 3, hb_y + 3, slot_x + hb_w - 3, hb_y + hb_w - 3, idef->color);

            // Count
            if (stack->count > 1) {
                char cnt_buf[16];
                snprintf(cnt_buf, sizeof(cnt_buf), "%d", stack->count);
                font_draw_text(slot_x + 2, hb_y + hb_w - 7, cnt_buf, RGB(255, 255, 255), 1);
            }
        }
    }

    // 5. Selected item name
    ItemStack* cur_sel = &g_player.hotbar[g_player.selected_slot];
    if (cur_sel->id != ITEM_NONE) {
        const ItemDef* idef = item_get_def(cur_sel->id);
        int tw = font_get_text_width(idef->name, 1);
        font_draw_text_shadow((SCREEN_WIDTH - tw) / 2, hb_y - 24, idef->name, RGB(255, 255, 200), 1);
    }

    // 6. Mining progress indicator under crosshair
    if (g_player.mining_progress > 0.0f) {
        int bar_w = 40;
        int bar_h = 4;
        int bar_x = (SCREEN_WIDTH - bar_w) / 2;
        int bar_y = cy + 12;

        renderer_draw_rect_2d(bar_x - 1, bar_y - 1, bar_x + bar_w + 1, bar_y + bar_h + 1, RGB(10, 10, 10));
        int fill_w = (int)(g_player.mining_progress * (float)bar_w);
        renderer_draw_rect_2d(bar_x, bar_y, bar_x + fill_w, bar_y + bar_h, RGB(0, 220, 100));
    }

    // 7. Boss Bar (Єблан Дракон) if in The End dimension
    if (g_world.current_dimension == DIMENSION_END && g_dragon.is_alive) {
        int bb_w = 240;
        int bb_h = 8;
        int bb_x = (SCREEN_WIDTH - bb_w) / 2;
        int bb_y = 10;

        font_draw_text_shadow(bb_x + 50, bb_y - 8, "Yeblan Drakon (1000 HP)", RGB(255, 100, 240), 1);

        renderer_draw_rect_2d(bb_x - 1, bb_y + 4, bb_x + bb_w + 1, bb_y + 4 + bb_h + 1, RGB(20, 10, 30));
        int fill = (g_dragon.hp * bb_w) / g_dragon.max_hp;
        if (fill > 0) {
            renderer_draw_rect_2d(bb_x, bb_y + 5, bb_x + fill, bb_y + 4 + bb_h, RGB(220, 40, 240));
        }
    }

    // Top status line
    font_draw_text_shadow(5, 5, "EBLANKRAFT 2.0 PSP", RGB(255, 215, 0), 1);

    // Red damage flash tint overlay
    if (g_player.damage_tint_time > 0.0f) {
        float factor = g_player.damage_tint_time / 0.45f;
        if (factor > 1.0f) factor = 1.0f;
        int alpha = (int)(factor * 115.0f);
        if (alpha > 0) {
            renderer_draw_rect_2d(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, RGBA(255, 20, 20, alpha));
        }
    }
}

static void render_pause_menu(void) {
    renderer_setup_2d();

    // Dark transparent backdrop
    renderer_draw_rect_2d(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, RGBA(15, 15, 20, 220));

    font_draw_text_shadow(160, 20, "EBLANKRAFT 2.0", RGB(255, 215, 0), 2);
    font_draw_text_shadow(185, 42, "PAUSE MENU", RGB(200, 200, 200), 1);

    int my = 65;
    for (int i = 0; i < MENU_ITEM_COUNT; i++) {
        uint32_t color = (i == g_ui.menu_cursor) ? RGB(255, 255, 50) : RGB(180, 180, 190);
        int scale = (i == g_ui.menu_cursor) ? 2 : 1;
        int offset_x = (i == g_ui.menu_cursor) ? 140 : 155;

        if (i == 6) {
            // Show current skin name
            char skin_buf[64];
            snprintf(skin_buf, sizeof(skin_buf), "Skin: %s", g_skins[g_ui.selected_skin]);
            font_draw_text_shadow(offset_x, my, skin_buf, color, scale);
        } else {
            font_draw_text_shadow(offset_x, my, g_menu_items[i], color, scale);
        }

        my += (i == g_ui.menu_cursor) ? 24 : 18;
    }

    font_draw_text_shadow(110, 250, "[X] Vybraty   [O] Nazad   [START] Gru", RGB(150, 150, 160), 1);
}

void ui_render(void) {
    if (g_case_roulette.is_open) {
        cases_render();
        return;
    }

    if (g_ui.state == UI_STATE_GAME) {
        render_hud();
    } else if (g_ui.state == UI_STATE_PAUSE_MENU) {
        render_hud();
        render_pause_menu();
    }
}

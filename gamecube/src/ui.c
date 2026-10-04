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
    "Skynuty Pozitsiyu (Respawn)"
};
#define MENU_ITEM_COUNT 8

void ui_init(void) {
    g_ui.state = UI_STATE_GAME;
    g_ui.menu_cursor = 0;
    g_ui.selected_skin = 0;
}

void ui_update(float dt, GCPad* pad) {
    if (g_case_roulette.is_open) {
        cases_update(dt, pad);
        if (!g_case_roulette.is_open) {
            g_ui.state = UI_STATE_GAME;
        }
        return;
    }

    // Direct case open shortcuts from gameplay
    if (g_ui.state == UI_STATE_GAME) {
        if (pad->buttons_down & PAD_BUTTON_X) {
            cases_start_opening(ITEM_CASE_BOMZH);
            g_ui.state = UI_STATE_CASE_ROULETTE;
            return;
        }
        if (pad->buttons_down & PAD_TRIGGER_Z) {
            cases_start_opening(ITEM_CASE_DRAGON);
            g_ui.state = UI_STATE_CASE_ROULETTE;
            return;
        }
    }

    // Toggle Pause Menu
    if (pad->buttons_down & PAD_BUTTON_START) {
        if (g_ui.state == UI_STATE_GAME) {
            g_ui.state = UI_STATE_PAUSE_MENU;
            audio_play(SOUND_CLICK);
        } else if (g_ui.state == UI_STATE_PAUSE_MENU) {
            g_ui.state = UI_STATE_GAME;
            audio_play(SOUND_CLICK);
        }
    }

    if (g_ui.state == UI_STATE_PAUSE_MENU) {
        if (pad->buttons_down & PAD_BUTTON_UP) {
            g_ui.menu_cursor = (g_ui.menu_cursor + MENU_ITEM_COUNT - 1) % MENU_ITEM_COUNT;
            audio_play(SOUND_CLICK);
        }
        if (pad->buttons_down & PAD_BUTTON_DOWN) {
            g_ui.menu_cursor = (g_ui.menu_cursor + 1) % MENU_ITEM_COUNT;
            audio_play(SOUND_CLICK);
        }

        if (pad->buttons_down & PAD_BUTTON_A) {
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
                case 7: // Respawn
                    player_spawn(WORLD_SIZE_X / 2.0f, WORLD_SIZE_Z / 2.0f);
                    g_ui.state = UI_STATE_GAME;
                    break;
            }
        }
        if (pad->buttons_down & PAD_BUTTON_B) {
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
    renderer_draw_rect_2d(cx - 7, cy, cx + 8, cy + 2, RGBA(255, 255, 255, 220));
    renderer_draw_rect_2d(cx, cy - 7, cx + 2, cy + 8, RGBA(255, 255, 255, 220));

    // 2. Health Bar (Left bottom)
    int hp_x = 180;
    int hp_y = 405;
    int hearts = (g_player.hp + 9) / 10;
    for (int i = 0; i < 10; i++) {
        uint32_t col = (i < hearts) ? RGB(220, 30, 30) : RGB(60, 20, 20);
        renderer_draw_rect_2d(hp_x + i * 11, hp_y, hp_x + i * 11 + 9, hp_y + 9, col);
    }

    // 3. Hunger Bar (Right bottom)
    int hg_x = 350;
    int hg_y = 405;
    int drumsticks = (g_player.hunger + 9) / 10;
    for (int i = 0; i < 10; i++) {
        uint32_t col = (i < drumsticks) ? RGB(220, 140, 20) : RGB(60, 40, 10);
        renderer_draw_rect_2d(hg_x + i * 11, hg_y, hg_x + i * 11 + 9, hg_y + 9, col);
    }

    // 4. Hotbar (9 slots at bottom center)
    int hb_w = 28;
    int hb_pad = 4;
    int total_hb_w = HOTBAR_SIZE * (hb_w + hb_pad);
    int start_hb_x = (SCREEN_WIDTH - total_hb_w) / 2;
    int hb_y = 425;

    for (int i = 0; i < HOTBAR_SIZE; i++) {
        int slot_x = start_hb_x + i * (hb_w + hb_pad);

        if (i == g_player.selected_slot) {
            renderer_draw_rect_2d(slot_x - 3, hb_y - 3, slot_x + hb_w + 3, hb_y + hb_w + 3, RGB(255, 255, 255));
        }

        renderer_draw_rect_2d(slot_x, hb_y, slot_x + hb_w, hb_y + hb_w, RGBA(30, 30, 40, 210));

        ItemStack* stack = &g_player.hotbar[i];
        if (stack->id != ITEM_NONE && stack->count > 0) {
            const ItemDef* idef = item_get_def(stack->id);
            renderer_draw_rect_2d(slot_x + 4, hb_y + 4, slot_x + hb_w - 4, hb_y + hb_w - 4, idef->color);

            if (stack->count > 1) {
                char cnt_buf[16];
                snprintf(cnt_buf, sizeof(cnt_buf), "%d", stack->count);
                font_draw_text(slot_x + 3, hb_y + hb_w - 9, cnt_buf, RGB(255, 255, 255), 1);
            }
        }
    }

    // 5. Selected item name
    ItemStack* cur_sel = &g_player.hotbar[g_player.selected_slot];
    if (cur_sel->id != ITEM_NONE) {
        const ItemDef* idef = item_get_def(cur_sel->id);
        int tw = font_get_text_width(idef->name, 1);
        font_draw_text_shadow((SCREEN_WIDTH - tw) / 2, hb_y - 20, idef->name, RGB(255, 255, 200), 1);
    }

    // 6. Mining progress indicator
    if (g_player.mining_progress > 0.0f) {
        int bar_w = 60;
        int bar_h = 6;
        int bar_x = (SCREEN_WIDTH - bar_w) / 2;
        int bar_y = cy + 18;

        renderer_draw_rect_2d(bar_x - 1, bar_y - 1, bar_x + bar_w + 1, bar_y + bar_h + 1, RGB(10, 10, 10));
        int fill_w = (int)(g_player.mining_progress * (float)bar_w);
        renderer_draw_rect_2d(bar_x, bar_y, bar_x + fill_w, bar_y + bar_h, RGB(0, 220, 100));
    }

    // 7. Boss Bar (The End)
    if (g_world.current_dimension == DIMENSION_END && g_dragon.is_alive) {
        int bb_w = 340;
        int bb_h = 10;
        int bb_x = (SCREEN_WIDTH - bb_w) / 2;
        int bb_y = 18;

        const char* boss_title = "Yeblan Drakon (1000 HP)";
        int btw = font_get_text_width(boss_title, 1);
        font_draw_text_shadow((SCREEN_WIDTH - btw) / 2, bb_y - 12, boss_title, RGB(255, 100, 240), 1);

        renderer_draw_rect_2d(bb_x - 2, bb_y + 4, bb_x + bb_w + 2, bb_y + 4 + bb_h + 2, RGB(20, 10, 30));
        int fill = (g_dragon.hp * bb_w) / g_dragon.max_hp;
        if (fill > 0) {
            renderer_draw_rect_2d(bb_x, bb_y + 5, bb_x + fill, bb_y + 4 + bb_h, RGB(220, 40, 240));
        }
    }

    // Top status line & controls reminder
    font_draw_text_shadow(10, 10, "EBLANKRAFT 2.0 GAMECUBE", RGB(255, 215, 0), 1);
    font_draw_text_shadow(10, 25, "Stick:Move  C-Stick:Look  A:Jump  R:Mine  L:Place  X/Z:Cases", RGB(210, 210, 210), 1);

    // Red damage flash tint overlay
    if (g_player.damage_tint_time > 0.0f) {
        float alpha_factor = g_player.damage_tint_time / 0.45f;
        uint32_t red_alpha = (uint32_t)(alpha_factor * 90.0f);
        renderer_draw_rect_2d(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, RGBA(255, 0, 0, red_alpha));
    }
}

static void render_pause_menu(void) {
    renderer_setup_2d();

    renderer_draw_rect_2d(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, RGBA(10, 10, 15, 215));

    const char* title = "=== EBLANKRAFT 2.0 GAMECUBE ===";
    int tw = font_get_text_width(title, 2);
    font_draw_text_shadow((SCREEN_WIDTH - tw) / 2, 40, title, RGB(255, 215, 0), 2);

    int menu_start_y = 110;
    int item_spacing = 38;

    for (int i = 0; i < MENU_ITEM_COUNT; i++) {
        int item_y = menu_start_y + i * item_spacing;
        bool is_sel = (i == g_ui.menu_cursor);

        int box_w = 420;
        int box_x = (SCREEN_WIDTH - box_w) / 2;

        if (is_sel) {
            renderer_draw_rect_2d(box_x - 3, item_y - 4, box_x + box_w + 3, item_y + 26, RGB(255, 255, 255));
            renderer_draw_rect_2d(box_x, item_y - 2, box_x + box_w, item_y + 24, RGB(45, 80, 155));
        } else {
            renderer_draw_rect_2d(box_x, item_y - 2, box_x + box_w, item_y + 24, RGBA(30, 30, 45, 180));
        }

        uint32_t text_col = is_sel ? RGB(255, 255, 255) : RGB(190, 190, 190);
        char buf[64];
        if (i == 6) {
            snprintf(buf, sizeof(buf), "%s: %s", g_menu_items[i], g_skins[g_ui.selected_skin]);
        } else {
            snprintf(buf, sizeof(buf), "%s", g_menu_items[i]);
        }

        int itw = font_get_text_width(buf, 1);
        font_draw_text_shadow((SCREEN_WIDTH - itw) / 2, item_y + 4, buf, text_col, 1);
    }

    const char* hint = "(A) Vybraty     (B)/(START) Prodovzhyty";
    int htw = font_get_text_width(hint, 1);
    font_draw_text_shadow((SCREEN_WIDTH - htw) / 2, 440, hint, RGB(180, 180, 180), 1);
}

void ui_render(void) {
    if (g_ui.state == UI_STATE_GAME) {
        render_hud();
    } else if (g_ui.state == UI_STATE_PAUSE_MENU) {
        render_hud();
        render_pause_menu();
    } else if (g_ui.state == UI_STATE_CASE_ROULETTE) {
        cases_render();
    }
}

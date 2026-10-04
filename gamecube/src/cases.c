#include "cases.h"
#include "renderer.h"
#include "font.h"
#include "player.h"
#include "audio.h"

CaseRoulette g_case_roulette;

static const ItemId g_bomzh_pool[] = {
    ITEM_TRASH_SOCK, ITEM_TRASH_ZHIGULI, ITEM_TRASH_CIG, ITEM_TRASH_NUT,
    ITEM_APPLE, ITEM_STEAK, ITEM_SHAWARMA, (ItemId)BLOCK_WOOD, ITEM_PICK_WOOD
};

static const ItemId g_diamond_pool[] = {
    (ItemId)BLOCK_GOLD_ORE, (ItemId)BLOCK_DIAMOND_ORE, (ItemId)BLOCK_TNT,
    (ItemId)BLOCK_POPCAT, ITEM_PICK_DIAMOND, ITEM_SWORD_DIAMOND, ITEM_SHAWARMA
};

static const ItemId g_dragon_pool[] = {
    (ItemId)BLOCK_NETHERITE, ITEM_PICK_NETHERITE, ITEM_PICK_SUPER_EBLAN,
    ITEM_SWORD_DRAGONSLAYER, ITEM_DRAGON_EGG, ITEM_SHAWARMA
};

void cases_init(void) {
    memset(&g_case_roulette, 0, sizeof(CaseRoulette));
}

void cases_start_opening(ItemId case_id) {
    g_case_roulette.is_open = true;
    g_case_roulette.case_id = case_id;
    g_case_roulette.scroll_pos = 0.0f;
    g_case_roulette.scroll_speed = 700.0f;
    g_case_roulette.is_spinning = true;
    g_case_roulette.finished = false;

    const ItemId* pool = g_bomzh_pool;
    int pool_size = sizeof(g_bomzh_pool) / sizeof(g_bomzh_pool[0]);

    if (case_id == ITEM_CASE_DIAMOND) {
        pool = g_diamond_pool;
        pool_size = sizeof(g_diamond_pool) / sizeof(g_diamond_pool[0]);
    } else if (case_id == ITEM_CASE_DRAGON) {
        pool = g_dragon_pool;
        pool_size = sizeof(g_dragon_pool) / sizeof(g_dragon_pool[0]);
    }

    for (int i = 0; i < 32; i++) {
        g_case_roulette.strip[i] = pool[rand() % pool_size];
    }

    int win_idx = 24;
    g_case_roulette.won_item = g_case_roulette.strip[win_idx];
    g_case_roulette.target_pos = (float)(win_idx * 70) - 285.0f;
}

void cases_update(float dt, GCPad* pad) {
    if (!g_case_roulette.is_open) return;

    if (g_case_roulette.is_spinning) {
        float remaining = g_case_roulette.target_pos - g_case_roulette.scroll_pos;
        if (remaining > 0.0f) {
            float speed = remaining * 3.5f + 30.0f;
            if (speed > 800.0f) speed = 800.0f;
            float old_pos = g_case_roulette.scroll_pos;
            g_case_roulette.scroll_pos += speed * dt;

            if ((int)(old_pos / 70.0f) != (int)(g_case_roulette.scroll_pos / 70.0f)) {
                audio_play(SOUND_CLICK);
            }

            if (g_case_roulette.scroll_pos >= g_case_roulette.target_pos) {
                g_case_roulette.scroll_pos = g_case_roulette.target_pos;
                g_case_roulette.is_spinning = false;
                g_case_roulette.finished = true;
                audio_play(SOUND_PLACE);

                for (int s = 0; s < HOTBAR_SIZE; s++) {
                    if (g_player.hotbar[s].id == g_case_roulette.won_item) {
                        g_player.hotbar[s].count += (g_case_roulette.won_item == ITEM_SHAWARMA) ? 3 : 1;
                        return;
                    }
                    if (g_player.hotbar[s].id == ITEM_NONE) {
                        g_player.hotbar[s].id = g_case_roulette.won_item;
                        g_player.hotbar[s].count = (g_case_roulette.won_item == ITEM_SHAWARMA) ? 3 : 1;
                        return;
                    }
                }
            }
        }
    } else if (g_case_roulette.finished) {
        if (pad->buttons_down & (PAD_BUTTON_A | PAD_BUTTON_B | PAD_BUTTON_START)) {
            audio_play(SOUND_CLICK);
            g_case_roulette.is_open = false;
            g_case_roulette.finished = false;
        }
    }
}

void cases_render(void) {
    if (!g_case_roulette.is_open) return;

    renderer_setup_2d();

    // Dark backdrop overlay
    renderer_draw_rect_2d(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, RGBA(10, 10, 15, 230));

    // Title
    const ItemDef* c_def = item_get_def(g_case_roulette.case_id);
    int tw = font_get_text_width(c_def->name, 2);
    font_draw_text_shadow((SCREEN_WIDTH - tw) / 2, 60, c_def->name, RGB(255, 215, 0), 2);

    // Roulette background frame
    int r_y = 180;
    renderer_draw_rect_2d(40, r_y - 6, SCREEN_WIDTH - 40, r_y + 96, RGB(30, 30, 40));
    renderer_draw_rect_2d(42, r_y - 4, SCREEN_WIDTH - 42, r_y + 94, RGB(15, 15, 22));

    // Draw cards in strip
    for (int i = 0; i < 32; i++) {
        float card_x = (float)(i * 70) - g_case_roulette.scroll_pos + 40.0f;
        if (card_x > -70.0f && card_x < SCREEN_WIDTH + 70.0f) {
            const ItemDef* idef = item_get_def(g_case_roulette.strip[i]);

            renderer_draw_rect_2d((int)card_x, r_y, (int)card_x + 64, r_y + 90, idef->color);
            renderer_draw_rect_2d((int)card_x + 2, r_y + 2, (int)card_x + 62, r_y + 88, RGB(25, 25, 30));
            renderer_draw_rect_2d((int)card_x + 14, r_y + 16, (int)card_x + 50, r_y + 56, idef->color);
        }
    }

    // Center indicator pointer
    int center_x = SCREEN_WIDTH / 2;
    renderer_draw_rect_2d(center_x - 3, r_y - 14, center_x + 3, r_y + 104, RGB(255, 215, 0));

    // Finished text
    if (g_case_roulette.finished) {
        const ItemDef* win_def = item_get_def(g_case_roulette.won_item);
        char win_buf[64];
        snprintf(win_buf, sizeof(win_buf), "Vypalo: %s", win_def->name);
        int wtw = font_get_text_width(win_buf, 2);
        font_draw_text_shadow((SCREEN_WIDTH - wtw) / 2, 310, win_buf, RGB(50, 255, 100), 2);

        const char* prompt = "Press (A) to Continue";
        int ptw = font_get_text_width(prompt, 1);
        font_draw_text_shadow((SCREEN_WIDTH - ptw) / 2, 360, prompt, RGB(255, 255, 255), 1);
    }
}

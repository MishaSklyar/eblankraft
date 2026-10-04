#ifndef EBLANKRAFT_UI_H
#define EBLANKRAFT_UI_H

#include "common.h"
#include "pad.h"

typedef enum {
    UI_STATE_GAME = 0,
    UI_STATE_PAUSE_MENU,
    UI_STATE_CASE_ROULETTE
} UIState;

typedef struct {
    UIState state;
    int menu_cursor;
    int selected_skin;
} UI;

extern UI g_ui;

void ui_init(void);
void ui_update(float dt, GCPad* pad);
void ui_render(void);

#endif // EBLANKRAFT_UI_H

#ifndef EBLANKRAFT_CASES_H
#define EBLANKRAFT_CASES_H

#include "common.h"
#include "items.h"

typedef struct {
    bool is_open;
    ItemId case_id;
    float scroll_pos;
    float scroll_speed;
    float target_pos;
    bool is_spinning;
    bool finished;
    ItemId won_item;
    ItemId strip[32];
} CaseRoulette;

extern CaseRoulette g_case_roulette;

void cases_init(void);
void cases_start_opening(ItemId case_id);
void cases_update(float dt, SceCtrlData* pad);
void cases_render(void);

#endif // EBLANKRAFT_CASES_H

#ifndef EBLANKRAFT_PAD_H
#define EBLANKRAFT_PAD_H

#include "common.h"

typedef struct {
    uint32_t buttons_down;
    uint32_t buttons_held;
    int stick_x;
    int stick_y;
    int substick_x;
    int substick_y;
    int trigger_l;
    int trigger_r;
} GCPad;

extern GCPad g_pad;

void pad_init(void);
void pad_update(void);

#endif // EBLANKRAFT_PAD_H

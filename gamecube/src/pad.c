#include "pad.h"

GCPad g_pad;

void pad_init(void) {
    PAD_Init();
    memset(&g_pad, 0, sizeof(GCPad));
}

void pad_update(void) {
    PAD_ScanPads();
    g_pad.buttons_down = PAD_ButtonsDown(0);
    g_pad.buttons_held = PAD_ButtonsHeld(0);
    g_pad.stick_x = PAD_StickX(0);
    g_pad.stick_y = PAD_StickY(0);
    g_pad.substick_x = PAD_SubStickX(0);
    g_pad.substick_y = PAD_SubStickY(0);
    g_pad.trigger_l = PAD_TriggerL(0);
    g_pad.trigger_r = PAD_TriggerR(0);
}

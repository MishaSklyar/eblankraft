#ifndef EBLANKRAFT_PAD_H
#define EBLANKRAFT_PAD_H

#include "common.h"

// Input button masks (GameCube & PC compatibility)
#define PAD_BUTTON_A      (1 << 0)  // Space / Enter / Gamepad A (Jump, Confirm)
#define PAD_BUTTON_B      (1 << 1)  // Esc / Gamepad B (Back, Mine)
#define PAD_BUTTON_X      (1 << 2)  // Key X / Gamepad X (Bomzh Case)
#define PAD_BUTTON_Y      (1 << 3)  // RMB / Gamepad Y (Place block)
#define PAD_BUTTON_START  (1 << 4)  // Escape / Gamepad Start (Pause Menu)
#define PAD_BUTTON_UP     (1 << 5)  // Up arrow / Key W
#define PAD_BUTTON_DOWN   (1 << 6)  // Down arrow / Key S
#define PAD_BUTTON_LEFT   (1 << 7)  // Left arrow / Key A
#define PAD_BUTTON_RIGHT  (1 << 8)  // Right arrow / Key D
#define PAD_TRIGGER_L     (1 << 9)  // RMB / Gamepad LT (Place block / Eat)
#define PAD_TRIGGER_R     (1 << 10) // LMB / Gamepad RT (Mine block / Attack)
#define PAD_TRIGGER_Z     (1 << 11) // Key Z or C / Gamepad RB (Dragon Case)

typedef struct {
    uint32_t buttons_down;
    uint32_t buttons_held;
    int stick_x;      // -128..127 (Walk / Strafe)
    int stick_y;      // -128..127 (Forward / Backward)
    int substick_x;   // -128..127 (Camera look)
    int substick_y;   // -128..127
    int trigger_l;
    int trigger_r;
    float mouse_dx;   // Relative mouse X movement
    float mouse_dy;   // Relative mouse Y movement
    int wheel_y;      // Mouse wheel scroll delta
    int number_key;   // 1..9 or 0
    bool quit_requested;
} GCPad;

extern GCPad g_pad;

void pad_init(void);
void pad_update(void);
void pad_set_mouse_captured(bool captured);
bool pad_is_mouse_captured(void);

#endif // EBLANKRAFT_PAD_H

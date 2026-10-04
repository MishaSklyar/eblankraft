#include "pad.h"

GCPad g_pad;
static SDL_GameController* s_controller = NULL;
static bool s_mouse_captured = false;

void pad_init(void) {
    memset(&g_pad, 0, sizeof(GCPad));

    for (int i = 0; i < SDL_NumJoysticks(); i++) {
        if (SDL_IsGameController(i)) {
            s_controller = SDL_GameControllerOpen(i);
            if (s_controller) {
                printf("[PC Input] Game controller connected: %s\n", SDL_GameControllerName(s_controller));
                break;
            }
        }
    }

    pad_set_mouse_captured(true);
}

void pad_set_mouse_captured(bool captured) {
    s_mouse_captured = captured;
    SDL_SetRelativeMouseMode(captured ? SDL_TRUE : SDL_FALSE);
}

bool pad_is_mouse_captured(void) {
    return s_mouse_captured;
}

void pad_update(void) {
    g_pad.buttons_down = 0;
    g_pad.buttons_held = 0;
    g_pad.stick_x = 0;
    g_pad.stick_y = 0;
    g_pad.substick_x = 0;
    g_pad.substick_y = 0;
    g_pad.mouse_dx = 0.0f;
    g_pad.mouse_dy = 0.0f;
    g_pad.wheel_y = 0;
    g_pad.number_key = 0;

    SDL_Event event;
    while (SDL_PollEvent(&event)) {
        switch (event.type) {
            case SDL_QUIT:
                g_pad.quit_requested = true;
                break;

            case SDL_KEYDOWN:
                if (event.key.repeat) break;
                switch (event.key.keysym.sym) {
                    case SDLK_ESCAPE:
                        g_pad.buttons_down |= PAD_BUTTON_START;
                        break;
                    case SDLK_SPACE:
                    case SDLK_RETURN:
                        g_pad.buttons_down |= PAD_BUTTON_A;
                        break;
                    case SDLK_UP:
                        g_pad.buttons_down |= PAD_BUTTON_UP;
                        break;
                    case SDLK_DOWN:
                        g_pad.buttons_down |= PAD_BUTTON_DOWN;
                        break;
                    case SDLK_LEFT:
                        g_pad.buttons_down |= PAD_BUTTON_LEFT;
                        break;
                    case SDLK_RIGHT:
                        g_pad.buttons_down |= PAD_BUTTON_RIGHT;
                        break;
                    case SDLK_x:
                        g_pad.buttons_down |= PAD_BUTTON_X;
                        break;
                    case SDLK_z:
                    case SDLK_c:
                        g_pad.buttons_down |= PAD_TRIGGER_Z;
                        break;
                    case SDLK_1: g_pad.number_key = 1; break;
                    case SDLK_2: g_pad.number_key = 2; break;
                    case SDLK_3: g_pad.number_key = 3; break;
                    case SDLK_4: g_pad.number_key = 4; break;
                    case SDLK_5: g_pad.number_key = 5; break;
                    case SDLK_6: g_pad.number_key = 6; break;
                    case SDLK_7: g_pad.number_key = 7; break;
                    case SDLK_8: g_pad.number_key = 8; break;
                    case SDLK_9: g_pad.number_key = 9; break;
                    default: break;
                }
                break;

            case SDL_MOUSEBUTTONDOWN:
                if (!s_mouse_captured) {
                    pad_set_mouse_captured(true);
                }
                if (event.button.button == SDL_BUTTON_LEFT) {
                    g_pad.buttons_down |= (PAD_TRIGGER_R | PAD_BUTTON_B);
                } else if (event.button.button == SDL_BUTTON_RIGHT) {
                    g_pad.buttons_down |= (PAD_TRIGGER_L | PAD_BUTTON_Y);
                }
                break;

            case SDL_MOUSEMOTION:
                if (s_mouse_captured) {
                    g_pad.mouse_dx += (float)event.motion.xrel;
                    g_pad.mouse_dy += (float)event.motion.yrel;
                }
                break;

            case SDL_MOUSEWHEEL:
                g_pad.wheel_y += event.wheel.y;
                break;

            case SDL_CONTROLLERDEVICEADDED:
                if (!s_controller) {
                    s_controller = SDL_GameControllerOpen(event.cdevice.which);
                }
                break;

            case SDL_CONTROLLERDEVICEREMOVED:
                if (s_controller && event.cdevice.which == SDL_JoystickInstanceID(SDL_GameControllerGetJoystick(s_controller))) {
                    SDL_GameControllerClose(s_controller);
                    s_controller = NULL;
                }
                break;

            default:
                break;
        }
    }

    // Keyboard Continuous State (WASD, Arrows, Space, Mouse Buttons)
    const Uint8* kstate = SDL_GetKeyboardState(NULL);

    if (kstate[SDL_SCANCODE_W]) g_pad.stick_y += 127;
    if (kstate[SDL_SCANCODE_S]) g_pad.stick_y -= 127;
    if (kstate[SDL_SCANCODE_A]) g_pad.stick_x -= 127;
    if (kstate[SDL_SCANCODE_D]) g_pad.stick_x += 127;

    if (kstate[SDL_SCANCODE_UP])    g_pad.buttons_held |= PAD_BUTTON_UP;
    if (kstate[SDL_SCANCODE_DOWN])  g_pad.buttons_held |= PAD_BUTTON_DOWN;
    if (kstate[SDL_SCANCODE_LEFT])  g_pad.buttons_held |= PAD_BUTTON_LEFT;
    if (kstate[SDL_SCANCODE_RIGHT]) g_pad.buttons_held |= PAD_BUTTON_RIGHT;
    if (kstate[SDL_SCANCODE_SPACE]) g_pad.buttons_held |= PAD_BUTTON_A;
    if (kstate[SDL_SCANCODE_ESCAPE])g_pad.buttons_held |= PAD_BUTTON_START;
    if (kstate[SDL_SCANCODE_X])     g_pad.buttons_held |= PAD_BUTTON_X;
    if (kstate[SDL_SCANCODE_Z] || kstate[SDL_SCANCODE_C]) g_pad.buttons_held |= PAD_TRIGGER_Z;

    Uint32 mstate = SDL_GetMouseState(NULL, NULL);
    if (mstate & SDL_BUTTON_LMASK) {
        g_pad.buttons_held |= (PAD_TRIGGER_R | PAD_BUTTON_B);
    }
    if (mstate & SDL_BUTTON_RMASK) {
        g_pad.buttons_held |= (PAD_TRIGGER_L | PAD_BUTTON_Y);
    }

    // Optional Gamepad Controller Support
    if (s_controller) {
        Sint16 lx = SDL_GameControllerGetAxis(s_controller, SDL_CONTROLLER_AXIS_LEFTX);
        Sint16 ly = SDL_GameControllerGetAxis(s_controller, SDL_CONTROLLER_AXIS_LEFTY);
        Sint16 rx = SDL_GameControllerGetAxis(s_controller, SDL_CONTROLLER_AXIS_RIGHTX);
        Sint16 ry = SDL_GameControllerGetAxis(s_controller, SDL_CONTROLLER_AXIS_RIGHTY);

        if (abs(lx) > 3200) g_pad.stick_x = lx / 256;
        if (abs(ly) > 3200) g_pad.stick_y = -ly / 256;
        if (abs(rx) > 3200) g_pad.substick_x = rx / 256;
        if (abs(ry) > 3200) g_pad.substick_y = -ry / 256;

        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_A)) {
            g_pad.buttons_held |= PAD_BUTTON_A;
        }
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_B)) {
            g_pad.buttons_held |= PAD_BUTTON_B;
        }
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_X)) {
            g_pad.buttons_held |= PAD_BUTTON_X;
        }
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_Y)) {
            g_pad.buttons_held |= PAD_BUTTON_Y;
        }
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_START)) {
            g_pad.buttons_held |= PAD_BUTTON_START;
        }
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_DPAD_UP)) {
            g_pad.buttons_held |= PAD_BUTTON_UP;
        }
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_DPAD_DOWN)) {
            g_pad.buttons_held |= PAD_BUTTON_DOWN;
        }
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_DPAD_LEFT)) {
            g_pad.buttons_held |= PAD_BUTTON_LEFT;
        }
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_DPAD_RIGHT)) {
            g_pad.buttons_held |= PAD_BUTTON_RIGHT;
        }

        Sint16 lt = SDL_GameControllerGetAxis(s_controller, SDL_CONTROLLER_AXIS_TRIGGERLEFT);
        Sint16 rt = SDL_GameControllerGetAxis(s_controller, SDL_CONTROLLER_AXIS_TRIGGERRIGHT);
        if (lt > 6000) g_pad.buttons_held |= PAD_TRIGGER_L;
        if (rt > 6000) g_pad.buttons_held |= PAD_TRIGGER_R;
        if (SDL_GameControllerGetButton(s_controller, SDL_CONTROLLER_BUTTON_RIGHTSHOULDER)) {
            g_pad.buttons_held |= PAD_TRIGGER_Z;
        }
    }
}

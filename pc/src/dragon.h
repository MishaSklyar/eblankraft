#ifndef EBLANKRAFT_DRAGON_H
#define EBLANKRAFT_DRAGON_H

#include "common.h"

typedef struct {
    Vec3 pos;
    Vec3 vel;
    float yaw;
    float pitch;
    float wing_angle;
    float wing_speed;

    int hp;
    int max_hp;
    bool is_alive;
    bool is_swooping;
    float state_timer;
    float hurt_time;

    // Fireball
    bool fireball_active;
    Vec3 fireball_pos;
    Vec3 fireball_vel;
} Dragon;

extern Dragon g_dragon;

void dragon_init(void);
void dragon_update(float dt, Vec3 player_pos);
void dragon_render(void);
void dragon_damage(int amount);

#endif // EBLANKRAFT_DRAGON_H

#ifndef EBLANKRAFT_MOBS_H
#define EBLANKRAFT_MOBS_H

#include "common.h"
#include "blocks.h"

typedef enum {
    MOB_ZOMBIE = 0,
    MOB_CREEPER,
    MOB_PIGLIN,
    MOB_ENDERMAN,
    MOB_COUNT
} MobType;

typedef struct {
    MobType type;
    Vec3 pos;
    Vec3 vel;
    float yaw;
    float walk_cycle;
    int hp;
    int max_hp;
    bool is_alive;
    float attack_cooldown;
    float hurt_time;
} Mob;

typedef struct {
    Vec3 pos;
    BlockType block_type;
    float rot_y;
    float bob_time;
    bool active;
} ItemDrop;

typedef struct {
    Vec3 pos;
    float spin_angle;
    bool active;
} EndCrystal;

#define MAX_MOBS 12
#define MAX_ITEM_DROPS 16
#define MAX_END_CRYSTALS 4

extern Mob g_mobs[MAX_MOBS];
extern ItemDrop g_item_drops[MAX_ITEM_DROPS];
extern EndCrystal g_end_crystals[MAX_END_CRYSTALS];

void mobs_init(int dimension);
void mobs_update(float dt, Vec3 player_pos);
void mobs_render(void);
void mobs_render_crystals_and_beam(Vec3 dragon_pos);
bool mobs_attack(Vec3 eye_pos, Vec3 look_dir, float range, int damage);

#endif // EBLANKRAFT_MOBS_H

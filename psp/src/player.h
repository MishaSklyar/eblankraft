#ifndef EBLANKRAFT_PLAYER_H
#define EBLANKRAFT_PLAYER_H

#include "common.h"
#include "items.h"
#include "blocks.h"

#define HOTBAR_SIZE 9
#define INVENTORY_SIZE 27

typedef struct {
    Vec3 pos;
    Vec3 vel;
    float yaw;
    float pitch;
    bool on_ground;

    int hp;
    int max_hp;
    int hunger;
    int max_hunger;
    float hunger_timer;
    float regen_timer;
    float damage_tint_time;

    int selected_slot;
    ItemStack hotbar[HOTBAR_SIZE];
    ItemStack inventory[INVENTORY_SIZE];

    // Targeting & Mining
    bool has_target;
    BlockPos target_block;
    BlockPos place_pos;
    BlockFace target_face;
    float mining_progress; // 0.0f .. 1.0f

    // Skin & upgrades
    int skin_id;
    int upgrade_speed_lvl;
    int upgrade_dmg_lvl;
    int upgrade_hp_lvl;
} Player;

extern Player g_player;

void player_init(void);
void player_spawn(float x, float z);
void player_update(float dt, SceCtrlData* pad);
void player_eat_food(ItemId id);
void player_damage(int amount);

#endif // EBLANKRAFT_PLAYER_H

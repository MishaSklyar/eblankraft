#include "player.h"
#include "world.h"
#include "mobs.h"
#include "audio.h"
#include <math.h>

Player g_player;

static bool check_collision_at(float x, float y, float z) {
    float r = 0.3f;
    float h = 1.75f;

    int min_bx = (int)floorf(x - r);
    int max_bx = (int)floorf(x + r);
    int min_by = (int)floorf(y);
    int max_by = (int)floorf(y + h);
    int min_bz = (int)floorf(z - r);
    int max_bz = (int)floorf(z + r);

    for (int by = min_by; by <= max_by; by++) {
        for (int bz = min_bz; bz <= max_bz; bz++) {
            for (int bx = min_bx; bx <= max_bx; bx++) {
                BlockType bt = world_get_block(bx, by, bz);
                if (block_is_solid(bt)) {
                    return true;
                }
            }
        }
    }
    return false;
}

void player_init(void) {
    memset(&g_player, 0, sizeof(Player));
    g_player.max_hp = 100;
    g_player.hp = 100;
    g_player.max_hunger = 100;
    g_player.hunger = 100;
    g_player.selected_slot = 0;

    // Starter gear in hotbar:
    g_player.hotbar[0] = (ItemStack){ ITEM_SHAWARMA, 5 };
    g_player.hotbar[1] = (ItemStack){ ITEM_PICK_DIAMOND, 1 };
    g_player.hotbar[2] = (ItemStack){ ITEM_SWORD_DRAGONSLAYER, 1 };
    g_player.hotbar[3] = (ItemStack){ (ItemId)BLOCK_WOOD, 64 };
    g_player.hotbar[4] = (ItemStack){ (ItemId)BLOCK_STONE, 64 };
    g_player.hotbar[5] = (ItemStack){ (ItemId)BLOCK_TNT, 16 };
    g_player.hotbar[6] = (ItemStack){ (ItemId)BLOCK_POPCAT, 8 };
    g_player.hotbar[7] = (ItemStack){ ITEM_CASE_BOMZH, 3 };
    g_player.hotbar[8] = (ItemStack){ ITEM_CASE_DRAGON, 1 };

    player_spawn(WORLD_SIZE_X / 2.0f, WORLD_SIZE_Z / 2.0f);
}

void player_spawn(float x, float z) {
    g_player.pos.x = x;
    g_player.pos.z = z;
    int h = world_get_height((int)x, (int)z);
    g_player.pos.y = (float)h + 1.0f;
    g_player.vel = (Vec3){ 0, 0, 0 };
    g_player.yaw = 0.0f;
    g_player.pitch = 0.0f;
}

void player_eat_food(ItemId id) {
    const ItemDef* def = item_get_def(id);
    if (!item_is_food(id)) return;

    g_player.hunger += def->value;
    if (g_player.hunger > g_player.max_hunger) {
        g_player.hunger = g_player.max_hunger;
    }

    if (id == ITEM_SHAWARMA) {
        g_player.hp += 45;
        if (g_player.hp > g_player.max_hp) g_player.hp = g_player.max_hp;
    } else if (id == ITEM_STEAK) {
        g_player.hp += 25;
        if (g_player.hp > g_player.max_hp) g_player.hp = g_player.max_hp;
    } else if (id == ITEM_APPLE) {
        g_player.hp += 10;
        if (g_player.hp > g_player.max_hp) g_player.hp = g_player.max_hp;
    }

    ItemStack* cur = &g_player.hotbar[g_player.selected_slot];
    if (cur->id == id) {
        cur->count--;
        if (cur->count <= 0) {
            cur->id = ITEM_NONE;
            cur->count = 0;
        }
    }
}

void player_damage(int amount) {
    g_player.hp -= amount;
    g_player.damage_tint_time = 0.45f;
    audio_play(SOUND_HURT);
    if (g_player.hp <= 0) {
        g_player.hp = g_player.max_hp;
        g_player.hunger = g_player.max_hunger;
        player_spawn(WORLD_SIZE_X / 2.0f, WORLD_SIZE_Z / 2.0f);
    }
}

void player_update(float dt, GCPad* pad) {
    // 1. Dual-Stick Camera Control (C-Stick)
    int c_x = pad->substick_x;
    int c_y = pad->substick_y;
    int deadzone_c = 15;

    if (abs(c_x) > deadzone_c) {
        g_player.yaw += ((float)c_x / 128.0f) * 115.0f * dt;
    }
    if (abs(c_y) > deadzone_c) {
        g_player.pitch -= ((float)c_y / 128.0f) * 115.0f * dt;
    }

    g_player.pitch = fclampf(g_player.pitch, -89.0f, 89.0f);
    if (g_player.yaw < 0.0f) g_player.yaw += 360.0f;
    if (g_player.yaw >= 360.0f) g_player.yaw -= 360.0f;

    // 2. Main Analog Stick Movement
    float move_x = 0.0f;
    float move_z = 0.0f;
    int stick_x = pad->stick_x;
    int stick_y = pad->stick_y;
    int deadzone_m = 16;

    if (abs(stick_x) > deadzone_m) {
        move_x = (float)stick_x / 128.0f;
    }
    if (abs(stick_y) > deadzone_m) {
        move_z = -(float)stick_y / 128.0f; // Up is forward (-Z)
    }

    float rad = g_player.yaw * DEG_TO_RAD;
    float sin_y = sinf(rad);
    float cos_y = cosf(rad);

    float speed = 4.3f;
    float vx = (move_x * cos_y - move_z * sin_y) * speed;
    float vz = (move_x * sin_y + move_z * cos_y) * speed;

    if (g_player.damage_tint_time > 0.0f) {
        g_player.damage_tint_time -= dt;
    }

    // Jump (A button or D-pad Up)
    if (((pad->buttons_down & PAD_BUTTON_A) || (pad->buttons_down & PAD_BUTTON_UP)) && g_player.on_ground) {
        g_player.vel.y = 6.2f;
        g_player.on_ground = false;
        audio_play(SOUND_JUMP);
    }

    // Gravity
    g_player.vel.y -= 18.0f * dt;
    if (g_player.vel.y < -20.0f) g_player.vel.y = -20.0f;

    // Collision X
    float next_x = g_player.pos.x + vx * dt;
    if (!check_collision_at(next_x, g_player.pos.y, g_player.pos.z)) {
        g_player.pos.x = next_x;
    }

    // Collision Z
    float next_z = g_player.pos.z + vz * dt;
    if (!check_collision_at(next_x, g_player.pos.y, next_z)) {
        g_player.pos.z = next_z;
    }

    // Collision Y
    float next_y = g_player.pos.y + g_player.vel.y * dt;
    if (check_collision_at(g_player.pos.x, next_y, g_player.pos.z)) {
        if (g_player.vel.y < 0.0f) {
            g_player.on_ground = true;
        }
        g_player.vel.y = 0.0f;
    } else {
        g_player.pos.y = next_y;
        g_player.on_ground = false;
    }

    // Hotbar cycle (D-Pad Left / Right)
    if (pad->buttons_down & PAD_BUTTON_LEFT) {
        g_player.selected_slot = (g_player.selected_slot + HOTBAR_SIZE - 1) % HOTBAR_SIZE;
    }
    if (pad->buttons_down & PAD_BUTTON_RIGHT) {
        g_player.selected_slot = (g_player.selected_slot + 1) % HOTBAR_SIZE;
    }

    // Raycast target block
    Vec3 look_dir;
    float pitch_rad = g_player.pitch * DEG_TO_RAD;
    look_dir.x = sinf(rad) * cosf(pitch_rad);
    look_dir.y = -sinf(pitch_rad);
    look_dir.z = -cosf(rad) * cosf(pitch_rad);

    Vec3 eye_pos = g_player.pos;
    eye_pos.y += 1.62f;

    g_player.has_target = world_raycast(eye_pos, look_dir, 5.0f,
        &g_player.target_block, &g_player.place_pos, &g_player.target_face);

    // Attack mob or Mine block (R-Trigger or B button)
    bool attack_pressed = (pad->buttons_down & PAD_TRIGGER_R) || (pad->buttons_down & PAD_BUTTON_B);
    bool mine_held = (pad->buttons_held & PAD_TRIGGER_R) || (pad->buttons_held & PAD_BUTTON_B);

    if (attack_pressed) {
        ItemId weapon = g_player.hotbar[g_player.selected_slot].id;
        int dmg = item_get_damage(weapon);
        if (mobs_attack(eye_pos, look_dir, 3.5f, dmg)) {
            g_player.mining_progress = 0.0f;
        }
    }

    if (mine_held) {
        if (g_player.has_target) {
            BlockType bt = world_get_block(g_player.target_block.x, g_player.target_block.y, g_player.target_block.z);
            const BlockDef* def = block_get_def(bt);
            if (def->hardness > 0.0f) {
                ItemId tool = g_player.hotbar[g_player.selected_slot].id;
                float tool_speed = item_get_mining_speed(tool);
                float speed_factor = tool_speed / def->hardness;

                g_player.mining_progress += speed_factor * dt;
                if (g_player.mining_progress >= 1.0f) {
                    world_set_block(g_player.target_block.x, g_player.target_block.y, g_player.target_block.z, BLOCK_AIR);
                    g_player.mining_progress = 0.0f;
                    audio_play(SOUND_BREAK);
                }
            }
        }
    } else {
        g_player.mining_progress = 0.0f;
    }

    // Place block or use item (L-Trigger or Y button)
    bool place_pressed = (pad->buttons_down & PAD_TRIGGER_L) || (pad->buttons_down & PAD_BUTTON_Y);
    if (place_pressed) {
        ItemStack* cur = &g_player.hotbar[g_player.selected_slot];
        if (cur->count > 0) {
            if (item_is_food(cur->id)) {
                player_eat_food(cur->id);
                audio_play(SOUND_PLACE);
            } else if (cur->id >= ITEM_BLOCK_START && cur->id <= ITEM_BLOCK_END) {
                if (g_player.has_target) {
                    BlockPos p = g_player.place_pos;
                    if (!check_collision_at(g_player.pos.x, g_player.pos.y, g_player.pos.z)) {
                        world_set_block(p.x, p.y, p.z, (BlockType)cur->id);
                        audio_play(SOUND_PLACE);
                        cur->count--;
                        if (cur->count <= 0) {
                            cur->id = ITEM_NONE;
                            cur->count = 0;
                        }
                    }
                }
            }
        }
    }

    // Hunger & HP
    g_player.hunger_timer += dt;
    if (g_player.hunger_timer >= 12.0f) {
        g_player.hunger_timer = 0.0f;
        if (g_player.hunger > 0) g_player.hunger--;
    }

    g_player.regen_timer += dt;
    if (g_player.regen_timer >= 4.0f) {
        g_player.regen_timer = 0.0f;
        if (g_player.hunger >= 80 && g_player.hp < g_player.max_hp) {
            g_player.hp += 2;
            if (g_player.hp > g_player.max_hp) g_player.hp = g_player.max_hp;
        } else if (g_player.hunger == 0) {
            player_damage(5);
        }
    }
}

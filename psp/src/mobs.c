#include "mobs.h"
#include "renderer.h"
#include "world.h"
#include "player.h"
#include "dragon.h"
#include "audio.h"
#include <math.h>

Mob g_mobs[MAX_MOBS];
ItemDrop g_item_drops[MAX_ITEM_DROPS];
EndCrystal g_end_crystals[MAX_END_CRYSTALS];

static float g_mob_hurt_tint = 0.0f;

static void draw_box(float sx, float sy, float sz, uint32_t color) {
    if (g_mob_hurt_tint > 0.0f) {
        color = RGB(245, 45, 45);
    }
    sceGuDisable(GU_TEXTURE_2D);

    ColorVertex3D* v = (ColorVertex3D*)sceGuGetMemory(36 * sizeof(ColorVertex3D));
    if (!v) return;

    float x1 = -sx / 2.0f, x2 = sx / 2.0f;
    float y1 = -sy / 2.0f, y2 = sy / 2.0f;
    float z1 = -sz / 2.0f, z2 = sz / 2.0f;

    ColorVertex3D box_verts[36] = {
        // Front
        {color, x1, y1, z2}, {color, x2, y1, z2}, {color, x2, y2, z2},
        {color, x1, y1, z2}, {color, x2, y2, z2}, {color, x1, y2, z2},
        // Back
        {color, x2, y1, z1}, {color, x1, y1, z1}, {color, x1, y2, z1},
        {color, x2, y1, z1}, {color, x1, y2, z1}, {color, x2, y2, z1},
        // Top
        {color, x1, y2, z2}, {color, x2, y2, z2}, {color, x2, y2, z1},
        {color, x1, y2, z2}, {color, x2, y2, z1}, {color, x1, y2, z1},
        // Bottom
        {color, x1, y1, z1}, {color, x2, y1, z1}, {color, x2, y1, z2},
        {color, x1, y1, z1}, {color, x2, y1, z2}, {color, x1, y1, z2},
        // Left
        {color, x1, y1, z1}, {color, x1, y1, z2}, {color, x1, y2, z2},
        {color, x1, y1, z1}, {color, x1, y2, z2}, {color, x1, y2, z1},
        // Right
        {color, x2, y1, z2}, {color, x2, y1, z1}, {color, x2, y2, z1},
        {color, x2, y1, z2}, {color, x2, y2, z1}, {color, x2, y2, z2},
    };

    memcpy(v, box_verts, sizeof(box_verts));
    sceGumDrawArray(GU_TRIANGLES, GU_COLOR_8888 | GU_VERTEX_32BITF | GU_TRANSFORM_3D, 36, 0, v);
    sceGuEnable(GU_TEXTURE_2D);
}

void mobs_init(int dimension) {
    memset(g_mobs, 0, sizeof(g_mobs));
    memset(g_item_drops, 0, sizeof(g_item_drops));
    memset(g_end_crystals, 0, sizeof(g_end_crystals));

    float center_x = WORLD_SIZE_X / 2.0f;
    float center_z = WORLD_SIZE_Z / 2.0f;

    if (dimension == DIMENSION_OVERWORLD) {
        // Spawn Zombies and Creepers
        for (int i = 0; i < 6; i++) {
            g_mobs[i].type = (i % 2 == 0) ? MOB_ZOMBIE : MOB_CREEPER;
            float mx = center_x + (float)((rand() % 40) - 20);
            float mz = center_z + (float)((rand() % 40) - 20);
            int my = world_get_height((int)mx, (int)mz);
            g_mobs[i].pos = (Vec3){ mx, (float)my + 1.0f, mz };
            g_mobs[i].max_hp = 28;
            g_mobs[i].hp = 28;
            g_mobs[i].is_alive = true;
        }

        // Spawn some 3D rotating item drops!
        for (int i = 0; i < 4; i++) {
            g_item_drops[i].active = true;
            g_item_drops[i].block_type = (i == 0) ? BLOCK_POPCAT : ((i == 1) ? BLOCK_EBLAN : BLOCK_DIAMOND_ORE);
            float dx = center_x + (float)((rand() % 30) - 15);
            float dz = center_z + (float)((rand() % 30) - 15);
            int dy = world_get_height((int)dx, (int)dz);
            g_item_drops[i].pos = (Vec3){ dx, (float)dy + 1.2f, dz };
        }
    } else if (dimension == DIMENSION_NETHER) {
        // Spawn Piglins
        for (int i = 0; i < 6; i++) {
            g_mobs[i].type = MOB_PIGLIN;
            float mx = center_x + (float)((rand() % 30) - 15);
            float mz = center_z + (float)((rand() % 30) - 15);
            g_mobs[i].pos = (Vec3){ mx, 16.0f, mz };
            g_mobs[i].max_hp = 36;
            g_mobs[i].hp = 36;
            g_mobs[i].is_alive = true;
        }
    } else { // THE END
        // Spawn Endermen
        for (int i = 0; i < 6; i++) {
            g_mobs[i].type = MOB_ENDERMAN;
            float mx = center_x + (float)((rand() % 24) - 12);
            float mz = center_z + (float)((rand() % 24) - 12);
            g_mobs[i].pos = (Vec3){ mx, 28.0f, mz };
            g_mobs[i].max_hp = 55;
            g_mobs[i].hp = 55;
            g_mobs[i].is_alive = true;
        }

        // Init 4 End Crystals on top of Obsidian pillars
        int pillar_coords[4][2] = {
            {(int)center_x - 12, (int)center_z - 12},
            {(int)center_x + 12, (int)center_z - 12},
            {(int)center_x - 12, (int)center_z + 12},
            {(int)center_x + 12, (int)center_z + 12}
        };
        for (int i = 0; i < 4; i++) {
            g_end_crystals[i].active = true;
            g_end_crystals[i].pos = (Vec3){ (float)pillar_coords[i][0] + 0.5f, 41.5f, (float)pillar_coords[i][1] + 0.5f };
            g_end_crystals[i].spin_angle = 0.0f;
        }
    }
}

void mobs_update(float dt, Vec3 player_pos) {
    // 1. Update Mobs
    for (int i = 0; i < MAX_MOBS; i++) {
        Mob* m = &g_mobs[i];
        if (!m->is_alive) continue;

        m->walk_cycle += dt * 5.0f;
        if (m->hurt_time > 0.0f) {
            m->hurt_time -= dt;
            if (m->hurt_time < 0.0f) m->hurt_time = 0.0f;
        }

        float dx = player_pos.x - m->pos.x;
        float dz = player_pos.z - m->pos.z;
        float dist = sqrtf(dx*dx + dz*dz);

        if (dist > 0.5f && dist < 18.0f) {
            // Walk towards player
            float speed = (m->type == MOB_ENDERMAN) ? 3.0f : 1.8f;
            m->pos.x += (dx / dist) * speed * dt;
            m->pos.z += (dz / dist) * speed * dt;
            m->yaw = atan2f(dx, dz) * RAD_TO_DEG;

            // Attack player
            if (dist < 1.5f) {
                m->attack_cooldown += dt;
                if (m->attack_cooldown >= 1.2f) {
                    m->attack_cooldown = 0.0f;
                    int dmg = (m->type == MOB_CREEPER) ? 25 : ((m->type == MOB_ENDERMAN) ? 12 : 6);
                    player_damage(dmg);
                }
            }
        }

        // Keep on ground
        int ground_y = world_get_height((int)m->pos.x, (int)m->pos.z);
        m->pos.y = (float)ground_y + 1.0f;
    }

    // 2. Update 3D Item Drops (spinning and magnetic pull!)
    for (int i = 0; i < MAX_ITEM_DROPS; i++) {
        ItemDrop* drop = &g_item_drops[i];
        if (!drop->active) continue;

        drop->rot_y += dt * 90.0f;
        drop->bob_time += dt * 3.0f;

        // Magnetic attraction to player
        float dx = player_pos.x - drop->pos.x;
        float dy = (player_pos.y + 1.0f) - drop->pos.y;
        float dz = player_pos.z - drop->pos.z;
        float dist = sqrtf(dx*dx + dy*dy + dz*dz);

        if (dist < 4.0f) {
            drop->pos.x += (dx / dist) * dt * 6.0f;
            drop->pos.y += (dy / dist) * dt * 6.0f;
            drop->pos.z += (dz / dist) * dt * 6.0f;

            if (dist < 0.8f) {
                // Collect drop!
                drop->active = false;
            }
        }
    }

    // 3. Update End Crystals
    for (int i = 0; i < MAX_END_CRYSTALS; i++) {
        if (g_end_crystals[i].active) {
            g_end_crystals[i].spin_angle += dt * 120.0f;
        }
    }
}

static void render_zombie(Mob* m) {
    float walk_sin = sinf(m->walk_cycle);

    // 1. Head (Green)
    sceGumPushMatrix();
    ScePspFVector3 h_pos = { 0, 1.48f, 0 };
    sceGumTranslate(&h_pos);
    draw_box(0.48f, 0.48f, 0.48f, RGB(79, 168, 70));
    sceGumPopMatrix();

    // 2. Torso (Blue Shirt)
    sceGumPushMatrix();
    ScePspFVector3 t_pos = { 0, 0.9f, 0 };
    sceGumTranslate(&t_pos);
    draw_box(0.48f, 0.68f, 0.28f, RGB(31, 120, 180));
    sceGumPopMatrix();

    // 3. Arms (Outstretched forward!)
    sceGumPushMatrix();
    ScePspFVector3 la_pos = { -0.35f, 0.9f, 0.25f };
    sceGumTranslate(&la_pos);
    draw_box(0.2f, 0.2f, 0.6f, RGB(79, 168, 70));
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 ra_pos = { 0.35f, 0.9f, 0.25f };
    sceGumTranslate(&ra_pos);
    draw_box(0.2f, 0.2f, 0.6f, RGB(79, 168, 70));
    sceGumPopMatrix();

    // 4. Legs (Dark pants, walking)
    sceGumPushMatrix();
    ScePspFVector3 ll_pos = { -0.14f, 0.32f, walk_sin * 0.15f };
    sceGumTranslate(&ll_pos);
    draw_box(0.22f, 0.65f, 0.22f, RGB(34, 51, 102));
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 rl_pos = { 0.14f, 0.32f, -walk_sin * 0.15f };
    sceGumTranslate(&rl_pos);
    draw_box(0.22f, 0.65f, 0.22f, RGB(34, 51, 102));
    sceGumPopMatrix();
}

static void render_creeper(Mob* m) {
    float walk_sin = sinf(m->walk_cycle);

    // Head
    sceGumPushMatrix();
    ScePspFVector3 h_pos = { 0, 1.35f, 0 };
    sceGumTranslate(&h_pos);
    draw_box(0.46f, 0.46f, 0.46f, RGB(60, 176, 67));
    sceGumPopMatrix();

    // Torso
    sceGumPushMatrix();
    ScePspFVector3 t_pos = { 0, 0.8f, 0 };
    sceGumTranslate(&t_pos);
    draw_box(0.44f, 0.66f, 0.26f, RGB(46, 139, 87));
    sceGumPopMatrix();

    // 4 Legs
    uint32_t leg_col = RGB(60, 176, 67);
    sceGumPushMatrix();
    ScePspFVector3 fl_pos = { -0.14f, 0.22f, 0.12f + walk_sin * 0.1f };
    sceGumTranslate(&fl_pos);
    draw_box(0.2f, 0.45f, 0.2f, leg_col);
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 fr_pos = { 0.14f, 0.22f, 0.12f - walk_sin * 0.1f };
    sceGumTranslate(&fr_pos);
    draw_box(0.2f, 0.45f, 0.2f, leg_col);
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 bl_pos = { -0.14f, 0.22f, -0.12f - walk_sin * 0.1f };
    sceGumTranslate(&bl_pos);
    draw_box(0.2f, 0.45f, 0.2f, leg_col);
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 br_pos = { 0.14f, 0.22f, -0.12f + walk_sin * 0.1f };
    sceGumTranslate(&br_pos);
    draw_box(0.2f, 0.45f, 0.2f, leg_col);
    sceGumPopMatrix();
}

static void render_piglin(Mob* m) {
    // Piglin head with golden sword
    sceGumPushMatrix();
    ScePspFVector3 h_pos = { 0, 1.48f, 0 };
    sceGumTranslate(&h_pos);
    draw_box(0.55f, 0.48f, 0.5f, RGB(238, 165, 165));
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 t_pos = { 0, 0.9f, 0 };
    sceGumTranslate(&t_pos);
    draw_box(0.48f, 0.68f, 0.28f, RGB(138, 75, 35));
    sceGumPopMatrix();

    // Golden sword in hand!
    sceGumPushMatrix();
    ScePspFVector3 sw_pos = { 0.35f, 0.8f, 0.25f };
    sceGumTranslate(&sw_pos);
    draw_box(0.08f, 0.55f, 0.08f, RGB(245, 197, 24));
    sceGumPopMatrix();

    // Legs
    sceGumPushMatrix();
    ScePspFVector3 l_pos = { -0.14f, 0.32f, 0 };
    sceGumTranslate(&l_pos);
    draw_box(0.22f, 0.65f, 0.22f, RGB(90, 45, 18));
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 r_pos = { 0.14f, 0.32f, 0 };
    sceGumTranslate(&r_pos);
    draw_box(0.22f, 0.65f, 0.22f, RGB(90, 45, 18));
    sceGumPopMatrix();
}

static void render_enderman(Mob* m) {
    // Tall slender 2.9m black figure with glowing purple eyes!
    sceGumPushMatrix();
    ScePspFVector3 h_pos = { 0, 2.65f, 0 };
    sceGumTranslate(&h_pos);
    draw_box(0.38f, 0.38f, 0.38f, RGB(17, 17, 17));

    // Purple eyes
    ScePspFVector3 eye_pos = { 0, 0.05f, 0.2f };
    sceGumTranslate(&eye_pos);
    draw_box(0.26f, 0.06f, 0.04f, RGB(218, 34, 255));
    sceGumPopMatrix();

    // Torso
    sceGumPushMatrix();
    ScePspFVector3 t_pos = { 0, 2.05f, 0 };
    sceGumTranslate(&t_pos);
    draw_box(0.36f, 0.85f, 0.2f, RGB(10, 10, 10));
    sceGumPopMatrix();

    // Long arms
    sceGumPushMatrix();
    ScePspFVector3 la_pos = { -0.28f, 1.7f, 0 };
    sceGumTranslate(&la_pos);
    draw_box(0.12f, 1.2f, 0.12f, RGB(10, 10, 10));
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 ra_pos = { 0.28f, 1.7f, 0 };
    sceGumTranslate(&ra_pos);
    draw_box(0.12f, 1.2f, 0.12f, RGB(10, 10, 10));
    sceGumPopMatrix();

    // Long legs
    sceGumPushMatrix();
    ScePspFVector3 ll_pos = { -0.12f, 0.72f, 0 };
    sceGumTranslate(&ll_pos);
    draw_box(0.12f, 1.45f, 0.12f, RGB(10, 10, 10));
    sceGumPopMatrix();

    sceGumPushMatrix();
    ScePspFVector3 rl_pos = { 0.12f, 0.72f, 0 };
    sceGumTranslate(&rl_pos);
    draw_box(0.12f, 1.45f, 0.12f, RGB(10, 10, 10));
    sceGumPopMatrix();
}

void mobs_render(void) {
    // 1. Render mobs
    for (int i = 0; i < MAX_MOBS; i++) {
        Mob* m = &g_mobs[i];
        if (!m->is_alive) continue;

        g_mob_hurt_tint = m->hurt_time;

        sceGumPushMatrix();
        ScePspFVector3 pos = { m->pos.x, m->pos.y, m->pos.z };
        sceGumTranslate(&pos);
        sceGumRotateY(m->yaw * DEG_TO_RAD);

        if (m->type == MOB_ZOMBIE) render_zombie(m);
        else if (m->type == MOB_CREEPER) render_creeper(m);
        else if (m->type == MOB_PIGLIN) render_piglin(m);
        else if (m->type == MOB_ENDERMAN) render_enderman(m);

        sceGumPopMatrix();
    }
    g_mob_hurt_tint = 0.0f;

    // 2. Render 3D Item Drops (spinning and bobbing cubes!)
    for (int i = 0; i < MAX_ITEM_DROPS; i++) {
        ItemDrop* drop = &g_item_drops[i];
        if (!drop->active) continue;

        sceGumPushMatrix();
        float bob_y = sinf(drop->bob_time) * 0.12f;
        ScePspFVector3 pos = { drop->pos.x, drop->pos.y + bob_y, drop->pos.z };
        sceGumTranslate(&pos);
        sceGumRotateY(drop->rot_y * DEG_TO_RAD);

        const BlockDef* bdef = block_get_def(drop->block_type);
        draw_box(0.35f, 0.35f, 0.35f, bdef->map_color);

        sceGumPopMatrix();
    }
}

void mobs_render_crystals_and_beam(Vec3 dragon_pos) {
    for (int i = 0; i < MAX_END_CRYSTALS; i++) {
        EndCrystal* ec = &g_end_crystals[i];
        if (!ec->active) continue;

        // Draw crystal base
        sceGumPushMatrix();
        ScePspFVector3 bpos = { ec->pos.x, ec->pos.y - 0.2f, ec->pos.z };
        sceGumTranslate(&bpos);
        draw_box(0.8f, 0.25f, 0.8f, RGB(21, 11, 31));
        sceGumPopMatrix();

        // Draw inner glowing core
        sceGumPushMatrix();
        ScePspFVector3 cpos = { ec->pos.x, ec->pos.y + 0.3f, ec->pos.z };
        sceGumTranslate(&cpos);
        sceGumRotateY(ec->spin_angle * DEG_TO_RAD);
        draw_box(0.35f, 0.35f, 0.35f, RGB(218, 34, 255));
        sceGumPopMatrix();

        // Draw outer cage
        sceGumPushMatrix();
        sceGumTranslate(&cpos);
        sceGumRotateY(-ec->spin_angle * 0.5f * DEG_TO_RAD);
        draw_box(0.55f, 0.55f, 0.55f, RGBA(255, 119, 255, 180));
        sceGumPopMatrix();

        // Healing laser beam line connecting crystal to dragon!
        sceGuDisable(GU_TEXTURE_2D);
        ColorVertex3D* beam = (ColorVertex3D*)sceGuGetMemory(2 * sizeof(ColorVertex3D));
        if (beam) {
            uint32_t beam_col = RGB(220, 50, 255);
            beam[0] = (ColorVertex3D){ beam_col, ec->pos.x, ec->pos.y + 0.5f, ec->pos.z };
            beam[1] = (ColorVertex3D){ beam_col, dragon_pos.x, dragon_pos.y, dragon_pos.z };
            sceGumDrawArray(GU_LINES, GU_COLOR_8888 | GU_VERTEX_32BITF | GU_TRANSFORM_3D, 2, 0, beam);
        }
        sceGuEnable(GU_TEXTURE_2D);
    }
}

bool mobs_attack(Vec3 eye_pos, Vec3 look_dir, float range, int damage) {
    // 1. Check Mobs
    for (int i = 0; i < MAX_MOBS; i++) {
        Mob* m = &g_mobs[i];
        if (!m->is_alive) continue;

        float dx = m->pos.x - eye_pos.x;
        float dy = (m->pos.y + 0.9f) - eye_pos.y;
        float dz = m->pos.z - eye_pos.z;
        float dist = sqrtf(dx*dx + dy*dy + dz*dz);

        if (dist <= range && dist > 0.001f) {
            float dot = (dx * look_dir.x + dy * look_dir.y + dz * look_dir.z) / dist;
            if (dot > 0.7f) {
                m->hp -= damage;
                m->hurt_time = 0.35f;
                audio_play(SOUND_HURT);
                // Knockback
                m->pos.x += look_dir.x * 0.8f;
                m->pos.z += look_dir.z * 0.8f;

                if (m->hp <= 0) {
                    m->is_alive = false;
                    // Spawn drop
                    for (int d = 0; d < MAX_ITEM_DROPS; d++) {
                        if (!g_item_drops[d].active) {
                            g_item_drops[d].active = true;
                            g_item_drops[d].pos = m->pos;
                            g_item_drops[d].rot_y = 0.0f;
                            g_item_drops[d].bob_time = 0.0f;
                            g_item_drops[d].block_type = (m->type == MOB_ZOMBIE) ? BLOCK_WOOD :
                                                         ((m->type == MOB_CREEPER) ? BLOCK_TNT :
                                                         ((m->type == MOB_ENDERMAN) ? BLOCK_OBSIDIAN : BLOCK_GOLD_ORE));
                            break;
                        }
                    }
                }
                return true;
            }
        }
    }

    // 2. Check End Crystals
    for (int i = 0; i < MAX_END_CRYSTALS; i++) {
        EndCrystal* ec = &g_end_crystals[i];
        if (!ec->active) continue;

        float dx = ec->pos.x - eye_pos.x;
        float dy = (ec->pos.y + 0.3f) - eye_pos.y;
        float dz = ec->pos.z - eye_pos.z;
        float dist = sqrtf(dx*dx + dy*dy + dz*dz);

        if (dist <= range + 1.5f && dist > 0.001f) {
            float dot = (dx * look_dir.x + dy * look_dir.y + dz * look_dir.z) / dist;
            if (dot > 0.65f) {
                ec->active = false;
                audio_play(SOUND_EXPLOSION);
                dragon_damage(120);
                return true;
            }
        }
    }

    // 3. Check Dragon in The End
    if (g_world.current_dimension == DIMENSION_END && g_dragon.is_alive) {
        float dx = g_dragon.pos.x - eye_pos.x;
        float dy = g_dragon.pos.y - eye_pos.y;
        float dz = g_dragon.pos.z - eye_pos.z;
        float dist = sqrtf(dx*dx + dy*dy + dz*dz);

        if (dist <= 7.0f && dist > 0.001f) {
            float dot = (dx * look_dir.x + dy * look_dir.y + dz * look_dir.z) / dist;
            if (dot > 0.5f) {
                dragon_damage(damage);
                return true;
            }
        }
    }

    return false;
}

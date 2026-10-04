#include "items.h"
#include "common.h"

static const ItemDef g_special_items[] = {
    // Food
    { ITEM_APPLE, "Yabluko", ITEM_TYPE_FOOD, 20, 0, RGB(220, 40, 40) },
    { ITEM_STEAK, "Zharenyi Steik", ITEM_TYPE_FOOD, 40, 0, RGB(160, 60, 40) },
    { ITEM_SHAWARMA, "Shaurma Yeblana", ITEM_TYPE_FOOD, 75, 0, RGB(240, 200, 100) },

    // Tools
    { ITEM_PICK_WOOD, "Derev'yana Kyrka", ITEM_TYPE_TOOL, 2, 0, RGB(150, 110, 60) },
    { ITEM_PICK_STONE, "Kam'yana Kyrka", ITEM_TYPE_TOOL, 4, 0, RGB(140, 140, 140) },
    { ITEM_PICK_IRON, "Zalizna Kyrka", ITEM_TYPE_TOOL, 6, 0, RGB(210, 210, 210) },
    { ITEM_PICK_DIAMOND, "Almazna Kyrka", ITEM_TYPE_TOOL, 10, 0, RGB(80, 240, 240) },
    { ITEM_PICK_NETHERITE, "Nezeritova Kyrka", ITEM_TYPE_TOOL, 15, 0, RGB(70, 60, 65) },
    { ITEM_PICK_SUPER_EBLAN, "Kyrka Sverkh-Yeblana", ITEM_TYPE_TOOL, 35, 0, RGB(255, 230, 0) },

    // Weapons
    { ITEM_SWORD_WOOD, "Derev'yanyi Mech", ITEM_TYPE_WEAPON, 10, 0, RGB(150, 110, 60) },
    { ITEM_SWORD_IRON, "Zaliznyi Mech", ITEM_TYPE_WEAPON, 25, 0, RGB(210, 210, 210) },
    { ITEM_SWORD_DIAMOND, "Almaznyi Mech", ITEM_TYPE_WEAPON, 50, 0, RGB(80, 240, 240) },
    { ITEM_SWORD_DRAGONSLAYER, "Mech Drakonoborets", ITEM_TYPE_WEAPON, 160, 0, RGB(255, 60, 220) },

    // Cases
    { ITEM_CASE_BOMZH, "Bomzh-Keis", ITEM_TYPE_CASE, 0, 0, RGB(160, 120, 80) },
    { ITEM_CASE_DIAMOND, "Almaznyi Keis", ITEM_TYPE_CASE, 0, 0, RGB(60, 220, 240) },
    { ITEM_CASE_NETHER, "Nezer-Keis", ITEM_TYPE_CASE, 0, 0, RGB(240, 60, 40) },
    { ITEM_CASE_DRAGON, "Keis Drakona", ITEM_TYPE_CASE, 0, 0, RGB(180, 50, 250) },

    // Trash
    { ITEM_TRASH_SOCK, "Diryavyi Nosok", ITEM_TYPE_TRASH, 1, 0, RGB(180, 180, 160) },
    { ITEM_TRASH_ZHIGULI, "Banka Zhyhulia", ITEM_TYPE_TRASH, 5, 0, RGB(230, 180, 30) },
    { ITEM_TRASH_CIG, "Okurok Prymy", ITEM_TYPE_TRASH, 1, 0, RGB(240, 240, 220) },
    { ITEM_TRASH_NUT, "Irzhava Haika", ITEM_TYPE_TRASH, 2, 0, RGB(140, 90, 60) },

    // Boss
    { ITEM_DRAGON_EGG, "Yaitse Yeblan Drakona", ITEM_TYPE_MISC, 1000, 0, RGB(30, 10, 40) },
    { ITEM_EYE_OF_EBLAND, "Oko Eblanda", ITEM_TYPE_MISC, 100, 0, RGB(30, 200, 150) },

    { ITEM_NONE, "Pusto", ITEM_TYPE_MISC, 0, 0, 0 }
};

static ItemDef g_dynamic_block_item;

const ItemDef* item_get_def(ItemId id) {
    if (id >= ITEM_BLOCK_START && id <= ITEM_BLOCK_END) {
        const BlockDef* bdef = block_get_def((BlockType)id);
        g_dynamic_block_item.id = id;
        g_dynamic_block_item.name = bdef->name;
        g_dynamic_block_item.category = ITEM_TYPE_BLOCK;
        g_dynamic_block_item.block_type = (int)id;
        g_dynamic_block_item.value = 0;
        g_dynamic_block_item.color = bdef->map_color;
        return &g_dynamic_block_item;
    }

    for (int i = 0; g_special_items[i].id != ITEM_NONE; i++) {
        if (g_special_items[i].id == id) {
            return &g_special_items[i];
        }
    }

    return &g_special_items[sizeof(g_special_items)/sizeof(g_special_items[0]) - 1];
}

bool item_is_food(ItemId id) {
    return (id == ITEM_APPLE || id == ITEM_STEAK || id == ITEM_SHAWARMA);
}

bool item_is_pickaxe(ItemId id) {
    return (id >= ITEM_PICK_WOOD && id <= ITEM_PICK_SUPER_EBLAN);
}

float item_get_mining_speed(ItemId id) {
    switch (id) {
        case ITEM_PICK_WOOD: return 2.0f;
        case ITEM_PICK_STONE: return 3.5f;
        case ITEM_PICK_IRON: return 5.5f;
        case ITEM_PICK_DIAMOND: return 9.0f;
        case ITEM_PICK_NETHERITE: return 15.0f;
        case ITEM_PICK_SUPER_EBLAN: return 35.0f;
        default: return 1.0f;
    }
}

int item_get_damage(ItemId id) {
    const ItemDef* def = item_get_def(id);
    if (def->category == ITEM_TYPE_WEAPON) {
        return def->value;
    }
    return 5; // Unarmed fist damage
}

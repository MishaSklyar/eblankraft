#ifndef EBLANKRAFT_ITEMS_H
#define EBLANKRAFT_ITEMS_H

#include <stdint.h>
#include <stdbool.h>
#include "blocks.h"

typedef enum {
    ITEM_TYPE_BLOCK = 0,
    ITEM_TYPE_FOOD,
    ITEM_TYPE_TOOL,
    ITEM_TYPE_WEAPON,
    ITEM_TYPE_CASE,
    ITEM_TYPE_TRASH,
    ITEM_TYPE_MISC
} ItemCategory;

typedef enum {
    ITEM_NONE = 0,
    // Blocks as items: 1 .. BLOCK_COUNT - 1
    ITEM_BLOCK_START = 1,
    ITEM_BLOCK_END = BLOCK_COUNT - 1,

    // Food
    ITEM_APPLE = 50,
    ITEM_STEAK,
    ITEM_SHAWARMA, // Шаурма Єблана!

    // Tools & Weapons
    ITEM_PICK_WOOD,
    ITEM_PICK_STONE,
    ITEM_PICK_IRON,
    ITEM_PICK_DIAMOND,
    ITEM_PICK_NETHERITE,
    ITEM_PICK_SUPER_EBLAN, // Кирка Сверх-Єблана
    ITEM_SWORD_WOOD,
    ITEM_SWORD_IRON,
    ITEM_SWORD_DIAMOND,
    ITEM_SWORD_DRAGONSLAYER, // Меч Драконоборець!

    // Cases
    ITEM_CASE_BOMZH,
    ITEM_CASE_DIAMOND,
    ITEM_CASE_NETHER,
    ITEM_CASE_DRAGON,

    // Trash & Meme Items
    ITEM_TRASH_SOCK,    // Дірявий носок
    ITEM_TRASH_ZHIGULI, // Банка Жигуля
    ITEM_TRASH_CIG,     // Окурок Прими
    ITEM_TRASH_NUT,     // Іржава гайка

    // Boss special
    ITEM_DRAGON_EGG,
    ITEM_EYE_OF_EBLAND
} ItemId;

typedef struct {
    ItemId id;
    const char* name;
    ItemCategory category;
    int value; // hunger restore, damage, mining multiplier, etc.
    int block_type; // If category == ITEM_TYPE_BLOCK
    uint32_t color;
} ItemDef;

typedef struct {
    ItemId id;
    int count;
} ItemStack;

const ItemDef* item_get_def(ItemId id);
bool item_is_food(ItemId id);
bool item_is_pickaxe(ItemId id);
float item_get_mining_speed(ItemId id);
int item_get_damage(ItemId id);

#endif // EBLANKRAFT_ITEMS_H

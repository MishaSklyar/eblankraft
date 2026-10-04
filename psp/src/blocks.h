#ifndef EBLANKRAFT_BLOCKS_H
#define EBLANKRAFT_BLOCKS_H

#include <stdint.h>
#include <stdbool.h>

typedef enum {
    BLOCK_AIR = 0,
    BLOCK_GRASS,
    BLOCK_DIRT,
    BLOCK_STONE,
    BLOCK_BEDROCK,
    BLOCK_WOOD,
    BLOCK_LEAVES,
    BLOCK_SAND,
    BLOCK_WATER,
    BLOCK_NETHERRACK,
    BLOCK_LAVA,
    BLOCK_ENDSTONE,
    BLOCK_OBSIDIAN,
    BLOCK_COAL_ORE,
    BLOCK_IRON_ORE,
    BLOCK_GOLD_ORE,
    BLOCK_DIAMOND_ORE,
    BLOCK_NETHERITE,
    BLOCK_POPCAT,
    BLOCK_TNT,
    BLOCK_CRAFTING_TABLE,
    BLOCK_GLOWSTONE,
    BLOCK_GLASS,
    BLOCK_BRICKS,
    BLOCK_EBLAN,          // Офіційний Еблан-Блок!
    BLOCK_COBBLESTONE,
    BLOCK_PLANKS,
    BLOCK_BOOKSHELF,
    BLOCK_SOUL_SAND,
    BLOCK_NETHER_BRICKS,
    BLOCK_NETHER_QUARTZ,
    BLOCK_DRAGON_EGG,
    BLOCK_COUNT
} BlockType;

typedef enum {
    FACE_TOP = 0,
    FACE_BOTTOM,
    FACE_NORTH,
    FACE_SOUTH,
    FACE_EAST,
    FACE_WEST
} BlockFace;

typedef struct {
    const char* name;
    uint8_t tex_top;
    uint8_t tex_bottom;
    uint8_t tex_side;
    bool is_transparent;
    bool is_solid;
    float hardness;
    uint32_t map_color;
} BlockDef;

extern const BlockDef g_block_defs[BLOCK_COUNT];

static inline const BlockDef* block_get_def(BlockType type) {
    if (type >= BLOCK_COUNT) return &g_block_defs[BLOCK_AIR];
    return &g_block_defs[type];
}

static inline bool block_is_transparent(BlockType type) {
    if (type >= BLOCK_COUNT) return true;
    return g_block_defs[type].is_transparent;
}

static inline bool block_is_solid(BlockType type) {
    if (type >= BLOCK_COUNT) return false;
    return g_block_defs[type].is_solid;
}

#endif // EBLANKRAFT_BLOCKS_H

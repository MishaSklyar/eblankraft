#include "blocks.h"
#include "common.h"

const BlockDef g_block_defs[BLOCK_COUNT] = {
    [BLOCK_AIR] = {
        .name = "Povitrya",
        .tex_top = 0, .tex_bottom = 0, .tex_side = 0,
        .is_transparent = true, .is_solid = false, .hardness = 0.0f,
        .map_color = 0x00000000
    },
    [BLOCK_GRASS] = {
        .name = "Trava",
        .tex_top = 0, .tex_bottom = 2, .tex_side = 1,
        .is_transparent = false, .is_solid = true, .hardness = 0.5f,
        .map_color = RGB(85, 170, 85)
    },
    [BLOCK_DIRT] = {
        .name = "Zemlya",
        .tex_top = 2, .tex_bottom = 2, .tex_side = 2,
        .is_transparent = false, .is_solid = true, .hardness = 0.5f,
        .map_color = RGB(134, 96, 67)
    },
    [BLOCK_STONE] = {
        .name = "Kamin",
        .tex_top = 3, .tex_bottom = 3, .tex_side = 3,
        .is_transparent = false, .is_solid = true, .hardness = 1.5f,
        .map_color = RGB(128, 128, 128)
    },
    [BLOCK_BEDROCK] = {
        .name = "Bedrok",
        .tex_top = 4, .tex_bottom = 4, .tex_side = 4,
        .is_transparent = false, .is_solid = true, .hardness = -1.0f,
        .map_color = RGB(32, 32, 32)
    },
    [BLOCK_WOOD] = {
        .name = "Dub",
        .tex_top = 6, .tex_bottom = 6, .tex_side = 5,
        .is_transparent = false, .is_solid = true, .hardness = 1.0f,
        .map_color = RGB(103, 82, 49)
    },
    [BLOCK_LEAVES] = {
        .name = "Listya",
        .tex_top = 7, .tex_bottom = 7, .tex_side = 7,
        .is_transparent = true, .is_solid = true, .hardness = 0.2f,
        .map_color = RGB(60, 140, 60)
    },
    [BLOCK_SAND] = {
        .name = "Pisok",
        .tex_top = 8, .tex_bottom = 8, .tex_side = 8,
        .is_transparent = false, .is_solid = true, .hardness = 0.5f,
        .map_color = RGB(218, 206, 147)
    },
    [BLOCK_WATER] = {
        .name = "Voda",
        .tex_top = 9, .tex_bottom = 9, .tex_side = 9,
        .is_transparent = true, .is_solid = false, .hardness = 100.0f,
        .map_color = RGB(64, 96, 255)
    },
    [BLOCK_NETHERRACK] = {
        .name = "Nezerak",
        .tex_top = 10, .tex_bottom = 10, .tex_side = 10,
        .is_transparent = false, .is_solid = true, .hardness = 0.4f,
        .map_color = RGB(120, 30, 30)
    },
    [BLOCK_LAVA] = {
        .name = "Lava",
        .tex_top = 11, .tex_bottom = 11, .tex_side = 11,
        .is_transparent = false, .is_solid = false, .hardness = 100.0f,
        .map_color = RGB(255, 100, 0)
    },
    [BLOCK_ENDSTONE] = {
        .name = "End-Kamin",
        .tex_top = 12, .tex_bottom = 12, .tex_side = 12,
        .is_transparent = false, .is_solid = true, .hardness = 2.0f,
        .map_color = RGB(225, 230, 160)
    },
    [BLOCK_OBSIDIAN] = {
        .name = "Obsidian",
        .tex_top = 13, .tex_bottom = 13, .tex_side = 13,
        .is_transparent = false, .is_solid = true, .hardness = 5.0f,
        .map_color = RGB(25, 15, 45)
    },
    [BLOCK_COAL_ORE] = {
        .name = "Vuhilna Ruda",
        .tex_top = 14, .tex_bottom = 14, .tex_side = 14,
        .is_transparent = false, .is_solid = true, .hardness = 2.0f,
        .map_color = RGB(50, 50, 50)
    },
    [BLOCK_IRON_ORE] = {
        .name = "Zalizna Ruda",
        .tex_top = 15, .tex_bottom = 15, .tex_side = 15,
        .is_transparent = false, .is_solid = true, .hardness = 2.5f,
        .map_color = RGB(180, 150, 130)
    },
    [BLOCK_GOLD_ORE] = {
        .name = "Zolota Ruda",
        .tex_top = 16, .tex_bottom = 16, .tex_side = 16,
        .is_transparent = false, .is_solid = true, .hardness = 2.5f,
        .map_color = RGB(255, 215, 0)
    },
    [BLOCK_DIAMOND_ORE] = {
        .name = "Almazna Ruda",
        .tex_top = 17, .tex_bottom = 17, .tex_side = 17,
        .is_transparent = false, .is_solid = true, .hardness = 3.0f,
        .map_color = RGB(90, 230, 240)
    },
    [BLOCK_NETHERITE] = {
        .name = "Blok Nezeritu",
        .tex_top = 18, .tex_bottom = 18, .tex_side = 18,
        .is_transparent = false, .is_solid = true, .hardness = 4.0f,
        .map_color = RGB(65, 55, 60)
    },
    [BLOCK_POPCAT] = {
        .name = "Pop-Kot Blok",
        .tex_top = 19, .tex_bottom = 19, .tex_side = 19,
        .is_transparent = false, .is_solid = true, .hardness = 0.5f,
        .map_color = RGB(255, 180, 150)
    },
    [BLOCK_TNT] = {
        .name = "TNT",
        .tex_top = 20, .tex_bottom = 20, .tex_side = 21,
        .is_transparent = false, .is_solid = true, .hardness = 0.1f,
        .map_color = RGB(220, 40, 40)
    },
    [BLOCK_CRAFTING_TABLE] = {
        .name = "Verstak",
        .tex_top = 22, .tex_bottom = 29, .tex_side = 23,
        .is_transparent = false, .is_solid = true, .hardness = 1.0f,
        .map_color = RGB(140, 100, 60)
    },
    [BLOCK_GLOWSTONE] = {
        .name = "Svitlokamin",
        .tex_top = 24, .tex_bottom = 24, .tex_side = 24,
        .is_transparent = false, .is_solid = true, .hardness = 0.3f,
        .map_color = RGB(245, 210, 110)
    },
    [BLOCK_GLASS] = {
        .name = "Sklo",
        .tex_top = 25, .tex_bottom = 25, .tex_side = 25,
        .is_transparent = true, .is_solid = true, .hardness = 0.2f,
        .map_color = RGB(220, 240, 255)
    },
    [BLOCK_BRICKS] = {
        .name = "Tsegla",
        .tex_top = 26, .tex_bottom = 26, .tex_side = 26,
        .is_transparent = false, .is_solid = true, .hardness = 2.0f,
        .map_color = RGB(155, 75, 65)
    },
    [BLOCK_EBLAN] = {
        .name = "Eblan-Blok",
        .tex_top = 27, .tex_bottom = 27, .tex_side = 27,
        .is_transparent = false, .is_solid = true, .hardness = 0.8f,
        .map_color = RGB(255, 220, 100)
    },
    [BLOCK_COBBLESTONE] = {
        .name = "Bulyzhnyk",
        .tex_top = 28, .tex_bottom = 28, .tex_side = 28,
        .is_transparent = false, .is_solid = true, .hardness = 1.8f,
        .map_color = RGB(110, 110, 110)
    },
    [BLOCK_PLANKS] = {
        .name = "Doshky",
        .tex_top = 29, .tex_bottom = 29, .tex_side = 29,
        .is_transparent = false, .is_solid = true, .hardness = 1.0f,
        .map_color = RGB(160, 120, 70)
    },
    [BLOCK_BOOKSHELF] = {
        .name = "Knyzhkova Politsya",
        .tex_top = 29, .tex_bottom = 29, .tex_side = 30,
        .is_transparent = false, .is_solid = true, .hardness = 1.0f,
        .map_color = RGB(140, 90, 50)
    },
    [BLOCK_SOUL_SAND] = {
        .name = "Pisok Dush",
        .tex_top = 31, .tex_bottom = 31, .tex_side = 31,
        .is_transparent = false, .is_solid = true, .hardness = 0.6f,
        .map_color = RGB(85, 60, 45)
    },
    [BLOCK_NETHER_BRICKS] = {
        .name = "Adska Tsegla",
        .tex_top = 32, .tex_bottom = 32, .tex_side = 32,
        .is_transparent = false, .is_solid = true, .hardness = 2.0f,
        .map_color = RGB(45, 20, 25)
    },
    [BLOCK_NETHER_QUARTZ] = {
        .name = "Kvartsova Ruda",
        .tex_top = 33, .tex_bottom = 33, .tex_side = 33,
        .is_transparent = false, .is_solid = true, .hardness = 1.5f,
        .map_color = RGB(160, 50, 50)
    },
    [BLOCK_DRAGON_EGG] = {
        .name = "Yaitse Yeblan Drakona",
        .tex_top = 34, .tex_bottom = 34, .tex_side = 34,
        .is_transparent = false, .is_solid = true, .hardness = 3.5f,
        .map_color = RGB(30, 10, 40)
    }
};

/**
 * Eblankraft 2.0 - Items Registry, Tools, Weapons, Foods, Junk & Crafting System
 */

const ITEM_TYPES = {
    // Blocks mapped from BLOCK_TYPES
    GRASS: 'grass',
    DIRT: 'dirt',
    STONE: 'stone',
    COBBLESTONE: 'cobblestone',
    WOOD: 'wood',
    PLANKS: 'planks',
    LEAVES: 'leaves',
    BRICKS: 'bricks',
    GLASS: 'glass',
    SAND: 'sand',
    TNT: 'tnt',
    DIAMOND_BLOCK: 'diamond_block',
    GOLD_BLOCK: 'gold_block',
    EBLAN_BLOCK: 'eblan_block',
    BEDROCK: 'bedrock',
    GLOWSTONE: 'glowstone',
    BOOKSHELF: 'bookshelf',
    CRAFTING_TABLE: 'crafting_table',
    WATER: 'water',
    LAVA: 'lava',
    SPONGE: 'sponge',
    MEME_CAT: 'meme_cat',
    COAL_ORE: 'coal_ore',
    IRON_ORE: 'iron_ore',
    OBSIDIAN: 'obsidian',
    NETHERRACK: 'netherrack',
    SOUL_SAND: 'soul_sand',
    NETHER_BRICKS: 'nether_bricks',
    NETHER_QUARTZ: 'nether_quartz',
    NETHERITE_BLOCK: 'netherite_block',
    END_STONE: 'end_stone',
    DRAGON_EGG: 'dragon_egg',
    PORTAL_NETHER: 'portal_nether',
    PORTAL_END: 'portal_end',
    SNOW: 'snow',
    ICE: 'ice',
    PACKED_ICE: 'packed_ice',
    SANDSTONE: 'sandstone',
    CACTUS: 'cactus',
    BIRCH_WOOD: 'birch_wood',
    BIRCH_LEAVES: 'birch_leaves',
    BIRCH_PLANKS: 'birch_planks',
    SPRUCE_WOOD: 'spruce_wood',
    SPRUCE_LEAVES: 'spruce_leaves',
    SPRUCE_PLANKS: 'spruce_planks',
    JUNGLE_WOOD: 'jungle_wood',
    JUNGLE_LEAVES: 'jungle_leaves',
    RED_FLOWER: 'red_flower',
    YELLOW_FLOWER: 'yellow_flower',
    RED_MUSHROOM: 'red_mushroom',
    BROWN_MUSHROOM: 'brown_mushroom',
    CLAY: 'clay',
    GRAVEL: 'gravel',
    MOSSY_COBBLESTONE: 'mossy_cobblestone',
    REDSTONE_LAMP: 'redstone_lamp',
    TERRACOTTA: 'terracotta',

    // Redstone & Electronics
    REDSTONE_DUST: 'redstone_dust',
    REDSTONE_WIRE: 'redstone_wire',
    REDSTONE_TORCH: 'redstone_torch',
    LEVER: 'lever',
    REDSTONE_BLOCK: 'redstone_block',
    STONE_BUTTON: 'stone_button',
    PRESSURE_PLATE: 'pressure_plate',
    COMPUTER: 'computer',
    REDSTONE_LAMP_ON: 'redstone_lamp_on',

    // Emerald
    EMERALD: 'emerald',

    // Firearms & Explosives
    AK47: 'ak47',
    M4A1: 'm4a1',
    AWP: 'awp',
    SHOTGUN: 'shotgun',
    DEAGLE: 'deagle',
    GLOCK: 'glock',
    MP5: 'mp5',
    RPG: 'rpg',
    GRENADE: 'grenade',

    // Ammo
    AMMO_PISTOL: 'ammo_pistol',
    AMMO_RIFLE: 'ammo_rifle',
    AMMO_SNIPER: 'ammo_sniper',
    AMMO_SHOTGUN: 'ammo_shotgun',
    AMMO_ROCKET: 'ammo_rocket',

    // Vehicles (Cars & Transport)
    CAR_SPORT: 'car_sport',
    CAR_POLICE: 'car_police',
    CAR_CYBER: 'car_cyber',
    CAR_TRUCK: 'car_truck',
    CAR_F1: 'car_f1',
    BICYCLE: 'bicycle',
    TOTEM_OF_UNDYING: 'totem_of_undying',

    // Tools & Weapons
    WOOD_PICKAXE: 'wood_pickaxe',
    STONE_PICKAXE: 'stone_pickaxe',
    IRON_PICKAXE: 'iron_pickaxe',
    DIAMOND_PICKAXE: 'diamond_pickaxe',
    NETHERITE_PICKAXE: 'netherite_pickaxe',
    EBLAN_PICKAXE: 'eblan_pickaxe',

    WOOD_SWORD: 'wood_sword',
    STONE_SWORD: 'stone_sword',
    IRON_SWORD: 'iron_sword',
    DIAMOND_SWORD: 'diamond_sword',
    NETHERITE_SWORD: 'netherite_sword',
    EBLAN_SWORD: 'eblan_sword',
    SHIELD: 'shield',

    // Armor (Захисна броня)
    DIAMOND_HELMET: 'diamond_helmet',
    DIAMOND_CHESTPLATE: 'diamond_chestplate',
    DIAMOND_LEGGINGS: 'diamond_leggings',
    DIAMOND_BOOTS: 'diamond_boots',
    NETHERITE_CHESTPLATE: 'netherite_chestplate',
    IRON_CHESTPLATE: 'iron_chestplate',

    // Raw Materials
    STICK: 'stick',
    COAL: 'coal',
    IRON_INGOT: 'iron_ingot',
    GOLD_INGOT: 'gold_ingot',
    DIAMOND_ITEM: 'diamond_item',
    NETHERITE_SCRAP: 'netherite_scrap',
    ENDER_EYE: 'ender_eye',
    BLAZE_ROD: 'blaze_rod',
    GUNPOWDER: 'gunpowder',
    ROTTEN_FLESH: 'rotten_flesh',

    // Foods
    APPLE: 'apple',
    COOKED_STEAK: 'cooked_steak',
    MEME_DONER: 'meme_doner',

    // Junk (Мусор)
    JUNK_SOCK: 'junk_sock',
    JUNK_BEER: 'junk_beer',
    JUNK_CIG: 'junk_cig',
    JUNK_NUT: 'junk_nut',
    JUNK_TOKEN: 'junk_token',

    // Cases
    CASE_HOBO: 'case_hobo',
    CASE_DIAMOND: 'case_diamond',
    CASE_NETHER: 'case_nether',
    CASE_DRAGON: 'case_dragon'
};

const ITEM_REGISTRY = {
    // --- BLOCKS ---
    [ITEM_TYPES.GRASS]: { id: ITEM_TYPES.GRASS, name: "Трава", category: 'block', blockType: 1, icon: 'grass_side', maxStack: 64 },
    [ITEM_TYPES.DIRT]: { id: ITEM_TYPES.DIRT, name: "Земля", category: 'block', blockType: 2, icon: 'dirt', maxStack: 64 },
    [ITEM_TYPES.STONE]: { id: ITEM_TYPES.STONE, name: "Камень", category: 'block', blockType: 3, icon: 'stone', maxStack: 64 },
    [ITEM_TYPES.COBBLESTONE]: { id: ITEM_TYPES.COBBLESTONE, name: "Булыжник", category: 'block', blockType: 4, icon: 'cobblestone', maxStack: 64 },
    [ITEM_TYPES.WOOD]: { id: ITEM_TYPES.WOOD, name: "Дуб (Бревно)", category: 'block', blockType: 5, icon: 'wood_side', maxStack: 64 },
    [ITEM_TYPES.PLANKS]: { id: ITEM_TYPES.PLANKS, name: "Доски", category: 'block', blockType: 6, icon: 'planks', maxStack: 64 },
    [ITEM_TYPES.LEAVES]: { id: ITEM_TYPES.LEAVES, name: "Листва", category: 'block', blockType: 7, icon: 'leaves', maxStack: 64 },
    [ITEM_TYPES.BRICKS]: { id: ITEM_TYPES.BRICKS, name: "Кирпичи", category: 'block', blockType: 8, icon: 'bricks', maxStack: 64 },
    [ITEM_TYPES.GLASS]: { id: ITEM_TYPES.GLASS, name: "Стекло", category: 'block', blockType: 9, icon: 'glass', maxStack: 64 },
    [ITEM_TYPES.SAND]: { id: ITEM_TYPES.SAND, name: "Песок", category: 'block', blockType: 10, icon: 'sand', maxStack: 64 },
    [ITEM_TYPES.TNT]: { id: ITEM_TYPES.TNT, name: "Динамит (ТНТ)", category: 'block', blockType: 11, icon: 'tnt_side', maxStack: 64 },
    [ITEM_TYPES.DIAMOND_BLOCK]: { id: ITEM_TYPES.DIAMOND_BLOCK, name: "Алмазный блок", category: 'block', blockType: 12, icon: 'diamond', maxStack: 64 },
    [ITEM_TYPES.GOLD_BLOCK]: { id: ITEM_TYPES.GOLD_BLOCK, name: "Золотой блок", category: 'block', blockType: 13, icon: 'gold', maxStack: 64 },
    [ITEM_TYPES.EBLAN_BLOCK]: { id: ITEM_TYPES.EBLAN_BLOCK, name: "Еблан-Блок", category: 'block', blockType: 14, icon: 'eblan', maxStack: 64 },
    [ITEM_TYPES.BEDROCK]: { id: ITEM_TYPES.BEDROCK, name: "Бедрок", category: 'block', blockType: 15, icon: 'bedrock', maxStack: 64 },
    [ITEM_TYPES.GLOWSTONE]: { id: ITEM_TYPES.GLOWSTONE, name: "Светокамень", category: 'block', blockType: 16, icon: 'glowstone', maxStack: 64 },
    [ITEM_TYPES.BOOKSHELF]: { id: ITEM_TYPES.BOOKSHELF, name: "Книжная полка", category: 'block', blockType: 17, icon: 'bookshelf', maxStack: 64 },
    [ITEM_TYPES.CRAFTING_TABLE]: { id: ITEM_TYPES.CRAFTING_TABLE, name: "Верстак", category: 'block', blockType: 18, icon: 'craft_top', maxStack: 64 },
    [ITEM_TYPES.WATER]: { id: ITEM_TYPES.WATER, name: "Вода", category: 'block', blockType: 19, icon: 'water', maxStack: 64 },
    [ITEM_TYPES.LAVA]: { id: ITEM_TYPES.LAVA, name: "Лава", category: 'block', blockType: 20, icon: 'lava', maxStack: 64 },
    [ITEM_TYPES.SPONGE]: { id: ITEM_TYPES.SPONGE, name: "Губка", category: 'block', blockType: 21, icon: 'sponge', maxStack: 64 },
    [ITEM_TYPES.MEME_CAT]: { id: ITEM_TYPES.MEME_CAT, name: "Поп-Кот", category: 'block', blockType: 22, icon: 'cat', maxStack: 64 },
    [ITEM_TYPES.COAL_ORE]: { id: ITEM_TYPES.COAL_ORE, name: "Угольная руда", category: 'block', blockType: 23, icon: 'coal_ore', maxStack: 64 },
    [ITEM_TYPES.IRON_ORE]: { id: ITEM_TYPES.IRON_ORE, name: "Железная руда", category: 'block', blockType: 24, icon: 'iron_ore', maxStack: 64 },
    [ITEM_TYPES.OBSIDIAN]: { id: ITEM_TYPES.OBSIDIAN, name: "Обсидиан", category: 'block', blockType: 25, icon: 'obsidian', maxStack: 64 },
    [ITEM_TYPES.NETHERRACK]: { id: ITEM_TYPES.NETHERRACK, name: "Адский камень", category: 'block', blockType: 26, icon: 'netherrack', maxStack: 64 },
    [ITEM_TYPES.SOUL_SAND]: { id: ITEM_TYPES.SOUL_SAND, name: "Песок душ", category: 'block', blockType: 27, icon: 'soul_sand', maxStack: 64 },
    [ITEM_TYPES.NETHER_BRICKS]: { id: ITEM_TYPES.NETHER_BRICKS, name: "Адские кирпичи", category: 'block', blockType: 28, icon: 'nether_bricks', maxStack: 64 },
    [ITEM_TYPES.NETHER_QUARTZ]: { id: ITEM_TYPES.NETHER_QUARTZ, name: "Кварцевая руда", category: 'block', blockType: 29, icon: 'nether_quartz', maxStack: 64 },
    [ITEM_TYPES.NETHERITE_BLOCK]: { id: ITEM_TYPES.NETHERITE_BLOCK, name: "Незеритовый блок", category: 'block', blockType: 30, icon: 'netherite_block', maxStack: 64 },
    [ITEM_TYPES.END_STONE]: { id: ITEM_TYPES.END_STONE, name: "Энд-камень", category: 'block', blockType: 31, icon: 'end_stone', maxStack: 64 },
    [ITEM_TYPES.DRAGON_EGG]: { id: ITEM_TYPES.DRAGON_EGG, name: "Яйцо Еблан Дракона", category: 'block', blockType: 32, icon: 'dragon_egg', maxStack: 64 },
    [ITEM_TYPES.PORTAL_NETHER]: { id: ITEM_TYPES.PORTAL_NETHER, name: "Портал в Незер", category: 'block', blockType: 33, icon: 'portal_nether', maxStack: 64 },
    [ITEM_TYPES.PORTAL_END]: { id: ITEM_TYPES.PORTAL_END, name: "Портал в Энд", category: 'block', blockType: 34, icon: 'portal_end', maxStack: 64 },
    [ITEM_TYPES.SNOW]: { id: ITEM_TYPES.SNOW, name: "Сніг", category: 'block', blockType: 35, icon: 'snow', maxStack: 64 },
    [ITEM_TYPES.ICE]: { id: ITEM_TYPES.ICE, name: "Лід", category: 'block', blockType: 36, icon: 'ice', maxStack: 64 },
    [ITEM_TYPES.PACKED_ICE]: { id: ITEM_TYPES.PACKED_ICE, name: "Щільний лід", category: 'block', blockType: 37, icon: 'packed_ice', maxStack: 64 },
    [ITEM_TYPES.SANDSTONE]: { id: ITEM_TYPES.SANDSTONE, name: "Пісковик", category: 'block', blockType: 38, icon: 'sandstone_side', maxStack: 64 },
    [ITEM_TYPES.CACTUS]: { id: ITEM_TYPES.CACTUS, name: "Кактус", category: 'block', blockType: 39, icon: 'cactus_side', maxStack: 64 },
    [ITEM_TYPES.BIRCH_WOOD]: { id: ITEM_TYPES.BIRCH_WOOD, name: "Береза (Колода)", category: 'block', blockType: 40, icon: 'birch_wood_side', maxStack: 64 },
    [ITEM_TYPES.BIRCH_LEAVES]: { id: ITEM_TYPES.BIRCH_LEAVES, name: "Березове листя", category: 'block', blockType: 41, icon: 'birch_leaves', maxStack: 64 },
    [ITEM_TYPES.BIRCH_PLANKS]: { id: ITEM_TYPES.BIRCH_PLANKS, name: "Березові дошки", category: 'block', blockType: 42, icon: 'birch_planks', maxStack: 64 },
    [ITEM_TYPES.SPRUCE_WOOD]: { id: ITEM_TYPES.SPRUCE_WOOD, name: "Смерека (Хвоя)", category: 'block', blockType: 43, icon: 'spruce_wood_side', maxStack: 64 },
    [ITEM_TYPES.SPRUCE_LEAVES]: { id: ITEM_TYPES.SPRUCE_LEAVES, name: "Хвоя (Листя)", category: 'block', blockType: 44, icon: 'spruce_leaves', maxStack: 64 },
    [ITEM_TYPES.SPRUCE_PLANKS]: { id: ITEM_TYPES.SPRUCE_PLANKS, name: "Смерекові дошки", category: 'block', blockType: 45, icon: 'spruce_planks', maxStack: 64 },
    [ITEM_TYPES.JUNGLE_WOOD]: { id: ITEM_TYPES.JUNGLE_WOOD, name: "Тропічне дерево", category: 'block', blockType: 46, icon: 'jungle_wood_side', maxStack: 64 },
    [ITEM_TYPES.JUNGLE_LEAVES]: { id: ITEM_TYPES.JUNGLE_LEAVES, name: "Листя джунглів", category: 'block', blockType: 47, icon: 'jungle_leaves', maxStack: 64 },
    [ITEM_TYPES.RED_FLOWER]: { id: ITEM_TYPES.RED_FLOWER, name: "Мак (Квітка)", category: 'block', blockType: 48, icon: 'red_flower', maxStack: 64 },
    [ITEM_TYPES.YELLOW_FLOWER]: { id: ITEM_TYPES.YELLOW_FLOWER, name: "Кульбаба", category: 'block', blockType: 49, icon: 'yellow_flower', maxStack: 64 },
    [ITEM_TYPES.RED_MUSHROOM]: { id: ITEM_TYPES.RED_MUSHROOM, name: "Мухомор", category: 'block', blockType: 50, icon: 'red_mushroom', maxStack: 64 },
    [ITEM_TYPES.BROWN_MUSHROOM]: { id: ITEM_TYPES.BROWN_MUSHROOM, name: "Гриб", category: 'block', blockType: 51, icon: 'brown_mushroom', maxStack: 64 },
    [ITEM_TYPES.CLAY]: { id: ITEM_TYPES.CLAY, name: "Глина", category: 'block', blockType: 52, icon: 'clay', maxStack: 64 },
    [ITEM_TYPES.GRAVEL]: { id: ITEM_TYPES.GRAVEL, name: "Гравій", category: 'block', blockType: 53, icon: 'gravel', maxStack: 64 },
    [ITEM_TYPES.REDSTONE_LAMP]: { id: ITEM_TYPES.REDSTONE_LAMP, name: "Світильник (Лампа)", category: 'block', blockType: 55, icon: 'redstone_lamp', maxStack: 64 },
    [ITEM_TYPES.TERRACOTTA]: { id: ITEM_TYPES.TERRACOTTA, name: "Теракота", category: 'block', blockType: 56, icon: 'terracotta', maxStack: 64 },

    // Редстоун та Комп'ютер
    [ITEM_TYPES.REDSTONE_WIRE]: { id: ITEM_TYPES.REDSTONE_WIRE, name: "Красный провод", category: 'block', blockType: 57, icon: 'redstone_dust', maxStack: 64 },
    [ITEM_TYPES.REDSTONE_TORCH]: { id: ITEM_TYPES.REDSTONE_TORCH, name: "Красный факел", category: 'block', blockType: 58, icon: 'redstone_torch', maxStack: 64 },
    [ITEM_TYPES.LEVER]: { id: ITEM_TYPES.LEVER, name: "Рычаг", category: 'block', blockType: 59, icon: 'lever', maxStack: 64 },
    [ITEM_TYPES.REDSTONE_BLOCK]: { id: ITEM_TYPES.REDSTONE_BLOCK, name: "Блок редстоуна", category: 'block', blockType: 60, icon: 'redstone_block', maxStack: 64 },
    [ITEM_TYPES.STONE_BUTTON]: { id: ITEM_TYPES.STONE_BUTTON, name: "Кнопка", category: 'block', blockType: 61, icon: 'stone_button', maxStack: 64 },
    [ITEM_TYPES.PRESSURE_PLATE]: { id: ITEM_TYPES.PRESSURE_PLATE, name: "Нажимная плита", category: 'block', blockType: 62, icon: 'pressure_plate', maxStack: 64 },
    [ITEM_TYPES.COMPUTER]: { id: ITEM_TYPES.COMPUTER, name: "Компьютер (EmuOS PC)", category: 'block', blockType: 63, icon: 'computer', maxStack: 16 },
    [ITEM_TYPES.REDSTONE_LAMP_ON]: { id: ITEM_TYPES.REDSTONE_LAMP_ON, name: "Включенная лампа", category: 'block', blockType: 64, icon: 'redstone_lamp_on', maxStack: 64 },

    // --- PICKAXES (SPEED BOOST & BALANCED DAMAGE) ---
    [ITEM_TYPES.WOOD_PICKAXE]: { id: ITEM_TYPES.WOOD_PICKAXE, name: "Деревянная кирка", category: 'tool', icon: 'wood_pickaxe', maxStack: 1, miningSpeed: 2.0, attackDamage: 6, attackSpeed: 1.2, durability: 60 },
    [ITEM_TYPES.STONE_PICKAXE]: { id: ITEM_TYPES.STONE_PICKAXE, name: "Каменная кирка", category: 'tool', icon: 'stone_pickaxe', maxStack: 1, miningSpeed: 3.5, attackDamage: 9, attackSpeed: 1.2, durability: 130 },
    [ITEM_TYPES.IRON_PICKAXE]: { id: ITEM_TYPES.IRON_PICKAXE, name: "Железная кирка", category: 'tool', icon: 'iron_pickaxe', maxStack: 1, miningSpeed: 5.5, attackDamage: 12, attackSpeed: 1.2, durability: 250 },
    [ITEM_TYPES.DIAMOND_PICKAXE]: { id: ITEM_TYPES.DIAMOND_PICKAXE, name: "Алмазная кирка", category: 'tool', icon: 'diamond_pickaxe', maxStack: 1, miningSpeed: 9.0, attackDamage: 16, attackSpeed: 1.2, durability: 600 },
    [ITEM_TYPES.NETHERITE_PICKAXE]: { id: ITEM_TYPES.NETHERITE_PICKAXE, name: "Незеритовая кирка", category: 'tool', icon: 'netherite_pickaxe', maxStack: 1, miningSpeed: 15.0, attackDamage: 20, attackSpeed: 1.2, durability: 1500 },
    [ITEM_TYPES.EBLAN_PICKAXE]: { id: ITEM_TYPES.EBLAN_PICKAXE, name: "КИРКА СВЕРХ-ЕБЛАНА ⚡", category: 'tool', icon: 'eblan_pickaxe', maxStack: 1, miningSpeed: 35.0, attackDamage: 28, attackSpeed: 1.5, durability: 9999 },

    // --- SWORDS (BALANCED COMPETITIVE DAMAGE - NO ONE-TAPS!) ---
    [ITEM_TYPES.WOOD_SWORD]: { id: ITEM_TYPES.WOOD_SWORD, name: "Деревянный меч", category: 'weapon', icon: 'wood_sword', maxStack: 1, miningSpeed: 1.2, attackDamage: 18, attackSpeed: 1.6, isSword: true, durability: 60 },
    [ITEM_TYPES.STONE_SWORD]: { id: ITEM_TYPES.STONE_SWORD, name: "Каменный меч", category: 'weapon', icon: 'stone_sword', maxStack: 1, miningSpeed: 1.4, attackDamage: 24, attackSpeed: 1.6, isSword: true, durability: 130 },
    [ITEM_TYPES.IRON_SWORD]: { id: ITEM_TYPES.IRON_SWORD, name: "Железный меч", category: 'weapon', icon: 'iron_sword', maxStack: 1, miningSpeed: 1.6, attackDamage: 30, attackSpeed: 1.6, isSword: true, durability: 250 },
    [ITEM_TYPES.DIAMOND_SWORD]: { id: ITEM_TYPES.DIAMOND_SWORD, name: "Алмазный меч", category: 'weapon', icon: 'diamond_sword', maxStack: 1, miningSpeed: 2.0, attackDamage: 36, attackSpeed: 1.6, isSword: true, durability: 600 },
    [ITEM_TYPES.NETHERITE_SWORD]: { id: ITEM_TYPES.NETHERITE_SWORD, name: "Незеритовый клинок", category: 'weapon', icon: 'netherite_sword', maxStack: 1, miningSpeed: 2.5, attackDamage: 42, attackSpeed: 1.6, isSword: true, durability: 1500 },
    [ITEM_TYPES.EBLAN_SWORD]: { id: ITEM_TYPES.EBLAN_SWORD, name: "МЕЧ ДРАКОНОБОРЕЦ 🐉", category: 'weapon', icon: 'eblan_sword', maxStack: 1, miningSpeed: 4.0, attackDamage: 55, attackSpeed: 1.8, isSword: true, durability: 9999 },

    // --- SHIELD (DEFENSE & BLOCKING) ---
    [ITEM_TYPES.SHIELD]: { id: ITEM_TYPES.SHIELD, name: "Щит 🛡️", category: 'tool', icon: 'shield', maxStack: 1, isShield: true, durability: 336 },

    // --- ARMOR SUITS (БРОНЯ) ---
    [ITEM_TYPES.DIAMOND_HELMET]: { id: ITEM_TYPES.DIAMOND_HELMET, name: "Алмазний шолом 🪖", category: 'armor', icon: 'diamond_helmet', maxStack: 1, armorType: 'diamond', armorSlot: 'head', defense: 3, durability: 363 },
    [ITEM_TYPES.DIAMOND_CHESTPLATE]: { id: ITEM_TYPES.DIAMOND_CHESTPLATE, name: "Алмазний нагрудник 🛡️", category: 'armor', icon: 'diamond_chestplate', maxStack: 1, armorType: 'diamond', armorSlot: 'chest', defense: 8, durability: 528 },
    [ITEM_TYPES.DIAMOND_LEGGINGS]: { id: ITEM_TYPES.DIAMOND_LEGGINGS, name: "Алмазні поножі 👖", category: 'armor', icon: 'diamond_leggings', maxStack: 1, armorType: 'diamond', armorSlot: 'legs', defense: 6, durability: 495 },
    [ITEM_TYPES.DIAMOND_BOOTS]: { id: ITEM_TYPES.DIAMOND_BOOTS, name: "Алмазні чоботи 👢", category: 'armor', icon: 'diamond_boots', maxStack: 1, armorType: 'diamond', armorSlot: 'feet', defense: 3, durability: 429 },
    [ITEM_TYPES.NETHERITE_CHESTPLATE]: { id: ITEM_TYPES.NETHERITE_CHESTPLATE, name: "Незеритовий нагрудник 🔥", category: 'armor', icon: 'netherite_chestplate', maxStack: 1, armorType: 'netherite', armorSlot: 'chest', defense: 9, durability: 800 },
    [ITEM_TYPES.IRON_CHESTPLATE]: { id: ITEM_TYPES.IRON_CHESTPLATE, name: "Залізний нагрудник ⛓️", category: 'armor', icon: 'iron_chestplate', maxStack: 1, armorType: 'iron', armorSlot: 'chest', defense: 6, durability: 240 },

    // --- FIREARMS & WEAPONS ARSENAL (REBALANCED) ---
    [ITEM_TYPES.AK47]: { id: ITEM_TYPES.AK47, name: "Автомат АК-47 💥", category: 'weapon', icon: 'ak47', maxStack: 1, attackDamage: 24, isGun: true, gunType: 'ak47', ammoType: ITEM_TYPES.AMMO_RIFLE },
    [ITEM_TYPES.M4A1]: { id: ITEM_TYPES.M4A1, name: "Штурмова гвинтівка M4A1", category: 'weapon', icon: 'm4a1', maxStack: 1, attackDamage: 22, isGun: true, gunType: 'm4a1', ammoType: ITEM_TYPES.AMMO_RIFLE },
    [ITEM_TYPES.AWP]: { id: ITEM_TYPES.AWP, name: "Снайперська гвинтівка AWP", category: 'weapon', icon: 'awp', maxStack: 1, attackDamage: 62, isGun: true, gunType: 'awp', ammoType: ITEM_TYPES.AMMO_SNIPER },
    [ITEM_TYPES.SHOTGUN]: { id: ITEM_TYPES.SHOTGUN, name: "Дробовик SPAS-12", category: 'weapon', icon: 'shotgun', maxStack: 1, attackDamage: 42, isGun: true, gunType: 'shotgun', ammoType: ITEM_TYPES.AMMO_SHOTGUN },
    [ITEM_TYPES.DEAGLE]: { id: ITEM_TYPES.DEAGLE, name: "Пістолет Desert Eagle .50", category: 'weapon', icon: 'deagle', maxStack: 1, attackDamage: 35, isGun: true, gunType: 'deagle', ammoType: ITEM_TYPES.AMMO_PISTOL },
    [ITEM_TYPES.GLOCK]: { id: ITEM_TYPES.GLOCK, name: "Пістолет Glock-18", category: 'weapon', icon: 'glock', maxStack: 1, attackDamage: 15, isGun: true, gunType: 'glock', ammoType: ITEM_TYPES.AMMO_PISTOL },
    [ITEM_TYPES.MP5]: { id: ITEM_TYPES.MP5, name: "Пістолет-кулемет MP5", category: 'weapon', icon: 'mp5', maxStack: 1, attackDamage: 17, isGun: true, gunType: 'mp5', ammoType: ITEM_TYPES.AMMO_PISTOL },
    [ITEM_TYPES.RPG]: { id: ITEM_TYPES.RPG, name: "РПГ-7 (Ракетниця)", category: 'weapon', icon: 'rpg', maxStack: 1, attackDamage: 65, isGun: true, gunType: 'rpg', ammoType: ITEM_TYPES.AMMO_ROCKET },
    [ITEM_TYPES.GRENADE]: { id: ITEM_TYPES.GRENADE, name: "Осколкова Граната 💣", category: 'weapon', icon: 'grenade', maxStack: 16, attackDamage: 45, isThrowable: true },

    // --- VEHICLES & TRANSPORT ---
    [ITEM_TYPES.CAR_SPORT]: { id: ITEM_TYPES.CAR_SPORT, name: "🏎️ Спорткар (Ключі)", category: 'vehicle', icon: 'car_sport', maxStack: 1, isVehicle: true, vehicleType: 'sport' },
    [ITEM_TYPES.CAR_POLICE]: { id: ITEM_TYPES.CAR_POLICE, name: "🚓 Поліцейське авто", category: 'vehicle', icon: 'car_police', maxStack: 1, isVehicle: true, vehicleType: 'police' },
    [ITEM_TYPES.CAR_CYBER]: { id: ITEM_TYPES.CAR_CYBER, name: "⚡ Кібертрак", category: 'vehicle', icon: 'car_cyber', maxStack: 1, isVehicle: true, vehicleType: 'cyber' },
    [ITEM_TYPES.CAR_TRUCK]: { id: ITEM_TYPES.CAR_TRUCK, name: "🚛 Вантажівка-пікап", category: 'vehicle', icon: 'car_truck', maxStack: 1, isVehicle: true, vehicleType: 'truck' },
    [ITEM_TYPES.CAR_F1]: { id: ITEM_TYPES.CAR_F1, name: "🏎️ Болід Формули-1 (F1)", category: 'vehicle', icon: 'car_f1', maxStack: 1, isVehicle: true, vehicleType: 'f1' },
    [ITEM_TYPES.BICYCLE]: { id: ITEM_TYPES.BICYCLE, name: "🚲 Спортивний Велосипед", category: 'vehicle', icon: 'bicycle', maxStack: 1, isVehicle: true, vehicleType: 'bicycle' },

    // --- MAGICAL ARTIFACTS & TOTEMS ---
    [ITEM_TYPES.TOTEM_OF_UNDYING]: { id: ITEM_TYPES.TOTEM_OF_UNDYING, name: "✨ Тотем Безсмертя", category: 'combat', icon: 'totem_of_undying', maxStack: 1, isTotem: true },

    // --- AMMO ---
    [ITEM_TYPES.AMMO_PISTOL]: { id: ITEM_TYPES.AMMO_PISTOL, name: "Патрони 9мм (Pistol/SMG)", category: 'material', icon: 'ammo_pistol', maxStack: 128 },
    [ITEM_TYPES.AMMO_RIFLE]: { id: ITEM_TYPES.AMMO_RIFLE, name: "Патрони 5.56×45мм (M4A1)", category: 'material', icon: 'ammo_rifle', maxStack: 128 },
    [ITEM_TYPES.AMMO_SNIPER]: { id: ITEM_TYPES.AMMO_SNIPER, name: "Патрони .338 Lapua (AWP)", category: 'material', icon: 'ammo_sniper', maxStack: 64 },
    [ITEM_TYPES.AMMO_SHOTGUN]: { id: ITEM_TYPES.AMMO_SHOTGUN, name: "Дріб 12G (Дробовик)", category: 'material', icon: 'ammo_shotgun', maxStack: 64 },
    [ITEM_TYPES.AMMO_ROCKET]: { id: ITEM_TYPES.AMMO_ROCKET, name: "Ракета РПГ-7", category: 'material', icon: 'ammo_rocket', maxStack: 16 },

    // --- RAW MATERIALS ---
    [ITEM_TYPES.STICK]: { id: ITEM_TYPES.STICK, name: "Палка", category: 'material', icon: 'stick', maxStack: 64 },
    [ITEM_TYPES.COAL]: { id: ITEM_TYPES.COAL, name: "Уголь", category: 'material', icon: 'coal', maxStack: 64 },
    [ITEM_TYPES.IRON_INGOT]: { id: ITEM_TYPES.IRON_INGOT, name: "Железный слиток", category: 'material', icon: 'iron_ingot', maxStack: 64 },
    [ITEM_TYPES.GOLD_INGOT]: { id: ITEM_TYPES.GOLD_INGOT, name: "Золотой слиток", category: 'material', icon: 'gold_ingot', maxStack: 64 },
    [ITEM_TYPES.DIAMOND_ITEM]: { id: ITEM_TYPES.DIAMOND_ITEM, name: "Алмаз", category: 'material', icon: 'diamond_item', maxStack: 64 },
    [ITEM_TYPES.EMERALD]: { id: ITEM_TYPES.EMERALD, name: "Смарагд 💎", category: 'material', icon: 'emerald', maxStack: 64 },
    [ITEM_TYPES.REDSTONE_DUST]: { id: ITEM_TYPES.REDSTONE_DUST, name: "Редстоун пил", category: 'material', icon: 'redstone_dust', maxStack: 64 },
    [ITEM_TYPES.NETHERITE_SCRAP]: { id: ITEM_TYPES.NETHERITE_SCRAP, name: "Незеритовый слиток", category: 'material', icon: 'netherite_scrap', maxStack: 64 },
    [ITEM_TYPES.ENDER_EYE]: { id: ITEM_TYPES.ENDER_EYE, name: "Око Ебланда (Ключ в Энд)", category: 'material', icon: 'ender_eye', maxStack: 16 },
    [ITEM_TYPES.BLAZE_ROD]: { id: ITEM_TYPES.BLAZE_ROD, name: "Огненный стержень", category: 'material', icon: 'blaze_rod', maxStack: 64 },
    [ITEM_TYPES.GUNPOWDER]: { id: ITEM_TYPES.GUNPOWDER, name: "Порох", category: 'material', icon: 'gunpowder', maxStack: 64 },
    [ITEM_TYPES.ROTTEN_FLESH]: { id: ITEM_TYPES.ROTTEN_FLESH, name: "Гнилая плоть", category: 'material', icon: 'rotten_flesh', maxStack: 64 },

    // --- FOOD ---
    [ITEM_TYPES.APPLE]: { id: ITEM_TYPES.APPLE, name: "Яблоко 🍎", category: 'food', icon: 'apple', maxStack: 64, foodRestore: 20, hpRestore: 10 },
    [ITEM_TYPES.COOKED_STEAK]: { id: ITEM_TYPES.COOKED_STEAK, name: "Жареный стейк 🥩", category: 'food', icon: 'cooked_steak', maxStack: 64, foodRestore: 40, hpRestore: 25 },
    [ITEM_TYPES.MEME_DONER]: { id: ITEM_TYPES.MEME_DONER, name: "Шаурма Еблана 🌯", category: 'food', icon: 'meme_doner', maxStack: 16, foodRestore: 75, hpRestore: 45 },

    // --- JUNK (МУСОР) ---
    [ITEM_TYPES.JUNK_SOCK]: { id: ITEM_TYPES.JUNK_SOCK, name: "Дырявый носок (Мусор)", category: 'junk', icon: 'junk_sock', maxStack: 64, junkValue: 1 },
    [ITEM_TYPES.JUNK_BEER]: { id: ITEM_TYPES.JUNK_BEER, name: "Банка Жигуля (Мусор)", category: 'junk', icon: 'junk_beer', maxStack: 64, junkValue: 2 },
    [ITEM_TYPES.JUNK_CIG]: { id: ITEM_TYPES.JUNK_CIG, name: "Окурок Примы (Мусор)", category: 'junk', icon: 'junk_cig', maxStack: 64, junkValue: 1 },
    [ITEM_TYPES.JUNK_NUT]: { id: ITEM_TYPES.JUNK_NUT, name: "Ржавая гайка (Мусор)", category: 'junk', icon: 'junk_nut', maxStack: 64, junkValue: 3 },
    [ITEM_TYPES.JUNK_TOKEN]: { id: ITEM_TYPES.JUNK_TOKEN, name: "Мусорный жетон ♻️", category: 'junk', icon: 'junk_token', maxStack: 64, junkValue: 10 },

    // --- CASES ---
    [ITEM_TYPES.CASE_HOBO]: { id: ITEM_TYPES.CASE_HOBO, name: "📦 Бомж-Кейс", category: 'case', icon: 'case_hobo', maxStack: 16 },
    [ITEM_TYPES.CASE_DIAMOND]: { id: ITEM_TYPES.CASE_DIAMOND, name: "💎 Алмазный Кейс", category: 'case', icon: 'case_diamond', maxStack: 16 },
    [ITEM_TYPES.CASE_NETHER]: { id: ITEM_TYPES.CASE_NETHER, name: "🔥 Незер-Кейс", category: 'case', icon: 'case_nether', maxStack: 16 },
    [ITEM_TYPES.CASE_DRAGON]: { id: ITEM_TYPES.CASE_DRAGON, name: "👑 Кейс Дракона", category: 'case', icon: 'case_dragon', maxStack: 16 }
};

// --- CRAFTING RECIPES ---
const CRAFTING_RECIPES = [
    // 1. Basic wood processing
    {
        id: 'craft_planks',
        name: 'Доски (x4)',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.WOOD, count: 1 }],
        output: { itemId: ITEM_TYPES.PLANKS, count: 4 },
        desc: '1 Дуб ➔ 4 Доски'
    },
    {
        id: 'craft_birch_planks',
        name: 'Березові дошки (x4)',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.BIRCH_WOOD, count: 1 }],
        output: { itemId: ITEM_TYPES.BIRCH_PLANKS, count: 4 },
        desc: '1 Береза ➔ 4 Дошки'
    },
    {
        id: 'craft_spruce_planks',
        name: 'Смерекові дошки (x4)',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.SPRUCE_WOOD, count: 1 }],
        output: { itemId: ITEM_TYPES.SPRUCE_PLANKS, count: 4 },
        desc: '1 Смерека ➔ 4 Дошки'
    },
    {
        id: 'craft_sandstone',
        name: 'Пісковик',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.SAND, count: 4 }],
        output: { itemId: ITEM_TYPES.SANDSTONE, count: 1 },
        desc: '4 Пісок ➔ 1 Пісковик'
    },
    {
        id: 'craft_packed_ice',
        name: 'Щільний лід',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.ICE, count: 4 }],
        output: { itemId: ITEM_TYPES.PACKED_ICE, count: 1 },
        desc: '4 Лід ➔ 1 Щільний лід'
    },
    {
        id: 'craft_mossy_cobble',
        name: 'Моховитий кругляк (x4)',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.COBBLESTONE, count: 4 },
            { itemId: ITEM_TYPES.LEAVES, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.MOSSY_COBBLESTONE, count: 4 },
        desc: '4 Булижник + 1 Листя ➔ 4 Моховитий кругляк'
    },
    {
        id: 'craft_lamp',
        name: 'Світильник (Лампа)',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.GLOWSTONE, count: 1 },
            { itemId: ITEM_TYPES.STONE, count: 4 }
        ],
        output: { itemId: ITEM_TYPES.REDSTONE_LAMP, count: 1 },
        desc: '1 Світлокамінь + 4 Камінь ➔ Лампа'
    },
    {
        id: 'craft_redstone_wire',
        name: 'Красный провод (x4)',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.REDSTONE_DUST, count: 1 }],
        output: { itemId: ITEM_TYPES.REDSTONE_WIRE, count: 4 },
        desc: '1 Редстоун ➔ 4 Червоні дроти'
    },
    {
        id: 'craft_lever',
        name: 'Рычаг',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.COBBLESTONE, count: 1 },
            { itemId: ITEM_TYPES.STICK, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.LEVER, count: 1 },
        desc: '1 Булижник + 1 Палиця ➔ Важіль'
    },
    {
        id: 'craft_redstone_torch',
        name: 'Красный факел',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.STICK, count: 1 },
            { itemId: ITEM_TYPES.REDSTONE_DUST, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.REDSTONE_TORCH, count: 1 },
        desc: '1 Палиця + 1 Редстоун ➔ Червоний смолоскип'
    },
    {
        id: 'craft_redstone_block',
        name: 'Блок редстоуна',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.REDSTONE_DUST, count: 4 }],
        output: { itemId: ITEM_TYPES.REDSTONE_BLOCK, count: 1 },
        desc: '4 Редстоун ➔ 1 Блок редстоуну'
    },
    {
        id: 'craft_computer',
        name: 'Компьютер (EmuOS PC)',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 4 },
            { itemId: ITEM_TYPES.GLASS, count: 1 },
            { itemId: ITEM_TYPES.REDSTONE_DUST, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.COMPUTER, count: 1 },
        desc: '4 Залізо + 1 Скло + 2 Редстоун ➔ Комп\'ютер'
    },
    {
        id: 'craft_terracotta',
        name: 'Теракота (x4)',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.CLAY, count: 4 }],
        output: { itemId: ITEM_TYPES.TERRACOTTA, count: 4 },
        desc: '4 Глина ➔ 4 Теракота'
    },
    {
        id: 'craft_sticks',
        name: 'Палки (x4)',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.PLANKS, count: 2 }],
        output: { itemId: ITEM_TYPES.STICK, count: 4 },
        desc: '2 Доски ➔ 4 Палки'
    },
    {
        id: 'craft_table',
        name: 'Верстак',
        category: 'basic',
        inputs: [{ itemId: ITEM_TYPES.PLANKS, count: 4 }],
        output: { itemId: ITEM_TYPES.CRAFTING_TABLE, count: 1 },
        desc: '4 Доски ➔ Верстак'
    },

    // 2. Pickaxes
    {
        id: 'craft_wood_pickaxe',
        name: 'Деревянная кирка',
        category: 'tools',
        inputs: [
            { itemId: ITEM_TYPES.PLANKS, count: 3 },
            { itemId: ITEM_TYPES.STICK, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.WOOD_PICKAXE, count: 1 },
        desc: 'Скорость копания x2.0'
    },
    {
        id: 'craft_stone_pickaxe',
        name: 'Каменная кирка',
        category: 'tools',
        inputs: [
            { itemId: ITEM_TYPES.COBBLESTONE, count: 3 },
            { itemId: ITEM_TYPES.STICK, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.STONE_PICKAXE, count: 1 },
        desc: 'Скорость копания x3.5'
    },
    {
        id: 'craft_iron_pickaxe',
        name: 'Железная кирка',
        category: 'tools',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 3 },
            { itemId: ITEM_TYPES.STICK, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.IRON_PICKAXE, count: 1 },
        desc: 'Скорость копания x5.5'
    },
    {
        id: 'craft_diamond_pickaxe',
        name: 'Алмазная кирка',
        category: 'tools',
        inputs: [
            { itemId: ITEM_TYPES.DIAMOND_ITEM, count: 3 },
            { itemId: ITEM_TYPES.STICK, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.DIAMOND_PICKAXE, count: 1 },
        desc: 'Скорость копания x9.0'
    },
    {
        id: 'craft_netherite_pickaxe',
        name: 'Незеритовая кирка',
        category: 'tools',
        inputs: [
            { itemId: ITEM_TYPES.DIAMOND_PICKAXE, count: 1 },
            { itemId: ITEM_TYPES.NETHERITE_SCRAP, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.NETHERITE_PICKAXE, count: 1 },
        desc: 'Скорость копания x15.0'
    },
    {
        id: 'craft_eblan_pickaxe',
        name: 'КИРКА СВЕРХ-ЕБЛАНА ⚡',
        category: 'tools',
        inputs: [
            { itemId: ITEM_TYPES.NETHERITE_PICKAXE, count: 1 },
            { itemId: ITEM_TYPES.EBLAN_BLOCK, count: 4 },
            { itemId: ITEM_TYPES.DRAGON_EGG, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.EBLAN_PICKAXE, count: 1 },
        desc: 'Скорость копания x35.0 (МОМЕНТАЛЬНО!)'
    },

    // 3. Swords
    {
        id: 'craft_wood_sword',
        name: 'Деревянный меч',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.PLANKS, count: 2 },
            { itemId: ITEM_TYPES.STICK, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.WOOD_SWORD, count: 1 },
        desc: 'Урон: 15 HP'
    },
    {
        id: 'craft_stone_sword',
        name: 'Каменный меч',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.COBBLESTONE, count: 2 },
            { itemId: ITEM_TYPES.STICK, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.STONE_SWORD, count: 1 },
        desc: 'Урон: 24 HP'
    },
    {
        id: 'craft_iron_sword',
        name: 'Железный меч',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 2 },
            { itemId: ITEM_TYPES.STICK, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.IRON_SWORD, count: 1 },
        desc: 'Урон: 36 HP'
    },
    {
        id: 'craft_diamond_sword',
        name: 'Алмазный меч',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.DIAMOND_ITEM, count: 2 },
            { itemId: ITEM_TYPES.STICK, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.DIAMOND_SWORD, count: 1 },
        desc: 'Урон: 55 HP'
    },
    {
        id: 'craft_netherite_sword',
        name: 'Незеритовый меч',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.DIAMOND_SWORD, count: 1 },
            { itemId: ITEM_TYPES.NETHERITE_SCRAP, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.NETHERITE_SWORD, count: 1 },
        desc: 'Урон: 80 HP'
    },
    {
        id: 'craft_eblan_sword',
        name: 'МЕЧ ДРАКОНОБОРЕЦ 🐉',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.NETHERITE_SWORD, count: 1 },
            { itemId: ITEM_TYPES.ENDER_EYE, count: 2 },
            { itemId: ITEM_TYPES.EBLAN_BLOCK, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.EBLAN_SWORD, count: 1 },
        desc: 'Урон: 160 HP (Крушит Еблан Дракона!)'
    },
    {
        id: 'craft_shield',
        name: 'Щит 🛡️',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.PLANKS, count: 6 },
            { itemId: ITEM_TYPES.IRON_INGOT, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.SHIELD, count: 1 },
        desc: 'Блокирует урон и удары мобов на ПКМ!'
    },

    // 4. Explosives & Portal Keys
    {
        id: 'craft_tnt',
        name: 'Динамит (ТНТ)',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.GUNPOWDER, count: 4 },
            { itemId: ITEM_TYPES.SAND, count: 4 }
        ],
        output: { itemId: ITEM_TYPES.TNT, count: 1 },
        desc: 'Взрывчатка для шахт и боя'
    },
    {
        id: 'craft_portal_nether',
        name: 'Портал в Незер 🔥',
        category: 'nether_end',
        inputs: [
            { itemId: ITEM_TYPES.OBSIDIAN, count: 10 },
            { itemId: ITEM_TYPES.IRON_INGOT, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.PORTAL_NETHER, count: 1 },
        desc: 'Открывает путь в огненный Незер'
    },
    {
        id: 'craft_ender_eye',
        name: 'Око Ебланда (Ключ в Энд) 👁️',
        category: 'nether_end',
        inputs: [
            { itemId: ITEM_TYPES.BLAZE_ROD, count: 1 },
            { itemId: ITEM_TYPES.ENDER_EYE, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.PORTAL_END, count: 1 },
        desc: 'Открывает телепорт на арену Еблан Дракона'
    },

    // 5. Food & Junk recycling
    {
        id: 'craft_doner',
        name: 'Шаурма Еблана 🌯',
        category: 'food',
        inputs: [
            { itemId: ITEM_TYPES.ROTTEN_FLESH, count: 2 },
            { itemId: ITEM_TYPES.APPLE, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.MEME_DONER, count: 1 },
        desc: 'Восстанавливает 75 сытости и 45 HP'
    },
    {
        id: 'recycle_junk_token',
        name: 'Мусорный жетон ♻️',
        category: 'junk',
        inputs: [
            { itemId: ITEM_TYPES.JUNK_SOCK, count: 2 },
            { itemId: ITEM_TYPES.JUNK_BEER, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.JUNK_TOKEN, count: 1 },
        desc: 'Переработка мусора для Апгрейдера и Кейсов'
    },
    {
        id: 'recycle_junk_token_alt',
        name: 'Мусорный жетон ♻️ (из гаек)',
        category: 'junk',
        inputs: [
            { itemId: ITEM_TYPES.JUNK_NUT, count: 2 },
            { itemId: ITEM_TYPES.JUNK_CIG, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.JUNK_TOKEN, count: 1 },
        desc: 'Переработка мелкого мусора'
    },

    // 6. Crafting Cases
    {
        id: 'craft_hobo_case',
        name: 'Бомж-Кейс 📦',
        category: 'case',
        inputs: [
            { itemId: ITEM_TYPES.JUNK_TOKEN, count: 3 }
        ],
        output: { itemId: ITEM_TYPES.CASE_HOBO, count: 1 },
        desc: 'Кейс с начальным лутом и скинами'
    },
    {
        id: 'craft_diamond_case',
        name: 'Алмазный Кейс 💎',
        category: 'case',
        inputs: [
            { itemId: ITEM_TYPES.DIAMOND_ITEM, count: 2 },
            { itemId: ITEM_TYPES.GOLD_INGOT, count: 4 }
        ],
        output: { itemId: ITEM_TYPES.CASE_DIAMOND, count: 1 },
        desc: 'Шанс выбить редкие скины и оружие'
    },

    // 7. Firearms & Weapons Arsenal
    {
        id: 'craft_ak47',
        name: 'Автомат АК-47 💥',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 6 },
            { itemId: ITEM_TYPES.PLANKS, count: 4 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 3 }
        ],
        output: { itemId: ITEM_TYPES.AK47, count: 1 },
        desc: '6 Залізо + 4 Дошки + 3 Порох ➔ Легендарний АК-47'
    },
    {
        id: 'craft_m4a1',
        name: 'Штурмова гвинтівка M4A1',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 8 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 4 }
        ],
        output: { itemId: ITEM_TYPES.M4A1, count: 1 },
        desc: '8 Залізо + 4 Порох ➔ Тактична M4A1'
    },
    {
        id: 'craft_awp',
        name: 'Снайперська гвинтівка AWP',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 10 },
            { itemId: ITEM_TYPES.GLASS, count: 2 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 6 }
        ],
        output: { itemId: ITEM_TYPES.AWP, count: 1 },
        desc: '10 Залізо + 2 Скло + 6 Порох ➔ Снайперка AWP'
    },
    {
        id: 'craft_shotgun',
        name: 'Дробовик SPAS-12',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 6 },
            { itemId: ITEM_TYPES.WOOD, count: 2 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 3 }
        ],
        output: { itemId: ITEM_TYPES.SHOTGUN, count: 1 },
        desc: '6 Залізо + 2 Дерево + 3 Порох ➔ Дробовик SPAS-12'
    },
    {
        id: 'craft_deagle',
        name: 'Пістолет Desert Eagle .50',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 5 },
            { itemId: ITEM_TYPES.GOLD_INGOT, count: 2 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.DEAGLE, count: 1 },
        desc: '5 Залізо + 2 Золото + 2 Порох ➔ Потужний Deagle'
    },
    {
        id: 'craft_rpg',
        name: 'РПГ-7 (Ракетниця)',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 12 },
            { itemId: ITEM_TYPES.TNT, count: 2 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 6 }
        ],
        output: { itemId: ITEM_TYPES.RPG, count: 1 },
        desc: '12 Залізо + 2 ТНТ + 6 Порох ➔ Ракетниця РПГ-7'
    },
    {
        id: 'craft_grenade',
        name: 'Осколкова Граната (x4) 💣',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 4 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 4 }
        ],
        output: { itemId: ITEM_TYPES.GRENADE, count: 4 },
        desc: '4 Залізо + 4 Порох ➔ 4 Гранати'
    },
    {
        id: 'craft_ammo_rifle',
        name: 'Патрони 5.56/7.62 (x32)',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 2 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.AMMO_RIFLE, count: 32 },
        desc: '2 Залізо + 2 Порох ➔ 32 Патрони для АК-47 / M4A1'
    },
    {
        id: 'craft_ammo_pistol',
        name: 'Патрони 9мм (x32)',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 1 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.AMMO_PISTOL, count: 32 },
        desc: '1 Залізо + 1 Порох ➔ 32 Патрони для пістолетів'
    },
    {
        id: 'craft_ammo_sniper',
        name: 'Патрони .338 (x16)',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 2 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 3 }
        ],
        output: { itemId: ITEM_TYPES.AMMO_SNIPER, count: 16 },
        desc: '2 Залізо + 3 Порох ➔ 16 Патронів AWP'
    },
    {
        id: 'craft_ammo_shotgun',
        name: 'Дріб 12G (x16)',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 2 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.AMMO_SHOTGUN, count: 16 },
        desc: '2 Залізо + 2 Порох ➔ 16 Патронів для Дробовика'
    },
    {
        id: 'craft_ammo_rocket',
        name: 'Ракета РПГ-7 (x2)',
        category: 'combat',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 4 },
            { itemId: ITEM_TYPES.TNT, count: 1 },
            { itemId: ITEM_TYPES.GUNPOWDER, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.AMMO_ROCKET, count: 2 },
        desc: '4 Залізо + 1 ТНТ + 2 Порох ➔ 2 Бойові ракети'
    },

    // 8. Vehicles (Cars & Transport)
    {
        id: 'craft_car_sport',
        name: '🏎️ Спорткар (Ключі)',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 8 },
            { itemId: ITEM_TYPES.REDSTONE_BLOCK, count: 2 },
            { itemId: ITEM_TYPES.GOLD_INGOT, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.CAR_SPORT, count: 1 },
        desc: '8 Залізо + 2 Блок редстоуну + 2 Золото ➔ Спорткар'
    },
    {
        id: 'craft_car_police',
        name: '🚓 Поліцейське авто',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 8 },
            { itemId: ITEM_TYPES.REDSTONE_BLOCK, count: 2 },
            { itemId: ITEM_TYPES.REDSTONE_TORCH, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.CAR_POLICE, count: 1 },
        desc: '8 Залізо + 2 Редстоун блоки + 2 Факели ➔ Поліцейська тачка'
    },
    {
        id: 'craft_car_cyber',
        name: '⚡ Кібертрак',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 12 },
            { itemId: ITEM_TYPES.DIAMOND_ITEM, count: 2 },
            { itemId: ITEM_TYPES.COMPUTER, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.CAR_CYBER, count: 1 },
        desc: '12 Залізо + 2 Алмази + 1 Комп\'ютер ➔ Кібертрак'
    },
    {
        id: 'craft_car_truck',
        name: '🚛 Вантажівка-пікап',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 10 },
            { itemId: ITEM_TYPES.WOOD, count: 6 },
            { itemId: ITEM_TYPES.REDSTONE_BLOCK, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.CAR_TRUCK, count: 1 },
        desc: '10 Залізо + 6 Дерево + 1 Редстоун ➔ Вантажівка'
    },
    {
        id: 'craft_bicycle',
        name: '🚲 Спортивний Велосипед',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.IRON_INGOT, count: 4 },
            { itemId: ITEM_TYPES.STICK, count: 4 },
            { itemId: ITEM_TYPES.LEATHER, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.BICYCLE, count: 1 },
        desc: '4 Залізо + 4 Палки + 2 Шкіра ➔ Велосипед'
    },
    {
        id: 'craft_car_f1',
        name: '🏎️ Болід Формули-1 (F1)',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.CAR_SPORT, count: 1 },
            { itemId: ITEM_TYPES.NETHERITE_SCRAP, count: 2 },
            { itemId: ITEM_TYPES.DIAMOND_ITEM, count: 4 },
            { itemId: ITEM_TYPES.REDSTONE_BLOCK, count: 2 }
        ],
        output: { itemId: ITEM_TYPES.CAR_F1, count: 1 },
        desc: '1 Спорткар + 2 Незерит + 4 Алмази + 2 Редстоун ➔ Болід F1'
    },
    {
        id: 'craft_totem',
        name: '✨ Тотем Безсмертя',
        category: 'basic',
        inputs: [
            { itemId: ITEM_TYPES.GOLD_INGOT, count: 4 },
            { itemId: ITEM_TYPES.EMERALD, count: 2 },
            { itemId: ITEM_TYPES.ENDER_EYE, count: 1 }
        ],
        output: { itemId: ITEM_TYPES.TOTEM_OF_UNDYING, count: 1 },
        desc: '4 Золото + 2 Смарагди + 1 Око Ебланда ➔ Тотем Безсмертя'
    }
];

// Map block ID to default item dropped when broken
const BLOCK_DROP_MAP = {
    1: ITEM_TYPES.DIRT,
    2: ITEM_TYPES.DIRT,
    3: ITEM_TYPES.COBBLESTONE,
    4: ITEM_TYPES.COBBLESTONE,
    5: ITEM_TYPES.WOOD,
    6: ITEM_TYPES.PLANKS,
    7: ITEM_TYPES.APPLE, // chance of apple
    8: ITEM_TYPES.BRICKS,
    9: null, // breaks into nothing
    10: ITEM_TYPES.SAND,
    11: ITEM_TYPES.TNT,
    12: ITEM_TYPES.DIAMOND_ITEM,
    13: ITEM_TYPES.GOLD_INGOT,
    14: ITEM_TYPES.EBLAN_BLOCK,
    15: null,
    16: ITEM_TYPES.GLOWSTONE,
    17: ITEM_TYPES.BOOKSHELF,
    18: ITEM_TYPES.CRAFTING_TABLE,
    23: ITEM_TYPES.COAL,
    24: ITEM_TYPES.IRON_INGOT,
    25: ITEM_TYPES.OBSIDIAN,
    26: ITEM_TYPES.NETHERRACK,
    27: ITEM_TYPES.SOUL_SAND,
    28: ITEM_TYPES.NETHER_BRICKS,
    29: ITEM_TYPES.NETHER_QUARTZ,
    30: ITEM_TYPES.NETHERITE_SCRAP,
    31: ITEM_TYPES.END_STONE,
    32: ITEM_TYPES.DRAGON_EGG,
    33: ITEM_TYPES.PORTAL_NETHER,
    34: ITEM_TYPES.PORTAL_END
};

// Random junk pool that can drop from breaking blocks or killing mobs
const JUNK_ITEMS_POOL = [
    ITEM_TYPES.JUNK_SOCK,
    ITEM_TYPES.JUNK_BEER,
    ITEM_TYPES.JUNK_CIG,
    ITEM_TYPES.JUNK_NUT
];

window.ITEM_TYPES = ITEM_TYPES;
window.ITEM_REGISTRY = ITEM_REGISTRY;
window.CRAFTING_RECIPES = CRAFTING_RECIPES;
window.BLOCK_DROP_MAP = BLOCK_DROP_MAP;
window.JUNK_ITEMS_POOL = JUNK_ITEMS_POOL;

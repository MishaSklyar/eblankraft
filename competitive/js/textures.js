/**
 * Eblankraft - Procedural Pixel Art Texture Generator
 * Generates 16x16 retro pixel textures and THREE.CanvasTexture objects
 */

const BLOCK_TYPES = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    COBBLESTONE: 4,
    WOOD: 5,
    PLANKS: 6,
    LEAVES: 7,
    BRICKS: 8,
    GLASS: 9,
    SAND: 10,
    TNT: 11,
    DIAMOND_BLOCK: 12,
    GOLD_BLOCK: 13,
    EBLAN_BLOCK: 14,
    BEDROCK: 15,
    GLOWSTONE: 16,
    BOOKSHELF: 17,
    CRAFTING_TABLE: 18,
    WATER: 19,
    LAVA: 20,
    SPONGE: 21,
    MEME_CAT: 22,
    COAL_ORE: 23,
    IRON_ORE: 24,
    OBSIDIAN: 25,
    NETHERRACK: 26,
    SOUL_SAND: 27,
    NETHER_BRICKS: 28,
    NETHER_QUARTZ: 29,
    NETHERITE_BLOCK: 30,
    END_STONE: 31,
    DRAGON_EGG: 32,
    PORTAL_NETHER: 33,
    PORTAL_END: 34,
    SNOW: 35,
    ICE: 36,
    PACKED_ICE: 37,
    SANDSTONE: 38,
    CACTUS: 39,
    BIRCH_WOOD: 40,
    BIRCH_LEAVES: 41,
    BIRCH_PLANKS: 42,
    SPRUCE_WOOD: 43,
    SPRUCE_LEAVES: 44,
    SPRUCE_PLANKS: 45,
    JUNGLE_WOOD: 46,
    JUNGLE_LEAVES: 47,
    RED_FLOWER: 48,
    YELLOW_FLOWER: 49,
    RED_MUSHROOM: 50,
    BROWN_MUSHROOM: 51,
    CLAY: 52,
    GRAVEL: 53,
    MOSSY_COBBLESTONE: 54,
    REDSTONE_LAMP: 55,
    TERRACOTTA: 56,
    REDSTONE_WIRE: 57,
    REDSTONE_TORCH: 58,
    LEVER: 59,
    REDSTONE_BLOCK: 60,
    STONE_BUTTON: 61,
    PRESSURE_PLATE: 62,
    COMPUTER: 63,
    REDSTONE_LAMP_ON: 64
};

const BLOCK_INFO = {
    [BLOCK_TYPES.GRASS]: { name: "Трава", sound: "grass", hardness: 0.6, transparent: false, tool: "shovel" },
    [BLOCK_TYPES.DIRT]: { name: "Земля", sound: "dirt", hardness: 0.5, transparent: false, tool: "shovel" },
    [BLOCK_TYPES.STONE]: { name: "Камень", sound: "stone", hardness: 1.5, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.COBBLESTONE]: { name: "Булыжник", sound: "stone", hardness: 1.8, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.WOOD]: { name: "Дуб", sound: "wood", hardness: 1.2, transparent: false, tool: "axe" },
    [BLOCK_TYPES.PLANKS]: { name: "Доски", sound: "wood", hardness: 1.0, transparent: false, tool: "axe" },
    [BLOCK_TYPES.LEAVES]: { name: "Листва", sound: "grass", hardness: 0.2, transparent: true },
    [BLOCK_TYPES.BRICKS]: { name: "Кирпичи", sound: "stone", hardness: 2.0, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.GLASS]: { name: "Стекло", sound: "glass", hardness: 0.3, transparent: true },
    [BLOCK_TYPES.SAND]: { name: "Песок", sound: "sand", hardness: 0.5, transparent: false, tool: "shovel" },
    [BLOCK_TYPES.TNT]: { name: "Динамит (ТНТ)", sound: "tnt", hardness: 0.1, transparent: false },
    [BLOCK_TYPES.DIAMOND_BLOCK]: { name: "Алмазный блок", sound: "stone", hardness: 3.0, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.GOLD_BLOCK]: { name: "Золотой блок", sound: "stone", hardness: 2.5, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.EBLAN_BLOCK]: { name: "Еблан-Блок", sound: "meme", hardness: 0.8, transparent: false },
    [BLOCK_TYPES.BEDROCK]: { name: "Бедрок", sound: "stone", hardness: 9999, transparent: false },
    [BLOCK_TYPES.GLOWSTONE]: { name: "Светокамень", sound: "glass", hardness: 0.4, transparent: false },
    [BLOCK_TYPES.BOOKSHELF]: { name: "Книжная полка", sound: "wood", hardness: 1.0, transparent: false, tool: "axe" },
    [BLOCK_TYPES.CRAFTING_TABLE]: { name: "Верстак", sound: "wood", hardness: 1.2, transparent: false, tool: "axe" },
    [BLOCK_TYPES.WATER]: { name: "Вода", sound: "water", hardness: 100, transparent: true, fluid: true },
    [BLOCK_TYPES.LAVA]: { name: "Лава", sound: "water", hardness: 100, transparent: false, fluid: true },
    [BLOCK_TYPES.SPONGE]: { name: "Губка", sound: "grass", hardness: 0.4, transparent: false },
    [BLOCK_TYPES.MEME_CAT]: { name: "Поп-Кот", sound: "meme", hardness: 0.8, transparent: false },
    [BLOCK_TYPES.COAL_ORE]: { name: "Угольная руда", sound: "stone", hardness: 1.8, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.IRON_ORE]: { name: "Железная руда", sound: "stone", hardness: 2.2, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.OBSIDIAN]: { name: "Обсидиан", sound: "stone", hardness: 8.0, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.NETHERRACK]: { name: "Адский камень", sound: "stone", hardness: 0.4, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.SOUL_SAND]: { name: "Песок душ", sound: "sand", hardness: 0.6, transparent: false, tool: "shovel" },
    [BLOCK_TYPES.NETHER_BRICKS]: { name: "Адские кирпичи", sound: "stone", hardness: 2.0, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.NETHER_QUARTZ]: { name: "Кварц Незера", sound: "stone", hardness: 1.5, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.NETHERITE_BLOCK]: { name: "Незеритовый блок", sound: "stone", hardness: 6.0, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.END_STONE]: { name: "Энд-камень", sound: "stone", hardness: 2.5, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.DRAGON_EGG]: { name: "Яйцо Еблан Дракона", sound: "stone", hardness: 3.5, transparent: false },
    [BLOCK_TYPES.PORTAL_NETHER]: { name: "Портал в Незер", sound: "glass", hardness: 9999, transparent: true },
    [BLOCK_TYPES.PORTAL_END]: { name: "Портал в Энд", sound: "glass", hardness: 9999, transparent: true },

    // Новые биомные блоки
    [BLOCK_TYPES.SNOW]: { name: "Снег", sound: "snow", hardness: 0.2, transparent: false, tool: "shovel" },
    [BLOCK_TYPES.ICE]: { name: "Лёд", sound: "glass", hardness: 0.5, transparent: true, tool: "pickaxe" },
    [BLOCK_TYPES.PACKED_ICE]: { name: "Плотный лёд", sound: "stone", hardness: 0.7, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.SANDSTONE]: { name: "Песчаник", sound: "stone", hardness: 1.2, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.CACTUS]: { name: "Кактус", sound: "grass", hardness: 0.4, transparent: false },
    [BLOCK_TYPES.BIRCH_WOOD]: { name: "Берёза", sound: "wood", hardness: 1.2, transparent: false, tool: "axe" },
    [BLOCK_TYPES.BIRCH_LEAVES]: { name: "Берёзовая листва", sound: "grass", hardness: 0.2, transparent: true },
    [BLOCK_TYPES.BIRCH_PLANKS]: { name: "Берёзовые доски", sound: "wood", hardness: 1.0, transparent: false, tool: "axe" },
    [BLOCK_TYPES.SPRUCE_WOOD]: { name: "Ель (Хвоя)", sound: "wood", hardness: 1.2, transparent: false, tool: "axe" },
    [BLOCK_TYPES.SPRUCE_LEAVES]: { name: "Еловая хвоя", sound: "grass", hardness: 0.2, transparent: true },
    [BLOCK_TYPES.SPRUCE_PLANKS]: { name: "Еловые доски", sound: "wood", hardness: 1.0, transparent: false, tool: "axe" },
    [BLOCK_TYPES.JUNGLE_WOOD]: { name: "Тропическое дерево", sound: "wood", hardness: 1.2, transparent: false, tool: "axe" },
    [BLOCK_TYPES.JUNGLE_LEAVES]: { name: "Листва джунглей", sound: "grass", hardness: 0.2, transparent: true },
    [BLOCK_TYPES.RED_FLOWER]: { name: "Красный мак", sound: "grass", hardness: 0.05, transparent: true, solid: false },
    [BLOCK_TYPES.YELLOW_FLOWER]: { name: "Одуванчик", sound: "grass", hardness: 0.05, transparent: true, solid: false },
    [BLOCK_TYPES.RED_MUSHROOM]: { name: "Мухомор", sound: "grass", hardness: 0.05, transparent: true, solid: false },
    [BLOCK_TYPES.BROWN_MUSHROOM]: { name: "Гриб", sound: "grass", hardness: 0.05, transparent: true, solid: false },
    [BLOCK_TYPES.CLAY]: { name: "Глина", sound: "dirt", hardness: 0.6, transparent: false, tool: "shovel" },
    [BLOCK_TYPES.GRAVEL]: { name: "Гравий", sound: "dirt", hardness: 0.6, transparent: false, tool: "shovel" },
    [BLOCK_TYPES.MOSSY_COBBLESTONE]: { name: "Замшелый булыжник", sound: "stone", hardness: 1.8, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.REDSTONE_LAMP]: { name: "Светильник (Лампа)", sound: "glass", hardness: 0.4, transparent: false },
    [BLOCK_TYPES.TERRACOTTA]: { name: "Терракота", sound: "stone", hardness: 1.25, transparent: false, tool: "pickaxe" },

    // Редстоун та Комп'ютер
    [BLOCK_TYPES.REDSTONE_WIRE]: { name: "Красный провод", sound: "stone", hardness: 0.1, transparent: true, solid: false, tool: "hand" },
    [BLOCK_TYPES.REDSTONE_TORCH]: { name: "Красный факел", sound: "wood", hardness: 0.1, transparent: true, solid: false, tool: "hand" },
    [BLOCK_TYPES.LEVER]: { name: "Рычаг", sound: "wood", hardness: 0.5, transparent: true, solid: false, tool: "hand" },
    [BLOCK_TYPES.REDSTONE_BLOCK]: { name: "Блок редстоуна", sound: "stone", hardness: 2.0, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.STONE_BUTTON]: { name: "Кнопка", sound: "stone", hardness: 0.5, transparent: true, solid: false, tool: "hand" },
    [BLOCK_TYPES.PRESSURE_PLATE]: { name: "Нажимная плита", sound: "stone", hardness: 0.5, transparent: true, solid: false, tool: "hand" },
    [BLOCK_TYPES.COMPUTER]: { name: "Компьютер (EmuOS PC)", sound: "stone", hardness: 1.5, transparent: false, tool: "pickaxe" },
    [BLOCK_TYPES.REDSTONE_LAMP_ON]: { name: "Включенная лампа", sound: "glass", hardness: 0.4, transparent: false, tool: "pickaxe" }
};

class TextureManager {
    constructor() {
        this.canvasCache = {};
        this.threeTextures = {};
        this.materials = {};
        this.iconDataUrlCache = new Map();
        this.itemDropMaterials = {};
        this.itemDropTextures = {};
        this.itemDropGeometry = new THREE.BoxGeometry(0.32, 0.32, 0.32);
        this.init();
    }

    createCanvas(w = 16, h = 16) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return canvas;
    }

    // Helper to draw pixel grid
    drawPixels(ctx, pixels, colorMap) {
        for (let y = 0; y < pixels.length; y++) {
            for (let x = 0; x < pixels[y].length; x++) {
                const char = pixels[y][x];
                if (char !== ' ' && colorMap[char]) {
                    ctx.fillStyle = colorMap[char];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    // Helper with noise
    addNoise(ctx, color, intensity = 15, w = 16, h = 16) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const noise = (Math.random() - 0.5) * intensity * 2;
            d[i] = Math.min(255, Math.max(0, d[i] + noise));
            d[i+1] = Math.min(255, Math.max(0, d[i+1] + noise));
            d[i+2] = Math.min(255, Math.max(0, d[i+2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
    }

    generateTextures() {
        // 1. Dirt Texture
        const dirtCanvas = this.createCanvas();
        const dirtCtx = dirtCanvas.getContext('2d');
        this.addNoise(dirtCtx, '#866043', 25);
        // Add darker dirt specks
        for (let i = 0; i < 20; i++) {
            dirtCtx.fillStyle = Math.random() > 0.5 ? '#573d26' : '#9c724f';
            dirtCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['dirt'] = dirtCanvas;

        // 2. Grass Top
        const grassTopCanvas = this.createCanvas();
        const grassTopCtx = grassTopCanvas.getContext('2d');
        this.addNoise(grassTopCtx, '#5b8c32', 20);
        for (let i = 0; i < 25; i++) {
            grassTopCtx.fillStyle = Math.random() > 0.5 ? '#487224' : '#6fad3d';
            grassTopCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['grass_top'] = grassTopCanvas;

        // 3. Grass Side (Dirt + jagged dripping grass top)
        const grassSideCanvas = this.createCanvas();
        const grassSideCtx = grassSideCanvas.getContext('2d');
        grassSideCtx.drawImage(dirtCanvas, 0, 0);
        grassSideCtx.fillStyle = '#5b8c32';
        grassSideCtx.fillRect(0, 0, 16, 2);
        const drips = [2, 3, 2, 4, 3, 2, 4, 5, 3, 2, 3, 4, 2, 3, 2, 3];
        for (let x = 0; x < 16; x++) {
            const h = drips[x];
            for (let y = 0; y < h; y++) {
                grassSideCtx.fillStyle = Math.random() > 0.3 ? '#5b8c32' : '#487224';
                grassSideCtx.fillRect(x, y, 1, 1);
            }
        }
        this.canvasCache['grass_side'] = grassSideCanvas;

        // 4. Stone
        const stoneCanvas = this.createCanvas();
        const stoneCtx = stoneCanvas.getContext('2d');
        this.addNoise(stoneCtx, '#737373', 25);
        for (let i = 0; i < 30; i++) {
            stoneCtx.fillStyle = Math.random() > 0.5 ? '#555555' : '#8e8e8e';
            stoneCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['stone'] = stoneCanvas;

        // 5. Cobblestone
        const cobbleCanvas = this.createCanvas();
        const cobbleCtx = cobbleCanvas.getContext('2d');
        this.addNoise(cobbleCtx, '#6b6b6b', 20);
        // Draw cobblestone outlines
        cobbleCtx.fillStyle = '#404040';
        cobbleCtx.fillRect(0, 4, 16, 1);
        cobbleCtx.fillRect(0, 9, 16, 1);
        cobbleCtx.fillRect(0, 14, 16, 1);
        cobbleCtx.fillRect(4, 0, 1, 4);
        cobbleCtx.fillRect(11, 0, 1, 4);
        cobbleCtx.fillRect(7, 4, 1, 5);
        cobbleCtx.fillRect(13, 9, 1, 5);
        cobbleCtx.fillRect(5, 9, 1, 5);
        this.canvasCache['cobblestone'] = cobbleCanvas;

        // 6. Wood Log Side
        const woodSideCanvas = this.createCanvas();
        const woodSideCtx = woodSideCanvas.getContext('2d');
        this.addNoise(woodSideCtx, '#674f2d', 15);
        for (let x = 0; x < 16; x += 3) {
            woodSideCtx.fillStyle = '#4a371e';
            woodSideCtx.fillRect(x, 0, 1, 16);
            woodSideCtx.fillStyle = '#7a5e38';
            woodSideCtx.fillRect(x + 1, 0, 1, 16);
        }
        this.canvasCache['wood_side'] = woodSideCanvas;

        // 7. Wood Log Top (rings)
        const woodTopCanvas = this.createCanvas();
        const woodTopCtx = woodTopCanvas.getContext('2d');
        this.addNoise(woodTopCtx, '#b5935f', 10);
        woodTopCtx.fillStyle = '#4a371e'; // Bark border
        woodTopCtx.strokeRect(0.5, 0.5, 15, 15);
        woodTopCtx.fillStyle = '#8f7243';
        woodTopCtx.strokeRect(3.5, 3.5, 9, 9);
        woodTopCtx.strokeRect(6.5, 6.5, 3, 3);
        this.canvasCache['wood_top'] = woodTopCanvas;

        // 8. Planks
        const planksCanvas = this.createCanvas();
        const planksCtx = planksCanvas.getContext('2d');
        this.addNoise(planksCtx, '#b8945f', 15);
        planksCtx.fillStyle = '#6e5430';
        planksCtx.fillRect(0, 4, 16, 1);
        planksCtx.fillRect(0, 8, 16, 1);
        planksCtx.fillRect(0, 12, 16, 1);
        planksCtx.fillRect(5, 0, 1, 4);
        planksCtx.fillRect(11, 4, 1, 4);
        planksCtx.fillRect(3, 8, 1, 4);
        planksCtx.fillRect(13, 12, 1, 4);
        this.canvasCache['planks'] = planksCanvas;

        // 9. Leaves
        const leavesCanvas = this.createCanvas();
        const leavesCtx = leavesCanvas.getContext('2d');
        this.addNoise(leavesCtx, '#3b6e22', 30);
        for (let i = 0; i < 40; i++) {
            const rx = Math.floor(Math.random() * 16);
            const ry = Math.floor(Math.random() * 16);
            leavesCtx.fillStyle = Math.random() > 0.5 ? '#244714' : '#558a36';
            leavesCtx.fillRect(rx, ry, 1, 1);
        }
        this.canvasCache['leaves'] = leavesCanvas;

        // 10. Bricks
        const brickCanvas = this.createCanvas();
        const brickCtx = brickCanvas.getContext('2d');
        this.addNoise(brickCtx, '#9c4533', 15);
        brickCtx.fillStyle = '#d1c7bd'; // mortar
        brickCtx.fillRect(0, 3, 16, 1);
        brickCtx.fillRect(0, 7, 16, 1);
        brickCtx.fillRect(0, 11, 16, 1);
        brickCtx.fillRect(0, 15, 16, 1);
        brickCtx.fillRect(7, 0, 1, 3);
        brickCtx.fillRect(3, 4, 1, 3);
        brickCtx.fillRect(11, 4, 1, 3);
        brickCtx.fillRect(7, 8, 1, 3);
        brickCtx.fillRect(3, 12, 1, 3);
        brickCtx.fillRect(11, 12, 1, 3);
        this.canvasCache['bricks'] = brickCanvas;

        // 11. Glass
        const glassCanvas = this.createCanvas();
        const glassCtx = glassCanvas.getContext('2d');
        glassCtx.fillStyle = 'rgba(210, 235, 255, 0.25)';
        glassCtx.fillRect(0, 0, 16, 16);
        glassCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        glassCtx.strokeRect(0.5, 0.5, 15, 15);
        // Highlights
        glassCtx.fillRect(2, 2, 2, 1);
        glassCtx.fillRect(3, 3, 2, 1);
        glassCtx.fillRect(9, 8, 3, 1);
        glassCtx.fillRect(11, 9, 3, 1);
        this.canvasCache['glass'] = glassCanvas;

        // 12. Sand
        const sandCanvas = this.createCanvas();
        const sandCtx = sandCanvas.getContext('2d');
        this.addNoise(sandCtx, '#ded29e', 15);
        for (let i = 0; i < 20; i++) {
            sandCtx.fillStyle = Math.random() > 0.5 ? '#c2b378' : '#ebdcaa';
            sandCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['sand'] = sandCanvas;

        // 13. TNT Side
        const tntSideCanvas = this.createCanvas();
        const tntSideCtx = tntSideCanvas.getContext('2d');
        this.addNoise(tntSideCtx, '#db372a', 15);
        // White center band
        tntSideCtx.fillStyle = '#ffffff';
        tntSideCtx.fillRect(0, 5, 16, 6);
        // "TNT" Pixel Text
        tntSideCtx.fillStyle = '#000000';
        // T
        tntSideCtx.fillRect(2, 6, 3, 1);
        tntSideCtx.fillRect(3, 7, 1, 3);
        // N
        tntSideCtx.fillRect(6, 6, 1, 4);
        tntSideCtx.fillRect(7, 7, 1, 2);
        tntSideCtx.fillRect(8, 6, 1, 4);
        // T
        tntSideCtx.fillRect(10, 6, 3, 1);
        tntSideCtx.fillRect(11, 7, 1, 3);
        this.canvasCache['tnt_side'] = tntSideCanvas;

        // 14. TNT Top/Bottom
        const tntTopCanvas = this.createCanvas();
        const tntTopCtx = tntTopCanvas.getContext('2d');
        this.addNoise(tntTopCtx, '#db372a', 15);
        tntTopCtx.fillStyle = '#8f231a';
        tntTopCtx.strokeRect(2.5, 2.5, 11, 11);
        tntTopCtx.fillStyle = '#3a3a3a'; // Fuse hole
        tntTopCtx.fillRect(7, 7, 2, 2);
        tntTopCtx.fillStyle = '#e8c874'; // Fuse string
        tntTopCtx.fillRect(8, 6, 1, 1);
        tntTopCtx.fillRect(9, 5, 1, 1);
        this.canvasCache['tnt_top'] = tntTopCanvas;

        // 15. Diamond Block
        const diamondCanvas = this.createCanvas();
        const diamondCtx = diamondCanvas.getContext('2d');
        this.addNoise(diamondCtx, '#62eae4', 20);
        diamondCtx.fillStyle = '#9cf5f0';
        diamondCtx.strokeRect(1.5, 1.5, 13, 13);
        diamondCtx.fillStyle = '#2db8b1';
        diamondCtx.strokeRect(3.5, 3.5, 9, 9);
        diamondCtx.fillStyle = '#ffffff';
        diamondCtx.fillRect(4, 4, 2, 2);
        diamondCtx.fillRect(10, 10, 2, 2);
        this.canvasCache['diamond'] = diamondCanvas;

        // 16. Gold Block
        const goldCanvas = this.createCanvas();
        const goldCtx = goldCanvas.getContext('2d');
        this.addNoise(goldCtx, '#f5ce38', 20);
        goldCtx.fillStyle = '#fae489';
        goldCtx.strokeRect(1.5, 1.5, 13, 13);
        goldCtx.fillStyle = '#ba9518';
        goldCtx.strokeRect(3.5, 3.5, 9, 9);
        goldCtx.fillStyle = '#ffffff';
        goldCtx.fillRect(4, 4, 2, 2);
        this.canvasCache['gold'] = goldCanvas;

        // 17. Eblan Block (Hilarious Troll / Meme Face)
        const eblanCanvas = this.createCanvas();
        const eblanCtx = eblanCanvas.getContext('2d');
        this.addNoise(eblanCtx, '#e6c280', 10);
        // Crazy Eyes
        eblanCtx.fillStyle = '#ffffff';
        eblanCtx.fillRect(2, 4, 4, 4);
        eblanCtx.fillRect(10, 3, 4, 5);
        // Pupils looking in silly directions
        eblanCtx.fillStyle = '#000000';
        eblanCtx.fillRect(4, 5, 2, 2);
        eblanCtx.fillRect(10, 4, 2, 2);
        // Monobrow
        eblanCtx.fillStyle = '#4a3319';
        eblanCtx.fillRect(2, 2, 12, 1);
        eblanCtx.fillRect(7, 3, 2, 1);
        // Wide Goofy Grin with missing tooth
        eblanCtx.fillStyle = '#000000';
        eblanCtx.fillRect(3, 10, 10, 4);
        eblanCtx.fillStyle = '#ffffff'; // Teeth
        eblanCtx.fillRect(4, 10, 2, 2);
        eblanCtx.fillRect(8, 10, 2, 2);
        eblanCtx.fillRect(11, 10, 1, 2);
        // Tongue
        eblanCtx.fillStyle = '#e84860';
        eblanCtx.fillRect(6, 12, 3, 3);
        this.canvasCache['eblan'] = eblanCanvas;

        // 18. Bedrock
        const bedrockCanvas = this.createCanvas();
        const bedrockCtx = bedrockCanvas.getContext('2d');
        this.addNoise(bedrockCtx, '#2b2b2b', 40);
        for (let i = 0; i < 35; i++) {
            bedrockCtx.fillStyle = Math.random() > 0.5 ? '#111111' : '#4f4f4f';
            bedrockCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 2, 2);
        }
        this.canvasCache['bedrock'] = bedrockCanvas;

        // 19. Glowstone
        const glowCanvas = this.createCanvas();
        const glowCtx = glowCanvas.getContext('2d');
        this.addNoise(glowCtx, '#e6b953', 25);
        for (let i = 0; i < 25; i++) {
            glowCtx.fillStyle = Math.random() > 0.5 ? '#fff4b3' : '#ba8623';
            glowCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 2, 1);
        }
        this.canvasCache['glowstone'] = glowCanvas;

        // 20. Bookshelf
        const bookCanvas = this.createCanvas();
        const bookCtx = bookCanvas.getContext('2d');
        bookCtx.drawImage(planksCanvas, 0, 0);
        // Two shelves
        bookCtx.fillStyle = '#4a3319';
        bookCtx.fillRect(1, 1, 14, 6);
        bookCtx.fillRect(1, 8, 14, 7);
        const bookColors = ['#ad342b', '#2b6bad', '#3bad3b', '#ada42b', '#7e2bad', '#e07928'];
        for (let x = 2; x < 14; x += 2) {
            bookCtx.fillStyle = bookColors[Math.floor(Math.random() * bookColors.length)];
            bookCtx.fillRect(x, 2, 1, 5);
            bookCtx.fillStyle = bookColors[Math.floor(Math.random() * bookColors.length)];
            bookCtx.fillRect(x, 9, 1, 6);
        }
        this.canvasCache['bookshelf'] = bookCanvas;

        // 21. Crafting Table Top
        const craftTopCanvas = this.createCanvas();
        const craftTopCtx = craftTopCanvas.getContext('2d');
        craftTopCtx.drawImage(planksCanvas, 0, 0);
        craftTopCtx.fillStyle = '#4a3319';
        craftTopCtx.strokeRect(2.5, 2.5, 11, 11);
        craftTopCtx.fillRect(2, 6, 12, 1);
        craftTopCtx.fillRect(2, 10, 12, 1);
        craftTopCtx.fillRect(6, 2, 1, 12);
        craftTopCtx.fillRect(10, 2, 1, 12);
        this.canvasCache['craft_top'] = craftTopCanvas;

        // 22. Crafting Table Side
        const craftSideCanvas = this.createCanvas();
        const craftSideCtx = craftSideCanvas.getContext('2d');
        craftSideCtx.drawImage(planksCanvas, 0, 0);
        craftSideCtx.fillStyle = '#4a3319';
        craftSideCtx.fillRect(2, 3, 5, 8); // Saw icon
        craftSideCtx.fillRect(9, 3, 5, 8); // Hammer icon
        this.canvasCache['craft_side'] = craftSideCanvas;

        // 23. Water
        const waterCanvas = this.createCanvas();
        const waterCtx = waterCanvas.getContext('2d');
        this.addNoise(waterCtx, '#2f62d1', 15);
        for (let i = 0; i < 15; i++) {
            waterCtx.fillStyle = '#6596ff';
            waterCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 2, 1);
        }
        this.canvasCache['water'] = waterCanvas;

        // 24. Lava (Procedural Molten Magma Canvas)
        const lavaCanvas = this.createCanvas();
        const lavaCtx = lavaCanvas.getContext('2d');
        this.lavaCanvas = lavaCanvas;
        this.lavaCtx = lavaCtx;
        this.updateLava(0);
        this.canvasCache['lava'] = lavaCanvas;

        // 25. Sponge
        const spongeCanvas = this.createCanvas();
        const spongeCtx = spongeCanvas.getContext('2d');
        this.addNoise(spongeCtx, '#c7c244', 15);
        for (let i = 0; i < 25; i++) {
            spongeCtx.fillStyle = '#8f8b22';
            spongeCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['sponge'] = spongeCanvas;

        // 26. Meme Pop Cat
        const catCanvas = this.createCanvas();
        const catCtx = catCanvas.getContext('2d');
        this.addNoise(catCtx, '#f7f4ea', 10);
        // Cat Ears
        catCtx.fillStyle = '#d47b7b';
        catCtx.fillRect(2, 1, 3, 3);
        catCtx.fillRect(11, 1, 3, 3);
        // Big round anime eyes
        catCtx.fillStyle = '#000000';
        catCtx.fillRect(3, 5, 3, 3);
        catCtx.fillRect(10, 5, 3, 3);
        catCtx.fillStyle = '#ffffff';
        catCtx.fillRect(4, 5, 1, 1);
        catCtx.fillRect(11, 5, 1, 1);
        // Big "O" mouth (POPCAT)
        catCtx.fillStyle = '#7a1f1d';
        catCtx.beginPath();
        catCtx.arc(8, 11, 4, 0, Math.PI * 2);
        catCtx.fill();
        this.canvasCache['cat'] = catCanvas;

        // 27. Coal Ore
        const coalCanvas = this.createCanvas();
        const coalCtx = coalCanvas.getContext('2d');
        this.addNoise(coalCtx, '#777777', 15);
        for (let i = 0; i < 18; i++) {
            coalCtx.fillStyle = Math.random() > 0.3 ? '#1c1c1c' : '#333333';
            coalCtx.fillRect(Math.floor(Math.random() * 14) + 1, Math.floor(Math.random() * 14) + 1, 2, 2);
        }
        this.canvasCache['coal_ore'] = coalCanvas;

        // 28. Iron Ore
        const ironOreCanvas = this.createCanvas();
        const ironOreCtx = ironOreCanvas.getContext('2d');
        this.addNoise(ironOreCtx, '#777777', 15);
        for (let i = 0; i < 18; i++) {
            ironOreCtx.fillStyle = Math.random() > 0.4 ? '#d8b598' : '#b08c72';
            ironOreCtx.fillRect(Math.floor(Math.random() * 14) + 1, Math.floor(Math.random() * 14) + 1, 2, 2);
        }
        this.canvasCache['iron_ore'] = ironOreCanvas;

        // 29. Obsidian
        const obsCanvas = this.createCanvas();
        const obsCtx = obsCanvas.getContext('2d');
        this.addNoise(obsCtx, '#120b1e', 18);
        for (let i = 0; i < 20; i++) {
            obsCtx.fillStyle = Math.random() > 0.5 ? '#2c1945' : '#45266e';
            obsCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 2);
        }
        this.canvasCache['obsidian'] = obsCanvas;

        // 30. Netherrack
        const netherCanvas = this.createCanvas();
        const netherCtx = netherCanvas.getContext('2d');
        this.addNoise(netherCtx, '#6b1c1c', 25);
        for (let i = 0; i < 24; i++) {
            netherCtx.fillStyle = Math.random() > 0.5 ? '#8e2626' : '#471111';
            netherCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['netherrack'] = netherCanvas;

        // 31. Soul Sand
        const soulCanvas = this.createCanvas();
        const soulCtx = soulCanvas.getContext('2d');
        this.addNoise(soulCtx, '#4e3b2e', 20);
        // Spooky faces in sand
        soulCtx.fillStyle = '#32251d';
        soulCtx.fillRect(3, 4, 2, 2); soulCtx.fillRect(7, 4, 2, 2); soulCtx.fillRect(4, 8, 4, 2);
        soulCtx.fillRect(10, 11, 2, 2); soulCtx.fillRect(13, 11, 2, 2); soulCtx.fillRect(11, 14, 3, 1);
        this.canvasCache['soul_sand'] = soulCanvas;

        // 32. Nether Bricks
        const nbCanvas = this.createCanvas();
        const nbCtx = nbCanvas.getContext('2d');
        this.addNoise(nbCtx, '#2e1418', 12);
        nbCtx.fillStyle = '#17090b';
        nbCtx.fillRect(0, 3, 16, 1); nbCtx.fillRect(0, 7, 16, 1); nbCtx.fillRect(0, 11, 16, 1); nbCtx.fillRect(0, 15, 16, 1);
        nbCtx.fillRect(7, 0, 1, 3); nbCtx.fillRect(3, 4, 1, 3); nbCtx.fillRect(11, 4, 1, 3);
        this.canvasCache['nether_bricks'] = nbCanvas;

        // 33. Nether Quartz
        const quartzCanvas = this.createCanvas();
        const qCtx = quartzCanvas.getContext('2d');
        this.addNoise(qCtx, '#6b1c1c', 22);
        for (let i = 0; i < 16; i++) {
            qCtx.fillStyle = Math.random() > 0.3 ? '#eae5de' : '#ffffff';
            qCtx.fillRect(Math.floor(Math.random() * 14) + 1, Math.floor(Math.random() * 14) + 1, 2, 1);
        }
        this.canvasCache['nether_quartz'] = quartzCanvas;

        // 34. Netherite Block
        const nBlockCanvas = this.createCanvas();
        const nBlockCtx = nBlockCanvas.getContext('2d');
        this.addNoise(nBlockCtx, '#312d30', 10);
        nBlockCtx.strokeStyle = '#4a4347';
        nBlockCtx.strokeRect(1, 1, 14, 14);
        nBlockCtx.fillStyle = '#221f21';
        nBlockCtx.fillRect(3, 3, 10, 10);
        this.canvasCache['netherite_block'] = nBlockCanvas;

        // 35. End Stone
        const endCanvas = this.createCanvas();
        const endCtx = endCanvas.getContext('2d');
        this.addNoise(endCtx, '#dbd8a7', 18);
        for (let i = 0; i < 25; i++) {
            endCtx.fillStyle = Math.random() > 0.5 ? '#b8b582' : '#edebc0';
            endCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['end_stone'] = endCanvas;

        // 36. Dragon Egg
        const eggCanvas = this.createCanvas();
        const eggCtx = eggCanvas.getContext('2d');
        eggCtx.fillStyle = '#0b090f';
        eggCtx.fillRect(0, 0, 16, 16);
        for (let i = 0; i < 20; i++) {
            eggCtx.fillStyle = Math.random() > 0.5 ? '#8018bf' : '#b33bf6';
            eggCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['dragon_egg'] = eggCanvas;

        // 37. Portals
        const pNetherCanvas = this.createCanvas();
        const pNetherCtx = pNetherCanvas.getContext('2d');
        pNetherCtx.fillStyle = '#4c0f7d';
        pNetherCtx.fillRect(0, 0, 16, 16);
        for (let i = 0; i < 20; i++) {
            pNetherCtx.fillStyle = Math.random() > 0.4 ? '#8a2be2' : '#da70d6';
            pNetherCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 2, 2);
        }
        this.canvasCache['portal_nether'] = pNetherCanvas;

        const pEndCanvas = this.createCanvas();
        const pEndCtx = pEndCanvas.getContext('2d');
        pEndCtx.fillStyle = '#05030a';
        pEndCtx.fillRect(0, 0, 16, 16);
        for (let i = 0; i < 15; i++) {
            pEndCtx.fillStyle = Math.random() > 0.5 ? '#1b5e3f' : '#88d8b0';
            pEndCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['portal_end'] = pEndCanvas;

        // --- CRACK OVERLAYS (0 to 4) ---
        for (let c = 0; c < 5; c++) {
            const crackCanvas = this.createCanvas();
            const crackCtx = crackCanvas.getContext('2d');
            crackCtx.fillStyle = 'rgba(0,0,0,0)';
            crackCtx.clearRect(0, 0, 16, 16);
            crackCtx.fillStyle = 'rgba(0,0,0,0.65)';
            const numLines = (c + 1) * 3;
            for (let i = 0; i < numLines; i++) {
                crackCtx.fillRect(Math.floor(Math.random() * 14) + 1, Math.floor(Math.random() * 14) + 1, 2, 1);
            }
            this.canvasCache[`crack_${c}`] = crackCanvas;
        }

        // --- ITEM & TOOL ICONS ---
        this.generateItemIcons();
    }

    generateItemIcons() {
        // Helper to draw tool icon diagonally
        const drawTool = (key, headColor, handleColor = '#7a5230', accentColor = null) => {
            const cv = this.createCanvas();
            const ctx = cv.getContext('2d');
            // Diagonal handle
            ctx.fillStyle = handleColor;
            for (let i = 2; i <= 10; i++) {
                ctx.fillRect(i, 16 - i - 1, 2, 2);
            }
            // Tool head
            ctx.fillStyle = headColor;
            if (key.includes('pickaxe')) {
                ctx.fillRect(9, 2, 5, 2);
                ctx.fillRect(12, 4, 2, 4);
                ctx.fillRect(7, 3, 3, 2);
                ctx.fillRect(11, 7, 2, 3);
            } else if (key.includes('sword')) {
                for (let i = 6; i <= 13; i++) {
                    ctx.fillRect(i, 15 - i, 2, 2);
                }
                ctx.fillStyle = accentColor || '#444444';
                ctx.fillRect(5, 10, 4, 2);
                ctx.fillRect(4, 9, 2, 4);
            } else if (key.includes('axe')) {
                ctx.fillRect(8, 2, 5, 4);
                ctx.fillRect(7, 4, 3, 3);
            }
            if (accentColor && !key.includes('sword')) {
                ctx.fillStyle = accentColor;
                ctx.fillRect(11, 3, 2, 2);
            }
            this.canvasCache[key] = cv;
        };

        // Pickaxes
        drawTool('wood_pickaxe', '#9c6f44');
        drawTool('stone_pickaxe', '#888888');
        drawTool('iron_pickaxe', '#e6e6e6');
        drawTool('diamond_pickaxe', '#4eedff', '#7a5230', '#25a8b8');
        drawTool('netherite_pickaxe', '#3d383b', '#2e2015', '#60585d');
        drawTool('eblan_pickaxe', '#ff0055', '#ffe600', '#00ffee');

        // Swords
        drawTool('wood_sword', '#9c6f44');
        drawTool('stone_sword', '#888888');
        drawTool('iron_sword', '#e6e6e6');
        drawTool('diamond_sword', '#4eedff', '#7a5230', '#25a8b8');
        drawTool('netherite_sword', '#3d383b', '#2e2015', '#60585d');
        drawTool('eblan_sword', '#ff0055', '#ffe600', '#00ffee');

        // Shield
        const shieldCv = this.createCanvas();
        const shCtx = shieldCv.getContext('2d');
        shCtx.fillStyle = '#8a5d3b'; // Wood base
        shCtx.fillRect(4, 2, 8, 10);
        shCtx.fillRect(5, 12, 6, 2);
        shCtx.fillRect(6, 14, 4, 1);
        shCtx.fillStyle = '#dcdcdc'; // Iron rim
        shCtx.fillRect(3, 2, 1, 10);
        shCtx.fillRect(12, 2, 1, 10);
        shCtx.fillRect(4, 1, 8, 1);
        shCtx.fillRect(4, 12, 1, 2);
        shCtx.fillRect(11, 12, 1, 2);
        shCtx.fillRect(5, 14, 1, 1);
        shCtx.fillRect(10, 14, 1, 1);
        shCtx.fillRect(6, 15, 4, 1);
        shCtx.fillStyle = '#ffffff'; // Top highlight
        shCtx.fillRect(5, 2, 6, 1);
        shCtx.fillStyle = '#707070'; // Central iron boss
        shCtx.fillRect(7, 6, 2, 4);
        shCtx.fillStyle = '#b0b0b0';
        shCtx.fillRect(7, 7, 2, 2);
        this.canvasCache['shield'] = shieldCv;

        // --- ARMOR SUIT PROCEDURAL ICONS ---
        // Diamond Helmet
        const dHelmCv = this.createCanvas();
        const dhCtx = dHelmCv.getContext('2d');
        dhCtx.fillStyle = '#25a8b8';
        dhCtx.fillRect(3, 4, 10, 8);
        dhCtx.fillStyle = '#4eedff';
        dhCtx.fillRect(4, 5, 8, 3);
        dhCtx.fillRect(4, 8, 2, 4);
        dhCtx.fillRect(10, 8, 2, 4);
        dhCtx.fillRect(7, 8, 2, 2);
        dhCtx.fillStyle = '#ffffff';
        dhCtx.fillRect(5, 5, 2, 1);
        this.canvasCache['diamond_helmet'] = dHelmCv;

        // Diamond Chestplate
        const dChestCv = this.createCanvas();
        const dcCtx = dChestCv.getContext('2d');
        dcCtx.fillStyle = '#25a8b8';
        dcCtx.fillRect(2, 2, 12, 11);
        dcCtx.clearRect(6, 2, 4, 3); // Neck cutout
        dcCtx.fillStyle = '#4eedff';
        dcCtx.fillRect(3, 3, 3, 4);
        dcCtx.fillRect(10, 3, 3, 4);
        dcCtx.fillRect(4, 5, 8, 7);
        dcCtx.fillStyle = '#ffffff';
        dcCtx.fillRect(5, 6, 2, 2);
        this.canvasCache['diamond_chestplate'] = dChestCv;

        // Diamond Leggings
        const dLegCv = this.createCanvas();
        const dlCtx = dLegCv.getContext('2d');
        dlCtx.fillStyle = '#25a8b8';
        dlCtx.fillRect(3, 3, 10, 11);
        dlCtx.clearRect(7, 6, 2, 8); // Leg gap
        dlCtx.fillStyle = '#4eedff';
        dlCtx.fillRect(4, 4, 8, 2);
        dlCtx.fillRect(4, 6, 3, 7);
        dlCtx.fillRect(9, 6, 3, 7);
        this.canvasCache['diamond_leggings'] = dLegCv;

        // Diamond Boots
        const dBootCv = this.createCanvas();
        const dbCtx = dBootCv.getContext('2d');
        dbCtx.fillStyle = '#25a8b8';
        dbCtx.fillRect(3, 8, 4, 6);
        dbCtx.fillRect(9, 8, 4, 6);
        dbCtx.fillStyle = '#4eedff';
        dbCtx.fillRect(2, 11, 5, 3);
        dbCtx.fillRect(9, 11, 5, 3);
        this.canvasCache['diamond_boots'] = dBootCv;

        // Netherite Chestplate
        const nChestCv = this.createCanvas();
        const ncCtx = nChestCv.getContext('2d');
        ncCtx.fillStyle = '#2e2015';
        ncCtx.fillRect(2, 2, 12, 11);
        ncCtx.clearRect(6, 2, 4, 3);
        ncCtx.fillStyle = '#3d383b';
        ncCtx.fillRect(3, 3, 3, 4);
        ncCtx.fillRect(10, 3, 3, 4);
        ncCtx.fillRect(4, 5, 8, 7);
        ncCtx.fillStyle = '#60585d';
        ncCtx.fillRect(5, 6, 2, 2);
        this.canvasCache['netherite_chestplate'] = nChestCv;

        // Iron Chestplate
        const iChestCv = this.createCanvas();
        const ironChCtx = iChestCv.getContext('2d');
        ironChCtx.fillStyle = '#9e9e9e';
        ironChCtx.fillRect(2, 2, 12, 11);
        ironChCtx.clearRect(6, 2, 4, 3);
        ironChCtx.fillStyle = '#e6e6e6';
        ironChCtx.fillRect(3, 3, 3, 4);
        ironChCtx.fillRect(10, 3, 3, 4);
        ironChCtx.fillRect(4, 5, 8, 7);
        ironChCtx.fillStyle = '#ffffff';
        ironChCtx.fillRect(5, 6, 2, 2);
        this.canvasCache['iron_chestplate'] = iChestCv;

        // Materials & Items
        // Stick
        const stickCv = this.createCanvas();
        const sCtx = stickCv.getContext('2d');
        sCtx.fillStyle = '#8a5d3b';
        for (let i = 3; i < 13; i++) sCtx.fillRect(i, 15 - i, 2, 2);
        this.canvasCache['stick'] = stickCv;

        // Coal
        const coalItemCv = this.createCanvas();
        const ciCtx = coalItemCv.getContext('2d');
        ciCtx.fillStyle = '#222222';
        ciCtx.fillRect(5, 5, 6, 6); ciCtx.fillRect(4, 7, 8, 3);
        this.canvasCache['coal'] = coalItemCv;

        // Iron Ingot
        const ironIngotCv = this.createCanvas();
        const iiCtx = ironIngotCv.getContext('2d');
        iiCtx.fillStyle = '#dedede';
        iiCtx.fillRect(4, 6, 8, 4);
        iiCtx.fillStyle = '#ffffff';
        iiCtx.fillRect(4, 6, 8, 1);
        this.canvasCache['iron_ingot'] = ironIngotCv;

        // Gold Ingot
        const goldIngotCv = this.createCanvas();
        const giCtx = goldIngotCv.getContext('2d');
        giCtx.fillStyle = '#f5c518';
        giCtx.fillRect(4, 6, 8, 4);
        giCtx.fillStyle = '#fff48f';
        giCtx.fillRect(4, 6, 8, 1);
        this.canvasCache['gold_ingot'] = goldIngotCv;

        // Diamond
        const diamCv = this.createCanvas();
        const dCtx = diamCv.getContext('2d');
        dCtx.fillStyle = '#4eedff';
        dCtx.fillRect(6, 4, 4, 3); dCtx.fillRect(4, 7, 8, 3); dCtx.fillRect(6, 10, 4, 2); dCtx.fillRect(7, 12, 2, 1);
        dCtx.fillStyle = '#bdf7ff';
        dCtx.fillRect(6, 5, 2, 2);
        this.canvasCache['diamond_item'] = diamCv;

        // Netherite Scrap / Ingot
        const nScrapCv = this.createCanvas();
        const nsCtx = nScrapCv.getContext('2d');
        nsCtx.fillStyle = '#3d383b';
        nsCtx.fillRect(4, 6, 8, 4);
        nsCtx.fillStyle = '#615a5e';
        nsCtx.fillRect(4, 6, 8, 1);
        this.canvasCache['netherite_scrap'] = nScrapCv;

        // Ender Eye
        const eyeCv = this.createCanvas();
        const eCtx = eyeCv.getContext('2d');
        eCtx.fillStyle = '#177a56';
        eCtx.beginPath(); eCtx.arc(8, 8, 6, 0, Math.PI * 2); eCtx.fill();
        eCtx.fillStyle = '#e64510';
        eCtx.fillRect(7, 5, 2, 6);
        eCtx.fillStyle = '#ffffff';
        eCtx.fillRect(8, 7, 1, 1);
        this.canvasCache['ender_eye'] = eyeCv;

        // Blaze Rod
        const rodCv = this.createCanvas();
        const rCtx = rodCv.getContext('2d');
        rCtx.fillStyle = '#ff8800';
        for (let i = 3; i < 13; i++) {
            rCtx.fillRect(i, 15 - i, 2, 3);
            rCtx.fillStyle = i % 2 === 0 ? '#ffdd00' : '#ff5500';
        }
        this.canvasCache['blaze_rod'] = rodCv;

        // Gunpowder
        const gpCv = this.createCanvas();
        const gpCtx = gpCv.getContext('2d');
        gpCtx.fillStyle = '#616161';
        gpCtx.fillRect(5, 7, 6, 5); gpCtx.fillRect(4, 9, 8, 3);
        this.canvasCache['gunpowder'] = gpCv;

        // Rotten Flesh
        const fleshCv = this.createCanvas();
        const fCtx = fleshCv.getContext('2d');
        fCtx.fillStyle = '#8f4b23';
        fCtx.fillRect(4, 6, 7, 5); fCtx.fillStyle = '#4f7831'; fCtx.fillRect(7, 8, 4, 3);
        this.canvasCache['rotten_flesh'] = fleshCv;

        // Foods: Apple, Cooked Steak, Meme Doner
        const appleCv = this.createCanvas();
        const aCtx = appleCv.getContext('2d');
        aCtx.fillStyle = '#d61818';
        aCtx.beginPath(); aCtx.arc(8, 9, 5, 0, Math.PI * 2); aCtx.fill();
        aCtx.fillStyle = '#3a8726'; aCtx.fillRect(8, 3, 2, 3);
        this.canvasCache['apple'] = appleCv;

        const steakCv = this.createCanvas();
        const stCtx = steakCv.getContext('2d');
        stCtx.fillStyle = '#8a3c26';
        stCtx.fillRect(4, 5, 8, 6); stCtx.fillStyle = '#dfd6c8'; stCtx.fillRect(3, 7, 2, 2);
        this.canvasCache['cooked_steak'] = steakCv;

        const donerCv = this.createCanvas();
        const dnCtx = donerCv.getContext('2d');
        dnCtx.fillStyle = '#e6c87e'; // Lavash wrapper
        dnCtx.fillRect(4, 3, 8, 10);
        dnCtx.fillStyle = '#c42727'; dnCtx.fillRect(5, 3, 6, 2); // Sauce
        dnCtx.fillStyle = '#389e34'; dnCtx.fillRect(5, 5, 6, 2); // Greens
        dnCtx.fillStyle = '#7a3e21'; dnCtx.fillRect(5, 7, 6, 2); // Meat
        this.canvasCache['meme_doner'] = donerCv;

        // Junk Items (Мусор)
        // 1. Old Sock
        const sockCv = this.createCanvas();
        const scCtx = sockCv.getContext('2d');
        scCtx.fillStyle = '#6b7b8a';
        scCtx.fillRect(5, 3, 4, 7); scCtx.fillRect(5, 9, 7, 4);
        scCtx.fillStyle = '#3d4852'; scCtx.fillRect(9, 10, 3, 3); // Hole
        this.canvasCache['junk_sock'] = sockCv;

        // 2. Beer Can (Банка Жигуля)
        const beerCv = this.createCanvas();
        const bCtx = beerCv.getContext('2d');
        bCtx.fillStyle = '#2255aa';
        bCtx.fillRect(5, 4, 6, 9);
        bCtx.fillStyle = '#d4af37'; bCtx.fillRect(5, 7, 6, 3); // Gold ribbon
        bCtx.fillStyle = '#cccccc'; bCtx.fillRect(6, 3, 4, 1); // Lid
        this.canvasCache['junk_beer'] = beerCv;

        // 3. Cigarette
        const cigCv = this.createCanvas();
        const cgCtx = cigCv.getContext('2d');
        cgCtx.fillStyle = '#f0ede6';
        cgCtx.fillRect(4, 7, 6, 2);
        cgCtx.fillStyle = '#c47d33'; cgCtx.fillRect(2, 7, 2, 2); // Filter
        cgCtx.fillStyle = '#ff3b14'; cgCtx.fillRect(10, 7, 1, 2); // Ember
        this.canvasCache['junk_cig'] = cigCv;

        // 4. Rusty Nut
        const nutCv = this.createCanvas();
        const ntCtx = nutCv.getContext('2d');
        ntCtx.fillStyle = '#8f5228';
        ntCtx.fillRect(4, 4, 8, 8);
        ntCtx.fillStyle = '#000000'; ntCtx.fillRect(6, 6, 4, 4); // Hole
        this.canvasCache['junk_nut'] = nutCv;

        // 5. Junk Token (Мусорный жетон)
        const tokenCv = this.createCanvas();
        const tkCtx = tokenCv.getContext('2d');
        tkCtx.fillStyle = '#2db87d';
        tkCtx.beginPath(); tkCtx.arc(8, 8, 6, 0, Math.PI * 2); tkCtx.fill();
        tkCtx.fillStyle = '#ffffff'; tkCtx.fillRect(7, 5, 2, 6); tkCtx.fillRect(6, 7, 4, 2);
        this.canvasCache['junk_token'] = tokenCv;

        // Emerald Gem (Смарагд)
        const emCv = this.createCanvas();
        const emCtx = emCv.getContext('2d');
        emCtx.fillStyle = '#0a7d2c'; emCtx.fillRect(6, 4, 4, 8); emCtx.fillRect(4, 6, 8, 4);
        emCtx.fillStyle = '#1ed451'; emCtx.fillRect(6, 5, 4, 6); emCtx.fillRect(5, 6, 6, 4);
        emCtx.fillStyle = '#8effad'; emCtx.fillRect(6, 5, 2, 2);
        this.canvasCache['emerald'] = emCv;

        // Redstone Dust
        const rdCv = this.createCanvas();
        const rdCtx = rdCv.getContext('2d');
        rdCtx.fillStyle = '#b50e0e';
        rdCtx.fillRect(5, 9, 6, 4); rdCtx.fillRect(6, 7, 4, 2); rdCtx.fillRect(7, 5, 2, 2);
        rdCtx.fillStyle = '#ff4d4d';
        rdCtx.fillRect(6, 9, 2, 1); rdCtx.fillRect(8, 8, 1, 1); rdCtx.fillRect(7, 6, 1, 1);
        this.canvasCache['redstone_dust'] = rdCv;

        // Lever Icon
        const levCv = this.createCanvas();
        const levCtx = levCv.getContext('2d');
        levCtx.fillStyle = '#6b6b6b'; levCtx.fillRect(4, 11, 8, 3);
        levCtx.fillStyle = '#444444'; levCtx.fillRect(7, 9, 2, 2);
        levCtx.fillStyle = '#8a5d3b';
        levCtx.fillRect(8, 7, 2, 2); levCtx.fillRect(9, 5, 2, 2); levCtx.fillRect(10, 3, 2, 2);
        this.canvasCache['lever'] = levCv;

        // Redstone Torch Icon
        const rtCv = this.createCanvas();
        const rtCtx = rtCv.getContext('2d');
        rtCtx.fillStyle = '#8a5d3b'; rtCtx.fillRect(7, 7, 2, 7);
        rtCtx.fillStyle = '#ff2200'; rtCtx.fillRect(6, 3, 4, 4);
        rtCtx.fillStyle = '#ff8866'; rtCtx.fillRect(7, 4, 2, 2);
        this.canvasCache['redstone_torch'] = rtCv;

        // Computer Icon (EmuOS PC)
        const compCv = this.createCanvas();
        const compCtx = compCv.getContext('2d');
        compCtx.fillStyle = '#d4ceb6'; compCtx.fillRect(2, 2, 12, 10);
        compCtx.fillStyle = '#000088'; compCtx.fillRect(4, 4, 8, 6); // Screen
        compCtx.fillStyle = '#ffffff'; compCtx.fillRect(5, 5, 3, 2); // Window
        compCtx.fillStyle = '#555555'; compCtx.fillRect(2, 13, 12, 2); // Keyboard
        compCtx.fillStyle = '#00ff44'; compCtx.fillRect(11, 11, 1, 1); // LED
        this.canvasCache['computer'] = compCv;

        // Weapons Icons
        // 0. AK-47
        const akCv = this.createCanvas();
        const akCtx = akCv.getContext('2d');
        akCtx.fillStyle = '#222328'; akCtx.fillRect(1, 8, 14, 2); // Steel barrel & receiver
        akCtx.fillStyle = '#8d431c'; akCtx.fillRect(1, 9, 4, 3);  // Wooden buttstock
        akCtx.fillStyle = '#8d431c'; akCtx.fillRect(6, 7, 3, 2);  // Wooden handguard
        akCtx.fillStyle = '#1e1e1e'; akCtx.fillRect(5, 10, 2, 4); // Pistol grip
        akCtx.fillStyle = '#d47b2c'; akCtx.fillRect(9, 10, 2, 4); // Curved orange mag
        akCtx.fillStyle = '#111111'; akCtx.fillRect(10, 12, 2, 2); // Mag tip curve
        this.canvasCache['ak47'] = akCv;

        // 1. M4A1
        const m4Cv = this.createCanvas();
        const m4Ctx = m4Cv.getContext('2d');
        m4Ctx.fillStyle = '#2c2f38'; m4Ctx.fillRect(1, 8, 14, 2);
        m4Ctx.fillRect(2, 9, 3, 4); // Stock
        m4Ctx.fillRect(7, 10, 2, 4); // Grip
        m4Ctx.fillRect(9, 10, 2, 3); // Mag
        m4Ctx.fillStyle = '#788296'; m4Ctx.fillRect(6, 6, 3, 2); // Holo sight
        this.canvasCache['m4a1'] = m4Cv;

        // 2. AWP Sniper Rifle
        const awpCv = this.createCanvas();
        const awpCtx = awpCv.getContext('2d');
        awpCtx.fillStyle = '#4d5736'; awpCtx.fillRect(1, 8, 14, 2); // Olive body
        awpCtx.fillStyle = '#1c1d21'; awpCtx.fillRect(12, 8, 3, 1); // Long barrel tip
        awpCtx.fillRect(1, 9, 3, 4); // Stock
        awpCtx.fillRect(6, 6, 5, 2); // Scope
        awpCtx.fillStyle = '#00ffff'; awpCtx.fillRect(10, 6, 1, 2); // Scope lens
        this.canvasCache['awp'] = awpCv;

        // 3. Shotgun SPAS-12
        const sgCv = this.createCanvas();
        const sgCtx = sgCv.getContext('2d');
        sgCtx.fillStyle = '#222222'; sgCtx.fillRect(2, 7, 13, 2);
        sgCtx.fillStyle = '#7a421d'; sgCtx.fillRect(1, 8, 4, 4); // Wood stock
        sgCtx.fillStyle = '#555555'; sgCtx.fillRect(7, 9, 4, 2); // Pump handle
        this.canvasCache['shotgun'] = sgCv;

        // 4. Desert Eagle .50
        const dgCv = this.createCanvas();
        const dgCtx = dgCv.getContext('2d');
        dgCtx.fillStyle = '#d0d7de'; dgCtx.fillRect(4, 5, 9, 4); // Chrome slide
        dgCtx.fillStyle = '#1f1f1f'; dgCtx.fillRect(4, 8, 4, 5); // Grip
        this.canvasCache['deagle'] = dgCv;

        // 5. Glock-18
        const gkCv = this.createCanvas();
        const gkCtx = gkCv.getContext('2d');
        gkCtx.fillStyle = '#282b30'; gkCtx.fillRect(4, 6, 8, 3);
        gkCtx.fillStyle = '#18191c'; gkCtx.fillRect(4, 8, 3, 5);
        this.canvasCache['glock'] = gkCv;

        // 6. MP5
        const mpCv = this.createCanvas();
        const mpCtx = mpCv.getContext('2d');
        mpCtx.fillStyle = '#222328'; mpCtx.fillRect(2, 7, 12, 2);
        mpCtx.fillRect(2, 8, 3, 4); // Stock
        mpCtx.fillRect(5, 9, 2, 4); // Grip
        mpCtx.fillStyle = '#111111'; mpCtx.fillRect(7, 9, 2, 4); // Curved mag
        this.canvasCache['mp5'] = mpCv;

        // 7. RPG-7 Rocket Launcher
        const rpgCv = this.createCanvas();
        const rpgCtx = rpgCv.getContext('2d');
        rpgCtx.fillStyle = '#444d32'; rpgCtx.fillRect(1, 8, 12, 2); // Tube
        rpgCtx.fillStyle = '#737a44'; rpgCtx.fillRect(11, 7, 4, 4); // Warhead
        rpgCtx.fillStyle = '#c45a27'; rpgCtx.fillRect(14, 8, 2, 2); // Nose cone
        rpgCtx.fillStyle = '#222222'; rpgCtx.fillRect(5, 10, 2, 3); // Grip
        this.canvasCache['rpg'] = rpgCv;

        // 8. Frag Grenade
        const grCv = this.createCanvas();
        const grenadeCtx = grCv.getContext('2d');
        grenadeCtx.fillStyle = '#3c522a'; grenadeCtx.fillRect(5, 6, 6, 7); // Body
        grenadeCtx.fillStyle = '#2a3b1d'; grenadeCtx.fillRect(5, 8, 6, 1); grenadeCtx.fillRect(7, 6, 2, 7); // Grid
        grenadeCtx.fillStyle = '#aaaaaa'; grenadeCtx.fillRect(7, 3, 2, 3); grenadeCtx.fillRect(9, 4, 3, 1); // Pin
        this.canvasCache['grenade'] = grCv;

        // Ammo Items
        const makeAmmo = (key, bulletColor, tipColor) => {
            const cv = this.createCanvas();
            const ctx = cv.getContext('2d');
            ctx.fillStyle = bulletColor; ctx.fillRect(4, 7, 8, 6);
            ctx.fillStyle = tipColor; ctx.fillRect(4, 4, 8, 3);
            ctx.fillStyle = '#333333'; ctx.fillRect(3, 13, 10, 1);
            this.canvasCache[key] = cv;
        };
        makeAmmo('ammo_pistol', '#d4af37', '#b5651d');
        makeAmmo('ammo_rifle', '#e6c84a', '#a34812');
        makeAmmo('ammo_sniper', '#c89e2e', '#444444');
        makeAmmo('ammo_shotgun', '#d42222', '#f0c030');
        makeAmmo('ammo_rocket', '#5a633c', '#d44e18');

        // Cases
        const makeCase = (key, baseColor, rimColor, symbolColor) => {
            const cv = this.createCanvas();
            const ctx = cv.getContext('2d');
            ctx.fillStyle = baseColor; ctx.fillRect(3, 4, 10, 8);
            ctx.strokeStyle = rimColor; ctx.strokeRect(3, 4, 10, 8);
            ctx.fillStyle = symbolColor; ctx.fillRect(7, 7, 2, 2);
            this.canvasCache[key] = cv;
        };
        makeCase('case_hobo', '#7a6045', '#4d3723', '#2db87d');
        makeCase('case_diamond', '#2baec7', '#8ef1ff', '#ffffff');
        makeCase('case_nether', '#781515', '#e64510', '#ffea00');
        makeCase('case_dragon', '#3d0d61', '#b737f5', '#ff0077');

        // Vehicle Icons (Cars / Transport)
        // 1. Sport Car
        const sportCv = this.createCanvas();
        const sportCtx = sportCv.getContext('2d');
        sportCtx.fillStyle = '#e53935'; sportCtx.fillRect(2, 6, 12, 4); // Red sports body
        sportCtx.fillStyle = '#b71c1c'; sportCtx.fillRect(4, 4, 7, 3); // Cabin
        sportCtx.fillStyle = '#80d8ff'; sportCtx.fillRect(5, 5, 5, 2); // Windshield
        sportCtx.fillStyle = '#212121'; sportCtx.fillRect(3, 9, 3, 3); sportCtx.fillRect(10, 9, 3, 3); // Wheels
        sportCtx.fillStyle = '#fff59d'; sportCtx.fillRect(13, 7, 1, 2); // Headlight
        this.canvasCache['car_sport'] = sportCv;

        // 2. Police Cruiser
        const policeCv = this.createCanvas();
        const policeCtx = policeCv.getContext('2d');
        policeCtx.fillStyle = '#212121'; policeCtx.fillRect(2, 6, 12, 4); // Black body
        policeCtx.fillStyle = '#ffffff'; policeCtx.fillRect(5, 4, 6, 4); // White roof/cabin
        policeCtx.fillStyle = '#80d8ff'; policeCtx.fillRect(6, 5, 4, 2); // Windshield
        policeCtx.fillStyle = '#ff1744'; policeCtx.fillRect(6, 3, 2, 1); // Red lightbar
        policeCtx.fillStyle = '#2979ff'; policeCtx.fillRect(8, 3, 2, 1); // Blue lightbar
        policeCtx.fillStyle = '#111111'; policeCtx.fillRect(3, 9, 3, 3); policeCtx.fillRect(10, 9, 3, 3); // Wheels
        this.canvasCache['car_police'] = policeCv;

        // 3. Cyber Truck
        const cyberCv = this.createCanvas();
        const cyberCtx = cyberCv.getContext('2d');
        cyberCtx.fillStyle = '#90a4ae'; cyberCtx.fillRect(2, 7, 12, 3); // Stainless body
        cyberCtx.fillStyle = '#b0bec5'; cyberCtx.fillRect(4, 4, 7, 3); // Angular top
        cyberCtx.fillStyle = '#37474f'; cyberCtx.fillRect(5, 5, 5, 2); // Dark armored glass
        cyberCtx.fillStyle = '#ffffff'; cyberCtx.fillRect(13, 6, 1, 2); // LED light strip
        cyberCtx.fillStyle = '#263238'; cyberCtx.fillRect(3, 9, 3, 3); cyberCtx.fillRect(10, 9, 3, 3); // All-terrain wheels
        this.canvasCache['car_cyber'] = cyberCv;

        // 4. Pickup Truck
        const truckCv = this.createCanvas();
        const truckCtx = truckCv.getContext('2d');
        truckCtx.fillStyle = '#33691e'; truckCtx.fillRect(2, 7, 12, 4); // Heavy green body
        truckCtx.fillStyle = '#558b2f'; truckCtx.fillRect(3, 4, 6, 4); // Cabin
        truckCtx.fillStyle = '#e0f7fa'; truckCtx.fillRect(4, 5, 4, 2); // Window
        truckCtx.fillStyle = '#1b5e20'; truckCtx.fillRect(9, 6, 5, 2); // Open cargo bed
        truckCtx.fillStyle = '#212121'; truckCtx.fillRect(3, 10, 3, 3); truckCtx.fillRect(10, 10, 3, 3); // Big wheels
        this.canvasCache['car_truck'] = truckCv;

        // 5. Formula-1 Racecar (F1 Bolide)
        const f1Cv = this.createCanvas();
        const f1Ctx = f1Cv.getContext('2d');
        f1Ctx.fillStyle = '#111111'; f1Ctx.fillRect(1, 7, 2, 3); // Front wing
        f1Ctx.fillStyle = '#e53935'; f1Ctx.fillRect(3, 7, 8, 3); // Red aerodynamic nose & chassis
        f1Ctx.fillStyle = '#212121'; f1Ctx.fillRect(7, 6, 3, 3); // Open Cockpit & Halo hoop
        f1Ctx.fillStyle = '#b71c1c'; f1Ctx.fillRect(10, 5, 3, 3); // Airbox intake scoop
        f1Ctx.fillStyle = '#d32f2f'; f1Ctx.fillRect(11, 7, 3, 3); // Rear cowl
        f1Ctx.fillStyle = '#111111'; f1Ctx.fillRect(13, 4, 2, 5); // Huge downforce rear wing
        // Open-wheel racing slicks with Pirelli red rim rings
        f1Ctx.fillStyle = '#1a1a1a';
        f1Ctx.fillRect(3, 4, 3, 2); f1Ctx.fillRect(3, 11, 3, 2); // Front slicks
        f1Ctx.fillRect(11, 4, 3, 2); f1Ctx.fillRect(11, 11, 3, 2); // Rear slicks
        f1Ctx.fillStyle = '#ff1744';
        f1Ctx.fillRect(4, 4, 1, 1); f1Ctx.fillRect(4, 12, 1, 1);
        f1Ctx.fillRect(12, 4, 1, 1); f1Ctx.fillRect(12, 12, 1, 1);
        this.canvasCache['car_f1'] = f1Cv;

        // 6. Sport Bicycle
        const bikeCv = this.createCanvas();
        const bikeCtx = bikeCv.getContext('2d');
        // Wheels with thin spokes
        bikeCtx.fillStyle = '#212121';
        bikeCtx.fillRect(1, 8, 4, 4); bikeCtx.fillRect(11, 8, 4, 4);
        bikeCtx.fillStyle = '#ffffff';
        bikeCtx.fillRect(2, 9, 2, 2); bikeCtx.fillRect(12, 9, 2, 2);
        bikeCtx.fillStyle = '#757575';
        bikeCtx.fillRect(2, 9, 1, 1); bikeCtx.fillRect(12, 9, 1, 1);
        // Sleek cyan diamond frame
        bikeCtx.fillStyle = '#00e5ff';
        bikeCtx.fillRect(3, 9, 5, 1); // Chainstay
        bikeCtx.fillRect(4, 6, 1, 4); // Seat tube
        bikeCtx.fillRect(5, 6, 5, 1); // Top tube crossbar
        bikeCtx.fillRect(5, 7, 4, 2); // Down tube
        bikeCtx.fillRect(10, 6, 2, 4); // Front fork
        // Handlebars & Saddle
        bikeCtx.fillStyle = '#212121';
        bikeCtx.fillRect(3, 5, 3, 1); // Black sport saddle
        bikeCtx.fillRect(9, 4, 3, 1); // Drop handlebars
        bikeCtx.fillStyle = '#ffd600';
        bikeCtx.fillRect(6, 10, 2, 1); // Crank & pedals
        this.canvasCache['bicycle'] = bikeCv;

        // 7. Totem of Undying (Golden Winged Idol with Emerald Eyes)
        const totemCv = this.createCanvas();
        const totemCtx = totemCv.getContext('2d');
        // Golden Angelic Wings
        totemCtx.fillStyle = '#ffd700';
        totemCtx.fillRect(1, 3, 3, 6);
        totemCtx.fillRect(12, 3, 3, 6);
        totemCtx.fillStyle = '#ffe57f';
        totemCtx.fillRect(2, 4, 2, 4);
        totemCtx.fillRect(12, 4, 2, 4);
        // Golden Head
        totemCtx.fillStyle = '#ffb300';
        totemCtx.fillRect(4, 2, 8, 6);
        totemCtx.fillStyle = '#ffd54f';
        totemCtx.fillRect(5, 3, 6, 2);
        // Glowing Emerald Eyes & Mouth
        totemCtx.fillStyle = '#00e676';
        totemCtx.fillRect(5, 4, 2, 2);
        totemCtx.fillRect(9, 4, 2, 2);
        totemCtx.fillStyle = '#69f0ae';
        totemCtx.fillRect(5, 4, 1, 1);
        totemCtx.fillRect(9, 4, 1, 1);
        totemCtx.fillStyle = '#e65100';
        totemCtx.fillRect(7, 7, 2, 1);
        // Golden Robe / Base with Chest Emerald
        totemCtx.fillStyle = '#ffa000';
        totemCtx.fillRect(5, 8, 6, 5);
        totemCtx.fillStyle = '#ffca28';
        totemCtx.fillRect(4, 13, 8, 2);
        totemCtx.fillStyle = '#00e676';
        totemCtx.fillRect(7, 9, 2, 2); // Heart emerald jewel
        this.canvasCache['totem_of_undying'] = totemCv;

        // --- NEW BIOME BLOCK TEXTURES ---
        // 1. Snow
        const snowCv = this.createCanvas();
        const snCtx = snowCv.getContext('2d');
        this.addNoise(snCtx, '#f4f7fc', 10);
        for (let i = 0; i < 20; i++) {
            snCtx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#e4ebf5';
            snCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['snow'] = snowCv;

        // 2. Ice (Translucent Cyan Blue with crystals)
        const iceCv = this.createCanvas();
        const icCtx = iceCv.getContext('2d');
        this.addNoise(icCtx, '#7ec2e8', 15);
        icCtx.fillStyle = '#a6ddf8';
        icCtx.fillRect(2, 2, 4, 1); icCtx.fillRect(6, 3, 3, 1); icCtx.fillRect(10, 8, 4, 1);
        icCtx.fillStyle = '#5baad6';
        icCtx.fillRect(3, 11, 4, 1); icCtx.fillRect(9, 4, 2, 1);
        this.canvasCache['ice'] = iceCv;

        // 3. Packed Ice (Vibrant Solid Ice)
        const pIceCv = this.createCanvas();
        const piCtx = pIceCv.getContext('2d');
        this.addNoise(piCtx, '#6daadc', 16);
        for (let i = 0; i < 25; i++) {
            piCtx.fillStyle = Math.random() > 0.5 ? '#90c5ec' : '#5292c4';
            piCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['packed_ice'] = pIceCv;

        // 4. Sandstone Top & Side
        const ssTopCv = this.createCanvas();
        const sstCtx = ssTopCv.getContext('2d');
        this.addNoise(sstCtx, '#dfcda3', 14);
        this.canvasCache['sandstone_top'] = ssTopCv;

        const ssSideCv = this.createCanvas();
        const ssCtx = ssSideCv.getContext('2d');
        this.addNoise(ssCtx, '#dec99d', 12);
        ssCtx.fillStyle = '#cfb483';
        ssCtx.fillRect(0, 0, 16, 2);
        ssCtx.fillRect(0, 7, 16, 2);
        ssCtx.fillRect(0, 14, 16, 2);
        ssCtx.fillStyle = '#ebdcb5';
        ssCtx.fillRect(0, 2, 16, 1);
        ssCtx.fillRect(0, 9, 16, 1);
        this.canvasCache['sandstone_side'] = ssSideCv;

        // 5. Cactus Top & Side
        const cacTopCv = this.createCanvas();
        const ctCtx = cacTopCv.getContext('2d');
        this.addNoise(ctCtx, '#527d26', 12);
        ctCtx.fillStyle = '#39571b';
        ctCtx.fillRect(6, 6, 4, 4);
        this.canvasCache['cactus_top'] = cacTopCv;

        const cacSideCv = this.createCanvas();
        const csCtx = cacSideCv.getContext('2d');
        this.addNoise(csCtx, '#527d26', 10);
        for (let x = 0; x < 16; x += 4) {
            csCtx.fillStyle = '#41631e';
            csCtx.fillRect(x, 0, 1, 16);
            csCtx.fillStyle = '#649631';
            csCtx.fillRect(x + 1, 0, 2, 16);
            // Thorn spikes
            csCtx.fillStyle = '#1c290e';
            csCtx.fillRect(x + 2, 3, 1, 1);
            csCtx.fillRect(x + 2, 9, 1, 1);
            csCtx.fillRect(x + 2, 14, 1, 1);
        }
        this.canvasCache['cactus_side'] = cacSideCv;

        // 6. Birch Wood Top & Side
        const bWoodTopCv = this.createCanvas();
        const bwtCtx = bWoodTopCv.getContext('2d');
        this.addNoise(bwtCtx, '#d2c9af', 15);
        bwtCtx.fillStyle = '#948a70';
        bwtCtx.beginPath(); bwtCtx.arc(8, 8, 4, 0, Math.PI * 2); bwtCtx.stroke();
        this.canvasCache['birch_wood_top'] = bWoodTopCv;

        const bWoodSideCv = this.createCanvas();
        const bwsCtx = bWoodSideCv.getContext('2d');
        this.addNoise(bwsCtx, '#e6e6e6', 8);
        // Characteristic birch dark horizontal notches
        const birchNotches = [
            [2, 2, 4], [8, 5, 5], [1, 9, 5], [10, 11, 4], [4, 14, 6]
        ];
        bwsCtx.fillStyle = '#222222';
        birchNotches.forEach(([x, y, w]) => {
            bwsCtx.fillRect(x, y, w, 1);
            bwsCtx.fillStyle = '#444444';
            bwsCtx.fillRect(x + 1, y + 1, w - 2, 1);
            bwsCtx.fillStyle = '#222222';
        });
        this.canvasCache['birch_wood_side'] = bWoodSideCv;

        // 7. Birch Leaves
        const bLeavesCv = this.createCanvas();
        const blCtx = bLeavesCv.getContext('2d');
        this.addNoise(blCtx, '#74b032', 20);
        for (let i = 0; i < 35; i++) {
            blCtx.fillStyle = Math.random() > 0.5 ? '#8ecb42' : '#5b9125';
            blCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['birch_leaves'] = bLeavesCv;

        // 8. Birch Planks
        const bPlanksCv = this.createCanvas();
        const bpCtx = bPlanksCv.getContext('2d');
        this.addNoise(bpCtx, '#ded4ab', 10);
        bpCtx.fillStyle = '#bdae7e';
        bpCtx.fillRect(0, 3, 16, 1);
        bpCtx.fillRect(0, 7, 16, 1);
        bpCtx.fillRect(0, 11, 16, 1);
        bpCtx.fillRect(0, 15, 16, 1);
        this.canvasCache['birch_planks'] = bPlanksCv;

        // 9. Spruce Wood Top & Side
        const sWoodTopCv = this.createCanvas();
        const swtCtx = sWoodTopCv.getContext('2d');
        this.addNoise(swtCtx, '#5a422a', 15);
        swtCtx.fillStyle = '#3c2b1a';
        swtCtx.beginPath(); swtCtx.arc(8, 8, 4, 0, Math.PI * 2); swtCtx.stroke();
        this.canvasCache['spruce_wood_top'] = sWoodTopCv;

        const sWoodSideCv = this.createCanvas();
        const swsCtx = sWoodSideCv.getContext('2d');
        this.addNoise(swsCtx, '#3f2d19', 15);
        for (let x = 0; x < 16; x += 3) {
            swsCtx.fillStyle = '#2c1e10';
            swsCtx.fillRect(x, 0, 1, 16);
            swsCtx.fillStyle = '#4a3621';
            swsCtx.fillRect(x + 1, 0, 1, 16);
        }
        this.canvasCache['spruce_wood_side'] = sWoodSideCv;

        // 10. Spruce Leaves (Needles)
        const sLeavesCv = this.createCanvas();
        const slCtx = sLeavesCv.getContext('2d');
        this.addNoise(slCtx, '#2b5233', 20);
        for (let i = 0; i < 35; i++) {
            slCtx.fillStyle = Math.random() > 0.5 ? '#3a6c44' : '#1e3d24';
            slCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['spruce_leaves'] = sLeavesCv;

        // 11. Spruce Planks
        const sPlanksCv = this.createCanvas();
        const spCtx = sPlanksCv.getContext('2d');
        this.addNoise(spCtx, '#6b4e30', 12);
        spCtx.fillStyle = '#4c3520';
        spCtx.fillRect(0, 3, 16, 1);
        spCtx.fillRect(0, 7, 16, 1);
        spCtx.fillRect(0, 11, 16, 1);
        spCtx.fillRect(0, 15, 16, 1);
        this.canvasCache['spruce_planks'] = sPlanksCv;

        // 12. Jungle Wood Top & Side
        const jWoodTopCv = this.createCanvas();
        const jwtCtx = jWoodTopCv.getContext('2d');
        this.addNoise(jwtCtx, '#6b4c34', 15);
        jwtCtx.fillStyle = '#4a3221';
        jwtCtx.beginPath(); jwtCtx.arc(8, 8, 4, 0, Math.PI * 2); jwtCtx.stroke();
        this.canvasCache['jungle_wood_top'] = jWoodTopCv;

        const jWoodSideCv = this.createCanvas();
        const jwsCtx = jWoodSideCv.getContext('2d');
        this.addNoise(jwsCtx, '#563c26', 15);
        for (let x = 0; x < 16; x += 4) {
            jwsCtx.fillStyle = '#402b1a';
            jwsCtx.fillRect(x, 0, 1, 16);
            jwsCtx.fillStyle = '#3f5923'; // moss tint
            jwsCtx.fillRect(x + 1, (x * 3) % 12, 1, 4);
        }
        this.canvasCache['jungle_wood_side'] = jWoodSideCv;

        // 13. Jungle Leaves
        const jLeavesCv = this.createCanvas();
        const jlCtx = jLeavesCv.getContext('2d');
        this.addNoise(jlCtx, '#2b6e1e', 22);
        for (let i = 0; i < 35; i++) {
            jlCtx.fillStyle = Math.random() > 0.5 ? '#3b8b29' : '#1e5414';
            jlCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['jungle_leaves'] = jLeavesCv;

        // 14. Red Flower (Poppy)
        const rFlowerCv = this.createCanvas();
        const rfCtx = rFlowerCv.getContext('2d');
        rfCtx.fillStyle = '#3c7520'; // Green stem
        rfCtx.fillRect(7, 7, 2, 9);
        rfCtx.fillRect(5, 10, 2, 2);
        rfCtx.fillStyle = '#d62424'; // Red petals
        rfCtx.fillRect(5, 3, 6, 5);
        rfCtx.fillStyle = '#f24444';
        rfCtx.fillRect(6, 4, 4, 3);
        rfCtx.fillStyle = '#221100'; // Center
        rfCtx.fillRect(7, 5, 2, 2);
        this.canvasCache['red_flower'] = rFlowerCv;

        // 15. Yellow Flower (Dandelion)
        const yFlowerCv = this.createCanvas();
        const yfCtx = yFlowerCv.getContext('2d');
        yfCtx.fillStyle = '#3c7520';
        yfCtx.fillRect(7, 7, 2, 9);
        yfCtx.fillRect(9, 11, 2, 2);
        yfCtx.fillStyle = '#f5ba18';
        yfCtx.fillRect(5, 3, 6, 5);
        yfCtx.fillStyle = '#ffe042';
        yfCtx.fillRect(6, 4, 4, 3);
        this.canvasCache['yellow_flower'] = yFlowerCv;

        // 16. Red Mushroom (Fly Agaric)
        const rMushCv = this.createCanvas();
        const rmCtx = rMushCv.getContext('2d');
        rmCtx.fillStyle = '#dcd6c8'; // Beige stem
        rmCtx.fillRect(7, 8, 2, 8);
        rmCtx.fillStyle = '#d42222'; // Red cap
        rmCtx.fillRect(4, 4, 8, 5);
        rmCtx.fillStyle = '#ffffff'; // White dots
        rmCtx.fillRect(5, 5, 1, 1);
        rmCtx.fillRect(9, 5, 1, 1);
        rmCtx.fillRect(7, 7, 1, 1);
        this.canvasCache['red_mushroom'] = rMushCv;

        // 17. Brown Mushroom
        const bMushCv = this.createCanvas();
        const bmCtx = bMushCv.getContext('2d');
        bmCtx.fillStyle = '#dcd6c8';
        bmCtx.fillRect(7, 8, 2, 8);
        bmCtx.fillStyle = '#8a5c37';
        bmCtx.fillRect(4, 5, 8, 4);
        bmCtx.fillStyle = '#a67246';
        bmCtx.fillRect(5, 5, 6, 2);
        this.canvasCache['brown_mushroom'] = bMushCv;

        // 18. Clay
        const clayCv = this.createCanvas();
        const clCtx = clayCv.getContext('2d');
        this.addNoise(clCtx, '#98a2b3', 12);
        this.canvasCache['clay'] = clayCv;

        // 19. Gravel
        const gravelCv = this.createCanvas();
        const grCtx = gravelCv.getContext('2d');
        this.addNoise(grCtx, '#7c7875', 24);
        for (let i = 0; i < 20; i++) {
            grCtx.fillStyle = Math.random() > 0.5 ? '#94908c' : '#595653';
            grCtx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
        }
        this.canvasCache['gravel'] = gravelCv;

        // 20. Mossy Cobblestone
        const mCobbleCv = this.createCanvas();
        const mcCtx = mCobbleCv.getContext('2d');
        mcCtx.drawImage(this.canvasCache['cobblestone'], 0, 0);
        mcCtx.fillStyle = '#4c7c2b';
        mcCtx.fillRect(2, 2, 4, 2); mcCtx.fillRect(3, 4, 2, 2);
        mcCtx.fillRect(10, 8, 5, 2); mcCtx.fillRect(11, 10, 3, 2);
        mcCtx.fillStyle = '#3a611f';
        mcCtx.fillRect(3, 3, 2, 1); mcCtx.fillRect(11, 9, 2, 1);
        this.canvasCache['mossy_cobblestone'] = mCobbleCv;

        // 21. Redstone Lamp
        const rLampCv = this.createCanvas();
        const rlCtx = rLampCv.getContext('2d');
        this.addNoise(rlCtx, '#3a2b1f', 15);
        rlCtx.fillStyle = '#f59a27'; // glowing amber core
        rlCtx.fillRect(3, 3, 10, 10);
        rlCtx.fillStyle = '#d47416';
        rlCtx.fillRect(3, 7, 10, 2);
        rlCtx.fillRect(7, 3, 2, 10);
        rlCtx.fillStyle = '#ffc366';
        rlCtx.fillRect(4, 4, 2, 2); rlCtx.fillRect(10, 4, 2, 2);
        rlCtx.fillRect(4, 10, 2, 2); rlCtx.fillRect(10, 10, 2, 2);
        this.canvasCache['redstone_lamp'] = rLampCv;

        // 22. Terracotta
        const terraCv = this.createCanvas();
        const trCtx = terraCv.getContext('2d');
        this.addNoise(trCtx, '#a35438', 12);
        trCtx.fillStyle = '#944830';
        trCtx.fillRect(0, 3, 16, 2); trCtx.fillRect(0, 11, 16, 2);
        this.canvasCache['terracotta'] = terraCv;

        // 23. Redstone Wire (Unpowered - dark crimson cross/lines)
        const rwCv = this.createCanvas();
        const rwCtx = rwCv.getContext('2d');
        rwCtx.fillStyle = '#4a0000';
        rwCtx.fillRect(6, 0, 4, 16);
        rwCtx.fillRect(0, 6, 16, 4);
        rwCtx.fillStyle = '#6b0707';
        rwCtx.fillRect(7, 1, 2, 14);
        rwCtx.fillRect(1, 7, 14, 2);
        this.canvasCache['redstone_wire'] = rwCv;

        // 24. Redstone Wire ON (Powered - bright neon glowing red)
        const rwoCv = this.createCanvas();
        const rwoCtx = rwoCv.getContext('2d');
        rwoCtx.fillStyle = '#cc0000';
        rwoCtx.fillRect(5, 0, 6, 16);
        rwoCtx.fillRect(0, 5, 16, 6);
        rwoCtx.fillStyle = '#ff2200';
        rwoCtx.fillRect(6, 0, 4, 16);
        rwoCtx.fillRect(0, 6, 16, 4);
        rwoCtx.fillStyle = '#ff9988';
        rwoCtx.fillRect(7, 1, 2, 14);
        rwoCtx.fillRect(1, 7, 14, 2);
        this.canvasCache['redstone_wire_on'] = rwoCv;

        // 25. Redstone Torch Block
        const rtbCv = this.createCanvas();
        const rtbCtx = rtbCv.getContext('2d');
        rtbCtx.fillStyle = '#8a5d3b';
        rtbCtx.fillRect(7, 5, 2, 11);
        rtbCtx.fillStyle = '#ff2200';
        rtbCtx.fillRect(6, 2, 4, 4);
        rtbCtx.fillStyle = '#ffa285';
        rtbCtx.fillRect(7, 3, 2, 2);
        this.canvasCache['redstone_torch_block'] = rtbCv;

        // 26. Lever Block
        const levbCv = this.createCanvas();
        const levbCtx = levbCv.getContext('2d');
        this.addNoise(levbCtx, '#6b6b6b', 15);
        levbCtx.fillStyle = '#333333';
        levbCtx.fillRect(6, 8, 4, 4);
        levbCtx.fillStyle = '#8a5d3b';
        levbCtx.fillRect(7, 2, 2, 7);
        this.canvasCache['lever_block'] = levbCv;

        // 27. Redstone Block (Solid)
        const rbCv = this.createCanvas();
        const rbCtx = rbCv.getContext('2d');
        this.addNoise(rbCtx, '#a80c0c', 16);
        rbCtx.fillStyle = '#d91e1e';
        rbCtx.fillRect(3, 3, 10, 10);
        rbCtx.fillStyle = '#ff4d4d';
        rbCtx.fillRect(4, 4, 3, 3); rbCtx.fillRect(9, 9, 3, 3);
        rbCtx.fillStyle = '#6b0000';
        rbCtx.fillRect(0, 0, 16, 1); rbCtx.fillRect(0, 0, 1, 16);
        this.canvasCache['redstone_block'] = rbCv;

        // 28. Stone Button
        const btnCv = this.createCanvas();
        const btnCtx = btnCv.getContext('2d');
        btnCtx.fillStyle = '#7a7a7a';
        btnCtx.fillRect(5, 6, 6, 4);
        btnCtx.fillStyle = '#a0a0a0';
        btnCtx.fillRect(5, 6, 6, 1);
        this.canvasCache['stone_button'] = btnCv;

        // 29. Pressure Plate
        const ppCv = this.createCanvas();
        const ppCtx = ppCv.getContext('2d');
        ppCtx.fillStyle = '#7a7a7a';
        ppCtx.fillRect(1, 13, 14, 3);
        ppCtx.fillStyle = '#9e9e9e';
        ppCtx.fillRect(2, 13, 12, 1);
        this.canvasCache['pressure_plate'] = ppCv;

        // 30. Computer Front (EmuOS CRT Monitor)
        const compFCv = this.createCanvas();
        const compFCtx = compFCv.getContext('2d');
        this.addNoise(compFCtx, '#cfc8b0', 10); // Beige monitor bezel
        compFCtx.fillStyle = '#222222';
        compFCtx.fillRect(2, 2, 12, 9); // CRT shadow frame
        compFCtx.fillStyle = '#000088';
        compFCtx.fillRect(3, 3, 10, 7); // Retro blue Windows screen
        compFCtx.fillStyle = '#ffffff';
        compFCtx.fillRect(4, 4, 4, 3); // Window box
        compFCtx.fillStyle = '#00aaaa';
        compFCtx.fillRect(4, 4, 4, 1); // Titlebar
        compFCtx.fillStyle = '#00ff44';
        compFCtx.fillRect(13, 13, 1, 1); // Power LED
        compFCtx.fillStyle = '#444444';
        compFCtx.fillRect(3, 12, 6, 2); // Floppy drive slot
        this.canvasCache['computer_front'] = compFCv;

        // 31. Computer Side
        const compSCv = this.createCanvas();
        const compSCtx = compSCv.getContext('2d');
        this.addNoise(compSCtx, '#cfc8b0', 10);
        compSCtx.fillStyle = '#9e9680';
        for (let y = 4; y <= 10; y += 2) compSCtx.fillRect(3, y, 10, 1); // Cooling vents
        this.canvasCache['computer_side'] = compSCv;

        // 32. Computer Top
        const compTCv = this.createCanvas();
        const compTCtx = compTCv.getContext('2d');
        this.addNoise(compTCtx, '#d9d3bd', 10);
        this.canvasCache['computer_top'] = compTCv;

        // 33. Redstone Lamp ON (Blazing bright amber light)
        const rlonCv = this.createCanvas();
        const rlonCtx = rlonCv.getContext('2d');
        this.addNoise(rlonCtx, '#593a17', 10);
        rlonCtx.fillStyle = '#ffca36';
        rlonCtx.fillRect(2, 2, 12, 12);
        rlonCtx.fillStyle = '#fff4a3';
        rlonCtx.fillRect(4, 4, 8, 8);
        rlonCtx.fillStyle = '#ff9900';
        rlonCtx.fillRect(2, 7, 12, 2); rlonCtx.fillRect(7, 2, 2, 12);
        this.canvasCache['redstone_lamp_on'] = rlonCv;
    }

    init() {
        this.generateTextures();

        // Convert 2D canvases to THREE.CanvasTexture with NearestFilter for retro pixel look
        for (let key in this.canvasCache) {
            const tex = new THREE.CanvasTexture(this.canvasCache[key]);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            this.threeTextures[key] = tex;
        }

        // Material Cache for reusing material instances across blocks (collapsing draw calls by 80%)
        this.materialCache = this.materialCache || new Map();
        this.basicMaterialCache = this.basicMaterialCache || new Map();

        const createMat = (tex, opts = {}) => {
            if (!tex) return null;
            const isTrans = !!opts.transparent;
            const op = opts.opacity !== undefined ? opts.opacity : 1.0;
            const at = opts.alphaTest || 0;
            const key = `${tex.id || tex.uuid}_${isTrans}_${op}_${at}`;
            if (this.materialCache.has(key)) {
                return this.materialCache.get(key);
            }
            const mat = new THREE.MeshLambertMaterial({
                map: tex,
                transparent: isTrans,
                opacity: op,
                alphaTest: at,
                ...opts
            });
            const basic = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: isTrans,
                opacity: op,
                alphaTest: at,
                ...opts
            });
            mat.basicCounterpart = basic;
            mat.lambertCounterpart = mat;
            basic.basicCounterpart = basic;
            basic.lambertCounterpart = mat;
            this.materialCache.set(key, mat);
            return mat;
        };

        const createBasicMat = (tex, opts = {}) => {
            if (!tex) return null;
            const isTrans = !!opts.transparent;
            const op = opts.opacity !== undefined ? opts.opacity : 1.0;
            const at = opts.alphaTest || 0;
            const key = `basic_${tex.id || tex.uuid}_${isTrans}_${op}_${at}`;
            if (this.basicMaterialCache.has(key)) {
                return this.basicMaterialCache.get(key);
            }
            const mat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: isTrans,
                opacity: op,
                alphaTest: at,
                ...opts
            });
            mat.basicCounterpart = mat;
            mat.lambertCounterpart = mat;
            this.basicMaterialCache.set(key, mat);
            return mat;
        };

        const t = this.threeTextures;

        const grassSideMat = createMat(t.grass_side);
        const grassTopMat = createMat(t.grass_top);
        const dirtMat = createMat(t.dirt);
        const stoneMat = createMat(t.stone);
        const cobbleMat = createMat(t.cobblestone);
        const woodSideMat = createMat(t.wood_side);
        const woodTopMat = createMat(t.wood_top);
        const planksMat = createMat(t.planks);
        const bricksMat = createMat(t.bricks);
        const glassMat = createMat(t.glass, { transparent: true, opacity: 0.6 });
        const sandMat = createMat(t.sand);
        const tntSideMat = createMat(t.tnt_side);
        const tntTopMat = createMat(t.tnt_top);
        const diamondMat = createMat(t.diamond);
        const goldMat = createMat(t.gold);
        const eblanMat = createMat(t.eblan);
        const bedrockMat = createMat(t.bedrock);
        const glowstoneMat = createBasicMat(t.glowstone);
        const bookshelfSideMat = createMat(t.bookshelf);
        const craftSideMat = createMat(t.craft_side);
        const craftTopMat = createMat(t.craft_top);
        
        // 🌋 Realistic Glowing Lava Material with Surface Heat Waves & Magma Emission
        const lavaMat = new THREE.MeshLambertMaterial({
            map: t.lava,
            emissive: new THREE.Color(0xff4400),
            emissiveIntensity: 0.88
        });
        const basicLavaMat = new THREE.MeshBasicMaterial({
            map: t.lava
        });
        lavaMat.basicCounterpart = basicLavaMat;
        lavaMat.lambertCounterpart = lavaMat;
        basicLavaMat.basicCounterpart = basicLavaMat;
        basicLavaMat.lambertCounterpart = lavaMat;

        lavaMat.userData.uTime = { value: 0 };
        lavaMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = lavaMat.userData.uTime;
            shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                if (normal.y > 0.5) {
                    float wave = sin(position.x * 1.6 + uTime * 1.4) * cos(position.z * 1.6 + uTime * 1.1) * 0.04;
                    transformed.y += wave;
                }`
            );
        };

        const spongeMat = createMat(t.sponge);
        const catMat = createMat(t.cat);

        // Blocks with multi-face materials reuse single material instances per face type
        this.materials[BLOCK_TYPES.GRASS] = [
            grassSideMat,
            grassSideMat,
            grassTopMat,
            dirtMat,
            grassSideMat,
            grassSideMat
        ];

        this.materials[BLOCK_TYPES.DIRT] = dirtMat;
        this.materials[BLOCK_TYPES.STONE] = stoneMat;
        this.materials[BLOCK_TYPES.COBBLESTONE] = cobbleMat;

        this.materials[BLOCK_TYPES.WOOD] = [
            woodSideMat,
            woodSideMat,
            woodTopMat,
            woodTopMat,
            woodSideMat,
            woodSideMat
        ];

        this.materials[BLOCK_TYPES.PLANKS] = planksMat;
        
        const leavesMat = createMat(t.leaves, { transparent: true, alphaTest: 0.1 });
        leavesMat.userData.uTime = { value: 0 };
        leavesMat.userData.uWindStrength = { value: 1.0 };
        leavesMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = leavesMat.userData.uTime;
            shader.uniforms.uWindStrength = leavesMat.userData.uWindStrength;
            shader.vertexShader = `uniform float uTime;\nuniform float uWindStrength;\n` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                if (uWindStrength > 0.001) {
                    float windPhase = uTime * 2.8 + (position.x * 1.5) + (position.y * 2.1) + (position.z * 1.7);
                    float swayX = sin(windPhase) * 0.08 * uWindStrength;
                    float swayZ = cos(windPhase * 0.8) * 0.07 * uWindStrength;
                    float swayY = sin(windPhase * 1.3) * 0.03 * uWindStrength;
                    transformed.x += swayX;
                    transformed.z += swayZ;
                    transformed.y += swayY;
                }`
            );
        };
        this.materials[BLOCK_TYPES.LEAVES] = leavesMat;
        this.materials[BLOCK_TYPES.BRICKS] = bricksMat;
        this.materials[BLOCK_TYPES.GLASS] = glassMat;
        this.materials[BLOCK_TYPES.SAND] = sandMat;

        this.materials[BLOCK_TYPES.TNT] = [
            tntSideMat,
            tntSideMat,
            tntTopMat,
            tntTopMat,
            tntSideMat,
            tntSideMat
        ];

        this.materials[BLOCK_TYPES.DIAMOND_BLOCK] = diamondMat;
        this.materials[BLOCK_TYPES.GOLD_BLOCK] = goldMat;
        this.materials[BLOCK_TYPES.EBLAN_BLOCK] = eblanMat;
        this.materials[BLOCK_TYPES.BEDROCK] = bedrockMat;
        this.materials[BLOCK_TYPES.GLOWSTONE] = glowstoneMat;

        this.materials[BLOCK_TYPES.BOOKSHELF] = [
            bookshelfSideMat,
            bookshelfSideMat,
            planksMat,
            planksMat,
            bookshelfSideMat,
            bookshelfSideMat
        ];

        this.materials[BLOCK_TYPES.CRAFTING_TABLE] = [
            craftSideMat,
            craftSideMat,
            craftTopMat,
            planksMat,
            craftSideMat,
            craftSideMat
        ];

        let waterNormalsTex = null;
        if (window.THREE && THREE.makeWaterNormals) {
            waterNormalsTex = THREE.makeWaterNormals(256);
            waterNormalsTex.wrapS = waterNormalsTex.wrapT = THREE.RepeatWrapping;
            waterNormalsTex.repeat.set(2, 2);
        }

        const waterMat = new THREE.MeshPhongMaterial({
            map: t.water,
            color: 0x22a6c8,
            specular: 0xffffff,
            shininess: 95,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            normalMap: waterNormalsTex,
            normalScale: new THREE.Vector2(0.85, 0.85),
            side: THREE.DoubleSide
        });

        // 🥔 Low-Settings Water Material: ZERO normal maps, ZERO vertex wave shaders, ZERO specular reflections
        const basicWaterMat = new THREE.MeshBasicMaterial({
            map: t.water,
            color: 0x2980b9,
            transparent: true,
            opacity: 0.65,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        basicWaterMat.basicCounterpart = basicWaterMat;
        basicWaterMat.fancyCounterpart = waterMat;
        waterMat.basicCounterpart = basicWaterMat;
        waterMat.fancyCounterpart = waterMat;

        try {
            const loader = new THREE.TextureLoader();
            loader.load('textures/waternormals.jpg', (tex) => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(2, 2);
                waterMat.normalMap = tex;
                waterMat.needsUpdate = true;
            });
        } catch (e) {}

        waterMat.userData.uTime = { value: 0 };
        waterMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = waterMat.userData.uTime;
            shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                if (normal.y > 0.5) {
                    float wave = sin(position.x * 2.2 + uTime * 2.5) * cos(position.z * 2.2 + uTime * 2.0) * 0.06;
                    transformed.y += wave;
                }`
            );
        };
        this.materials[BLOCK_TYPES.WATER] = waterMat;
        this.materials[BLOCK_TYPES.LAVA] = lavaMat;
        this.materials[BLOCK_TYPES.SPONGE] = spongeMat;
        this.materials[BLOCK_TYPES.MEME_CAT] = catMat;

        // New Nether / End / Ore materials
        this.materials[BLOCK_TYPES.COAL_ORE] = createMat(t.coal_ore);
        this.materials[BLOCK_TYPES.IRON_ORE] = createMat(t.iron_ore);
        this.materials[BLOCK_TYPES.OBSIDIAN] = createMat(t.obsidian);
        this.materials[BLOCK_TYPES.NETHERRACK] = createMat(t.netherrack);
        this.materials[BLOCK_TYPES.SOUL_SAND] = createMat(t.soul_sand);
        this.materials[BLOCK_TYPES.NETHER_BRICKS] = createMat(t.nether_bricks);
        this.materials[BLOCK_TYPES.NETHER_QUARTZ] = createMat(t.nether_quartz);
        this.materials[BLOCK_TYPES.NETHERITE_BLOCK] = createMat(t.netherite_block);
        this.materials[BLOCK_TYPES.END_STONE] = createMat(t.end_stone);
        this.materials[BLOCK_TYPES.DRAGON_EGG] = createMat(t.dragon_egg);
        this.materials[BLOCK_TYPES.PORTAL_NETHER] = createMat(t.portal_nether, { transparent: true, opacity: 0.8 });
        this.materials[BLOCK_TYPES.PORTAL_END] = createMat(t.portal_end, { transparent: true, opacity: 0.85 });

        // New Biome Block Materials
        const snowMat = createMat(t.snow);
        const iceMat = createMat(t.ice, { transparent: true, opacity: 0.72, depthWrite: false });
        iceMat.side = THREE.DoubleSide;
        const packedIceMat = createMat(t.packed_ice);
        const ssTopMat = createMat(t.sandstone_top);
        const ssSideMat = createMat(t.sandstone_side);
        const cacTopMat = createMat(t.cactus_top);
        const cacSideMat = createMat(t.cactus_side);
        const bWoodTopMat = createMat(t.birch_wood_top);
        const bWoodSideMat = createMat(t.birch_wood_side);
        const bPlanksMat = createMat(t.birch_planks);
        const sWoodTopMat = createMat(t.spruce_wood_top);
        const sWoodSideMat = createMat(t.spruce_wood_side);
        const sPlanksMat = createMat(t.spruce_planks);
        const jWoodTopMat = createMat(t.jungle_wood_top);
        const jWoodSideMat = createMat(t.jungle_wood_side);

        const makeLeafMat = (tex) => {
            const mat = createMat(tex, { transparent: true, alphaTest: 0.1 });
            mat.userData.uTime = { value: 0 };
            mat.userData.uWindStrength = { value: 1.0 };
            mat.onBeforeCompile = (shader) => {
                shader.uniforms.uTime = mat.userData.uTime;
                shader.uniforms.uWindStrength = mat.userData.uWindStrength;
                shader.vertexShader = `uniform float uTime;\nuniform float uWindStrength;\n` + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>
                    float windPhase = position.x * 0.8 + position.z * 0.8 + uTime * 2.2;
                    float swayX = sin(windPhase) * 0.05 * uWindStrength;
                    float swayZ = cos(windPhase * 0.9) * 0.05 * uWindStrength;
                    transformed.x += swayX;
                    transformed.z += swayZ;`
                );
            };
            return mat;
        };

        const bLeavesMat = makeLeafMat(t.birch_leaves);
        const sLeavesMat = makeLeafMat(t.spruce_leaves);
        const jLeavesMat = makeLeafMat(t.jungle_leaves);

        const flowerOpts = { transparent: true, alphaTest: 0.15, side: THREE.DoubleSide };
        const rFlowerMat = createMat(t.red_flower, flowerOpts);
        const yFlowerMat = createMat(t.yellow_flower, flowerOpts);
        const rMushMat = createMat(t.red_mushroom, flowerOpts);
        const bMushMat = createMat(t.brown_mushroom, flowerOpts);
        const clayMat = createMat(t.clay);
        const gravelMat = createMat(t.gravel);
        const mCobbleMat = createMat(t.mossy_cobblestone);
        const rLampMat = createBasicMat(t.redstone_lamp);
        const terraMat = createMat(t.terracotta);

        this.materials[BLOCK_TYPES.SNOW] = snowMat;
        this.materials[BLOCK_TYPES.ICE] = iceMat;
        this.materials[BLOCK_TYPES.PACKED_ICE] = packedIceMat;
        this.materials[BLOCK_TYPES.SANDSTONE] = [ssSideMat, ssSideMat, ssTopMat, ssTopMat, ssSideMat, ssSideMat];
        this.materials[BLOCK_TYPES.CACTUS] = [cacSideMat, cacSideMat, cacTopMat, cacTopMat, cacSideMat, cacSideMat];
        this.materials[BLOCK_TYPES.BIRCH_WOOD] = [bWoodSideMat, bWoodSideMat, bWoodTopMat, bWoodTopMat, bWoodSideMat, bWoodSideMat];
        this.materials[BLOCK_TYPES.BIRCH_LEAVES] = bLeavesMat;
        this.materials[BLOCK_TYPES.BIRCH_PLANKS] = bPlanksMat;
        this.materials[BLOCK_TYPES.SPRUCE_WOOD] = [sWoodSideMat, sWoodSideMat, sWoodTopMat, sWoodTopMat, sWoodSideMat, sWoodSideMat];
        this.materials[BLOCK_TYPES.SPRUCE_LEAVES] = sLeavesMat;
        this.materials[BLOCK_TYPES.SPRUCE_PLANKS] = sPlanksMat;
        this.materials[BLOCK_TYPES.JUNGLE_WOOD] = [jWoodSideMat, jWoodSideMat, jWoodTopMat, jWoodTopMat, jWoodSideMat, jWoodSideMat];
        this.materials[BLOCK_TYPES.JUNGLE_LEAVES] = jLeavesMat;
        this.materials[BLOCK_TYPES.RED_FLOWER] = rFlowerMat;
        this.materials[BLOCK_TYPES.YELLOW_FLOWER] = yFlowerMat;
        this.materials[BLOCK_TYPES.RED_MUSHROOM] = rMushMat;
        this.materials[BLOCK_TYPES.BROWN_MUSHROOM] = bMushMat;
        this.materials[BLOCK_TYPES.CLAY] = clayMat;
        this.materials[BLOCK_TYPES.GRAVEL] = gravelMat;
        this.materials[BLOCK_TYPES.MOSSY_COBBLESTONE] = mCobbleMat;
        this.materials[BLOCK_TYPES.REDSTONE_LAMP] = rLampMat;
        this.materials[BLOCK_TYPES.TERRACOTTA] = terraMat;

        const rwMat = createMat(t.redstone_wire, flowerOpts);
        const rtbMat = createMat(t.redstone_torch_block, flowerOpts);
        const levMat = createMat(t.lever_block, flowerOpts);
        const rbMat = createMat(t.redstone_block);
        const btnMat = createMat(t.stone_button, flowerOpts);
        const ppMat = createMat(t.pressure_plate, flowerOpts);
        const compFrontMat = createBasicMat(t.computer_front);
        const compSideMat = createMat(t.computer_side);
        const compTopMat = createMat(t.computer_top);
        const compMaterials = [compSideMat, compSideMat, compTopMat, compTopMat, compFrontMat, compSideMat];
        const rLampOnMat = createBasicMat(t.redstone_lamp_on);

        this.materials[BLOCK_TYPES.REDSTONE_WIRE] = rwMat;
        this.materials[BLOCK_TYPES.REDSTONE_TORCH] = rtbMat;
        this.materials[BLOCK_TYPES.LEVER] = levMat;
        this.materials[BLOCK_TYPES.REDSTONE_BLOCK] = rbMat;
        this.materials[BLOCK_TYPES.STONE_BUTTON] = btnMat;
        this.materials[BLOCK_TYPES.PRESSURE_PLATE] = ppMat;
        this.materials[BLOCK_TYPES.COMPUTER] = compMaterials;
        this.materials[BLOCK_TYPES.REDSTONE_LAMP_ON] = rLampOnMat;
    }

    getBlockMaterial(type) {
        const mat = this.materials[type] || this.materials[BLOCK_TYPES.STONE];
        if (type === BLOCK_TYPES.WATER) {
            const isFancy = (window.game && window.game.isFancyWaterActive) ? window.game.isFancyWaterActive() : (!window.game || (!window.game.turboFPS && !window.game.isA02Mode));
            return isFancy ? mat : (mat.basicCounterpart || mat);
        }
        const isTurboOrA02 = (window.game && (window.game.turboFPS || window.game.isA02Mode || window.game.lowGraphicsMode));
        if (isTurboOrA02) {
            if (Array.isArray(mat)) {
                return mat.map(m => (m && m.basicCounterpart) ? m.basicCounterpart : m);
            }
            return (mat && mat.basicCounterpart) ? mat.basicCounterpart : mat;
        }
        return mat;
    }

    getTextureCanvas(name) {
        return this.canvasCache[name] || this.canvasCache['stone'];
    }

    getItemDropGeometry() {
        return this.itemDropGeometry;
    }

    getTexture(name) {
        if (this.threeTextures[name]) return this.threeTextures[name];
        if (this.itemDropTextures[name]) return this.itemDropTextures[name];
        const cv = this.getTextureCanvas(name);
        const tex = new THREE.CanvasTexture(cv);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        this.itemDropTextures[name] = tex;
        return tex;
    }

    getItemDropMaterial(itemId) {
        if (this.itemDropMaterials[itemId]) {
            return this.itemDropMaterials[itemId];
        }
        const info = (window.ITEM_REGISTRY && window.ITEM_REGISTRY[itemId]) ? window.ITEM_REGISTRY[itemId] : { name: 'Item', icon: 'stone' };
        const iconName = info.icon || 'stone';
        const tex = this.getTexture(iconName);
        const mat = new THREE.MeshLambertMaterial({
            map: tex,
            transparent: !!info.transparent,
            alphaTest: info.alphaTest || 0.05
        });
        this.itemDropMaterials[itemId] = mat;
        return mat;
    }

    getIconDataURL(keyOrType) {
        if (this.iconDataUrlCache.has(keyOrType)) {
            return this.iconDataUrlCache.get(keyOrType);
        }

        let url = '';
        if (typeof keyOrType === 'string') {
            const canvas = this.canvasCache[keyOrType];
            url = canvas ? canvas.toDataURL() : (this.canvasCache['stone'] ? this.canvasCache['stone'].toDataURL() : '');
        } else {
            let key = 'stone';
            if (window.BLOCK_INFO && window.BLOCK_INFO[keyOrType] && window.BLOCK_INFO[keyOrType].iconKey) {
                key = window.BLOCK_INFO[keyOrType].iconKey;
            } else {
                switch (keyOrType) {
                case BLOCK_TYPES.GRASS: key = 'grass_side'; break;
                case BLOCK_TYPES.DIRT: key = 'dirt'; break;
                case BLOCK_TYPES.STONE: key = 'stone'; break;
                case BLOCK_TYPES.COBBLESTONE: key = 'cobblestone'; break;
                case BLOCK_TYPES.WOOD: key = 'wood_side'; break;
                case BLOCK_TYPES.PLANKS: key = 'planks'; break;
                case BLOCK_TYPES.LEAVES: key = 'leaves'; break;
                case BLOCK_TYPES.BRICKS: key = 'bricks'; break;
                case BLOCK_TYPES.GLASS: key = 'glass'; break;
                case BLOCK_TYPES.SAND: key = 'sand'; break;
                case BLOCK_TYPES.TNT: key = 'tnt_side'; break;
                case BLOCK_TYPES.DIAMOND_BLOCK: key = 'diamond'; break;
                case BLOCK_TYPES.GOLD_BLOCK: key = 'gold'; break;
                case BLOCK_TYPES.EBLAN_BLOCK: key = 'eblan'; break;
                case BLOCK_TYPES.BEDROCK: key = 'bedrock'; break;
                case BLOCK_TYPES.GLOWSTONE: key = 'glowstone'; break;
                case BLOCK_TYPES.BOOKSHELF: key = 'bookshelf'; break;
                case BLOCK_TYPES.CRAFTING_TABLE: key = 'craft_top'; break;
                case BLOCK_TYPES.WATER: key = 'water'; break;
                case BLOCK_TYPES.LAVA: key = 'lava'; break;
                case BLOCK_TYPES.SPONGE: key = 'sponge'; break;
                case BLOCK_TYPES.MEME_CAT: key = 'cat'; break;
                case BLOCK_TYPES.COAL_ORE: key = 'coal_ore'; break;
                case BLOCK_TYPES.IRON_ORE: key = 'iron_ore'; break;
                case BLOCK_TYPES.OBSIDIAN: key = 'obsidian'; break;
                case BLOCK_TYPES.NETHERRACK: key = 'netherrack'; break;
                case BLOCK_TYPES.SOUL_SAND: key = 'soul_sand'; break;
                case BLOCK_TYPES.NETHER_BRICKS: key = 'nether_bricks'; break;
                case BLOCK_TYPES.NETHER_QUARTZ: key = 'nether_quartz'; break;
                case BLOCK_TYPES.NETHERITE_BLOCK: key = 'netherite_block'; break;
                case BLOCK_TYPES.END_STONE: key = 'end_stone'; break;
                case BLOCK_TYPES.DRAGON_EGG: key = 'dragon_egg'; break;
                case BLOCK_TYPES.PORTAL_NETHER: key = 'portal_nether'; break;
                case BLOCK_TYPES.PORTAL_END: key = 'portal_end'; break;
                case BLOCK_TYPES.SNOW: key = 'snow'; break;
                case BLOCK_TYPES.ICE: key = 'ice'; break;
                case BLOCK_TYPES.PACKED_ICE: key = 'packed_ice'; break;
                case BLOCK_TYPES.SANDSTONE: key = 'sandstone_side'; break;
                case BLOCK_TYPES.CACTUS: key = 'cactus_side'; break;
                case BLOCK_TYPES.BIRCH_WOOD: key = 'birch_wood_side'; break;
                case BLOCK_TYPES.BIRCH_LEAVES: key = 'birch_leaves'; break;
                case BLOCK_TYPES.BIRCH_PLANKS: key = 'birch_planks'; break;
                case BLOCK_TYPES.SPRUCE_WOOD: key = 'spruce_wood_side'; break;
                case BLOCK_TYPES.SPRUCE_LEAVES: key = 'spruce_leaves'; break;
                case BLOCK_TYPES.SPRUCE_PLANKS: key = 'spruce_planks'; break;
                case BLOCK_TYPES.JUNGLE_WOOD: key = 'jungle_wood_side'; break;
                case BLOCK_TYPES.JUNGLE_LEAVES: key = 'jungle_leaves'; break;
                case BLOCK_TYPES.RED_FLOWER: key = 'red_flower'; break;
                case BLOCK_TYPES.YELLOW_FLOWER: key = 'yellow_flower'; break;
                case BLOCK_TYPES.RED_MUSHROOM: key = 'red_mushroom'; break;
                case BLOCK_TYPES.BROWN_MUSHROOM: key = 'brown_mushroom'; break;
                case BLOCK_TYPES.CLAY: key = 'clay'; break;
                case BLOCK_TYPES.GRAVEL: key = 'gravel'; break;
                case BLOCK_TYPES.MOSSY_COBBLESTONE: key = 'mossy_cobblestone'; break;
                case BLOCK_TYPES.REDSTONE_LAMP: key = 'redstone_lamp'; break;
                case BLOCK_TYPES.TERRACOTTA: key = 'terracotta'; break;
                case BLOCK_TYPES.REDSTONE_WIRE: key = 'redstone_dust'; break;
                case BLOCK_TYPES.REDSTONE_TORCH: key = 'redstone_torch'; break;
                case BLOCK_TYPES.LEVER: key = 'lever'; break;
                case BLOCK_TYPES.REDSTONE_BLOCK: key = 'redstone_block'; break;
                case BLOCK_TYPES.STONE_BUTTON: key = 'stone_button'; break;
                case BLOCK_TYPES.PRESSURE_PLATE: key = 'pressure_plate'; break;
                case BLOCK_TYPES.COMPUTER: key = 'computer'; break;
                case BLOCK_TYPES.REDSTONE_LAMP_ON: key = 'redstone_lamp_on'; break;
                }
            }
            const canvas = this.canvasCache[key];
            url = canvas ? canvas.toDataURL() : '';
        }
        this.iconDataUrlCache.set(keyOrType, url);
        return url;
    }

    createCanvasFromSpec(spec, width = 16, height = 16, onUpdate = null) {
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        if (!spec) {
            ctx.fillStyle = '#666666';
            ctx.fillRect(0, 0, width, height);
            return canvas;
        }

        if (typeof spec === 'string') {
            const trimmed = spec.trim();
            if (this.canvasCache[trimmed]) {
                ctx.drawImage(this.canvasCache[trimmed], 0, 0, width, height);
            } else if (trimmed.startsWith('#') || trimmed.startsWith('rgb')) {
                ctx.fillStyle = trimmed;
                ctx.fillRect(0, 0, width, height);
                const imgData = ctx.getImageData(0, 0, width, height);
                const d = imgData.data;
                for (let i = 0; i < d.length; i += 4) {
                    const delta = (Math.random() - 0.5) * 16;
                    d[i] = Math.max(0, Math.min(255, d[i] + delta));
                    d[i+1] = Math.max(0, Math.min(255, d[i+1] + delta));
                    d[i+2] = Math.max(0, Math.min(255, d[i+2] + delta));
                }
                ctx.putImageData(imgData, 0, 0);
            } else if (trimmed.startsWith('data:image') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.endsWith('.png') || trimmed.endsWith('.jpg') || trimmed.endsWith('.webp')) {
                ctx.fillStyle = '#444444';
                ctx.fillRect(0, 0, width, height);
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    canvas.width = img.naturalWidth || width;
                    canvas.height = img.naturalHeight || height;
                    const c2 = canvas.getContext('2d');
                    c2.imageSmoothingEnabled = false;
                    c2.drawImage(img, 0, 0);
                    if (typeof onUpdate === 'function') onUpdate(canvas);
                };
                img.src = trimmed;
            } else {
                ctx.fillStyle = '#555555';
                ctx.fillRect(0, 0, width, height);
            }
        } else if (typeof spec === 'function') {
            try { spec(ctx, width, height); } catch (e) { console.warn('Texture draw error:', e); }
        } else if (typeof spec === 'object') {
            if (Array.isArray(spec.pixels) && spec.colors) {
                const p = spec.pixels;
                const c = spec.colors;
                const ph = p.length;
                const pw = p[0] ? p[0].length : 16;
                canvas.width = pw;
                canvas.height = ph;
                for (let y = 0; y < ph; y++) {
                    const row = String(p[y] || '');
                    for (let x = 0; x < pw; x++) {
                        const ch = row[x];
                        const col = c[ch];
                        if (col && col !== 'transparent' && col !== 'none' && col !== ' ') {
                            ctx.fillStyle = col;
                            ctx.fillRect(x, y, 1, 1);
                        }
                    }
                }
            } else if (spec.draw && typeof spec.draw === 'function') {
                try { spec.draw(ctx, width, height); } catch (e) { console.warn('Texture draw error:', e); }
            } else if (spec.url || spec.texture || spec.image) {
                return this.createCanvasFromSpec(spec.url || spec.texture || spec.image, width, height, onUpdate);
            } else if (spec.color || spec.pattern) {
                const color = spec.color || '#555555';
                const pattern = spec.pattern || 'noise';
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, width, height);
                if (pattern === 'noise') {
                    this.addNoise(ctx, color, 20, width, height);
                } else if (pattern === 'grid') {
                    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                    ctx.strokeRect(0, 0, width, height);
                } else if (pattern === 'hazard') {
                    ctx.fillStyle = '#ffaa00';
                    ctx.fillRect(0, 0, width, height);
                    ctx.fillStyle = '#111111';
                    for (let i = -width; i < width * 2; i += 6) {
                        ctx.beginPath();
                        ctx.moveTo(i, 0);
                        ctx.lineTo(i + 4, 0);
                        ctx.lineTo(i + 4 + height, height);
                        ctx.lineTo(i + height, height);
                        ctx.closePath();
                        ctx.fill();
                    }
                } else if (pattern === 'road_line') {
                    ctx.fillStyle = '#222222';
                    ctx.fillRect(0, 0, width, height);
                    ctx.fillStyle = '#ffd700';
                    ctx.fillRect(Math.floor(width / 2) - 1, 0, 2, height);
                }
            }
        }
        return canvas;
    }

    // 🌋 Real-Time Convective Magma Simulation (Flowing fluid animation)
    updateLava(time = 0) {
        if (!this.lavaCanvas || !this.lavaCtx) return;
        this._lastLavaUpdate = this._lastLavaUpdate || 0;
        if (time > 0 && time - this._lastLavaUpdate < 0.045) return;
        this._lastLavaUpdate = time;

        const w = 16, h = 16;
        if (!this._lavaImgData) {
            this._lavaImgData = this.lavaCtx.createImageData(w, h);
        }
        const data = this._lavaImgData.data;
        const t1 = time * 1.8;
        const t2 = time * 1.1;

        for (let y = 0; y < h; y++) {
            const ny = y / h;
            for (let x = 0; x < w; x++) {
                const nx = x / w;
                // Multi-octave convective heat simulation
                const s1 = Math.sin(nx * 6.28 + t1) * Math.cos(ny * 6.28 + t2);
                const s2 = Math.sin((nx + ny) * 8.0 - t1 * 1.2);
                const s3 = Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 10.0 + t2 * 1.7);
                const heat = (s1 + s2 * 0.6 + s3 * 0.5 + 2.1) / 4.2; // 0.0 .. 1.0

                let r, g, b;
                if (heat < 0.32) {
                    // Dark volcanic crust / cooling basalt
                    const f = heat / 0.32;
                    r = Math.floor(65 + f * 95);
                    g = Math.floor(8 + f * 20);
                    b = 4;
                } else if (heat < 0.70) {
                    // Radiant molten red-orange fire
                    const f = (heat - 0.32) / (0.70 - 0.32);
                    r = Math.floor(160 + f * 95);
                    g = Math.floor(28 + f * 125);
                    b = 4;
                } else {
                    // Superheated bright yellow / gold core
                    const f = (heat - 0.70) / (1.0 - 0.70);
                    r = 255;
                    g = Math.floor(153 + f * 97);
                    b = Math.floor(4 + f * 90);
                }

                const idx = (y * w + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
        this.lavaCtx.putImageData(this._lavaImgData, 0, 0);
        if (this.threeTextures && this.threeTextures['lava']) {
            this.threeTextures['lava'].needsUpdate = true;
        }
    }

    registerTexture(name, spec, opts = {}) {
        const key = String(name).trim().toLowerCase();
        let tex = this.threeTextures[key];
        const canvas = this.createCanvasFromSpec(spec, 16, 16, (cv) => {
            if (tex) tex.needsUpdate = true;
            this.iconDataUrlCache.delete(key);
            if (window.game && window.game.world) window.game.world.updateMeshes();
        });
        this.canvasCache[key] = canvas;
        if (!tex) {
            tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            this.threeTextures[key] = tex;
        } else {
            tex.image = canvas;
            tex.needsUpdate = true;
        }
        this.iconDataUrlCache.delete(key);
        return tex;
    }

    overrideTexture(targetName, spec) {
        const key = String(targetName).trim().toLowerCase();
        const tex = this.registerTexture(key, spec);
        if (window.game && window.game.world) {
            window.game.world.updateMeshes();
        }
        return tex;
    }
}

window.BLOCK_TYPES = BLOCK_TYPES;
window.BLOCK_INFO = BLOCK_INFO;
window.TextureManager = TextureManager;

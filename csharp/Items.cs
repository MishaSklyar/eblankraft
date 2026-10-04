using System;
using System.Collections.Generic;
using Raylib_cs;

namespace Eblankraft;

public enum ItemCategory
{
    Block = 0,
    Food,
    Tool,
    Weapon,
    Case,
    Trash,
    Misc
}

public enum ItemId
{
    None = 0,
    // Blocks as items: 1..Count-1
    BlockStart = 1,
    BlockEnd = (int)BlockType.Count - 1,

    // Food
    Apple = 50,
    Steak,
    Shawarma,

    // Tools & Weapons
    PickWood,
    PickStone,
    PickIron,
    PickDiamond,
    PickNetherite,
    PickSuperEblan,
    SwordWood,
    SwordIron,
    SwordDiamond,
    SwordDragonslayer,

    // Cases
    CaseBomzh,
    CaseDiamond,
    CaseNether,
    CaseDragon,

    // Trash & Meme Items
    TrashSock,
    TrashZhiguli,
    TrashCig,
    TrashNut,

    // Boss Drops
    DragonEgg,
    EyeOfEbland
}

public sealed class ItemDef
{
    public ItemId Id { get; set; }
    public string Name { get; set; } = "";
    public ItemCategory Category { get; set; }
    public BlockType BlockType { get; set; }
    public int Value { get; set; }
    public int TextureIndex { get; set; }
    public float MiningSpeed { get; set; } = 1f;
    public float AttackDamage { get; set; } = 1f;
    public bool IsBlock => Category == ItemCategory.Block;
}

public static class Items
{
    private static readonly Dictionary<ItemId, ItemDef> SpecialItems = new()
    {
        // Food
        [ItemId.Apple] = new ItemDef { Id = ItemId.Apple, Name = "Yabluko", Category = ItemCategory.Food, Value = 20, TextureIndex = 14, AttackDamage = 1f },
        [ItemId.Steak] = new ItemDef { Id = ItemId.Steak, Name = "Zharenyi Steik", Category = ItemCategory.Food, Value = 40, TextureIndex = 14, AttackDamage = 1f },
        [ItemId.Shawarma] = new ItemDef { Id = ItemId.Shawarma, Name = "Shaurma Yeblana", Category = ItemCategory.Food, Value = 75, TextureIndex = 23, AttackDamage = 2f },

        // Tools
        [ItemId.PickWood] = new ItemDef { Id = ItemId.PickWood, Name = "Derev'yana Kyrka", Category = ItemCategory.Tool, Value = 2, TextureIndex = 29, MiningSpeed = 2.0f, AttackDamage = 2f },
        [ItemId.PickStone] = new ItemDef { Id = ItemId.PickStone, Name = "Kam'yana Kyrka", Category = ItemCategory.Tool, Value = 4, TextureIndex = 28, MiningSpeed = 4.0f, AttackDamage = 3f },
        [ItemId.PickIron] = new ItemDef { Id = ItemId.PickIron, Name = "Zalizna Kyrka", Category = ItemCategory.Tool, Value = 6, TextureIndex = 15, MiningSpeed = 6.0f, AttackDamage = 4f },
        [ItemId.PickDiamond] = new ItemDef { Id = ItemId.PickDiamond, Name = "Almazna Kyrka", Category = ItemCategory.Tool, Value = 10, TextureIndex = 17, MiningSpeed = 10.0f, AttackDamage = 5f },
        [ItemId.PickNetherite] = new ItemDef { Id = ItemId.PickNetherite, Name = "Nezeritova Kyrka", Category = ItemCategory.Tool, Value = 15, TextureIndex = 18, MiningSpeed = 15.0f, AttackDamage = 6f },
        [ItemId.PickSuperEblan] = new ItemDef { Id = ItemId.PickSuperEblan, Name = "Kyrka Sverkh-Yeblana", Category = ItemCategory.Tool, Value = 35, TextureIndex = 27, MiningSpeed = 35.0f, AttackDamage = 12f },

        // Weapons
        [ItemId.SwordWood] = new ItemDef { Id = ItemId.SwordWood, Name = "Derev'yanyi Mech", Category = ItemCategory.Weapon, Value = 10, TextureIndex = 29, AttackDamage = 4f },
        [ItemId.SwordIron] = new ItemDef { Id = ItemId.SwordIron, Name = "Zaliznyi Mech", Category = ItemCategory.Weapon, Value = 25, TextureIndex = 15, AttackDamage = 6f },
        [ItemId.SwordDiamond] = new ItemDef { Id = ItemId.SwordDiamond, Name = "Almaznyi Mech", Category = ItemCategory.Weapon, Value = 50, TextureIndex = 17, AttackDamage = 8f },
        [ItemId.SwordDragonslayer] = new ItemDef { Id = ItemId.SwordDragonslayer, Name = "Mech Drakonoborets", Category = ItemCategory.Weapon, Value = 160, TextureIndex = 27, AttackDamage = 25f },

        // Cases
        [ItemId.CaseBomzh] = new ItemDef { Id = ItemId.CaseBomzh, Name = "Bomzh-Keis", Category = ItemCategory.Case, Value = 0, TextureIndex = 2, AttackDamage = 1f },
        [ItemId.CaseDiamond] = new ItemDef { Id = ItemId.CaseDiamond, Name = "Almaznyi Keis", Category = ItemCategory.Case, Value = 0, TextureIndex = 17, AttackDamage = 1f },
        [ItemId.CaseNether] = new ItemDef { Id = ItemId.CaseNether, Name = "Nezer-Keis", Category = ItemCategory.Case, Value = 0, TextureIndex = 10, AttackDamage = 1f },
        [ItemId.CaseDragon] = new ItemDef { Id = ItemId.CaseDragon, Name = "Keis Drakona", Category = ItemCategory.Case, Value = 0, TextureIndex = 34, AttackDamage = 1f },

        // Trash
        [ItemId.TrashSock] = new ItemDef { Id = ItemId.TrashSock, Name = "Diryavyi Nosok", Category = ItemCategory.Trash, Value = 1, TextureIndex = 3, AttackDamage = 1f },
        [ItemId.TrashZhiguli] = new ItemDef { Id = ItemId.TrashZhiguli, Name = "Banka Zhyhulia", Category = ItemCategory.Trash, Value = 5, TextureIndex = 16, AttackDamage = 1f },
        [ItemId.TrashCig] = new ItemDef { Id = ItemId.TrashCig, Name = "Okurok Prymy", Category = ItemCategory.Trash, Value = 1, TextureIndex = 4, AttackDamage = 1f },
        [ItemId.TrashNut] = new ItemDef { Id = ItemId.TrashNut, Name = "Irzhava Haika", Category = ItemCategory.Trash, Value = 2, TextureIndex = 14, AttackDamage = 1f },

        // Boss
        [ItemId.DragonEgg] = new ItemDef { Id = ItemId.DragonEgg, Name = "Yaitse Yeblan Drakona", Category = ItemCategory.Misc, Value = 1000, TextureIndex = 34, AttackDamage = 1f },
        [ItemId.EyeOfEbland] = new ItemDef { Id = ItemId.EyeOfEbland, Name = "Oko Eblanda", Category = ItemCategory.Misc, Value = 100, TextureIndex = 19, AttackDamage = 1f },
    };

    public static ItemDef Get(ItemId id)
    {
        if (id >= ItemId.BlockStart && (int)id <= (int)ItemId.BlockEnd)
        {
            var bdef = Blocks.GetDef((BlockType)id);
            return new ItemDef
            {
                Id = id,
                Name = bdef.Name,
                Category = ItemCategory.Block,
                BlockType = (BlockType)id,
                Value = 0,
                TextureIndex = bdef.TexSide,
                MiningSpeed = 1f,
                AttackDamage = 1f
            };
        }

        if (SpecialItems.TryGetValue(id, out var sdef))
        {
            return sdef;
        }

        return new ItemDef { Id = ItemId.None, Name = "Pusto", Category = ItemCategory.Misc, TextureIndex = -1 };
    }

    public static float GetMiningSpeed(ItemId id) => Get(id).MiningSpeed;
    public static float GetDamage(ItemId id) => Get(id).AttackDamage;
}

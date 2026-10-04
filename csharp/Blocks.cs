using System;
using Raylib_cs;

namespace Eblankraft;

public enum BlockType : byte
{
    Air = 0,
    Grass,
    Dirt,
    Stone,
    Bedrock,
    Wood,
    Leaves,
    Sand,
    Water,
    Netherrack,
    Lava,
    Endstone,
    Obsidian,
    CoalOre,
    IronOre,
    GoldOre,
    DiamondOre,
    Netherite,
    Popcat,
    TNT,
    CraftingTable,
    Glowstone,
    Glass,
    Bricks,
    Eblan,
    Cobblestone,
    Planks,
    Bookshelf,
    SoulSand,
    NetherBricks,
    NetherQuartz,
    DragonEgg,
    Count
}

public sealed class BlockDef
{
    public required string Name { get; init; }
    public byte TexTop { get; init; }
    public byte TexBottom { get; init; }
    public byte TexSide { get; init; }
    public bool IsTransparent { get; init; }
    public bool IsSolid { get; init; }
    public float Hardness { get; init; }
    public Color MapColor { get; init; }
}

public static class Blocks
{
    private static readonly BlockDef[] Defs = new BlockDef[(int)BlockType.Count];

    static Blocks()
    {
        Defs[(int)BlockType.Air] = new BlockDef { Name = "Povitrya", TexTop = 0, TexBottom = 0, TexSide = 0, IsTransparent = true, IsSolid = false, Hardness = 0.0f, MapColor = Color.Blank };
        Defs[(int)BlockType.Grass] = new BlockDef { Name = "Trava", TexTop = 0, TexBottom = 2, TexSide = 1, IsTransparent = false, IsSolid = true, Hardness = 0.5f, MapColor = new Color(85, 170, 85, 255) };
        Defs[(int)BlockType.Dirt] = new BlockDef { Name = "Zemlya", TexTop = 2, TexBottom = 2, TexSide = 2, IsTransparent = false, IsSolid = true, Hardness = 0.5f, MapColor = new Color(134, 96, 67, 255) };
        Defs[(int)BlockType.Stone] = new BlockDef { Name = "Kamin", TexTop = 3, TexBottom = 3, TexSide = 3, IsTransparent = false, IsSolid = true, Hardness = 1.5f, MapColor = new Color(128, 128, 128, 255) };
        Defs[(int)BlockType.Bedrock] = new BlockDef { Name = "Bedrok", TexTop = 4, TexBottom = 4, TexSide = 4, IsTransparent = false, IsSolid = true, Hardness = -1.0f, MapColor = new Color(32, 32, 32, 255) };
        Defs[(int)BlockType.Wood] = new BlockDef { Name = "Dub", TexTop = 6, TexBottom = 6, TexSide = 5, IsTransparent = false, IsSolid = true, Hardness = 1.0f, MapColor = new Color(103, 82, 49, 255) };
        Defs[(int)BlockType.Leaves] = new BlockDef { Name = "Listya", TexTop = 7, TexBottom = 7, TexSide = 7, IsTransparent = true, IsSolid = true, Hardness = 0.2f, MapColor = new Color(60, 140, 60, 255) };
        Defs[(int)BlockType.Sand] = new BlockDef { Name = "Pisok", TexTop = 8, TexBottom = 8, TexSide = 8, IsTransparent = false, IsSolid = true, Hardness = 0.5f, MapColor = new Color(218, 206, 147, 255) };
        Defs[(int)BlockType.Water] = new BlockDef { Name = "Voda", TexTop = 9, TexBottom = 9, TexSide = 9, IsTransparent = true, IsSolid = false, Hardness = 100.0f, MapColor = new Color(64, 96, 255, 255) };
        Defs[(int)BlockType.Netherrack] = new BlockDef { Name = "Nezerak", TexTop = 10, TexBottom = 10, TexSide = 10, IsTransparent = false, IsSolid = true, Hardness = 0.4f, MapColor = new Color(120, 30, 30, 255) };
        Defs[(int)BlockType.Lava] = new BlockDef { Name = "Lava", TexTop = 11, TexBottom = 11, TexSide = 11, IsTransparent = false, IsSolid = false, Hardness = 100.0f, MapColor = new Color(255, 100, 0, 255) };
        Defs[(int)BlockType.Endstone] = new BlockDef { Name = "End-Kamin", TexTop = 12, TexBottom = 12, TexSide = 12, IsTransparent = false, IsSolid = true, Hardness = 2.0f, MapColor = new Color(225, 230, 160, 255) };
        Defs[(int)BlockType.Obsidian] = new BlockDef { Name = "Obsidian", TexTop = 13, TexBottom = 13, TexSide = 13, IsTransparent = false, IsSolid = true, Hardness = 5.0f, MapColor = new Color(25, 15, 45, 255) };
        Defs[(int)BlockType.CoalOre] = new BlockDef { Name = "Vuhilna Ruda", TexTop = 14, TexBottom = 14, TexSide = 14, IsTransparent = false, IsSolid = true, Hardness = 2.0f, MapColor = new Color(50, 50, 50, 255) };
        Defs[(int)BlockType.IronOre] = new BlockDef { Name = "Zalizna Ruda", TexTop = 15, TexBottom = 15, TexSide = 15, IsTransparent = false, IsSolid = true, Hardness = 2.5f, MapColor = new Color(180, 150, 130, 255) };
        Defs[(int)BlockType.GoldOre] = new BlockDef { Name = "Zolota Ruda", TexTop = 16, TexBottom = 16, TexSide = 16, IsTransparent = false, IsSolid = true, Hardness = 2.5f, MapColor = new Color(255, 215, 0, 255) };
        Defs[(int)BlockType.DiamondOre] = new BlockDef { Name = "Almazna Ruda", TexTop = 17, TexBottom = 17, TexSide = 17, IsTransparent = false, IsSolid = true, Hardness = 3.0f, MapColor = new Color(90, 230, 240, 255) };
        Defs[(int)BlockType.Netherite] = new BlockDef { Name = "Blok Nezeritu", TexTop = 18, TexBottom = 18, TexSide = 18, IsTransparent = false, IsSolid = true, Hardness = 4.0f, MapColor = new Color(65, 55, 60, 255) };
        Defs[(int)BlockType.Popcat] = new BlockDef { Name = "Pop-Kot Blok", TexTop = 19, TexBottom = 19, TexSide = 19, IsTransparent = false, IsSolid = true, Hardness = 0.5f, MapColor = new Color(255, 180, 150, 255) };
        Defs[(int)BlockType.TNT] = new BlockDef { Name = "TNT", TexTop = 20, TexBottom = 20, TexSide = 21, IsTransparent = false, IsSolid = true, Hardness = 0.1f, MapColor = new Color(220, 40, 40, 255) };
        Defs[(int)BlockType.CraftingTable] = new BlockDef { Name = "Verstak", TexTop = 22, TexBottom = 29, TexSide = 23, IsTransparent = false, IsSolid = true, Hardness = 1.0f, MapColor = new Color(140, 100, 60, 255) };
        Defs[(int)BlockType.Glowstone] = new BlockDef { Name = "Svitlokamin", TexTop = 24, TexBottom = 24, TexSide = 24, IsTransparent = false, IsSolid = true, Hardness = 0.3f, MapColor = new Color(245, 210, 110, 255) };
        Defs[(int)BlockType.Glass] = new BlockDef { Name = "Sklo", TexTop = 25, TexBottom = 25, TexSide = 25, IsTransparent = true, IsSolid = true, Hardness = 0.2f, MapColor = new Color(220, 240, 255, 255) };
        Defs[(int)BlockType.Bricks] = new BlockDef { Name = "Tsegla", TexTop = 26, TexBottom = 26, TexSide = 26, IsTransparent = false, IsSolid = true, Hardness = 2.0f, MapColor = new Color(155, 75, 65, 255) };
        Defs[(int)BlockType.Eblan] = new BlockDef { Name = "Eblan-Blok", TexTop = 27, TexBottom = 27, TexSide = 27, IsTransparent = false, IsSolid = true, Hardness = 0.8f, MapColor = new Color(255, 220, 100, 255) };
        Defs[(int)BlockType.Cobblestone] = new BlockDef { Name = "Bulyzhnyk", TexTop = 28, TexBottom = 28, TexSide = 28, IsTransparent = false, IsSolid = true, Hardness = 1.8f, MapColor = new Color(110, 110, 110, 255) };
        Defs[(int)BlockType.Planks] = new BlockDef { Name = "Doshky", TexTop = 29, TexBottom = 29, TexSide = 29, IsTransparent = false, IsSolid = true, Hardness = 1.0f, MapColor = new Color(160, 120, 70, 255) };
        Defs[(int)BlockType.Bookshelf] = new BlockDef { Name = "Knyzhkova Politsya", TexTop = 29, TexBottom = 29, TexSide = 30, IsTransparent = false, IsSolid = true, Hardness = 1.0f, MapColor = new Color(140, 90, 50, 255) };
        Defs[(int)BlockType.SoulSand] = new BlockDef { Name = "Pisok Dush", TexTop = 31, TexBottom = 31, TexSide = 31, IsTransparent = false, IsSolid = true, Hardness = 0.6f, MapColor = new Color(85, 60, 45, 255) };
        Defs[(int)BlockType.NetherBricks] = new BlockDef { Name = "Adska Tsegla", TexTop = 32, TexBottom = 32, TexSide = 32, IsTransparent = false, IsSolid = true, Hardness = 2.0f, MapColor = new Color(45, 20, 25, 255) };
        Defs[(int)BlockType.NetherQuartz] = new BlockDef { Name = "Kvartsova Ruda", TexTop = 33, TexBottom = 33, TexSide = 33, IsTransparent = false, IsSolid = true, Hardness = 1.5f, MapColor = new Color(160, 50, 50, 255) };
        Defs[(int)BlockType.DragonEgg] = new BlockDef { Name = "Yaitse Yeblan Drakona", TexTop = 34, TexBottom = 34, TexSide = 34, IsTransparent = false, IsSolid = true, Hardness = 3.5f, MapColor = new Color(30, 10, 40, 255) };
    }

    public static BlockDef GetDef(BlockType type) => Defs[(int)type] ?? Defs[0];
    public static bool IsSolid(BlockType type) => GetDef(type).IsSolid;
    public static bool IsTransparent(BlockType type) => GetDef(type).IsTransparent;
}

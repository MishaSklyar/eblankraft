using System;
using System.IO;
using System.Reflection;
using Raylib_cs;

namespace Eblankraft;

public static class Textures
{
    public const int AtlasSize = 256;
    public const int TileSize = 16;
    public const int TilesPerRow = AtlasSize / TileSize; // 16
    private const float Step = (float)TileSize / (float)AtlasSize;

    public static Texture2D Atlas { get; private set; }

    public static void Init()
    {
        string atlasPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "atlas.png");
        if (!File.Exists(atlasPath))
        {
            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream("eblankraft.atlas.png")
                ?? (File.Exists("atlas.png") ? File.OpenRead("atlas.png") : null);

            if (stream != null)
            {
                using var fs = File.Create(atlasPath);
                stream.CopyTo(fs);
            }
        }

        Image img;
        if (File.Exists(atlasPath))
        {
            img = Raylib.LoadImage(atlasPath);
        }
        else if (File.Exists("atlas.png"))
        {
            img = Raylib.LoadImage("atlas.png");
        }
        else
        {
            img = Raylib.GenImageColor(AtlasSize, AtlasSize, Color.Magenta);
        }

        Atlas = Raylib.LoadTextureFromImage(img);
        Raylib.UnloadImage(img);

        Raylib.SetTextureFilter(Atlas, TextureFilter.Point);
        Raylib.SetTextureWrap(Atlas, TextureWrap.Repeat);
    }

    public static void Bind()
    {
        Rlgl.SetTexture(Atlas.Id);
    }

    public static (float u0, float v0, float u1, float v1) GetUV(int tileIndex)
    {
        int tx = tileIndex % TilesPerRow;
        int ty = tileIndex / TilesPerRow;
        float u0 = tx * Step;
        float v0 = ty * Step;
        float u1 = u0 + Step;
        float v1 = v0 + Step;
        return (u0, v0, u1, v1);
    }

    public static void GetUV(byte tileIndex, out float u0, out float v0, out float u1, out float v1)
    {
        var uv = GetUV((int)tileIndex);
        u0 = uv.u0;
        v0 = uv.v0;
        u1 = uv.u1;
        v1 = uv.v1;
    }

    public static void Close()
    {
        if (Atlas.Id != 0)
        {
            Raylib.UnloadTexture(Atlas);
        }
    }
}

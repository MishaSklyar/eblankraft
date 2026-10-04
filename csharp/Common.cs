using System;
using System.Numerics;
using Raylib_cs;

namespace Eblankraft;

public enum DimensionType
{
    Overworld = 0,
    Nether = 1,
    TheEnd = 2
}

public enum BlockFace
{
    Top = 0,
    Bottom = 1,
    North = 2,
    South = 3,
    East = 4,
    West = 5
}

public readonly record struct BlockPos(int X, int Y, int Z)
{
    public static readonly BlockPos Zero = new(0, 0, 0);
}

public static class Common
{
    public const int WindowWidth = 1280;
    public const int WindowHeight = 720;

    public const int VirtualWidth = 640;
    public const int VirtualHeight = 480;

    public const float DegToRad = MathF.PI / 180.0f;
    public const float RadToDeg = 180.0f / MathF.PI;

    public static float Clamp(float v, float min, float max) => Math.Clamp(v, min, max);

    // Fast 2D Value Noise with cosine interpolation for terrain heightmaps
    public static float Noise2D(float x, float z)
    {
        int xi = (int)MathF.Floor(x);
        int zi = (int)MathF.Floor(z);
        float xf = x - xi;
        float zf = z - zi;

        float u = xf * xf * (3.0f - 2.0f * xf);
        float v = zf * zf * (3.0f - 2.0f * zf);

        float n00 = Hash2D(xi, zi);
        float n10 = Hash2D(xi + 1, zi);
        float n01 = Hash2D(xi, zi + 1);
        float n11 = Hash2D(xi + 1, zi + 1);

        float nx0 = n00 * (1.0f - u) + n10 * u;
        float nx1 = n01 * (1.0f - u) + n11 * u;

        return nx0 * (1.0f - v) + nx1 * v;
    }

    private static float Hash2D(int x, int z)
    {
        int n = x * 374761393 + z * 668265263;
        n = (n ^ (n >> 13)) * 1274126177;
        return (float)((n & 0x7fffffff) % 10000) / 10000.0f;
    }
}

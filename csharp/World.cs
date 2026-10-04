using System;
using System.Numerics;
using Raylib_cs;

namespace Eblankraft;

public struct RaycastHit
{
    public bool Hit;
    public BlockPos BlockPos;
    public BlockFace Face;
    public float Distance;
}

public class Chunk
{
    public const int SizeX = 16;
    public const int SizeZ = 16;
    public const int SizeY = 64;

    public readonly int ChunkX;
    public readonly int ChunkZ;
    public readonly byte[] Blocks = new byte[SizeX * SizeY * SizeZ];
    public bool IsDirty = true;

    public Chunk(int cx, int cz)
    {
        ChunkX = cx;
        ChunkZ = cz;
    }

    public byte GetBlock(int x, int y, int z)
    {
        if (x < 0 || x >= SizeX || y < 0 || y >= SizeY || z < 0 || z >= SizeZ) return 0;
        return Blocks[x + (z * SizeX) + (y * SizeX * SizeZ)];
    }

    public void SetBlock(int x, int y, int z, byte block)
    {
        if (x < 0 || x >= SizeX || y < 0 || y >= SizeY || z < 0 || z >= SizeZ) return;
        Blocks[x + (z * SizeX) + (y * SizeX * SizeZ)] = block;
        IsDirty = true;
    }
}

public class World
{
    public const int ChunksAcross = 5;
    public const int WorldSizeBlocksX = ChunksAcross * Chunk.SizeX;
    public const int WorldSizeBlocksZ = ChunksAcross * Chunk.SizeZ;

    public DimensionType CurrentDimension { get; private set; } = DimensionType.Overworld;
    private readonly Chunk[,] m_chunks = new Chunk[ChunksAcross, ChunksAcross];

    public World()
    {
        for (int x = 0; x < ChunksAcross; x++)
        {
            for (int z = 0; z < ChunksAcross; z++)
            {
                m_chunks[x, z] = new Chunk(x, z);
            }
        }
        Generate(DimensionType.Overworld);
    }

    public byte GetBlock(int bx, int by, int bz)
    {
        if (by < 0 || by >= Chunk.SizeY) return 0;
        int cx = bx / Chunk.SizeX;
        int cz = bz / Chunk.SizeZ;
        if (cx < 0 || cx >= ChunksAcross || cz < 0 || cz >= ChunksAcross) return 0;

        int lx = bx % Chunk.SizeX;
        int lz = bz % Chunk.SizeZ;
        return m_chunks[cx, cz].GetBlock(lx, by, lz);
    }

    public void SetBlock(int bx, int by, int bz, byte id)
    {
        if (by < 0 || by >= Chunk.SizeY) return;
        int cx = bx / Chunk.SizeX;
        int cz = bz / Chunk.SizeZ;
        if (cx < 0 || cx >= ChunksAcross || cz < 0 || cz >= ChunksAcross) return;

        int lx = bx % Chunk.SizeX;
        int lz = bz % Chunk.SizeZ;
        m_chunks[cx, cz].SetBlock(lx, by, lz, id);

        if (lx == 0 && cx > 0) m_chunks[cx - 1, cz].IsDirty = true;
        if (lx == Chunk.SizeX - 1 && cx < ChunksAcross - 1) m_chunks[cx + 1, cz].IsDirty = true;
        if (lz == 0 && cz > 0) m_chunks[cx, cz - 1].IsDirty = true;
        if (lz == Chunk.SizeZ - 1 && cz < ChunksAcross - 1) m_chunks[cx, cz + 1].IsDirty = true;
    }

    public void Generate(DimensionType dim)
    {
        CurrentDimension = dim;
        for (int cx = 0; cx < ChunksAcross; cx++)
        {
            for (int cz = 0; cz < ChunksAcross; cz++)
            {
                Array.Clear(m_chunks[cx, cz].Blocks, 0, m_chunks[cx, cz].Blocks.Length);
                m_chunks[cx, cz].IsDirty = true;
            }
        }

        if (dim == DimensionType.Overworld) GenerateOverworld();
        else if (dim == DimensionType.Nether) GenerateNether();
        else if (dim == DimensionType.TheEnd) GenerateTheEnd();
    }

    private void GenerateOverworld()
    {
        Random rng = new Random(1337);
        for (int x = 0; x < WorldSizeBlocksX; x++)
        {
            for (int z = 0; z < WorldSizeBlocksZ; z++)
            {
                SetBlock(x, 0, z, (byte)BlockType.Bedrock);

                float n = Common.Noise2D(x * 0.05f, z * 0.05f) * 12f;
                int height = 24 + (int)n;
                if (height < 2) height = 2;
                if (height >= Chunk.SizeY - 10) height = Chunk.SizeY - 11;

                for (int y = 1; y < height - 3; y++)
                {
                    float oreN = (float)rng.NextDouble();
                    if (y < 12 && oreN < 0.02f) SetBlock(x, y, z, (byte)BlockType.DiamondOre);
                    else if (y < 20 && oreN < 0.05f) SetBlock(x, y, z, (byte)BlockType.GoldOre);
                    else if (oreN < 0.09f) SetBlock(x, y, z, (byte)BlockType.IronOre);
                    else if (oreN < 0.14f) SetBlock(x, y, z, (byte)BlockType.CoalOre);
                    else SetBlock(x, y, z, (byte)BlockType.Stone);
                }

                for (int y = height - 3; y < height; y++)
                {
                    SetBlock(x, y, z, (byte)BlockType.Dirt);
                }
                SetBlock(x, height, z, (byte)BlockType.Grass);

                for (int y = height + 1; y <= 20; y++)
                {
                    SetBlock(x, y, z, (byte)BlockType.Water);
                }

                if (height > 21 && x > 4 && x < WorldSizeBlocksX - 5 && z > 4 && z < WorldSizeBlocksZ - 5)
                {
                    if (rng.Next(100) < 2)
                    {
                        PlantTree(x, height + 1, z);
                    }
                }
            }
        }
    }

    private void PlantTree(int tx, int ty, int tz)
    {
        int trunkHeight = 4;
        for (int y = 0; y < trunkHeight; y++)
        {
            SetBlock(tx, ty + y, tz, (byte)BlockType.Wood);
        }

        int top = ty + trunkHeight;
        for (int dx = -2; dx <= 2; dx++)
        {
            for (int dz = -2; dz <= 2; dz++)
            {
                for (int dy = -1; dy <= 1; dy++)
                {
                    if (Math.Abs(dx) == 2 && Math.Abs(dz) == 2 && dy == 1) continue;
                    if (GetBlock(tx + dx, top + dy, tz + dz) == 0)
                    {
                        SetBlock(tx + dx, top + dy, tz + dz, (byte)BlockType.Leaves);
                    }
                }
            }
        }
        SetBlock(tx, top + 2, tz, (byte)BlockType.Leaves);
    }

    private void GenerateNether()
    {
        Random rng = new Random(666);
        for (int x = 0; x < WorldSizeBlocksX; x++)
        {
            for (int z = 0; z < WorldSizeBlocksZ; z++)
            {
                SetBlock(x, 0, z, (byte)BlockType.Bedrock);
                SetBlock(x, Chunk.SizeY - 1, z, (byte)BlockType.Bedrock);

                float floorN = Common.Noise2D(x * 0.06f, z * 0.06f) * 10f;
                int floorH = 14 + (int)floorN;

                for (int y = 1; y <= floorH; y++)
                {
                    if (rng.Next(100) < 6) SetBlock(x, y, z, (byte)BlockType.NetherQuartz);
                    else if (rng.Next(100) < 3) SetBlock(x, y, z, (byte)BlockType.SoulSand);
                    else SetBlock(x, y, z, (byte)BlockType.Netherrack);
                }

                for (int y = floorH + 1; y <= 16; y++)
                {
                    SetBlock(x, y, z, (byte)BlockType.Lava);
                }

                float ceilN = Common.Noise2D(x * 0.06f + 50f, z * 0.06f + 50f) * 10f;
                int ceilH = Chunk.SizeY - 2 - (int)ceilN;
                for (int y = ceilH; y < Chunk.SizeY - 1; y++)
                {
                    if (rng.Next(100) < 12) SetBlock(x, y, z, (byte)BlockType.Glowstone);
                    else SetBlock(x, y, z, (byte)BlockType.Netherrack);
                }
            }
        }
    }

    private void GenerateTheEnd()
    {
        int centerX = WorldSizeBlocksX / 2;
        int centerZ = WorldSizeBlocksZ / 2;
        float islandRadius = 26f;

        for (int x = 0; x < WorldSizeBlocksX; x++)
        {
            for (int z = 0; z < WorldSizeBlocksZ; z++)
            {
                float dist = MathF.Sqrt((x - centerX) * (x - centerX) + (z - centerZ) * (z - centerZ));
                if (dist < islandRadius)
                {
                    float profile = MathF.Cos((dist / islandRadius) * (MathF.PI * 0.5f));
                    int top = 28 + (int)(profile * 5f);
                    int bottom = 28 - (int)(profile * 8f);

                    for (int y = bottom; y <= top; y++)
                    {
                        SetBlock(x, y, z, (byte)BlockType.Endstone);
                    }
                }
            }
        }

        int[] pillarAngles = { 0, 60, 120, 180, 240, 300 };
        float pillarDist = 18f;
        foreach (int angle in pillarAngles)
        {
            float rad = angle * MathF.PI / 180f;
            int px = centerX + (int)(MathF.Cos(rad) * pillarDist);
            int pz = centerZ + (int)(MathF.Sin(rad) * pillarDist);
            int ph = 14 + (angle % 7);

            for (int dx = -1; dx <= 1; dx++)
            {
                for (int dz = -1; dz <= 1; dz++)
                {
                    for (int y = 28; y <= 28 + ph; y++)
                    {
                        SetBlock(px + dx, y, pz + dz, (byte)BlockType.Obsidian);
                    }
                }
            }
        }
    }

    public RaycastHit Raycast(Vector3 origin, Vector3 direction, float maxDist = 6f)
    {
        RaycastHit result = new RaycastHit { Hit = false };
        float step = 0.05f;
        Vector3 prev = origin;

        for (float d = 0; d < maxDist; d += step)
        {
            Vector3 cur = origin + direction * d;
            int bx = (int)MathF.Floor(cur.X);
            int by = (int)MathF.Floor(cur.Y);
            int bz = (int)MathF.Floor(cur.Z);

            byte b = GetBlock(bx, by, bz);
            if (b != 0 && b != (byte)BlockType.Water && b != (byte)BlockType.Lava)
            {
                result.Hit = true;
                result.BlockPos = new BlockPos(bx, by, bz);
                result.Distance = d;

                int px = (int)MathF.Floor(prev.X);
                int py = (int)MathF.Floor(prev.Y);
                int pz = (int)MathF.Floor(prev.Z);

                if (px < bx) result.Face = BlockFace.West;
                else if (px > bx) result.Face = BlockFace.East;
                else if (py < by) result.Face = BlockFace.Bottom;
                else if (py > by) result.Face = BlockFace.Top;
                else if (pz < bz) result.Face = BlockFace.North;
                else if (pz > bz) result.Face = BlockFace.South;
                else result.Face = BlockFace.Top;

                return result;
            }
            prev = cur;
        }

        return result;
    }

    public void Render(Vector3 cameraPos, float renderDistance = 48f)
    {
        Textures.Bind();
        Rlgl.Begin(DrawMode.Triangles);
        Rlgl.Color4ub(255, 255, 255, 255);

        int minCx = Math.Max(0, (int)((cameraPos.X - renderDistance) / Chunk.SizeX));
        int maxCx = Math.Min(ChunksAcross - 1, (int)((cameraPos.X + renderDistance) / Chunk.SizeX));
        int minCz = Math.Max(0, (int)((cameraPos.Z - renderDistance) / Chunk.SizeZ));
        int maxCz = Math.Min(ChunksAcross - 1, (int)((cameraPos.Z + renderDistance) / Chunk.SizeZ));

        for (int cx = minCx; cx <= maxCx; cx++)
        {
            for (int cz = minCz; cz <= maxCz; cz++)
            {
                RenderChunk(cx, cz);
            }
        }

        Rlgl.End();
    }

    private void RenderChunk(int cx, int cz)
    {
        Chunk chunk = m_chunks[cx, cz];
        int baseX = cx * Chunk.SizeX;
        int baseZ = cz * Chunk.SizeZ;

        for (int x = 0; x < Chunk.SizeX; x++)
        {
            int worldX = baseX + x;
            for (int z = 0; z < Chunk.SizeZ; z++)
            {
                int worldZ = baseZ + z;
                for (int y = 0; y < Chunk.SizeY; y++)
                {
                    byte b = chunk.GetBlock(x, y, z);
                    if (b == 0) continue;

                    BlockDef def = Blocks.GetDef((BlockType)b);

                    // Top face (+Y)
                    if (y == Chunk.SizeY - 1 || Blocks.IsTransparent((BlockType)GetBlock(worldX, y + 1, worldZ)))
                    {
                        RenderFace(worldX, y, worldZ, BlockFace.Top, def.TexTop, 255);
                    }
                    // Bottom face (-Y)
                    if (y > 0 && Blocks.IsTransparent((BlockType)GetBlock(worldX, y - 1, worldZ)))
                    {
                        RenderFace(worldX, y, worldZ, BlockFace.Bottom, def.TexBottom, 140);
                    }
                    // North face (-Z)
                    if (Blocks.IsTransparent((BlockType)GetBlock(worldX, y, worldZ - 1)))
                    {
                        RenderFace(worldX, y, worldZ, BlockFace.North, def.TexSide, 200);
                    }
                    // South face (+Z)
                    if (Blocks.IsTransparent((BlockType)GetBlock(worldX, y, worldZ + 1)))
                    {
                        RenderFace(worldX, y, worldZ, BlockFace.South, def.TexSide, 200);
                    }
                    // West face (-X)
                    if (Blocks.IsTransparent((BlockType)GetBlock(worldX - 1, y, worldZ)))
                    {
                        RenderFace(worldX, y, worldZ, BlockFace.West, def.TexSide, 175);
                    }
                    // East face (+X)
                    if (Blocks.IsTransparent((BlockType)GetBlock(worldX + 1, y, worldZ)))
                    {
                        RenderFace(worldX, y, worldZ, BlockFace.East, def.TexSide, 175);
                    }
                }
            }
        }
    }

    private static void RenderFace(int x, int y, int z, BlockFace face, int texIdx, byte light)
    {
        Rlgl.Color4ub(light, light, light, 255);
        var (u0, v0, u1, v1) = Textures.GetUV(texIdx);

        float x0 = x, x1 = x + 1;
        float y0 = y, y1 = y + 1;
        float z0 = z, z1 = z + 1;

        switch (face)
        {
            case BlockFace.Top:
                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x0, y1, z0);
                Rlgl.TexCoord2f(u0, v1); Rlgl.Vertex3f(x0, y1, z1);
                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x1, y1, z1);

                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x0, y1, z0);
                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x1, y1, z1);
                Rlgl.TexCoord2f(u1, v0); Rlgl.Vertex3f(x1, y1, z0);
                break;

            case BlockFace.Bottom:
                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x0, y0, z1);
                Rlgl.TexCoord2f(u0, v1); Rlgl.Vertex3f(x0, y0, z0);
                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x1, y0, z0);

                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x0, y0, z1);
                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x1, y0, z0);
                Rlgl.TexCoord2f(u1, v0); Rlgl.Vertex3f(x1, y0, z1);
                break;

            case BlockFace.North: // -Z
                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x0, y0, z0);
                Rlgl.TexCoord2f(u1, v0); Rlgl.Vertex3f(x0, y1, z0);
                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x1, y1, z0);

                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x0, y0, z0);
                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x1, y1, z0);
                Rlgl.TexCoord2f(u0, v1); Rlgl.Vertex3f(x1, y0, z0);
                break;

            case BlockFace.South: // +Z
                Rlgl.TexCoord2f(u0, v1); Rlgl.Vertex3f(x0, y0, z1);
                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x1, y0, z1);
                Rlgl.TexCoord2f(u1, v0); Rlgl.Vertex3f(x1, y1, z1);

                Rlgl.TexCoord2f(u0, v1); Rlgl.Vertex3f(x0, y0, z1);
                Rlgl.TexCoord2f(u1, v0); Rlgl.Vertex3f(x1, y1, z1);
                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x0, y1, z1);
                break;

            case BlockFace.West: // -X
                Rlgl.TexCoord2f(u0, v1); Rlgl.Vertex3f(x0, y0, z0);
                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x0, y0, z1);
                Rlgl.TexCoord2f(u1, v0); Rlgl.Vertex3f(x0, y1, z1);

                Rlgl.TexCoord2f(u0, v1); Rlgl.Vertex3f(x0, y0, z0);
                Rlgl.TexCoord2f(u1, v0); Rlgl.Vertex3f(x0, y1, z1);
                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x0, y1, z0);
                break;

            case BlockFace.East: // +X
                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x1, y0, z0);
                Rlgl.TexCoord2f(u1, v0); Rlgl.Vertex3f(x1, y1, z0);
                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x1, y1, z1);

                Rlgl.TexCoord2f(u1, v1); Rlgl.Vertex3f(x1, y0, z0);
                Rlgl.TexCoord2f(u0, v0); Rlgl.Vertex3f(x1, y1, z1);
                Rlgl.TexCoord2f(u0, v1); Rlgl.Vertex3f(x1, y0, z1);
                break;
        }
    }
}

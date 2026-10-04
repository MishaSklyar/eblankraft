using System;
using System.Collections.Generic;
using System.Numerics;
using Raylib_cs;

namespace Eblankraft;

public enum MobKind
{
    Zombie,
    Creeper,
    Piglin,
    Enderman,
    EndCrystal
}

public class Mob
{
    public MobKind Kind;
    public Vector3 Position;
    public Vector3 Velocity;
    public float Yaw;
    public float Health;
    public float MaxHealth;
    public float AnimTime;
    public float HurtTime;
    public bool IsDead;

    public Mob(MobKind kind, Vector3 pos)
    {
        Kind = kind;
        Position = pos;
        AnimTime = 0f;
        HurtTime = 0f;
        IsDead = false;

        switch (kind)
        {
            case MobKind.Zombie: MaxHealth = 20f; break;
            case MobKind.Creeper: MaxHealth = 20f; break;
            case MobKind.Piglin: MaxHealth = 16f; break;
            case MobKind.Enderman: MaxHealth = 40f; break;
            case MobKind.EndCrystal: MaxHealth = 1f; break;
        }
        Health = MaxHealth;
    }

    public void Update(World world, Player player, float dt)
    {
        if (IsDead) return;
        AnimTime += dt * 4f;
        if (HurtTime > 0f) HurtTime -= dt;

        if (Kind == MobKind.EndCrystal) return;

        Vector3 diff = player.Position - Position;
        float dist = diff.Length();

        if (dist < 14f && dist > 1.2f)
        {
            Yaw = MathF.Atan2(diff.X, diff.Z);
            float speed = (Kind == MobKind.Enderman) ? 3.5f : 2.0f;
            Velocity.X = MathF.Sin(Yaw) * speed;
            Velocity.Z = MathF.Cos(Yaw) * speed;

            int checkX = (int)MathF.Floor(Position.X + Velocity.X * dt * 2f);
            int checkY = (int)MathF.Floor(Position.Y);
            int checkZ = (int)MathF.Floor(Position.Z + Velocity.Z * dt * 2f);
            if (Blocks.IsSolid((BlockType)world.GetBlock(checkX, checkY, checkZ)))
            {
                Velocity.Y = 5.0f;
            }
        }
        else
        {
            Velocity.X *= 0.8f;
            Velocity.Z *= 0.8f;
        }

        Velocity.Y -= 20f * dt;
        Position.Y += Velocity.Y * dt;

        int bx = (int)MathF.Floor(Position.X);
        int by = (int)MathF.Floor(Position.Y);
        int bz = (int)MathF.Floor(Position.Z);

        if (Blocks.IsSolid((BlockType)world.GetBlock(bx, by, bz)))
        {
            Position.Y = by + 1f;
            Velocity.Y = 0;
        }

        Position.X += Velocity.X * dt;
        Position.Z += Velocity.Z * dt;

        if (dist < 1.5f && (Kind == MobKind.Zombie || Kind == MobKind.Piglin || Kind == MobKind.Enderman))
        {
            player.Health -= 2f * dt;
            if (Raylib.GetRandomValue(0, 30) == 0) Audio.PlayHurt();
        }
        else if (dist < 2.0f && Kind == MobKind.Creeper)
        {
            Audio.PlayExplosion();
            player.Health -= 10f;
            IsDead = true;
        }
    }

    public void TakeDamage(float amount)
    {
        Health -= amount;
        HurtTime = 0.35f;
        Audio.PlayHurt();
        if (Health <= 0)
        {
            IsDead = true;
            if (Kind == MobKind.EndCrystal) Audio.PlayExplosion();
        }
    }
}

public static class MobRenderer
{
    public static void RenderMobs(List<Mob> mobs)
    {
        // Untextured flat shaded boxes like PSP version
        Rlgl.SetTexture(0);

        foreach (var mob in mobs)
        {
            if (mob.IsDead) continue;
            RenderMob(mob);
        }
    }

    private static void RenderMob(Mob mob)
    {
        Rlgl.PushMatrix();
        Rlgl.Translatef(mob.Position.X, mob.Position.Y, mob.Position.Z);
        Rlgl.Rotatef(mob.Yaw * (180f / MathF.PI), 0, 1, 0);

        float walk = MathF.Sin(mob.AnimTime);
        bool isHurt = mob.HurtTime > 0f;
        Color hurtColor = new Color(245, 45, 45, 255);

        Color C(int r, int g, int b) => isHurt ? hurtColor : new Color(r, g, b, 255);

        switch (mob.Kind)
        {
            case MobKind.Zombie:
                // Head (Green: 79, 168, 70)
                DrawColorBox(new Vector3(0, 1.48f, 0), new Vector3(0.48f, 0.48f, 0.48f), C(79, 168, 70));
                // Torso (Blue Shirt: 31, 120, 180)
                DrawColorBox(new Vector3(0, 0.9f, 0), new Vector3(0.48f, 0.68f, 0.28f), C(31, 120, 180));
                // Outstretched Arms (Green: 79, 168, 70)
                DrawColorBox(new Vector3(-0.35f, 0.9f, 0.25f), new Vector3(0.2f, 0.2f, 0.6f), C(79, 168, 70));
                DrawColorBox(new Vector3(0.35f, 0.9f, 0.25f), new Vector3(0.2f, 0.2f, 0.6f), C(79, 168, 70));
                // Legs (Dark pants: 34, 51, 102)
                DrawColorBox(new Vector3(-0.14f, 0.32f, walk * 0.15f), new Vector3(0.22f, 0.65f, 0.22f), C(34, 51, 102));
                DrawColorBox(new Vector3(0.14f, 0.32f, -walk * 0.15f), new Vector3(0.22f, 0.65f, 0.22f), C(34, 51, 102));
                break;

            case MobKind.Creeper:
                // Head (Green: 60, 176, 67)
                DrawColorBox(new Vector3(0, 1.35f, 0), new Vector3(0.46f, 0.46f, 0.46f), C(60, 176, 67));
                // Torso (Dark green: 46, 139, 87)
                DrawColorBox(new Vector3(0, 0.8f, 0), new Vector3(0.44f, 0.66f, 0.26f), C(46, 139, 87));
                // 4 Legs
                DrawColorBox(new Vector3(-0.14f, 0.22f, 0.12f + walk * 0.1f), new Vector3(0.2f, 0.45f, 0.2f), C(60, 176, 67));
                DrawColorBox(new Vector3(0.14f, 0.22f, 0.12f - walk * 0.1f), new Vector3(0.2f, 0.45f, 0.2f), C(60, 176, 67));
                DrawColorBox(new Vector3(-0.14f, 0.22f, -0.12f - walk * 0.1f), new Vector3(0.2f, 0.45f, 0.2f), C(60, 176, 67));
                DrawColorBox(new Vector3(0.14f, 0.22f, -0.12f + walk * 0.1f), new Vector3(0.2f, 0.45f, 0.2f), C(60, 176, 67));
                break;

            case MobKind.Piglin:
                // Head (Pink: 238, 165, 165)
                DrawColorBox(new Vector3(0, 1.48f, 0), new Vector3(0.55f, 0.48f, 0.5f), C(238, 165, 165));
                // Torso (Brown leather: 138, 75, 35)
                DrawColorBox(new Vector3(0, 0.9f, 0), new Vector3(0.48f, 0.68f, 0.28f), C(138, 75, 35));
                // Golden sword in hand (Gold: 245, 197, 24)
                DrawColorBox(new Vector3(0.35f, 0.8f, 0.25f), new Vector3(0.08f, 0.55f, 0.08f), C(245, 197, 24));
                // Legs (Dark brown: 90, 45, 18)
                DrawColorBox(new Vector3(-0.14f, 0.32f, walk * 0.15f), new Vector3(0.22f, 0.65f, 0.22f), C(90, 45, 18));
                DrawColorBox(new Vector3(0.14f, 0.32f, -walk * 0.15f), new Vector3(0.22f, 0.65f, 0.22f), C(90, 45, 18));
                break;

            case MobKind.Enderman:
                // Head (Black: 17, 17, 17)
                DrawColorBox(new Vector3(0, 2.65f, 0), new Vector3(0.38f, 0.38f, 0.38f), C(17, 17, 17));
                // Purple glowing eyes (218, 34, 255)
                DrawColorBox(new Vector3(0, 2.70f, 0.20f), new Vector3(0.26f, 0.06f, 0.04f), C(218, 34, 255));
                // Torso (10, 10, 10)
                DrawColorBox(new Vector3(0, 2.05f, 0), new Vector3(0.36f, 0.85f, 0.2f), C(10, 10, 10));
                // Long Arms
                DrawColorBox(new Vector3(-0.28f, 1.7f, 0), new Vector3(0.12f, 1.2f, 0.12f), C(10, 10, 10));
                DrawColorBox(new Vector3(0.28f, 1.7f, 0), new Vector3(0.12f, 1.2f, 0.12f), C(10, 10, 10));
                // Long Legs
                DrawColorBox(new Vector3(-0.12f, 0.72f, walk * 0.1f), new Vector3(0.12f, 1.45f, 0.12f), C(10, 10, 10));
                DrawColorBox(new Vector3(0.12f, 0.72f, -walk * 0.1f), new Vector3(0.12f, 1.45f, 0.12f), C(10, 10, 10));
                break;

            case MobKind.EndCrystal:
                Rlgl.PushMatrix();
                Rlgl.Rotatef(mob.AnimTime * 25f, 0, 1, 0);
                Rlgl.Rotatef(mob.AnimTime * 15f, 1, 0, 0);
                DrawColorBox(new Vector3(0, 1.0f, 0), new Vector3(0.7f, 0.7f, 0.7f), C(255, 100, 220));
                Rlgl.PopMatrix();
                break;
        }

        Rlgl.PopMatrix();
    }

    public static void DrawColorBox(Vector3 center, Vector3 size, Color color)
    {
        float hx = size.X * 0.5f;
        float hy = size.Y * 0.5f;
        float hz = size.Z * 0.5f;

        float x0 = center.X - hx, x1 = center.X + hx;
        float y0 = center.Y - hy, y1 = center.Y + hy;
        float z0 = center.Z - hz, z1 = center.Z + hz;

        Rlgl.Begin(DrawMode.Triangles);
        Rlgl.Color4ub(color.R, color.G, color.B, color.A);

        // Front (+Z)
        Rlgl.Vertex3f(x0, y0, z1); Rlgl.Vertex3f(x1, y0, z1); Rlgl.Vertex3f(x1, y1, z1);
        Rlgl.Vertex3f(x0, y0, z1); Rlgl.Vertex3f(x1, y1, z1); Rlgl.Vertex3f(x0, y1, z1);

        // Back (-Z)
        Rlgl.Vertex3f(x1, y0, z0); Rlgl.Vertex3f(x0, y0, z0); Rlgl.Vertex3f(x0, y1, z0);
        Rlgl.Vertex3f(x1, y0, z0); Rlgl.Vertex3f(x0, y1, z0); Rlgl.Vertex3f(x1, y1, z0);

        // Top (+Y)
        Rlgl.Vertex3f(x0, y1, z0); Rlgl.Vertex3f(x0, y1, z1); Rlgl.Vertex3f(x1, y1, z1);
        Rlgl.Vertex3f(x0, y1, z0); Rlgl.Vertex3f(x1, y1, z1); Rlgl.Vertex3f(x1, y1, z0);

        // Bottom (-Y)
        Rlgl.Vertex3f(x0, y0, z1); Rlgl.Vertex3f(x0, y0, z0); Rlgl.Vertex3f(x1, y0, z0);
        Rlgl.Vertex3f(x0, y0, z1); Rlgl.Vertex3f(x1, y0, z0); Rlgl.Vertex3f(x1, y0, z1);

        // Left (-X)
        Rlgl.Vertex3f(x0, y0, z0); Rlgl.Vertex3f(x0, y0, z1); Rlgl.Vertex3f(x0, y1, z1);
        Rlgl.Vertex3f(x0, y0, z0); Rlgl.Vertex3f(x0, y1, z1); Rlgl.Vertex3f(x0, y1, z0);

        // Right (+X)
        Rlgl.Vertex3f(x1, y0, z1); Rlgl.Vertex3f(x1, y0, z0); Rlgl.Vertex3f(x1, y1, z0);
        Rlgl.Vertex3f(x1, y0, z1); Rlgl.Vertex3f(x1, y1, z0); Rlgl.Vertex3f(x1, y1, z1);

        Rlgl.End();
    }
}

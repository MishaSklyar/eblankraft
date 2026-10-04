using System;
using System.Numerics;
using Raylib_cs;

namespace Eblankraft;

public class Dragon
{
    public Vector3 Position;
    public float Yaw;
    public float Pitch;
    public float Health = 200f;
    public float MaxHealth = 200f;
    public float WingAngle;
    public float HurtTime;
    public bool IsDead;

    private float m_circleAngle;
    private float m_circleRadius = 24f;
    private float m_circleY = 38f;

    public Dragon(Vector3 startPos)
    {
        Position = startPos;
    }

    public void Update(Player player, float dt)
    {
        if (IsDead) return;

        WingAngle += dt * 8f;
        if (HurtTime > 0f) HurtTime -= dt;

        m_circleAngle += dt * 0.4f;
        Vector3 center = new Vector3(World.WorldSizeBlocksX * 0.5f, m_circleY, World.WorldSizeBlocksZ * 0.5f);

        Vector3 target = center + new Vector3(
            MathF.Cos(m_circleAngle) * m_circleRadius,
            MathF.Sin(m_circleAngle * 2f) * 4f,
            MathF.Sin(m_circleAngle) * m_circleRadius
        );

        Vector3 toTarget = target - Position;
        Position += toTarget * MathF.Min(1f, dt * 2.5f);

        Yaw = MathF.Atan2(toTarget.X, toTarget.Z);

        float distToPlayer = Vector3.Distance(Position, player.Position);
        if (distToPlayer < 4f)
        {
            player.Health -= 25f * dt;
            player.Velocity += Vector3.Normalize(player.Position - Position) * 12f;
            Audio.PlayHurt();
        }
    }

    public void TakeDamage(float dmg)
    {
        Health -= dmg;
        HurtTime = 0.35f;
        Audio.PlayHurt();
        if (Health <= 0)
        {
            Health = 0;
            IsDead = true;
            Audio.PlayExplosion();
        }
    }

    public void Render()
    {
        if (IsDead) return;

        Rlgl.SetTexture(0);

        Rlgl.PushMatrix();
        Rlgl.Translatef(Position.X, Position.Y, Position.Z);
        Rlgl.Rotatef(Yaw * (180f / MathF.PI), 0, 1, 0);

        bool isHurt = HurtTime > 0f;
        Color hurtColor = new Color(245, 45, 45, 255);
        Color C(int r, int g, int b) => isHurt ? hurtColor : new Color(r, g, b, 255);

        // 1. Dragon Body (Dark purple/black: 35, 15, 45)
        Color bodyCol = C(35, 15, 45);
        MobRenderer.DrawColorBox(new Vector3(0, 0, 0), new Vector3(2.2f, 1.6f, 4.2f), bodyCol);

        // 2. Dragon Neck & Head (45, 20, 55)
        MobRenderer.DrawColorBox(new Vector3(0, 0.8f, 2.8f), new Vector3(1.4f, 1.4f, 1.8f), C(45, 20, 55));

        // Glowing purple eyes (220, 50, 255)
        MobRenderer.DrawColorBox(new Vector3(-0.5f, 1.1f, 3.7f), new Vector3(0.25f, 0.25f, 0.1f), C(220, 50, 255));
        MobRenderer.DrawColorBox(new Vector3(0.5f, 1.1f, 3.7f), new Vector3(0.25f, 0.25f, 0.1f), C(220, 50, 255));

        // Horns (20, 10, 25)
        MobRenderer.DrawColorBox(new Vector3(0, 1.7f, 2.4f), new Vector3(1.2f, 0.4f, 0.8f), C(20, 10, 25));

        // 3. Left Wing (Flapping)
        float wingRot = MathF.Sin(WingAngle) * 35f;

        Rlgl.PushMatrix();
        Rlgl.Translatef(-1.4f, 0.5f, 0.2f);
        Rlgl.Rotatef(-wingRot, 0, 0, 1);
        MobRenderer.DrawColorBox(new Vector3(-2.0f, 0, 0), new Vector3(4.0f, 0.15f, 2.5f), C(30, 10, 40));
        Rlgl.PopMatrix();

        // 4. Right Wing (Flapping)
        Rlgl.PushMatrix();
        Rlgl.Translatef(1.4f, 0.5f, 0.2f);
        Rlgl.Rotatef(wingRot, 0, 0, 1);
        MobRenderer.DrawColorBox(new Vector3(2.0f, 0, 0), new Vector3(4.0f, 0.15f, 2.5f), C(30, 10, 40));
        Rlgl.PopMatrix();

        // 5. Tail segments
        for (int t = 1; t <= 3; t++)
        {
            MobRenderer.DrawColorBox(
                new Vector3(0, 0, -2.0f - t * 1.2f),
                new Vector3(1.0f - t * 0.2f, 0.8f - t * 0.15f, 1.2f),
                bodyCol
            );
        }

        Rlgl.PopMatrix();
    }
}

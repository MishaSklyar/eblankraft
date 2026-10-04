using System;
using System.Collections.Generic;
using System.Numerics;
using Raylib_cs;

namespace Eblankraft;

public class CaseRoulette
{
    public bool IsActive { get; private set; }
    public ItemId CaseType { get; private set; }

    private readonly List<ItemId> m_items = new List<ItemId>();
    private float m_scrollOffset;
    private float m_scrollSpeed;
    private float m_targetOffset;
    private ItemId m_wonItem;
    private bool m_settled;

    public void Open(ItemId caseType)
    {
        CaseType = caseType;
        IsActive = true;
        m_settled = false;
        m_items.Clear();

        Random rng = new Random();

        ItemId[] pool;
        if (caseType == ItemId.CaseDragon)
        {
            pool = new ItemId[]
            {
                ItemId.DragonEgg, ItemId.EyeOfEbland, ItemId.SwordDragonslayer,
                ItemId.PickSuperEblan, ItemId.PickNetherite, ItemId.SwordDiamond,
                ItemId.PickDiamond, (ItemId)BlockType.Netherite
            };
        }
        else
        {
            // Bomzh case
            pool = new ItemId[]
            {
                ItemId.TrashSock, ItemId.TrashZhiguli, ItemId.TrashCig, ItemId.TrashNut,
                (ItemId)BlockType.Dirt, (ItemId)BlockType.Stone, ItemId.Shawarma,
                ItemId.Steak, ItemId.PickWood, ItemId.PickIron
            };
        }

        for (int i = 0; i < 40; i++)
        {
            m_items.Add(pool[rng.Next(pool.Length)]);
        }

        // Winning item is index 30
        int winIdx = 30;
        m_wonItem = m_items[winIdx];

        float jitter = ((float)rng.NextDouble() - 0.5f) * 40f;
        m_targetOffset = winIdx * 90f + jitter;

        m_scrollOffset = 0f;
        m_scrollSpeed = 1600f;
    }

    public void Update(Player player, float dt)
    {
        if (!IsActive) return;

        if (m_scrollSpeed > 20f)
        {
            m_scrollOffset += m_scrollSpeed * dt;
            float remaining = m_targetOffset - m_scrollOffset;
            if (remaining < 300f)
            {
                m_scrollSpeed = MathF.Max(25f, remaining * 2.5f);
            }
            else
            {
                m_scrollSpeed = MathF.Max(120f, m_scrollSpeed - dt * 450f);
            }

            if (m_scrollOffset >= m_targetOffset)
            {
                m_scrollOffset = m_targetOffset;
                m_scrollSpeed = 0f;
                m_settled = true;
                Audio.PlayClick();
                player.AddItem(m_wonItem, 1);
            }
        }

        if (m_settled && (Raylib.IsKeyPressed(KeyboardKey.Escape) || Raylib.IsKeyPressed(KeyboardKey.Space) || Raylib.IsKeyPressed(KeyboardKey.Enter)))
        {
            IsActive = false;
        }
    }

    public void Render()
    {
        if (!IsActive) return;

        Raylib.DrawRectangle(0, 0, Common.VirtualWidth, Common.VirtualHeight, new Color(0, 0, 0, 200));

        string title = (CaseType == ItemId.CaseDragon) ? "DRAGON CASE OPENING" : "BOMZH CASE OPENING";
        int titleW = Raylib.MeasureText(title, 20);
        Raylib.DrawText(title, (Common.VirtualWidth - titleW) / 2, 120, 20, Color.Gold);

        int boxX = 60;
        int boxY = 180;
        int boxW = 520;
        int boxH = 110;
        Raylib.DrawRectangle(boxX, boxY, boxW, boxH, new Color(20, 20, 25, 240));
        Raylib.DrawRectangleLines(boxX, boxY, boxW, boxH, Color.Gray);

        Raylib.BeginScissorMode(
            (int)(boxX * ((float)Raylib.GetScreenWidth() / Common.VirtualWidth)),
            (int)(boxY * ((float)Raylib.GetScreenHeight() / Common.VirtualHeight)),
            (int)(boxW * ((float)Raylib.GetScreenWidth() / Common.VirtualWidth)),
            (int)(boxH * ((float)Raylib.GetScreenHeight() / Common.VirtualHeight))
        );

        float centerX = Common.VirtualWidth * 0.5f;

        for (int i = 0; i < m_items.Count; i++)
        {
            float cardX = centerX - m_scrollOffset + (i * 90f);
            float cardY = boxY + 15;

            if (cardX > boxX - 100 && cardX < boxX + boxW + 20)
            {
                ItemDef def = Items.Get(m_items[i]);
                Raylib.DrawRectangle((int)cardX - 35, (int)cardY, 70, 80, new Color(40, 45, 55, 255));
                Raylib.DrawRectangleLines((int)cardX - 35, (int)cardY, 70, 80, Color.Gold);

                if (def != null && def.TextureIndex >= 0)
                {
                    var (u0, v0, u1, v1) = Textures.GetUV(def.TextureIndex);
                    Rectangle src = new Rectangle(u0 * 256f, v0 * 256f, 16, 16);
                    Rectangle dst = new Rectangle(cardX - 16, cardY + 12, 32, 32);
                    Raylib.DrawTexturePro(Textures.Atlas, src, dst, Vector2.Zero, 0f, Color.White);
                }

                string shortName = def != null ? def.Name : "";
                if (shortName.Length > 8) shortName = shortName.Substring(0, 8);
                Raylib.DrawText(shortName, (int)cardX - 30, (int)cardY + 54, 10, Color.White);
            }
        }

        Raylib.EndScissorMode();

        Raylib.DrawLineEx(new Vector2(centerX, boxY - 5), new Vector2(centerX, boxY + boxH + 5), 3f, Color.Red);
        Raylib.DrawTriangle(
            new Vector2(centerX, boxY + 10),
            new Vector2(centerX - 8, boxY - 8),
            new Vector2(centerX + 8, boxY - 8),
            Color.Red
        );

        if (m_settled)
        {
            ItemDef won = Items.Get(m_wonItem);
            string winTxt = $"YOU WON: {won?.Name}!";
            int winW = Raylib.MeasureText(winTxt, 20);
            Raylib.DrawText(winTxt, (Common.VirtualWidth - winW) / 2, 320, 20, Color.Yellow);

            string contTxt = "Press SPACE or ESC to take item";
            int contW = Raylib.MeasureText(contTxt, 14);
            Raylib.DrawText(contTxt, (Common.VirtualWidth - contW) / 2, 360, 14, Color.RayWhite);
        }
    }
}

using System;
using System.Numerics;
using Raylib_cs;

namespace Eblankraft;

public static class UI
{
    public static bool IsPaused = false;
    public static int PauseSelectedOption = 0;

    public static void RenderHUD(Player player, World world, Dragon dragon)
    {
        int cx = Common.VirtualWidth / 2;
        int cy = Common.VirtualHeight / 2;
        Raylib.DrawLine(cx - 6, cy, cx + 6, cy, Color.White);
        Raylib.DrawLine(cx, cy - 6, cx, cy + 6, Color.White);

        int barY = Common.VirtualHeight - 56;
        int hearts = (int)MathF.Ceiling(player.Health / 2f);
        for (int i = 0; i < 10; i++)
        {
            int hx = 200 + i * 12;
            Color col = (i < hearts) ? Color.Red : Color.DarkGray;
            Raylib.DrawRectangle(hx, barY, 10, 10, col);
        }

        int hunger = (int)MathF.Ceiling(player.Hunger / 2f);
        for (int i = 0; i < 10; i++)
        {
            int fx = 325 + i * 12;
            Color col = (i < hunger) ? Color.Orange : Color.DarkGray;
            Raylib.DrawRectangle(fx, barY, 10, 10, col);
        }

        int hotbarW = 9 * 36;
        int hotbarX = (Common.VirtualWidth - hotbarW) / 2;
        int hotbarY = Common.VirtualHeight - 42;

        for (int i = 0; i < 9; i++)
        {
            int sx = hotbarX + i * 36;
            bool isSel = (i == player.SelectedSlot);

            Raylib.DrawRectangle(sx, hotbarY, 34, 34, isSel ? new Color(120, 120, 140, 220) : new Color(40, 40, 45, 200));
            Raylib.DrawRectangleLines(sx, hotbarY, 34, 34, isSel ? Color.Yellow : Color.Gray);

            InventorySlot slot = player.Hotbar[i];
            if (!slot.IsEmpty)
            {
                ItemDef def = Items.Get(slot.Item);
                if (def != null && def.TextureIndex >= 0)
                {
                    var (u0, v0, u1, v1) = Textures.GetUV(def.TextureIndex);
                    Rectangle src = new Rectangle(u0 * 256f, v0 * 256f, 16, 16);
                    Rectangle dst = new Rectangle(sx + 3, hotbarY + 3, 28, 28);
                    Raylib.DrawTexturePro(Textures.Atlas, src, dst, Vector2.Zero, 0f, Color.White);
                }

                if (slot.Count > 1)
                {
                    string countTxt = slot.Count.ToString();
                    Raylib.DrawText(countTxt, sx + 20, hotbarY + 20, 10, Color.White);
                }
            }
        }

        InventorySlot active = player.ActiveSlot;
        if (!active.IsEmpty)
        {
            ItemDef def = Items.Get(active.Item);
            if (def != null)
            {
                int nameW = Raylib.MeasureText(def.Name, 12);
                Raylib.DrawText(def.Name, (Common.VirtualWidth - nameW) / 2, hotbarY - 16, 12, Color.RayWhite);
            }
        }

        if (player.IsMining && player.MiningTimeRequired > 0)
        {
            float pct = Math.Clamp(player.MiningProgress / player.MiningTimeRequired, 0f, 1f);
            int bw = 100;
            int bx = (Common.VirtualWidth - bw) / 2;
            int by = cy + 18;
            Raylib.DrawRectangle(bx, by, bw, 8, Color.DarkGray);
            Raylib.DrawRectangle(bx, by, (int)(bw * pct), 8, Color.Green);
            Raylib.DrawRectangleLines(bx, by, bw, 8, Color.White);
        }

        Raylib.DrawText($"Dim: {world.CurrentDimension}", 10, 10, 12, Color.White);
        Raylib.DrawText($"FPS: {Raylib.GetFPS()}", 10, 24, 12, Color.Green);

        if (world.CurrentDimension == DimensionType.TheEnd && dragon != null && !dragon.IsDead)
        {
            int bossW = 260;
            int bossX = (Common.VirtualWidth - bossW) / 2;
            int bossY = 16;

            string bossName = "Ender Dragon";
            int nameW = Raylib.MeasureText(bossName, 12);
            Raylib.DrawText(bossName, (Common.VirtualWidth - nameW) / 2, bossY - 14, 12, Color.Purple);

            Raylib.DrawRectangle(bossX, bossY, bossW, 10, new Color(50, 0, 50, 200));
            float pct = Math.Clamp(dragon.Health / dragon.MaxHealth, 0f, 1f);
            Raylib.DrawRectangle(bossX, bossY, (int)(bossW * pct), 10, Color.Magenta);
            Raylib.DrawRectangleLines(bossX, bossY, bossW, 10, Color.White);
        }
    }

    public static void UpdatePauseMenu(World world, Player player)
    {
        if (Raylib.IsKeyPressed(KeyboardKey.Up) || Raylib.IsKeyPressed(KeyboardKey.W))
        {
            PauseSelectedOption = (PauseSelectedOption + 3) % 4;
            Audio.PlayClick();
        }
        if (Raylib.IsKeyPressed(KeyboardKey.Down) || Raylib.IsKeyPressed(KeyboardKey.S))
        {
            PauseSelectedOption = (PauseSelectedOption + 1) % 4;
            Audio.PlayClick();
        }

        if (Raylib.IsKeyPressed(KeyboardKey.Enter) || Raylib.IsKeyPressed(KeyboardKey.Space))
        {
            Audio.PlayClick();
            switch (PauseSelectedOption)
            {
                case 0:
                    IsPaused = false;
                    Raylib.DisableCursor();
                    break;

                case 1:
                    world.Generate(DimensionType.Overworld);
                    player.Position = new Vector3(40, 45, 40);
                    player.Velocity = Vector3.Zero;
                    IsPaused = false;
                    Raylib.DisableCursor();
                    break;

                case 2:
                    world.Generate(DimensionType.Nether);
                    player.Position = new Vector3(40, 25, 40);
                    player.Velocity = Vector3.Zero;
                    IsPaused = false;
                    Raylib.DisableCursor();
                    break;

                case 3:
                    world.Generate(DimensionType.TheEnd);
                    player.Position = new Vector3(40, 35, 40);
                    player.Velocity = Vector3.Zero;
                    IsPaused = false;
                    Raylib.DisableCursor();
                    break;
            }
        }
    }

    public static void RenderPauseMenu()
    {
        Raylib.DrawRectangle(0, 0, Common.VirtualWidth, Common.VirtualHeight, new Color(0, 0, 0, 180));

        string title = "GAME PAUSED";
        int tw = Raylib.MeasureText(title, 24);
        Raylib.DrawText(title, (Common.VirtualWidth - tw) / 2, 80, 24, Color.Yellow);

        string[] options = {
            "Resume Game",
            "Warp to Overworld",
            "Warp to Nether",
            "Warp to The End"
        };

        for (int i = 0; i < options.Length; i++)
        {
            bool isSel = (i == PauseSelectedOption);
            int btnW = 220;
            int btnH = 34;
            int btnX = (Common.VirtualWidth - btnW) / 2;
            int btnY = 150 + i * 46;

            Raylib.DrawRectangle(btnX, btnY, btnW, btnH, isSel ? Color.DarkGray : new Color(30, 30, 35, 240));
            Raylib.DrawRectangleLines(btnX, btnY, btnW, btnH, isSel ? Color.Gold : Color.Gray);

            int textW = Raylib.MeasureText(options[i], 14);
            Raylib.DrawText(options[i], btnX + (btnW - textW) / 2, btnY + 10, 14, isSel ? Color.Yellow : Color.White);
        }
    }
}

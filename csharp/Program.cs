using System;
using System.Collections.Generic;
using System.Numerics;
using Raylib_cs;

namespace Eblankraft;

public static class Program
{
    public static void Main(string[] args)
    {
        Raylib.SetConfigFlags(ConfigFlags.ResizableWindow);
        Raylib.InitWindow(Common.VirtualWidth * 2, Common.VirtualHeight * 2, "Eblankraft 2.0 (C# + Raylib)");
        Raylib.SetTargetFPS(60);

        Audio.Init();
        Textures.Init();

        World world = new World();
        Player player = new Player(new Vector3(40, 35, 40));

        Camera3D camera = new Camera3D
        {
            Position = player.CameraPosition,
            Target = player.CameraPosition + player.LookDirection,
            Up = new Vector3(0, 1, 0),
            FovY = 70f,
            Projection = CameraProjection.Perspective
        };

        List<Mob> mobs = new List<Mob>();
        Dragon dragon = new Dragon(new Vector3(40, 36, 40));

        void SpawnDimensionMobs(DimensionType dim)
        {
            mobs.Clear();
            Random rng = new Random(42);
            if (dim == DimensionType.Overworld)
            {
                for (int i = 0; i < 8; i++)
                {
                    mobs.Add(new Mob(MobKind.Zombie, new Vector3(rng.Next(20, 60), 30, rng.Next(20, 60))));
                }
                for (int i = 0; i < 4; i++)
                {
                    mobs.Add(new Mob(MobKind.Creeper, new Vector3(rng.Next(20, 60), 30, rng.Next(20, 60))));
                }
            }
            else if (dim == DimensionType.Nether)
            {
                for (int i = 0; i < 10; i++)
                {
                    mobs.Add(new Mob(MobKind.Piglin, new Vector3(rng.Next(20, 60), 20, rng.Next(20, 60))));
                }
            }
            else if (dim == DimensionType.TheEnd)
            {
                for (int i = 0; i < 8; i++)
                {
                    mobs.Add(new Mob(MobKind.Enderman, new Vector3(rng.Next(25, 55), 30, rng.Next(25, 55))));
                }
                int[] angles = { 0, 60, 120, 180, 240, 300 };
                foreach (int a in angles)
                {
                    float rad = a * MathF.PI / 180f;
                    int px = 40 + (int)(MathF.Cos(rad) * 18f);
                    int pz = 40 + (int)(MathF.Sin(rad) * 18f);
                    int ph = 14 + (a % 7);
                    mobs.Add(new Mob(MobKind.EndCrystal, new Vector3(px, 29 + ph, pz)));
                }
                dragon = new Dragon(new Vector3(40, 36, 40));
            }
        }

        SpawnDimensionMobs(DimensionType.Overworld);

        CaseRoulette roulette = new CaseRoulette();

        Raylib.DisableCursor();

        RenderTexture2D target = Raylib.LoadRenderTexture(Common.VirtualWidth, Common.VirtualHeight);
        Raylib.SetTextureFilter(target.Texture, TextureFilter.Point);

        DimensionType lastDim = world.CurrentDimension;

        while (!Raylib.WindowShouldClose())
        {
            float dt = Raylib.GetFrameTime();
            if (dt > 0.1f) dt = 0.1f;

            if (world.CurrentDimension != lastDim)
            {
                SpawnDimensionMobs(world.CurrentDimension);
                lastDim = world.CurrentDimension;
            }

            if (Raylib.IsKeyPressed(KeyboardKey.Escape) && !roulette.IsActive)
            {
                UI.IsPaused = !UI.IsPaused;
                if (UI.IsPaused) Raylib.EnableCursor();
                else Raylib.DisableCursor();
            }

            if (roulette.IsActive)
            {
                roulette.Update(player, dt);
            }
            else if (UI.IsPaused)
            {
                UI.UpdatePauseMenu(world, player);
            }
            else
            {
                if (Raylib.IsMouseButtonPressed(MouseButton.Right))
                {
                    if (player.ActiveSlot.Item == ItemId.CaseBomzh || player.ActiveSlot.Item == ItemId.CaseDragon)
                    {
                        ItemId ctype = player.ActiveSlot.Item;
                        player.ActiveSlot.Count--;
                        if (player.ActiveSlot.Count <= 0) player.ActiveSlot.Item = ItemId.None;
                        roulette.Open(ctype);
                    }
                }

                if (Raylib.IsMouseButtonPressed(MouseButton.Left) && !player.IsMining)
                {
                    ItemDef tool = Items.Get(player.ActiveSlot.Item);
                    float dmg = (tool != null) ? tool.AttackDamage : 1f;

                    Vector3 eye = player.CameraPosition;
                    foreach (var m in mobs)
                    {
                        if (m.IsDead) continue;
                        if (Vector3.Distance(eye, m.Position) < 3.5f)
                        {
                            m.TakeDamage(dmg);
                            break;
                        }
                    }

                    if (world.CurrentDimension == DimensionType.TheEnd && !dragon.IsDead)
                    {
                        if (Vector3.Distance(eye, dragon.Position) < 6f)
                        {
                            dragon.TakeDamage(dmg);
                        }
                    }
                }

                player.Update(world, dt);

                foreach (var mob in mobs)
                {
                    mob.Update(world, player, dt);
                }

                if (world.CurrentDimension == DimensionType.TheEnd)
                {
                    dragon.Update(player, dt);
                }
            }

            camera.Position = player.CameraPosition;
            camera.Target = player.CameraPosition + player.LookDirection;

            Raylib.BeginTextureMode(target);

            Color skyColor = world.CurrentDimension switch
            {
                DimensionType.Nether => new Color(40, 10, 10, 255),
                DimensionType.TheEnd => new Color(15, 10, 25, 255),
                _ => new Color(120, 170, 255, 255)
            };
            Raylib.ClearBackground(skyColor);

            Raylib.BeginMode3D(camera);

            world.Render(player.Position);
            MobRenderer.RenderMobs(mobs);
            if (world.CurrentDimension == DimensionType.TheEnd)
            {
                dragon.Render();
            }

            Raylib.EndMode3D();

            UI.RenderHUD(player, world, dragon);

            if (UI.IsPaused)
            {
                UI.RenderPauseMenu();
            }

            if (roulette.IsActive)
            {
                roulette.Render();
            }

            Raylib.EndTextureMode();

            Raylib.BeginDrawing();
            Raylib.ClearBackground(Color.Black);

            int screenW = Raylib.GetScreenWidth();
            int screenH = Raylib.GetScreenHeight();

            float scale = MathF.Min((float)screenW / Common.VirtualWidth, (float)screenH / Common.VirtualHeight);
            int renderW = (int)(Common.VirtualWidth * scale);
            int renderH = (int)(Common.VirtualHeight * scale);
            int renderX = (screenW - renderW) / 2;
            int renderY = (screenH - renderH) / 2;

            Rectangle srcRec = new Rectangle(0, 0, target.Texture.Width, -target.Texture.Height);
            Rectangle dstRec = new Rectangle(renderX, renderY, renderW, renderH);

            Raylib.DrawTexturePro(target.Texture, srcRec, dstRec, Vector2.Zero, 0f, Color.White);

            Raylib.EndDrawing();
        }

        Raylib.UnloadRenderTexture(target);
        Textures.Close();
        Audio.Close();
        Raylib.CloseWindow();
    }
}

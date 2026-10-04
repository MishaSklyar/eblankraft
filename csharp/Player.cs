using System;
using System.Numerics;
using Raylib_cs;

namespace Eblankraft;

public class InventorySlot
{
    public ItemId Item;
    public int Count;

    public InventorySlot(ItemId item = ItemId.None, int count = 0)
    {
        Item = item;
        Count = count;
    }

    public bool IsEmpty => Item == ItemId.None || Count <= 0;
}

public class Player
{
    public Vector3 Position;
    public Vector3 Velocity;
    public float Yaw;   // Horizontal rotation (radians)
    public float Pitch; // Vertical rotation (radians)

    public float Health = 20f;
    public float Hunger = 20f;
    public bool IsGrounded;

    public const float EyeHeight = 1.62f;
    public const float Width = 0.6f;
    public const float Height = 1.8f;

    public InventorySlot[] Hotbar = new InventorySlot[9];
    public int SelectedSlot = 0;

    // Mining state
    public bool IsMining;
    public BlockPos MiningBlock;
    public float MiningProgress;
    public float MiningTimeRequired;

    public Player(Vector3 startPos)
    {
        Position = startPos;
        Yaw = 0f;
        Pitch = 0f;

        // Starter inventory
        for (int i = 0; i < 9; i++) Hotbar[i] = new InventorySlot();
        Hotbar[0] = new InventorySlot(ItemId.PickDiamond, 1);
        Hotbar[1] = new InventorySlot(ItemId.SwordDiamond, 1);
        Hotbar[2] = new InventorySlot(ItemId.Steak, 16);
        Hotbar[3] = new InventorySlot((ItemId)BlockType.Dirt, 64);
        Hotbar[4] = new InventorySlot((ItemId)BlockType.Wood, 64);
        Hotbar[5] = new InventorySlot((ItemId)BlockType.Stone, 64);
        Hotbar[6] = new InventorySlot(ItemId.CaseBomzh, 5);
        Hotbar[7] = new InventorySlot(ItemId.CaseDragon, 2);
    }

    public Vector3 CameraPosition => new Vector3(Position.X, Position.Y + EyeHeight, Position.Z);

    public Vector3 LookDirection
    {
        get
        {
            return new Vector3(
                MathF.Sin(Yaw) * MathF.Cos(Pitch),
                MathF.Sin(Pitch),
                MathF.Cos(Yaw) * MathF.Cos(Pitch)
            );
        }
    }

    public InventorySlot ActiveSlot => Hotbar[SelectedSlot];

    public void Update(World world, float dt)
    {
        // Mouse look
        Vector2 mouseDelta = Raylib.GetMouseDelta();
        const float sens = 0.003f;
        Yaw -= mouseDelta.X * sens;
        Pitch -= mouseDelta.Y * sens;
        Pitch = Math.Clamp(Pitch, -1.55f, 1.55f);

        // Hotbar selection with keys 1-9 or mouse wheel
        for (int i = 0; i < 9; i++)
        {
            if (Raylib.IsKeyPressed(KeyboardKey.One + i))
            {
                SelectedSlot = i;
            }
        }
        float wheel = Raylib.GetMouseWheelMove();
        if (wheel > 0) SelectedSlot = (SelectedSlot + 8) % 9;
        else if (wheel < 0) SelectedSlot = (SelectedSlot + 1) % 9;

        // Movement inputs
        Vector3 forward = new Vector3(MathF.Sin(Yaw), 0, MathF.Cos(Yaw));
        Vector3 right = new Vector3(MathF.Cos(Yaw), 0, -MathF.Sin(Yaw));
        Vector3 wishDir = Vector3.Zero;

        if (Raylib.IsKeyDown(KeyboardKey.W)) wishDir += forward;
        if (Raylib.IsKeyDown(KeyboardKey.S)) wishDir -= forward;
        if (Raylib.IsKeyDown(KeyboardKey.D)) wishDir -= right; // D is strafe right
        if (Raylib.IsKeyDown(KeyboardKey.A)) wishDir += right; // A is strafe left

        if (wishDir.LengthSquared() > 0.001f)
        {
            wishDir = Vector3.Normalize(wishDir);
        }

        float speed = 4.3f;
        if (Raylib.IsKeyDown(KeyboardKey.LeftShift)) speed = 6.2f;

        Velocity.X = wishDir.X * speed;
        Velocity.Z = wishDir.Z * speed;

        // Gravity
        Velocity.Y -= 22f * dt;

        // Jump: STRICTLY SPACE KEY
        if (Raylib.IsKeyPressed(KeyboardKey.Space) && IsGrounded)
        {
            Velocity.Y = 8.0f;
            IsGrounded = false;
            Audio.PlayJump();
        }

        // Move with AABB collision
        MoveWithCollision(world, dt);

        // Void check
        if (Position.Y < -10f)
        {
            Position = new Vector3(40, 45, 40);
            Velocity = Vector3.Zero;
            Health = MathF.Max(1f, Health - 5f);
            Audio.PlayHurt();
        }

        // Mining update
        UpdateMining(world, dt);
    }

    private void MoveWithCollision(World world, float dt)
    {
        float halfW = Width * 0.5f;

        // Y Axis collision
        Position.Y += Velocity.Y * dt;
        IsGrounded = false;

        if (CheckCollision(world, Position, halfW, Height))
        {
            if (Velocity.Y < 0)
            {
                Position.Y = MathF.Floor(Position.Y) + 1f;
                IsGrounded = true;
            }
            else
            {
                Position.Y = MathF.Floor(Position.Y + Height) - Height;
            }
            Velocity.Y = 0;
        }

        // X Axis collision
        Position.X += Velocity.X * dt;
        if (CheckCollision(world, Position, halfW, Height))
        {
            if (Velocity.X > 0)
                Position.X = MathF.Floor(Position.X + halfW) - halfW - 0.001f;
            else
                Position.X = MathF.Floor(Position.X - halfW) + 1f + halfW + 0.001f;
            Velocity.X = 0;
        }

        // Z Axis collision
        Position.Z += Velocity.Z * dt;
        if (CheckCollision(world, Position, halfW, Height))
        {
            if (Velocity.Z > 0)
                Position.Z = MathF.Floor(Position.Z + halfW) - halfW - 0.001f;
            else
                Position.Z = MathF.Floor(Position.Z - halfW) + 1f + halfW + 0.001f;
            Velocity.Z = 0;
        }
    }

    private static bool CheckCollision(World world, Vector3 pos, float halfW, float height)
    {
        int minX = (int)MathF.Floor(pos.X - halfW);
        int maxX = (int)MathF.Floor(pos.X + halfW);
        int minY = (int)MathF.Floor(pos.Y);
        int maxY = (int)MathF.Floor(pos.Y + height);
        int minZ = (int)MathF.Floor(pos.Z - halfW);
        int maxZ = (int)MathF.Floor(pos.Z + halfW);

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                for (int z = minZ; z <= maxZ; z++)
                {
                    byte b = world.GetBlock(x, y, z);
                    if (Blocks.IsSolid((BlockType)b)) return true;
                }
            }
        }
        return false;
    }

    private void UpdateMining(World world, float dt)
    {
        RaycastHit hit = world.Raycast(CameraPosition, LookDirection, 5f);

        if (Raylib.IsMouseButtonDown(MouseButton.Left) && hit.Hit)
        {
            byte blockId = world.GetBlock(hit.BlockPos.X, hit.BlockPos.Y, hit.BlockPos.Z);
            BlockDef bdef = Blocks.GetDef((BlockType)blockId);

            if (bdef.Hardness >= 0) // Bedrock is unbreakable (-1)
            {
                if (!IsMining || MiningBlock != hit.BlockPos)
                {
                    IsMining = true;
                    MiningBlock = hit.BlockPos;
                    MiningProgress = 0f;

                    ItemDef tool = Items.Get(ActiveSlot.Item);
                    float speed = (tool != null) ? tool.MiningSpeed : 1f;
                    MiningTimeRequired = MathF.Max(0.1f, bdef.Hardness / speed);
                }

                MiningProgress += dt;
                if (MiningProgress >= MiningTimeRequired)
                {
                    world.SetBlock(hit.BlockPos.X, hit.BlockPos.Y, hit.BlockPos.Z, 0);
                    Audio.PlayBreak();
                    IsMining = false;
                    MiningProgress = 0f;

                    AddItem((ItemId)blockId, 1);
                }
            }
            else
            {
                IsMining = false;
                MiningProgress = 0f;
            }
        }
        else
        {
            IsMining = false;
            MiningProgress = 0f;
        }

        // Block placing
        if (Raylib.IsMouseButtonPressed(MouseButton.Right) && hit.Hit)
        {
            ItemDef active = Items.Get(ActiveSlot.Item);
            if (active != null && active.IsBlock && ActiveSlot.Count > 0)
            {
                BlockPos target = hit.BlockPos;
                switch (hit.Face)
                {
                    case BlockFace.Top: target = new BlockPos(target.X, target.Y + 1, target.Z); break;
                    case BlockFace.Bottom: target = new BlockPos(target.X, target.Y - 1, target.Z); break;
                    case BlockFace.North: target = new BlockPos(target.X, target.Y, target.Z - 1); break;
                    case BlockFace.South: target = new BlockPos(target.X, target.Y, target.Z + 1); break;
                    case BlockFace.West: target = new BlockPos(target.X - 1, target.Y, target.Z); break;
                    case BlockFace.East: target = new BlockPos(target.X + 1, target.Y, target.Z); break;
                }

                // Check player bounding box intersection
                float halfW = Width * 0.5f;
                bool overlapsPlayer =
                    target.X >= MathF.Floor(Position.X - halfW) && target.X <= MathF.Floor(Position.X + halfW) &&
                    target.Z >= MathF.Floor(Position.Z - halfW) && target.Z <= MathF.Floor(Position.Z + halfW) &&
                    target.Y >= MathF.Floor(Position.Y) && target.Y <= MathF.Floor(Position.Y + Height);

                if (!overlapsPlayer)
                {
                    world.SetBlock(target.X, target.Y, target.Z, (byte)active.BlockType);
                    Audio.PlayPlace();
                    ActiveSlot.Count--;
                    if (ActiveSlot.Count <= 0) ActiveSlot.Item = ItemId.None;
                }
            }
        }
    }

    public void AddItem(ItemId item, int count)
    {
        // Stack into existing slots
        for (int i = 0; i < 9; i++)
        {
            if (Hotbar[i].Item == item && Hotbar[i].Count < 64)
            {
                Hotbar[i].Count += count;
                return;
            }
        }
        // Find empty slot
        for (int i = 0; i < 9; i++)
        {
            if (Hotbar[i].IsEmpty)
            {
                Hotbar[i].Item = item;
                Hotbar[i].Count = count;
                return;
            }
        }
    }
}

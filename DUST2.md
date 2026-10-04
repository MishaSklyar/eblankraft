# Dust2 mode

Run `python3 server.py`, open `http://localhost:8081`, select **Dust2 / Online**, and create or join a room. Empty places are filled by bots (3 T versus 3 CT).

- WASD: movement; mouse: aim; left click: fire.
- R: reload. Magazine and reserve counts appear in the HUD; misses also consume ammunition. Bots reload when their magazine is empty.
- Space: jump. Release and press again for each hop; use A/D and mouse movement in the air to gain speed.
- B: open or close the buy menu during the 10-second buy phase.
- Hold E on A/B while carrying C4 to plant (3 seconds). CT hold E near planted C4 to defuse (5 seconds).
- After death, watch surviving teammates; `[` and `]` switch targets.

Rounds last 85 seconds; planted C4 explodes after 40 seconds. Teams swap after 6 rounds; first team to 7 wins. Kill reward: $300; planting/defusing: $300. Winners receive $3250 ($3500 for explosion); loss rewards increase with consecutive losses.

The multiplayer mode uses the imported `de_eblan2` map. Server collision and bot navigation come from the same voxel data rendered by the browser; A/B markers and team spawn points are configured for this map.

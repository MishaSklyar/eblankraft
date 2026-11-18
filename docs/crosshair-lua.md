# Lua crosshairs

A Lua crosshair is a short script that draws the crosshair every frame. It can be as simple as one dot or as strange as you like: spinning polygons, text, rings that follow the real bullet spread, or a crosshair that flashes when you hit something.

Scripts run in Lua, the same engine the Lua mods use, inside a sandbox. A script can only draw. It cannot read the page, the network, or the game beyond the state table described below.

Where to find it: pause menu → **Aim** tab → **Advanced (Lua)**.

---

## For AI agents

Read this section first. It is the short contract. The rest of the document is the reference.

1. A valid script defines `function draw(c, s)`. Nothing else is required.
2. Draw only with the methods in [Canvas API](#canvas-api) (`c:line`, `c:circle`, ...). Read only the fields in [State](#state-s). There is no DOM, no `os`, no `io`, no `require`, no `load`, no `print`.
3. Coordinates are pixels from the centre of the screen. `x` grows to the right, `y` grows downwards. Everything is clamped to ±240 px.
4. Colours are text: `"#rgb"`, `"#rrggbb"` or `"#rrggbbaa"`. Anything else is an error.
5. Limits: 16 KB of source, 400 draw calls per frame, about 300 000 Lua steps per frame (a loop of about 3 000 iterations is fine, `while true do end` is stopped), 16 settings, 32 points per shape.
6. To add a shipped example: create `crosshairs/examples/<id>.lua` with `-- @name` and `-- @author` header lines, then run `python3 tools/build_crosshair_examples.py`. Then run `node --test tests/crosshair-lua.test.js`. The test checks the bundle is in sync, that every example compiles, and that it draws in idle, scoped and hitting states.
7. To check a script without the game: load `js/fengari-web.js`, `js/crosshair_lua.js` into a Node `vm` context (see `tests/crosshair-lua.test.js` for the exact harness), then call `CrosshairLua.createEngine(fengari)`, `engine.load(source)` and `engine.frame(state, values)`.
8. A script that errors during play is switched off automatically and the built-in crosshair comes back. The error text appears in the Advanced tab.

---

## Quick start

The smallest valid crosshair:

```lua
function draw(c, s)
  c:circle(0, 0, 2, "#ffffff")
end
```

A crosshair with settings and a live spread ring:

```lua
params = {
  size  = { label = "Arm length", type = "number", min = 2, max = 40, default = 6, order = 1 },
  color = { label = "Colour", type = "color", default = "#ffffff", order = 2 },
}

function draw(c, s)
  local gap = s.spreadPx                 -- the real bullet cone, in pixels
  c:line(0, gap, 0, gap + param.size, 2, param.color)
  c:line(0, -gap, 0, -(gap + param.size), 2, param.color)
  c:line(gap, 0, gap + param.size, 0, 2, param.color)
  c:line(-gap, 0, -(gap + param.size), 0, 2, param.color)
end
```

---

## Script structure

- **Top level** runs once when the script is applied. Use it for `local` helpers, constants and the `params` table.
- **`draw(c, s)`** runs every frame. `c` is the canvas, `s` is the state. It must exist.
- `param` is a table with the current value of each setting. It is available inside `draw`.

---

## Settings (`params`)

Declaring a `params` table turns each entry into a control in the Advanced tab: a slider for numbers, a colour picker for colours, a checkbox for booleans. The script reads the value as `param.<key>`.

```lua
params = {
  thick = { label = "Thickness", type = "number", min = 1, max = 8, default = 2, order = 1 },
  color = { label = "Colour", type = "color", default = "#9be7ff", order = 2 },
  label = { label = "Show readout", type = "bool", default = true, order = 3 },
}
```

| Field | Meaning |
|---|---|
| key (the table key) | Letters, digits and `_`, starting with a letter. Up to 32 characters. |
| `type` | `"number"`, `"color"` or `"bool"`. Anything else is an error. |
| `label` | Text shown in the UI. Defaults to the key. |
| `min`, `max` | Numbers only. Default 0 and 100. Values are clamped. |
| `default` | Used until the player changes the setting. Numbers are clamped to `min`..`max`. |
| `order` | Sort position in the UI. Lower first. Defaults to 1000. |

At most 16 settings per script. Values from the UI or a share code are checked against the type and range, and bad values fall back to the default.

---

## Canvas API

Every method is called with a colon on the canvas: `c:circle(...)`. Coordinates are relative to the screen centre. Widths and sizes are clamped; colours are checked and an invalid one is an error.

| Call | Draws |
|---|---|
| `c:line(x1, y1, x2, y2, width, color)` | A straight line. `width` is optional, default 1. |
| `c:rect(x, y, w, h, color)` | A filled rectangle centred on `(x, y)`. |
| `c:frame(x, y, w, h, thickness, color)` | A rectangle outline centred on `(x, y)`. |
| `c:circle(x, y, radius, color)` | A filled circle. |
| `c:ring(x, y, radius, thickness, color)` | A circle outline. |
| `c:poly(points, color)` | A filled polygon. `points` is `{x1, y1, x2, y2, ...}`, 3 to 32 points. |
| `c:outline(points, width, color)` | A closed polygon outline, same point format. |
| `c:text(x, y, string, size, color)` | Text centred on `(x, y)`. `size` is optional, default 12. Up to 48 characters. |
| `c:rotate(angle)` | Rotates everything drawn after it, around the screen centre, in radians. |
| `c:reset()` | Cancels `c:rotate`. |

Calls are recorded in order and drawn after `draw` returns, so later calls draw on top of earlier ones.

---

## State (`s`)

`s` is rebuilt every frame and is read-only in practice: writing to it has no effect. Every field is always present.

| Field | Type | Meaning |
|---|---|---|
| `time` | number | Seconds since the crosshair started. Use it for animation. |
| `width`, `height` | number | Screen size in pixels. |
| `fov` | number | Camera field of view, degrees. |
| `hasGun` | bool | A gun is in hand (false in the arena and with other items). |
| `gun` | string | Gun id: `ak47`, `m4a1`, `awp`, `shotgun`, `deagle`, `glock`, `mp5`, `rpg`. Empty without a gun. |
| `ammo` | number | Rounds in the magazine. |
| `reloading` | bool | Reloading right now. |
| `spread` | number | The current bullet cone, radians. This is the real value the game uses. |
| `spreadPx` | number | The same cone as a screen radius in pixels at the current FOV. |
| `bloom` | number | Sustained-fire bloom, 0 (none) to 1 (maximum). |
| `moving` | bool | Walking or running (horizontal speed above 0.3). |
| `speed` | number | Horizontal speed, blocks per second. |
| `airborne` | bool | Off the ground for more than 0.15 s. |
| `aiming` | bool | Aiming down sights. |
| `scoped` | bool | The AWP scope is up. The whole cone is tighter then. |
| `targetLocked` | bool | The crosshair is on a mob, dragon or another player. |
| `blockTarget` | bool | The crosshair is on a block that can be mined or used. |
| `hitMarker` | bool | The last shot hit something, for about 150 ms. |
| `hitType` | string | What was hit: `mob`, `dragon`, `player`, `block`, or empty. |
| `health`, `maxHealth` | number | Player health. |
| `dead` | bool | The player is dead. |
| `menuOpen` | bool | A menu or the inventory is open. |

A typical pattern: use `s.spreadPx` for geometry, `s.targetLocked` and `s.hitMarker` for colour, and `s.time` for animation.

---

## Limits and sandbox

| Limit | Value |
|---|---|
| Script size | 16 KB |
| Draw calls per frame | 400 |
| Lua steps per frame | about 300 000 (checked every 1 000 instructions) |
| Points per shape | 32 |
| Characters per `c:text` | 48 |
| Line or ring thickness | 0 to 64 px |
| Settings (`params`) | 16 |
| Share code length accepted | 64 KB |

The Lua standard library is reduced to `math`, `table`, `string`, and the base functions `pairs`, `ipairs`, `pcall`, `xpcall`, `tostring`, `tonumber`, `type`, `select`, `error`, `assert`, `next`, `rawget`, `rawset`, `rawequal`, `rawlen`, `setmetatable`, `getmetatable`. These are removed: `os`, `io`, `debug`, `package`, `require`, `load`, `loadfile`, `dofile`, `print`, `collectgarbage`, and `string.rep` (one call can allocate gigabytes).

---

## Behaviour

- **Apply** compiles the script and runs `draw` once with a gun in hand and once without. Errors at this point are reported and the running crosshair keeps running. The text stays in the editor so you can fix it.
- **Use Lua crosshair** switches the Lua crosshair on or off. While it is on, the built-in crosshair and spread ring are hidden, and the script is responsible for everything shown.
- **A runtime error** (for example a `nil` access that only happens when the spread is wide) switches the Lua crosshair off, brings the built-in one back, and shows the error. Fix the script and press Apply.
- The crosshair is hidden in the main menu and during preloading, as the built-in one is.
- Settings and the script are saved in the browser. A script that was on when you left the game starts again.

---

## Sharing

- **Copy code** produces `EBCHL1.…`. It contains the name, author, script and current setting values. Paste it into **Apply code** on another browser. Codes work with any text, including non-Latin names.
- **Export .lua** saves the script as a file. The first lines are `-- @name` and `-- @author` comments, so the file stays readable and carries its name.
- **Import .lua** loads such a file into the editor. Press Apply to run it.

A shared `.lua` file can go in a repository, be pasted in a chat, or be kept with other crosshairs.

---

## Examples

The examples live in [`crosshairs/examples/`](../crosshairs/examples/) and are the source for the **Start from** menu.

| File | What it shows |
|---|---|
| `minimal.lua` | The smallest valid script: one dot. |
| `classic.lua` | A plus sign with settings for length, gap, thickness, colour and outline. |
| `dynamic_gap.lua` | Four ticks whose gap is the real bullet spread. Changes colour on a target. |
| `dot_and_ring.lua` | A dot inside a ring that matches the spread. |
| `hit_x.lua` | An X that turns red and grows on a hit. |
| `brackets.lua` | Four corner brackets that open with the spread. |
| `scope_mildots.lua` | A mil-dot reticle while the AWP scope is up. |
| `anything.lua` | A spinning custom shape, a colour driven by the spread, and a text readout. |

To change an example, edit the `.lua` file and run `python3 tools/build_crosshair_examples.py`.

---

## Recipes

**A gap that follows the spread, with a minimum**

```lua
local gap = math.max(3, math.min(s.spreadPx, 200))
```

**Flash on a hit**

```lua
if s.hitMarker then col = "#ff3b3b" end
```

**A reticle that only exists while scoped**

```lua
if s.scoped then
  -- draw the reticle
end
```

**A shape that rotates with time**

```lua
c:rotate(s.time * 2)
c:outline({ 0, -10, 9, 7, -9, 7 }, 2, "#ffffff")
c:reset()
```

**Colour from spread (blue tight, red wide)**

```lua
local k = math.min(1, s.spreadPx / 60)
local col = string.format("#%02x%02x%02x", math.floor(80 + 175 * k), 200 - math.floor(120 * k), 255 - math.floor(200 * k))
```

---

## Troubleshooting

| Message | Cause and fix |
|---|---|
| `define function draw(c, s)` | The script has no `draw` function at the top level. Check the name and that it is not inside another block. |
| `invalid colour "red"` | Colours must be `#rgb`, `#rrggbb` or `#rrggbbaa`. |
| `bad argument #1 to 'line' (number expected...)` | A coordinate was text or `nil`. Check the arguments and their order. |
| `... finite number` | A value was `0/0` or `inf`. Guard divisions. |
| `too many draw calls in one frame` | More than 400 calls. Reduce loops or draw fewer, larger shapes. |
| `ran too long in one frame` | A loop never ends, or runs over about 300 000 steps. Check loop bounds. |
| `attempt to index a nil value` | A table field was missing. Give defaults, for example `(s.foo or 0)`. |
| `the script is larger than 16 KB` | Split it, or remove comments. |
| `that code is damaged` | The share code was cut or edited. Copy it again. |

---

## Notes for maintainers

- Engine: `js/crosshair_lua.js`. Sandbox, limits, `params` parsing, draw recording, canvas rendering, share and file codecs, the Advanced tab UI.
- Examples: `crosshairs/examples/*.lua`, bundled into `js/crosshair_examples.js` by `tools/build_crosshair_examples.py`.
- Tests: `tests/crosshair-lua.test.js` (engine, sandbox, examples, codecs), `tests/crosshair-customizer.test.js` (the Basic shapes and share codes), `tests/gun-spread-recoil.test.js` (the state fields and spread values the scripts read).
- The Basic (non-Lua) customizer lives in `js/crosshair.js`.

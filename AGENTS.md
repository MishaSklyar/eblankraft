# Notes for AI agents

## Crosshair scripts (Lua)

Players write Lua crosshairs in the game's Aim tab, under Advanced (Lua). Full reference, API and rules: [`docs/crosshair-lua.md`](docs/crosshair-lua.md). Read its "For AI agents" section first.

Workflow for shipped examples:

1. Edit or add `crosshairs/examples/<id>.lua`. Keep the `-- @name` and `-- @author` header lines.
2. Run `python3 tools/build_crosshair_examples.py` to regenerate `js/crosshair_examples.js`.
3. Run `node --test tests/crosshair-lua.test.js`. Every example must compile and draw.

Do not edit `js/crosshair_examples.js` by hand. It is generated.

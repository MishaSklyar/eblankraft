-- @name Anything
-- @author Eblankraft
-- Shows what a Lua crosshair can do: a spinning custom shape, a text readout of the spread and the gun,
-- and a colour that follows the bullet spread. Replace the shapes with anything you like.

params = {
  color = { label = "Colour", type = "color", default = "#9be7ff", order = 1 },
  spin  = { label = "Spin speed (radians/s)", type = "number", min = 0, max = 6, default = 1.5, order = 2 },
  label = { label = "Show readout", type = "bool", default = true, order = 3 },
}

function draw(c, s)
  -- A triangle that spins around the centre.
  c:rotate(s.time * param.spin)
  c:outline({ 0, -10, 9, 7, -9, 7 }, 2, param.color)
  c:reset()

  -- A small diamond whose colour changes from blue (tight) to red (wide), using the real spread.
  local k = math.min(1, s.spreadPx / 60)
  c:poly({ 0, -3, 3, 0, 0, 3, -3, 0 }, string.format("#%02x%02x%02x", math.floor(80 + 175 * k), 200 - math.floor(120 * k), 255 - math.floor(200 * k)))

  if param.label and s.hasGun then
    c:text(0, 24, string.format("%s  %.0f px", s.gun, s.spreadPx), 11, param.color)
  end
end

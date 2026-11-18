-- @name Classic plus
-- @author Eblankraft
-- A plus sign with a gap in the middle. Length, gap, thickness and colour are settings you can change.

params = {
  size    = { label = "Arm length", type = "number", min = 2, max = 40, default = 6, order = 1 },
  gap     = { label = "Gap", type = "number", min = 0, max = 30, default = 4, order = 2 },
  thick   = { label = "Thickness", type = "number", min = 1, max = 8, default = 2, order = 3 },
  color   = { label = "Colour", type = "color", default = "#ffffff", order = 4 },
  outline = { label = "Black outline", type = "bool", default = true, order = 5 },
}

-- Four arms that start `g` px from the centre and run `l` px outwards.
local function arms(c, g, l, t, color)
  c:line(0, g, 0, g + l, t, color)
  c:line(0, -g, 0, -(g + l), t, color)
  c:line(g, 0, g + l, 0, t, color)
  c:line(-g, 0, -(g + l), 0, t, color)
end

function draw(c, s)
  if param.outline then
    arms(c, param.gap, param.size, param.thick + 2, "#000000")
  end
  arms(c, param.gap, param.size, param.thick, param.color)
end

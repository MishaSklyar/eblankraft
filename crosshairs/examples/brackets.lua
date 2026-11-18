-- @name Corner brackets
-- @author Eblankraft
-- Four corner brackets that open up with the bullet spread.

params = {
  size  = { label = "Bracket length", type = "number", min = 2, max = 30, default = 6, order = 1 },
  thick = { label = "Thickness", type = "number", min = 1, max = 6, default = 2, order = 2 },
  color = { label = "Colour", type = "color", default = "#ffffff", order = 3 },
}

function draw(c, s)
  local d = math.max(6, s.spreadPx + 6)   -- distance of each corner from the centre
  local l, t, col = param.size, param.thick, param.color
  for _, sx in ipairs({ -1, 1 }) do
    for _, sy in ipairs({ -1, 1 }) do
      c:line(sx * d, sy * d, sx * (d - l), sy * d, t, col)
      c:line(sx * d, sy * d, sx * d, sy * (d - l), t, col)
    end
  end
end

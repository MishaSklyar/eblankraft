-- @name Hit X
-- @author Eblankraft
-- Four diagonal ticks. They turn red and grow for a moment when a bullet hits something.

params = {
  size  = { label = "Length", type = "number", min = 3, max = 20, default = 6, order = 1 },
  color = { label = "Colour", type = "color", default = "#ffffff", order = 2 },
  hit   = { label = "Hit colour", type = "color", default = "#ff3b3b", order = 3 },
}

local K = 0.7071   -- cos(45 degrees): moves a point out along the diagonal

function draw(c, s)
  local col, len = param.color, param.size
  if s.hitMarker then
    col = param.hit
    len = len + 3
  end
  local a, b = 4 * K, (4 + len) * K
  for _, sx in ipairs({ -1, 1 }) do
    for _, sy in ipairs({ -1, 1 }) do
      c:line(sx * a, sy * a, sx * b, sy * b, 2, col)
    end
  end
end

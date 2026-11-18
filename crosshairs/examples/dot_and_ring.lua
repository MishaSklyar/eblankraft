-- @name Dot and ring
-- @author Eblankraft
-- A centre dot inside a ring that matches the bullet spread. The ring is the area your bullets can reach.

params = {
  dot        = { label = "Dot radius", type = "number", min = 1, max = 8, default = 2, order = 1 },
  ring_alpha = { label = "Ring opacity %", type = "number", min = 0, max = 100, default = 45, order = 2 },
  color      = { label = "Colour", type = "color", default = "#ffffff", order = 3 },
}

function draw(c, s)
  local alpha = string.format("%02x", math.floor(param.ring_alpha / 100 * 255))
  if s.hasGun then
    c:ring(0, 0, math.max(s.spreadPx, 2), 1, param.color .. alpha)
  end
  c:circle(0, 0, param.dot, s.targetLocked and "#ff4d4d" or param.color)
end

-- @name Dynamic gap
-- @author Eblankraft
-- Four ticks that move outwards with the real bullet spread: the wider the cone, the wider the gap.
-- Turns to the target colour when the crosshair is on an enemy or player.

params = {
  size     = { label = "Tick length", type = "number", min = 2, max = 30, default = 7, order = 1 },
  thick    = { label = "Thickness", type = "number", min = 1, max = 6, default = 2, order = 2 },
  color    = { label = "Colour", type = "color", default = "#ffffff", order = 3 },
  target   = { label = "Target colour", type = "color", default = "#ff4d4d", order = 4 },
  min_gap  = { label = "Smallest gap", type = "number", min = 0, max = 20, default = 3, order = 5 },
}

function draw(c, s)
  local gap = math.max(param.min_gap, math.min(s.spreadPx, 200))
  local col = param.color
  if s.targetLocked then col = param.target end
  local l, t = param.size, param.thick
  c:line(0, gap, 0, gap + l, t, col)
  c:line(0, -gap, 0, -(gap + l), t, col)
  c:line(gap, 0, gap + l, 0, t, col)
  c:line(-gap, 0, -(gap + l), 0, t, col)
end

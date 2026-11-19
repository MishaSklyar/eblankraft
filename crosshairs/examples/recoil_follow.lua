-- @name Recoil follow
-- @author Eblankraft
-- Four ticks that jump up with the camera kick of each shot and settle back as it recovers.
-- The gap is the real bullet spread. The dot is the point you were aiming at before the kick.

params = {
  size  = { label = "Tick length", type = "number", min = 2, max = 30, default = 6, order = 1 },
  thick = { label = "Thickness", type = "number", min = 1, max = 6, default = 2, order = 2 },
  color = { label = "Colour", type = "color", default = "#ffffff", order = 3 },
  aim   = { label = "Show aim point", type = "bool", default = true, order = 4 },
}

function draw(c, s)
  local up = -s.recoilPx                 -- negative y is up: the ticks ride up with the kick
  local gap = math.max(3, math.min(s.spreadPx, 200))
  local l, t, col = param.size, param.thick, param.color
  local top = up - gap
  c:line(0, top, 0, top - l, t, col)
  c:line(0, up + gap, 0, up + gap + l, t, col)
  c:line(-gap, up, -(gap + l), up, t, col)
  c:line(gap, up, gap + l, up, t, col)
  if param.aim then
    -- Before the kick, the aim point was this far below the centre. It slides up to the centre as the kick recovers.
    c:circle(0, s.recoilPx, 1.5, col)
  end
end

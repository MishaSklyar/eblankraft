-- @name Scope mil-dots
-- @author Eblankraft
-- A mil-dot reticle while the AWP scope is up, and a small dot otherwise.

params = {
  color = { label = "Colour", type = "color", default = "#ffffff", order = 1 },
  dot   = { label = "Dot radius", type = "number", min = 1, max = 4, default = 1.5, order = 2 },
  step  = { label = "Dot spacing", type = "number", min = 8, max = 40, default = 20, order = 3 },
}

function draw(c, s)
  if not s.scoped then
    c:circle(0, 0, 1.5, param.color)
    return
  end
  local col = param.color
  c:line(0, -200, 0, -6, 1, col)
  c:line(0, 6, 0, 200, 1, col)
  c:line(-200, 0, -6, 0, 1, col)
  c:line(6, 0, 200, 0, 1, col)
  for i = 1, 8 do
    local d = i * param.step
    c:circle(0, d, param.dot, col)
    c:circle(0, -d, param.dot, col)
    c:circle(d, 0, param.dot, col)
    c:circle(-d, 0, param.dot, col)
  end
end

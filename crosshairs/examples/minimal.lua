-- @name Minimal dot
-- @author Eblankraft
-- The smallest valid Lua crosshair: one dot in the middle of the screen.

function draw(c, s)
  c:circle(0, 0, 2, "#ffffff")
end

from PIL import Image, ImageDraw, ImageFont

# 1. Generate ICON0.PNG (144x80)
icon = Image.new("RGBA", (144, 80), (20, 20, 30, 255))
draw = ImageDraw.Draw(icon)

# Border
draw.rectangle([0, 0, 143, 79], outline=(255, 215, 0, 255), width=2)
# Gradient or box
draw.rectangle([4, 4, 139, 75], fill=(35, 45, 65, 255))
# Popcat / block motif
draw.rectangle([10, 15, 45, 50], fill=(85, 170, 85, 255), outline=(50, 120, 50, 255)) # grass block
draw.rectangle([10, 25, 45, 50], fill=(134, 96, 67, 255)) # dirt

# Text
draw.text((52, 18), "EBLAN", fill=(255, 220, 40, 255))
draw.text((52, 32), "KRAFT", fill=(255, 255, 255, 255))
draw.text((52, 48), "2.0 PSP", fill=(60, 220, 240, 255))

icon.save("psp/assets/ICON0.PNG", "PNG")

# 2. Generate PIC1.PNG (480x272)
pic1 = Image.new("RGBA", (480, 272), (15, 12, 25, 255))
draw_pic = ImageDraw.Draw(pic1)

# Sky to ground gradient
for y in range(272):
    r = int(20 + (y / 272.0) * 30)
    g = int(30 + (y / 272.0) * 50)
    b = int(60 + (y / 272.0) * 70)
    draw_pic.line([(0, y), (479, y)], fill=(r, g, b, 255))

# Title
draw_pic.rectangle([40, 60, 440, 210], fill=(10, 15, 25, 200), outline=(255, 215, 0, 255), width=2)
draw_pic.text((90, 80), "EBLANKRAFT 2.0", fill=(255, 215, 0, 255))
draw_pic.text((90, 110), "SONY PLAYSTATION PORTABLE EDITION", fill=(220, 230, 255, 255))
draw_pic.text((90, 135), "Native 3D Voxel Engine (PSP 2000 / 3000)", fill=(100, 220, 150, 255))
draw_pic.text((90, 160), "Dragon Boss, Nether & End, Meme Cases, Survival", fill=(240, 180, 100, 255))

pic1.save("psp/assets/PIC1.PNG", "PNG")
print("Assets generated successfully!")

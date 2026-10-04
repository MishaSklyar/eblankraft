import zlib
import struct

def create_png(width, height, filename):
    # Create an RGB image with pixel block pattern
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter type none
        for x in range(width):
            # Grass block pattern: green top, brown bottom, face in center
            if y < height * 0.35:
                # Green grass
                r, g, b = 91, 140, 50
            else:
                # Brown dirt
                r, g, b = 134, 96, 67

            # Troll / meme face in center
            cx, cy = x / width, y / height
            if 0.35 < cx < 0.45 and 0.4 < cy < 0.55:
                r, g, b = 255, 255, 255 # Eye left
            elif 0.55 < cx < 0.65 and 0.4 < cy < 0.55:
                r, g, b = 255, 255, 255 # Eye right
            elif 0.38 < cx < 0.43 and 0.45 < cy < 0.52:
                r, g, b = 0, 0, 0 # Pupil left
            elif 0.57 < cx < 0.62 and 0.45 < cy < 0.52:
                r, g, b = 0, 0, 0 # Pupil right
            elif 0.35 < cx < 0.65 and 0.65 < cy < 0.8:
                r, g, b = 0, 0, 0 # Mouth

            # Add border
            if x < 4 or x >= width - 4 or y < 4 or y >= height - 4:
                r, g, b = 40, 40, 40

            raw_data.extend([r, g, b])

    compressed = zlib.compress(raw_data)
    
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('!I', len(data)) + tag + data + struct.pack('!I', crc)

    png_header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, 2, 0, 0, 0))
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(png_header + ihdr + idat + iend)

create_png(192, 192, '/root/eblankraft/assets/icon-192.png')
create_png(512, 512, '/root/eblankraft/assets/icon-512.png')
print("Icons created successfully!")

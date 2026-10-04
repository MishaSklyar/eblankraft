#!/usr/bin/env python3
import sys
import struct
import os

def create_gamecube_iso(dol_path, output_iso_path, game_title="Eblankraft 2.0 GameCube", game_id="GEBE01"):
    with open(dol_path, "rb") as f:
        dol_data = f.read()

    # Align DOL offset to 0x10000 (64 KB)
    dol_offset = 0x10000
    dol_size = len(dol_data)

    # Empty FST table at dol_offset + aligned dol_size
    fst_offset = (dol_offset + dol_size + 0x1FF) & ~0x1FF
    # Root FST entry (12 bytes: is_dir=1, name_offset=0, parent=0, num_entries=1)
    fst_data = struct.pack(">III", 0x01000000, 0, 1)

    total_size = (fst_offset + len(fst_data) + 0x7FFF) & ~0x7FFF
    # At least 1.5MB for nice alignment and disc structure
    if total_size < 1572864:
        total_size = 1572864

    iso = bytearray(total_size)

    # 1. Header (0x0000 - 0x0440)
    # Game ID: 6 bytes (e.g. 'G', 'E', 'B', 'E', '0', '1')
    game_id_bytes = game_id.encode('ascii')[:6].ljust(6, b'\x00')
    iso[0:6] = game_id_bytes
    iso[6] = 0x00 # Disc ID
    iso[7] = 0x00 # Version

    # Magic word at 0x1C: 0xC2339F3D
    struct.pack_into(">I", iso, 0x1C, 0xC2339F3D)

    # Game Title (64 bytes)
    title_bytes = game_title.encode('utf-8')[:64]
    iso[0x20:0x20 + len(title_bytes)] = title_bytes

    # DOL Offset at 0x0420
    struct.pack_into(">I", iso, 0x0420, dol_offset)

    # FST Offset, Size, MaxSize at 0x0424
    struct.pack_into(">III", iso, 0x0424, fst_offset, len(fst_data), len(fst_data))

    # User pos & length
    struct.pack_into(">II", iso, 0x0430, fst_offset, len(fst_data))

    # 2. Write DOL
    iso[dol_offset:dol_offset + dol_size] = dol_data

    # 3. Write FST
    iso[fst_offset:fst_offset + len(fst_data)] = fst_data

    with open(output_iso_path, "wb") as f:
        f.write(iso)

    print(f"Created GameCube ISO: {output_iso_path} ({len(iso)} bytes)")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: make_gc_iso.py <input.dol> <output.iso>")
        sys.exit(1)
    create_gamecube_iso(sys.argv[1], sys.argv[2])

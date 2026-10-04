#!/usr/bin/env python3
"""Собрать .eblan пак = обычный ZIP. python3 eblan_pack.py <папка> [выход.eblan]"""
import os
import sys
import zipfile

SKIP = {'.DS_Store', 'Thumbs.db'}


def pack(src_dir, out_path):
    n = 0
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(src_dir):
            for f in files:
                if f in SKIP:
                    continue
                full = os.path.join(root, f)
                arc = os.path.relpath(full, src_dir).replace(os.sep, '/')
                z.write(full, arc)
                n += 1
    size = os.path.getsize(out_path)
    print(f'OK: {out_path} ({n} files, {size / 1024:.1f} KB)')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else src.rstrip('/\\') + '.eblan'
    pack(src, out)

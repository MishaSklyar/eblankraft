#!/bin/bash
set -e

echo "=== Building Eblankraft 2.0 for Nintendo GameCube (DOL & ISO) ==="

mkdir -p dist_gamecube

# 1. Compile DOL via devkitPPC
docker run --rm -v "$(pwd):/src" -w /src/gamecube devkitpro/devkitppc:latest bash -c "
    make clean
    make -j\$(nproc)
"

cp gamecube/eblankraft.dol dist_gamecube/eblankraft.dol

# 2. Build GameCube Bootable ISO
python3 make_gc_iso.py dist_gamecube/eblankraft.dol dist_gamecube/eblankraft_gamecube.iso

echo "=== BUILD COMPLETED ==="
echo "1. GameCube DOL Executable: dist_gamecube/eblankraft.dol"
echo "2. GameCube Bootable Disc: dist_gamecube/eblankraft_gamecube.iso"
ls -lh dist_gamecube/

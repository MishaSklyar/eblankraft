#!/bin/bash
set -e

echo "=== Building Eblankraft 2.0 for PC (Native C / SDL2 / OpenGL) ==="
make -C pc
echo "=== BUILD COMPLETE: dist_pc/eblankraft ==="

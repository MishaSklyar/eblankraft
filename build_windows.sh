#!/bin/bash
set -e

echo "=== Building Eblankraft 2.0 for Windows (x86_64) via MinGW ==="
mkdir -p dist_windows

# Ensure SDL2 mingw libraries exist
if [ ! -d "tools/sdl2_mingw/x86_64-w64-mingw32" ]; then
    echo "Downloading SDL2 Windows development library..."
    mkdir -p tools/sdl2_mingw
    curl -L https://github.com/libsdl-org/SDL/releases/download/release-2.30.12/SDL2-devel-2.30.12-mingw.tar.gz | tar -xz -C tools/sdl2_mingw --strip-components=1
fi

x86_64-w64-mingw32-gcc -O3 -Wall -Wextra \
    -Ipc/src \
    -Itools/sdl2_mingw/x86_64-w64-mingw32/include \
    -Itools/sdl2_mingw/x86_64-w64-mingw32/include/SDL2 \
    pc/src/*.c \
    -Ltools/sdl2_mingw/x86_64-w64-mingw32/lib \
    -lSDL2 -lopengl32 -lglu32 -lm \
    -o dist_windows/eblankraft.exe

cp tools/sdl2_mingw/x86_64-w64-mingw32/bin/SDL2.dll dist_windows/

cd dist_windows
zip -r eblankraft_windows.zip eblankraft.exe SDL2.dll
cd ..

echo "=== BUILD COMPLETE: dist_windows/eblankraft.exe & eblankraft_windows.zip ==="

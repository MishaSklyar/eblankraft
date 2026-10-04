#!/bin/bash

# Prefer DOL for direct GameCube homebrew execution in Dolphin
TARGET="$(pwd)/dist_gamecube/eblankraft.dol"
if [ ! -f "$TARGET" ]; then
    TARGET="$(pwd)/dist_gamecube/eblankraft_gamecube.iso"
fi

echo "Launching Dolphin Emulator with: $TARGET"

# 1. Native dolphin-emu
if command -v dolphin-emu &> /dev/null; then
    exec dolphin-emu -e "$TARGET" "$@" 2> >(grep -v "qtpaths: command not found" >&2)
elif command -v dolphin-emu-nogui &> /dev/null; then
    exec dolphin-emu-nogui -e "$TARGET" "$@"
# 2. Flatpak dolphin
elif command -v flatpak &> /dev/null && flatpak list | grep -q "org.DolphinEmu.dolphin-emu"; then
    exec flatpak run org.DolphinEmu.dolphin-emu -e "$TARGET" "$@"
else
    echo "Dolphin Emulator not found in PATH or Flatpak."
    echo "You can run either:"
    echo "  1. $TARGET on real GameCube / Wii (via Swiss / SD Gecko / GC Loader)"
    echo "  2. Install Dolphin: 'sudo pacman -S dolphin-emu'"
fi

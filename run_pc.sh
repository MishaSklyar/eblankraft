#!/bin/bash
TARGET="$(pwd)/dist_pc/eblankraft"
if [ ! -f "$TARGET" ]; then
    ./build_pc.sh
fi
echo "Launching Eblankraft 2.0 PC Native..."
exec "$TARGET" "$@"

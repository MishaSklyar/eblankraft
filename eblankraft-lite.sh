#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Force bypass VSync at the driver level:
# NVIDIA (RTX 3060, etc.)
export __GL_SYNC_TO_VBLANK=0
# Intel Mesa & AMD (Netbook 2010, Intel GMA/Ironlake/Iris, Radeon)
export vblank_mode=0
# Qt OpenGL integration
export QT_XCB_GL_INTEGRATION=xcb_glx

# 🚀 ASUS UL20FT / Intel GMA HD / Ironlake (2010) Netbook Optimizations:
# 1. Use modern Gallium3D crocus driver (much faster than legacy i965)
export MESA_LOADER_DRIVER_OVERRIDE=crocus
# 2. Multithreaded OpenGL dispatch (offloads draw calls to 2nd CPU core of Celeron/Core 2 Duo)
export mesa_glthread=true
# 3. Disable redundant OpenGL error checking overhead
export MESA_NO_ERROR=1
export INTEL_DEBUG=noccs

# Chromium extreme frame rate & hardware acceleration flags
export QTWEBENGINE_CHROMIUM_FLAGS="--disable-frame-rate-limit --disable-gpu-vsync --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --enable-webgl --enable-accelerated-2d-canvas --disable-background-timer-throttling --disable-renderer-backgrounding --canvas-oop-rasterization --enable-low-res-tiling --num-raster-threads=2"

python3 "$DIR/eblankraft_lite.py" "$@"

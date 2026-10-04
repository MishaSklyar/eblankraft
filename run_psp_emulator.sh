#!/bin/bash
# Run ISO if available, otherwise EBOOT.PBP
if [ -f "dist_psp/eblankraft.iso" ]; then
    PPSSPPSDL dist_psp/eblankraft.iso "$@"
else
    PPSSPPSDL dist_psp/EBOOT.PBP "$@"
fi

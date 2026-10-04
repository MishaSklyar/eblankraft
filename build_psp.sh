#!/bin/bash
set -e

echo "=== Building Eblankraft 2.0 for Sony PSP (PBP & ISO) ==="

mkdir -p dist_psp

# 1. Compile PRX and EBOOT.PBP via PSPSDK
docker run --rm -v "$(pwd):/src" -w /src/psp pspdev/pspdev:latest bash -c "
    make clean
    make BUILD_PRX=1 -j\$(nproc)
    mksfoex -d MEMSIZE=2 -s CATEGORY=UG -s DISC_ID=ULES01234 -s DISC_VERSION=1.00 'Eblankraft 2.0 PSP' iso_param.sfo
"

cp psp/EBOOT.PBP dist_psp/EBOOT.PBP

# 2. Build UMD ISO (eblankraft.iso)
rm -rf iso_build
mkdir -p iso_build/PSP_GAME/SYSDIR
mkdir -p iso_build/PSP_GAME/USRDIR

cp psp/iso_param.sfo iso_build/PSP_GAME/PARAM.SFO
cp psp/assets/ICON0.PNG iso_build/PSP_GAME/ICON0.PNG
cp psp/assets/PIC1.PNG iso_build/PSP_GAME/PIC1.PNG
cp psp/eblankraft.prx iso_build/PSP_GAME/SYSDIR/EBOOT.BIN
cp psp/eblankraft.prx iso_build/PSP_GAME/SYSDIR/BOOT.BIN

printf "ULES-01234|00000001|\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00" > iso_build/UMD_DATA.BIN

mkisofs -iso-level 4 -xa -A "PSP GAME" -V "EBLANKRAFT" -sysid "PSP GAME" -volset "" -p "" -publisher "" -o dist_psp/eblankraft.iso iso_build
rm -rf iso_build psp/iso_param.sfo

echo "=== BUILD COMPLETED ==="
echo "1. Homebrew PBP: dist_psp/EBOOT.PBP"
echo "2. UMD Disc ISO: dist_psp/eblankraft.iso"
ls -lh dist_psp/

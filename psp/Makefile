TARGET = eblankraft
OBJS = src/main.o src/renderer.o src/textures.o src/ripped_atlas.o src/font.o src/blocks.o src/items.o src/world.o src/player.o src/dragon.o src/mobs.o src/cases.o src/ui.o src/audio.o

INCDIR = 
CFLAGS = -O3 -G0 -Wall -Wno-unused-variable -Wno-unused-but-set-variable -ffast-math
CXXFLAGS = $(CFLAGS) -fno-exceptions -fno-rtti
ASFLAGS = $(CFLAGS)

LIBDIR =
LDFLAGS =
LIBS = -lpspgum -lpspgu -lpspdisplay -lpspctrl -lpsppower -lpsprtc -lpspaudiolib -lpspaudio -lm

PSP_LARGE_MEMORY = 1
EXTRA_TARGETS = EBOOT.PBP
PSP_EBOOT_TITLE = Eblankraft 2.0 PSP
PSP_EBOOT_ICON = assets/ICON0.PNG
PSP_EBOOT_PIC1 = assets/PIC1.PNG

PSPSDK=$(shell psp-config --pspsdk-path)
include $(PSPSDK)/lib/build.mak

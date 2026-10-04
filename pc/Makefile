CC := gcc
CFLAGS := -O3 -Wall -Wextra -D_GNU_SOURCE=1 -Isrc $(shell pkg-config --cflags sdl2 gl glu 2>/dev/null || echo "-I/usr/include/SDL2")
LDFLAGS := $(shell pkg-config --libs sdl2 gl glu 2>/dev/null || echo "-lSDL2 -lGL -lGLU") -lm

SRC := $(wildcard src/*.c)
OBJ := $(SRC:.c=.o)
TARGET := ../dist_pc/eblankraft

all: $(TARGET)

$(TARGET): $(OBJ)
	@mkdir -p ../dist_pc
	$(CC) $(OBJ) -o $@ $(LDFLAGS)
	@echo "Build successful: $@"

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f src/*.o $(TARGET)

.PHONY: all clean

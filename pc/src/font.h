#ifndef EBLANKRAFT_FONT_H
#define EBLANKRAFT_FONT_H

#include "common.h"

void font_init(void);
void font_draw_char(int x, int y, char c, uint32_t color, int scale);
void font_draw_text(int x, int y, const char* str, uint32_t color, int scale);
void font_draw_text_shadow(int x, int y, const char* str, uint32_t color, int scale);
int  font_get_text_width(const char* str, int scale);

#endif // EBLANKRAFT_FONT_H

#include "audio.h"
#include <pspaudio.h>
#include <pspaudiolib.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

#define MAX_VOICES 8
#define SAMPLE_RATE 44100
#define PI 3.14159265358979323846f

typedef struct {
    SoundId id;
    int pos;
    int length;
    float phase;
} Voice;

typedef struct {
    short l, r;
} AudioSample;

static Voice g_voices[MAX_VOICES];
static int g_audio_channel = -1;

static void audio_callback(void* buf, unsigned int length, void* userdata) {
    AudioSample* out = (AudioSample*)buf;
    memset(buf, 0, length * sizeof(AudioSample));

    for (unsigned int s = 0; s < length; s++) {
        float mix = 0.0f;

        for (int v = 0; v < MAX_VOICES; v++) {
            Voice* voice = &g_voices[v];
            if (voice->id == SOUND_NONE) continue;

            float t = (float)voice->pos / (float)voice->length;
            float val = 0.0f;

            switch (voice->id) {
                case SOUND_HURT: {
                    // Minecraft-style hurt: crunchy low pitch drop (160Hz -> 65Hz)
                    float freq = 160.0f - 95.0f * t;
                    voice->phase += (2.0f * PI * freq) / (float)SAMPLE_RATE;
                    float saw = (fmodf(voice->phase, 2.0f * PI) / PI) - 1.0f;
                    float env = (1.0f - t) * (1.0f - t);
                    val = saw * env * 0.75f;
                    break;
                }
                case SOUND_BREAK: {
                    // Crisp snap + thud
                    float noise = ((float)(rand() % 2000) - 1000.0f) / 1000.0f;
                    float thud = sinf(2.0f * PI * (130.0f - 60.0f * t) * (float)voice->pos / (float)SAMPLE_RATE);
                    float env = expf(-t * 9.0f);
                    val = (noise * 0.5f + thud * 0.5f) * env * 0.7f;
                    break;
                }
                case SOUND_PLACE: {
                    // Warm pop
                    voice->phase += (2.0f * PI * (220.0f - 140.0f * t)) / (float)SAMPLE_RATE;
                    float env = expf(-t * 14.0f);
                    val = sinf(voice->phase) * env * 0.65f;
                    break;
                }
                case SOUND_JUMP: {
                    // Upward sweep (140Hz -> 320Hz)
                    voice->phase += (2.0f * PI * (140.0f + 200.0f * t)) / (float)SAMPLE_RATE;
                    float env = (1.0f - t);
                    val = sinf(voice->phase) * env * 0.45f;
                    break;
                }
                case SOUND_CLICK: {
                    // UI Click (1800Hz)
                    voice->phase += (2.0f * PI * 1800.0f) / (float)SAMPLE_RATE;
                    float env = expf(-t * 35.0f);
                    val = sinf(voice->phase) * env * 0.4f;
                    break;
                }
                case SOUND_EXPLOSION: {
                    // Low rumble + harsh noise
                    float noise = ((float)(rand() % 2000) - 1000.0f) / 1000.0f;
                    float bass = sinf(2.0f * PI * (65.0f - 35.0f * t) * (float)voice->pos / (float)SAMPLE_RATE);
                    float env = (1.0f - t);
                    val = (noise * 0.6f + bass * 0.6f) * env * 0.85f;
                    break;
                }
                default:
                    break;
            }

            mix += val;
            voice->pos++;
            if (voice->pos >= voice->length) {
                voice->id = SOUND_NONE;
            }
        }

        if (mix > 1.0f) mix = 1.0f;
        if (mix < -1.0f) mix = -1.0f;
        short out_s = (short)(mix * 30000.0f);
        out[s].l = out_s;
        out[s].r = out_s;
    }
}

void audio_init(void) {
    memset(g_voices, 0, sizeof(g_voices));
    pspAudioInit();
    g_audio_channel = 0;
    pspAudioSetChannelCallback(g_audio_channel, audio_callback, NULL);
}

void audio_play(SoundId id) {
    if (id == SOUND_NONE) return;

    int free_idx = -1;
    for (int i = 0; i < MAX_VOICES; i++) {
        if (g_voices[i].id == SOUND_NONE) {
            free_idx = i;
            break;
        }
    }
    if (free_idx == -1) free_idx = 0; // Overwrite oldest

    Voice* v = &g_voices[free_idx];
    v->id = id;
    v->pos = 0;
    v->phase = 0.0f;

    switch (id) {
        case SOUND_HURT:      v->length = (int)(SAMPLE_RATE * 0.20f); break;
        case SOUND_BREAK:     v->length = (int)(SAMPLE_RATE * 0.14f); break;
        case SOUND_PLACE:     v->length = (int)(SAMPLE_RATE * 0.09f); break;
        case SOUND_JUMP:      v->length = (int)(SAMPLE_RATE * 0.12f); break;
        case SOUND_CLICK:     v->length = (int)(SAMPLE_RATE * 0.04f); break;
        case SOUND_EXPLOSION: v->length = (int)(SAMPLE_RATE * 0.65f); break;
        default:              v->length = (int)(SAMPLE_RATE * 0.10f); break;
    }
}

void audio_term(void) {
    pspAudioEnd();
}

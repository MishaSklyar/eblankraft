#include "audio.h"
#include <asndlib.h>
#include <math.h>

#define SAMPLE_RATE 44100
#define MAX_CHANNELS 8

typedef struct {
    int16_t* buffer;
    int size_bytes;
} PrecalcSound;

static PrecalcSound s_sounds[SOUND_COUNT];
static int s_next_voice = 0;

static void synthesize_sound(SoundId id, float duration) {
    int num_samples = (int)(SAMPLE_RATE * duration);
    // Align size to 32 bytes for GameCube DMA
    int size_bytes = (num_samples * sizeof(int16_t) + 31) & ~31;
    int16_t* buf = (int16_t*)memalign(32, size_bytes);
    if (!buf) return;
    memset(buf, 0, size_bytes);

    float phase = 0.0f;
    for (int i = 0; i < num_samples; i++) {
        float t = (float)i / (float)num_samples;
        float val = 0.0f;

        switch (id) {
            case SOUND_HURT: {
                // Minecraft-style hurt: crunchy low pitch drop (160Hz -> 65Hz)
                float freq = 160.0f - 95.0f * t;
                phase += (2.0f * PI * freq) / (float)SAMPLE_RATE;
                float saw = (fmodf(phase, 2.0f * PI) / PI) - 1.0f;
                float env = (1.0f - t) * (1.0f - t);
                val = saw * env * 0.75f;
                break;
            }
            case SOUND_BREAK: {
                // Crisp snap + thud
                float noise = ((float)(rand() % 2000) - 1000.0f) / 1000.0f;
                float thud = sinf(2.0f * PI * (130.0f - 60.0f * t) * (float)i / (float)SAMPLE_RATE);
                float env = expf(-t * 9.0f);
                val = (noise * 0.5f + thud * 0.5f) * env * 0.7f;
                break;
            }
            case SOUND_PLACE: {
                // Warm pop
                phase += (2.0f * PI * (220.0f - 140.0f * t)) / (float)SAMPLE_RATE;
                float env = expf(-t * 14.0f);
                val = sinf(phase) * env * 0.65f;
                break;
            }
            case SOUND_JUMP: {
                // Upward sweep (140Hz -> 320Hz)
                phase += (2.0f * PI * (140.0f + 200.0f * t)) / (float)SAMPLE_RATE;
                float env = (1.0f - t);
                val = sinf(phase) * env * 0.45f;
                break;
            }
            case SOUND_CLICK: {
                // UI Click (1800Hz)
                phase += (2.0f * PI * 1800.0f) / (float)SAMPLE_RATE;
                float env = expf(-t * 35.0f);
                val = sinf(phase) * env * 0.4f;
                break;
            }
            case SOUND_EXPLOSION: {
                // Low rumble + harsh noise
                float noise = ((float)(rand() % 2000) - 1000.0f) / 1000.0f;
                float bass = sinf(2.0f * PI * (65.0f - 35.0f * t) * (float)i / (float)SAMPLE_RATE);
                float env = (1.0f - t);
                val = (noise * 0.6f + bass * 0.6f) * env * 0.85f;
                break;
            }
            default:
                break;
        }

        if (val > 1.0f) val = 1.0f;
        if (val < -1.0f) val = -1.0f;
        buf[i] = (int16_t)(val * 30000.0f);
    }

    DCStoreRange(buf, size_bytes);

    s_sounds[id].buffer = buf;
    s_sounds[id].size_bytes = size_bytes;
}

void audio_init(void) {
    memset(s_sounds, 0, sizeof(s_sounds));
    ASND_Init();
    ASND_Pause(0);

    synthesize_sound(SOUND_HURT, 0.20f);
    synthesize_sound(SOUND_BREAK, 0.14f);
    synthesize_sound(SOUND_PLACE, 0.09f);
    synthesize_sound(SOUND_JUMP, 0.12f);
    synthesize_sound(SOUND_CLICK, 0.04f);
    synthesize_sound(SOUND_EXPLOSION, 0.65f);
}

void audio_play(SoundId id) {
    if (id <= SOUND_NONE || id >= SOUND_COUNT) return;
    if (!s_sounds[id].buffer) return;

    int voice = s_next_voice;
    s_next_voice = (s_next_voice + 1) % MAX_CHANNELS;

    ASND_StopVoice(voice);
    ASND_SetVoice(voice, VOICE_MONO_16BIT, SAMPLE_RATE, 0,
                  s_sounds[id].buffer, s_sounds[id].size_bytes, 255, 255, NULL);
}

void audio_term(void) {
    for (int i = 0; i < SOUND_COUNT; i++) {
        if (s_sounds[i].buffer) {
            free(s_sounds[i].buffer);
            s_sounds[i].buffer = NULL;
        }
    }
}

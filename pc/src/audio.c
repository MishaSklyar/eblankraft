#include "audio.h"

#define SAMPLE_RATE 44100
#define MAX_VOICES 16

typedef struct {
    int16_t* buffer;
    int num_samples;
} PrecalcSound;

typedef struct {
    const int16_t* samples;
    int total_samples;
    int cursor;
    bool active;
} ActiveVoice;

static PrecalcSound s_sounds[SOUND_COUNT];
static ActiveVoice s_voices[MAX_VOICES];
static SDL_AudioDeviceID s_device_id = 0;

static void audio_callback(void* userdata, Uint8* stream, int len) {
    (void)userdata;
    int16_t* out = (int16_t*)stream;
    int samples_to_render = len / sizeof(int16_t);

    for (int i = 0; i < samples_to_render; i++) {
        int32_t mix = 0;
        for (int v = 0; v < MAX_VOICES; v++) {
            if (s_voices[v].active) {
                mix += s_voices[v].samples[s_voices[v].cursor++];
                if (s_voices[v].cursor >= s_voices[v].total_samples) {
                    s_voices[v].active = false;
                }
            }
        }
        if (mix > 32767) mix = 32767;
        if (mix < -32768) mix = -32768;
        out[i] = (int16_t)mix;
    }
}

static void synthesize_sound(SoundId id, float duration) {
    int num_samples = (int)(SAMPLE_RATE * duration);
    int16_t* buf = (int16_t*)malloc(num_samples * sizeof(int16_t));
    if (!buf) return;

    float phase = 0.0f;
    for (int i = 0; i < num_samples; i++) {
        float t = (float)i / (float)num_samples;
        float val = 0.0f;

        switch (id) {
            case SOUND_HURT: {
                // Minecraft-style hurt: crunchy low pitch drop (160Hz -> 65Hz)
                float freq = 160.0f - 95.0f * t;
                phase += (2.0f * M_PI * freq) / (float)SAMPLE_RATE;
                float saw = (fmodf(phase, 2.0f * M_PI) / M_PI) - 1.0f;
                float env = (1.0f - t) * (1.0f - t);
                val = saw * env * 0.75f;
                break;
            }
            case SOUND_BREAK: {
                // Crisp snap + thud
                float noise = ((float)(rand() % 2000) - 1000.0f) / 1000.0f;
                float thud = sinf(2.0f * M_PI * (130.0f - 60.0f * t) * (float)i / (float)SAMPLE_RATE);
                float env = expf(-t * 9.0f);
                val = (noise * 0.5f + thud * 0.5f) * env * 0.7f;
                break;
            }
            case SOUND_PLACE: {
                // Warm pop
                phase += (2.0f * M_PI * (220.0f - 140.0f * t)) / (float)SAMPLE_RATE;
                float env = expf(-t * 14.0f);
                val = sinf(phase) * env * 0.65f;
                break;
            }
            case SOUND_JUMP: {
                // Upward sweep (140Hz -> 320Hz)
                phase += (2.0f * M_PI * (140.0f + 200.0f * t)) / (float)SAMPLE_RATE;
                float env = (1.0f - t);
                val = sinf(phase) * env * 0.45f;
                break;
            }
            case SOUND_CLICK: {
                // UI Click (1800Hz)
                phase += (2.0f * M_PI * 1800.0f) / (float)SAMPLE_RATE;
                float env = expf(-t * 35.0f);
                val = sinf(phase) * env * 0.4f;
                break;
            }
            case SOUND_EXPLOSION: {
                // Low rumble + harsh noise
                float noise = ((float)(rand() % 2000) - 1000.0f) / 1000.0f;
                float bass = sinf(2.0f * M_PI * (65.0f - 35.0f * t) * (float)i / (float)SAMPLE_RATE);
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

    s_sounds[id].buffer = buf;
    s_sounds[id].num_samples = num_samples;
}

void audio_init(void) {
    memset(s_sounds, 0, sizeof(s_sounds));
    memset(s_voices, 0, sizeof(s_voices));

    synthesize_sound(SOUND_HURT, 0.20f);
    synthesize_sound(SOUND_BREAK, 0.14f);
    synthesize_sound(SOUND_PLACE, 0.09f);
    synthesize_sound(SOUND_JUMP, 0.12f);
    synthesize_sound(SOUND_CLICK, 0.04f);
    synthesize_sound(SOUND_EXPLOSION, 0.65f);

    SDL_AudioSpec desired, obtained;
    SDL_zero(desired);
    desired.freq = SAMPLE_RATE;
    desired.format = AUDIO_S16SYS;
    desired.channels = 1;
    desired.samples = 1024;
    desired.callback = audio_callback;

    s_device_id = SDL_OpenAudioDevice(NULL, 0, &desired, &obtained, 0);
    if (s_device_id > 0) {
        SDL_PauseAudioDevice(s_device_id, 0);
    }
}

void audio_play(SoundId id) {
    if (id <= SOUND_NONE || id >= SOUND_COUNT) return;
    if (!s_sounds[id].buffer || s_device_id == 0) return;

    SDL_LockAudioDevice(s_device_id);
    for (int v = 0; v < MAX_VOICES; v++) {
        if (!s_voices[v].active) {
            s_voices[v].samples = s_sounds[id].buffer;
            s_voices[v].total_samples = s_sounds[id].num_samples;
            s_voices[v].cursor = 0;
            s_voices[v].active = true;
            break;
        }
    }
    SDL_UnlockAudioDevice(s_device_id);
}

void audio_term(void) {
    if (s_device_id > 0) {
        SDL_CloseAudioDevice(s_device_id);
        s_device_id = 0;
    }
    for (int i = 0; i < SOUND_COUNT; i++) {
        if (s_sounds[i].buffer) {
            free(s_sounds[i].buffer);
            s_sounds[i].buffer = NULL;
        }
    }
}

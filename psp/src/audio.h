#ifndef EBLANKRAFT_AUDIO_H
#define EBLANKRAFT_AUDIO_H

typedef enum {
    SOUND_NONE = 0,
    SOUND_HURT,
    SOUND_BREAK,
    SOUND_PLACE,
    SOUND_JUMP,
    SOUND_CLICK,
    SOUND_EXPLOSION
} SoundId;

void audio_init(void);
void audio_play(SoundId id);
void audio_term(void);

#endif // EBLANKRAFT_AUDIO_H

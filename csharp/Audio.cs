using System;
using Raylib_cs;

namespace Eblankraft;

public static class Audio
{
    private static Sound s_sndHurt;
    private static Sound s_sndBreak;
    private static Sound s_sndPlace;
    private static Sound s_sndJump;
    private static Sound s_sndClick;
    private static Sound s_sndExplode;
    private static bool s_initialized;

    private static unsafe Sound GenerateSound(int sampleRate, short[] samples)
    {
        fixed (short* ptr = samples)
        {
            Wave wave = new Wave
            {
                FrameCount = (uint)samples.Length,
                SampleRate = (uint)sampleRate,
                SampleSize = 16,
                Channels = 1,
                Data = (void*)ptr
            };
            return Raylib.LoadSoundFromWave(wave);
        }
    }

    public static void Init()
    {
        if (s_initialized) return;

        Raylib.InitAudioDevice();

        const int rate = 44100;
        const float PI = MathF.PI;
        Random rng = new Random(42);

        // 1. PSP Hurt: Minecraft-style hurt: crunchy low pitch drop (160Hz -> 65Hz)
        {
            int len = (int)(rate * 0.20f);
            short[] pcm = new short[len];
            float phase = 0f;
            for (int i = 0; i < len; i++)
            {
                float t = (float)i / len;
                float freq = 160.0f - 95.0f * t;
                phase += (2.0f * PI * freq) / rate;
                float saw = ((phase % (2.0f * PI)) / PI) - 1.0f;
                float env = (1.0f - t) * (1.0f - t);
                float val = saw * env * 0.75f;
                val = Math.Clamp(val, -1.0f, 1.0f);
                pcm[i] = (short)(val * 30000.0f);
            }
            s_sndHurt = GenerateSound(rate, pcm);
        }

        // 2. PSP Break: Crisp snap + thud
        {
            int len = (int)(rate * 0.14f);
            short[] pcm = new short[len];
            for (int i = 0; i < len; i++)
            {
                float t = (float)i / len;
                float noise = ((float)rng.NextDouble() * 2.0f - 1.0f);
                float thud = MathF.Sin(2.0f * PI * (130.0f - 60.0f * t) * (float)i / rate);
                float env = MathF.Exp(-t * 9.0f);
                float val = (noise * 0.5f + thud * 0.5f) * env * 0.7f;
                val = Math.Clamp(val, -1.0f, 1.0f);
                pcm[i] = (short)(val * 30000.0f);
            }
            s_sndBreak = GenerateSound(rate, pcm);
        }

        // 3. PSP Place: Warm pop
        {
            int len = (int)(rate * 0.09f);
            short[] pcm = new short[len];
            float phase = 0f;
            for (int i = 0; i < len; i++)
            {
                float t = (float)i / len;
                phase += (2.0f * PI * (220.0f - 140.0f * t)) / rate;
                float env = MathF.Exp(-t * 14.0f);
                float val = MathF.Sin(phase) * env * 0.65f;
                val = Math.Clamp(val, -1.0f, 1.0f);
                pcm[i] = (short)(val * 30000.0f);
            }
            s_sndPlace = GenerateSound(rate, pcm);
        }

        // 4. PSP Jump: Upward sweep (140Hz -> 320Hz)
        {
            int len = (int)(rate * 0.12f);
            short[] pcm = new short[len];
            float phase = 0f;
            for (int i = 0; i < len; i++)
            {
                float t = (float)i / len;
                phase += (2.0f * PI * (140.0f + 200.0f * t)) / rate;
                float env = (1.0f - t);
                float val = MathF.Sin(phase) * env * 0.45f;
                val = Math.Clamp(val, -1.0f, 1.0f);
                pcm[i] = (short)(val * 30000.0f);
            }
            s_sndJump = GenerateSound(rate, pcm);
        }

        // 5. PSP Click: UI Click (1800Hz)
        {
            int len = (int)(rate * 0.04f);
            short[] pcm = new short[len];
            float phase = 0f;
            for (int i = 0; i < len; i++)
            {
                float t = (float)i / len;
                phase += (2.0f * PI * 1800.0f) / rate;
                float env = MathF.Exp(-t * 35.0f);
                float val = MathF.Sin(phase) * env * 0.4f;
                val = Math.Clamp(val, -1.0f, 1.0f);
                pcm[i] = (short)(val * 30000.0f);
            }
            s_sndClick = GenerateSound(rate, pcm);
        }

        // 6. PSP Explosion: Low rumble + harsh noise
        {
            int len = (int)(rate * 0.65f);
            short[] pcm = new short[len];
            for (int i = 0; i < len; i++)
            {
                float t = (float)i / len;
                float noise = ((float)rng.NextDouble() * 2.0f - 1.0f);
                float bass = MathF.Sin(2.0f * PI * (65.0f - 35.0f * t) * (float)i / rate);
                float env = (1.0f - t);
                float val = (noise * 0.6f + bass * 0.6f) * env * 0.85f;
                val = Math.Clamp(val, -1.0f, 1.0f);
                pcm[i] = (short)(val * 30000.0f);
            }
            s_sndExplode = GenerateSound(rate, pcm);
        }

        s_initialized = true;
    }

    public static void PlayHurt() { if (s_initialized) Raylib.PlaySound(s_sndHurt); }
    public static void PlayBreak() { if (s_initialized) Raylib.PlaySound(s_sndBreak); }
    public static void PlayPlace() { if (s_initialized) Raylib.PlaySound(s_sndPlace); }
    public static void PlayJump() { if (s_initialized) Raylib.PlaySound(s_sndJump); }
    public static void PlayClick() { if (s_initialized) Raylib.PlaySound(s_sndClick); }
    public static void PlayExplosion() { if (s_initialized) Raylib.PlaySound(s_sndExplode); }

    public static void Close()
    {
        if (!s_initialized) return;
        Raylib.UnloadSound(s_sndHurt);
        Raylib.UnloadSound(s_sndBreak);
        Raylib.UnloadSound(s_sndPlace);
        Raylib.UnloadSound(s_sndJump);
        Raylib.UnloadSound(s_sndClick);
        Raylib.UnloadSound(s_sndExplode);
        Raylib.CloseAudioDevice();
        s_initialized = false;
    }
}

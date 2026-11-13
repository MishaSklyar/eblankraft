// RTX sky + clouds: procedural atmosphere evaluated inside the RTX final pass (see rtx.js FinalShader).
//
// Only pixels the god-ray pass flagged as "sky" (alpha = sky mask) pay for it, so terrain costs nothing extra.
//   * horizon-to-zenith gradient that follows the day/night cycle, tinted from the fog colour so distant terrain blends in
//   * sunset / sunrise glow on the sun's side, Mie halo, sun + moon discs (the sprites are hidden while this is on)
//   * twinkling stars at night
//   * lit cumulus layer (self-shadowed toward the sun, silver lining) + thin cirrus streaks, drifting with the wind
// 100% procedural (hash noise, no textures, no downloads), so it works offline and costs no extra memory.
// Authored in display space, like the clear colour it replaces; never tone-mapped.
window.RTX_SKY_GLSL = `
    uniform mat4 skyInvProj; uniform mat4 skyCamWorld;
    uniform vec3 skyCamPos, skySun, skyMoon;
    uniform float skyTime, skyOn, skyClouds;

    float sk_h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float sk_h31(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    float sk_vn(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(sk_h21(i), sk_h21(i + vec2(1.0, 0.0)), f.x), mix(sk_h21(i + vec2(0.0, 1.0)), sk_h21(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float sk_fbm5(vec2 p) {
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 5; i++) { s += a * sk_vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; }
        return s;
    }
    float sk_fbm3(vec2 p) {
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 3; i++) { s += a * sk_vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; }
        return s;
    }
    float sk_cloud5(vec2 p) {
        float d = sk_fbm5(p) * mix(0.82, 1.18, sk_vn(p * 0.23 + 4.0));      // big clear patches / dense banks
        return smoothstep(0.5, 0.8, d);
    }
    float sk_cloud3(vec2 p) {
        float d = sk_fbm3(p) * mix(0.82, 1.18, sk_vn(p * 0.23 + 4.0));
        return smoothstep(0.5, 0.8, d);
    }

    // view ray for this screen pixel
    vec3 sk_viewDir(vec2 uv) {
        vec4 v = skyInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        return normalize((skyCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
    }

    // horizon = the fog colour as the terrain shows it, so far hills melt into the sky
    vec3 sk_sky(vec3 dir, vec3 horizon) {
        float sunY = skySun.y;
        float day = smoothstep(-0.12, 0.25, sunY);
        float night = 1.0 - smoothstep(-0.22, 0.06, sunY);
        float up = clamp(dir.y, 0.0, 1.0);

        vec3 zenith = mix(horizon * 0.42, vec3(0.15, 0.37, 0.82), day);
        vec3 col = mix(horizon, zenith, pow(up, 0.42));

        // sunrise / sunset: warm band on the sun's side of the horizon
        float twilight = 1.0 - smoothstep(0.0, 0.5, abs(sunY));
        vec2 dh = normalize(dir.xz + 1e-5), sh = normalize(skySun.xz + 1e-5);
        float side = max(dot(dh, sh), 0.0);
        col += vec3(1.0, 0.42, 0.14) * twilight * (0.25 + 0.75 * pow(side, 3.0)) * pow(1.0 - up, 3.5) * 0.85 * step(-0.35, sunY);

        // Mie halo around the sun
        float sd = max(dot(dir, skySun), 0.0);
        col += mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.55, 0.25), twilight) * (pow(sd, 14.0) * 0.22 + pow(sd, 220.0) * 0.5) * smoothstep(-0.18, 0.0, sunY);
        // sun disc
        col = mix(col, vec3(1.0, 0.97, 0.86), smoothstep(0.9984, 0.9990, sd) * step(-0.04, sunY));

        // stars (hidden by daylight, fade near the horizon)
        if (night > 0.01 && dir.y > 0.0) {
            vec3 sp = dir * 120.0;
            vec3 ip = floor(sp);
            float h = sk_h31(ip);
            vec3 f = fract(sp) - 0.5 + (vec3(sk_h31(ip + 3.1), sk_h31(ip + 7.7), sk_h31(ip + 1.3)) - 0.5) * 0.5;
            float star = step(0.987, h) * smoothstep(0.34, 0.0, length(f));
            float tw = 0.7 + 0.3 * sin(skyTime * 3.0 + h * 80.0);
            col += vec3(0.9, 0.95, 1.0) * star * tw * night * smoothstep(0.0, 0.15, dir.y) * 1.2;
        }

        // moon disc (slightly cratered) + soft glow
        float md = max(dot(dir, skyMoon), 0.0);
        float moon = smoothstep(0.9988, 0.9992, md) * step(-0.04, skyMoon.y);
        float crater = 0.85 + 0.15 * sk_vn(dir.xz * 260.0 + dir.y * 90.0);
        col += vec3(0.5, 0.58, 0.8) * pow(md, 40.0) * 0.18 * night;
        col = mix(col, vec3(0.86, 0.9, 1.0) * crater, moon);
        return col;
    }

    // returns rgb in rgb, coverage in a
    vec4 sk_clouds(vec3 dir, vec3 skyCol) {
        if (skyClouds < 0.5 || dir.y < 0.012) return vec4(0.0);
        float hf = smoothstep(0.012, 0.2, dir.y);
        float sunY = skySun.y;
        float day = smoothstep(-0.12, 0.25, sunY);
        float night = 1.0 - smoothstep(-0.22, 0.06, sunY);
        float twilight = 1.0 - smoothstep(0.0, 0.5, abs(sunY));

        vec3 sunCol = mix(vec3(1.0, 0.5, 0.22), vec3(1.0, 0.97, 0.9), smoothstep(0.05, 0.5, sunY));
        sunCol = mix(sunCol, vec3(0.22, 0.28, 0.45), night);                               // moonlit at night
        vec3 amb = (skyCol * 0.55 + vec3(0.30, 0.34, 0.42)) * mix(0.16, 1.0, day);
        vec2 wind = vec2(0.0095, 0.0035) * skyTime;

        vec4 outc = vec4(0.0);
        // cumulus
        float t = (150.0 - skyCamPos.y) / dir.y;
        if (t > 0.0) {
            vec2 p = (skyCamPos.xz + dir.xz * t) * 0.0062 + wind;
            float dens = sk_cloud5(p);
            if (dens > 0.003) {
                vec2 l = normalize(skySun.xz + 1e-5) * 0.07;
                float tau = sk_cloud3(p + l) + 0.7 * sk_cloud3(p + l * 2.2);
                float lit = exp(-tau * 1.5);
                float sd = max(dot(dir, skySun), 0.0);
                float silver = pow(sd, 8.0) * (1.0 - dens) * 0.9;
                vec3 c = amb + sunCol * (lit * 0.8 + silver) * mix(0.35, 1.0, day);
                c = mix(c, c * vec3(1.05, 0.92, 0.85) + vec3(0.18, 0.06, 0.0) * twilight, twilight * 0.5);
                float a = dens * hf * 0.96;
                outc = vec4(c, a);
            }
        }
        // cirrus: thin streaks high up, stretched along the wind
        float t2 = (300.0 - skyCamPos.y) / dir.y;
        if (t2 > 0.0) {
            vec2 q = (skyCamPos.xz + dir.xz * t2) * vec2(0.0026, 0.0058) + wind * 0.6;
            float ci = smoothstep(0.58, 0.9, sk_fbm3(q * vec2(1.0, 2.0))) * 0.26 * hf;
            vec3 cc = amb * 0.9 + sunCol * 0.55 * mix(0.3, 1.0, day);
            outc.rgb = mix(cc, outc.rgb, outc.a / max(outc.a + ci * (1.0 - outc.a), 1e-4));
            outc.a = outc.a + ci * (1.0 - outc.a);
        }
        return outc;
    }

    vec3 sk_shade(vec2 uv, vec3 horizon) {
        vec3 dir = sk_viewDir(uv);
        vec3 col = sk_sky(dir, horizon);
        vec4 cl = sk_clouds(dir, col);
        return mix(col, cl.rgb, cl.a);
    }
`;

#!/usr/bin/env python3
"""Bake neural normal + height maps for the block textures (offline; nothing here runs in the game).

Uses DeepBump (https://github.com/HugoTini/DeepBump, GPL-3.0), a small CNN that predicts a normal map from a
grey-scale albedo. The model file is downloaded on demand and is NOT committed to this repo; only the baked
images it produced are (js/textures.js reads them, see TextureManager.loadBakedPbr).

Output (textures/):
  baked_pbr.png   atlas, 8 columns of 128x64 cells:  [ normal RGB 64x64 | height grey 64x64 ]
  baked_pbr.json  { "size": 64, "cols": 8, "keys": ["bedrock", ...] }   (cell i = keys[i], row-major)

Per texture:
  1. the 16/64px tile is nearest-upscaled to 128px and wrapped so it sits in the middle of a 256px canvas
     (blocks tile in-game, so the network sees the real neighbours instead of a hard border)
  2. DeepBump predicts the normal map; the middle tile is cropped and box-filtered down to 64x64
  3. the channel conventions are matched to the game's own luminance-derived normals (decided globally from
     the data, printed below), and the tilt is scaled so its average strength equals the game's old
     "strength = 3.0" relief -> the existing per-material tuning in textures.js keeps working
  4. height = Frankot-Chellappa integration of the slopes (periodic, so it tiles), stretched to 0..255

    python3 tools/bake_pbr.py [--src ALL_ASSETS/TEXTURES/all_textures] [--out textures]
Requires: numpy, Pillow, onnxruntime.
"""
import argparse, json, os, sys, urllib.request
import numpy as np
from PIL import Image
import onnxruntime as ort

MODEL_URL = 'https://raw.githubusercontent.com/HugoTini/DeepBump/master/deepbump256.onnx'
OUT = 64          # baked resolution (the game's x64 textures)
COLS = 8


def fetch_model(path):
    if not os.path.exists(path):
        print('downloading DeepBump model ->', path)
        urllib.request.urlretrieve(MODEL_URL, path)
    return ort.InferenceSession(path, providers=['CPUExecutionProvider'])


def predict_normals(sess, rgb):
    """rgb: PIL image (16/32/64/128 square). Returns (128,128,3) unit normals of the tile, DeepBump convention."""
    n = rgb.width
    tile = np.asarray(rgb.convert('L').resize((128, 128), Image.NEAREST), np.float32) / 255
    canvas = np.empty((256, 256), np.float32)
    ys, xs = np.mgrid[0:256, 0:256]
    canvas[:] = tile[(ys - 64) % 128, (xs - 64) % 128]
    y = sess.run(None, {'input': canvas[None, None]})[0][0]          # (3,256,256), 0..1
    nrm = (y.transpose(1, 2, 0) * 2 - 1)[64:192, 64:192]
    return nrm / np.maximum(np.linalg.norm(nrm, axis=-1, keepdims=True), 1e-6)


def downsample(nrm, size):
    f = nrm.shape[0] // size
    out = nrm.reshape(size, f, size, f, 3).mean(axis=(1, 3))
    return out / np.maximum(np.linalg.norm(out, axis=-1, keepdims=True), 1e-6)


def game_reference(lum64, strength=3.0):
    """The old textures.js relief on the 64px image: 3x3-blurred luminance -> Sobel -> tilt. Returns (nx, ny) before
    normalisation, in the game's convention (nx = -dx*s, ny = +dy*s, rows go down)."""
    def at(a, dx, dy):
        return np.roll(np.roll(a, -dx, axis=1), -dy, axis=0)
    d = (4 * lum64 + 2 * (at(lum64, -1, 0) + at(lum64, 1, 0) + at(lum64, 0, -1) + at(lum64, 0, 1))
         + at(lum64, -1, -1) + at(lum64, 1, -1) + at(lum64, -1, 1) + at(lum64, 1, 1)) / 16
    dx = (at(d, 1, -1) + 2 * at(d, 1, 0) + at(d, 1, 1)) - (at(d, -1, -1) + 2 * at(d, -1, 0) + at(d, -1, 1))
    dy = (at(d, -1, 1) + 2 * at(d, 0, 1) + at(d, 1, 1)) - (at(d, -1, -1) + 2 * at(d, 0, -1) + at(d, 1, -1))
    return -dx * strength, dy * strength


def integrate(slope_x, slope_y):
    """Frankot-Chellappa: periodic height field whose gradient best matches (slope_x, slope_y) (x right, y down)."""
    h, w = slope_x.shape
    fx = np.fft.fftfreq(w)[None, :] * 2j * np.pi
    fy = np.fft.fftfreq(h)[:, None] * 2j * np.pi
    den = (fx * np.conj(fx) + fy * np.conj(fy)).real
    den[0, 0] = 1
    Z = (np.conj(fx) * np.fft.fft2(slope_x) + np.conj(fy) * np.fft.fft2(slope_y)) / den
    Z[0, 0] = 0
    return np.fft.ifft2(Z).real


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='ALL_ASSETS/TEXTURES/all_textures')
    ap.add_argument('--out', default='textures')
    ap.add_argument('--model', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'deepbump256.onnx'))
    a = ap.parse_args()
    sess = fetch_model(a.model)

    items = []
    for f in sorted(os.listdir(a.src)):
        if not f.endswith('.png'):
            continue
        im = Image.open(os.path.join(a.src, f))
        if im.width != im.height or im.width not in (16, 32, 64, 128):
            continue                                              # skins, items, big art: not block tiles
        items.append((f[:-4], im.convert('RGB')))
    print('baking', len(items), 'textures')

    raw = []
    for key, im in items:
        nrm = downsample(predict_normals(sess, im), OUT)
        lum = np.asarray(im.resize((OUT, OUT), Image.NEAREST).convert('L'), np.float32) / 255
        raw.append((key, nrm, lum))

    # channel conventions: compare with the game's luminance relief over the whole set
    cx = cy = 0.0
    for key, nrm, lum in raw:
        rx, ry = game_reference(lum)
        cx += np.sum(nrm[..., 0] * rx); cy += np.sum(nrm[..., 1] * ry)
    sx, sy = (1 if cx >= 0 else -1), (1 if cy >= 0 else -1)
    print('convention: x %s, y %s (corr sums %.1f, %.1f)' % ('as-is' if sx > 0 else 'flipped', 'as-is' if sy > 0 else 'flipped', cx, cy))

    rows = (len(raw) + COLS - 1) // COLS
    atlas = np.zeros((rows * OUT, COLS * OUT * 2, 3), np.uint8)
    keys = []
    gains = []
    for i, (key, nrm, lum) in enumerate(raw):
        n = nrm.copy(); n[..., 0] *= sx; n[..., 1] *= sy
        rx, ry = game_reference(lum)
        tilt = lambda sl: float((np.hypot(sl[..., 0], sl[..., 1]) / np.sqrt(1 + sl[..., 0] ** 2 + sl[..., 1] ** 2)).mean())
        t_ref = tilt(np.dstack([rx, ry]))                          # mean tilt of the game's old normals
        slope = n[..., :2] / np.maximum(n[..., 2:3], 0.2)
        lo_g, hi_g = 0.05, 60.0                                    # bisection: scale the slopes to the old mean tilt
        for _ in range(30):
            mid = (lo_g + hi_g) / 2
            if tilt(slope * mid) < t_ref: lo_g = mid
            else: hi_g = mid
        g = (lo_g + hi_g) / 2
        gains.append(g)
        slope *= g
        # n = (slope_x, slope_y, 1) normalised: the game's (nx, ny, nz) with nz from the slope magnitude
        v = np.dstack([slope, np.ones(slope.shape[:2], np.float32)])
        v /= np.linalg.norm(v, axis=-1, keepdims=True)
        # height: heights rise where the old formula's depth rises; gradient of height ~ -nx (x), +ny (y, rows down)
        hgt = integrate(-slope[..., 0], slope[..., 1])
        lo, hi = np.percentile(hgt, 1), np.percentile(hgt, 99)
        hgt = np.clip((hgt - lo) / max(hi - lo, 1e-6), 0, 1)
        r, c = divmod(i, COLS)
        y0, x0 = r * OUT, c * OUT * 2
        atlas[y0:y0 + OUT, x0:x0 + OUT] = ((v * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)
        atlas[y0:y0 + OUT, x0 + OUT:x0 + 2 * OUT] = (hgt[..., None] * 255 + 0.5).astype(np.uint8).repeat(3, axis=2)
        keys.append(key)
    print('tilt gain: min %.1f median %.1f max %.1f' % (min(gains), float(np.median(gains)), max(gains)))

    os.makedirs(a.out, exist_ok=True)
    Image.fromarray(atlas).save(os.path.join(a.out, 'baked_pbr.png'), optimize=True)
    with open(os.path.join(a.out, 'baked_pbr.json'), 'w') as f:
        json.dump({'size': OUT, 'cols': COLS, 'keys': keys}, f, separators=(',', ':'))
    print('wrote', os.path.join(a.out, 'baked_pbr.png'), os.path.getsize(os.path.join(a.out, 'baked_pbr.png')) // 1024, 'KB')


if __name__ == '__main__':
    main()

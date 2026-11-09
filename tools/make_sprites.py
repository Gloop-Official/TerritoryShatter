#!/usr/bin/env python3
"""TerritoryShatter sprite pipeline — renders top-down art to art/.
Deterministic. Requires Pillow + numpy.
Usage: python tools/make_sprites.py
"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'art')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(13371)
PALETTE = ["#00f5ff", "#ff2ea6", "#ffd600", "#39ff6a", "#ff7b00",
           "#b26bff", "#00ff9d", "#ff4d4d", "#4da6ff", "#ffea00"]

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# ---------- floor tile (dark carbon-metal, tileable) ----------
def floor_tile():
    s = 128
    base = np.zeros((s, s, 3), float)
    base[:] = (13, 13, 26)
    noise = rng.normal(0, 5, (s, s, 1))
    base += noise
    # faint brush streaks
    yy = np.arange(s)[:, None]; xx = np.arange(s)[None, :]
    base += 3 * np.sin((xx * .7 + yy * .35) * .35)[..., None]
    # sparse micro-dots
    dots = rng.random((s, s, 1)) > .9975
    base += dots * 38
    # beveled seam: 1px darker border (tileable -> consistent grid seams)
    base[0, :] = base[0, :] * .55; base[:, 0] = base[:, 0] * .55
    img = Image.fromarray(np.clip(base, 0, 255).astype('uint8'))
    img.save(os.path.join(OUT, 'floor.png'))
    print('  floor.png')

# ---------- territory tile bevel overlay ----------
def tile_overlay():
    s = 64
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # inner shading: soft dark corners
    shade = Image.new('L', (s, s), 0)
    ds = ImageDraw.Draw(shade)
    ds.rectangle([0, 0, s - 1, s - 1], outline=70, width=3)
    shade = shade.filter(ImageFilter.GaussianBlur(3))
    img.paste((0, 0, 0), (0, 0), shade)
    # top/left light bevel
    d.line([1, 1, s - 2, 1], fill=(255, 255, 255, 70), width=2)
    d.line([1, 1, 1, s - 2], fill=(255, 255, 255, 55), width=2)
    # bottom/right dark bevel
    d.line([1, s - 2, s - 2, s - 2], fill=(0, 0, 0, 110), width=2)
    d.line([s - 2, 1, s - 2, s - 2], fill=(0, 0, 0, 100), width=2)
    # central sheen
    sheen = Image.new('L', (s, s), 0)
    ImageDraw.Draw(sheen).ellipse([s * .25, s * .12, s * .75, s * .55], fill=34)
    sheen = sheen.filter(ImageFilter.GaussianBlur(10))
    img.paste((255, 255, 255), (0, 0), sheen)
    img.save(os.path.join(OUT, 'tile.png'))
    print('  tile.png')

# ---------- crystal shards ----------
def shard(name, col):
    s = 48
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    c = hex2rgb(col)
    gd.polygon([(s//2, 6), (s - 12, s//2), (s//2, s - 6), (12, s//2)], fill=c + (200,))
    glow = glow.filter(ImageFilter.GaussianBlur(6))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    dark = tuple(int(v * .55) for v in c)
    lite = tuple(min(255, int(v * 1.35)) for v in c)
    # facets
    d.polygon([(s//2, 6), (s - 12, s//2), (s//2, s - 6), (12, s//2)], fill=c + (255,), outline=(0, 0, 0, 160))
    d.polygon([(s//2, 6), (s//2, s - 6), (12, s//2)], fill=dark + (255,))     # left facet
    d.polygon([(s//2, 6), (s - 12, s//2), (s//2, s - 6)], fill=lite + (255,))  # right facet
    d.polygon([(s//2, 10), (s//2 + 5, s//2), (s//2, s - 10), (s//2 - 5, s//2)], fill=(255, 255, 255, 90))
    # glint
    d.ellipse([s//2 - 2, 11, s//2 + 3, 16], fill=(255, 255, 255, 230))
    img.save(os.path.join(OUT, f'{name}.png'))
    print(f'  {name}.png')

# ---------- top-down character (faces +X) ----------
def char_frame(col):
    s = 96
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    c = hex2rgb(col)
    lite = tuple(min(255, int(v * 1.3)) for v in c)
    dark = tuple(int(v * .5) for v in c)

    # thruster glow (rear)
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([8, 36, 34, 60], fill=c + (220,))
    gd.ellipse([14, 42, 28, 54], fill=(255, 255, 255, 230))
    glow = glow.filter(ImageFilter.GaussianBlur(5))
    img.alpha_composite(glow)

    d = ImageDraw.Draw(img)
    # wing pods (top/bottom)
    for y0, y1 in [(22, 34), (62, 74)]:
        d.rounded_rectangle([34, y0, 54, y1], radius=5, fill=(28, 31, 40, 255), outline=(0, 0, 0, 200), width=2)
        d.ellipse([46, y0 + 2, 53, y1 - 2], fill=c + (255,))
    # hull
    d.rounded_rectangle([30, 34, 74, 62], radius=14, fill=(36, 40, 52, 255), outline=(0, 0, 0, 230), width=3)
    d.rounded_rectangle([33, 36, 71, 47], radius=10, fill=(74, 82, 102, 140))  # top light
    # colored belly stripe
    d.line([34, 57, 68, 57], fill=c + (230,), width=3)
    # canopy + rim + glint
    d.ellipse([56, 39, 76, 57], fill=(10, 16, 26, 255), outline=c + (255,), width=2)
    d.ellipse([61, 42, 67, 46], fill=(255, 255, 255, 220))
    # nose tip
    d.polygon([(74, 43), (84, 48), (74, 53)], fill=lite + (255,))
    d.ellipse([81, 46, 84, 50], fill=(255, 255, 255, 255))
    # specular spine
    d.line([38, 37, 66, 41], fill=(255, 255, 255, 90), width=2)
    # rim accents near rear
    d.ellipse([30, 42, 36, 48], fill=dark + (255,)); d.ellipse([30, 50, 36, 58], fill=dark + (255,))
    return img

def chars_sheet():
    frame = char_frame(PALETTE[0])
    fw, fh = frame.size
    sheet = Image.new('RGBA', (fw * len(PALETTE), fh), (0, 0, 0, 0))
    for i, col in enumerate(PALETTE):
        sheet.paste(char_frame(col), (i * fw, 0))
    sheet.save(os.path.join(OUT, 'chars.png'))
    print('  chars.png  (10 frames)')

if __name__ == '__main__':
    print('Rendering TerritoryShatter top-down art ->', os.path.abspath(OUT))
    floor_tile(); tile_overlay()
    shard('shard_gold', '#ffd600'); shard('shard_cyan', '#00f5ff')
    chars_sheet()
    print('Done.')

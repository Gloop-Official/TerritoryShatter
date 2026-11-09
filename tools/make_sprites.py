#!/usr/bin/env python3
"""TerritoryShatter sprite pipeline (arcade-kids edition) — renders to art/.
Chunky pastel top-down/isometric assets. Deterministic. Requires Pillow + numpy.
Usage: python tools/make_sprites.py
"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'art')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(13371)
PALETTE = ["#00c8f5", "#ff2ea6", "#ffc800", "#2fe86a", "#ff7b00",
           "#a35bff", "#00d98a", "#ff4d4d", "#3f9dff", "#ffd80f"]

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lite(c, f=1.35): return tuple(min(255, int(v * f)) for v in c)
def dark(c, f=.55):  return tuple(int(v * f) for v in c)

# ---------- pastel picnic floor (arcade, tileable) ----------
def floor_tile():
    s = 128
    base = np.zeros((s, s, 3), float)
    yy = np.arange(s)[:, None]; xx = np.arange(s)[None, :]
    checker = ((xx // 16 + yy // 16) % 2).astype(float)[..., None]
    base[:] = (178, 188, 238)      # periwinkle
    base -= checker * 10
    base += rng.normal(0, 3, (s, s, 1))
    # white polka dots
    dots = rng.random((s, s, 1)) > .996
    base += dots * 70
    img = Image.fromarray(np.clip(base, 0, 255).astype('uint8')).convert('RGBA')
    d = ImageDraw.Draw(img)
    # candy sprinkles (short colored dashes, sparse)
    sprinkle_cols = [(255, 150, 170), (140, 235, 195), (255, 225, 130), (165, 215, 255)]
    for _ in range(14):
        x, y = int(rng.integers(2, s - 6)), int(rng.integers(2, s - 6))
        col = sprinkle_cols[int(rng.integers(0, 4))]
        a = float(rng.random() * math.pi)
        dx, dy = math.cos(a) * 3, math.sin(a) * 3
        d.line([x, y, x + dx, y + dy], fill=col + (150,), width=2)
    img.convert('RGB').save(os.path.join(OUT, 'floor.png'))
    print('  floor.png (pastel)')

# ---------- rounded tile bevel overlay ----------
def tile_overlay():
    s = 64; r = 13
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    # soft corner shadow outside the rounded top face
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([1, 1, s - 2, s - 2], radius=r, fill=255)
    face = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(face)
    d.line([r * .6, 2, s - r * .6, 2], fill=(255, 255, 255, 110), width=3)             # top gloss
    d.line([2, r * .6, 2, s - r * .6], fill=(255, 255, 255, 70), width=3)              # left gloss
    d.line([r * .5, s - 3, s - r * .5, s - 3], fill=(0, 0, 0, 90), width=3)            # bottom shade
    d.line([s - 3, r * .5, s - 3, s - r * .5], fill=(0, 0, 0, 80), width=3)            # right shade
    sheen = Image.new('L', (s, s), 0)
    ImageDraw.Draw(sheen).ellipse([10, 6, s - 18, s * .45], fill=42)
    sheen = sheen.filter(ImageFilter.GaussianBlur(8))
    face.paste((255, 255, 255), (0, 0), sheen)
    face.putalpha(Image.composite(face.getchannel('A'), Image.new('L', (s, s), 0), mask))
    img.alpha_composite(face)
    img.save(os.path.join(OUT, 'tile.png'))
    print('  tile.png (rounded)')

# ---------- candy crystal shards ----------
def shard(name, col):
    s = 48
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    c = hex2rgb(col)
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon([(s//2, 4), (s - 10, s//2), (s//2, s - 4), (10, s//2)], fill=c + (220,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(7)))
    d = ImageDraw.Draw(img)
    dk, lt = dark(c, .6), lite(c, 1.4)
    d.polygon([(s//2, 5), (s - 11, s//2), (s//2, s - 5), (11, s//2)], fill=c + (255,), outline=(255, 255, 255, 200), width=2)
    d.polygon([(s//2, 5), (s//2, s - 5), (11, s//2)], fill=dk + (255,))
    d.polygon([(s//2, 5), (s - 11, s//2), (s//2, s - 5)], fill=lt + (255,))
    d.polygon([(s//2, 9), (s//2 + 5, s//2), (s//2, s - 9), (s//2 - 5, s//2)], fill=(255, 255, 255, 110))
    # sparkle star
    d.line([s//2 - 6, 14, s//2 + 2, 14], fill=(255, 255, 255, 255), width=2)
    d.line([s//2 - 2, 10, s//2 - 2, 18], fill=(255, 255, 255, 255), width=2)
    img.save(os.path.join(OUT, f'{name}.png'))
    print(f'  {name}.png (candy)')

# ---------- chibi hoverboard kid (3/4 view, front-facing, feet anchor bottom) ----------
def char_frame(col):
    """96x120 RGBA. Anchor = board center (48,102)."""
    s, c = 96, hex2rgb(col)
    img = Image.new('RGBA', (s, 120), (0, 0, 0, 0))
    dk, lt = dark(col and c, .62), lite(c, 1.25)

    # hover glow under the board
    glow = Image.new('RGBA', (s, 120), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([22, 102, 74, 114], fill=c + (190,))
    ImageDraw.Draw(glow).ellipse([36, 104, 60, 110], fill=(255, 255, 255, 210))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(4)))

    d = ImageDraw.Draw(img)
    # hoverboard
    d.ellipse([24, 92, 72, 106], fill=(38, 42, 54, 255), outline=(15, 17, 24, 255), width=2)
    d.ellipse([28, 92, 68, 100], fill=(70, 78, 98, 255))
    d.line([32, 99, 64, 99], fill=lt + (255,), width=2)          # color stripe
    # feet
    d.ellipse([36, 86, 47, 96], fill=(30, 33, 42, 255))
    d.ellipse([52, 86, 63, 96], fill=(30, 33, 42, 255))
    # arms
    d.ellipse([19, 56, 31, 72], fill=dk + (255,), outline=(20, 20, 28, 255), width=2)
    d.ellipse([68, 56, 80, 72], fill=dk + (255,), outline=(20, 20, 28, 255), width=2)
    # chunky bean body: outline stub then fill
    d.ellipse([26, 28, 74, 90], fill=(22, 24, 32, 255))
    d.ellipse([29, 31, 71, 87], fill=lt + (255,))
    # belly patch
    d.ellipse([37, 58, 63, 84], fill=(255, 255, 255, 235))
    # eyes (big, cute) + cheek blush
    for ex in (39, 55):
        d.ellipse([ex, 42, ex + 12, 55], fill=(255, 255, 255, 255), outline=(22, 24, 32, 255), width=2)
        d.ellipse([ex + 4, 46, ex + 9, 51], fill=(24, 26, 34, 255))
        d.ellipse([ex + 6, 45, ex + 8, 47], fill=(255, 255, 255, 255))
    d.ellipse([30, 54, 38, 60], fill=(255, 120, 150, 120))
    d.ellipse([62, 54, 70, 60], fill=(255, 120, 150, 120))
    # antenna + bobble
    d.line([49, 24, 49, 33], fill=(22, 24, 32, 255), width=3)
    d.ellipse([44, 16, 56, 28], fill=dk + (255,), outline=(22, 24, 32, 255), width=2)
    d.ellipse([47, 18, 52, 23], fill=(255, 255, 255, 220))
    # sticker on belly
    d.ellipse([46, 66, 54, 74], fill=dk + (255,))
    d.ellipse([48, 68, 52, 72], fill=(255, 255, 255, 200))
    return img

def chars_sheet():
    fw, fh = 96, 120
    sheet = Image.new('RGBA', (fw * len(PALETTE), fh), (0, 0, 0, 0))
    for i, col in enumerate(PALETTE):
        sheet.paste(char_frame(col), (i * fw, 0))
    sheet.save(os.path.join(OUT, 'chars.png'))
    print('  chars.png (10 chibi frames)')

if __name__ == '__main__':
    print('Rendering TerritoryShatter arcade art ->', os.path.abspath(OUT))
    floor_tile(); tile_overlay()
    shard('shard_gold', '#ffc800'); shard('shard_cyan', '#00d5f5')
    chars_sheet()
    print('Done.')

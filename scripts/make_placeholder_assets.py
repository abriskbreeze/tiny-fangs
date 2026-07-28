#!/usr/bin/env python3
"""Fill every non-card image slot in the asset manifest with a basic-shape
placeholder at the EXACT required dimensions (user direction 2026-07-29:
"use basic shapes and such for now but correct sizing"). The user will
regenerate real art later at the same sizes; provenance stays unclaimed and
strict release stays honestly red.

Card faces already carry the Phase 6 faction templates; audio slots are left
missing (no image placeholder can honestly satisfy them).
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

INK = (59, 35, 23)
PARCHMENT = (220, 186, 150)
IVORY = (222, 187, 145)
GOLD = (238, 195, 78)
NAVY = (55, 47, 63)
AMBER = (180, 112, 21)
TEAL = (39, 122, 121)
PLUM = (106, 90, 102)
MEADOW_HI = (194, 171, 77)
MEADOW_LO = (179, 167, 79)
FOLIAGE = (51, 75, 66)


def save_webp(image, path, quality=85):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, quality=quality)
    return path


def frame(family_color):
    """Basic card frame: ivory lip, family rail, parchment panels, empty art
    window and sockets — correct 1536×2304 geometry, simple shapes only."""
    img = Image.new('RGBA', (1536, 2304), IVORY + (255,))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([53, 53, 1483, 2251], radius=44, outline=INK, width=14)
    d.rounded_rectangle([67, 67, 1469, 2237], radius=30, fill=family_color)
    d.rounded_rectangle([164, 164, 1372, 2140], radius=8, fill=PARCHMENT)
    # Art window (transparent hole) upper ~55%.
    d.rectangle([178, 92, 1358, 1310], fill=(0, 0, 0, 0))
    d.rectangle([178, 92, 1358, 1310], outline=INK, width=8)
    # Nameplate band.
    d.rounded_rectangle([194, 1052, 1346, 1330], radius=32, fill=(237, 211, 172), outline=INK, width=7)
    # Rules panel keyline.
    d.rectangle([194, 1516, 1346, 2006], outline=INK, width=5)
    # Cost socket.
    d.ellipse([37, 37, 350, 350], fill=PARCHMENT, outline=family_color, width=21)
    return img


def creature_frame():
    img = frame(AMBER)
    d = ImageDraw.Draw(img)
    # Stat sockets bottom corners.
    d.polygon([(198, 2016), (360, 1976), (390, 2160), (230, 2260), (90, 2160)], fill=AMBER)
    d.ellipse([1150, 2000, 1480, 2280], fill=(110, 53, 44))
    return img


def back(kind):
    img = Image.new('RGBA', (1536, 2304), NAVY + (255,))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([64, 64, 1472, 2240], radius=44, outline=GOLD, width=9)
    d.ellipse([408, 792, 1128, 1512], outline=GOLD, width=9)
    d.ellipse([460, 844, 1076, 1460], outline=GOLD, width=5)
    # Twin fang basic shapes.
    d.polygon([(672, 1010), (712, 1010), (740, 1290), (700, 1240)], fill=GOLD)
    d.polygon([(864, 1010), (824, 1010), (796, 1290), (836, 1240)], fill=GOLD)
    if kind == 'set-hidden':
        d.ellipse([708, 560, 828, 680], outline=GOLD, width=7)
    return img


def circle_icon(size, fill, glyph=None):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = size // 10
    d.ellipse([pad, pad, size - pad, size - pad], fill=fill, outline=INK, width=size // 40)
    if glyph == 'ring':
        d.ellipse([size // 4, size // 4, 3 * size // 4, 3 * size // 4], fill=(0, 0, 0, 0), outline=INK, width=size // 30)
    if glyph == 'diamond':
        c = size // 2
        r = size // 4
        d.polygon([(c, c - r), (c + r, c), (c, c + r), (c - r, c)], fill=GOLD)
    return img


def ring(size, color):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = size // 8
    d.ellipse([pad, pad, size - pad, size - pad], outline=color, width=size // 22)
    return img


def flat(size_wh, color):
    return Image.new('RGB', size_wh, color)


def gradient_v(size_wh, top, bottom):
    img = Image.new('RGB', size_wh, top)
    d = ImageDraw.Draw(img)
    width, height = size_wh
    for y in range(height):
        t = y / height
        d.line([(0, y), (width, y)], fill=tuple(
            int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def contact_shadow():
    img = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(60, 0, -1):
        alpha = int(140 * (i / 60) ** 2)
        pad = 512 - int(430 * (i / 60))
        d.ellipse([pad, pad, 1024 - pad, 1024 - pad], fill=(16, 13, 10, alpha))
    return img


def props_atlas():
    img = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Basic prop shapes on a grid: tree, rock, fence, flower, grass tuft.
    d.polygon([(256, 96), (448, 480), (64, 480)], fill=FOLIAGE)          # tree
    d.rectangle([236, 480, 276, 560], fill=(90, 62, 40))
    d.polygon([(640, 400), (760, 300), (900, 360), (930, 500), (620, 520)], fill=(87, 96, 79))  # rock
    d.rectangle([1100, 300, 1130, 560], fill=(150, 118, 74))              # fence posts
    d.rectangle([1180, 300, 1210, 560], fill=(150, 118, 74))
    d.rectangle([1080, 350, 1230, 380], fill=(150, 118, 74))
    d.ellipse([1500, 340, 1580, 420], fill=(237, 198, 116))               # flower
    d.ellipse([1524, 364, 1556, 396], fill=(180, 112, 21))
    for i, x in enumerate(range(200, 420, 40)):                           # grass tuft
        d.line([(x, 900), (x + 12, 780 + (i % 3) * 24)], fill=MEADOW_HI, width=12)
    return img


def main() -> int:
    out = []
    frames_dir = ROOT / 'src/assets/frames'
    out.append(save_webp(creature_frame(), frames_dir / 'creature.webp'))
    out.append(save_webp(frame(TEAL), frames_dir / 'verse-cast.webp'))
    out.append(save_webp(frame(PLUM), frames_dir / 'verse-set.webp'))
    out.append(save_webp(frame((138, 138, 100)), frames_dir / 'token.webp'))

    backs_dir = ROOT / 'src/assets/backs'
    out.append(save_webp(back('standard'), backs_dir / 'standard.webp'))
    out.append(save_webp(back('set-hidden'), backs_dir / 'set-hidden.webp'))

    status_dir = ROOT / 'src/assets/status'
    out.append(save_webp(circle_icon(512, (95, 138, 60)), status_dir / 'poison.webp'))
    out.append(save_webp(circle_icon(512, (128, 96, 82), 'ring'), status_dir / 'trapped.webp'))
    out.append(save_webp(circle_icon(512, (120, 124, 132)), status_dir / 'fortified.webp'))
    out.append(save_webp(circle_icon(512, GOLD, 'diamond'), status_dir / 'unbreakable.webp'))

    ui_dir = ROOT / 'src/assets/ui'
    out.append(save_webp(circle_icon(512, (168, 62, 52)), ui_dir / 'life-token.webp'))
    out.append(save_webp(circle_icon(512, TEAL), ui_dir / 'mana-token.webp'))
    out.append(save_webp(circle_icon(512, (200, 150, 50), 'ring'), ui_dir / 'turn-marker.webp'))
    out.append(save_webp(circle_icon(512, (245, 215, 131), 'diamond'), ui_dir / 'divider-rune.webp'))
    out.append(save_webp(ring(1024, GOLD), ui_dir / 'selection-ring.webp'))
    out.append(save_webp(ring(1024, (143, 216, 203)), ui_dir / 'legal-target-ring.webp'))
    out.append(save_webp(circle_icon(1024, GOLD, 'diamond'), ui_dir / 'coin-heads.webp'))
    out.append(save_webp(circle_icon(1024, PARCHMENT, 'ring'), ui_dir / 'coin-tails.webp'))

    env_dir = ROOT / 'src/assets/environment'
    out.append(save_webp(gradient_v((3840, 2160), (36, 47, 63), MEADOW_HI), env_dir / 'meadow-backdrop.webp'))
    out.append(save_webp(gradient_v((2048, 2048), MEADOW_HI, MEADOW_LO), env_dir / 'terrain-color.webp'))
    out.append(save_webp(flat((2048, 2048), (128, 128, 255)), env_dir / 'terrain-normal.webp'))
    out.append(save_webp(flat((1024, 1024), (128, 128, 255)), env_dir / 'water-normal.webp'))
    out.append(save_webp(props_atlas(), env_dir / 'props-atlas.webp'))
    out.append(save_webp(contact_shadow(), env_dir / 'contact-shadow.webp'))

    for path in out:
        print(path.relative_to(ROOT), path.stat().st_size)
    return 0


if __name__ == '__main__':
    sys.exit(main())

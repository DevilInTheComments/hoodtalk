#!/usr/bin/env python3
"""Draw HoodTalk app icons: neon purple speech bubble with a green HT mark on black.
Outputs icons/icon-180.png (apple-touch-icon), icon-192.png, icon-512.png.
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
os.makedirs(OUT, exist_ok=True)

BG = (11, 11, 16, 255)
PURPLE = (168, 85, 247, 255)
PURPLE_DARK = (124, 58, 237, 255)
GREEN = (34, 197, 94, 255)
WHITE = (245, 243, 250, 255)

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def draw_icon(size):
    img = Image.new("RGBA", (size, size), BG)
    d = ImageDraw.Draw(img)
    s = size / 512.0

    # Neon glow: concentric rounded bubbles, fading outward.
    cx, cy = size * 0.5, size * 0.46
    for r, alpha in [(0.46, 28), (0.42, 40), (0.38, 60)]:
        rr = int(size * r)
        glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(168, 85, 247, alpha))
        img = Image.alpha_composite(img, glow)
        d = ImageDraw.Draw(img)

    # Speech bubble: rounded rect + tail.
    bx0, by0 = int(size * 0.14), int(size * 0.14)
    bx1, by1 = int(size * 0.86), int(size * 0.70)
    rad = int(size * 0.16)
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=rad, fill=PURPLE)
    # Tail bottom-left.
    tail = [
        (int(size * 0.30), int(size * 0.68)),
        (int(size * 0.22), int(size * 0.88)),
        (int(size * 0.44), int(size * 0.68)),
    ]
    d.polygon(tail, fill=PURPLE)

    # Green underline bar inside bubble bottom.
    bar_y0 = int(size * 0.585)
    d.rounded_rectangle(
        [int(size * 0.30), bar_y0, int(size * 0.70), bar_y0 + int(size * 0.035)],
        radius=int(size * 0.018), fill=GREEN,
    )

    # "HT" mark, dark text on purple bubble.
    font = ImageFont.truetype(FONT_PATH, int(size * 0.30))
    text = "HT"
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(
        (cx - tw / 2 - tb[0], int(size * 0.24) - tb[1]),
        text, font=font, fill=(11, 11, 16, 255),
    )
    return img


for size in (180, 192, 512):
    icon = draw_icon(size)
    icon.convert("RGB").save(os.path.join(OUT, f"icon-{size}.png"))
    print(f"wrote icons/icon-{size}.png ({size}x{size})")

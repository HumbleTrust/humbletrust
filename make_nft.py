"""
444 NFT Collection Generator
Run: pip install Pillow  (first time only)
Then: python make_nft.py
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os, math

# ── Config ──────────────────────────────────────────────────────────────────
OUTPUT_DIR = "nft_output"
SIZE = (1000, 1000)  # Square NFT format

RARITIES = {
    "common":    {"label": "COMMON",    "color": (0, 255, 65),    "glow": (0, 200, 50),    "file": "common.png",    "count": 44},
    "genesis":   {"label": "GENESIS",   "color": (255, 184, 0),   "glow": (220, 150, 0),   "file": "genesis.png",   "count": 176},
    "legendary": {"label": "LEGENDARY", "color": (180, 38, 255),  "glow": (140, 20, 220),  "file": "legendary.png", "count": 220},
    "rare":      {"label": "RARE",      "color": (153, 69, 255),  "glow": (120, 40, 220),  "file": "rare.png",      "count": 4},
}

VARIANTS = [
    {"name": "v1", "border": "hex",    "badge_pos": "top_left"},
    {"name": "v2", "border": "glow",   "badge_pos": "top_right"},
]

os.makedirs(OUTPUT_DIR, exist_ok=True)

def hex_border(draw, size, color, thickness=12):
    """Draw hexagon-style corner brackets."""
    w, h = size
    t = thickness
    c = color
    corner = 60
    # Top-left
    draw.line([(t//2, corner), (t//2, t//2), (corner, t//2)], fill=c, width=t)
    # Top-right
    draw.line([(w-corner, t//2), (w-t//2, t//2), (w-t//2, corner)], fill=c, width=t)
    # Bottom-left
    draw.line([(t//2, h-corner), (t//2, h-t//2), (corner, h-t//2)], fill=c, width=t)
    # Bottom-right
    draw.line([(w-corner, h-t//2), (w-t//2, h-t//2), (w-t//2, h-corner)], fill=c, width=t)

def full_border(draw, size, color, thickness=6):
    """Draw full glowing border."""
    w, h = size
    t = thickness
    for i in range(t, 0, -1):
        alpha = int(255 * (i / t) * 0.9)
        c = color + (alpha,)
        draw.rectangle([i, i, w-i, h-i], outline=c, width=1)

def rarity_badge(img, label, color, position="top_left"):
    """Add rarity badge."""
    draw = ImageDraw.Draw(img, "RGBA")
    w, h = img.size

    # Badge size
    bw, bh = 180, 36
    pad = 18

    if position == "top_left":
        bx, by = pad, pad
    else:
        bx, by = w - bw - pad, pad

    # Badge background
    badge_bg = color + (40,)
    badge_border = color + (200,)
    draw.rounded_rectangle([bx, by, bx+bw, by+bh], radius=6, fill=badge_bg, outline=badge_border, width=2)

    # Diamond icon
    cx, cy = bx + 18, by + bh//2
    s = 7
    draw.polygon([(cx, cy-s), (cx+s, cy), (cx, cy+s), (cx-s, cy)], fill=color + (255,))

    # Label text
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except:
        font = ImageFont.load_default()

    tx = bx + 34
    ty = by + bh//2 - 8
    draw.text((tx+1, ty+1), label, font=font, fill=(0, 0, 0, 120))
    draw.text((tx, ty), label, font=font, fill=color + (255,))

    return img

def collection_stamp(img, color):
    """Add 444 collection watermark bottom center."""
    draw = ImageDraw.Draw(img, "RGBA")
    w, h = img.size

    # Bottom gradient bar
    bar_h = 70
    for y in range(bar_h):
        alpha = int(200 * (1 - y / bar_h))
        draw.line([(0, h - bar_h + y), (w, h - bar_h + y)], fill=(0, 0, 0, alpha))

    try:
        font_big = ImageFont.truetype("arialbd.ttf", 28)
        font_small = ImageFont.truetype("arial.ttf", 12)
    except:
        font_big = ImageFont.load_default()
        font_small = font_big

    # "444" text
    text = "444"
    bbox = draw.textbbox((0, 0), text, font=font_big)
    tw = bbox[2] - bbox[0]
    tx = (w - tw) // 2
    ty = h - 52

    # Glow effect
    for offset in range(4, 0, -1):
        glow_alpha = int(80 / offset)
        draw.text((tx - offset, ty), text, font=font_big, fill=color + (glow_alpha,))
        draw.text((tx + offset, ty), text, font=font_big, fill=color + (glow_alpha,))
        draw.text((tx, ty - offset), text, font=font_big, fill=color + (glow_alpha,))
        draw.text((tx, ty + offset), text, font=font_big, fill=color + (glow_alpha,))

    draw.text((tx, ty), text, font=font_big, fill=color + (230,))

    # "HumbleTrust" subtitle
    sub = "HumbleTrust NFT Collection"
    sbbox = draw.textbbox((0, 0), sub, font=font_small)
    sw = sbbox[2] - sbbox[0]
    draw.text(((w - sw) // 2, h - 22), sub, font=font_small, fill=(255, 255, 255, 80))

    return img

def edition_stamp(img, edition, color):
    """Add edition number top center."""
    draw = ImageDraw.Draw(img, "RGBA")
    w, _ = img.size

    try:
        font = ImageFont.truetype("arial.ttf", 12)
    except:
        font = ImageFont.load_default()

    text = f"#{str(edition).zfill(3)}"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, 22), text, font=font, fill=color + (160,))

    return img

def process_image(base_path, rarity_key, variant, edition):
    r = RARITIES[rarity_key]
    color = r["color"]
    label = r["label"]
    v = variant

    # Load & resize to square
    img = Image.open(base_path).convert("RGBA")
    # Crop to square (center crop)
    w, h = img.size
    if w > h:
        left = (w - h) // 2
        img = img.crop((left, 0, left + h, h))
    elif h > w:
        top = (h - w) // 2
        img = img.crop((0, top, w, top + w))
    img = img.resize(SIZE, Image.LANCZOS)

    # Border layer
    border_layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(border_layer, "RGBA")

    if v["border"] == "hex":
        hex_border(draw, SIZE, color + (220,), thickness=10)
        # Inner thin line
        hex_border(draw, SIZE, color + (80,), thickness=4)
    else:
        full_border(draw, SIZE, color, thickness=8)

    img = Image.alpha_composite(img, border_layer)

    # Badges & stamps
    img = rarity_badge(img, label, color, v["badge_pos"])
    img = collection_stamp(img, color)
    img = edition_stamp(img, edition, color)

    # Save
    fname = f"{rarity_key}_{v['name']}_#{str(edition).zfill(3)}.png"
    out_path = os.path.join(OUTPUT_DIR, fname)
    img.convert("RGB").save(out_path, "PNG", quality=95)
    print(f"✓ {fname}")
    return out_path

# ── Main ────────────────────────────────────────────────────────────────────
print("444 NFT Generator\n")
missing = []
for key, r in RARITIES.items():
    if not os.path.exists(r["file"]):
        missing.append(r["file"])

if missing:
    print(f"⚠ Missing files: {', '.join(missing)}")
    print("Put your images in the same folder as this script:")
    for key, r in RARITIES.items():
        print(f"  {r['file']} → {r['label']} tier")
    exit(1)

edition_counter = 1
for key, r in RARITIES.items():
    for v in VARIANTS:
        process_image(r["file"], key, v, edition_counter)
        edition_counter += 1

print(f"\n✅ Done! Check folder: {OUTPUT_DIR}/")

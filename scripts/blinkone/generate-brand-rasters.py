#!/usr/bin/env python3
"""Generate PNG/ICO rasters from BlinkOne placeholder SVGs (optional Pillow)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "public" / "blinkone-brand"

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: pip install pillow")
    raise SystemExit(1)

PRIMARY = (11, 95, 255)
INK = (10, 15, 28)
WHITE = (255, 255, 255)


def draw_mark(size: int, bg=PRIMARY, fg=WHITE) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.18)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg)
    d.text((size // 2, size // 2), "B1", fill=fg, anchor="mm")
    return img


def save_png(name: str, img: Image.Image) -> None:
    path = ROOT / name
    if img.mode == "RGBA":
        bg = Image.new("RGBA", img.size, WHITE + (255,))
        bg.paste(img, mask=img.split()[3])
        img = bg.convert("RGB")
    img.save(path, format="PNG")
    print(f"  wrote {path}")


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    mark = draw_mark(256)
    save_png("favicon-32.png", mark.resize((32, 32), Image.Resampling.LANCZOS))
    save_png("favicon-16.png", mark.resize((16, 16), Image.Resampling.LANCZOS))
    save_png("apple-touch-icon.png", mark.resize((180, 180), Image.Resampling.LANCZOS))

    # Email header ~600x120
    email = Image.new("RGBA", (600, 120), (0, 0, 0, 0))
    em = mark.resize((96, 96), Image.Resampling.LANCZOS)
    email.paste(em, (12, 12), em)
    save_png("logo-email.png", email)

    # OG 1200x630
    og = Image.new("RGB", (1200, 630), INK)
    big = draw_mark(200)
    og.paste(big, (500, 215), big)
    save_png("og-image.png", og)

    ico = mark.resize((32, 32), Image.Resampling.LANCZOS)
    ico.save(ROOT / "favicon.ico", format="ICO", sizes=[(32, 32)])
    print(f"  wrote {ROOT / 'favicon.ico'}")


if __name__ == "__main__":
    main()

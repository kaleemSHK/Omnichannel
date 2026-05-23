# BlinkOne brand assets

Served at **`/blinkone-brand/`** (nginx alias). Paths referenced from `config/blinkone/branding.yml`.

| File | Use |
|------|-----|
| `logo-full.svg` | Dashboard header (light background) |
| `logo-full-dark.svg` | Dashboard header (dark background) |
| `logo-mark.svg` | Compact mark, favicon source |
| `logo-mark-dark.svg` | Mark on dark UI |
| `logo-email.png` | Transactional emails (600×120 recommended) |
| `favicon.ico` / `favicon-16.png` / `favicon-32.png` | Browser tab |
| `apple-touch-icon.png` | iOS home screen (180×180) |
| `og-image.png` | Social / link previews (1200×630) |
| `splash.svg` | Loading screen |

Placeholders include `<!-- BLINKONE PLACEHOLDER -->` in SVG sources.

## Generate raster assets

From repo root (requires Python 3 + Pillow: `pip install pillow`):

```bash
python scripts/blinkone/generate-brand-rasters.py
```

This writes PNG/ICO files next to the SVGs from the placeholder mark.

# Icons — regenerate favicon & app icons

All web and iOS icons are derived from the eyed **W** in the title wordmark.

## When to regenerate

Run this after you change either:

- `assets/images/wormular-source.png` (full-res title art), or
- the crop / canvas logic in `scripts/generate-icons.py`

Do **not** hand-edit the generated PNGs in `public/` or the iOS App Icon — they will be overwritten on the next run.

## How

From the repo root:

```bash
pip install Pillow numpy   # once per machine
npm run icons              # → python3 scripts/generate-icons.py
```

Then commit the updated masters + generated icon files together.

## Inputs / outputs

| Role | Path |
| --- | --- |
| Source wordmark | `assets/images/wormular-source.png` |
| Script | `scripts/generate-icons.py` |
| W extract (transparent) | `assets/images/wormular-w.png` |
| Transparent square mark | `assets/images/wormular-w-mark.png` |
| 1024 master | `assets/images/icon-1024.png` |
| Web / PWA icons | `public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` |
| iOS App Icon | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` |

Hand-maintained (not overwritten by the script):

- `public/site.webmanifest` — points at `icon-192.png` / `icon-512.png`
- `index.html` head tags — `rel="icon"`, `apple-touch-icon`, `manifest`

Background / theme color is `#05060E` (same as `theme-color` in `index.html`).

## What the script does

1. Flood-fills the leftmost letter of the source art (`extract_w()`, seed inside the W) and crops it.
2. Composites that W onto square canvases with margin on `#05060E`.
3. Writes the masters, `public/` favicons / PWA icons, and the 1024 iOS App Icon.

If the title layout changes a lot and the crop fails (`seed pixel is not foreground`), update the seed / `right_limit` in `extract_w()` inside the script, then re-run.

## Quick check

```bash
npm run build
npm run preview
# open the preview URL (Pages builds use base /wormular/)
# confirm the tab favicon is the orange W
```

For iOS, run `npm run cap:sync` (or `npm run ios`) so Xcode picks up the new App Icon.

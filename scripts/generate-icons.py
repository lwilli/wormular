#!/usr/bin/env python3
"""Extract the Wormular W from the title art and write favicon / app icons.

Requires: pip install Pillow numpy

Usage (from repo root):
  npm run icons
  # or: python3 scripts/generate-icons.py

Full regen notes (inputs/outputs, when to re-run): docs/icons.md
"""

from __future__ import annotations

import struct
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/images/wormular-source.png"
OUT_ASSETS = ROOT / "assets/images"
OUT_PUBLIC = ROOT / "public"
IOS_ICON = (
    ROOT
    / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
)

THEME_RGB = (5, 6, 14)  # matches meta theme-color #05060E
THEME_RGBA = (*THEME_RGB, 255)


def extract_w(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    luma = arr[:, :, :3].max(axis=2)
    alpha = arr[:, :, 3]
    fg = (alpha > 20) & (luma > 28)

    seed = (100, 400)
    if not fg[seed[1], seed[0]]:
        raise RuntimeError("seed pixel is not foreground; logo layout may have changed")

    visited = np.zeros((h, w), dtype=bool)
    q = deque([seed])
    visited[seed[1], seed[0]] = True
    right_limit = 1020
    neighbors = (
        (-1, 0),
        (1, 0),
        (0, -1),
        (0, 1),
        (-1, -1),
        (1, -1),
        (-1, 1),
        (1, 1),
    )
    while q:
        x, y = q.popleft()
        for dx, dy in neighbors:
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h or nx > right_limit:
                continue
            if visited[ny, nx] or not fg[ny, nx]:
                continue
            visited[ny, nx] = True
            q.append((nx, ny))

    mask = Image.fromarray((visited.astype(np.uint8) * 255), "L")
    dil = np.array(mask.filter(ImageFilter.MaxFilter(3))) > 0
    keep = visited | (dil & fg)

    out = np.zeros_like(arr)
    out[keep] = arr[keep]
    out[~keep, 3] = 0
    out[out[:, :, :3].max(axis=2) < 28, 3] = 0

    ys, xs = np.where(out[:, :, 3] > 8)
    pad = 10
    right = int(np.where(visited.any(axis=0))[0].max())
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(w, right + pad + 1)
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(h, int(ys.max()) + pad + 1)
    return Image.fromarray(out, "RGBA").crop((x0, y0, x1, y1))


def fit_on_canvas(
    src: Image.Image, size: int, bg_rgba: tuple[int, int, int, int], margin_frac: float
) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg_rgba)
    max_dim = int(size * (1 - 2 * margin_frac))
    sw, sh = src.size
    scale = min(max_dim / sw, max_dim / sh)
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    if size <= 64:
        resized = resized.filter(
            ImageFilter.UnsharpMask(radius=0.5, percent=110, threshold=2)
        )
    canvas.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def to_rgb(img: Image.Image, bg: tuple[int, int, int] = THEME_RGB) -> Image.Image:
    base = Image.new("RGB", img.size, bg)
    base.paste(img, mask=img.split()[3])
    return base


def write_ico(path: Path, images: list[Image.Image]) -> None:
    """Write a modern ICO with embedded PNG payloads."""
    pngs: list[bytes] = []
    for im in images:
        import io

        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        pngs.append(buf.getvalue())

    num = len(images)
    header = struct.pack("<HHH", 0, 1, num)
    entries = []
    offset = 6 + 16 * num
    blob = b""
    for im, png in zip(images, pngs):
        sw, sh = im.size
        bw = 0 if sw >= 256 else sw
        bh = 0 if sh >= 256 else sh
        entries.append(struct.pack("<BBBBHHII", bw, bh, 0, 0, 1, 32, len(png), offset))
        blob += png
        offset += len(png)
    path.write_bytes(header + b"".join(entries) + blob)


def main() -> None:
    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)
    w_tight = extract_w(SRC)
    print(f"W extract {w_tight.size}")

    w_tight.save(OUT_ASSETS / "wormular-w.png", optimize=True)
    mark = fit_on_canvas(w_tight, 512, (0, 0, 0, 0), 0.06)
    mark.save(OUT_ASSETS / "wormular-w-mark.png", optimize=True)

    app = to_rgb(fit_on_canvas(w_tight, 1024, THEME_RGBA, 0.13))
    app.save(IOS_ICON, "PNG", optimize=True)
    app.save(OUT_ASSETS / "icon-1024.png", "PNG", optimize=True)

    to_rgb(fit_on_canvas(w_tight, 180, THEME_RGBA, 0.12)).save(
        OUT_PUBLIC / "apple-touch-icon.png", "PNG", optimize=True
    )
    for size, name, margin in (
        (512, "icon-512.png", 0.12),
        (192, "icon-192.png", 0.12),
        (32, "favicon-32x32.png", 0.08),
        (16, "favicon-16x16.png", 0.06),
    ):
        to_rgb(fit_on_canvas(w_tight, size, THEME_RGBA, margin)).save(
            OUT_PUBLIC / name, "PNG", optimize=True
        )

    ico_rgba = [
        fit_on_canvas(w_tight, 16, THEME_RGBA, 0.06),
        fit_on_canvas(w_tight, 32, THEME_RGBA, 0.08),
        fit_on_canvas(w_tight, 48, THEME_RGBA, 0.08),
    ]
    write_ico(OUT_PUBLIC / "favicon.ico", ico_rgba)
    print("wrote public icons + iOS AppIcon")


if __name__ == "__main__":
    main()

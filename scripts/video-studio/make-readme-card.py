#!/usr/bin/env python3
"""Generate a clickable 1080p README video preview card with a studio Play overlay."""

from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
VIDEO_DIR = ROOT / "docs" / "public" / "video"
TIMELINE_JSON = ROOT / "cache" / "video-build" / "timeline.json"
POSTER = VIDEO_DIR / "enterprise-azure-ai-hub-csa-forum-intro-poster.png"
OUT_CARD = VIDEO_DIR / "readme-video-card.png"


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def format_duration_mmss() -> str:
    if TIMELINE_JSON.exists():
        tl = json.loads(TIMELINE_JSON.read_text(encoding="utf-8"))
        total_sec = int(round(float(tl.get("totalDuration", 173))))
        return f"{total_sec // 60}:{total_sec % 60:02d}"
    return "2:53"


def main() -> None:
    base = Image.open(POSTER).convert("RGBA")
    w, h = base.size
    dur_label = format_duration_mmss()

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Place pill cleanly in the open lower canvas band (below KPI strip y=749, above bottom-bar y=1014)
    pill_w, pill_h = 780, 102
    px0 = (w - pill_w) // 2
    py0 = 862
    px1 = px0 + pill_w
    py1 = py0 + pill_h

    # Outer cyan glow halo
    for pad, alpha in [(14, 28), (8, 48), (3, 85)]:
        draw.rounded_rectangle(
            [px0 - pad, py0 - pad, px1 + pad, py1 + pad],
            radius=58 + pad,
            fill=(0, 140, 228, alpha),
        )

    # Deep glass pill
    draw.rounded_rectangle(
        [px0, py0, px1, py1],
        radius=54,
        fill=(6, 17, 34, 236),
        outline=(56, 189, 248, 235),
        width=3,
    )

    # Play circle
    cx = px0 + 58
    cy = py0 + pill_h // 2
    r = 34
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 120, 212, 255))
    tri = [(cx - 10, cy - 16), (cx - 10, cy + 16), (cx + 17, cy)]
    draw.polygon(tri, fill=(255, 255, 255, 255))

    # Text inside pill
    f_main = load_font(30, bold=True)
    f_sub = load_font(19, bold=False)
    draw.text(
        (cx + 54, py0 + 20),
        f"Watch Complete 45-Page Hub Film ({dur_label})",
        font=f_main,
        fill=(255, 255, 255, 255),
    )
    draw.text(
        (cx + 54, py0 + 60),
        "1080p HD  ·  Studio Voiceover + Score  ·  All 45 Subpages & Captions",
        font=f_sub,
        fill=(125, 211, 252, 255),
    )

    out = Image.alpha_composite(base, overlay).convert("RGB")
    out.save(OUT_CARD, format="PNG", optimize=True)
    print(f"✅ README video card saved: {OUT_CARD}")


if __name__ == "__main__":
    main()

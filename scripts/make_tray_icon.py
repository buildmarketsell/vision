"""Draw the menu bar icon (an eye, like VISION's app icon) as macOS template PNGs and write them into trayIcon.ts.

Run: uv run --with pillow python scripts/make_tray_icon.py"""
import base64, io, math
from PIL import Image, ImageDraw

def eye(scale: int) -> str:
    S = 8  # supersample
    n = 18 * scale * S
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = scale * S  # one point
    cx, cy, half_w, lift = n / 2, n / 2, 7.6 * u, 4.6 * u
    # Almond: two arcs meeting at the corners.
    top = [(cx - half_w + 2 * half_w * t / 60, cy - lift * math.sin(math.pi * t / 60)) for t in range(61)]
    bottom = [(x, 2 * cy - y) for x, y in reversed(top)]
    d.line(top + bottom + [top[0]], fill=(0, 0, 0, 255), width=round(1.5 * u), joint="curve")
    r = 2.7 * u
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 0, 0, 255))
    out = img.resize((18 * scale, 18 * scale), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()

ts = f"""/** The menu bar icon: an eye, like VISION's app icon. Template images (black + alpha), so macOS tints them. Drawn by scripts/make_tray_icon.py. */
export const TRAY_ICON_1X = 'data:image/png;base64,{eye(1)}';
export const TRAY_ICON_2X = 'data:image/png;base64,{eye(2)}';
"""
open("src/features/focus/main/trayIcon.ts", "w").write(ts)

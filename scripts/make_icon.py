"""Draw the VISION app icon (arc + eye) at 1024 px on Apple's icon grid.

Run: uv run --with pillow python scripts/make_icon.py build/icon.png, then rebuild build/icon.icns with sips + iconutil."""
import sys
from PIL import Image, ImageDraw, ImageFilter

S = 4  # supersample for smooth edges
N = 1024 * S
out = sys.argv[1]

img = Image.new("RGBA", (N, N), (0, 0, 0, 0))

# Apple grid: 824 px body centered in 1024, corner radius ~185.
inset, radius = 100 * S, 185 * S
shadow = Image.new("RGBA", (N, N), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(
    (inset, inset + 12 * S, N - inset, N - inset + 12 * S), radius, fill=(0, 0, 0, 70))
img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(14 * S)))

body = Image.new("RGBA", (N, N), (0, 0, 0, 0))
mask = Image.new("L", (N, N), 0)
ImageDraw.Draw(mask).rounded_rectangle((inset, inset, N - inset, N - inset), radius, fill=255)
grad = Image.new("RGBA", (N, N))
gd = ImageDraw.Draw(grad)
for y in range(N):
    t = y / N
    c = int(255 - 18 * t)
    gd.line((0, y, N, y), fill=(c, c, c, 255))
body.paste(grad, (0, 0), mask)
img = Image.alpha_composite(img, body)

d = ImageDraw.Draw(img)
ink = (28, 28, 30, 255)
cx = N // 2
base = 598 * S          # where the arc's flat ends sit
outer, thick = 300 * S, 112 * S

# Thick half ring: outer half disc minus inner half disc, cut flat at the base line.
ring = Image.new("L", (N, N), 0)
rd = ImageDraw.Draw(ring)
rd.pieslice((cx - outer, base - outer, cx + outer, base + outer), 180, 360, fill=255)
inner = outer - thick
rd.pieslice((cx - inner, base - inner, cx + inner, base + inner), 180, 360, fill=0)
img.paste(Image.new("RGBA", (N, N), ink), (0, 0), ring)

# The eye: a solid dot sitting on the base line with a small highlight.
r = 118 * S
ey = base + 10 * S
d.ellipse((cx - r, ey - r, cx + r, ey + r), fill=ink)
hr, hx, hy = 34 * S, cx + 46 * S, ey - 46 * S
d.ellipse((hx - hr, hy - hr, hx + hr, hy + hr), fill=(255, 255, 255, 255))

img.resize((1024, 1024), Image.LANCZOS).save(out)

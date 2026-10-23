from PIL import Image
import os

src = "docs/brand-source-256.png"
out = "public/img"
os.makedirs(out, exist_ok=True)

im = Image.open(src).convert("RGB")
print("source", im.size)

for size in (64, 176):
    r = im.resize((size, size), Image.LANCZOS)
    p = f"{out}/brand-{size}.png"
    r.save(p, optimize=True)
    print(p, os.path.getsize(p))

r176 = im.resize((176, 176), Image.LANCZOS)
p = f"{out}/brand-176.webp"
r176.save(p, "WEBP", quality=82, method=6)
print(p, os.path.getsize(p))

r180 = im.resize((180, 180), Image.LANCZOS)
p = f"{out}/brand-180.png"
r180.save(p, optimize=True)
print(p, os.path.getsize(p))

"""把 .icons-raw/ 里的原图缩成 96px WebP 存到 public/img/chars/。

用法：python scripts/resize-char-icons.py .icons-raw public/img/chars
"""
import os
import sys

from PIL import Image

SIZE = 96
QUALITY = 80

src_dir, dst_dir = sys.argv[1], sys.argv[2]
os.makedirs(dst_dir, exist_ok=True)

done = 0
skipped = 0
failed = []
total = 0

for name in sorted(os.listdir(src_dir)):
    if not name.lower().endswith(('.webp', '.png', '.jpg', '.jpeg')):
        continue
    total += 1
    stem = os.path.splitext(name)[0]
    out = os.path.join(dst_dir, stem + '.webp')
    if os.path.exists(out) and os.path.getsize(out) > 0:
        skipped += 1
        continue
    try:
        im = Image.open(os.path.join(src_dir, name))
        im = im.convert('RGBA')
        w, h = im.size
        side = min(w, h)
        # 居中裁成正方形再缩，避免头像被拉变形
        im = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
        im.save(out, 'WEBP', quality=QUALITY, method=6)
        done += 1
    except Exception as e:  # noqa: BLE001
        failed.append((name, str(e)))

print(f'resize: total={total} done={done} skipped={skipped} failed={len(failed)}')
if failed:
    for name, err in failed[:5]:
        print('  FAIL', name, err)

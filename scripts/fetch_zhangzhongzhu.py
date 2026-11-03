# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Fetch canvas images of the 掌中珠 scan from the NIJL IIIF service.

The images are CC BY-NC 4.0 and are kept in cache/, which git ignores; only the
transcription is committed. Canvas numbers are the IIIF canvas labels (1-based),
the file names are canvas - 1, zero-padded to five digits.
"""
import argparse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'cache' / 'zhangzhongzhu'
BASE = 'https://kokusho.nijl.ac.jp/api/iiif/100354804/v4/SAIG/SAIG-00219/SAIG-00219-{file}.tif'
CANVASES = 46


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--canvas', type=int, action='append', help='canvas number, repeatable; default all')
    parser.add_argument('--crop', help='IIIF region as pct:x,y,w,h')
    parser.add_argument('--size', default='full', help='IIIF size, e.g. 1600, or the default full')
    parser.add_argument('--out', type=Path, default=OUT)
    options = parser.parse_args()

    canvases = options.canvas or list(range(1, CANVASES + 1))
    region = options.crop or 'full'
    # A bare `x,y,w,h` is read as percentages of the canvas, which is how the
    # pages of this book are addressed; `pct:` may be given explicitly.
    if region != 'full' and ':' not in region:
        region = f'pct:{region}'
    # IIIF wants `1200,` for a width and no height; a bare `1200` is rejected.
    size = f'{options.size},' if options.size.isdigit() else options.size
    options.out.mkdir(parents=True, exist_ok=True)
    for canvas in canvases:
        if not 1 <= canvas <= CANVASES:
            raise SystemExit(f'canvas {canvas} is outside 1..{CANVASES}')
        # The cache key has to carry the size: 1600 and native are different pictures
        # of the same canvas, and a shared name would serve the wrong one later.
        region_key = 'native' if region == 'full' else region.replace(',', '_').replace(':', '')
        size_key = 'native' if size == 'full' else size.rstrip(',')
        name = f'{canvas:02d}-{region_key}-{size_key}.jpg'
        url = f'{BASE.format(file=f"{canvas - 1:05d}")}/{region}/{size}/0/default.jpg'
        target = options.out / name
        if target.exists():
            print(f'{target.relative_to(ROOT)} exists')
            continue
        with urllib.request.urlopen(url) as response, open(target, 'wb') as out:
            out.write(response.read())
        print(f'{target.relative_to(ROOT)}  {target.stat().st_size} bytes  <{url}>')


if __name__ == '__main__':
    main()

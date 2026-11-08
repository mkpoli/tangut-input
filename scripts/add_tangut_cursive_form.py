# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4==4.15.0",
#   "scipy==1.18.1",
#   "numpy==2.2.6",
#   "pillow==11.3.0",
#   "potracer==0.0.4",
#   "fonttools==4.68.0",
# ]
# ///
"""Add one traced cursive form to `data/cursive/forms.json.gz` and rebuild the face.

The font grows one verified form at a time. A form needs a crop, the character it shows, and the
source the crop comes from; the same trace as `fetch_tangut_cursive.py` turns it into an outline.
With `--base` it stands at the code point, and the earlier base becomes an alternate.

    uv run scripts/add_tangut_cursive_form.py --char 𗀔 --image crops/u17014.jpg \
        --source "Arakawa Shintaro 2016 p. 89 no. 1 A" --base
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import time

from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/cursive/forms.json.gz'


def tracer():
    """The tracing functions of the fetch script, imported without running its table pass."""
    spec = importlib.util.spec_from_file_location('fetch_tangut_cursive', ROOT / 'scripts/fetch_tangut_cursive.py')
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--char', required=True, help='the Tangut character the crop shows')
    parser.add_argument('--image', type=pathlib.Path, required=True, help='the crop')
    parser.add_argument('--source', required=True, help='the source title, as the source gives it')
    parser.add_argument('--crop', help='left,top,right,bottom as fractions of the crop')
    parser.add_argument('--base', action='store_true', help='stand at the code point')
    parser.add_argument('--no-build', action='store_true', help='write the record without rebuilding the face')
    args = parser.parse_args()

    if len(args.char) != 1 or not 0x17000 <= ord(args.char) <= 0x18DFF:
        raise SystemExit('--char must be one Tangut character')
    if not args.image.exists():
        raise SystemExit(f'no image at {args.image}')
    codepoint = f'{ord(args.char):04X}'

    module = tracer()
    data = args.image.read_bytes()
    picture = ImageOps.exif_transpose(Image.open(args.image)).convert('RGB')
    width, height = picture.size
    crop = None
    if args.crop:
        crop = [float(value) for value in args.crop.split(',')]
        if len(crop) != 4 or not all(0 <= value <= 1 for value in crop):
            raise SystemExit('--crop needs four fractions between 0 and 1')
        picture = picture.crop((round(width * crop[0]), round(height * crop[1]),
                                round(width * crop[2]), round(height * crop[3])))
    mask, _ = module.ink_mask(picture)
    outline = module.normalise(module.trace(mask))

    record = json.load(gzip.open(DATA, 'rt', encoding='utf-8'))
    forms = [form for form in record['forms'] if form['codepoint'] == codepoint]
    order = max((form['order'] for form in record['forms'] if form['codepoint'] == codepoint), default=-1) + 1
    base = args.base or not any(form['base'] for form in forms)
    form = {
        'char': args.char,
        'codepoint': codepoint,
        'meaning': forms[0]['meaning'] if forms else '',
        'references': forms[0]['references'] if forms else [],
        'source': args.source,
        'image': args.image.name,
        'sha256': hashlib.sha256(data).hexdigest(),
        'width': width,
        'height': height,
        'order': order,
        'outline': outline,
        'base': base,
    }
    if crop:
        form['crop'] = crop
    for old in forms:
        if base:
            old['base'] = False
        old.pop('alternate', None)
    record['forms'].append(form)
    if base:
        form['base'] = True
    alternate = 0
    for old in sorted((f for f in record['forms'] if f['codepoint'] == codepoint), key=lambda f: f['order']):
        if old['base']:
            old['base'] = True
            old.pop('alternate', None)
        else:
            alternate += 1
            old['alternate'] = alternate
    record['built'] = time.strftime('%Y-%m-%d')
    raw = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    with gzip.GzipFile(DATA, 'wb', mtime=0) as archive:
        archive.write(raw)
    count = sum(1 for item in record['forms'] if item['base'])
    print(f'{DATA.relative_to(ROOT)}: {count} characters, {len(record["forms"])} forms')

    if not args.no_build:
        subprocess.run(['uv', 'run', str(ROOT / 'scripts/build_tangut_cursive_font.py')], check=True, cwd=ROOT)


if __name__ == '__main__':
    main()

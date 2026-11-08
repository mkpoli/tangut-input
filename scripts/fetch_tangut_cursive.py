# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4==4.15.0",
#   "fonttools==4.68.0",
#   "numpy==2.2.6",
#   "pillow==11.3.0",
#   "potracer==0.0.4",
#   "scipy==1.18.1",
# ]
# ///
"""Read BabelStone's table of cursive Tangut examples and trace each example to an outline.

The table at https://www.babelstone.co.uk/Tangut/CursiveExamples.html lists 108 Tangut characters
with 1 to 8 cursive forms each, cut from Arakawa Shintaro's 2016 report and from manuscript
photographs. This script downloads the images once into `cache/cursive/`, separates the ink from
the paper, traces the ink with potrace (the `potracer` port), normalises every form to a 1000-unit
em, and writes `data/cursive/forms.json.gz`.

The source page states no licence for the images; the crops are not written into the repository.
The record keeps each crop's URL, SHA-256 and the title the page gives it, so a rebuild can tell
that a file changed. The font built from the record is in `fonts/`.

    uv run scripts/fetch_tangut_cursive.py            # cached images, trace, write the record
    uv run scripts/fetch_tangut_cursive.py --refresh  # download the page and images again
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import pathlib
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import potrace
from bs4 import BeautifulSoup
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from PIL import Image, ImageFilter, ImageOps
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / 'cache/cursive'
SOURCE_PAGE = 'https://www.babelstone.co.uk/Tangut/CursiveTangut.html'
TABLE_PAGE = 'https://www.babelstone.co.uk/Tangut/CursiveExamples.html'
BASE = 'https://www.babelstone.co.uk/Tangut/'
TABLE_CACHE = CACHE / 'CursiveExamples.html'
OUT = ROOT / 'data/cursive/forms.json.gz'

EM = 1000
# The ink box in font units. Noto Serif Tangut's glyphs run x 46-947, y -81-824, so a cursive
# glyph set to the same height sits beside them; the advance stays a full em.
INK = 880
CENTER_X = 500
CENTER_Y = 372
TARGET_PIXELS = 760

# Where the page's first form traces badly (a neighbour's ink joined the glyph, or the crop is
# cut), a later form of the same character stands at the code point instead. The other forms stay
# available as alternates, so no form is lost.
BASE_OVERRIDES = {
    '174DA': {
        'image': 'U_174DA_F056_2_4.jpg',
        'reason': 'The first crop is a mass in which the glyph and the character beside it join; '
                  'the second crop separates them.',
    },
    '17943': {
        'image': 'U_17943_Tang_334_248.png',
        'reason': 'The first crop is faint and cut; the second is the clearest of the five.',
    },
}

# Crops whose edges carry part of the character beside the named one. The page's crop is kept,
# less the strip named here, as fractions of the crop's width and height (left, top, right,
# bottom). The glyph itself stays inside the kept part.
CROPS = {
    'U_1710B_F065_1.jpg': (0.06, 0.06, 0.90, 0.94),
    'U_172BB_F056_2_2.jpg': (0.04, 0.02, 0.83, 0.98),
    'U_17C2D_F056_3_4.jpg': (0.18, 0.02, 0.98, 0.98),
}


def fetch(url: str, path: pathlib.Path, refresh: bool) -> bytes:
    if path.exists() and not refresh:
        return path.read_bytes()
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                data = response.read()
            break
        except urllib.error.HTTPError as error:
            if error.code == 404:
                raise
            if attempt == 3:
                raise
            time.sleep(1 + attempt)
        except OSError:
            if attempt == 3:
                raise
            time.sleep(1 + attempt)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data


def read_table(refresh: bool) -> tuple[list[dict], str]:
    data = fetch(TABLE_PAGE, TABLE_CACHE, refresh=refresh)
    html = data.decode('utf-8')
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    for row in soup.select('table tr'):
        cells = row.find_all(['th', 'td'])
        if len(cells) < 5:
            continue
        code = cells[0].get_text(' ', strip=True)
        if not re.fullmatch(r'[0-9A-F]{4,6}', code):
            continue
        references = [item for item in cells[2].get_text(' ', strip=True).split() if item]
        images = [
            {'image': img['src'].removeprefix('Cursive/'), 'title': img.get('title', '')}
            for img in cells[4].find_all('img')
        ]
        rows.append({
            'codepoint': int(code, 16),
            'char': cells[1].get_text(' ', strip=True),
            'references': references,
            'meaning': cells[3].get_text(' ', strip=True),
            'images': images,
        })
    if len(rows) != 108:
        raise SystemExit(f'expected 108 rows, read {len(rows)}')
    return rows, hashlib.sha256(data).hexdigest()


def otsu(values: np.ndarray) -> float:
    histogram, _ = np.histogram(values, bins=256, range=(0, 1))
    probability = histogram.astype(np.float64)
    probability /= probability.sum()
    omega = np.cumsum(probability)
    mu = np.cumsum(probability * np.arange(256))
    mu_total = mu[-1]
    denominator = omega * (1 - omega)
    with np.errstate(divide='ignore', invalid='ignore'):
        variance = (mu_total * omega - mu) ** 2 / denominator
    variance[~np.isfinite(variance)] = -1
    return (int(np.argmax(variance)) + 0.5) / 256


def ink_mask(image: Image.Image) -> tuple[np.ndarray, int]:
    """Separate the ink from the paper and drop the specks and neighbouring strokes the crop
    catches. Returns a boolean mask (True is ink) and the upscaling factor."""
    grey = image.convert('L')
    width, height = grey.size
    upscale = max(4, min(16, round(TARGET_PIXELS / max(width, height))))
    grey = grey.resize((width * upscale, height * upscale), Image.LANCZOS)
    grey = grey.filter(ImageFilter.MedianFilter(3))
    values = np.asarray(grey, dtype=np.float32) / 255.0

    # Paper is lighter than ink, so closing the grey levels removes the ink and leaves an
    # illumination map; dividing by it flattens shadows, foxing and the tan of old paper.
    radius = max(5, round(max(values.shape) * 0.10))
    paper = ndimage.grey_closing(values, size=(radius, radius))
    paper = ndimage.gaussian_filter(paper, radius / 2)
    inkness = np.clip(1 - values / np.maximum(paper, 1e-3), 0, 1)
    mask = inkness > otsu(inkness)

    structure = np.ones((3, 3), bool)
    labelled, count = ndimage.label(mask, structure=structure)
    if count == 0:
        return mask, upscale
    sizes = ndimage.sum(mask, labelled, range(1, count + 1))
    centroids = ndimage.center_of_mass(mask, labelled, range(1, count + 1))
    height, width = values.shape
    # The page centres the crop on the glyph, so its strokes have their centres near the middle;
    # a neighbour's strip at an edge does not. The window is the box around those central
    # strokes, not around the largest single stroke: a cursive glyph can be several strokes, and
    # the largest of them may be only one of them.
    middle = [index for index, (cy, cx) in enumerate(centroids, start=1)
              if 0.22 * width <= cx <= 0.78 * width and 0.22 * height <= cy <= 0.78 * height]
    central = np.isin(labelled, middle) if middle else mask
    ys, xs = np.where(central)
    pad = 0.08 * max(values.shape)
    left, right = xs.min() - pad, xs.max() + pad
    top, bottom = ys.min() - pad, ys.max() + pad

    # Keep only the ink near the glyph. The page's crops catch parts of the characters beside
    # the one they name; those sit outside this window and their strokes would otherwise join the
    # glyph. A dot or a broken stroke of the glyph itself stays within a few percent of its box.
    keep = np.zeros(count + 1, bool)
    minimum = max(4 * upscale * upscale, 0.0006 * sizes.max())
    for index in range(1, count + 1):
        if sizes[index - 1] < minimum:
            continue
        cy, cx = centroids[index - 1]
        if left <= cx <= right and top <= cy <= bottom:
            keep[index] = True
    # A fragment of a neighbouring character often runs off the edge of the crop. If it is not
    # one of the central strokes and it touches the border, it does not belong to this glyph.
    edge = np.zeros_like(mask)
    edge[:2, :] = edge[-2:, :] = edge[:, :2] = edge[:, -2:] = True
    for index in np.unique(labelled[edge & mask]):
        if index not in middle:
            keep[index] = False

    before = mask.sum()
    kept = keep[labelled]
    # A faint, broken glyph can be made mostly of dots that no single component holds. When the
    # window would throw most of the ink away, the image is the glyph and the window is wrong.
    if kept.sum() < 0.40 * before:
        kept = mask.copy()
    mask = kept

    # Fill the small holes that JPEG noise makes inside a stroke, but leave the loops of the
    # glyph open: a loop is far larger than any compression artefact.
    holes, count = ndimage.label(~mask, structure=structure)
    if count:
        sizes = ndimage.sum(~mask, holes, range(1, count + 1))
        border = set(np.unique(np.concatenate([holes[0, :], holes[-1, :], holes[:, 0], holes[:, -1]])))
        fill = np.zeros(count + 1, bool)
        for index in range(1, count + 1):
            if index in border:
                continue
            fill[index] = sizes[index - 1] < max(6 * upscale * upscale, 0.0005 * mask.sum())
        mask |= fill[holes]
    return mask, upscale


def point(value) -> tuple[float, float]:
    return value.x, value.y


def trace(mask: np.ndarray) -> RecordingPen:
    """Trace the ink with potrace. A mask of True is paper to potracer's bitmap, so invert it."""
    bitmap = potrace.Bitmap(~mask)
    path = bitmap.trace(turdsize=10, alphamax=1.0, opticurve=True, opttolerance=0.3)
    pen = RecordingPen()
    for curve in path:
        pen.moveTo(point(curve.start_point))
        for segment in curve.segments:
            if segment.is_corner:
                # A corner is two straight lines, through the corner point to the end point.
                pen.lineTo(point(segment.c))
                pen.lineTo(point(segment.end_point))
            else:
                pen.curveTo(point(segment.c1), point(segment.c2), point(segment.end_point))
        pen.closePath()
    return pen


def bounds(pen: RecordingPen) -> tuple[float, float, float, float]:
    pen_calculator = BoundsPen(None)
    pen.replay(pen_calculator)
    if pen_calculator.bounds is None:
        raise ValueError('empty outline')
    return pen_calculator.bounds


def normalise(pen: RecordingPen) -> list[list]:
    """Fit the ink into the em box and write the pen's commands for the font builder."""
    x0, y0, x1, y1 = bounds(pen)
    scale = INK / max(x1 - x0, y1 - y0)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    commands = []
    for operator, points in pen.value:
        if operator == 'closePath':
            commands.append(['Z'])
            continue
        mapped = []
        for x, y in points:
            mapped.extend([round(CENTER_X + (x - mx) * scale), round(CENTER_Y + (my - y) * scale)])
        commands.append([{'moveTo': 'M', 'lineTo': 'L', 'curveTo': 'C'}[operator], *mapped])
    return commands


def draw(form: dict, image: Image.Image) -> dict:
    mask, _ = ink_mask(image)
    pen = trace(mask)
    form['outline'] = normalise(pen)
    return form


def download(item):
    row, position, image = item
    path = CACHE / 'source' / image['image']
    try:
        data = fetch(BASE + 'Cursive/' + image['image'], path, refresh=ARGS.refresh)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return row, position, image, None
        raise
    return row, position, image, data


def main() -> None:
    rows, table_sha256 = read_table(ARGS.refresh)
    items = [(row, position, image) for row in rows for position, image in enumerate(row['images'])]
    with ThreadPoolExecutor(max_workers=6) as pool:
        downloads = list(pool.map(download, items))

    forms = []
    missing = []
    for row, position, image, data in downloads:
        if data is None:
            missing.append({'codepoint': f'{row["codepoint"]:04X}', 'char': row['char'],
                            'image': image['image'], 'source': image['title']})
            print(f'missing on the page: {image["image"]}')
            continue
        picture = ImageOps.exif_transpose(Image.open(CACHE / 'source' / image['image'])).convert('RGB')
        width, height = picture.size
        crop = CROPS.get(image['image'])
        if crop:
            picture = picture.crop((round(width * crop[0]), round(height * crop[1]),
                                    round(width * crop[2]), round(height * crop[3])))
        form = {
            'char': row['char'],
            'codepoint': f'{row["codepoint"]:04X}',
            'meaning': row['meaning'],
            'references': row['references'],
            'source': image['title'],
            'image': image['image'],
            'sha256': hashlib.sha256(data).hexdigest(),
            'width': width,
            'height': height,
            'order': position,
        }
        if crop:
            form['crop'] = list(crop)
        forms.append(draw(form, picture))
        print(f'{row["char"]} {form["codepoint"]} {image["image"]}: {len(form["outline"])} commands')

    # The first Arakawa form is the cleanest reproduction on the page; where there is none, the
    # page's first form stands for the character and the others become stylistic alternates.
    for row in rows:
        candidates = [form for form in forms if form['codepoint'] == f'{row["codepoint"]:04X}']
        if not candidates:
            continue
        arakawa = [form for form in candidates if form['source'].startswith('Arakawa')]
        wanted = BASE_OVERRIDES.get(form['codepoint'], {})
        override = [form for form in candidates if form['image'] == wanted.get('image')]
        base = override[0] if override else arakawa[0] if arakawa else candidates[0]
        alternate = 0
        for form in candidates:
            form['base'] = form is base
            if form is base:
                form.pop('alternate', None)
            else:
                alternate += 1
                form['alternate'] = alternate

    retrieved = time.strftime('%Y-%m-%d', time.localtime(TABLE_CACHE.stat().st_mtime))
    record = {
        'format': 'tangut-cursive/1',
        'built': ARGS.built,
        'source': {
            'page': SOURCE_PAGE,
            'table': TABLE_PAGE,
            'tableModified': '2020-07-01',
            'compiler': 'Andrew West (BabelStone)',
            'retrieved': retrieved,
            'tableSha256': table_sha256,
            'note': 'The page states no licence for the images. Each crop is a reproduction from the '
                    'publication or manuscript its title names; the titles are kept as the page gives them, '
                    'including the spelling Baisgou Fangta.',
        },
        'selection': {
            'rule': 'The first Arakawa form where the page gives one, otherwise the page\'s first '
                    'form; two later forms stand at their code point because their earlier forms '
                    'trace badly.',
            'overrides': [
                {'codepoint': codepoint, 'image': value['image'], 'reason': value['reason']}
                for codepoint, value in BASE_OVERRIDES.items()
            ],
        },
        'metrics': {'unitsPerEm': EM, 'ink': INK, 'center': [CENTER_X, CENTER_Y], 'advance': EM,
                    'ascent': 836, 'descent': -146},
        'forms': forms,
        'missing': missing,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    with gzip.GzipFile(OUT, 'wb', mtime=0) as archive:
        archive.write(raw)
    bases = sum(1 for form in forms if form['base'])
    print(f'{OUT.relative_to(ROOT)}: {bases} characters, {len(forms)} forms, {OUT.stat().st_size} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true', help='download the page and images again')
    parser.add_argument('--built', default=time.strftime('%Y-%m-%d'), help='the date to record')
    ARGS = parser.parse_args()
    main()

# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==13.0.0"]
# ///
"""Build `app/data/tangut-attestation.json.gz` and the facsimile crops under `app/public/facsimile/`.

The source is the Glyph Atlas record of chapter 2 of the Tangut Bodhicaryāvatāra: the lines of the
edition of Solonin and Arakawa (2024) with their English translation, the link to ぶんぽ's reading of
each line, and one box per character on the edition's facsimile. The output keeps every line, and
for each character the places that attest it; a character missing from it has no attestation yet,
and the page says so. Each character box is cut from the facsimile strip as a small greyscale WebP.

Set GLYPH_ATLAS to the Glyph Atlas checkout when it is not ~/projects/Philology/glyph-atlas. The
strips come from its `work/tangut/facsimile/`, which `scripts/build_tangut_facsimile.py` there
regenerates.
"""
import gzip
import hashlib
import json
import os
import re
from datetime import date
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/tangut-attestation.json.gz'
CROPS = ROOT / 'app/public/facsimile/solonin-2024'
ATLAS = Path(os.environ.get('GLYPH_ATLAS', '~/projects/Philology/glyph-atlas')).expanduser()
TEXTS = ATLAS / 'data/tangut'
STRIPS = ATLAS / 'work/tangut/facsimile'
TANGUT = re.compile(r'^[\U00017000-\U00018AFF\U00018D00-\U00018DFF]$')
CROP_HEIGHT = 128

# The edition, its rights, and the reading series the line links point to, as Glyph Atlas records them.
SOURCES = [
    {
        'id': 'solonin-2024',
        'title': 'Śāntideva’s Bodhicaryāvatāra in Tangut Translation, chapter 2',
        'author': 'Kirill Solonin and Shintaro Arakawa',
        'year': 2024,
        'publisher': 'ILCAA, Tokyo University of Foreign Studies',
        'url': 'https://hdl.handle.net/10108/0002000647',
        'licence': 'CC BY 4.0',
        'manuscript': 'IOM RAS Tangut collection no. 781',
        'facsimile': '/facsimile/solonin-2024/{line}-{position}.webp',
        'facsimileCredit': 'Facsimile from the edition (CC BY 4.0), which reproduces photographs by the Institute of Ethnology, CASS. Boxes cut by Glyph Atlas; the page edge cuts the right side of line 2.1.1.',
        'reading': 'ぶんぽ, 西夏語公開自主ゼミ (note.com, 2024-12-30 to 2025-09-15)',
        'readingUrl': 'https://note.com/bunpo10381227',
    },
]


def table(name):
    path = TEXTS / f'bodhicaryavatara-ch2.{name}.tsv'
    rows = [row for row in path.read_text(encoding='utf-8').splitlines() if row and not row.startswith('#')]
    header = rows[0].split('\t')
    return [dict(zip(header, row.split('\t'))) for row in rows[1:]]


def main():
    lines = table('lines')
    boxes = {(row['line_id'], int(row['position'])): row for row in table('facsimile-characters')}
    CROPS.mkdir(parents=True, exist_ok=True)
    strips = {}

    rows = {}
    out_lines = {}
    cropped = 0
    for row in lines:
        line_id = row['line_id']
        out_lines[line_id] = {
            'text': row['tangut'],
            'english': row['english'],
            'page': int(row['page']),
            'read': row['reading'] == 'read',
            'url': row['reading_url'],
        }
        for position, char in enumerate(row['tangut'], 1):
            if not TANGUT.match(char):
                continue
            rows.setdefault(char, {}).setdefault('solonin-2024', []).append([line_id, position])
            box = boxes.get((line_id, position))
            if box and crop(box, strips, CROPS / f'{line_id.split(":")[1]}-{position}.webp'):
                cropped += 1

    corpus = ' '.join(row['tangut'] for row in lines)
    document = {
        'built': date.today().isoformat(),
        'corpus': {'lines': len(lines), 'characters': sum(len(row['tangut']) for row in lines), 'distinct': len(rows), 'sha256': hashlib.sha256(corpus.encode()).hexdigest()},
        'sources': SOURCES,
        'lines': out_lines,
        'rows': rows,
    }
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(raw)
    print(f'{len(rows)} characters in {len(lines)} lines, {cropped} crops, {len(raw)} bytes raw, {OUT.stat().st_size} gzipped -> {OUT.relative_to(ROOT)}')


def crop(box, strips, path):
    """Cut one character box from its facsimile strip, scaled to a common height, in greyscale."""
    page = box['image'].rsplit(':', 1)[1]
    source = STRIPS / f'facsimile-{page}.png'
    if not source.exists():
        return False
    if page not in strips:
        strips[page] = Image.open(source).convert('L')
    x, y, w, h = (int(box[key]) for key in ('x', 'y', 'w', 'h'))
    piece = strips[page].crop((x, y, x + w, y + h))
    scale = CROP_HEIGHT / h
    piece = piece.resize((max(1, round(w * scale)), CROP_HEIGHT), Image.Resampling.LANCZOS)
    piece.save(path, 'WEBP', quality=72, method=6)
    return True


if __name__ == '__main__':
    main()

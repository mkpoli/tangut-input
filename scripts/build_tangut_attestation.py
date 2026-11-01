# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build `app/data/tangut-attestation.json.gz`, where each Tangut character is attested.

The sources are the Lomtatidze/Tangut Digital Corpus text records in the Glyph Atlas data directory,
one file per source with one row per attested character: the line it stands in and its count there.
The output keeps, for each character, the sources that attest it and their first lines; a character
missing from it has no attestation yet, and the page says so.

Set GLYPH_ATLAS to the Glyph Atlas checkout when it is not ~/projects/Philology/glyph-atlas.
"""
import gzip
import hashlib
import json
import os
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/tangut-attestation.json.gz'
ATLAS = Path(os.environ.get('GLYPH_ATLAS', '~/projects/Philology/glyph-atlas')).expanduser()
TANGUT = re.compile(r'^[\U00017000-\U00018AFF\U00018D00-\U00018DFF]$')
TEXTS = ATLAS / 'data/tangut'

# The reading series and the edition the lines come from, with the rights Glyph Atlas records for them.
SOURCES = [
    {
        'id': 'solonin-2024',
        'title': 'Śāntideva’s Bodhicaryāvatāra in Tangut Translation, chapter 2',
        'author': 'Kirill Solonin and Shintaro Arakawa',
        'url': 'https://hdl.handle.net/10108/0002000647',
        'licence': 'CC BY 4.0',
        'note': 'Line readings from ぶんぽ, 西夏語公開自主ゼミ.',
    },
]


def lines():
    path = TEXTS / 'bodhicaryavatara-ch2.lines.tsv'
    rows = [row for row in path.read_text(encoding='utf-8').splitlines() if row and not row.startswith('#')]
    header = rows[0].split('\t')
    return [dict(zip(header, row.split('\t'))) for row in rows[1:]]


def main():
    built = {}
    for row in lines():
        line_id = row['line_id']
        for position, char in enumerate(row['tangut'], 1):
            if not TANGUT.match(char):
                continue
            entry = built.setdefault(char, {})
            source = entry.setdefault('solonin-2024', [])
            source.append([line_id, position])

    corpus = ' '.join(row['tangut'] for row in lines())
    document = {
        'built': date.today().isoformat(),
        'corpus': {'lines': len(lines()), 'characters': len(corpus), 'sha256': hashlib.sha256(corpus.encode()).hexdigest()},
        'sources': SOURCES,
        'rows': built,
    }
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(raw)
    print(f'{len(built)} characters in {len(lines())} lines, {len(raw)} bytes raw, {OUT.stat().st_size} gzipped -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

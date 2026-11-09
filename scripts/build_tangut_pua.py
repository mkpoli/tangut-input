"""Build `app/data/tangut-pua.json.gz` from `data/tangut-pua-variants.tsv`.

Tangut Yinchuan v16.0.4 draws 2,814 Tangut variant forms in Supplementary Private Use Area-A,
U+F0000 through U+F1613. The table pairs each with its encoded base character, its IDS and the source
that attests the form. 39 variants have no base character; they are counted and kept separately, not
shown on a card.

The source page states no licence. The font's own terms, including Jing Yongshi's copyright, are on
https://www.babelstone.co.uk/Fonts/Yinchuan.html. Only the code points, IDS and source references are
kept here.

    python3 scripts/build_tangut_pua.py
"""

import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/tangut-pua-variants.tsv'
OUT = ROOT / 'app/data/tangut-pua.json.gz'
URL = 'https://www.babelstone.co.uk/Fonts/Tangut_Variants.html'
FONT = 'https://www.babelstone.co.uk/Fonts/Yinchuan.html'
VERSION = '16.0.4'
RETRIEVED = '2026-11-09'


def main():
    rows = []
    for line in SOURCE.read_text(encoding='utf-8').splitlines():
        if not line or line.startswith('#'):
            continue
        base, code, ids, sources = line.split('\t')
        point = int(code, 16)
        if not 0xF0000 <= point <= 0xF1613:
            raise SystemExit(f'{code} is outside the Tangut Yinchuan PUA range')
        if base:
            character = chr(int(base, 16))
            if not 0x17000 <= ord(character) <= 0x18D7F:
                raise SystemExit(f'{base} is not a Tangut code point')
        else:
            character = ''
        rows.append((character, f'U+{code}', ids, [part for part in sources.split(' | ') if part]))
    if len(rows) != 2814:
        raise SystemExit(f'{len(rows)} rows, expected 2,814')
    chars = {}
    unassigned = []
    for character, code, ids, sources in rows:
        if not character:
            unassigned.append([code, ids, sources])
            continue
        chars.setdefault(character, []).append([code, ids, sources])
    for values in chars.values():
        values.sort(key=lambda row: row[0])
    codes = {row[1] for row in rows}
    data = {
        'format': 'tangut-input/tangut-pua',
        'source': URL,
        'font': FONT,
        'version': VERSION,
        'retrieved': RETRIEVED,
        'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'note': 'Tangut Yinchuan PUA variants, each paired with its encoded base character, IDS and source. '
                'The page states no licence; the font terms are on the BabelStone Yinchuan page. '
                'A PUA code is a variant glyph, not a different encoded character. '
                '39 variants have no encoded base character.',
        'counts': {
            'rows': len(rows),
            'assigned': sum(len(values) for values in chars.values()),
            'characters': len(chars),
            'codes': len(codes),
            'unassigned': len(unassigned),
        },
        'chars': dict(sorted(chars.items(), key=lambda item: ord(item[0]))),
        'unassigned': unassigned,
    }
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{len(chars)} characters, {data["counts"]["assigned"]} assigned variants, '
          f'{len(unassigned)} without a base -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


if __name__ == '__main__':
    main()

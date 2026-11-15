"""Build `app/data/tangut-pua.json.gz` from `data/tangut-pua-variants.tsv`.

Tangut Yinchuan v16.0.4 draws 2,814 Tangut variant forms in Supplementary Private Use Area-A,
U+F0000 through U+F1613. The table pairs each with its encoded base character, its IDS and the source
that attests the form. 39 variants have no base character in version 16.0.4; the Unicode 18.0
proposals give 16 of them a character, and the 23 left are listed on the Variants page and answered
by Find.

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

# The PUA codes in the 39 unassigned rows that Unicode 18.0 now gives a character. N5217 assigns
# 187F8-187FF and 18D09-18D1C; this map holds the 14 of those that the table leaves unassigned.
# N5286 assigns 18D1D and N5314 assigns 18D20. The IDS and sources stay the source table's; a
# proposal can give a slightly different IDS (F05C1's differs by one component).
UNICODE_18 = {
    'U+F05C1': 'U+187F8', 'U+F05C4': 'U+187F9', 'U+F0631': 'U+187FA',
    'U+F0630': 'U+187FB', 'U+F0632': 'U+187FC', 'U+F01A6': 'U+187FD',
    'U+F054C': 'U+187FE', 'U+F00FE': 'U+18D0C', 'U+F00E2': 'U+18D0D',
    'U+F01A1': 'U+18D0E', 'U+F0624': 'U+18D15', 'U+F062D': 'U+18D16',
    'U+F0580': 'U+18D1A', 'U+F051C': 'U+18D1B', 'U+F15F8': 'U+18D1D',
    'U+F1025': 'U+18D20',
}


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
    encoded_in_unicode18 = []
    unencoded = []
    unassigned_codes = {code for code, _, _ in unassigned}
    missing = set(UNICODE_18) - unassigned_codes
    if missing:
        raise SystemExit(f'UNICODE_18 names codes the table does not leave unassigned: {sorted(missing)}')
    for code, ids, sources in unassigned:
        point = UNICODE_18.get(code)
        if point:
            encoded_in_unicode18.append([code, ids, sources, point])
        else:
            unencoded.append([code, ids, sources])
    if (len(encoded_in_unicode18), len(unencoded)) != (16, 23):
        raise SystemExit(f'{len(encoded_in_unicode18)} encoded, {len(unencoded)} unencoded; expected 16 and 23')
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
                'The table leaves 39 variants without a base character; the Unicode 18.0 proposals give '
                '16 of them a code point, and 23 remain without one.',
        'counts': {
            'rows': len(rows),
            'assigned': sum(len(values) for values in chars.values()),
            'characters': len(chars),
            'codes': len(codes),
            'unassigned': len(unassigned),
            'encodedInUnicode18': len(encoded_in_unicode18),
            'unencoded': len(unencoded),
        },
        'chars': dict(sorted(chars.items(), key=lambda item: ord(item[0]))),
        'unassigned': unassigned,
        'encodedInUnicode18': encoded_in_unicode18,
        'unencoded': unencoded,
    }
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{len(chars)} characters, {data["counts"]["assigned"]} assigned variants, '
          f'{len(unassigned)} without a base ({len(encoded_in_unicode18)} now in Unicode 18.0, '
          f'{len(unencoded)} still without one) -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


if __name__ == '__main__':
    main()

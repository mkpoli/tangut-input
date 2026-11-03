"""Check BabelStone's 文海 skeleton against the rhyme data the site is built from.

Andrew West's draft electronic 文海 (Wenhai.html) gives, for each head character of the level-tone
and mixed volumes, its position, its fanqie and sometimes its construction, all written in the
Private Use Area of two scan fonts. The page's radical index (WHYJ_Index.html) ties each index-font
glyph to a Li Fanwen 2008 number, and nkay0's table ties those numbers to Unicode, so the fanqie can
be read as Unicode and compared, position by position, with the table's own 文海 fanqie. The head
characters are compared too, through BabelStone's Unicode listing (WenhaiUnicode.html).

Nothing is written; the script prints the counts and every disagreement.

    uv run python scripts/check_babelstone_wenhai.py [--pages DIR] [--csv FILE]

DIR holds saved copies of the three pages under their own names.
"""

import argparse
import collections
import csv
import hashlib
import io
import re
import urllib.request
from pathlib import Path

from build_tangut_rhymes import SHA256, URL as TABLE

BASE = 'https://www.babelstone.co.uk/Tangut/'
PAGES = ('Wenhai.html', 'WenhaiUnicode.html', 'WHYJ_Index.html')
# Level-tone sections are anchored Ping_NN, the mixed volume Za_… under Mixed_…; the table writes
# a position in the level-tone volume as 1.05.143, in the mixed one as Z.02.111.
VOLUME = {'Ping': '1', 'Za': 'Z'}


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': 'tangut-input data check'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def by_position(page: str, anchor: str, row: str) -> dict[str, tuple]:
    """Rows keyed by the table's position form, volume.folio.place (1.05.143, Z.02.111)."""
    marks = [(m.start(), m.group(1)) for m in re.finditer(anchor, page)]
    rows = {}
    for m in re.finditer(row, page, re.S):
        section = [name for at, name in marks if at < m.start()][-1]
        volume = VOLUME['Za' if section.startswith(('Za', 'Mixed')) else 'Ping']
        folio, place = m.group(1).split('.')
        key = f'{volume}.{int(folio):02d}.{place}'
        if key in rows:
            raise SystemExit(f'position {key} appears twice')
        rows[key] = m.groups()[1:]
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=Path, help='a folder of saved copies of the three pages')
    parser.add_argument('--csv', type=Path, help="a copy of nkay0's table, instead of fetching it")
    options = parser.parse_args()
    pages = {name: (options.pages / name).read_bytes() if options.pages else fetch(BASE + name) for name in PAGES}
    wenhai, listing, index = (pages[name].decode('utf-8') for name in PAGES)
    raw = options.csv.read_bytes() if options.csv else fetch(TABLE)
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise SystemExit('the table is not the one the site is built from')

    skeleton = by_position(
        wenhai, r'<a name="([^"]+)"',
        r'<tr><td>([\d.]+)</td><td><span class="whyj med">(.*?)</span></td><td><span class="whyj big">(.*?)</span></td>'
        r'<td class="left"><span class="whyjx big">(.*?)</span></td><td class="left"><span class="whyjx big">(.*?)</span></td>'
        r'<td>(.*?)</td></tr>')
    heads = by_position(listing, r'id="([^"]+)"', r'<td class="sl">([\d.]+)</td>\s*<td class="sl"><span class="wenhai big">(.*?)</span>')
    glyph_number = {glyph: number for glyph, number in re.findall(
        r'<tr><th>\d+</th><td><span class="whyjx vbig">(.)</span></td><td>.*?</td><td>.*?</td><td>(\d+)</td></tr>', index)}

    table = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    number_char = {row['李範文 2008'][1:].lstrip('0'): row['文字'] for row in table if row['李範文 2008'][1:].isdigit()}
    at = {row['文海']: row for row in table if row['文海']}

    def unicode_of(glyphs: str) -> str:
        return ''.join(number_char.get(glyph_number.get(glyph, '').lstrip('0'), '¿') for glyph in glyphs)

    filled = collections.Counter()
    for _circle, _glyph, fanqie, construction, definition in skeleton.values():
        filled['fanqie'] += bool(fanqie)
        filled['construction'] += bool(construction)
        filled['definition'] += bool(definition.strip())
    print(f'{len(skeleton)} head characters; filled: {dict(filled)}')

    head_same = head_other = head_missing = 0
    for key, (char,) in heads.items():
        row = at.get(key)
        if not row:
            head_missing += 1
        elif row['文字'] == char:
            head_same += 1
        else:
            head_other += 1
            print(f'head  {key}  BabelStone {char}  table {row["文字"]}')
    print(f'head characters: {head_same} agree, {head_other} differ, {head_missing} positions not in the table')

    kinds = collections.Counter()
    for key, (_circle, _glyph, fanqie, _construction, _definition) in sorted(skeleton.items()):
        if not fanqie:
            continue
        row = at.get(key)
        upper, lower = (row['文海 反切上字'], row['文海 反切下字']) if row else ('', '')
        if not upper or '?' in upper + lower:
            kinds['no fanqie in the table'] += 1
            continue
        read = unicode_of(fanqie)[:2]
        if read == upper + lower:
            kinds['agree'] += 1
            continue
        kind = ('not convertible' if '¿' in read
                else 'table gives the head as its own speller' if row['文字'] in (upper, lower)
                else 'both differ' if read[0] != upper and read[1] != lower
                else 'upper differs' if read[0] != upper else 'lower differs')
        kinds[kind] += 1
        print(f'fanqie  {key}  {row["文字"]}  BabelStone {read}  table {upper}{lower}  ({kind})')
    print('fanqie:', dict(kinds))


if __name__ == '__main__':
    main()

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


def position(section: str, place: str) -> str:
    """The table's position form, volume.folio.place: 1.05.143 or Z.02.111."""
    volume = VOLUME['Za' if section.startswith(('Za', 'Mixed')) else 'Ping']
    folio, rest = place.split('.')
    return f'{volume}.{int(folio):02d}.{rest}'


def cells(row: str) -> list[str]:
    """The text of each cell, with notes and markup taken out."""
    return [re.sub(r'<[^>]+>', '', re.sub(r'<sup>.*?</sup>', '', cell)).strip()
            for cell in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row)]


def skeleton_rows(page: str) -> dict[str, list[str]]:
    """Each head character's cells (circle, glyph, fanqie, construction, definition) by position.
    The page puts one row on one line; a row whose place is not a number (4X.XXX) is a gap."""
    rows, section = {}, ''
    for line in page.splitlines():
        anchor = re.search(r'<a name="([^"]+)"', line)
        if anchor:
            section = anchor.group(1)
        if not line.startswith('<tr><td>'):
            continue
        place, *rest = cells(line)
        if not re.fullmatch(r'\d+\.\d+', place):
            continue
        if len(rest) != 5:
            raise SystemExit(f'unread row: {line}')
        key = position(section, place)
        if key in rows:
            raise SystemExit(f'position {key} appears twice')
        rows[key] = rest
    return rows


def listing_rows(page: str) -> dict[str, str]:
    """The head characters of the Unicode listing by position."""
    marks = [(m.start(), m.group(1)) for m in re.finditer(r'id="([^"]+)"', page)]
    rows = {}
    for m in re.finditer(r'<td class="sl">([\d.]+)</td>\s*<td class="sl"><span class="wenhai big">(.*?)</span>', page):
        key = position([name for at, name in marks if at < m.start()][-1], m.group(1))
        if key in rows:
            raise SystemExit(f'position {key} appears twice')
        rows[key] = m.group(2)
    return rows


def index_numbers(page: str) -> dict[str, list[str]]:
    """Each index-font glyph's Li Fanwen 2008 numbers: usually one, sometimes two (1493<br/>1505),
    sometimes with a letter (5150B). A row under a rowspan repeats only the entry and is skipped."""
    numbers = {}
    for line in page.splitlines():
        if not line.startswith('<tr><th'):
            continue
        row = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', line)
        if len(row) != 5:
            continue
        glyph = re.sub(r'<[^>]+>', '', row[1])
        if not glyph:
            continue  # [4936], the one head character the index lacks, has no index glyph
        found = [number.lstrip('0') for number in re.findall(r'\d+[A-Z]?', row[4])]
        if len(glyph) != 1 or not found:
            raise SystemExit(f'unread index row: {line}')
        numbers[glyph] = found
    return numbers


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

    skeleton = skeleton_rows(wenhai)
    heads = listing_rows(listing)
    glyph_numbers = index_numbers(index)

    table = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    number_char = {row['李範文 2008'][1:].lstrip('0'): row['文字'] for row in table if row['李範文 2008'].startswith('L')}
    at = {row['文海']: row for row in table if row['文海']}

    def readings(glyph: str) -> tuple[set[str], set[str]]:
        """The characters the glyph's index numbers name in the table, and those named once a
        number's letter is dropped (5150B as 5150), for numbers the table lacks with the letter."""
        numbers = glyph_numbers.get(glyph, [])
        exact = {number_char[number] for number in numbers if number in number_char}
        loose = {number_char[number.rstrip('ABCDEFGHIJKLMNOPQRSTUVWXYZ')] for number in numbers
                 if number not in number_char and number.rstrip('ABCDEFGHIJKLMNOPQRSTUVWXYZ') in number_char}
        return exact, loose

    def shown(glyph: str) -> str:
        exact, loose = readings(glyph)
        found = exact or loose
        return '/'.join(sorted(found)) if found else '¿'

    filled = collections.Counter()
    for _circle, _glyph, fanqie, construction, definition in skeleton.values():
        filled['fanqie'] += bool(fanqie)
        filled['construction'] += bool(construction)
        filled['definition'] += bool(definition.strip())
    print(f'{len(skeleton)} head characters, {len(heads)} in the Unicode listing, {len(glyph_numbers)} index glyphs; filled: {dict(filled)}')

    head_same = head_other = head_missing = 0
    for key, char in heads.items():
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
        (exact_up, loose_up), (exact_lo, loose_lo) = readings(fanqie[0]), readings(fanqie[1])
        read = '|'.join(shown(glyph) for glyph in fanqie[:2])
        if exact_up == {upper} and exact_lo == {lower}:
            kinds['agree'] += 1
            continue
        if upper in exact_up and lower in exact_lo:
            kind = 'agrees with one of the two numbers the index gives'
        elif upper in exact_up | loose_up and lower in exact_lo | loose_lo:
            kind = "agrees once the index number's letter is dropped"
        elif not (exact_up or loose_up) or not (exact_lo or loose_lo):
            kind = 'not convertible'
        elif row['文字'] in (upper, lower):
            kind = 'table gives the head as its own speller'
        elif upper not in exact_up | loose_up and lower not in exact_lo | loose_lo:
            kind = 'both differ'
        else:
            kind = 'upper differs' if upper not in exact_up | loose_up else 'lower differs'
        kinds[kind] += 1
        print(f'fanqie  {key}  {row["文字"]}  BabelStone {read}  table {upper}{lower}  ({kind})')
    print('fanqie:', dict(kinds))


if __name__ == '__main__':
    main()

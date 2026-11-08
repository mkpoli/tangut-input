# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""List 類林 rows whose gloss and reading describe two different words.

The table gives every position a character, a number, a rhyme and a Chinese gloss. When a row's rhyme
disagrees with the rhyme books and its gloss is missing from the character's own dictionary meaning, the
gloss and the reading belong to different words. The road word is such a row: it is numbered 0021, the
elephant, while its rhyme 1.19 and its gloss 路 or 道 are 0020's.

    uv run scripts/audit_tangut_leilin.py

Reads the tables the builders read, plus the meanings the site ships, and prints one line per character,
most gloss uses first. A row worth a look is not a row proven wrong: a translation may use the word for
"the place where goods are sold" for 市, and a Chinese name is written with a word that only sounds the
same.
"""
import collections
import csv
import gzip
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXTS = [{
    'name': 'Leilin table',
    'url': 'https://raw.githubusercontent.com/tinbreaker/tangut-text/820fe592c8c0b1512867c70e5c84395a042667f3/%E7%B1%BB%E6%9E%97_l%C3%A8i%20l%C3%ADn.csv',
    'sha256': '9e8b000467b62913809d23d6dd1bf321602897682f4844a4aef8eddd09880ed9',
}, {
    'name': 'rhyme dictionaries',
    'url': 'https://raw.githubusercontent.com/nkay0/Tangut-rhyme-dictionaries-data/6ce66747f760160d8b8ee1c23356573788b4c5a5/tangut%20rhyme%20dictionaries%20data.csv',
    'sha256': '84787642cc34ac347dd1a361584a5239bc63e1f4f32077f2d45809f70feeea7b',
}]
CJK = re.compile(r'[\u3400-\u9fff\uf900-\ufaff]')
MIN_USES = 5


def fetch(table):
    raw = urllib.request.urlopen(table['url'], timeout=60).read()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != table['sha256']:
        raise SystemExit(f'{table["name"]}: expected {table["sha256"]}, got {digest}')
    return csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))


def rhyme(value):
    """The table writes tone and rhyme as a decimal, so a one-digit rhyme is the ten it lost."""
    if '.' not in value:
        return None
    tone, placed = value.split('.')
    try:
        number = int(placed)
    except ValueError:
        return None
    return (int(tone), number if len(placed) == 2 else number * 10)


def named(gloss):
    """A gloss that names something, not a grammatical label or a Latin-script tag."""
    return bool(CJK.search(gloss)) and not re.search(r'[₁₂₃]', gloss) \
        and not re.fullmatch(r'[A-Za-zꜰ-ꜿᴀ-ᴥ\s:./]+', gloss)


def main():
    glosses, rhymes = collections.defaultdict(collections.Counter), collections.defaultdict(set)
    for row in fetch(TEXTS[0]):
        char, gloss = row['character'], row['meaning'].strip()
        if not char:
            continue
        found = rhyme(row['rhyme'] or '')
        if found:
            rhymes[char].add(found)
        if gloss:
            glosses[char][gloss] += 1

    book = collections.defaultdict(set)
    for row in fetch(TEXTS[1]):
        char, tone, placed = row['文字'].strip(), row['声調'].strip(), row['声調韻'].strip()
        if len(char) == 1 and tone.isdigit() and placed.isdigit():
            book[char].add((int(tone), int(placed)))

    data = gzip.decompress((ROOT / 'app/data/tangut-ccamc-index.json.gz').read_bytes())
    meanings = json.loads(data)['meanings']['zh']

    rows = []
    for char, found in glosses.items():
        if not rhymes[char] or char not in book or rhymes[char] & book[char]:
            continue
        meaning = ' '.join(meanings.get(char, []))
        if not meaning or '譯音' in meaning:
            continue
        unlisted = sorted(((g, n) for g, n in found.items() if named(g) and g not in meaning), key=lambda x: -x[1])
        if unlisted and sum(n for _, n in unlisted) >= MIN_USES:
            rows.append((sum(n for _, n in unlisted), char, unlisted[:3], sorted(rhymes[char]), sorted(book[char]), meaning))
    rows.sort(reverse=True)

    print(f'{len(rows)} characters where the table\'s rhyme and gloss name different words')
    for total, char, unlisted, table, own, meaning in rows:
        print(f'  {char} U+{ord(char):04X}  {total:3d} {unlisted}  table {table}  own {own}  {meaning[:48]}')


if __name__ == '__main__':
    main()

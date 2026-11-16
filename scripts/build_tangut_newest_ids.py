# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build `app/data/tangut-newest-ids.json`: descriptions for the eight newest Tangut ideographs.

The entries for U+187F8–U+187FF come from Wiktionary and carry no description, because BabelStone's
Tangut IDS stops at U+187F7. Table 2 of WG2 N5217R2 assigns each of the eight a description;
`data/tangut-newest-ids.tsv` transcribes it, and this script checks that every description reads as
complete trees of assigned Tangut characters before writing the file the card reads.

    uv run scripts/build_tangut_newest_ids.py
"""
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/tangut-newest-ids.tsv'
OUT = ROOT / 'app/data/tangut-newest-ids.json'
UNICODE = ROOT / 'data/unicode-18.0.0'
RANGE = range(0x187F8, 0x18800)
OPS = set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻')
ARITY = {'⿲': 3, '⿳': 3}


def assigned() -> set[int]:
    points: set[int] = set()
    for line in gzip.open(UNICODE / 'UnicodeData.txt.gz', 'rt'):
        fields = line.split(';')
        point, name = int(fields[0], 16), fields[1]
        if name.endswith(', First>'):
            start = point
        elif name.endswith(', Last>'):
            points.update(range(start, point + 1))
        else:
            points.add(point)
    return points


def leaves(text: str) -> list[str]:
    """The description's leaves, after checking that it reads as complete trees."""
    found: list[str] = []
    at = 0

    def node() -> None:
        nonlocal at
        if at >= len(text):
            raise ValueError('description ends inside an operator')
        char = text[at]
        at += 1
        if char in OPS:
            for _ in range(ARITY.get(char, 2)):
                node()
            return
        found.append(char)

    while at < len(text):
        node()
    return found


def main() -> None:
    known = assigned()
    rows: dict[int, str] = {}
    for line in SOURCE.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        point, text = line.split('\t')
        rows[int(point, 16)] = text
    if sorted(rows) != list(RANGE):
        raise SystemExit(f'expected the eight code points U+187F8–U+187FF, got {[hex(c) for c in rows]}')
    for point, text in rows.items():
        for char in leaves(text):
            if ord(char) not in known:
                raise SystemExit(f'U+{point:04X}: {char!r} is not an assigned character')
    characters = {chr(point): rows[point] for point in sorted(rows)}
    document = {
        'format': 'tangut-input/newest-ids',
        'source': {
            'name': 'WG2 N5217R2 = L2/23-246, table 2',
            'author': 'Andrew West',
            'date': '2023-10-02',
            'url': 'https://www.unicode.org/wg2/docs/n5217r2-Tangut-components-ideographs.pdf',
        },
        'characters': characters,
    }
    OUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(characters)} descriptions -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

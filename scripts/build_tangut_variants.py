# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build `app/data/tangut-variants.json` from `data/tangut-variants.tsv`, what Wiktionary states,
`data/tangut-component-variants.tsv`, component pairs used to find possible variants, and
`data/tangut-variants-reported.tsv`, pairs a person reported, and `data/tangut-component-groups.tsv`, the
components the parts palette keeps together, each marked `apart` when its members mostly stand in different places
or `shared` when they stand in the same ones, with who says so in `kind_source`. A component pair whose one
member stands only first in ⿺ and whose other never does is emitted as a surrounding pair, `[plain, hooked]`,
which the app rewrites as ⿰ beside ⿺. The build stops on a value that is not one Tangut character.

    uv run scripts/build_tangut_variants.py
"""
import csv
import gzip
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/tangut-variants.json'
ENTRIES = ROOT / 'app/data/tangut-entries.json.gz'
ONE = re.compile('^[\U00017000-\U00018AFF\U00018D00-\U00018D7F]$')
OPERATORS = set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻')
ARITY = {'⿲': 3, '⿳': 3}


def rows(name: str) -> list[dict[str, str]]:
    with (ROOT / 'data' / name).open(encoding='utf-8') as file:
        return list(csv.DictReader(file, delimiter='\t'))


def pair(row: dict[str, str], one: str, other: str) -> list[str]:
    if not (ONE.match(row[one]) and ONE.match(row[other])):
        raise SystemExit(f'not a pair of Tangut characters: {row}')
    return [row[one], row[other]]


def placements(composition: str) -> list[tuple[str, str, int]]:
    """Every component written in a description, with its enclosing operator and place."""
    chars = list(composition)
    at = 0
    found: list[tuple[str, str, int]] = []

    def node(op: str, place: int) -> None:
        nonlocal at
        if at >= len(chars):
            raise ValueError(composition)
        char = chars[at]
        at += 1
        if char in OPERATORS:
            for i in range(ARITY.get(char, 2)):
                node(char, i)
            return
        found.append((char, op, place))

    while at < len(chars):
        node('', 0)
    return found


def component_places() -> dict[str, list[tuple[str, int]]]:
    """Where each component stands in the recorded descriptions, by operator and place."""
    data = json.loads(gzip.decompress(ENTRIES.read_bytes()))
    places: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for row in data['rows']:
        composition = row[1]
        if not composition:
            continue
        try:
            for char, op, place in placements(composition):
                places[char].append((op, place))
        except ValueError:
            # A recorded sequence short of an operand keeps no placement.
            continue
    return places


def surrounding_pairs(pairs: list[list[str]], places: dict[str, list[tuple[str, int]]]) -> list[list[str]]:
    """The pairs whose one member wraps: `[plain, hooked]`, the wrapped form first in ⿺ throughout."""
    def wraps(hooked: str, plain: str) -> bool:
        wrapped = places.get(hooked, [])
        open_places = places.get(plain, [])
        return bool(wrapped) and bool(open_places) \
            and all(place == ('⿺', 0) for place in wrapped) \
            and all(place != ('⿺', 0) for place in open_places)

    found: list[list[str]] = []
    for one, other in pairs:
        if wraps(one, other):
            found.append([other, one])
        elif wraps(other, one):
            found.append([one, other])
    return found


def main() -> None:
    stated = rows('tangut-variants.tsv')
    components = [pair(row, 'one', 'other') for row in rows('tangut-component-variants.tsv')]
    data = {
        'variants': [[*pair(row, 'form', 'base'), row['revisions']] for row in stated if row['kind'] == 'variant' and row['scope'] == 'whole'],
        'partial': [[*pair(row, 'form', 'base'), row['revisions']] for row in stated if row['kind'] == 'variant' and row['scope'] == 'partial'],
        'synonyms': [pair(row, 'form', 'base') for row in stated if row['kind'] == 'synonym'],
        'components': components,
        'surrounding': surrounding_pairs(components, component_places()),
        'reported': [pair(row, 'one', 'other') for row in rows('tangut-variants-reported.tsv')],
        'groups': [{'members': row['members'], 'kind': row['kind'], 'explained': not row['kind_source'].startswith('this site')} for row in rows('tangut-component-groups.tsv')],
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print({key: len(value) for key, value in data.items()})


if __name__ == '__main__':
    main()

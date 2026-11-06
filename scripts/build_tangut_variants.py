# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build `app/data/tangut-variants.json` from `data/tangut-variants.tsv`, what Wiktionary states,
`data/tangut-component-variants.tsv`, component pairs used to find possible variants, and
`data/tangut-variants-reported.tsv`, pairs a person reported, and `data/tangut-component-groups.tsv`, the
components the parts palette keeps together. The build stops on a value
that is not one Tangut character.

    uv run scripts/build_tangut_variants.py
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/tangut-variants.json'
ONE = re.compile('^[\U00017000-\U00018AFF\U00018D00-\U00018D7F]$')


def rows(name: str) -> list[dict[str, str]]:
    with (ROOT / 'data' / name).open(encoding='utf-8') as file:
        return list(csv.DictReader(file, delimiter='\t'))


def pair(row: dict[str, str], one: str, other: str) -> list[str]:
    if not (ONE.match(row[one]) and ONE.match(row[other])):
        raise SystemExit(f'not a pair of Tangut characters: {row}')
    return [row[one], row[other]]


def main() -> None:
    stated = rows('tangut-variants.tsv')
    data = {
        'variants': [pair(row, 'form', 'base') for row in stated if row['kind'] == 'variant' and row['scope'] == 'whole'],
        'partial': [pair(row, 'form', 'base') for row in stated if row['kind'] == 'variant' and row['scope'] == 'partial'],
        'synonyms': [pair(row, 'form', 'base') for row in stated if row['kind'] == 'synonym'],
        'components': [pair(row, 'one', 'other') for row in rows('tangut-component-variants.tsv')],
        'reported': [pair(row, 'one', 'other') for row in rows('tangut-variants-reported.tsv')],
        'groups': [row['members'] for row in rows('tangut-component-groups.tsv')],
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print({key: len(value) for key, value in data.items()})


if __name__ == '__main__':
    main()

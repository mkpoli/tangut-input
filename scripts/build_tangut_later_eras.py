# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the later era names written in Tangut from `data/tangut-later-eras.tsv`.

Each row is one era and one Tangut form as a source gives it. An era with two rows has two possible
readings of one source.

    uv run scripts/build_tangut_later_eras.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TABLE = ROOT / 'data/tangut-later-eras.tsv'
OUT = ROOT / 'app/data/tangut-later-eras.json'


def main() -> None:
    eras = {}
    with TABLE.open(encoding='utf-8') as file:
        for row in csv.DictReader(file, delimiter='\t'):
            if not row['tangut'] or not all(0x17000 <= ord(c) <= 0x18AFF for c in row['tangut']):
                raise SystemExit(f'not Tangut: {row}')
            era = eras.setdefault(row['era'], {'era': row['era'], 'forms': [], 'source': row['source']})
            era['forms'].append(row['tangut'])
    OUT.write_text(json.dumps(list(eras.values()), ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(eras)} eras → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

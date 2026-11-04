# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the posthumous, temple and tomb names of the Western Xia from `data/tangut-posthumous.tsv`.

Each row quotes the sentence of 宋史 卷485–486 that names one emperor or empress. The build stops
unless every name in the row occurs in its quotation, and unless Tangut comes with its source.

    uv run scripts/build_tangut_posthumous.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TABLE = ROOT / 'data/tangut-posthumous.tsv'
OUT = ROOT / 'app/data/tangut-posthumous.json'


def main() -> None:
    rows = []
    with TABLE.open(encoding='utf-8') as file:
        for row in csv.DictReader(file, delimiter='\t'):
            if row['kind'] not in ('emperor', 'empress'):
                raise SystemExit(f'unknown kind: {row}')
            if bool(row['tangut']) != bool(row['tangut_source']):
                raise SystemExit(f'Tangut without its source: {row}')
            for field in ('temple', 'posthumous', 'tomb'):
                if row[field] and row[field] not in row['quote']:
                    raise SystemExit(f'{field} is not in the quotation: {row}')
            rows.append({
                'kind': row['kind'], 'temple': row['temple'], 'name': row['name'], 'relation': row['relation'], 'posthumous': row['posthumous'],
                'tomb': row['tomb'], 'tangut': row['tangut'], 'tanguts': row['tangut_source'],
            })
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(rows)} rows → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

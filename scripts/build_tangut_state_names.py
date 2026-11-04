# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the names of the Western Xia state from `data/tangut-state-names.tsv`.

Each row is one name and one work citing it. `place` names a text in this repository that writes the
Tangut, and the build stops unless the name occurs there. A name's `basis` follows as in the imperial
titles: `text`, `reported` or `chinese`.

    uv run scripts/build_tangut_state_names.py
"""
import csv
import json
from pathlib import Path

from build_tangut_titles import place_text

ROOT = Path(__file__).resolve().parents[1]
TABLE = ROOT / 'data/tangut-state-names.tsv'
OUT = ROOT / 'app/data/tangut-state-names.json'


def main() -> None:
    names = {}
    with TABLE.open(encoding='utf-8') as file:
        for row in csv.DictReader(file, delimiter='\t'):
            if row['place'] and (not row['tangut'] or row['tangut'] not in place_text(row['place'])):
                raise SystemExit(f'the name does not occur in the text named: {row}')
            name = names.setdefault(row['chinese'], {
                'chinese': row['chinese'], 'tangut': row['tangut'], 'gloss': row['gloss'], 'basis': 'chinese', 'sources': [],
            })
            if (name['tangut'], name['gloss']) != (row['tangut'], row['gloss']):
                raise SystemExit(f'rows for one name disagree: {row}')
            if row['place']:
                name['basis'] = 'text'
            elif row['tangut'] and name['basis'] == 'chinese':
                name['basis'] = 'reported'
            name['sources'].append(row['source'])
    OUT.write_text(json.dumps(list(names.values()), ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(names)} names → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

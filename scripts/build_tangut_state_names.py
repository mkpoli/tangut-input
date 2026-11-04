# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the names of the Western Xia state from `data/tangut-state-names.tsv`.

Each row is one name and one work citing it, with `backs` saying whether the work bears on the Tangut,
the Chinese or the row's note. `chinese_source` is the work that prints the Chinese as written, and `note` names a
message shown on the row. `place` names a text in this repository that writes the Tangut, and the
build stops unless the name occurs there. A name's `basis` follows as in the imperial titles.

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
            if row['backs'] not in ('tangut', 'chinese', 'note') or (row['backs'] == 'tangut' and not row['tangut']):
                raise SystemExit(f'unknown backing: {row}')
            name = names.setdefault(row['chinese'], {
                'chinese': row['chinese'], 'tangut': row['tangut'], 'gloss': row['gloss'], 'note': row['note'],
                'basis': 'chinese', 'tangutSources': [], 'chineseSources': [row['chinese_source']], 'noteSources': [],
            })
            if (name['tangut'], name['gloss'], name['note'], name['chineseSources'][0]) != (row['tangut'], row['gloss'], row['note'], row['chinese_source']):
                raise SystemExit(f'rows for one name disagree: {row}')
            if row['place']:
                name['basis'] = 'text'
            elif row['backs'] == 'tangut' and name['basis'] == 'chinese':
                name['basis'] = 'reported'
            sources = name[f"{row['backs']}Sources"]
            if row['source'] not in sources:
                sources.append(row['source'])
    OUT.write_text(json.dumps(list(names.values()), ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(names)} names → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

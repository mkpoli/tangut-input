# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the surnames, offices and places in `data/tangut-names.tsv` for the names page.

Each row is one name, its kind, the source's reading where it gives one, the Chinese and English it
can be identified with, a modern location for a place, and the work it is read from. Rows for one
name from several works are merged into one entry that cites them all. The build stops on a kind it
does not know, a character outside the Tangut block, a name with neither Tangut nor Chinese, and a
source key the page cannot number.

    uv run scripts/build_tangut_names.py
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TABLE = ROOT / 'data/tangut-names.tsv'
OUT = ROOT / 'app/data/tangut-names.json'
SOURCES = ROOT / 'app/lib/name-sources.js'
KINDS = ('surname', 'office', 'place')
TANGUT = range(0x17000, 0x18B00)


def sources() -> set[str]:
    return set(re.findall(r"^  '?([\w-]+)'?: \{", SOURCES.read_text(encoding='utf-8'), re.M))


def main() -> None:
    known = sources()
    names = {}
    with TABLE.open(encoding='utf-8') as file:
        for row in csv.DictReader(file, delimiter='\t'):
            if row['kind'] not in KINDS:
                raise SystemExit(f'unknown kind: {row}')
            if not row['tangut'] and not row['chinese']:
                raise SystemExit(f'a name with neither Tangut nor Chinese: {row}')
            if any(ord(char) not in TANGUT for char in row['tangut']):
                raise SystemExit(f'a character outside the Tangut block: {row}')
            if row['source'] not in known:
                raise SystemExit(f'a source the page cannot number: {row}')
            key = (row['kind'], row['tangut'] or row['chinese'])
            given = {name: row[name] for name in ('reading', 'chinese', 'english', 'modern', 'note')}
            name = names.setdefault(key, {**given, 'kind': row['kind'], 'tangut': row['tangut'], 'sources': []})
            for column, value in given.items():
                if name[column] != value:
                    raise SystemExit(f'rows for one name disagree on {column}: {row}')
            if row['source'] not in name['sources']:
                name['sources'].append(row['source'])
    OUT.write_text(json.dumps(list(names.values()), ensure_ascii=False, separators=(',', ':')) + '\n',
                   encoding='utf-8')
    print(f'{len(names)} names → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

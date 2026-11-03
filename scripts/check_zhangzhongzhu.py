# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Check the 掌中珠 transcription tables before they are built.

The tables are hand-keyed, so the check is about the shape of what a hand wrote:
that every cell belongs to an entry, that positions inside an entry start at 1
and leave no gap, that a status is one of the four the README defines, and that
a glyph of a given role is in the right block.
"""
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'zhangzhongzhu'
STATUSES = {'ok', 'uncertain', 'illegible', 'absent'}
ROLES = {'tangut', 'transcription', 'gloss_spelling'}
TANGUT = range(0x17000, 0x18D900)
HAN = range(0x3400, 0xA000)


def rows(name):
    with open(DATA / name, encoding='utf-8', newline='') as file:
        return list(csv.DictReader(file, delimiter='\t'))


def main():
    problems = []
    entries = {row['entry_id']: row for row in rows('entries.tsv')}
    if len(entries) != len(rows('entries.tsv')):
        problems.append('entries.tsv has a repeated entry_id')

    by_entry = {}
    for line, row in enumerate(rows('cells.tsv'), start=2):
        entry = row['entry_id']
        if entry not in entries:
            problems.append(f'cells.tsv:{line} names an entry that is not in entries.tsv: {entry}')
            continue
        if row['role'] not in ROLES:
            problems.append(f'cells.tsv:{line} role {row["role"]!r} is not one of {sorted(ROLES)}')
        if row['status'] not in STATUSES:
            problems.append(f'cells.tsv:{line} status {row["status"]!r} is not one of {sorted(STATUSES)}')
        if row['status'] in {'ok', 'uncertain'} and not row['glyph'].strip():
            problems.append(f'cells.tsv:{line} has status {row["status"]} and no glyph')
        if not row['position'].isdigit():
            problems.append(f'cells.tsv:{line} position {row["position"]!r} is not a number')
            continue
        position = int(row['position'])
        if row['glyph'].strip():
            code = ord(row['glyph'].strip()[0])
            if row['role'] == 'tangut' and code not in TANGUT:
                problems.append(f'cells.tsv:{line} tangut cell holds U+{code:04X}, which is not Tangut')
            if row['role'] in {'transcription', 'gloss_spelling'} and code not in HAN:
                problems.append(f'cells.tsv:{line} {row["role"]} cell holds U+{code:04X}, which is not Han')
        by_entry.setdefault(entry, []).append(position)

    for entry, positions in by_entry.items():
        positions.sort()
        if positions != list(range(1, len(positions) + 1)):
            problems.append(f'{entry}: positions are {positions}, not 1..{len(positions)}')

    for line, row in enumerate(rows('leaves.tsv'), start=2):
        if row['role'] and row['surveyed'] not in {'0', '1'}:
            problems.append(f'leaves.tsv:{line} surveyed {row["surveyed"]!r} is not 0 or 1')

    print(f'entries {len(entries)}, cells {sum(len(p) for p in by_entry.values())}')
    if problems:
        print('\n'.join(problems))
        sys.exit(1)
    print('tables are consistent')


if __name__ == '__main__':
    main()

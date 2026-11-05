# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Check the 掌中珠 transcription tables before they are built.

The tables are hand-keyed, so the check is about the shape of what a hand wrote:
that every cell belongs to an entry, that the positions of each role inside an
entry start at 1 and leave no gap, that a status is one of the four the README
defines, that a cell marked `ok` names who read it and when, and that a glyph of
a given role is in the right script.
"""
import csv
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'zhangzhongzhu'
STATUSES = {'ok', 'uncertain', 'illegible', 'absent'}
GLOSS_STATUSES = {'ok', 'uncertain', 'illegible'}
COLUMN_ROLES = {'gloss', 'transcription', 'tangut', 'unknown'}
ROLES = {'tangut', 'transcription', 'gloss_spelling'}
# Tangut, Tangut components, Tangut Supplement. Khitan Small Script (U+18B00) is
# a different script and must not pass.
TANGUT = [(0x17000, 0x187FF), (0x18800, 0x18AFF), (0x18D00, 0x18D7F)]
# Han: Ext A, URO, compatibility, Ext B and the planes after it.
HAN = [(0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF), (0x20000, 0x2FA1F), (0x30000, 0x323AF)]


def in_ranges(code, ranges):
    return any(low <= code <= high for low, high in ranges)


def rows(name):
    with open(DATA / name, encoding='utf-8', newline='') as file:
        return list(csv.DictReader(file, delimiter='\t'))


def main():
    problems = []
    entries = {}
    for line, row in enumerate(rows('entries.tsv'), start=2):
        entry = row['entry_id']
        if entry in entries:
            problems.append(f'entries.tsv:{line} repeats the entry id {entry}')
        entries[entry] = row
        if row['gloss_status'] and row['gloss_status'] not in GLOSS_STATUSES:
            problems.append(f'entries.tsv:{line} gloss_status {row["gloss_status"]!r} is not one of {sorted(GLOSS_STATUSES)}')
        if row['column_role'] not in COLUMN_ROLES:
            problems.append(f'entries.tsv:{line} column_role {row["column_role"]!r} is not one of {sorted(COLUMN_ROLES)}')
        if row['reviewed'] not in {'', '0', '1'}:
            problems.append(f'entries.tsv:{line} reviewed {row["reviewed"]!r} is not 0 or 1')

    positions = {}
    for line, row in enumerate(rows('cells.tsv'), start=2):
        entry, role = row['entry_id'], row['role']
        if entry not in entries:
            problems.append(f'cells.tsv:{line} names an entry that is not in entries.tsv: {entry}')
            continue
        if role not in ROLES:
            problems.append(f'cells.tsv:{line} role {role!r} is not one of {sorted(ROLES)}')
        if row['status'] not in STATUSES:
            problems.append(f'cells.tsv:{line} status {row["status"]!r} is not one of {sorted(STATUSES)}')
        if row['status'] in {'ok', 'uncertain'} and not row['glyph'].strip():
            problems.append(f'cells.tsv:{line} has status {row["status"]} and no glyph')
        # A reading called ok has to say who read it; an uncertain one may wait.
        if row['status'] == 'ok' and not (row['reviewer'].strip() and row['reviewed_date'].strip()):
            problems.append(f'cells.tsv:{line} is ok without a reviewer and a date')
        if not row['position'].isdigit():
            problems.append(f'cells.tsv:{line} position {row["position"]!r} is not a number')
            continue
        position = int(row['position'])
        positions.setdefault((entry, role), []).append(position)

        glyph = row['glyph'].strip()
        if not glyph:
            continue
        code = ord(glyph[0])
        if len(glyph) != 1:
            problems.append(f'cells.tsv:{line} holds {glyph!r} in one cell; one row is one character')
        if row['codepoints'].strip():
            written = row['codepoints'].strip().upper().replace('U+', '')
            if written != f'{code:04X}':
                problems.append(f'cells.tsv:{line} codepoints {row["codepoints"]!r} does not name U+{code:04X}')
        if role == 'tangut' and not in_ranges(code, TANGUT):
            problems.append(f'cells.tsv:{line} tangut cell holds U+{code:04X} ({unicodedata.name(glyph[0], "unnamed")}), which is not Tangut')
        if role != 'tangut' and not in_ranges(code, HAN):
            problems.append(f'cells.tsv:{line} {role} cell holds U+{code:04X}, which is not Han')

    for (entry, role), found in positions.items():
        found.sort()
        if found != list(range(1, len(found) + 1)):
            problems.append(f'{entry} {role}: positions are {found}, not 1..{len(found)}')

    for line, row in enumerate(rows('leaves.tsv'), start=2):
        if row['surveyed'] not in {'0', '1'}:
            problems.append(f'leaves.tsv:{line} surveyed {row["surveyed"]!r} is not 0 or 1')

    print(f'entries {len(entries)}, cells {sum(len(v) for v in positions.values())}')
    if problems:
        print('\n'.join(problems))
        sys.exit(1)
    print('tables are consistent')


if __name__ == '__main__':
    main()

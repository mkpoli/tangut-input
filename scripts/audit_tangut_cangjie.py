# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Check the Tangut Cangjie table against the rule it is built on.

The scheme spells a character with the codes of its parts, one after another, with the `p` that marks
a component code dropped: ⿱𘠀⿰𘢰𘠆 is `m` + `sb` + `u` = `msbu`. A character's longer code should
therefore be exactly the codes of its parts joined, and its shorter code should be the longer one with
letters left out. Where either fails, the table is suspect — the scheme's own repository says some
codes are wrong and invites reports.

    uv run scripts/audit_tangut_cangjie.py [--out docs/tangut-cangjie-audit.tsv]

The audit is a review, not a correction: a mismatch can also mean the part code this project holds is
the wrong one, or that the scheme spells a shape by a rule the parts do not show.
"""
import argparse
import gzip
import json
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPERATORS = set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT / 'docs/tangut-cangjie-audit.tsv')
    parser.add_argument('--show', type=int, default=12)
    options = parser.parse_args()

    pairs = json.loads(gzip.decompress((ROOT / 'app/data/tangut-cangjie.json.gz').read_bytes()))
    codes = {}
    for char, code in pairs:
        codes.setdefault(char, []).append(code)
    entries = json.loads(gzip.decompress((ROOT / 'app/data/tangut-entries.json.gz').read_bytes()))
    by_char = {entry['char']: entry for entry in entries}

    def part_code(part):
        held = codes.get(part)
        if not held:
            return None
        marked = [code for code in held if code.startswith('p')]
        return marked[0][1:] if marked else min(held, key=len)

    def deleted_from(short, long):
        """Whether `short` can be got from `long` by leaving letters out."""
        it = iter(long)
        return all(letter in it for letter in short)

    rows = []
    checked = 0
    kinds = Counter()
    for char, held in codes.items():
        composition = by_char.get(char, {}).get('composition')
        if composition:
            parts = [part for part in composition if part not in OPERATORS]
            pieces = [part_code(part) for part in parts]
            if all(pieces):
                checked += 1
                expected = ''.join(pieces)
                longest = max(held, key=len)
                if longest != expected:
                    kinds[classify(longest, expected)] += 1
                    rows.append(('spelling', char, composition, ''.join(parts), expected, longest))
        if len(held) > 1:
            short, long = min(held, key=len), max(held, key=len)
            if not deleted_from(short, long):
                kinds['short code not a deletion of the long one'] += 1
                rows.append(('short', char, composition or '', '', long, short))

    rows.sort(key=lambda row: (row[0], row[1]))
    options.out.write_text(
        'kind\tcharacter\tcomposition\tparts\texpected\tfound\n'
        + '\n'.join('\t'.join(row) for row in rows) + '\n',
        encoding='utf-8')
    print(f'{checked} characters with a composition and a code for every part')
    print(f'{len(rows)} suspect rows -> {options.out.relative_to(ROOT)}')
    for kind, count in kinds.most_common():
        print(f'  {count:>5}  {kind}')
    print()
    for row in rows[:options.show]:
        print('\t'.join(row))


def classify(found, expected):
    """What kind of difference there is between the code held and the one the parts predict."""
    if len(found) < len(expected):
        return 'code shorter than its parts'
    if len(found) > len(expected):
        return 'code longer than its parts'
    matcher = SequenceMatcher(None, expected, found)
    changes = [op for op in matcher.get_opcodes() if op[0] != 'equal']
    if all(op[0] == 'replace' and op[2] - op[1] == 1 and op[4] - op[3] == 1 for op in changes):
        return 'one letter differs'
    return 'letters differ'


if __name__ == '__main__':
    main()

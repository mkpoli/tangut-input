"""Measure the code space of the 60 文海 constructions.

The four characters name source characters and parts of them, not the head's meaning. This script
counts how many of the 60 rows share a code at two levels: the whole formula and the source
characters alone. It prints the counts; it writes nothing.

    uv run python scripts/study_wenhai_codes.py
"""

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import eval_wenhai_composition as measure

ROOT = Path(__file__).resolve().parents[1]
TABLE = ROOT / 'data/wenhai/constructions.jsonl'


def main() -> None:
    rows = measure.read_formulas(TABLE)
    levels = {'formula': [], 'sources': []}
    lengths = Counter()
    for row in rows:
        parts = measure.formula_parts(row['formula'])
        sources = tuple(source for source, _ in parts)
        lengths[len(sources)] += 1
        levels['formula'].append(row['formula'])
        levels['sources'].append(sources)
    print(f'{len(rows)} rows; source counts: {dict(sorted(lengths.items()))}')
    for name, codes in levels.items():
        counts = Counter(codes)
        collisions = {code: count for code, count in counts.items() if count > 1}
        print(f'{name}: {len(counts)} distinct of {len(codes)}; '
              f'{len(collisions)} colliding codes, {sum(collisions.values())} rows in them')
    head = rows[0]
    parts = measure.formula_parts(head['formula'])
    print(f'example {head["position"]} {head["character"]}: ' +
          '; '.join(f'{part} of {source}' for source, part in parts))


if __name__ == '__main__':
    main()

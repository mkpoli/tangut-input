"""Measure the code space of the 60 文海 constructions.

The four characters name source characters and parts of them, not the head's meaning. This script
counts how many of the 60 rows share a code at three levels: the whole formula, the source
characters alone, and the first English gloss of each source. It prints the counts; it writes
nothing.

    uv run python scripts/study_wenhai_codes.py
"""

import gzip
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import eval_wenhai_composition as measure

ROOT = Path(__file__).resolve().parents[1]
TABLE = ROOT / 'data/wenhai/constructions.jsonl'
ENTRIES = ROOT / 'app/data/tangut-entries.json.gz'
def gloss(character: str, entries: dict) -> str:
    """The first English gloss; not a curated meaning."""
    row = entries.get(character)
    return row[4][0] if row and row[4] else ''


def main() -> None:
    rows = measure.read_formulas(TABLE)
    entries = {row[0]: row for row in json.load(gzip.open(ENTRIES, 'rt'))['rows']}
    levels = {'formula': [], 'sources': [], 'source meanings': []}
    lengths = Counter()
    for row in rows:
        parts = measure.formula_parts(row['formula'])
        sources = tuple(source for source, _ in parts)
        lengths[len(sources)] += 1
        levels['formula'].append(row['formula'])
        levels['sources'].append(sources)
        meanings = tuple(gloss(source, entries) or source for source in sources)
        levels['source meanings'].append(meanings)
    print(f'{len(rows)} rows; source counts: {dict(sorted(lengths.items()))}')
    for name, codes in levels.items():
        counts = Counter(codes)
        collisions = {code: count for code, count in counts.items() if count > 1}
        print(f'{name}: {len(counts)} distinct of {len(codes)}; '
              f'{len(collisions)} colliding codes, {sum(collisions.values())} rows in them')
    head = rows[0]
    parts = measure.formula_parts(head['formula'])
    print(f'example {head["position"]} {head["character"]}: ' +
          '; '.join(f'{part} of {source} ({gloss(source, entries) or "no gloss"})'
                    for source, part in parts))


if __name__ == '__main__':
    main()

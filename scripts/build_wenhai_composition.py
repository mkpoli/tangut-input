"""Write the 60 文海 constructions the card shows.

The card reads `app/data/wenhai-composition.json`: a head character, its 文海 position, and the
source characters and parts its entry names. This script builds that file from BabelStone's draft
(Wenhai.html), or from a JSONL construction table when `--formulas` is given, so a fuller corpus can
replace the 60 rows without hand editing.

    uv run python scripts/build_wenhai_composition.py [--pages DIR] [--csv FILE] [--out FILE]
    uv run python scripts/build_wenhai_composition.py --formulas FILE --source 'edition'
        [--out FILE]

A source with no part term after it is written as a null part: the card shows the character alone,
because the 文海 leaves the term out and the head has to supply it.
"""

import argparse
import csv
import hashlib
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_babelstone_wenhai as check
import eval_wenhai_composition as measure

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/wenhai-composition.json'
SOURCE = ('BabelStone, Wenhai.html (after 文海研究, 1983); WHYJ index; nkay0 table; '
          'part terms after BabelStone, "Untangling the Web of Characters" (2010).')


def card_parts(characters: str) -> list[list[str | None]]:
    """The construction as [source, part] pairs; a source without a term gets a null part."""
    parts, index = [], 0
    while index < len(characters):
        source = characters[index]
        if source in measure.PARTS:
            raise ValueError(f'part term {source} has no source')
        if index + 1 < len(characters) and characters[index + 1] in measure.PARTS:
            parts.append([source, measure.PARTS[characters[index + 1]]])
            index += 2
        else:
            parts.append([source, None])
            index += 1
    return parts


def from_table(rows: list[dict[str, str]], source: str) -> dict:
    """A document from the JSONL table read by eval_wenhai_composition.read_formulas."""
    entries = {}
    for row in rows:
        character = row['character']
        if character in entries:
            raise SystemExit(f'{character}: duplicate head at {entries[character]["position"]}')
        try:
            parts = card_parts(row['formula'])
        except ValueError as error:
            raise SystemExit(f'{character}: {error}')
        entries[character] = {'position': row['position'], 'parts': parts}
    return {'source': source, 'entries': entries}


def from_pages(pages: dict[str, bytes], raw: bytes) -> dict:
    """A document from BabelStone's three pages and nkay0's table."""
    wenhai, listing, index = (pages[name].decode('utf-8') for name in check.PAGES)
    skeleton = check.skeleton_rows(wenhai)
    heads = check.listing_rows(listing)
    numbers = check.index_numbers(index)
    table = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    number_char = {row['李範文 2008'][1:].lstrip('0'): row['文字']
                   for row in table if row['李範文 2008'].startswith('L')}

    entries = {}
    total = 0
    skipped = []
    for key, value in sorted(skeleton.items()):
        construction = value[3]
        if not construction:
            continue
        total += 1
        found = [measure.glyph_characters(glyph, numbers, number_char) for glyph in construction]
        if any(len(characters) != 1 for characters in found):
            skipped.append((key, 'unreadable construction'))
            continue
        head = heads.get(key)
        if not head:
            skipped.append((key, 'no head'))
            continue
        if head in entries:
            skipped.append((key, f'duplicate head {head}'))
            continue
        characters = ''.join(mapped[0] for mapped in found)
        entries[head] = {'position': key, 'parts': card_parts(characters)}
    if skipped or len(entries) != total:
        detail = '; '.join(f'{key}: {reason}' for key, reason in skipped)
        raise SystemExit(f'{len(entries)} of {total} constructions resolved; not writing. {detail}')
    return {'source': SOURCE, 'entries': entries}


def write(document: dict, path: Path) -> None:
    """Write the compact one-entry-per-line JSON the card reads."""
    items = list(document['entries'].items())
    lines = ['{', f' "source": {json.dumps(document["source"], ensure_ascii=False)},', ' "entries": {']
    for i, (character, entry) in enumerate(items):
        line = '  ' + json.dumps(character, ensure_ascii=False) + ': '
        line += json.dumps(entry, ensure_ascii=False, separators=(', ', ': '))
        if i < len(items) - 1:
            line += ','
        lines.append(line)
    lines += [' }', '}']
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=Path, help='a folder of saved copies of the three pages')
    parser.add_argument('--csv', type=Path, help="a copy of nkay0's table, instead of fetching it")
    parser.add_argument('--formulas', type=Path, help='a JSONL construction table')
    parser.add_argument('--source', help='the citation for a --formulas table')
    parser.add_argument('--out', type=Path, default=OUT,
                        help=f'the file to write (default: {OUT})')
    options = parser.parse_args()
    if options.formulas and (options.pages or options.csv):
        parser.error('--formulas cannot be combined with --pages or --csv')
    if options.formulas and not options.source:
        parser.error('--formulas needs --source')

    if options.formulas:
        document = from_table(measure.read_formulas(options.formulas), options.source)
    else:
        pages = {name: (options.pages / name).read_bytes() if options.pages
                 else check.fetch(check.BASE + name) for name in check.PAGES}
        raw = options.csv.read_bytes() if options.csv else check.fetch(check.TABLE)
        if hashlib.sha256(raw).hexdigest() != check.SHA256:
            raise SystemExit('the table is not the one the site is built from')
        document = from_pages(pages, raw)

    write(document, options.out)
    print(f'{len(document["entries"])} entries → {options.out}')


if __name__ == '__main__':
    main()

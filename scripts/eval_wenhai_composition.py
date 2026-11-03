"""Measure the 文海's four-character construction against the glyph data.

A 文海 entry opens with at most four characters that say how the glyph is built from parts of other
characters: the whole, left, middle, right, top, bottom or surrounding part of a source character.
The 60 cells use those seven terms, and a source with no term after it is read as the whole
character. This script reads the 60 construction cells in BabelStone's draft (Wenhai.html), turns
their Private Use Area glyphs into Unicode through the WHYJ index and nkay0's Li Fanwen 2008 table,
cuts the named part out of the source character's IDS, and compares the parts with the head
character's own IDS.

Nothing is written; the script prints the counts and every mismatch.

    uv run python scripts/eval_wenhai_composition.py [--pages DIR] [--csv FILE] [--ids FILE]

DIR holds saved copies of the three BabelStone pages under their own names.  The construction's
part terms and their readings are from Andrew West, "Untangling the Web of Characters" (2010):
whole 𘓳, left 𘊱, middle 𘁝, right 𗡼, top 𗥦, bottom 𗘡, surrounding 𘍞.
"""

import argparse
import collections
import csv
import gzip
import hashlib
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_babelstone_wenhai as check

ROOT = Path(__file__).resolve().parents[1]
IDS = ROOT / 'data' / 'tangut-ids.tsv.gz'

# The part terms, as the 文海 writes them.
PARTS = {
    '𘓳': 'whole',
    '𘊱': 'left',
    '𘁝': 'middle',
    '𗡼': 'right',
    '𗥦': 'top',
    '𗘡': 'bottom',
    '𘍞': 'surrounding',
}
ARITY = {'⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2, '⿶': 2,
         '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2}
ENCLOSING = {'⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺'}
LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def parse_ids(text: str):
    """An IDS string as nested (operator, children) and ('leaf', character) tuples."""
    if not text:
        raise ValueError('empty IDS')
    character = text[0]
    if character in ARITY:
        children, rest = [], text[1:]
        for _ in range(ARITY[character]):
            child, rest = parse_ids(rest)
            children.append(child)
        return (character, children), rest
    return ('leaf', character), text[1:]


def ids_text(node) -> str:
    if node[0] == 'leaf':
        return node[1]
    return node[0] + ''.join(ids_text(child) for child in node[1])


def ids_top(text: str):
    """The whole IDS as a tree, or None when the text is not one complete description."""
    try:
        node, rest = parse_ids(text)
    except (ValueError, IndexError):
        return None
    return node if not rest else None


def ids_leaves(node) -> list[str]:
    if node[0] == 'leaf':
        return [node[1]]
    return [leaf for child in node[1] for leaf in ids_leaves(child)]


def ids_subtrees(node) -> set[str]:
    found = {ids_text(node)}
    if node[0] != 'leaf':
        for child in node[1]:
            found |= ids_subtrees(child)
    return found


def part_of(source: str, part: str, ids: dict[str, str]):
    """The named part of a source character's IDS, or None when its top level cannot give it."""
    text = ids.get(source)
    if not text:
        return None
    node = ids_top(text)
    if node is None:
        return None
    if part == 'whole':
        return text
    if node[0] == 'leaf':
        return None
    operator, children = node
    if part in ('left', 'right', 'middle'):
        if operator == '⿰':
            if part == 'left':
                return ids_text(children[0])
            if part == 'right':
                return ids_text(children[1])
            return None
        if operator == '⿲':
            return ids_text(children[{'left': 0, 'middle': 1, 'right': 2}[part]])
        if operator == '⿳' and part == 'middle':
            return ids_text(children[1])
        return None
    if part in ('top', 'bottom'):
        if operator == '⿱':
            return ids_text(children[0] if part == 'top' else children[1])
        if operator == '⿳':
            return ids_text(children[0] if part == 'top' else children[2])
        return None
    if part == 'surrounding':
        return ids_text(children[0]) if operator in ENCLOSING else None
    raise ValueError(f'unknown part {part}')


def formula_parts(characters: str) -> list[tuple[str, str]]:
    """A construction as (source, part) pairs: a part term modifies the source before it, and a
    source without a term is the whole character."""
    parts, index = [], 0
    while index < len(characters):
        source = characters[index]
        if source in PARTS:
            raise ValueError(f'part term {source} has no source')
        if index + 1 < len(characters) and characters[index + 1] in PARTS:
            parts.append((source, PARTS[characters[index + 1]]))
            index += 2
        else:
            parts.append((source, 'whole'))
            index += 1
    return parts


def glyph_characters(glyph: str, numbers: dict[str, list[str]], number_char: dict[str, str]):
    """The Unicode characters the WHYJ index gives a PUA glyph, exactly or with a dropped letter."""
    found = numbers.get(glyph, [])
    exact = [number_char[number] for number in found if number in number_char]
    loose = [number_char[number.rstrip(LETTERS)] for number in found
             if number not in number_char and number.rstrip(LETTERS) in number_char]
    return exact or loose


def read_ids(path: Path) -> dict[str, str]:
    """The IDS table: one character and its description per row."""
    ids = {}
    with gzip.open(path, 'rt', encoding='utf-8') as source:
        for row in csv.reader(source, delimiter='\t'):
            if len(row) >= 2 and row[0] and not row[0].startswith('#'):
                ids[row[0]] = row[1]
    return ids


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=Path, help='a folder of saved copies of the three pages')
    parser.add_argument('--csv', type=Path, help="a copy of nkay0's table, instead of fetching it")
    parser.add_argument('--ids', type=Path, default=IDS,
                        help='the IDS table (default: data/tangut-ids.tsv.gz)')
    options = parser.parse_args()

    pages = {name: (options.pages / name).read_bytes() if options.pages
             else check.fetch(check.BASE + name) for name in check.PAGES}
    wenhai, listing, index = (pages[name].decode('utf-8') for name in check.PAGES)
    raw = options.csv.read_bytes() if options.csv else check.fetch(check.TABLE)
    if hashlib.sha256(raw).hexdigest() != check.SHA256:
        raise SystemExit('the table is not the one the site is built from')

    skeleton = check.skeleton_rows(wenhai)
    heads = check.listing_rows(listing)
    numbers = check.index_numbers(index)
    table = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    number_char = {row['李範文 2008'][1:].lstrip('0'): row['文字']
                   for row in table if row['李範文 2008'].startswith('L')}
    ids = read_ids(options.ids)

    cells = [(key, value[3]) for key, value in sorted(skeleton.items()) if value[3]]
    counts = collections.Counter()
    failures = []
    for key, construction in cells:
        found = [glyph_characters(glyph, numbers, number_char) for glyph in construction]
        if any(len(mapped) != 1 for mapped in found):
            counts['unreadable'] += 1
            continue
        counts['readable'] += 1
        characters = ''.join(mapped[0] for mapped in found)
        try:
            parts = formula_parts(characters)
        except ValueError:
            counts['unreadable formula'] += 1
            continue
        counts[f'{len(parts)} parts'] += 1
        head = heads.get(key)
        if not head or head not in ids:
            counts['no head'] += 1
            continue
        extracted = [(source, part, part_of(source, part, ids)) for source, part in parts]
        missing = [item for item in extracted if item[2] is None]
        if missing:
            counts['part missing'] += 1
            failures.append((key, head, characters, missing))
            continue
        node = ids_top(ids[head])
        if node is None:
            counts['head without IDS'] += 1
            continue
        counts['all parts'] += 1
        leaves = ids_leaves(node)
        subtrees = ids_subtrees(node)
        if all(part in subtrees for _, _, part in extracted):
            counts['parts are subtrees'] += 1
        if node[0] != 'leaf':
            if [part for _, _, part in extracted] == [ids_text(child) for child in node[1]]:
                counts['exact top level'] += 1
        positions, covered, ordered = [], set(), True
        for _, _, part in extracted:
            part_node = ids_top(part)
            if part_node is None:
                ordered = False
                break
            leaves_part = ids_leaves(part_node)
            start = next((i for i in range(len(leaves) - len(leaves_part) + 1)
                          if leaves[i:i + len(leaves_part)] == leaves_part), None)
            if start is None:
                ordered = False
                break
            positions.append(start)
            covered.update(range(start, start + len(leaves_part)))
        if ordered:
            counts['parts in leaf order'] += 1
            if positions == sorted(positions):
                counts['parts in the stated order'] += 1
            if len(covered) == len(leaves):
                counts['parts cover every leaf'] += 1
            counts['leaf coverage'] += len(covered) / len(leaves)
            counts['coverage entries'] += 1

    print(f'{len(cells)} constructions: {counts["readable"]} read to Unicode, '
          f'{counts["unreadable"]} not')
    print(f'  {counts["2 parts"]} in two parts, {counts["3 parts"]} in three, '
          f'{counts["4 parts"]} in four')
    print(f'  {counts["all parts"]} with every part cut from its source IDS, '
          f'{counts["part missing"]} without, {counts["no head"]} without a head, '
          f'{counts["head without IDS"]} with an unreadable IDS')
    if counts['unreadable formula']:
        print(f'  {counts["unreadable formula"]} with an unreadable formula')
    if counts['all parts']:
        print(f'  of those: {counts["exact top level"]} rebuild the head top level exactly, '
              f'{counts["parts are subtrees"]} are subtrees of the head')
        print(f'             {counts["parts in leaf order"]} put every part on a contiguous run of '
              f'leaves, {counts["parts in the stated order"]} keep the stated order')
    if counts['coverage entries']:
        print(f'  of the {counts["coverage entries"]} whose parts fall on a run: '
              f'{counts["parts cover every leaf"]} cover every leaf, '
              f'mean leaf coverage {counts["leaf coverage"] / counts["coverage entries"]:.1%}')
    print('failures:')
    for key, head, construction, missing in failures:
        detail = '; '.join(f'{source} {part} (source {ids.get(source, "no IDS")})'
                           for source, part, _ in missing)
        print(f'  {key}  {head}  {construction}  {detail}')


if __name__ == '__main__':
    main()

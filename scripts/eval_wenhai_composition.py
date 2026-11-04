"""Measure the 文海's four-character construction against the glyph data.

A 文海 entry opens with at most four characters that say how the glyph is built from parts of other
characters: the whole, left, middle, right, top, bottom or surrounding part of a source character.
The 60 cells use those seven terms, and a source with no term after it is read as the whole
character. This script reads them from BabelStone's draft (Wenhai.html), or from a JSONL table,
cuts the named part out of the source character's IDS, and compares the parts with the head
character's own IDS. The BabelStone path turns its Private Use Area glyphs into Unicode through the
WHYJ index and nkay0's Li Fanwen 2008 table.

Nothing is written; the script prints the counts and every mismatch.

    uv run python scripts/eval_wenhai_composition.py [--pages DIR] [--csv FILE] [--formulas FILE]
        [--ids FILE]

DIR holds saved copies of the three BabelStone pages under their own names. A JSONL --formulas
table, one {"character", "formula", "position"} object per line, can stand in for the pages; the
formula is the construction's characters in order.  The construction's
part terms and their readings are from Andrew West, "Untangling the Web of Characters" (2010):
whole 𘓳, left 𘊱, middle 𘁝, right 𗡼, top 𗥦, bottom 𗘡, surrounding 𘍞.
"""

import argparse
import collections
import csv
import gzip
import hashlib
import io
import json
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


def cut_node(node, part: str):
    """The named part of an IDS node, or None when its top level cannot give it."""
    if part == 'whole':
        return ids_text(node)
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


def part_of(source: str, part: str, ids: dict[str, str]):
    """The named part of a source character's IDS, or None when its top level cannot give it."""
    text = ids.get(source)
    if not text:
        return None
    node = ids_top(text)
    if node is None:
        return None
    return cut_node(node, part)


def all_nodes(node) -> list:
    """An IDS node and every node under it."""
    found = [node]
    if node[0] != 'leaf':
        for child in node[1]:
            found += all_nodes(child)
    return found


def choose_part(source: str, part: str | None, head: str, ids: dict[str, str]):
    """A part of the source that lands in the head's IDS. The top level is tried first; a part the
    top level cannot give, or a term the 文海 left out (None), is searched for in every descendant.
    An explicit whole is only the whole source."""
    head_node = ids_top(ids.get(head, '') or '')
    if head_node is None:
        return None
    subtrees = ids_subtrees(head_node)
    source_node = ids_top(ids.get(source, '') or '')
    if source_node is None:
        return None
    if part == 'whole':
        root = cut_node(source_node, 'whole')
        return root if root in subtrees else None
    if part is not None:
        root = cut_node(source_node, part)
        if root is not None and root in subtrees:
            return root
        terms = [part]
    else:
        terms = list(PARTS.values())
    best = None
    for node in all_nodes(source_node):
        for term in terms:
            found = cut_node(node, term)
            if found is None or found not in subtrees:
                continue
            size = len(ids_leaves(ids_top(found)))
            if best is None or size > best[0]:
                best = (size, found)
    return best[1] if best else None


def formula_parts(characters: str, elide: bool = False) -> list[tuple[str, str | None]]:
    """A construction as (source, part) pairs: a part term modifies the source before it, and a
    source without a term is the whole character, or None when elide is set."""
    parts, index = [], 0
    while index < len(characters):
        source = characters[index]
        if source in PARTS:
            raise ValueError(f'part term {source} has no source')
        if index + 1 < len(characters) and characters[index + 1] in PARTS:
            parts.append((source, PARTS[characters[index + 1]]))
            index += 2
        else:
            parts.append((source, None if elide else 'whole'))
            index += 1
    return parts


def glyph_characters(glyph: str, numbers: dict[str, list[str]], number_char: dict[str, str]):
    """The Unicode characters the WHYJ index gives a PUA glyph, exactly or with a dropped letter."""
    found = numbers.get(glyph, [])
    exact = [number_char[number] for number in found if number in number_char]
    loose = [number_char[number.rstrip(LETTERS)] for number in found
             if number not in number_char and number.rstrip(LETTERS) in number_char]
    return exact or loose


def is_tangut(character: str) -> bool:
    """Whether a character is one of the Tangut ideographs or components."""
    return 0x17000 <= ord(character) <= 0x18AFF


def read_formulas(path: Path) -> list[dict[str, str]]:
    """A construction table as JSONL: one object per line, with character, formula and optional
    position. The formula is the entry's construction characters in order."""
    rows = []
    with path.open(encoding='utf-8') as source:
        for number, line in enumerate(source, 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as error:
                raise SystemExit(f'{path}:{number}: {error}')
            if not isinstance(row, dict):
                raise SystemExit(f'{path}:{number}: expected an object')
            character = row.get('character')
            formula = row.get('formula')
            if not isinstance(character, str) or len(character) != 1 or not is_tangut(character):
                raise SystemExit(f'{path}:{number}: character must be one Tangut character')
            if (not isinstance(formula, str) or not 1 <= len(formula) <= 4
                    or not all(is_tangut(char) for char in formula)):
                raise SystemExit(f'{path}:{number}: formula must be one to four Tangut characters')
            rows.append({'character': character, 'formula': formula,
                         'position': str(row.get('position') or number)})
    if not rows:
        raise SystemExit(f'{path}: no constructions')
    return rows


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
    parser.add_argument('--formulas', type=Path,
                        help='a JSONL construction table, instead of the BabelStone pages')
    parser.add_argument('--choose', action='store_true',
                        help="also choose each cut with the head's IDS")
    parser.add_argument('--ids', type=Path, default=IDS,
                        help='the IDS table (default: data/tangut-ids.tsv.gz)')
    options = parser.parse_args()
    if options.formulas and (options.pages or options.csv):
        parser.error('--formulas cannot be combined with --pages or --csv')

    if options.formulas:
        cells = [(row['position'], row['formula'], row['character'])
                 for row in read_formulas(options.formulas)]
    else:
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
        cells = [(key, value[3], heads.get(key))
                 for key, value in sorted(skeleton.items()) if value[3]]

    ids = read_ids(options.ids)
    counts = collections.Counter()
    failures = []
    parsed = []
    for key, construction, head in cells:
        if options.formulas:
            characters = construction
            counts['readable'] += 1
        else:
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
        if not head or head not in ids:
            counts['no head'] += 1
            continue
        parsed.append((key, characters, head))
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

    if options.choose:
        resolved = exact = 0
        unresolved = []
        for key, characters, head in parsed:
            parts = formula_parts(characters, elide=True)
            head_node = ids_top(ids[head])
            children = ([ids_text(child) for child in head_node[1]]
                        if head_node is not None and head_node[0] != 'leaf' else [])
            chosen = []
            for source, part in parts:
                found = choose_part(source, part, head, ids)
                if found is None:
                    chosen = None
                    break
                chosen.append(found)
            if chosen is None:
                unresolved.append((key, head, parts))
            else:
                resolved += 1
                if chosen == children:
                    exact += 1
        print(f'head-assisted: {resolved} of {len(parsed)} resolved, {exact} exact, '
              f'{len(unresolved)} unresolved')
        for key, head, parts in unresolved:
            print(f'  {key}  {head}  {parts}')


if __name__ == '__main__':
    main()

# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Record what English and Chinese Wiktionary state about variant forms, from their pages-articles dumps.

A Tangut page states a variant in three ways: `{{txg-see|𗍸}}`, which renders "This character is a
variant form of 𗍸"; a definition `Variant form of {{l|txg|𗇫}}`; or `{{alt of|txg|𘄵}}`. A statement
on a page with several etymologies covers one of its words, so its `scope` is `partial`. `{{syn|txg|𗌜}}`
is recorded as `synonym`, which keeps the pair out of the possible variants. Writes
`data/tangut-variants.tsv` with each page's revision as `wiki:revision`. The dumps are not kept here.

    uv run scripts/extract_tangut_variants.py en=enwiktionary-20261101-pages-articles.xml.bz2 zh=zhwiktionary-20261101-pages-articles.xml.bz2
"""
import bz2
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'data/tangut-variants.tsv'
TANGUT = re.compile('^[\U00017000-\U00018AFF\U00018D00-\U00018D7F]$')
STATED = re.compile(r'\{\{txg-see\|([^}|]+)|[Vv]ariant form of \{\{l\|txg\|([^}|]+)|\{\{alt of\|txg\|([^}|]+)')
SYNONYMS = re.compile(r'\{\{syn\|txg\|([^}]*)\}\}')
ETYMOLOGIES = re.compile(r'Etymology 1|詞源\s*1')


def statements(title: str, text: str) -> set[tuple[str, str, str]]:
    """What one page states, as (base, kind, scope)."""
    found = set()
    scope = 'partial' if ETYMOLOGIES.search(text) else 'whole'
    for groups in STATED.findall(text):
        found.add((next(group for group in groups if group), 'variant', scope))
    for arguments in SYNONYMS.findall(text):
        for argument in arguments.split('|'):
            other = re.sub(r'<.*?>', '', argument)
            if '=' not in other and TANGUT.match(other) and other != title:
                found.add((other, 'synonym', 'whole'))
    return found


def add_dump(wiki: str, dump: str, rows: dict[tuple[str, str, str, str], list[str]]) -> None:
    """Add what one dump states to `rows`."""
    root = None
    with bz2.open(dump, 'rb') as file:
        for event, element in ET.iterparse(file, events=('start', 'end')):
            if root is None:
                root = element
            if event != 'end' or not element.tag.endswith('}page'):
                continue
            space = element.tag.split('}')[0] + '}'
            title = element.findtext(space + 'title') or ''
            if TANGUT.match(title):
                text = element.findtext(f'{space}revision/{space}text') or ''
                revision = element.findtext(f'{space}revision/{space}id')
                for base, kind, scope in statements(title, text):
                    rows.setdefault((title, base, kind, scope), []).append(f'{wiki}:{revision}')
            element.clear()
            root.clear()


def write(rows: dict[tuple[str, str, str, str], list[str]]) -> None:
    lines = ['form\tbase\tkind\tscope\trevisions'] + ['\t'.join([*key, ','.join(revisions)]) for key, revisions in sorted(rows.items())]
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{len(rows)} rows → {OUT.name}')


def main(dumps: list[str]) -> None:
    rows: dict[tuple[str, str, str, str], list[str]] = {}
    for dump in dumps:
        wiki, path = dump.split('=', 1)
        add_dump(wiki, path, rows)
    write(rows)


if __name__ == '__main__':
    main(sys.argv[1:])

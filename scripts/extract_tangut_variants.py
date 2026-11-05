# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Record the variant forms English and Chinese Wiktionary state, from their pages-articles dumps.

A Tangut page states one in two ways: `{{txg-see|𗍸}}`, which renders "This character is a variant form
of 𗍸", or a definition `Variant form of {{l|txg|𗇫}}`. Writes `data/tangut-variants.tsv` with the form,
its base and each page's revision as `wiki:revision`. The dumps are not kept here.

    uv run scripts/extract_tangut_variants.py en=enwiktionary-20261101-pages-articles.xml.bz2 zh=zhwiktionary-20261101-pages-articles.xml.bz2
"""
import bz2
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'data/tangut-variants.tsv'
TANGUT = re.compile('^[\U00017000-\U00018AFF\U00018D00-\U00018D7F]$')
STATED = re.compile(r'\{\{txg-see\|([^}|]+)|[Vv]ariant form of \{\{l\|txg\|([^}|]+)')


def stated_in(wiki: str, dump: str, rows: dict[tuple[str, str], list[str]]) -> None:
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
                for see, line in STATED.findall(text):
                    rows.setdefault((title, see or line), []).append(f'{wiki}:{revision}')
            element.clear()
            root.clear()


def main(dumps: list[str]) -> None:
    rows: dict[tuple[str, str], list[str]] = {}
    for dump in dumps:
        wiki, path = dump.split('=', 1)
        stated_in(wiki, path, rows)
    lines = ['form\tbase\trevisions'] + [f"{form}\t{base}\t{','.join(revisions)}" for (form, base), revisions in sorted(rows.items())]
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{len(rows)} variants → {OUT.name}')


if __name__ == '__main__':
    main(sys.argv[1:])

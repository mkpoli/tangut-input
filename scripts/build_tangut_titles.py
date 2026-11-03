# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the list of Western Xia imperial titles from `data/tangut-titles.tsv`.

Each row is one title as a text in this repository writes it, with its holder, the Chinese printed
by the study named in `chinese_source` where there is one, and the text's `place`. `identified`
says how the holder is known: `stated` by a study, or `dated`, inferred from the date of the passage
in the text. The build stops unless the title occurs in its place, outside wikitext comments and
notes. Spaces and line numbers in a running text are ignored, since the Lausanne files keep the
edition's line breaks. Rows for one title must agree on everything but the source.

    uv run scripts/build_tangut_titles.py
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TITLES = ROOT / 'data/tangut-titles.tsv'
OUT = ROOT / 'app/data/tangut-titles.json'
NOT_TANGUT = re.compile('[^\U00017000-\U00018AFF\U00018D00-\U00018D7F]')


def place_text(place: str) -> str:
    """A work in the repository's own corpus, as Tangut characters alone."""
    corpus, name = place.split(':', 1)
    if corpus == 'lcdtt':
        text = (ROOT / f'data/lcdtt/{name}.txt').read_text(encoding='utf-8')
    elif corpus == 'wikisource':
        text = json.loads((ROOT / 'data/wikisource/pages.json').read_text(encoding='utf-8'))['pages'][name]['content']
        text = re.sub(r'(?s)<ref[^>]*/>|<ref.*?</ref>|<!--.*?-->', '', text)
    else:
        raise SystemExit(f'unknown corpus: {place}')
    return NOT_TANGUT.sub('', text)


def main() -> None:
    titles = {}
    with TITLES.open(encoding='utf-8') as file:
        for row in csv.DictReader(file, delimiter='\t'):
            if row['identified'] not in ('stated', 'dated'):
                raise SystemExit(f'unknown identification: {row}')
            if bool(row['chinese']) != bool(row['chinese_source']):
                raise SystemExit(f'Chinese without its source, or a source without Chinese: {row}')
            if row['tangut'] not in place_text(row['place']):
                raise SystemExit(f'the title does not occur in the text named: {row}')
            title = titles.setdefault((row['holder'], row['tangut']), {
                'holder': row['holder'], 'identified': row['identified'], 'tangut': row['tangut'],
                'chinese': row['chinese'], 'chineseSource': row['chinese_source'], 'sources': [],
            })
            if (title['identified'], title['chinese'], title['chineseSource']) != (row['identified'], row['chinese'], row['chinese_source']):
                raise SystemExit(f'rows for one title disagree: {row}')
            if row['source'] not in title['sources']:
                title['sources'].append(row['source'])
    OUT.write_text(json.dumps(list(titles.values()), ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(titles)} titles → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

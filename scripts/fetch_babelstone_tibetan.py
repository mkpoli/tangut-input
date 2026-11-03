"""Read BabelStone's index of Tangut characters with Tibetan phonetic glosses into app/data.

The page (Andrew West, published 2011-12-19) tabulates, for each Tangut character, the Tibetan
glosses written beside it in five British Library manuscripts, in Wylie and in Tibetan script, with
a count per manuscript. A character with several glosses spans several rows. Only the character,
the gloss and its manuscripts are kept; the page's Li Fanwen number and reading are left out, since
the site has its own.

    uv run --with beautifulsoup4 python scripts/fetch_babelstone_tibetan.py [saved-page.html]
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

URL = 'https://www.babelstone.co.uk/Tangut/TangutTibetanIndex.html'
OUT = Path(__file__).resolve().parent.parent / 'app/data/tangut-tibetan.json'
# The date the page was last read; set it when the page is fetched again.
RETRIEVED = '2026-11-03'
SOURCE = re.compile(r'(Or\.\d+/\d+)\s*\[×(\d+)\]')


def read_page() -> str:
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).read_text(encoding='utf-8')
    request = urllib.request.Request(URL, headers={'User-Agent': 'tangut-input data build'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode('utf-8')


def main() -> None:
    soup = BeautifulSoup(read_page(), 'html.parser')
    modified = re.search(r'Last modified:\s*(\d{4}-\d{2}-\d{2})', soup.get_text(' '))
    glosses: dict[str, list[list]] = {}
    char = ''
    pending = 0
    skipped = []
    for row in soup.find_all('tr'):
        cells = row.find_all('td')
        if not cells:
            continue
        texts = [cell.get_text(' ', strip=True) for cell in cells]
        if len(texts) == 6:
            if pending:
                sys.exit(f'{char}: {pending} gloss rows promised by rowspan never came')
            char = texts[1]
            pending = int(cells[1].get('rowspan', 1)) - 1
            texts = texts[3:]
        elif len(texts) == 3 and pending:
            pending -= 1
        else:
            skipped.append(texts)
            continue
        wylie, tibetan, where = texts
        sources = [[shelf, int(count)] for shelf, count in SOURCE.findall(where)]
        if not wylie or not sources or SOURCE.sub('', where).strip():
            skipped.append(texts)
            continue
        glosses.setdefault(char, []).append([wylie, tibetan, sources])
    if pending:
        sys.exit(f'{char}: {pending} gloss rows promised by rowspan never came')
    if skipped:
        sys.exit(f'{len(skipped)} rows not read, first: {skipped[0]}')
    if not glosses:
        sys.exit('no glosses read: the page layout changed')
    data = {
        'format': 'tangut-input/tibetan',
        'source': URL,
        'author': 'Andrew West (BabelStone)',
        'modified': modified.group(1) if modified else None,
        'retrieved': RETRIEVED,
        'note': 'Tibetan phonetic glosses in British Library manuscripts Or.12380/1842, 3495, 3909, '
                '3910 and 3911. The page omits some incomplete glosses, and warns that some glosses '
                'are hard to read, so the table probably holds some erroneous readings. A [?] in the '
                'Wylie marks a letter that could not be read.',
        'glosses': glosses,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    total = sum(len(value) for value in glosses.values())
    print(f'{len(glosses)} characters, {total} glosses -> {OUT}')


if __name__ == '__main__':
    main()

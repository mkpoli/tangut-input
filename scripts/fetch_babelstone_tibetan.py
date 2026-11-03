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
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

URL = 'https://www.babelstone.co.uk/Tangut/TangutTibetanIndex.html'
OUT = Path(__file__).resolve().parent.parent / 'app/data/tangut-tibetan.json'
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
    for row in soup.find_all('tr'):
        cells = [cell.get_text(' ', strip=True) for cell in row.find_all('td')]
        if len(cells) == 6:
            char = cells[1]
            cells = cells[3:]
        elif len(cells) != 3 or not char:
            continue
        wylie, tibetan, where = cells
        sources = [[shelf, int(count)] for shelf, count in SOURCE.findall(where)]
        if not wylie or not sources:
            continue
        glosses.setdefault(char, []).append([wylie, tibetan, sources])
    if not glosses:
        sys.exit('no glosses read: the page layout changed')
    data = {
        'format': 'tangut-input/tibetan',
        'source': URL,
        'author': 'Andrew West (BabelStone)',
        'modified': modified.group(1) if modified else None,
        'retrieved': date.today().isoformat(),
        'note': 'Tibetan phonetic glosses in British Library manuscripts Or.12380/1842, 3495, 3909, '
                '3910 and 3911. The page warns that some glosses are hard to read and some readings '
                'are probably wrong, and omits incomplete glosses.',
        'glosses': glosses,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    total = sum(len(value) for value in glosses.values())
    print(f'{len(glosses)} characters, {total} glosses -> {OUT}')


if __name__ == '__main__':
    main()

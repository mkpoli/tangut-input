#!/usr/bin/env python3
"""Fetch BabelStone's parallel Tangut and Chinese text of the Dragon King sutra.

The page (Andrew West, <https://www.babelstone.co.uk/Tangut/DragonKing.html>) prints the Tangut
transcription and 義淨's Chinese translation of T599 line by line. The table keeps both columns in
page order; the Tangut column aligns each Chinese line with the transcriptions of the same text.

    python3 scripts/fetch_babelstone_dragon_king.py [saved-page.html]

The page states no licence. The Chinese is a public-domain translation; see
`data/babelstone/README.md`.
"""
import html
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/babelstone/dragon-king.tsv'
URL = 'https://www.babelstone.co.uk/Tangut/DragonKing.html'
RETRIEVED = '2026-11-07'
TANGUT = re.compile(r'[\U00017000-\U00018AFF\U00018D00-\U00018DFF]')
HAN = re.compile(r'[\u3400-\u9fff]')


def read_page():
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).read_text(encoding='utf-8')
    request = urllib.request.Request(URL, headers={'User-Agent': 'tangut-input/0.1 (corpus snapshot)'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode('utf-8')


def paragraphs(page, kind):
    found = re.findall(rf'<p class="{kind} big">(.*?)</p>', page, re.S)
    lines = [html.unescape(re.sub(r'<[^>]+>', '', value)).strip() for value in found]
    return [line for line in lines if line]


def main():
    page = read_page()
    tangut = paragraphs(page, 'tangut')
    chinese = paragraphs(page, 'han')
    if not tangut or len(tangut) != len(chinese):
        sys.exit(f'{len(tangut)} Tangut paragraphs and {len(chinese)} Chinese ones: the page layout changed')
    for line in tangut:
        if not TANGUT.search(line):
            sys.exit(f'no Tangut in {line!r}')
    for line in chinese:
        if not HAN.search(line):
            sys.exit(f'no Chinese in {line!r}')

    header = (
        '# BabelStone, Question asked by the Dragon King of the Sea, ' + URL + '\n'
        f'# Read {RETRIEVED}. Tangut and Chinese line by line, in page order.\n'
        "# The Chinese is 義淨's translation, Taishō T599, as the page prints it. The page states no licence.\n"
        '# The Tangut column only aligns the Chinese with the two transcriptions of the same text.\n'
        '#tangut\tchinese\n'
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(header + ''.join(f'{t}\t{c}\n' for t, c in zip(tangut, chinese)), encoding='utf-8')
    print(f'{len(tangut)} pairs -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

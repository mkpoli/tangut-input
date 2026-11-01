# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build `app/data/tangut-sijiao.json.gz`: each Tangut character's 四角号碼 (four-corner code).

The column comes from `tangut rhyme dictionaries data.csv` in nkay0/Tangut-rhyme-dictionaries-data
(https://github.com/nkay0/Tangut-rhyme-dictionaries-data), which records 韓小忙 (2021)'s six-digit
codes as `2141/22` for the character's row. The table declares no licence; the codes themselves are
a classification of the glyph, the book they are read from is 韓小忙's.
"""
import csv
import gzip
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/tangut-sijiao.json.gz'
SOURCE = 'https://raw.githubusercontent.com/nkay0/Tangut-rhyme-dictionaries-data/main/tangut%20rhyme%20dictionaries%20data.csv'


def main() -> None:
    with urlopen(SOURCE) as response:
        text = response.read().decode('utf-8-sig')
    pairs = []
    for row in csv.DictReader(text.splitlines()):
        char = (row.get('文字') or '').strip()
        code = (row.get('四角号碼') or '').strip().replace('/', '')
        if len(char) != 1 or not code.isdigit() or len(code) != 6:
            continue
        if not '\U00017000' <= char <= '\U00018DFF':
            continue
        pairs.append([char, code])
    raw = json.dumps(pairs, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(raw)
    print(f'{len(pairs)} codes, {OUT.stat().st_size} bytes -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the rhyme record: for each character, its class in the rhyme books and its fanqie.

The source is nkay0's *Tangut rhyme dictionaries data* (西夏語韻書データ), the tables of the 文海,
文海寶韻, 同音 and 合編 compiled from Han Xiaomang (2021) and the editions: the rhyme class 総合韻,
the tone 声調, the initial group 声母, and the fanqie spelling 反切 given in the 文海 and in 合編.
Only the fields the site shows are kept; the page and index numbers are left in the source table.

The file is a little-endian u32 header length, the header as UTF-8 JSON, then one gzipped record.
The record maps a character to `[rhyme, tone, group, upper, lower, upperB, lowerB]`, where the upper
and lower are the 文海 fanqie's own characters, and the `B` pair is 合編's.
"""
import argparse
import csv
import datetime
import gzip
import hashlib
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '6ce66747f760160d8b8ee1c23356573788b4c5a5'
FILE = 'tangut rhyme dictionaries data.csv'
SHA256 = '84787642cc34ac347dd1a361584a5239bc63e1f4f32077f2d45809f70feeea7b'
URL = f'https://raw.githubusercontent.com/nkay0/Tangut-rhyme-dictionaries-data/{COMMIT}/{FILE.replace(" ", "%20")}'
OUT = ROOT / 'app/data/tangut-rhymes.json.gz'

# The columns, as the table heads them.
COLUMNS = {
    'char': '文字',
    'rhyme': '総合韻',
    'tone': '声調',
    'group': '声母',
    'upper': '文海 反切上字',
    'lower': '文海 反切下字',
    'upperB': '合編 反切A上字',
    'lowerB': '合編 反切A下字',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', type=Path, help='a copy of the table, instead of fetching it')
    options = parser.parse_args()
    raw = options.csv.read_bytes() if options.csv else urllib.request.urlopen(URL).read()
    digest = hashlib.sha256(raw).hexdigest()
    if not options.csv and digest != SHA256:
        raise SystemExit(f'the table is not the one this builder was written for: sha256 {digest}')
    rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
    head, body = rows[0], rows[1:]
    at = {name: head.index(column) for name, column in COLUMNS.items() if column in head}

    chars = {}
    for row in body:
        char = row[at['char']].strip()
        if len(char) != 1:
            continue
        chars[char] = [field(row, at[name]) for name in ('rhyme', 'tone', 'group', 'upper', 'lower', 'upperB', 'lowerB')]

    record = {
        'built': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'source': {
            'name': 'Tangut-rhyme-dictionaries-data (西夏語韻書データ)',
            'author': 'nkay0',
            'url': 'https://github.com/nkay0/Tangut-rhyme-dictionaries-data',
            'commit': COMMIT,
            'file': FILE,
            'sha256': digest,
        },
        'columns': ['rhyme', 'tone', 'group', 'upper', 'lower', 'upperB', 'lowerB'],
        'chars': chars,
    }
    header = json.dumps(record, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(header)
    print(f'{len(chars)} characters -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


def field(row, index):
    """A cell as a number when it is one, otherwise as text; empty as null."""
    value = row[index].strip() if index < len(row) else ''
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return value


if __name__ == '__main__':
    main()

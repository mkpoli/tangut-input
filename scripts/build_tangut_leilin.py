# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the Chinese glosses of the Tangut 類林, character by character.

Guillaume Jacques's Leilin database gives the Chinese word for each character position in the text.
tinbreaker/tangut-text publishes it as a table. Each character keeps every gloss it has there, as
written, the commonest first, with how often. That includes the grammatical labels such as ɴᴇɢ.

    uv run scripts/build_tangut_leilin.py
"""
import collections
import csv
import hashlib
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '820fe592c8c0b1512867c70e5c84395a042667f3'
SHA256 = '9e8b000467b62913809d23d6dd1bf321602897682f4844a4aef8eddd09880ed9'
URL = 'https://raw.githubusercontent.com/tinbreaker/tangut-text/820fe592c8c0b1512867c70e5c84395a042667f3/%E7%B1%BB%E6%9E%97_l%C3%A8i%20l%C3%ADn.csv'
OUT = ROOT / 'app/data/tangut-leilin.json'


def main():
    raw = urllib.request.urlopen(URL, timeout=60).read()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SHA256:
        raise SystemExit(f'{URL}: expected {SHA256}, got {digest}')
    counts = collections.defaultdict(collections.Counter)
    for row in csv.DictReader(io.StringIO(raw.decode('utf-8'))):
        gloss = row['meaning'].strip()
        if row['character'] and gloss:
            counts[row['character']][gloss] += 1
    record = {
        'format': 'tangut-input/leilin',
        'source': 'Guillaume Jacques, Leilin database, https://www.academia.edu/25078937/Leilin_database',
        'via': f'https://github.com/tinbreaker/tangut-text/tree/{COMMIT}',
        'note': 'No licence is stated. A gloss is the word used at a place in this one text, so a character '
                'the text does not use has none, and a word can be a grammatical label.',
        'glosses': {char: found.most_common() for char, found in sorted(counts.items())},
    }
    OUT.write_text(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(counts)} characters -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


if __name__ == '__main__':
    main()

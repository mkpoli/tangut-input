"""Build `app/data/tangut-tibetan-seta.json.gz` from `data/tibetan-seta.tsv`.

The table maps the 1,536 precomposed characters of Tibetan Extension-A (藏文编码字符集（扩充集A）)
to the Unicode Tibetan sequences they stand for. It is transcribed from Andrew West's archived
mapping table; the live page now returns 404. The page states no licence, so the table keeps the
factual code points only. Set B, announced for the Supplementary Private Use Area, was never
published.

    python3 scripts/build_tibetan_seta.py
"""

import gzip
import hashlib
import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/tibetan-seta.tsv'
OUT = ROOT / 'app/data/tangut-tibetan-seta.json.gz'
URL = 'http://web.archive.org/web/20090202122023/http://babelstone.co.uk/Tibetan/PrecomposedTibetan.html'
ORIGINAL = 'https://www.babelstone.co.uk/Tibetan/PrecomposedTibetan.html'
RETRIEVED = '2026-11-08'


def main():
    rows = []
    for line in SOURCE.read_text(encoding='utf-8').splitlines():
        if not line or line.startswith('#'):
            continue
        code, sequence, composite = line.split('\t')
        point = int(code, 16)
        if not 0xF300 <= point <= 0xF8FF:
            raise SystemExit(f'{code} is outside Tibetan Extension-A')
        text = ''.join(chr(int(part, 16)) for part in sequence.split())
        if text != composite:
            raise SystemExit(f'{code}: {sequence} is {text}, not {composite}')
        rows.append([f'U+{code}', text, sequence])
    if len(rows) != 1536:
        raise SystemExit(f'{len(rows)} rows, expected 1,536')
    if len({row[0] for row in rows}) != len(rows):
        raise SystemExit('duplicate code point')
    keys = [unicodedata.normalize('NFD', row[1]) for row in rows]
    if len(set(keys)) != len(keys):
        raise SystemExit('two code points name the same sequence')

    data = {
        'format': 'tangut-input/tibetan-seta',
        'standard': 'Tibetan Extension-A (藏文编码字符集（扩充集A）)',
        'source': URL,
        'original': ORIGINAL,
        'author': 'Andrew West (BabelStone)',
        'retrieved': RETRIEVED,
        'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'note': 'Precomposed Tibetan stacks mapped to the Unicode sequences they stand for. '
                'The archived page states no licence; only the code points and sequences are kept. '
                'Set B was never published.',
        'map': rows,
    }
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{len(rows)} Set A characters -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


if __name__ == '__main__':
    main()

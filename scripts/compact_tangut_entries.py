# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Pack the character records the way the site reads them: one row of values per character.

The record as Open Tangut's data comes has a name for every value in every character — the eight
reading systems, the two sound glosses, the three languages of meaning — repeated 6,144 times. Naming
them once in a header instead makes the file a third smaller to parse and a quarter smaller to send.
The `codepoint` (derived from the character) and `radical_extra_strokes` (shown nowhere) are dropped.

    uv run scripts/compact_tangut_entries.py

Reads `app/data/tangut-entries.json.gz`, whether it is in the old shape or this one, and writes it
back compacted; a second run changes nothing.
"""
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'app/data/tangut-entries.json.gz'
FORMAT = 'tangut-input/entries'
SYSTEMS = ['li_fanwen', 'gong_huangcheng', 'gong_xun_202411', 'arakawa_shintaro', 'miyake', 'nishida',
           'kychanov', 'sofronov', 'sound_li_fanwen', 'sound_nie_lishan']


def main():
    data = json.loads(gzip.decompress(PATH.read_bytes()))
    rows = data['rows'] if isinstance(data, dict) and data.get('format') == FORMAT else pack(data)
    compact = {'format': FORMAT, 'systems': SYSTEMS, 'rows': rows}
    raw = json.dumps(compact, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(PATH, 'wb', mtime=0) as out:
        out.write(raw)
    print(f'{len(rows)} characters -> {PATH.relative_to(ROOT)} ({PATH.stat().st_size} bytes gzipped)')


def pack(entries):
    rows = []
    for entry in entries:
        pronunciations = entry.get('pronunciations') or {}
        definitions = entry.get('definitions') or {}
        rows.append([
            entry['char'],
            entry.get('composition'),
            entry.get('total_strokes'),
            entry.get('radical'),
            definitions.get('en'),
            definitions.get('ja'),
            definitions.get('zh'),
            [pronunciations.get(key) for key in SYSTEMS],
            entry.get('wenhai_text_en'),
            entry.get('wenhai_text_zh'),
        ])
    return rows


if __name__ == '__main__':
    main()

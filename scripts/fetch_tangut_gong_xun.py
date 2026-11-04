# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Snapshot Xun Gong's GX202411 reconstruction from the Tangut Pronunciation Database.

The database is published under a Limited Public Use licence: a data point may be cited with
attribution, and the site does so one character at a time, the way a dictionary is consulted. The
snapshot keeps the version, digest and DOI so every reading can be traced to the table it came from.

    uv run scripts/fetch_tangut_gong_xun.py

Writes ``data/gong-xun/gx202411.json.gz``.
"""
import csv
import gzip
import hashlib
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/gong-xun/gx202411.json.gz'
VERSION = '20250507'
URL = f'https://raw.githubusercontent.com/semakosa/tangut-pronunciation-db/main/{VERSION}.tsv'
UA = 'tangut-input/1.0 (https://tangut.mkpo.li; mkpoli@mkpo.li)'
SUPERSCRIPTS = str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹', '0123456789')


def main():
    request = urllib.request.Request(URL, headers={'User-Agent': UA})
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
    rows = csv.DictReader(io.StringIO(raw.decode('utf-8')), delimiter='\t')
    readings = {}
    for row in rows:
        char = row.get('unicode', '').strip()
        value = row.get('GX202411', '').strip().translate(SUPERSCRIPTS)
        if char and value:
            readings[char] = value
    data = {
        'retrieved': '2026-11-04',
        'version': VERSION,
        'sha256': hashlib.sha256(raw).hexdigest(),
        'source': {
            'name': 'Tangut Pronunciation Database, GX202411',
            'author': 'Xun Gong',
            'url': 'https://github.com/semakosa/tangut-pronunciation-db',
            'doi': '10.25365/phaidra.654',
            'licence': 'Limited Public Use',
            'licenceUrl': 'https://github.com/semakosa/tangut-pronunciation-db/blob/main/LICENSE-DATA.md',
            'attribution': 'Data sourced from the "Tangut Pronunciation Database" by Xun Gong.',
        },
        'readings': readings,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{len(readings)} readings -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

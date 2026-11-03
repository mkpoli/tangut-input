# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the list of Western Xia era names, with their Tangut forms and what each form rests on.

The eras, their dates and a Tangut form for most of them come from Andrew West's daily calendar of
the Western Xia (XixiaCalendar.txt, 2023-07-10), which names no source for its Tangut forms. What
the forms rest on is in `data/tangut-era-evidence.tsv`, one row per form and source:

- `coin`: read on a coin; `disputed`: read on a coin, but the reading or the era it names is
  disputed; `text`: written in a Tangut text; `unknown`: a source says no Tangut form is known.

An era's dates are those of its first and last day in the calendar (Julian). The calendar runs
past the end of the state, so the last era is given its start alone.

    uv run scripts/build_tangut_eras.py [--zip FILE]
"""
import argparse
import csv
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.babelstone.co.uk/Calendar/XixiaCalendar_txt.zip'
SHA256 = 'bd3f44d3bbb1a285ed6a085a8434770e7a97c537e8f4cdd8a4864c0e6cc66c14'
EVIDENCE = ROOT / 'data/tangut-era-evidence.tsv'
OUT = ROOT / 'app/data/tangut-eras.json'
KINDS = {'coin', 'disputed', 'text', 'unknown'}


def tangut(text: str) -> bool:
    return bool(text) and all(0x17000 <= ord(c) <= 0x18AFF or 0x18D00 <= ord(c) <= 0x18D7F for c in text)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', type=Path, help='a copy of the calendar archive, instead of fetching it')
    options = parser.parse_args()
    raw = options.zip.read_bytes() if options.zip else urllib.request.urlopen(
        urllib.request.Request(URL, headers={'User-Agent': 'tangut-input data build'})).read()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise SystemExit('the calendar is not the one this list was checked against')
    text = zipfile.ZipFile(io.BytesIO(raw)).read('XixiaCalendar.txt').decode('utf-8-sig')

    # One row per day; an era runs until the Chinese era name changes. 大慶 is used twice.
    eras = []
    for row in csv.DictReader(io.StringIO(text), delimiter='\t'):
        name, form, day = row['Xia Era (Chinese)'], row['Xia Era (Tangut)'], row['Year-Month-Day']
        if not eras or eras[-1]['era'] != name:
            forms = [f.strip() for f in form.split(' or ')] if form else []
            if not all(map(tangut, forms)):
                raise SystemExit(f'unread Tangut form for {name}: {form!r}')
            eras.append({'era': name, 'from': day, 'to': day, 'calendar': forms, 'evidence': []})
        eras[-1]['to'] = day
    eras[-1]['to'] = None

    with EVIDENCE.open(encoding='utf-8') as file:
        for row in csv.DictReader(file, delimiter='\t'):
            if row['kind'] not in KINDS:
                raise SystemExit(f'unknown kind: {row}')
            if (row['kind'] == 'unknown') != (not row['tangut']) or (row['tangut'] and not tangut(row['tangut'])):
                raise SystemExit(f'form and kind disagree: {row}')
            era = next((e for e in eras if e['era'] == row['era'] and e['from'][:4] == row['from']), None)
            if not era:
                raise SystemExit(f'no such era in the calendar: {row}')
            era['evidence'].append({'tangut': row['tangut'], 'kind': row['kind'], 'source': row['source']})

    OUT.write_text(json.dumps(eras, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(eras)} eras, {sum(bool(e["calendar"]) for e in eras)} with a Tangut form in the calendar → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

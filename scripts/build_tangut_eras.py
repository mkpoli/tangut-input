# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the list of Western Xia era names, with their Tangut forms and what each form rests on.

The eras, their dates and a Tangut form for most of them come from Andrew West's daily calendar of
the Western Xia (XixiaCalendar.txt, 2023-07-10), which names no source for its Tangut forms. What
the forms rest on is in `data/tangut-era-evidence.tsv`, one row per form and source:

- `coin`: read on a coin; `disputed`: read on a coin, but the reading or the era it names is
  disputed; `text`: written in a Tangut text, as a date or in a title; `gloss`: the same characters
  render the era name's Chinese in a Tangut text, of another era bearing the name; `post`: in a social
  media post naming no source, which may differ from the calendar and is cited on its own form; `unknown`: a
  source says no Tangut form is known.

A row with a `place` names a dated line in this repository's texts, `wikisource:<page>` or
`lcdtt:<file>`, and the build stops unless the form occurs there followed by a year: an optional
cyclical pair, a numeral and 𗤒. Tags belong to an era, so an era with two competing forms, apart from a post's, can only
carry `disputed` evidence.

An era's dates are its first and last day in the calendar (Julian), and its years are the lunar
years those days fall in, counted by the Julian year in which each lunar year begins, so an era
that ends in January does not seem to overlap the next. The calendar runs past the end of the
state, so the last era is given its start alone.

    uv run scripts/build_tangut_eras.py [--zip FILE]
"""
import argparse
import csv
import hashlib
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.babelstone.co.uk/Calendar/XixiaCalendar_txt.zip'
SHA256 = 'bd3f44d3bbb1a285ed6a085a8434770e7a97c537e8f4cdd8a4864c0e6cc66c14'
EVIDENCE = ROOT / 'data/tangut-era-evidence.tsv'
OUT = ROOT / 'app/data/tangut-eras.json'
KINDS = {'coin', 'disputed', 'text', 'gloss', 'post', 'unknown'}
# The numerals two to ten, as the dated lines write them.
NUMERALS = '𗍫𘕕𗥃𗏁𗤁𗒹𘉋𗢭𗰗'


def tangut(text: str) -> bool:
    return bool(text) and all(0x17000 <= ord(c) <= 0x18AFF or 0x18D00 <= ord(c) <= 0x18D7F for c in text)


def corpus_text(place: str) -> str:
    """The running text of a work in the repository's own corpus."""
    corpus, name = place.split(':', 1)
    if corpus == 'lcdtt':
        return (ROOT / f'data/lcdtt/{name}.txt').read_text(encoding='utf-8')
    if corpus == 'wikisource':
        pages = json.loads((ROOT / 'data/wikisource/pages.json').read_text(encoding='utf-8'))['pages']
        return re.sub(r'(?s)\{\{header.*?\n\}\}|<ref[^>]*/>|<ref.*?</ref>|<!--.*?-->', '', pages[name]['content'])
    raise SystemExit(f'unknown corpus: {place}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', type=Path, help='a copy of the calendar archive, instead of fetching it')
    options = parser.parse_args()
    raw = options.zip.read_bytes() if options.zip else urllib.request.urlopen(
        urllib.request.Request(URL, headers={'User-Agent': 'tangut-input data build'})).read()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise SystemExit('the calendar is not the one this list was checked against')
    text = zipfile.ZipFile(io.BytesIO(raw)).read('XixiaCalendar.txt').decode('utf-8-sig')

    # One row per day; an era runs until the Chinese era name changes. 大慶 is used twice. A lunar
    # year begins on the day the cyclical year changes.
    eras, cycle, lunar = [], None, None
    for row in csv.DictReader(io.StringIO(text), delimiter='\t'):
        name, form, day = row['Xia Era (Chinese)'], row['Xia Era (Tangut)'], row['Year-Month-Day']
        if row['Cyclical Year'] != cycle:
            cycle, lunar = row['Cyclical Year'], int(day[:4])
        if not eras or eras[-1]['era'] != name:
            forms = [f.strip() for f in form.split(' or ')] if form else []
            if not all(map(tangut, forms)):
                raise SystemExit(f'unread Tangut form for {name}: {form!r}')
            eras.append({'era': name, 'from': day, 'to': day, 'years': [lunar, lunar], 'calendar': forms, 'evidence': []})
        eras[-1]['to'], eras[-1]['years'][1] = day, lunar
    eras[-1]['to'], eras[-1]['years'][1] = None, None

    with EVIDENCE.open(encoding='utf-8') as file:
        for row in csv.DictReader(file, delimiter='\t'):
            if row['kind'] not in KINDS:
                raise SystemExit(f'unknown kind: {row}')
            if (row['kind'] == 'unknown') != (not row['tangut']) or (row['tangut'] and not tangut(row['tangut'])):
                raise SystemExit(f'form and kind disagree: {row}')
            era = next((e for e in eras if e['era'] == row['era'] and e['from'][:4] == row['from']), None)
            if not era:
                raise SystemExit(f'no such era in the calendar: {row}')
            if row['kind'] == 'post' and not row['tangut']:
                raise SystemExit(f'a post row needs a form: {row}')
            if row['kind'] == 'post' and row['tangut'] not in era['calendar'] and any(e['kind'] in ('coin', 'text') for e in era['evidence']):
                raise SystemExit(f'a post form would look backed by this era\'s coin or text: {row}')
            if row['kind'] != 'post' and row['tangut'] and row['tangut'] not in era['calendar']:
                raise SystemExit(f'the form differs from the calendar\'s, which the page would hide: {row}')
            if row['place'] and not re.search(f'{row["tangut"]}.{{0,2}}[{NUMERALS}]{{1,3}}𗤒', corpus_text(row['place'])):
                raise SystemExit(f'the form is not followed by a year in the text named: {row}')
            if len(era['calendar']) > 1 and row['kind'] in ('coin', 'text'):
                raise SystemExit(f'an era with two competing forms cannot carry this tag: {row}')
            era['evidence'].append({'tangut': row['tangut'], 'kind': row['kind'], 'source': row['source']})

    OUT.write_text(json.dumps(eras, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(eras)} eras, {sum(bool(e["calendar"]) for e in eras)} with a Tangut form in the calendar → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

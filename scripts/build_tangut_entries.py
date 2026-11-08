# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the character records the site may display, and the derived index it may only search.

Displayable fields come from sources the site can republish:

- the five reconstruction tables on English Wiktionary (CC BY-SA 4.0), and Gong Hwang-cherng's and
  Xun Gong's reconstructions from the Tangut Pronunciation Database (Limited Public Use, cited per
  character);
- the English definitions in Wiktionary's Tangut entries, through Kaikki's extract;
- the Japanese definitions on ja.wiktionary (CC BY-SA 4.0);
- the Chinese definitions in the pinned zhwiktionary snapshot (CC BY-SA 4.0);
- BabelStone's Tangut IDS (public domain);
- the 文海's Chinese entry text (12th century, public domain);
- Unicode's TangutSources radical and stroke data.

CCAMC's readings, glosses and 文海 text are not copied into the records. What the site keeps is a
derived index of normalized search terms, so a reader can still find a character by a reading or a
meaning CCAMC records; the card links to the CCAMC page instead of showing those values.

    uv run scripts/build_tangut_entries.py --ccamc /tmp/tangut-entries-open-tangut.json.gz

The ``--ccamc`` file must be a copy of the old Open Tangut/CCAMC records, made before this script
replaces ``app/data/tangut-entries.json.gz``. It is only read here; the index it produces holds
folded readings and lower-cased terms, not the records.

Keyed readings come from ``data/readings/readings.tsv`` unless ``--readings`` names another file; a
rebuild without them drops every keyed value, so the default is the table itself.

Writes ``app/data/tangut-entries.json.gz`` and ``app/data/tangut-ccamc-index.json.gz``.
The keyed readings' citations go to ``app/data/tangut-reading-sources.json.gz``.
"""
import argparse
import gzip
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENTRIES = ROOT / 'app/data/tangut-entries.json.gz'
INDEX = ROOT / 'app/data/tangut-ccamc-index.json.gz'
SOURCES = ROOT / 'app/data/tangut-reading-sources.json.gz'
FORMAT = 'tangut-input/entries/6'
SYSTEMS = ['li_fanwen', 'gong_huangcheng', 'gong_xun_202411', 'miyake', 'kychanov', 'sofronov',
           'nishida', 'sound_li_fanwen', 'sound_nie_lishan', 'arakawa_shintaro', 'tibetan']
READINGS = ROOT / 'data/readings/readings.tsv'
CCAMC_SYSTEMS = ['arakawa_shintaro']

LETTERS = {
    'ɨ': 'i', 'ɪ': 'i', 'ʉ': 'u', 'ɯ': 'u', 'ə': 'e', 'ɛ': 'e', 'ɔ': 'o', 'ɑ': 'a', 'æ': 'ae',
    'ŋ': 'ng', 'ɣ': 'gh', 'ʁ': 'r', 'ɲ': 'ny', 'ȵ': 'ny', 'ɱ': 'm', 'ʷ': 'w', 'ⁿ': 'n', 'ł': 'l',
    'ɡ': 'g', 'ʟ': 'l', 'ᴛ': 't', 'ɢ': 'g', 'ʙ': 'b', 'ᴄ': 'c', 'ʜ': 'h', 'ꜰ': 'f', 'ᴜ': 'u',
    'ʔ': '', 'ɦ': '',
}


def fold(value):
    """The reading as the site folds it: plain letters, then the tone digit."""
    text = value.strip().lower()
    tone = re.search(r'([0-9])\s*$', text)
    letters = ''.join(LETTERS.get(char, char) for char in unicodedata.normalize('NFD', text))
    letters = ''.join(char for char in letters if char.isascii() and char.isalpha())
    return letters + (tone.group(1) if tone else '')


def plain(value):
    """Searchable text: no case, no punctuation, one space between words."""
    text = unicodedata.normalize('NFKC', value).lower()
    text = re.sub(r'[\u3000\s]+', ' ', text)
    text = re.sub(r'[^\w]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def keyed(path):
    """The readings keyed from the books, per character: {char: {field: [[value, work, locator], ...]}}.

    Two witnesses to one value are both kept and joined at build time; a row still marked uncertain
    is held back until a second reading lifts it.
    """
    out = {}
    if not path or not path.exists():
        return out
    lines = path.read_text(encoding='utf-8').splitlines()
    head = lines[0].split('\t')
    for line in lines[1:]:
        if not line.strip():
            continue
        row = dict(zip(head, line.split('\t')))
        if row.get('status') == 'uncertain':
            continue
        out.setdefault(row['char'], {}).setdefault(row['field'], []).append(
            [row['value'], row['work'], row['locator'], row.get('note', '')])
    return out


def gz(path):
    return json.load(gzip.open(path))


def babelstone():
    ids = {}
    with gzip.open(ROOT / 'data/tangut-ids.tsv.gz', 'rt') as f:
        for line in f:
            if line.startswith('#'):
                continue
            parts = line.rstrip('\n').split('\t')
            if len(parts) >= 2:
                ids[parts[0]] = parts[1].split()[0].split('(')[0]
    return ids


def kaikki():
    found = {}
    for line in gzip.open(ROOT / 'data/tangut-glosses-en-source.jsonl.gz', 'rt'):
        entry = json.loads(line)
        word = entry.get('word')
        if not word:
            continue
        senses = []
        for sense in entry.get('senses') or []:
            for gloss in sense.get('glosses') or []:
                gloss = re.sub(r'<[^>]+>', '', gloss).strip()
                if gloss and gloss not in senses:
                    senses.append(gloss)
        if senses:
            found[word] = senses
    return found


def hidden(entries, systems, index):
    """The terms CCAMC records, folded or lower-cased for search, never for display."""
    readings = {}
    meanings = {'en': {}, 'zh': {}}
    for row in entries['rows']:
        char = row[0]
        values = row[7]
        for key in CCAMC_SYSTEMS:
            i = systems.index(key)
            value = values[i].strip() if i < len(values) else ''
            if value:
                token = fold(value)
                if token:
                    readings.setdefault(key, {})[char] = token
        for language, column in (('en', 4), ('zh', 6)):
            terms = [plain(value) for value in (row[column] or []) if plain(value)]
            if terms:
                meanings[language][char] = terms
    index.update({
        'format': 'tangut-input/ccamc-index',
        'note': 'Normalized search terms derived from CCAMC records. Not for display or redistribution.',
        'readings': readings,
        'meanings': meanings,
    })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ccamc', type=Path, help='a copy of the old Open Tangut/CCAMC records')
    parser.add_argument('--readings', type=Path, default=READINGS,
                        help='keyed readings (default data/readings/readings.tsv)')
    args = parser.parse_args()
    if args.readings and not args.readings.exists():
        raise SystemExit(f"{args.readings}: no such readings file, so no keyed value would be built")

    old = gz(ENTRIES)
    systems = old['systems']
    rows = old['rows']
    ids = babelstone()
    en = kaikki()
    ja = gz(ROOT / 'data/wiktionary/definitions-ja.json.gz')['pages']
    zh = gz(ROOT / 'data/wiktionary/definitions-zh.json.gz')['pages']
    readings = gz(ROOT / 'data/wiktionary/txg-readings.json.gz')['systems']
    gong_hwang = gz(ROOT / 'data/gong-xun/ghc.json.gz')['readings']
    gong_xun = gz(ROOT / 'data/gong-xun/gx202411.json.gz')['readings']
    wenhai = gz(ROOT / 'data/wenhai/entry-text.json.gz')['entries']
    keyed_readings = keyed(args.readings)
    citations = {}

    out = []
    for row in rows:
        char, composition, strokes, radical = row[0], row[1], row[2], row[3]
        definitions_en = en.get(char, [])
        definitions_ja = ja.get(char, {}).get('definitions') or []
        keyed_fields = keyed_readings.get(char, {})
        definitions_zh = [value[0] for value in keyed_fields.get('gloss_zh', [])]
        wiktionary_page = zh.get(char, {})
        wiktionary_zh = wiktionary_page.get('definitions') or []
        pron = [
            readings['li_fanwen'].get(char, ''),
            '；'.join(value[0] for value in keyed_fields.get('gong_huangcheng', []))
            or gong_hwang.get(char, ''),
            gong_xun.get(char, ''),
            readings['miyake'].get(char, ''),
            readings['kychanov'].get(char, ''),
            readings['sofronov'].get(char, ''),
            readings['nishida'].get(char, ''),
            *('；'.join(dict.fromkeys(value[0] for value in keyed_fields.get(key, [])))
              for key in SYSTEMS[7:]),
        ]
        if keyed_fields:
            citations[char] = {
                key: [{'work': value[1], 'locator': value[2], 'note': value[3]} for value in values]
                for key, values in keyed_fields.items()
            }
        text = wenhai.get(char, {})
        text = {'en': text.get('en', ''),
                'zh': keyed_fields['wenhai_zh'][0][0] if 'wenhai_zh' in keyed_fields else text.get('zh', '')}
        out.append([
            char,
            ids.get(char) or composition,
            strokes,
            radical,
            definitions_en,
            definitions_ja,
            definitions_zh,
            pron,
            text.get('zh', ''),
            wiktionary_zh,
            wiktionary_page.get('url') or '',
        ])

    data = {'format': FORMAT, 'systems': SYSTEMS, 'rows': out}
    with gzip.GzipFile(ENTRIES, 'wb', mtime=0) as f:
        f.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{len(out)} characters -> {ENTRIES.relative_to(ROOT)}')

    with gzip.GzipFile(SOURCES, 'wb', mtime=0) as f:
        f.write(json.dumps({'format': 'tangut-input/reading-sources', 'citations': citations},
                           ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{len(citations)} characters with a keyed citation -> {SOURCES.relative_to(ROOT)}')

    if args.ccamc:
        index = {}
        old_ccamc = gz(args.ccamc)
        hidden(old_ccamc, old_ccamc['systems'], index)
        with gzip.GzipFile(INDEX, 'wb', mtime=0) as f:
            f.write(json.dumps(index, ensure_ascii=False, separators=(',', ':')).encode())
        print(f'search terms -> {INDEX.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

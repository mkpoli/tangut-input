# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Extract attributed Chinese Wiktionary glosses without expanding templates.

    uv run scripts/extract_tangut_chinese.py --dump /path/to/zhwiktionary-20261101-pages-articles.xml.bz2

The dated dump is pinned to Wikimedia's SHA1. The snapshot retains the original
wikitext and rejected senses. Wiktionary's stated licence does not establish
independence from CCAMC: txg-ref can link there.
"""
import argparse
import bz2
import collections
import gzip
import hashlib
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/wiktionary/definitions-zh.json.gz'
DUMP_DATE = '20261101'
FILENAME = f'zhwiktionary-{DUMP_DATE}-pages-articles.xml.bz2'
DUMP_URL = f'https://dumps.wikimedia.org/zhwiktionary/{DUMP_DATE}/{FILENAME}'
SHA1 = 'bd139bae2c7c9f5fad6d6a347d07296bf9bcabdc'
CHECKSUM_URL = f'https://dumps.wikimedia.org/zhwiktionary/{DUMP_DATE}/zhwiktionary-{DUMP_DATE}-sha1sums.txt'
TOP_SENSE = re.compile(r'^#(?![#:*;])')
DEFINITION_HEADINGS = {'釋義', '释义', '名詞', '名词', '動詞', '动词', '形容詞', '形容词', '副詞', '副词', '代詞', '代词', '數詞', '数词', '助詞', '助词', '介詞', '介词', '專有名詞', '专有名词', '連詞', '连词', '量詞', '量词', '嘆詞', '叹词', '音節', '音节'}
LINK = re.compile(r'\[\[([^\[\]\n|]+)(?:\|([^\[\]\n|]+))?\]\]')
BAD_SENSES = {
    ('𘆽', '# [[龍]]'): 'Source inconsistency: the same page categorizes this character as 馬; 龍 needs independent verification.',
    ('𗗻', '# [[壬]]，[[地支]]的第十一位'): 'Source error: 壬 is a heavenly stem, not the eleventh earthly branch.',
    ('𗵊', '# [[丑]]，[[地支]]的第五位'): 'Source error: 丑 is the second earthly branch, not the fifth.',
}


def is_tangut(title):
    return len(title) == 1 and (0x17000 <= ord(title) <= 0x18AFF or 0x18D00 <= ord(title) <= 0x18D7F)


def definition_lines(text):
    """Read only top-level senses in a 西夏語/西夏语 language section."""
    active = False
    in_definitions = False
    found = []
    for line in text.splitlines():
        heading = re.fullmatch(r'(={2,})([^=\n]+)\1\s*', line)
        if heading:
            if len(heading[1]) == 2:
                active = heading[2].strip() in ('西夏語', '西夏语')
                in_definitions = False
            else:
                in_definitions = heading[2].strip() in DEFINITION_HEADINGS
        elif active and in_definitions and TOP_SENSE.match(line):
            found.append(line)
    return found


def clean_definition(char, raw):
    """Return lossless display text, or a reason for retaining only the raw line."""
    bad = BAD_SENSES.get((char, raw.strip()))
    if bad:
        return None, bad
    if '{{rfdef' in raw:
        return None, 'Definition requested; no gloss supplied.'
    if any(mark in raw for mark in '{}<>'):
        return None, 'Unresolved template or HTML markup.'
    if "''" in raw:
        return None, 'Unresolved formatting markup.'
    text = LINK.sub(lambda match: match[2] if match[2] is not None else match[1].split('#', 1)[0], raw[1:].strip())
    if any(mark in text for mark in '[]|'):
        return None, 'Unresolved link markup.'
    text = text.strip()
    if not text:
        return None, 'Empty definition.'
    return text, None


def scan_dump(path):
    digest = hashlib.sha1()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != SHA1:
        raise ValueError(f'Dump SHA1 mismatch: expected {SHA1}, got {digest.hexdigest()}')
    pages = []
    counts = collections.Counter()
    with bz2.open(path, 'rb') as file:
        root = None
        for event, element in ET.iterparse(file, events=('start', 'end')):
            if root is None:
                root = element
            if event != 'end' or not element.tag.endswith('}page'):
                continue
            ns = element.tag.split('}')[0] + '}'
            title = element.findtext(ns + 'title') or ''
            if is_tangut(title) and element.findtext(ns + 'ns') == '0':
                counts['single_tangut_pages'] += 1
                text = element.findtext(f'{ns}revision/{ns}text') or ''
                lines = definition_lines(text)
                if lines:
                    pages.append({
                        'char': title,
                        'rev': element.findtext(f'{ns}revision/{ns}id'),
                        'timestamp': element.findtext(f'{ns}revision/{ns}timestamp'),
                        'contributor': element.findtext(f'{ns}revision/{ns}contributor/{ns}username'),
                        'text': text,
                    })
            element.clear()
            root.clear()
    return {'counts': dict(counts), 'pages': pages}


def build(audit, retrieved):
    pages = {}
    for page in sorted(audit['pages'], key=lambda page: page['char']):
        char = page['char']
        if not is_tangut(char):
            continue
        lines = definition_lines(page['text'])
        if not lines:
            continue
        definitions, rejected = [], []
        for raw in lines:
            value, reason = clean_definition(char, raw)
            if reason:
                rejected.append({'raw': raw, 'reason': reason})
            elif value not in definitions:
                definitions.append(value)
        revision = int(page['rev'])
        title = urllib.parse.quote(char, safe='')
        pages[char] = {
            'revision': revision,
            'timestamp': page['timestamp'],
            'contributor': page.get('contributor'),
            'url': f'https://zh.wiktionary.org/w/index.php?title={title}&oldid={revision}',
            'historyUrl': f'https://zh.wiktionary.org/w/index.php?title={title}&action=history',
            'wikitext': page['text'],
            'rawDefinitions': lines,
            'definitions': definitions,
            'rejected': rejected,
        }
    stats = {
        'singleTangutPages': audit.get('counts', {}).get('single_tangut_pages'),
        'pagesWithDefinitionLines': len(pages),
        'acceptedPages': sum(bool(page['definitions']) for page in pages.values()),
        'acceptedDefinitions': sum(len(page['definitions']) for page in pages.values()),
        'rejectedDefinitions': sum(len(page['rejected']) for page in pages.values()),
    }
    return {
        'format': 'tangut-input/wiktionary-zh/1',
        'retrieved': retrieved,
        'source': {
            'name': 'Chinese Wiktionary contributors',
            'url': 'https://zh.wiktionary.org/',
            'licence': 'CC BY-SA 4.0',
            'licenceUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
            'copyrightUrl': 'https://zh.wiktionary.org/w/index.php?title=Wiktionary:%E7%89%88%E6%9D%83%E4%BF%A1%E6%81%AF&oldid=8368252',
        },
        'dump': {'date': '2026-11-01', 'filename': FILENAME, 'url': DUMP_URL, 'sha1': SHA1, 'checksumUrl': CHECKSUM_URL},
        'note': 'Glosses are attested on the cited Wiktionary revisions, unchecked against the primary dictionaries. Some source templates link to CCAMC; independence from CCAMC is unverified. Only plain text and losslessly unwrapped wikilinks are accepted; unresolved markup and identified source errors remain in rejected.',
        'stats': stats,
        'pages': pages,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dump', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=OUT)
    parser.add_argument('--retrieved', default=date.today().isoformat())
    args = parser.parse_args()
    audit = scan_dump(args.dump)
    data = build(audit, args.retrieved)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(args.output, 'wb', mtime=0) as file:
        file.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())
    print(json.dumps(data['stats'], ensure_ascii=False))
    print(args.output)


if __name__ == '__main__':
    main()

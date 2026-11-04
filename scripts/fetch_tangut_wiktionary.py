# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Snapshot the Wiktionary data the site is allowed to republish.

The five reconstruction tables are Lua modules under ``Module:txg/data/``; fetching the module
instead of 6,144 pages gives the same values with one request each. The Japanese definitions come
from the ja.wiktionary pages themselves, in batches of 50 titles. Chinese Wiktionary has almost no
Tangut entries, so the site links to CCAMC for meanings in Chinese rather than copying them.

    uv run scripts/fetch_tangut_wiktionary.py

Writes ``data/wiktionary/txg-readings.json.gz`` and ``data/wiktionary/definitions-ja.json.gz``.
"""
import gzip
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/wiktionary'
UA = 'tangut-input/1.0 (https://tangut.mkpo.li; mkpoli@mkpo.li)'
API = 'https://{host}/w/api.php'
RETRIEVED = '2026-11-04'

MODULES = {
    'li_fanwen': 'LFW2008',
    'miyake': 'Miyake',
    'kychanov': 'Kychanov2006',
    'sofronov': 'Sofronov1968',
    'nishida': 'Nishida1966',
}
SUPERSCRIPTS = str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹', '0123456789')
SUBSCRIPTS = str.maketrans('₀₁₂₃₄₅₆₇₈₉', '0123456789')


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read())


def module(title):
    """The module's text and revision id."""
    query = urllib.parse.urlencode({
        'action': 'query', 'prop': 'revisions', 'rvslots': 'main', 'rvprop': 'content|ids',
        'format': 'json', 'formatversion': '2', 'maxlag': '5', 'titles': f'Module:txg/data/{title}',
    })
    page = fetch(API.format(host='en.wiktionary.org') + '?' + query)['query']['pages'][0]
    revision = page['revisions'][0]
    return revision['slots']['main']['content'], revision['revid']


def pairs(text):
    return dict(re.findall(r'\["([^"]+)"\]\s*=\s*"([^"]*)"', text))


def normalize(value, system):
    """A reading the site's folding can use: the tone mark becomes a trailing digit."""
    value = value.strip()
    if system == 'miyake':
        # Miyake writes the tone before the syllable as a superscript and repeats it as a subscript.
        head = re.match(r'^([⁰¹²³⁴⁵⁶⁷⁸⁹])(.*)$', value)
        tone = head.group(1).translate(SUPERSCRIPTS) if head else ''
        value = head.group(2) if head else value
        tail = re.search(r'([₀₁₂₃₄₅₆₇₈₉])$', value)
        if tail:
            tone = tail.group(1).translate(SUBSCRIPTS)
            value = value[:tail.start()]
        value = value.replace('·', '').strip()
        return value + tone
    value = value.translate(SUPERSCRIPTS).translate(SUBSCRIPTS)
    return value.replace('·', '').strip()


def readings():
    systems = {}
    revisions = {}
    for key, title in MODULES.items():
        text, revision = module(title)
        revisions[key] = revision
        systems[key] = {char: normalize(value, key) for char, value in pairs(text).items() if value.strip()}
        print(f'{key}: {len(systems[key])} readings (revision {revision})')
        time.sleep(0.5)
    data = {
        'retrieved': RETRIEVED,
        'source': {
            'name': 'English Wiktionary, Module:txg/data',
            'url': 'https://en.wiktionary.org/wiki/Module:txg/data',
            'licence': 'CC BY-SA 4.0',
            'licenceUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
        'revisions': revisions,
        'systems': systems,
    }
    path = OUT / 'txg-readings.json.gz'
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(path, 'wb', mtime=0) as out:
        out.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{path.relative_to(ROOT)}')


def clean(line):
    line = re.sub(r'<!--.*?-->', '', line)
    line = re.sub(r'\{\{ふりがな\|([^|{}]+)\|([^|{}]+)(?:\|[^}]*)?\}\}', r'\1（\2）', line)
    line = re.sub(r'<ref[^>]*>.*?</ref>', '', line, flags=re.S)
    line = re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]', r'\2', line)
    line = re.sub(r'\[\[([^\]]+)\]\]', r'\1', line)
    line = re.sub(r'\{\{[^{}]*\}\}', '', line)
    line = re.sub(r"'{2,}", '', line)
    line = re.sub(r'^\s*#+\s*', '', line)
    return re.sub(r'\s+', ' ', line).strip(' 。;；,，')


def definitions(text):
    found = []
    for line in text.splitlines():
        if not line.startswith('#'):
            continue
        if line.startswith(('##', '#*', '#:', '#;')):
            continue
        value = clean(line)
        if value and value not in found:
            found.append(value)
    return found


def japanese(chars):
    """The ja.wiktionary definitions for the characters the current records gloss in Japanese."""
    pages = {}
    for start in range(0, len(chars), 50):
        batch = chars[start:start + 50]
        query = urllib.parse.urlencode({
            'action': 'query', 'prop': 'revisions', 'rvslots': 'main', 'rvprop': 'content|ids',
            'format': 'json', 'formatversion': '2', 'maxlag': '5', 'titles': '|'.join(batch),
        })
        result = fetch(API.format(host='ja.wiktionary.org') + '?' + query)
        for page in result['query']['pages']:
            if 'missing' in page:
                continue
            revision = page['revisions'][0]
            values = definitions(revision['slots']['main']['content'])
            if values:
                pages[page['title']] = {'revision': revision['revid'], 'definitions': values}
        print(f'ja: {min(start + 50, len(chars))}/{len(chars)}', file=sys.stderr)
        time.sleep(0.5)
    data = {
        'retrieved': RETRIEVED,
        'source': {
            'name': 'Japanese Wiktionary',
            'url': 'https://ja.wiktionary.org/wiki/',
            'licence': 'CC BY-SA 4.0',
            'licenceUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
        'pages': pages,
    }
    path = OUT / 'definitions-ja.json.gz'
    with gzip.GzipFile(path, 'wb', mtime=0) as out:
        out.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{path.relative_to(ROOT)} ({len(pages)} pages)')


def main():
    readings()
    entries = json.load(gzip.open(ROOT / 'app/data/tangut-entries.json.gz'))['rows']
    chars = [row[0] for row in entries if row[5]]
    japanese(chars)


if __name__ == '__main__':
    main()

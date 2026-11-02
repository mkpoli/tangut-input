#!/usr/bin/env python3
"""Fetch the Wikisource category of Tangut Buddhist texts into `data/wikisource/pages.json`.

The snapshot pins each page's revision and timestamp, so a transcription can be rebuilt after the
wiki changes. `scripts/build_tangut_attestation.py` reads this file and never the network.

    python3 scripts/fetch_tangut_wikisource.py [--category "Category:Buddhist texts in Tangut"]

The text is CC BY-SA 4.0; see `data/wikisource/README.md`.
"""
import argparse
import json
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/wikisource/pages.json'
SITE = 'https://wikisource.org'
API = f'{SITE}/w/api.php'
USER_AGENT = 'tangut-input/0.1 (https://tangut.mkpo.li; corpus snapshot)'
DEFAULT_CATEGORY = 'Category:Buddhist texts in Tangut'


def api(params):
    query = {**params, 'format': 'json', 'formatversion': '2'}
    request = urllib.request.Request(f'{API}?{urllib.parse.urlencode(query)}', headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def category_members(category):
    members = []
    cont = {}
    while True:
        result = api({'action': 'query', 'list': 'categorymembers', 'cmtitle': category,
                      'cmlimit': '500', **cont})['query']
        members.extend(member['title'] for member in result['categorymembers'])
        if 'continue' not in result:
            return members
        cont = result['continue']


def revisions(titles):
    pages = {}
    for start in range(0, len(titles), 10):
        batch = titles[start:start + 10]
        result = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'ids|timestamp|user|content',
                      'rvslots': 'main', 'titles': '|'.join(batch), 'redirects': '1'})['query']
        for page in result['pages']:
            revision = page.get('revisions', [{}])[0]
            pages[page['title']] = {
                'pageid': page['pageid'],
                'ns': page['ns'],
                'revision': revision.get('revid'),
                'timestamp': revision.get('timestamp'),
                'user': revision.get('user'),
                'content': revision.get('slots', {}).get('main', {}).get('content', ''),
            }
    return pages


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--category', default=DEFAULT_CATEGORY)
    args = parser.parse_args()

    titles = category_members(args.category)
    pages = revisions(titles)
    missing = [title for title in titles if title not in pages]
    if missing:
        raise SystemExit(f'not returned by the API: {missing}')

    document = {
        'site': SITE,
        'category': args.category,
        'categoryUrl': f'{SITE}/wiki/{urllib.parse.quote(args.category.replace(" ", "_"))}',
        'retrieved': date.today().isoformat(),
        'titles': titles,
        'pages': pages,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(document, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(pages)} pages, {OUT.stat().st_size} bytes -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

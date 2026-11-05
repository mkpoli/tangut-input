# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the English glosses Alan Downes compiled, as C27Ezx/TangutTranslator publishes them.

The repository credits its 6,000 entries to Downes's site, tangut.info. Only the character and its
meaning are kept. The site's own reconstructions, parts of speech and phonetic classes are left out:
the site has its own reconstructions, and the codes are not explained.

    uv run scripts/build_tangut_downes.py
"""
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMIT = 'a2695dae20af20fc1d2b0c38295eb8b9a743d2eb'
SHA256 = '56dd6ebf489c3fae1563ed2e0a856088c231a464a7fac354edbb7d150819604e'
URL = f'https://raw.githubusercontent.com/C27Ezx/TangutTranslator/{COMMIT}/tangut_learning_data.json'
OUT = ROOT / 'app/data/tangut-downes.json'


def main():
    raw = urllib.request.urlopen(URL, timeout=60).read()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SHA256:
        raise SystemExit(f'{URL}: expected {SHA256}, got {digest}')
    glosses = {}
    for entry in json.loads(raw):
        meaning = entry['Meaning'].strip()
        if not meaning or meaning == '?':
            continue
        known = glosses.setdefault(entry['Character'], [])
        if meaning not in known:
            known.append(meaning)
    record = {
        'format': 'tangut-input/downes',
        'source': 'Alan Downes, tangut.info',
        'via': f'https://github.com/C27Ezx/TangutTranslator/blob/{COMMIT}/tangut_learning_data.json',
        'licence': 'MIT, as the repository states it',
        'note': 'The site itself returned HTTP 521 when tried on 2026-11-05, so these glosses were read '
                'only through the repository. Of 441 characters that also have a Wiktionary gloss, 373 '
                'share a word with it; some of the others are synonyms and some disagree.',
        'glosses': {char: '; '.join(senses) for char, senses in sorted(glosses.items())},
    }
    OUT.write_text(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(glosses)} characters -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


if __name__ == '__main__':
    main()

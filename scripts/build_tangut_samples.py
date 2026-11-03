# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build `app/data/tangut-samples.json` from the attestation corpus.

Each sample is one or more attesting lines, copied exactly from
`app/data/tangut-attestation.json.gz`. The list favours short, self-contained passages and marks
the well-known sutras and dhāraṇī. Change `SAMPLES` to add another piece; a missing source or line
stops the build.
"""
import gzip
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / 'app/data/tangut-attestation.json.gz'
OUT = ROOT / 'app/data/tangut-samples.json'

# The order is the order in the picker: the famous passages first, then the rest.
SAMPLES = [
    {'id': 'diamond-opening', 'source': 'wikisource-diamond', 'lines': ['wikisource-diamond:1.1'], 'label': '1.1', 'famous': True},
    {'id': 'diamond-marks', 'source': 'wikisource-diamond', 'lines': ['wikisource-diamond:5.3'], 'label': '5.3', 'famous': True},
    {'id': 'diamond-closing', 'source': 'wikisource-diamond', 'lines': ['wikisource-diamond:32.2', 'wikisource-diamond:32.3'], 'label': '32.2–32.3', 'famous': True},
    {'id': 'dharani-opening', 'source': 'wikisource-dharani', 'lines': ['wikisource-dharani:line-1', 'wikisource-dharani:line-2'], 'label': 'lines 1–2', 'famous': True},
    {'id': 'high-king-sutra', 'source': 'wikisource-high-king', 'lines': ['wikisource-high-king:line-3'], 'label': 'line 3', 'famous': True},
    {'id': 'grains-of-gold', 'source': 'wikisource-grains-of-gold', 'lines': ['wikisource-grains-of-gold:line-2'], 'label': 'line 2', 'famous': True},
    {'id': 'monthly-pleasures', 'source': 'wikisource-monthly-pleasures', 'lines': ['wikisource-monthly-pleasures:line-6'], 'label': '1st month', 'famous': True},
    {'id': 'liangzhou-stele', 'source': 'wikisource-liangzhou-stele', 'lines': ['wikisource-liangzhou-stele:line-1'], 'label': 'line 1', 'famous': True},
    {'id': 'hymn-origin', 'source': 'wikisource-hymn-origin', 'lines': ['wikisource-hymn-origin:line-2'], 'label': 'verse 1', 'famous': True},
    {'id': 'twenty-five-questions', 'source': 'wikisource-twenty-five-questions', 'lines': ['wikisource-twenty-five-questions:q1'], 'label': 'Question 1', 'famous': False},
    {'id': 'dragon-king', 'source': 'wikisource-dragon-king', 'lines': ['wikisource-dragon-king:line-1'], 'label': 'line 1', 'famous': False},
    {'id': 'bodhicaryavatara', 'source': 'solonin-2024', 'lines': ['solonin-2024:2.1.1'], 'label': '2.1.1', 'famous': False},
    {'id': 'dual-maxims', 'source': 'wikisource-dual-maxims', 'lines': ['wikisource-dual-maxims:line-3', 'wikisource-dual-maxims:line-4'], 'label': 'proverb 1', 'famous': False},
]


def main():
    corpus = json.load(gzip.open(CORPUS, 'rt'))
    sources = {source['id']: source for source in corpus['sources']}
    samples = []
    seen = set()
    for spec in SAMPLES:
        if spec['id'] in seen:
            raise SystemExit(f'duplicate sample id: {spec["id"]}')
        seen.add(spec['id'])
        source = sources.get(spec['source'])
        if source is None:
            raise SystemExit(f'{spec["id"]}: unknown source {spec["source"]}')
        texts = []
        for line_id in spec['lines']:
            line = corpus['lines'].get(line_id)
            if line is None:
                raise SystemExit(f'{spec["id"]}: unknown line {line_id}')
            texts.append(line['text'])
        samples.append({
            'id': spec['id'],
            'sourceId': source['id'],
            'sourceTitle': source.get('shortTitle') or source['title'],
            'sourceUrl': source['url'],
            'licence': source['licence'],
            'label': spec['label'],
            'famous': spec['famous'],
            'lineIds': spec['lines'],
            'text': '\n'.join(texts),
        })

    document = {'built': date.today().isoformat(), 'samples': samples}
    OUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    total = sum(1 for sample in samples for char in sample['text'] if 0x17000 <= ord(char) <= 0x18dff)
    print(f'{len(samples)} samples, {total} Tangut characters -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

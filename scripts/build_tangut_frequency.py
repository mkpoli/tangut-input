# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Count how often each Tangut character occurs in the attested corpus.

The count is the number of places in `app/data/tangut-attestation.json.gz`. A character repeated in
a duplicated text counts each time; the file names the corpus hash so the counts can be rebuilt.
The site reads `app/data/tangut-frequency.json.gz` to rank finder candidates.
"""
import gzip
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / 'app/data/tangut-attestation.json.gz'
OUT = ROOT / 'app/data/tangut-frequency.json.gz'


def main():
    corpus = json.load(gzip.open(CORPUS, 'rt'))
    counts = {
        char: sum(len(places) for places in by_source.values())
        for char, by_source in corpus['rows'].items()
    }
    counts = dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))
    document = {
        'built': date.today().isoformat(),
        'corpus': {
            'lines': corpus['corpus']['lines'],
            'characters': corpus['corpus']['characters'],
            'distinct': corpus['corpus']['distinct'],
            'sha256': corpus['corpus']['sha256'],
        },
        'counts': counts,
    }
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(raw)
    print(f'{len(counts)} characters, {sum(counts.values())} places, '
          f'{len(raw)} bytes raw, {OUT.stat().st_size} gzipped -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()

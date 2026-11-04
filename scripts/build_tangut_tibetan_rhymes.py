# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the Tibetan spellings the rhyme chart shows at each crossing of rhyme and initial class.

`data/tangut-tibetan-rhymes.tsv` holds 李範文's table (宋代西北方音, 1994, pp. 270-281) as reposted by
KwingiemChan at https://zhuanlan.zhihu.com/p/272058247, keyed by tone and the rhyme's number within
that tone. `data/tangut-rhyme-numbers.tsv` turns those numbers into the 105 rhymes the chart uses. It
follows table 1-3-1 of 郭抒遠 2019, as scanned at https://zhuanlan.zhihu.com/p/271919711. The rhyme
headings scanned at the first address agree, except that rhyme 58's also claims 2.48, which table
1-3-1 and rhyme 57's heading give to rhyme 57.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ']


def read(name):
    with open(ROOT / 'data' / name, newline='', encoding='utf-8') as file:
        return list(csv.DictReader(file, delimiter='\t'))


def main():
    rhyme_of = {}
    for row in read('tangut-rhyme-numbers.tsv'):
        for tone, column in (('1', 'level'), ('2', 'rising')):
            for number in filter(None, row[column].split(',')):
                rhyme_of[(tone, number)] = int(row['rhyme'])

    cells = {}
    for row in read('tangut-tibetan-rhymes.tsv'):
        key = f"{rhyme_of[(row['tone'], row['rhyme_in_tone'])]}·{row['tone']}"
        spellings = cells.setdefault(key, {}).setdefault(ROMAN[int(row['initial_class']) - 1], [])
        if row['tibetan'] not in spellings:
            spellings.append(row['tibetan'])

    record = {
        'format': 'tangut-input/tibetan-rhymes',
        'source': '李範文, 宋代西北方音, 1994, pp. 270-281',
        'via': 'https://zhuanlan.zhihu.com/p/272058247',
        'note': 'Read from a repost by KwingiemChan and not checked against the book. '
                'Of the 305 spellings that a character in other scanned tables also has, 12 stand in another class.',
        'cells': dict(sorted(cells.items(), key=lambda item: [int(part) for part in item[0].split('·')])),
    }
    out = ROOT / 'app/data/tangut-tibetan-rhymes.json'
    out.write_text(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(cells)} rhymes -> {out.relative_to(ROOT)} ({out.stat().st_size} bytes)')


if __name__ == '__main__':
    main()

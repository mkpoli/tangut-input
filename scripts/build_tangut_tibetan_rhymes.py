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
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ']


WYLIE_ROOT={'ཀ':'k','ཁ':'kh','ག':'g','ང':'ng','ཅ':'c','ཆ':'ch','ཇ':'j','ཉ':'ny','ཏ':'t','ཐ':'th','ད':'d','ན':'n','པ':'p','ཕ':'ph','བ':'b','མ':'m','ཙ':'ts','ཚ':'tsh','ཛ':'dz','ཝ':'w','ཞ':'zh','ཟ':'z','འ':"'",'ཡ':'y','ར':'r','ལ':'l','ཤ':'sh','ས':'s','ཧ':'h','ཨ':''}
WYLIE_SUB={'ྐ':'k','ྑ':'kh','ྒ':'g','ྔ':'ng','ྕ':'c','ྖ':'ch','ྗ':'j','ྙ':'ny','ྟ':'t','ྠ':'th','ྡ':'d','ྣ':'n','ྤ':'p','ྥ':'ph','ྦ':'b','ྨ':'m','ྩ':'ts','ྪ':'tsh','ྫ':'dz','ྭ':'w','ྱ':'y','ྲ':'r','ླ':'l','ྴ':'sh','ྶ':'s','ྷ':'h','ྯ':'z'}
WYLIE_VOWEL={'ི':'i','ུ':'u','ེ':'e','ོ':'o'}
def to_wylie(script):
    """Wylie for one Tibetan spelling, in the form BabelStone's index uses."""
    s=unicodedata.normalize('NFD',script)
    letters=list(s);n=len(letters);i=0;groups=[]
    while i<n:
        c=letters[i]
        if c not in WYLIE_ROOT: return None
        g={'root':c,'sub':[],'vow':'','long':False};i+=1
        while i<n and letters[i] in WYLIE_SUB: g['sub'].append(letters[i]);i+=1
        while i<n and (letters[i] in WYLIE_VOWEL or letters[i]=='ཱ'):
            if letters[i]=='ཱ': g['long']=True
            else: g['vow']+=WYLIE_VOWEL[letters[i]]
            i+=1
        groups.append(g)
    # the vowel-bearing group is the syllable's root; letters after it close the syllable
    vi=next((k for k,g in enumerate(groups) if g['vow'] or g['long'] or g['sub']),None)
    if vi is None: vi=len(groups)-1 if len(groups)==1 else (1 if len(groups)>1 and groups[0]['root'] in 'གདབམའ' else 0)
    res=''
    for k,g in enumerate(groups):
        r=WYLIE_ROOT[g['root']];sub=''
        for x in g['sub']:
            v=WYLIE_SUB[x]
            # h on a letter that would read as an aspirate keeps a plus: k+ha, kh+ha
            if v=='h' and g['root'] in 'ཀཁཙ': sub+='+h'
            else: sub+=v
        if k==vi and k>0 and groups[k-1]['root'] in 'གདབམའ' and not groups[k-1]['sub'] and not groups[k-1]['vow'] and (r in('y','w','r','l') or (r=='h')) and groups[k-1]['root']!='འ' and not g['sub']:
            res+='.'
        elif k==vi and k>0 and groups[k-1]['root']=='བ' and r in('l','r') and g['sub']:
            res+='.' if r=='l' else ''
        res+=r+sub
        if k==vi:
            v=g['vow'] or 'a'
            if g['long']: v=v.upper() if v in 'aiu' else v+v
            res+=v
    return res


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
        # A few table cells set two spellings apart with a space.
        for script in row['tibetan'].split():
            entry = [script, to_wylie(script)]
            if entry not in spellings:
                spellings.append(entry)

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

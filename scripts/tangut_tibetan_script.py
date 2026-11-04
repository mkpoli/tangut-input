# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Turn the transliteration in `app/data/tangut-tibetan-hands.json` into Tibetan script.

The tables write a prefix with a hyphen (`g-yi`), འ as `v`, and k+h as `k.ha`. Checked against the
script of the same spellings in BabelStone's index (268 of 268) and in 李範文's table (253 of 253).
Run it to fill in the script after the transliteration changes:

    uv run scripts/tangut_tibetan_script.py
"""
import json
from pathlib import Path

import re
ROOT={'k':'ཀ','kh':'ཁ','g':'ག','ng':'ང','c':'ཅ','ch':'ཆ','j':'ཇ','ny':'ཉ','t':'ཏ','th':'ཐ','d':'ད','n':'ན','p':'པ','ph':'ཕ','b':'བ','m':'མ','ts':'ཙ','tsh':'ཚ','dz':'ཛ','w':'ཝ','zh':'ཞ','z':'ཟ','v':'འ','y':'ཡ','r':'ར','l':'ལ','sh':'ཤ','s':'ས','h':'ཧ'}
SUB={'k':'ྐ','kh':'ྑ','g':'ྒ','ng':'ྔ','c':'ྕ','ch':'ྖ','j':'ྗ','ny':'ྙ','t':'ྟ','th':'ྠ','d':'ྡ','n':'ྣ','p':'ྤ','ph':'ྥ','b':'ྦ','m':'ྨ','ts':'ྩ','tsh':'ྪ','dz':'ྫ','w':'ྭ','zh':'ྮ','z':'ྯ','y':'ྱ','r':'ྲ','l':'ླ','sh':'ྴ','s':'ྶ','h':'ྷ'}
VOW={'a':'','e':'ེ','i':'ི','o':'ོ','u':'ུ'}
CONS=sorted(ROOT,key=len,reverse=True)
def cons(s):
    out=[]
    while s:
        if s[0]=='?': out.append('?');s=s[1:];continue
        for c in CONS:
            if s.startswith(c): out.append(c);s=s[len(c):];break
        else: return None
    return out
def stack(seq):
    """A consonant run: unstacked prefix letters, then one stacked head."""
    if not seq: return ''
    out=''
    # a prefix stands apart before a root it cannot stack on
    while len(seq)>1 and seq[0] in('g','d','b','m','v') and (seq[1] not in('y','r','l','w','h','+h','?') or (seq[1] in('r','l','s') and len(seq)>2 and seq[2] not in('y','r','l','w','h','+h'))):
        out+=ROOT[seq[0]];seq=seq[1:]
    if seq[0]=='?': head='?'
    else: head=ROOT[seq[0]]
    return out+head+''.join('?' if c=='?' else SUB['h' if c=='+h' else c] for c in seq[1:])
def syll(s):
    """One syllable of the transliteration, or None when it does not parse."""
    # A dot keeps k+h from reading as kh, and otherwise marks a prefix, as a hyphen does.
    s=re.sub(r'^((?:[gdbmv?]-)?)([kgdbpt])[.+]h',lambda m:m[1]+m[2]+'\x00',s).replace('.','-')
    if '-' in s:
        pre,s=s.split('-',1)
        p=''.join(ROOT.get(x,'?') for x in pre) if pre!='?' else '?'
        rest=syll(s)
        return None if rest is None else p+rest
    m=re.match(r'^([^aeiou]*)([aeiou]+)?(.*)$',s)
    c,v,suf=m[1],m[2] or '',m[3]
    seq=[]
    for i,piece in enumerate(c.split('\x00')):
        got=cons(piece)
        if got is None: return None
        if i: seq.append('+h')
        seq+=got
    if seq is None: return None
    body=stack(seq) if seq else 'ཨ'
    vs=''
    for i,x in enumerate(v):
        if i and x==v[i-1]: vs+='ཱ' if False else VOW[x]
        else: vs+=VOW[x]
    sf=cons(suf)
    if sf is None: return None
    return body+vs+''.join('?' if x=='?' else ROOT[x] for x in sf)
def to_tibetan(s):
    parts=[syll(x) for x in s.split()]
    return None if any(p is None for p in parts) else '་'.join(parts)


def main():
    path = Path(__file__).resolve().parents[1] / 'app/data/tangut-tibetan-hands.json'
    record = json.loads(path.read_text(encoding='utf-8'))
    for entry in record['chars'].values():
        entry['tibetan'] = [[hand, latin, count, to_tibetan(latin)] for hand, latin, count, *_ in entry.get('tibetan', [])] or None
        if not entry['tibetan']:
            del entry['tibetan']
    path.write_text(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()

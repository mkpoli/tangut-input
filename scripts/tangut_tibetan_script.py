# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Fill in the script, transcription and IPA of the spellings in `tangut-tibetan-hands.json`.

The tables write a prefix with a hyphen (`g-yi`), འ as `v`, and k+h as `k.ha`. The Tibetan script is
checked against BabelStone's index (268 of 268) and 李範文's table (254 of 254). The Sanskrit is
printed in transliteration and is converted to Devanagari here. The IPA reads the letters one by one:
the Tibetan letters with their Old Tibetan values, the Sanskrit in the usual Sanskrit pronunciation.
It is the site's reading, not the source's. Run it after the transliteration changes:

    uv run scripts/tangut_tibetan_script.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_tangut_tibetan_rhymes import to_wylie

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
def stack(seq, prefixed=False):
    """A consonant run: unstacked prefix letters, then one stacked head."""
    if not seq: return ''
    out=''
    # a prefix stands apart before a root it cannot stack on
    while len(seq)>1 and seq[0] in('g','d','b','m','v') and ((seq[:2]==['d','w'] and not out and not prefixed) or seq[1] not in('y','r','l','w','h','+h','?') or (seq[1] in('r','l','s') and len(seq)>2 and seq[2] not in('y','r','l','w','h','+h'))):
        out+=ROOT[seq[0]];seq=seq[1:]
    if seq[0]=='?': head='?'
    else: head=ROOT[seq[0]]
    return out+head+''.join('?' if c=='?' else SUB['h' if c=='+h' else c] for c in seq[1:])
def syll(s, prefixed=False):
    """One syllable of the transliteration, or None when it does not parse."""
    # A dot keeps k+h from reading as kh, and otherwise marks a prefix, as a hyphen does.
    s=re.sub(r'^((?:[gdbmv?]-)?)([kgdbpt])[.+]h',lambda m:m[1]+m[2]+'\x00',s).replace('.','-')
    if '-' in s:
        pre,s=s.split('-',1)
        p=''.join(ROOT.get(x,'?') for x in pre) if pre!='?' else '?'
        rest=syll(s, True)
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
    body=stack(seq, prefixed) if seq else 'ཨ'
    # A doubled vowel is the long-vowel mark, as 李範文's table writes བཱང for baang.
    vs=('\u0f71'+VOW[v[0]]) if len(v)==2 and v[0]==v[1] else ''.join(VOW[x] for x in v)
    sf=cons(suf)
    if sf is None: return None
    return body+vs+''.join('?' if x=='?' else ROOT[x] for x in sf)
def to_tibetan(s):
    parts=[syll(x) for x in s.split()]
    return None if any(p is None for p in parts) else '་'.join(parts)


# The script loses the source's parse in these spellings: to_wylie reads a root and a suffix as a
# prefix and a root, or orders two vowel signs against the printed form. The table's printed form is
# the source, so the Wylie follows it.
WYLIE_AS_PRINTED = {
    'gar': 'gar', 'mar': 'mar', 'dav': "da'",
    'phuo': 'phuo', 'chui': 'chui', 'mue': 'mue',
}


def wylie_of(latin):
    """Wylie for a spelling; one with an unread letter keeps its printed form, ? and all."""
    if '?' in latin:
        return latin
    if latin in WYLIE_AS_PRINTED:
        return WYLIE_AS_PRINTED[latin]
    return ' '.join(to_wylie(part) for part in to_tibetan(latin).split('་'))


# The IPA of the Tibetan letters, one letter at a time: prefixes are spoken, འ is a glottal stop,
# and the long vowels are the ones Wylie writes A, I, U (or oo/ee).
TIBETAN_UNITS = [
    ('tsh', 'tsʰ'), ('ts', 'ts'), ('dz', 'dz'), ('kh', 'kʰ'), ('gh', 'ɡʱ'), ('ch', 'tɕʰ'),
    ('jh', 'dʑʱ'), ('th', 'tʰ'), ('dh', 'dʱ'), ('ph', 'pʰ'), ('bh', 'bʱ'), ('ng', 'ŋ'),
    ('ny', 'ɲ'), ('zh', 'ʑ'), ('sh', 'ɕ'), ('lh', 'l̥'), ('nh', 'nʱ'), ('aa', 'aː'), ('ii', 'iː'), ('uu', 'uː'), ('oo', 'oː'), ('ee', 'eː'),
    ('k', 'k'), ('g', 'ɡ'), ('c', 'tɕ'), ('j', 'dʑ'), ('t', 't'), ('d', 'd'), ('n', 'n'),
    ('p', 'p'), ('b', 'b'), ('m', 'm'), ('w', 'w'), ('z', 'z'), ('y', 'j'), ('r', 'r'),
    ('l', 'l'), ('s', 's'), ('h', 'h'), ("'", 'ʔ'), ('v', 'ʔ'),
    ('A', 'aː'), ('I', 'iː'), ('U', 'uː'), ('E', 'eː'), ('O', 'oː'),
    ('a', 'a'), ('i', 'i'), ('u', 'u'), ('e', 'e'), ('o', 'o'),
]
TIBETAN_ASPIRATES = {
    'k': 'kʰ', 'kʰ': 'kʰ', 'ɡ': 'ɡʱ', 'ɡʱ': 'ɡʱ', 'tɕ': 'tɕʰ', 'tɕʰ': 'tɕʰ',
    'dʑ': 'dʑʱ', 'dʑʱ': 'dʑʱ', 't': 'tʰ', 'tʰ': 'tʰ', 'd': 'dʱ', 'dʱ': 'dʱ',
    'p': 'pʰ', 'pʰ': 'pʰ', 'b': 'bʱ', 'bʱ': 'bʱ',
}
TIBETAN_UNITS.sort(key=lambda unit: -len(unit[0]))


def tibetan_ipa(wylie):
    """Read a printed spelling letter by letter, keeping ? where the source could not be read."""
    units = []
    i = 0
    while i < len(wylie):
        char = wylie[i]
        if wylie.startswith(('+h', '.h'), i):
            last = units[-1] if units else ''
            if last in TIBETAN_ASPIRATES:
                units[-1] = TIBETAN_ASPIRATES[last]
            else:
                units.append('h')
            i += 2
            continue
        if char in ' .-':
            if char == ' ':
                units.append(' ')
            i += 1
            continue
        if char in '?[]':
            if char == '?':
                units.append('?')
            i += 1
            continue
        # A second h after an aspirated letter is the same aspiration: thha, khha.
        if char == 'h' and units and units[-1].endswith(('ʰ', 'ʱ')):
            i += 1
            continue
        for token, value in TIBETAN_UNITS:
            if wylie.startswith(token, i):
                units.append(value)
                i += len(token)
                break
        else:
            raise ValueError(f'no Tibetan reading for {char!r} in {wylie!r}')
    return ''.join(units).strip()


# Sanskrit, in IAST: the consonants, vowels and signs the tables use, with their usual IPA.
SANSKRIT_IPA = {
    'kh': 'kʰ', 'gh': 'ɡʱ', 'ch': 'tɕʰ', 'jh': 'dʑʱ', 'ṭh': 'ʈʰ', 'ḍh': 'ɖʱ', 'th': 't̪ʰ',
    'dh': 'd̪ʱ', 'ph': 'pʰ', 'bh': 'bʱ', 'ai': 'ɐi̯', 'au': 'ɐu̯', 'ā': 'aː', 'ī': 'iː',
    'ū': 'uː', 'ṝ': 'r̩ː', 'ḹ': 'l̩ː', 'ṛ': 'r̩', 'ḷ': 'l̩', 'k': 'k', 'g': 'ɡ', 'ṅ': 'ŋ',
    'c': 'tɕ', 'j': 'dʑ', 'ñ': 'ɲ', 'ṭ': 'ʈ', 'ḍ': 'ɖ', 'ṇ': 'ɳ', 't': 't̪',
    'd': 'd̪', 'n': 'n', 'p': 'p', 'b': 'b', 'm': 'm', 'y': 'j', 'r': 'r', 'l': 'l',
    'v': 'ʋ', 'ś': 'ɕ', 'ṣ': 'ʂ', 's': 's', 'h': 'ɦ', 'ṃ': 'm', 'ḥ': 'h', 'a': 'ɐ',
    'i': 'i', 'u': 'u', 'e': 'eː', 'o': 'oː',
}
SANSKRIT_TOKENS = sorted(SANSKRIT_IPA, key=len, reverse=True)
SANSKRIT_VOWEL_SIGNS = {'ā': 'ा', 'i': 'ि', 'ī': 'ी', 'u': 'ु', 'ū': 'ू', 'ṛ': 'ृ', 'ṝ': 'ॄ',
                        'ḷ': 'ॢ', 'ḹ': 'ॣ', 'e': 'े', 'ai': 'ै', 'o': 'ो', 'au': 'ौ'}
SANSKRIT_INDEPENDENT = {'a': 'अ', 'ā': 'आ', 'i': 'इ', 'ī': 'ई', 'u': 'उ', 'ū': 'ऊ', 'ṛ': 'ऋ',
                        'ṝ': 'ॠ', 'ḷ': 'ऌ', 'ḹ': 'ॡ', 'e': 'ए', 'ai': 'ऐ', 'o': 'ओ', 'au': 'औ'}
SANSKRIT_LETTERS = {'k': 'क', 'kh': 'ख', 'g': 'ग', 'gh': 'घ', 'ṅ': 'ङ', 'c': 'च', 'ch': 'छ',
                    'j': 'ज', 'jh': 'झ', 'ñ': 'ञ', 'ṭ': 'ट', 'ṭh': 'ठ', 'ḍ': 'ड', 'ḍh': 'ढ',
                    'ṇ': 'ण', 't': 'त', 'th': 'थ', 'd': 'द', 'dh': 'ध', 'n': 'न', 'p': 'प',
                    'ph': 'फ', 'b': 'ब', 'bh': 'भ', 'm': 'म', 'y': 'य', 'r': 'र', 'l': 'ल',
                    'v': 'व', 'ś': 'श', 'ṣ': 'ष', 's': 'स', 'h': 'ह', 'ṃ': 'ं', 'ḥ': 'ः'}


def sanskrit_tokens(iast):
    """Split one IAST spelling into its letters and signs, or fail on a character it cannot read."""
    tokens = []
    i = 0
    while i < len(iast):
        for token in SANSKRIT_TOKENS:
            if iast.startswith(token, i):
                tokens.append(token)
                i += len(token)
                break
        else:
            raise ValueError(f'no Sanskrit reading for {iast[i]!r} in {iast!r}')
    return tokens


def to_devanagari(iast):
    """Write an IAST spelling in Devanagari, with a virama on a consonant that ends it."""
    out = []
    consonant = False
    for token in sanskrit_tokens(iast):
        if token in ('ṃ', 'ḥ'):
            out.append(SANSKRIT_LETTERS[token])
            consonant = False
        elif token in SANSKRIT_LETTERS:
            if consonant:
                out.append('्')
            out.append(SANSKRIT_LETTERS[token])
            consonant = True
        elif token in SANSKRIT_VOWEL_SIGNS or token == 'a':
            if consonant:
                out.append(SANSKRIT_VOWEL_SIGNS.get(token, ''))
                consonant = False
            else:
                out.append(SANSKRIT_INDEPENDENT[token])
        else:
            raise ValueError(f'no Devanagari letter for {token!r}')
    if consonant:
        out.append('्')
    return ''.join(out)


def sanskrit_ipa(iast):
    """The usual Sanskrit pronunciation of an IAST spelling, letter by letter."""
    return ''.join(SANSKRIT_IPA[unit] for unit in sanskrit_tokens(iast))


def sanskrit_forms(value):
    """The printed spellings of a row, whether the file still holds the strings or the triples."""
    if isinstance(value, str):
        printed = [value]
    elif isinstance(value[0], str):
        printed = value
    else:
        printed = [item[0] for item in value]
    return [[part.strip(), to_devanagari(part.strip()), sanskrit_ipa(part.strip())] for item in printed for part in item.split(',')]


def main():
    path = Path(__file__).resolve().parents[1] / 'app/data/tangut-tibetan-hands.json'
    record = json.loads(path.read_text(encoding='utf-8'))
    record['note'] = ('Tibetan spellings of Tangut characters by hand class A–E, with counts, and Sanskrit, machine-read '
                      'from reposted scans of a study the repost does not name. Each row’s 李範文 number was checked '
                      'through kTGT_MergedSrc against the rhyme, tone and initial class in the rhyme data; rows that '
                      'failed are left out unless a second source confirms them. 134 of the 151 characters also in '
                      'BabelStone’s index share a spelling with it. The spellings themselves have not been checked '
                      'against the scans one by one. Each Tibetan spelling is given in the tables’ transliteration, '
                      'Tibetan script converted from it, Wylie, and IPA; each Sanskrit spelling in IAST, Devanagari '
                      'converted from it, and IPA. The IPA reads the printed transliteration one letter at a time and '
                      'is this site’s reading, not the source’s. Six Tibetan spellings keep the printed order in Wylie, '
                      'where the script conversion loses it, and one Sanskrit form is read ñi where the machine gave '
                      'the IPA letter ɲi. A count of 0 means none was read, and ? marks a letter that could not be read.')
    for entry in record['chars'].values():
        entry['tibetan'] = [[hand, latin, count, to_tibetan(latin), wylie_of(latin), tibetan_ipa(latin)] for hand, latin, count, *_ in entry.get('tibetan', [])] or None
        if not entry['tibetan']:
            del entry['tibetan']
        if entry.get('sanskrit'):
            entry['sanskrit'] = sanskrit_forms(entry['sanskrit'])
    path.write_text(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()

# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.68.0", "brotli==1.2.1"]
# ///
"""Build `app/data/tangut-supplement.json.gz`: every character in the two Tangut supplement blocks.

Unicode 18.0.0 assigns 33 ideographs to Tangut Supplement (U+18D00–U+18D20) and 115 components to
Tangut Components Supplement (U+18D80–U+18DF2). The site's records, glyphs and parts did not cover
them, so this file collects what each character has:

- its Unicode name, block and, for components, its component number;
- the radical-stroke index and the source reference from Unicode's `TangutSources.txt`;
- the description from BabelStone's TangutIDS.txt for U+18D00–U+18D08, and from the WG2 proposals
  for U+18D09–U+18D20 (transcribed in `data/tangut-supplement-ids.tsv`);
- the Cangjie codes the RIME table records;
- the stroke count, from the block's NamesList annotations;
- which bundled face draws it.

No reading or meaning is recorded for these characters in any source the site uses.

    uv run scripts/build_tangut_supplement.py
"""
import gzip
import hashlib
import json
import re
from datetime import date
from pathlib import Path
from urllib.request import urlopen

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/tangut-supplement.json.gz'
UNICODE = ROOT / 'data/unicode-18.0.0'
TANGUT_SOURCES = 'https://www.unicode.org/Public/18.0.0/ucd/TangutSources.txt'
TANGUT_SOURCES_SHA256 = 'ae440bd9bba89b2610cfe6b498ac462d2763dd32bfead8ac30d32988b5b67a27'
N5217 = 'https://www.unicode.org/wg2/docs/n5217r2-Tangut-components-ideographs.pdf'
NAMES_LIST = 'https://www.unicode.org/Public/18.0.0/ucd/NamesList.txt'
NAMES_LIST_SHA256 = 'e0732f7cb47a08ee2186c83a18a91ae277126e8099b53c432b4c3e32488dac9b'
BLOCKS = {'supplement': (0x18D00, 0x18D7F), 'components': (0x18D80, 0x18DFF)}
OPS = set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻')
ARITY = {'⿲': 3, '⿳': 3}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def unicode_data() -> dict[int, str]:
    """The assigned code points in the two blocks, with the Unicode name of each."""
    names: dict[int, str] = {}
    for line in gzip.open(UNICODE / 'UnicodeData.txt.gz', 'rt'):
        fields = line.split(';')
        point, name = int(fields[0], 16), fields[1]
        if not any(lo <= point <= hi for lo, hi in BLOCKS.values()):
            continue
        if name.endswith(', First>'):
            names[point] = f'TANGUT IDEOGRAPH-{point:05X}'
            continue
        if name.endswith(', Last>'):
            for run in range(max(names) + 1, point + 1):
                names[run] = f'TANGUT IDEOGRAPH-{run:05X}'
            continue
        names[point] = name
    return dict(sorted(names.items()))


def sources() -> dict[int, tuple[str | None, int, int]]:
    """The source reference and radical-stroke index of each ideograph, from TangutSources.txt."""
    raw = urlopen(TANGUT_SOURCES).read()
    if hashlib.sha256(raw).hexdigest() != TANGUT_SOURCES_SHA256:
        raise SystemExit(f'Unexpected Tangut sources: {TANGUT_SOURCES}')
    found: dict[int, list] = {}
    for line in raw.decode().splitlines():
        fields = line.split('\t')
        if len(fields) < 3 or not fields[0].startswith('U+'):
            continue
        point = int(fields[0][2:], 16)
        if not 0x18D00 <= point <= 0x18D20:
            continue
        found.setdefault(point, [None, None])
        if fields[1] == 'kTGT_MergedSrc':
            found[point][0] = fields[2]
        elif fields[1] == 'kTGT_RSUnicode':
            radical, extra = fields[2].split('.')
            found[point][1] = (int(radical), int(extra))
    if len(found) != 33:
        raise SystemExit(f'Expected 33 Tangut Supplement ideographs, found {len(found)}')
    return {point: (src, *rs) for point, (src, rs) in found.items()}


def component_strokes() -> dict[int, int]:
    """The stroke count of each component, from the block's NamesList annotations."""
    raw = urlopen(NAMES_LIST).read()
    if hashlib.sha256(raw).hexdigest() != NAMES_LIST_SHA256:
        raise SystemExit(f'Unexpected names list: {NAMES_LIST}')
    lines = raw.decode().splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith('@@\t18D80'))
    end = next(i for i, line in enumerate(lines) if line.startswith('@@\t18E00'))
    words = {word.lower(): number for number, word in enumerate(
        'One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen'.split(), 1)}
    found: dict[int, int | None] = {}
    group = None
    for index in range(start, end):
        heading = re.match(r'^@\t\t(?:Miscellaneous|(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen)-stroke)', lines[index])
        if heading:
            group = words[heading.group(1).lower()] if heading.group(1) else None
            continue
        entry = re.match(r'^([0-9A-F]{5})\tTANGUT COMPONENT-\d+$', lines[index])
        if not entry:
            continue
        point, strokes = int(entry.group(1), 16), group
        if index + 1 < end:
            note = re.match(r'^\t\* ([A-Za-z]+) strokes?$', lines[index + 1].lower())
            if note and note.group(1) in words:
                strokes = words[note.group(1)]
        found[point] = strokes
    if len(found) != 115 or any(count is None for count in found.values()):
        raise SystemExit(f'Names list gives {len(found)} components, {sum(1 for c in found.values() if c is None)} without strokes')
    return found


def cangjie() -> dict[str, list[str]]:
    """Every code the RIME table records, full forms after short ones."""
    rows = json.loads(gzip.decompress((ROOT / 'app/data/tangut-cangjie.json.gz').read_bytes()))
    codes: dict[str, list[str]] = {}
    for char, code in rows:
        codes.setdefault(char, []).append(code)
    for char in codes:
        codes[char] = sorted(set(codes[char]), key=lambda code: (len(code), code))
    return codes


def description(text: str) -> list[str]:
    """The leaves of a description, after checking that it reads as complete trees."""
    leaves: list[str] = []
    at = 0

    def node() -> None:
        nonlocal at
        if at >= len(text):
            raise ValueError('description ends inside an operator')
        char = text[at]
        at += 1
        if char in OPS:
            for _ in range(ARITY.get(char, 2)):
                node()
            return
        if not ('\U00017000' <= char <= '\U00018AFF' or '\U00018D00' <= char <= '\U00018DFF'):
            raise ValueError(f'{char!r} is not a Tangut character')
        leaves.append(char)

    while at < len(text):
        node()
    return leaves


def main() -> None:
    names = unicode_data()
    tangut_sources = sources()
    component_counts = component_strokes()
    codes = cangjie()
    strokes = json.loads(gzip.decompress((ROOT / 'data/tangut-strokes.json.gz').read_bytes()))['values']
    babel = {}
    for line in gzip.open(ROOT / 'data/tangut-ids.tsv.gz', 'rt'):
        if line.startswith('#') or '\t' not in line:
            continue
        char, text = line.rstrip('\n').split('\t')
        babel[char] = text
    published = {}
    for line in (ROOT / 'data/tangut-supplement-ids.tsv').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        point, text, source = line.split('\t')
        published[int(point, 16)] = (text, source)
    noto = TTFont(ROOT / 'app/public/fonts/NotoSerifTangut-Regular.woff2', lazy=True).getBestCmap()
    n4694 = TTFont(ROOT / 'app/public/fonts/TangutN4694.ttf', lazy=True).getBestCmap()

    characters = []
    for point, name in names.items():
        char = chr(point)
        block = next(key for key, (lo, hi) in BLOCKS.items() if lo <= point <= hi)
        record = {'char': char, 'block': block, 'name': name}
        if block == 'supplement':
            source, radical, extra = tangut_sources[point]
            if radical > 768:
                raise SystemExit(f'Radical {radical} is not a Tangut component')
            record.update({
                'strokes': extra,
                'radical': chr(0x18800 + radical - 1),
                'radicalStrokes': f'{radical}.{extra}',
                'source': source,
            })
            if strokes.get(char) != extra:
                raise SystemExit(f'U+{point:04X}: stroke count disagrees with data/tangut-strokes.json.gz')
            if char in babel:
                record['ids'], record['idsSource'] = babel[char], 'BabelStone'
            elif point in published:
                record['ids'], record['idsSource'] = published[point]
            if 'ids' in record:
                description(record['ids'])
        else:
            record['component'] = int(name.rsplit('-', 1)[1])
            record['strokes'] = component_counts[point]
        record['cangjie'] = codes.get(char, [])
        if point not in n4694:
            raise SystemExit(f'Tangut N4694 has no glyph for U+{point:04X}')
        record['glyph'] = 'Noto Serif Tangut 2.168' if point in noto else 'Tangut N4694'
        characters.append(record)

    document = {
        'format': 'tangut-input/supplement',
        'unicode': '18.0.0',
        'built': date.today().isoformat(),
        'sources': [
            {'id': 'unicode', 'name': 'Unicode 18.0.0 UnicodeData.txt',
             'url': 'https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt',
             'sha256': json.loads((UNICODE / 'sources.json').read_text())['files']['UnicodeData.txt']['sha256']},
            {'id': 'tangut-sources', 'name': 'Unicode 18.0.0 TangutSources.txt',
             'url': TANGUT_SOURCES, 'sha256': TANGUT_SOURCES_SHA256},
            {'id': 'babelstone-ids', 'name': 'BabelStone Tangut IDS, filtered in data/tangut-ids.tsv.gz',
             'url': 'https://www.babelstone.co.uk/Tangut/TangutIDS.txt',
             'sha256': sha256(ROOT / 'data/tangut-ids.tsv.gz')},
            {'id': 'n5217', 'name': 'WG2 N5217R2, Proposal to encode 2 Tangut components and 28 Tangut ideographs',
             'url': N5217},
            {'id': 'n5286', 'name': 'WG2 N5286, Proposal to encode two Tangut ideographs',
             'url': 'https://www.unicode.org/wg2/docs/n5286_TwoTangutIdeographs.pdf'},
            {'id': 'n5303', 'name': 'WG2 N5303, Proposal to encode one Tangut ideograph',
             'url': 'https://www.unicode.org/L2/L2025/25144-additional-tangut.pdf'},
            {'id': 'n5314', 'name': 'WG2 N5314, A newly-identified Tangut ideograph with Component 108',
             'url': 'https://www.unicode.org/L2/L2025/25165-wg2-n5314.pdf'},
            {'id': 'names-list', 'name': 'Unicode 18.0.0 NamesList.txt',
             'url': NAMES_LIST, 'sha256': NAMES_LIST_SHA256},
            {'id': 'rime', 'name': 'RIME Tangut Cangjie, version 2026.02.02',
             'url': 'https://github.com/Hulenkius/rime_tangutcjkk',
             'commit': 'b27f1f91e5180e061fd7fc600d1b024a4009857c'},
            {'id': 'n4694', 'name': 'Tangut N4694, version 18',
             'url': 'https://ccamc.org/fonts_tangut.php', 'sha256': sha256(ROOT / 'app/public/fonts/TangutN4694.ttf')},
        ],
        'counts': {
            'characters': len(characters),
            'ideographs': sum(1 for c in characters if c['block'] == 'supplement'),
            'components': sum(1 for c in characters if c['block'] == 'components'),
            'descriptions': sum(1 for c in characters if 'ids' in c),
            'strokes': sum(1 for c in characters if c.get('strokes')),
            'cangjie': sum(1 for c in characters if c['cangjie']),
        },
        'characters': characters,
    }
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(raw)
    print(f"{document['counts']} -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes gzipped)")


if __name__ == '__main__':
    main()

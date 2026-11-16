# /// script
# requires-python = ">=3.11"
# dependencies = ["brotli==1.2.1", "fonttools==4.68.0"]
# ///
"""Build the Cursive Tangut face from the traced forms in `data/cursive/forms.json.gz`.

Each character gets one base glyph at its code point and the page's other forms as `.alt1`,
`.alt2` … glyphs behind the stylistic sets `ss01`–`ss07`. A run of text set in `ss01` therefore
shows every character in its second form, where the source gives one.

    uv run scripts/build_tangut_cursive_font.py
"""
from __future__ import annotations

import calendar
import gzip
import json
import pathlib

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/cursive/forms.json.gz'
TF = ROOT / 'fonts/CursiveTangut-Regular.ttf'
WOFF2 = ROOT / 'fonts/CursiveTangut-Regular.woff2'

# The head table's dates, so that a rebuild from the same record gives the same file.
TIMESTAMP = calendar.timegm((2026, 11, 8, 0, 0, 0)) + 2082844800
ASCENT = 836
DESCENT = -146
ADVANCE = 1000

NOTDEF = [
    ['M', 60, 0], ['L', 940, 0], ['L', 940, 820], ['L', 60, 820], ['Z'],
    ['M', 140, 80], ['L', 140, 740], ['L', 860, 740], ['L', 860, 80], ['Z'],
]


def glyph(outline: list[list], glyph_set) -> object:
    pen = TTGlyphPen(glyph_set)
    quad = Cu2QuPen(pen, max_err=0.5, all_quadratic=True)
    for command in outline:
        operator, *values = command
        if operator == 'M':
            quad.moveTo(tuple(values))
        elif operator == 'L':
            quad.lineTo(tuple(values))
        elif operator == 'C':
            quad.curveTo(tuple(values[:2]), tuple(values[2:4]), tuple(values[4:6]))
        elif operator == 'Z':
            quad.closePath()
        else:
            raise ValueError(f'unknown command {operator}')
    return pen.glyph()


def left_side(outline: list[list]) -> int:
    values = []
    for operator, *points in outline:
        if operator in 'ML':
            values.append(points[0])
        elif operator == 'C':
            values.extend([points[0], points[2], points[4]])
    return round(min(values))


def glyph_name(codepoint: str, alternate: int | None) -> str:
    name = f'u{codepoint}'
    return name if alternate is None else f'{name}.alt{alternate}'


def main() -> None:
    record = json.load(gzip.open(DATA, 'rt', encoding='utf-8'))
    metrics = record.get('metrics', {})
    if metrics.get('unitsPerEm', 1000) != 1000 or metrics.get('advance', ADVANCE) != ADVANCE:
        raise SystemExit('the builder assumes a 1000-unit em and a 1000-unit advance')

    bases = {}
    alternates = {}
    for form in record['forms']:
        name = glyph_name(form['codepoint'], form.get('alternate'))
        if form['base']:
            bases[form['codepoint']] = (name, form)
        else:
            alternates.setdefault(form['codepoint'], []).append((name, form))
    if len(bases) < 108:
        raise SystemExit(f'expected at least the 108 base forms, read {len(bases)}')

    order = ['.notdef']
    drawings = {'.notdef': NOTDEF}
    widths = {'.notdef': (ADVANCE, 60)}
    cmap = {}
    for codepoint in sorted(bases, key=lambda value: int(value, 16)):
        name, form = bases[codepoint]
        order.append(name)
        cmap[int(codepoint, 16)] = name
        drawings[name] = form['outline']
        widths[name] = (ADVANCE, 0)
        for alternate_name, alternate_form in sorted(alternates.get(codepoint, []), key=lambda item: item[1]['alternate']):
            order.append(alternate_name)
            drawings[alternate_name] = alternate_form['outline']
            widths[alternate_name] = (ADVANCE, 0)

    glyph_set = {}
    glyphs = {name: glyph(outline, glyph_set) for name, outline in drawings.items()}
    for name, outline in drawings.items():
        if name == '.notdef':
            continue
        widths[name] = (ADVANCE, left_side(outline))

    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap(cmap)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(widths)
    builder.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT, lineGap=0)
    builder.setupNameTable({
        'copyright': 'Cursive forms traced from examples collected by Andrew West (BabelStone); '
                     'the reproductions belong to the publishers and libraries named in the source record.',
        'familyName': 'Cursive Tangut',
        'styleName': 'Regular',
        'uniqueFontIdentifier': 'CursiveTangut-Regular;1.000;2026',
        'fullName': 'Cursive Tangut Regular',
        'version': 'Version 1.000',
        'psName': 'CursiveTangut-Regular',
        'designer': 'Traced for the Tangut Input project',
        'description': f'{len(bases)} cursive Tangut characters, traced from the sources in '
                       'data/cursive/README.md. Each character has one form at its code point; the '
                       'other forms are in the stylistic sets ss01–ss07.',
        'licenseDescription': 'The source page states no licence for the reproductions. '
                              'The outlines are provided for study and citation, not for resale.',
        'licenseInfoURL': 'https://github.com/mkpoli/tangut-input/blob/main/data/cursive/README.md',
        'vendorURL': 'https://www.babelstone.co.uk/Tangut/CursiveTangut.html',
        'designerURL': 'https://tangut.mkpo.li/',
    })
    builder.setupOS2(
        sTypoAscender=ASCENT,
        sTypoDescender=DESCENT,
        sTypoLineGap=0,
        usWinAscent=ASCENT,
        usWinDescent=-DESCENT,
        sxHeight=500,
        sCapHeight=700,
        achVendID='MKPO',
        fsType=0,
    )
    builder.setupPost()

    features = ['languagesystem DFLT dflt;', 'languagesystem Tang dflt;']
    for number in range(1, 8):
        rules = []
        for codepoint, (name, _) in bases.items():
            for alternate_name, form in alternates.get(codepoint, []):
                if form['alternate'] == number:
                    rules.append(f'sub {name} by {alternate_name};')
        if rules:
            features.append(f'feature ss0{number} {{')
            features.extend(sorted(rules))
            features.append(f'}} ss0{number};')
    addOpenTypeFeaturesFromString(builder.font, '\n'.join(features))

    builder.font['head'].created = TIMESTAMP
    builder.font['head'].modified = TIMESTAMP
    builder.save(TF)
    builder.font.flavor = 'woff2'
    builder.save(WOFF2)
    print(f'{TF.relative_to(ROOT)}: {len(order)} glyphs, {TF.stat().st_size} bytes')
    print(f'{WOFF2.relative_to(ROOT)}: {WOFF2.stat().st_size} bytes')


if __name__ == '__main__':
    main()

# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.68.0", "brotli==1.2.1"]
# ///
"""Build the small font subsets the site serves beside the full Tangut faces.

`NotoSerifTangut-supplement.woff2` holds the characters Google Fonts' Noto Serif Tangut lacks,
taken from the bundled 2.168. `BabelStoneTangut-complement.woff2` holds the characters BabelStone
Tangut Wenhai draws that Noto does not.
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / 'app/public/fonts'
TANGUT = (0x17000, 0x18DFF)
# Where the bundled copies come from: the data directory of the repository the outlines were built
# from, and the open-tangut download recorded in data/README.md.
NOTO = ROOT / 'app/public/fonts/.cache/NotoSerifTangut-2.168.ttf'


def points(path: Path) -> set[int]:
    return {c for c in (TTFont(path, lazy=True).getBestCmap() or {}) if TANGUT[0] <= c <= TANGUT[1]}


def write_subset(source: Path, chars: list[int], out: Path) -> None:
    options = subset.Options()
    options.layout_features = []
    options.name_IDs = ['*']
    options.notdef_outline = True
    # Woff2 unless the source is already a WOFF2: re-encoding it would need the Brotli module.
    options.flavor = None if source.read_bytes()[:4] == b'wOF2' else 'woff2'
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=chars)
    subsetter.subset(font)
    subset.save_font(font, str(out), options)
    print(f'{out.name}: {len(chars)} characters, {out.stat().st_size} bytes')


def main() -> None:
    if not NOTO.exists():
        raise SystemExit(f'missing {NOTO}; copy Noto Serif Tangut 2.168 there first')
    # Google Fonts' copy stops at U+18AF2 and U+18D08; only what lies past them needs adding.
    latest = [*range(0x18AF3, 0x18B00), *range(0x18D00, 0x18D09)]
    write_subset(NOTO, latest, FONTS / 'NotoSerifTangut-supplement.woff2')
    noto = points(NOTO)
    wenhai = points(FONTS / 'BabelStoneTangutWenhai.ttf')
    write_subset(FONTS / 'BabelStoneTangutWenhai.ttf', sorted(noto - wenhai), FONTS / 'BabelStoneTangut-complement.woff2')


if __name__ == '__main__':
    main()

# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==13.0.0", "fonttools[woff]==4.68.0", "brotli==1.2.1"]
# ///
"""Build the pen lines the drawing pad compares a drawing with: one file per face.

Every Tangut ideograph and component the face draws is rendered at 96 px, cropped to its ink,
stretched to fill a 32×32 square and thinned to a one-cell line along the pen, then packed as 128
bytes of bits. `--face` names the face: `noto` (the default, Noto Serif Tangut), `std` (new Tangut
Std, 楷書-structured), `yinchuan` (Tangut Yinchuan), `wenhai` (BabelStone Tangut Wenhai), `n4694`
(Tangut N4694), `twu` (Tangut TWU), `mojikyo` (Mojikyo Tangut) or `genzui` (GenZui Sans Tangut), so
a drawing can be compared with each of the shapes a reader might write from.
The file is a little-endian u32 header length, the header as UTF-8 JSON (format, size, face, font,
sha256 and the characters in order), then the masks back to back.
The page normalises a drawing the same way, so a match compares the line of the drawing with the
line of the font's glyph and nothing else.
"""
import argparse
import gzip
import hashlib
import json
import tempfile
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
# Each face, its file, its name in the file header and where it comes from.
FACES = {
    'noto': (ROOT / 'fonts/NotoSerifTangut-Regular.woff2', 'Noto Serif Tangut', 'app/data/tangut-shapes.bin.gz'),
    'std': (ROOT / 'app/public/fonts/NewTangutStd.ttf', 'New Tangut Std', 'app/data/tangut-shapes-std.bin.gz'),
    'yinchuan': (ROOT / 'app/public/fonts/TangutYinchuan.ttf', 'Tangut Yinchuan', 'app/data/tangut-shapes-yinchuan.bin.gz'),
    'wenhai': (ROOT / 'app/public/fonts/BabelStoneTangutWenhai.ttf', 'BabelStone Tangut Wenhai', 'app/data/tangut-shapes-wenhai.bin.gz'),
    'n4694': (ROOT / 'app/public/fonts/TangutN4694.ttf', 'Tangut N4694', 'app/data/tangut-shapes-n4694.bin.gz'),
    'twu': (ROOT / 'app/public/fonts/TangutTWU.ttf', 'Tangut TWU', 'app/data/tangut-shapes-twu.bin.gz'),
    'mojikyo': (ROOT / 'app/public/fonts/MojikyoTangut.ttf', 'Mojikyo Tangut', 'app/data/tangut-shapes-mojikyo.bin.gz'),
    'genzui': (ROOT / 'app/public/fonts/GenZuiSansTangut.ttf', 'GenZui Sans Tangut', 'app/data/tangut-shapes-genzui.bin.gz'),
}
SIZE = 32
FIT = 30
THIN_SCALE = 3
RENDER = 96
THRESHOLD = 96
RANGES = [(0x17000, 0x187FF), (0x18800, 0x18AFF), (0x18D00, 0x18D1F)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--face', choices=sorted(FACES), default='noto')
    options = parser.parse_args()
    face_name = options.face
    FONT, NAME, out = FACES[face_name]
    OUT = ROOT / out
    font = TTFont(FONT)
    cmap = font.getBestCmap() or {}
    font.flavor = None
    with tempfile.NamedTemporaryFile(suffix='.otf') as plain:
        font.save(plain.name)
        face = ImageFont.truetype(plain.name, RENDER)
        chars = []
        packed = bytearray()
        outlined = 0
        for start, end in RANGES:
            for code in range(start, end + 1):
                if code not in cmap:
                    continue
                try:
                    ink = draw(face, chr(code))
                except Exception:
                    # Some faces hold single glyphs of many thousand contours; Pillow's text path
                    # stops there, and the contours have to be drawn by hand.
                    ink = outline_face(font, code, chr(code))
                    outlined += 1
                mask = mask_of(ink) if ink is not None else None
                if mask is None:
                    continue
                chars.append(chr(code))
                packed += mask
    document = {
        'format': 'tangut-input/shapes',
        'size': SIZE,
        'font': NAME,
        'face': face_name,
        'fontSha256': hashlib.sha256(FONT.read_bytes()).hexdigest(),
        'chars': ''.join(chars),
    }
    header = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    raw = len(header).to_bytes(4, 'little') + header + bytes(packed)
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(raw)
    print(f'{len(chars)} glyphs ({outlined} from outlines), {len(raw)} bytes raw, '
          f'{OUT.stat().st_size} gzipped -> {OUT.relative_to(ROOT)}')


class PolygonPen(BasePen):
    """A glyph outline as filled polygons, for faces whose contours exceed Pillow's path limit."""

    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.polygons = []
        self.contour = []

    def _moveTo(self, point):
        if len(self.contour) > 2:
            self.polygons.append(self.contour)
        self.contour = [point]

    def _lineTo(self, point):
        self.contour.append(point)

    def _curveToOne(self, a, b, c, steps=8):
        start = self.contour[-1]
        for i in range(1, steps + 1):
            t = i / steps
            x = (1 - t) ** 3 * start[0] + 3 * (1 - t) ** 2 * t * a[0] + 3 * (1 - t) * t ** 2 * b[0] + t ** 3 * c[0]
            y = (1 - t) ** 3 * start[1] + 3 * (1 - t) ** 2 * t * a[1] + 3 * (1 - t) * t ** 2 * b[1] + t ** 3 * c[1]
            self.contour.append((x, y))

    def _closePath(self):
        if len(self.contour) > 2:
            self.polygons.append(self.contour)
        self.contour = []


def outline_face(font, code, char):
    """A glyph drawn from its own contours, for faces too dense for Pillow's text path."""
    scale = RENDER / font['head'].unitsPerEm
    glyph_set = font.getGlyphSet()
    name = (font.getBestCmap() or {}).get(code)
    if not name:
        return None
    pen = PolygonPen(glyph_set)
    glyph_set[name].draw(pen)
    pen._closePath()
    if not pen.polygons:
        return None
    xs = [x for polygon in pen.polygons for x, _ in polygon]
    ys = [y for polygon in pen.polygons for _, y in polygon]
    left, right = min(xs) * scale, max(xs) * scale
    top, bottom = min(ys) * scale, max(ys) * scale
    pad = 8
    width = int(right - left) + 2 * pad
    height = int(bottom - top) + 2 * pad
    canvas = Image.new('L', (max(1, width), max(1, height)), 0)
    draw = ImageDraw.Draw(canvas)
    for polygon in pen.polygons:
        points = [((x * scale) - left + pad, (y * scale) - top + pad) for x, y in polygon]
        draw.polygon(points, fill=255)
    return canvas


def draw(face, char):
    """The glyph's ink drawn by the font engine, for the faces Pillow can render whole."""
    canvas = Image.new('L', (RENDER * 2, RENDER * 2), 0)
    ImageDraw.Draw(canvas).text((RENDER // 2, RENDER // 2), char, font=face, fill=255)
    return canvas


def mask_of(canvas):
    """The ink of a rendered glyph as a pen line of packed bits, stretched to the square."""
    box = canvas.point(lambda v: 255 if v >= THRESHOLD else 0).getbbox()
    if not box:
        return None
    ink = canvas.crop(box)
    width, height = ink.size
    # The line is thinned at a larger size than the file, so that a stroke comes out continuous.
    size = SIZE * THIN_SCALE
    fit = FIT * THIN_SCALE
    # Fitted by its longer side so the proportions survive; a thin glyph (a lone stroke) would
    # otherwise be blown up into a bar.
    scale = fit / max(width, height, 1)
    w = max(1, round(width * scale))
    h = max(1, round(height * scale))
    fitted = ink.resize((w, h), Image.Resampling.LANCZOS)
    square = Image.new('L', (size, size), 0)
    square.paste(fitted, ((size - w) // 2, (size - h) // 2))
    pixels = square.load()
    # A low cutoff keeps faint joins from breaking the line before it is thinned.
    ink_cells = {(x, y) for y in range(size) for x in range(size) if pixels[x, y] >= THRESHOLD // 4}
    ink_cells = {(x // THIN_SCALE, y // THIN_SCALE) for x, y in thinner(ink_cells)}
    bits = bytearray(SIZE * SIZE // 8)
    for x, y in ink_cells:
        index = y * SIZE + x
        bits[index >> 3] |= 1 << (index & 7)
    return bits


def thinner(ink):
    """Zhang-Suen thinning: the filled glyph reduced to a one-cell-wide line along its pen."""
    ink = set(ink)
    while True:
        removed = 0
        for step in (0, 1):
            marks = []
            for x, y in ink:
                p = (0 if (x, y - 1) not in ink else 1, 0 if (x + 1, y - 1) not in ink else 1,
                     0 if (x + 1, y) not in ink else 1, 0 if (x + 1, y + 1) not in ink else 1,
                     0 if (x, y + 1) not in ink else 1, 0 if (x - 1, y + 1) not in ink else 1,
                     0 if (x - 1, y) not in ink else 1, 0 if (x - 1, y - 1) not in ink else 1)
                around = sum(p)
                if not 2 <= around <= 6:
                    continue
                crossings = sum(1 for k in range(8) if p[k] == 0 and p[(k + 1) % 8] == 1)
                if crossings != 1:
                    continue
                if step == 0 and (p[0] * p[2] * p[4] or p[2] * p[4] * p[6]):
                    continue
                if step == 1 and (p[0] * p[2] * p[6] or p[0] * p[4] * p[6]):
                    continue
                marks.append((x, y))
            for cell in marks:
                ink.discard(cell)
            removed += len(marks)
        if not removed:
            return ink


if __name__ == '__main__':
    main()

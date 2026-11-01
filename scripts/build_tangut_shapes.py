# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==13.0.0", "fonttools[woff]==4.68.0", "brotli==1.2.1"]
# ///
"""Build `app/data/tangut-shapes.bin.gz`, the glyph masks the drawing pad compares a drawing with.

Every Tangut ideograph and component that Noto Serif Tangut draws is rendered at 96 px, cropped to
its ink and stretched to fill a 32×32 square, then packed as 128 bytes of bits.
The file is a little-endian u32 header length, the header as UTF-8 JSON (format, size, font and
the characters in order), then the masks back to back.
The page normalises a drawing the same way, so a match compares the shape of the font's glyph with
the shape of the drawing and nothing else.
"""
import gzip
import hashlib
import json
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / 'fonts/NotoSerifTangut-Regular.woff2'
OUT = ROOT / 'app/data/tangut-shapes.bin.gz'
SIZE = 32
FIT = 30
RENDER = 96
THRESHOLD = 96
RANGES = [(0x17000, 0x187FF), (0x18800, 0x18AFF), (0x18D00, 0x18D1F)]


def main():
    font = TTFont(FONT)
    cmap = font.getBestCmap() or {}
    font.flavor = None
    with tempfile.NamedTemporaryFile(suffix='.otf') as plain:
        font.save(plain.name)
        face = ImageFont.truetype(plain.name, RENDER)
        chars = []
        packed = bytearray()
        for start, end in RANGES:
            for code in range(start, end + 1):
                if code not in cmap:
                    continue
                mask = draw(face, chr(code))
                if mask is None:
                    continue
                chars.append(chr(code))
                packed += mask
    document = {
        'format': 'tangut-input/shapes',
        'size': SIZE,
        'font': 'Noto Serif Tangut',
        'fontSha256': hashlib.sha256(FONT.read_bytes()).hexdigest(),
        'chars': ''.join(chars),
    }
    header = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    raw = len(header).to_bytes(4, 'little') + header + bytes(packed)
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(raw)
    print(f'{len(chars)} glyphs, {len(raw)} bytes raw, {OUT.stat().st_size} gzipped -> {OUT.relative_to(ROOT)}')


def draw(face, char):
    """The glyph's ink, stretched to fill the square, as packed bits."""
    canvas = Image.new('L', (RENDER * 2, RENDER * 2), 0)
    ImageDraw.Draw(canvas).text((RENDER // 2, RENDER // 2), char, font=face, fill=255)
    box = canvas.point(lambda v: 255 if v >= THRESHOLD else 0).getbbox()
    if not box:
        return None
    ink = canvas.crop(box)
    width, height = ink.size
    # Stretched to fill the square, except that a thin glyph (a lone stroke) keeps a sliver shape.
    w = FIT if width * 4 >= height else max(1, round(FIT * width * 4 / height))
    h = FIT if height * 4 >= width else max(1, round(FIT * height * 4 / width))
    fitted = ink.resize((w, h), Image.Resampling.LANCZOS)
    square = Image.new('L', (SIZE, SIZE), 0)
    square.paste(fitted, ((SIZE - w) // 2, (SIZE - h) // 2))
    pixels = square.load()
    bits = bytearray(SIZE * SIZE // 8)
    for y in range(SIZE):
        for x in range(SIZE):
            if pixels[x, y] >= THRESHOLD:
                index = y * SIZE + x
                bits[index >> 3] |= 1 << (index & 7)
    return bits


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Draw the Tangut characters a transcribed Chinese character allows.

A keyer looking at a 掌中珠 band has to name the Tangut sign under each Chinese character. The
corpus holds 6,144 signs, so no sheet can show them all: the Chinese character's initial rules most
of them out before any ink is compared. The class that survives is still too large for one page, so
it is drawn in pages, sorted by stroke count, and the eye decides.

    uv run scripts/key_sheet.py 酩 m cache/zzz/sheets/酩.png

The initial is the Chinese character's, given as a pinyin initial; the classes it allows are the
consonants a Tangut reading of that syllable may begin with. A class of 250 to 1,600 is normal and
means the sheet narrows the search, never that the answer is on the page.
"""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACE = ROOT / "app/public/fonts/NewTangutStd.ttf"
CELL, COLUMNS, ROWS = 220, 7, 13

# A Chinese initial and the consonants a Tangut reading of that syllable can start with. 屈 is kh-,
# so q takes kh; 迎 and 業 are ŋ-, 由 is j-, which is why y is not "anything".
SOUNDS = {
    "b": "b p ph", "p": "p ph b", "m": "m", "f": "f p ph b",
    "d": "d t th", "t": "t th d", "n": "n", "l": "l",
    "g": "g k kh", "k": "k kh g", "h": "x h kh g",
    "j": "dz ts tś ś z", "q": "ts tś ś s kh th d tsh dzh", "x": "ś s z ts",
    "zh": "tś ts dz", "ch": "tś ś ts", "sh": "ś s tś", "r": "ź z ś",
    "z": "dz ts z", "c": "ts dz", "s": "s ś ts",
    "y": "ŋ j ź ś z x ꞏ", "w": "ŋ w x", "": "",
}


def onset(reading: str) -> str:
    """The consonant a Li Fanwen reading begins with, as far as it can be told from the spelling."""
    letters = "".join(char for char in reading.lower() if char.isalpha())
    for prefix in ("ia", "ie", "io", "iu", "ya", "ye", "yo", "yu"):
        if letters.startswith(prefix):
            return "i"
    for onset_letters in ("tsh", "dzh", "tśh", "źj", "tś", "dz", "kh", "lh", "ts", "dz", "śj"):
        if letters.startswith(onset_letters):
            return onset_letters
    return letters[:1]


def candidates(initial: str) -> list[tuple[str, str]]:
    allowed = set(SOUNDS.get(initial, "").split())
    data = json.load(gzip.open(ROOT / "app/data/tangut-entries.json.gz"))
    index = data["systems"].index("li_fanwen")
    found = []
    for row in data["rows"]:
        values = row[7]
        reading = values[index] if index < len(values) else ""
        if not reading:
            continue
        head = onset(reading)
        if not allowed or head in allowed or head[:1] in allowed:
            found.append((reading, row[0]))
    found.sort(key=lambda pair: (len(pair[1]), ord(pair[1])))
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("character", help="the Chinese character printed under the Tangut sign")
    parser.add_argument("initial", help="its pinyin initial, or '' for none")
    parser.add_argument("output", type=Path, help="where to write the sheets, e.g. cache/zzz/酩.png")
    args = parser.parse_args()

    from PIL import Image, ImageDraw, ImageFont

    hits = candidates(args.initial)
    if not hits:
        print(f"{args.character}: no candidate begins with {args.initial!r}")
        return 1
    glyphs = ImageFont.truetype(str(FACE), 150)
    labels = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    per_page = COLUMNS * ROWS
    pages = (len(hits) + per_page - 1) // per_page
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for page in range(pages):
        chunk = hits[page * per_page:(page + 1) * per_page]
        lines = (len(chunk) + COLUMNS - 1) // COLUMNS
        sheet = Image.new("L", (COLUMNS * CELL, lines * CELL), 255)
        draw = ImageDraw.Draw(sheet)
        for i, (reading, char) in enumerate(chunk):
            x, y = (i % COLUMNS) * CELL, (i // COLUMNS) * CELL
            draw.text((x + 36, y + 6), char, font=glyphs, fill=0)
            draw.text((x + 8, y + CELL - 30), f"{reading} U+{ord(char):X}", font=labels, fill=90)
        name = args.output.with_name(f"{args.output.stem}-{page + 1}{args.output.suffix}" if pages > 1 else args.output.name)
        sheet.save(name)
    print(f"{args.character}: {len(hits)} candidates in {pages} page(s) for {args.initial!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

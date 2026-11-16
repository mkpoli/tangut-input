#!/usr/bin/env python3
"""Propose the Tangut signs of a 掌中珠 band with a line OCR model.

The bands are vertical columns, and the only open Tangut model reads horizontal lines, so each column
is cut into its four glyphs and laid side by side as one line. The column boxes come from the model's
own detector, which finds them on the unbanded image in reading order, right to left.

    uv run scripts/ocr_band.py --model ~/src/tangut-mixocr --image cache/zzz/c40-b2.jpg

It prints one line per column, numbered from the band's right edge, with the role its place in the
entry gives it and what the model read. Nothing here is evidence: on canvas 40 band 1, where the
answer is known, the model gets 9 of 24 signs, so a proposal is a lead to check at 6x against the
print, never a reading to copy.

Requires a clone of https://github.com/FlagRain/tangut-mixocr (MIT) with its `weights/` directory,
and onnxruntime, opencv-python-headless, pillow and pyclipper.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROLES = ("transcription", "tangut", "gloss", "spelling")
GLYPHS = 4


def tangut(text: str) -> str:
    return "".join(char for char in text if "\U00017000" <= char <= "\U000187ff")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", type=Path, required=True, help="the tangut-mixocr clone")
    parser.add_argument("--image", type=Path, required=True, help="a band, both leaves")
    parser.add_argument("--glyphs", type=int, default=GLYPHS, help="signs to a column (default 4)")
    parser.add_argument("--contrast", action="store_true", help="stretch the tone first, for a faint band")
    args = parser.parse_args()

    import numpy as np
    from PIL import Image

    sys.path.insert(0, str(args.model / "web"))
    from app.engine import Engine  # noqa: E402  the clone's own engine

    weights = args.model / "weights"
    engine = Engine(det=weights / "det" / "PP-OCRv6_det_small.onnx", rec=weights / "mixocr-v1.onnx",
                    charset=weights / "charset.json", threads=2)
    image = Image.open(args.image).convert("L")
    grey = np.asarray(image)
    if args.contrast:
        low, high = np.percentile(grey, [2, 98])
        grey = np.clip((grey.astype(np.float32) - low) * 255.0 / (high - low), 0, 255).astype(np.uint8)
        image = Image.fromarray(grey)

    def read(box) -> str:
        x0, y0, x1, y1 = [int(value) for value in box]
        column = image.crop((x0, y0, x1, y1))
        step = column.height / args.glyphs
        pieces = [column.crop((0, int(i * step), column.width, int((i + 1) * step))) for i in range(args.glyphs)]
        height = max(piece.height for piece in pieces)
        strip = Image.new("L", (sum(piece.width + 14 for piece in pieces), height), 255)
        left = 0
        for piece in pieces:
            strip.paste(piece, (left, 0))
            left += piece.width + 14
        text, _ = engine.read_line(np.asarray(strip))
        return text

    boxes = [box for box in engine.detect(grey) if box[3] - box[1] > 200]
    boxes.sort(key=lambda box: -box[0])
    print("canvas\tband\tindex\trole\tx0\tx1\tproposal")
    for index, box in enumerate(boxes, start=1):
        text = read(box)
        print("\t".join((str(args.image.stem), "", str(index), ROLES[(index - 1) % len(ROLES)],
                         str(int(box[0])), str(int(box[2])), tangut(text) or text.strip())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

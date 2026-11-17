#!/usr/bin/env python3
"""Run tangut-mixocr on the six Tangut columns of 掌中珠 canvas 40 band 1.

The model reads horizontal lines. `--mode column` cuts each vertical column into its four glyphs
and lays them side by side, which is what the site's band reader does; `--mode single` reads each
glyph on its own. Output is one JSON object per line, ready for `score.mjs`:

    uv run benchmark/ocr/run.py --model ~/src/tangut-mixocr \
        --image cache/zhangzhongzhu/40-l-1.png --mode column --out predictions.jsonl
    bun benchmark/ocr/score.mjs predictions.jsonl

Requires a clone of https://github.com/FlagRain/tangut-mixocr (MIT) with its `weights/`, and
onnxruntime, opencv-python-headless, pillow and pyclipper.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# The six Tangut columns of the sample, in the detector's right-to-left order. The other columns
# are the Chinese transcription, gloss and spelling, which this sample does not score.
COLUMNS = (2, 6, 10, 14, 18, 22)
GLYPHS = 4


def tangut(text: str) -> str:
    return "".join(char for char in text if "\U00017000" <= char <= "\U000187ff")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", type=Path, required=True, help="the tangut-mixocr clone")
    parser.add_argument("--image", type=Path, required=True, help="the whole band, both leaves")
    parser.add_argument("--mode", choices=("single", "column"), default="column")
    parser.add_argument("--prefix", default="c40b1", help="the id prefix in sample.json")
    parser.add_argument("--out", type=Path, required=True, help="one JSON line per sign")
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

    boxes = [box for box in engine.detect(grey) if box[3] - box[1] > 200]
    boxes.sort(key=lambda box: -box[0])
    if len(boxes) < max(COLUMNS):
        print(f"found {len(boxes)} columns, expected at least {max(COLUMNS)}", file=sys.stderr)
        return 1

    rows = []
    for column in COLUMNS:
        x0, y0, x1, y1 = [int(value) for value in boxes[column - 1]]
        crop = image.crop((x0, y0, x1, y1))
        step = crop.height / GLYPHS
        pieces = [crop.crop((0, int(i * step), crop.width, int((i + 1) * step))) for i in range(GLYPHS)]
        if args.mode == "column":
            height = max(piece.height for piece in pieces)
            strip = Image.new("L", (sum(piece.width + 14 for piece in pieces), height), 255)
            left = 0
            for piece in pieces:
                strip.paste(piece, (left, 0))
                left += piece.width + 14
            text, _ = engine.read_line(np.asarray(strip))
            reading = tangut(text) or text.strip()
            for position in range(GLYPHS):
                rows.append({
                    "id": f"{args.prefix}-c{column:02d}-{position + 1}",
                    "char": reading[position] if position < len(reading) else "",
                })
        else:
            for position, piece in enumerate(pieces, start=1):
                text, _ = engine.read_line(np.asarray(piece))
                rows.append({
                    "id": f"{args.prefix}-c{column:02d}-{position}",
                    "char": tangut(text) or text.strip(),
                })

    args.out.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    print(f"{len(rows)} signs -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

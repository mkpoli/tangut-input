#!/usr/bin/env python3
"""Read a page of 西夏語通韻字典 into rows of its table.

Arakawa's dictionary is one table per rhyme class: a header naming the class, then a row per syllable,
with the rhyme number, the characters that share it, and the reconstruction in an IPA column. The
Tangut characters and the numbers come off the page; the IPA does not, so a row carries what was read
and the reading stays a job for the eye at the crop the script prints.

    uv run scripts/ocr_table.py --model ~/src/tangut-mixocr --page cache/zzz/ara-030.png

Needs a clone of https://github.com/FlagRain/tangut-mixocr and onnxruntime, opencv-python-headless,
pillow and pyclipper.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def tangut(text: str) -> str:
    return "".join(char for char in text if "\U00017000" <= char <= "\U000187ff")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", type=Path, required=True, help="the tangut-mixocr clone")
    parser.add_argument("--page", type=Path, required=True, help="one page, 200-300 dpi")
    parser.add_argument("--row-gap", type=int, default=22, help="vertical gap that starts a new row")
    args = parser.parse_args()

    import numpy as np
    from PIL import Image

    sys.path.insert(0, str(args.model / "web"))
    from app.engine import Engine  # noqa: E402  the clone's own engine

    weights = args.model / "weights"
    engine = Engine(det=weights / "det" / "PP-OCRv6_det_small.onnx", rec=weights / "mixocr-v1.onnx",
                    charset=weights / "charset.json", threads=2)
    page = Image.open(args.page).convert("L")
    lines = [([int(value) for value in line["box"]], line["text"]) for line in engine.page(np.asarray(page))["lines"]
             if line["text"].strip()]
    lines.sort(key=lambda item: (item[0][1] + item[0][3]) / 2)

    header = next((text for _, text in lines if "R." in text), "")
    match = re.search(r"R\.\s*(\d+)\s*平声(\d+)[^\d]*上声(\d+)", header)
    print("#", header.strip() or "no rhyme header read")
    if match:
        print(f"# rhyme {match.group(1)}, level {match.group(2)}, rising {match.group(3)}")

    rows, current, centre = [], [], None
    for box, text in lines:
        if "R." in text:
            continue
        middle = (box[1] + box[3]) / 2
        if centre is None or abs(middle - centre) < args.row_gap:
            current.append((box, text))
            centre = middle if centre is None else centre
        else:
            rows.append(current)
            current, centre = [(box, text)], middle
    if current:
        rows.append(current)

    print("row\tcharacters\treading-cell")
    for number, row in enumerate(rows, start=1):
        row.sort(key=lambda item: item[0][0])
        characters = "".join(tangut(text) for _, text in row)
        reading = " ".join(text.strip() for _, text in row if not tangut(text) and re.search(r"[a-zA-Z]", text))
        if not characters and not reading:
            continue
        print(f"{number}\t{characters}\t{reading[:60]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

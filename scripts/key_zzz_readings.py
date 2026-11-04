#!/usr/bin/env python3
"""Turn keyed 掌中珠 cells into reading rows.

`data/zhangzhongzhu/cells.tsv` holds a page's columns in order, with the role each plays. This walks
those bands and writes one `sound_li_fanwen` row per Tangut character whose Chinese transcription
character stands beside it: the transcription is the 直音, and the cell's canvas and position make the
locator.

    uv run scripts/key_zzz_readings.py >> data/readings/readings.tsv
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CELLS = ROOT / "data" / "zhangzhongzhu" / "cells.tsv"
WORK = "zhangzhongzhu"
DAYS = date.today().isoformat()


def cells(path: Path) -> list[dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    head = lines[0].split("\t")
    for column in ("entry_id", "position", "role", "glyph"):
        if column not in head:
            sys.exit(f"{path} has no {column} column")
    return [dict(zip(head, line.split("\t"))) for line in lines[1:] if line.strip()]


def where(entry_id: str) -> tuple[str, str] | None:
    """The canvas and band from an entry id, and the sequence within the band."""
    found = re.fullmatch(r"zzz:[\w-]+:(\d+)(?:\.(\d+))?", entry_id)
    if not found:
        return None
    canvas = str(int(found.group(1)))
    return canvas, found.group(2) or ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cells", type=Path, default=CELLS)
    args = parser.parse_args()

    rows = cells(args.cells)
    written = 0
    for row in rows:
        if row["role"] != "transcription":
            continue
        place = where(row["entry_id"])
        text = row["glyph"].strip()
        if not place or len(text) != 1:
            continue
        canvas, band = place
        # The Tangut column of the same entry: the transcription stands one column to its left.
        seq = int(row["position"])
        tangut = next((other for other in rows
                       if other["entry_id"] == row["entry_id"]
                       and other["role"] == "tangut"
                       and int(other["position"]) == seq - 1), None)
        if tangut is None:
            continue
        glyph = tangut["glyph"].strip()
        if len(glyph) != 1:
            continue
        note = " ".join(value for value in (tangut.get("glyph_note", ""), row.get("glyph_note", "")) if value)
        status = "uncertain" if "uncertain" in (tangut.get("status", "") + row.get("status", "")) else "keyed"
        locator = f"canvas {canvas} band {band} seq {seq}" if band else f"canvas {canvas}"
        print("\t".join((glyph, "sound_li_fanwen", text, WORK, locator, note, status, DAYS)))
        written += 1
    print(f"{written} rows", file=sys.stderr)
    return 0 if written else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Turn keyed 掌中珠 cells into reading rows.

`data/zhangzhongzhu/cells.tsv` holds each entry's columns by role and position; `entries.tsv` says
which canvas and band the entry stands on. This pairs every Tangut character with the Chinese
character printed for it — that character is the 直音 — and writes one row per pair, with the canvas,
the band and the Tangut character's own position as the locator.

    uv run scripts/key_zzz_readings.py >> data/readings/readings.tsv
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "data" / "zhangzhongzhu"
WORK = "zhangzhongzhu"
DOUBTFUL = {"uncertain", "illegible"}


def table(path: Path, columns: tuple[str, ...]) -> list[dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    head = lines[0].split("\t")
    absent = set(columns) - set(head)
    if absent:
        sys.exit(f"{path} has no {', '.join(sorted(absent))} column")
    return [dict(zip(head, line.split("\t"))) for line in lines[1:] if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cells", type=Path, default=DIR / "cells.tsv")
    parser.add_argument("--entries", type=Path, default=DIR / "entries.tsv")
    parser.add_argument("--sketched", action="store_true", help="date the rows today instead of asking")
    args = parser.parse_args()

    entries = {row["entry_id"]: row for row in table(args.entries, ("entry_id", "canvas", "band"))}
    cells = table(args.cells, ("entry_id", "position", "role", "glyph", "status", "glyph_note"))
    written = 0
    for entry_id, entry in entries.items():
        own = [row for row in cells if row["entry_id"] == entry_id]
        tangut = {int(row["position"]): row for row in own if row["role"] == "tangut"}
        written_for = 0
        for row in own:
            if row["role"] != "transcription":
                continue
            position = int(row["position"])
            # The transcription stands one column left of its Tangut character and holds one
            # character for it, so the two are matched by their position within their own role.
            head = tangut.get(position)
            if head is None or len(head["glyph"].strip()) != 1 or len(row["glyph"].strip()) != 1:
                continue
            doubts = [name for name in (head["glyph_note"], row["glyph_note"]) if name]
            doubtful = head["status"] in DOUBTFUL or row["status"] in DOUBTFUL
            if doubtful and not doubts:
                doubts = ["cell marked " + (head["status"] if head["status"] in DOUBTFUL else row["status"])]
            place = f"canvas {entry['canvas']}"
            if entry.get("band"):
                place += f" band {entry['band']}"
            print("\t".join((
                head["glyph"].strip(), "sound_li_fanwen", row["glyph"].strip(), WORK,
                f"{place} t{position}", " ".join(doubts),
                "uncertain" if doubtful else "keyed", date.today().isoformat(),
            )))
            written += 1
            written_for += 1
        if own and not written_for:
            print(f"{entry_id}: nothing paired", file=sys.stderr)
    print(f"{written} rows", file=sys.stderr)
    return 0 if written else 1


if __name__ == "__main__":
    raise SystemExit(main())

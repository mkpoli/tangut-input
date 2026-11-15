#!/usr/bin/env python3
"""Turn keyed 掌中珠 bands into the readings table.

The keying export has one line per printed column: canvas, band, the column's number from the band's
right edge, its role, and either the Chinese text of a transcription column or the code points of a
Tangut column. A transcription column and the Tangut column to its left hold the same number of
signs, one against one; each pair is the page's own 直音 and becomes a row.

    uv run scripts/key_zzz_readings.py --cells data/readings/cells/c41b1.tsv --write

The rows are merged into `data/readings/readings.tsv`: every 掌中珠 row on a canvas the export covers
is replaced, and every other row is kept as it stands. Without `--write` the rows go to stdout as a
list of files. A pair counts as `keyed` when the keyer marked it certain and `uncertain` otherwise,
with the keyer's words for that pair in the note.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

COLUMNS = ("canvas", "band", "index", "role", "glyph", "codepoints", "note")
WORK = "zhangzhongzhu"


def read(path: Path) -> list[dict[str, str]]:
    rows = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        fields = line.split("\t")
        if len(fields) < len(COLUMNS):
            fields += [""] * (len(COLUMNS) - len(fields))
        rows.append(dict(zip(COLUMNS, fields), line=str(number)))
    return rows


def clauses(note: str) -> list[tuple[str, str]]:
    """The note split into one piece per pair: (the character the piece names, its words).

    Words are everything the keyer wrote about that pair, so a parenthetical remark stays with it.
    """
    out = []
    for piece in re.split(r"[,;]\s*(?=[^,;]{1,6}→)", note):
        piece = piece.strip()
        if "→" not in piece:
            continue
        piece = piece.removeprefix("side=r; ").strip()
        target = re.search(r"→(\S+)", piece)
        if target:
            out.append((target.group(1), piece))
    return out


def verdict(words: str, fallback: str) -> str:
    if any(word in words for word in ("probable", "open", "uncertain")):
        return "uncertain"
    if "certain" in words:
        return "keyed"
    return fallback


TABLE = Path("data/readings/readings.tsv")
HEADER = ("char", "field", "value", "work", "locator", "note", "status", "checked")


def merge(table: Path, rows: list[dict[str, str]], canvases: set[str]) -> int:
    """Rewrite the table without the 掌中珠 rows on `canvases`, then add `rows`. Returns the count."""
    kept, dropped = [], 0
    for line in table.read_text(encoding="utf-8").splitlines():
        fields = line.split("\t")
        if fields[:1] == ["char"]:
            continue
        canvas = re.match(r"canvas (\d+) ", fields[4]) if len(fields) > 5 else None
        if fields[3] == WORK and canvas and canvas.group(1) in canvases:
            dropped += 1
            continue
        kept.append(line)
    table.write_text("\n".join(["\t".join(HEADER), *kept, *(row["line"] for row in rows)]) + "\n",
                     encoding="utf-8")
    return dropped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cells", type=Path, required=True, action="append",
                        help="a keying export; repeat for several")
    parser.add_argument("--write", type=Path, default=TABLE, help=f"the table to merge into (default {TABLE})")
    parser.add_argument("--drop-canvas", action="append", default=[],
                        help="also clear the rows on this canvas, for one that was mislabelled")
    args = parser.parse_args()

    rows = [row for path in args.cells for row in read(path)]
    today = date.today().isoformat()
    written = 0
    out = []
    for index, row in enumerate(rows):
        if row["role"] != "transcription" or index + 1 >= len(rows):
            continue
        head = rows[index + 1]
        if head["role"] != "tangut" or head["canvas"] != row["canvas"] or head["band"] != row["band"]:
            continue
        chinese = row["glyph"].strip()
        tangut = [chr(int(code[2:], 16)) for code in head["codepoints"].split()]
        # The keyer names each pair as 字→character 音reading; that piece carries the certainty.
        pieces = clauses(head["note"])
        # An unmarked pair is not evidence of anything; only an explicit `certain` counts.
        words = {word for word in re.split(r"[^a-z]+", head["note"].lower()) if word}
        loose = "keyed" if "certain" in words and not words & {"probable", "open", "uncertain"} else "uncertain"
        for place, (source, target) in enumerate(zip(chinese, tangut)):
            piece = next((words for pair, words in pieces if pair.startswith(target)), "")
            status = verdict(piece, loose)
            if len(source) != 1 or len(tangut) != len(chinese):
                status = "uncertain"
            out.append({"line": "\t".join((
                target, "sound_li_fanwen", source, WORK,
                f"canvas {row['canvas']} band {row['band']} c{head['index']}",
                piece or head["note"], status, today,
            ))})
            written += 1
    if not written:
        print("no pair found", file=sys.stderr)
        return 1
    canvases = {row["canvas"] for row in rows if row["role"] == "transcription"} | set(args.drop_canvas)
    dropped = merge(args.write, out, canvases)
    print(f"{written} rows written, {dropped} replaced on canvas {', '.join(sorted(canvases))}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Turn a keyed 掌中珠 band into reading rows.

The keying export has one line per printed column: canvas, band, the column's number from the band's
right edge, its role, and either the Chinese text of a transcription column or the code points of a
Tangut column. A transcription column and the Tangut column to its left hold the same number of
signs, one against one; each pair is the page's own 直音 and becomes a row.

    uv run scripts/key_zzz_readings.py --cells cache/zzz/cells-c40b1r.tsv

A pair counts as `keyed` when the keyer marked it certain and `uncertain` otherwise, with the keyer's
words for that pair in the note.
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cells", type=Path, required=True)
    args = parser.parse_args()

    rows = read(args.cells)
    today = date.today().isoformat()
    written = 0
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
        loose = "keyed" if "certain" in head["note"] and not any(
            word in head["note"] for word in ("probable", "open")) else "uncertain"
        for place, (source, target) in enumerate(zip(chinese, tangut)):
            piece = next((words for pair, words in pieces if pair.startswith(target)), "")
            status = verdict(piece, loose)
            if len(source) != 1 or len(tangut) != len(chinese):
                status = "uncertain"
            print("\t".join((
                target, "sound_li_fanwen", source, WORK,
                f"canvas {row['canvas']} band {row['band']} c{head['index']}",
                piece or head["note"], status, today,
            )))
            written += 1
    print(f"{written} rows", file=sys.stderr)
    return 0 if written else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Check a keying export before it becomes rows.

An export is one line per printed column of a band. The printed page fixes what a line may say: four
columns to a group in the order transcription, Tangut, gloss, spelling; the Tangut column and the
transcription column hold the same number of signs; every Tangut sign is a character the corpus has;
and a pair says how sure the keyer is, because the converter reads that word.

    uv run scripts/check_cells.py data/readings/cells/*.tsv

Exit 1 on any finding. The last group of a band may be ragged where the page ends.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ("canvas", "band", "index", "role", "glyph", "codepoints", "note")
ORDER = ("transcription", "tangut", "gloss", "spelling")
CERTAINTY = ("certain", "probable", "open")


def corpus() -> set[str]:
    data = json.load(gzip.open(ROOT / "app/data/tangut-entries.json.gz"))
    return {row[0] for row in data["rows"]}


def groups(path: Path) -> list[list[dict[str, str]]]:
    found: list[list[dict[str, str]]] = []
    current: list[dict[str, str]] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip() or line.startswith("#"):
            continue
        if line.strip() == "-":
            if current:
                found.append(current)
            current = []
            continue
        fields = line.split("\t")
        if len(fields) < len(COLUMNS):
            fields += [""] * (len(COLUMNS) - len(fields))
        current.append(dict(zip(COLUMNS, fields), line=str(number)))
    if current:
        found.append(current)
    return found


def main(argv: list[str]) -> int:
    known = corpus()
    bad = 0
    total = 0

    def report(path: Path, row: dict[str, str], why: str) -> None:
        nonlocal bad
        print(f"{path.name}:{row['line']}: {why}")
        bad += 1

    for name in argv[1:]:
        path = Path(name)
        seen = groups(path)
        total += len(seen)
        canvas, band = None, None
        expected = 1
        for number, group in enumerate(seen, start=1):
            last = number == len(seen)
            roles = [row["role"] for row in group]
            if not last and roles != list(ORDER):
                report(path, group[0], f"group {number} has {roles}, not {list(ORDER)}")
            elif last and roles != list(ORDER) and not set(roles) <= set(ORDER):
                report(path, group[0], f"group {number} has {roles}, which is not a shorter entry")
            for row in group:
                if canvas is None:
                    canvas, band = row["canvas"], row["band"]
                if (row["canvas"], row["band"]) != (canvas, band):
                    report(path, row, f"canvas {row['canvas']} band {row['band']} inside canvas {canvas} band {band}")
                try:
                    index = int(row["index"])
                except ValueError:
                    report(path, row, f"index {row['index']!r} is not a number")
                    continue
                if index != expected:
                    report(path, row, f"index {index} where the band is at {expected}")
                expected = index + 1
                points = [code for code in row["codepoints"].split() if code]
                for code in points:
                    if not re.fullmatch(r"U\+1[78][0-9A-F]{3}", code):
                        report(path, row, f"{code!r} is not a Tangut code point")
                    elif chr(int(code[2:], 16)) not in known:
                        report(path, row, f"{code} is not in the corpus")
            if roles and roles[0] == "tangut" or "transcription" in roles:
                tangut = next((row for row in group if row["role"] == "tangut"), None)
                transcription = next((row for row in group if row["role"] == "transcription"), None)
                if tangut and transcription:
                    signs = len([code for code in tangut["codepoints"].split() if code])
                    written = len(transcription["glyph"].strip())
                    if signs != written:
                        # A band can stop inside its last group; that is the page, not a mistake.
                        line = (f"{signs} Tangut signs against {written} transcribed")
                        if last:
                            print(f"{path.name}:{tangut['line']}: the band ends short: {line}")
                        else:
                            report(path, tangut, line)
                    if tangut["codepoints"].strip() and not any(
                            word in tangut["note"].lower() for word in CERTAINTY):
                        report(path, tangut, "the note names no certainty for its pairs")
    print(f"{total} groups in {len(argv) - 1} files")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

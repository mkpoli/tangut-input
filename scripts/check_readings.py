#!/usr/bin/env python3
"""Check data/readings/readings.tsv against its shape, its books and the character corpus.

The readings are keyed by hand, so this holds what a machine can hold: the columns, the field names,
the date, the work, and whether the character is one the site knows. Whether a value is right is a
reader's judgement, not this script's.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLE = ROOT / "data" / "readings" / "readings.tsv"
BOOKS = ROOT / "data" / "books" / "source.yaml"
ENTRIES = ROOT / "app" / "data" / "tangut-entries.json.gz"

COLUMNS = ("char", "field", "value", "work", "locator", "note", "status", "checked")
FIELDS = {
    "sound_li_fanwen": {"xiahan-zidian", "zhangzhongzhu"},
    "sound_nie_lishan": {"nevsky-1960"},
    "arakawa_shintaro": {"arakawa-tsuin"},
    "gong_huangcheng": {"ghc-2002", "ghc-2005"},
    "tibetan": {"-"},
    "wenhai_zh": {"wenhai-yanjiu"},
    "gloss_zh": {"xiahan-zidian"},
}
STATUSES = {"keyed", "checked", "uncertain"}
# A 直音 taken from 掌中珠 is a Chinese character printed for a Tangut one; the dictionaries print
# theirs inside a Chinese description that runs to a dozen characters.
PLAIN = {"zhangzhongzhu"}


def works() -> set[str]:
    if not BOOKS.exists():
        sys.exit(f"missing {BOOKS}")
    return {
        line.split(":", 1)[1].strip()
        for line in BOOKS.read_text(encoding="utf-8").splitlines()
        if line.startswith("  - id: ")
    }


def volumes() -> set[str]:
    """The works printed in volumes, which is the only case `vol` belongs to a locator."""
    found, current = set(), ""
    for line in BOOKS.read_text(encoding="utf-8").splitlines():
        if line.startswith("  - id: "):
            current = line.split(":", 1)[1].strip()
        elif line.startswith("    volumes:"):
            found.add(current)
    return found


def corpus() -> set[str]:
    with gzip.open(ENTRIES, "rt", encoding="utf-8") as handle:
        return {row[0] for row in json.load(handle)["rows"]}


def rows() -> list[tuple[int, list[str]]]:
    lines = TABLE.read_text(encoding="utf-8").splitlines()
    head = lines[0].split("\t")
    absent = set(COLUMNS) - set(head)
    if absent:
        sys.exit(f"readings.tsv has no {', '.join(sorted(absent))} column")
    if head.index("char") != 0 or head != list(COLUMNS):
        sys.exit(f"readings.tsv columns are {head}; want {list(COLUMNS)}")
    out = []
    for number, line in enumerate(lines[1:], start=2):
        if not line.strip():
            continue
        fields = line.split("\t")
        out.append((number, fields))
    return out


def main() -> int:
    bad = 0
    known = works()
    chars = corpus()
    volumed = volumes()

    def report(number: int, why: str) -> None:
        nonlocal bad
        print(f"readings.tsv:{number}: {why}")
        bad += 1

    seen: Counter[tuple[str, str, str]] = Counter()
    where: dict[tuple[str, str, str], int] = {}
    today = date.today().isoformat()
    for number, fields in rows():
        if len(fields) != len(COLUMNS):
            report(number, f"{len(fields)} fields where the table has {len(COLUMNS)}")
            continue
        row = dict(zip(COLUMNS, fields))
        char, field, value, work = row["char"], row["field"], row["value"], row["work"]
        if len(char) != 1 or not 0x17000 <= ord(char) <= 0x187FF:
            report(number, f"{char!r} is not one Tangut character")
        elif char not in chars:
            report(number, f"{char} is not in the entry corpus")
        if field not in FIELDS:
            report(number, f"unknown field {field!r}")
        elif work not in FIELDS[field]:
            allowed = ", ".join(sorted(FIELDS[field]))
            report(number, f"{field} comes from {allowed}, not {work!r}")
        if work != "-" and work not in known:
            report(number, f"work {work!r} is not in data/books/source.yaml")
        if not value.strip():
            report(number, "empty value")
        elif value != value.strip():
            report(number, "value has a space at an edge")
        if not row["locator"].strip():
            report(number, "no locator")
        elif work in PLAIN:
            if not re.fullmatch(r"canvas \d+( band \d+)?( c\d+)?", row["locator"]):
                report(number, f"locator {row['locator']!r} is not 'canvas <n> [band <n>] [c<n>]'")
        elif work != "-" and not re.fullmatch(r"(vol \d+ )?p\.\d+( line \d+)?( col \d+)?", row["locator"]):
            report(number, f"locator {row['locator']!r} is not 'p.<n>' or 'vol <n> p.<n>'")
        elif work not in volumed and row["locator"].startswith("vol "):
            report(number, f"{work} is one volume, so the locator needs no volume")
        elif work in volumed and not row["locator"].startswith("vol "):
            report(number, f"{work} is printed in volumes, so the locator needs 'vol <n>'")
        if row["status"] not in STATUSES:
            report(number, f"status {row['status']!r} is not one of {sorted(STATUSES)}")
        elif row["status"] == "uncertain" and not row["note"].strip():
            report(number, "an uncertain row says what is doubtful in note")
        try:
            checked = date.fromisoformat(row["checked"])
        except ValueError:
            report(number, f"checked {row['checked']!r} is not a date")
        else:
            if checked.isoformat() > today:
                report(number, f"checked {row['checked']} is in the future")
        key = (char, field, work)
        if key in where:
            print(f"readings.tsv:{number}: {char} repeats the {field} row at line {where[key]}")
            bad += 1
        where.setdefault(key, number)
        seen[key] += 1
        if work == "-" and not row["note"].strip():
            report(number, "a row without a work names its source in note")

    print(f"{len(seen)} values over {len({char for char, _, _ in seen})} characters")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())

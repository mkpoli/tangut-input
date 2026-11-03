# /// script
# requires-python = ">=3.11"
# ///
"""Build `app/data/tangut-gloss-readings.json.gz`, the word and reading a page shows for a character.

The site's Read page puts a Tangut text in front of a reader who wants to read it by meaning: under
each character stands the Chinese word it is glossed by, and under that the Japanese reading of that
word. This copies the two built tables into one file the page fetches:

- `char` → `[word, on, kun]`
- `word` is the gloss word from `data/tangut-gloss-words.tsv.gz`, for every tier that has one
  (`word`, `phrase`); a character without a word is left out.
- `on` and `kun` are the first reading of each kind from `data/tangut-gloss-readings.tsv.gz`. A
  phrase gloss has no single reading, so both are empty.

    uv run scripts/build_tangut_gloss_readings_app.py
"""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORDS = ROOT / "data" / "tangut-gloss-words.tsv.gz"
READINGS = ROOT / "data" / "tangut-gloss-readings.tsv.gz"
TARGET = ROOT / "app" / "data" / "tangut-gloss-readings.json.gz"


def rows(path: Path) -> list[list[str]]:
    text = gzip.decompress(path.read_bytes()).decode()
    return [line.split("\t") for line in text.splitlines() if line and not line.startswith("#")]


def build() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for char, gloss, tier, _ in rows(WORDS):
        if tier in ("word", "phrase"):
            out[char] = [gloss, "", ""]
    for char, _, _, on, kun in rows(READINGS):
        if char in out:
            out[char][1] = (on.split() or [""])[0]
            out[char][2] = (kun.split() or [""])[0]
    return dict(sorted(out.items(), key=lambda item: ord(item[0])))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(argv)
    entries = build()
    document = {
        "format": "tangut-input/gloss-readings",
        "rows": entries,
    }
    TARGET.write_bytes(gzip.compress(json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode(), 9, mtime=0))
    words = sum(1 for value in entries.values() if value[0])
    on = sum(1 for value in entries.values() if value[1])
    kun = sum(1 for value in entries.values() if value[2])
    print(f"wrote {TARGET} ({len(entries)} characters, {words} words, {on} on, {kun} kun, {TARGET.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# /// script
# requires-python = ">=3.11"
# ///
"""Build `data/tangut-gloss-readings.tsv.gz`, how to read the word each Tangut character is read by.

`data/tangut-gloss-words.tsv.gz` gives 3,117 characters one Chinese character to be read as. This
adds the readings of that character, so a line of Tangut can be turned into Chinese or Japanese
words without looking each gloss up: 佛 is *fo2* or *fu2*, ブツ or フツ, ほとけ.

The readings are KANJIDIC2's, in the order KANJIDIC2 writes them: the pinyin tones are tone numbers
as that file has them, and a kun reading keeps its dot (い.く for 行). A character KANJIDIC2 does not
carry, such as 說, keeps empty columns; its Japanese form 説 is a different character and its
readings are not copied across.

Only the `word` tier is read. A gloss of several characters is a phrase whose Japanese reading is
not its parts joined — 世界 is セカイ, not よかい — so it waits for an editor.

KANJIDIC2 is fetched into `cache/` against its pinned SHA-256. The file is shared alike under
CC BY-SA 4.0, because its readings are.

    uv run scripts/build_tangut_gloss_readings.py [--refresh]
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "cache"
WORDS = ROOT / "data" / "tangut-gloss-words.tsv.gz"
TARGET = ROOT / "data" / "tangut-gloss-readings.tsv.gz"

KANJIDIC2_URL = "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz"
KANJIDIC2_SHA256 = "fb6b3e73acd412b7b1b3a390eab24aa6a543a2779edc72be330419a0ec445a4a"

READING_TYPES = {"pinyin": "pinyin", "ja_on": "on", "ja_kun": "kun"}


def fetch(url: str, dest: Path, sha256: str, refresh: bool = False) -> Path:
    if refresh or not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "tangut-input gloss readings build"})
        with urllib.request.urlopen(request, timeout=300) as response:
            dest.write_bytes(response.read())
    found = hashlib.sha256(dest.read_bytes()).hexdigest()
    if found != sha256:
        raise ValueError(f"{dest} does not match the pinned SHA-256 of {url}: {found}")
    return dest


def rows(path: Path) -> list[list[str]]:
    return [line.split("\t") for line in gzip.decompress(path.read_bytes()).decode().splitlines() if line and not line.startswith("#")]


def readings(wanted: set[str], path: Path) -> dict[str, dict[str, list[str]]]:
    """Pinyin, on and kun readings by character, in KANJIDIC2's order."""
    out: dict[str, dict[str, list[str]]] = {}
    with gzip.open(path, "rb") as source:
        for _, element in ET.iterparse(source, events=("end",)):
            if element.tag != "character":
                continue
            literal = element.findtext("literal")
            if literal not in wanted:
                element.clear()
                continue
            found: dict[str, list[str]] = {"pinyin": [], "on": [], "kun": []}
            for reading in element.iter("reading"):
                kind = READING_TYPES.get(reading.get("r_type", ""))
                # A hyphen marks a bound form, not how the character is read on its own: 日 is ひ,
                # and -び, -か and うわ- belong to the words it ends or begins.
                if kind and reading.text and "-" not in reading.text:
                    found[kind].append(reading.text)
            out[literal] = found
            element.clear()
    return out


def build(words: list[list[str]], by_char: dict[str, dict[str, list[str]]]) -> list[tuple[str, str, str, str, str]]:
    out = []
    for char, gloss, tier, _ in words:
        if tier != "word":
            continue
        found = by_char.get(gloss, {})
        out.append((
            char,
            gloss,
            " ".join(found.get("pinyin", [])),
            " ".join(found.get("on", [])),
            " ".join(found.get("kun", [])),
        ))
    out.sort(key=lambda row: ord(row[0]))
    return out


def header(built: list[tuple[str, str, str, str, str]]) -> str:
    pinyin = sum(1 for row in built if row[2])
    on = sum(1 for row in built if row[3])
    kun = sum(1 for row in built if row[4])
    return f"""# How to read the Chinese word given for each Tangut character.
# columns: char, gloss, pinyin, on, kun
# rows: {len(built)}
# pinyin: KANJIDIC2 pinyin in its tone numbers, space-separated ({pinyin} rows)
# on: KANJIDIC2 ja_on readings, space-separated ({on} rows)
# kun: KANJIDIC2 ja_kun readings, space-separated, with the dot of an okurigana stem; bound forms
#   that KANJIDIC2 marks with a hyphen at either end are left out ({kun} rows)
# Only the word tier of data/tangut-gloss-words.tsv.gz is read; a phrase gloss is left to an editor.
# gloss: from data/tangut-gloss-words.tsv.gz, MIT, following the entries file
# Built by scripts/build_tangut_gloss_readings.py.
# source: KANJIDIC2, file version 4, database version 2026-307, created 2026-11-03,
#   https://www.edrdg.org/kanjidic/kanjidic2.xml.gz, SHA-256 {KANJIDIC2_SHA256}
#   Electronic Dictionary Research and Development Group, Copyright EDRDG, CC BY-SA 4.0
# licence: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="fetch KANJIDIC2 again")
    args = parser.parse_args(argv)
    words = rows(WORDS)
    wanted = {gloss for _, gloss, tier, _ in words if tier == "word"}
    by_char = readings(wanted, fetch(KANJIDIC2_URL, CACHE / "kanjidic2.xml.gz", KANJIDIC2_SHA256, args.refresh))
    built = build(words, by_char)
    text = header(built) + "".join("\t".join(row) + "\n" for row in built)
    TARGET.write_bytes(gzip.compress(text.encode("utf-8"), 9, mtime=0))
    print(f"wrote {TARGET} ({len(built)} characters, {TARGET.stat().st_size} bytes)")
    print(f"  gloss characters KANJIDIC2 does not carry: {len(wanted) - len(by_char)}")
    for label, index in (("pinyin", 2), ("on", 3), ("kun", 4)):
        filled = sum(1 for row in built if row[index])
        print(f"  {label:<7}{filled:>6}  {filled / len(built):5.1%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

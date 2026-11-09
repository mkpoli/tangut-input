# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build `app/data/tangut-ids-aliases.json`, the other descriptions the parts index and the card read.

The source is `data/tangut-ids-aliases.tsv`, one line per description,
`char<TAB>IDS<TAB>source<TAB>detail<TAB>lang`. Each description is checked before it is written: the
character is one Tangut ideograph, the description is complete, every operand is a Tangut character
or component, and the description is not the one the character's record already carries. `lang`
names the language of `detail` and is required whenever a detail is given.

    uv run scripts/build_tangut_ids_aliases.py

Reads `app/data/tangut-entries.json.gz` and `app/data/tangut-supplement.json.gz` to compare each
alias with the recorded description.
"""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "tangut-ids-aliases.tsv"
TARGET = ROOT / "app" / "data" / "tangut-ids-aliases.json"
ENTRIES = ROOT / "app" / "data" / "tangut-entries.json.gz"
SUPPLEMENT = ROOT / "app" / "data" / "tangut-supplement.json.gz"
OPERATORS = set("⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿽㇯")
ARITY = {"⿲": 3, "⿳": 3, "⿽": 2, "㇯": 2}
IDEOGRAPH = range(0x17000, 0x18800)
IDEOGRAPH_D = range(0x18D00, 0x18D80)
COMPONENTS = range(0x18800, 0x18B00)
COMPONENTS_D = range(0x18D80, 0x18E00)
LANG = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$")


def one_char(text: str, where: str) -> str:
    chars = list(text)
    if len(chars) != 1:
        raise ValueError(f"{where}: {text!r} is not one character")
    return chars[0]


def check_description(char: str, text: str, where: str) -> None:
    """Whether the whole string is one description IDS can read, of the given character's glyph."""
    chars = list(text)
    if not chars:
        raise ValueError(f"{where}: the description is empty")
    at = 0

    def node() -> None:
        nonlocal at
        if at >= len(chars):
            raise ValueError(f"{where}: {text!r} stops before an operand")
        char_at = chars[at]
        at += 1
        if char_at in OPERATORS:
            for _ in range(ARITY.get(char_at, 2)):
                node()
            return
        code = ord(char_at)
        if not (code in IDEOGRAPH or code in IDEOGRAPH_D or code in COMPONENTS or code in COMPONENTS_D):
            raise ValueError(f"{where}: {char_at!r} is not a Tangut character or component")
        if char_at == char:
            raise ValueError(f"{where}: the description names the character itself")

    node()
    if at != len(chars):
        raise ValueError(f"{where}: {text!r} has an operand left over")
    if char not in text and len(chars) == 1:
        raise ValueError(f"{where}: {text!r} is a component, not a description of {char}")


def recorded_descriptions() -> dict[str, str]:
    data = json.loads(gzip.decompress(ENTRIES.read_bytes()))
    recorded = {row[0]: row[1] for row in data["rows"] if row[1]}
    supplement = json.loads(gzip.decompress(SUPPLEMENT.read_bytes()))
    # The app adds the supplement's ideographs to its entries; an alias may stand beside one.
    for record in supplement["characters"]:
        if record.get("block") != "components" and record.get("ids"):
            recorded.setdefault(record["char"], record["ids"])
    return recorded


def read_rows() -> list[dict[str, str]]:
    recorded = recorded_descriptions()
    rows: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for number, line in enumerate(SOURCE.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        fields = line.split("\t")
        where = f"{SOURCE.name}:{number}"
        if len(fields) not in (4, 5):
            raise ValueError(f"{where}: needs a character, a description, a source, a detail and a language")
        char = one_char(fields[0], where)
        code = ord(char)
        if not (code in IDEOGRAPH or code in IDEOGRAPH_D):
            raise ValueError(f"{where}: {char!r} is not a Tangut ideograph")
        ids, source, detail = (field.strip() for field in fields[1:4])
        lang = fields[4].strip() if len(fields) == 5 else ""
        if not source:
            raise ValueError(f"{where}: the source is empty")
        if detail and not lang:
            raise ValueError(f"{where}: the detail needs a language")
        if lang and not LANG.match(lang):
            raise ValueError(f"{where}: {lang!r} is not a language tag")
        check_description(char, ids, where)
        if char not in recorded:
            raise ValueError(f"{where}: {char!r} has no recorded description to stand beside")
        if recorded[char] == ids:
            raise ValueError(f"{where}: {ids!r} is already the character's recorded description")
        if (char, ids) in seen:
            raise ValueError(f"{where}: {ids!r} is listed twice")
        seen.add((char, ids))
        rows.append({"char": char, "ids": ids, "source": source, "detail": detail, **({"lang": lang} if lang else {})})
    return rows


def main() -> None:
    rows = read_rows()
    compact = {"format": "tangut-input/ids-aliases", "version": 1, "rows": rows}
    raw = json.dumps(compact, ensure_ascii=False, separators=(",", ":")).encode()
    TARGET.write_text(raw.decode() + "\n", encoding="utf-8")
    print(f"{len(rows)} aliases -> {TARGET.relative_to(ROOT)} ({len(raw)} bytes)")


if __name__ == "__main__":
    main()

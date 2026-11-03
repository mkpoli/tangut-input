# /// script
# requires-python = ">=3.11"
# ///
"""Build `data/tangut-gloss-words.tsv.gz`, the one word each Tangut character is glossed by.

A table that reads a Tangut character by its meaning needs one word for each character. The Chinese
gloss in `app/data/tangut-entries.json.gz` gives that word for most of them; for the rest it gives a
phrase, a note about the character, or the foreign sound the character writes. The tier records
which:

- `word` — one Chinese character (毒, 佛, 日), which can be read as it stands
- `phrase` — two to four characters (菩薩, 世界)
- `long` — five or more characters, or a note (白蹄杂色马, （滴）答, 用在…)
- `transliteration` — the character writes a foreign sound (【宿】), so there is no meaning to read
- `empty` — nothing to read: no gloss, 暫無解釋, or 不識
- `redirect` — the entry points at another character instead of glossing this one

The gloss is the first sense of the first Chinese gloss string. Senses are separated by 、；， or a
space outside brackets; numbering, part-of-speech tags and placeholder senses are dropped; a short bracket before a
word joins it (（滴）答 is 滴答). The reading is Gong Xun's 202411 reconstruction, the column the
site shows first. The script also prints how much of `app/data/tangut-attestation.json.gz` each tier
covers.

    uv run scripts/build_tangut_gloss_words.py
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENTRIES = ROOT / "app" / "data" / "tangut-entries.json.gz"
CORPUS = ROOT / "app" / "data" / "tangut-attestation.json.gz"
TARGET = ROOT / "data" / "tangut-gloss-words.tsv.gz"

# What Open Tangut writes after a gloss: the part of speech, or a note that the word is borrowed.
TAGS = "名詞|動詞|形容詞|副詞|量詞|助詞|代詞|數詞|連詞|介詞|感嘆詞|擬聲詞|漢語借詞|譯音|音譯"
TAG_END = re.compile(rf"[\s　]*(?:{TAGS})\s*$")
TAG_ONLY = re.compile(rf"^(?:{TAGS})$")
NUMBER = re.compile(r"^\d+\.")
SEPARATORS = "、；;，,／/　 "
REDIRECT = re.compile(r"^重定向至")

# Senses that say only that the character has no recorded meaning.
PLACEHOLDERS = {"暫無解釋", "不識"}
# Senses that describe how a character is used, rather than name a meaning.
NOTE_STARTS = ("用在", "用於", "僅用於", "作為", "表示", "相當於", "構成", "常附", "常加", "具有")
# The entries mark a character with no recorded meaning this way.


def senses(text: str) -> list[str]:
    """Split a gloss string at separators that stand outside brackets."""
    out: list[str] = []
    buffer: list[str] = []
    depth = 0
    for char in text:
        if char in "（(":
            depth += 1
        elif char in "）)":
            depth = max(0, depth - 1)
        if depth == 0 and char in SEPARATORS:
            out.append("".join(buffer))
            buffer = []
        else:
            buffer.append(char)
    out.append("".join(buffer))
    return [part.strip() for part in out if part.strip()]


def is_note(text: str) -> bool:
    """A sense that is only a bracketed remark."""
    return text.startswith(("（", "(")) and text.endswith(("）", ")"))


def read(entry: list) -> tuple[str, str]:
    """The word to read a character by, and the tier that says what kind of word it is."""
    chinese = entry[6]
    if not chinese:
        return "", "empty"
    gloss = chinese[0]
    if REDIRECT.match(gloss):
        return "", "redirect"
    parts = []
    for sense in senses(NUMBER.sub("", gloss)):
        sense = NUMBER.sub("", sense.strip())
        while True:
            tag = TAG_END.search(sense)
            if not tag:
                break
            sense = sense[: tag.start()]
        if not sense or TAG_ONLY.match(sense) or sense in PLACEHOLDERS or sense in ("【】", "（）"):
            continue
        if sense.startswith("不識"):
            continue
        parts.append(sense)
    # A note that stands alone before the word explains it: (解剖學) 肘 is 肘.
    while len(parts) > 1 and is_note(parts[0]):
        parts.pop(0)
    if not parts:
        return "", "empty"
    word = parts[0]
    if "【" in word or "譯音" in word or "音譯" in word:
        return word, "transliteration"
    if word.startswith(NOTE_STARTS) or word.startswith(("（", "(")) or word.endswith("。"):
        return word, "long"
    if len(word) == 1:
        return word, "word"
    if len(word) <= 4:
        return word, "phrase"
    return word, "long"


def build(entries: list[list]) -> list[tuple[str, str, str, str]]:
    rows = []
    for entry in sorted(entries, key=lambda row: ord(row[0])):
        char = entry[0]
        word, tier = read(entry)
        reading = entry[7][2] if len(entry[7]) > 2 else ""
        rows.append((char, word, tier, reading))
    return rows


def coverage(rows: list[tuple[str, str, str, str]]) -> Counter:
    """How many characters of the attested corpus each tier holds.

    Only the ideographs of U+17000–U+187FF are counted: the corpus also carries a few Tangut
    Supplement characters that the entries do not cover, and the table has no row for them.
    """
    tiers = {char: tier for char, _, tier, _ in rows}
    seen: Counter = Counter()
    corpus = json.loads(gzip.decompress(CORPUS.read_bytes()))
    for line in corpus["lines"].values():
        for char in line["text"]:
            if 0x17000 <= ord(char) <= 0x187FF:
                seen[tiers.get(char, "empty")] += 1
    return seen


def header(rows: list[tuple[str, str, str, str]], counts: Counter) -> str:
    tiers = ", ".join(f"{tier} {count}" for tier, count in counts.most_common())
    return f"""# The one word each Tangut character is glossed by, for reading a character by its meaning.
# columns: char, gloss, tier, reading
# rows: {len(rows)}
# tier: {tiers}
# gloss: the first sense of the first Chinese gloss, without its numbering, part-of-speech tags or placeholder senses
# reading: Gong Xun's 202411 reconstruction
# Built by scripts/build_tangut_gloss_words.py from app/data/tangut-entries.json.gz.
# licence: MIT, following the entries file
# source: Open Tangut, which merges CCAMC and Wiktionary; https://github.com/imlooh/open-tangut
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(argv)
    entries = json.loads(gzip.decompress(ENTRIES.read_bytes()))["rows"]
    rows = build(entries)
    counts = Counter(tier for _, _, tier, _ in rows)
    text = header(rows, counts) + "".join("\t".join(row) + "\n" for row in rows)
    TARGET.write_bytes(gzip.compress(text.encode("utf-8"), 9, mtime=0))
    print(f"wrote {TARGET} ({len(rows)} characters, {TARGET.stat().st_size} bytes)")
    if CORPUS.exists():
        seen = coverage(rows)
        total = sum(seen.values())
        print(f"corpus: {total} characters")
        for tier, count in seen.most_common():
            print(f"  {tier:<16}{count:>6}  {count / total:5.1%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

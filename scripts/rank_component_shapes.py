# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy"]
# ///
"""Rank Tangut components by how closely they resemble the attested Japanese shape names.

This is a review aid, not a source of names. The output is a separate inferred file; its rows are
candidates with a similarity score, never a claim that the component is called that. The attested
rows live in `data/tangut-component-names.tsv`.

The comparison uses the component's ink, fitted to a 56×56 square, against each attested example
rendered from the same face. It cannot separate forms whose difference is stroke continuity: くノ
and ノメ score about 0.98 against each other in Tangut Yinchuan. Stroke counts are recorded beside
each candidate so a reviewer can reject a shape that only looks alike.

    uv run scripts/rank_component_shapes.py [--font FONT] [--out PATH]
"""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
NAMES = ROOT / "data" / "tangut-component-names.tsv"
STROKES = ROOT / "data" / "tangut-component-strokes.tsv"
DEFAULT_FONT = ROOT / "app" / "public" / "fonts" / "TangutYinchuan.ttf"
DEFAULT_OUT = ROOT / "data" / "tangut-component-shape-hints.json.gz"
SIZE = 56
PAINT = 160


def read_names() -> list[tuple[str, str, int | None]]:
    rows: list[tuple[str, str, int | None]] = []
    for line in NAMES.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        name, char, *_ = line.split("\t")
        rows.append((name, char, None))
    return rows


def read_strokes() -> dict[int, int]:
    counts: dict[int, int] = {}
    for line in STROKES.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        key, value = line.split("\t")
        counts[int(key[2:], 16)] = int(value)
    return counts


def vector(char: str, font: ImageFont.FreeTypeFont) -> np.ndarray | None:
    image = Image.new("L", (PAINT + 60, PAINT + 60), 0)
    ImageDraw.Draw(image).text((30, 20), char, font=font, fill=255)
    ink = np.asarray(image)
    ys, xs = np.where(ink > 20)
    if not len(xs):
        return None
    ink = ink[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    height, width = ink.shape
    scale = min((SIZE - 8) / width, (SIZE - 8) / height)
    fitted = Image.fromarray(ink).resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.LANCZOS)
    square = Image.new("L", (SIZE, SIZE), 0)
    square.paste(fitted, ((SIZE - fitted.width) // 2, (SIZE - fitted.height) // 2))
    square = square.filter(ImageFilter.GaussianBlur(0.8))
    data = np.asarray(square, dtype=np.float32).ravel()
    return data / (np.linalg.norm(data) + 1e-9)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path, default=DEFAULT_FONT)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    font = ImageFont.truetype(str(args.font), PAINT)
    strokes = read_strokes()
    exemplars = []
    for name, char, _ in read_names():
        vec = vector(char, font)
        if vec is None:
            raise ValueError(f"{char} has no ink in {args.font}")
        exemplars.append({"name": name, "char": char, "strokes": strokes.get(ord(char)), "vector": vec})

    components = []
    for cp in range(0x18800, 0x18B00):
        char = chr(cp)
        vec = vector(char, font)
        if vec is None:
            continue
        ranked = []
        for exemplar in exemplars:
            if exemplar["char"] == char:
                continue
            score = float(vec @ exemplar["vector"])
            ranked.append({
                "name": exemplar["name"],
                "char": exemplar["char"],
                "score": round(score, 3),
                "strokes": exemplar["strokes"],
                "sameStrokes": exemplar["strokes"] is not None and strokes.get(cp) == exemplar["strokes"],
            })
        ranked.sort(key=lambda row: (-row["score"], row["char"]))
        components.append({
            "char": char,
            "codepoint": f"U+{cp:X}",
            "strokes": strokes.get(cp),
            "named": any(exemplar["char"] == char for exemplar in exemplars),
            "candidates": ranked[:3],
        })

    doc = {
        "format": "tangut-input/component-shape-hints",
        "version": 1,
        "editorial": True,
        "note": "Nearest attested shape names by ink similarity. Every candidate is a hint for review, not a name; the attested rows are data/tangut-component-names.tsv.",
        "method": {
            "font": args.font.name,
            "paint": PAINT,
            "size": SIZE,
            "metric": "cosine similarity of pre-blurred 56x56 ink bitmaps",
            "limitation": "Stroke continuity is not captured: くノ and ノメ score about 0.98 against each other in this face.",
        },
        "counts": {"components": len(components), "exemplars": len(exemplars)},
        "exemplars": [{"name": e["name"], "char": e["char"], "strokes": e["strokes"]} for e in exemplars],
        "components": components,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(args.out, "wb", mtime=0) as handle:
        handle.write(json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode())

    print(f"{len(components)} components, {len(exemplars)} exemplars -> {args.out}")
    print("Leave-one-out nearest names:")
    for exemplar in exemplars:
        ranked = [
            (float(exemplar["vector"] @ other["vector"]), other["name"])
            for other in exemplars if other["char"] != exemplar["char"]
        ]
        ranked.sort(reverse=True)
        print(f"  {exemplar['name']} {exemplar['char']}: " + ", ".join(f"{name} {score:.2f}" for score, name in ranked[:2]))


if __name__ == "__main__":
    main()

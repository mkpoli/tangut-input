# Tangut OCR microbenchmark

Twenty-four printed Tangut signs, six vertical columns, one band of 番漢合時掌中珠. A run names each
sign by code point; the score is exact matches out of 24. The sample is small and one printing, so it
separates a reader from a non-reader, not two good readers.

## Sample

Canvas 40, band 1 of the National Institute of Japanese Literature's scan of the 貽安堂 print
([DOI 10.20730/100354804](https://kokusho.nijl.ac.jp/biblio/100354804), CC BY-NC 4.0). The six
Tangut columns are 2, 6, 10, 14, 18 and 22, counted from the band's right edge. Their answers are
the 24 code points in `sample.json`, keyed by eye in `data/readings/cells/c40b1.tsv`.

The image is not in this repository: its licence is non-commercial. Fetch the canvas with
`uv run scripts/fetch_zhangzhongzhu.py --canvas 40`, then cut the opening band at native size. The
sample used a 3,780 × 1,000 crop of both leaves; the segmenter writes narrower per-side bands, which
have to be joined at the gutter.

## Run

`run.py` needs a clone of [FlagRain/tangut-mixocr](https://github.com/FlagRain/tangut-mixocr) (MIT)
with its `weights/`, plus `onnxruntime`, `opencv-python-headless`, `pillow`, `pyclipper` and
`numpy`.

```sh
uv run benchmark/ocr/run.py --model ~/src/tangut-mixocr \
  --image path/to/c40-b1.jpg --mode column --out predictions.jsonl
bun benchmark/ocr/score.mjs predictions.jsonl
```

`--mode column` cuts each column into four glyphs and lays them side by side, as the site's band
reader does. `--mode single` reads each glyph alone. A submission is one JSON object per line:

```json
{"id": "c40b1-c02-1", "char": "𗉛"}
```

## Baseline, 2026-11-17

| Run | Mode | Right |
| --- | --- | ---: |
| Tesseract 5.5.2, `chi_sim`, `--psm 10` | one glyph | 0/24 |
| tangut-mixocr v1 | one glyph | 9/24 |
| tangut-input band reader | four glyphs a column | 11/24 |

The band reader's result is 11/24 on the full band; the 2026-11-07 note in
`data/readings/cells/README.md` records 9/24 for the model reading one glyph at a time, which is the
same number this sample gives.

## A general-engine check

Measured 2026-11-07. On five 夏漢字典 pages, a route over OvisOCR3, Unlimited-OCR-2, GLM-OCR and PaddleOCR-VL 1.6
put a Han character at 738 of 821 Tangut positions, and no engine put a Tangut code point. That
run used different pages and is not part of the 24-sign score.

## Caveats

- Twenty-four signs from one printing. A score here is a smoke test, not a measure of a model on
  manuscripts, other typefaces or running text.
- The answers are keyed by eye. Five of the 24 are marked `probable` or `open` in the keying note,
  so a "wrong" answer on those may be the key's fault.
- A model trained on this band's answers would score 24/24 and mean nothing. Say what you trained
  on.

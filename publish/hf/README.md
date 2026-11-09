---
license: cc-by-4.0
language:
  - txg
task_categories:
  - image-to-text
tags:
  - handwriting
  - tangut
  - stroke-recognition
  - low-resource
size_categories:
  - n<1K
configs:
  - config_name: default
    data_files:
      - split: train
        path: tangut-strokes.jsonl
---

# Tangut strokes

![Drawings beside their characters](cover.png)

Strokes drawn on https://tangut.mkpo.li/dataset/ with a mouse, a trackpad or a stylus, each kept with
the character it was made for. The pad records the path of the pointer at one width, by visitors with
no training in the script, to test character recognition for a search box.

- 211 drawings of 180 characters, 6,136 characters in the script
- strokes are polylines in the unit square, in drawing order
- `label` is `answer` where the character was shown to the writer, `picked` where it is only what a
  reader chose from the results — score on `answer` records only
- `split.json` fixes 84 dev and 106 test drawings; `benchmark` scores a ranked list of up to 24
  characters per drawing

## Baseline

The site's own matcher, across five typefaces: 32.1% first, 57.5% in five, 75.5% in 24, MRR 0.440.
Predictions are in `baseline-submission.jsonl`; `score.mjs` reproduces the figures.

## Citation

Tangut stroke dataset, tangut.mkpo.li, CC BY 4.0. The printed characters are not part of this release;
they belong to the typefaces the site draws with, each under its own licence, listed in
https://github.com/mkpoli/tangut-input/blob/main/docs/materials.md

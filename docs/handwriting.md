# Handwriting

Strokes drawn on the quiz's pad with a mouse, a trackpad or a stylus — one width per drawing, by visitors
rather than by calligraphers, for recognition in a search box — kept under `data/handwriting/`, which is
ignored by git: the recordings stay on the machine that made them. The quiz writes them and rebuilds
the dataset after every saved drawing; `bun run quiz:dataset` rebuilds it on its own.

## A round

```
data/handwriting/2026-11-01T14-53-08/
  001-17925.json      one drawing, named after its place and the answer's code point
  002-179bf.json
  session.json        when the round started, its seed and size, and every record
  glyph-17925.png     a prompt image, drawn on first use
```

Each `NNN-<code>.json` holds one drawing:

| Field | |
| --- | --- |
| `char` | the character that was asked for |
| `kind` | `glyph` for a random ideograph, `lookalike` for one of five shapes close to the previous answer |
| `lookalikes` | the five the prompt could have been, for a `lookalike` |
| `strokes` | the pen's path, `[[[x, y], …], …]`, normalised to the pad's width and height |
| `times` | milliseconds after the first point, per point |
| `pressure` | the pointer's pressure per point, or `0` where the device reports none |
| `pointer` | `mouse`, `pen` or `touch` |
| `writer` | what the reader typed into the writer box, or `null` |
| `device` | the platform and browser |
| `width`, `height` | the pad's size in pixels, which the strokes were normalised by |
| `at` | when it was saved |

`times`, `pressure` and `pointer` are missing from drawings made before the quiz recorded them.

## The dataset

`data/handwriting/dataset.jsonl.gz` is every drawing, one JSON record per line, with its session
beside it:

```json
{"id":"2026-11-01T14-53-08/001","char":"𗤥","code":"U+17925","kind":"glyph","lookalikes":null,
 "strokes":[[[0.3275,0.2091],…]],"strokeCount":9,"times":null,"pressure":null,"pointer":null,
 "writer":null,"device":null,"width":340,"height":340,"at":"2026-11-01T14:56:50.141Z",
 "session":{"dir":"2026-11-01T14-53-08","seed":11,"started":"2026-11-01T14:53:08.228Z"}}
```

`data/handwriting/dataset.json` is its manifest: the schema version, when it was built, how many
drawings and sessions, the kinds, the writers, and how many drawings have no timing.

The session folders remain the source of truth. A record adds only its place in a session to the
fields above, and nothing in the folders is rewritten.

## Drawing a round

```sh
bun run quiz --port 5411 --size 40 --seed 31
```

Round kinds alternate: a random ideograph, then a lookalike of it, and so on. The page never learns
the answer, so a drawing is saved against what was on screen.

`scripts/handwriting/score.mjs` ranks a session's drawings against the shapes the Draw page uses:

```sh
bun run quiz:score data/handwriting/2026-11-01T14-53-08 --shapes app/data/tangut-shapes.bin.gz,app/data/tangut-shapes-std.bin.gz --strokes 1
```

## Glyphs that are no character

A drawing can be of a shape no character has — a component swapped for a neighbour, or a stroke
short at the end. `2026-11-01T14-53-08/032-17402.json` is one: ⿲𘫺𘦳⿱𘠛𘥷, drawn with sixteen
strokes against the eighteen 𗐂 (U+17402) is recorded with, one short at the end. It is marked
`unattested` and corrected to 𗐂.

The search does not need the stroke count put aside for this: with it, 𗐂 ranks first and 𗐁 second;
without it, 𗐂 is still first and 𗐁 fourth. The stroke term is soft, so a missing stroke moves a
character down a place or two rather than out of reach, which is what makes a first-page correction
possible for a glyph that does not exist.

## What the search does on the corpus

Measured on the 55 drawings a reviewer called fair, split in half, with the weights read on one
half and reported on the other:

| | First | In five | In a page | MRR |
| --- | ---: | ---: | ---: | ---: |
| Tuning half | 46% | 75% | 86% | 0.60 |
| Test half | 59% | 78% | 89% | 0.70 |

`bun scripts/bench_tangut_drawings.mjs --good` reproduces it; leave `--good` off to see the whole
corpus, where the eight scribbles a reviewer threw out pull the figures down. The defaults
(direction weight 2, stroke weight 0.35, re-ranking the first 150 by block direction at weight 0.5)
are the best of the settings swept on that subset: direction weight 0 or 1 loses 7 to 20 points of
first place, a heavier or absent stroke term loses 4 to 10, and a shallower or deeper re-rank loses
5 points of five-place accuracy.

Where the intended character sat, across the 31 drawings a reviewer corrected: first in 10, within
five in 7 more, within thirty in 11 more, absent 3 — 90% within the first page, median rank 3.

## What has not worked

Four attempts, each measured on the same frozen split, none kept:

| Attempt | Measured | Why it fails |
| --- | --- | --- |
| A convolutional classifier over augmented skeletons | 5% first place on the fair drawings | the corpus is font lines against two hands |
| Weights learned from the corrections as ranked pairs | 46.0% to 36.3% first place | the loss drives every term to one shrunken value: the corrections ask for different features, not different weights |
| Scoring a candidate by whether its IDS parts appear in the drawing | worse at every weight, 66.4% to 50.4% and down | a part found anywhere in a busy drawing says little; the test needs position |
| Ranking against other hand drawings instead of typefaces | 2.5% first place | the corpus holds about one drawing per character, so a neighbour is almost never the same character |

The common cause is the corpus: 296 drawings of 245 characters from two writers. Every method that needs
many drawings per character — a classifier, a learned metric, exemplar matching — is starved, and the one
method that needs none, chamfer against typeface skeletons, is what the site runs.

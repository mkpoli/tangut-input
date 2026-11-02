# Handwriting

Drawings of Tangut characters made on the quiz's pad, kept under `data/handwriting/`, which is
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

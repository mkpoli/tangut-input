# Kaggle: text to paste into the web form

## Subtitle
Strokes drawn with a mouse, for recognising Tangut characters

## File descriptions

- **tangut-strokes.jsonl** — 211 drawings, one JSON record per line: the character, the polylines drawn for it in the unit square, and when.
- **split.json** — the fixed 84 dev and 106 test drawings; scores are only comparable against this split.
- **baseline-submission.jsonl** — the site's own matcher, ranking 24 characters per test drawing: 34.0% first, 60.4% in five, MRR 0.459.
- **submission-template.csv** — the shape a competition submission takes: one row per test drawing, 24 rank columns.
- **annotations.json** — a reviewer's verdict on 103 drawings, and the character 32 of them should have been.

## Cover image
`publish/cover.png` (1200×630), uploaded through the dataset page: **Edit → Cover image**.

## Column descriptors (web form → Columns)

- **id** — the drawing's file name under `data/handwriting/`, `session/file.json`; matches the ids in `split.json` and the baseline
- **char** — the Tangut character the drawing was made for, one code point
- **code** — that character's code point, as `U+174C1`
- **kind** — `glyph` for a random character, `lookalike` when it was drawn as a near-neighbour of the previous one
- **label** — `answer` where the character was shown to the writer, `picked` where it is only what a reader chose from the search results
- **strokes** — a list of strokes, each a list of `[x, y]` points in the unit square, in drawing order
- **strokeCount** — number of strokes
- **times** — when each point was sampled, where the browser reported it
- **pressure** — pen pressure where there is a pen; absent on a mouse
- **width, height** — the pad's size in pixels when the drawing was made
- **session** — the round the drawing belongs to: when it started, its size and seed

## Provenance (web form → Provenance)

Strokes were drawn on the pad at https://tangut.mkpo.li/draw and in the rounds at
https://tangut.mkpo.li/quiz by visitors to the site, with a mouse, a trackpad or a stylus, at one width,
with no requirement to know the script. Each drawing was kept with the character on screen (quiz rounds)
or with the character the reader picked out of the search results (the live pad). A reviewer marked 103
of them good, wrong, unclear, not a character, or bad strokes; 8 were excluded and 32 corrected, and the
annotations file holds that record. The set is organised as `data/handwriting/<session>/<index>-<code>.json`,
one file per drawing, and the published records keep that file name as their id.

## Update frequency (web form → Maintenance)

Updated when new drawings are collected and reviewed — a few times a month at present. The split never
changes, so an old submission stays comparable with a new one.

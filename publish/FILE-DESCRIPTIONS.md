# Kaggle: text to paste into the web form

## Subtitle
Strokes drawn with a mouse, for recognising Tangut characters

## File descriptions

- **tangut-strokes.jsonl** — 211 drawings, one JSON record per line: the character, the polylines drawn for it in the unit square, and when.
- **split.json** — the fixed 84 dev and 106 test drawings; scores are only comparable against this split.
- **baseline-submission.jsonl** — the site's own matcher, ranking 24 characters per test drawing: 32.1% first, 57.5% in five, MRR 0.440.
- **submission-template.csv** — the shape a competition submission takes: one row per test drawing, 24 rank columns.
- **annotations.json** — a reviewer's verdict on 103 drawings, and the character 32 of them should have been.

## Cover image
`publish/cover.png` (1200×630), uploaded through the dataset page: **Edit → Cover image**.

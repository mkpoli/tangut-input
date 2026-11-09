# Tangut stroke recognition benchmark

Draw a Tangut character with a mouse, a trackpad or a stylus, and name it. The corpus is 190 strokes
drawn on this site's pad, each with the character it was made for; the task is to put the right
character at the top of a short list.

## The data

`https://tangut.mkpo.li/dataset/tangut-strokes.jsonl.gz` — one JSON record per line, strokes as
polylines in the unit square. `benchmark/split.json` fixes which drawings are dev and which are test;
the test half is 106 drawings and its answers are in the corpus file, so scores mean nothing unless
you train on dev only.

Strokes come from a browser pad at one width, drawn by visitors with no training in the script. They
are rough shapes, not handwriting; see https://tangut.mkpo.li/dataset/.

## Submitting

Write one line per test drawing, ranking up to 24 characters, best first:

```json
{"id": "2026-11-01T19-43-14/003-180c8.json", "ranked": ["𘃈", "𘃉", "𘃊"]}
```

Then score it, and add the file to the leaderboard:

```sh
bun benchmark/score.mjs --name your-name submissions/your-name.jsonl
```

That prints first / in five / in 24 / MRR and records the entry in `benchmark/leaderboard.json`. Open
a pull request that adds your submission file and the leaderboard entry; the split is fixed, so a
score is comparable with everyone else's.

## Baseline

The site's own matcher, in `app/lib/shape.js`, ranked against all 6,136 characters across five
typefaces: `bun benchmark/baseline.mjs` then `bun benchmark/score.mjs --name baseline benchmark/baseline.jsonl`.

| | First | In five | In 24 | MRR |
| --- | ---: | ---: | ---: | ---: |
| Baseline, site matcher | 32.1% | 57.5% | 75.5% | 0.440 |

## Rules

- Train on the dev half and on any data you bring; never on the test half's answers.
- One model per entry, no network calls while ranking, no looking the character up in a corpus by
  other means than the strokes.
- Report what you trained on. A score from a model that has seen the test drawings means nothing.
- The drawings are CC BY 4.0; cite `Tangut stroke dataset, tangut.mkpo.li`.

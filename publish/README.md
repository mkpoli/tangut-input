# Publishing

Two hosts, two jobs, one corpus.

| | Hugging Face | Kaggle |
| --- | --- | --- |
| Hosts | the dataset, and a Space that shows the leaderboard | the dataset, and a competition that keeps the leaderboard |
| Reader gets | `load_dataset("mkpoli/tangut-strokes")` | downloadable files, notebooks, a submission slot |
| Leaderboard | the Space reads `leaderboard.json` from the repo | the competition scores submissions itself |
| Effort | two commands | web wizard, plus a CSV with 24 rank columns |

## Pack

```sh
bun publish/pack.mjs
```

Writes `publish/out/`: `tangut-strokes.jsonl`, `split.json`, `baseline-submission.jsonl`,
`submission-template.csv`, `answers.csv`, `annotations.json`, `counts.json`. `answers.csv` is the key
for the test half — it belongs on the host only if the competition keeps it private.

## Hugging Face

```sh
hf auth login
hf repo create mkpoli/tangut-strokes --repo-type dataset
hf upload mkpoli/tangut-strokes publish/kaggle-dataset/tangut-strokes.jsonl publish/kaggle-dataset/split.json publish/kaggle-dataset/baseline-submission.jsonl publish/kaggle-dataset/annotations.json publish/kaggle-dataset/submission-template.csv --repo-type dataset
hf upload mkpoli/tangut-strokes publish/hf/README.md README.md --repo-type dataset
```

The dataset card is `publish/hf/README.md`; its YAML front matter sets the licence, the language
(`txg`) and the task (`image-to-text`, `other`).

## Kaggle

```sh
kaggle datasets create -p publish/kaggle-dataset
kaggle competitions create   # web wizard: Community Competition, then upload scoring
```

`publish/kaggle-dataset/dataset-metadata.json` names the files and the licence. For the competition,
upload `submission-template.csv` as the submission format, `answers.csv` as the solution, and set the
metric to mean reciprocal rank of the first correct column (Kaggle's `MeanAveragePrecision` and
`accuracy` do not fit a ranked list, so a small scoring script goes with the competition).

## Which, then

Hugging Face is where a dataset is found and loaded; Kaggle is where a competition runs by itself.
Both point at the same files, and the site's own page stays the canonical description:
https://tangut.mkpo.li/dataset/

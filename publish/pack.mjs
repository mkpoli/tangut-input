// Pack the dataset and the benchmark for the places that host one.
//   bun publish/pack.mjs            # writes publish/out/
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const ROOT = new URL('../', import.meta.url)
const DATA = new URL('data/handwriting/', ROOT)
const OUT = new URL('publish/out/', ROOT)
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const annotations = JSON.parse(readFileSync(new URL('annotations.json', DATA), 'utf8'))
const rows = gunzipSync(readFileSync(new URL('dataset.jsonl.gz', DATA))).toString().trim().split('\n').map(line => JSON.parse(line))
const split = JSON.parse(readFileSync(new URL('benchmark/split.json', ROOT), 'utf8'))
const test = new Set(split.test)

// The dataset as a single uncompressed JSONL, which both hosts read without unpacking.
writeFileSync(new URL('tangut-strokes.jsonl', OUT), rows.map(row => JSON.stringify(row)).join('\n') + '\n')
writeFileSync(new URL('annotations.json', OUT), JSON.stringify(annotations, null, 1) + '\n')
writeFileSync(new URL('split.json', OUT), JSON.stringify(split, null, 2) + '\n')
copyFileSync(new URL('benchmark/baseline.jsonl', ROOT), new URL('baseline-submission.jsonl', OUT))
copyFileSync(new URL('benchmark/score.mjs', ROOT), new URL('score.mjs', OUT))

// A CSV submission, the shape Kaggle's competition upload expects: one row per test drawing.
const answers = new Map(rows.map(row => [row.id, row.char]))
const header = ['id', ...Array.from({ length: split.cutoff }, (_, i) => `rank_${i + 1}`)]
const lines = [header.join(',')]
for (const id of split.test) {
  lines.push([id, ...Array.from({ length: split.cutoff }, () => '')].join(','))
}
writeFileSync(new URL('submission-template.csv', OUT), lines.join('\n') + '\n')

// The answer key is kept for scoring only; a pack that ships it is a pack that spoils the test.
writeFileSync(new URL('answers.csv', OUT), ['id,char', ...[...test].filter(id => answers.has(id)).map(id => `${id},${answers.get(id)}`)].join('\n') + '\n')

const counts = {
  drawings: rows.length,
  test: split.test.length,
  dev: split.dev.length,
}
writeFileSync(new URL('counts.json', OUT), JSON.stringify(counts, null, 2) + '\n')
console.log(`${counts.drawings} drawings packed, ${counts.test} test, ${counts.dev} dev -> publish/out/`)

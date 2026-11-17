// Score a run on the 24 printed signs of 掌中珠 canvas 40 band 1.
//
//   bun benchmark/ocr/score.mjs predictions.jsonl
//
// One JSON object per line, in any order, one per sign:
//   {"id": "c40b1-c02-1", "char": "𗉛"}
// A missing sign is counted, not ignored: the denominator is always 24.
import { readFileSync } from 'node:fs'

const SAMPLE = new URL('sample.json', import.meta.url)

export function sample() {
  return JSON.parse(readFileSync(SAMPLE, 'utf8'))
}

/** @param {{ id: string, char: string }[]} predictions */
export function score(predictions) {
  const rows = sample()
  const answered = new Map()
  for (const prediction of predictions) {
    if (typeof prediction?.id === 'string' && typeof prediction?.char === 'string') answered.set(prediction.id, prediction.char)
  }
  let correct = 0
  const wrong = []
  for (const row of rows) {
    const answer = answered.get(row.id)
    if (answer === row.char) correct++
    else wrong.push({ id: row.id, expected: row.char, got: answer ?? null })
  }
  return { correct, total: rows.length, missing: rows.filter(row => !answered.has(row.id)).length, wrong }
}

if (import.meta.main) {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: bun benchmark/ocr/score.mjs predictions.jsonl')
    process.exit(1)
  }
  const predictions = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  const result = score(predictions)
  console.log(`${file}: ${result.correct}/${result.total} (${(100 * result.correct / result.total).toFixed(1)}%), ${result.missing} missing`)
  for (const miss of result.wrong.slice(0, 8)) console.log(`  ${miss.id}: ${miss.expected} -> ${miss.got ?? '—'}`)
  if (result.wrong.length > 8) console.log(`  … ${result.wrong.length - 8} more`)
}

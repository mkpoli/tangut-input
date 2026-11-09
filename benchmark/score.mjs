// The competition's fixed split and its scorer.
//
//   bun benchmark/split.mjs              # write benchmark/split.json once, then never again
//   bun benchmark/score.mjs --name mine submissions/mine.jsonl
//
// A submission is one JSON object per line, in any order, covering every drawing in the test half:
//   {"id": "2026-11-01T19-43-14/003-180c8.json", "ranked": ["𘃈", "𘃉", … up to 24 …]}
// The scorer reads only the ids and the ranked characters; it never sees the answer beside them.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const ROOT = new URL('../', import.meta.url)
const DATA = new URL('data/handwriting/', ROOT)
const SPLIT = new URL('benchmark/split.json', ROOT)
const LEADERBOARD = new URL('benchmark/leaderboard.json', ROOT)

export const CUTOFF = 24

/** Every drawing whose character is known, minus the ones a reviewer threw out. */
export function labelled() {
  const annotations = JSON.parse(readFileSync(new URL('annotations.json', DATA), 'utf8')).notes ?? {}
  const rows = []
  for (const entry of readdirSync(DATA, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'reviewer') continue
    for (const name of readdirSync(new URL(`${entry.name}/`, DATA))) {
      if (!name.endsWith('.json') || name === 'session.json') continue
      const id = `${entry.name}/${name}`
      if (annotations[id]?.verdict === 'bad') continue
      const record = JSON.parse(readFileSync(new URL(id, DATA), 'utf8'))
      // Live drawings carry a pick, not an answer, so they are not scored.
      if (!record.char || record.label === 'picked') continue
      rows.push({ id, char: record.char, strokes: record.strokes })
    }
  }
  return rows
}

/** The half a drawing falls in, by a hash of its id: stable as the corpus grows. */
export function halfOf(id) {
  return createHash('sha1').update(id).digest()[0] % 2 === 0 ? 'test' : 'dev'
}

export function split() {
  const rows = labelled()
  return {
    test: rows.filter(row => halfOf(row.id) === 'test').map(row => row.id),
    dev: rows.filter(row => halfOf(row.id) === 'dev').map(row => row.id),
  }
}

/** Score a submission against the answers. @param {{ id: string, ranked: string[] }[]} submission */
export function score(submission) {
  const rows = new Map(labelled().map(row => [row.id, row.char]))
  const wanted = new Set(split().test)
  const seen = new Set()
  let first = 0, five = 0, page = 0, reciprocal = 0, total = 0
  for (const entry of submission) {
    if (!wanted.has(entry.id) || seen.has(entry.id)) continue
    seen.add(entry.id)
    const answer = rows.get(entry.id)
    const at = entry.ranked.slice(0, CUTOFF).indexOf(answer)
    total++
    if (at === 0) first++
    if (at >= 0 && at < 5) five++
    if (at >= 0) page++
    if (at >= 0) reciprocal += 1 / (at + 1)
  }
  return {
    scored: total,
    missing: wanted.size - total,
    top1: total ? first / total : 0,
    top5: total ? five / total : 0,
    top24: total ? page / total : 0,
    mrr: total ? reciprocal / total : 0,
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args[0] === '--write-split' || !existsSync(SPLIT)) {
    const halves = split()
    writeFileSync(SPLIT, JSON.stringify({
      created: new Date().toISOString(),
      cutoff: CUTOFF,
      note: 'Fixed. Do not regenerate: scores are only comparable against this split.',
      dev: halves.dev,
      test: halves.test,
    }, null, 2) + '\n')
    console.log(`${halves.dev.length} dev, ${halves.test.length} test -> benchmark/split.json`)
    process.exit(0)
  }
  const at = args.indexOf('--name')
  const name = at >= 0 ? args[at + 1] : ''
  const file = args[at >= 0 ? at + 2 : 0]
  if (!file) {
    console.error('usage: bun benchmark/score.mjs --name mine submissions/mine.jsonl')
    process.exit(1)
  }
  const submission = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  const result = score(submission)
  console.log(`${name || file}: ${result.scored} scored, ${result.missing} missing`)
  console.log(`  first ${(result.top1 * 100).toFixed(1)}%  in five ${(result.top5 * 100).toFixed(1)}%  ` +
    `in ${CUTOFF} ${(result.top24 * 100).toFixed(1)}%  MRR ${result.mrr.toFixed(3)}`)
  if (!name) process.exit(0)
  mkdirSync(new URL('benchmark/', ROOT), { recursive: true })
  const board = existsSync(LEADERBOARD) ? JSON.parse(readFileSync(LEADERBOARD, 'utf8')) : {}
  board[name] = { ...result, at: new Date().toISOString().slice(0, 10) }
  writeFileSync(LEADERBOARD, JSON.stringify(board, null, 2) + '\n')
  // The dataset page imports the board, so it is written where the page can read it.
  writeFileSync(new URL('app/lib/leaderboard.js', ROOT),
    '// Written by `bun benchmark/score.mjs`; imported by the dataset page so the board paints without a request.\n' +
    `export const leaderboard = ${JSON.stringify(board, null, 2)}\n`)
  console.log(`  written to benchmark/leaderboard.json and app/lib/leaderboard.js`)
}

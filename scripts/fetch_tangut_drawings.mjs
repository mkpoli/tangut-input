// Bring the drawings readers made on the live pad into the local corpus: the same files the quiz
// writes, one per drawing, so the board, the dataset and the benchmarks see them.
//   bun scripts/fetch_tangut_drawings.mjs [--since 2026-11-01] [--batch live-2026-11-06]
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const DATABASE = 'tangut-records'
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at < 0 ? fallback : args[at + 1]
}
const since = option('since', '1970-01-01')
const batch = option('batch', `live-${new Date().toISOString().slice(0, 10)}`)

/** @param {string} statement @returns {any[]} */
function query(statement) {
  const out = execFileSync('bunx', ['--no-install', 'wrangler', 'd1', 'execute', DATABASE, '--remote', '--json', '--command', statement], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const parsed = JSON.parse(out)
  return parsed[0]?.results ?? []
}

// The pad never learns the answer, as the quiz does: a live drawing is only what was drawn and the
// character its reader picked out of the results. Those are stored as a weak label, marked as one.
const rows = query(
  `select at, origin, answer, kind, picked, place, strokes, times, pressure, pointer, writer, device, width, height, session ` +
  `from drawings where at >= '${since}' and strokes is not null and (answer is not null or picked is not null) order by at`,
)
if (!rows.length) {
  console.log(`no drawings since ${since}`)
  process.exit(0)
}

const ROOT = new URL('../data/handwriting/', import.meta.url)
const dir = new URL(`${batch}/`, ROOT)
mkdirSync(dir, { recursive: true })

let written = 0
for (const row of rows) {
  const strokes = JSON.parse(row.strokes)
  if (!Array.isArray(strokes) || !strokes.length) continue
  const char = row.answer ?? row.picked
  if (!char) continue
  const stamp = String(row.at).replace(/[-:]/g, '').replace(/\..*$/, '')
  const name = `${String(++written).padStart(3, '0')}-${char.codePointAt(0).toString(16)}.json`
  writeFileSync(new URL(name, dir), JSON.stringify({
    char,
    // 'picked' where the character is only what the reader chose, not a known answer.
    label: row.answer ? 'answer' : 'picked',
    kind: row.kind ?? 'glyph',
    strokes,
    times: row.times ? JSON.parse(row.times) : null,
    pressure: row.pressure ? JSON.parse(row.pressure) : null,
    pointer: row.pointer ?? null,
    writer: row.writer ?? null,
    device: row.device ?? null,
    width: row.width ?? 340,
    height: row.height ?? 340,
    at: row.at,
    origin: row.origin ?? null,
    live: { picked: row.picked ?? null, place: row.place ?? null, session: row.session ?? null, imported: stamp },
  }) + '\n')
}

writeFileSync(new URL('session.json', dir), JSON.stringify({ started: rows[0].at, source: `live ${since}`, drawings: written }, null, 2) + '\n')
console.log(`${written} drawings since ${since} -> data/handwriting/${batch}/`)

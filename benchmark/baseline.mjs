// The baseline anyone can beat: the site's own matcher, ranked against every character it knows.
//   bun benchmark/baseline.mjs            # writes benchmark/baseline.jsonl
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { parseShapes, indexShapes, rasterize, rankShapes } from '../app/lib/shape.js'
import { labelled, split, halfOf, CUTOFF } from './score.mjs'

const ROOT = new URL('../', import.meta.url)
const FACES = [
  'tangut-shapes.bin.gz',
  'tangut-shapes-yinchuan.bin.gz',
  'tangut-shapes-genzui.bin.gz',
  'tangut-shapes-mojikyo.bin.gz',
  'tangut-shapes-std.bin.gz',
]

const indexes = FACES.map(face => indexShapes(parseShapes(gunzipSync(readFileSync(new URL(`app/data/${face}`, ROOT))))))
const strokes = JSON.parse(gunzipSync(readFileSync(new URL('app/data/tangut-strokes.json.gz', ROOT))).toString())
const strokeCounts = new Map(Object.entries(strokes.values))

const rows = labelled().filter(row => halfOf(row.id) === 'test')
const out = []
let done = 0
for (const row of rows) {
  const scaled = row.strokes.map(stroke => stroke.map(([x, y]) => [x * 340, y * 340]))
  const mask = rasterize(scaled)
  /** @type {Map<string, number>} */
  const best = new Map()
  for (const index of indexes) {
    rankShapes(index, mask, { limit: index.chars.length, strokes: scaled.length, strokeCounts })
      .forEach((hit, at) => {
        const known = best.get(hit.char)
        if (known === undefined || at < known) best.set(hit.char, at)
      })
  }
  const ranked = [...best.entries()]
    .filter(([char]) => /[\u{18800}-\u{18AFF}]/u.test(char) === false)
    .sort((a, b) => a[1] - b[1])
    .slice(0, CUTOFF)
    .map(([char]) => char)
  out.push(JSON.stringify({ id: row.id, ranked }))
  if (++done % 20 === 0) console.error(`${done}/${rows.length}`)
}

writeFileSync(new URL('benchmark/baseline.jsonl', ROOT), out.join('\n') + '\n')
console.log(`${rows.length} test drawings -> benchmark/baseline.jsonl`)

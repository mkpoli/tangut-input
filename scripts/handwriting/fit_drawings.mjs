// Are other drawings better templates than the typefaces? Each drawing ranked against every other
// drawing in the corpus, leave-one-out, and compared with the font-based matcher.
//   bun scripts/handwriting/fit_drawings.mjs
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseShapes, indexShapes, rasterize, rankShapes, distanceField } from '../../app/lib/shape.js'

const ROOT = new URL('../../', import.meta.url)
const face = indexShapes(parseShapes(gunzipSync(readFileSync(new URL('app/data/tangut-shapes.bin.gz', ROOT)))))
const strokeCounts = new Map(Object.entries(JSON.parse(gunzipSync(readFileSync(new URL('app/data/tangut-strokes.json.gz', ROOT))).toString()).values))
const notes = JSON.parse(readFileSync(new URL('data/handwriting/annotations.json', ROOT), 'utf8')).notes ?? {}

const drawings = []
for (const [id, note] of Object.entries(notes)) {
  if (note.verdict === 'bad') continue
  try {
    const record = JSON.parse(readFileSync(new URL(`data/handwriting/${id}`, ROOT), 'utf8'))
    if (!record.strokes?.length) continue
    const wanted = note.correct || (note.verdict === 'good' ? record.char : null)
    if (!wanted) continue
    const scaled = record.strokes.map(stroke => stroke.map(([x, y]) => [x * 340, y * 340]))
    const mask = rasterize(scaled)
    drawings.push({ id, wanted, mask, field: distanceField(mask) })
  } catch { /* gone */ }
}
drawings.sort((a, b) => a.id.localeCompare(b.id))
console.log('drawings', drawings.length)

/** Chamfer from one drawing to another, symmetric. */
function between(a, b) {
  let forward = 0, back = 0
  for (let i = 0; i < a.mask.length; i++) if (a.mask[i]) forward += b.field[i]
  for (let i = 0; i < b.mask.length; i++) if (b.mask[i]) back += a.field[i]
  const inkA = a.mask.reduce((s, v) => s + v, 0)
  const inkB = b.mask.reduce((s, v) => s + v, 0)
  return forward / Math.max(1, inkA) + back / Math.max(1, inkB)
}

const dev = drawings.filter((_, i) => i % 2 === 0)
const test = drawings.filter((_, i) => i % 2 === 1)

/** Rank the test drawings against dev drawings only, first place if the nearest shares the character. */
function humanOnly() {
  let first = 0, five = 0, total = 0
  for (const query of test) {
    const scored = dev.map(other => ({ char: other.wanted, score: between(query, other) })).sort((a, b) => a.score - b.score)
    const at = scored.findIndex(hit => hit.char === query.wanted)
    total++
    if (at === 0) first++
    if (at >= 0 && at < 5) five++
  }
  return { n: total, top1: first / total, top5: five / total }
}

/** The fonts' ranking, for the same drawings, as the figure to beat. */
function fonts() {
  let first = 0, five = 0, total = 0
  for (const query of test) {
    const hits = rankShapes(face, query.mask, { limit: face.chars.length, strokes: 0, strokeCounts })
    const at = hits.findIndex(hit => hit.char === query.wanted)
    total++
    if (at === 0) first++
    if (at >= 0 && at < 5) five++
  }
  return { n: total, top1: first / total, top5: five / total }
}

const human = humanOnly(), font = fonts()
console.log(`fonts on ${font.n}: first ${(font.top1 * 100).toFixed(1)}%, five ${(font.top5 * 100).toFixed(1)}%`)
console.log(`drawings on ${human.n}: first ${(human.top1 * 100).toFixed(1)}%, five ${(human.top5 * 100).toFixed(1)}%`)

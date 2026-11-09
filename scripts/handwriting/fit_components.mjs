// Does scoring a candidate by the parts it is built from help? For the head of the list, compare
// each candidate's IDS components against the drawing and see whether that term separates them.
//   bun scripts/handwriting/fit_components.mjs
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseShapes, indexShapes, rasterize, rankShapes, distanceField, SIZE } from '../../app/lib/shape.js'

const ROOT = new URL('../../', import.meta.url)
const FACES = [
  'tangut-shapes.bin.gz', 'tangut-shapes-yinchuan.bin.gz', 'tangut-shapes-genzui.bin.gz',
  'tangut-shapes-mojikyo.bin.gz', 'tangut-shapes-std.bin.gz',
]
const indexes = FACES.map(face => indexShapes(parseShapes(gunzipSync(readFileSync(new URL(`app/data/${face}`, ROOT))))))
const primary = indexes[0]
const strokeCounts = new Map(Object.entries(JSON.parse(gunzipSync(readFileSync(new URL('app/data/tangut-strokes.json.gz', ROOT))).toString()).values))

// What each character is built from, from the descriptions the records carry.
const entries = JSON.parse(gunzipSync(readFileSync(new URL('app/data/tangut-entries.json.gz', ROOT))).toString()).rows
/** @type {Map<string, string[]>} */
const parts = new Map()
for (const row of entries) {
  const partsOf = [...String(row[1] ?? '')].filter(char => /[\u{18800}-\u{18AFF}]/u.test(char))
  if (partsOf.length) parts.set(String(row[0]), [...new Set(partsOf)])
}
console.log('characters with parts', parts.size)

const CELLS = SIZE * SIZE
/** The ink cells of a character's skeleton, from the primary face. */
function inkOf(char) {
  const at = primary.chars.indexOf(char)
  return at < 0 ? null : primary.inks[at]
}

const notes = JSON.parse(readFileSync(new URL('data/handwriting/annotations.json', ROOT), 'utf8')).notes ?? {}
const drawings = []
for (const [id, note] of Object.entries(notes)) {
  if (note.verdict === 'bad') continue
  try {
    const record = JSON.parse(readFileSync(new URL(`data/handwriting/${id}`, ROOT), 'utf8'))
    if (!record.strokes?.length) continue
    const wanted = note.correct || (note.verdict === 'good' ? record.char : null)
    if (wanted) drawings.push({ id, wanted, strokes: record.strokes })
  } catch { /* gone */ }
}
drawings.sort((a, b) => a.id.localeCompare(b.id))

const TOP = 40
const rows = []
for (const drawing of drawings) {
  const scaled = drawing.strokes.map(stroke => stroke.map(([x, y]) => [x * 340, y * 340]))
  const mask = rasterize(scaled)
  const field = distanceField(mask)
  /** @type {Map<string, any>} */
  const best = new Map()
  for (const index of indexes) {
    for (const hit of rankShapes(index, mask, { limit: index.chars.length, strokes: scaled.length, strokeCounts })) {
      if (!/[\u{17000}-\u{187FF}]/u.test(hit.char)) continue
      const known = best.get(hit.char)
      if (!known || hit.score < known.score) best.set(hit.char, hit)
    }
  }
  const list = [...best.values()].sort((a, b) => a.score - b.score).slice(0, TOP)
  // How far each character's parts lie from the drawing's ink: a character built from parts the
  // writer actually drew should sit closer than one whose parts are somewhere else.
  for (const hit of list) {
    const partsOf = parts.get(hit.char) ?? []
    let total = 0, counted = 0
    for (const part of partsOf) {
      const ink = inkOf(part)
      if (!ink) continue
      let sum = 0
      for (const cell of ink) sum += field[cell]
      total += sum / ink.length
      counted++
    }
    hit.parts = counted ? total / counted : 99
  }
  rows.push({ drawing, at: list.findIndex(hit => hit.char === drawing.wanted), list })
}

function measure(set, weight) {
  let first = 0, five = 0, total = 0
  for (const row of set) {
    if (row.at < 0) continue
    total++
    const scored = row.list.map(hit => ({ char: hit.char, value: hit.score + weight * (hit.parts ?? 0) }))
    scored.sort((a, b) => a.value - b.value)
    const rank = scored.findIndex(hit => hit.char === row.drawing.wanted)
    if (rank === 0) first++
    if (rank >= 0 && rank < 5) five++
  }
  return { n: total, top1: first / Math.max(1, total), top5: five / Math.max(1, total) }
}

const dev = rows.filter((_, i) => i % 2 === 0)
const test = rows.filter((_, i) => i % 2 === 1)
for (const weight of [0, 0.1, 0.2, 0.35, 0.5, 0.8]) {
  const d = measure(dev, weight), t = measure(test, weight)
  console.log(`parts weight ${weight}: dev ${(d.top1 * 100).toFixed(1)}% / ${(d.top5 * 100).toFixed(1)}%  test ${(t.top1 * 100).toFixed(1)}% / ${(t.top5 * 100).toFixed(1)}%`)
}

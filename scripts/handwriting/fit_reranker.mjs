// A small linear re-ranker over every term the matcher computes, fitted on the drawings a reviewer
// called fair and judged on the half it was not fitted to.
//   bun scripts/handwriting/fit_reranker.mjs
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseShapes, indexShapes, rasterize, rankShapes } from '../../app/lib/shape.js'

const ROOT = new URL('../../', import.meta.url)
const FACES = [
  'tangut-shapes.bin.gz', 'tangut-shapes-yinchuan.bin.gz', 'tangut-shapes-genzui.bin.gz',
  'tangut-shapes-mojikyo.bin.gz', 'tangut-shapes-std.bin.gz',
]
const indexes = FACES.map(face => indexShapes(parseShapes(gunzipSync(readFileSync(new URL(`app/data/${face}`, ROOT))))))
const strokeCounts = new Map(Object.entries(JSON.parse(gunzipSync(readFileSync(new URL('app/data/tangut-strokes.json.gz', ROOT))).toString()).values))

const annotations = JSON.parse(readFileSync(new URL('data/handwriting/annotations.json', ROOT), 'utf8')).notes ?? {}
const drawings = []
for (const [id, note] of Object.entries(annotations)) {
  if (note.verdict !== 'good') continue
  try {
    const record = JSON.parse(readFileSync(new URL(`data/handwriting/${id}`, ROOT), 'utf8'))
    if (!record.char || !record.strokes?.length) continue
    drawings.push({ id, char: record.char, strokes: record.strokes })
  } catch { /* gone with the corpus */ }
}
drawings.sort((a, b) => a.id.localeCompare(b.id))

const TOP = 40
/** Every term the matcher uses, block distance included. */
const featuresOf = hit => [hit.forward, hit.backward, hit.direction, hit.stroke, hit.block ?? 0]

function shortlist(drawing) {
  const scaled = drawing.strokes.map(stroke => stroke.map(([x, y]) => [x * 340, y * 340]))
  const mask = rasterize(scaled)
  /** @type {Map<string, any>} */
  const best = new Map()
  for (const index of indexes) {
    for (const hit of rankShapes(index, mask, { limit: index.chars.length, strokes: scaled.length, strokeCounts })) {
      if (!/[\u{17000}-\u{187FF}]/u.test(hit.char)) continue
      const known = best.get(hit.char)
      if (!known || hit.score < known.score) best.set(hit.char, hit)
    }
  }
  return [...best.values()].sort((a, b) => a.score - b.score).slice(0, TOP)
}

const rows = []
for (const drawing of drawings) {
  const list = shortlist(drawing)
  rows.push({ drawing, at: list.findIndex(hit => hit.char === drawing.char), list })
}
const dev = rows.filter((_, i) => i % 2 === 0)
const test = rows.filter((_, i) => i % 2 === 1)

/** @param {{ drawing: any, at: number, list: any[] }[]} set @param {number[]} w */
function measure(set, w) {
  let first = 0, five = 0, total = 0
  for (const row of set) {
    if (row.at < 0) continue
    total++
    const scored = row.list.map(hit => ({ char: hit.char, value: w.reduce((sum, weight, i) => sum + weight * featuresOf(hit)[i], 0) }))
    scored.sort((a, b) => a.value - b.value)
    const rank = scored.findIndex(hit => hit.char === row.drawing.char)
    if (rank === 0) first++
    if (rank >= 0 && rank < 5) five++
  }
  return { n: total, top1: first / Math.max(1, total), top5: five / Math.max(1, total) }
}

// The matcher's own weights, in the same units: forward + backward + direction + stroke, block at 0.5.
const base = [1, 1, 1, 0.35, 0.5]
const grid = [1, 0.5, 1.5, 2]
const blocks = [0, 0.25, 0.5, 1]
let best = { w: base, score: measure(dev, base) }
for (const backward of grid) for (const direction of [0.5, 1, 1.5]) for (const stroke of [0, 0.2, 0.35, 0.7]) for (const block of blocks) {
  const w = [1, backward, direction, stroke, block]
  const score = measure(dev, w)
  if (score.top1 > best.score.top1 || (score.top1 === best.score.top1 && score.top5 > best.score.top5)) best = { w, score }
}
const names = ['forward', 'backward', 'direction', 'stroke', 'block']
console.log('base ', names.map((n, i) => `${n} ${base[i]}`).join(', '), '| dev', pct(measure(dev, base)), '| test', pct(measure(test, base)))
console.log('fitted', names.map((n, i) => `${n} ${best.w[i]}`).join(', '), '| dev', pct(best.score), '| test', pct(measure(test, best.w)))

function pct(result) {
  return `${result.n} drawings, first ${(result.top1 * 100).toFixed(1)}%, in five ${(result.top5 * 100).toFixed(1)}%`
}

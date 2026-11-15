// Learn the matcher's term weights from the corrections rather than from a grid: every corrected
// drawing is a pair — the character the reviewer says it should be, against the ones ranked above it.
//   bun scripts/handwriting/fit_ranking.mjs
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

const notes = JSON.parse(readFileSync(new URL('data/handwriting/annotations.json', ROOT), 'utf8')).notes ?? {}
const drawings = []
for (const [id, note] of Object.entries(notes)) {
  if (note.verdict === 'bad') continue
  const target = note.correct || (note.verdict === 'good' ? null : null)
  try {
    const record = JSON.parse(readFileSync(new URL(`data/handwriting/${id}`, ROOT), 'utf8'))
    if (!record.char || !record.strokes?.length) continue
    // The character the reviewer says it should be, or the one it was drawn for when they said good.
    const wanted = note.correct || (note.verdict === 'good' ? record.char : null)
    if (!wanted) continue
    drawings.push({ id, wanted, strokes: record.strokes })
  } catch { /* not in the corpus */ }
}
drawings.sort((a, b) => a.id.localeCompare(b.id))
console.log('drawings with a known character', drawings.length)

const TOP = 40
const featuresOf = hit => [hit.forward, hit.backward, hit.direction, hit.stroke, hit.block ?? 0]
const NAMES = ['forward', 'backward', 'direction', 'stroke', 'block']

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
  const at = list.findIndex(hit => hit.char === drawing.wanted)
  rows.push({ drawing, at, list })
}

/** @param {{ at: number, list: any[] }[]} set @param {number[]} w */
function measure(set, w) {
  let first = 0, five = 0, total = 0
  for (const row of set) {
    if (row.at < 0) continue
    total++
    const scored = row.list.map(hit => ({ char: hit.char, value: w.reduce((sum, weight, i) => sum + weight * featuresOf(hit)[i], 0) }))
    scored.sort((a, b) => a.value - b.value)
    const rank = scored.findIndex(hit => hit.char === row.drawing.wanted)
    if (rank === 0) first++
    if (rank >= 0 && rank < 5) five++
  }
  return { n: total, top1: first / Math.max(1, total), top5: five / Math.max(1, total) }
}

/** Pairs where the wanted character lost to something ranked above it. */
function pairs(set) {
  const out = []
  for (const row of set) {
    if (row.at < 0) continue
    const good = featuresOf(row.list[row.at])
    for (let i = 0; i < row.at; i++) out.push([featuresOf(row.list[i]), good])
  }
  return out
}

function fit(set, epochs = 3000, rate = 0.3, margin = 0.1) {
  const training = pairs(set)
  // The terms live on different scales — a stroke count runs to twenty while a chamfer stays under
  // three — so each is put in units of its own spread before any learning.
  const scale = [0, 0, 0, 0, 0]
  for (const [wrong, right] of training) for (let i = 0; i < 5; i++) scale[i] += Math.abs(wrong[i] - right[i]) / training.length
  for (let i = 0; i < 5; i++) scale[i] = scale[i] || 1
  const scaled = training.map(([wrong, right]) => [wrong.map((v, i) => v / scale[i]), right.map((v, i) => v / scale[i])])
  const w = [1, 1, 1, 0.35, 0.5]
  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = [0, 0, 0, 0, 0]
    for (const [wrong, right] of scaled) {
      const gap = w.reduce((sum, weight, i) => sum + weight * (wrong[i] - right[i]), 0)
      if (gap < -margin) continue
      for (let i = 0; i < 5; i++) grad[i] += wrong[i] - right[i]
    }
    for (let i = 0; i < 5; i++) {
      w[i] -= rate * grad[i] / Math.max(1, scaled.length)
      if (w[i] < 0.01) w[i] = 0.01
    }
  }
  return { w, scale, pairs: training.length }
}

const dev = rows.filter((_, i) => i % 2 === 0)
const test = rows.filter((_, i) => i % 2 === 1)
const base = [1, 1, 1, 0.35, 0.5]
const fitted = fit(dev)
const scaledMeasure = (set, w, scale) => measure(set, w.map((weight, i) => weight / scale[i]))
const show = (label, result) => `${label}: ${result.n} drawings, first ${(result.top1 * 100).toFixed(1)}%, in five ${(result.top5 * 100).toFixed(1)}%`
console.log('base   ', NAMES.map((n, i) => `${n} ${base[i]}`).join(', '))
console.log('  ', show('dev ', measure(dev, base)), '|', show('test', measure(test, base)))
console.log('fitted ', NAMES.map((n, i) => `${n} ${fitted.w[i].toFixed(2)}`).join(', '), `(${fitted.pairs} pairs)`)
console.log('  ', show('dev ', scaledMeasure(dev, fitted.w, fitted.scale)), '|', show('test', scaledMeasure(test, fitted.w, fitted.scale)))

// Measure the drawing search on the drawings made by hand, the only input that says anything about
// real use. Every round of tuning is chosen on the tuning half and reported on the test half, so a
// weight cannot be fitted to the number it is judged by.
//   bun scripts/bench_tangut_drawings.mjs [--all] [--face=noto] [--weight=2] [--merge=rank|min]
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseShapes, indexShapes, rasterize, rankShapes } from '../app/lib/shape.js'

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, value = '1'] = arg.replace(/^--/, '').split('=')
  return [key, value]
}))
const every = args.has('all')
const onlySessions = args.get('sessions')?.split(',')
const ideographsOnly = args.has('ideographs')
const onlyFace = args.get('face')
const merge = args.get('merge') ?? 'rank'
const weights = {
  direction: Number(args.get('weight') ?? 2),
  stroke: Number(args.get('stroke') ?? 0.35),
  limit: Number(args.get('limit') ?? 0),
}

const FACES = [
  { key: 'noto', file: 'tangut-shapes.bin.gz' },
  { key: 'yinchuan', file: 'tangut-shapes-yinchuan.bin.gz' },
  { key: 'genzui', file: 'tangut-shapes-genzui.bin.gz' },
  { key: 'mojikyo', file: 'tangut-shapes-mojikyo.bin.gz' },
  { key: 'std', file: 'tangut-shapes-std.bin.gz' },
].filter(face => !onlyFace || face.key === onlyFace)

const DATA = new URL('../data/handwriting/', import.meta.url)
if (!existsSync(DATA)) {
  console.error('no data/handwriting; nothing to measure')
  process.exit(1)
}

const strokesFile = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-strokes.json.gz', import.meta.url))).toString())
const strokeCounts = new Map(Object.entries(strokesFile.values))
const indexes = FACES.map(face => ({ face: face.key, index: indexShapes(parseShapes(gunzipSync(readFileSync(new URL(`../app/data/${face.file}`, import.meta.url))))) }))

/** Every drawing on disk, with the character it was made for. */
const drawings = []
for (const session of readdirSync(DATA).sort()) {
  if (onlySessions && !onlySessions.includes(session)) continue
  const dir = new URL(`${session}/`, DATA)
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir).filter(name => /^\d{3}-.*\.json$/.test(name)).sort()) {
    const record = JSON.parse(readFileSync(new URL(name, dir)).toString())
    if (!record.char || !record.strokes?.length) continue
    drawings.push({ session, name, char: record.char, strokes: record.strokes })
  }
}

/** The rank the right character took, 1-based; Infinity when outside the list. */
function rankOf(strokes, char, config = {}) {
  const weights = { direction: config.direction ?? Number(args.get('weight') ?? 2), stroke: config.stroke ?? Number(args.get('stroke') ?? 0.35) }
  const merge = config.merge ?? args.get('merge') ?? 'rank'
  const mask = rasterize(strokes)
  /** @type {Map<string, number>} */
  const bestRank = new Map()
  if (merge === 'rank') {
    for (const { index } of indexes) {
      rankShapes(index, mask, { limit: index.chars.length, strokes: strokes.length, strokeCounts, strokeWeight: weights.stroke, directionWeight: weights.direction })
        .forEach((hit, at) => { if (!bestRank.has(hit.char) || /** @type {number} */ (bestRank.get(hit.char)) > at) bestRank.set(hit.char, at) })
    }
  } else {
    /** @type {Map<string, number>} */
    const bestScore = new Map()
    for (const { index } of indexes) {
      for (const hit of rankShapes(index, mask, { limit: index.chars.length, strokes: strokes.length, strokeCounts, strokeWeight: weights.stroke, directionWeight: weights.direction })) {
        const known = bestScore.get(hit.char)
        if (known === undefined || hit.score < known) bestScore.set(hit.char, hit.score)
      }
    }
    const ranked = [...bestScore.entries()].sort((a, b) => a[1] - b[1]).map(([c]) => c)
    ranked.forEach((c, at) => { bestRank.set(c, at) })
  }
  let ranked = [...bestRank.entries()]
  if (ideographsOnly) ranked = ranked.filter(([c]) => /[\u{17000}-\u{187FF}]/u.test(c))
  ranked.sort((a, b) => a[1] - b[1])
  const at = ranked.findIndex(([c]) => c === char)
  return at < 0 ? Infinity : at + 1
}

/** @param {number[]} ranks */
function report(name, ranks) {
  const n = ranks.length
  const at = k => ranks.filter(rank => rank <= k).length / n
  const mrr = ranks.reduce((sum, rank) => sum + (rank === Infinity ? 0 : 1 / rank), 0) / n
  const found = ranks.filter(rank => rank !== Infinity).sort((a, b) => a - b)
  const median = found.length ? found[Math.floor(found.length / 2)] : Infinity
  const buckets = [0, 0, 0, 0]
  for (const rank of ranks) buckets[rank <= 24 ? 0 : rank <= 200 ? 1 : rank === Infinity ? 3 : 2]++
  console.log(`${name}: n=${n}  top1 ${(at(1) * 100).toFixed(0)}%  top5 ${(at(5) * 100).toFixed(0)}%  top24 ${(at(24) * 100).toFixed(0)}%  MRR ${mrr.toFixed(3)}  median ${median === Infinity ? '—' : median}`)
  console.log(`   misses by rank: ≤24 ${buckets[0]}, 25–200 ${buckets[1]}, 201+ ${buckets[2]}, absent ${buckets[3]}`)
}

/** Rank every drawing under one configuration. */
function evaluate(config) {
  const ranks = []
  for (const drawing of drawings) {
    const pad = 340
    const strokes = drawing.strokes.map(stroke => stroke.map(([x, y]) => [x * pad, y * pad]))
    ranks.push(rankOf(strokes, drawing.char, config))
  }
  return { tuning: ranks.filter((_, i) => i % 2 === 0), test: ranks.filter((_, i) => i % 2 === 1), all: ranks }
}

const sweep = args.has('sweep')
  ? [
      { label: 'dir 0 stroke .35', direction: 0 },
      { label: 'dir 1 stroke .35', direction: 1 },
      { label: 'dir 2 stroke .35', direction: 2 },
      { label: 'dir 3 stroke .35', direction: 3 },
      { label: 'dir 2 stroke .7', direction: 2, stroke: 0.7 },
      { label: 'dir 2 stroke 0', direction: 2, stroke: 0 },
      { label: 'dir 2 by distance', direction: 2, merge: 'min' },
    ]
  : [{ label: `dir ${weights.direction} stroke ${weights.stroke}`, direction: weights.direction, stroke: weights.stroke, merge }]

for (const config of sweep) {
  const result = evaluate(config)
  console.log(`\n== ${config.label}${config.merge ? ` merge=${config.merge}` : ''}`)
  report('tuning', result.tuning)
  report('test', result.test)
}

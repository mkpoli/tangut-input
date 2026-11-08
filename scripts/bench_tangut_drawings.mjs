// Measure the drawing search on the drawings made by hand, the only input that says anything about
// real use. Every round of tuning is chosen on the tuning half and reported on the test half, so a
// weight cannot be fitted to the number it is judged by.
//   bun scripts/bench_tangut_drawings.mjs [--all] [--face=noto] [--weight=2] [--merge=rank|min]
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { partsOf } from '../app/lib/composition.js'
import { parseShapes, indexShapes, rasterize, rankShapes, inkDirections, blockHistogram, SIZE } from '../app/lib/shape.js'

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

/**
 * The drawings the review threw out. A scribble is no example of a character, and leaving one in
 * the measuring set makes every model look worse than it is.
 * @returns {Set<string>}
 */
/**
 * The drawings a reviewer called fair. Measuring on those says what the search does for a real
 * attempt, without the scribbles that no model could answer.
 * @returns {Set<string> | null}
 */
function goodOnly() {
  if (!args.has('good')) return null
  const file = new URL('../data/handwriting/annotations.json', import.meta.url)
  if (!existsSync(file)) return null
  try {
    const saved = JSON.parse(readFileSync(file).toString())
    return new Set(Object.entries(saved.notes ?? {}).filter(([, note]) => note.verdict === 'good').map(([id]) => id))
  } catch { return null }
}
const only = goodOnly()

function excluded() {
  const file = new URL('../data/handwriting/annotations.json', import.meta.url)
  if (!existsSync(file)) return new Set()
  try {
    const saved = JSON.parse(readFileSync(file).toString())
    return new Set(Object.entries(saved.notes ?? {}).filter(([, note]) => note.verdict === 'bad').map(([id]) => id))
  } catch { return new Set() }
}
const skip = excluded()

/** Every drawing on disk, with the character it was made for. */
const drawings = []
for (const session of readdirSync(DATA).sort()) {
  if (onlySessions && !onlySessions.includes(session)) continue
  const dir = new URL(`${session}/`, DATA)
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir).filter(name => /^\d{3}-.*\.json$/.test(name)).sort()) {
    const record = JSON.parse(readFileSync(new URL(name, dir)).toString())
    if (!record.char || !record.strokes?.length) continue
    if (skip.has(`${session}/${name}`)) continue
    if (only && !only.has(`${session}/${name}`)) continue
    drawings.push({ session, name, char: record.char, strokes: record.strokes })
  }
}

/** Tangut Components, U+18800–U+18AFF. @param {string} char */
const isComponent = char => {
  const code = char.codePointAt(0) ?? 0
  return code >= 0x18800 && code <= 0x18AFF
}

/** @param {string} char */
const codeOf = char => 'U+' + (char.codePointAt(0) ?? 0).toString(16).toUpperCase()

/**
 * Characters one component apart, in the sense the annotator uses: same parts with one replaced,
 * one dropped or one added. Characters of a single part are left out, as they are there.
 * @returns {{ partsByChar: Map<string, string[]>, byDropped: Map<string, Set<string>> }}
 */
function loadApart() {
  const entries = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  /** @type {Map<string, string[]>} */
  const partsByChar = new Map()
  /** @type {Map<string, Set<string>>} */
  const byDropped = new Map()
  for (const row of entries.rows) {
    const parts = partsOf(row[1] ?? '')
    if (parts.length < 2) continue
    partsByChar.set(row[0], parts)
    for (const part of new Set(parts)) {
      const key = [...parts]
      key.splice(key.indexOf(part), 1)
      const joined = key.sort().join('')
      const bucket = byDropped.get(joined) ?? new Set()
      bucket.add(row[0])
      byDropped.set(joined, bucket)
    }
  }
  return { partsByChar, byDropped }
}
const apart = loadApart()

/** @param {string} a @param {string} b */
function oneApart(a, b) {
  const parts = apart.partsByChar.get(a)
  if (!parts || !apart.partsByChar.has(b)) return false
  for (const part of new Set(parts)) {
    const key = [...parts]
    key.splice(key.indexOf(part), 1)
    if (apart.byDropped.get(key.sort().join(''))?.has(b)) return true
  }
  return false
}

/** @param {ArrayLike<number>} a @param {ArrayLike<number>} b */
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/**
 * Where the labelled character landed, and what beat it.
 * @param {[number, number][][]} strokes
 * @param {string} char
 */
function detailOf(strokes, char, config = {}) {
  const weights = { direction: config.direction ?? Number(args.get('weight') ?? 2), stroke: config.stroke ?? Number(args.get('stroke') ?? 0.35) }
  const merge = config.merge ?? args.get('merge') ?? 'rank'
  const rerank = { rerankDepth: config.depth ?? Number(args.get('depth') ?? 150), rerankWeight: config.rerank ?? Number(args.get('rerank') ?? 0.5) }
  const mask = rasterize(strokes)
  const ink = []
  for (let c = 0; c < SIZE * SIZE; c++) if (mask[c]) ink.push(c)
  const drawnBlocks = ink.length ? blockHistogram(inkDirections(mask, ink), ink) : null
  /** @type {Map<string, { hits: { char: string, at: number, forward: number, backward: number, direction: number, stroke: number }[], index: import('../app/lib/shape.js').ShapeIndex }>} */
  const byFace = new Map()
  /** @type {Map<string, number>} */
  const bestRank = new Map()
  /** @type {Map<string, string>} */
  const bestFrom = new Map()
  const options = { limit: indexes[0]?.index.chars.length ?? 0, strokes: strokes.length, strokeCounts, strokeWeight: weights.stroke, directionWeight: weights.direction, ...rerank }
  if (merge === 'rank') {
    for (const { face, index } of indexes) {
      const hits = rankShapes(index, mask, { ...options, limit: index.chars.length })
      byFace.set(face, { hits, index })
      hits.forEach((hit, at) => {
        if (!bestRank.has(hit.char) || /** @type {number} */ (bestRank.get(hit.char)) > at) {
          bestRank.set(hit.char, at)
          bestFrom.set(hit.char, face)
        }
      })
    }
  } else {
    /** @type {Map<string, { score: number, face: string }>} */
    const bestScore = new Map()
    for (const { face, index } of indexes) {
      const hits = rankShapes(index, mask, { ...options, limit: index.chars.length })
      byFace.set(face, { hits, index })
      for (const hit of hits) {
        const known = bestScore.get(hit.char)
        if (known === undefined || hit.score < known.score) bestScore.set(hit.char, { score: hit.score, face })
      }
    }
    ;[...bestScore.entries()].sort((a, b) => a[1].score - b[1].score).forEach(([c, info], at) => {
      bestRank.set(c, at)
      bestFrom.set(c, info.face)
    })
  }
  let ranked = [...bestRank.entries()]
  if (ideographsOnly) ranked = ranked.filter(([c]) => /[\u{17000}-\u{187FF}]/u.test(c))
  ranked.sort((a, b) => a[1] - b[1])
  const place = ranked.findIndex(([c]) => c === char)
  const rank = place < 0 ? Infinity : place + 1
  const winner = ranked[0]?.[0] ?? null
  const faces = [...byFace.entries()].map(([face, { hits }]) => {
    const labelAt = hits.findIndex(hit => hit.char === char)
    return { face, labelRank: labelAt < 0 ? Infinity : labelAt + 1 }
  })
  const notoWinner = byFace.get('noto')?.hits[0]?.char ?? null
  let laterFace = false
  if (notoWinner) {
    for (const [face, { hits }] of byFace) {
      if (face === 'noto') continue
      const labelAt = hits.findIndex(hit => hit.char === char)
      const notoAt = hits.findIndex(hit => hit.char === notoWinner)
      if ((labelAt < 0 ? Infinity : labelAt) < (notoAt < 0 ? Infinity : notoAt)) laterFace = true
    }
  }
  const source = winner ? byFace.get(bestFrom.get(winner) ?? '') : null
  let margin = null
  if (source && winner && drawnBlocks) {
    const labelHit = source.hits.find(hit => hit.char === char)
    const winnerHit = source.hits.find(hit => hit.char === winner)
    if (labelHit && winnerHit) {
      const block = (/** @type {{ at: number }} */ hit) => 1 - cosine(drawnBlocks, source.index.blocks[hit.at])
      margin = {
        face: bestFrom.get(winner),
        forward: labelHit.forward - winnerHit.forward,
        backward: labelHit.backward - winnerHit.backward,
        direction: labelHit.direction - winnerHit.direction,
        stroke: labelHit.stroke - winnerHit.stroke,
        block: block(labelHit) - block(winnerHit),
      }
    }
  }
  const amongIdeographs = ranked.filter(([c]) => !isComponent(c)).findIndex(([c]) => c === char)
  return {
    rank,
    winner,
    faces,
    laterFace,
    margin,
    apart: !!winner && winner !== char && oneApart(winner, char),
    componentBlocked: !!winner && isComponent(winner) && amongIdeographs === 0,
  }
}

/**
 * The 31 drawings with a reviewer's correction. The unattested drawing whose correction is the
 * character it was labelled as is not among them.
 * @returns {{ session: string, name: string, char: string, strokes: number[][][] }[]}
 */
function correctedDrawings() {
  const file = new URL('../data/handwriting/annotations.json', import.meta.url)
  if (!existsSync(file)) return []
  const saved = JSON.parse(readFileSync(file).toString())
  /** @type {{ session: string, name: string, char: string, strokes: number[][][] }[]} */
  const list = []
  for (const [id, note] of Object.entries(saved.notes ?? {})) {
    if (!note.correct) continue
    const slash = id.lastIndexOf('/')
    const session = id.slice(0, slash)
    const name = id.slice(slash + 1)
    const path = new URL(`${session}/${name}`, DATA)
    if (!existsSync(path)) continue
    const record = JSON.parse(readFileSync(path).toString())
    if (!record.strokes?.length) continue
    if (note.verdict === 'unattested' && note.correct === record.char) continue
    list.push({ session, name, char: note.correct, strokes: record.strokes })
  }
  return list.sort((a, b) => `${a.session}/${a.name}`.localeCompare(`${b.session}/${b.name}`))
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

/** Rank every drawing under one configuration. The odd/even split is the list order. */
function measure(list, config) {
  return list.map((drawing, index) => {
    const pad = 340
    const strokes = drawing.strokes.map(stroke => stroke.map(([x, y]) => [x * pad, y * pad]))
    return { drawing, index, ...detailOf(strokes, drawing.char, config) }
  })
}

/** @param {ReturnType<typeof measure>} rows */
function printMisses(rows) {
  const misses = rows.filter(row => row.rank !== 1)
  console.log(`\nfair misses: ${misses.length}`)
  for (const row of misses) {
    const half = row.index % 2 === 0 ? 'tuning' : 'test'
    const where = row.rank === Infinity ? 'absent' : String(row.rank)
    const faces = row.faces.map(face => `${face.face}:${face.labelRank === Infinity ? 'absent' : face.labelRank}`).join(',')
    const margin = row.margin
      ? `${row.margin.face} f${row.margin.forward.toFixed(1)} b${row.margin.backward.toFixed(1)} d${row.margin.direction.toFixed(1)} s${row.margin.stroke.toFixed(1)} block${row.margin.block.toFixed(2)}`
      : 'none'
    console.log(`${half} ${row.drawing.session}/${row.drawing.name} rank=${where} winner=${row.winner ?? '—'} ${row.winner ? codeOf(row.winner) : ''} component=${row.winner && isComponent(row.winner) ? 'yes' : 'no'} apart=${row.apart ? 'yes' : 'no'} later=${row.laterFace ? 'yes' : 'no'} faces=${faces} margin=${margin}`)
  }
  const summarise = (name, list) => {
    const count = (/** @type {(row: typeof list[number]) => boolean} */ pick) => list.filter(pick).length
    console.log(`${name}: misses ${list.length}, component-first ${count(row => !!row.winner && isComponent(row.winner))}, one-apart ${count(row => row.apart)}, component-filter ceiling ${count(row => row.componentBlocked)}, label first on a face ${count(row => row.faces.some(face => face.labelRank === 1))}, later face above Noto's winner ${count(row => row.laterFace)}`)
  }
  summarise('tuning misses', misses.filter(row => row.index % 2 === 0))
  summarise('test misses', misses.filter(row => row.index % 2 === 1))
}

const sweep = args.has('sweep')
  ? [
      { label: 'dir 0 stroke .35', direction: 0 },
      { label: 'dir 1 stroke .35', direction: 1 },
      { label: 'dir 2 stroke .35', direction: 2 },
      { label: 'dir 3 stroke .35', direction: 3 },
      { label: 'dir 2 stroke .7', direction: 2, stroke: 0.7 },
      { label: 'dir 2 stroke 0', direction: 2, stroke: 0 },
      { label: 'rerank 150 w .2', direction: 2, depth: 150, rerank: 0.2 },
      { label: 'rerank 150 w .5', direction: 2, depth: 150, rerank: 0.5 },
      { label: 'rerank 400 w .3', direction: 2, depth: 400, rerank: 0.3 },
    ]
  : [{ label: `dir ${weights.direction} stroke ${weights.stroke}`, direction: weights.direction, stroke: weights.stroke, merge }]

const corrected = correctedDrawings()

for (const config of sweep) {
  const rows = measure(drawings, config)
  const ranks = rows.map(row => row.rank)
  console.log(`\n== ${config.label}${config.merge ? ` merge=${config.merge}` : ''}`)
  report('tuning', ranks.filter((_, i) => i % 2 === 0))
  report('test', ranks.filter((_, i) => i % 2 === 1))
  if (!args.has('sweep')) {
    report('corrected', measure(corrected, config).map(row => row.rank))
    if (only) printMisses(rows)
  }
}

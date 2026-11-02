// Score the handwriting collected by `bun run quiz` against a drawing search, so a change to the
// search can be judged on real pen strokes instead of synthetic ones.
//
//   bun scripts/handwriting/score.mjs <session-dir> [--strokes 0|1] [--shapes file[,file…]] [--width 1.6]
//
// Every saved drawing is ranked against every ideograph, and the answer's rank is reported. The quiz
// saves the strokes normalised to the pad's width, so they can be rasterised exactly as the Draw
// page does. `--strokes 1` adds the recorded stroke count to the score, as the Draw page can.
// `--shapes` picks the glyph files to compare against; with several, a character keeps its best rank
// in any one of them, as the Draw page does. `--width` is the pen width of the drawing.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { parseShapes, indexShapes, rasterize, rankShapes } from '../../app/lib/shape.js'

const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1] }
const useStrokes = option('strokes') === '1'
const shapesFile = option('shapes')
const penWidth = Number(option('width') ?? 1.6)
const strokeWeight = Number(option('weight') ?? 0.35)

/** The most recent session under data/handwriting, when none is named. */
function latestSession() {
  const root = new URL('../../data/handwriting/', import.meta.url)
  if (!existsSync(root)) throw new Error('no data/handwriting yet; run `bun run quiz` first')
  const names = readdirSync(root).filter(name => !name.startsWith('.') && /^\d/.test(name)).sort()
  if (!names.length) throw new Error('no session in data/handwriting')
  return new URL(`${names.at(-1)}/`, root)
}

// A session directory from the command line is resolved against the working directory.
const dir = args.find(arg => !arg.startsWith('--'))
  ? new URL(`file://${resolve(args.find(arg => !arg.startsWith('--')).replace(/\/*$/, ''))}/`)
  : latestSession()
const shapeFiles = shapesFile
  ? shapesFile.split(',').map(name => resolve(name))
  : [new URL('../../app/data/tangut-shapes.bin.gz', import.meta.url)]
const indexes = shapeFiles.map(file => indexShapes(parseShapes(gunzipSync(readFileSync(file)))))
const strokeCounts = new Map(Object.entries(
  JSON.parse(new TextDecoder().decode(gunzipSync(readFileSync(new URL('../../app/data/tangut-strokes.json.gz', import.meta.url))))).values,
))

/** @typedef {{ char: string, kind: string, strokes: number[][][], width: number, height: number }} Saved */
/** @type {Saved[]} */
const saved = readdirSync(dir).filter(name => /^\d{3}-.*\.json$/.test(name)).sort()
  .map(name => JSON.parse(readFileSync(new URL(name, dir))))
if (!saved.length) throw new Error(`no saved drawings in ${dir.pathname}`)

/** @type {{ char: string, kind: string, rank: number, strokes: number, top: string[] }[]} */
const results = []
for (const record of saved) {
  const pad = record.width || 340
  const drawing = record.strokes.map(stroke => stroke.map(([x, y]) => [x * pad, y * pad]))
  const mask = rasterize(drawing, penWidth)
  // Each character keeps its best place in any one face, as the Draw page ranks them.
  const best = new Map()
  for (const index of indexes) {
    rankShapes(index, mask, { limit: index.chars.length, strokes: useStrokes ? drawing.length : 0, strokeCounts, strokeWeight })
      .forEach((hit, at) => { const known = best.get(hit.char); if (known === undefined || at < known) best.set(hit.char, at) })
  }
  const ideographs = [...best.entries()].sort((a, b) => a[1] - b[1]).filter(([char]) => /[\u{17000}-\u{187FF}]/u.test(char))
    .map(([char]) => ({ char }))
  results.push({ char: record.char, kind: record.kind, rank: ideographs.findIndex(hit => hit.char === record.char), strokes: drawing.length, top: ideographs.slice(0, 5).map(hit => hit.char) })
}

const hits = { 1: 0, 5: 0, 20: 0, 60: 0 }
for (const result of results) for (const k of Object.keys(hits)) if (result.rank >= 0 && result.rank < Number(k)) hits[k]++
const pct = k => `${((100 * hits[k]) / results.length).toFixed(0)}%`
const names = shapeFiles.map(file => String(file).split('/').pop()).join(' + ')
console.log(`${results.length} drawings from ${dir.pathname}, against ${names}${useStrokes ? ', stroke count counted' : ''}`)
for (const result of results) {
  const code = result.char.codePointAt(0)?.toString(16).toUpperCase()
  console.log(`  U+${code}  ${result.kind.padEnd(9)}  ${String(result.strokes).padStart(2)} strokes  rank ${result.rank < 0 ? '—' : result.rank + 1}  ${result.top.join(' ')}`)
}
console.log(`top 1 ${pct(1)}, top 5 ${pct(5)}, top 20 ${pct(20)}, top 60 ${pct(60)}`)

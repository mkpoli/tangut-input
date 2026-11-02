// The drawing search, measured on the drawings made by hand that the repository does not carry
// (`data/handwriting/` is ignored by git). Where they are absent the test says so and passes: a
// clean checkout cannot run it, and a machine that collected a round can.
import { expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseShapes, indexShapes, rasterize, rankShapes } from '../app/lib/shape.js'

const readGz = async name => JSON.parse(gunzipSync(readFileSync(new URL(`app/data/${name}`, ROOT))).toString())

const ROOT = new URL('../', import.meta.url)
const DATA = new URL('data/handwriting/', ROOT)
const SESSIONS = ['2026-11-01T14-53-08', '2026-11-01T19-43-14']
const FACES = ['tangut-shapes.bin.gz', 'tangut-shapes-yinchuan.bin.gz', 'tangut-shapes-genzui.bin.gz', 'tangut-shapes-mojikyo.bin.gz', 'tangut-shapes-std.bin.gz']

const present = SESSIONS.every(session => existsSync(new URL(session, DATA)))

test('the drawing search keeps its place on the drawings made by hand', async () => {
  if (!present) {
    console.log('no saved drawings (data/handwriting is not in the repository); skipping')
    return
  }
  const indexes = FACES.map(face => indexShapes(parseShapes(gunzipSync(readFileSync(new URL(`app/data/${face}`, ROOT))))))
  const strokeCounts = new Map(Object.entries((await readGz('tangut-strokes.json.gz')).values))
  let drawings = 0, first = 0, five = 0
  for (const session of SESSIONS) {
    const dir = new URL(`${session}/`, DATA)
    for (const name of readdirSync(dir).filter(name => /^\d{3}-.*\.json$/.test(name))) {
      const record = JSON.parse(readFileSync(new URL(name, dir)).toString())
      const pad = record.width || 340
      const strokes = record.strokes.map(stroke => stroke.map(([x, y]) => [x * pad, y * pad]))
      const mask = rasterize(strokes)
      const best = new Map()
      for (const index of indexes) {
        rankShapes(index, mask, { limit: index.chars.length, strokes: strokes.length, strokeCounts })
          .forEach((hit, at) => { const known = best.get(hit.char); if (known === undefined || at < known) best.set(hit.char, at) })
      }
      const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]).map(([char]) => char).filter(char => /[\u{17000}-\u{187FF}]/u.test(char))
      const at = ranked.indexOf(record.char)
      drawings++
      if (at === 0) first++
      if (at >= 0 && at < 5) five++
    }
  }
  const top1 = first / drawings, top5 = five / drawings
  console.log(`${drawings} drawings: top 1 ${(top1 * 100).toFixed(0)}%, top 5 ${(top5 * 100).toFixed(0)}%`)
  // The figures recorded for the search as it stands: 29% and 50%. A change that drops them fails.
  expect(top1).toBeGreaterThanOrEqual(0.25)
  expect(top5).toBeGreaterThanOrEqual(0.45)
}, 60_000)

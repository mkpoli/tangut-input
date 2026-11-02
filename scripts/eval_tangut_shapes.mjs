// Measure the drawing search on synthetic drawings: each test glyph is thinned to a one-pixel
// skeleton, skewed and stretched at random, redrawn as thin strokes and ranked against every glyph.
// The test input comes from the same font as the index, so the figures are an upper bound; real
// handwriting differs from the font far more than these drawings do.
//   bun scripts/eval_tangut_shapes.mjs [samples] [seed] [warp]
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { parseShapes, indexShapes, rasterize, rankShapes, SIZE } from '../app/lib/shape.js'

const samples = Number(process.argv[2] ?? 300)
let seed = Number(process.argv[3] ?? 7)
// A warp amplitude in cells: each point is pushed along a slow random wave, as an unsteady hand might.
const warp = Number(process.argv[4] ?? 0)
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

const shapes = parseShapes(gunzipSync(readFileSync(new URL('../app/data/tangut-shapes.bin.gz', import.meta.url))))
const index = indexShapes(shapes)
const ideographs = index.chars.map((char, i) => [char, i]).filter(([char]) => /[\u{17000}-\u{187FF}]/u.test(String(char)))

/** Zhang–Suen thinning of a 0/1 grid. @param {Uint8Array} source */
function thin(source) {
  const g = Uint8Array.from(source)
  const at = (x, y) => (x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : g[y * SIZE + x])
  let changed = true
  while (changed) {
    changed = false
    for (const step of [0, 1]) {
      const drop = []
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (!at(x, y)) continue
        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)]
        const b = p.reduce((s, v) => s + v, 0)
        let a = 0
        for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++
        const c1 = step ? p[0] * p[2] * p[6] : p[0] * p[2] * p[4]
        const c2 = step ? p[0] * p[4] * p[6] : p[2] * p[4] * p[6]
        if (b >= 2 && b <= 6 && a === 1 && !c1 && !c2) drop.push(y * SIZE + x)
      }
      for (const c of drop) g[c] = 0
      if (drop.length) changed = true
    }
  }
  return g
}

const hits = { 1: 0, 5: 0, 20: 0, 60: 0 }
const bytes = SIZE * SIZE / 8
for (let n = 0; n < samples; n++) {
  const [char, i] = ideographs[Math.floor(random() * ideographs.length)]
  const grid = new Uint8Array(SIZE * SIZE)
  for (let c = 0; c < SIZE * SIZE; c++) grid[c] = (shapes.masks[Number(i) * bytes + (c >> 3)] >> (c & 7)) & 1
  const skeleton = thin(grid)
  const sx = 0.8 + random() * 0.4, sy = 0.8 + random() * 0.4, shear = (random() - 0.5) * 0.3
  const fx = 0.15 + random() * 0.2, fy = 0.15 + random() * 0.2, px = random() * 6.3, py = random() * 6.3
  /** @type {[number, number][][]} */
  const strokes = []
  for (let c = 0; c < SIZE * SIZE; c++) if (skeleton[c]) {
    const x = c % SIZE, y = Math.floor(c / SIZE)
    const jx = (random() - 0.5) * 0.8, jy = (random() - 0.5) * 0.8
    const wx = warp * Math.sin(y * fy + px), wy = warp * Math.sin(x * fx + py)
    strokes.push([[(x + wx + shear * y) * sx + jx, (y + wy) * sy + jy]])
  }
  const ranked = rankShapes(index, rasterize(strokes), { limit: 60 })
  const at = ranked.findIndex(hit => hit.char === char)
  for (const k of Object.keys(hits)) if (at >= 0 && at < Number(k)) hits[k]++
}
console.log(`${samples} synthetic drawings: ` + Object.entries(hits).map(([k, v]) => `top ${k} ${(100 * v / samples).toFixed(0)}%`).join(', '))

// Drawing search: a drawing and every glyph are stretched to fill the same 32×32 square, and each glyph
// is scored by how far the drawing's ink lies from the glyph's ink and the glyph's ink from the
// drawing's (a two-way chamfer distance). It knows nothing of strokes, order or direction, only of
// where ink is, so it ranks by overall shape and is rough by construction.

export const SIZE = 32
const FIT = 30
const CELLS = SIZE * SIZE
const FAR = 255

/** @typedef {{ size: number, chars: string[], masks: Uint8Array }} Shapes */
/** @typedef {{ chars: string[], fields: Uint8Array, inks: Uint16Array[] }} ShapeIndex */
/** @typedef {[x: number, y: number][]} Stroke */

/** Parse the binary shape file: a u32 header length, the JSON header, the packed masks. @param {Uint8Array} bytes @returns {Shapes} */
export function parseShapes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const length = view.getUint32(0, true)
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + length)))
  return { size: header.size, chars: [...header.chars], masks: bytes.subarray(4 + length) }
}

/** The distance field and ink cells of every glyph, computed once. @param {Shapes} shapes @returns {ShapeIndex} */
export function indexShapes(shapes) {
  const bytes = CELLS / 8
  const fields = new Uint8Array(shapes.chars.length * CELLS)
  /** @type {Uint16Array[]} */
  const inks = []
  const grid = new Uint8Array(CELLS)
  for (let i = 0; i < shapes.chars.length; i++) {
    const packed = shapes.masks.subarray(i * bytes, (i + 1) * bytes)
    let count = 0
    for (let c = 0; c < CELLS; c++) {
      grid[c] = (packed[c >> 3] >> (c & 7)) & 1
      count += grid[c]
    }
    const ink = new Uint16Array(count)
    for (let c = 0, k = 0; c < CELLS; c++) if (grid[c]) ink[k++] = c
    inks.push(ink)
    fields.set(distanceField(grid), i * CELLS)
  }
  return { chars: shapes.chars, fields, inks }
}

/** City-block distance (×2, diagonal 3) from every cell to the nearest ink cell. @param {Uint8Array} grid */
export function distanceField(grid) {
  const field = new Uint8Array(CELLS)
  for (let c = 0; c < CELLS; c++) field[c] = grid[c] ? 0 : FAR
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = y * SIZE + x
    let d = field[c]
    if (x > 0) d = Math.min(d, field[c - 1] + 2)
    if (y > 0) {
      d = Math.min(d, field[c - SIZE] + 2)
      if (x > 0) d = Math.min(d, field[c - SIZE - 1] + 3)
      if (x < SIZE - 1) d = Math.min(d, field[c - SIZE + 1] + 3)
    }
    field[c] = d
  }
  for (let y = SIZE - 1; y >= 0; y--) for (let x = SIZE - 1; x >= 0; x--) {
    const c = y * SIZE + x
    let d = field[c]
    if (x < SIZE - 1) d = Math.min(d, field[c + 1] + 2)
    if (y < SIZE - 1) {
      d = Math.min(d, field[c + SIZE] + 2)
      if (x < SIZE - 1) d = Math.min(d, field[c + SIZE + 1] + 3)
      if (x > 0) d = Math.min(d, field[c + SIZE - 1] + 3)
    }
    field[c] = d
  }
  return field
}

/** Stretch the strokes to fill the square, as the glyph masks are, and draw them as a mask. @param {Stroke[]} strokes @param {number} [width] */
export function rasterize(strokes, width = 2.4) {
  const grid = new Uint8Array(CELLS)
  const points = strokes.flat()
  if (!points.length) return grid
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6)
  // A stroke or two drawn alone stays thin rather than being blown up into a block.
  const scaleX = (FIT - width) / Math.max(spanX, spanY / 4)
  const scaleY = (FIT - width) / Math.max(spanY, spanX / 4)
  const offsetX = (SIZE - (maxX - minX) * scaleX) / 2
  const offsetY = (SIZE - (maxY - minY) * scaleY) / 2
  /** @param {[number, number]} point @returns {[number, number]} */
  const place = ([x, y]) => [(x - minX) * scaleX + offsetX, (y - minY) * scaleY + offsetY]
  const radius = width / 2
  for (const stroke of strokes) {
    const placed = stroke.map(place)
    if (placed.length === 1) placed.push(placed[0])
    for (let i = 1; i < placed.length; i++) segment(grid, placed[i - 1], placed[i], radius)
  }
  return grid
}

/** @param {Uint8Array} grid @param {[number, number]} a @param {[number, number]} b @param {number} radius */
function segment(grid, a, b, radius) {
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius))
  const x1 = Math.min(SIZE - 1, Math.ceil(Math.max(a[0], b[0]) + radius))
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius))
  const y1 = Math.min(SIZE - 1, Math.ceil(Math.max(a[1], b[1]) + radius))
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const length = dx * dx + dy * dy
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5
    const t = length ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / length)) : 0
    const ex = a[0] + t * dx - px, ey = a[1] + t * dy - py
    if (ex * ex + ey * ey <= radius * radius) grid[y * SIZE + x] = 1
  }
}

/**
 * Rank the glyphs by shape distance from the drawn mask. A stroke count, when given, nudges glyphs
 * whose recorded count is near it upward; it never removes one.
 * @param {ShapeIndex} index
 * @param {Uint8Array} drawn
 * @param {{ limit?: number, strokes?: number, strokeCounts?: Map<string, number>, only?: (char: string) => boolean }} [options]
 * @returns {{ char: string, score: number }[]}
 */
export function rankShapes(index, drawn, options = {}) {
  const { limit = 60, strokes = 0, strokeCounts, only } = options
  const ink = []
  for (let c = 0; c < CELLS; c++) if (drawn[c]) ink.push(c)
  if (!ink.length) return []
  const field = distanceField(drawn)
  /** @type {{ char: string, score: number }[]} */
  const scored = []
  for (let i = 0; i < index.chars.length; i++) {
    const char = index.chars[i]
    if (only && !only(char)) continue
    const base = i * CELLS
    let forward = 0
    for (const c of ink) forward += index.fields[base + c]
    const glyph = index.inks[i]
    let backward = 0
    for (let k = 0; k < glyph.length; k++) backward += field[glyph[k]]
    let score = forward / ink.length + backward / Math.max(1, glyph.length)
    if (strokes && strokeCounts) {
      const recorded = strokeCounts.get(char)
      if (recorded) score += 0.35 * Math.abs(recorded - strokes)
    }
    scored.push({ char, score })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, limit)
}

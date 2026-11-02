// Drawing search: a drawing and every glyph are stretched to fill the same 32×32 square, and each glyph
// is scored by two chamfer distances: how far the drawing's ink lies from the glyph's ink and the
// glyph's ink from the drawing's, and how far the direction the drawing runs at each cell is from the
// direction the glyph runs there. The glyph files hold pen lines thinned to one cell, so a drawing is
// compared with the line a writer would have followed rather than with a printed stroke's width.

export const SIZE = 32
const FIT = 30
const PEN = 1.6
const DIRECTIONS = 4
const DIRECTION_WEIGHT = 2
const CELLS = SIZE * SIZE
const FAR = 255

/** @typedef {{ size: number, chars: string[], masks: Uint8Array }} Shapes */
/** @typedef {{ chars: string[], fields: Uint8Array, inks: Uint16Array[], bins: Uint8Array[] }} ShapeIndex */
/** @typedef {[x: number, y: number][]} Stroke */

/** Parse the binary shape file: a u32 header length, the JSON header, the packed masks. @param {Uint8Array} bytes @returns {Shapes} */
export function parseShapes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const length = view.getUint32(0, true)
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + length)))
  return { size: header.size, chars: [...header.chars], masks: bytes.subarray(4 + length) }
}

/** The distance field, ink cells and ink directions of every glyph, computed once. @param {Shapes} shapes @returns {ShapeIndex} */
export function indexShapes(shapes) {
  const bytes = CELLS / 8
  const fields = new Uint8Array(shapes.chars.length * CELLS)
  /** @type {Uint16Array[]} */
  const inks = []
  /** @type {Uint8Array[]} */
  const bins = []
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
    bins.push(inkDirections(grid, ink))
    fields.set(distanceField(grid), i * CELLS)
  }
  return { chars: shapes.chars, fields, inks, bins }
}

/**
 * The direction the ink runs at each ink cell, in four bins of 45°, from the second moments of the ink
 * within two cells. A drawing is read the same way, so both sides are measured alike.
 * @param {Uint8Array} grid
 * @param {ArrayLike<number>} ink cells, in the order the bins are returned
 * @returns {Uint8Array}
 */
export function inkDirections(grid, ink) {
  const bins = new Uint8Array(ink.length)
  for (let k = 0; k < ink.length; k++) {
    const c = ink[k]
    const x = c % SIZE, y = (c - x) / SIZE
    let sxx = 0, sxy = 0, syy = 0, count = 0
    for (let dy = -2; dy <= 2; dy++) {
      const ny = y + dy
      if (ny < 0 || ny >= SIZE) continue
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx
        if (nx < 0 || nx >= SIZE || !grid[ny * SIZE + nx]) continue
        sxx += dx * dx; sxy += dx * dy; syy += dy * dy; count++
      }
    }
    // A lone cell has no direction to speak of; it is left to the distance term.
    if (count < 3) { bins[k] = DIRECTIONS; continue }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    bins[k] = directionBin(Math.cos(angle), Math.sin(angle))
  }
  return bins
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

/** Stretch the strokes to fill the square, as the glyph masks are. @param {Stroke[]} strokes @param {number} [width] @returns {[number, number][][]} */
function placeStrokes(strokes, width = PEN) {
  const points = strokes.flat()
  if (!points.length) return []
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
  return strokes.map(stroke => stroke.map(([x, y]) => /** @type {[number, number]} */ ([(x - minX) * scaleX + offsetX, (y - minY) * scaleY + offsetY])))
}

/** Draw the strokes as a mask. @param {Stroke[]} strokes @param {number} [width] */
export function rasterize(strokes, width = PEN) {
  const grid = new Uint8Array(CELLS)
  walk(placeStrokes(strokes, width), width, (cell) => { grid[cell] = 1 })
  return grid
}

/** The four directions a line can be drawn along, as the index of a 45° bin. @param {number} dx @param {number} dy */
export function directionBin(dx, dy) {
  let angle = Math.atan2(dy, dx)
  if (angle < 0) angle += Math.PI
  return Math.min(DIRECTIONS - 1, Math.floor((angle / Math.PI) * DIRECTIONS))
}

/** @param {[number, number][][]} strokes @param {number} width @param {(cell: number) => void} visit */
function walk(strokes, width, visit) {
  const radius = width / 2
  for (const stroke of strokes) {
    const path = stroke.length === 1 ? [stroke[0], stroke[0]] : stroke
    for (let i = 1; i < path.length; i++) cover(path[i - 1], path[i], radius, visit)
  }
}

/** Visit every cell a round pen of this radius covers along the segment. @param {[number, number]} a @param {[number, number]} b @param {number} radius @param {(cell: number) => void} visit */
function cover(a, b, radius, visit) {
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
    if (ex * ex + ey * ey <= radius * radius) visit(y * SIZE + x)
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
  // How far each cell lies from ink drawn along each of the four directions.
  const drawnBins = inkDirections(drawn, ink)
  const directionFields = []
  for (let b = 0; b < DIRECTIONS; b++) {
    const grid = new Uint8Array(CELLS)
    for (let k = 0; k < ink.length; k++) if (drawnBins[k] === b) grid[ink[k]] = 1
    directionFields.push(distanceField(grid))
  }
  /** @type {{ char: string, score: number }[]} */
  const scored = []
  for (let i = 0; i < index.chars.length; i++) {
    const char = index.chars[i]
    if (only && !only(char)) continue
    const base = i * CELLS
    let forward = 0
    for (const c of ink) forward += index.fields[base + c]
    const glyph = index.inks[i]
    const bins = index.bins[i]
    let backward = 0
    let direction = 0
    let directed = 0
    for (let k = 0; k < glyph.length; k++) {
      const c = glyph[k]
      backward += field[c]
      const bin = bins[k]
      if (bin < DIRECTIONS) {
        direction += directionFields[bin][c]
        directed++
      }
    }
    let score = forward / ink.length + backward / Math.max(1, glyph.length)
      + DIRECTION_WEIGHT * direction / Math.max(1, directed)
    if (strokes && strokeCounts) {
      const recorded = strokeCounts.get(char)
      if (recorded) score += 0.35 * Math.abs(recorded - strokes)
    }
    scored.push({ char, score })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, limit)
}

// Drawing search: a drawing and every glyph are stretched to fill the same 32×32 square, and each glyph
// is scored by two chamfer distances: how far the drawing's ink lies from the glyph's ink and the
// glyph's ink from the drawing's, and how far the direction the drawing runs at each cell is from the
// direction the glyph runs there. The glyph files hold pen lines thinned to one cell, so a drawing is
// compared with the line a writer would have followed rather than with a printed stroke's width.
// Both lines are then resampled at half strength so cumulative line density is uniform, the same map
// the shape files were built with.

export const SIZE = 32
const FIT = 30
const PEN = 1.6
const DIRECTIONS = 8
const DIRECTION_WEIGHT = 2
const CELLS = SIZE * SIZE
const FAR = 255
// Distances are read in units of half a cell; past six cells a stroke is simply elsewhere, and
// leaving it uncapped lets one stray line outweigh the rest of the character.
const TRUNCATE = 12
const BLOCK = 4
// Blend of a cell's own coordinate and the coordinate that evens out cumulative line density,
// half and half. Yamada, Yamamoto, Saito, Pattern Recognition 23.9 (1990), pp. 1023–1029.
// scripts/build_tangut_shapes.py bakes the same blend into the glyph masks.
const DENSITY_BLEND = 0.5
// Pitch used where a scan has no stroke on one side: four image widths, the value given for that
// case of this method by US 5,757,979 (Hongo, 1998).
const OPEN_PITCH = 4

/** @typedef {{ size: number, chars: string[], masks: Uint8Array }} Shapes */
/** @typedef {{ chars: string[], fields: Uint8Array, inks: Uint16Array[], bins: Uint8Array[], blocks: Uint8Array[] }} ShapeIndex */
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
  /** @type {Uint8Array[]} */
  const blocks = []
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
    const directions = inkDirections(grid, ink)
    bins.push(directions)
    blocks.push(blockHistogram(directions, ink))
    fields.set(distanceField(grid), i * CELLS)
  }
  return { chars: shapes.chars, fields, inks, bins, blocks }
}

/**
 * The direction the ink runs at each ink cell, in eight bins of 22.5°, from the second moments of the ink
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
    field[c] = Math.min(TRUNCATE, d)
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
  // Fitted by the longer side, as the glyph masks are: the drawing keeps its proportions.
  const scale = (FIT - width) / Math.max(spanX, spanY)
  const offsetX = (SIZE - spanX * scale) / 2
  const offsetY = (SIZE - spanY * scale) / 2
  return strokes.map(stroke => stroke.map(([x, y]) => /** @type {[number, number]} */ ([(x - minX) * scale + offsetX, (y - minY) * scale + offsetY])))
}

/**
 * Line density along one scan: the reciprocal of the distance between the centres of the ink runs
 * on either side of the cell. A cell with a run missing on one side takes the open pitch.
 * @param {ArrayLike<number>} line
 */
function pitchDensity(line) {
  /** @type {[number, number, number][]} */
  const runs = []
  let start = /** @type {number | null} */ (null)
  for (let i = 0; i < line.length; i++) {
    if (line[i] && start === null) start = i
    else if (!line[i] && start !== null) {
      runs.push([start, i - 1, (start + i - 1) / 2])
      start = null
    }
  }
  if (start !== null) runs.push([start, line.length - 1, (start + line.length - 1) / 2])
  const openPitch = OPEN_PITCH * line.length
  const density = new Array(line.length)
  for (let x = 0; x < line.length; x++) {
    let inside = -1
    for (let i = 0; i < runs.length; i++) if (runs[i][0] <= x && x <= runs[i][1]) { inside = i; break }
    /** @type {number | null} */
    let left = null
    /** @type {number | null} */
    let right = null
    if (inside >= 0) {
      if (inside > 0) left = runs[inside - 1][2]
      if (inside + 1 < runs.length) right = runs[inside + 1][2]
    } else {
      for (const run of runs) {
        if (run[2] < x) left = run[2]
        else if (run[2] > x) { right = run[2]; break }
      }
    }
    const pitch = left !== null && right !== null ? right - left : openPitch
    density[x] = pitch ? 1 / pitch : 1
  }
  return density
}

/** Cell i mapped halfway from where it is toward a uniform cumulative line density. @param {number[]} weights */
function axisMap(weights) {
  const n = weights.length
  let denom = 0
  for (let i = 0; i < n - 1; i++) denom += weights[i]
  const out = new Array(n)
  if (!(denom > 0)) {
    for (let i = 0; i < n; i++) out[i] = i
    return out
  }
  let acc = 0
  for (let i = 0; i < n; i++) {
    const equalised = (n - 1) * acc / denom
    out[i] = (1 - DENSITY_BLEND) * i + DENSITY_BLEND * equalised
    if (i < n - 1) acc += weights[i]
  }
  return out
}

/** The half-strength line-density map of a mask, one position per column and per row. @param {Uint8Array} grid */
function densityMaps(grid) {
  const hx = new Array(SIZE).fill(0)
  const hy = new Array(SIZE).fill(0)
  const row = new Array(SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) row[x] = grid[y * SIZE + x]
    const density = pitchDensity(row)
    for (let x = 0; x < SIZE; x++) hx[x] += density[x]
  }
  const column = new Array(SIZE)
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) column[y] = grid[y * SIZE + x]
    const density = pitchDensity(column)
    for (let y = 0; y < SIZE; y++) hy[y] += density[y]
  }
  return [axisMap(hx), axisMap(hy)]
}

/** @param {number} p @param {number[]} map */
function mapAt(p, map) {
  const n = map.length
  if (p <= 0) return map[0]
  if (p >= n - 1) return map[n - 1]
  const i = Math.floor(p)
  const t = p - i
  return map[i] * (1 - t) + map[Math.min(n - 1, i + 1)] * t
}

/**
 * Draw the strokes as a mask. The line-density map is read from a one-cell line, the same ink the
 * glyph masks hold, and the pen is then drawn along the resampled coordinates.
 * @param {Stroke[]} strokes
 * @param {number} [width]
 */
export function rasterize(strokes, width = PEN) {
  const placed = placeStrokes(strokes, width)
  const line = new Uint8Array(CELLS)
  walk(placed, 1, (cell) => { line[cell] = 1 })
  let ink = 0
  for (let c = 0; c < CELLS; c++) ink += line[c]
  if (!ink) return line
  const [mx, my] = densityMaps(line)
  const warped = placed.map(stroke => stroke.map(([x, y]) => /** @type {[number, number]} */ ([mapAt(x, mx), mapAt(y, my)])))
  const out = new Uint8Array(CELLS)
  walk(warped, width, (cell) => { out[cell] = 1 })
  return out
}

/**
 * The ink of each cell assigned to one of sixteen blocks, four by four, with its direction: a coarse
 * picture of where each direction sits, which the chamfer term alone does not see.
 * @param {Uint8Array} bins
 * @param {ArrayLike<number>} ink
 * @returns {Uint8Array}
 */
export function blockHistogram(bins, ink) {
  const counts = new Uint8Array(BLOCK * BLOCK * DIRECTIONS)
  for (let k = 0; k < ink.length; k++) {
    const bin = bins[k]
    if (bin >= DIRECTIONS) continue
    const c = ink[k]
    const x = c % SIZE, y = (c - x) / SIZE
    const bx = Math.min(BLOCK - 1, (x * BLOCK / SIZE) | 0)
    const by = Math.min(BLOCK - 1, (y * BLOCK / SIZE) | 0)
    counts[(by * BLOCK + bx) * DIRECTIONS + bin] = Math.min(255, counts[(by * BLOCK + bx) * DIRECTIONS + bin] + 1)
  }
  return counts
}

/** Cosine similarity of two block histograms. @param {ArrayLike<number>} a @param {ArrayLike<number>} b */
function similarity(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/** The eight directions a line can be drawn along, as the index of a 22.5° bin. @param {number} dx @param {number} dy */
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
 * @param {{ limit?: number, strokes?: number, strokeCounts?: Map<string, number>, strokeWeight?: number, directionWeight?: number, only?: (char: string) => boolean, rerankDepth?: number, rerankWeight?: number }} [options]
 * @returns {{ char: string, at: number, score: number, forward: number, backward: number, direction: number, stroke: number }[]}
 */
export function rankShapes(index, drawn, options = {}) {
  const { limit = 60, strokes = 0, strokeCounts, strokeWeight = 0.35, directionWeight = DIRECTION_WEIGHT, only, rerankDepth = 150, rerankWeight = 0.5 } = options
  const ink = []
  for (let c = 0; c < CELLS; c++) if (drawn[c]) ink.push(c)
  if (!ink.length) return []
  const field = distanceField(drawn)
  // How far each cell lies from ink drawn along each of the eight directions.
  const drawnBins = inkDirections(drawn, ink)
  const directionFields = []
  for (let b = 0; b < DIRECTIONS; b++) {
    const grid = new Uint8Array(CELLS)
    for (let k = 0; k < ink.length; k++) if (drawnBins[k] === b) grid[ink[k]] = 1
    directionFields.push(distanceField(grid))
  }
  /** @type {{ char: string, at: number, score: number, forward: number, backward: number, direction: number, stroke: number }[]} */
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
    // The terms stay separate so a benchmark can re-weigh them without recomputing the distances.
    const parts = {
      forward: forward / ink.length,
      backward: backward / Math.max(1, glyph.length),
      direction: direction / Math.max(1, directed),
      stroke: strokes && strokeCounts?.get(char) ? Math.abs((strokeCounts.get(char) ?? 0) - strokes) : 0,
    }
    const score = parts.forward + parts.backward + directionWeight * parts.direction + strokeWeight * parts.stroke
    scored.push({ char, at: i, score, ...parts })
  }
  scored.sort((a, b) => a.score - b.score)
  if (rerankDepth > 0 && index.blocks) {
    // A second look at the head of the list: characters whose ink sits in the wrong quarter of the
    // square score well on chamfer and badly here.
    const head = scored.slice(0, rerankDepth)
    const own = blockHistogram(drawnBins, ink)
    const scale = head[0]?.score || 1
    for (const hit of head) hit.score = hit.score / scale + rerankWeight * (1 - similarity(own, index.blocks[hit.at]))
    head.sort((a, b) => a.score - b.score)
    scored.splice(0, rerankDepth, ...head)
  }
  return scored.slice(0, limit)
}

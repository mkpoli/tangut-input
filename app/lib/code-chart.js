// The code chart's blocks, pages and counts. The Unicode blocks hold the site's characters and
// components; a page is 16 rows of 16 code positions, so every page starts on a row boundary.

/** Every block the chart draws, in code order. @type {{ key: string, label: string, kind: 'characters' | 'components', start: number, end: number }[]} */
export const BLOCKS = [
  { key: 'tangut', label: 'codes.block.tangut', kind: 'characters', start: 0x17000, end: 0x187FF },
  { key: 'components', label: 'codes.block.components', kind: 'components', start: 0x18800, end: 0x18AFF },
  { key: 'supplement', label: 'codes.block.supplement', kind: 'characters', start: 0x18D00, end: 0x18D7F },
  { key: 'supplementComponents', label: 'codes.block.supplementComponents', kind: 'components', start: 0x18D80, end: 0x18DFF },
]

export const COLUMNS = 16
export const PER_PAGE = COLUMNS * COLUMNS

/** A block's range as the chart writes it. @param {number} start @param {number} end */
export const rangeLabel = (start, end) => `U+${start.toString(16).toUpperCase()}–U+${end.toString(16).toUpperCase()}`

/** The first and last assigned code on a chart page. @param {{ cells: (string | null)[] }} page */
export function pageRange(page) {
  const chars = page.cells.filter((char) => char !== null)
  if (!chars.length) return ''
  const at = chars.map(char => char.codePointAt(0) ?? 0)
  return rangeLabel(at[0], at[at.length - 1])
}

/**
 * A block's positions and how many of them the records fill.
 * @param {{ key: string, label: string, kind: 'characters' | 'components', start: number, end: number }} block
 * @param {Set<string>} chars
 */
export function blockUse(block, chars) {
  const positions = block.end - block.start + 1
  let assigned = 0
  for (let code = block.start; code <= block.end; code++) if (chars.has(String.fromCodePoint(code))) assigned++
  return { ...block, positions, assigned, share: assigned / positions, range: rangeLabel(block.start, block.end) }
}

/**
 * The four blocks the chart counts, with the records' occupancy.
 * @param {Set<string>} characters @param {Set<string>} components
 */
export function blockUseAll(characters, components) {
  return BLOCKS.map(block => blockUse(block, block.kind === 'characters' ? characters : components))
}

/**
 * The pages of one section: each block's positions in runs of 16 rows, with a null in every
 * unassigned slot. The last page of a block is padded to the full page.
 * @param {'characters' | 'components'} kind
 * @param {Set<string>} chars
 * @returns {{ block: string, start: number, cells: (string | null)[] }[]}
 */
export function chartPages(kind, chars) {
  /** @type {{ block: string, start: number, cells: (string | null)[] }[]} */
  const pages = []
  for (const block of BLOCKS) {
    if (block.kind !== kind) continue
    for (let start = block.start; start <= block.end; start += PER_PAGE) {
      /** @type {(string | null)[]} */
      const cells = []
      for (let code = start; code < start + PER_PAGE; code++) {
        const char = code <= block.end ? String.fromCodePoint(code) : null
        cells.push(char && chars.has(char) ? char : null)
      }
      pages.push({ block: block.key, start, cells })
    }
  }
  return pages
}

/** The use-count buckets, low to high, over all components. @type {{ label: string, min: number, max: number }[]} */
export const USE_BUCKETS = [
  { label: '0', min: 0, max: 0 },
  { label: '1–2', min: 1, max: 2 },
  { label: '3–5', min: 3, max: 5 },
  { label: '6–10', min: 6, max: 10 },
  { label: '11–25', min: 11, max: 25 },
  { label: '26–50', min: 26, max: 50 },
  { label: '51+', min: 51, max: Infinity },
]

/**
 * How many characters use each component, the buckets over all components, and the most-used ones.
 * @param {Set<string>} components @param {Map<string, Set<string>>} usedBy
 */
export function componentUse(components, usedBy) {
  const rows = [...components].map(char => ({ char, uses: usedBy.get(char)?.size ?? 0 }))
  const total = rows.length
  const buckets = USE_BUCKETS.map(bucket => {
    const count = rows.filter(row => row.uses >= bucket.min && row.uses <= bucket.max).length
    return { label: bucket.label, count, share: total ? count / total : 0 }
  })
  const top = [...rows]
    .sort((a, b) => b.uses - a.uses || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
    .slice(0, 6)
  return { total, buckets, top }
}

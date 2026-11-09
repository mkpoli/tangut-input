// The Tangut Yinchuan private-use variants. A PUA code names a glyph variant of an encoded Tangut
// character, not a different character; the table pairs each with its base, IDS and source.

export const PUA_SOURCE = 'https://www.babelstone.co.uk/Fonts/Tangut_Variants.html'
export const PUA_FONT = 'https://www.babelstone.co.uk/Fonts/Yinchuan.html'

/** Whether a five-digit code is in the Yinchuan PUA range. @param {string} code */
const inRange = code => {
  const value = parseInt(code, 16)
  return value >= 0xf0000 && value <= 0xf1613
}

/**
 * A query written as a Tangut Yinchuan PUA code, or the empty string. Four-digit codes are left to
 * the Tibetan Set A finder; the encoded Tangut block is not in this range.
 * @param {string} text
 */
export function parsePuaQuery(text) {
  const explicit = text.match(/^(?:pua|tangut[- ]pua|yinchuan)\s*[-:]?\s*(?:u\+)?([0-9a-f]{5})$/i)
  if (explicit) return inRange(explicit[1]) ? `U+${explicit[1].toUpperCase()}` : ''
  const unicode = text.match(/^u\+([0-9a-f]{5})$/i)
  if (unicode) return inRange(unicode[1]) ? `U+${unicode[1].toUpperCase()}` : ''
  const bare = text.match(/^([0-9a-f]{5})$/i)
  if (bare) return inRange(bare[1]) ? `U+${bare[1].toUpperCase()}` : ''
  return ''
}

/**
 * The encoded base character of every PUA code.
 * @param {Record<string, [string, string, string[]][]>} chars
 * @returns {Map<string, string[]>}
 */
export function indexTangutPua(chars) {
  /** @type {Map<string, Set<string>>} */
  const index = new Map()
  for (const [char, rows] of Object.entries(chars)) {
    for (const [code] of rows) {
      const found = index.get(code)
      if (found) found.add(char)
      else index.set(code, new Set([char]))
    }
  }
  return new Map([...index].map(([code, found]) => [code, [...found].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))]))
}

/**
 * Characters a PUA code names.
 * @param {Map<string, string[]>} index
 * @param {string} text
 * @returns {{ char: string, code: string }[]}
 */
export function byTangutPua(index, text) {
  const code = parsePuaQuery(text)
  if (!code) return []
  return (index.get(code) ?? []).map(char => ({ char, code }))
}

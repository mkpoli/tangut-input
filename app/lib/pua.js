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

/**
 * The PUA rows that no Unicode 18.0 character owns, by code.
 * @param {[code: string, ids: string, sources: string[]][]} rows
 * @returns {Map<string, { code: string, ids: string, sources: string[] }>}
 */
export function indexUnencodedPua(rows) {
  return new Map(rows.map(([code, ids, sources]) => [code, { code, ids, sources }]))
}

/**
 * The unencoded PUA row a query names, or null. A code with a base in the table is left to
 * `byTangutPua`; one that Unicode 18.0 has since given a character to `byEncodedPua`.
 * @param {Map<string, { code: string, ids: string, sources: string[] }>} index
 * @param {string} text
 */
export function byUnencodedPua(index, text) {
  const code = parsePuaQuery(text)
  return (code && index.get(code)) || null
}

/** The private-use character a PUA code names, for a face that draws it. @param {string} code */
export const puaCharacter = code => String.fromCodePoint(parseInt(code.slice(2), 16))

/**
 * The PUA rows that Unicode 18.0 gives a character, by code.
 * @param {[code: string, ids: string, sources: string[], point: string][]} rows
 * @returns {Map<string, { code: string, ids: string, sources: string[], point: string, char: string }>}
 */
export function indexEncodedPua(rows) {
  return new Map(rows.map(([code, ids, sources, point]) => [code, {
    code, ids, sources, point, char: String.fromCodePoint(parseInt(point.slice(2), 16)),
  }]))
}

/**
 * The row a code has a Unicode 18.0 character for, or null.
 * @param {Map<string, { code: string, ids: string, sources: string[], point: string, char: string }>} index
 * @param {string} text
 */
export function byEncodedPua(index, text) {
  const code = parsePuaQuery(text)
  return (code && index.get(code)) || null
}

/**
 * The unencoded PUA rows by their exact IDS.
 * @param {[code: string, ids: string, sources: string[]][]} rows
 * @returns {Map<string, { code: string, ids: string, sources: string[] }>}
 */
export function indexPuaIds(rows) {
  return new Map(rows.map(([code, ids, sources]) => [ids, { code, ids, sources }]))
}

/**
 * The unencoded PUA row whose IDS is the query, or null.
 * @param {Map<string, { code: string, ids: string, sources: string[] }>} index
 * @param {string} text
 */
export function byPuaIds(index, text) {
  const ids = text.trim()
  return ids ? index.get(ids) ?? null : null
}

/**
 * The row for every PUA code that has an encoded base character.
 * @param {Record<string, [string, string, string[]][]>} chars
 * @returns {Map<string, { code: string, ids: string, sources: string[], char: string }>}
 */
export function indexPuaByCode(chars) {
  /** @type {Map<string, { code: string, ids: string, sources: string[], char: string }>} */
  const index = new Map()
  for (const [char, rows] of Object.entries(chars)) {
    for (const [code, ids, sources] of rows) {
      if (!index.has(code)) index.set(code, { code, ids, sources, char })
    }
  }
  return index
}

/**
 * The PUA row a code names when an encoded character owns it, or null.
 * @param {Map<string, { code: string, ids: string, sources: string[], char: string }>} index
 * @param {string} text
 */
export function byPuaCode(index, text) {
  const code = parsePuaQuery(text)
  return (code && index.get(code)) || null
}

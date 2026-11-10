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
 * One row of the conversion table: a recorded PUA code, the character it converts to, and what
 * records the variant.
 * @typedef {{ code: string, char: string, ids: string, sources: string[], status: 'variant' | 'new' | 'unencoded' }} PuaRow
 */

/**
 * Every recorded PUA code, in code order, with the character it converts to. The 16 codes Unicode
 * 18.0 assigned carry their new character; the 23 still without one carry the empty string.
 * @param {{ chars: Record<string, [string, string, string[]][]>, encodedInUnicode18: [string, string, string[], string][], unencoded: [string, string, string[]][] }} pua
 * @returns {PuaRow[]}
 */
export function tangutPuaTable(pua) {
  /** @type {PuaRow[]} */
  const rows = []
  for (const [char, variants] of Object.entries(pua.chars)) {
    for (const [code, ids, sources] of variants) rows.push({ code, char, ids, sources, status: 'variant' })
  }
  for (const [code, ids, sources, point] of pua.encodedInUnicode18) {
    rows.push({ code, char: String.fromCodePoint(parseInt(point.slice(2), 16)), ids, sources, status: 'new' })
  }
  for (const [code, ids, sources] of pua.unencoded) rows.push({ code, char: '', ids, sources, status: 'unencoded' })
  // A stable sort keeps the source's order for the two rows that share U+F023C.
  return rows.sort((a, b) => parseInt(a.code.slice(2), 16) - parseInt(b.code.slice(2), 16))
}

/**
 * @typedef {{ text: string, converted: number, remaining: number, unencoded: number, otherPua: number, ambiguous: number, unicode18: number }} PuaConversion
 */

/**
 * Convert every Yinchuan PUA character in a text to the character it names. A code with more than
 * one base is left as it is and counted as ambiguous; any other private-use character stays too.
 * @param {string} text
 * @param {{ get(code: string): string[] | undefined }} assigned
 * @param {{ get(code: string): { char: string } | undefined }} encoded
 * @param {{ has(code: string): boolean }} unencoded
 * @returns {PuaConversion}
 */
export function convertTangutPua(text, assigned, encoded, unencoded) {
  let output = ''
  let converted = 0
  let remaining = 0
  let unencodedCount = 0
  let otherPua = 0
  let ambiguous = 0
  let unicode18 = 0
  for (const char of text) {
    if (!/\p{Co}/u.test(char)) { output += char; continue }
    const code = `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`
    const bases = assigned.get(code)
    if (bases?.length === 1) { output += bases[0]; converted++; continue }
    if (bases?.length) { output += char; remaining++; ambiguous++; continue }
    const row = encoded.get(code)
    if (row) { output += row.char; converted++; unicode18++; continue }
    output += char
    remaining++
    if (unencoded.has(code)) unencodedCount++
    else otherPua++
  }
  return { text: output, converted, remaining, unencoded: unencodedCount, otherPua, ambiguous, unicode18 }
}

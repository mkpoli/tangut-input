// The finders that read the records directly: Cangjie codes, meanings, parts and code points.
// Readings live in reading.js and drawings in shape.js.
import { ix, isTangut, OPERATORS } from './db.svelte.js'

/** @typedef {{ char: string, code: string }} CodeHit */

/**
 * Characters whose Cangjie code begins with the typed letters: an exact code first, then shorter
 * codes, then by code. Each character appears once, under its best code.
 * @param {string} letters
 * @param {{ components?: boolean }} [options] components: only codes beginning `p`; otherwise ideographs come first
 * @returns {CodeHit[]}
 */
export function byCode(letters, options = {}) {
  const typed = letters.toLowerCase().replace(/[^a-z]/g, '')
  if (!typed) return []
  const list = ix.codeList
  let low = 0, high = list.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (list[mid][0] < typed) low = mid + 1
    else high = mid
  }
  /** @type {Map<string, string>} */
  const best = new Map()
  for (let i = low; i < list.length && list[i][0].startsWith(typed); i++) {
    const [code, char] = list[i]
    const known = best.get(char)
    if (known === undefined || rank(code, typed) < rank(known, typed)) best.set(char, code)
  }
  return [...best].map(([char, code]) => ({ char, code }))
    .sort((a, b) => rank(a.code, typed) - rank(b.code, typed) || a.code.localeCompare(b.code)
      || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}

/** @param {string} code @param {string} typed */
const rank = (code, typed) => (code === typed ? 0 : 1000) + code.length

/** The languages the meanings are recorded in. */
export const MEANING_LANGUAGES = /** @type {const} */ (['en', 'ja', 'zh'])

/**
 * Characters whose recorded meanings contain the words: a whole sense first, then a whole word, then
 * any substring. The glosses are Open Tangut's, in English, Japanese and Chinese; a search can keep
 * to one of the three.
 * @param {string} query
 * @param {{ languages?: string[] }} [options]
 * @returns {{ char: string, tier: number, sense: string, lang: string }[]}
 */
export function byMeaning(query, options = {}) {
  const needle = query.trim().toLowerCase()
  if (!needle || (/^[a-z ]+$/.test(needle) && needle.length < 2)) return []
  const languages = options.languages?.length ? options.languages : MEANING_LANGUAGES
  const word = new RegExp(`(^|[^\\p{L}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u')
  /** @type {{ char: string, tier: number, sense: string, lang: string }[]} */
  const hits = []
  for (const entry of ix.entries) {
    const d = entry.definitions ?? {}
    let tier = 9, sense = '', lang = ''
    for (const key of languages) for (const text of /** @type {string[]} */ (/** @type {any} */ (d)[key] ?? [])) {
      const lower = text.toLowerCase()
      const senses = lower.split(/[;；,，。、]\s*/)
      const t = senses.some(/** @param {string} part */ part => part.trim() === needle) ? 0 : word.test(lower) ? 1 : lower.includes(needle) ? 2 : 9
      if (t < tier) { tier = t; sense = text; lang = key }
    }
    if (tier < 9) hits.push({ char: entry.char, tier, sense, lang })
  }
  return hits.sort((a, b) => a.tier - b.tier || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}


/**
 * Characters whose description holds every chosen part (a part chosen twice must appear twice),
 * optionally with a given outermost layout.
 * @param {string[]} parts
 * @param {string} [layout] an IDS operator the description must begin with
 * @returns {string[]}
 */
export function byParts(parts, layout = '') {
  if (!parts.length && !layout) return []
  /** @type {Map<string, number>} */
  const need = new Map()
  for (const part of parts) need.set(part, (need.get(part) ?? 0) + 1)
  /** @type {Iterable<string>} */
  let pool = ix.byChar.keys()
  let smallest = Infinity
  for (const part of need.keys()) {
    const users = ix.usedBy.get(part)
    if (!users) return []
    if (users.size < smallest) { pool = users; smallest = users.size }
  }
  /** @type {string[]} */
  const hits = []
  for (const char of pool) {
    if (layout && !ix.byChar.get(char)?.composition?.startsWith(layout)) continue
    const have = ix.partsOf.get(char)
    if ([...need].every(([part, count]) => (have?.get(part) ?? 0) >= count)) hits.push(char)
  }
  return hits.sort((a, b) => (ix.strokes.get(a) ?? 99) - (ix.strokes.get(b) ?? 99) || (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
}

/** The parts other than the chosen ones that occur in the given characters, with how many use each. @param {string[]} chars */
export function partsAmong(chars) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const char of chars) for (const part of ix.partsOf.get(char)?.keys() ?? []) counts.set(part, (counts.get(part) ?? 0) + 1)
  return counts
}

/** The parts of a description, in order, without the layout operators. @param {string} char */
export function partsIn(char) {
  return [...(ix.byChar.get(char)?.composition ?? '')].filter(part => !OPERATORS.has(part) && isTangut(part))
}

/**
 * Characters whose fanqie is spelt with one or two characters: one matches either the upper or the
 * lower of a spelling, two match them in that order. 文海's spelling is read before 合編's.
 * @param {string} text
 * @returns {{ char: string, rhyme: number | null, tone: number | null, spelling: string, upper: string, lower: string }[]}
 */
export function byFanqie(text) {
  const typed = [...text].filter(isTangut)
  if (!typed.length) return []
  const [first, second] = typed
  /** @type {{ char: string, rhyme: number | null, tone: number | null, spelling: string, upper: string, lower: string }[]} */
  const hits = []
  for (const [char, value] of ix.rhymes) {
    const [rhyme, tone, , upper, lower, upperB, lowerB] = value
    const found = second
      ? (upper === first && lower === second) || (upperB === first && lowerB === second)
      : upper === first || lower === first || upperB === first || lowerB === first
    if (!found) continue
    // 文海's spelling is read before 合編's; the two characters are kept apart so each can be read.
    const usedUpper = upper || upperB || ''
    const usedLower = lower || lowerB || ''
    hits.push({ char, rhyme, tone, spelling: `${usedUpper}${usedLower}`, upper: usedUpper, lower: usedLower })
  }
  return hits.sort((a, b) => (a.rhyme ?? 99) - (b.rhyme ?? 99) || (a.tone ?? 9) - (b.tone ?? 9)
    || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}

/**
 * Characters by code point: `U+17000`, `17000` or the leading digits `1700`.
 * @param {string} query
 * @returns {string[]}
 */
export function byCodePoint(query) {
  const digits = query.trim().replace(/^u\+?/i, '').toUpperCase()
  if (!/^[0-9A-F]{3,5}$/.test(digits)) return []
  return ix.all.filter(char => (char.codePointAt(0) ?? 0).toString(16).toUpperCase().startsWith(digits))
}

/** Characters whose four-corner code begins with the typed digits, in code order. @param {string} digits */
export function bySijiao(digits) {
  const typed = digits.replace(/[^0-9]/g, '')
  if (!typed) return []
  /** @type {CodeHit[]} */
  const hits = []
  for (const [code, char] of ix.sijiaoList) {
    if (code.startsWith(typed)) hits.push({ char, code })
  }
  return hits
}

/** The Tangut characters in a piece of text, each once, in order. @param {string} text */
export function tangutIn(text) {
  return [...new Set([...text].filter(isTangut))]
}

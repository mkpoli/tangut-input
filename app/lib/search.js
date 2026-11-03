// The finders that read the records directly: Cangjie codes, meanings, parts and code points.
// Readings live in reading.js and drawings in shape.js.
import { ix, isTangut, OPERATORS } from './db.svelte.js'
import { searchShapeNames } from './names.js'
import { describedBy } from './description.js'

/** @typedef {{ char: string, code: string, near?: boolean }} CodeHit */

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
  if (best.size) {
    return [...best].map(([char, code]) => ({ char, code, near: false }))
      .sort((a, b) => rank(a.code, typed) - rank(b.code, typed) || a.code.localeCompare(b.code)
        || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
  }
  // Nothing begins with the typed code. A code one key away is what a reader most often typed:
  // a letter misread from the chart, or a second analysis of the same shape.
  /** @type {Map<string, string>} */
  const near = new Map()
  for (const [code, char] of list) {
    if (Math.abs(code.length - typed.length) > 1) continue
    if (!within(code, typed)) continue
    const known = near.get(char)
    if (known === undefined || code.length < known.length) near.set(char, code)
  }
  return [...near].map(([char, code]) => ({ char, code, near: true }))
    .sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code))
}

/**
 * Whether two codes differ by at most one key: one letter added, dropped or replaced.
 * @param {string} a @param {string} b
 */
function within(a, b) {
  if (a === b) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (long.length - short.length > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (short.length === long.length) { i++; j++ } else j++
  }
  return edits + (long.length - j) + (short.length - i) <= 1
}

/** @param {string} code @param {string} typed */
const rank = (code, typed) => (code === typed ? 0 : 1000) + code.length

/**
 * Tangut components whose Japanese shape name is the query, or starts it, or holds it. A whole name
 * comes before a longer one, and a component with several names keeps its closest.
 * @param {string} query
 * @returns {{ char: string, name: string, tier: number }[]}
 */
export const byName = query => searchShapeNames(ix.names, query)

/** The languages the meanings are recorded in. */
export const MEANING_LANGUAGES = /** @type {const} */ (['en', 'ja', 'zh'])

/**
 * Characters whose recorded meanings contain the words: a whole sense first, then a whole word, then
 * any substring. The glosses are Open Tangut's, in English, Japanese and Chinese; a search can keep
 * to one of the three. The 文海 explanation of a character is searched too, after every gloss.
 * @param {string} query
 * @param {{ languages?: string[] }} [options]
 * @returns {{ char: string, tier: number, sense: string, lang: string }[]}
 */
export function byMeaning(query, options = {}) {
  const needle = query.trim().toLowerCase()
  if (!needle || (/^[a-z ]+$/.test(needle) && needle.length < 2)) return []
  const languages = options.languages?.length ? options.languages : MEANING_LANGUAGES
  const word = new RegExp(`(^|[^\\p{L}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u')
  /** @param {string} text */
  const rank = text => {
    const lower = text.toLowerCase()
    const senses = lower.split(/[;；,，。、]\s*/)
    return senses.some(/** @param {string} part */ part => part.trim() === needle) ? 0 : word.test(lower) ? 1 : lower.includes(needle) ? 2 : 9
  }
  /** @type {{ char: string, tier: number, sense: string, lang: string }[]} */
  const hits = []
  for (const entry of ix.entries) {
    const d = entry.definitions ?? {}
    let tier = 9, sense = '', lang = ''
    for (const key of languages) for (const text of /** @type {string[]} */ (/** @type {any} */ (d)[key] ?? [])) {
      const t = rank(text)
      if (t < tier) { tier = t; sense = text; lang = key }
    }
    // A character the 文海 explains with the word, without glossing it so, still answers the search.
    if (tier > 2) for (const key of languages) {
      const text = /** @type {any} */ (entry)[`wenhai_text_${key}`]
      if (typeof text !== 'string') continue
      const t = rank(text)
      if (t + 3 < tier) { tier = t + 3; sense = text; lang = key }
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

/**
 * Characters whose recorded description begins with the typed or pasted text: the whole description
 * names its character, a description cut after its opening part names the family that opens so.
 * @param {string} text
 * @returns {string[]}
 */
export const byDescription = text => describedBy(ix.entries, text)

/** The Tangut characters in a piece of text, each once, in order. @param {string} text */
export function tangutIn(text) {
  return [...new Set([...text].filter(isTangut))]
}

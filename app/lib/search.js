// The finders that read the records directly: Cangjie codes, meanings, parts and code points.
// Readings live in reading.js and drawings in shape.js.
import { searchTibetan } from './tibetan.js'
import { byIdentifier as byStoredIdentifier } from './identifiers.js'
import { byTibetanSeta as byStoredSeta } from './seta.js'
import { byTangutPua as byStoredPua } from './pua.js'
import { ix, isTangut, OPERATORS } from './db.svelte.js'
import { matchByParts } from './composition.js'
import { searchShapeNames } from './names.js'
import { describedBy } from './description.js'

/** @typedef {{ char: string, code: string, near?: boolean }} CodeHit */

/** How often the character occurs in the corpus. @param {string} char */
const frequency = char => ix.frequency.get(char) ?? 0

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
      .sort((a, b) => rank(a.code, typed) - rank(b.code, typed)
        || frequency(b.char) - frequency(a.char) || a.code.localeCompare(b.code)
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
    .sort((a, b) => a.code.length - b.code.length || frequency(b.char) - frequency(a.char)
      || a.code.localeCompare(b.code) || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
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
 * any substring. The displayed glosses are Wiktionary's, in English, Japanese and Chinese; a search
 * can keep to one of the three. CCAMC's normalized terms answer the search too, after every gloss,
 * but a result that only CCAMC answers carries no sense: the card links to CCAMC instead.
 * @param {string} query
 * @param {{ languages?: string[] }} [options]
 * @returns {{ char: string, tier: number, sense: string, lang: string, via?: 'ccamc' }[]}
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
  /** @type {{ char: string, tier: number, sense: string, lang: string, via?: 'ccamc' }[]} */
  const hits = []
  /** @type {Set<string>} */
  const seen = new Set()
  for (const entry of ix.entries) {
    const d = entry.definitions ?? {}
    let tier = 9, sense = '', lang = ''
    for (const key of languages) for (const text of /** @type {string[]} */ (/** @type {any} */ (d)[key] ?? [])) {
      const t = rank(text)
      if (t < tier) { tier = t; sense = text; lang = key }
    }
    // Chinese senses imported from Wiktionary answer the Chinese search beside the keyed ones.
    if (languages.includes('zh')) for (const text of entry.wiktionary_zh ?? []) {
      const t = rank(text)
      if (t < tier) { tier = t; sense = text; lang = 'zh' }
    }
    // The 文海's own entry text can answer even when the gloss does not use the word.
    if (tier > 2) for (const key of languages) {
      if (key !== 'zh') continue
      const value = entry.wenhai_text_zh
      if (typeof value !== 'string') continue
      const t = rank(value)
      if (t + 3 < tier) { tier = t + 3; sense = value; lang = key }
    }
    if (tier < 9) { hits.push({ char: entry.char, tier, sense, lang }); seen.add(entry.char) }
  }
  // Downes's glosses answer below Wiktionary's, for the characters it did not find.
  if (languages.includes('en')) {
    for (const [char, text] of ix.downes) {
      if (seen.has(char)) continue
      const tier = rank(text)
      if (tier < 9) {
        hits.push({ char, tier: tier + 3, sense: text, lang: 'en' })
        seen.add(char)
      }
    }
  }
  const hidden = ix.ccamcMeanings
  for (const key of languages) {
    for (const [char, terms] of Object.entries(hidden.meanings?.[key] ?? {})) {
      if (seen.has(char)) continue
      let tier = 9
      for (const text of terms) tier = Math.min(tier, rank(text))
      if (tier < 9) {
        hits.push({ char, tier: tier + 3, sense: '', lang: key, via: 'ccamc' })
        seen.add(char)
      }
    }
  }
  return hits.sort((a, b) => a.tier - b.tier || frequency(b.char) - frequency(a.char)
    || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}


/**
 * Characters whose description holds every chosen part at any layer (a part chosen twice must
 * appear twice), optionally with a given outermost layout. A part can be a component or a
 * character the description spells whole.
 * @param {string[]} parts
 * @param {string} [layout] an IDS operator the description must begin with
 * @returns {string[]}
 */
export function byParts(parts, layout = '') {
  if (!parts.length && !layout) return []
  // The parts and the layout are read from one description, so a three-part description that the
  // editorial cut reads as two matches the operator of that cut.
  const hits = matchByParts(ix, parts, layout)
  return hits.sort((a, b) => (ix.strokes.get(a) ?? 99) - (ix.strokes.get(b) ?? 99)
    || frequency(b) - frequency(a) || (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
}

/** The parts the given characters hold at any layer, with how many use each. @param {string[]} chars */
export function partsAmong(chars) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const char of chars) for (const part of ix.partsOf.get(char)?.keys() ?? []) counts.set(part, (counts.get(part) ?? 0) + 1)
  return counts
}

/** The components of a description, in order, without the layout operators. @param {string} char */
export function partsIn(char) {
  return [...(ix.byChar.get(char)?.composition ?? '')].filter(part => !OPERATORS.has(part) && isTangut(part))
}

/**
 * The parts a character is described with directly, character-sized parts kept whole. Splitting
 * one of these opens the character it stands for in turn.
 * @param {string} char
 */
export function directPartsIn(char) {
  return ix.directPartsOf.get(char) ?? []
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
    || frequency(b.char) - frequency(a.char) || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
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
  return hits.sort((a, b) => a.code.localeCompare(b.code) || frequency(b.char) - frequency(a.char)
    || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}

/**
 * Characters whose recorded or editorial description begins with the typed or pasted text: the whole description
 * names its character, a description cut after its opening part names the family that opens so.
 * @param {string} text
 * @returns {string[]}
 */
export const byDescription = text => describedBy(ix.descriptions, text)

/** The Tangut characters in a piece of text, each once, in order. @param {string} text */
export function tangutIn(text) {
  return [...new Set([...text].filter(isTangut))]
}

/** Characters by a Tibetan spelling, in script, Wylie or the tables' notation. @param {string} text */
export const byTibetan = text => searchTibetan(ix.tibetanIndex, text)

/** Characters by a Li Fanwen number, a 文海 position, a Mojikyo code or an XXZT code. @param {string} text */
export const byIdentifier = text => byStoredIdentifier(ix.identifierIndex, text)

/** Characters whose Tibetan spelling has a Tibetan Extension-A code. @param {string} text */
export const byTibetanSeta = text => byStoredSeta(ix.setaIndex, text)

/** Characters a Tangut Yinchuan PUA variant code names. @param {string} text */
export const byTangutPua = text => byStoredPua(ix.puaIndex, text)

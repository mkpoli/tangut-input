// Finding a character by how it was spelled in Tibetan. One spelling reaches the site in several
// forms: Tibetan script, Wylie as BabelStone writes it, the notation of the tables on the card. All
// fold to one key, so a reader can type whichever they know.

const SCRIPT = /[ཀ-ྼ]/
const SIGNS = /[་༌།\s]/g

/**
 * The key of a spelling typed in Latin letters: long-vowel capitals are doubled, ' and v are the one
 * letter འ, and the marks that separate letters (g-yi, g.yi, k+ha) drop out.
 * @param {string} text
 */
export function foldLatin(text) {
  return text.trim()
    .replace(/[AIU]/g, vowel => vowel.toLowerCase().repeat(2))
    .toLowerCase()
    .replace(/'/g, 'v')
    .replace(/[-.+\s]/g, '')
}

/** The key of a spelling in Tibetan script. @param {string} text */
export const foldScript = text => text.normalize('NFD').replace(SIGNS, '')

/** Whether a query is written in Tibetan script. @param {string} text */
export const isTibetanScript = text => SCRIPT.test(text)

/** Whether a query could be a spelling in Latin letters. @param {string} text */
export const isTibetanLatin = text => /^[a-z'.+\- ]+$/i.test(text.trim())

/**
 * @typedef {{ char: string, latin: string, script: string, shown: string, count: number }} TibetanSpelling
 * @typedef {{ char: string, shown: string, tier: number, count: number }} TibetanHit
 */

/**
 * Every spelling with its keys. One with an unread letter cannot be matched, so it is left out.
 * @param {Map<string, [string, string, [string, number][]][]>} glosses BabelStone's index
 * @param {Record<string, { tibetan?: [string, string, number, string, ...unknown[]][] }>} hands the tables on the card
 * @returns {TibetanSpelling[]}
 */
export function indexTibetan(glosses, hands) {
  /** @type {Map<string, TibetanSpelling>} */
  const found = new Map()
  /** @param {string} char @param {string} written @param {string} shown @param {number} count */
  const add = (char, written, shown, count) => {
    if (/[?[{]/.test(written) || shown.includes('?') || !SCRIPT.test(shown)) return
    const script = foldScript(shown)
    const key = `${char} ${script}`
    const known = found.get(key)
    if (known) known.count += count
    else found.set(key, { char, latin: foldLatin(written), script, shown, count })
  }
  for (const [char, list] of glosses) {
    for (const [wylie, shown, where] of list) add(char, wylie, shown, where.reduce((sum, [, count]) => sum + count, 0))
  }
  for (const [char, entry] of Object.entries(hands)) {
    for (const [, written, count, shown] of entry.tibetan ?? []) add(char, written, shown, count)
  }
  return [...found.values()]
}

/**
 * The characters spelled so: a whole spelling first (tier 0), then one that begins with the query
 * (tier 1), then the most often attested, then code point. A character is listed once, by the best
 * spelling it has.
 * @param {TibetanSpelling[]} index
 * @param {string} query
 * @returns {TibetanHit[]}
 */
export function searchTibetan(index, query) {
  const inScript = isTibetanScript(query)
  if (!inScript && !isTibetanLatin(query)) return []
  const key = inScript ? foldScript(query) : foldLatin(query)
  if (!key) return []
  /** @type {Map<string, TibetanHit>} */
  const hits = new Map()
  for (const spelling of index) {
    const value = inScript ? spelling.script : spelling.latin
    const tier = value === key ? 0 : value.startsWith(key) ? 1 : -1
    if (tier < 0) continue
    const best = hits.get(spelling.char)
    if (!best || tier < best.tier || (tier === best.tier && spelling.count > best.count)) {
      hits.set(spelling.char, { char: spelling.char, shown: spelling.shown, tier, count: spelling.count })
    }
  }
  return [...hits.values()].sort((a, b) => a.tier - b.tier || b.count - a.count || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}

// Add a dotted circle to a lone vowel sign for display. Unread letters remain in the Wylie,
// whose [?] records their position; the partial script alone cannot locate them.
/** @param {string} script */
export const tibetanShown = script => `${/^\p{M}/u.test(script) ? '◌' : ''}${script}`

/** @param {[string, number][]} where */
export const tibetanWhere = where => where.map(([shelf, count]) => `${shelf} ×${count}`).join(', ')

/** A gloss's hover text: its Wylie, and each manuscript it is written in with how often.
 *  @param {string} wylie @param {[string, number][]} where */
export const tibetanTitle = (wylie, where) => `${wylie} · ${tibetanWhere(where)}`

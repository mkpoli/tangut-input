// Tibetan Extension-A, the precomposed stacks the PRC put in the private-use area. BabelStone's
// mapping table pairs each with the Unicode sequence it stands for; a spelling has a code only when
// the sequence is exactly one of the table's 1,536 entries.
import { foldScript } from './tibetan.js'

export const SETA_SOURCE = 'http://web.archive.org/web/20090202122023/http://babelstone.co.uk/Tibetan/PrecomposedTibetan.html'

/**
 * The Set A code for a spelling, or the empty string when no set A character stands for it.
 * @param {Map<string, string>} map folded sequence -> code
 * @param {string} script
 */
export const setaCode = (map, script) => map.get(foldScript(script)) ?? ''

/**
 * The Set A code of every spelling in the two Tibetan sources, with the spelling that carries it.
 * @param {Map<string, string>} map folded sequence -> code
 * @param {Map<string, [string, string, [string, number][]][]>} glosses BabelStone's index
 * @param {Record<string, { tibetan?: [string, string, number, string, ...unknown[]][] }>} hands the card's tables
 * @returns {Map<string, Map<string, string>>} code -> character -> spelling
 */
export function indexTibetanSeta(map, glosses, hands) {
  /** @type {Map<string, Map<string, string>>} */
  const index = new Map()
  /** @param {string} char @param {string} script */
  const add = (char, script) => {
    const code = setaCode(map, script)
    if (!code) return
    let chars = index.get(code)
    if (!chars) { chars = new Map(); index.set(code, chars) }
    if (!chars.has(char)) chars.set(char, script)
  }
  for (const [char, rows] of glosses) for (const [, script] of rows) add(char, script)
  for (const [char, entry] of Object.entries(hands)) for (const row of entry.tibetan ?? []) add(char, row[3])
  return index
}

/**
 * A query written as a Set A code, or the empty string. The explicit forms name the system; a bare
 * four-digit F3xx–F8xx is accepted because no other finder reads a private-use code as a character.
 * @param {string} text
 */
export function parseSetaQuery(text) {
  const explicit = text.match(/^(?:seta|set-a|set a|tibetan[- ]set[- ]a|extension[- ]a)\s*[-:]?\s*(?:u\+)?([0-9a-f]{4})$/i)
  if (explicit) return `U+${explicit[1].toUpperCase()}`
  const unicode = text.match(/^u\+([0-9a-f]{4})$/i)
  if (unicode && /^f[3-8][0-9a-f]{2}$/i.test(unicode[1])) return `U+${unicode[1].toUpperCase()}`
  const bare = text.match(/^([0-9a-f]{4})$/i)
  if (bare && /^f[3-8][0-9a-f]{2}$/i.test(bare[1])) return `U+${bare[1].toUpperCase()}`
  return ''
}

/**
 * Characters whose Tibetan spelling has the queried Set A code.
 * @param {Map<string, Map<string, string>>} index code -> character -> spelling
 * @param {string} text
 * @returns {{ char: string, code: string, script: string }[]}
 */
export function byTibetanSeta(index, text) {
  const code = parseSetaQuery(text)
  if (!code) return []
  const chars = index.get(code)
  return chars ? [...chars].map(([char, script]) => ({ char, code, script })) : []
}

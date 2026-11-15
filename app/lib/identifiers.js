// The numbers and legacy code points a character has besides its Unicode code point. A query may
// arrive as a reader copied it from a dictionary or a converter, so the parser takes the forms each
// source prints and the index keeps the aliases.

/** @typedef {'lfw' | 'wenhai' | 'mojikyo' | 'xxzt'} Scheme */
/** @typedef {[scheme: Scheme, value: string, edition?: string]} Row */
/** @typedef {{ scheme: Scheme, value: string, edition?: string, keys: string[] }} Query */

/** The order the card reads the systems in. */
export const SCHEMES = /** @type {const} */ (['lfw', 'wenhai', 'mojikyo', 'xxzt'])

/** @param {string} value */
const padNumber = value => value.replace(/\d+/, digits => digits.padStart(4, '0'))

/** @param {string} value */
const upper = value => value.toUpperCase()

/**
 * Parse a query written as an identifier. Returns null for anything that is not one.
 * @param {string} text
 * @returns {Query | null}
 */
export function parseIdentifier(text) {
  const input = text.trim()
  const lfw = input.match(/^(?:lfw|l2008|l)\s*[-:]?\s*(\d{1,4})([ab])?(?:\s*[/-]\s*(\d{1,4})([ab])?)?$/i)
  if (lfw) {
    const first = padNumber(lfw[1]) + (lfw[2] ?? '').toUpperCase()
    const second = lfw[3] ? padNumber(lfw[3]) + (lfw[4] ?? '').toUpperCase() : ''
    const value = second ? `L${first}/${second}` : `L${first}`
    const keys = [`lfw:${first}`, `lfw:${first.replace(/[AB]$/, '')}`]
    if (second) keys.push(`lfw:${second}`, `lfw:${second.replace(/[AB]$/, '')}`)
    return { scheme: 'lfw', value, keys }
  }
  const wenhai = input.match(/^(?:(?:wh|wenhai)\s*[-:]?\s*)?([lm])(\d{1,2})\.(\d{1,3})$/i)
  if (wenhai) {
    const value = `${wenhai[1].toUpperCase()}${wenhai[2].padStart(2, '0')}.${wenhai[3].padStart(3, '0')}`
    return { scheme: 'wenhai', value, keys: [`wenhai:${value}`, `wenhai:${value.slice(1)}`] }
  }
  const mojikyo = input.match(/^(mojikyo|mj|m202|m203)\s*[-:]?\s*(?:(4\.?50|4\.?60)\s*[-:]?\s*)?(?:u\+)?([0-9a-f]{4,6})$/i)
  if (mojikyo) {
    const written = mojikyo[2] ? `4.${mojikyo[2].replace('.', '').slice(1)}` : ''
    const edition = written || (mojikyo[1].toLowerCase() === 'm202' ? '4.50' : mojikyo[1].toLowerCase() === 'm203' ? '4.60' : '')
    const value = `U+${upper(mojikyo[3])}`
    return { scheme: 'mojikyo', value, edition: edition || undefined, keys: [edition ? `mojikyo:${edition}:${upper(mojikyo[3])}` : `mojikyo:${upper(mojikyo[3])}`] }
  }
  const xxzt = input.match(/^(?:xxzt|xz)\s*[-:]?\s*(?:(a|b)\s*[-:]?\s*)?(?:u\+)?([0-9a-f]{4,6})$/i)
  if (xxzt) {
    const edition = xxzt[1] ? xxzt[1].toUpperCase() : ''
    const value = `U+${upper(xxzt[2])}`
    return { scheme: 'xxzt', value, edition: edition || undefined, keys: [edition ? `xxzt:${edition}:${upper(xxzt[2])}` : `xxzt:${upper(xxzt[2])}`] }
  }
  return null
}

/**
 * The keys a stored row answers to. A Li Fanwen number is also reachable without its edition
 * letter, and a two-number record by either number.
 * @param {Row} row
 * @returns {string[]}
 */
function rowKeys([scheme, value, edition]) {
  if (scheme === 'lfw') {
    const keys = new Set([`lfw:${value}`])
    for (const part of value.slice(1).split('/')) {
      keys.add(`lfw:${part}`)
      keys.add(`lfw:${part.replace(/[AB]$/, '')}`)
    }
    return [...keys]
  }
  if (scheme === 'wenhai') return [`wenhai:${value}`, `wenhai:${value.slice(1)}`]
  const point = value.replace(/^U\+/, '')
  return edition ? [`${scheme}:${edition}:${point}`, `${scheme}:${point}`] : [`${scheme}:${point}`]
}

/**
 * An index from every key to the characters it names, built once when the records load.
 * @param {Record<string, Row[]>} chars
 * @returns {Map<string, string[]>}
 */
export function indexIdentifiers(chars) {
  /** @type {Map<string, Set<string>>} */
  const index = new Map()
  for (const [char, rows] of Object.entries(chars)) {
    for (const row of rows) {
      for (const key of rowKeys(row)) {
        const found = index.get(key)
        if (found) found.add(char)
        else index.set(key, new Set([char]))
      }
    }
  }
  return new Map([...index].map(([key, found]) => [key, [...found].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))]))
}

/**
 * Characters named by an identifier query. A query with two Li Fanwen numbers needs both.
 * @param {Map<string, string[]>} index
 * @param {string} text
 * @returns {{ char: string, scheme: Scheme, value: string, edition?: string }[]}
 */
export function byIdentifier(index, text) {
  const query = parseIdentifier(text)
  if (!query) return []
  /** @type {Set<string> | null} */
  let found = null
  for (const key of query.keys) {
    const chars = index.get(key) ?? []
    if (found === null) found = new Set(chars)
    else {
      /** @type {Set<string>} */
      const current = found
      found = new Set([...current].filter(char => chars.includes(char)))
    }
  }
  return [...(found ?? [])].map(char => ({ char, scheme: query.scheme, value: query.value, edition: query.edition }))
}

/**
 * A character's rows grouped the way the card reads them: scheme, then edition.
 * @param {Row[]} rows
 * @returns {{ scheme: Scheme, edition?: string, label: string, values: string[] }[]}
 */
export function identifierGroups(rows) {
  /** @type {{ scheme: Scheme, edition?: string, label: string, values: string[] }[]} */
  const groups = []
  for (const scheme of SCHEMES) {
    const list = rows.filter(row => row[0] === scheme)
    if (!list.length) continue
    const editions = scheme === 'mojikyo' || scheme === 'xxzt'
      ? [...new Set(list.map(row => row[2]).filter(Boolean))]
      : [undefined]
    for (const edition of editions) {
      const values = [...new Set(list.filter(row => row[2] === edition).map(row => row[1]))]
      if (values.length) groups.push({ scheme, edition, label: `card.identifier.${scheme}`, values })
    }
  }
  return groups
}

/** The name of an edition as the card prints it. @param {Scheme} scheme @param {string} [edition] */
export function editionName(scheme, edition) {
  if (!edition) return ''
  if (scheme === 'mojikyo') return edition === '4.50' ? 'M202 · 4.50' : 'M203 · 4.60'
  return edition
}

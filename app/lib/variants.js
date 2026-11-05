// Variant forms. English Wiktionary states a few in a character's definitions ("Variant form of 𗇫"),
// and no other source the site may show states any. The rest are candidates found by comparison.

const VARIANT_OF = /^Variant form of ([\u{17000}-\u{18AFF}\u{18D00}-\u{18D7F}])/u

/** @typedef {{ char: string, definitions?: { en?: string[], ja?: string[] }, pronunciations?: Record<string, string> }} VariantEntry */

/**
 * The senses a character's Wiktionary definitions name, for comparing two characters.
 * @param {VariantEntry} entry
 */
function senses(entry) {
  const en = (entry.definitions?.en ?? [])
    .filter(sense => !sense.startsWith('Variant form of'))
    .flatMap(sense => sense.replace(/\(.*?\)/g, '').toLowerCase().split(/[;,]/))
    .map(sense => sense.replace(/[^a-z ]/g, '').trim().replace(/^to /, ''))
  const ja = (entry.definitions?.ja ?? []).flatMap(sense => sense.split(/[、，,;；。\s]/))
  return new Set([...en, ...ja].filter(Boolean))
}

/**
 * Both directions of the stated relation, and the possible variants: characters that share a reading
 * in Li Fanwen's system and a sense in Wiktionary. Nothing states those, so they stay apart from the
 * stated ones, and characters already linked through a stated variant are left out.
 * @param {VariantEntry[]} entries
 * @returns {Map<string, { of: string[], forms: string[], possible: string[] }>}
 */
export function variantIndex(entries) {
  /** @type {Map<string, { of: string[], forms: string[], possible: string[] }>} */
  const index = new Map()
  /** @param {string} char */
  const at = char => {
    let record = index.get(char)
    if (!record) index.set(char, record = { of: [], forms: [], possible: [] })
    return record
  }
  for (const entry of entries) {
    for (const sense of entry.definitions?.en ?? []) {
      const base = VARIANT_OF.exec(sense)?.[1]
      if (!base || base === entry.char || at(entry.char).of.includes(base)) continue
      at(entry.char).of.push(base)
      at(base).forms.push(entry.char)
    }
  }
  /** @param {string} char */
  const family = char => {
    const record = index.get(char)
    return new Set([char, ...(record?.of ?? []), ...(record?.forms ?? []), ...(record?.of ?? []).flatMap(base => index.get(base)?.forms ?? [])])
  }
  /** @type {Map<string, { char: string, senses: Set<string> }[]>} */
  const byReading = new Map()
  for (const entry of entries) {
    const reading = entry.pronunciations?.li_fanwen?.trim()
    const named = senses(entry)
    if (!reading || !named.size) continue
    const peers = byReading.get(reading) ?? []
    for (const peer of peers) {
      if (family(entry.char).has(peer.char) || ![...named].some(sense => peer.senses.has(sense))) continue
      at(entry.char).possible.push(peer.char)
      at(peer.char).possible.push(entry.char)
    }
    byReading.set(reading, [...peers, { char: entry.char, senses: named }])
  }
  return index
}

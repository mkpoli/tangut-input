// Variant forms. English Wiktionary states some outright. The rest are candidates found by comparison,
// so they stay apart from the stated ones.

import VARIANTS from '../data/tangut-variants.json' with { type: 'json' }

/** @typedef {{ char: string, composition?: string, definitions?: { en?: string[], ja?: string[] }, pronunciations?: Record<string, string> }} VariantEntry */

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
 * Both directions of the stated relation, and the possible variants: characters with the same reading
 * in Li Fanwen's system that also share a sense in Wiktionary, or whose descriptions differ only by
 * a pair of variant components. Characters already linked through a stated variant are left out.
 * @param {VariantEntry[]} entries
 * @param {{ variants: string[][], components: string[][] }} [stated]
 * @returns {Map<string, { of: string[], forms: string[], possible: string[] }>}
 */
export function variantIndex(entries, stated = VARIANTS) {
  /** @type {Map<string, { of: string[], forms: string[], possible: string[] }>} */
  const index = new Map()
  /** @param {string} char */
  const at = char => {
    let record = index.get(char)
    if (!record) index.set(char, record = { of: [], forms: [], possible: [] })
    return record
  }
  for (const [form, base] of stated.variants) {
    at(form).of.push(base)
    at(base).forms.push(form)
  }
  /** @param {string} char */
  const family = char => {
    const record = index.get(char)
    return new Set([char, ...(record?.of ?? []), ...(record?.forms ?? []), ...(record?.of ?? []).flatMap(base => index.get(base)?.forms ?? [])])
  }
  /** @param {string} one @param {string} other */
  const link = (one, other) => {
    if (family(one).has(other) || at(one).possible.includes(other)) return
    at(one).possible.push(other)
    at(other).possible.push(one)
  }
  /** @type {Map<string, { char: string, senses: Set<string> }[]>} */
  const byReading = new Map()
  /** @type {Map<string, VariantEntry[]>} */
  const byDescription = new Map()
  for (const entry of entries) {
    if (entry.composition) byDescription.set(entry.composition, [...(byDescription.get(entry.composition) ?? []), entry])
    const reading = entry.pronunciations?.li_fanwen?.trim()
    const named = senses(entry)
    if (!reading || !named.size) continue
    const peers = byReading.get(reading) ?? []
    for (const peer of peers) if ([...named].some(sense => peer.senses.has(sense))) link(entry.char, peer.char)
    byReading.set(reading, [...peers, { char: entry.char, senses: named }])
  }
  for (const [one, other] of stated.components) {
    for (const entry of entries) {
      if (!entry.composition?.includes(one)) continue
      const reading = entry.pronunciations?.li_fanwen?.trim()
      for (const match of byDescription.get(entry.composition.replaceAll(one, other)) ?? []) {
        if (reading && match.pronunciations?.li_fanwen?.trim() === reading) link(entry.char, match.char)
      }
    }
  }
  return index
}

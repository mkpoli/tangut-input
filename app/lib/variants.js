// Variant forms. English and Chinese Wiktionary state some, and a person reported one more.
// The rest are candidates found by comparison, so they stay apart from the stated ones.

import VARIANTS from '../data/tangut-variants.json' with { type: 'json' }

/** @typedef {{ char: string, composition?: string, definitions?: { en?: string[], ja?: string[] }, pronunciations?: Record<string, string> }} VariantEntry */

// Lines that say how a character is used, which two unrelated characters can share.
const FILLER = /^(transliteration of|used in surnames|姓に用いられた字)/

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
  return new Set([...en, ...ja].filter(sense => sense && !FILLER.test(sense)))
}

/**
 * Both directions of the stated relation, reported pairs, and the possible variants: characters
 * with the same reading in Li Fanwen's system that also share a sense in Wiktionary, or whose
 * descriptions differ only by a pair of variant components. Characters already linked, or that
 * Wiktionary calls synonyms, are left out.
 * @typedef {{ of: string[], partial: string[], forms: string[], reported: string[], possible: string[] }} Variants
 * @param {VariantEntry[]} entries
 * @param {{ variants: string[][], partial: string[][], synonyms: string[][], components: string[][], reported: string[][] }} [stated]
 * @returns {Map<string, Variants>}
 */
export function variantIndex(entries, stated = VARIANTS) {
  /** @type {Map<string, Variants>} */
  const index = new Map()
  /** @param {string} char */
  const at = char => {
    let record = index.get(char)
    if (!record) index.set(char, record = { of: [], partial: [], forms: [], reported: [], possible: [] })
    return record
  }
  for (const [form, base] of stated.variants) {
    at(form).of.push(base)
    at(base).forms.push(form)
  }
  for (const [form, base] of stated.partial) {
    at(form).partial.push(base)
    at(base).forms.push(form)
  }
  for (const [one, other] of stated.reported) {
    at(one).reported.push(other)
    at(other).reported.push(one)
  }
  const synonyms = new Set(stated.synonyms.flatMap(([one, other]) => [one + other, other + one]))
  /** @param {string} char */
  const family = char => {
    const record = index.get(char)
    const bases = [...(record?.of ?? []), ...(record?.partial ?? [])]
    return new Set([char, ...bases, ...(record?.forms ?? []), ...(record?.reported ?? []), ...bases.flatMap(base => index.get(base)?.forms ?? [])])
  }
  /** @param {string} one @param {string} other */
  const link = (one, other) => {
    if (synonyms.has(one + other) || family(one).has(other) || index.get(one)?.possible.includes(other)) return
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

/**
 * Keep variant components together in a palette already in its reading order. Each group takes the
 * place of whichever member comes first, so a member can stand in a section with fewer strokes than
 * its own; `section` is the stroke count a part is shown under.
 * @template {{ part: string, strokes: number }} P
 * @param {P[]} parts
 * @param {string[]} [groups]
 * @returns {(P & { section: number })[]}
 */
export function keepVariantsTogether(parts, groups = VARIANTS.groups) {
  /** @type {Map<string, string>} */
  const groupOf = new Map(groups.flatMap(group => [...group].map(member => [member, group])))
  const placed = new Set()
  /** @type {(P & { section: number })[]} */
  const arranged = []
  for (const part of parts) {
    if (placed.has(part.part)) continue
    const group = groupOf.get(part.part)
    const members = group ? parts.filter(other => groupOf.get(other.part) === group) : [part]
    for (const member of members) {
      placed.add(member.part)
      arranged.push({ ...member, section: part.strokes })
    }
  }
  return arranged
}

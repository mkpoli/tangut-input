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
 * @typedef {{ of: string[], partial: string[], forms: string[], partialForms: string[], reported: string[], possible: string[] }} Variants
 * @typedef {{ variants: string[][], partial: string[][], synonyms: string[][], components: string[][], reported: string[][] }} Stated
 * @typedef {{ one: string, other: string, reading: string, components?: string }} PossiblePair
 */

/**
 * Both directions of what is stated, and the reported pairs.
 * @param {Stated} stated
 * @returns {Map<string, Variants>}
 */
function statedIndex(stated) {
  /** @type {Map<string, Variants>} */
  const index = new Map()
  /** @param {string} char */
  const at = char => {
    let record = index.get(char)
    if (!record) index.set(char, record = { of: [], partial: [], forms: [], partialForms: [], reported: [], possible: [] })
    return record
  }
  for (const [form, base] of stated.variants) {
    at(form).of.push(base)
    at(base).forms.push(form)
  }
  for (const [form, base] of stated.partial) {
    at(form).partial.push(base)
    at(base).partialForms.push(form)
  }
  for (const [one, other] of stated.reported) {
    at(one).reported.push(other)
    at(other).reported.push(one)
  }
  return index
}

/**
 * The possible variants: characters with the same reading in Li Fanwen's system that also share a
 * sense in Wiktionary, or whose descriptions differ only by a pair of variant components. Characters
 * already linked, or that Wiktionary calls synonyms, are left out.
 * @param {VariantEntry[]} entries
 * @param {Stated} [stated]
 * @returns {PossiblePair[]}
 */
export function possiblePairs(entries, stated = VARIANTS) {
  const index = statedIndex(stated)
  const synonyms = new Set(stated.synonyms.flatMap(([one, other]) => [one + other, other + one]))
  /** @param {string} char */
  const family = char => {
    const record = index.get(char)
    const bases = [...(record?.of ?? []), ...(record?.partial ?? [])]
    return new Set([char, ...bases, ...(record?.forms ?? []), ...(record?.partialForms ?? []), ...(record?.reported ?? []), ...bases.flatMap(base => [...(index.get(base)?.forms ?? []), ...(index.get(base)?.partialForms ?? [])])])
  }
  /** @type {Map<string, PossiblePair>} */
  const pairs = new Map()
  /** @param {string} one @param {string} other @param {string} reading @param {string} [components] */
  const link = (one, other, reading, components) => {
    const key = [one, other].sort().join('')
    if (synonyms.has(one + other) || family(one).has(other) || pairs.has(key)) return
    const [first, second] = [...key]
    pairs.set(key, { one: first, other: second, reading, ...(components ? { components } : {}) })
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
    for (const peer of peers) if ([...named].some(sense => peer.senses.has(sense))) link(entry.char, peer.char, reading)
    byReading.set(reading, [...peers, { char: entry.char, senses: named }])
  }
  for (const [one, other] of stated.components) {
    for (const entry of entries) {
      if (!entry.composition?.includes(one)) continue
      const reading = entry.pronunciations?.li_fanwen?.trim()
      for (const match of byDescription.get(entry.composition.replaceAll(one, other)) ?? []) {
        if (reading && match.pronunciations?.li_fanwen?.trim() === reading) link(entry.char, match.char, reading, one + other)
      }
    }
  }
  return [...pairs.values()].sort((a, b) => (a.one < b.one ? -1 : 1))
}

/**
 * What the card shows for each character.
 * @param {PossiblePair[]} pairs
 * @param {Stated} [stated]
 */
export function variantIndex(pairs, stated = VARIANTS) {
  const index = statedIndex(stated)
  for (const { one, other } of pairs) {
    for (const [char, peer] of [[one, other], [other, one]]) {
      let record = index.get(char)
      if (!record) index.set(char, record = { of: [], partial: [], forms: [], partialForms: [], reported: [], possible: [] })
      record.possible.push(peer)
    }
  }
  return index
}

const ARITY = /** @type {Record<string, number>} */ ({ '⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2, '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2 })
const PLACES = /** @type {Record<string, string[]>} */ ({ '⿰': ['left', 'right'], '⿱': ['top', 'bottom'], '⿲': ['left', 'middle', 'right'], '⿳': ['top', 'middle', 'bottom'] })

/**
 * How often each variant component stands in each place in the characters' descriptions, most often
 * first. A place is its slot under the operator directly above it.
 * @param {VariantEntry[]} entries
 * @param {{ members: string }[]} [groups]
 * @returns {Map<string, Record<string, number>>}
 */
export function componentPositions(entries, groups = VARIANTS.groups) {
  const wanted = new Set(groups.flatMap(group => [...group.members]))
  /** @type {Map<string, Record<string, number>>} */
  const found = new Map()
  for (const entry of entries) {
    const units = [...(entry.composition ?? '')]
    let at = 0
    /** @param {string} place */
    const walk = place => {
      const unit = units[at++]
      if (unit === undefined) return
      const arity = ARITY[unit]
      if (arity) {
        for (let slot = 0; slot < arity; slot++) walk(PLACES[unit]?.[slot] ?? (slot === 0 ? 'outer' : 'inner'))
      } else if (wanted.has(unit)) {
        const counts = found.get(unit) ?? {}
        counts[place] = (counts[place] ?? 0) + 1
        found.set(unit, counts)
      }
    }
    walk('whole')
  }
  return new Map([...found].map(([unit, counts]) => [unit, Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))]))
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
export function keepVariantsTogether(parts, groups = VARIANTS.groups.map(group => group.members)) {
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

/**
 * Groups of characters joined by a variant relation, however long the chain: a form of a form stands
 * in the same group as the first. Each link keeps the ground it rests on, and a group its count.
 * @typedef {{ one: string, other: string, kind: 'stated' | 'partial' | 'reported' | 'possible', ground: 'stated' | 'reported' | 'possible' }} FamilyLink
 * @typedef {{ members: string[], links: FamilyLink[], grounds: { kind: 'stated' | 'reported' | 'possible', count: number }[] }} Family
 * @param {PossiblePair[]} pairs
 * @param {Stated} [stated]
 * @returns {Family[]}
 */
export function variantFamilies(pairs, stated = VARIANTS) {
  /** @type {FamilyLink[]} */
  const links = [
    ...stated.variants.map(([one, other]) => /** @type {FamilyLink} */ ({ one, other, kind: 'stated', ground: 'stated' })),
    ...stated.partial.map(([one, other]) => /** @type {FamilyLink} */ ({ one, other, kind: 'partial', ground: 'stated' })),
    ...stated.reported.map(([one, other]) => /** @type {FamilyLink} */ ({ one, other, kind: 'reported', ground: 'reported' })),
    ...pairs.map(({ one, other }) => /** @type {FamilyLink} */ ({ one, other, kind: 'possible', ground: 'possible' })),
  ]
  /** @type {Map<string, string>} */
  const parent = new Map()
  /** @param {string} char */
  const find = char => {
    let root = parent.get(char) ?? char
    while (root !== (parent.get(root) ?? root)) root = parent.get(root) ?? root
    parent.set(char, root)
    return root
  }
  for (const { one, other } of links) {
    const a = find(one)
    const b = find(other)
    if (a !== b) parent.set(a, b)
  }
  /** @type {Map<string, string[]>} */
  const members = new Map()
  for (const { one, other } of links) {
    for (const char of [one, other]) {
      const root = find(char)
      members.set(root, [...(members.get(root) ?? []), char])
    }
  }
  const byCodePoint = (/** @type {string} */ a, /** @type {string} */ b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)
  /** @type {Family[]} */
  const families = []
  for (const [root, list] of members) {
    const unique = [...new Set(list)].sort(byCodePoint)
    if (unique.length < 2) continue
    const own = links.filter(link => find(link.one) === root)
    /** @type {Record<string, number>} */
    const counts = {}
    for (const link of own) {
      const kind = link.kind === 'partial' ? 'stated' : link.kind
      counts[kind] = (counts[kind] ?? 0) + 1
    }
    const grounds = ['stated', 'reported', 'possible']
      .filter(kind => counts[kind])
      .map(kind => ({ kind: /** @type {'stated' | 'reported' | 'possible'} */ (kind), count: counts[kind] }))
    families.push({ members: unique, links: own, grounds })
  }
  // What a reader cannot see from the pair lists comes first: a report, then a chain, then a
  // Wiktionary pair, then a pair the site inferred.
  const rank = (/** @type {Family} */ family) =>
    family.grounds.some(ground => ground.kind === 'reported') ? 0
      : family.links.length > 1 ? 1
        : family.grounds.some(ground => ground.kind === 'stated') ? 2
          : 3
  return families.sort((a, b) => rank(a) - rank(b) || b.members.length - a.members.length || byCodePoint(a.members[0], b.members[0]))
}

/**
 * The group each character stands in, for the card.
 * @param {Family[]} families
 * @returns {Map<string, Family>}
 */
export function familyIndex(families) {
  /** @type {Map<string, Family>} */
  const index = new Map()
  for (const family of families) for (const member of family.members) index.set(member, family)
  return index
}

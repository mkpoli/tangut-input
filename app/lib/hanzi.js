// Literal correspondences keep the unit the source aligns: a character gloss or a whole name.

/** @typedef {{ author: string, title: string, where?: string, note?: string, url?: string, via?: string }} HanziSource */
/** @typedef {{ source: string, role: string, place?: string, count?: number, quote?: string, kind?: string }} HanziEvidence */
/** @typedef {{ tangut: string, hanzi: string, kind: 'gloss' | 'era' | 'title' | 'state' | 'posthumous', basis: string,
 * identified?: string, holder?: string, evidence: HanziEvidence[] }} HanziRecord */
/** @typedef {{ format: string, sources: Record<string, HanziSource>, records: HanziRecord[] }} HanziLibrary */
/** @typedef {{ glosses: Map<string, HanziRecord[]>, phrases: HanziRecord[] }} HanziIndex */

/** @param {HanziLibrary} library @returns {HanziIndex} */
export function indexHanzi(library) {
  /** @type {Map<string, HanziRecord[]>} */
  const glosses = new Map()
  /** @type {HanziRecord[]} */
  const phrases = []
  for (const record of library.records) {
    if (record.kind !== 'gloss') { phrases.push(record); continue }
    if ([...record.tangut].length !== 1) continue
    const known = glosses.get(record.tangut)
    if (known) known.push(record)
    else glosses.set(record.tangut, [record])
  }
  return { glosses, phrases }
}

/** Literal Han-script queries, without changing the source's spelling. @param {string} query */
export const hanziQuery = query => /\p{Script=Han}/u.test(query) ? query.trim() : ''

/** @param {string} text @param {string} query */
export const hanziRank = (text, query) => text === query ? 0 : text.startsWith(query) ? 1 : text.includes(query) ? 2 : 9

/**
 * Whole names matching a Hanzi query. A substring returns the complete attested pair; it does not
 * align any of its characters. Evidence stays attached even when two records share the same form.
 * @param {HanziIndex} index
 * @param {string} query
 */
export function searchHanziNames(index, query) {
  const needle = hanziQuery(query)
  if (!needle) return []
  /** @type {Map<string, { record: HanziRecord, records: HanziRecord[], tier: number }>} */
  const hits = new Map()
  for (const record of index.phrases) {
    const tier = hanziRank(record.hanzi, needle)
    if (tier === 9) continue
    const key = JSON.stringify([record.kind, record.hanzi, record.tangut, record.holder])
    const known = hits.get(key)
    if (known) known.records.push(record)
    else hits.set(key, { record, records: [record], tier })
  }
  return [...hits.values()].sort((a, b) => a.tier - b.tier
    || [...a.record.hanzi].length - [...b.record.hanzi].length
    || a.record.hanzi.localeCompare(b.record.hanzi) || a.record.tangut.localeCompare(b.record.tangut))
}

/** The best source-labelled character gloss for each matching character. @param {HanziIndex} index @param {string} query */
export function searchHanziGlosses(index, query) {
  const needle = hanziQuery(query)
  if (!needle) return []
  const hits = []
  for (const [char, records] of index.glosses) {
    let tier = 9
    /** @type {HanziRecord | undefined} */
    let record
    for (const candidate of records) {
      const rank = hanziRank(candidate.hanzi, needle)
      if (rank < tier) { tier = rank; record = candidate }
    }
    if (record) hits.push({ char, tier, record })
  }
  return hits
}

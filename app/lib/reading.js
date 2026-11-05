// Reconstructions. Seven systems spell the same syllables differently, so every reading is folded to
// plain letters before comparison: diacritics and IPA letters become their nearest ASCII letter,
// separators drop out, and a final digit is kept apart as the tone.

/** The systems a reader can type in, in the order the card lists them. */
// Each system is named after the scholar who proposes it: in Latin letters for a reader working in
// English, in the characters their name is written with in Chinese, Japanese and Korean. The other
// spelling is the name's own title, so both are a hover away.
export const SYSTEMS = /** @type {const} */ ([
  { key: 'li_fanwen', abbr: 'LFW2008', tag: 'LFW2008', name: 'Li Fanwen', zh: '李範文', year: '2008', tones: true },
  { key: 'gong_huangcheng', abbr: 'GHC', tag: 'GHC', name: 'Gong Hwang-cherng', zh: '龔煌城', year: '2005', tones: true },
  { key: 'gong_xun_202411', abbr: 'GX202411', tag: 'GX202411', name: 'Gong Xun', zh: '龔勛', year: '2024-11', tones: true },
  { key: 'miyake', abbr: 'Miyake', tag: 'Miyake 2019', name: 'Marc Miyake', zh: '三宅', year: '2019', tones: true },
  { key: 'nishida', abbr: 'Nishida', tag: 'Nishida 1966', name: 'Tatsuo Nishida', zh: '西田龍雄', year: '1966', tones: true },
  { key: 'kychanov', abbr: 'Kychanov', tag: 'Kychanov 2006', name: 'Yevgeny Kychanov', zh: '克恰諾夫', year: '2006', tones: true },
  { key: 'sofronov', abbr: 'Sofronov', tag: 'Sofronov 1968', name: 'Mikhail Sofronov', zh: '索弗羅諾夫', year: '1968', tones: true },
])

/** The system readings are shown in until a reader picks another. */
export const DEFAULT_READING = 'gong_xun_202411'

/** The system to show for a stored choice; a value left by an older version falls back to the default.
 * @param {string | null} stored */
export const readingFromStore = stored => (SYSTEMS.some(system => system.key === stored) ? /** @type {string} */ (stored) : DEFAULT_READING)

/**
 * A system's name for a reader of a language: the characters a Chinese, Japanese or Korean reader
 * knows it by, the Latin spelling otherwise.
 * @param {{ name: string, zh: string }} system
 * @param {string} locale
 */
export const systemBaseName = (system, locale) => /^(ja|zh|ko)/.test(locale) ? system.zh : system.name

/** The name and year, for a list or a table. @param {{ name: string, zh: string, year: string }} system @param {string} locale */
export const systemName = (system, locale) => `${systemBaseName(system, locale)} ${system.year}`

/** Both spellings of a system's name and its abbreviation, for a title. @param {{ name: string, zh: string, year: string, abbr: string }} system */
export const systemTitle = system => `${system.name} ${system.year} · ${system.zh} · ${system.abbr}`

/** @typedef {typeof SYSTEMS[number]['key']} SystemKey */
/** A reading from the records, or CCAMC's extra system, which is searchable but not shown.
 * @typedef {{ char: string, system: SystemKey | 'ccamc', raw: string, folded: string, loose: string, tone: string }} Reading */
/** @typedef {{ char: string, system: string, token: string }} HiddenReading */

const LETTERS = /** @type {Record<string, string>} */ ({
  ɨ: 'i', ɪ: 'i', ʉ: 'u', ɯ: 'u', ə: 'e', ɛ: 'e', ɔ: 'o', ɑ: 'a', æ: 'ae',
  ŋ: 'ng', ɣ: 'gh', ʁ: 'r', ɲ: 'ny', ȵ: 'ny', ɱ: 'm', ʷ: 'w', ⁿ: 'n', ł: 'l', ɡ: 'g',
  ʟ: 'l', ᴛ: 't', ɢ: 'g', ʙ: 'b', ᴄ: 'c', ʜ: 'h', ꜰ: 'f', ᴜ: 'u',
  ʔ: '', ɦ: '',
})

/**
 * Plain letters and the tone, if the reading ends in a digit.
 * @param {string} value
 * @returns {{ folded: string, tone: string }}
 */
export function fold(value) {
  const text = value.trim().toLowerCase()
  const tone = /([0-9])\s*$/.exec(text)?.[1] ?? ''
  const letters = [...text.normalize('NFD').replace(/[̀-ͯ]/g, '')]
    .map(char => LETTERS[char] ?? char)
    .join('')
    .replace(/[^a-z]/g, '')
  return { folded: letters, tone }
}

/**
 * A looser spelling for near matches: medial j and y are dropped, and a prenasal before a stop
 * (Kychanov's nd-, mb- against Li's d-, b-) goes too.
 * @param {string} folded
 */
export function loosen(folded) {
  return folded.replace(/^n(?=d|t|g|k|dz|ts)/, '').replace(/^m(?=b|p)/, '').replace(/[jy]/g, '')
}

/** The CCAMC readings Wiktionary does not carry, one folded token each. @param {import('./data.js').CcamcIndex | null} index @returns {HiddenReading[]} */
export function indexHiddenReadings(index) {
  /** @type {HiddenReading[]} */
  const readings = []
  for (const [system, byChar] of Object.entries(index?.readings ?? {})) {
    for (const [char, token] of Object.entries(byChar)) {
      const folded = token.replace(/[^a-z]/g, '')
      if (!folded) continue
      readings.push({ char, system, token })
    }
  }
  return readings
}

/** Every reading of every entry, folded once. @param {import('./data.js').Entry[]} entries @returns {Reading[]} */
export function indexReadings(entries) {
  /** @type {Reading[]} */
  const readings = []
  for (const entry of entries) {
    for (const { key } of SYSTEMS) {
      const raw = entry.pronunciations?.[key]?.trim()
      if (!raw) continue
      const { folded, tone } = fold(raw)
      if (!folded) continue
      readings.push({ char: entry.char, system: key, raw, folded, loose: loosen(folded), tone })
    }
  }
  return readings
}

/** How close a reading came: exact, a beginning, near (loose) exact, near beginning. */
export const TIERS = ['Exact', 'Begins with', 'Near', 'Near, begins with']

/** @typedef {{ char: string, tier: number, readings: Reading[], via?: 'ccamc' }} ReadingHit */

/**
 * The characters with a reading like the query, best first: by tier, then by how many systems
 * agree, then by corpus frequency, then by code point.
 * @param {Reading[]} readings
 * @param {string} query
 * @param {{ systems?: Set<string>, tone?: string, frequency?: Map<string, number>, hidden?: HiddenReading[] }} [options]
 * @returns {ReadingHit[]}
 */
export function searchReadings(readings, query, options = {}) {
  const { folded, tone: typedTone } = fold(query)
  if (!folded) return []
  const tone = typedTone || options.tone || ''
  const loose = loosen(folded)
  /** @type {Map<string, ReadingHit>} */
  const hits = new Map()
  for (const reading of readings) {
    if (options.systems?.size && !options.systems.has(reading.system)) continue
    if (tone && reading.tone && reading.tone !== tone) continue
    let tier = -1
    if (reading.folded === folded) tier = 0
    else if (reading.folded.startsWith(folded)) tier = 1
    else if (loose && reading.loose === loose) tier = 2
    else if (loose.length > 1 && reading.loose.startsWith(loose)) tier = 3
    if (tier < 0) continue
    const hit = hits.get(reading.char)
    if (!hit || tier < hit.tier) hits.set(reading.char, { char: reading.char, tier, readings: [reading] })
    else if (tier === hit.tier) hit.readings.push(reading)
  }
  // CCAMC's extra system answers the search, but the result says only that CCAMC records the
  // character and links there; the matched reading itself stays out of the page.
  const hidden = options.hidden ?? []
  if (hidden.length && (!options.systems?.size || options.systems.has('ccamc'))) {
    for (const reading of hidden) {
      if (hits.has(reading.char)) continue
      if (tone && reading.token.at(-1) !== tone) continue
      const value = fold(reading.token)
      let tier = -1
      if (value.folded === folded) tier = 0
      else if (value.folded.startsWith(folded)) tier = 1
      else if (loose && loosen(value.folded) === loose) tier = 2
      else if (loose.length > 1 && loosen(value.folded).startsWith(loose)) tier = 3
      if (tier < 0) continue
      hits.set(reading.char, {
        char: reading.char, tier, via: 'ccamc',
        readings: [{ char: reading.char, system: 'ccamc', raw: '', folded: value.folded, loose: loosen(value.folded), tone: value.tone }],
      })
    }
  }
  const frequency = options.frequency
  /** @param {string} char */
  const count = char => frequency?.get(char) ?? 0
  return [...hits.values()].sort((a, b) => a.tier - b.tier || Number(a.via === 'ccamc') - Number(b.via === 'ccamc') || b.readings.length - a.readings.length
    || count(b.char) - count(a.char) || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}

// The static files the site reads. Each is fetched once, when a page first needs it; nothing is
// bundled into the script.

/** @typedef {{ en?: string[], ja?: string[], zh?: string[], synonym?: string[] }} Definitions */
/** A character's place in the rhyme books: `[rhyme, tone, group, upper, lower, upperB, lowerB]`.
 * @typedef {{ [char: string]: [number | null, number | null, string | null, string | null, string | null, string | null, string | null] }} RhymeChars */
/** @typedef {{ built: string, source: { name: string, author: string, url: string, commit: string, file: string, sha256: string }, columns: string[], chars: RhymeChars }} Rhymes */
/** @typedef {{ char: string, codepoint?: string, composition?: string, total_strokes?: number, radical?: string, radical_extra_strokes?: number,
 *   definitions?: Definitions, pronunciations?: Record<string, string>, wenhai_text_en?: string, wenhai_text_zh?: string }} Entry */
/** @typedef {{ id: string, kind: 'facsimile' | 'transcription', title: string, shortTitle?: string, titleTangut?: string, author: string, year?: number,
 *   publisher: string, url: string, licence: string, licenceUrl?: string, manuscript?: string, facsimile?: string,
 *   facsimileCredit?: string, reading?: string, readingUrl?: string, retrieved?: string, revision?: number, note?: string,
 *   pages?: { title: string, url: string, revision: number }[] }} AttestationSource */
/** @typedef {{ text: string, label: string, english?: string, page?: number, read?: boolean, url?: string, section?: string,
 *   chapter?: number, revision?: number }} AttestedLine */
/** @typedef {[line: string, position: number]} Place */
/** @typedef {{ built: string, corpus: { lines: number, characters: number, distinct: number, sources: number, sha256: string },
 *   sources: AttestationSource[], lines: Record<string, AttestedLine>, rows: Record<string, Record<string, Place[]>> }} Attestation */

/**
 * Fetch a gzipped file. The dev server may hand it over already decoded, so the magic bytes decide
 * whether anything is left to decompress.
 * @param {URL} url
 * @returns {Promise<Uint8Array>}
 */
async function readGz(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url.pathname}: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** @param {URL} url @returns {Promise<any>} */
const readJson = async url => JSON.parse(new TextDecoder().decode(await readGz(url)))

/** @type {Map<string, Promise<any>>} */
const pending = new Map()
/** @template T @param {string} key @param {() => Promise<T>} load @returns {Promise<T>} */
const once = (key, load) => {
  if (!pending.has(key)) pending.set(key, load())
  return /** @type {Promise<T>} */ (pending.get(key))
}

/** Meanings, readings and descriptions, from Open Tangut. @returns {Promise<Entry[]>} */
export const loadEntries = () => once('entries', async () => {
  const data = await readJson(new URL('../data/tangut-entries.json.gz', import.meta.url))
  return Array.isArray(data) ? data : expandEntries(data)
})

/**
 * A packed record, one row of values per character, as `compact_tangut_entries.py` writes it. The
 * names of the readings are in the header once instead of in every row.
 * @param {{ systems: string[], rows: any[][] }} packed
 * @returns {Entry[]}
 */
function expandEntries(packed) {
  return packed.rows.map(([char, composition, strokes, radical, en, ja, zh, readings, wenhaiEn, wenhaiZh]) => {
    /** @type {Record<string, string>} */
    const pronunciations = {}
    packed.systems.forEach((key, i) => {
      const value = readings?.[i]
      if (value) pronunciations[key] = value
    })
    const definitions = {}
    if (en?.length) definitions.en = en
    if (ja?.length) definitions.ja = ja
    if (zh?.length) definitions.zh = zh
    return {
      char,
      composition: composition ?? undefined,
      total_strokes: strokes ?? undefined,
      radical: radical ?? undefined,
      definitions,
      pronunciations,
      wenhai_text_en: wenhaiEn ?? undefined,
      wenhai_text_zh: wenhaiZh ?? undefined,
    }
  })
}

/** Cangjie codes as [character, code] pairs, from the RIME Tangut Cangjie table. @returns {Promise<[string, string][]>} */
export const loadCodes = () => once('codes', () => readJson(new URL('../data/tangut-cangjie.json.gz', import.meta.url)))

/** Japanese shape names for Tangut components. @returns {Promise<{ name: string, char: string, source: string, detail: string, strokes: number, credit: string }[]>} */
export const loadTangutNames = () => once('tangut-names', async () => (await readJson(new URL('../data/tangut-component-names.json', import.meta.url))).names)

/** Other descriptions of a character, each with the source that gives it. @returns {Promise<{ char: string, ids: string, source: string, detail?: string }[]>} */
export const loadIdsAliases = () => once('ids-aliases', async () => (await readJson(new URL('../data/tangut-ids-aliases.json', import.meta.url))).rows)

/** The forms one component is written in, each with the plain form it stands for. @returns {Promise<{ form: string, base: string, kind: 'surround' | 'hook', source: string, detail?: string }[]>} */
export const loadComponentVariants = () => once('component-variants', async () => (await readJson(new URL('../data/tangut-component-variants.json', import.meta.url))).rows)

/** Four-corner codes as [character, six digits] pairs, from the rhyme-dictionary table. @returns {Promise<[string, string][]>} */
export const loadSijiao = () => once('sijiao', () => readJson(new URL('../data/tangut-sijiao.json.gz', import.meta.url)))

/** The rhyme books' class for each character, with its fanqie. @returns {Promise<Rhymes>} */
export const loadRhymes = () => once('rhymes', () => readJson(new URL('../data/tangut-rhymes.json.gz', import.meta.url)))

/** Groups of Chinese fanqie characters that stand for one initial. @returns {Promise<{ note: string, groups: string[][] }>} */
export const loadFanqieAliases = () => once('fanqie-aliases', () => readJson(new URL('../data/tangut-fanqie-aliases.json', import.meta.url)))

/** Stroke counts of ideographs and components. @returns {Promise<Record<string, number>>} */
export const loadStrokes = () => once('strokes', async () => (await readJson(new URL('../data/tangut-strokes.json.gz', import.meta.url))).values)

/** The lines of the recorded corpus and where each character stands in them. @returns {Promise<Attestation>} */
export const loadAttestation = () => once('attestation', () => readJson(new URL('../data/tangut-attestation.json.gz', import.meta.url)))

/** The faces a drawing is compared with, best first: the shapes tabulated for each face. */
export const SHAPE_FACES = /** @type {const} */ ([
  { key: 'noto', file: 'tangut-shapes.bin.gz' },
  { key: 'yinchuan', file: 'tangut-shapes-yinchuan.bin.gz' },
  { key: 'genzui', file: 'tangut-shapes-genzui.bin.gz' },
  { key: 'mojikyo', file: 'tangut-shapes-mojikyo.bin.gz' },
  { key: 'std', file: 'tangut-shapes-std.bin.gz' },
])

/** Glyph masks for the drawing pad, one file per face. @param {string} [file] @returns {Promise<Uint8Array>} */
export const loadShapes = (file = 'tangut-shapes.bin.gz') => once(`shapes:${file}`, () => readGz(new URL(`../data/${file}`, import.meta.url)))

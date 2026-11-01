// The static files the site reads. Each is fetched once, when a page first needs it; nothing is
// bundled into the script.

/** @typedef {{ en?: string[], ja?: string[], zh?: string[], synonym?: string[] }} Definitions */
/** @typedef {{ char: string, codepoint: string, composition?: string, total_strokes?: number, radical?: string, radical_extra_strokes?: number,
 *   definitions?: Definitions, pronunciations?: Record<string, string>, wenhai_text_en?: string, wenhai_text_zh?: string }} Entry */
/** @typedef {{ id: string, title: string, author: string, year: number, publisher: string, url: string, licence: string, manuscript: string,
 *   facsimile: string, facsimileCredit: string, reading: string, readingUrl: string }} AttestationSource */
/** @typedef {{ text: string, english: string, page: number, read: boolean, url: string }} AttestedLine */
/** @typedef {[line: string, position: number]} Place */
/** @typedef {{ built: string, corpus: { lines: number, characters: number, distinct: number, sha256: string }, sources: AttestationSource[],
 *   lines: Record<string, AttestedLine>, rows: Record<string, Record<string, Place[]>> }} Attestation */

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
export const loadEntries = () => once('entries', () => readJson(new URL('../data/tangut-entries.json.gz', import.meta.url)))

/** Cangjie codes as [character, code] pairs, from the RIME Tangut Cangjie table. @returns {Promise<[string, string][]>} */
export const loadCodes = () => once('codes', () => readJson(new URL('../data/tangut-cangjie.json.gz', import.meta.url)))

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

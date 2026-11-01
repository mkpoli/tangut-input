// The Tangut records and Cangjie codes, read once from the gzipped files and indexed for the
// search modes. Nothing is bundled twice: each file is fetched when the page first needs it.

/** @typedef {{ char: string, codepoint: string, composition?: string, total_strokes?: number, radical?: string, radical_extra_strokes?: number,
 *   definitions?: { en?: string[], ja?: string[], zh?: string[] }, pronunciations?: Record<string, string>, wenhai_text_en?: string, wenhai_text_zh?: string }} Entry */
/** @typedef {{ id: string, title: string, url?: string, author?: string, licence?: string, note?: string }} AttestationSource */
/** @typedef {[line: string, position: number]} AttestedLine */
/** @typedef {{ built: string, corpus: { lines: number, characters: number, sha256: string }, sources: AttestationSource[], rows: Record<string, Record<string, AttestedLine[]>> }} Attestation */

/** @param {string | URL} url @returns {Promise<unknown>} */
async function readJsonGz(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const stream = response.body?.pipeThrough(new DecompressionStream('gzip'))
  if (!stream) throw new Error('This browser cannot decompress the data.')
  return new Response(stream).json()
}

/** @type {Promise<Entry[]> | null} */
let entries = null
/** @type {Promise<[string, string][]> | null} */
let codes = null
/** @type {Promise<Attestation> | null} */
let attestation = null
/** @type {Promise<[string, number][]> | null} */
let parts = null

/** @returns {Promise<Entry[]>} */
export async function loadEntries() {
  return entries ??= readJsonGz(new URL('./data/tangut-entries.json.gz', import.meta.url)).then(data => /** @type {Entry[]} */ (data))
}

/** @returns {Promise<[string, string][]>} */
export async function loadCodes() {
  return codes ??= readJsonGz(new URL('./data/tangut-cangjie.json.gz', import.meta.url)).then(data => /** @type {[string, string][]} */ (data))
}

/** Attestation of every character in the recorded corpus, built from the Glyph Atlas records. @returns {Promise<Attestation>} */
export async function loadAttestation() {
  return attestation ??= readJsonGz(new URL('./data/tangut-attestation.json.gz', import.meta.url)).then(data => /** @type {Attestation} */ (data))
}

/** Every Tangut character and component the records or the font define, with how many descriptions use it. @returns {Promise<[string, number][]>} */
export async function loadParts() {
  return parts ??= readJsonGz(new URL('./data/tangut-parts.json.gz', import.meta.url)).then(data => /** @type {{ parts: [string, number][] }} */ (data).parts)
}

/** @param {string} char */
export const isTangut = char => /^[\u{17000}-\u{187FF}\u{18D00}-\u{18DFF}]$/u.test(char)

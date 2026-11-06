// The static files the site reads. Each is fetched once, when a page first needs it; nothing is
// bundled into the script.

/** @typedef {{ en?: string[], ja?: string[], zh?: string[], synonym?: string[] }} Definitions */
/** A character's place in the rhyme books: `[rhyme, tone, group, upper, lower, upperB, lowerB]`.
 * @typedef {{ [char: string]: [number | null, number | null, string | null, string | null, string | null, string | null, string | null] }} RhymeChars */
/** @typedef {{ built: string, source: { name: string, author: string, url: string, commit: string, file: string, sha256: string }, columns: string[], chars: RhymeChars }} Rhymes */
/** @typedef {{ char: string, codepoint?: string, composition?: string, total_strokes?: number, radical?: string, radical_extra_strokes?: number,
 *   definitions?: Definitions, pronunciations?: Record<string, string>, wenhai_text_en?: string, wenhai_text_zh?: string }} Entry */
/** Normalized terms derived from CCAMC records, used only to answer a search: the readings of three
 * systems Wiktionary does not carry, and the English and Chinese glosses. Never rendered.
 * @typedef {{ format: string, note: string, readings: Record<string, Record<string, string>>,
 *   meanings: Record<string, Record<string, string[]>> }} CcamcIndex */
/** @typedef {{ id: string, kind: 'facsimile' | 'transcription', title: string, shortTitle?: string, titleTangut?: string, author: string, year?: number,
 *   publisher: string, url: string, licence: string, licenceUrl?: string, manuscript?: string, facsimile?: string,
 *   facsimileCredit?: string, reading?: string, readingUrl?: string, retrieved?: string, revision?: number, note?: string,
 *   study?: string, studyUrl?: string, pages?: { title: string, url: string, revision: number }[], commit?: string }} AttestationSource */
/** @typedef {{ text: string, label: string, english?: string, page?: number, read?: boolean, url?: string, section?: string,
 *   chapter?: number, revision?: number }} AttestedLine */
/** @typedef {[line: string, position: number]} Place */
/** @typedef {{ built: string, corpus: { lines: number, characters: number, distinct: number, sources: number, sha256: string },
 *   sources: AttestationSource[], lines: Record<string, AttestedLine>, rows: Record<string, Record<string, Place[]>> }} Attestation */
/** @typedef {{ id: string, sourceId: string, sourceTitle: string, sourceUrl: string, licence: string, label: string,
 *   famous: boolean, lineIds: string[], text: string }} Sample */
/** @typedef {{ built: string, samples: Sample[] }} Samples */
/** @typedef {{ built: string, corpus: { lines: number, characters: number, distinct: number, sha256: string },
 *   counts: Record<string, number> }} Frequency */
/** @typedef {{ source: string, entries: Record<string, { position: string, parts: [string, string | null][] }> }} WenhaiComposition */
/** @typedef {{ char: string, block: 'supplement' | 'components', name: string, strokes?: number, radical?: string,
 *   radicalStrokes?: string, source?: string, ids?: string, idsSource?: string, component?: number,
 *   cangjie: string[], glyph: string }} SupplementCharacter */
/** @typedef {{ format: string, unicode: string, built: string, sources: { id: string, name: string, url: string, sha256?: string, commit?: string }[],
 *   counts: Record<string, number>, characters: SupplementCharacter[] }} Supplement */

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

/** Meanings and readings from Wiktionary, with the descriptions from BabelStone. @returns {Promise<Entry[]>} */
export const loadEntries = () => once('entries', async () => {
  const data = await readJson(new URL('../data/tangut-entries.json.gz', import.meta.url))
  return expandEntries(data)
})

/**
 * A packed record, one row of values per character, as `build_tangut_entries.py` writes it. The
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
      wenhai_text_en: wenhaiEn || undefined,
      wenhai_text_zh: wenhaiZh || undefined,
    }
  })
}

/** The derived CCAMC search terms. @returns {Promise<CcamcIndex>} */
export const loadCcamcIndex = () => once('ccamc', () => readJson(new URL('../data/tangut-ccamc-index.json.gz', import.meta.url)))

/** Cangjie codes as [character, code] pairs, from the RIME Tangut Cangjie table. @returns {Promise<[string, string][]>} */
export const loadCodes = () => once('codes', () => readJson(new URL('../data/tangut-cangjie.json.gz', import.meta.url)))

/** Japanese shape names for Tangut components. @returns {Promise<{ name: string, char: string, source: string, detail: string, credit: string }[]>} */
export const loadTangutNames = () => once('tangut-names', async () => (await readJson(new URL('../data/tangut-component-names.json', import.meta.url))).names)

/** The same names compared across the languages that record one. @returns {Promise<{ languages: string[], rows: { char: string, names: Record<string, string[]>, source: string }[] }>} */
export const loadPartNames = () => once('part-names', () => readJson(new URL('../data/tangut-part-names.json', import.meta.url)))

/** Editorial shape hints, not attested names. @returns {Promise<{ components: { char: string, named: boolean, candidates: { name: string, char: string, score: number, strokes: number | null, sameStrokes: boolean }[] }[] }>} */
export const loadShapeHints = () => once('shape-hints', () => readJson(new URL('../data/tangut-component-shape-hints.json.gz', import.meta.url)))

/** Four-corner codes as [character, six digits] pairs, from the rhyme-dictionary table. @returns {Promise<[string, string][]>} */
export const loadSijiao = () => once('sijiao', () => readJson(new URL('../data/tangut-sijiao.json.gz', import.meta.url)))

/** The rhyme books' class for each character, with its fanqie. @returns {Promise<Rhymes>} */
export const loadRhymes = () => once('rhymes', () => readJson(new URL('../data/tangut-rhymes.json.gz', import.meta.url)))

/** Tibetan phonetic glosses by character, from BabelStone's index of five British Library manuscripts:
 * each gloss is [Wylie, Tibetan script, [[shelfmark, count]…]].
 * @returns {Promise<{ format: string, source: string, author: string, modified: string | null, retrieved: string, note: string, glosses: Record<string, [string, string, [string, number][]][]> }>} */
/** The Tibetan spellings 李範文 lists at each crossing of rhyme and initial class. @returns {Promise<{ cells: Record<string, Record<string, [string, string][]>> } | null>} */
export const loadTibetanRhymes = () => once('tibetanRhymes', () => readJson(new URL('../data/tangut-tibetan-rhymes.json', import.meta.url)))
/** 龔煌城's value for each of the 105 rhymes. @returns {Promise<{ values: Record<string, string> } | null>} */
export const loadGongRhymes = () => once('gongRhymes', () => readJson(new URL('../data/tangut-gong-rhymes.json', import.meta.url)))
/** The Chinese characters transcribing Tangut, by rhyme: each is [character, final?]. @returns {Promise<{ rhymes: Record<string, [string, string?][]> } | null>} */
export const loadChineseRhymes = () => once('chineseRhymes', () => readJson(new URL('../data/tangut-chinese-rhymes.json', import.meta.url)))
/** Tibetan spellings by hand class, with counts, and Sanskrit, by character. A Tibetan row is
 * [hand, printed, count, script, Wylie, IPA]; a Sanskrit row is [printed IAST, Devanagari, IPA].
 * @returns {Promise<{ chars: Record<string, { tibetan?: [string, string, number, string, string, string][], sanskrit?: [string, string, string][] }> } | null>} */
export const loadTibetanHands = () => once('tibetanHands', () => readJson(new URL('../data/tangut-tibetan-hands.json', import.meta.url)))
/** Alan Downes's English gloss for each character he records. @returns {Promise<{ glosses: Record<string, string> } | null>} */
export const loadDownes = () => once('downes', () => readJson(new URL('../data/tangut-downes.json', import.meta.url)))
/** The Chinese words the Tangut 類林 uses for a character, the commonest first. @returns {Promise<{ glosses: Record<string, [string, number][]> } | null>} */
export const loadLeilin = () => once('leilin', () => readJson(new URL('../data/tangut-leilin.json', import.meta.url)))
export const loadTibetan = () => once('tibetan', () => readJson(new URL('../data/tangut-tibetan.json', import.meta.url)))

/** Stroke counts of ideographs and components. @returns {Promise<Record<string, number>>} */
export const loadStrokes = () => once('strokes', async () => (await readJson(new URL('../data/tangut-strokes.json.gz', import.meta.url))).values)

/** The lines of the recorded corpus and where each character stands in them. @returns {Promise<Attestation>} */
export const loadAttestation = () => once('attestation', () => readJson(new URL('../data/tangut-attestation.json.gz', import.meta.url)))

/** Sample passages copied from the corpus. @returns {Promise<Samples>} */
export const loadSamples = () => once('samples', () => readJson(new URL('../data/tangut-samples.json', import.meta.url)))

/** How often each character occurs in the corpus. @returns {Promise<Frequency>} */
export const loadFrequency = () => once('frequency', () => readJson(new URL('../data/tangut-frequency.json.gz', import.meta.url)))

/** The 60 文海 constructions: each head character's page and its source/part pairs. @returns {Promise<WenhaiComposition>} */
export const loadWenhaiComposition = () => once('wenhai-composition', () => readJson(new URL('../data/wenhai-composition.json', import.meta.url)))

/** The characters in the two Tangut supplement blocks, with the fields each one has.
 * @returns {Promise<Supplement>} */
export const loadSupplement = () => once('supplement', () => readJson(new URL('../data/tangut-supplement.json.gz', import.meta.url)))

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

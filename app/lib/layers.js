// The reading tool's layers: what stands in each row under a line of Tangut, top to bottom. A layer
// is plain data so a reader's arrangement can be stored, and any kind can appear more than once.
import { SYSTEMS } from './reading.js'

/** The reconstruction a layer follows when it keeps to the reader's chosen system. */
export const CURRENT = 'current'
export const MIN_SIZE = 10
export const MAX_SIZE = 64

/** Every kind of layer, in the order the add menu lists them. */
export const KINDS = /** @type {const} */ (['reading', 'tangut', 'sinograph', 'english', 'wiktionary', 'downes', 'japanese', 'tibetan', 'rhyme'])

/** @typedef {typeof KINDS[number]} LayerKind */
/** @typedef {{ kind: LayerKind, system?: string, size: number }} Layer */

/** The arrangement a reader starts with: the chosen reconstruction, 西夏文, 漢字 and English. @returns {Layer[]} */
export const defaultLayers = () => [
  { kind: 'reading', system: CURRENT, size: 14 },
  { kind: 'tangut', size: 30 },
  { kind: 'sinograph', size: 17 },
  { kind: 'english', size: 12 },
]

/** The size a new layer of a kind starts at. @param {LayerKind} kind */
export const startSize = kind => (kind === 'tangut' ? 30 : kind === 'sinograph' ? 17 : kind === 'reading' ? 14 : 12)

/**
 * A stored arrangement, kept only as far as it still makes sense: an unknown kind or system drops out
 * and a size comes back in range. Nothing usable gives the default.
 * @param {unknown} stored
 * @returns {Layer[]}
 */
export function readLayers(stored) {
  if (!Array.isArray(stored)) return defaultLayers()
  /** @type {Layer[]} */
  const layers = []
  for (const item of stored) {
    if (!item || typeof item !== 'object' || !KINDS.includes(item.kind)) continue
    const size = Math.round(Number(item.size))
    /** @type {Layer} */
    const layer = { kind: item.kind, size: Number.isFinite(size) ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) : startSize(item.kind) }
    if (item.kind === 'reading') {
      if (item.system !== CURRENT && !SYSTEMS.some(system => system.key === item.system)) continue
      layer.system = item.system
    }
    layers.push(layer)
  }
  return layers.length ? layers : defaultLayers()
}

/** The first sense of a gloss, short enough for a cell. @param {string | undefined} text */
export const firstSense = text => (text ?? '').split(/[;,；，、。]/)[0].trim()

/**
 * What a layer says about a character, and the fuller text for its hover.
 * @param {Layer} layer
 * @param {string} char
 * @param {{ entry?: { definitions?: { en?: string[], ja?: string[], zh?: string[] }, pronunciations?: Record<string, string> },
 *   reading: string, downes?: string, rhyme?: [number | null, number | null, ...unknown[]],
 *   hands?: { tibetan?: [string, string, number, string, ...string[]][] }, glosses?: [string, string, unknown][] }} data
 * @returns {{ text: string, title: string }}
 */
export function layerValue(layer, char, data) {
  const definitions = data.entry?.definitions ?? {}
  /** @param {string[] | undefined} senses */
  const sense = senses => ({ text: firstSense(senses?.[0]), title: (senses ?? []).join('; ') })
  switch (layer.kind) {
    case 'tangut': return { text: char, title: char }
    case 'reading': {
      const value = data.entry?.pronunciations?.[layer.system === CURRENT || !layer.system ? data.reading : layer.system]?.trim() ?? ''
      return { text: value, title: value }
    }
    case 'sinograph': return sense(definitions.zh)
    case 'japanese': return sense(definitions.ja)
    case 'wiktionary': return sense(definitions.en)
    case 'downes': return { text: firstSense(data.downes), title: data.downes ?? '' }
    case 'english': return definitions.en?.length ? sense(definitions.en) : { text: firstSense(data.downes), title: data.downes ?? '' }
    case 'tibetan': {
      const spelled = [...(data.hands?.tibetan ?? [])].sort((a, b) => b[2] - a[2])[0]
      if (spelled) return { text: spelled[3], title: spelled[4] ?? spelled[1] }
      const gloss = data.glosses?.[0]
      return gloss ? { text: gloss[1], title: gloss[0] } : { text: '', title: '' }
    }
    case 'rhyme': {
      const [rhyme, tone] = data.rhyme ?? []
      return typeof rhyme === 'number' ? { text: `${rhyme}${tone ? `·${tone}` : ''}`, title: '' } : { text: '', title: '' }
    }
  }
}

/**
 * A line of text cut into what the rows stand on: a Tangut character gets a column, any other mark
 * stands in the Tangut row alone, and white space becomes a gap.
 * @param {string} line
 * @param {(char: string) => boolean} isTangut
 * @returns {{ char: string, kind: 'tangut' | 'mark' | 'gap' }[]}
 */
export const cutLine = (line, isTangut) => [...line].map(char => ({
  char,
  kind: isTangut(char) ? 'tangut' : /\s/.test(char) ? 'gap' : 'mark',
}))

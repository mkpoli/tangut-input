// The records every page reads, loaded once and indexed for each way of finding a character.
// The indexes are plain (not reactive) objects; only the load status is state.
import { loadCodes, loadEntries, loadStrokes, loadAttestation, loadSamples, loadSijiao, loadRhymes, loadCcamcIndex, loadTibetan, loadTibetanRhymes, loadGongRhymes, loadChineseRhymes, loadTangutNames, loadPartNames, loadFrequency } from './data.js'
import { indexReadings, indexHiddenReadings } from './reading.js'
import { OPERATORS, isTangut, buildPartIndex } from './composition.js'

/** @typedef {import('./data.js').Entry} Entry */

export { OPERATORS, isTangut }

/** @param {string} char */
export const isComponent = char => /^[\u{18800}-\u{18AFF}\u{18D80}-\u{18DFF}]$/u.test(char)
/** Whether the bundled fonts draw the character (Noto Serif Tangut 2.168 stops at U+187F7 and U+18D08). @param {string} char */
export const hasGlyph = char => {
  const code = char.codePointAt(0) ?? 0
  return (code >= 0x17000 && code <= 0x187F7) || (code >= 0x18800 && code <= 0x18AFF) || (code >= 0x18D00 && code <= 0x18D08)
}
/** @param {string} char */
export const hex = char => (char.codePointAt(0) ?? 0).toString(16).toUpperCase()
/** @param {string} char */
export const codePoint = char => `U+${hex(char)}`

export const db = $state({
  /** @type {'loading' | 'ready' | 'failed'} */ status: 'loading',
  /** @type {import('./data.js').Attestation | null} */ attestation: null,
  /** @type {import('./data.js').Sample[]} */ samples: [],
})

/** The indexes, filled when the records arrive. */
export const ix = {
  /** @type {Entry[]} */ entries: [],
  /** @type {Map<string, Entry>} */ byChar: new Map(),
  /** Cangjie codes by character, shortest first. @type {Map<string, string[]>} */ codes: new Map(),
  /** Every [code, character] pair, ordered by code. @type {[string, string][]} */ codeList: [],
  /** Characters and components with a component code (one beginning `p`), by code. @type {[string, string][]} */ palette: [],
  /** @type {import('./reading.js').Reading[]} */ readings: [],
  /** CCAMC readings Wiktionary does not carry, used by the search and never shown. @type {import('./reading.js').HiddenReading[]} */ hiddenReadings: [],
  /** CCAMC glosses as normalized terms, used by the meaning search and never shown.
   *  @type {{ meanings: Record<string, Record<string, string[]>> }} */ ccamcMeanings: { meanings: {} },
  /** @type {Map<string, number>} */ strokes: new Map(),
  /** The parts of each description at every layer, counted. @type {Map<string, Map<string, number>>} */ partsOf: new Map(),
  /** The characters holding each part at any layer. @type {Map<string, Set<string>>} */ usedBy: new Map(),
  /** The parts each description names directly, character parts included. @type {Map<string, string[]>} */ directPartsOf: new Map(),
  /** Every character the site knows, in code point order. @type {string[]} */ all: [],
  /** Four-corner codes by character. @type {Map<string, string>} */ sijiao: new Map(),
  /** [code, character] pairs ordered by code. @type {[string, string][]} */ sijiaoList: [],
  /** The rhyme books' record by character. @type {Map<string, import('./data.js').RhymeChars[string]>} */ rhymes: new Map(),
  /** Where the rhyme record comes from, for the sources page. @type {import('./data.js').Rhymes['source'] | null} */ rhymeSource: null,
  /** The characters whose spelling is read from this one. @type {Map<string, Set<string>>} */ fanqieUsedBy: new Map(),
  /** Tibetan phonetic glosses by character: [Wylie, Tibetan script, [[shelfmark, count]…]]. @type {Map<string, [string, string, [string, number][]][]>} */ tibetan: new Map(),
  /** The Tibetan spellings at each crossing: `rhyme·tone`, then initial class. @type {Record<string, Record<string, string[]>>} */ tibetanRhymes: {},
  /** 龔煌城's value for each rhyme. @type {Record<string, string>} */ gongRhymes: {},
  /** The Chinese characters transcribing each rhyme: [character, final?]. @type {Record<string, [string, string?][]>} */ chineseRhymes: {},
  /** How often each character occurs in the corpus. @type {Map<string, number>} */ frequency: new Map(),
  /** Japanese shape names for Tangut components. @type {{ name: string, char: string, source: string, detail: string, credit: string }[]} */ names: [],
  /** The same names compared across languages. @type {{ languages: string[], rows: { char: string, names: Record<string, string[]>, source: string }[] } | null} */ partNames: null,
  /** Characters one component away, built on the first ask: a reader who means one shape and draws
   *  a neighbour of it needs that neighbour offered. @type {Map<string, string[]>} */ siblings: new Map(),
  /** Whether the sibling index has been built. */ siblingsReady: false,
}

export async function load() {
  try {
    const [entries, pairs, strokes, sijiao, rhymes, hidden, tibetan, tibetanRhymes, gongRhymes, chineseRhymes, names, partNames, frequency] = await Promise.all([
      loadEntries(), loadCodes(), loadStrokes(), loadSijiao().catch(() => []), loadRhymes().catch(() => null),
      loadCcamcIndex().catch(() => null), loadTibetan().catch(() => null), loadTibetanRhymes().catch(() => null), loadGongRhymes().catch(() => null), loadChineseRhymes().catch(() => null), loadTangutNames().catch(() => []),
      loadPartNames().catch(() => null), loadFrequency().catch(() => null),
    ])
    ix.tibetan = new Map(Object.entries(tibetan?.glosses ?? {}))
    ix.tibetanRhymes = tibetanRhymes?.cells ?? {}
    ix.gongRhymes = gongRhymes?.values ?? {}
    ix.chineseRhymes = chineseRhymes?.rhymes ?? {}
    ix.entries = entries
    ix.byChar = new Map(entries.map(entry => [entry.char, entry]))
    ix.names = names
    ix.partNames = partNames
    for (const [char, code] of pairs) {
      const list = ix.codes.get(char)
      if (list) list.push(code)
      else ix.codes.set(char, [code])
    }
    for (const list of ix.codes.values()) list.sort((a, b) => a.length - b.length || a.localeCompare(b))
    ix.codeList = pairs.map(([char, code]) => /** @type {[string, string]} */ ([code, char])).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
    ix.palette = ix.codeList.filter(([code]) => code.startsWith('p'))
    ix.readings = indexReadings(entries)
    ix.hiddenReadings = indexHiddenReadings(hidden)
    if (hidden) ix.ccamcMeanings = { meanings: hidden.meanings ?? {} }
    ix.strokes = new Map(Object.entries(strokes))
    const index = buildPartIndex(entries)
    ix.partsOf = index.partsOf
    ix.usedBy = index.usedBy
    ix.directPartsOf = index.directPartsOf
    if (frequency) ix.frequency = new Map(Object.entries(frequency.counts))
    if (rhymes) {
      ix.rhymes = new Map(Object.entries(rhymes.chars))
      ix.rhymeSource = rhymes.source
      // The two characters a spelling is read from, turned round: who is spelt with this one.
      for (const [spelt, value] of ix.rhymes) {
        for (const cell of [value[3], value[4], value[5], value[6]]) {
          if (!cell || cell === '?' || cell === spelt) continue
          const users = ix.fanqieUsedBy.get(cell)
          if (users) users.add(spelt)
          else ix.fanqieUsedBy.set(cell, new Set([spelt]))
        }
      }
    }
    for (const [char, code] of sijiao) ix.sijiao.set(char, code)
    ix.sijiaoList = [...ix.sijiao].map(([char, code]) => /** @type {[string, string]} */ ([code, char])).sort((a, b) => a[0].localeCompare(b[0]) || (a[1].codePointAt(0) ?? 0) - (b[1].codePointAt(0) ?? 0))
    ix.all = [...new Set([...ix.byChar.keys(), ...ix.codes.keys()])].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
    db.status = 'ready'
  } catch (error) {
    console.error(error)
    db.status = 'failed'
  }
  loadAttestation().then(found => { db.attestation = found }, error => console.error(error))
  loadSamples().then(found => { db.samples = found.samples }, error => console.error(error))
}

/** The first English sense, shortened for a tile or a list row. @param {string} char */
export function gloss(char) {
  const entry = ix.byChar.get(char)
  const first = entry?.definitions?.en?.[0] ?? entry?.definitions?.zh?.[0] ?? ''
  return first.split(/[;,]/)[0].trim()
}

/** The places in the recorded corpus that attest a character. @param {string} char */
export function attested(char) {
  const found = db.attestation
  if (!found) return []
  const rows = found.rows[char] ?? {}
  return found.sources.flatMap(source => (rows[source.id] ?? []).map(([line, position]) => ({ source, line, position, text: found.lines[line] })))
}

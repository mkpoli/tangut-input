// The state every view shares: the loaded records, the chosen character, and the search box.
import { loadCodes, loadEntries } from './data.js'

/** @typedef {import('./data.js').Entry} Entry */
export const app = $state({
  data: {
    /** @type {'loading' | 'ready' | 'failed'} */ status: 'loading',
    /** @type {Entry[]} */ entries: [],
    /** @type {Map<string, Entry>} */ byChar: new Map(),
    /** Full Cangjie codes by character, from the RIME table. @type {Map<string, string[]>} */
    codes: new Map(),
  },
  view: {
    /** @type {string | null} */ selected: null,
    /** @type {'code' | 'phonetic' | 'glyph' | 'component'} */ mode: 'code',
    /** @type {string} */ query: '',
  },
})

export async function load() {
  if (app.data.status !== 'loading') return
  try {
    /** @type {[Entry[], [string, string][]]} */
    const [records, pairs] = await Promise.all([loadEntries(), loadCodes()])
    const codes = new Map()
    for (const [char, code] of pairs) {
      const list = codes.get(char)
      if (list) list.push(code)
      else codes.set(char, [code])
    }
    app.data.entries = records
    app.data.byChar = new Map(records.map(record => [record.char, record]))
    app.data.codes = codes
    app.data.status = 'ready'
  } catch {
    app.data.status = 'failed'
  }
}

/** @param {string | null} char */
export function select(char) {
  app.view.selected = char
}

/** The records matching a query in the given mode, best first. @param {string} query @param {string} mode */
export function search(query, mode) {
  const text = query.trim()
  if (!text) return []
  if (mode === 'code') return byCode(text)
  if (mode === 'phonetic') return byPhonetic(text)
  if (mode === 'glyph') return byGloss(text)
  if (mode === 'component') return byComponent(text)
  return []
}

/** Cangjie: characters whose full or short code starts with the typed letters. @param {string} query */
function byCode(query) {
  const letters = query.toLowerCase().replace(/[^a-z]/g, '')
  if (!letters) return []
  /** @type {{ char: string, code: string }[]} */
  const hits = []
  for (const [char, list] of app.data.codes) for (const code of list) if (code.startsWith(letters)) hits.push({ char, code })
  hits.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code))
  return unique(hits.map(hit => hit.char))
}

/** Phonetic: romanizations across the recorded systems, compared without tone marks or diacritics. @param {string} query */
function byPhonetic(query) {
  const normalized = fold(query)
  if (!normalized) return []
  /** @type {{ char: string, exact: number }[]} */
  const hits = []
  for (const entry of app.data.entries) {
    let best = 0
    for (const value of Object.values(entry.pronunciations ?? {})) {
      const folded = fold(value)
      if (!folded) continue
      if (folded === normalized) best = 2
      else if (best < 2 && folded.startsWith(normalized)) best = 1
    }
    if (best) hits.push({ char: entry.char, exact: best })
  }
  hits.sort((a, b) => b.exact - a.exact)
  return hits.map(hit => hit.char)
}

/** English, Japanese or Chinese meanings. @param {string} query */
function byGloss(query) {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []
  return app.data.entries.filter(entry => {
    const d = entry.definitions ?? {}
    return [...(d.en ?? []), ...(d.ja ?? []), ...(d.zh ?? [])].some(text => text.toLowerCase().includes(needle))
  }).map(entry => entry.char)
}

/** A component: the characters whose recorded description contains it. @param {string} query */
function byComponent(query) {
  const char = [...query.trim()][0]
  if (!char) return []
  return app.data.entries.filter(entry => entry.composition?.includes(char) && entry.char !== char).map(entry => entry.char)
}

/** Lower case, tone marks and vowel diacritics dropped, nothing between letters. @param {string} value */
export function fold(value) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u0316\u0318-\u0334\u0336-\u0339\u033b-\u0341]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** @param {string[]} chars */
function unique(chars) {
  return [...new Set(chars)]
}

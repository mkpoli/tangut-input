// The Japanese shape names for Tangut components, and the search over them: くノ, ノメ, ノメメ,
// くくノ. A name is folded before it is compared, so katakana and hiragana, wide and narrow
// letters, and spaces and punctuation do not tell names apart.
import { readDescription } from './composition.js'

const KATAKANA = /[\u30A1-\u30F6]/g
const MARKS = /[\s　・·,，、.。:：;；/／|｜\\()（）「」『』【】\[\]{}<>《》〈〉'"“”‘’!?！？~〜～\-—–_ー]+/g

/** A shape name folded for a search: NFKC, lower case, katakana as hiragana, punctuation out. @param {string} text */
export function foldShapeName(text) {
  return (text ?? '').normalize('NFKC').toLowerCase()
    .replace(KATAKANA, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(MARKS, '')
}

/**
 * Components whose shape name is the query, starts it, or holds it. A whole name comes first, then a
 * shorter name, then code point order. A component with several names keeps its closest.
 * @param {{ name: string, char: string }[]} names name rows
 * @param {string} query
 * @returns {{ char: string, name: string, tier: number }[]}
 */
export function searchShapeNames(names, query) {
  const typed = foldShapeName(query)
  if ([...typed].length < 2) return []
  /** @type {Map<string, { char: string, name: string, tier: number }>} */
  const best = new Map()
  for (const { name, char } of names) {
    const folded = foldShapeName(name)
    const tier = folded === typed ? 0 : folded.startsWith(typed) ? 1 : folded.includes(typed) ? 2 : 9
    if (tier === 9) continue
    const known = best.get(char)
    if (!known || tier < known.tier) best.set(char, { char, name, tier })
  }
  return [...best.values()].sort((a, b) => a.tier - b.tier || a.name.length - b.name.length
    || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}

/**
 * The shape spellings of a description: its parts' names in the order it writes them. A part
 * without a name, a description short of an operand, or a description with more than one root
 * leaves the character unread. A part with several names gives one spelling for each.
 * @param {string} composition
 * @param {Map<string, string[]>} namesOf shape names by component
 * @returns {string[]}
 */
export function spellShape(composition, namesOf) {
  const { roots, complete } = readDescription(composition)
  if (!complete || roots.length !== 1) return []
  /** @type {string[]} */
  const parts = []
  /** @param {import('./composition.js').Node} node */
  const walk = node => {
    if (typeof node === 'string') { parts.push(node); return }
    for (const part of node.parts) walk(part)
  }
  walk(roots[0])
  /** @type {string[]} */
  let spellings = ['']
  for (const part of parts) {
    const names = namesOf.get(part)
    if (!names?.length) return []
    spellings = spellings.flatMap(spelling => names.map(name => spelling + name))
  }
  return spellings
}

/**
 * The shape spelling of every character whose parts all have a Japanese shape name. A character
 * described with the parts spelled in order reads as their names run together.
 * @param {{ char: string, composition?: string }[]} entries
 * @param {{ name: string, char: string }[]} names
 * @returns {Map<string, string[]>}
 */
export function indexShapeSpellings(entries, names) {
  /** @type {Map<string, string[]>} */
  const namesOf = new Map()
  for (const { name, char } of names) {
    const known = namesOf.get(char)
    if (known) { if (!known.includes(name)) known.push(name) }
    else namesOf.set(char, [name])
  }
  /** @type {Map<string, string[]>} */
  const spellings = new Map()
  for (const entry of entries) {
    if (!entry.composition) continue
    const found = spellShape(entry.composition, namesOf)
    if (found.length) spellings.set(entry.char, [...new Set(found)])
  }
  return spellings
}

/**
 * Characters whose parts, named in order, spell the whole query. A spelling typed in katakana or
 * hiragana reads the same.
 * @param {Map<string, string[]>} spellings
 * @param {string} query
 * @returns {{ char: string, spelling: string }[]}
 */
export function searchShapeSpellings(spellings, query) {
  const typed = foldShapeName(query)
  if ([...typed].length < 2) return []
  /** @type {{ char: string, spelling: string }[]} */
  const hits = []
  for (const [char, list] of spellings) {
    const spelling = list.find(spelling => foldShapeName(spelling) === typed)
    if (spelling) hits.push({ char, spelling })
  }
  return hits.sort((a, b) => (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
}

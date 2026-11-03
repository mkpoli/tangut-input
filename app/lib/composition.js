// Comparing characters by their parts: what a character is built from, and which characters differ
// from it by a single part — the neighbours a reader most often means when a component is drawn
// slightly wrong.

export const OPERATORS = new Set([...'⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻'])

/** The parts of a description, in the order they are written. @param {string} composition */
export function partsOf(composition) {
  return [...(composition ?? '')].filter(char => !OPERATORS.has(char) && char !== '(' && char !== ')')
}

/**
 * Every character's one-part-away neighbours: same parts with one replaced, one dropped, or one
 * added. Built once over the whole block, which is a second's work at this size.
 * @param {{ char: string, composition?: string }[]} entries
 * @returns {Map<string, string[]>}
 */
export function siblingIndex(entries) {
  /** @type {Map<string, string[]>} */
  const parts = new Map()
  /** @type {Map<string, string[]>} */
  const byDropped = new Map()
  for (const entry of entries) {
    const list = partsOf(entry.composition ?? '')
    if (list.length < 2) continue
    parts.set(entry.char, list)
    for (const part of new Set(list)) {
      const key = [...list]
      key.splice(key.indexOf(part), 1)
      const joined = key.sort().join('')
      const bucket = byDropped.get(joined) ?? []
      bucket.push(entry.char)
      byDropped.set(joined, bucket)
    }
  }
  /** @type {Map<string, string[]>} */
  const siblings = new Map()
  for (const [char, list] of parts) {
    /** @type {Set<string>} */
    const found = new Set()
    for (const part of new Set(list)) {
      const key = [...list]
      key.splice(key.indexOf(part), 1)
      for (const other of byDropped.get(key.sort().join('')) ?? []) if (other !== char) found.add(other)
    }
    siblings.set(char, [...found].slice(0, 24))
  }
  return siblings
}

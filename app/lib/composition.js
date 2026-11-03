// Comparing characters by their parts: what a character is built from, which characters differ
// from it by a single part, and the parts it holds at every layer of its description.
//
// A Tangut character is described with components, and a run of those components often spells
// another character whole. That character is itself described in turn, so the parts of a character
// form a tree of characters and components, not one flat list of components.

/** @typedef {{ op: string, parts: Node[], cut?: boolean } | string} Node */

export const OPERATORS = new Set([...'⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻'])
const ARITY = /** @type {Record<string, number>} */ ({ '⿲': 3, '⿳': 3 })

/** @param {string} char */
export const isTangut = char => /^[\u{17000}-\u{18AFF}\u{18D00}-\u{18D7F}\u{18D80}-\u{18DFF}]$/u.test(char)

/** The parts of a description, in the order they are written. @param {string} composition */
export function partsOf(composition) {
  return [...(composition ?? '')].filter(char => !OPERATORS.has(char) && char !== '(' && char !== ')')
}

/**
 * Read a description into the trees it is written as. An operator short of an operand keeps the
 * operands it has; the caller can tell that the reading is incomplete.
 * @param {string} text
 * @returns {{ roots: Node[], complete: boolean }}
 */
export function readDescription(text) {
  const chars = [...(text ?? '')]
  let at = 0
  let complete = true
  /** @returns {Node} */
  const node = () => {
    const char = chars[at++]
    if (!OPERATORS.has(char)) return char
    /** @type {Node[]} */
    const parts = []
    let cut = false
    for (let i = 0; i < (ARITY[char] ?? 2); i++) {
      if (at >= chars.length) { complete = false; cut = true; break }
      const part = node()
      if (typeof part !== 'string' && part.cut) cut = true
      parts.push(part)
    }
    // An operator with no operands is read as its own glyph.
    return parts.length ? { op: char, parts, ...(cut ? { cut: true } : {}) } : char
  }
  /** @type {Node[]} */
  const roots = []
  while (at < chars.length) roots.push(node())
  return { roots, complete }
}

/** A tree written as the description it came from. @param {Node} node @returns {string} */
export function writeDescription(node) {
  return typeof node === 'string' ? node : node.op + node.parts.map(writeDescription).join('')
}

/** The components written in a description, in order. @param {string} composition */
export function leavesOf(composition) {
  return [...(composition ?? '')].filter(char => !OPERATORS.has(char) && isTangut(char))
}

/**
 * The parts of every character, at every layer. A subtree that spells another character stands for
 * that character, whose own parts stand under it in turn, so a part is found however deep it lies.
 * A leaf that spells several characters keeps its written component as the character's direct part,
 * but each candidate remains a part of it. A description short of an operand keeps its components.
 * @param {{ char: string, composition?: string }[]} entries
 * @returns {{ partsOf: Map<string, Map<string, number>>, usedBy: Map<string, Set<string>>, directPartsOf: Map<string, string[]> }}
 */
export function buildPartIndex(entries) {
  /** @type {Map<string, string[]>} */
  const byDescription = new Map()
  for (const entry of entries) {
    const text = entry.composition
    if (!text) continue
    const chars = byDescription.get(text)
    if (chars) chars.push(entry.char)
    else byDescription.set(text, [entry.char])
  }
  /** @type {Map<string, { roots: Node[], complete: boolean } | null>} */
  const read = new Map()
  /** @type {Map<string, string>} */
  const compositionOf = new Map()
  for (const entry of entries) {
    if (!entry.composition) continue
    read.set(entry.char, readDescription(entry.composition))
    compositionOf.set(entry.char, entry.composition)
  }

  /**
   * The characters a piece of description can stand for. A character is not one of its own parts.
   * @param {string} text @param {string} self
   */
  const charactersAt = (text, self) => (byDescription.get(text) ?? []).filter(char => char !== self)

  /**
   * The parts a character is directly described with: the largest characters its description
   * spells whole, or the components where no single character does.
   * @param {string} char
   * @returns {string[]}
   */
  function directParts(char) {
    const found = read.get(char)
    const composition = compositionOf.get(char) ?? ''
    if (!found) return leavesOf(composition)
    /** @type {string[]} */
    const parts = []
    /** @param {Node} node @param {boolean} top */
    const walk = (node, top) => {
      if (typeof node === 'string') {
        // The root of a description is the character itself, not one of its parts.
        if (top) { if (isTangut(node)) parts.push(node); return }
        const chars = charactersAt(node, char)
        // A leaf that spells several characters is left as the component written there.
        parts.push(chars.length === 1 ? chars[0] : node)
        return
      }
      // A truncated node is no character's description; the operands it kept may still be.
      if (top || node.cut) { for (const part of node.parts) walk(part, false); return }
      const chars = charactersAt(writeDescription(node), char)
      if (chars.length === 1) { parts.push(chars[0]); return }
      // No one character stands there, or several do: keep the parts it is written with.
      for (const part of node.parts) walk(part, false)
    }
    const top = found.roots.length === 1
    for (const root of found.roots) walk(root, top)
    return parts.filter(isTangut)
  }

  /** @type {Map<string, string[][]>} */
  const groupCache = new Map()
  /**
   * The direct parts of a character, each place holding the candidates that may stand there.
   * @param {string} char
   * @returns {string[][]}
   */
  function groupsOf(char) {
    const known = groupCache.get(char)
    if (known) return known
    const found = read.get(char)
    const composition = compositionOf.get(char) ?? ''
    /** @type {string[][]} */
    const groups = []
    if (found) {
      /** @param {Node} node @param {boolean} top */
      const walk = (node, top) => {
        if (typeof node === 'string') {
          // The root of a description is the character itself, not one of its parts.
          if (top) { if (isTangut(node)) groups.push([node]); return }
          const chars = charactersAt(node, char)
          groups.push(chars.length ? chars : isTangut(node) ? [node] : [])
          return
        }
        // A truncated node is no character's description; the operands it kept may still be.
        if (top || node.cut) { for (const part of node.parts) walk(part, false); return }
        const chars = charactersAt(writeDescription(node), char)
        if (chars.length) { groups.push(chars); return }
        for (const part of node.parts) walk(part, false)
      }
      const top = found.roots.length === 1
      for (const root of found.roots) walk(root, top)
    } else {
      for (const part of leavesOf(composition)) groups.push([part])
    }
    const kept = groups.filter(group => group.length)
    groupCache.set(char, kept)
    return kept
  }

  /**
   * Every part of a character, counted through its whole tree. Several characters that one
   * description spells are alternative readings of one place, not different parts; the reading
   * that holds the most of a part is used for each.
   * @param {string} char @param {Set<string>} path
   * @returns {Map<string, number>}
   */
  function collect(char, path) {
    if (path.has(char)) return new Map()
    const next = new Set(path).add(char)
    /** @type {Map<string, number>} */
    const out = new Map()
    for (const group of groupsOf(char)) {
      /** @type {Map<string, number> | null} */
      let best = null
      for (const candidate of group) {
        /** @type {Map<string, number>} */
        const found = new Map(collect(candidate, next))
        found.set(candidate, (found.get(candidate) ?? 0) + 1)
        if (!best) best = found
        else for (const [part, count] of found) if (count > (best.get(part) ?? 0)) best.set(part, count)
      }
      if (!best) continue
      for (const [part, count] of best) out.set(part, (out.get(part) ?? 0) + count)
    }
    return out
  }

  /** @type {Map<string, Map<string, number>>} */
  const partsOf = new Map()
  /** @type {Map<string, Set<string>>} */
  const usedBy = new Map()
  /** @type {Map<string, string[]>} */
  const directPartsOf = new Map()
  for (const entry of entries) {
    const char = entry.char
    const parts = collect(char, new Set())
    partsOf.set(char, parts)
    directPartsOf.set(char, directParts(char))
    for (const part of parts.keys()) {
      let users = usedBy.get(part)
      if (!users) usedBy.set(part, users = new Set())
      users.add(char)
    }
  }
  return { partsOf, usedBy, directPartsOf }
}

/**
 * The characters that hold every part, as often as asked, at any layer. The smallest set of
 * holders of one part is scanned, never the whole table.
 * @param {{ partsOf: Map<string, Map<string, number>>, usedBy: Map<string, Set<string>> }} index
 * @param {string[]} parts
 * @returns {string[]}
 */
export function matchByParts(index, parts) {
  if (!parts.length) return []
  /** @type {Map<string, number>} */
  const need = new Map()
  for (const part of parts) need.set(part, (need.get(part) ?? 0) + 1)
  /** @type {Iterable<string>} */
  let pool = []
  let smallest = Infinity
  for (const part of need.keys()) {
    const users = index.usedBy.get(part)
    if (!users) return []
    if (users.size < smallest) { pool = users; smallest = users.size }
  }
  /** @type {string[]} */
  const hits = []
  for (const char of pool) {
    const have = index.partsOf.get(char)
    if ([...need].every(([part, count]) => (have?.get(part) ?? 0) >= count)) hits.push(char)
  }
  return hits
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

// Comparing characters by their parts: what a character is built from, which characters differ
// from it by a single part, and the parts it holds at every layer of its description.
//
// A Tangut character is described with components, and a run of those components often spells
// another character whole. That character is itself described in turn, so the parts of a character
// form a tree of characters and components, not one flat list of components.

/** @typedef {{ op: string, parts: Node[], cut?: boolean } | string} Node */
/** @typedef {{ candidates: string[], leaf?: string, shape?: string, children?: PartGroup[] }} PartGroup */

export const OPERATORS = new Set([...'⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻㇯'])
const ARITY = /** @type {Record<string, number>} */ ({ '⿲': 3, '⿳': 3, '㇯': 2 })

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
 * Whether a part is a description of several characters rather than one encoded character or
 * component. A description part is an editorial key, not a character of its own.
 * @param {string} part
 */
export const isDescriptionPart = part => [...(part ?? '')].some(char => OPERATORS.has(char))

/**
 * A description read as two parts wherever a pair of its three operands spells a character: a
 * character of three columns or three rows is often one part beside a character of two. The pair
 * that spells a character is the evidence for the cut; both pairs or neither leave three operands.
 * A node that spells a character whole is left as it is, so the character stays the base there.
 * @param {{ roots: Node[], complete: boolean }} parsed
 * @param {(text: string) => string[]} charactersAt the characters a description spells, the character itself left out
 * @returns {{ roots: Node[], complete: boolean }}
 */
export function binaryDescription(parsed, charactersAt) {
  /** @param {Node} node @returns {Node} */
  const regroup = node => {
    if (typeof node === 'string') return node
    // A truncated node is no character's description, but the operands it kept may be.
    if (node.cut) return { ...node, parts: node.parts.map(regroup) }
    // A node that spells a character is that character's base; its own cut is the character's.
    if (charactersAt(writeDescription(node)).length) return { ...node, parts: node.parts }
    const parts = node.parts.map(regroup)
    if (parts.length !== 3) return { ...node, parts }
    const op = node.op === '⿳' ? '⿱' : node.op === '⿲' ? '⿰' : ''
    if (!op) return { ...node, parts }
    const text = parts.map(writeDescription)
    const tail = charactersAt(op + text[1] + text[2])
    const head = charactersAt(op + text[0] + text[1])
    if (tail.length === 1 && !head.length) return { op, parts: [parts[0], { op, parts: [parts[1], parts[2]] }] }
    if (head.length === 1 && !tail.length) return { op, parts: [{ op, parts: [parts[0], parts[1]] }, parts[2]] }
    return { ...node, parts }
  }
  return { roots: parsed.roots.map(regroup), complete: parsed.complete }
}

/**
 * The parts of every character, at every layer. A subtree that spells another character stands for
 * that character, whose own parts stand under it in turn, so a part is found however deep it lies.
 * A leaf that spells several characters keeps its written component as the character's direct part,
 * but each candidate remains a part of it. A description short of an operand keeps its components.
 * Other descriptions (aliases) read beside the record: a character is found from the parts they
 * name, matches a layout they open with, and keeps the record's structure as the one it draws and
 * splits into.
 * @param {{ char: string, composition?: string }[]} entries
 * @param {{ char: string, ids: string }[]} [aliases]
 * @returns {{ partsOf: Map<string, Map<string, number>>, usedBy: Map<string, Set<string>>, directPartsOf: Map<string, string[]>, descriptionGroups: Map<string, { op: string, groups: PartGroup[] }[]> }}
 */
export function buildPartIndex(entries, aliases = []) {
  /** @type {Map<string, string[]>} */
  const byDescription = new Map()
  for (const entry of entries) {
    const text = entry.composition
    if (!text) continue
    const chars = byDescription.get(text)
    if (chars) { if (!chars.includes(entry.char)) chars.push(entry.char) }
    else byDescription.set(text, [entry.char])
  }
  /** @type {Map<string, string[]>} */
  const aliasesOf = new Map()
  for (const alias of aliases) {
    if (!alias.ids) continue
    const list = aliasesOf.get(alias.char)
    if (list) list.push(alias.ids)
    else aliasesOf.set(alias.char, [alias.ids])
  }
  /** @type {Map<string, { roots: Node[], complete: boolean } | null>} */
  const read = new Map()
  /** @type {Map<string, string>} */
  const compositionOf = new Map()
  /** @param {{ roots: Node[], complete: boolean }} parsed @param {string} self */
  function binaryView(parsed, self) {
    return binaryDescription(parsed, text => (byDescription.get(text) ?? []).filter(char => char !== self))
  }
  for (const entry of entries) {
    if (!entry.composition) continue
    read.set(entry.char, binaryView(readDescription(entry.composition), entry.char))
    compositionOf.set(entry.char, entry.composition)
  }

  /**
   * The characters a piece of description can stand for. A character is not one of its own parts.
   * @param {string} text @param {string} self
   */
  const charactersAt = (text, self) => (byDescription.get(text) ?? []).filter(char => char !== self)

  /**
   * The parts a character is directly described with: the largest characters its description
   * spells whole, complete unencoded editorial subtrees, and remaining components.
   * @param {string} char
   * @returns {string[]}
   */
  function directParts(char) {
    const found = read.get(char)
    const composition = compositionOf.get(char) ?? ''
    if (!found) return leavesOf(composition)
    /** @type {string[]} */
    const parts = []
    /** @param {Node} node @param {boolean} top @param {boolean} root */
    const walk = (node, top, root) => {
      if (typeof node === 'string') {
        // The root of a description is the character itself, not one of its parts.
        if (top) { if (isTangut(node)) parts.push(node); return }
        const chars = charactersAt(node, char)
        // A leaf that spells several characters is left as the component written there.
        parts.push(chars.length === 1 ? chars[0] : node)
        return
      }
      // A truncated node is no character's description; the operands it kept may still be.
      if (top || node.cut) { for (const part of node.parts) walk(part, false, false); return }
      const chars = charactersAt(writeDescription(node), char)
      if (chars.length === 1) { parts.push(chars[0]); return }
      if (!chars.length && !root) {
        parts.push(node.op + node.parts.map(part => editorialNode(part, char)).join(''))
        return
      }
      // Several characters stand there: keep the parts it is written with.
      for (const part of node.parts) walk(part, false, false)
    }
    const top = found.roots.length === 1
    for (const root of found.roots) walk(root, top, true)
    return parts.filter(part => isTangut(part) || OPERATORS.has([...part][0]))
  }

  // Render proper children as unambiguous encoded characters, matching the editorial IDS view.
  /** @param {Node} node @param {string} self @returns {string} */
  function editorialNode(node, self) {
    const text = writeDescription(node)
    if ((typeof node === 'string' && !OPERATORS.has(node)) || (typeof node !== 'string' && !node.cut)) {
      const chars = charactersAt(text, self).filter(char => /^[\u{17000}-\u{187FF}\u{18D00}-\u{18D7F}]$/u.test(char))
      if (chars.length === 1) return chars[0]
    }
    return typeof node === 'string' ? node : node.op + node.parts.map(part => editorialNode(part, self)).join('')
  }

  /** @type {Map<string, { op: string, groups: PartGroup[] }[]>} */
  const descriptionGroups = new Map()

  /** @type {Map<string, PartGroup[]>} */
  const groupCache = new Map()
  /**
   * Each group is one place in the tree. Its candidates are exclusive; a written leaf is
   * retained under any candidate. Children provide the written subtree when a cycle cuts off
   * every candidate at an internal node.
   * @param {string} char @param {{ roots: Node[], complete: boolean } | null | undefined} found
   * @returns {PartGroup[]}
   */
  function groupsFor(char, found) {
    /** @param {Node} node @param {boolean} top @param {boolean} root @returns {PartGroup[]} */
    const walk = (node, top, root) => {
      if (typeof node === 'string') {
        const candidates = top ? [] : charactersAt(node, char)
        return isTangut(node) || candidates.length ? [{ candidates, ...(isTangut(node) ? { leaf: node } : {}) }] : []
      }
      const children = node.parts.flatMap(part => walk(part, false, false))
      if (top || node.cut) return children
      const candidates = charactersAt(writeDescription(node), char)
      if (candidates.length) return [{ candidates, children }]
      if (root) return children
      const shape = node.op + node.parts.map(part => editorialNode(part, char)).join('')
      return [{ candidates, shape, children }]
    }
    const top = found?.roots.length === 1
    return found ? found.roots.flatMap(root => walk(root, top, true)) : []
  }

  /** The groups of a character's recorded description. @param {string} char @returns {PartGroup[]} */
  function groupsOf(char) {
    const known = groupCache.get(char)
    if (known) return known
    const kept = groupsFor(char, read.get(char))
    groupCache.set(char, kept)
    return kept
  }

  /** The operator the first root of a description opens with; a record with several roots keeps
   * the first, as the layout filter always read it. @param {{ roots: Node[] } | null | undefined} parsed */
  const openingOf = parsed => (parsed && parsed.roots[0] !== undefined && typeof parsed.roots[0] !== 'string' ? parsed.roots[0].op : '')

  // Every description of a character, the record first, read once so the part counts and the
  // search descend through all of them at any depth.
  for (const entry of entries) {
    if (!entry.composition) continue
    /** @type {{ op: string, groups: PartGroup[] }[]} */
    const views = [{ op: openingOf(read.get(entry.char)), groups: groupsOf(entry.char) }]
    for (const text of aliasesOf.get(entry.char) ?? []) {
      const parsed = binaryView(readDescription(text), entry.char)
      views.push({ op: openingOf(parsed), groups: groupsFor(entry.char, parsed) })
    }
    descriptionGroups.set(entry.char, views)
  }

  /**
   * Every part of a character, counted through its whole tree. Several characters that one
   * description spells are alternative readings of one place, not different parts; the reading
   * that holds the most of a part is used for each.
   * @param {string} char @param {Set<string>} path
   * @returns {Map<string, number>}
   */
  function collect(char, path) {
    /** @type {Map<string, number>} */
    const best = new Map()
    for (const view of descriptionGroups.get(char) ?? []) {
      for (const [part, count] of collectGroups(char, view.groups, path)) {
        if (count > (best.get(part) ?? 0)) best.set(part, count)
      }
    }
    return best
  }

  /**
   * The parts of one description of a character, counted through its groups.
   * @param {string} char @param {PartGroup[]} groups @param {Set<string>} path
   * @returns {Map<string, number>}
   */
  function collectGroups(char, groups, path) {
    const next = new Set(path).add(char)
    /** @type {Map<string, number>} */
    const out = new Map()
    for (const group of groups) {
      /** @type {Map<string, number>} */
      const best = new Map()
      const candidates = group.candidates.filter(candidate => !next.has(candidate))
      for (const candidate of candidates) {
        /** @type {Map<string, number>} */
        let found
        if (group.leaf) {
          const branch = new Set(next).add(candidate)
          found = candidate === group.leaf ? collect(candidate, next) :
            branch.has(group.leaf) ? new Map() : collect(group.leaf, branch)
          if (!next.has(group.leaf)) found.set(group.leaf, (found.get(group.leaf) ?? 0) + 1)
        } else found = collect(candidate, next)
        if (candidate !== group.leaf) found.set(candidate, (found.get(candidate) ?? 0) + 1)
        for (const [part, count] of found) if (count > (best.get(part) ?? 0)) best.set(part, count)
      }
      if (!candidates.length && group.children) {
        for (const [part, count] of collectGroups(char, group.children, path)) best.set(part, count)
      }
      if (!candidates.length && group.leaf && !next.has(group.leaf)) {
        for (const [part, count] of collect(group.leaf, next)) best.set(part, count)
        best.set(group.leaf, (best.get(group.leaf) ?? 0) + 1)
      }
      if (group.shape) best.set(group.shape, (best.get(group.shape) ?? 0) + 1)
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
  // A description part's operands are the parts a reader splits it into, characters kept whole.
  for (const part of usedBy.keys()) {
    if (!isDescriptionPart(part)) continue
    const { roots, complete } = readDescription(part)
    const root = roots[0]
    if (complete && roots.length === 1 && typeof root !== 'string') {
      directPartsOf.set(part, root.parts.map(child => editorialNode(child, part)).filter(child => isTangut(child) || isDescriptionPart(child)))
    }
  }
  return { partsOf, usedBy, directPartsOf, descriptionGroups }
}

/**
 * The characters that hold every part, as often as asked, at any layer. The smallest set of
 * holders of one part is scanned, never the whole table.
 * @param {{ partsOf: Map<string, Map<string, number>>, usedBy: Map<string, Set<string>>, descriptionGroups: Map<string, { op: string, groups: PartGroup[] }[]> }} index
 * @param {string[]} parts
 * @param {string} [layout] an IDS operator, matched against the description the parts are read in
 * @returns {string[]}
 */
export function matchByParts(index, parts, layout = '') {
  if (!parts.length && !layout) return []
  /** @type {Map<string, number>} */
  const need = new Map()
  for (const part of parts) need.set(part, (need.get(part) ?? 0) + 1)
  /** @type {Iterable<string>} */
  let pool = need.size ? [] : (index.descriptionGroups?.keys() ?? [])
  let smallest = Infinity
  for (const part of need.keys()) {
    const users = index.usedBy.get(part)
    if (!users) return []
    if (users.size < smallest) { pool = users; smallest = users.size }
  }
  /** Every description a character has, the record first: a nested character is read the same way.
   * A character without one contributes itself and no parts.
   * @param {string} char @returns {PartGroup[][]} */
  const descriptionsOf = char => {
    const views = index.descriptionGroups?.get(char) ?? []
    return views.length ? views.map(view => view.groups) : [[]]
  }
  const wanted = [...need.keys()]
  const limits = wanted.map(part => need.get(part) ?? 0)
  const positions = new Map(wanted.map((part, i) => [part, i]))
  /** @param {number[]} counts @param {string} part */
  function add(counts, part) {
    const i = positions.get(part)
    if (i === undefined || counts[i] >= limits[i]) return counts
    const next = counts.slice()
    next[i]++
    return next
  }
  /**
   * Enumerate distinct capped query counts, never full trees. A path is local to a branch so the
   * same character can occur in independent places, but an ancestor cannot reappear below itself.
   * @param {PartGroup[]} groups @param {Set<string>} path @param {number[]} initial
   * @returns {Generator<number[]>}
   */
  function* resolve(groups, path, initial) {
    // Different choices in earlier places can reach the same capped counts. Resolve each state
    // once at this layer rather than revisiting all of its remaining places for every path.
    const visited = new Set()
    /** @param {number} at @param {number[]} counts @returns {Generator<number[]>} */
    function* visit(at, counts) {
      const state = `${at}:${counts.join(',')}`
      if (visited.has(state)) return
      visited.add(state)
      if (at === groups.length) { yield counts; return }
      const group = groups[at]
      if (group.shape) counts = add(counts, group.shape)
      const candidates = group.candidates.filter(candidate => !path.has(candidate))
      const seen = new Set()
      /** @param {number[]} value */
      function* advance(value) {
        const key = value.join(',')
        if (seen.has(key)) return
        seen.add(key)
        yield* visit(at + 1, value)
      }
      /** @param {number[]} value @param {Set<string>} branch @returns {Generator<number[]>} */
      function* expandLeaf(value, branch) {
        if (!group.leaf || branch.has(group.leaf)) { yield value; return }
        const next = new Set(branch).add(group.leaf)
        for (const groupsOfLeaf of descriptionsOf(group.leaf)) yield* resolve(groupsOfLeaf, next, add(value, group.leaf))
      }
      if (!candidates.length) {
        if (group.children) {
          for (const value of resolve(group.children, path, counts)) yield* advance(value)
        } else {
          for (const value of expandLeaf(counts, path)) yield* advance(value)
        }
      } else {
        for (const candidate of candidates) {
          const next = new Set(path).add(candidate)
          if (group.leaf) {
            const value = add(counts, candidate)
            if (candidate === group.leaf) {
              for (const groupsOfCandidate of descriptionsOf(candidate)) {
                for (const nested of resolve(groupsOfCandidate, next, value)) yield* advance(nested)
              }
            } else {
              for (const nested of expandLeaf(value, next)) yield* advance(nested)
            }
          } else {
            for (const groupsOfCandidate of descriptionsOf(candidate)) {
              for (const nested of resolve(groupsOfCandidate, next, add(counts, candidate))) yield* advance(nested)
            }
          }
        }
      }
    }
    yield* visit(0, initial)
  }
  /** @type {string[]} */
  const hits = []
  for (const char of pool) {
    const have = index.partsOf.get(char)
    if (need.size && ![...need].every(([part, count]) => (have?.get(part) ?? 0) >= count)) continue
    // The layout and the parts are read from one description: a part of the record does not pair
    // with an operator only an alias opens with.
    const views = (index.descriptionGroups?.get(char) ?? []).filter(view => !layout || view.op === layout)
    if (!views.length) continue
    if (!need.size) { hits.push(char); continue }
    // Per-part maxima are exact for a single distinct part, and exact for a character whose one
    // description already passed the layout filter.
    if (need.size === 1 && (index.descriptionGroups?.get(char) ?? []).length === 1) { hits.push(char); continue }
    // A character matches from any one of its descriptions; parts of two descriptions are not
    // added together.
    const matches = views.some(view => {
      for (const counts of resolve(view.groups, new Set([char]), limits.map(() => 0))) {
        if (counts.every((count, i) => count >= limits[i])) return true
      }
      return false
    })
    if (matches) hits.push(char)
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

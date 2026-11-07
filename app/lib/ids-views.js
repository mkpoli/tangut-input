// Editorial character-sized descriptions retain the source tree and replace only complete,
// unambiguous proper subtrees with the character whose recorded description matches them.
import { leavesOf, OPERATORS, readDescription, writeDescription } from './composition.js'

/** @typedef {{ op: string, parts: Node[], cut?: boolean } | string} Node */

/** @param {string} char */
const isCharacter = char => /^[\u{17000}-\u{187FF}\u{18D00}-\u{18D7F}]$/u.test(char)

/**
 * Index complete recorded descriptions by character. Duplicate records of the same character
 * count once; descriptions with missing operands or multiple roots cannot match a subtree.
 * @param {{ char: string, composition?: string }[]} entries
 * @returns {Map<string, Set<string>>}
 */
export function indexIdsDescriptions(entries) {
  /** @type {Map<string, Set<string>>} */
  const index = new Map()
  for (const { char, composition } of entries) {
    if (!composition || !isCharacter(char)) continue
    const parsed = readDescription(composition)
    if (!parsed.complete || parsed.roots.length !== 1) continue
    let chars = index.get(composition)
    if (!chars) index.set(composition, chars = new Set())
    chars.add(char)
  }
  return index
}

/**
 * @param {string} char
 * @param {string} recorded
 * @param {Map<string, Set<string>>} index
 * @returns {{ recorded: string, editorial: string, showEditorial: boolean, recordedParts: string[], editorialParts: string[] }}
 */
export function idsViews(char, recorded, index) {
  const { roots, complete } = readDescription(recorded)
  /** @param {Node} node @param {boolean} top @returns {string} */
  function render(node, top) {
    const text = writeDescription(node)
    if (!top && (typeof node === 'string' ? !OPERATORS.has(node) : !node.cut)) {
      const choices = [...(index.get(text) ?? [])].filter(other => other !== char)
      if (choices.length === 1) return choices[0]
    }
    return typeof node === 'string' ? node : node.op + node.parts.map(part => render(part, false)).join('')
  }
  const showEditorial = complete && roots.length === 1
  const editorial = showEditorial ? render(roots[0], true) : recorded
  return { recorded, editorial, showEditorial, recordedParts: leavesOf(recorded), editorialParts: leavesOf(editorial) }
}

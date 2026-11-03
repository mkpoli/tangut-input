// A description read as a query. The records write every character as an IDS string, so a string
// that starts with an operator is a description: the whole of it names the one character it
// describes, and a description cut after its opening part names the family that opens that way.
import { OPERATORS } from './composition.js'

/**
 * Characters whose recorded description begins with the typed or pasted text, in code order.
 * @param {{ char: string, composition?: string }[]} entries
 * @param {string} text
 * @returns {string[]}
 */
export function describedBy(entries, text) {
  const chars = [...text]
  // A description starts with an operator and holds at least one part after it.
  if (chars.length < 2 || !OPERATORS.has(chars[0])) return []
  if (!chars.slice(1).some(char => !OPERATORS.has(char))) return []
  /** @type {string[]} */
  const hits = []
  for (const entry of entries) {
    if (entry.composition?.startsWith(text)) hits.push(entry.char)
  }
  return hits.sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
}

// Operators that take three parts; the rest take two.
const ARITY = /** @type {Record<string, number>} */ ({ '⿲': 3, '⿳': 3 })

/** The index just past the description node that starts at `at`. @param {string[]} chars @param {number} at */
function after(chars, at) {
  if (!OPERATORS.has(chars[at])) return at + 1
  let end = at + 1
  for (let k = 0; k < (ARITY[chars[at]] ?? 2); k++) end = after(chars, end)
  return end
}

/**
 * The operator and the first part a description opens with, the part's whole subtree when it is
 * itself described, as the string a prefix query takes.
 * @param {string} [composition]
 * @returns {string}
 */
export function openingOf(composition) {
  const chars = [...(composition ?? '')]
  if (chars.length < 2 || !OPERATORS.has(chars[0])) return ''
  const end = after(chars, 1)
  return end <= chars.length ? chars.slice(0, end).join('') : ''
}

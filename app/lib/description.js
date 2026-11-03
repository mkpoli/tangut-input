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

/**
 * The operator and first part a description opens with, as the string a prefix query takes.
 * @param {string} [composition]
 * @returns {string}
 */
export function openingOf(composition) {
  const chars = [...(composition ?? '')]
  return chars.length > 1 && OPERATORS.has(chars[0]) ? chars.slice(0, 2).join('') : ''
}

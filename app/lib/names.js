// The Japanese shape names for Tangut components, and the search over them: くノ, ノメ, ノメメ,
// くくノ. A name is folded before it is compared, so katakana and hiragana, wide and narrow
// letters, and spaces and punctuation do not tell names apart.

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

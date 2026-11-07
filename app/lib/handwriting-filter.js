/** Filter shape-ranked candidates before applying the display limit.
 * @param {{ char: string }[]} hits
 * @param {{ usedBy: Map<string, Set<string>> }} index
 * @param {{ chosen?: string[], componentsOnly?: boolean, includeComponents?: boolean, limit?: number }} options
 */
export function filterHandwriting(hits, index, { chosen = [], componentsOnly = false, includeComponents = false, limit = 48 } = {}) {
  return hits.filter(({ char }) => {
    if (componentsOnly && !index.usedBy.has(char)) return false
    if (!componentsOnly && !includeComponents && /[\u{18800}-\u{18AFF}]/u.test(char)) return false
    return chosen.every(part => index.usedBy.get(part)?.has(char))
  }).slice(0, limit)
}

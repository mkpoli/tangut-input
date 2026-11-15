// The page query is a JSON tuple so composite descriptions and repeated parts stay distinct.
export const PART_LAYOUTS = ['⿰', '⿱', '⿲', '⿳', '⿺', '⿸', '⿵', '⿻']

/** @param {string[]} parts @param {string} layout */
export function encodePartsQuery(parts, layout) {
  return parts.length || layout ? JSON.stringify([parts, layout]) : ''
}

/** @param {string} query @returns {{ parts: string[], layout: string, legacy: boolean }} */
export function decodePartsQuery(query) {
  if (query.startsWith('[')) {
    try {
      const value = JSON.parse(query)
      if (Array.isArray(value) && value.length === 2 && Array.isArray(value[0]) && value[0].every(part => typeof part === 'string' && part.length > 0) && typeof value[1] === 'string' && (!value[1] || PART_LAYOUTS.includes(value[1]))) {
        return { parts: value[0], layout: value[1], legacy: false }
      }
    } catch { /* invalid query */ }
    return { parts: [], layout: '', legacy: false }
  }
  return { parts: [...query], layout: '', legacy: true }
}

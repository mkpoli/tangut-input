/**
 * The commonest Chinese word recorded for a character in 類林, with all its words for hover.
 * @param {[string, number][] | undefined} words
 */
export function hanGloss(words) {
  return { text: words?.[0]?.[0] ?? '', title: (words ?? []).map(([word]) => word).join('、') }
}

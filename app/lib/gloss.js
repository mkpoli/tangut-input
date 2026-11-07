/** @param {import('./data.js').Definitions | undefined} definitions @param {string | undefined} downes */
export function englishGloss(definitions, downes) {
  const first = definitions?.en?.[0] ?? downes ?? definitions?.zh?.[0] ?? ''
  return first.split(/[;,]/)[0].trim()
}

/**
 * A Chinese dictionary sense, falling back to the commonest contextual word in 類林.
 * @param {[string, number][] | undefined} words
 * @param {string[]} [definitions]
 */
export function hanGloss(words, definitions) {
  const senses = definitions?.filter(text => text.trim()) ?? []
  if (senses.length) return {
    text: senses[0].split(/[;,；，、。]/)[0].trim(),
    title: senses.join('；'),
    source: 'wiktionary',
  }
  return { text: words?.[0]?.[0] ?? '', title: (words ?? []).map(([word]) => word).join('、'), source: 'leilin' }
}

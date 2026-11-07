/** @param {import('./data.js').Definitions | undefined} definitions @param {string | undefined} downes @param {string[]} [wiktionary] */
export function englishGloss(definitions, downes, wiktionary = []) {
  const first = definitions?.en?.[0] ?? downes ?? definitions?.zh?.[0] ?? wiktionary[0] ?? ''
  return first.split(/[;,]/)[0].trim()
}

/**
 * A Chinese dictionary sense, then a Chinese Wiktionary sense, then the commonest contextual word
 * in 類林. @param {[string, number][] | undefined} words
 * @param {string[]} [keyed] Chinese meanings keyed from the editions
 * @param {string[]} [wiktionary] Chinese Wiktionary senses
 */
export function hanGloss(words, keyed, wiktionary) {
  const senses = keyed?.filter(text => text.trim()) ?? []
  if (senses.length) return {
    text: senses[0].split(/[;,；，、。]/)[0].trim(),
    title: senses.join('；'),
    source: 'keyed',
  }
  const imported = wiktionary?.filter(text => text.trim()) ?? []
  if (imported.length) return {
    text: imported[0].split(/[;,；，、。]/)[0].trim(),
    title: imported.join('；'),
    source: 'wiktionary',
  }
  return { text: words?.[0]?.[0] ?? '', title: (words ?? []).map(([word]) => word).join('、'), source: 'leilin' }
}

/** @param {import('./data.js').Definitions | undefined} definitions @param {string | undefined} downes @param {string[]} [wiktionary] */
export function englishGloss(definitions, downes, wiktionary = []) {
  const first = definitions?.en?.[0] ?? downes ?? definitions?.zh?.[0] ?? wiktionary[0] ?? ''
  return first.split(/[;,]/)[0].trim()
}

const HAN = /\p{Script=Han}/u

/**
 * A Chinese dictionary sense, then a Chinese Wiktionary sense, then the commonest contextual word
 * in 類林. A sense with no Han character is a grammatical label or a placeholder, not a Chinese
 * gloss, so it never becomes the visible text; the full list stays in the title and on the card.
 * @param {[string, number][] | undefined} words
 * @param {string[]} [keyed] Chinese meanings keyed from the editions
 * @param {string[]} [wiktionary] Chinese Wiktionary senses
 */
export function hanGloss(words, keyed, wiktionary) {
  const senses = keyed?.filter(text => text.trim()) ?? []
  const keyedText = senses.find(text => HAN.test(text))
  if (keyedText) return {
    text: keyedText.split(/[;,；，、。]/)[0].trim(),
    title: senses.join('；'),
    source: 'keyed',
  }
  const imported = wiktionary?.filter(text => text.trim()) ?? []
  const importedText = imported.find(text => HAN.test(text))
  if (importedText) return {
    text: importedText.split(/[;,；，、。]/)[0].trim(),
    title: imported.join('；'),
    source: 'wiktionary',
  }
  const records = words ?? []
  const leilinText = records.find(([word]) => HAN.test(word))
  return {
    text: leilinText ? leilinText[0] : '',
    title: records.map(([word]) => word).join('、'),
    source: 'leilin',
  }
}

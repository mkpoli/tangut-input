/** @param {import('./data.js').Definitions | undefined} definitions @param {string | undefined} downes @param {string[]} [wiktionary] */
export function englishGloss(definitions, downes, wiktionary = []) {
  const first = definitions?.en?.[0] ?? downes ?? definitions?.zh?.[0] ?? wiktionary[0] ?? ''
  return first.split(/[;,]/)[0].trim()
}

const HAN = /\p{Script=Han}/u
const SEPARATOR = /[;,；，、。]/

/** The first segment of a sense that is written in Han, or nothing. @param {string} sense */
function firstHanSegment(sense) {
  for (const part of sense.split(SEPARATOR)) {
    const text = part.trim()
    if (text && HAN.test(text)) return text
  }
  return ''
}

/**
 * A Chinese dictionary sense, then a Chinese Wiktionary sense, then the commonest contextual word
 * in 類林. A segment with no Han character is a grammatical label or a placeholder, not a Chinese
 * gloss, so it never becomes the visible text; the card keeps the full record.
 * @param {[string, number][] | undefined} words
 * @param {string[]} [keyed] Chinese meanings keyed from the editions
 * @param {string[]} [wiktionary] Chinese Wiktionary senses
 */
export function hanGloss(words, keyed, wiktionary) {
  const senses = keyed?.filter(text => text.trim()) ?? []
  const keyedText = senses.map(firstHanSegment).find(Boolean)
  if (keyedText) return {
    text: keyedText,
    title: senses.join('；'),
    source: 'keyed',
  }
  const imported = wiktionary?.filter(text => text.trim()) ?? []
  const importedText = imported.map(firstHanSegment).find(Boolean)
  if (importedText) return {
    text: importedText,
    title: imported.join('；'),
    source: 'wiktionary',
  }
  const records = words ?? []
  const leilinText = records.map(([word]) => firstHanSegment(word)).find(Boolean)
  return {
    text: leilinText ?? '',
    title: records.map(([word]) => word).join('、'),
    source: 'leilin',
  }
}

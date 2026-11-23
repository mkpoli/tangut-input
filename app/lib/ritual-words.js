// The words an ode says twice: once in the unusual vocabulary Kepping called the ritual language,
// once in the ordinary one. Each pair names the source that sets the two side by side.
import WORDS from '../data/tangut-ritual-words.json' with { type: 'json' }

/** @typedef {{ id: string, author: string, title: string, where: string, date: string, url: string,
 *   retrieved: string, licence: string, note: string }} RitualSource */
/** @typedef {{ kind: string, gloss: string, ritual: string, common: string, source: string }} RitualWord */

/** @type {RitualSource[]} */
export const RITUAL_SOURCES = WORDS.sources
/** @type {RitualWord[]} */
export const RITUAL_WORDS = WORDS.words

/** @type {Map<string, RitualWord[]>} */
const byChar = new Map()
for (const word of RITUAL_WORDS) {
  for (const char of new Set([...word.ritual, ...word.common])) {
    const list = byChar.get(char)
    if (list) list.push(word)
    else byChar.set(char, [word])
  }
}

/** The pairs a character is written in, on either side, in the order the data gives them. @param {string} char */
export const ritualWords = char => byChar.get(char) ?? []

// What part of speech a character's Chinese gloss says it is. Open Tangut's glosses mark it inside
// the definition — 「吮、唼 動詞」, 「撮（動詞）」 — so it can be read off. The marks are the source's,
// not a classification of this project's own, and many entries carry none.

/** The words the glosses use for each part of speech. @type {{ key: string, zh: string }[]} */
export const POS = [
  { key: 'noun', zh: '名詞' },
  { key: 'verb', zh: '動詞' },
  { key: 'adjective', zh: '形容詞' },
  { key: 'adverb', zh: '副詞' },
  { key: 'numeral', zh: '數詞' },
  { key: 'pronoun', zh: '代詞' },
  { key: 'classifier', zh: '量詞' },
  { key: 'particle', zh: '助詞' },
  { key: 'preposition', zh: '介詞' },
  { key: 'conjunction', zh: '連詞' },
  { key: 'interjection', zh: '嘆詞' },
  { key: 'copula', zh: '係詞' },
]

/** A loanword is not a part of speech, but the glosses mark it the same way and readers look for it. */
export const LOANWORD = { key: 'loanword', zh: '漢語借詞' }

/** A marked word stands alone between punctuation or spaces, never inside another word. */
const boundary = '\\s、，,；;。：:()（）「」'
/** @param {string} word */
const pattern = word => new RegExp(`(?:^|[${boundary}])${word}(?=$|[${boundary}])`)

/**
 * The parts of speech a character's Chinese gloss marks, as keys of `POS`, with `loanword` when the
 * gloss says it is one. @param {string[] | undefined} definitions the `zh` senses
 * @returns {string[]}
 */
export function partsOfSpeech(definitions) {
  if (!definitions?.length) return []
  const text = definitions.join(' ')
  const found = []
  for (const entry of [...POS, LOANWORD]) {
    if (pattern(entry.zh).test(text)) found.push(entry.key)
  }
  return found
}

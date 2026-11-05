import { expect, test } from 'bun:test'
import en from '../messages/en.json' with { type: 'json' }
import ja from '../messages/ja.json' with { type: 'json' }
import ko from '../messages/ko.json' with { type: 'json' }
import zhHans from '../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../messages/zh-Hant.json' with { type: 'json' }

const CATALOGUES = { en, ja, ko, 'zh-Hans': zhHans, 'zh-Hant': zhHant }
const TERMINATOR = /[。！？]|[.!?](?=\s|$)/g

/** @param {string} text */
const sentences = text => (text.replace(/<[^>]*>/g, '').match(TERMINATOR) ?? []).length

test('every page introduction stays within three sentences', () => {
  const over = []
  for (const [locale, messages] of Object.entries(CATALOGUES)) {
    for (const [key, text] of Object.entries(messages)) {
      if (key === 'nav.intro' || !key.endsWith('.intro')) continue
      const count = sentences(text)
      if (count > 3) over.push(`${locale} ${key}: ${count}`)
    }
  }
  expect(over).toEqual([])
})

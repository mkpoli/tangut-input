import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import WORDS from '../app/data/tangut-ritual-words.json' with { type: 'json' }
import { ritualWords } from '../app/lib/ritual-words.js'

const ROOT = new URL('..', import.meta.url)
const read = (/** @type {string} */ path) => JSON.parse(gunzipSync(readFileSync(new URL(path, ROOT))).toString())

test('every pair names a recorded source and two forms', () => {
  const sources = new Set(WORDS.sources.map(source => source.id))
  expect(WORDS.words.length).toBe(19)
  for (const word of WORDS.words) {
    expect(sources.has(word.source)).toBe(true)
    expect(word.ritual).not.toBe(word.common)
    expect([...word.ritual].length).toBeGreaterThan(0)
    expect([...word.common].length).toBeGreaterThan(0)
  }
  for (const source of WORDS.sources) expect(source.url).toStartWith('https://')
})

test('every character is one the site knows', () => {
  const known = new Set(read('app/data/tangut-entries.json.gz').rows.map((/** @type {any[]} */ row) => row[0]))
  for (const word of WORDS.words) for (const char of word.ritual + word.common) expect(known.has(char)).toBe(true)
})

test('each month name opens its verse of the ode in the matching version', () => {
  const lines = Object.entries(read('app/data/tangut-attestation.json.gz').lines)
    .filter(([id]) => id.startsWith('wikisource-monthly-pleasures:'))
    .map(([, line]) => /** @type {{ text: string, section?: string }} */ (line))
  const months = WORDS.words.filter(word => word.kind === 'month')
  expect(months.length).toBe(12)
  months.forEach((word, i) => {
    const verse = new RegExp(`^${i + 1}(st|nd|rd|th) month, `)
    const opening = (/** @type {string} */ text, /** @type {string} */ form) =>
      lines.filter(line => verse.test(line.section ?? '') && line.section?.endsWith(form) && line.text.startsWith(text)).length
    expect(opening(word.ritual, 'ritual language')).toBe(1)
    expect(opening(word.common, 'common language')).toBe(1)
  })
})

test('a character finds its pairs from either side', () => {
  expect(ritualWords('𘘞').length).toBe(13)
  expect(ritualWords('𗒹').map(word => word.gloss)).toEqual(['seven', 'seventh lunar month'])
  expect(ritualWords('𗘎').map(word => word.gloss)).toEqual(['seven', 'seventh lunar month'])
  expect(ritualWords('𗴂')).toEqual([])
})

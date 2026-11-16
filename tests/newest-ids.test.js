// Descriptions for the eight ideographs Unicode 18.0.0 puts at the end of the Tangut block, which
// BabelStone's table does not reach.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readDescription } from '../app/lib/composition.js'

const newest = JSON.parse(readFileSync(new URL('../app/data/tangut-newest-ids.json', import.meta.url)))
const entries = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
const stroked = JSON.parse(gunzipSync(readFileSync(new URL('../data/tangut-strokes.json.gz', import.meta.url))).toString())['values']
const recorded = new Set(entries.rows.map(row => row[0]))

test('the file holds the eight newest ideographs', () => {
  const points = Object.keys(newest.characters).map(char => char.codePointAt(0)).sort((a, b) => a - b)
  expect(points).toEqual(Array.from({ length: 8 }, (_, index) => 0x187F8 + index))
  for (const char of Object.keys(newest.characters)) expect(recorded.has(char)).toBe(true)
})

test('every description reads as complete trees of Tangut characters', () => {
  for (const [char, text] of Object.entries(newest.characters)) {
    const reading = readDescription(text)
    expect(reading.complete).toBe(true)
    for (const part of text) {
      if ('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻'.includes(part)) continue
      const point = part.codePointAt(0) ?? 0
      expect(point >= 0x17000 && point <= 0x18AFF || point >= 0x18D00 && point <= 0x18DFF).toBe(true)
    }
  }
})

test('every described character has a stroke count', () => {
  for (const char of Object.keys(newest.characters)) expect(stroked[char]).toBeGreaterThan(0)
})

test('the file names the table it transcribes', () => {
  expect(newest.format).toBe('tangut-input/newest-ids')
  expect(newest.source.author).toBe('Andrew West')
  expect(newest.source.url).toBe('https://www.unicode.org/wg2/docs/n5217r2-Tangut-components-ideographs.pdf')
})

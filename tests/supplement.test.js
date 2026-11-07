// The two Tangut supplement blocks: every character Unicode 18.0.0 assigns there, with the fields
// the sources give and the descriptions the parser must read whole.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readDescription } from '../app/lib/composition.js'

const json = name => JSON.parse(gunzipSync(readFileSync(new URL(`../app/data/${name}`, import.meta.url))).toString())
const supplement = json('tangut-supplement.json.gz')
const codes = json('tangut-cangjie.json.gz')
const recorded = new Map()
for (const [char, code] of codes) recorded.set(char, (recorded.get(char) ?? new Set()).add(code))

test('the file collects the whole of both supplement blocks', () => {
  const ideographs = supplement.characters.filter(record => record.block === 'supplement')
  const components = supplement.characters.filter(record => record.block === 'components')
  expect(ideographs.map(record => record.char.codePointAt(0))).toEqual(
    Array.from({ length: 33 }, (_, index) => 0x18D00 + index),
  )
  expect(components.map(record => record.char.codePointAt(0))).toEqual(
    Array.from({ length: 115 }, (_, index) => 0x18D80 + index),
  )
  expect(supplement.counts).toEqual({
    characters: 148, ideographs: 33, components: 115, descriptions: 33, strokes: 148, cangjie: 146,
  })
})

test('each record carries the fields its source gives', () => {
  for (const record of supplement.characters) {
    expect(record.name).toMatch(/^TANGUT (COMPONENT|IDEOGRAPH)-\w+$/)
    expect(record.strokes).toBeGreaterThan(0)
    expect(['Noto Serif Tangut 2.168', 'Tangut N4694']).toContain(record.glyph)
    expect(record.cangjie.every(code => recorded.get(record.char)?.has(code))).toBe(true)
    if (record.block === 'supplement') {
      expect(record.radicalStrokes).toMatch(/^\d+\.\d+$/)
      expect([...record.radical]).toHaveLength(1)
      expect(record.source).toMatch(/^(L2008|N5217|N5314|H2021)-\w+$/)
    } else {
      expect(record.component).toBeGreaterThanOrEqual(769)
      expect(record.component).toBeLessThanOrEqual(883)
    }
  }
})

test('every description reads as complete trees of Tangut characters', () => {
  const described = supplement.characters.filter(record => record.ids)
  expect(described).toHaveLength(33)
  for (const record of described) {
    const reading = readDescription(record.ids)
    expect(reading.complete).toBe(true)
    expect(reading.roots.length).toBeGreaterThan(0)
    for (const char of record.ids) {
      if ('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻'.includes(char)) continue
      const point = char.codePointAt(0) ?? 0
      expect(point >= 0x17000 && point <= 0x18AFF || point >= 0x18D00 && point <= 0x18DFF).toBe(true)
    }
  }
})

test('the two newest ideographs have no Cangjie code', () => {
  const missing = supplement.characters.filter(record => !record.cangjie.length).map(record => record.char)
  expect(missing).toEqual([String.fromCodePoint(0x18D1F), String.fromCodePoint(0x18D20)])
})

test('the four latest ideographs take their descriptions from their own proposals', () => {
  const sources = new Map(supplement.characters.filter(record => record.idsSource).map(record => [record.char, record.idsSource]))
  expect(sources.get(String.fromCodePoint(0x18D1D))).toBe('N5286')
  expect(sources.get(String.fromCodePoint(0x18D1E))).toBe('N5286')
  expect(sources.get(String.fromCodePoint(0x18D1F))).toBe('N5303')
  expect(sources.get(String.fromCodePoint(0x18D20))).toBe('N5314')
})

test('the file cites every source it drew on', () => {
  expect(supplement.sources.map(source => source.id)).toEqual([
    'unicode', 'tangut-sources', 'babelstone-ids', 'n5217', 'n5286', 'n5303', 'n5314', 'names-list', 'rime', 'n4694',
  ])
  for (const source of supplement.sources) expect(source.url.startsWith('https://')).toBe(true)
  expect(supplement.sources.find(source => source.id === 'rime').commit).toHaveLength(40)
})

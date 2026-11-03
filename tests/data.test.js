// The data files the site ships, checked against numbers taken from their sources. A builder or a
// re-pack that changes the content should fail here before it reaches the site.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { hanFanqie, sounds } from '../app/lib/fanqie.js'

const json = name => JSON.parse(gunzipSync(readFileSync(new URL(`../app/data/${name}`, import.meta.url))).toString())
const entries = json('tangut-entries.json.gz')
const rhymes = json('tangut-rhymes.json.gz')

/** The packed records, expanded just enough for the fanqie parse. */
const expanded = entries.rows.map(row => {
  /** @type {Record<string, string>} */
  const pronunciations = {}
  entries.systems.forEach((key, i) => { if (row[7]?.[i]) pronunciations[key] = row[7][i] })
  return { char: row[0], pronunciations }
})

test('the packed records keep every character and its languages', () => {
  expect(entries.format).toBe('tangut-input/entries')
  expect(entries.rows.length).toBe(6144)
  expect(entries.systems.length).toBe(10)
  const first = expanded[0]
  expect(first.char).toBe('𗀀')
  expect(first.pronunciations.li_fanwen).toBe('do1')
})

test('the Chinese fanqie parse is the one the chart draws', () => {
  const records = hanFanqie(expanded)
  expect(records.length).toBe(3816)
  const bySound = sounds(records)
  expect(bySound.size).toBe(1433)
  const several = [...bySound.values()].filter(group => group.spellings.size > 1).length
  expect(several).toBe(504)
  expect(bySound.get('勒').spellings.size).toBe(20)
})

test('a rounding marker is not one of the two characters', () => {
  const records = hanFanqie(expanded)
  const rounded = records.find(record => record.char === '𗅶')
  // 「底合卒切」: 底 with 合 marking the rounding, spelt with 卒.
  expect(rounded.upper).toBe('底')
  expect(rounded.lower).toBe('卒')
  expect(rounded.round).toBe(true)
  expect(records.filter(record => record.round).length).toBe(21)
})

test('every character with a rhyme is a character the site knows', () => {
  const known = new Set(entries.rows.map(row => row[0]))
  const missing = Object.keys(rhymes.chars).filter(char => !known.has(char))
  // The nine ideographs of U+18D00–18D08 are newer than the records the entries are built from.
  expect(missing.sort()).toEqual(['𘴀', '𘴁', '𘴂', '𘴃', '𘴄', '𘴅', '𘴆', '𘴇', '𘴈'])
  expect(missing.every(char => (char.codePointAt(0) ?? 0) >= 0x18d00 && (char.codePointAt(0) ?? 0) <= 0x18d08)).toBe(true)
})

test('the rhyme record keeps the fields the card and the chart read', () => {
  expect(rhymes.columns).toEqual(['rhyme', 'tone', 'group', 'upper', 'lower', 'upperB', 'lowerB'])
  const value = rhymes.chars['𗀀']
  expect(value[0]).toBe(51)
  expect(value[1]).toBe(1)
  expect(value[3]).toBe('𗃦')
  expect(value[4]).toBe('𗏟')
})

const attestation = json('tangut-attestation.json.gz')

test('the attestation joins the edition and the five Wikisource texts', () => {
  expect(attestation.corpus).toEqual({
    lines: 321,
    characters: 11168,
    distinct: 967,
    sources: 6,
    sha256: '7a79caf2bdf3fa48aea60dbd0e243965c50d22ea341810812ffa3248069d9f1b',
  })
  expect(attestation.sources.map(source => source.id)).toEqual([
    'solonin-2024',
    'wikisource-dragon-king',
    'wikisource-high-king',
    'wikisource-diamond',
    'wikisource-twenty-five-questions',
    'wikisource-dharani',
  ])
  expect(attestation.sources.every(source => source.url && source.licence)).toBe(true)
  expect(attestation.sources[0].facsimile).toContain('/facsimile/solonin-2024/')
  expect(attestation.sources.slice(1).every(source => source.kind === 'transcription' && source.revision)).toBe(true)
})

test('every place points at the character it attests', () => {
  const sources = new Set(attestation.sources.map(source => source.id))
  for (const [char, bySource] of Object.entries(attestation.rows)) {
    for (const [source, places] of Object.entries(bySource)) {
      expect(sources.has(source)).toBe(true)
      for (const [line, position] of places) {
        const text = attestation.lines[line]
        expect(text).toBeDefined()
        expect([...text.text][position - 1]).toBe(char)
      }
    }
  }
})

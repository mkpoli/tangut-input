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
  expect(records.length).toBe(3697)
  const bySound = sounds(records)
  expect(bySound.size).toBe(1425)
  const several = [...bySound.values()].filter(group => group.spellings.size > 1).length
  expect(several).toBe(492)
  expect(bySound.get('勒').spellings.size).toBe(20)
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

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

test('the attestation joins the edition and the twelve Wikisource texts', () => {
  expect(attestation.corpus).toEqual({
    lines: 1305,
    characters: 24280,
    distinct: 2665,
    sources: 13,
    sha256: '675699a6d2d7663431ba4f3504c85f61caef6f8b3eaba51bf00dc2b3f6fb2860',
  })
  expect(attestation.sources.map(source => source.id)).toEqual([
    'solonin-2024',
    'wikisource-dragon-king',
    'wikisource-high-king',
    'wikisource-diamond',
    'wikisource-twenty-five-questions',
    'wikisource-dharani',
    'wikisource-hymn-origin',
    'wikisource-grains-of-gold',
    'wikisource-monthly-pleasures',
    'wikisource-leilin',
    'wikisource-liangzhou-stele',
    'wikisource-dual-maxims',
    'wikisource-tongyin-preface',
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

const samples = JSON.parse(readFileSync(new URL('../app/data/tangut-samples.json', import.meta.url)).toString())

test('the sample passages are exact lines from the attestation', () => {
  expect(samples.samples.length).toBe(13)
  expect(samples.samples.filter(sample => sample.famous).length).toBe(9)
  const sourceIds = new Set(attestation.sources.map(source => source.id))
  for (const sample of samples.samples) {
    expect(sourceIds.has(sample.sourceId)).toBe(true)
    expect(sample.licence).toBe(attestation.sources.find(source => source.id === sample.sourceId)?.licence)
    expect(sample.text).toBe(sample.lineIds.map(line => attestation.lines[line].text).join('\n'))
  }
})

const glossWords = gunzipSync(readFileSync(new URL('../data/tangut-gloss-words.tsv.gz', import.meta.url)))
  .toString().split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('\t'))

test('the gloss word table names every character once', () => {
  expect(glossWords.length).toBe(6144)
  expect(new Set(glossWords.map(row => row[0]))).toEqual(new Set(entries.rows.map(row => row[0])))
  const tiers = {}
  for (const [, , tier] of glossWords) tiers[tier] = (tiers[tier] ?? 0) + 1
  expect(tiers).toEqual({ word: 3117, phrase: 2053, transliteration: 728, long: 162, empty: 61, redirect: 23 })
  const glossOf = char => glossWords.find(row => row[0] === char)
  expect(glossOf('𗢳')).toEqual(['𗢳', '佛', 'word', 'tha̱1'])
  expect(glossOf('𘋢').slice(0, 3)).toEqual(['𘋢', '菩薩', 'phrase'])
  expect(glossOf('𗍏')[2]).toBe('transliteration')
  // A bracket later in the entry does not make the first sense a transliteration.
  expect(glossOf('𗓭').slice(0, 3)).toEqual(['𗓭', '富', 'word'])
  // A bracketed note stays as it is and is left for an editor, rather than guessed into a word.
  expect(glossOf('𗁋').slice(0, 3)).toEqual(['𗁋', '（滴）答', 'long'])
  expect(glossOf('𗠏').slice(0, 3)).toEqual(['𗠏', '（喉嚨）咽喉', 'long'])
  // An ASCII note before the word explains the word and is dropped.
  expect(glossOf('𗈒')).toEqual(['𗈒', '肘', 'word', 'rkiwr2'])
  expect(glossOf('𗘓')[2]).toBe('long')
})

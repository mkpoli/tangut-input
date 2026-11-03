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

test('the attestation joins the edition, the twelve Wikisource texts and the Lausanne corpus', () => {
  expect(attestation.corpus).toEqual({
    lines: 5273,
    characters: 92509,
    distinct: 3350,
    sources: 14,
    sha256: '5312f92bf9751cf88e4ef8c4306a5f4a7be4c94690f58da4eba1d88323623017',
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
    'lcdtt',
  ])
  expect(attestation.sources.every(source => source.url && source.licence)).toBe(true)
  expect(attestation.sources[0].facsimile).toContain('/facsimile/solonin-2024/')
  expect(attestation.sources.slice(1).every(source => source.kind === 'transcription' && (source.revision || source.commit))).toBe(true)
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
  expect(samples.samples.length).toBe(18)
  expect(samples.samples.filter(sample => sample.famous).length).toBe(13)
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

const glossReadings = gunzipSync(readFileSync(new URL('../data/tangut-gloss-readings.tsv.gz', import.meta.url)))
  .toString().split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('\t'))

test('the gloss readings cover the one-character words', () => {
  const words = glossWords.filter(row => row[2] === 'word').map(row => row[0])
  expect(glossReadings.length).toBe(3117)
  expect(glossReadings.map(row => row[0])).toEqual(words.sort((a, b) => a.codePointAt(0) - b.codePointAt(0)))
  // Every reading of the gloss is kept, in KANJIDIC2's order and its pinyin tone numbers, except
  // bound forms, which the source marks with a hyphen at either end.
  expect(glossReadings.filter(row => row[2]).length).toBe(3068)
  expect(glossReadings.filter(row => row[3]).length).toBe(3063)
  expect(glossReadings.filter(row => row[4]).length).toBe(2801)
  const readingOf = char => glossReadings.find(row => row[0] === char)
  expect(readingOf('𗢳')).toEqual(['𗢳', '佛', 'fo2 fu2', 'ブツ フツ', 'ほとけ'])
  expect(readingOf('𘛛')).toEqual(['𘛛', '日', 'ri4', 'ニチ ジツ', 'ひ'])
  // An okurigana stem keeps its dot; a hyphenated suffix reading is left out.
  expect(readingOf('𗄖')).toEqual(['𗄖', '行', 'xing2 hang2 hang4 xing4', 'コウ ギョウ アン', 'い.く ゆ.く おこな.う おこ.なう'])
  // 毒 is read in Sino-Japanese only, so its kun reading is empty rather than guessed.
  expect(readingOf('𗀀')).toEqual(['𗀀', '毒', 'du2', 'ドク', ''])
  // 上 keeps its standalone kun readings and drops the うわ- bound form.
  expect(readingOf('𗥁')[4]).toBe('うえ かみ あ.げる あ.がる あ.がり のぼ.る のぼ.り のぼ.せる のぼ.す たてまつ.る')
  // A character KANJIDIC2 does not carry keeps empty columns.
  expect(readingOf('𗐭')).toEqual(['𗐭', '說', '', '', ''])
})

const frequency = json('tangut-frequency.json.gz')

test('the frequency table counts every place in the corpus', () => {
  expect(frequency.corpus).toEqual({
    lines: 5273,
    characters: 92509,
    distinct: 3350,
    sha256: '5312f92bf9751cf88e4ef8c4306a5f4a7be4c94690f58da4eba1d88323623017',
  })
  expect(Object.keys(frequency.counts).length).toBe(3350)
  expect(Object.values(frequency.counts).reduce((sum, count) => sum + count, 0)).toBe(92509)
  expect(frequency.counts['𗋕']).toBe(711)
})

const readPage = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-gloss-readings.json.gz', import.meta.url))).toString())

test('the read page has a word and its readings for every character that carries one', () => {
  expect(readPage.format).toBe('tangut-input/gloss-readings')
  const rows = readPage.rows
  expect(Object.keys(rows).length).toBe(5170)
  expect(rows['𗢳']).toEqual(['佛', 'ブツ', 'ほとけ'])
  expect(rows['𗀀']).toEqual(['毒', 'ドク', ''])
  // A phrase gloss has a word and no single reading.
  expect(rows['𘋢']).toEqual(['菩薩', '', ''])
  // A transliteration and a description have no word to read, so the page file leaves them out.
  expect(rows['𗍏']).toBeUndefined()
  expect(rows['𗧓']).toBeUndefined()
  const known = new Set(entries.rows.map(row => row[0]))
  expect(Object.keys(rows).every(char => known.has(char))).toBe(true)
})

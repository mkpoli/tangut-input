// The 對音 the card shows: the 掌中珠's Chinese transcription of a Tangut character, and the
// Tibetan glosses of the five British Library manuscripts. The join rules are exercised on fixtures
// because the keyed tables are still empty; the shipped file is checked for the shape the card reads.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { pairZzz, parseTsv } from '../scripts/build_tangut_zzz.mjs'
import { hasCardReadings } from '../app/lib/card-readings.js'
import { tibetanShown, tibetanWhere } from '../app/lib/tibetan.js'

const read = name => JSON.parse(readFileSync(new URL(`../app/data/${name}`, import.meta.url), 'utf8'))
const zzz = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-zzz.json.gz', import.meta.url))).toString())
const tibetan = read('tangut-tibetan.json')

const isTangut = char => /^[\u{17000}-\u{187FF}\u{18800}-\u{18AFF}\u{18D00}-\u{18D7F}]$/u.test(char)
const isHan = char => /^[\u{3400}-\u{4DBF}\u{4E00}-\u{9FFF}\u{F900}-\u{FAFF}\u{20000}-\u{2FA1F}\u{30000}-\u{323AF}]$/u.test(char)

const entry = id => ({ entry_id: id })
const cell = (entry_id, position, role, glyph, status = 'ok', glyph_norm = '') =>
  ({ entry_id, position: String(position), role, glyph, glyph_norm, status })

test('a pair is published for every aligned ok position', () => {
  const { pairs, counts, problems } = pairZzz(
    [entry('a'), entry('b')],
    [
      cell('a', 1, 'tangut', '𗄈'), cell('a', 1, 'transcription', '叔'),
      cell('a', 2, 'tangut', '𗍍'), cell('a', 2, 'transcription', '天'),
      cell('b', 1, 'tangut', '𗄈'), cell('b', 1, 'transcription', '毒'),
    ],
  )
  expect(problems).toEqual([])
  expect(counts).toMatchObject({ entries: 2, keyedEntries: 2, paired: 3, characters: 2 })
  expect(pairs['𗄈']).toEqual([{ text: '叔', entry: 'a' }, { text: '毒', entry: 'b' }])
  expect(pairs['𗍍']).toEqual([{ text: '天', entry: 'a' }])
})

test('the four non-ok statuses keep separate counts', () => {
  const { pairs, counts } = pairZzz(
    [entry('a'), entry('b'), entry('c'), entry('d')],
    [
      cell('a', 1, 'tangut', '𗄈'), cell('a', 1, 'transcription', '叔', 'uncertain'),
      cell('b', 1, 'tangut', '𗄈'), cell('b', 1, 'transcription', '叔', 'illegible'),
      cell('c', 1, 'tangut', '𗄈'), cell('c', 1, 'transcription', '叔', 'absent'),
      cell('d', 1, 'tangut', '𗄈'), cell('d', 1, 'transcription', ''),
    ],
  )
  expect(pairs).toEqual({})
  expect(counts).toMatchObject({ paired: 0, uncertainCells: 1, illegibleCells: 1, absentCells: 1, emptyCells: 1 })
})

test('an unfinished column is incomplete, an unequal one is a finding', () => {
  const { counts } = pairZzz(
    [entry('a'), entry('b'), entry('c'), entry('d'), entry('e')],
    [
      cell('a', 1, 'tangut', '𗄈'),
      cell('b', 1, 'transcription', '叔'),
      cell('c', 1, 'tangut', '𗄈'), cell('c', 2, 'tangut', '𗍍'), cell('c', 1, 'transcription', '叔'),
      cell('d', 1, 'tangut', '𗄈'), cell('d', 2, 'tangut', '𗍍'),
      cell('d', 2, 'transcription', '叔'), cell('d', 3, 'transcription', '天'),
      cell('e', 1, 'tangut', '𗄈'), cell('e', 1, 'transcription', '叔'),
    ],
  )
  expect(counts).toMatchObject({ paired: 1, incompleteEntries: 2, unpairedEntries: 2 })
})

test('the transcription is the printed character, the key the normalized one', () => {
  const { pairs, problems } = pairZzz(
    [entry('a')],
    [cell('a', 1, 'tangut', '𗄈', 'ok', '𗍍'), cell('a', 1, 'transcription', '叔', 'ok', '毒')],
  )
  expect(problems).toEqual([])
  expect(pairs).toEqual({ '𗍍': [{ text: '叔', entry: 'a' }] })
})

test('a wrong script, an unknown entry or an unknown status is a problem', () => {
  const { problems } = pairZzz(
    [entry('a'), entry('d'), entry('c')],
    [
      cell('a', 1, 'tangut', 'a'), cell('a', 1, 'transcription', '叔'),
      cell('d', 1, 'tangut', '𗄈'), cell('d', 1, 'transcription', 'ab'),
      cell('b', 1, 'tangut', '𗄈'), cell('b', 1, 'transcription', '叔'),
      cell('c', 1, 'tangut', '𗄈', 'maybe'), cell('c', 1, 'transcription', '叔'),
    ],
  )
  expect(problems.some(problem => problem.includes('not one Tangut character'))).toBe(true)
  expect(problems.some(problem => problem.includes('not one Han character'))).toBe(true)
  expect(problems.some(problem => problem.includes('not in entries.tsv'))).toBe(true)
  expect(problems.some(problem => problem.includes('maybe'))).toBe(true)
})

test('the shipped join has every count and one Han character per pair', () => {
  expect(zzz.format).toBe('tangut-input/zzz')
  expect(zzz.source.name).toBe('番漢合時掌中珠')
  expect(zzz.source.date).toBe('1190')
  for (const key of ['entries', 'keyedEntries', 'paired', 'characters', 'unpairedEntries', 'incompleteEntries', 'uncertainCells', 'illegibleCells', 'absentCells', 'emptyCells']) {
    expect(typeof zzz.counts[key]).toBe('number')
  }
  expect(zzz.counts.characters).toBe(Object.keys(zzz.pairs).length)
  for (const [char, pairs] of Object.entries(zzz.pairs)) {
    expect(isTangut(char)).toBe(true)
    expect(pairs.length).toBeGreaterThan(0)
    for (const pair of pairs) {
      expect(isHan(pair.text)).toBe(true)
      expect(pair.entry).toMatch(/^zzz:/)
    }
  }
})

test('the tables parse as the builder reads them', () => {
  const entries = parseTsv(readFileSync(new URL('../data/zhangzhongzhu/entries.tsv', import.meta.url), 'utf8'))
  const cells = parseTsv(readFileSync(new URL('../data/zhangzhongzhu/cells.tsv', import.meta.url), 'utf8'))
  expect(Array.isArray(entries)).toBe(true)
  expect(Array.isArray(cells)).toBe(true)
})

test('Readings appears for each kind of evidence without a reconstruction', () => {
  const empty = { readings: [], rhymeClass: '', spelling: '', glosses: [] }
  expect(hasCardReadings(empty)).toBe(false)
  for (const evidence of [
    { readings: ['reading'] }, { rhymeClass: '1' }, { spelling: '𗄈𗍍' },
    { hands: { tibetan: [['B']] } }, { hands: { sanskrit: ['śo'] } },
    { glosses: tibetan.glosses['𗄈'] },
  ]) expect(hasCardReadings({ ...empty, ...evidence })).toBe(true)
  expect(hasCardReadings({ ...empty, hands: { tibetan: [], sanskrit: [] } })).toBe(false)
})

test('a manuscript gloss keeps its script, Wylie and manuscript counts', () => {
  const [wylie, script, where] = tibetan.glosses['𗄈'][0]
  expect(tibetanShown(wylie, script)).toBe('ཤོ')
  expect(wylie).toBe('sho')
  expect(tibetanWhere(where)).toBe('Or.12380/1842 ×1')
  expect(tibetanShown('a[?]', 'ི')).toBe('◌ི?')
})

test('the Tibetan glosses carry a Wylie reading, a script spelling and a manuscript', () => {
  expect(tibetan.format).toBe('tangut-input/tibetan')
  expect(tibetan.glosses['𗄈']).toEqual([['sho', 'ཤོ', [['Or.12380/1842', 1]]]])
  for (const [char, glosses] of Object.entries(tibetan.glosses)) {
    expect(isTangut(char)).toBe(true)
    for (const [wylie, script, where] of glosses) {
      expect(wylie.length).toBeGreaterThan(0)
      expect(script.length).toBeGreaterThan(0)
      expect(where.length).toBeGreaterThan(0)
      for (const [shelf, count] of where) {
        expect(shelf).toMatch(/^Or\.12380\//)
        expect(count).toBeGreaterThan(0)
      }
    }
  }
})

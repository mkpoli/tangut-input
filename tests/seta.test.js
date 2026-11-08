// Tibetan Extension-A codes: the mapping table, the code a spelling has, the search key, and the
// coverage of the two Tibetan sources.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { setaCode, indexTibetanSeta, parseSetaQuery, byTibetanSeta } from '../app/lib/seta.js'
import { foldScript } from '../app/lib/tibetan.js'

const read = (name, gz = false) => {
  const bytes = readFileSync(new URL(`../app/data/${name}`, import.meta.url))
  return JSON.parse((gz ? gunzipSync(bytes) : bytes).toString())
}
const seta = read('tangut-tibetan-seta.json.gz', true)
const map = new Map(seta.map.map(([code, script]) => [foldScript(script), code]))

test('the shipped table is the 1,536 Tibetan Extension-A characters', () => {
  expect(seta.format).toBe('tangut-input/tibetan-seta')
  expect(seta.standard).toContain('Tibetan Extension-A')
  expect(seta.retrieved).toBe('2026-11-08')
  expect(seta.source).toMatch(/^http:\/\/web\.archive\.org\//)
  expect(seta.sha256).toMatch(/^[0-9a-f]{64}$/)
  expect(seta.map.length).toBe(1536)
  expect(new Set(seta.map.map(([code]) => code)).size).toBe(1536)
  for (const [code, script, sequence] of seta.map) {
    expect(code).toMatch(/^U\+F[3-8][0-9A-F]{2}$/)
    expect(script).toBe(String.fromCodePoint(...sequence.split(' ').map(part => parseInt(part, 16))))
    for (const char of script) expect(char.codePointAt(0)).toBeGreaterThanOrEqual(0x0f00)
    for (const char of script) expect(char.codePointAt(0)).toBeLessThanOrEqual(0x0fff)
  }
  expect(seta.map.find(([code]) => code === 'U+F5C0')[1]).toBe('ཤོ')
})

test('a spelling has a code only when the table has that exact sequence', () => {
  expect(setaCode(map, 'ཤོ')).toBe('U+F5C0')
  expect(setaCode(map, 'རྒི')).toBe('U+F375')
  for (const script of ['དཝི', 'གརུའ', 'ཀྷ', 'དགྷ', 'ཚྭི']) expect(setaCode(map, script)).toBe('')
})

test('a Set A query is read in the forms a reader can copy', () => {
  expect(parseSetaQuery('U+F5C0')).toBe('U+F5C0')
  expect(parseSetaQuery('u+f5c0')).toBe('U+F5C0')
  expect(parseSetaQuery('F5C0')).toBe('U+F5C0')
  expect(parseSetaQuery('SETA-F5C0')).toBe('U+F5C0')
  expect(parseSetaQuery('set a f5c0')).toBe('U+F5C0')
  expect(parseSetaQuery('extension-a U+F5C0')).toBe('U+F5C0')
  expect(parseSetaQuery('U+F2FF')).toBe('')
  expect(parseSetaQuery('U+17000')).toBe('')
  expect(parseSetaQuery('L0009')).toBe('')
})

test('the index names the characters whose spelling carries a code', () => {
  const glosses = new Map([
    ['𗄈', [['sho', 'ཤོ', [['Or.12380/1842', 1]]]]],
    ['𗀀', [['rgi', 'རྒི', [['Or.12380/3495', 2]]]]],
  ])
  const hands = { '𗍥': { tibetan: [['A', 'rgi', 3, 'རྒི', 'rgi', 'rɡi']] } }
  const index = indexTibetanSeta(map, glosses, hands)
  expect(byTibetanSeta(index, 'U+F5C0')).toEqual([{ char: '𗄈', code: 'U+F5C0', script: 'ཤོ' }])
  expect(byTibetanSeta(index, 'U+F375').map(hit => hit.char).sort()).toEqual(['𗀀', '𗍥'])
  expect(byTibetanSeta(index, 'U+F300')).toEqual([])
  expect(byTibetanSeta(index, 'ཤོ')).toEqual([])
})

test('the shipped sources reach 119 codes over 213 characters', () => {
  const glosses = new Map(Object.entries(read('tangut-tibetan.json').glosses))
  const hands = read('tangut-tibetan-hands.json').chars
  const index = indexTibetanSeta(map, glosses, hands)
  expect(index.size).toBe(119)
  expect(new Set([...index.values()].flatMap(chars => [...chars.keys()])).size).toBe(213)
  expect(byTibetanSeta(index, 'U+F5C0')).toEqual([{ char: '𗄈', code: 'U+F5C0', script: 'ཤོ' }])
  expect(byTibetanSeta(index, 'U+F375').length).toBeGreaterThan(0)
})

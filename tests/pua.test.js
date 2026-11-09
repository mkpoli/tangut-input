// Tangut Yinchuan PUA variants: the table shape, the code a variant has, its encoded base and the
// search key.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parsePuaQuery, indexTangutPua, byTangutPua } from '../app/lib/pua.js'

const pua = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-pua.json.gz', import.meta.url))).toString())
const isTangut = char => /^[\u{17000}-\u{18D7F}]$/u.test(char)
const index = indexTangutPua(pua.chars)

test('the shipped table has the Yinchuan counts and ranges', () => {
  expect(pua.format).toBe('tangut-input/tangut-pua')
  expect(pua.version).toBe('16.0.4')
  expect(pua.retrieved).toBe('2026-11-09')
  expect(pua.source).toBe('https://www.babelstone.co.uk/Fonts/Tangut_Variants.html')
  expect(pua.sha256).toMatch(/^[0-9a-f]{64}$/)
  expect(pua.counts).toEqual({ rows: 2814, assigned: 2775, characters: 2257, codes: 2813, unassigned: 39 })
  expect(Object.keys(pua.chars)).toHaveLength(2257)
  expect(pua.unassigned).toHaveLength(39)
  const rows = Object.values(pua.chars).flat()
  expect(rows).toHaveLength(2775)
  for (const [code, ids, sources] of rows) {
    expect(code).toMatch(/^U\+F[0-9A-F]{4}$/)
    expect(ids).toBeTruthy()
    expect(Array.isArray(sources)).toBe(true)
  }
  for (const char of Object.keys(pua.chars)) expect(isTangut(char)).toBe(true)
  for (const [code] of pua.unassigned) expect(code).toMatch(/^U\+F[0-9A-F]{4}$/)
})

test('known variants keep their base, IDS and source', () => {
  expect(pua.chars['𗀀']).toContainEqual(['U+F02BB', '⿰𘣩𘠆', ['Zazi Or.12380/1843 (K)']])
  const duplicate = pua.chars['𘉜'].filter(([code]) => code === 'U+F023C')
  expect(duplicate).toHaveLength(2)
  expect(duplicate.map(row => row[1])).toEqual(['⿲𘥷𘣾𘣈', '⿲𘥷𘣌𘣈'])
  expect(pua.unassigned.map(row => row[0])).toContain('U+F00CF')
})

test('a PUA query is a five-digit private-use code, not a Tangut code point', () => {
  expect(parsePuaQuery('U+F02BB')).toBe('U+F02BB')
  expect(parsePuaQuery('u+f02bb')).toBe('U+F02BB')
  expect(parsePuaQuery('F02BB')).toBe('U+F02BB')
  expect(parsePuaQuery('PUA-F02BB')).toBe('U+F02BB')
  expect(parsePuaQuery('tangut pua F02BB')).toBe('U+F02BB')
  expect(parsePuaQuery('U+F1613')).toBe('U+F1613')
  expect(parsePuaQuery('U+F1614')).toBe('')
  expect(parsePuaQuery('U+17000')).toBe('')
  expect(parsePuaQuery('17000')).toBe('')
  expect(parsePuaQuery('U+F5C0')).toBe('')
  expect(parsePuaQuery('L0009')).toBe('')
})

test('a PUA code names its encoded base character', () => {
  expect(byTangutPua(index, 'U+F02BB')).toEqual([{ char: '𗀀', code: 'U+F02BB' }])
  expect(byTangutPua(index, 'F02BB')).toEqual([{ char: '𗀀', code: 'U+F02BB' }])
  expect(byTangutPua(index, 'U+F023C')).toEqual([{ char: '𘉜', code: 'U+F023C' }])
  expect(byTangutPua(index, 'U+F00CF')).toEqual([])
  expect(byTangutPua(index, 'U+17000')).toEqual([])
})

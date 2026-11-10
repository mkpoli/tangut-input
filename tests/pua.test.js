// Tangut Yinchuan PUA variants: the table shape, the code a variant has, its encoded base and the
// search key.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parsePuaQuery, indexTangutPua, byTangutPua, indexUnencodedPua, byUnencodedPua, indexEncodedPua, byEncodedPua } from '../app/lib/pua.js'

const pua = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-pua.json.gz', import.meta.url))).toString())
const isTangut = char => /^[\u{17000}-\u{18D7F}]$/u.test(char)
const index = indexTangutPua(pua.chars)
const unencoded = indexUnencodedPua(pua.unencoded)
const encoded = indexEncodedPua(pua.encodedInUnicode18)

test('the shipped table has the Yinchuan counts and ranges', () => {
  expect(pua.format).toBe('tangut-input/tangut-pua')
  expect(pua.version).toBe('16.0.4')
  expect(pua.retrieved).toBe('2026-11-09')
  expect(pua.source).toBe('https://www.babelstone.co.uk/Fonts/Tangut_Variants.html')
  expect(pua.sha256).toMatch(/^[0-9a-f]{64}$/)
  expect(pua.counts).toEqual({ rows: 2814, assigned: 2775, characters: 2257, codes: 2813, unassigned: 39, encodedInUnicode18: 16, unencoded: 23 })
  expect(Object.keys(pua.chars)).toHaveLength(2257)
  expect(pua.unassigned).toHaveLength(39)
  expect(pua.encodedInUnicode18).toHaveLength(16)
  expect(pua.unencoded).toHaveLength(23)
  const rows = Object.values(pua.chars).flat()
  expect(rows).toHaveLength(2775)
  for (const [code, ids, sources] of rows) {
    expect(code).toMatch(/^U\+F[0-9A-F]{4}$/)
    expect(ids).toBeTruthy()
    expect(Array.isArray(sources)).toBe(true)
  }
  for (const char of Object.keys(pua.chars)) expect(isTangut(char)).toBe(true)
  for (const [code] of pua.unassigned) expect(code).toMatch(/^U\+F[0-9A-F]{4}$/)
  expect(Object.fromEntries(pua.encodedInUnicode18.map(([code, , , point]) => [code, point]))).toEqual({
    'U+F05C1': 'U+187F8', 'U+F05C4': 'U+187F9', 'U+F0631': 'U+187FA', 'U+F0630': 'U+187FB',
    'U+F0632': 'U+187FC', 'U+F01A6': 'U+187FD', 'U+F054C': 'U+187FE', 'U+F00FE': 'U+18D0C',
    'U+F00E2': 'U+18D0D', 'U+F01A1': 'U+18D0E', 'U+F0624': 'U+18D15', 'U+F062D': 'U+18D16',
    'U+F0580': 'U+18D1A', 'U+F051C': 'U+18D1B', 'U+F15F8': 'U+18D1D', 'U+F1025': 'U+18D20',
  })
  for (const [code] of pua.unencoded) expect(code).toMatch(/^U\+F[0-9A-F]{4}$/)
})

test('known variants keep their base, IDS and source', () => {
  expect(pua.chars['𗀀']).toContainEqual(['U+F02BB', '⿰𘣩𘠆', ['Zazi Or.12380/1843 (K)']])
  const duplicate = pua.chars['𘉜'].filter(([code]) => code === 'U+F023C')
  expect(duplicate).toHaveLength(2)
  expect(duplicate.map(row => row[1])).toEqual(['⿲𘥷𘣾𘣈', '⿲𘥷𘣌𘣈'])
  expect(pua.unassigned.map(row => row[0])).toContain('U+F00CF')
  expect(pua.unencoded.map(row => row[0])).toContain('U+F00CF')
  expect(pua.unencoded.map(row => row[0])).not.toContain('U+F00FE')
  expect(pua.encodedInUnicode18).toContainEqual(['U+F00FE', '⿰𘪎𘤘', ['Homonyms 08A2.05'], 'U+18D0C'])
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

test('a code with no encoded base names its PUA row', () => {
  expect(byUnencodedPua(unencoded, 'U+F00CF')).toEqual({ code: 'U+F00CF', ids: '⿰⿱𘥄𘠒𘢌', sources: [] })
  expect(byUnencodedPua(unencoded, 'F00E1')).toEqual({ code: 'U+F00E1', ids: '⿱𘡊⿰𘧤⿱𘡩𘡰', sources: ['Homonyms 12B1.01'] })
  expect(byUnencodedPua(unencoded, 'U+F00FE')).toBeNull()
  expect(byUnencodedPua(unencoded, 'U+17000')).toBeNull()
})

test('a code Unicode 18.0 has given a character names that row', () => {
  expect(byEncodedPua(encoded, 'U+F00FE')).toEqual({
    code: 'U+F00FE', ids: '⿰𘪎𘤘', sources: ['Homonyms 08A2.05'], point: 'U+18D0C', char: '𘴌',
  })
  expect(byEncodedPua(encoded, 'U+F1025')?.char).toBe('𘴠')
  expect(byEncodedPua(encoded, 'U+F00CF')).toBeNull()
  expect(byEncodedPua(encoded, 'U+17000')).toBeNull()
})

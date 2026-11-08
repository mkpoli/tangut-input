// The numbers and legacy code points a character carries: parsing the forms a reader copies,
// answering a search, and the shape of the shipped table.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseIdentifier, indexIdentifiers, byIdentifier, identifierGroups, editionName } from '../app/lib/identifiers.js'

const isTangut = char => /^[\u{17000}-\u{18D7F}]$/u.test(char)
const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`../app/data/${name}`, import.meta.url))).toString())

const characters = {
  '𗄈': [['lfw', 'L0009'], ['wenhai', 'L55.172'], ['mojikyo', 'U+84B2', '4.50'], ['mojikyo', 'U+84B2', '4.60'], ['xxzt', 'U+764F', 'A'], ['xxzt', 'U+764F', 'B']],
  '𗀀': [['lfw', 'L0008'], ['wenhai', 'L56.161']],
  '𗹆': [['lfw', 'L6014'], ['xxzt', 'U+4E00', 'A'], ['xxzt', 'U+6B63', 'A']],
}
const index = indexIdentifiers(characters)

test('an identifier is read in the forms each source prints', () => {
  expect(parseIdentifier('L0009')).toMatchObject({ scheme: 'lfw', value: 'L0009' })
  expect(parseIdentifier('l9')).toMatchObject({ scheme: 'lfw', value: 'L0009' })
  expect(parseIdentifier('LFW 9')).toMatchObject({ scheme: 'lfw', value: 'L0009' })
  expect(parseIdentifier('L2008-2941A')).toMatchObject({ scheme: 'lfw', value: 'L2941A' })
  expect(parseIdentifier('L0042/4537')).toMatchObject({ scheme: 'lfw', value: 'L0042/4537' })
  expect(parseIdentifier('L2008-0042-4537')).toMatchObject({ scheme: 'lfw', value: 'L0042/4537' })
  expect(parseIdentifier('L62.221')).toMatchObject({ scheme: 'wenhai', value: 'L62.221' })
  expect(parseIdentifier('m10.131')).toMatchObject({ scheme: 'wenhai', value: 'M10.131' })
  expect(parseIdentifier('M202-84B2')).toMatchObject({ scheme: 'mojikyo', value: 'U+84B2', edition: '4.50' })
  expect(parseIdentifier('M203-84B2')).toMatchObject({ scheme: 'mojikyo', value: 'U+84B2', edition: '4.60' })
  expect(parseIdentifier('MJ-84B2')).toMatchObject({ scheme: 'mojikyo', value: 'U+84B2', edition: undefined })
  expect(parseIdentifier('XXZT-A-764F')).toMatchObject({ scheme: 'xxzt', value: 'U+764F', edition: 'A' })
  expect(parseIdentifier('xxzt-764f')).toMatchObject({ scheme: 'xxzt', value: 'U+764F', edition: undefined })
})

test('the parser leaves ordinary text alone', () => {
  for (const text of ['wind', 'U+17000', 'L', 'M202', 'XXZT', '𗄈', '']) expect(parseIdentifier(text)).toBeNull()
})

test('a search finds every character the identifier names', () => {
  expect(byIdentifier(index, 'L0009').map(hit => hit.char)).toEqual(['𗄈'])
  expect(byIdentifier(index, 'L55.172').map(hit => hit.char)).toEqual(['𗄈'])
  expect(byIdentifier(index, 'M202-84B2').map(hit => hit.char)).toEqual(['𗄈'])
  expect(byIdentifier(index, 'MJ-84B2').map(hit => hit.char)).toEqual(['𗄈'])
  expect(byIdentifier(index, 'XXZT-A-764F').map(hit => hit.char)).toEqual(['𗄈'])
  expect(byIdentifier(index, 'XXZT-6B63').map(hit => hit.char)).toEqual(['𗹆'])
  expect(byIdentifier(index, 'wind')).toEqual([])
})

test('a Li Fanwen number without its edition letter finds both letters, and a pair needs both numbers', () => {
  const letters = indexIdentifiers({ '𗄈': [['lfw', 'L2941A']], '𗀀': [['lfw', 'L2941B']] })
  expect(byIdentifier(letters, 'L2941').map(hit => hit.char).sort()).toEqual(['𗀀', '𗄈'])
  expect(byIdentifier(letters, 'L2941A').map(hit => hit.char)).toEqual(['𗄈'])
  const pair = indexIdentifiers({ '𗄈': [['lfw', 'L0042/4537']], '𗀀': [['lfw', 'L0042']] })
  expect(byIdentifier(pair, 'L0042').map(hit => hit.char).sort()).toEqual(['𗀀', '𗄈'])
  expect(byIdentifier(pair, 'L0042/4537').map(hit => hit.char)).toEqual(['𗄈'])
})

test('the card groups the rows by system and keeps the editions apart', () => {
  const groups = identifierGroups(characters['𗄈'])
  expect(groups.map(group => [group.scheme, group.edition, group.values])).toEqual([
    ['lfw', undefined, ['L0009']],
    ['wenhai', undefined, ['L55.172']],
    ['mojikyo', '4.50', ['U+84B2']],
    ['mojikyo', '4.60', ['U+84B2']],
    ['xxzt', 'A', ['U+764F']],
    ['xxzt', 'B', ['U+764F']],
  ])
  expect(editionName('mojikyo', '4.50')).toBe('M202 · 4.50')
  expect(editionName('mojikyo', '4.60')).toBe('M203 · 4.60')
  expect(editionName('xxzt', 'A')).toBe('A')
})

test('the shipped table has every system, the expected coverage and one shape per row', () => {
  const document = read('tangut-identifiers.json.gz')
  expect(document.format).toBe('tangut-input/identifiers')
  expect(document.retrieved).toBe('2026-11-08')
  for (const scheme of ['lfw', 'wenhai', 'mojikyo', 'xxzt']) {
    expect(document.sources[scheme].name).toBeTruthy()
    expect(document.sources[scheme].url).toMatch(/^https:/)
    expect(document.sources[scheme].sha256).toMatch(/^[0-9a-f]{64}$/)
  }
  const counts = Object.fromEntries(['lfw', 'wenhai', 'mojikyo', 'xxzt'].map(scheme => [
    scheme,
    Object.values(document.chars).filter(rows => rows.some(row => row[0] === scheme)).length,
  ]))
  expect(counts.lfw).toBeGreaterThan(6000)
  expect(counts.wenhai).toBeGreaterThan(3000)
  expect(counts.mojikyo).toBeGreaterThan(6000)
  expect(counts.xxzt).toBeGreaterThan(6400)
  expect(counts).toMatchObject({ lfw: 6068, wenhai: 3069, mojikyo: 6061, xxzt: 6455 })
  const row = document.chars['𗄈']
  expect(row).toContainEqual(['lfw', 'L0009'])
  expect(row).toContainEqual(['wenhai', 'L55.172'])
  expect(row).toContainEqual(['xxzt', 'U+764F', 'A'])
  expect(row).toContainEqual(['mojikyo', 'U+84B2', '4.50'])
  for (const [char, rows] of Object.entries(document.chars)) {
    expect(isTangut(char)).toBe(true)
    for (const [scheme, value, edition] of rows) {
      expect(['lfw', 'wenhai', 'mojikyo', 'xxzt']).toContain(scheme)
      if (scheme === 'lfw') expect(value).toMatch(/^L\d{4}[AB]?(\/\d{4}[AB]?)?$/)
      else if (scheme === 'wenhai') expect(value).toMatch(/^[LM]\d{2}\.\d{3}$/)
      else {
        expect(value).toMatch(/^U\+[0-9A-F]{4,6}$/)
        if (scheme === 'xxzt') expect(edition).toMatch(/^[AB]$/)
        else expect(edition).toMatch(/^4\.(50|60)$/)
      }
    }
  }
})

// Every written form of a Tibetan spelling reaches the same characters.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { foldLatin, indexTibetan, searchTibetan } from '../app/lib/tibetan.js'

const read = name => JSON.parse(readFileSync(new URL(`../app/data/${name}`, import.meta.url), 'utf8'))
const index = indexTibetan(new Map(Object.entries(read('tangut-tibetan.json').glosses)), read('tangut-tibetan-hands.json').chars)
const exact = query => searchTibetan(index, query).filter(hit => hit.tier === 0).map(hit => hit.char)

test('the written forms of one spelling fold together', () => {
  expect(foldLatin('g-yi')).toBe(foldLatin('g.yi'))
  expect(foldLatin("'go")).toBe(foldLatin('v-go'))
  expect(foldLatin('bAng')).toBe(foldLatin('baang'))
  expect(foldLatin('k+ha')).toBe(foldLatin('k.ha'))
})

test('script, Wylie and the tables\' notation find the same characters', () => {
  const byScript = exact('འགོ')
  expect(byScript.length).toBeGreaterThan(0)
  expect(exact("'go")).toEqual(byScript)
  expect(exact('v-go')).toEqual(byScript)
  expect(exact('གཡི')).toContain('𘘣')
  expect(exact('g.yi')).toContain('𘘣')
  expect(exact('g-yi')).toContain('𘘣')
  expect(exact('བཱང')).toContain('𗬠')
  expect(exact('bAng')).toContain('𗬠')
  expect(exact('baang')).toContain('𗬠')
})

test('script keeps apart what Latin folds together: གྱི is not གཡི', () => {
  expect(exact('གྱི')).not.toEqual(exact('གཡི'))
})

test('a whole spelling comes before one that begins with the query, and the commonest first', () => {
  const hits = searchTibetan(index, 'g.yi')
  expect(hits[0].char).toBe('𘘣')
  const tiers = hits.map(hit => hit.tier)
  expect([...tiers].sort()).toEqual(tiers)
  expect(new Set(hits.map(hit => hit.char)).size).toBe(hits.length)
})

test('a spelling of two syllables is found with or without the space', () => {
  expect(exact('me lda')).toEqual(exact('melda'))
  expect(exact('melda').length).toBeGreaterThan(0)
})

test('an unread letter is never indexed, and other text finds nothing', () => {
  expect(index.some(spelling => spelling.shown.includes('?'))).toBe(false)
  expect(searchTibetan(index, '菩')).toEqual([])
  expect(searchTibetan(index, '123')).toEqual([])
  expect(searchTibetan(index, '   ')).toEqual([])
})

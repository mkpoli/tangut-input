// The editorial shape ranking: candidates for review, never attested names.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readNames } from '../src/core/names.js'

const hints = JSON.parse(gunzipSync(readFileSync(new URL('../data/tangut-component-shape-hints.json.gz', import.meta.url))).toString())
const exemplars = new Set(hints.exemplars.map(row => row.char))
const named = new Set(readNames(readFileSync(new URL('../data/tangut-component-names.tsv', import.meta.url), 'utf8')).map(row => row.char))

test('the hint file covers every component and every attested example', () => {
  expect(hints.format).toBe('tangut-input/component-shape-hints')
  expect(hints.editorial).toBe(true)
  expect(hints.counts).toEqual({ components: 768, exemplars: 19 })
  expect(hints.components.length).toBe(768)
  expect(hints.components[0].codepoint).toBe('U+18800')
  expect(hints.components.at(-1).codepoint).toBe('U+18AFF')
})

test('candidates point at attested examples, with scores', () => {
  for (const component of hints.components) {
    expect(component.candidates.length).toBe(3)
    for (const candidate of component.candidates) {
      expect(exemplars.has(candidate.char)).toBe(true)
      expect(candidate.score).toBeGreaterThan(0)
      expect(candidate.score).toBeLessThanOrEqual(1)
    }
  }
})

test('the exemplars are the named components', () => {
  expect(exemplars).toEqual(named)
})

test('a named component never offers itself', () => {
  for (const component of hints.components.filter(row => row.named)) {
    expect(component.candidates.every(candidate => candidate.char !== component.char)).toBe(true)
  }
})

test('the app copy is the published hints file', () => {
  const hash = path => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex')
  expect(hash('../app/data/tangut-component-shape-hints.json.gz')).toBe(hash('../data/tangut-component-shape-hints.json.gz'))
})

test('some unnamed components pass the card threshold', () => {
  const hinted = hints.components.filter(row => !row.named && row.candidates[0]?.score >= 0.7 && row.candidates[0]?.sameStrokes)
  expect(hinted.length).toBeGreaterThan(0)
})

test('the method states the limitation the names exist to mark', () => {
  expect(hints.method.limitation).toContain('くノ')
  expect(hints.method.limitation).toContain('ノメ')
})

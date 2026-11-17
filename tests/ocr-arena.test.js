// The OCR page's numbers are claims: the sample stays 24 signs, the measured counts follow the
// sample, and the history stays in order.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { ATTEMPTS, ENTRIES, MEASURED } from '../app/lib/ocr-arena.js'
import { score } from '../benchmark/ocr/score.mjs'

const SAMPLE = JSON.parse(readFileSync(new URL('../benchmark/ocr/sample.json', import.meta.url), 'utf8'))
const TANGUT = /^[\u{17000}-\u{187FF}]$/u

test('the sample is 24 Tangut signs in six columns of four', () => {
  expect(SAMPLE.length).toBe(24)
  expect(new Set(SAMPLE.map(row => row.id)).size).toBe(24)
  expect(SAMPLE.every(row => TANGUT.test(row.char))).toBe(true)
  expect(ENTRIES.length).toBe(6)
  expect(ENTRIES.every(entry => entry.length === 4)).toBe(true)
})

test('the measured counts are the sample, not a remembered number', () => {
  expect(MEASURED.map(run => `${run.score}/${run.total}`)).toEqual(['0/24', '9/24', '11/24'])
  expect(score(SAMPLE.map(row => ({ id: row.id, char: row.band }))).correct).toBe(11)
  expect(score(SAMPLE.map(row => ({ id: row.id, char: row.mixocr }))).correct).toBe(9)
})

test('the history runs oldest first and names a source for every row', () => {
  expect(ATTEMPTS.length).toBe(17)
  const years = ATTEMPTS.map(attempt => attempt.year)
  expect(years).toEqual([...years].sort((a, b) => a - b))
  for (const attempt of ATTEMPTS) {
    expect(attempt.url).toMatch(/^https?:\/\//)
    expect(attempt.name.length).toBeGreaterThan(0)
    expect(attempt.terms.length).toBeGreaterThan(0)
  }
})

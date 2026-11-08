// The cursive forms: 108 characters from BabelStone's examples, each with one form at its code
// point and the page's other forms as stylistic alternates.
import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const record = JSON.parse(gunzipSync(readFileSync(new URL('../data/cursive/forms.json.gz', import.meta.url))).toString())
/** @type {{ char: string, codepoint: string, meaning: string, references: string[], source: string,
 *   image: string, sha256: string, width: number, height: number, order: number, base?: boolean,
 *   alternate?: number, outline: (string | number)[][] }[]} */
const forms = record.forms
const bases = forms.filter(form => form.base)
const byChar = new Map()
for (const form of forms) {
  const list = byChar.get(form.char) ?? []
  list.push(form)
  byChar.set(form.char, list)
}

test('the record covers 108 characters in 210 forms, all in the Tangut blocks', () => {
  expect(bases).toHaveLength(108)
  expect(forms).toHaveLength(210)
  expect(byChar.size).toBe(108)
  for (const form of forms) {
    const code = Number.parseInt(form.codepoint, 16)
    expect(code >= 0x17000 && code <= 0x18DFF).toBe(true)
    expect(String.fromCodePoint(code)).toBe(form.char)
  }
})

test('every form keeps the page\'s source and the crop it came from', () => {
  for (const form of forms) {
    expect(form.source.length).toBeGreaterThan(0)
    expect(form.image).toMatch(/^U_[0-9A-F]+_.+\.(jpg|png)$/)
    expect(form.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(form.width).toBeGreaterThan(0)
    expect(form.height).toBeGreaterThan(0)
    expect(form.meaning.length).toBeGreaterThan(0)
  }
  expect(record.missing).toHaveLength(1)
  expect(record.missing[0].image).toBe('U_1868C_Arakawa_2016_B.jpg')
})

test('a character\'s alternates are numbered without a gap', () => {
  for (const [char, list] of byChar) {
    const atCodePoint = list.filter(form => form.base)
    expect({ char, bases: atCodePoint.length }).toEqual({ char, bases: 1 })
    expect(atCodePoint[0].alternate).toBeUndefined()
    const alternates = list.filter(form => !form.base).map(form => form.alternate).sort((a, b) => a - b)
    expect(alternates).toEqual(Array.from({ length: alternates.length }, (_, index) => index + 1))
  }
})

test('each outline is a closed path inside the em box', () => {
  for (const form of forms) {
    const outline = form.outline
    expect(outline[0][0]).toBe('M')
    expect(outline.at(-1)[0]).toBe('Z')
    const operands = { M: 2, L: 2, C: 6, Z: 0 }
    for (const [operator, ...points] of outline) {
      expect(points).toHaveLength(operands[operator])
      for (let index = 0; index < points.length; index += 2) {
        expect(points[index]).toBeGreaterThanOrEqual(0)
        expect(points[index]).toBeLessThanOrEqual(1000)
        expect(points[index + 1]).toBeGreaterThan(-146)
        expect(points[index + 1]).toBeLessThan(900)
      }
    }
  }
})

test('the built face is in fonts/', () => {
  const ttf = readFileSync(new URL('../fonts/CursiveTangut-Regular.ttf', import.meta.url))
  const woff2 = readFileSync(new URL('../fonts/CursiveTangut-Regular.woff2', import.meta.url))
  expect(ttf.length).toBeGreaterThan(300_000)
  expect([0x00010000, 0x74727565]).toContain(ttf.readUInt32BE(0))
  expect(woff2.subarray(0, 4).toString('latin1')).toBe('wOF2')
  expect(existsSync(new URL('../data/cursive/README.md', import.meta.url))).toBe(true)
})

import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import FORMS from '../app/data/tangut-script-forms.json' with { type: 'json' }

const ROOT = new URL('..', import.meta.url)

test('every recorded form points at a crop and a stated source', () => {
  expect(FORMS.forms.length).toBe(16)
  const sources = new Map(FORMS.sources.map(source => [source.id, source]))
  for (const form of FORMS.forms) {
    expect(form.script).toBe('seal')
    expect(sources.has(form.source)).toBe(true)
    expect(form.image).toStartWith('/seal/shouling/')
    expect(existsSync(new URL(`app/public${form.image}`, ROOT))).toBe(true)
    const source = sources.get(form.source)
    expect(source.author).toBe('李范文')
    expect(source.book).toBe('夏漢字典')
    expect(source.licence).toBe('No licence stated')
  }
})

test('the sixteen forms are distinct characters in the plate order', () => {
  expect(new Set(FORMS.forms.map(form => form.char)).size).toBe(16)
  expect(FORMS.forms.map(form => form.position)).toEqual([...Array(16).keys()])
  expect(FORMS.forms.map(form => form.char).join('')).toBe('𘜶𗴂𗹭𗂧𗓑𗍁𗼈𗣼𗫡𗤓𘓺𘋨𘗽𗳇𘋼𘝞')
})

test('every form is a character the site knows', () => {
  const packed = JSON.parse(gunzipSync(readFileSync(new URL('app/data/tangut-entries.json.gz', ROOT))).toString())
  const known = new Set(packed.rows.map((/** @type {any[]} */ row) => row[0]))
  for (const form of FORMS.forms) expect(known.has(form.char)).toBe(true)
})

test('the source record names the plate and its order', () => {
  const [source] = FORMS.sources
  expect(source.title).toBe('篆額復原圖')
  expect(source.edition).toContain('2008 edition p. 90')
  expect(source.note).toContain('大白高國')
  expect(existsSync(new URL('data/shouling/README.md', ROOT))).toBe(true)
})

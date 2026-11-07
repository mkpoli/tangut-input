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
    expect(source.licence).toBe('CC BY-SA 4.0')
    expect(source.author.length).toBeGreaterThan(0)
    expect(source.url).toStartWith('https://commons.wikimedia.org/')
  }
})

test('the sixteen forms are distinct characters in the source order', () => {
  expect(new Set(FORMS.forms.map(form => form.char)).size).toBe(16)
  expect(FORMS.forms.map(form => form.position)).toEqual([...Array(16).keys()])
  expect(FORMS.forms.map(form => form.index)).toEqual(['1572', '1890', '2937', '4457', '4976', '0289', '2546', '2748', '2679', '3228', '0510', '5306', '0590', '0466', '5545', '4797'])
})

test('every form is a character the site knows', () => {
  const packed = JSON.parse(gunzipSync(readFileSync(new URL('app/data/tangut-entries.json.gz', ROOT))).toString())
  const known = new Set(packed.rows.map((/** @type {any[]} */ row) => row[0]))
  for (const form of FORMS.forms) expect(known.has(form.char)).toBe(true)
})

test('the source image is the one the build cuts', () => {
  expect(existsSync(new URL('data/shouling/seal-title.jpg', ROOT))).toBe(true)
})

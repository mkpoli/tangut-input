import { expect, test } from 'bun:test'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { variantIndex } from '../app/lib/variants.js'
import VARIANTS from '../app/data/tangut-variants.json' with { type: 'json' }

const NONE = { variants: [], components: [] }

test('a stated variant links both characters', () => {
  const index = variantIndex([], { variants: [['𗄧', '𘚡']], components: [] })
  expect(index.get('𗄧')).toEqual({ of: ['𘚡'], forms: [], possible: [] })
  expect(index.get('𘚡')).toEqual({ of: [], forms: ['𗄧'], possible: [] })
})

test('a shared reading and sense makes a possible variant, and neither alone does', () => {
  const entry = (char, reading, en) => ({ char, pronunciations: { li_fanwen: reading }, definitions: { en } })
  const index = variantIndex([entry('𗀀', 'a1', ['flag']), entry('𗀁', 'a1', ['to flag; banner']), entry('𗀂', 'a1', ['fish']), entry('𗀃', 'b1', ['flag'])], NONE)
  expect(index.get('𗀀')?.possible).toEqual(['𗀁'])
  expect(index.get('𗀂')).toBeUndefined()
  expect(index.get('𗀃')).toBeUndefined()
})

test('variant components link characters only when the reading also matches', () => {
  const entry = (char, composition, reading) => ({ char, composition, pronunciations: { li_fanwen: reading } })
  const index = variantIndex([entry('𗀀', '⿰𘢩𘠀', 'a1'), entry('𗀁', '⿰𘢪𘠀', 'a1'), entry('𗀂', '⿰𘢩𘠁', 'a1'), entry('𗀃', '⿰𘢪𘠁', 'b1')], { variants: [], components: [['𘢩', '𘢪']] })
  expect(index.get('𗀀')?.possible).toEqual(['𗀁'])
  expect(index.get('𗀂')).toBeUndefined()
})

test('the recorded data gives the stated variants and the possible ones', () => {
  const packed = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  const li = packed.systems.indexOf('li_fanwen')
  const entries = packed.rows.map((/** @type {any[]} */ row) => ({ char: row[0], composition: row[1], pronunciations: { li_fanwen: row[7][li] }, definitions: { en: row[4], ja: row[5] } }))
  const known = new Set(entries.map(entry => entry.char))
  const index = variantIndex(entries)
  expect(VARIANTS.variants.length).toBe(27)
  for (const [form, base] of VARIANTS.variants) {
    expect(known.has(form)).toBe(true)
    expect(known.has(base)).toBe(true)
  }
  expect(index.get('𗇫')?.forms.toSorted()).toEqual(['𗄄', '𗇐'].toSorted())
  expect(index.get('𗁇')?.of).toEqual(['𘚠'])
  expect(index.get('𘈣')?.of).toEqual(['𗀛'])
  expect(index.get('𗀏')?.possible).toEqual([])
  expect(index.get('𗌲')?.possible).toEqual(['𗍒'])
  expect(index.get('𗚅')?.possible).toEqual(['𗚆'])
})

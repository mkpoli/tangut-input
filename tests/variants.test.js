import { expect, test } from 'bun:test'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { keepVariantsTogether, variantIndex } from '../app/lib/variants.js'
import VARIANTS from '../app/data/tangut-variants.json' with { type: 'json' }

const NONE = { variants: [], partial: [], synonyms: [], components: [], reported: [] }

test('a stated variant links both characters', () => {
  const index = variantIndex([], { ...NONE, variants: [['𗄧', '𘚡']] })
  expect(index.get('𗄧')).toEqual({ of: ['𘚡'], partial: [], forms: [], reported: [], possible: [] })
  expect(index.get('𘚡')).toEqual({ of: [], partial: [], forms: ['𗄧'], reported: [], possible: [] })
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
  const index = variantIndex([entry('𗀀', '⿰𘢩𘠀', 'a1'), entry('𗀁', '⿰𘢪𘠀', 'a1'), entry('𗀂', '⿰𘢩𘠁', 'a1'), entry('𗀃', '⿰𘢪𘠁', 'b1')], { ...NONE, components: [['𘢩', '𘢪']] })
  expect(index.get('𗀀')?.possible).toEqual(['𗀁'])
  expect(index.get('𗀂')).toBeUndefined()
})

test('a usage line is not a shared meaning', () => {
  const entry = (char, en) => ({ char, pronunciations: { li_fanwen: 'a1' }, definitions: { en } })
  expect(variantIndex([entry('𗀀', ['Transliteration of Middle Chinese 俄']), entry('𗀁', ['Transliteration of Middle Chinese 娥'])], NONE).size).toBe(0)
})

test('synonyms are not possible variants', () => {
  const entry = (char, en) => ({ char, pronunciations: { li_fanwen: 'a1' }, definitions: { en } })
  const index = variantIndex([entry('𗀀', ['name']), entry('𗀁', ['name'])], { ...NONE, synonyms: [['𗀀', '𗀁']] })
  expect(index.size).toBe(0)
})

test('the recorded data gives the stated variants and the possible ones', () => {
  const packed = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  const li = packed.systems.indexOf('li_fanwen')
  const entries = packed.rows.map((/** @type {any[]} */ row) => ({ char: row[0], composition: row[1], pronunciations: { li_fanwen: row[7][li] }, definitions: { en: row[4], ja: row[5] } }))
  const known = new Set(entries.map(entry => entry.char))
  const index = variantIndex(entries)
  expect(VARIANTS.variants.length + VARIANTS.partial.length).toBe(28)
  for (const [form, base] of [...VARIANTS.variants, ...VARIANTS.partial]) {
    expect(known.has(form)).toBe(true)
    expect(known.has(base)).toBe(true)
  }
  expect(index.get('𗇫')?.forms.toSorted()).toEqual(['𗄄', '𗇐'].toSorted())
  expect(index.get('𗁇')?.of).toEqual(['𘚠'])
  expect(index.get('𘈣')?.of).toEqual(['𗀛'])
  expect(index.get('𗀏')?.possible).toEqual([])
  expect(index.get('𗌲')?.possible).toEqual(['𗍒'])
  expect(index.get('𗚅')?.possible).toEqual(['𗚆'])
  expect(index.get('𘅾')?.of).toEqual(['𘄵'])
  expect(index.get('𗀑')?.partial).toEqual(['𗀉'])
  expect(index.get('𗀑')?.of).toEqual([])
  expect(index.get('𗢨')?.reported).toEqual(['𘓐'])
  expect(index.get('𗢨')?.possible).toEqual([])
  expect(index.get('𗥠')?.possible ?? []).toEqual([])
  expect([...index.values()].flatMap(record => record.possible).length).toBe(38)
})

test('variant components stand together, under the first member\'s strokes', () => {
  const part = (name, strokes) => ({ part: name, strokes })
  const arranged = keepVariantsTogether([part('𘠣', 2), part('𘠀', 2), part('𘡍', 3), part('𘠅', 3), part('𘠁', 3)], ['𘠣𘡍𘠅'])
  expect(arranged.map(item => item.part)).toEqual(['𘠣', '𘡍', '𘠅', '𘠀', '𘠁'])
  expect(arranged.map(item => item.section)).toEqual([2, 2, 2, 2, 3])
})

test('a member filtered out of the palette leaves the rest in place', () => {
  const part = (name, strokes) => ({ part: name, strokes })
  expect(keepVariantsTogether([part('𘠟', 4)], ['𘠠𘠟'])).toEqual([{ part: '𘠟', strokes: 4, section: 4 }])
})

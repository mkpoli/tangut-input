import { expect, test } from 'bun:test'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { variantIndex } from '../app/lib/variants.js'

test('a variant line links both characters, once each', () => {
  const index = variantIndex([
    { char: '𗄧', definitions: { en: ['Variant form of 𘚡 (*lə²)', 'Variant form of 𘚡 (*lə²):', 'flea'] } },
    { char: '𘚡', definitions: {} },
  ])
  expect(index.get('𗄧')).toEqual({ of: ['𘚡'], forms: [], possible: [] })
  expect(index.get('𘚡')).toEqual({ of: [], forms: ['𗄧'], possible: [] })
})

test('a definition that only mentions a form is not a variant', () => {
  const index = variantIndex([{ char: '𗐱', definitions: { en: ['Suffixed to the stem 1 form of verbs'] } }])
  expect(index.size).toBe(0)
})

test('a shared reading and sense makes a possible variant, and neither alone does', () => {
  const entry = (char, reading, en) => ({ char, pronunciations: { li_fanwen: reading }, definitions: { en } })
  const index = variantIndex([entry('𗀀', 'a1', ['flag']), entry('𗀁', 'a1', ['to flag; banner']), entry('𗀂', 'a1', ['fish']), entry('𗀃', 'b1', ['flag'])])
  expect(index.get('𗀀')?.possible).toEqual(['𗀁'])
  expect(index.get('𗀂')).toBeUndefined()
  expect(index.get('𗀃')).toBeUndefined()
})

test('the recorded entries give the stated variants and the possible ones', () => {
  const packed = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  const li = packed.systems.indexOf('li_fanwen')
  const entries = packed.rows.map((/** @type {any[]} */ row) => ({ char: row[0], pronunciations: { li_fanwen: row[7][li] }, definitions: { en: row[4], ja: row[5] } }))
  const index = variantIndex(entries)
  expect(index.get('𗇫')?.forms.toSorted()).toEqual(['𗄄', '𗇐'].toSorted())
  expect(index.get('𘚡')?.forms).toEqual(['𗄧'])
  expect(index.get('𗈀')?.forms).toEqual(['𗇔'])
  expect(index.get('𗄄')?.of).toEqual(['𗇫'])
  expect(index.get('𗄄')?.possible).toEqual([])
  expect(index.get('𗌲')?.possible).toEqual(['𗍒'])
  expect([...index.values()].flatMap(record => record.possible).length).toBe(28)
})

// Reading either recorded or editorial descriptions as queries: a whole description names its
// character, and a description cut after its opening part names a family.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describedBy, indexDescriptions, openingOf } from '../app/lib/description.js'
import { indexIdsDescriptions } from '../app/lib/ids-views.js'

const entries = [
  { char: '𗾆', composition: '⿱𘡃𘘘' },
  { char: '𗾇', composition: '⿰𘤊𘠡' },
  { char: '𗾈', composition: '⿰𘫽𘫺' },
  { char: '𗾋', composition: '⿰𘤊𘢅' },
  { char: '𗾌', composition: '⿰𘤊𘢬' },
  { char: '𗔿', composition: '⿰⿸𘡋𘠮𘠢' },
  { char: '𘤊' },
]
const index = indexDescriptions(entries, indexIdsDescriptions(entries))

test('the whole description names its character', () => {
  expect(describedBy(index, '⿰𘤊𘠡')).toEqual(['𗾇'])
})

test('a description cut after its opening part names the family that opens so', () => {
  expect(describedBy(index, '⿰𘤊')).toEqual(['𗾇', '𗾋', '𗾌'])
  expect(describedBy(index, '⿱𘡃')).toEqual(['𗾆'])
})

test('a part or an operator alone is not a description', () => {
  expect(describedBy(index, '𗾇')).toEqual([])
  expect(describedBy(index, '⿰')).toEqual([])
})

test('a description no record begins with finds nothing', () => {
  expect(describedBy(index, '⿲𘤊')).toEqual([])
})

test('a description opens with its operator and first part', () => {
  expect(openingOf('⿰𘤊𘠡')).toBe('⿰𘤊')
  expect(openingOf('⿱𘠀⿰𘢰𘠆')).toBe('⿱𘠀')
  expect(openingOf('⿲𘠀𘠁𘠂')).toBe('⿲𘠀')
  expect(openingOf('𘤊')).toBe('')
  expect(openingOf('')).toBe('')
})

test('a first part that is itself described is taken whole', () => {
  expect(openingOf('⿰⿸𘡋𘠮𘠢')).toBe('⿰⿸𘡋𘠮')
  expect(openingOf('⿱⿰𘠠𘢌𘡪')).toBe('⿱⿰𘠠𘢌')
})

test('an opening taken from a record is a query that finds it', () => {
  for (const entry of entries) {
    const opening = openingOf(entry.composition)
    if (opening) expect(describedBy(index, opening)).toContain(entry.char)
  }
})

test('recorded and editorial descriptions and their prefixes find the source character', () => {
  const data = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  const source = data.rows.map(row => ({ char: row[0], composition: row[1] ?? undefined }))
  const sourceIndex = indexDescriptions(source, indexIdsDescriptions(source))
  for (const query of ['⿱𘠀⿲𘨷𘨷𘠢', '⿱𘠀⿲𘘤𘘤𘠢', '⿱𘠀⿲𘨷', '⿱𘠀⿲𘘤']) {
    expect(describedBy(sourceIndex, query)).toContain('𗀮')
  }
})

test('matching both views and duplicate records yields each character once in code order', () => {
  const rows = [
    { char: '𗀁', composition: '⿱𘠀𘠁' },
    { char: '𗀀', composition: '𘠁' },
    { char: '𗀁', composition: '⿱𘠀𘠁' },
    { char: '𗀂', composition: '⿱𘠀𘠂' },
  ]
  const found = indexDescriptions(rows, indexIdsDescriptions(rows))
  expect(describedBy(found, '⿱𘠀')).toEqual(['𗀁', '𗀂'])
  expect(describedBy(found, '⿱𘠀𗀀')).toEqual(['𗀁'])
  expect(describedBy(found, '⿱𘠀𘠁')).toEqual(['𗀁'])
})

test('malformed records retain recorded prefix search without fabricated editorial views', () => {
  const rows = [
    { char: '𗀀', composition: '𘠁' },
    { char: '𗀁', composition: '⿲𘠀𘠁' },
    { char: '𗀂', composition: '⿰𘠀𘠁𘠂' },
    { char: '𗀃' },
  ]
  const found = indexDescriptions(rows, indexIdsDescriptions(rows))
  expect(describedBy(found, '⿲𘠀𘠁')).toEqual(['𗀁'])
  expect(describedBy(found, '⿰𘠀𘠁𘠂')).toEqual(['𗀂'])
  expect(describedBy(found, '⿲𘠀𗀀')).toEqual([])
  expect(describedBy(found, '⿰𘠀𗀀')).toEqual([])
  expect(describedBy(found, '')).toEqual([])
  expect(describedBy(found, '⿰⿱')).toEqual([])
})

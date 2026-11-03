// Reading a description as a query: the records' own descriptions are the index, so the whole of a
// description names one character and a description cut after its opening part names a family.
import { expect, test } from 'bun:test'
import { describedBy, openingOf } from '../app/lib/description.js'

const entries = [
  { char: '𗾆', composition: '⿱𘡃𘘘' },
  { char: '𗾇', composition: '⿰𘤊𘠡' },
  { char: '𗾈', composition: '⿰𘫽𘫺' },
  { char: '𗾋', composition: '⿰𘤊𘢅' },
  { char: '𗾌', composition: '⿰𘤊𘢬' },
  { char: '𗔿', composition: '⿰⿸𘡋𘠮𘠢' },
  { char: '𘤊' },
]

test('the whole description names its character', () => {
  expect(describedBy(entries, '⿰𘤊𘠡')).toEqual(['𗾇'])
})

test('a description cut after its opening part names the family that opens so', () => {
  expect(describedBy(entries, '⿰𘤊')).toEqual(['𗾇', '𗾋', '𗾌'])
  expect(describedBy(entries, '⿱𘡃')).toEqual(['𗾆'])
})

test('a part or an operator alone is not a description', () => {
  expect(describedBy(entries, '𗾇')).toEqual([])
  expect(describedBy(entries, '⿰')).toEqual([])
})

test('a description no record begins with finds nothing', () => {
  expect(describedBy(entries, '⿲𘤊')).toEqual([])
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
    if (opening) expect(describedBy(entries, opening)).toContain(entry.char)
  }
})

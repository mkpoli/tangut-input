import { describe, expect, test } from 'bun:test'
import { filterHandwriting } from '../app/lib/handwriting-filter.js'

const a = '𗀀', b = '𗀁', c = '𗀂', p = '𘠀', q = '𘠁'
const index = { usedBy: new Map([[p, new Set([a, c])], [q, new Set([b, c])], [a, new Set([b])]]) }
const ranked = [b, p, a, c, q].map(char => ({ char }))

describe('handwriting component filters', () => {
  test('filters the full ranked list before limiting', () => {
    expect(filterHandwriting(ranked, index, { chosen: [p], limit: 1 })).toEqual([{ char: a }])
  })
  test('intersects all selected parts while preserving shape order', () => {
    expect(filterHandwriting(ranked, index, { chosen: [p, q] })).toEqual([{ char: c }])
  })
  test('removing a choice and resetting restore candidates', () => {
    expect(filterHandwriting(ranked, index, { chosen: [q] })).toEqual([{ char: b }, { char: c }])
    expect(filterHandwriting(ranked, index, {})).toEqual([b, a, c].map(char => ({ char })))
  })
  test('unknown parts yield no matches', () => {
    expect(filterHandwriting(ranked, index, { chosen: ['missing'] })).toEqual([])
  })
  test('component mode includes only selectable parts, including character-sized parts', () => {
    expect(filterHandwriting(ranked, index, { componentsOnly: true })).toEqual([p, a, q].map(char => ({ char })))
  })
  test('optional component inclusion preserves shape order', () => {
    expect(filterHandwriting(ranked, index, { includeComponents: true })).toEqual(ranked)
  })
})

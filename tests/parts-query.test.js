import { describe, expect, test } from 'bun:test'
import { encodePartsQuery, decodePartsQuery } from '../app/lib/parts-query.js'

describe('parts page query', () => {
  test('round trips composite and repeated parts with layout', () => {
    const parts = ['⿱𘡊𗎘', '𘠁', '⿱𘡊𗎘']
    const query = encodePartsQuery(parts, '⿰')
    const url = new URL('https://example.test/parts')
    url.searchParams.set('q', query)
    expect(decodePartsQuery(new URL(url.href).searchParams.get('q'))).toEqual({ parts, layout: '⿰', legacy: false })
  })

  test('round trips a layout without parts and an empty state', () => {
    expect(decodePartsQuery(encodePartsQuery([], '⿱'))).toEqual({ parts: [], layout: '⿱', legacy: false })
    expect(encodePartsQuery([], '')).toBe('')
  })

  test('reads character links and rejects malformed structured queries', () => {
    expect(decodePartsQuery('𗁛')).toEqual({ parts: ['𗁛'], layout: '', legacy: true })
    expect(decodePartsQuery('[broken')).toEqual({ parts: [], layout: '', legacy: false })
    expect(decodePartsQuery('[[],"x"]')).toEqual({ parts: [], layout: '', legacy: false })
  })
})

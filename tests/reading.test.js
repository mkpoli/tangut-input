// Which reconstruction a reader sees on arrival.
import { expect, test } from 'bun:test'
import { DEFAULT_READING, SYSTEMS, readingFromStore } from '../app/lib/reading.js'

test('a reader with no stored choice gets Gong Xun', () => {
  expect(DEFAULT_READING).toBe('gong_xun_202411')
  expect(readingFromStore(null)).toBe('gong_xun_202411')
})

test('every system a reader can pick survives a reload', () => {
  for (const { key } of SYSTEMS) expect(readingFromStore(key)).toBe(key)
})

test('a value left by an older version falls back to the default', () => {
  expect(readingFromStore('gong_huangcheng')).toBe('gong_xun_202411')
})

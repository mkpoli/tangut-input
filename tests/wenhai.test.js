// The 60 文海 constructions the card shows: a head character, its page position and the source
// characters and parts its entry names. The data is transcribed from BabelStone's Wenhai.html.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const doc = JSON.parse(readFileSync(new URL('../app/data/wenhai-composition.json', import.meta.url), 'utf8'))
const PARTS = new Set(['whole', 'left', 'middle', 'right', 'top', 'bottom', 'surrounding'])
const single = text => [...text].length === 1
const tangut = text => {
  const code = text.codePointAt(0)
  return code !== undefined && code >= 0x17000 && code <= 0x18AFF
}

test('the file keeps the 60 entries and the known example', () => {
  expect(doc.source).toContain('BabelStone')
  expect(Object.keys(doc.entries).length).toBe(60)
  expect(doc.entries['𘀏']).toEqual({
    position: '1.05.131',
    parts: [['𘀑', 'left'], ['𗩝', 'right']],
  })
})

test('every entry names a position, a source character and one of the seven parts', () => {
  const positions = new Set()
  for (const [char, { position, parts }] of Object.entries(doc.entries)) {
    expect(single(char)).toBe(true)
    expect(tangut(char)).toBe(true)
    expect(position).toMatch(/^1\.\d{2}\.\d{3}$/)
    expect(positions.has(position)).toBe(false)
    positions.add(position)
    expect(parts.length).toBeGreaterThan(0)
    for (const [source, part] of parts) {
      expect(single(source)).toBe(true)
      expect(tangut(source)).toBe(true)
      if (part !== null) expect(PARTS.has(part)).toBe(true)
    }
  }
})

test('the 124 parts keep the 56/4 split and only the explicit wholes', () => {
  const parts = Object.values(doc.entries).flatMap(entry => entry.parts)
  expect(parts.length).toBe(124)
  expect(parts.filter(([, part]) => part === 'whole').length).toBe(12)
  expect(parts.filter(([, part]) => part === null).length).toBe(8)
  expect(Object.values(doc.entries).filter(entry => entry.parts.length === 2).length).toBe(56)
  expect(Object.values(doc.entries).filter(entry => entry.parts.length === 3).length).toBe(4)
})

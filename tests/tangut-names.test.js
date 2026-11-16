// The surnames, offices and places on the names page, checked against the work each row is read
// from. A build that loses a name or a citation should fail here.
import { expect, test } from 'bun:test'
import NAMES from '../app/data/tangut-names.json' with { type: 'json' }
import { NAME_SOURCES, NAME_SOURCE_ORDER } from '../app/lib/name-sources.js'

test('every name cites a numbered source, and every source is cited', () => {
  const cited = NAMES.flatMap(row => row.sources)
  for (const key of cited) expect(NAME_SOURCE_ORDER).toContain(key)
  expect(NAME_SOURCE_ORDER.toSorted()).toEqual(Object.keys(NAME_SOURCES).toSorted())
  expect([...new Set(cited)].toSorted()).toEqual(NAME_SOURCE_ORDER.toSorted())
  expect(NAMES.filter(row => !row.sources.length)).toEqual([])
})

test('each row is one of the three kinds in Tangut script', () => {
  for (const row of NAMES) {
    expect(['surname', 'office', 'place']).toContain(row.kind)
    expect(row.tangut.length).toBeGreaterThan(0)
    for (const char of row.tangut) {
      const point = char.codePointAt(0) ?? 0
      expect(point >= 0x17000 && point <= 0x18AFF).toBe(true)
    }
  }
})

test('the page holds the names the sources give', () => {
  expect(NAMES.filter(row => row.kind === 'place').length).toBe(37)
  expect(NAMES.filter(row => row.kind === 'office').length).toBe(6)
  expect(NAMES.filter(row => row.kind === 'surname').length).toBe(14)
})

test('a place keeps the Chinese and location the fragment gives', () => {
  expect(NAMES.find(row => row.tangut === '𗤛𗼵𗥑')).toMatchObject({ chinese: '中興府', modern: 'Yinchuan, Ningxia' })
  expect(NAMES.find(row => row.tangut === '𗙓𘔘𗾩')).toMatchObject({ chinese: '臨河縣', modern: 'Bayannur, Inner Mongolia' })
})

test('the surnames keep the forms and readings their works print', () => {
  expect(NAMES.find(row => row.tangut === '𗼨𗆟')).toMatchObject({ chinese: '嵬名', reading: 'ngwe² mi¹' })
  expect(NAMES.find(row => row.tangut === '𗼽𘝾')).toMatchObject({ chinese: '小李', reading: 'seɯ² li̭e²' })
  expect(NAMES.filter(row => row.tangut.includes('𗩋')).length).toBe(4)
})

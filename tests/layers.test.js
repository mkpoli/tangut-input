// The reading tool's layers, which a reader arranges and the browser stores.
import { expect, test } from 'bun:test'
import { CURRENT, MAX_SIZE, MIN_SIZE, cutLine, defaultLayers, firstSense, layerValue, readLayers } from '../app/lib/layers.js'

test('a reader starts with the chosen reconstruction, 西夏文, 漢字 and English', () => {
  expect(defaultLayers().map(layer => layer.kind)).toEqual(['reading', 'tangut', 'sinograph', 'english'])
  expect(defaultLayers()[0].system).toBe(CURRENT)
})

test('a stored arrangement keeps its order, repeats and sizes', () => {
  const stored = [
    { kind: 'tangut', size: 40 },
    { kind: 'reading', system: 'li_fanwen', size: 12 },
    { kind: 'reading', system: 'gong_xun_202411', size: 13 },
    { kind: 'japanese', size: 11 },
  ]
  expect(readLayers(stored)).toEqual(stored)
})

test('what no longer makes sense drops out, and a size comes back in range', () => {
  expect(readLayers([{ kind: 'gone', size: 12 }, { kind: 'reading', system: 'gone', size: 12 }, { kind: 'tangut', size: 999 }, { kind: 'english', size: 1 }]))
    .toEqual([{ kind: 'tangut', size: MAX_SIZE }, { kind: 'english', size: MIN_SIZE }])
  expect(readLayers([{ kind: 'tangut', size: 'big' }])[0].size).toBe(30)
})

test('nothing usable gives the default', () => {
  for (const stored of [null, 'x', [], [{ kind: 'gone' }], [null]]) expect(readLayers(stored)).toEqual(defaultLayers())
})

const data = {
  entry: { definitions: { en: ['to undergo; to suffer', 'to guard'], ja: ['終わり', '苦しみ'] }, pronunciations: { li_fanwen: 'zar2', gong_xun_202411: 'rzar2' } },
  reading: 'gong_xun_202411',
  downes: 'undergo; bear',
  leilin: [['受', 3], ['遭', 1]],
  rhyme: [85, 2],
  hands: { tibetan: [['A', 'lda', 1, 'ལྡ', 'lda'], ['B', 'g-yi', 13, 'གཡི', 'g.yi']] },
}

test('a reading layer follows the chosen system or keeps to its own', () => {
  expect(layerValue({ kind: 'reading', system: CURRENT, size: 14 }, '𗀅', data).text).toBe('rzar2')
  expect(layerValue({ kind: 'reading', system: 'li_fanwen', size: 14 }, '𗀅', data).text).toBe('zar2')
})

test('a meaning shows its first sense, with all of them on hover', () => {
  expect(layerValue({ kind: 'english', size: 12 }, '𗀅', data)).toEqual({ text: 'to undergo', title: 'to undergo; to suffer; to guard' })
  expect(layerValue({ kind: 'sinograph', size: 17 }, '𗀅', data)).toEqual({ text: '受', title: '受、遭' })
  expect(layerValue({ kind: 'sinograph', size: 17 }, '𗀅', { ...data, leilin: undefined }).text).toBe('')
  expect(layerValue({ kind: 'japanese', size: 12 }, '𗀅', data).text).toBe('終わり')
})

test('English falls back to Downes, and the two can be asked for apart', () => {
  const bare = { ...data, entry: { definitions: {}, pronunciations: {} } }
  expect(layerValue({ kind: 'english', size: 12 }, '𗀅', bare).text).toBe('undergo')
  expect(layerValue({ kind: 'wiktionary', size: 12 }, '𗀅', bare).text).toBe('')
  expect(layerValue({ kind: 'downes', size: 12 }, '𗀅', data).text).toBe('undergo')
})

test('Tibetan shows the commonest spelling in script, with Wylie on hover', () => {
  expect(layerValue({ kind: 'tibetan', size: 12 }, '𗀅', data)).toEqual({ text: 'གཡི', title: 'g.yi' })
  expect(layerValue({ kind: 'tibetan', size: 12 }, '𗀅', { ...data, hands: undefined, glosses: [['sho', 'ཤོ', []]] })).toEqual({ text: 'ཤོ', title: 'sho' })
})

test('a rhyme shows its number and tone', () => {
  expect(layerValue({ kind: 'rhyme', size: 12 }, '𗀅', data).text).toBe('85·2')
  expect(layerValue({ kind: 'rhyme', size: 12 }, '𗀅', { ...data, rhyme: undefined }).text).toBe('')
})

test('a line is cut into columns, marks and gaps', () => {
  expect(cutLine('𗀅。 𗀀', char => char.codePointAt(0) > 0xffff).map(part => part.kind)).toEqual(['tangut', 'mark', 'gap', 'tangut'])
  expect(firstSense('a, b; c')).toBe('a')
})

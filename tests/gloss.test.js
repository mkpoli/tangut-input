import { expect, test } from 'bun:test'
import { hanGloss, englishGloss } from '../app/lib/gloss.js'
import { layerValue } from '../app/lib/layers.js'

test('Chinese definitions do not displace an available English gloss', () => {
  expect(englishGloss({ zh: ['橋'] }, 'bridge')).toBe('bridge')
  expect(englishGloss({ en: ['bridge; crossing'], zh: ['橋'] }, 'a bridge')).toBe('bridge')
  expect(englishGloss({ zh: ['橋'] }, undefined)).toBe('橋')
  expect(englishGloss({}, undefined, ['桥'])).toBe('桥')
})

test('a keyed dictionary sense precedes the Wiktionary and 類林 senses, and identifies its source', () => {
  expect(hanGloss([['程', 1]], ['領土；地方；區域', '界限，邊緣'], ['疆域'])).toEqual({
    text: '領土', title: '領土；地方；區域；界限，邊緣', source: 'keyed',
  })
})

test('a Chinese Wiktionary sense follows the keyed sense and precedes 類林', () => {
  expect(hanGloss([['程', 1]], [], ['領土；地方；區域', '界限，邊緣'])).toEqual({
    text: '領土', title: '領土；地方；區域；界限，邊緣', source: 'wiktionary',
  })
})

test('a whole first phrase survives and only sense separators shorten it', () => {
  expect(hanGloss(undefined, undefined, ['在……的上面'])).toEqual({ text: '在……的上面', title: '在……的上面', source: 'wiktionary' })
})

test('the commonest 類林 word supplies a fallback, with every recorded word on hover', () => {
  expect(hanGloss([['虎', 8], ['獸', 2]], [])).toEqual({ text: '虎', title: '虎、獸', source: 'leilin' })
  expect(hanGloss([['虎', 8]], ['  '])).toEqual({ text: '虎', title: '虎', source: 'leilin' })
  expect(hanGloss([['虎', 8]], [], [])).toEqual({ text: '虎', title: '虎', source: 'leilin' })
})

test('missing Chinese glosses produce no placeholder or invented translation', () => {
  expect(hanGloss(undefined)).toEqual({ text: '', title: '', source: 'leilin' })
  expect(hanGloss([])).toEqual({ text: '', title: '', source: 'leilin' })
})

test('tiles and the 漢字 reading layer select the same gloss and preserve source attribution', () => {
  const leilin = [['水', 7], ['河', 3]]
  expect(layerValue({ kind: 'sinograph', size: 17 }, '𗍊', { reading: '', leilin })).toEqual({ text: '水', title: '水、河' })
  expect(layerValue({ kind: 'sinograph', size: 17 }, '𗋽', { reading: '', leilin, entry: { wiktionary_zh: ['水；河流'] } })).toEqual({ text: '水', title: '水；河流', source: 'wiktionary' })
  expect(layerValue({ kind: 'sinograph', size: 17 }, '𗋽', { reading: '', leilin, entry: { definitions: { zh: ['水；河流'] } } })).toEqual({ text: '水', title: '水；河流', source: 'keyed' })
})

import { expect, test } from 'bun:test'
import { hanGloss, englishGloss } from '../app/lib/gloss.js'
import { layerValue } from '../app/lib/layers.js'

test('Chinese definitions do not displace an available English gloss', () => {
  expect(englishGloss({ zh: ['橋'] }, 'bridge')).toBe('bridge')
  expect(englishGloss({ en: ['bridge; crossing'], zh: ['橋'] }, 'a bridge')).toBe('bridge')
  expect(englishGloss({ zh: ['橋'] }, undefined)).toBe('橋')
})

test('a dictionary sense precedes the contextual 類林 word and identifies its source', () => {
  expect(hanGloss([['程', 1]], ['領土；地方；區域', '界限，邊緣'])).toEqual({
    text: '領土', title: '領土；地方；區域；界限，邊緣', source: 'wiktionary',
  })
})

test('a whole first phrase survives and only sense separators shorten it', () => {
  expect(hanGloss(undefined, ['在……的上面'])).toEqual({ text: '在……的上面', title: '在……的上面', source: 'wiktionary' })
})

test('the commonest 類林 word supplies a fallback, with every recorded word on hover', () => {
  expect(hanGloss([['虎', 8], ['獸', 2]], [])).toEqual({ text: '虎', title: '虎、獸', source: 'leilin' })
  expect(hanGloss([['虎', 8]], ['  ']).text).toBe('虎')
})

test('missing Chinese glosses produce no placeholder or invented translation', () => {
  expect(hanGloss(undefined)).toEqual({ text: '', title: '', source: 'leilin' })
  expect(hanGloss([])).toEqual({ text: '', title: '', source: 'leilin' })
})

test('tiles and the 漢字 reading layer select the same gloss and preserve source attribution', () => {
  const leilin = [['水', 7], ['河', 3]]
  expect(layerValue({ kind: 'sinograph', size: 17 }, '𗍊', { reading: '', leilin })).toEqual({ text: '水', title: '水、河' })
  const definitions = { zh: ['水；河流'] }
  expect(layerValue({ kind: 'sinograph', size: 17 }, '𗋽', { reading: '', leilin, entry: { definitions } })).toEqual({ text: '水', title: 'Wiktionary: 水；河流' })
})

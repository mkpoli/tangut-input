import { expect, test } from 'bun:test'
import { hanGloss } from '../app/lib/gloss.js'
import { layerValue } from '../app/lib/layers.js'

test('the commonest 類林 word is shown, with every recorded word on hover', () => {
  expect(hanGloss([['虎', 8], ['獸', 2]])).toEqual({ text: '虎', title: '虎、獸' })
})

test('missing Chinese glosses produce no placeholder or invented translation', () => {
  expect(hanGloss(undefined)).toEqual({ text: '', title: '' })
  expect(hanGloss([])).toEqual({ text: '', title: '' })
})

test('tiles and the 漢字 reading layer use the same gloss', () => {
  const leilin = [['水', 7], ['河', 3]]
  expect(layerValue({ kind: 'sinograph', size: 17 }, '𗍊', { reading: '', leilin })).toEqual(hanGloss(leilin))
})

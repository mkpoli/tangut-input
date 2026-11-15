import { expect, test } from 'bun:test'
import COINS from '../app/data/tangut-coins.json' with { type: 'json' }
import ERAS from '../app/data/tangut-eras.json' with { type: 'json' }
import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../app/lib/era-sources.js'
import en from '../messages/en.json' with { type: 'json' }
import ja from '../messages/ja.json' with { type: 'json' }
import zhHans from '../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../messages/zh-Hant.json' with { type: 'json' }
import ko from '../messages/ko.json' with { type: 'json' }

// West, Tangut Coins (29 January 2007, Unicode update 1 January 2017), inscription table.
const inscriptions = [
  ['fusheng', 'disputed', ['𗼃𗼕𘏨𘔭', '𗣼𗧯𘏨𘔭']],
  ['daan', 'clear', ['𘜶𗵐𘏨𘔭']],
  ['zhenguan', 'disputed', ['𗣼𘝯𘏨𘔭']],
  ['zhengde', 'disputed', ['𗣼𘇚𘏨𘔭']],
  ['qianyou', 'clear', ['𘀗𘑨𘏨𘔭']],
  ['tianqing', 'clear', ['𘓺𘅝𘏨𘔭']],
]

test('six coin types preserve clockwise legends and disputed interpretations', () => {
  expect(COINS.order).toEqual(['top', 'right', 'bottom', 'left'])
  expect(COINS.coins.map(coin => [coin.id, coin.kind, [...new Set(coin.interpretations.map(row => row.tangut))]]))
    .toEqual(inscriptions)
  expect(COINS.coins[0].interpretations.map(row => row.name)).toEqual(['福聖寶錢', '稟德寶錢'])
  expect(COINS.coins[2].interpretations.map(row => row.name)).toEqual(['貞觀寶錢', '觀德寶錢'])
  expect(COINS.coins[3].interpretations.map(row => row.name)).toEqual(['正德寶錢', '治德寶錢'])
  for (const coin of COINS.coins) for (const row of coin.interpretations) {
    expect([...row.tangut]).toHaveLength(4)
    expect([...row.tangut].slice(2).join('')).toBe('𘏨𘔭')
    const era = ERAS.find(era => era.era === coin.era)
    expect(era?.evidence).toContainEqual({ tangut: [...row.tangut].slice(0, 2).join(''), kind: coin.kind === 'clear' ? 'coin' : 'disputed', source: COINS.source })
  }
})

test('the 1997 dictionary readings and reference numbers stay distinct from other editions', () => {
  const rows = COINS.characters.map(row => [row.char, row.reading, row.chinese, row.xhzd, row.whyj])
  expect(rows).toEqual([
    ['𗵐', 'nej', '安', '0139', '2920'],
    ['𘅝', 'ljwu', '慶', '0305', '3264'],
    ['𗘞', 'lha', '聖', '0480', '1089'],
    ['𘓺', 'ŋwər', '天', '0510', '4454'],
    ['𘑨', 'ꞏwu', '祐', '0645', '4150'],
    ['𘇚', 'mji̲', '治', '0720', '3194'],
    ['𘔭', 'dzjɨj', '錢', '1604', '4429'],
    ['𗧯', 'ꞏji̲j', '稟 = 秉', '2135', '2448'],
    ['𗼕', 'ljo', '福', '2342', '3650'],
    ['𗼃', 'śjɨj', '聖', '2544', '3628'],
    ['𗣼', 'tśhja', '德', '2748', '2239'],
    ['𘀗', 'tshjwu', '乾', '3950', '2781'],
    ['𘜶', 'tha', '大', '4457', '4815'],
    ['𘝯', 'bio̲', '觀', '5593', '4773'],
    ['𘏨', 'ljɨ̣', '寶', '5655', '3824'],
  ])
  const byChar = new Map(COINS.characters.map(row => [row.char, row.reading]))
  const readings = COINS.coins.flatMap(coin => [...new Set(coin.interpretations.map(row => row.tangut))]
    .map(form => [...form].map(char => byChar.get(char)).join(' ')))
  expect(readings).toEqual([
    'śjɨj ljo ljɨ̣ dzjɨj', 'tśhja ꞏji̲j ljɨ̣ dzjɨj', 'tha nej ljɨ̣ dzjɨj',
    'tśhja bio̲ ljɨ̣ dzjɨj', 'tśhja mji̲ ljɨ̣ dzjɨj', 'tshjwu ꞏwu ljɨ̣ dzjɨj', 'ŋwər ljwu ljɨ̣ dzjɨj',
  ])
})

test('coin records cite West and preserve specimen links without inventing a Zhengde example', () => {
  expect(ERA_SOURCE_ORDER).toContain(COINS.source)
  expect(ERA_SOURCES[COINS.source].url).toBe('https://babelstone.co.uk/Blog/2007/01/tangut-coins.html')
  expect(COINS.coins.map(coin => coin.example?.url ?? null)).toEqual([
    'http://www.zeno.ru/showphoto.php?photo=16068',
    'http://www.zeno.ru/showphoto.php?photo=1084',
    'http://www.zeno.ru/showphoto.php?photo=78',
    null,
    'http://www.zeno.ru/showphoto.php?photo=16071',
    'http://www.zeno.ru/showphoto.php?photo=1332',
  ])
})

test('coin labels and uncertainty notes exist in every interface language', () => {
  const keys = Object.keys(en).filter(key => key.startsWith('eras.coins.'))
  for (const catalogue of [en, ja, zhHans, zhHant, ko]) for (const key of keys) {
    expect(catalogue[key]).toBeTruthy()
  }
  for (const id of ['fusheng', 'zhenguan', 'zhengde']) expect(en[`eras.coins.note.${id}`]).toBeTruthy()
})

test('preview images stay on West’s server and keep photographs apart from drawings', () => {
  const kinds = Object.fromEntries(COINS.coins.map(coin => [coin.id, coin.images.map(image => image.kind)]))
  expect(kinds).toEqual({
    fusheng: ['photograph', 'drawing', 'drawing'],
    daan: ['drawing'],
    zhenguan: ['photograph', 'drawing'],
    zhengde: ['photograph', 'drawing'],
    qianyou: ['drawing'],
    tianqing: ['photograph', 'drawing'],
  })
  for (const coin of COINS.coins) for (const image of coin.images) {
    expect(image.src).toMatch(/^https:\/\/www\.babelstone\.co\.uk\/Tangut\/Images\/[A-Za-z]+\.jpg$/)
    expect(image.width).toBeGreaterThan(0)
    expect(image.height).toBeGreaterThan(0)
    expect(['photograph', 'drawing']).toContain(image.kind)
    if (image.kind === 'drawing') expect(coin.interpretations.map(row => row.name)).toContain(image.label)
  }
  expect(COINS.coins[0].images.slice(1).map(image => image.label)).toEqual(['福聖寶錢', '稟德寶錢'])
})

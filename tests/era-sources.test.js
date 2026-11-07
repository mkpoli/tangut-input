import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../app/lib/era-sources.js'
import TITLES from '../app/data/tangut-titles.json' with { type: 'json' }
import STATE_NAMES from '../app/data/tangut-state-names.json' with { type: 'json' }
import CONTEMPORARY_ERAS from '../app/data/tangut-contemporary-eras.json' with { type: 'json' }
import ERAS from '../app/data/tangut-eras.json' with { type: 'json' }
import LATER_ERAS from '../app/data/tangut-later-eras.json' with { type: 'json' }
import en from '../messages/en.json' with { type: 'json' }
import ja from '../messages/ja.json' with { type: 'json' }
import ko from '../messages/ko.json' with { type: 'json' }
import zhHans from '../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../messages/zh-Hant.json' with { type: 'json' }

test('every cited source is in the numbered list', () => {
  const cited = [...TITLES, ...STATE_NAMES].flatMap(row => [...row.tangutSources, ...row.chineseSources, ...(row.noteSources ?? [])])
  for (const key of [...cited, ...CONTEMPORARY_ERAS.map(row => row.source)]) expect(ERA_SOURCE_ORDER).toContain(key)
  expect(ERA_SOURCE_ORDER.toSorted()).toEqual(Object.keys(ERA_SOURCES).toSorted())
})

test('the contemporary Jin era is separate and its Tangut form remains unverified', () => {
  expect(CONTEMPORARY_ERAS).toEqual([{ era: '貞祐', years: [1213, 1217], tangut: null, source: 'lizi2019' }])
  expect(ERAS.some(row => row.era === '貞祐')).toBe(false)
  expect(LATER_ERAS.some(row => row.era === '貞祐')).toBe(false)
  expect(ERA_SOURCES.lizi2019.url).toBe('https://collection.sina.com.cn/qbtd/2019-04-10/doc-ihvhiqax1350522.shtml')
  expect(ERA_SOURCES.lizi2019.author).toBe('西夏泉女——李子999')
  expect(ERA_SOURCES.lizi2019.where).toContain('2019-04-10')
})

test('the contemporary table retains its column headers on small screens', () => {
  const page = readFileSync(new URL('../app/pages/Eras.svelte', import.meta.url), 'utf8')
  expect(page).toContain('class="ui-table list contemporary-table"')
  expect(page).toMatch(/\.contemporary-table thead\{display:table-header-group;[^}]*clip-path:inset\(50%\)/)
})

test('every locale describes the contemporary entry and its uncertainty', () => {
  for (const messages of [en, ja, ko, zhHans, zhHant]) {
    for (const key of ['tab', 'title', 'unverified', 'tentative', 'note']) {
      expect(messages[`eras.contemporary.${key}`]).toBeTruthy()
    }
  }
})

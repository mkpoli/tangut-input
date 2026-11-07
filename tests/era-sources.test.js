import { expect, test } from 'bun:test'
import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../app/lib/era-sources.js'
import TITLES from '../app/data/tangut-titles.json' with { type: 'json' }
import STATE_NAMES from '../app/data/tangut-state-names.json' with { type: 'json' }
import ERAS from '../app/data/tangut-eras.json' with { type: 'json' }

test('every cited source is in the numbered list', () => {
  const cited = [...TITLES, ...STATE_NAMES].flatMap(row => [...row.tangutSources, ...row.chineseSources, ...(row.noteSources ?? [])])
  for (const key of cited) expect(ERA_SOURCE_ORDER).toContain(key)
  expect(ERA_SOURCE_ORDER.toSorted()).toEqual(Object.keys(ERA_SOURCES).toSorted())
})

test('光定 cites the manuscript colophon transcription', () => {
  const era = ERAS.find(row => row.era === '光定')
  expect(era?.evidence).toContainEqual({ tangut: '𗪚𗏴', kind: 'text', source: 'ma2023' })
  expect(ERA_SOURCE_ORDER).toContain('ma2023')
  expect(ERA_SOURCES.ma2023.url).toBe('https://real.mtak.hu/191670/1/062-article-p239.pdf#page=27')
})

test('乾定 cites the manuscript transcription', () => {
  const era = ERAS.find(row => row.era === '乾定')
  expect(era?.evidence).toContainEqual({ tangut: '𘀗𗪚', kind: 'text', source: 'qianding1226' })
  expect(ERA_SOURCE_ORDER).toContain('qianding1226')
  expect(ERA_SOURCES.qianding1226.url).toBe('https://weibo.com/6008710471/KbTyK101X')
})

import { expect, test } from 'bun:test'
import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../app/lib/era-sources.js'
import TITLES from '../app/data/tangut-titles.json' with { type: 'json' }

test('every cited source is in the numbered list', () => {
  const cited = TITLES.flatMap(title => [...title.tangutSources, ...title.chineseSources])
  for (const key of cited) expect(ERA_SOURCE_ORDER).toContain(key)
  expect(ERA_SOURCE_ORDER.toSorted()).toEqual(Object.keys(ERA_SOURCES).toSorted())
})

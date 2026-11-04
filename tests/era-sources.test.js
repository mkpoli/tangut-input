import { expect, test } from 'bun:test'
import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../app/lib/era-sources.js'
import TITLES from '../app/data/tangut-titles.json' with { type: 'json' }
import STATE_NAMES from '../app/data/tangut-state-names.json' with { type: 'json' }

test('every cited source is in the numbered list', () => {
  const cited = [...TITLES, ...STATE_NAMES].flatMap(row => [...row.tangutSources, ...row.chineseSources, ...(row.noteSources ?? [])])
  for (const key of cited) expect(ERA_SOURCE_ORDER).toContain(key)
  expect(ERA_SOURCE_ORDER.toSorted()).toEqual(Object.keys(ERA_SOURCES).toSorted())
})

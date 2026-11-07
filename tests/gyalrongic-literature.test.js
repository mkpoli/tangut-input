import { expect, test } from 'bun:test'
import { GROUPS, LITERATURE } from '../app/lib/gyalrongic-literature.js'
import en from '../messages/en.json' with { type: 'json' }
import ja from '../messages/ja.json' with { type: 'json' }
import ko from '../messages/ko.json' with { type: 'json' }
import zhHans from '../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../messages/zh-Hant.json' with { type: 'json' }

const WORKS = Object.values(LITERATURE).flat()

test('every group has works, and every work belongs to a listed group', () => {
  expect(Object.keys(LITERATURE).toSorted()).toEqual(GROUPS.map(group => group.id).toSorted())
  for (const group of GROUPS) expect(LITERATURE[group.id].length).toBeGreaterThan(0)
})

test('each work has one https link of its own', () => {
  const urls = WORKS.map(work => work.url)
  expect(new Set(urls).size).toBe(urls.length)
  for (const url of urls) expect(url).toStartWith('https://')
})

test('works run oldest first, with undated resources last', () => {
  for (const works of Object.values(LITERATURE)) {
    const years = works.map(work => work.year ?? Infinity)
    expect(years).toEqual(years.toSorted((a, b) => a - b))
  }
})

test('every catalogue names the groups and kinds the list uses', () => {
  const keys = [
    'gyalrongic.title', 'gyalrongic.intro', 'gyalrongic.toc', 'gyalrongic.free', 'gyalrongic.more',
    ...GROUPS.map(group => `gyalrongic.group.${group.id}`),
    ...new Set(WORKS.map(work => `gyalrongic.kind.${work.kind}`)),
  ]
  for (const messages of [en, ja, ko, zhHans, zhHant]) {
    for (const key of keys) expect(messages[key], key).toBeString()
  }
})

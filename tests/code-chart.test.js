// The code chart reads the four Unicode blocks the site draws, pages them 16 rows at a time, and
// counts what the records hold in each. These are the figures the page shows.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { buildPartIndex } from '../app/lib/composition.js'
import { SURROUNDING } from '../app/lib/variants.js'
import { blockUseAll, chartPages, componentUse, PER_PAGE, pageRange, rangeLabel } from '../app/lib/code-chart.js'

const json = name => JSON.parse(gunzipSync(readFileSync(new URL(`../app/data/${name}`, import.meta.url))).toString())
const recorded = json('tangut-entries.json.gz').rows.map(row => ({ char: row[0], composition: row[1] ?? undefined }))
const supplement = json('tangut-supplement.json.gz').characters
const entries = [...recorded, ...supplement.filter(record => record.block === 'supplement').map(record => ({ char: record.char, composition: record.ids }))]
const characters = new Set(entries.map(entry => entry.char))
const components = new Set(json('tangut-cangjie.json.gz').filter(([, code]) => code.startsWith('p')).map(([char]) => char))

test('every character and component has a block, and the blocks hold the counts the page shows', () => {
  expect(characters.size).toBe(6177)
  expect(components.size).toBe(883)
  const blocks = blockUseAll(characters, components)
  expect(blocks.map(block => [block.key, block.assigned, block.positions])).toEqual([
    ['tangut', 6144, 6144],
    ['components', 768, 768],
    ['supplement', 33, 128],
    ['supplementComponents', 115, 128],
  ])
  expect(blocks.map(block => block.range)).toEqual([
    'U+17000–U+187FF', 'U+18800–U+18AFF', 'U+18D00–U+18D7F', 'U+18D80–U+18DFF',
  ])
  expect(rangeLabel(0x18D00, 0x18D7F)).toBe('U+18D00–U+18D7F')
})

test('each page is sixteen rows of sixteen positions, starting on a row boundary', () => {
  const charactersPages = chartPages('characters', characters)
  const componentsPages = chartPages('components', components)
  expect(charactersPages).toHaveLength(25)
  expect(componentsPages).toHaveLength(4)
  for (const page of [...charactersPages, ...componentsPages]) {
    expect(page.cells).toHaveLength(PER_PAGE)
    expect(page.start % 16).toBe(0)
  }
  expect(charactersPages[0].start).toBe(0x17000)
  expect(charactersPages[0].cells[0]).toBe('𗀀')
  expect(charactersPages[24].start).toBe(0x18D00)
  expect(charactersPages[24].cells.filter(Boolean)).toHaveLength(33)
  expect(charactersPages[24].cells.slice(0, 33)).toEqual([...Array(33)].map((_, index) => String.fromCodePoint(0x18D00 + index)))
  expect(componentsPages[0].start).toBe(0x18800)
  expect(componentsPages[3].start).toBe(0x18D80)
  expect(componentsPages[3].cells.filter(Boolean)).toHaveLength(115)
  // A component position is empty in the characters chart, and a character position in the components chart.
  expect(charactersPages[24].cells[0x80]).toBe(null)
  expect(componentsPages[3].cells[0]).toBe('𘶀')
  expect(pageRange(charactersPages[0])).toBe('U+17000–U+170FF')
  expect(pageRange(charactersPages[24])).toBe('U+18D00–U+18D20')
  expect(pageRange(componentsPages[3])).toBe('U+18D80–U+18DF2')
})

test('the components the records use, unused and most-used, fill the distribution', () => {
  const index = buildPartIndex(entries, SURROUNDING)
  const use = componentUse(components, index.usedBy)
  expect(use.total).toBe(883)
  expect(use.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(883)
  expect(use.buckets[0]).toEqual({ label: '0', count: 178, share: 178 / 883 })
  expect(use.top).toHaveLength(6)
  expect(use.top[0]).toEqual({ char: '𘢌', uses: 1266 })
  expect(use.top.every((row, index) => index === 0 || row.uses <= use.top[index - 1].uses)).toBe(true)
})

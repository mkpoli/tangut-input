// Other descriptions of a character read beside the recorded one: they find the character from the
// parts they name, and the recorded description keeps the structure the card draws.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { buildPartIndex, matchByParts, readDescription } from '../app/lib/composition.js'

const data = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
/** @type {{ char: string, composition?: string }[]} */
const entries = data.rows.map((/** @type {any[]} */ row) => ({ char: row[0], composition: row[1] ?? undefined }))
const aliases = JSON.parse(readFileSync(new URL('../app/data/tangut-ids-aliases.json', import.meta.url), 'utf8')).rows
const index = buildPartIndex(entries, aliases)
const tsv = readFileSync(new URL('../data/tangut-ids-aliases.tsv', import.meta.url), 'utf8')
  .split('\n')
  .filter(line => line && !line.startsWith('#'))
  .map(line => {
    const [char, ids, source, detail, lang] = line.split('\t').map(field => field.trim())
    return { char, ids, source, detail, ...(lang ? { lang } : {}) }
  })

test('an alias finds the character from the parts it names', () => {
  // 𘋤 is recorded as ⿰𘦘⿰𘠣⿰𘤣𘠢; NGWU YOH reads it as 𘋢 enclosing 𘠣.
  expect(aliases.find((/** @type {any} */ row) => row.char === '𘋤')?.ids).toBe('⿴𘋢𘠣')
  expect(index.usedBy.get('𘋢')?.has('𘋤')).toBe(true)
  expect(index.usedBy.get('𘠣')?.has('𘋤')).toBe(true)
  expect(matchByParts(index, ['𘋢', '𘠣'])).toContain('𘋤')
})

test('an alias opens a layout the record does not', () => {
  expect(index.descriptionGroups.get('𘋤')?.map(view => view.op)).toEqual(['⿰', '⿴'])
})

test('the layout and the parts are read from one description', () => {
  // ⿰𘤣𘠢 is a part of the record; the alias is the only description that opens with ⿴.
  expect(matchByParts(index, ['𘋢'], '⿴')).toContain('𘋤')
  expect(matchByParts(index, ['𘋢'], '⿰')).not.toContain('𘋤')
  expect(matchByParts(index, ['⿰𘤣𘠢'], '⿰')).toContain('𘋤')
  expect(matchByParts(index, ['⿰𘤣𘠢'], '⿴')).not.toContain('𘋤')
})

test('the recorded description still decides the direct parts', () => {
  expect(index.directPartsOf.get('𘋤')).toEqual(['𘋝', '⿰𘠣⿰𘤣𘠢'])
})

test('two readings of one glyph do not count a part twice', () => {
  expect(index.partsOf.get('𘋤')?.get('𘠣')).toBe(1)
  expect(index.partsOf.get('𘋤')?.get('𘤣')).toBe(1)
  expect(index.partsOf.get('𘋤')?.get('𘦘')).toBe(1)
  expect(matchByParts(index, ['𘠣', '𘠣'])).not.toContain('𘋤')
})

test('an alias part is found through a character that holds the aliased one', () => {
  // A character built from 𘋤 holds the parts of every reading of it, at every depth.
  const composite = buildPartIndex([...entries, { char: '𗀁', composition: '⿰𘋤𘠀' }], aliases)
  expect(matchByParts(composite, ['𘋤', '𘠀'])).toContain('𗀁')
  expect(matchByParts(composite, ['𘋢', '𘠀'])).toContain('𗀁')
})

test('the site copy is the source table', () => {
  expect(aliases).toEqual(tsv)
})

test('the quoted detail says which language it is', () => {
  for (const row of aliases) {
    if (row.detail) expect(row.lang).toMatch(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
  }
})

test('an alias on a supplement character is indexed like any other', () => {
  // The app appends the supplement's ideographs to its entries before the index is built.
  const supplement = [{ char: '𘴀', composition: '⿰𘠐⿱𘠚𘡃' }]
  const aliased = buildPartIndex([...entries, ...supplement], [...aliases, { char: '𘴀', ids: '⿰𘠐𘠡' }])
  expect(aliased.descriptionGroups.get('𘴀')).toHaveLength(2)
  expect(matchByParts(aliased, ['𘠡'])).toContain('𘴀')
})

test('every alias is one complete description, sourced, and not the recorded one', () => {
  const recorded = new Map(entries.map(entry => [entry.char, entry.composition]))
  for (const row of aliases) {
    const read = readDescription(row.ids)
    expect(read.complete).toBe(true)
    expect(read.roots).toHaveLength(1)
    expect(row.ids).not.toBe(recorded.get(row.char))
    expect(row.source.trim()).not.toBe('')
  }
})

test('a character may carry several aliases', () => {
  const two = buildPartIndex(
    [{ char: '𘋤', composition: '⿰𘦘⿰𘠣⿰𘤣𘠢' }],
    [
      { char: '𘋤', ids: '⿴𘋢𘠣' },
      { char: '𘋤', ids: '⿴𘋢𘠢' },
    ],
  )
  expect(two.usedBy.get('𘋢')?.has('𘋤')).toBe(true)
  expect(two.usedBy.get('𘠢')?.has('𘋤')).toBe(true)
})

test('a subtraction alias reads beside the record', () => {
  const row = aliases.find((/** @type {any} */ alias) => alias.char === '𘖨')
  expect(row?.ids).toBe('⿱𘨞㇯𗀋𘠀')
  expect(readDescription(row.ids)).toEqual({
    roots: [{ op: '⿱', parts: ['𘨞', { op: '㇯', parts: ['𗀋', '𘠀'] }] }],
    complete: true,
  })
  expect(index.usedBy.get('𗀋')?.has('𘖨')).toBe(true)
})

test('one character carries two readings', () => {
  expect(aliases.filter((/** @type {any} */ row) => row.char === '𗊳').map(row => row.ids)).toEqual([
    '⿰𘠣⿽𗎘𘠚',
    '⿶𗊈𘠚',
  ])
})

test('an alias opens from the lower right', () => {
  const row = aliases.find((/** @type {any} */ alias) => alias.char === '𗅍')
  expect(row?.ids).toBe('⿰𘠐⿽𗎘𘠚')
  expect(readDescription(row.ids).complete).toBe(true)
})

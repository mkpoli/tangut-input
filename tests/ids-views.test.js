import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { indexIdsDescriptions, idsViews } from '../app/lib/ids-views.js'

const entries = [
  { char: '𗀀', composition: '⿰𘠀𘠁' },
  { char: '𗀁', composition: '𘠂' },
  { char: '𗀂', composition: '⿰𘠃𘠄' },
  { char: '𗀃', composition: '⿰𘠃𘠄' },
  { char: '𗀄', composition: '⿱⿰𘠀𘠁𘠂' },
  { char: '𗀅', composition: '⿰𘠅' },
]
const index = indexIdsDescriptions(entries)
const view = (char, text) => idsViews(char, text, index)

test('replaces maximal proper matching subtrees and retains operators', () => {
  expect(view('𗀆', '⿲⿱⿰𘠀𘠁𘠂⿰𘠀𘠁𘠂').editorial).toBe('⿲𗀄𗀀𗀁')
  expect(view('𗀄', '⿱⿰𘠀𘠁𘠂').editorial).toBe('⿱𗀀𗀁')
  expect(view('𗀀', '⿰𘠀𘠁').editorial).toBe('⿰𘠀𘠁')
  expect(view('𗀆', '𘠂').editorial).toBe('𘠂')
})

test('both complete views remain available when identical', () => {
  expect(view('𗀀', '⿰𘠀𘠁').showEditorial).toBe(true)
  expect(view('𗀆', '⿰').showEditorial).toBe(false)
  expect(view('𗀆', '⿲𘠅⿱⿰𘠀𘠁𘠂').showEditorial).toBe(false)
})

test('a nested unmatched tree retains its exact operands', () => {
  expect(view('𗀆', '⿰⿱𘠅𘠆⿻𘠇𘠈').editorial).toBe('⿰⿱𘠅𘠆⿻𘠇𘠈')
})

test('ambiguous matches retain their structure and self is excluded', () => {
  expect(view('𗀆', '⿱⿰𘠃𘠄𘠂').editorial).toBe('⿱⿰𘠃𘠄𗀁')
  expect(view('𗀂', '⿱⿰𘠃𘠄𘠂').editorial).toBe('⿱𗀃𗀁')
})

test('incomplete operators and multiple roots remain visible without invented splits', () => {
  expect(view('𗀆', '⿲𘠅⿱⿰𘠀𘠁𘠂').editorial).toBe('⿲𘠅⿱⿰𘠀𘠁𘠂')
  expect(view('𗀆', '⿱⿰𘠅𘠂').editorial).toBe('⿱⿰𘠅𘠂')
  expect(view('𗀆', '⿰𘠀𘠁⿱𘠂').editorial).toBe('⿰𘠀𘠁⿱𘠂')
  expect(view('𗀆', '⿰').editorial).toBe('⿰')
})

test('parts preserve repeats and the recorded text is unchanged', () => {
  const result = view('𗀆', '⿰⿰𘠀𘠁⿰𘠀𘠁')
  expect(result.recorded).toBe('⿰⿰𘠀𘠁⿰𘠀𘠁')
  expect(result.recordedParts).toEqual(['𘠀', '𘠁', '𘠀', '𘠁'])
  expect(result.editorialParts).toEqual(['𗀀', '𗀀'])
})

test('source data retains a ternary tree and infers one-component characters', () => {
  const data = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  const source = data.rows.map((row) => ({ char: row[0], composition: row[1] ?? undefined }))
  const sourceIndex = indexIdsDescriptions(source)
  const character = source.find((entry) => entry.char === '𗀮')
  const result = idsViews(character.char, character.composition, sourceIndex)
  expect(result.recorded).toBe('⿱𘠀⿲𘨷𘨷𘠢')
  expect(result.editorial).toContain('⿲𘘤𘘤')
  expect(result.editorialParts.filter(part => part === '𘘤')).toHaveLength(2)
})

// The Japanese shape names for Tangut components, in the table the parts finder searches and in the
// copy the site's Find page reads.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createNameSearch, readNames } from '../src/core/names.js'
import { indexShapeSpellings, searchShapeNames, searchShapeSpellings, spellShape } from '../app/lib/names.js'

const names = readNames(readFileSync(new URL('../data/component-names.tsv', import.meta.url), 'utf8'))
const search = createNameSearch(names)
const app = JSON.parse(readFileSync(new URL('../app/data/tangut-component-names.json', import.meta.url), 'utf8')).names
const comparison = JSON.parse(readFileSync(new URL('../app/data/tangut-part-names.json', import.meta.url), 'utf8'))

const SHAPE_SOURCES = new Set(['arakawa-2023', 'ja-wikipedia-tangut', 'NGWU YOH, chat message, 2026-11-10'])

const TANGUT = [
  ['くノ', '𘫺'],
  ['ノメ', '𘡃'],
  ['ノノメ', '𘢌'],
  ['ノメメ', '𘤊'],
  ['くくノ', '𘫽'],
  ['くノ﹅', '𘢒'],
  ['ノくノ﹅', '𘤆'],
  ['くくノ﹅', '𘦄'],
  ['コくノ﹅', '𘧆'],
  ['くノ﹅ノメ', '𘧶'],
  ['ノ匕﹅', '𘢕'],
  ['ノノ匕﹅', '𘤈'],
  ['一匕﹅', '𘡴'],
  ['二匕﹅', '𘣒'],
  ['ソ一匕﹅', '𘦜'],
  ['ラ匕﹅', '𘣭'],
  ['コ匕﹅', '𘤾'],
  ['コ一匕﹅', '𘦺'],
  ['コくノ', '𘫿'],
]

test('the nineteen Tangut components are named by their Japanese shapes', () => {
  const found = new Map(names
    .filter(name => SHAPE_SOURCES.has(name.source))
    .map(name => [name.name, name.char]))
  expect(found).toEqual(new Map(TANGUT))
})

test('the Tangut source table is the one that was merged', () => {
  const source = readFileSync(new URL('../data/tangut-component-names.tsv', import.meta.url), 'utf8')
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [name, char] = line.split('\t')
      return [name, char]
    })
  expect(source).toEqual(TANGUT)
})

test('the site copy holds the same rows as the source table', () => {
  const source = new Map(readFileSync(new URL('../data/tangut-component-names.tsv', import.meta.url), 'utf8')
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [name, char, from, detail] = line.split('\t')
      return [name, { char, source: from, detail, credit: from === 'arakawa-2023' ? 'Arakawa 2023' : from === 'ja-wikipedia-tangut' ? 'Arakawa 2020 · Japanese Wikipedia' : from.split(',')[0] }]
    }))
  const site = new Map(app.map(row => [row.name, { char: row.char, source: row.source, detail: row.detail, credit: row.credit }]))
  expect(site).toEqual(source)
})

test('the comparison table covers every named part', () => {
  expect(comparison.languages).toEqual(['ja', 'en', 'zh', 'ru', 'ko'])
  expect(new Set(comparison.rows.map(row => row.char))).toEqual(new Set(TANGUT.map(([, char]) => char)))
  for (const row of comparison.rows) expect(row.names.ja.length).toBeGreaterThan(0)
})

test('a shape name reaches its component first', () => {
  for (const [name, char] of TANGUT) {
    expect(search.search(name)[0]).toMatchObject({ char, label: name, score: 0 })
    // The search folds katakana to hiragana, so the same name typed in hiragana works.
    expect(search.search([...name].map(kana => kana === 'ノ' ? 'の' : kana).join(''))[0].char).toBe(char)
    expect(searchShapeNames(app, name)[0]).toMatchObject({ char, name, tier: 0 })
  }
})

const entries = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  .rows.map(row => ({ char: row[0], composition: row[1] ?? undefined }))
const spellings = indexShapeSpellings(entries, app)

test('a character reads as the names of its parts run together', () => {
  // 𘄳 is ⿰𘫿𘢌: コくノ and ノノメ.
  expect(spellings.get('𘄳')).toEqual(['コくノノノメ'])
  for (const query of ['コくノノノメ', 'コクノノノメ', 'こくのののめ']) {
    expect(searchShapeSpellings(spellings, query)).toEqual([{ char: '𘄳', spelling: 'コくノノノメ' }])
  }
})

test('a description with a part that has no name spells nothing', () => {
  // Most characters mix parts that have a name with parts that do not.
  expect(spellings.has('𗀀')).toBe(false)
})

test('only a complete description with one root spells', () => {
  const namesOf = new Map([['𘫿', ['コくノ']], ['𘢌', ['ノノメ']]])
  expect(spellShape('⿰𘫿𘢌', namesOf)).toEqual(['コくノノノメ'])
  expect(spellShape('𘫿𘢌', namesOf)).toEqual([])
  expect(spellShape('⿰𘫿', namesOf)).toEqual([])
  // A placeholder operand is not a named component.
  expect(spellShape('⿱？𘢌', namesOf)).toEqual([])
})

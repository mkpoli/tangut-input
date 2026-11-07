import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { buildTangutHanzi } from '../scripts/build_tangut_hanzi.mjs'

const built = buildTangutHanzi()
const generatedText = readFileSync(new URL('../app/data/tangut-hanzi.json', import.meta.url), 'utf8')
const leilin = JSON.parse(readFileSync(new URL('../app/data/tangut-leilin.json', import.meta.url), 'utf8'))

test('the bundled correspondences reproduce exactly from pinned local inputs', () => {
  expect(JSON.stringify(built) + '\n').toBe(generatedText)
  expect(buildTangutHanzi()).toEqual(built)
})

test('every literal Han-containing 類林 gloss keeps its character, complete wording and count', () => {
  const expected = Object.entries(leilin.glosses).flatMap(([tangut, glosses]) => glosses
    .filter(([hanzi]) => /\p{Script=Han}/u.test(hanzi))
    .map(([hanzi, count]) => [tangut, hanzi, count]))
  const actual = built.records.filter(row => row.kind === 'gloss')
  expect(actual.map(row => [row.tangut, row.hanzi, row.evidence[0].count])).toEqual(expected)
  expect(actual.find(row => row.tangut === '𗂧')).toMatchObject({ hanzi: '國', evidence: [{ source: 'leilin', role: 'gloss', count: 172 }] })
  expect(actual.some(row => row.hanzi === '???' || row.hanzi === 'ꜱᴜᴘᴇ')).toBe(false)
  expect(actual.some(row => row.tangut === '𘴄')).toBe(true)
  expect(actual.some(row => row.tangut === '𘴈')).toBe(true)
})

test('Names retain whole phrases, partial-title punctuation and separate source roles', () => {
  const state = built.records.find(row => row.kind === 'state' && row.hanzi === '大白高國')
  expect(state).toMatchObject({ tangut: '𗴂𗹭𗂧𘜶', basis: 'text' })
  expect(state.evidence).toContainEqual({ source: 'commons', role: 'chinese' })
  expect(state.evidence).toContainEqual({ source: 'stele1094', role: 'tangut', place: 'wikisource:𗴂𗹭𗂧𘜶𘍞𗃛𗉔𗿣𗿷𗽔𘗣𗗙𘐆𘝞' })
  const partial = built.records.find(row => row.kind === 'title' && row.holder === '崇宗' && row.identified === 'decoded')
  expect(partial).toMatchObject({ tangut: '𗸯𗑗𘓺𘋨', hanzi: '…仁净皇帝', basis: 'text' })
  const names = built.records.filter(row => row.kind !== 'gloss')
  expect(names.every(row => [...row.tangut].length > 1)).toBe(true)
  expect(names.some(row => row.hanzi === '西夏' || row.hanzi === '白上国' || row.tangut === '𗼇𗂧')).toBe(false)
})

test('the same era form retains coin and text evidence without merging their tiers', () => {
  const forms = built.records.filter(row => row.kind === 'era' && row.hanzi === '大安')
  expect(forms.map(row => row.basis)).toEqual(['coin', 'text'])
  expect(forms.find(row => row.basis === 'coin').evidence).toContainEqual({ source: 'west2007', role: 'tangut', kind: 'coin' })
  expect(forms.find(row => row.basis === 'text').evidence).toContainEqual({ source: 'stele1094', role: 'tangut', kind: 'text', place: 'wikisource:𗴂𗹭𗂧𘜶𘍞𗃛𗉔𗿣𗿷𗽔𘗣𗗙𘐆𘝞' })
  const zhenguan = built.records.filter(row => row.kind === 'era' && row.hanzi === '貞觀')
  expect(zhenguan.map(row => row.basis)).toEqual(['disputed', 'gloss'])
  expect(zhenguan.find(row => row.basis === 'gloss').evidence).toContainEqual({ source: 'kychanov2010', role: 'tangut', kind: 'gloss', place: 'lcdtt:貞觀政要' })
})

test('calendar forms, conflicting posts and unknown-form reports remain distinguishable', () => {
  const forms = built.records.filter(row => row.kind === 'era' && row.hanzi === '天賜禮盛國慶')
  expect(forms.map(row => [row.tangut, row.basis])).toEqual([
    ['𘀗𗙀𗅲𗯿𗂧𗴴', 'calendar'], ['𘓺𗙀𗅲𗯿𗂧𗴴', 'post'],
  ])
  for (const row of forms) expect(row.evidence).toContainEqual({ source: 'nie2004', role: 'note', kind: 'unknown' })
  const later = built.records.find(row => row.kind === 'era' && row.hanzi === '至元' && row.later)
  expect(later).toMatchObject({ tangut: '𗫡𗪟', basis: 'post', evidence: [{ source: 'zoenshiueh2026', role: 'tangut', kind: 'post' }] })
})

test('weak captions, uncertain decoding and quoted Chinese retain their caveats', () => {
  const posthumous = built.records.find(row => row.kind === 'posthumous')
  expect(posthumous).toMatchObject({ hanzi: '昭簡皇帝', tangut: '𗭼𘜶𘓺𘋨', basis: 'reported', holder: '桓宗' })
  expect(posthumous.evidence).toContainEqual({ source: 'songshi', role: 'chinese', quote: '謚曰昭簡皇帝，廟號桓宗，陵號莊陵' })
  expect(built.sources.commons.note).toContain('a weak source')
  expect(built.sources.sun2021.note).toContain('糂 is uncertain')
  expect(built.sources.leilin.note).toContain(leilin.note)
  expect(built.sources.leilin.via).toBe(leilin.via)
  for (const row of built.records) {
    expect(row.tangut).not.toBe('')
    expect(/\p{Script=Han}/u.test(row.hanzi)).toBe(true)
    expect(row.evidence.length).toBeGreaterThan(0)
    for (const evidence of row.evidence) expect(built.sources[evidence.source]).toBeDefined()
  }
})

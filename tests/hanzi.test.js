import { expect, test } from 'bun:test'
import library from '../app/data/tangut-hanzi.json' with { type: 'json' }
import { hanziQuery, indexHanzi, searchHanziGlosses, searchHanziNames } from '../app/lib/hanzi.js'

const index = indexHanzi(library)

test('錢 finds the attested 類林 gloss for 𘔭 with its citation and count', () => {
  const hit = searchHanziGlosses(index, '錢').find(hit => hit.char === '𘔭')
  expect(hit).toMatchObject({ tier: 0, record: { hanzi: '錢', kind: 'gloss' } })
  expect(hit.record.evidence[0].source).toBe('leilin')
  expect(hit.record.evidence[0].count).toBeGreaterThan(0)
})

test('literary gloss search retains secondary senses and supplementary Tangut', () => {
  expect(searchHanziGlosses(index, '鋼').map(hit => hit.char)).toContain('𗁀')
  for (const char of ['𘴄', '𘴈']) {
    const record = index.glosses.get(char)[0]
    expect(searchHanziGlosses(index, record.hanzi).map(hit => hit.char)).toContain(char)
  }
})

test('whole state names answer searches without aligning characters by position', () => {
  const hits = searchHanziNames(index, '大白高國')
  expect(hits).toHaveLength(1)
  expect(hits[0]).toMatchObject({ tier: 0, record: { tangut: '𗴂𗹭𗂧𘜶', hanzi: '大白高國' } })
  expect(searchHanziNames(index, '高國').map(hit => hit.record.tangut)).toContain('𗴂𗹭𗂧𘜶')
  // The source gives a name as a unit, and its word order differs from the Chinese.
  expect(searchHanziGlosses(index, '高').some(hit => hit.char === '𗂧')).toBe(false)
  expect(index.glosses.has('𗴂𗹭𗂧𘜶')).toBe(false)
})

test('repeated name forms share one result while retaining every evidence tier', () => {
  const hits = searchHanziNames(index, '大安')
  expect(hits).toHaveLength(1)
  expect(hits[0].records.map(record => record.basis)).toEqual(['coin', 'text'])
  expect(hits[0].records.flatMap(record => record.evidence).some(item => item.place)).toBe(true)
  expect(searchHanziNames(index, '天賜禮盛國慶')).toHaveLength(2)
  expect(searchHanziNames(index, '貞觀')[0].records.map(record => record.basis)).toEqual(['disputed', 'gloss'])
})

test('name fragments stay whole and keep editorial identification', () => {
  const hit = searchHanziNames(index, '仁净皇帝').find(hit => hit.record.holder === '崇宗')
  expect(hit.record).toMatchObject({ hanzi: '…仁净皇帝', identified: 'decoded', tangut: '𗸯𗑗𘓺𘋨' })
  const codes = searchHanziNames(index, '天生圆能')[0]
  expect(codes.record.identified).toBe('codes')
})

test('literal queries do not invent simplified spellings or match non-Han labels', () => {
  expect(hanziQuery('  國  ')).toBe('國')
  expect(searchHanziNames(index, '')).toEqual([])
  expect(searchHanziNames(index, '???')).toEqual([])
  expect(searchHanziGlosses(index, 'ꜱᴜᴘᴇ')).toEqual([])
  const fixture = indexHanzi({ format: 'tangut-input/hanzi', sources: {}, records: [
    { tangut: '𗂧', hanzi: '國', kind: 'gloss', basis: 'text', evidence: [] },
  ] })
  expect(searchHanziGlosses(fixture, '国')).toEqual([])
})

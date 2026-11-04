// The data files the site ships, checked against numbers taken from their sources. A builder or a
// re-pack that changes the content should fail here before it reaches the site.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const json = name => JSON.parse(gunzipSync(readFileSync(new URL(`../app/data/${name}`, import.meta.url))).toString())
const entries = json('tangut-entries.json.gz')
const rhymes = json('tangut-rhymes.json.gz')

test('the packed records keep every character, the five Wiktionary readings and Gong Xun\'s', () => {
  expect(entries.format).toBe('tangut-input/entries/3')
  expect(entries.rows.length).toBe(6144)
  expect(entries.systems).toEqual(['li_fanwen', 'gong_xun_202411', 'miyake', 'kychanov', 'sofronov', 'nishida'])
  const first = entries.rows[0]
  expect(first[0]).toBe('𗀀')
  expect(first[7]).toEqual(['do1', 'do̱1', 'do1', 'ndo1', 'ndo1', 'ndɔɦ1'])
  expect(first[4]).toEqual(['poison; venom; toxin', 'poisonous; venomous; noxious'])
  expect(first[5]).toEqual(['毒'])
  expect(first[6]).toEqual([])
  expect(first[8]).toBe('Composed of the middle of 𘊓 "scorpion" and the right of "𗀋".')
  expect(first[9]).toBe('蝎中蛇右。')
})

test('the 文海 text is kept for the entries it carries', () => {
  expect(entries.rows.filter(row => row[8]).length).toBe(12)
  expect(entries.rows.filter(row => row[9]).length).toBe(6)
})

test('the displayable meanings cover only the Wiktionary entries', () => {
  const count = column => entries.rows.filter(row => row[column]?.length).length
  expect(count(4)).toBe(457)
  expect(count(5)).toBe(278)
  expect(count(6)).toBe(0)
})

test('every Tibetan spelling stands at a crossing the chart draws', () => {
  const { cells } = JSON.parse(readFileSync(new URL('../app/data/tangut-tibetan-rhymes.json', import.meta.url), 'utf8'))
  const drawn = new Set(Object.values(rhymes.chars).map(row => `${row[0]}·${row[1]}`))
  expect(Object.keys(cells).filter(key => !drawn.has(key))).toEqual([])
  expect(Object.keys(cells).length).toBe(124)
  // 2.1 is rhyme 1 in the rising tone, 2.9 rhyme 10: the two tones number their rhymes apart.
  expect(cells['1·2'].Ⅰ).toEqual(['ཕུ'])
  expect(Object.keys(cells['10·2'] ?? {}).length).toBeGreaterThan(0)
})

test('every rhyme the chart draws has 龔煌城\'s value', () => {
  const { values } = JSON.parse(readFileSync(new URL('../app/data/tangut-gong-rhymes.json', import.meta.url), 'utf8'))
  expect(Object.keys(values).length).toBe(105)
  const drawn = new Set(Object.values(rhymes.chars).map(row => row[0]).filter(rhyme => typeof rhyme === 'number'))
  expect([...drawn].filter(rhyme => !values[rhyme])).toEqual([])
  expect([values[1], values[33], values[65], values[105]]).toEqual(['u', 'iəə/jɨɨ', 'jɨ̣j', 'jwa'])
})

test('the Chinese transcription characters stand under rhymes the chart draws', () => {
  const { rhymes: list } = JSON.parse(readFileSync(new URL('../app/data/tangut-chinese-rhymes.json', import.meta.url), 'utf8'))
  const drawn = new Set(Object.values(rhymes.chars).map(row => String(row[0])))
  expect(Object.keys(list).filter(rhyme => !drawn.has(rhyme))).toEqual([])
  expect(Object.keys(list).length).toBe(58)
  expect(list['1'][0]).toEqual(['菩', 'u'])
  // In the thesis table, left out of the repost: no final is known for them.
  expect(list['100']).toEqual([['棱']])
})

test('the Tibetan spellings by hand class belong to known characters', () => {
  const { chars } = JSON.parse(readFileSync(new URL('../app/data/tangut-tibetan-hands.json', import.meta.url), 'utf8'))
  expect(Object.keys(chars).filter(char => !rhymes.chars[char])).toEqual([])
  for (const { tibetan = [] } of Object.values(chars)) {
    for (const [hand, spelt, count, script] of tibetan) {
      expect('ABCDE').toContain(hand)
      expect(spelt.length).toBeGreaterThan(0)
      expect(count).toBeGreaterThanOrEqual(0)
      expect(script).toMatch(/^[\u0f00-\u0fff?]+$/)
    }
  }
  expect(chars['𗀄'].tibetan).toEqual([['B', 'ngu', 1, 'ངུ']])
  expect(chars['𘘣'].tibetan[0]).toEqual(['B', 'g-yi', 13, 'གཡི'])
})

const ccamc = json('tangut-ccamc-index.json.gz')

test('the CCAMC index holds only normalized search terms', () => {
  expect(ccamc.format).toBe('tangut-input/ccamc-index')
  expect(Object.keys(ccamc.readings).sort()).toEqual(['arakawa_shintaro', 'gong_huangcheng'])
  expect(Object.keys(ccamc.meanings).sort()).toEqual(['en', 'zh'])
  expect(ccamc.wenhai).toBeUndefined()
  expect(ccamc.meanings.zh['𗀀']).toEqual(['毒', '下毒者', '毒死', '毒 蠱 名詞'])
  const gongXun = entries.rows.filter(row => row[7][1]).length
  expect(gongXun).toBe(5869)
  // The index is not a record: no original diacritics survive, and no 文海 sentence is stored.
  expect(JSON.stringify(ccamc.readings)).not.toContain('¹')
})

test('every character with a rhyme is a character the site knows', () => {
  const known = new Set(entries.rows.map(row => row[0]))
  const missing = Object.keys(rhymes.chars).filter(char => !known.has(char))
  // The nine ideographs of U+18D00–18D08 are newer than the records the entries are built from.
  expect(missing.sort()).toEqual(['𘴀', '𘴁', '𘴂', '𘴃', '𘴄', '𘴅', '𘴆', '𘴇', '𘴈'])
  expect(missing.every(char => (char.codePointAt(0) ?? 0) >= 0x18d00 && (char.codePointAt(0) ?? 0) <= 0x18d08)).toBe(true)
})

test('the rhyme record keeps the fields the card and the chart read', () => {
  expect(rhymes.columns).toEqual(['rhyme', 'tone', 'group', 'upper', 'lower', 'upperB', 'lowerB'])
  const value = rhymes.chars['𗀀']
  expect(value[0]).toBe(51)
  expect(value[1]).toBe(1)
  expect(value[3]).toBe('𗃦')
  expect(value[4]).toBe('𗏟')
})

const attestation = json('tangut-attestation.json.gz')

test('the attestation joins the edition, the twelve Wikisource texts and the Lausanne corpus', () => {
  expect(attestation.corpus).toEqual({
    lines: 5273,
    characters: 92509,
    distinct: 3350,
    sources: 14,
    sha256: '5312f92bf9751cf88e4ef8c4306a5f4a7be4c94690f58da4eba1d88323623017',
  })
  expect(attestation.sources.map(source => source.id)).toEqual([
    'solonin-2024',
    'wikisource-dragon-king',
    'wikisource-high-king',
    'wikisource-diamond',
    'wikisource-twenty-five-questions',
    'wikisource-dharani',
    'wikisource-hymn-origin',
    'wikisource-grains-of-gold',
    'wikisource-monthly-pleasures',
    'wikisource-leilin',
    'wikisource-liangzhou-stele',
    'wikisource-dual-maxims',
    'wikisource-tongyin-preface',
    'lcdtt',
  ])
  expect(attestation.sources.every(source => source.url && source.licence)).toBe(true)
  expect(attestation.sources[0].facsimile).toContain('/facsimile/solonin-2024/')
  expect(attestation.sources.slice(1).every(source => source.kind === 'transcription' && (source.revision || source.commit))).toBe(true)
})

test('every place points at the character it attests', () => {
  const sources = new Set(attestation.sources.map(source => source.id))
  for (const [char, bySource] of Object.entries(attestation.rows)) {
    for (const [source, places] of Object.entries(bySource)) {
      expect(sources.has(source)).toBe(true)
      for (const [line, position] of places) {
        const text = attestation.lines[line]
        expect(text).toBeDefined()
        expect([...text.text][position - 1]).toBe(char)
      }
    }
  }
})

const samples = JSON.parse(readFileSync(new URL('../app/data/tangut-samples.json', import.meta.url)).toString())

test('the sample passages are exact lines from the attestation', () => {
  expect(samples.samples.length).toBe(18)
  expect(samples.samples.filter(sample => sample.famous).length).toBe(13)
  const sourceIds = new Set(attestation.sources.map(source => source.id))
  for (const sample of samples.samples) {
    expect(sourceIds.has(sample.sourceId)).toBe(true)
    expect(sample.licence).toBe(attestation.sources.find(source => source.id === sample.sourceId)?.licence)
    expect(sample.text).toBe(sample.lineIds.map(line => attestation.lines[line].text).join('\n'))
  }
})

const frequency = json('tangut-frequency.json.gz')

test('the frequency table counts every place in the corpus', () => {
  expect(frequency.corpus).toEqual({
    lines: 5273,
    characters: 92509,
    distinct: 3350,
    sha256: '5312f92bf9751cf88e4ef8c4306a5f4a7be4c94690f58da4eba1d88323623017',
  })
  expect(Object.keys(frequency.counts).length).toBe(3350)
  expect(Object.values(frequency.counts).reduce((sum, count) => sum + count, 0)).toBe(92509)
  expect(frequency.counts['𗋕']).toBe(711)
})

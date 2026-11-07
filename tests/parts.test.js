// The recursive part index: a character's parts are every character and component its description
// holds, however many layers of character-sized parts lie between.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { buildPartIndex, isTangut, matchByParts, readDescription } from '../app/lib/composition.js'
import { idsViews, indexIdsDescriptions } from '../app/lib/ids-views.js'

const data = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
/** @type {{ char: string, composition?: string }[]} */
const entries = data.rows.map((/** @type {any[]} */ row) => ({ char: row[0], composition: row[1] ?? undefined }))
const byChar = new Map(entries.map(entry => [entry.char, entry]))
const index = buildPartIndex(entries)

test('a description is read as a tree, and an operator short of an operand is reported', () => {
  const read = readDescription('⿰𘠁𗢪')
  expect(read.complete).toBe(true)
  expect(read.roots).toHaveLength(1)
  expect(readDescription('⿰𘠁').complete).toBe(false)
  expect(readDescription('𘠁').roots).toEqual(['𘠁'])
})

test('a character part stands at its own layer, and its parts stand below it', () => {
  // 𗁼 is ⿰𘠁𗢪; 𗢪 is ⿰𗢨𘠨; 𗢨 is 𘢌. Searching 𗢨 must still find 𗁼.
  expect(index.directPartsOf.get('𗁼')).toEqual(['𘠁', '⿰𘠨𗢪'])
  expect(index.directPartsOf.get('⿰𘠨𗢪')).toEqual(['𘠨', '𗢪'])
  expect(index.directPartsOf.get('𗢪')).toEqual(['𗢨', '𘠨'])
  expect(index.partsOf.get('𗁼')?.get('𗢪')).toBe(1)
  expect(index.partsOf.get('𗁼')?.get('𗢨')).toBe(1)
  expect(index.partsOf.get('𗁼')?.get('𘢌')).toBe(1)
  expect(index.usedBy.get('𗢨')?.has('𗁼')).toBe(true)
})

test('every component written in a description is held at least its written count', () => {
  for (const entry of entries) {
    if (!entry.composition) continue
    const counts = new Map()
    for (const part of entry.composition) counts.set(part, (counts.get(part) ?? 0) + 1)
    const parts = index.partsOf.get(entry.char)
    for (const [part, count] of counts) {
      if (!isTangut(part)) continue
      expect(parts?.get(part) ?? 0).toBeGreaterThanOrEqual(count)
    }
  }
})

test('complete unencoded subtrees are searchable in editorial form', () => {
  const shape = '⿱𘡊𗎘'
  expect(index.partsOf.get('𗁛')?.get(shape)).toBe(1)
  expect(index.usedBy.get(shape)?.has('𗁛')).toBe(true)
  expect(index.directPartsOf.get('𗁛')).toEqual(['𘠁', shape])
  expect(index.directPartsOf.get(shape)).toEqual(['𘡊', '𗎘'])
  expect(matchByParts(index, [shape, '𗎘', '𘠳', '𘠢'])).toContain('𗁛')
})

test('a subtree that spells a character is that character, not a shape of its own', () => {
  // 𘒛 is ⿱𘧉⿰𘧘𘣩, and ⿰𘧘𘣩 is 𘓔: the base of the larger character is 𘓔.
  expect(byChar.get('𘓔')?.composition).toBe('⿰𘧘𘣩')
  expect(index.directPartsOf.get('𘒛')).toEqual(['𘧉', '𘓔'])
  expect(index.directPartsOf.get('𘓔')).toEqual(['𘧘', '𘣩'])
  expect(index.usedBy.get('⿰𘧘𘣩')).toBeUndefined()
  expect(index.usedBy.get('𘓔')?.has('𘒛')).toBe(true)
})

test('a character of three columns reads as one part beside a character of two', () => {
  // 𗆫 is ⿲𘠐𘧘𘣩, and ⿰𘧘𘣩 is 𘓔: the base 𘓔 is kept, not split into its components.
  expect(byChar.get('𗆫')?.composition).toBe('⿲𘠐𘧘𘣩')
  expect(index.directPartsOf.get('𗆫')).toEqual(['𘠐', '𘓔'])
  expect(index.partsOf.get('𗆫')?.get('𘓔')).toBe(1)
  expect(index.partsOf.get('𗆫')?.get('𘧘')).toBe(1)
  expect(index.usedBy.get('𘓔')?.has('𗆫')).toBe(true)
  expect(matchByParts(index, ['𘠐', '𘓔'])).toContain('𗆫')
})

test('the outermost operator is the editorial one, for the layout filter', () => {
  // 𗆫 is recorded as ⿲𘠐𘧘𘣩 and read as two parts, so its layout is ⿰.
  expect(index.layoutOf.get('𗆫')).toBe('⿰')
  // 𗁋 is ⿲𘠁𘦢𘠅 with both pairs spelling a character, so it stays three.
  expect(index.layoutOf.get('𗁋')).toBe('⿲')
})

test('three operands stay three when both pairs spell characters or neither does', () => {
  const synthetic = buildPartIndex([
    { char: '𗀁', composition: '⿰𘠀𘠁' },
    { char: '𗀂', composition: '⿰𘠁𘠂' },
    { char: '𗀃', composition: '⿲𘠀𘠁𘠂' },
    { char: '𗀄', composition: '⿲𘠃𘠄𘠅' },
    { char: '𗀅', composition: '⿱𘠁𘠂' },
    { char: '𗀆', composition: '⿳𘠀𘠁𘠂' },
  ])
  expect(synthetic.directPartsOf.get('𗀃')).toEqual(['𘠀', '𘠁', '𘠂'])
  expect(synthetic.directPartsOf.get('𗀄')).toEqual(['𘠃', '𘠄', '𘠅'])
  expect(synthetic.directPartsOf.get('𗀆')).toEqual(['𘠀', '𗀅'])
})

test('subtree shapes preserve multiplicity, branches, and incomplete roots', () => {
  const shape = '⿰𘠀𘠁'
  const synthetic = buildPartIndex([
    { char: '𗀁', composition: `⿱${shape}${shape}` },
    { char: '𗀂', composition: `⿲${shape}𘠂` },
    { char: '𗀃', composition: shape },
    { char: '𗀄', composition: `⿱${shape}𘠃` },
    { char: '𗀅', composition: `⿱${shape}𘠃` },
    { char: '𗀆', composition: `⿰⿱${shape}𘠃𘠄` },
  ])
  // The encoded shape is represented by its character; use another unencoded shape below.
  expect(synthetic.partsOf.get('𗀁')?.has(shape)).toBe(false)
  expect(synthetic.partsOf.get('𗀂')?.has('⿲⿰𘠀𘠁𘠂')).toBe(false)
  expect(synthetic.partsOf.get('𗀃')?.has(shape)).toBe(false)
  const unencoded = '⿰𘠅𘠆'
  const repeated = buildPartIndex([{ char: '𗀇', composition: `⿱${unencoded}${unencoded}` }])
  expect(repeated.partsOf.get('𗀇')?.get(unencoded)).toBe(2)
  expect(matchByParts(repeated, [unencoded, unencoded, '𘠅', '𘠆'])).toContain('𗀇')
  expect(matchByParts(repeated, [unencoded, unencoded, unencoded])).not.toContain('𗀇')
  expect(matchByParts(synthetic, ['𗀄', '𗀅'])).not.toContain('𗀆')
  const malformed = buildPartIndex([{ char: '𗀈', composition: `⿲${unencoded}𘠂` }])
  expect(matchByParts(malformed, [unencoded, '𘠅'])).toContain('𗀈')
  expect(malformed.partsOf.get('𗀈')?.has(`⿲${unencoded}𘠂`)).toBe(false)
})

test('shape matches follow the same alternative branch as characters', () => {
  const shape = '⿰𘠅𘠆'
  const synthetic = buildPartIndex([
    { char: '𗀁', composition: `⿱${shape}𘠃` },
    { char: '𗀂', composition: `⿱${shape}𘠃` },
    { char: '𗀃', composition: `⿰⿱${shape}𘠃𘠄` },
  ])
  expect(matchByParts(synthetic, [shape, '𗀁', '𘠅'])).toContain('𗀃')
  expect(matchByParts(synthetic, [shape, '𗀁', '𗀂'])).not.toContain('𗀃')
})

test('a part written twice is held twice, at any layer', () => {
  // 𗀌 is ⿱𘠀⿰𘡰𘡰.
  expect(index.partsOf.get('𗀌')?.get('𘡰')).toBe(2)
  // 𗀮 is ⿱𘠀⿲𘨷𘨷𘠢, and 𘨷 is the character 𘘤.
  expect(index.partsOf.get('𗀮')?.get('𘘤')).toBe(2)
})

test('a description short of an operand keeps its complete subtrees', () => {
  // 𗆽 is ⿲𘠐⿱𘠙⿰𘠁𘫙: the ⿲ has one operand too few, but ⿰𘠁𘫙 is 𗂍.
  expect(readDescription(byChar.get('𗆽')?.composition ?? '').complete).toBe(false)
  expect(index.partsOf.get('𗆽')?.get('𗂍')).toBe(1)
  expect(index.partsOf.get('𗆽')?.get('𘠁')).toBe(1)
  expect(index.directPartsOf.get('𗆽')).toEqual(['𘠐', '⿱𘠙𗂍'])
  expect(index.directPartsOf.get('⿱𘠙𗂍')).toEqual(['𘠙', '𗂍'])
  // 𗱋 is ⿰𘢷𘢣⿱⿺𘠔𘢌: it loses an operand too, but ⿺𘠔𘢌 is 𗇅.
  expect(index.partsOf.get('𗱋')?.get('𗇅')).toBe(1)
})

test('a character whose description is one component keeps that component as its part', () => {
  expect(byChar.get('𗢨')?.composition).toBe('𘢌')
  expect(index.partsOf.get('𗢨')?.get('𘢌')).toBe(1)
  expect(index.usedBy.get('𘢌')?.has('𗢨')).toBe(true)
})

test('alternative readings coexist only across different places', () => {
  const synthetic = buildPartIndex([
    { char: '𗀁', composition: '⿰𘠀𘠁' },
    { char: '𗀂', composition: '⿰𘠀𘠁' },
    { char: '𗀃', composition: '⿱⿰𘠀𘠁𘠂' },
    { char: '𗀄', composition: '⿱⿰𘠀𘠁⿰𘠀𘠁' },
    { char: '𗀅', composition: '⿱⿰𘠀𘠁𘠀' },
  ])
  expect(matchByParts(synthetic, ['𗀁'])).toContain('𗀃')
  expect(matchByParts(synthetic, ['𗀂'])).toContain('𗀃')
  expect(matchByParts(synthetic, ['𗀁', '𗀂'])).not.toContain('𗀃')
  expect(matchByParts(synthetic, ['𗀁', '𘠀', '𘠁'])).toContain('𗀃')
  expect(matchByParts(synthetic, ['𗀁', '𗀂'])).toContain('𗀄')
  expect(matchByParts(synthetic, ['𗀁', '𗀁'])).toContain('𗀄')
  expect(matchByParts(synthetic, ['𗀁', '𗀁', '𗀂'])).not.toContain('𗀄')
  expect(matchByParts(synthetic, ['𗀁', '𘠀', '𘠀'])).toContain('𗀅')
})

test('repeated ambiguous places share equivalent search states', () => {
  const subtree = '⿰𘠀𘠁'
  const tree = Array(20).fill(subtree).reduce((left, right) => left ? `⿱${left}${right}` : right, '')
  const synthetic = buildPartIndex([
    { char: '𗀁', composition: subtree },
    { char: '𗀂', composition: subtree },
    { char: '𗀃', composition: tree },
  ])
  expect(matchByParts(synthetic, [...Array(20).fill('𗀁'), ...Array(20).fill('𗀂')])).not.toContain('𗀃')
})

test('written leaves remain searchable with derived characters', () => {
  const synthetic = buildPartIndex([
    { char: '𗀁', composition: '𘠀' },
    { char: '𗀂', composition: '𘠀' },
    { char: '𗀃', composition: '𘠁' },
    { char: '𗀄', composition: '⿰𘠀𘠁' },
  ])
  expect(matchByParts(synthetic, ['𘠀', '𗀁', '𗀃'])).toContain('𗀄')
  expect(matchByParts(synthetic, ['𗀁', '𗀂'])).not.toContain('𗀄')
  expect(matchByParts(synthetic, ['𘠁', '𗀃'])).toContain('𗀄')
  expect(synthetic.usedBy.get('𗀄')?.has('𗀄')).not.toBe(true)
})

test('cycles stop before counting an ancestor and allow independent occurrences', () => {
  const synthetic = buildPartIndex([
    { char: '𗀁', composition: '⿰𗀂𘠀' },
    { char: '𗀂', composition: '⿰𗀁𘠁' },
    { char: '𗀃', composition: '⿰𗀁𗀁' },
  ])
  expect(synthetic.partsOf.get('𗀁')?.has('𗀁')).toBe(false)
  expect(synthetic.usedBy.get('𗀁')?.has('𗀁')).not.toBe(true)
  expect(matchByParts(synthetic, ['𗀁'])).not.toContain('𗀁')
  expect(matchByParts(synthetic, ['𗀂', '𘠁'])).toContain('𗀁')
  expect(matchByParts(synthetic, ['𗀁', '𗀁', '𗀂', '𗀂'])).toContain('𗀃')
})

test('ambiguous subtrees retain their written leaves when a branch cycles', () => {
  const synthetic = buildPartIndex([
    { char: '𗀁', composition: '⿰𘠀𘠁' },
    { char: '𗀂', composition: '⿰𘠀𘠁' },
    { char: '𗀃', composition: '⿱⿰𘠀𘠁𘠂' },
    { char: '𘠀', composition: '𗀃' },
  ])
  expect(matchByParts(synthetic, ['𗀁', '𘠀', '𘠁', '𘠂'])).toContain('𗀃')
  expect(matchByParts(synthetic, ['𗀁', '𗀂'])).not.toContain('𗀃')
  expect(synthetic.partsOf.get('𗀃')?.has('𗀃')).toBe(false)
})

test('recorded and editorial view parts find their source characters', () => {
  const descriptions = indexIdsDescriptions(entries)
  // A singleton, a duplicate leaf, a malformed source, and a nested character.
  for (const char of ['𗢨', '𗀌', '𗆽', '𗁼']) {
    const view = idsViews(char, byChar.get(char)?.composition ?? '', descriptions)
    expect(matchByParts(index, view.recordedParts)).toContain(char)
    expect(matchByParts(index, view.editorialParts)).toContain(char)
  }
})

test('duplicate records do not create ambiguous derived characters', () => {
  const entries = [
    { char: '𗀁', composition: '⿰𘠀𘠁' },
    { char: '𗀁', composition: '⿰𘠀𘠁' },
    { char: '𗀂', composition: '⿱⿰𘠀𘠁𘠂' },
  ]
  const synthetic = buildPartIndex(entries)
  const view = idsViews('𗀂', entries[2].composition, indexIdsDescriptions(entries))
  expect(view.editorialParts).toContain('𗀁')
  expect(synthetic.directPartsOf.get('𗀂')).toContain('𗀁')
  expect(matchByParts(synthetic, view.recordedParts)).toContain('𗀂')
  expect(matchByParts(synthetic, view.editorialParts)).toContain('𗀂')
})

test('matching reaches a part at every layer, and counts a repeated choice', () => {
  expect(matchByParts(index, ['𗧤']).sort()).toEqual(['𗃏', '𘗋'])
  expect(matchByParts(index, ['𗸡']).sort()).toEqual(['𗀃', '𗶵'])
  expect(matchByParts(index, ['𗢨'])).toContain('𗁼')
  expect(matchByParts(index, ['𘠀', '𗸡'])).toContain('𗀃')
  expect(matchByParts(index, ['𘡰', '𘡰'])).toContain('𗀌')
  expect(matchByParts(index, ['𘡰', '𘡰'])).not.toContain('𗁨')
  expect(matchByParts(index, ['not a part'])).toEqual([])
})

import { expect, test } from 'bun:test'
import { gunzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { componentPositions, derivedDescriptions, familyIndex, keepVariantsTogether, possiblePairs, surroundingDescriptions, variantFamilies, variantIndex } from '../app/lib/variants.js'
import VARIANTS from '../app/data/tangut-variants.json' with { type: 'json' }

const NONE = { variants: [], partial: [], synonyms: [], components: [], reported: [] }

test('a stated variant links both characters', () => {
  const index = variantIndex([], { ...NONE, variants: [['𗄧', '𘚡']] })
  expect(index.get('𗄧')).toEqual({ of: ['𘚡'], partial: [], forms: [], partialForms: [], reported: [], possible: [] })
  expect(index.get('𘚡')).toEqual({ of: [], partial: [], forms: ['𗄧'], partialForms: [], reported: [], possible: [] })
})

test('a shared reading and sense makes a possible variant, and neither alone does', () => {
  const entry = (char, reading, en) => ({ char, pronunciations: { li_fanwen: reading }, definitions: { en } })
  const index = variantIndex(possiblePairs([entry('𗀀', 'a1', ['flag']), entry('𗀁', 'a1', ['to flag; banner']), entry('𗀂', 'a1', ['fish']), entry('𗀃', 'b1', ['flag'])], NONE), NONE)
  expect(index.get('𗀀')?.possible).toEqual(['𗀁'])
  expect(index.get('𗀂')).toBeUndefined()
  expect(index.get('𗀃')).toBeUndefined()
})

test('a surrounding form turns the ⿰ above it into ⿺, and back', () => {
  expect(surroundingDescriptions('⿰𘣠𘣩', '𘣠', '𘢢')).toEqual(['⿺𘢢𘣩'])
  expect(surroundingDescriptions('⿺𘢢𘣩', '𘣠', '𘢢')).toEqual(['⿰𘣠𘣩'])
  expect(surroundingDescriptions('⿱𘠀⿰𘣠𘣩', '𘣠', '𘢢')).toEqual(['⿱𘠀⿺𘢢𘣩'])
  // The hook wraps only what follows it: elsewhere, and under another operator, nothing changes.
  expect(surroundingDescriptions('⿰𘠁𘢢', '𘣠', '𘢢')).toEqual([])
  expect(surroundingDescriptions('⿱𘣠𘣩', '𘣠', '𘢢')).toEqual([])
})

test('a surrounding pair links the characters written with either layout', () => {
  const entry = (char, composition, reading) => ({ char, composition, pronunciations: { li_fanwen: reading } })
  const stated = { ...NONE, components: [['𘣠', '𘢢']], surrounding: [['𘣠', '𘢢']] }
  const entries = [entry('𗸘', '⿰𘣠𘣩', 'a1'), entry('𗸠', '⿺𘢢𘣩', 'a1')]
  expect(variantIndex(possiblePairs(entries, stated), stated).get('𗸘')?.possible).toEqual(['𗸠'])
  // Without the surrounding rule the plain substitution finds no character at ⿰𘢢𘣩.
  const plain = { ...NONE, components: [['𘣠', '𘢢']] }
  expect(variantIndex(possiblePairs(entries, plain), plain).get('𗸘')).toBeUndefined()
})

test('a derived description is the substitution no character carries', () => {
  const stated = { ...NONE, components: [['𘣠', '𘢢']], surrounding: [['𘣠', '𘢢']] }
  const entry = { char: '𗸘', composition: '⿰𘣠𘣩' }
  expect(derivedDescriptions(entry, new Set(['⿰𘣠𘣩']), stated)).toEqual(['⿺𘢢𘣩'])
  expect(derivedDescriptions(entry, new Set(['⿰𘣠𘣩', '⿺𘢢𘣩']), stated)).toEqual([])
  // A hook with no surrounding rewrite keeps the layout, and either direction is written out.
  const hook = { ...NONE, components: [['𘣜', '𘣝']] }
  expect(derivedDescriptions({ char: '𗠐', composition: '⿰𘡯𘣝' }, new Set(['⿰𘡯𘣝']), hook)).toEqual(['⿰𘡯𘣜'])
  expect(derivedDescriptions({ char: '𗠐', composition: '⿰𘡯𘣜' }, new Set(['⿰𘡯𘣜']), hook)).toEqual(['⿰𘡯𘣝'])
  expect(derivedDescriptions({ char: '𗸘' }, new Set(), stated)).toEqual([])
})

test('variant components link characters only when the reading also matches', () => {
  const entry = (char, composition, reading) => ({ char, composition, pronunciations: { li_fanwen: reading } })
  const index = variantIndex(possiblePairs([entry('𗀀', '⿰𘢩𘠀', 'a1'), entry('𗀁', '⿰𘢪𘠀', 'a1'), entry('𗀂', '⿰𘢩𘠁', 'a1'), entry('𗀃', '⿰𘢪𘠁', 'b1')], { ...NONE, components: [['𘢩', '𘢪']] }), { ...NONE, components: [['𘢩', '𘢪']] })
  expect(index.get('𗀀')?.possible).toEqual(['𗀁'])
  expect(index.get('𗀂')).toBeUndefined()
})

test('a usage line is not a shared meaning', () => {
  const entry = (char, en) => ({ char, pronunciations: { li_fanwen: 'a1' }, definitions: { en } })
  expect(variantIndex(possiblePairs([entry('𗀀', ['Transliteration of Middle Chinese 俄']), entry('𗀁', ['Transliteration of Middle Chinese 娥'])], NONE), NONE).size).toBe(0)
})

test('synonyms are not possible variants', () => {
  const entry = (char, en) => ({ char, pronunciations: { li_fanwen: 'a1' }, definitions: { en } })
  const index = variantIndex(possiblePairs([entry('𗀀', ['name']), entry('𗀁', ['name'])], { ...NONE, synonyms: [['𗀀', '𗀁']] }), { ...NONE, synonyms: [['𗀀', '𗀁']] })
  expect(index.size).toBe(0)
})

test('the recorded data gives the stated variants and the possible ones', () => {
  const packed = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  const li = packed.systems.indexOf('li_fanwen')
  const entries = packed.rows.map((/** @type {any[]} */ row) => ({ char: row[0], composition: row[1], pronunciations: { li_fanwen: row[7][li] }, definitions: { en: row[4], ja: row[5] } }))
  const known = new Set(entries.map(entry => entry.char))
  const pairs = possiblePairs(entries)
  const index = variantIndex(pairs)
  expect(VARIANTS.variants.length + VARIANTS.partial.length).toBe(28)
  expect(pairs.length).toBe(22)
  expect(pairs.filter(pair => pair.components).length).toBe(16)
  expect(VARIANTS.surrounding.length).toBe(4)
  const places = componentPositions(entries)
  expect(Object.keys(places.get('𘡍'))).toEqual(['top'])
  expect(Object.keys(places.get('𘠠'))[0]).toBe('left')
  expect(Object.keys(places.get('𘠟'))[0]).toBe('right')
  for (const [form, base] of [...VARIANTS.variants, ...VARIANTS.partial]) {
    expect(known.has(form)).toBe(true)
    expect(known.has(base)).toBe(true)
  }
  expect(index.get('𗇫')?.forms.toSorted()).toEqual(['𗄄', '𗇐'].toSorted())
  expect(index.get('𗁇')?.of).toEqual(['𘚠'])
  expect(index.get('𘈣')?.of).toEqual(['𗀛'])
  expect(index.get('𗀏')?.possible).toEqual([])
  expect(index.get('𗌲')?.possible).toEqual(['𗍒'])
  expect(index.get('𗚅')?.possible).toEqual(['𗚆'])
  expect(index.get('𘅾')?.of).toEqual(['𘄵'])
  expect(index.get('𗀑')?.partial).toEqual(['𗀉'])
  expect(index.get('𗀑')?.of).toEqual([])
  expect(index.get('𗀉')?.partialForms).toEqual(['𗀑'])
  expect(index.get('𗀉')?.forms).toEqual([])
  expect(index.get('𗢨')?.reported).toEqual(['𘓐'])
  expect(index.get('𗢨')?.possible).toEqual([])
  expect(index.get('𗥠')?.possible ?? []).toEqual([])
  // 𗸘 is ⿰𘣠𘣩 and 𗸠 is ⿺𘢢𘣩: the plain and the surrounding form of one part, same reading.
  expect(index.get('𗸘')?.possible).toEqual(['𗸠'])
  expect(index.get('𗸠')?.possible).toEqual(['𗸘'])
  expect(index.get('𗸖')?.possible).toEqual(['𗸟'])
  expect([...index.values()].flatMap(record => record.possible).length).toBe(44)
  // The same substitution, written out where no character carries it.
  const described = new Set(entries.map(entry => entry.composition).filter(Boolean))
  const byChar = new Map(entries.map(entry => [entry.char, entry]))
  expect(derivedDescriptions(byChar.get('𗠐'), described)).toContain('⿰𘡯𘣜')
  expect(derivedDescriptions(byChar.get('𗸘'), described)).toEqual([])
})

test('variant components stand together, under the first member\'s strokes', () => {
  const part = (name, strokes) => ({ part: name, strokes })
  const arranged = keepVariantsTogether([part('𘠣', 2), part('𘠀', 2), part('𘡍', 3), part('𘠅', 3), part('𘠁', 3)], ['𘠣𘡍𘠅'])
  expect(arranged.map(item => item.part)).toEqual(['𘠣', '𘡍', '𘠅', '𘠀', '𘠁'])
  expect(arranged.map(item => item.section)).toEqual([2, 2, 2, 2, 3])
})

test('a member filtered out of the palette leaves the rest in place', () => {
  const part = (name, strokes) => ({ part: name, strokes })
  expect(keepVariantsTogether([part('𘠟', 4)], ['𘠠𘠟'])).toEqual([{ part: '𘠟', strokes: 4, section: 4 }])
})

test('positions come from the slot under the operator directly above', () => {
  const places = componentPositions([{ char: '𗀀', composition: '⿰𘠀⿱𘠁𘠂' }, { char: '𗀁', composition: '⿲𘠂𘠀𘠁' }], [{ members: '𘠀𘠁𘠂' }])
  expect(places.get('𘠀')).toEqual({ left: 1, middle: 1 })
  expect(places.get('𘠁')).toEqual({ top: 1, right: 1 })
  expect(places.get('𘠂')).toEqual({ bottom: 1, left: 1 })
})

test('a form of a form stands in the same group as the first', () => {
  const families = variantFamilies([{ one: '𗁒', other: '𗄢', reading: 'a1' }], { ...NONE, variants: [['𗁘', '𗁒']] })
  expect(families.length).toBe(1)
  expect(families[0].members).toEqual(['𗁒', '𗁘', '𗄢'])
  expect(families[0].links.map(link => [link.one, link.other, link.ground])).toEqual([['𗁘', '𗁒', 'stated'], ['𗁒', '𗄢', 'possible']])
  expect(families[0].grounds).toEqual([{ kind: 'stated', count: 1 }, { kind: 'possible', count: 1 }])
})

test('a partial variant counts as stated, and a report comes first', () => {
  const families = variantFamilies([], { ...NONE, partial: [['𗀑', '𗀉']], reported: [['𗢨', '𘓐']] })
  expect(families.map(family => family.members)).toEqual([['𗢨', '𘓐'], ['𗀉', '𗀑']])
  expect(families[1].grounds).toEqual([{ kind: 'stated', count: 1 }])
  expect(families[1].links[0].ground).toBe('stated')
})

test('every member of a group maps to it', () => {
  const [family] = variantFamilies([], { ...NONE, reported: [['𗢨', '𘓐']] })
  const index = familyIndex([family])
  expect(index.get('𗢨')).toBe(family)
  expect(index.get('𘓐')).toBe(family)
})

test('the recorded data gives the groups a pair list hides', () => {
  const packed = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
  const li = packed.systems.indexOf('li_fanwen')
  const entries = packed.rows.map((/** @type {any[]} */ row) => ({ char: row[0], composition: row[1], pronunciations: { li_fanwen: row[7][li] }, definitions: { en: row[4], ja: row[5] } }))
  const families = variantFamilies(possiblePairs(entries))
  expect(families.length).toBe(49)
  expect(families[0].members).toEqual(['𗢨', '𘓐'])
  expect(families[0].grounds).toEqual([{ kind: 'reported', count: 1 }])
  const linked = families.filter(family => family.links.length > 1 || family.grounds.some(ground => ground.kind === 'reported'))
  expect(linked.map(family => family.members.join(''))).toEqual(['𗢨𘓐', '𗁒𗁘𗄢', '𗄄𗇐𗇫'])
  // Each family draws only the records it has, so a chain never suggests a link that is not there.
  expect(linked.map(family => family.links.map(link => `${link.one}${link.other}${link.ground}`))).toEqual([
    ['𗢨𘓐' + 'reported'],
    ['𗁘𗁒' + 'stated', '𗁒𗄢' + 'possible'],
    ['𗄄𗇫' + 'stated', '𗇐𗇫' + 'stated'],
  ])
})

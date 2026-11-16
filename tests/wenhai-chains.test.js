// The Digital Wenhai as the site reads it: the published counts, the shape of every chain, and the
// two indices the card and the chains page build from it.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const doc = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-wenhai.json.gz', import.meta.url))).toString())
const chains = new Map([...doc.initial, ...doc.rhyme].map(chain => [chain.id, chain]))
const code = node => node.codePointAt(0) ?? 0

test('the release keeps the figures it states', () => {
  expect(doc.stats).toEqual({
    heads: 3085,
    characters: 3077,
    initial: 173,
    rhyme: 321,
    initialCross: 8,
    rhymeCross: 13,
    unresolved: 6,
  })
  expect(doc.initial.length).toBe(173)
  expect(doc.rhyme.length).toBe(321)
  expect(doc.cross.initial.length).toBe(8)
  expect(doc.cross.rhyme.length).toBe(13)
  expect(doc.unresolved.length).toBe(6)
  expect(doc.unresolved.filter(set => set.graph === 'Initial').length).toBe(3)
  expect(doc.unresolved.filter(set => set.graph === 'Rhyme').length).toBe(3)
})

test('the source is pinned to the version whose files were read', () => {
  expect(doc.source.author).toBe('Mathieu Beaudouin')
  expect(doc.source.version).toBe('1.2: Phonology')
  expect(doc.source.doi).toBe('10.5281/zenodo.22256047')
  expect(doc.source.versionDoi).toBe('10.5281/zenodo.23956653')
  expect(doc.source.licence).toBe('CC BY 4.0')
  expect(doc.source.files.length).toBe(8)
  for (const file of doc.source.files) {
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(file.bytes).toBeGreaterThan(0)
  }
})

test('every chain counts its members and anchors on the first of them', () => {
  for (const chain of chains.values()) {
    expect(chain.members.length).toBe(chain.size)
    expect(new Set(chain.members).size).toBe(chain.size)
    const first = [...chain.members].sort((a, b) => code(a) - code(b) || a.localeCompare(b))[0]
    expect(chain.anchor).toBe(first)
    expect([...chain.anchor].length).toBe(1)
  }
})

test('every head stands in the chains it names', () => {
  const membersOf = new Map([...chains].map(([id, chain]) => [id, new Set(chain.members)]))
  const positions = new Set()
  for (const head of doc.heads) {
    expect(positions.has(head.pos)).toBe(false)
    positions.add(head.pos)
    for (const field of ['initial', 'rhyme']) {
      if (!head[field]) continue
      expect(chains.has(head[field])).toBe(true)
      expect(membersOf.get(head[field]).has(head.char)).toBe(true)
    }
    expect([...head.char].length).toBeGreaterThan(0)
    expect(code(head.char)).toBeGreaterThanOrEqual(0x17000)
    expect(code(head.char)).toBeLessThanOrEqual(0x18DFF)
  }
})

test('every chain member names one Tangut character', () => {
  const readings = new Set(['𘅇a', '𘅇b', '𗼍a', '𗼍b'])
  for (const chain of chains.values()) {
    for (const node of chain.members) {
      expect(code(node)).toBeGreaterThanOrEqual(0x17000)
      expect(code(node)).toBeLessThanOrEqual(0x18DFF)
      if ([...node].length > 1) expect(readings.has(node)).toBe(true)
    }
  }
})

test('a rhyme list says whether it covers only the chain heads', () => {
  const heads = new Set(doc.heads.map(head => head.char))
  for (const chain of doc.rhyme) {
    expect(typeof chain.partial).toBe('boolean')
    if (!chain.cross) expect(chain.partial).toBe(chain.members.some(member => !heads.has(member)))
    expect(chain.level.every(rhyme => /^1\./.test(rhyme))).toBe(true)
    expect(chain.other.every(rhyme => /^[34]\./.test(rhyme))).toBe(true)
  }
})

test('the rhyme crossings are the chains with more than one level-tone rhyme', () => {
  const crossed = doc.rhyme.filter(chain => chain.level.length > 1).map(chain => chain.id).sort()
  expect(crossed).toEqual([...doc.cross.rhyme].sort())
  for (const chain of doc.rhyme) {
    expect(chain.level.every(rhyme => rhyme.startsWith('1.'))).toBe(true)
    expect(chain.other.every(rhyme => /^[34]\./.test(rhyme))).toBe(true)
  }
})

test('the direct links sit inside the chain they are filed under', () => {
  for (const [graph, groups] of Object.entries(doc.links)) {
    for (const [id, rows] of Object.entries(groups)) {
      const chain = chains.get(id)
      expect(chain).toBeDefined()
      expect(chain.members.length).toBeGreaterThan(1)
      for (const [node, other] of rows) {
        expect(chain.members).toContain(node)
        expect(chain.members).toContain(other)
      }
    }
  }
})

test('the first position keeps its statement and the next inherits it', () => {
  const first = doc.heads.find(head => head.pos === '05.131')
  const second = doc.heads.find(head => head.pos === '05.132')
  expect(first).toMatchObject({
    char: '𘀏', ty: 'I', initial: 'I-07', rhyme: 'R-087', tr: '1.01',
    fanqie: '𗈽𗒿𘈖𗥃', stated: true, via: '05.131',
  })
  expect(second).toMatchObject({
    char: '𘀑', initial: 'I-07', rhyme: 'R-087', stated: false, via: '05.131',
  })
})

test('a character read two ways keeps a node for each reading', () => {
  const readings = doc.heads.filter(head => head.char.startsWith('𘅇'))
  expect(readings.map(head => [head.char, head.ty])).toEqual([['𘅇a', 'III'], ['𘅇b', 'V']])
  expect(chains.get('III-05').members).toContain('𘅇a')
  expect(chains.get('V-09').members).toContain('𘅇b')
})

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { babelStoneAdapter } from '../src/adapter/babelstone.js'
import { createCharacterInfo, characterScript } from '../src/adapter/character-info.js'

const document = JSON.parse(gunzipSync(readFileSync(new URL('../data/character-info.json.gz', import.meta.url))).toString())
const info = createCharacterInfo(document)

describe('the character information shipped with the package', () => {
  test('is the format the adapter reads', () => {
    expect(document.format).toBe('ids-character-info-2')
    expect(Object.keys(document.entries).filter(char => characterScript(char) === 'tangut')).toHaveLength(6144)
  })

  test('carries the Tangut meanings and readings from Open Tangut', () => {
    const poison = info('𗀀')
    expect(poison.glosses).toContain('poison; venom; toxin')
    expect(poison.meanings?.ja).toContain('毒。')
    expect(poison.meanings?.zh).toContain('毒')
    expect(poison.readings?.find(reading => reading.name === 'Li Fanwen 2008')?.value).toBe('do1')
    expect(poison.sources.map(source => source.note)).toContain('openTangut')
  })

  test('lets the adapter find a character by its reconstruction', async () => {
    const adapter = babelStoneAdapter({ table: new Map([['𗀀', [{ text: '⿱𘠀⿰𘢰𘠆', regions: '' }]]]), characterInfo: document })
    expect((await adapter.search('do1')).map(hit => hit.char)).toContain('𗀀')
  })
})

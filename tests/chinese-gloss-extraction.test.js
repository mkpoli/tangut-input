import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'

const root = new URL('../', import.meta.url)
const snapshot = JSON.parse(gunzipSync(readFileSync(new URL('../data/wiktionary/definitions-zh.json.gz', import.meta.url))).toString())

function python(source) {
  const result = spawnSync('python3', ['-B', '-c', `import importlib.util,json\nspec=importlib.util.spec_from_file_location('extract','scripts/extract_tangut_chinese.py')\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\n${source}`], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
  return JSON.parse(result.stdout)
}

test('the publishing command requires the checksum-verified dump input', () => {
  const result = spawnSync('python3', ['-B', 'scripts/extract_tangut_chinese.py', '--audit-json', 'data/wiktionary/definitions-zh.json.gz'], { cwd: root, encoding: 'utf8' })
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('--dump')
  const help = spawnSync('python3', ['-B', 'scripts/extract_tangut_chinese.py', '--help'], { cwd: root, encoding: 'utf8' })
  expect(help.status).toBe(0)
  expect(help.stdout).not.toContain('--audit-json')
})

test('plain Chinese and wikilink display labels survive without inferred text', () => {
  const result = python(`print(json.dumps([m.clean_definition('𗀀', line) for line in ['# [[毒]]', '# [[下毒]]者', '# [[奴婢]]、[[佣人|傭人]]', '# [[水#漢語]]', '# 在……的[[上面]]']],ensure_ascii=False))`)
  expect(result).toEqual([['毒', null], ['下毒者', null], ['奴婢、傭人', null], ['水', null], ['在……的上面', null]])
})

test('unresolved templates, HTML, links and formatting never become display glosses', () => {
  const lines = ['# {{n-g|量詞}}', '# [[背面]]{{gloss|無生}}', '# {{n-g|用於轉寫{{cog|ltc|俄}}。}}', '# {{rfdef|txg}}', '# <ref>來源</ref>毒', '# [[毒', '# [https://example.com 毒]', "# ''毒''"]
  const result = python(`print(json.dumps([m.clean_definition('𗀀', line) for line in ${JSON.stringify(lines)}],ensure_ascii=False))`)
  expect(result.every(([value, reason]) => value === null && reason)).toBe(true)
})

test('only top-level Tangut senses are extracted across both Chinese heading spellings', () => {
  const text = '==日語==\n# 日本語\n==西夏語==\n===釋義===\n# [[毒]]\n#: 用例\n#* 引文\n## 下位義\n===來源===\n# numbered reference\n==英語==\n# poison\n==西夏语==\n===释义===\n# [[吸]]'
  const result = python(`print(json.dumps(m.definition_lines(${JSON.stringify(text)}),ensure_ascii=False))`)
  expect(result).toEqual(['# [[毒]]', '# [[吸]]'])
})

test('three identified source errors are retained with reasons and excluded from accepted senses', () => {
  expect(snapshot.pages['𘆽'].definitions).toEqual(['午，地支的第七位'])
  expect(snapshot.pages['𗗻'].definitions).toEqual(['犬，狗'])
  expect(snapshot.pages['𗵊'].definitions).toEqual(['牛'])
  for (const char of ['𘆽', '𗗻', '𗵊']) {
    expect(snapshot.pages[char].rejected.length).toBe(1)
    expect(snapshot.pages[char].rejected[0].reason).toMatch(/^Source (error|inconsistency):/)
    expect(snapshot.pages[char].wikitext).toContain(snapshot.pages[char].rejected[0].raw)
  }
})

test('snapshot preserves page attribution, raw wikitext and source terms', () => {
  expect(snapshot.source.licence).toBe('CC BY-SA 4.0')
  expect(snapshot.dump.sha1).toBe('bd139bae2c7c9f5fad6d6a347d07296bf9bcabdc')
  expect(snapshot.dump.date).toBe('2026-11-01')
  expect(snapshot.note).toContain('independence from CCAMC is unverified')
  expect(snapshot.pages['𗀁'].revision).toBe(9268345)
  expect(snapshot.pages['𗀁'].timestamp).toBe('2025-05-28T05:08:18Z')
  expect(snapshot.pages['𗀁'].contributor).toBe('Fglffer')
  expect(snapshot.pages['𗀁'].definitions).toEqual(['吸'])
  expect(snapshot.pages['𗀁'].url).toContain('oldid=9268345')
  expect(snapshot.pages['𗀁'].historyUrl).toContain('action=history')
  for (const page of Object.values(snapshot.pages)) {
    expect(page.revision).toBeGreaterThan(0)
    expect(page.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(page.wikitext).toContain('==西夏')
    expect(page.rawDefinitions.every(raw => page.wikitext.includes(raw))).toBe(true)
    expect(page.definitions.every(value => !/[{}<>\[\]|]/u.test(value))).toBe(true)
  }
})

test('coverage counts accepted senses separately from placeholders and unresolved markup', () => {
  expect(snapshot.stats).toEqual({ singleTangutPages: 237, pagesWithDefinitionLines: 119, acceptedPages: 110, acceptedDefinitions: 152, rejectedDefinitions: 28 })
  expect(snapshot.pages['𗀦'].definitions).toEqual([])
  expect(snapshot.pages['𗀦'].rejected[0].reason).toContain('no gloss supplied')
  const leilin = JSON.parse(readFileSync(new URL('../app/data/tangut-leilin.json', import.meta.url))).glosses
  const accepted = Object.entries(snapshot.pages).filter(([, page]) => page.definitions.length)
  expect(accepted.filter(([char]) => !leilin[char]).length).toBe(57)
  expect(accepted.filter(([char]) => leilin[char]).length).toBe(53)
})

test('retained wikitext and revisions reproduce every snapshot field', () => {
  const result = python(`import gzip\npinned=json.load(gzip.open('data/wiktionary/definitions-zh.json.gz'))\naudit={'counts':{'single_tangut_pages':pinned['stats']['singleTangutPages']},'pages':[{'char':char,'rev':page['revision'],'timestamp':page['timestamp'],'contributor':page['contributor'],'text':page['wikitext']} for char,page in pinned['pages'].items()]}\nprint(json.dumps(m.build(audit,pinned['retrieved'])==pinned))`)
  expect(result).toBe(true)
})

test('dump rebuilding rejects an unpinned input before attempting XML extraction', () => {
  const result = python(`from pathlib import Path\ntry:\n m.scan_dump(Path('scripts/extract_tangut_chinese.py'))\nexcept ValueError as error:\n print(json.dumps(str(error)))`)
  expect(result).toContain('Dump SHA1 mismatch')
})

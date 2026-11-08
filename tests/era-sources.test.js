import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../app/lib/era-sources.js'
import TITLES from '../app/data/tangut-titles.json' with { type: 'json' }
import STATE_NAMES from '../app/data/tangut-state-names.json' with { type: 'json' }
import ERAS from '../app/data/tangut-eras.json' with { type: 'json' }
import CONTEMPORARY_ERAS from '../app/data/tangut-contemporary-eras.json' with { type: 'json' }
import LATER_ERAS from '../app/data/tangut-later-eras.json' with { type: 'json' }
import en from '../messages/en.json' with { type: 'json' }
import ja from '../messages/ja.json' with { type: 'json' }
import ko from '../messages/ko.json' with { type: 'json' }
import zhHans from '../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../messages/zh-Hant.json' with { type: 'json' }

test('every cited source is in the numbered list', () => {
  const cited = [...TITLES, ...STATE_NAMES].flatMap(row => [...row.tangutSources, ...row.chineseSources, ...(row.noteSources ?? [])])
  for (const key of [...cited, ...CONTEMPORARY_ERAS.flatMap(row => [row.source, row.proposalSource, ...row.dictionarySources])]) expect(ERA_SOURCE_ORDER).toContain(key)
  expect(ERA_SOURCE_ORDER.toSorted()).toEqual(Object.keys(ERA_SOURCES).toSorted())
})

test('光定 cites the manuscript colophon transcription', () => {
  const era = ERAS.find(row => row.era === '光定')
  expect(era?.evidence).toContainEqual({ tangut: '𗪚𗏴', kind: 'text', source: 'ma2023' })
  expect(ERA_SOURCE_ORDER).toContain('ma2023')
  expect(ERA_SOURCES.ma2023.url).toBe('https://real.mtak.hu/191670/1/062-article-p239.pdf#page=27')
})

test('乾定 cites the manuscript transcription', () => {
  const era = ERAS.find(row => row.era === '乾定')
  expect(era?.evidence).toContainEqual({ tangut: '𘀗𗪚', kind: 'text', source: 'qianding1226' })
  expect(ERA_SOURCE_ORDER).toContain('qianding1226')
  expect(ERA_SOURCES.qianding1226.url).toBe('https://weibo.com/6008710471/KbTyK101X')
})

test('the contemporary Jin era is separate and its proposed transcription follows the photographed order', () => {
  expect(CONTEMPORARY_ERAS).toEqual([{ era: '貞祐', years: [1213, 1217], tangut: '𗣼𘑨𘏨𘔭', source: 'lizi2019', proposalSource: 'mkpoli2026', dictionarySources: ['xhzd1997', 'clauson2016', 'westClausonIndex'] }])
  expect(ERA_SOURCES.mkpoli2026.author).toBe('mkpoli')
  expect(ERA_SOURCES.mkpoli2026.where).toBe('Personal communication, 2026-11-07')
  expect(ERAS.some(row => row.era === '貞祐')).toBe(false)
  expect(LATER_ERAS.some(row => row.era === '貞祐')).toBe(false)
  expect(ERA_SOURCES.lizi2019.url).toBe('https://collection.sina.com.cn/qbtd/2019-04-10/doc-ihvhiqax1350522.shtml')
  expect(ERA_SOURCES.lizi2019.author).toBe('西夏泉女——李子999')
  expect(ERA_SOURCES.lizi2019.where).toContain('2019-04-10')
})

test('dictionary citations identify a headword without confirming the photograph', () => {
  expect(ERA_SOURCES.clauson2016.url).toBe('https://archive.org/details/gerardclausonssk0001unse/page/233/mode/1up')
  expect(ERA_SOURCES.clauson2016.where).toContain('f. 115r, entry 1530')
  expect(ERA_SOURCES.clauson2016.note).toContain('祐 and 助')
  expect(ERA_SOURCES.westClausonIndex.url).toBe('https://www.babelstone.co.uk/CTT/CTT01/CTT01-index.html')
  expect(ERA_SOURCES.westClausonIndex.note).toContain('entry 1530, f. 115, under 𘑨')
  expect(ERA_SOURCES.westClausonIndex.note).toContain('not the photographed character')
  const page = readFileSync(new URL('../app/pages/Eras.svelte', import.meta.url), 'utf8')
  expect(page).toContain("t('eras.contemporary.comparison')}{@render cites([era.proposalSource, era.source])")
  expect(page).toContain("t('eras.contemporary.dictionary')}{@render cites(era.dictionarySources)")
})

test('the contemporary table retains its column headers on small screens', () => {
  const page = readFileSync(new URL('../app/pages/Eras.svelte', import.meta.url), 'utf8')
  expect(page).toContain('class="ui-table list contemporary-table"')
  expect(page).toMatch(/\.contemporary-table thead\{display:table-header-group;[^}]*clip-path:inset\(50%\)/)
})

test('every locale describes the provisional transcription and its uncertainty', () => {
  for (const messages of [en, ja, ko, zhHans, zhHant]) {
    for (const key of ['tab', 'title', 'inscription', 'transcription', 'note', 'comparison', 'dictionary', 'uncertain']) {
      expect(messages[`eras.contemporary.${key}`]).toBeTruthy()
    }
  }
  const page = readFileSync(new URL('../app/pages/Eras.svelte', import.meta.url), 'utf8')
  expect(page).toContain("t('eras.contemporary.inscription')")
  expect(page).toContain("t('eras.contemporary.transcription')}</span>{@render cites([era.proposalSource])}")
  expect(page).toContain("t('eras.contemporary.note')}{@render cites([era.source])}")
  expect(page).toMatch(/role="img" aria-label=\{t\('eras\.contemporary\.uncertain'\)\}/)
  expect(page).not.toContain("aria-label={`${t('eras.contemporary.transcription')}: ${era.tangut}`}")
  expect(page).toMatch(/\[\.\.\.era\.tangut\] as char/)
  expect(page).toContain('onclick={() => choose(char)}><G {char}/></button>')
  expect(en['eras.contemporary.comparison']).toContain('counterclockwise')
  expect(en['eras.contemporary.comparison']).toContain('all four signs differ from standard forms')
  expect(en['eras.contemporary.dictionary']).toContain('probably a distorted 祐')
  expect(ja['eras.contemporary.dictionary']).toContain('崩れた「祐」')
  expect(ERA_SOURCES.xhzd1997.where).toContain('entry #0645')
  expect(en['eras.contemporary.note']).toContain('authenticity, date and official status are uncertain')
  expect(ja['eras.contemporary.note']).toContain('貞祐宝銭')
  expect(ko['eras.contemporary.note']).toContain('貞祐寶錢')
})

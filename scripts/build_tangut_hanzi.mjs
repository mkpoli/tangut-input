// Explicit character glosses and whole-phrase names, with the evidence for each form.
// Run with: bun scripts/build_tangut_hanzi.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { ERA_SOURCES } from '../app/lib/era-sources.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const HAN = /\p{Script=Han}/u
const TANGUT = /^[\u{17000}-\u{18AFF}\u{18D00}-\u{18D7F}]+$/u

/** Build from local, pinned inputs; no network or build date enters the output. */
export function buildTangutHanzi(root = ROOT) {
  const json = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'))
  function table(name) {
    const [header, ...lines] = readFileSync(resolve(root, name), 'utf8').split(/\r?\n/)
    const fields = header.split('\t')
    return lines.filter(line => line !== '').map(line => {
      const values = line.split('\t')
      if (values.length > fields.length) throw new Error(`${name}: wrong field count: ${line}`)
      return Object.fromEntries(fields.map((field, i) => [field, values[i] ?? '']))
    })
  }

  const records = []
  const sources = {}
  function evidence(record, source, role, detail = {}) {
    if (!ERA_SOURCES[source] && source !== 'leilin') throw new Error(`unknown source: ${source}`)
    sources[source] ??= { ...ERA_SOURCES[source] }
    const item = { source, role, ...detail }
    if (!record.evidence.some(known => JSON.stringify(known) === JSON.stringify(item))) record.evidence.push(item)
  }
  function add(record) {
    if (!record.tangut || !record.hanzi) return false
    if (!TANGUT.test(record.tangut) || !HAN.test(record.hanzi)) throw new Error(`invalid correspondence: ${JSON.stringify(record)}`)
    records.push(record)
    return true
  }

  const leilin = json('app/data/tangut-leilin.json')
  for (const [tangut, glosses] of Object.entries(leilin.glosses)) {
    for (const [hanzi, count] of glosses) {
      // Labels such as ɴᴇɢ and ??? have no Han correspondence. A multi-Han gloss stays whole.
      if (!HAN.test(hanzi)) continue
      const record = { tangut, hanzi, kind: 'gloss', basis: 'text', evidence: [] }
      if (!Number.isSafeInteger(count) || count < 1) throw new Error(`invalid 類林 count: ${count}`)
      evidence(record, 'leilin', 'gloss', { count })
      add(record)
    }
  }
  sources.leilin = {
    ...ERA_SOURCES.leilin,
    source: leilin.source,
    via: leilin.via,
    note: `${ERA_SOURCES.leilin.note} ${leilin.note}`,
  }

  const eraEvidence = table('data/tangut-era-evidence.tsv')
  const eraKinds = new Set(['coin', 'text', 'disputed', 'gloss', 'post', 'unknown'])
  for (const row of eraEvidence) {
    if (!eraKinds.has(row.kind) || ((row.kind === 'unknown') !== !row.tangut)) throw new Error(`invalid era evidence: ${JSON.stringify(row)}`)
  }
  const eras = json('app/data/tangut-eras.json')
  for (const era of eras) {
    const rows = eraEvidence.filter(row => row.era === era.era && row.from === era.from.slice(0, 4))
    const forms = [...new Set([...era.calendar, ...rows.map(row => row.tangut).filter(Boolean)])]
    for (const tangut of forms) {
      const backing = rows.filter(row => row.tangut === tangut)
      // Different evidence kinds stay on separate records, including competing post forms.
      const kinds = [...new Set(backing.map(row => row.kind))]
      if (!kinds.length) kinds.push('calendar')
      for (const basis of kinds) {
        const record = {
          tangut, hanzi: era.era, kind: 'era', basis,
          from: era.from, to: era.to, years: era.years, evidence: [],
        }
        if (era.calendar.includes(tangut)) evidence(record, 'calendar', 'tangut', { kind: 'calendar' })
        for (const row of backing.filter(row => row.kind === basis)) {
          evidence(record, row.source, 'tangut', { kind: row.kind, ...(row.place ? { place: row.place } : {}) })
        }
        for (const row of rows.filter(row => row.kind === 'unknown')) evidence(record, row.source, 'note', { kind: 'unknown' })
        add(record)
      }
    }
  }
  for (const row of eraEvidence) {
    if (!eras.some(era => era.era === row.era && era.from.slice(0, 4) === row.from)) throw new Error(`unmatched era evidence: ${JSON.stringify(row)}`)
  }
  for (const row of table('data/tangut-later-eras.tsv')) {
    const record = { tangut: row.tangut, hanzi: row.era, kind: 'era', basis: 'post', later: true, evidence: [] }
    evidence(record, row.source, 'tangut', { kind: 'post' })
    add(record)
  }

  const titles = new Map()
  const identifications = new Set(['stated', 'caption', 'decoded', 'codes', 'dated', 'disputed'])
  for (const row of table('data/tangut-titles.tsv')) {
    if (!row.tangut || !row.chinese) continue
    if (!identifications.has(row.identified) || !['tangut', 'chinese'].includes(row.backs)) throw new Error(`invalid title: ${JSON.stringify(row)}`)
    const key = JSON.stringify([row.holder, row.tangut])
    let record = titles.get(key)
    if (!record) {
      record = {
        tangut: row.tangut, hanzi: row.chinese, kind: 'title', basis: 'reported',
        identified: row.identified, holder: row.holder,
        titleKind: row.chinese.includes('城') || row.tangut.includes('𗍁') ? 'city' : 'honorific',
        evidence: [],
      }
      titles.set(key, record)
      evidence(record, row.chinese_source, 'chinese')
    }
    if (record.hanzi !== row.chinese || record.identified !== row.identified) throw new Error(`conflicting title rows: ${key}`)
    if (row.place) record.basis = 'text'
    evidence(record, row.source, row.backs, row.place ? { place: row.place } : {})
  }
  for (const record of titles.values()) add(record)

  const states = new Map()
  for (const row of table('data/tangut-state-names.tsv')) {
    if (!row.tangut || !row.chinese) continue
    if (!['tangut', 'chinese', 'note'].includes(row.backs)) throw new Error(`invalid state name: ${JSON.stringify(row)}`)
    const key = row.chinese
    let record = states.get(key)
    if (!record) {
      record = {
        tangut: row.tangut, hanzi: row.chinese, kind: 'state', basis: 'reported',
        ...(row.gloss ? { gloss: row.gloss } : {}), ...(row.note ? { note: row.note } : {}), evidence: [],
      }
      states.set(key, record)
      evidence(record, row.chinese_source, 'chinese')
    }
    if (record.tangut !== row.tangut || (record.gloss ?? '') !== row.gloss || (record.note ?? '') !== row.note) throw new Error(`conflicting state rows: ${key}`)
    if (row.place) record.basis = 'text'
    evidence(record, row.source, row.backs, row.place ? { place: row.place } : {})
  }
  for (const record of states.values()) add(record)

  for (const row of table('data/tangut-posthumous.tsv')) {
    if (!row.tangut || !row.posthumous) continue
    const record = {
      tangut: row.tangut, hanzi: row.posthumous, kind: 'posthumous', basis: 'reported',
      holder: row.temple || row.name, name: row.name, ...(row.tomb ? { tomb: row.tomb } : {}), evidence: [],
    }
    evidence(record, row.tangut_source, 'tangut')
    evidence(record, 'songshi', 'chinese', { quote: row.quote })
    add(record)
  }

  return { format: 'tangut-input/hanzi', sources, records }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const data = buildTangutHanzi()
  const out = resolve(ROOT, 'app/data/tangut-hanzi.json')
  writeFileSync(out, JSON.stringify(data) + '\n')
  const counts = Object.fromEntries([...new Set(data.records.map(row => row.kind))].map(kind => [kind, data.records.filter(row => row.kind === kind).length]))
  console.log(`${data.records.length} correspondences, ${JSON.stringify(counts)} → app/data/tangut-hanzi.json`)
}

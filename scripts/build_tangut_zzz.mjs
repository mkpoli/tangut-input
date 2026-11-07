// Join the 掌中珠's transcription column to its Tangut headwords.
//
// The print sets one Chinese character under each Tangut character, so an entry can be paired only
// where the two columns name the same positions. Where they differ the difference is a finding and
// the entry stays out; pairing by eye would put a claim into the data the columns do not carry.
//
// Only cells both marked `ok` are published. The other three statuses keep their own count:
// `uncertain` awaits a second witness, `illegible` cannot be read, and `absent` means the print has
// no character at that position, which is a reading rather than a gap.
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DATA = `${ROOT}/data/zhangzhongzhu`
const OUT = `${ROOT}/app/data/tangut-zzz.json.gz`

const TANGUT = /^[\u{17000}-\u{187FF}\u{18800}-\u{18AFF}\u{18D00}-\u{18D7F}]$/u
const HAN = /^[\u{3400}-\u{4DBF}\u{4E00}-\u{9FFF}\u{F900}-\u{FAFF}\u{20000}-\u{2FA1F}\u{30000}-\u{323AF}]$/u
const STATUSES = new Set(['ok', 'uncertain', 'illegible', 'absent'])

/**
 * A TSV with a header row, as objects keyed by column.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseTsv(text) {
  const [head, ...lines] = text.replace(/\r\n?/g, '\n').trim().split('\n')
  const columns = head.split('\t')
  return lines.filter(line => line.trim()).map(line => {
    const values = line.split('\t')
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']))
  })
}

/**
 * Pair every entry's Tangut column with its transcription column.
 * @param {{ entry_id: string }[]} entries
 * @param {Record<string, string>[]} cells
 * @returns {{ pairs: Record<string, { text: string, entry: string }[]>, counts: Record<string, number>, problems: string[] }}
 */
export function pairZzz(entries, cells) {
  const known = new Set(entries.map(entry => entry.entry_id))
  /** @type {Record<string, number>} */
  const counts = {
    entries: entries.length,
    keyedEntries: 0,
    paired: 0,
    characters: 0,
    unpairedEntries: 0,
    incompleteEntries: 0,
    uncertainCells: 0,
    illegibleCells: 0,
    absentCells: 0,
    emptyCells: 0,
  }
  /** @type {string[]} */
  const problems = []
  /** @type {Map<string, Record<string, Record<string, string>[]>>} */
  const byEntry = new Map()
  for (const cell of cells) {
    if (!known.has(cell.entry_id)) {
      problems.push(`cells.tsv names an entry that is not in entries.tsv: ${cell.entry_id}`)
      continue
    }
    if (!STATUSES.has(cell.status)) problems.push(`${cell.entry_id}: status ${JSON.stringify(cell.status)} is not one of ${[...STATUSES].join(', ')}`)
    const roles = byEntry.get(cell.entry_id) ?? {}
    byEntry.set(cell.entry_id, roles)
    ;(roles[cell.role] ??= []).push(cell)
  }
  counts.keyedEntries = byEntry.size
  for (const roles of byEntry.values()) {
    for (const role of Object.values(roles)) role.sort((a, b) => Number(a.position) - Number(b.position))
  }

  /** @type {Map<string, { text: string, entry: string }[]>} */
  const pairs = new Map()
  for (const [entryId, roles] of byEntry) {
    const tangut = roles.tangut ?? []
    const transcription = roles.transcription ?? []
    if (!tangut.length && !transcription.length) continue
    if (!tangut.length || !transcription.length) {
      counts.incompleteEntries += 1
      continue
    }
    if (tangut.length !== transcription.length
      || tangut.some((cell, index) => Number(cell.position) !== Number(transcription[index].position))) {
      counts.unpairedEntries += 1
      continue
    }
    for (const [index, source] of tangut.entries()) {
      const target = transcription[index]
      // `absent` is a reading, and it outranks a damaged glyph in the same position.
      if (source.status === 'absent' || target.status === 'absent') { counts.absentCells += 1; continue }
      if (source.status === 'illegible' || target.status === 'illegible') { counts.illegibleCells += 1; continue }
      if (source.status === 'uncertain' || target.status === 'uncertain') { counts.uncertainCells += 1; continue }
      if (source.status !== 'ok' || target.status !== 'ok') continue
      const key = (source.glyph_norm || source.glyph || '').trim()
      const text = (target.glyph || '').trim()
      if (!key || !text) { counts.emptyCells += 1; continue }
      if (!TANGUT.test(key) || [...key].length !== 1) { problems.push(`${entryId}: ${JSON.stringify(key)} is not one Tangut character`); continue }
      if (!HAN.test(text) || [...text].length !== 1) { problems.push(`${entryId}: ${JSON.stringify(text)} is not one Han character`); continue }
      const group = pairs.get(key) ?? []
      pairs.set(key, group)
      if (!group.some(pair => pair.text === text && pair.entry === entryId)) {
        group.push({ text, entry: entryId })
        counts.paired += 1
      }
    }
  }

  counts.characters = pairs.size
  const ordered = Object.fromEntries([...pairs].sort(([a], [b]) => a.codePointAt(0) - b.codePointAt(0))
    .map(([char, list]) => [char, list.sort((a, b) => a.entry.localeCompare(b.entry))]))
  return { pairs: ordered, counts, problems }
}

/** Read the keyed tables, check the join, and write the app's copy. */
export function build() {
  const entries = parseTsv(readFileSync(`${DATA}/entries.tsv`, 'utf8'))
  const cells = parseTsv(readFileSync(`${DATA}/cells.tsv`, 'utf8'))
  const { pairs, counts, problems } = pairZzz(entries, cells)
  if (problems.length) throw new Error(problems.join('\n'))
  const document = {
    format: 'tangut-input/zzz',
    built: new Date().toISOString().slice(0, 10),
    source: {
      name: '番漢合時掌中珠',
      date: '1190',
      edition: '民國 貽安堂 print, held by 清光山西巖寺, photographed by 国文学研究資料館',
      doi: '10.20730/100354804',
      url: 'https://kokusho.nijl.ac.jp/biblio/100354804',
      licence: 'Images CC BY-NC 4.0; the keyed rows are this workshop’s own work, licence not settled',
    },
    counts,
    pairs,
  }
  writeFileSync(OUT, gzipSync(JSON.stringify(document)))
  console.log(`${counts.characters} characters, ${counts.paired} pairs, `
    + `${counts.unpairedEntries} entries unpaired, ${counts.incompleteEntries} incomplete, `
    + `${counts.uncertainCells + counts.illegibleCells + counts.absentCells} cells not published`)
}

if (import.meta.main) build()

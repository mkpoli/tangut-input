// Collect every drawing the quiz has saved into one dataset, so the strokes a reader made are usable
// as data instead of only as a pile of session folders.
//
//   bun scripts/handwriting/dataset.mjs [--dry]
//
// Reads `data/handwriting/<session>/NNN-<code>.json`, one file per drawing, and writes
// `data/handwriting/dataset.jsonl.gz` — one record per line — with `data/handwriting/dataset.json`
// beside it as a manifest. The session folders stay the source of truth; the quiz rebuilds both after
// every saved drawing, so the dataset never lags behind the pad.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const ROOT = new URL('../../data/handwriting/', import.meta.url)
const OUT = new URL('dataset.jsonl.gz', ROOT)
const MANIFEST = new URL('dataset.json', ROOT)
const ANNOTATIONS = new URL('annotations.json', ROOT)

/**
 * The drawings the review threw out: a scribble or a one-stroke mark is no example of a character,
 * and keeping it in the dataset would teach a model the wrong thing. The verdict is the tag, so a
 * drawing removed once stays out however often the dataset is rebuilt.
 * @returns {Set<string>}
 */
function excluded() {
  if (!existsSync(ANNOTATIONS)) return new Set()
  try {
    const saved = JSON.parse(readFileSync(ANNOTATIONS, 'utf8'))
    return new Set(Object.entries(saved.notes ?? {})
      .filter(([, note]) => note.verdict === 'bad')
      .map(([id]) => id))
  } catch {
    return new Set()
  }
}

/** A session folder, oldest first. @returns {string[]} */
function sessions() {
  return readdirSync(ROOT)
    .filter(name => !name.startsWith('.') && /^\d{4}-\d{2}-\d{2}T/.test(name))
    .sort()
}

/** A session's own file, when it has one. @param {string} dir @returns {{ seed?: number, started?: string }} */
function meta(dir) {
  const file = new URL(`${dir}/session.json`, ROOT)
  if (!existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

/** The drawings of one session, in the order they were made. @param {string} dir */
function drawings(dir) {
  return readdirSync(new URL(`${dir}/`, ROOT))
    .filter(name => /^\d{3}-.*\.json$/.test(name))
    .sort()
    .map(name => ({ name, record: JSON.parse(readFileSync(new URL(`${dir}/${name}`, ROOT), 'utf8')) }))
}

/**
 * Read every session and build the dataset. Returns the manifest it wrote.
 * @param {{ write?: boolean }} [options]
 */
export function build({ write = true } = {}) {
  const counts = { sessions: 0, empty: 0, drawings: 0, excluded: 0, withoutTiming: 0 }
  const skip = excluded()
  /** @type {Record<string, number>} */
  const kinds = {}
  /** @type {Record<string, number>} */
  const writers = {}
  const lines = []
  for (const dir of sessions()) {
    const list = drawings(dir)
    if (!list.length) {
      counts.empty++
      continue
    }
    counts.sessions++
    const session = meta(dir)
    for (const { name, record } of list) {
      if (typeof record.char !== 'string' || !record.char || !Array.isArray(record.strokes) || !record.strokes.length) {
        console.warn(`skipped ${dir}/${name}: no character or no strokes`)
        continue
      }
      if (skip.has(`${dir}/${name}`)) {
        counts.excluded++
        continue
      }
      const entry = {
        id: `${dir}/${name.slice(0, 3)}`,
        char: record.char,
        code: `U+${record.char.codePointAt(0).toString(16).toUpperCase()}`,
        kind: record.kind,
        lookalikes: record.lookalikes ?? null,
        strokes: record.strokes,
        strokeCount: record.strokes.length,
        // Null where the drawing was made before the quiz recorded them.
        times: record.times ?? null,
        pressure: record.pressure ?? null,
        pointer: record.pointer ?? null,
        writer: record.writer ?? null,
        device: record.device ?? null,
        width: record.width,
        height: record.height,
        at: record.at,
        session: { dir, seed: session.seed ?? null, started: session.started ?? null },
      }
      if (!entry.times) counts.withoutTiming++
      kinds[entry.kind] = (kinds[entry.kind] ?? 0) + 1
      const who = entry.writer ?? 'unnamed'
      writers[who] = (writers[who] ?? 0) + 1
      counts.drawings++
      lines.push(JSON.stringify(entry))
    }
  }
  // Drawings the reviewer made while searching for the character: their hand, not the writer's, and
  // linked to the drawing that prompted them.
  const reviewer = new URL('reviewer/', ROOT)
  if (existsSync(reviewer)) {
    for (const name of readdirSync(reviewer).filter(name => name.endsWith('.json')).sort()) {
      const record = JSON.parse(readFileSync(new URL(name, reviewer), 'utf8'))
      if (!record.char || !record.strokes?.length) continue
      counts.drawings++
      counts.reviewer = (counts.reviewer ?? 0) + 1
      lines.push(JSON.stringify({
        id: `reviewer/${name.replace('.json', '')}`,
        char: record.char,
        code: `U+${record.char.codePointAt(0).toString(16).toUpperCase()}`,
        kind: 'reviewer',
        author: 'reviewer',
        for: record.for ?? null,
        strokes: record.strokes,
        strokeCount: record.strokes.length,
        times: null, pressure: null, pointer: null, writer: 'reviewer', device: null,
        width: record.width, height: record.height, at: record.at,
        session: { dir: 'reviewer', seed: null, started: null },
      }))
    }
  }

  const manifest = {
    schema: 1,
    built: new Date().toISOString(),
    drawings: counts.drawings,
    excluded: counts.excluded,
    reviewer: counts.reviewer ?? 0,
    sessions: counts.sessions,
    kinds,
    writers,
    // Drawings made before the quiz began saving the pen's timing and pressure.
    withoutTiming: counts.withoutTiming,
    file: 'dataset.jsonl.gz',
    source: 'data/handwriting/<session>/NNN-<code>.json',
  }
  if (write) {
    writeFileSync(OUT, gzipSync(lines.join('\n') + '\n'))
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  }
  return manifest
}

if (import.meta.main) {
  const manifest = build({ write: !process.argv.includes('--dry') })
  console.log(`${manifest.drawings} drawings from ${manifest.sessions} sessions -> data/handwriting/dataset.jsonl.gz`)
  console.log(JSON.stringify({ kinds: manifest.kinds, writers: manifest.writers, withoutTiming: manifest.withoutTiming }))
}

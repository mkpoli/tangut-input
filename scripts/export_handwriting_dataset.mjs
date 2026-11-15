// Publish the drawings as an open dataset: the files a reader can download, the schema they follow,
// where each drawing came from, and a gallery of every one of them.
//   bun scripts/export_handwriting_dataset.mjs
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const ROOT = new URL('../', import.meta.url)
const OUT = new URL('app/public/dataset/', ROOT)
const DATA = new URL('data/handwriting/', ROOT)

if (!existsSync(new URL('dataset.jsonl.gz', DATA))) {
  console.error('no data/handwriting/dataset.jsonl.gz — run `bun run quiz:dataset` first')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

const manifest = JSON.parse(readFileSync(new URL('dataset.json', DATA), 'utf8'))
const annotations = JSON.parse(readFileSync(new URL('annotations.json', DATA), 'utf8'))
const rows = gunzipSync(readFileSync(new URL('dataset.jsonl.gz', DATA))).toString().trim().split('\n').map(line => JSON.parse(line))

copyFileSync(new URL('dataset.jsonl.gz', DATA), new URL('tangut-strokes.jsonl.gz', OUT))
writeFileSync(new URL('manifest.json', OUT), JSON.stringify({
  ...manifest,
  about: 'Strokes drawn with a mouse, trackpad or stylus on a browser pad, one width per drawing, by ' +
    'visitors to the site. Collected to train and test character recognition for search, not as a record ' +
    'of handwriting or calligraphy.',
  counts: {
    drawings: rows.length,
    chars: new Set(rows.map(row => row.char)).size,
    sessions: new Set(rows.map(row => row.session?.dir)).size,
    reviewed: Object.values(annotations.notes ?? {}).filter(note => note.verdict).length,
    corrected: Object.values(annotations.notes ?? {}).filter(note => note.correct).length,
  },
}, null, 2) + '\n')
writeFileSync(new URL('annotations.json', OUT), JSON.stringify(annotations, null, 1) + '\n')
execFileSync('bun', ['scripts/gallery_tangut_drawings.mjs', new URL('gallery.html', OUT).pathname], { cwd: ROOT.pathname, stdio: 'inherit' })

const example = JSON.stringify({
  id: rows[0].id, char: rows[0].char, kind: rows[0].kind, label: rows[0].label,
  strokes: [[[0.13, 0.44], [0.51, 0.4]], '…'], times: ['…'], pressure: ['…'], width: 340, height: 340,
}, null, 0).replace(/"…"/g, '…')

const byHand = rows.reduce((counts, row) => {
  const hand = row.label === 'picked' ? 'live reader' : row.kind === 'reviewer' ? 'reviewer' : 'quiz writer'
  counts[hand] = (counts[hand] ?? 0) + 1
  return counts
}, {})
const counts = {
  drawings: rows.length,
  chars: new Set(rows.map(row => row.char)).size,
  sessions: new Set(rows.map(row => row.session?.dir)).size,
  reviewed: Object.values(annotations.notes ?? {}).filter(note => note.verdict).length,
  corrected: Object.values(annotations.notes ?? {}).filter(note => note.correct).length,
}
const size = (file) => `${(readFileSync(new URL(file, OUT)).length / 1024 / 1024).toFixed(1)} MB`

// The page itself is a route of the site (app/pages/Dataset.svelte); this directory holds only
// the files it offers.

// The page reads the counts from here rather than fetching them, so the numbers are there on the
// first paint and a failed request cannot leave the page blank.
writeFileSync(new URL('app/lib/dataset-counts.js', ROOT), `// Written by scripts/export_handwriting_dataset.mjs; rebuilt with \`bun run dataset:export\`.
export const counts = ${JSON.stringify(counts, null, 2)}
`)
console.log(`${rows.length} drawings, ${Object.keys(byHand).length} hands -> app/public/dataset/`)

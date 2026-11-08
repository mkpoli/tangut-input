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

copyFileSync(new URL('dataset.jsonl.gz', DATA), new URL('tangut-handwriting.jsonl.gz', OUT))
writeFileSync(new URL('manifest.json', OUT), JSON.stringify({
  ...manifest,
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
const size = (file) => `${(readFileSync(new URL(file, OUT)).length / 1024 / 1024).toFixed(1)} MB`

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tangut handwriting dataset</title>
<link rel="stylesheet" href="/fonts.css">
<style>
:root { --bg: #fbf9f5; --ink: #23201c; --muted: #6d675e; --line: #e2dcd2; --accent: #a8402c; }
@media (prefers-color-scheme: dark) { :root { --bg: #16140f; --ink: #ece5d8; --muted: #a89e8e; --line: #33302a; --accent: #e0836a; } }
body { margin: 0 auto; padding: 48px 24px 80px; max-width: 74em; background: var(--bg); color: var(--ink);
       font: 15px/1.65 ui-serif, "Noto Serif", Georgia, serif; }
h1 { font-size: 30px; margin: 0 0 6px; letter-spacing: -0.01em; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin: 40px 0 12px; font-weight: 500; }
p { margin: 0 0 14px; max-width: 62em; }
a { color: var(--accent); }
table { border-collapse: collapse; margin: 0 0 8px; font-size: 14px; }
th, td { text-align: left; padding: 6px 18px 6px 0; border-bottom: 1px solid var(--line); font-weight: 400; }
th { color: var(--muted); font-weight: 500; }
code { font: 13px/1.5 ui-monospace, monospace; background: color-mix(in srgb, var(--ink) 7%, transparent); padding: 1px 5px; border-radius: 4px; }
.files li { margin: 0 0 6px; }
</style>
</head>
<body>
<h1>Tangut handwriting dataset</h1>
<p>${rows.length} drawings of ${new Set(rows.map(row => row.char)).size} characters, written on a pad by hand
and stored as strokes in the unit square.</p>

<h2>Files</h2>
<ul class="files">
<li><a href="tangut-handwriting.jsonl.gz">tangut-handwriting.jsonl.gz</a> — one JSON record per line, ${size('tangut-handwriting.jsonl.gz')}</li>
<li><a href="annotations.json">annotations.json</a> — a reviewer's verdict on ${Object.values(annotations.notes ?? {}).filter(note => note.verdict).length} drawings, ${Object.values(annotations.notes ?? {}).filter(note => note.correct).length} with the character it should have been</li>
<li><a href="manifest.json">manifest.json</a> — schema version, counts, and the face each shape came from</li>
<li><a href="gallery.html">gallery.html</a> — every drawing beside the character it was made for</li>
</ul>

<h2>A record</h2>
<p><code>${example}</code></p>
<p>Strokes are polylines in the unit square, in drawing order; <code>times</code> and <code>pressure</code> are kept
where the browser reported them. <code>label</code> is <code>answer</code> where the character was shown to the
writer, and <code>picked</code> where it is only what a reader chose out of the search results.</p>

<h2>Where it came from</h2>
<table>
<tr><th>Hand</th><th>Drawings</th><th>Character</th></tr>
${Object.entries(byHand).map(([hand, count]) => `<tr><td>${hand}</td><td>${count}</td><td>${hand === 'live reader' ? 'picked from the results' : 'shown to the writer'}</td></tr>`).join('\n')}
</table>
<p>Rounds run on the site's quiz page, which shows a character and keeps the strokes drawn for it; the
live pad on <a href="/draw">/draw</a>, which keeps a drawing with the character its reader picked; and the
reviewer's own drawings, made to correct the others.</p>

<h2>Licence and attribution</h2>
<p>The drawings are released under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>:
cite “Tangut handwriting dataset, tangut.mkpo.li” with the date you downloaded it. The printed characters
are not part of this release; they come from the typefaces the site draws with, each under its own licence,
listed in <a href="https://github.com/mkpoli/tangut-input/blob/main/docs/materials.md">docs/materials.md</a>.</p>

<p><a href="/draw">Try the pad</a> · <a href="gallery.html">Gallery</a> ·
<a href="https://github.com/mkpoli/tangut-input/blob/main/docs/handwriting.md">How the corpus is kept</a></p>
</body>
</html>
`
writeFileSync(new URL('index.html', OUT), html)
console.log(`${rows.length} drawings, ${Object.keys(byHand).length} hands -> app/public/dataset/`)

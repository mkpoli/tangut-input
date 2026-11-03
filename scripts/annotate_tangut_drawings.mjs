// An annotation board for the drawings made by hand: pick a drawing, say whether it is a fair
// example, what went wrong when it is not, and the character it should have been. Everything stays
// in the page until "Export" writes it out, because the drawings never leave this machine.
//   bun scripts/annotate_tangut_drawings.mjs [out.html]
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'

const out = process.argv[2] ?? 'docs/handwriting-annotate.html'
const DATA = new URL('../data/handwriting/', import.meta.url)
if (!existsSync(DATA)) {
  console.error('no data/handwriting')
  process.exit(1)
}

/** @type {{ id: string, session: string, name: string, char: string, at: string, strokes: number[][][] }[]} */
const drawings = []
for (const session of readdirSync(DATA).sort()) {
  const dir = join(DATA.pathname, session)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
  for (const name of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const record = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    if (!record.char || !record.strokes?.length) continue
    drawings.push({ id: `${session}/${name}`, session, name, char: record.char, at: record.at ?? '', strokes: record.strokes })
  }
}

// Characters near the drawn one, by the codes they share: a misdrawn character is usually one a
// neighbouring code names, and the board offers those to correct a wrong target with.
const pairs = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-cangjie.json.gz', import.meta.url))).toString())
/** @type {Map<string, string[]>} */
const codesOf = new Map()
for (const [char, code] of pairs) codesOf.set(char, [...(codesOf.get(char) ?? []), code])
/** @type {Map<string, string[]>} */
const suggestions = new Map()
for (const char of new Set(drawings.map(drawing => drawing.char))) {
  const own = codesOf.get(char) ?? []
  /** @type {Set<string>} */
  const near = new Set()
  for (const [other, codes] of codesOf) {
    if (other === char) continue
    if (codes.some(code => own.some(mine => code.slice(0, 2) === mine.slice(0, 2)))) near.add(other)
    if (near.size >= 16) break
  }
  suggestions.set(char, [...near].slice(0, 16))
}
const payload = JSON.stringify({ drawings, suggestions: Object.fromEntries(suggestions) })

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Annotate the hand drawings — ${drawings.length}</title>
<style>
  :root { color-scheme: light dark; --ink:#2b241d; --bg:#faf6ef; --line:#e4dccd; --muted:#8a7f6d; --accent:#a5382c; --ok:#2f6b46; --warn:#8a6a1f; }
  @media (prefers-color-scheme: dark) { :root { --ink:#eae3d6; --bg:#1b1815; --line:#3a342c; --muted:#9c907c; --accent:#e07060; --ok:#7fc79b; --warn:#d9b45a; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 ui-serif, Georgia, serif; }
  header { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:16px; padding:14px 20px;
           background:color-mix(in srgb, var(--bg) 92%, var(--ink)); border-bottom:1px solid var(--line); }
  h1 { font-size:18px; margin:0; font-weight:600; }
  .count { color:var(--muted); font-size:13px; }
  header .spacer { flex:1; }
  button { font:inherit; padding:6px 11px; border:1px solid var(--line); border-radius:8px; background:transparent; color:var(--ink); cursor:pointer; }
  button:hover { border-color:var(--ink); }
  button[aria-pressed="true"] { background:var(--ink); color:var(--bg); border-color:var(--ink); }
  main { display:grid; grid-template-columns: minmax(0,1fr) 340px; gap:20px; padding:20px; align-items:start; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(132px,1fr)); gap:10px; }
  figure { margin:0; padding:8px; border:2px solid var(--line); border-radius:10px; cursor:pointer; background:color-mix(in srgb,var(--bg) 94%, var(--ink)); }
  figure[data-verdict="good"] { border-color:var(--ok); }
  figure[data-verdict="wrong"] { border-color:var(--accent); }
  figure[data-verdict="bad"] { border-color:var(--warn); }
  figure[aria-current="true"] { outline:2px solid var(--ink); outline-offset:1px; }
  figure .pair { display:flex; align-items:center; justify-content:space-between; gap:4px; }
  figure svg { color:var(--accent); }
  figure .target { font-family:"Noto Serif Tangut", serif; font-size:32px; line-height:1; }
  figcaption { margin-top:6px; display:flex; justify-content:space-between; gap:6px; font:11px/1.4 ui-monospace, monospace; color:var(--muted); }
  aside { position:sticky; top:78px; display:grid; gap:16px; padding:16px; border:1px solid var(--line); border-radius:12px; }
  aside h2 { font-size:13px; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); margin:0; font-weight:600; }
  .row { display:flex; flex-wrap:wrap; gap:6px; }
  .field { width:100%; padding:7px 9px; border:1px solid var(--line); border-radius:8px; background:transparent; color:var(--ink); font:inherit; }
  textarea.field { min-height:70px; resize:vertical; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(36px,1fr)); gap:6px; }
  .tile { aspect-ratio:1; display:grid; place-items:center; border:1px solid var(--line); border-radius:8px; font-family:"Noto Serif Tangut", serif; font-size:22px; cursor:pointer; background:transparent; color:var(--ink); }
  .tile[aria-pressed="true"] { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
  .empty { color:var(--muted); }
  kbd { font:11px ui-monospace, monospace; border:1px solid var(--line); border-radius:4px; padding:1px 4px; }
</style>
</head>
<body>
<header>
  <h1>Annotate the hand drawings</h1>
  <span class="count" id="count"></span>
  <span class="spacer"></span>
  <button id="export">Export JSONL</button>
  <button id="copy">Copy JSON</button>
  <button id="clear">Clear all</button>
</header>
<main>
  <div>
    <div class="row" id="filter" style="margin-bottom:12px">
      <button data-f="all" aria-pressed="true">All</button>
      <button data-f="todo">Unannotated</button>
      <button data-f="good">Good</button>
      <button data-f="wrong">Wrong character</button>
      <button data-f="bad">Bad strokes</button>
      <button data-f="unclear">Unclear</button>
    </div>
    <div class="grid" id="grid"></div>
  </div>
  <aside>
    <h2>The drawing</h2>
    <div id="detail" class="empty">Pick a drawing on the left.</div>
    <h2>Is it a fair example?</h2>
    <div class="row" id="verdict">
      <button data-v="good">Good</button>
      <button data-v="wrong">Wrong character</button>
      <button data-v="bad">Bad strokes</button>
      <button data-v="unclear">Unclear</button>
    </div>
    <h2>What went wrong</h2>
    <div class="row" id="tags">
      <button data-t="missing-stroke">Missing stroke</button>
      <button data-t="extra-stroke">Extra stroke</button>
      <button data-t="misplaced-part">Part misplaced</button>
      <button data-t="proportions">Proportions</button>
      <button data-t="scribble">Scribble</button>
      <button data-t="one-stroke">One stroke only</button>
    </div>
    <h2>The character it should be</h2>
    <input class="field" id="correct" placeholder="Type or paste a character" spellcheck="false">
    <div class="tiles" id="suggest"></div>
    <h2>Note</h2>
    <textarea class="field" id="note" placeholder="What is worth remembering about this one"></textarea>
    <p class="count">Keys: <kbd>←</kbd> <kbd>→</kbd> move, <kbd>1</kbd>–<kbd>4</kbd> verdict, <kbd>Esc</kbd> clear the selection.</p>
  </aside>
</main>
<script type="application/json" id="data">${payload}</script>
<script>
  const data = JSON.parse(document.getElementById('data').textContent)
  const drawings = data.drawings
  const suggestions = data.suggestions
  const KEY = 'tangut-input:annotations'
  /** @type {Record<string, {verdict?: string, tags: string[], note: string, correct: string}>} */
  let notes = {}
  try { notes = JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { notes = {} }

  const grid = document.getElementById('grid')
  const detail = document.getElementById('detail')
  const count = document.getElementById('count')
  let current = -1
  let filter = 'all'

  /** @param {{id: string}} drawing */
  function kept(drawing) {
    const note = notes[drawing.id]
    if (filter === 'all') return true
    if (filter === 'todo') return !note?.verdict
    return note?.verdict === filter
  }

  /** @param {number[][]} strokes */
  function svgOf(strokes, size = 76) {
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      strokes.map(stroke => '<polyline points="' + stroke.map(([x, y]) => (x * size).toFixed(1) + ',' + (y * size).toFixed(1)).join(' ') +
        '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>').join('') + '</svg>'
  }

  function noteOf(id) { return notes[id] ??= { tags: [], note: '', correct: '' } }

  function paint() {
    grid.innerHTML = ''
    drawings.forEach((drawing, i) => {
      if (!kept(drawing)) return
      const note = notes[drawing.id]
      const figure = document.createElement('figure')
      if (note?.verdict) figure.dataset.verdict = note.verdict
      if (i === current) figure.setAttribute('aria-current', 'true')
      figure.innerHTML = '<div class="pair">' + svgOf(drawing.strokes) + '<span class="target" lang="txg">' +
        (note?.correct || drawing.char) + '</span></div><figcaption><span>' + drawing.session.slice(-8) + ' · ' +
        drawing.strokes.length + ' strokes</span><span>' + drawing.at.slice(11, 16) + '</span></figcaption>'
      figure.onclick = () => { current = i; paint(); show() }
      grid.append(figure)
    })
    const done = Object.values(notes).filter(note => note.verdict).length
    const shown = drawings.filter(kept).length
    count.textContent = shown + ' of ' + drawings.length + ' drawings · ' + done + ' annotated'
    for (const button of document.querySelectorAll('#filter button')) button.setAttribute('aria-pressed', String(button.dataset.f === filter))
  }

  function show() {
    const drawing = drawings[current]
    if (!drawing) { detail.textContent = 'Pick a drawing on the left.'; detail.className = 'empty'; return }
    const note = noteOf(drawing.id)
    detail.className = ''
    detail.innerHTML = '<div class="pair" style="display:flex;align-items:center;gap:12px">' + svgOf(drawing.strokes, 96) +
      '<span style="font-family:\\'Noto Serif Tangut\\',serif;font-size:46px">' + (note.correct || drawing.char) + '</span></div>' +
      '<p class="count">' + drawing.id + '<br>' + drawing.at.replace('T', ' ').slice(0, 16) + ' · ' + drawing.strokes.length + ' strokes</p>'
    for (const button of document.querySelectorAll('#verdict button')) button.setAttribute('aria-pressed', String(note.verdict === button.dataset.v))
    for (const button of document.querySelectorAll('#tags button')) button.setAttribute('aria-pressed', String(note.tags.includes(button.dataset.t)))
    document.getElementById('correct').value = note.correct
    document.getElementById('note').value = note.note
    suggest(drawing)
  }

  /** Characters near the drawn one in the Cangjie table, for correcting a wrong target. */
  function suggest(drawing) {
    const box = document.getElementById('suggest')
    box.innerHTML = ''
    const note = notes[drawing.id]
    for (const char of suggestions[note?.correct || drawing.char] ?? []) {
      const button = document.createElement('button')
      button.className = 'tile'
      button.textContent = char
      button.setAttribute('aria-pressed', String(document.getElementById('correct').value === char))
      button.onclick = () => { setCorrect(char); show() }
      box.append(button)
    }
  }

  function setCorrect(char) { noteOf(drawings[current].id).correct = char; save() }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(notes)) } catch {} }

  for (const button of document.querySelectorAll('#verdict button')) {
    button.onclick = () => {
      if (current < 0) return
      const note = noteOf(drawings[current].id)
      note.verdict = note.verdict === button.dataset.v ? undefined : button.dataset.v
      save(); paint(); show()
    }
  }
  for (const button of document.querySelectorAll('#tags button')) {
    button.onclick = () => {
      if (current < 0) return
      const note = noteOf(drawings[current].id)
      const tag = button.dataset.t
      note.tags = note.tags.includes(tag) ? note.tags.filter(other => other !== tag) : [...note.tags, tag]
      save(); show()
    }
  }
  document.getElementById('note').oninput = event => { if (current >= 0) { noteOf(drawings[current].id).note = event.target.value; save() } }
  document.getElementById('correct').oninput = event => { if (current >= 0) { noteOf(drawings[current].id).correct = event.target.value.trim(); save(); paint() } }

  document.getElementById('export').onclick = () => {
    const lines = drawings.map(drawing => {
      const note = notes[drawing.id]
      if (!note?.verdict && !note?.correct && !note?.note) return null
      return JSON.stringify({ id: drawing.id, char: drawing.char, corrected: note.correct || undefined, verdict: note.verdict ?? null, tags: note.tags ?? [], note: note.note || undefined })
    }).filter(Boolean)
    const blob = new Blob([lines.join('\\n') + '\\n'], { type: 'application/jsonl' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'tangut-drawings-annotations.jsonl'
    link.click()
  }
  document.getElementById('copy').onclick = async () => {
    await navigator.clipboard.writeText(JSON.stringify(notes, null, 2))
  }
  document.getElementById('clear').onclick = () => { notes = {}; save(); paint(); show() }
  for (const button of document.querySelectorAll('#filter button')) {
    button.onclick = () => { filter = button.dataset.f; paint() }
  }

  addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    if (event.key === 'ArrowRight') { current = Math.min(drawings.length - 1, current + 1); paint(); show() }
    if (event.key === 'ArrowLeft') { current = Math.max(0, current - 1); paint(); show() }
    const verdicts = ['good', 'wrong', 'bad', 'unclear']
    if (['1', '2', '3', '4'].includes(event.key) && current >= 0) {
      const note = noteOf(drawings[current].id)
      note.verdict = verdicts[Number(event.key) - 1]
      save(); paint(); show()
    }
    if (event.key === 'Escape') { current = -1; paint(); show() }
  })

  paint()
</script>
</body>
</html>
`

writeFileSync(out, html)
console.log(`${drawings.length} drawings -> ${out}`)

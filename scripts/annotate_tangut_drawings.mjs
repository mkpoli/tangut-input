// A review board for the drawings made by hand, one at a time: the drawing large beside the
// character it was made for, a verdict on the number keys, and the next one up as soon as it is
// given. Everything stays in the page until "Export" writes it out; the drawings never leave the
// machine.
//   bun scripts/annotate_tangut_drawings.mjs [out.html]
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { parseShapes, indexShapes, rasterize, rankShapes } from '../app/lib/shape.js'

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

// Characters near the drawn one in the Cangjie table, to correct a wrong target with.
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
    if (near.size >= 12) break
  }
  suggestions.set(char, [...near].slice(0, 12))
}

// What the drawing search itself makes of each drawing: the characters it ranked first. Marking one
// wrong then opens these, so the correction is a pick from the recogniser's own list.
const faces = ['tangut-shapes.bin.gz', 'tangut-shapes-yinchuan.bin.gz', 'tangut-shapes-genzui.bin.gz', 'tangut-shapes-mojikyo.bin.gz', 'tangut-shapes-std.bin.gz']
const indexes = faces.map(file => indexShapes(parseShapes(gunzipSync(readFileSync(new URL(`../app/data/${file}`, import.meta.url))))))
const strokesFile = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-strokes.json.gz', import.meta.url))).toString())
const strokeCounts = new Map(Object.entries(strokesFile.values))
/** @type {Map<string, string[]>} */
const candidates = new Map()
for (const drawing of drawings) {
  const strokes = drawing.strokes.map(stroke => stroke.map(([x, y]) => [x * 340, y * 340]))
  const mask = rasterize(strokes)
  /** @type {Map<string, number>} */
  const ranked = new Map()
  for (const index of indexes) {
    rankShapes(index, mask, { limit: index.chars.length, strokes: strokes.length, strokeCounts })
      .forEach((hit, at) => { const known = ranked.get(hit.char); if (known === undefined || at < known) ranked.set(hit.char, at) })
  }
  const list = [...ranked.entries()]
    .filter(([char]) => /[\u{17000}-\u{187FF}]/u.test(char))
    .sort((a, b) => a[1] - b[1])
    .map(([char]) => char)
    .slice(0, 30)
  candidates.set(drawing.id, list)
}

// Characters one component away: same parts but one replaced, added or dropped. A reader who means
// a character but writes a shape with a neighbouring component needs to see that neighbour, and the
// recogniser is right to rank what was actually drawn.
const entries = JSON.parse(gunzipSync(readFileSync(new URL('../app/data/tangut-entries.json.gz', import.meta.url))).toString())
const OPERATORS = new Set([...'⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻'])
/** @param {string} composition */
function partsOf(composition) {
  return [...(composition ?? '')].filter(char => !OPERATORS.has(char) && char !== '(' && char !== ')')
}
/** @type {Map<string, Set<string>>} */
const byDropped = new Map()
/** @type {Map<string, string[]>} */
const partsByChar = new Map()
for (const row of entries.rows) {
  const parts = partsOf(row[1])
  if (parts.length < 2) continue
  partsByChar.set(row[0], parts)
  for (const part of new Set(parts)) {
    const key = [...parts]
    key.splice(key.indexOf(part), 1)
    const bucket = byDropped.get(key.sort().join('')) ?? new Set()
    byDropped.set(key.sort().join(''), bucket)
    bucket.add(row[0])
  }
}
/** @param {string} char */
function siblingsOf(char) {
  const parts = partsByChar.get(char)
  if (!parts) return []
  /** @type {Set<string>} */
  const found = new Set()
  for (const part of new Set(parts)) {
    const key = [...parts]
    key.splice(key.indexOf(part), 1)
    for (const other of byDropped.get(key.sort().join('')) ?? []) if (other !== char) found.add(other)
  }
  return [...found].slice(0, 24)
}
/** @type {Record<string, string[]>} */
const siblings = {}
for (const drawing of drawings) {
  siblings[drawing.char] ??= siblingsOf(drawing.char)
  for (const pick of (candidates.get(drawing.id) ?? []).slice(0, 6)) siblings[pick] ??= siblingsOf(pick)
}

const payload = JSON.stringify({
  drawings,
  suggestions: Object.fromEntries(suggestions),
  candidates: Object.fromEntries(candidates),
  siblings,
})

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review the hand drawings — ${drawings.length}</title>
<style>
  @font-face { font-family: "Noto Serif Tangut"; src: url("/app/public/fonts/NotoSerifTangut-Regular.woff2") format("woff2");
               unicode-range: U+17000-18AFF, U+18D00-18DFF; font-display: swap; }
  :root { color-scheme: light dark; --ink:#2b241d; --bg:#faf6ef; --line:#e4dccd; --muted:#8a7f6d;
          --accent:#a5382c; --ok:#2f6b46; --warn:#8a6a1f; }
  @media (prefers-color-scheme: dark) { :root { --ink:#eae3d6; --bg:#1b1815; --line:#3a342c; --muted:#9c907c;
          --accent:#e07060; --ok:#7fc79b; --warn:#d9b45a; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; display:flex; flex-direction:column; background:var(--bg); color:var(--ink);
         font:15px/1.5 ui-serif, Georgia, serif; }
  header { display:flex; align-items:center; gap:18px; padding:14px 22px; border-bottom:1px solid var(--line); }
  h1 { font-size:15px; margin:0; font-weight:600; letter-spacing:.01em; }
  .progress { flex:1; height:4px; background:var(--line); border-radius:2px; overflow:hidden; }
  .progress i { display:block; height:100%; background:var(--accent); width:0; transition:width .2s ease; }
  .count { color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
  main { flex:1; display:grid; place-items:center; padding:24px 22px 6px; }
  .card { display:flex; align-items:center; gap:44px; }
  .drawn { color:var(--accent); }
  .target { font-family:"Noto Serif Tangut", serif; font-size:104px; line-height:1; }
  .target.corrected { color:var(--ok); }
  .picks { display:grid; gap:10px; justify-items:center; margin-top:14px; }
  .picks p { margin:0; color:var(--muted); font-size:13px; }
  .picks .tiles { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; max-width:900px; }
  .picks .tile { width:52px; height:52px; font-size:28px; position:relative; }
  .picks .tile span { position:absolute; top:1px; left:3px; font:9px ui-monospace, monospace; color:var(--muted); }
  .meta { margin:18px 0 0; text-align:center; color:var(--muted); font:12px ui-monospace, monospace; }
  .verdicts { display:flex; justify-content:center; gap:10px; flex-wrap:wrap; padding:6px 22px 16px; }
  .verdicts button { font:inherit; font-size:16px; padding:11px 20px; border:1px solid var(--line); border-radius:10px;
                     background:transparent; color:var(--ink); cursor:pointer; display:flex; align-items:center; gap:8px; }
  .verdicts button:hover { border-color:var(--ink); }
  .verdicts button[aria-pressed="true"] { background:var(--ink); color:var(--bg); border-color:var(--ink); }
  .verdicts kbd { font:11px ui-monospace, monospace; opacity:.6; }
  .finder { width:min(920px, calc(100vw - 44px)); margin:0 auto 14px; display:grid; gap:8px; }
  .frame { position:relative; height:min(70vh, 560px); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  .frame iframe { width:100%; height:100%; border:0; background:var(--bg); }
  #site { font:inherit; font-size:13px; padding:6px 11px; border:1px solid var(--line); border-radius:8px;
          background:transparent; color:var(--ink); cursor:pointer; }
  details { margin:0 auto 16px; width:min(920px, calc(100vw - 44px)); border:1px solid var(--line); border-radius:12px; }
  summary { cursor:pointer; padding:10px 14px; color:var(--muted); font-size:13px; }
  .inside { display:grid; gap:14px; padding:0 14px 16px; }
  .row { display:flex; flex-wrap:wrap; gap:6px; }
  .row button { font:inherit; font-size:13px; padding:6px 11px; border:1px solid var(--line); border-radius:8px;
                background:transparent; color:var(--ink); cursor:pointer; }
  .row button[aria-pressed="true"] { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
  .field { width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:transparent;
           color:var(--ink); font:inherit; }
  textarea.field { min-height:64px; resize:vertical; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(38px,1fr)); gap:6px; }
  .tile { aspect-ratio:1; display:grid; place-items:center; border:1px solid var(--line); border-radius:8px;
          font-family:"Noto Serif Tangut", serif; font-size:22px; cursor:pointer; background:transparent; color:var(--ink); }
  .label { font-size:11.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); font-weight:600; margin:0 0 6px; }
  footer { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 22px 16px; color:var(--muted); font-size:12.5px; }
  .done { text-align:center; display:grid; gap:10px; }
  .done h2 { font-size:22px; margin:0; font-weight:600; }
</style>
</head>
<body>
<header>
  <h1>Review the hand drawings</h1>
  <span class="count" id="count"></span>
  <span class="count" id="status">saved</span>
  <span class="progress"><i id="bar"></i></span>
</header>
<main><div id="stage"></div><div id="picks" hidden></div></main>
<div class="finder" id="finder" hidden>
  <div class="row" style="justify-content:space-between;align-items:center">
    <span class="label" style="margin:0">Find the character it should be</span>
    <button id="site" type="button">Open the site's input method</button>
  </div>
  <div id="siteframe" class="frame" hidden>
    <iframe id="embed" title="Tangut Input" src="about:blank" referrerpolicy="no-referrer"></iframe>
  </div>
</div>
</div>
<div class="verdicts" id="verdicts">
  <button data-v="good">Good <kbd>1</kbd></button>
  <button data-v="wrong">Wrong character <kbd>2</kbd></button>
  <button data-v="bad">Bad strokes <kbd>3</kbd></button>
  <button data-v="unclear">Unclear <kbd>4</kbd></button>
  <button data-v="unattested">Not a character <kbd>5</kbd></button>
  <button data-v="skip">Skip <kbd>space</kbd></button>
</div>
<details id="more">
  <summary>Tags, correction and note</summary>
  <div class="inside">
    <div>
      <p class="label">What went wrong</p>
      <div class="row" id="tags">
        <button data-t="missing-stroke">Missing stroke</button>
        <button data-t="extra-stroke">Extra stroke</button>
        <button data-t="misplaced-part">Part misplaced</button>
        <button data-t="proportions">Proportions</button>
        <button data-t="scribble">Scribble</button>
        <button data-t="one-stroke">One stroke only</button>
      </div>
    </div>
    <div>
      <p class="label">The character it should be</p>
      <input class="field" id="correct" placeholder="Type or paste a character" spellcheck="false">
      <div class="tiles" id="suggest" style="margin-top:8px"></div>
    </div>
    <div>
      <p class="label">Note</p>
      <textarea class="field" id="note" placeholder="What is worth remembering about this one"></textarea>
    </div>
  </div>
</details>
<footer>
  <span id="where"></span>
  <div class="row">
    <button id="back">Back ←</button>
    <button id="export">Export JSONL</button>
    <button id="clear">Start over</button>
  </div>
</footer>
<script type="application/json" id="data">${payload}</script>
<script>
  const data = JSON.parse(document.getElementById('data').textContent)
  const drawings = data.drawings
  const suggestions = data.suggestions
  const KEY = 'tangut-input:annotations'
  let notes = {}
  try { notes = JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { notes = {} }
  fetch('/api/annotations').then(response => response.ok ? response.json() : null).then(data => {
    if (!data?.notes) return
    const stored = Object.keys(notes).length
    const fromServer = Object.keys(data.notes).length
    if (fromServer > stored) { notes = data.notes; save(); paint() }
  }).catch(() => {})

  const stage = document.getElementById('stage')
  const count = document.getElementById('count')
  const bar = document.getElementById('bar')
  const where = document.getElementById('where')
  const more = document.getElementById('more')
  let index = 0
  let history = []
  let picking = false

  /**
   * The drawings still worth a look. One called good is settled and one called bad has left the
   * dataset; what remains is unjudged, or judged as another character and still without the
   * correction the reviewer wanted to give it.
   */
  function needsWork(drawing) {
    const note = notes[drawing.id]
    if (!note?.verdict) return true
    if (note.verdict === 'good' || note.verdict === 'bad') return false
    return !note.correct
  }
  function queue() { return drawings.filter(needsWork) }
  function current() { return queue()[Math.min(index, Math.max(0, queue().length - 1))] }
  function noteOf(id) { return notes[id] ??= { tags: [], note: '', correct: '' } }
  let saving = null
  let saved = 'saved'
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(notes)) } catch {}
    saved = 'saving'
    document.getElementById('status').textContent = saved
    clearTimeout(saving)
    saving = setTimeout(async () => {
      try {
        const response = await fetch('/api/annotations', { method: 'POST', body: JSON.stringify(notes) })
        saved = response.ok ? 'saved' : 'not saved'
      } catch { saved = 'not saved' }
      document.getElementById('status').textContent = saved
    }, 250)
  }

  /** @param {number[][]} strokes */
  function svgOf(strokes, size = 250) {
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" class="drawn">' +
      strokes.map(stroke => '<polyline points="' + stroke.map(([x, y]) => (x * size).toFixed(1) + ',' + (y * size).toFixed(1)).join(' ') +
        '" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>').join('') + '</svg>'
  }

  function paint() {
    const pending = queue().length
    const done = drawings.length - pending
    count.textContent = done + ' / ' + drawings.length
    bar.style.width = (done / drawings.length * 100).toFixed(1) + '%'

    const drawing = current()
    if (!drawing) {
      stage.innerHTML = '<div class="done"><h2>Nothing left to review</h2><p class="count">Every drawing is either good, out of the dataset, or corrected.</p></div>'
      return
    }
    const note = noteOf(drawing.id)
    stage.innerHTML = '<div><div class="card">' + svgOf(drawing.strokes) +
      '<div class="target' + (note.correct ? ' corrected' : '') + '" lang="txg">' + (note.correct || drawing.char) + '</div></div>' +
      '<p class="meta">' + drawing.at.replace('T', ' ').slice(0, 16) + ' · ' + drawing.strokes.length + ' strokes · ' +
      drawing.name + '</p></div>'
    where.textContent = pending + ' to look at' + (note.verdict ? ' · this one: ' + note.verdict : '')
    for (const button of document.querySelectorAll('#verdicts button')) {
      button.setAttribute('aria-pressed', String(note.verdict === button.dataset.v))
    }
    paintPicks(drawing, note)
    // The finders are for a drawing whose character is in doubt; otherwise they only take room.
    document.getElementById('finder').hidden = !picking && note.verdict !== 'wrong' && note.verdict !== 'unattested'
    if (document.getElementById('finder').hidden) document.getElementById('siteframe').hidden = true
    for (const button of document.querySelectorAll('#tags button')) {
      button.setAttribute('aria-pressed', String(note.tags.includes(button.dataset.t)))
    }
    document.getElementById('correct').value = note.correct
    document.getElementById('note').value = note.note
    const box = document.getElementById('suggest')
    box.innerHTML = ''
    for (const char of suggestions[note.correct || drawing.char] ?? []) {
      const button = document.createElement('button')
      button.className = 'tile'
      button.textContent = char
      button.onclick = () => { note.correct = char; save(); paint() }
      box.append(button)
    }
  }

  /**
   * Marking the character wrong asks which one it was, from the recogniser's own ranking: the pick
   * records both, so a review leaves a corrected target behind.
   */
  function paintPicks(drawing, note) {
    const box = document.getElementById('picks')
    box.innerHTML = ''
    box.hidden = !picking
    if (!picking) return
    const picks = data.candidates[drawing.id] ?? []
    const hint = document.createElement('p')
    hint.textContent = 'What the drawing search ranked for this drawing — pick the character it should be.'
    const tiles = document.createElement('div')
    tiles.className = 'tiles'
    picks.forEach((char, i) => {
      const button = document.createElement('button')
      button.className = 'tile'
      button.title = 'Rank ' + (i + 1)
      button.innerHTML = '<span>' + (i + 1) + '</span>' + char
      button.onclick = () => { note.correct = char; choose() }
      tiles.append(button)
    })
    // Beside the ranking, the characters one component away from the first pick: what a reader who
    // wrote a neighbouring component most likely meant.
    const first = picks[0]
    const kin = (data.siblings[first] ?? []).filter(char => !picks.includes(char)).slice(0, 16)
    if (kin.length) {
      const kinHint = document.createElement('p')
      kinHint.textContent = 'One component away from ' + first + ' — often what was meant'
      const kinTiles = document.createElement('div')
      kinTiles.className = 'tiles'
      for (const char of kin) {
        const button = document.createElement('button')
        button.className = 'tile'
        button.textContent = char
        button.onclick = () => { note.correct = char; choose() }
        kinTiles.append(button)
      }
      box.append(kinHint, kinTiles)
    }
    const none = document.createElement('button')
    none.className = 'verdicts'
    none.style.cssText = 'font:inherit;font-size:13px;padding:6px 11px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink);cursor:pointer'
    none.textContent = 'None of these'
    none.onclick = () => choose()
    box.append(hint, tiles, none)
  }

  /** Records the wrong character, with whatever correction was picked, and moves on. */
  function choose() {
    const drawing = current()
    noteOf(drawing.id).verdict = 'wrong'
    save()
    picking = false
    index = 0
    paint()
  }

  /** @param {string} verdict */
  function decide(verdict) {
    const drawing = current()
    if (!drawing) return
    if (verdict === 'wrong') { picking = true; paint(); return }
    history.push(drawing.id)
    if (verdict !== 'skip') noteOf(drawing.id).verdict = verdict
    save()
    picking = false
    index = 0
    paint()
  }

  for (const button of document.querySelectorAll('#verdicts button')) button.onclick = () => decide(button.dataset.v)
  for (const button of document.querySelectorAll('#tags button')) {
    button.onclick = () => {
      const note = noteOf(current().id)
      const tag = button.dataset.t
      note.tags = note.tags.includes(tag) ? note.tags.filter(other => other !== tag) : [...note.tags, tag]
      save(); paint()
    }
  }
  document.getElementById('note').oninput = event => { const note = noteOf(current().id); note.note = event.target.value; save() }
  document.getElementById('correct').oninput = event => { const note = noteOf(current().id); note.correct = event.target.value.trim(); save(); paint() }
  document.getElementById('back').onclick = () => {
    const id = history.pop()
    if (!id) return
    if (notes[id]) notes[id].verdict = undefined
    save()
    index = Math.max(0, queue().findIndex(drawing => drawing.id === id))
    paint()
  }
  document.getElementById('export').onclick = () => {
    const lines = drawings.map(drawing => {
      const note = notes[drawing.id]
      if (!note?.verdict && !note?.correct && !note?.note) return null
      return JSON.stringify({ id: drawing.id, char: drawing.char, corrected: note.correct || undefined,
        verdict: note.verdict ?? null, excluded: note.verdict === 'bad' || undefined,
        tags: note.tags ?? [], note: note.note || undefined })
    }).filter(Boolean)
    const blob = new Blob([lines.join('\\n') + '\\n'], { type: 'application/jsonl' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'tangut-drawings-annotations.jsonl'
    link.click()
  }
  document.getElementById('clear').onclick = () => { notes = {}; history = []; save(); index = 0; paint() }

  // The site's own input method, embedded: whatever way the reviewer finds the character there —
  // code, corners, reading, meaning, parts, the pad — it comes back here as the correction.
  addEventListener('message', event => {
    const data = event.data
    if (!data || data.type !== 'tangut-pick' || typeof data.char !== 'string' || !data.char) return
    const drawing = current()
    if (!drawing) return
    const note = noteOf(drawing.id)
    note.correct = data.char
    // The reviewer's own drawing of the character is kept too, marked as theirs.
    if (Array.isArray(data.strokes) && data.strokes.length) {
      fetch('/api/reviewer', { method: 'POST', body: JSON.stringify({ char: data.char, strokes: data.strokes, for: drawing.id }) })
        .then(response => response.ok ? response.json() : null)
        .then(saved => { if (saved?.file) { note.reviewer = saved.file; save() } })
        .catch(() => {})
    }
    if (note.verdict === 'good' || note.verdict === 'bad' || !note.verdict) note.verdict = 'wrong'
    save()
    document.getElementById('siteframe').hidden = true
    paint()
  })
  document.getElementById('site').onclick = () => {
    const frame = document.getElementById('siteframe')
    const embed = document.getElementById('embed')
    embed.src = 'https://tangut.mkpo.li/?pick=1'
    frame.hidden = false
  }

  addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    const verdicts = { '1': 'good', '2': 'wrong', '3': 'bad', '4': 'unclear', '5': 'unattested', ' ': 'skip' }
    if (verdicts[event.key]) { event.preventDefault(); decide(verdicts[event.key]) }
    if (event.key === 'ArrowLeft') document.getElementById('back').click()
    if (event.key === 'Escape') more.open = false
  })

  paint()
</script>
</body>
</html>
`

writeFileSync(out, html)
console.log(`${drawings.length} drawings -> ${out}`)

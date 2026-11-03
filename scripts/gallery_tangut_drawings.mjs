// A gallery of the drawings made by hand: each one beside the character it was made for, in the
// pad's own square, with the round it came from and the time it was made.
//   bun scripts/gallery_tangut_drawings.mjs [out.html]
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'docs/handwriting-gallery.html'
const DATA = new URL('../data/handwriting/', import.meta.url)
if (!existsSync(DATA)) {
  console.error('no data/handwriting')
  process.exit(1)
}

/** @param {number[][]} strokes */
function svgOf(strokes, size = 84) {
  const paths = strokes.map(stroke => {
    const points = stroke.map(([x, y]) => `${(x * size).toFixed(1)},${(y * size).toFixed(1)}`)
    return `<polyline points="${points.join(' ')}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
  })
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${paths.join('')}</svg>`
}

/** @type {{ session: string, name: string, char: string, at: string, kind: string, count: number, svg: string }[]} */
const drawings = []
for (const session of readdirSync(DATA).sort()) {
  const dir = join(DATA.pathname, session)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
  for (const name of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const record = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    if (!record.char || !record.strokes?.length) continue
    drawings.push({
      session,
      name,
      char: record.char,
      at: record.at ?? '',
      kind: record.kind ?? '',
      count: record.strokes.length,
      svg: svgOf(record.strokes),
    })
  }
}

const sessions = new Map()
for (const drawing of drawings) sessions.set(drawing.session, (sessions.get(drawing.session) ?? 0) + 1)
const right = []

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Drawings made by hand — ${drawings.length}</title>
<style>
  :root { color-scheme: light dark; --ink: #2b241d; --bg: #faf6ef; --line: #e4dccd; --muted: #8a7f6d; --accent: #a5382c; }
  @media (prefers-color-scheme: dark) { :root { --ink: #eae3d6; --bg: #1b1815; --line: #3a342c; --muted: #9c907c; --accent: #e07060; } }
  body { margin: 0; padding: 28px 32px 60px; background: var(--bg); color: var(--ink);
         font: 15px/1.5 ui-serif, "Noto Serif", Georgia, serif; }
  h1 { font-size: 26px; font-weight: 600; margin: 0 0 4px; }
  .lead { color: var(--muted); margin: 0 0 22px; max-width: 62em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 14px; }
  figure { margin: 0; padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: color-mix(in srgb, var(--bg) 92%, var(--ink)); }
  .pair { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .drawn { color: var(--accent); }
  .target { font-family: "Noto Serif Tangut", serif; font-size: 38px; line-height: 1; }
  figcaption { margin-top: 8px; font: 12px/1.4 ui-monospace, monospace; color: var(--muted);
               display: flex; justify-content: space-between; gap: 6px; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0 0 20px; color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<h1>Drawings made by hand</h1>
<p class="lead">Every drawing the pad kept, beside the character it was made for. The red line is what
the reader drew; the black glyph is the printed form it was matched against. Rounds are the pad's own
sessions; a quiz round draws each character until it is found.</p>
<p class="summary"><span>${drawings.length} drawings</span><span>${sessions.size} rounds</span>
<span>${new Set(drawings.map(drawing => drawing.char)).size} characters</span></p>
<div class="grid">
${drawings.map(drawing => `<figure>
  <div class="pair"><span class="drawn">${drawing.svg}</span><span class="target" lang="txg">${drawing.char}</span></div>
  <figcaption><span>${drawing.session.slice(-8)} · ${drawing.count} strokes</span><span>${drawing.at.slice(11, 16)}</span></figcaption>
</figure>`).join('\n')}
</div>
</body>
</html>
`

writeFileSync(out, html)
console.log(`${drawings.length} drawings from ${sessions.size} rounds -> ${out}`)

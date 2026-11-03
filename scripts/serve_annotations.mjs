// The annotation board's server: it serves the repository (so the Tangut face loads from the same
// origin) and takes the notes as they are written, so the file is current without an export.
//   bun scripts/serve_annotations.mjs [port]
import { writeFileSync, mkdirSync } from 'node:fs'

const root = new URL('../', import.meta.url).pathname
const port = Number(process.argv[2] ?? 5480)
const notesFile = new URL('../data/handwriting/annotations.json', import.meta.url)
const reviewerDir = new URL('../data/handwriting/reviewer/', import.meta.url)
const types = new Map([['html', 'text/html; charset=utf-8'], ['woff2', 'font/woff2'], ['js', 'text/javascript'], ['css', 'text/css'], ['json', 'application/json']])

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/api/annotations') {
      if (request.method === 'POST') {
        const body = await request.text()
        let notes
        try { notes = JSON.parse(body) } catch { return new Response('bad json', { status: 400 }) }
        mkdirSync(new URL('../data/handwriting/', import.meta.url), { recursive: true })
        writeFileSync(notesFile, JSON.stringify({ saved: new Date().toISOString(), notes }, null, 2) + '\n')
        return Response.json({ ok: true })
      }
      return new Response(await Bun.file(notesFile).text(), { headers: { 'content-type': 'application/json' } })
    }
    // A drawing the reviewer made to find the character: kept as theirs, beside the writer's.
    if (url.pathname === '/api/reviewer' && request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body?.char || !Array.isArray(body.strokes) || !body.strokes.length) return new Response('bad request', { status: 400 })
      mkdirSync(reviewerDir, { recursive: true })
      const at = new Date().toISOString()
      const name = `${at.replace(/[:.]/g, '-')}-${(body.char.codePointAt(0) ?? 0).toString(16)}.json`
      writeFileSync(new URL(name, reviewerDir), JSON.stringify({
        char: body.char, author: 'reviewer', for: body.for ?? null, at,
        strokes: body.strokes, width: 340, height: 340,
      }) + '\n')
      return Response.json({ ok: true, file: name })
    }
    let path = decodeURIComponent(url.pathname)
    if (path === '/') path = '/docs/handwriting-annotate.html'
    let file = Bun.file(root + path.slice(1))
    // The site's built files are served beside the repository, so a page that embeds a built entry
    // finds its chunks here too.
    if (!(await file.exists())) {
      const built = Bun.file(new URL(`../dist${path}`, import.meta.url))
      if (await built.exists()) file = built
      else return new Response('not found: ' + path, { status: 404 })
    }
    return new Response(file, {
      headers: { 'content-type': types.get(path.split('.').pop() ?? '') ?? 'application/octet-stream', 'cache-control': 'no-cache' },
    })
  },
})
console.log(`serving ${root} on http://0.0.0.0:${port}/ · notes -> ${notesFile.pathname}`)

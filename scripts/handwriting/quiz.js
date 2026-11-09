#!/usr/bin/env bun
// A local quiz to collect handwriting: it shows a Tangut character, you draw it, and every stroke
// is saved beside the answer in a session directory. Two kinds of prompt make up a round — a
// character that looks like the one before it on the page, and a set of characters drawn from the
// font's glyphs, one of them the answer — so the drawings include the confusions that matter.
//
//   bun run quiz                     # writes to data/handwriting/<timestamp>/
//   bun run quiz --out data/handwriting/trial-1 --size 60 --seed 3
//
// The app screenshots are made with `shapes` (the drawing pad), so a formal test uses the same
// pad as the site. The capture page here differs in two ways: it never shows the answer, and it
// exports the strokes as JSON.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseShapes, indexShapes, distanceField, SIZE } from '../../app/lib/shape.js'
import page from './page.html' with { type: 'text' }
import { build as buildDataset } from './dataset.mjs'

const CELLS = SIZE * SIZE
const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1])
// A round's length; the last prompt is always asked for rather than prefetched, so it is not missed.
const rounds = Math.max(10, Number(args.get('size') ?? 40))
let seed = Number(args.get('seed') ?? Date.now() % 100000)
const out = args.get('out') ?? `data/handwriting/${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
const port = Number(args.get('port') ?? 5411)
// A drawing is also sent to the site's record, so everything the pad has seen can be read back from
// one place. `--upload ''` keeps a round on this machine only.
const upload = args.get('upload') ?? 'https://tangut.mkpo.li/api/record'

/** A small reproducible generator, seeded from the argument. */
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

/** Zhang–Suen thinning, as the evaluation uses. @param {Uint8Array} source */
function thin(source) {
  const g = Uint8Array.from(source)
  const at = (x, y) => (x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : g[y * SIZE + x])
  let changed = true
  while (changed) {
    changed = false
    for (const step of [0, 1]) {
      const drop = []
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (!at(x, y)) continue
        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)]
        const b = p.reduce((s, v) => s + v, 0)
        let a = 0
        for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++
        const c1 = step ? p[0] * p[2] * p[6] : p[0] * p[2] * p[4]
        const c2 = step ? p[0] * p[4] * p[6] : p[2] * p[4] * p[6]
        if (b >= 2 && b <= 6 && a === 1 && !c1 && !c2) drop.push(y * SIZE + x)
      }
      for (const c of drop) g[c] = 0
      if (drop.length) changed = true
    }
  }
  return g
}

const shapes = parseShapes(gunzipSync(readFileSync(new URL('../../app/data/tangut-shapes.bin.gz', import.meta.url))))
// The components the entries are built from, so a round can ask for one on its own: a reader can
// recognise a piece of a character long before they can name the whole of it.
const entries = JSON.parse(gunzipSync(readFileSync(new URL('../../app/data/tangut-entries.json.gz', import.meta.url))).toString())
const componentChars = [...new Set(
  entries.rows.flatMap(row => [...String(row[1] ?? '')].filter(char => /[\u{18800}-\u{18AFF}]/u.test(char))),
)]
const index = indexShapes(shapes)
/** Ideographs with a glyph, in code point order. */
const ideographs = index.chars.map((char, i) => [char, i]).filter(([char]) => /[\u{17000}-\u{187FF}]/u.test(String(char)))

/** @param {string} char */
const glyphIndex = char => ideographs.find(([other]) => other === char)?.[1]

/**
 * The characters a glyph looks like: its own mask against every other, a two-way chamfer.
 * @param {string} char @param {number} count
 */
function lookalikes(char, count) {
  const i = glyphIndex(char)
  let glyph = null
  if (i !== undefined) {
    glyph = new Uint8Array(CELLS)
    const bytes = CELLS / 8
    for (let c = 0; c < CELLS; c++) glyph[c] = (shapes.masks[Number(i) * bytes + (c >> 3)] >> (c & 7)) & 1
  }
  if (!glyph) return []
  const target = index.inks[/** @type {number} */ (i)]
  const field = distanceField(glyph)
  const scored = []
  for (let k = 0; k < index.chars.length; k++) {
    if (index.chars[k] === char || !/[\u{17000}-\u{187FF}]/u.test(String(index.chars[k]))) continue
    const ink = index.inks[k]
    let forward = 0
    for (const c of target) forward += index.fields[k * CELLS + c]
    let backward = 0
    for (const c of ink) backward += field[c]
    scored.push({ char: index.chars[k], score: forward / Math.max(1, target.length) + backward / Math.max(1, ink.length) })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, count).map(hit => hit.char)
}

// Prompts are drawn with the same face the site sets Tangut in, so the answer is a glyph exactly as
// a reader meets it. The face is the version Google Fonts serves, downloaded once per run.
const FONT_URL = 'https://fonts.gstatic.com/s/notoseriftangut/v19/xn76YGc72GKoTvER4Gn3b4m9Ern7Em41.ttf'
/** @type {string | null} */
let face = null
/** @type {Map<string, string>} */
const glyphImages = new Map()

/**
 * @param {string} char
 * @returns {Promise<string>} the PNG path in the session directory, or '' when the glyph will not draw
 */
async function glyphImage(char) {
  const known = glyphImages.get(char)
  if (known !== undefined) return known
  try {
    face ??= await downloadFace()
    const path = `${out}/glyph-${char.codePointAt(0)?.toString(16)}.png`
    writeFileSync(path, renderGlyph(char, /** @type {string} */ (face)))
    glyphImages.set(char, path)
    return path
  } catch {
    glyphImages.set(char, '')
    return ''
  }
}

/** @returns {Promise<string>} the local font file */
async function downloadFace() {
  const response = await fetch(FONT_URL)
  if (!response.ok) throw new Error(`font: ${response.status}`)
  const path = `/tmp/tangut-quiz-${process.pid}.ttf`
  writeFileSync(path, new Uint8Array(await response.arrayBuffer()))
  return path
}

/**
 * Render one character at 256 px. Pillow comes from `uv`, which every run of the site's builders
 * already relies on.
 * @param {string} char @param {string} font
 */
function renderGlyph(char, font) {
  const script = `/tmp/tangut-quiz-${process.pid}.py`
  const png = `/tmp/tangut-quiz-glyph-${process.pid}.png`
  writeFileSync(script, `
import sys
from PIL import Image, ImageDraw, ImageFont
char, font, out = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.new('RGB', (256, 256), 'white')
ImageDraw.Draw(img).text((128, 128), char, font=ImageFont.truetype(font, 210), fill='black', anchor='mm')
img.save(out)
`)
  const result = Bun.spawnSync({ cmd: ['uv', 'run', '--quiet', '--with', 'pillow==13.0.0', script, char, font, png], stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return readFileSync(png)
}

const session = { started: new Date().toISOString(), size: rounds, seed, items: [] }

/** Send a saved drawing to the site's record. The drawing is already on disk, so a failure is only
 *  logged. @param {any} record */
async function uploadDrawing(record) {
  if (!upload) return
  try {
    const response = await fetch(upload, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'drawing', origin: 'quiz', session: out.split('/').pop(),
        answer: record.char, kind: record.kind,
        strokes: record.strokes, times: record.times, pressure: record.pressure,
        pointer: record.pointer, writer: record.writer, device: record.device,
        width: record.width, height: record.height,
      }),
    })
    if (!response.ok) console.warn(`saved here, but ${upload} answered ${response.status}`)
  } catch (error) {
    console.warn(`saved here, but not sent to ${upload}: ${error}`)
  }
}
mkdirSync(out, { recursive: true })

const prompts = new Map()
function promptId(item) {
  if (!item.id) {
    item.id = crypto.randomUUID()
    prompts.set(item.id, item)
    writeFileSync(`${out}/prompt-${item.id}.json`, JSON.stringify(item))
  }
  return item.id
}
let current = null
/** The prompt fetched ahead with `/api/peek`, shown by the next `/api/next`. */
let pending = null
let prompted = 0
const makeItem = async () => {
  if (session.items.length >= rounds) return null
  prompted++
  const previous = session.items.at(-1)
  if (previous && session.items.length % 2 === 1) {
    const options = lookalikes(previous.char, 5)
    if (options.length) {
      const answer = options[Math.floor(random() * options.length)]
      return { kind: 'lookalike', char: answer, options: [answer, ...options.filter(other => other !== answer)], images: await Promise.all(options.map(glyphImage)) }
    }
  }
  // One prompt in four is a component on its own, drawn where a reader meets it in the palette.
  if (componentChars.length && prompted % 4 === 2) {
    const char = componentChars[Math.floor(random() * componentChars.length)]
    return { kind: 'component', char, image: await glyphImage(char) }
  }
  const char = ideographs[Math.floor(random() * ideographs.length)][0]
  return { kind: 'glyph', char, image: await glyphImage(char) }
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/api/next') {
      // The prompt the page is to show: the one fetched ahead, or a new one.
      current = pending ?? await makeItem()
      pending = null
      if (!current) return Response.json({ done: true })
      // The answer never reaches the page: it gets the picture to copy and nothing that names it.
      const image = current.kind === 'lookalike' ? current.images[current.options.indexOf(current.char)] : current.image
      return Response.json({ prompt: promptId(current), kind: current.kind, index: session.items.length, total: rounds, image: image ?? null })
    }
    if (url.pathname === '/api/peek') {
      // The prompt after the current one, so the page can fetch it while the reader draws.
      const ahead = pending ?? (session.items.length + 1 >= rounds ? null : await makeItem())
      pending = ahead
      if (!ahead) return Response.json({ done: true })
      const image = ahead.kind === 'lookalike' ? ahead.images[ahead.options.indexOf(ahead.char)] : ahead.image
      // The answer stays on the server.
      return Response.json({
        prompt: promptId(ahead), index: session.items.length, total: rounds, kind: ahead.kind, image: image ?? null,
      })
    }
    if (url.pathname === '/api/claim' && request.method === 'POST') {
      // The page shows the prompt fetched ahead; the server makes that same prompt its current one,
      // so the drawing is saved against what was on screen.
      if (pending) current = pending
      pending = null
      return Response.json({ ok: true, has: Boolean(current) })
    }
    if (url.pathname === '/api/capture' && request.method === 'POST') {
      const body = await request.json()
      const stored = typeof body.prompt === 'string' && /^[0-9a-f-]{36}$/.test(body.prompt) ? `${out}/prompt-${body.prompt}.json` : null
      const prompt = prompts.get(body.prompt) ?? (stored && existsSync(stored) ? JSON.parse(readFileSync(stored, 'utf8')) : null)
      if (!prompt || !Array.isArray(body.strokes) || !body.strokes.length) return Response.json({ error: 'no drawing' }, { status: 400 })
      const record = { ...body, char: prompt.char, kind: prompt.kind, lookalikes: prompt.options ?? null, at: new Date().toISOString() }
      if (typeof body.captureId !== 'string' || !/^[0-9a-f-]{36}$/.test(body.captureId)) return Response.json({ error: 'bad id' }, { status: 400 })
      const name = `capture-${body.captureId}.json`
      if (!existsSync(`${out}/${name}`)) {
        writeFileSync(`${out}/${name}`, JSON.stringify(record))
        void uploadDrawing(record)
        try { buildDataset() } catch (error) { console.warn(`dataset: ${error}`) }
      }
      return Response.json({ saved: name })
    }
    if (url.pathname === '/api/save' && request.method === 'POST') {
      const body = await request.json()
      if (!current) return Response.json({ error: 'no prompt' }, { status: 409 })
      const record = {
        char: current.char, lookalikes: current.options ?? null, kind: current.kind,
        strokes: body.strokes, times: body.times ?? null, pressure: body.pressure ?? null,
        pointer: body.pointer ?? null, writer: body.writer ?? null, device: body.device ?? null,
        width: body.width, height: body.height, at: new Date().toISOString(),
      }
      session.items.push(record)
      const name = `${String(session.items.length).padStart(3, '0')}-${current.char.codePointAt(0)?.toString(16)}.json`
      writeFileSync(`${out}/${name}`, JSON.stringify(record))
      void uploadDrawing(record)
      writeFileSync(`${out}/session.json`, JSON.stringify(session, null, 2))
      // The dataset is rebuilt on every save, so a round is collectable while it is being drawn.
      let dataset = null
      try {
        dataset = buildDataset()
      } catch (error) {
        console.warn(`the drawing is saved, but the dataset was not rebuilt: ${error}`)
      }
      current = null
      return Response.json({ saved: name, dataset })
    }
    if (url.pathname === '/api/skip' && request.method === 'POST') {
      current = null
      pending = null
      return Response.json({ skipped: true })
    }
    if (url.pathname === '/api/session') return Response.json({ out, count: session.items.length, total: rounds })
    // The prompt images are the session's own files, made on first use.
    const asked = /^\/glyph-([0-9a-f]+)\.png$/i.exec(url.pathname)
    if (asked && !(await Bun.file(`${out}/glyph-${asked[1]}.png`).exists())) await glyphImage(String.fromCodePoint(parseInt(asked[1], 16)))
    const glyph = /^\/glyph-([0-9a-f]+)\.png$/i.exec(url.pathname)
    if (glyph) {
      const file = Bun.file(`${out}/glyph-${glyph[1]}.png`)
      if (await file.exists()) return new Response(file, { headers: { 'content-type': 'image/png' } })
    }
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Not found', { status: 404 })
    return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  },
})

// Writing every answer beside its prompt is the whole point, so the round says where it goes.
console.log(`Tangut handwriting quiz — ${rounds} drawings, ${server.url.href}`)
console.log(`Answers and strokes go to ${out}`)

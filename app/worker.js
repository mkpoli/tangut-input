// The site's worker: it takes what a reader drew and what they picked, and leaves the pages to the
// assets. Only `/api/*` reaches it (`run_worker_first`), so a page view costs the worker nothing.
//
//   POST /api/record   one event, or an array of them
//
// An event is either a pick, `{ type: 'pick', char, finder, query, place, locale, session }`, or a
// drawing, `{ type: 'drawing', strokes, picked?, place?, origin?, answer?, kind?, times?, … }`. The
// rows land in D1 (`migrations/0001_records.sql`); `bun run records` reads them back.

// A drawing of a few hundred points is a few kilobytes; anything past this is not a reader's pen.
const LIMIT = 60_000
const MAX_POINTS = 20_000
const TANGUT = /^[\u{17000}-\u{18AFF}\u{18D00}-\u{18D1F}]$/u

/** @param {unknown} value */
const text = value => (typeof value === 'string' && value.length <= 4000 ? value : null)
/** @param {unknown} value */
const number = value => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null)
/** @param {unknown} value */
const json = value => (value === undefined || value === null ? null : JSON.stringify(value))

/**
 * @param {unknown} value
 * @returns {string | null} a single Tangut character, or null
 */
function character(value) {
  if (typeof value !== 'string' || [...value].length !== 1 || !TANGUT.test(value)) return null
  return value
}

/** @param {any[]} points */
const points = points => Array.isArray(points) && points.length <= MAX_POINTS

/**
 * @param {any} event
 * @param {string} at
 * @returns {{ table: 'picks' | 'drawings', values: any[] } | null}
 */
function row(event, at) {
  if (!event || typeof event !== 'object') return null
  const session = text(event.session)
  if (event.type === 'pick') {
    const char = character(event.char)
    if (!char) return null
    return { table: 'picks', values: [at, session, char, text(event.finder), text(event.query), number(event.place), text(event.locale)] }
  }
  if (event.type === 'drawing') {
    const strokes = event.strokes
    if (!Array.isArray(strokes) || !strokes.length || strokes.length > 400) return null
    if (!strokes.every(points)) return null
    const picked = event.picked ? character(event.picked) : null
    return {
      table: 'drawings',
      values: [
        at, session, text(event.origin) ?? 'draw', character(event.answer), text(event.kind),
        picked, number(event.place), JSON.stringify(strokes), strokes.length,
        json(event.times), json(event.pressure), text(event.pointer), text(event.writer),
        text(event.device), number(event.width), number(event.height),
      ],
    }
  }
  return null
}

/**
 * @param {Request} request
 * @param {{ DB?: D1Database }} env
 */
async function record(request, env) {
  if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: { allow: 'POST' } })
  const body = await request.text()
  if (body.length > LIMIT) return new Response('too large', { status: 413 })
  const db = env.DB
  if (!db) return new Response('no database', { status: 503 })
  /** @type {unknown} */
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('bad json', { status: 400 })
  }
  const events = Array.isArray(payload) ? payload : [payload]
  if (events.length > 100) return new Response('too many', { status: 413 })
  const at = new Date().toISOString()
  /** @type {D1PreparedStatement[]} */
  const statements = []
  for (const event of events) {
    const entry = row(event, at)
    if (!entry) continue
    const marks = entry.values.map(() => '?').join(', ')
    statements.push(db.prepare(`INSERT INTO ${entry.table} VALUES (NULL, ${marks})`).bind(...entry.values))
  }
  if (!statements.length) return new Response('nothing to record', { status: 400 })
  await db.batch(statements)
  return Response.json({ stored: statements.length })
}

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: Fetcher, DB?: D1Database }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/record') return record(request, env)
    return env.ASSETS.fetch(request)
  },
}

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
// A browser's outbox sends a handful of events at a time; 20 fits well inside the free plan's
// 50 statements an invocation, so a batch never half-fails.
const EVENTS = 20
const MAX_STROKES = 400
const MAX_POINTS = 20_000
const DAY = 86_400_000
const TANGUT = /^[\u{17000}-\u{18AFF}\u{18D00}-\u{18D1F}]$/u

// The columns each table takes, in the order `row` builds its values.
const COLUMNS = {
  picks: ['at', 'session', 'char', 'finder', 'query', 'place', 'locale'],
  drawings: ['at', 'session', 'origin', 'answer', 'kind', 'picked', 'place', 'strokes', 'stroke_count', 'times', 'pressure', 'pointer', 'writer', 'device', 'width', 'height'],
}

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
 * When the reader made the event, when it is plausible: an outbox that sat offline for a week still
 * carries the day it was drawn. @param {unknown} value @returns {string | null}
 */
function time(value) {
  if (typeof value !== 'string') return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms) || ms > Date.now() + DAY || ms < Date.now() - 30 * DAY) return null
  return new Date(ms).toISOString()
}

/**
 * @param {any} event
 * @param {string} at the time to fall back on when the event carries none
 * @returns {{ table: 'picks' | 'drawings', values: any[] } | null}
 */
function row(event, at) {
  if (!event || typeof event !== 'object') return null
  at = time(event.at) ?? at
  const session = text(event.session)
  if (event.type === 'pick') {
    const char = character(event.char)
    if (!char) return null
    return { table: 'picks', values: [at, session, char, text(event.finder), text(event.query), number(event.place), text(event.locale)] }
  }
  if (event.type === 'drawing') {
    const strokes = event.strokes
    if (!Array.isArray(strokes) || !strokes.length || strokes.length > MAX_STROKES) return null
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
 * The body, read up to the limit rather than after: a body that never ends is cut off instead of
 * waited out. @param {Request} request @returns {Promise<string | null>} null when it is too large
 */
async function readBody(request) {
  if (Number(request.headers.get('content-length') ?? 0) > LIMIT) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let body = ''
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > LIMIT) {
      await reader.cancel()
      return null
    }
    body += decoder.decode(value, { stream: true })
  }
  return body + decoder.decode()
}

/**
 * @param {Request} request
 * @param {{ DB?: D1Database, RECORD?: RateLimit }} env
 */
async function record(request, env) {
  if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: { allow: 'POST' } })
  // The ceiling comes before the body: a flood costs a limiter check, not a read.
  if (env.RECORD) {
    const { success } = await env.RECORD.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' })
    if (!success) return new Response('slow down', { status: 429, headers: { 'retry-after': '60' } })
  }
  const db = env.DB
  if (!db) return new Response('no database', { status: 503 })
  const body = await readBody(request)
  if (body === null) return new Response('too large', { status: 413 })
  /** @type {unknown} */
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('bad json', { status: 400 })
  }
  const events = Array.isArray(payload) ? payload : [payload]
  if (events.length > EVENTS) return new Response('too many', { status: 413 })
  const at = new Date().toISOString()
  /** @type {D1PreparedStatement[]} */
  const statements = []
  for (const event of events) {
    const entry = row(event, at)
    if (!entry) continue
    const columns = COLUMNS[entry.table]
    const marks = columns.map(() => '?').join(', ')
    statements.push(db.prepare(`INSERT INTO ${entry.table} (${columns.join(', ')}) VALUES (${marks})`).bind(...entry.values))
  }
  if (!statements.length) return new Response('nothing to record', { status: 400 })
  await db.batch(statements)
  return Response.json({ stored: statements.length })
}

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: Fetcher, DB?: D1Database, RECORD?: RateLimit }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/record') return record(request, env)
    return env.ASSETS.fetch(request)
  },
}

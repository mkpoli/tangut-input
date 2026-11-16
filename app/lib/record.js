// What a reader drew and what they picked, sent to the worker so it can be read back later. The
// events are the quiz's own fields: a drawing with its strokes and, when one came of it, the
// character the reader chose; a pick with the finder it came from.
//
// Everything is best effort. A site served without the worker answers nothing at `/api/record`, and
// a reader's page must behave the same whether the record is kept or not, so a failed send is
// dropped rather than shown, and a refused endpoint is not tried again until the page reloads.

const ENDPOINT = '/api/record'
const SESSION = 'tangut-input:session'
const OUTBOX = 'tangut-input:outbox'
const KEEP = 200
// What the worker takes in one request: as many events and as many bytes. A batch that fits is
// accepted whole, so the queue can never wedge on a body the endpoint always refuses.
const EVENTS = 20
const BYTES = 48_000

/** Once the endpoint has answered that it is not there, stop asking. */
let refused = false
let sending = false

/** The id that ties a browser's events together. @returns {string | null} */
function session() {
  try {
    let id = localStorage.getItem(SESSION)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION, id)
    }
    return id
  } catch {
    return null
  }
}

/** Remove query text from new picks and picks queued by older versions. @param {any} event */
function withoutPickQuery(event) {
  if (!event || event.type !== 'pick') return event
  const { query, ...pick } = event
  return pick
}

/** @returns {any[]} */
function outbox() {
  try {
    const stored = JSON.parse(localStorage.getItem(OUTBOX) ?? '[]')
    return Array.isArray(stored) ? stored.map(withoutPickQuery) : []
  } catch {
    return []
  }
}

/** @param {any[]} events */
function keep(events) {
  try {
    if (events.length) localStorage.setItem(OUTBOX, JSON.stringify(events.slice(-KEEP)))
    else localStorage.removeItem(OUTBOX)
  } catch {
    // A full or blocked store costs the queue, not the page.
  }
}

/**
 * The first events that fit in one request, in the order they were queued.
 * @param {any[]} events
 */
function batchOf(events) {
  const batch = []
  let bytes = 2
  for (const event of events) {
    if (batch.length >= EVENTS) break
    const size = JSON.stringify(event).length + 1
    if (bytes + size > BYTES) break
    batch.push(event)
    bytes += size
  }
  return batch
}

async function send() {
  if (sending || refused) return
  sending = true
  try {
    while (!refused) {
      const queued = outbox()
      const batch = batchOf(queued)
      if (!batch.length) break
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch),
        referrerPolicy: 'no-referrer',
        keepalive: true,
      })
      if (response.ok) {
        // Only what was sent goes: events recorded while this request was in flight stay queued.
        keep(outbox().slice(batch.length))
        continue
      }
      if (response.status === 429) break
      if (response.status >= 400 && response.status < 500) {
        // The endpoint will never take these; dropping them keeps the queue moving.
        keep(outbox().slice(batch.length))
        continue
      }
      if ([501, 503].includes(response.status)) refused = true
      break
    }
  } catch {
    // Offline, or the endpoint is not there; the queue waits for the next event.
  } finally {
    sending = false
  }
}

/**
 * Record one event. Never throws and never waits.
 * @param {{ type: 'pick' | 'drawing', [key: string]: any }} event
 */
export function record(event) {
  const events = outbox()
  events.push(withoutPickQuery({ ...event, session: session(), at: new Date().toISOString() }))
  keep(events)
  void send()
}

/** Try the queue again, after a page load or when the connection returns. */
export function flush() {
  void send()
}

if (typeof addEventListener === 'function') {
  addEventListener('online', flush)
  // A queue left from an earlier visit goes out when the site next loads.
  if (typeof requestIdleCallback === 'function') requestIdleCallback(flush)
  else setTimeout(flush, 2000)
}

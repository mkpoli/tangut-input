// What a reader drew and what they picked, sent to the worker so it can be read back later. The
// events are the quiz's own fields: a drawing with its strokes and, when one came of it, the
// character the reader chose; a pick with the finder it came from and what had been typed.
//
// Everything is best effort. A site served without the worker answers nothing at `/api/record`, and
// a reader's page must behave the same whether the record is kept or not, so a failed send is
// dropped rather than shown, and a refused endpoint is not tried again until the page reloads.

const ENDPOINT = '/api/record'
const SESSION = 'tangut-input:session'
const OUTBOX = 'tangut-input:outbox'
const KEEP = 200

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

/** @returns {any[]} */
function outbox() {
  try {
    const stored = JSON.parse(localStorage.getItem(OUTBOX) ?? '[]')
    return Array.isArray(stored) ? stored : []
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

async function send() {
  if (sending || refused) return
  const events = outbox()
  if (!events.length) return
  sending = true
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(events),
      keepalive: true,
    })
    if (response.ok) keep([])
    else if ([404, 405, 501, 503].includes(response.status)) refused = true
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
  events.push({ ...event, session: session(), at: new Date().toISOString() })
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

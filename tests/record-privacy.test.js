import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { flush, record } from '../app/lib/record.js'
import worker from '../app/worker.js'

const OUTBOX = 'tangut-input:outbox'
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const originalFetch = globalThis.fetch
let storage, requests, optionsSeen

beforeEach(() => {
  storage = new Map()
  requests = []
  optionsSeen = []
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } })
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body))
    optionsSeen.push(options)
    return new Response('', { status: 429 })
  }
})

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete globalThis.localStorage
  globalThis.fetch = originalFetch
})

// Let the send loop process its mocked response before another test starts.
const settled = () => new Promise(resolve => setTimeout(resolve, 0))

describe('pick privacy in the outbox', () => {
  test('new picks omit query from storage and requests', async () => {
    record({ type: 'pick', char: '𗀀', finder: 'find', query: 'private text', place: 2, locale: 'en' })
    await settled()
    const queued = JSON.parse(storage.get(OUTBOX))
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ type: 'pick', char: '𗀀', finder: 'find', place: 2, locale: 'en' })
    expect(queued[0]).not.toHaveProperty('query')
    expect(requests[0]).toEqual(queued)
    expect(optionsSeen[0].referrerPolicy).toBe('no-referrer')
  })

  test('successful sends preserve events queued during the request', async () => {
    let resolveFirst
    globalThis.fetch = (_url, options) => {
      requests.push(JSON.parse(options.body))
      if (requests.length === 1) return new Promise(resolve => { resolveFirst = resolve })
      return Promise.resolve(new Response('', { status: 429 }))
    }
    storage.set(OUTBOX, JSON.stringify([{ type: 'pick', char: '𗀀', query: 'old secret' }]))
    flush()
    record({ type: 'pick', char: '𗀁', query: 'new secret' })
    resolveFirst(new Response('', { status: 200 }))
    await settled()
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual([{ type: 'pick', char: '𗀀' }])
    expect(requests[1][0]).toMatchObject({ type: 'pick', char: '𗀁' })
    expect(requests[1][0]).not.toHaveProperty('query')
    expect(JSON.parse(storage.get(OUTBOX))).toEqual(requests[1])
  })

  test('legacy queued picks are scrubbed before batching without changing drawings', async () => {
    const drawing = { type: 'drawing', strokes: [[[0, 0]]], query: 'drawing metadata' }
    storage.set(OUTBOX, JSON.stringify([
      { type: 'pick', char: '𗀀', finder: 'fanqie', query: 'private text', place: 0 },
      drawing,
      { type: 'pick', char: '𗀁', query: 'x'.repeat(50000) },
    ]))
    flush()
    await settled()
    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual([
      { type: 'pick', char: '𗀀', finder: 'fanqie', place: 0 },
      drawing,
      { type: 'pick', char: '𗀁' },
    ])
    expect(JSON.parse(storage.get(OUTBOX))[0].query).toBe('private text')
    expect(optionsSeen[0].referrerPolicy).toBe('no-referrer')
  })

  test('scrubs outgoing events when offline without rewriting the queue', async () => {
    const queued = [{ type: 'pick', char: '𗀀', query: 'private text' }]
    storage.set(OUTBOX, JSON.stringify(queued))
    globalThis.fetch = async (_url, options) => {
      requests.push(JSON.parse(options.body))
      throw new Error('offline')
    }
    flush()
    await settled()
    expect(requests[0]).toEqual([{ type: 'pick', char: '𗀀' }])
    expect(JSON.parse(storage.get(OUTBOX))).toEqual(queued)
  })

  test('scrubs outgoing events even when storage cannot be rewritten', async () => {
    storage.set(OUTBOX, JSON.stringify([{ type: 'pick', char: '𗀀', query: 'private text' }]))
    localStorage.setItem = () => { throw new Error('storage blocked') }
    flush()
    await settled()
    expect(requests[0]).toEqual([{ type: 'pick', char: '𗀀' }])
  })
})

test('worker ignores legacy pick queries while preserving historical rows', async () => {
  const db = new Database(':memory:')
  try {
    db.exec(readFileSync(new URL('../migrations/0001_records.sql', import.meta.url), 'utf8'))
    db.exec(readFileSync(new URL('../migrations/0002_leaner_rows.sql', import.meta.url), 'utf8'))
    db.query('INSERT INTO picks (at, char, query) VALUES (?, ?, ?)').run('2020-01-01', '𗀀', 'historical query')
    const DB = {
      prepare(sql) { return { bind(...values) { return { sql, values } } } },
      async batch(statements) { for (const { sql, values } of statements) db.query(sql).run(...values) },
    }
    const response = await worker.fetch(new Request('https://example.test/api/record', {
      method: 'POST', body: JSON.stringify([
        { type: 'pick', char: '𗀁', finder: 'fanqie', query: 'legacy secret', place: 3, locale: 'en', session: 'session' },
        { type: 'pick', char: '𗀂', finder: 'find', locale: 'zh' },
      ]),
    }), { DB })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ stored: 2 })
    expect(db.query('SELECT char, finder, query, place, locale, session FROM picks ORDER BY id').all()).toEqual([
      { char: '𗀀', finder: null, query: 'historical query', place: null, locale: null, session: null },
      { char: '𗀁', finder: 'fanqie', query: null, place: 3, locale: 'en', session: 'session' },
      { char: '𗀂', finder: 'find', query: null, place: null, locale: 'zh', session: null },
    ])
  } finally {
    db.close()
  }
})

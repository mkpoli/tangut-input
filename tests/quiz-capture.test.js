import { test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('quiz Clear durably queues its prompt label and retries failed capture sends', async () => {
  const source = readFileSync(new URL('../scripts/handwriting/page.html', import.meta.url), 'utf8').split('<script type="module">')[1].split('</script>')[0]
  const storage = new Map(), events = {}, requests = []
  const element = () => ({
    style: {}, classList: { remove() {} }, addEventListener() {}, replaceChildren() {},
    getContext: () => ({ setTransform() {}, clearRect() {} }), clientWidth: 240, clientHeight: 240,
  })
  const elements = new Map()
  let ok = false
  const sandbox = {
    console, crypto, navigator: {}, Image: class {}, getComputedStyle: () => ({ color: '#000' }),
    addEventListener: (name, callback) => { events[name] = callback },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    document: {
      hidden: false, addEventListener() {},
      getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id) },
    },
    fetch: async (url, options) => {
      if (url === '/api/next') return new Promise(() => {})
      const body = JSON.parse(options.body)
      requests.push(body)
      return body.prompt === 'expired' ? { ok: false, status: 400 } : { ok }
    },
  }
  runInNewContext(source + `\n globalThis.fixture = {
    prepare() { item = { prompt: 'prompt-one' }; strokes = [[[24, 48]]]; times = [[12]]; pressure = [[0.5]]; paint = () => {}; },
    capture, flushCaptures,
  };`, sandbox)
  sandbox.fixture.prepare()
  elements.get('clear').onclick()
  await new Promise(resolve => setTimeout(resolve, 0))
  const queued = JSON.parse(storage.get('tangut-quiz:captures'))
  expect(queued).toHaveLength(1)
  expect(queued[0].prompt).toBe('prompt-one')
  expect(queued[0].strokes).toEqual([[[0.1, 0.2]]])
  expect(queued[0].times).toEqual([[12]])
  ok = true
  await sandbox.fixture.flushCaptures()
  expect(JSON.parse(storage.get('tangut-quiz:captures'))).toEqual([])
  expect(requests[0].captureId).toBe(requests[1].captureId)
  storage.set('tangut-quiz:captures:unresolved', JSON.stringify([{ captureId: 'older' }]))
  storage.set('tangut-quiz:captures', JSON.stringify([
    { ...queued[0], captureId: 'stale', prompt: 'expired' },
    { ...queued[0], captureId: 'valid' },
  ]))
  await sandbox.fixture.flushCaptures()
  expect(JSON.parse(storage.get('tangut-quiz:captures'))).toEqual([])
  expect(JSON.parse(storage.get('tangut-quiz:captures:unresolved')).map(entry => entry.captureId)).toEqual(['older', 'stale'])
  expect(requests.at(-1).captureId).toBe('valid')
})

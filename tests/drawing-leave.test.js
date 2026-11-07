import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { parse } from 'svelte/compiler'
import { createDrawingCapture } from '../src/core/drawing-capture.js'

const surfaces = [
  ['shared handwriting', '../app/ui/Handwriting.svelte', false],
  ['embedded finder', '../app/ui/MiniFinder.svelte', false],
  ['workshop sketch', '../src/svelte/IdsSketch.svelte', true],
]

// Execute the component's actual lifecycle bindings and stroke-finalization functions.
function fixture(path, sketch) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const ast = parse(source, { modern: true })
  const functions = ast.instance.content.body
    .filter(node => node.type === 'FunctionDeclaration' && ['snapshot', 'up', 'leave'].includes(node.id.name))
    .map(node => source.slice(node.start, node.end)).join('\n')
  const bindings = Object.fromEntries(['SvelteWindow', 'SvelteDocument'].flatMap(type => {
    const node = ast.fragment.nodes.find(node => node.type === type)
    return node.attributes.filter(attribute => ['onbeforeunload', 'onpagehide', 'onvisibilitychange'].includes(attribute.name))
      .map(attribute => [attribute.name.slice(2), source.slice(attribute.value.expression.start, attribute.value.expression.end)])
  }))
  const records = [], capture = createDrawingCapture(event => records.push(event))
  const sandbox = {
    capture, document: { hidden: false },
    canvas: { getBoundingClientRect: () => ({ width: 240, height: 240 }) },
    CANVAS: 240, PAD: 240, strokes: [], current: null, drawing: null,
    rasterize() {}, paint() {}, update() {}, schedule() {},
  }
  runInNewContext(`${functions}\nglobalThis.handlers = {${Object.entries(bindings).map(([name, expression]) => `${name}: ${expression}`).join(',')}};`, sandbox)
  return {
    records, capture, sandbox,
    start() {
      if (sketch) {
        sandbox.strokes = [[{ x: 24, y: 48 }, { x: 120, y: 144 }]]
        sandbox.drawing = 7
      } else sandbox.current = [[24, 48], [120, 144]]
    },
    inactive() { return sketch ? sandbox.drawing === null : sandbox.current === null },
  }
}

for (const [name, path, sketch] of surfaces) describe(name, () => {
  for (const trigger of ['beforeunload', 'pagehide', 'visibilitychange']) {
    test(`${trigger} finalizes active ink once without blocking departure`, () => {
      const f = fixture(path, sketch)
      try {
        f.start()
        const event = { preventDefault() { throw new Error('departure must stay unblocked') }, returnValue: undefined }
        f.sandbox.document.hidden = trigger === 'visibilitychange'
        f.sandbox.handlers[trigger](event)
        expect(f.inactive()).toBe(true)
        expect(f.records).toHaveLength(1)
        expect(f.records[0].strokes).toEqual([[[0.1, 0.2], [0.5, 0.6]]])
        expect(event.returnValue).toBeUndefined()
        f.sandbox.document.hidden = true
        f.sandbox.handlers.beforeunload(event)
        f.sandbox.handlers.visibilitychange(event)
        f.sandbox.handlers.pagehide(event)
        expect(f.records).toHaveLength(1)
      } finally { f.capture.clear() }
    })
  }
  test('becoming visible leaves the active stroke untouched', () => {
    const f = fixture(path, sketch)
    try {
      f.start()
      f.sandbox.handlers.visibilitychange({})
      expect(f.inactive()).toBe(false)
      expect(f.records).toHaveLength(0)
    } finally { f.capture.clear() }
  })
})

function quizFixture() {
  const source = readFileSync(new URL('../scripts/handwriting/page.html', import.meta.url), 'utf8').split('<script type="module">')[1].split('</script>')[0]
  const storage = new Map(), events = {}, documentEvents = {}, elements = new Map(), pointerEvents = {}
  const element = () => ({
    style: {}, classList: { remove() {} }, replaceChildren() {},
    addEventListener(name, handler) { pointerEvents[name] = handler },
    getContext: () => ({ setTransform() {}, clearRect() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {},
    clientWidth: 240, clientHeight: 240,
  })
  const sandbox = {
    console, crypto, navigator: {}, Image: class {}, getComputedStyle: () => ({ color: '#000' }),
    addEventListener(name, handler) { events[name] = handler },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    document: {
      hidden: false,
      addEventListener(name, handler) { documentEvents[name] = handler },
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id) },
    },
    fetch: () => new Promise(() => {}),
  }
  runInNewContext(source + `\n globalThis.fixture = {
    prepare() { item = { prompt: 'active-prompt' }; paint = () => {}; },
    inactive() { return current === null && first === null; },
  };`, sandbox)
  sandbox.fixture.prepare()
  return { sandbox, storage, events, documentEvents, pointerEvents }
}

describe('quiz lifecycle capture', () => {
  for (const trigger of ['beforeunload', 'pagehide', 'visibilitychange']) {
    test(`${trigger} finalizes active ink in the durable queue without duplicates`, () => {
      const f = quizFixture()
      const pointer = { pointerId: 7, pointerType: 'pen', clientX: 24, clientY: 48, timeStamp: 10, pressure: 0.5 }
      f.pointerEvents.pointerdown(pointer)
      f.pointerEvents.pointermove({ ...pointer, clientX: 120, clientY: 144, timeStamp: 20 })
      const event = { preventDefault() { throw new Error('departure must stay unblocked') }, returnValue: undefined }
      f.sandbox.document.hidden = trigger === 'visibilitychange'
      ;(trigger === 'visibilitychange' ? f.documentEvents : f.events)[trigger](event)
      expect(f.sandbox.fixture.inactive()).toBe(true)
      const queue = () => JSON.parse(f.storage.get('tangut-quiz:captures'))
      expect(queue()).toHaveLength(1)
      expect(queue()[0].prompt).toBe('active-prompt')
      expect(queue()[0].strokes).toEqual([[[0.1, 0.2], [0.5, 0.6]]])
      expect(queue()[0].times).toEqual([[10, 20]])
      expect(queue()[0].pressure).toEqual([[0.5, 0.5]])
      expect(event.returnValue).toBeUndefined()
      f.pointerEvents.pointermove({ ...pointer, clientX: 200 })
      f.sandbox.document.hidden = true
      f.events.beforeunload(event)
      f.documentEvents.visibilitychange(event)
      f.events.pagehide(event)
      expect(queue()).toHaveLength(1)
      expect(queue()[0].strokes).toEqual([[[0.1, 0.2], [0.5, 0.6]]])
    })
  }
  test('becoming visible does not finalize the active quiz stroke', () => {
    const f = quizFixture()
    f.pointerEvents.pointerdown({ pointerId: 7, clientX: 24, clientY: 48, timeStamp: 10 })
    f.documentEvents.visibilitychange({})
    expect(f.sandbox.fixture.inactive()).toBe(false)
    expect(f.storage.has('tangut-quiz:captures')).toBe(false)
  })
})

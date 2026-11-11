import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { parse } from 'svelte/compiler'
import { isImeKey } from '../app/lib/keyboard.js'

const surfaces = [
  ['Find', '../app/pages/Find.svelte', 'keys', ['Enter', 'ArrowDown']],
  ['Meaning', '../app/pages/Meaning.svelte', 'keys', ['Enter', 'ArrowDown', 'Escape']],
  ['Reading', '../app/pages/Reading.svelte', 'keys', ['Enter', 'ArrowDown', 'Escape']],
  ['Cangjie', '../app/pages/Cangjie.svelte', 'keys', ['Enter', ' ', '1', 'ArrowDown', 'Backspace', 'Escape']],
  ['Sijiao', '../app/pages/Sijiao.svelte', 'keys', ['Enter', ' ', '1', 'ArrowDown', 'Backspace', 'Escape']],
  ['MiniIme', '../app/ui/MiniIme.svelte', 'keys', ['Enter', ' ', '1', 'ArrowDown', 'Escape']],
  ['MiniFinder', '../app/ui/MiniFinder.svelte', 'searchKey', ['Enter']],
]

// Run each component's real key handler with candidate and action stubs.
function fixture(path, name) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const ast = parse(source, { modern: true })
  const node = ast.instance.content.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
  const calls = []
  const action = (...args) => calls.push(args)
  const hit = { char: '𗀀' }
  const sandbox = {
    isImeKey, flat: [hit, hit], shown: [hit, hit], hits: [hit, hit], active: -1, code: 'a', query: 'water',
    page: 0, pages: 2, PAGE: 9, digitsPick: true, list: null, id: 'test',
    tick: () => Promise.resolve(),
    document: { querySelector: () => null, getElementById: () => null },
    preview: action, put: action, pick: action, close: action, setQuery: action, setCode: action, backspace: action, commit: action, turn: action,
  }
  runInNewContext(`${source.slice(node.start, node.end)}\nglobalThis.handler = ${name}`, sandbox)
  return { sandbox, calls }
}

function keyEvent(key, options = {}) {
  return { key, isComposing: false, keyCode: 0, ctrlKey: false, metaKey: false, altKey: false,
    defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...options }
}

for (const [label, path, name, keys] of surfaces) describe(label, () => {
  for (const key of keys) for (const composing of key === 'Enter' ? [{ isComposing: true }, { keyCode: 229 }] : [{ isComposing: true }]) {
    test(`${JSON.stringify(key)} leaves IME key ${JSON.stringify(composing)} untouched`, () => {
      const { sandbox, calls } = fixture(path, name)
      const event = keyEvent(key, composing)
      sandbox.handler(event)
      expect(event.defaultPrevented).toBe(false)
      expect(calls).toHaveLength(0)
      expect(sandbox.active).toBe(-1)
      expect(sandbox.query).toBe('water')
    })
  }
  for (const key of keys.filter(key => key !== 'Enter')) test(`${JSON.stringify(key)} with keyCode 229 keeps its normal shortcut`, () => {
    const normal = fixture(path, name)
    const mobile = fixture(path, name)
    const normalEvent = keyEvent(key)
    const mobileEvent = keyEvent(key, { keyCode: 229 })
    normal.sandbox.handler(normalEvent)
    mobile.sandbox.handler(mobileEvent)
    expect(mobileEvent.defaultPrevented).toBe(normalEvent.defaultPrevented)
    expect(mobile.calls).toEqual(normal.calls)
    expect(mobile.sandbox.active).toBe(normal.sandbox.active)
    expect(mobile.sandbox.query).toBe(normal.sandbox.query)
  })
  test('ordinary Enter still invokes the shortcut', () => {
    const { sandbox, calls } = fixture(path, name)
    const event = keyEvent('Enter')
    sandbox.handler(event)
    expect(event.defaultPrevented).toBe(true)
    expect(calls.length).toBeGreaterThan(0)
  })
})

describe('embedded code input composition', () => {
  for (const [mode, starting, composed, expected, caret] of [
    ['cangjie', 'a', 'A中b', 'ab', 1],
    ['sijiao', '1', '1中2', '12', 1],
  ]) test(`${mode} preserves composition until it ends`, () => {
    const { sandbox } = fixture('../app/ui/MiniFinder.svelte', 'typedCode')
    class InputEvent { constructor(isComposing, currentTarget) { this.isComposing = isComposing; this.currentTarget = currentTarget } }
    Object.assign(sandbox, { InputEvent, mode, queries: { [mode]: starting } })
    const field = { value: composed, selectionStart: 2, setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end } }
    sandbox.handler(new InputEvent(true, field))
    expect(field.value).toBe(composed)
    expect(sandbox.queries[mode]).toBe(starting)
    sandbox.handler({ currentTarget: field })
    expect(field.value).toBe(expected)
    expect(sandbox.queries[mode]).toBe(expected)
    expect(field.selectionStart).toBe(caret)
    expect(field.selectionEnd).toBe(caret)
  })
})

describe('bubbling shortcuts', () => {
  test('the app leaves a composing Escape to the input, and still closes normally', () => {
    const { sandbox, calls } = fixture('../app/App.svelte', 'keys')
    Object.assign(sandbox, { menu: true, ui: { sheet: false }, settingsOpen: false, closeMenu: () => calls.push('close') })
    for (const flags of [{ isComposing: true }]) {
      const event = keyEvent('Escape', { target: { closest: () => true }, ...flags })
      sandbox.handler(event)
      expect(event.defaultPrevented).toBe(false)
      expect(calls).toHaveLength(0)
    }
    sandbox.handler(keyEvent('Escape', { target: { closest: () => true } }))
    expect(calls).toEqual(['close'])
  })

  test('the embedded finder leaves composing slash events alone', () => {
    const { sandbox } = fixture('../app/ui/MiniFinder.svelte', 'panelKeys')
    for (const flags of [{ isComposing: true }]) {
      const event = keyEvent('/', flags)
      sandbox.handler(event)
      expect(event.defaultPrevented).toBe(false)
    }
  })

  for (const [label, path, pattern, setup] of [
    ['finder', '../app/ui/MiniFinder.svelte', /const key = \([^\n]+\) => \{[\s\S]*?\n    \}/, 'close'],
    ['spelling card', '../app/ui/Spelling.svelte', /const escape = event => \{[\s\S]*?\n    \}/, 'close'],
    ['eras preview', '../app/pages/Eras.svelte', /const onKey = \([^\n]+\) => \{[^\n]+\}/, 'closePreview'],
  ]) test(`${label} leaves composing Escape to the input`, () => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    const declaration = source.match(pattern)?.[0]
    expect(declaration).toBeDefined()
    const calls = []
    const sandbox = { isImeKey, preview: true, tip: null, document: {}, [setup]: () => calls.push('close') }
    const name = declaration.match(/const (\w+)/)[1]
    runInNewContext(`${declaration}\nglobalThis.handler = ${name}`, sandbox)
    for (const flags of [{ isComposing: true }]) {
      const event = keyEvent('Escape', { stopPropagation() { throw new Error('IME event stopped') }, ...flags })
      sandbox.handler(event)
      expect(event.defaultPrevented).toBe(false)
      expect(calls).toHaveLength(0)
    }
    sandbox.handler(keyEvent('Escape', { stopPropagation() {} }))
    expect(calls).toEqual(['close'])
  })
})

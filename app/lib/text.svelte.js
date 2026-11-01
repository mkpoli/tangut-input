// The text being written: one per browser, kept in local storage. Every finder inserts into it at
// the caret, so a character can be found by any method and land in the same place.
import { hex, ix, isTangut } from './db.svelte.js'

const KEY = 'tangut-input:text'

export const text = $state({
  value: (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || '',
  /** The caret, remembered while focus is elsewhere. */
  start: -1,
  end: -1,
})

/** @type {HTMLTextAreaElement | null} */
let field = null

/** The writing field registers itself so insertions follow its caret. @param {HTMLTextAreaElement | null} element */
export function attach(element) {
  field = element
}

function save() {
  try { localStorage.setItem(KEY, text.value) } catch { /* storage may be full or blocked */ }
}

/** @param {string} value */
export function setText(value) {
  text.value = value
  save()
}

/** Remember the caret of the writing field. */
export function remember() {
  if (!field) return
  text.start = field.selectionStart
  text.end = field.selectionEnd
}

/** Insert at the caret (the end, when the caret was never placed). @param {string} chars */
export function insert(chars) {
  const length = text.value.length
  const start = text.start < 0 || text.start > length ? length : text.start
  const end = text.end < 0 || text.end > length ? length : Math.max(start, text.end)
  text.value = text.value.slice(0, start) + chars + text.value.slice(end)
  text.start = text.end = start + chars.length
  save()
  if (field) {
    const at = text.start
    queueMicrotask(() => field?.setSelectionRange(at, at))
  }
}

/** Delete the character before the caret, as Backspace in an empty code box does. */
export function backspace() {
  const chars = [...text.value.slice(0, text.start < 0 ? text.value.length : text.start)]
  if (!chars.length) return
  const removed = chars.pop() ?? ''
  const start = text.start < 0 ? text.value.length : text.start
  text.value = text.value.slice(0, start - removed.length) + text.value.slice(Math.max(start, text.end))
  text.start = text.end = start - removed.length
  save()
}

/** The text as code points. @param {string} value */
export const asCodePoints = value => [...value].filter(isTangut).map(char => `U+${hex(char)}`).join(' ')

/** The text as Cangjie codes, a character without a code shown as its code point. @param {string} value */
export const asCodes = value => [...value].filter(isTangut).map(char => ix.codes.get(char)?.at(-1) ?? `U+${hex(char)}`).join(' ')

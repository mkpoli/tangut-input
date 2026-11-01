// The few view states that are not worth an address: the phone's card sheet and the theme.
import { open } from './route.svelte.js'
import { insert } from './text.svelte.js'
import { say } from './clip.svelte.js'

const THEME = 'tangut-input:theme'
const TANGUT = 'tangut-input:font'

/** The Tangut faces the reader can set the script in. Each is a family the stylesheet defines. */
export const TANGUT_FACES = /** @type {const} */ ([
  { key: 'serif', label: 'Noto Serif', family: '"Noto Serif Tangut"' },
  { key: 'yinchuan', label: 'Yinchuan', family: '"Tangut Yinchuan"' },
  { key: 'wenhai', label: 'Wenhai', family: '"BabelStone Wenhai"' },
  { key: 'kai', label: 'New Standard (kai)', family: '"New Tangut Std"' },
])

export const ui = $state({
  /** On a narrow screen the card is a sheet over the finder, opened by a tap. */
  sheet: false,
  /** @type {'auto' | 'light' | 'dark'} */
  theme: /** @type {'auto' | 'light' | 'dark'} */ ((typeof localStorage !== 'undefined' && localStorage.getItem(THEME)) || 'auto'),
  /** The face Tangut is set in. @type {'serif' | 'yinchuan' | 'wenhai' | 'kai'} */
  tangut: /** @type {'serif' | 'yinchuan' | 'wenhai' | 'kai'} */ ((typeof localStorage !== 'undefined' && localStorage.getItem(TANGUT)) || 'serif'),
})

/** Show a character in the card without taking the reader anywhere (arrow keys, highlighting). @param {string} char */
export const preview = char => open(char)

/** Open a character: the card on a wide screen, the sheet on a narrow one. @param {string} char */
export function choose(char) {
  open(char)
  if (matchMedia('(max-width: 900px)').matches) ui.sheet = true
}

/** Put a character into the text being written. @param {string} char */
export function put(char) {
  insert(char)
  say(`Added ${char} to the text`)
}

export function cycleTheme() {
  ui.theme = ui.theme === 'auto' ? 'light' : ui.theme === 'light' ? 'dark' : 'auto'
  applyTheme()
  try { localStorage.setItem(THEME, ui.theme) } catch { /* ignore */ }
}

/** @param {'serif' | 'yinchuan' | 'wenhai' | 'kai'} key */
export function setTangut(key) {
  ui.tangut = key
  document.documentElement.dataset.tangut = key
  try { localStorage.setItem(TANGUT, key) } catch { /* ignore */ }
  // The face is fetched the first time it is chosen; wait for it so the switch does not flash.
  const face = TANGUT_FACES.find(entry => entry.key === key)
  if (face) document.fonts?.load(`32px ${face.family}`, '𗀀').catch(() => { /* the fallback face stands in */ })
}

export function applyTangut() {
  document.documentElement.dataset.tangut = ui.tangut
}

export function applyTheme() {
  if (ui.theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = ui.theme
}

/** Focus a page's input when it appears, except on touch screens where that would raise the keyboard. @param {HTMLElement} node */
export function autofocus(node) {
  if (!matchMedia('(pointer: coarse)').matches) queueMicrotask(() => node.focus())
}

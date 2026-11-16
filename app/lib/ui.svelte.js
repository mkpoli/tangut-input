// The few view states that are not worth an address: the phone's card sheet and the theme.
import { untrack } from 'svelte'
import { open, route } from './route.svelte.js'
import { insert } from './text.svelte.js'
import { say } from './clip.svelte.js'
import { i18n, t } from './i18n.svelte.js'
import { record } from './record.js'
import { readingFromStore } from './reading.js'

const THEME = 'tangut-input:theme'
const TANGUT = 'tangut-input:font'
const READING = 'tangut-input:reading'
const PALETTE = 'tangut-input:scheme'

/** The colour schemes the design system carries, in the order the switcher lists them. */
export const PALETTES = /** @type {const} */ ([
  { key: 'paper', label: 'palette.paper' },
  { key: 'mineral', label: 'palette.mineral' },
  { key: 'indigo', label: 'palette.indigo' },
  { key: 'sand', label: 'palette.sand' },
])

/** The Tangut faces the reader can set the script in. Each is a family the stylesheet defines. */
export const TANGUT_FACES = /** @type {const} */ ([
  { key: 'serif', label: 'font.serif', family: '"Noto Serif Tangut"' },
  { key: 'yinchuan', label: 'font.yinchuan', family: '"Tangut Yinchuan"' },
  { key: 'wenhai', label: 'font.wenhai', family: '"BabelStone Wenhai"' },
  { key: 'kai', label: 'font.kai', family: '"New Tangut Std"' },
])

export const ui = $state({
  /** On a narrow screen the card is a sheet over the finder, opened by a tap. */
  sheet: false,
  /** @type {'auto' | 'light' | 'dark'} */
  theme: /** @type {'auto' | 'light' | 'dark'} */ ((typeof localStorage !== 'undefined' && localStorage.getItem(THEME)) || 'auto'),
  /** The colour scheme. The document already carries the one the head picked; this mirrors it. */
  /** @type {'paper' | 'mineral' | 'indigo' | 'sand'} */
  palette: /** @type {'paper' | 'mineral' | 'indigo' | 'sand'} */ (
    (typeof document !== 'undefined' && document.documentElement.dataset.palette)
    || (typeof localStorage !== 'undefined' && localStorage.getItem(PALETTE))
    || 'paper'
  ),
  /** The face Tangut is set in. @type {'serif' | 'yinchuan' | 'wenhai' | 'kai'} */
  tangut: /** @type {'serif' | 'yinchuan' | 'wenhai' | 'kai'} */ ((typeof localStorage !== 'undefined' && localStorage.getItem(TANGUT)) || 'serif'),
  /** Which reconstruction readings are shown in, wherever a system can be chosen. */
  reading: readingFromStore(typeof localStorage !== 'undefined' ? localStorage.getItem(READING) : null),
})

/** Remember the reconstruction a reader picked, for the pages that show readings. @param {string} key */
export function setReading(key) {
  ui.reading = key
  try { localStorage.setItem(READING, key) } catch { /* a blocked store only loses the choice */ }
}

/** Show a character in the card without taking the reader anywhere (arrow keys, highlighting).
 * A page previews from an effect on its highlight; the open character stays out of that effect, so a
 * choice made in the card is not put back. @param {string} char */
export const preview = char => untrack(() => open(char))

/** Open a character: the card on a wide screen, the sheet on a narrow one. @param {string} char */
export function choose(char) {
  open(char)
  if (matchMedia('(max-width: 900px)').matches) ui.sheet = true
  // With ?pick the page is being used as a character picker for another tool: the pick is handed
  // back rather than only shown.
  if (new URLSearchParams(location.search).has('pick')) {
    try { window.parent?.postMessage({ type: 'tangut-pick', char }, '*') } catch { /* a closed window */ }
  }
}

/** The pad a page is drawing on, if any: a pick made while it has a drawing carries that drawing.
 * @type {null | ((picked: string, place: number | null) => boolean)} */
let pad = null

/** Hand the page's drawing to the pick that follows. `null` when the pad goes away.
 * @param {null | ((picked: string, place: number | null) => boolean)} source */
export function attachPad(source) {
  pad = source
}

/**
 * Put a character into the text being written, and record where it came from.
 * @param {string} char
 * @param {{ place?: number }} [context]
 */
export function put(char, context = {}) {
  const drawing = pad?.(char, context.place ?? null)
  if (!drawing) {
    record({ type: 'pick', char, finder: route.page || 'find', place: context.place ?? null, locale: i18n.locale })
  }
  insert(char)
  say(t('toast.added', { char }))
}

/** @param {'auto' | 'light' | 'dark'} theme */
export function setTheme(theme) {
  ui.theme = theme
  applyTheme()
  try { localStorage.setItem(THEME, theme) } catch { /* ignore */ }
}


/** @param {'paper' | 'mineral' | 'indigo' | 'sand'} key */
export function setPalette(key) {
  if (!PALETTES.some(palette => palette.key === key)) return
  ui.palette = key
  document.documentElement.dataset.palette = key
  try { localStorage.setItem(PALETTE, key) } catch { /* a blocked store only loses the choice */ }
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

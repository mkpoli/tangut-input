// Where the reader is: the page in the path, the open character in `?c=` (its code point in hex),
// and the page's own query in `?q=`. Every state worth sharing is in the address.

export const PAGES = /** @type {const} */ ([
  { path: '', label: 'Find', hint: 'Any character, code, reading or meaning' },
  { path: 'cangjie', label: 'Cangjie', hint: 'Type glyph codes' },
  { path: 'sijiao', label: '四角號碼', hint: 'Type the four-corner code' },
  { path: 'reading', label: 'Reading', hint: 'Type a reconstruction' },
  { path: 'draw', label: 'Draw', hint: 'Sketch the shape' },
  { path: 'parts', label: 'Parts', hint: 'Build from components' },
])

/** @typedef {typeof PAGES[number]['path'] | 'about'} Page */

/** @returns {{ page: Page, q: string, c: string }} */
function read() {
  const path = location.pathname.replace(/^\/+|\/+$/g, '')
  const page = /** @type {Page} */ ([...PAGES.map(p => p.path), 'about'].includes(path) ? path : '')
  const params = new URLSearchParams(location.search)
  const code = params.get('c') ?? ''
  const c = /^[0-9a-f]{4,5}$/i.test(code) ? String.fromCodePoint(parseInt(code, 16)) : ''
  return { page, q: params.get('q') ?? '', c }
}

export const route = $state(read())

/** @param {{ page: Page, q: string, c: string }} next */
function href(next) {
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.c) params.set('c', (next.c.codePointAt(0) ?? 0).toString(16).toUpperCase())
  const search = params.toString()
  return `/${next.page}${search ? `?${search}` : ''}`
}

/** Go to another page; the open character stays open. @param {Page} page */
export function go(page) {
  if (page === route.page) return
  route.page = page
  route.q = ''
  history.pushState(null, '', href(route))
  scrollTo(0, 0)
}

/** Open a character in the card. @param {string} char */
export function open(char) {
  if (route.c === char) return
  route.c = char
  history.replaceState(null, '', href(route))
}

/** Keep the page's query in the address without adding to history. @param {string} q */
export function setQuery(q) {
  route.q = q
  history.replaceState(null, '', href(route))
}

/** A link to a page with a character open. @param {Page} page @param {string} [c] @param {string} [q] */
export const link = (page, c = '', q = '') => href({ page, c, q })

addEventListener('popstate', () => Object.assign(route, read()))

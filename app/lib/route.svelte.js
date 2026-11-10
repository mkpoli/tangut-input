// Where the reader is: the page in the path, the open character in `?c=` (its code point in hex),
// and the page's own query in `?q=`. Every state worth sharing is in the address.

// Each page's name and one-line hint are message keys, so the bar reads in the reader's language.
// One box takes anything and stands before the bar; the finders behind it are grouped by what the
// reader already has: a shape, a sound, a meaning. A group's `tab` is its short name in the phone's
// bottom bar, where the long label would not fit.
export const PRIMARY = /** @type {const} */ ({ path: '', label: 'nav.find', tab: 'nav.find.tab', icon: 'find', hint: 'nav.find.hint' })

export const GROUPS = /** @type {const} */ ([
  {
    label: 'nav.group.text',
    tab: 'nav.group.text.tab',
    icon: 'book',
    pages: [
      { path: 'texts', label: 'nav.texts', icon: 'book', hint: 'nav.texts.hint' },
      { path: 'transcribe', label: 'nav.transcribe', icon: 'transcribe', hint: 'nav.transcribe.hint' },
      { path: 'convert', label: 'nav.convert', icon: 'convert', hint: 'nav.convert.hint' },
    ],
  },
  {
    label: 'nav.group.shape',
    tab: 'nav.group.shape.tab',
    icon: 'shape',
    pages: [
      { path: 'cangjie', label: 'nav.cangjie', icon: 'cangjie', hint: 'nav.cangjie.hint' },
      { path: 'sijiao', label: 'nav.sijiao', icon: 'sijiao', hint: 'nav.sijiao.hint' },
      { path: 'draw', label: 'nav.draw', icon: 'draw', hint: 'nav.draw.hint' },
      { path: 'parts', label: 'nav.parts', icon: 'parts', hint: 'nav.parts.hint' },
    ],
  },
  {
    label: 'nav.group.sound',
    tab: 'nav.group.sound.tab',
    icon: 'sound',
    pages: [
      { path: 'fanqie', label: 'nav.fanqie', icon: 'fanqie', hint: 'nav.fanqie.hint' },
      { path: 'chart', label: 'nav.chart', icon: 'chart', hint: 'nav.chart.hint' },
      { path: 'reading', label: 'nav.reading', icon: 'reading', hint: 'nav.reading.hint' },
    ],
  },
  {
    label: 'nav.group.sense',
    tab: 'nav.group.sense.tab',
    icon: 'sense',
    pages: [
      { path: 'meaning', label: 'nav.meaning', icon: 'meaning', hint: 'nav.meaning.hint' },
      { path: 'eras', label: 'nav.eras', icon: 'eras', hint: 'nav.eras.hint' },
    ],
  },
])

// The pages outside the finder groups: the introduction, the Gyalrongic note and the sources.
export const MORE = /** @type {const} */ ([
  { path: 'intro', label: 'nav.intro', icon: 'book', hint: 'nav.intro.hint' },
  { path: 'gyalrongic', label: 'gyalrongic.title', icon: 'book', hint: 'gyalrongic.hint' },
  { path: 'about', label: 'nav.sources', icon: 'sources', hint: 'nav.sources.hint' },
  { path: 'dataset', label: 'nav.dataset', icon: 'code', hint: 'nav.dataset.hint' },
])

/** @typedef {typeof GROUPS[number]['pages'][number] | typeof MORE[number]} MenuEntry */

/** @typedef {typeof PRIMARY | MenuEntry} PageEntry */

/** @type {PageEntry[]} */
export const PAGES = [PRIMARY, ...GROUPS.flatMap(group => /** @type {PageEntry[]} */ ([...group.pages]))]

/** @typedef {PageEntry['path'] | 'variants'} Page */

/** @returns {{ page: Page, q: string, c: string }} */
function read() {
  const path = location.pathname.replace(/^\/+|\/+$/g, '')
  const page = /** @type {Page} */ ([...PAGES, ...MORE].some(entry => entry.path === path) || path === 'variants' ? path : '')
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

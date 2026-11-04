// What each page says about itself outside the page: the title a tab and a search result show, the
// one-line description under it, and the address the page answers at. The worker reads this to
// answer a crawler without running the app, and the app reads it to keep the head in step when a
// reader moves between finders without a page load.

export const SITE = {
  name: 'Tangut Input',
  url: 'https://tangut.mkpo.li',
  image: 'https://tangut.mkpo.li/og.png',
  description: 'Enter Tangut characters by Cangjie code, reconstruction, meaning, four-corner code, drawing or components, and read what is recorded about each one.',
}

/** @type {Record<string, { title: string, description: string }>} */
export const PAGE_SEO = {
  '': {
    title: 'Tangut Input — look up a Tangut character',
    description: 'Look up a Tangut character by its Cangjie code, its four-corner code, its reconstruction, its meaning or the shape you draw, and read its readings, components and attested lines.',
  },
  meaning: {
    title: 'Meaning — Tangut Input',
    description: 'Search the Tangut glosses in English, Japanese and Chinese, and see which character each sense belongs to.',
  },
  cangjie: {
    title: 'Cangjie — Tangut Input',
    description: 'Type a Tangut Cangjie code letter by letter and pick the character it names, with the shapes each key holds laid out beside it.',
  },
  sijiao: {
    title: 'Four-corner — Tangut Input',
    description: 'Find a Tangut character by its four-corner code, digit by digit, from the top left corner to the fifth digit.',
  },
  reading: {
    title: 'Reading — Tangut Input',
    description: 'Type a Tangut reconstruction in any of eight systems — Li Fanwen, Gong Hwang-cherng, Miyake and the rest — and see the characters read so.',
  },
  transcribe: {
    title: 'Transcribe Tangut text — every character’s reading',
    description: 'Paste a line of Tangut and read every character: its reconstruction in any of eight systems, its rhyme and tone, and a table of all eight for copying.',
  },
  fanqie: {
    title: 'Fanqie — Tangut Input',
    description: 'Type the two characters a Tangut fanqie is spelt with, the upper and the lower, and find the character they spell.',
  },
  chart: {
    title: 'Rhyme chart — Tangut Input',
    description: 'The rhyme books laid out as a chart: rhymes down the side, initial groups across the top, and the characters that stand at each crossing.',
  },
  eras: {
    title: 'Eras, titles and state names — Tangut Input',
    description: 'The era names, imperial titles, posthumous names and state names of the Western Xia, with Tangut where recorded and each marked by what it rests on.',
  },
  draw: {
    title: 'Draw — Tangut Input',
    description: 'Sketch a Tangut character on the pad and see the glyphs closest to it in shape, compared against five Tangut faces.',
  },
  parts: {
    title: 'Parts — Tangut Input',
    description: 'Choose the components you can see in a Tangut character and narrow the list to the characters built with them.',
  },
  intro: {
    title: 'Tangut: people, script, language and texts — Tangut Input',
    description: 'A short introduction to the Tanguts (党項), the Western Xia state, the Tangut script and language, the surviving texts, and how the script is used today.',
  },
  about: {
    title: 'Sources — Tangut Input',
    description: 'Where every record on Tangut Input comes from — Open Tangut, the Tangut Cangjie table, Unicode, an edition with facsimile, twelve Wikisource texts and the Lausanne Corpus — and what the site keeps.',
  },
}

/** The title, description and canonical address of a page. @param {string} page */
export function seoOf(page) {
  const entry = PAGE_SEO[page] ?? PAGE_SEO['']
  return { ...entry, url: `${SITE.url}/${page}` }
}

/**
 * Put a page's title, description and canonical address into the document, so a reader who moves
 * between finders without a page load still sees the right tab and shares the right link.
 * @param {string} page
 */
export function applySeo(page) {
  if (typeof document === 'undefined') return
  const { title, description, url } = seoOf(page)
  document.title = title
  /** @param {string} selector @param {string} value @param {string} [attribute] */
  const set = (selector, value, attribute = 'content') => {
    const element = document.head.querySelector(selector)
    if (element) element.setAttribute(attribute, value)
  }
  set('meta[name="description"]', description)
  set('link[rel="canonical"]', url, 'href')
  set('meta[property="og:title"]', title)
  set('meta[property="og:description"]', description)
  set('meta[property="og:url"]', url)
  set('meta[name="twitter:title"]', title)
  set('meta[name="twitter:description"]', description)
}

// The books a keyed reading may cite, by the id it carries in data/books/source.yaml. The full record
// of each stays in the repository; the card needs a short title and the reader's way to the page.
/** @type {Record<string, { title: string, url?: string }>} */
export const BOOKS = {
  'zhangzhongzhu': { title: '番漢合時掌中珠', url: 'https://kokusho.nijl.ac.jp/biblio/100354804' },
  'xiahan-zidian': { title: '夏漢字典' },
  'nevsky-1960': { title: 'Тангутская филология' },
  'arakawa-tsuin': { title: '西夏語通韻字典' },
  'ghc-2002': { title: '西夏語文研究論文集' },
  'ghc-2005': { title: '西夏語言文字研究論集' },
  'wenhai-yanjiu': { title: '文海研究' },
  '-': { title: '' },
}

/** @param {string} work */
export const bookTitle = work => BOOKS[work]?.title ?? work

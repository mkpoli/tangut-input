// Build `app/data/tangut-identifiers.json.gz`: the numbers and legacy code points a Tangut
// character has besides its Unicode code point. Four systems are recorded:
//
// - Li Fanwen 2008's dictionary number, from Unicode's `kTGT_MergedSrc` (`L2008-0008`);
// - the 文海 page and entry, from BabelStone's lookup (`L62.221`, `M10.131`);
// - Mojikyo's M202 and M203 code points, from BabelStone's conversion table;
// - the XXZT (Tangut Yinchuan) A and B code points, from the same table.
//
// The two BabelStone files are JavaScript data with no stated licence. Their digests are pinned;
// a changed file stops the build until a person reads the change.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const ROOT = new URL('..', import.meta.url)
const OUT = new URL('app/data/tangut-identifiers.json.gz', ROOT)
const RETRIEVED = '2026-11-08'

const SOURCES = {
  lfw: {
    name: 'Unicode 18.0.0 TangutSources.txt',
    url: 'https://www.unicode.org/Public/18.0.0/ucd/TangutSources.txt',
    sha256: 'ae440bd9bba89b2610cfe6b498ac462d2763dd32bfead8ac30d32988b5b67a27',
    licence: 'Unicode License v3',
  },
  wenhai: {
    name: 'BabelStone 文海 lookup',
    url: 'https://www.babelstone.co.uk/Tangut/WenhaiLookup.js',
    sha256: '678aebcca824de478ff624f6b71c957ac4d2bedeb92e12b7348a87239eacfae0',
    note: 'Li Fanwen 2008 number to code point and 文海 page and entry; last modified 2020-05-20. No licence stated.',
  },
  legacy: {
    name: 'BabelStone Tangut conversion tables',
    url: 'https://www.babelstone.co.uk/Unicode/tangut.js',
    sha256: '898386e26a6aaadde39b2d9c076bf179af4fc85664552bedfc327246a987421d',
    note: 'XXZT A/B and Mojikyo 4.50/4.60 code points; version 2018-12-04. No licence stated.',
  },
}

/** @param {string} url @param {string} sha256 */
async function source(url, sha256) {
  const response = await fetch(url)
  if (!response.ok) throw Error(`${response.status} ${url}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== sha256) throw Error(`the source changed: ${url}\nexpected ${sha256}\ngot      ${digest}`)
  return bytes.toString()
}

const TANGUT = /^[\u{17000}-\u{18D7F}]$/u
const codePoint = value => `U+${value.toString(16).toUpperCase().padStart(4, '0')}`
/** @type {Map<string, [string, string, string?][]>} */
const chars = new Map()
/** @param {string} char @param {string} scheme @param {string} value @param {string} [edition] */
function add(char, scheme, value, edition) {
  if (!TANGUT.test(char)) return
  const rows = chars.get(char)
  const row = /** @type {[string, string, string?]} */ (edition ? [scheme, value, edition] : [scheme, value])
  if (rows) rows.push(row)
  else chars.set(char, [row])
}

// Li Fanwen 2008 numbers. A merged character can carry two numbers (L0042/4537); an
// alternative character a letter (L2941A). Keep the source's number, with its letter or pair.
const unicode = await source(SOURCES.lfw.url, SOURCES.lfw.sha256)
let lfwCount = 0
for (const line of unicode.split('\n')) {
  const [point, tag, raw] = line.split('\t')
  if (!point?.startsWith('U+') || tag !== 'kTGT_MergedSrc' || !raw?.startsWith('L2008-')) continue
  const char = String.fromCodePoint(parseInt(point.slice(2), 16))
  const numbers = raw.slice('L2008-'.length).match(/\d{4}[AB]?/g) ?? []
  if (!numbers.length) continue
  const value = `L${numbers.join('/')}`
  add(char, 'lfw', value)
  lfwCount++
}

// 文海 positions. The lookup gives a code point as "1" + four hex digits for supplementary
// characters, and a page/entry such as L62.221 (level tone) or M10.131 (mixed category).
const wenhai = await source(SOURCES.wenhai.url, SOURCES.wenhai.sha256)
const POSITION = /^[LM]\d{2}\.\d{3}$/
let wenhaiCount = 0
for (const [, hex, position] of wenhai.matchAll(/L2008\[\d+\] = \["([0-9A-F]{4})", "([^"]*)"\];/g)) {
  if (!POSITION.test(position)) continue
  const char = String.fromCodePoint(0x10000 + parseInt(hex, 16))
  add(char, 'wenhai', position)
  wenhaiCount++
}

// Legacy code points. XXZT has two editions (A and B); Mojikyo has two (4.50 and 4.60).
// BabelStone's converter resolves a legacy code to one character, or prints both in braces
// when the same code means two characters. Both are kept here, each under its edition.
const legacy = await source(SOURCES.legacy.url, SOURCES.legacy.sha256)
/** @param {string} name */
function rows(name) {
  /** @type {number[][]} */
  const out = []
  for (const match of legacy.matchAll(new RegExp(`${name}\\[\\d+\\] = \\[([^\\]]+)\\];`, 'g'))) {
    out.push(match[1].split(',').map(value => parseInt(value.trim(), 16)))
  }
  return out
}
const NONE = 0xffff
const PLUS = 0xfffe
const xxzt = rows('XXZT')
const mojikyo = rows('Mojikyo')
const plus = new Map(rows('MojikyoPlus').filter(row => row[1] !== NONE && row[1] !== PLUS).map(row => [row[0], row[1]]))
const remap = new Map(rows('MojikyoRemapped').filter(row => row[1] !== NONE && row[1] !== PLUS).map(row => [row[0], row[1]]))

let xxztRows = 0
for (const [code, a, b] of xxzt) {
  if (a !== NONE && a !== PLUS) { add(String.fromCodePoint(a), 'xxzt', codePoint(code), 'A'); xxztRows++ }
  if (b !== NONE && b !== PLUS) { add(String.fromCodePoint(b), 'xxzt', codePoint(code), 'B'); xxztRows++ }
}

let mojikyoRows = 0
for (const [code, old, next] of mojikyo) {
  // 4.50: the old value, the new one when the old is absent, and both when both exist.
  const oldValues = [old, next].filter(value => value !== NONE && value !== PLUS)
  for (const value of new Set(oldValues)) { add(String.fromCodePoint(value), 'mojikyo', codePoint(code), '4.50'); mojikyoRows++ }
  // 4.60: the converter takes the old value when the new one is absent, the new one when the
  // old is absent, and resolves a missing new value through its plus table. The seven remapped
  // codes replace the new value outright.
  let current = next
  if (current === PLUS) current = plus.get(code) ?? NONE
  if (current !== NONE && old !== NONE) current = remap.get(code) ?? current
  if (current === NONE) current = old
  const newValues = [old, current].filter(value => value !== NONE && value !== PLUS)
  for (const value of new Set(newValues)) { add(String.fromCodePoint(value), 'mojikyo', codePoint(code), '4.60'); mojikyoRows++ }
}

// One row per distinct scheme, value and edition, in the order the card reads them.
for (const [char, list] of chars) {
  const seen = new Set()
  chars.set(char, list.filter(row => {
    const key = row.join('\t')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }))
}

const document = {
  format: 'tangut-input/identifiers',
  retrieved: RETRIEVED,
  sources: {
    lfw: { name: SOURCES.lfw.name, url: SOURCES.lfw.url, licence: SOURCES.lfw.licence, note: 'The dictionary index of every encoded Tangut ideograph; a merged character can carry two numbers and an alternative character a letter.' },
    wenhai: { name: SOURCES.wenhai.name, url: 'https://www.babelstone.co.uk/Tangut/WenhaiLookup.html', note: `${SOURCES.wenhai.note} The data file is ${SOURCES.wenhai.url}.` },
    mojikyo: { name: 'Mojikyo M202/M203', url: 'https://www.babelstone.co.uk/Unicode/mojikyo.html', note: `${SOURCES.legacy.note} The data file is ${SOURCES.legacy.url}. The code point is a CJK code point, not a private-use one.` },
    xxzt: { name: 'XXZT (Tangut Yinchuan)', url: 'https://www.babelstone.co.uk/Unicode/xxzt.html', note: `${SOURCES.legacy.note} The data file is ${SOURCES.legacy.url}. The A and B fonts of Jing Yongshi’s XXZT map Tangut glyphs to CJK code points.` },
  },
  chars: Object.fromEntries([...chars].sort(([a], [b]) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))),
}
const json = JSON.stringify(document)
writeFileSync(OUT, gzipSync(json, { level: 9, mtime: 0 }))
const counts = Object.fromEntries(['lfw', 'wenhai', 'mojikyo', 'xxzt'].map(scheme => [scheme, [...chars.values()].filter(rows => rows.some(row => row[0] === scheme)).length]))
console.log(`${chars.size} characters, ${lfwCount} Li Fanwen numbers, ${wenhaiCount} 文海 positions, ${mojikyoRows} Mojikyo rows, ${xxztRows} XXZT rows`)
console.log(counts, `${OUT.pathname.split('/').pop()} ${(readFileSync(OUT).length / 1024).toFixed(1)} KB`)

// Screenshot the built site (dist/) in light and dark, at 1440×900 and at phone width, without a
// server: requests to the site's origin are answered from dist/, everything else (the font) goes
// to the network. Run `bun run build:app` first.
//   bun scripts/shoot_app.mjs [out-dir] [only-name]
import { chromium } from 'playwright-core'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, extname } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DIST = join(ROOT, 'dist')
const OUT = process.argv[2] ?? join(ROOT, 'docs/design')
const ONLY = process.argv[3] ?? ''
const ORIGIN = 'http://tangut.test'
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gz': 'application/gzip', '.png': 'image/png' }

function browserPath() {
  const cache = join(homedir(), '.cache/ms-playwright')
  const dirs = readdirSync(cache).filter(dir => dir.startsWith('chromium-')).sort().reverse()
  for (const dir of dirs) {
    const path = join(cache, dir, 'chrome-linux64/chrome')
    if (existsSync(path)) return path
    const old = join(cache, dir, 'chrome-linux/chrome')
    if (existsSync(old)) return old
  }
  throw new Error('No Chromium under ~/.cache/ms-playwright')
}

/** @type {{ name: string, path: string, act?: (page: import('playwright-core').Page, phone: boolean) => Promise<void> }[]} */
const SCREENS = [
  { name: 'find', path: '/' },
  { name: 'find-text', path: '/?q=%F0%97%8B%95%F0%98%8F%A8%F0%98%9C%B6%F0%97%A4%B6%F0%97%9C%88%F0%97%A7%AF%F0%98%94%BC&c=172D5' },
  { name: 'cangjie', path: '/cangjie', act: async page => { await page.locator('input.code-input').pressSequentially('msb', { delay: 40 }) } },
  { name: 'reading', path: '/reading?q=ndzi' },
  { name: 'draw', path: '/draw', act: draw },
  { name: 'parts', path: '/parts?q=%F0%98%A0%80%F0%98%A0%86' },
  { name: 'texts', path: '/texts' },
  { name: 'card', path: '/cangjie?c=172D5', act: async (page, phone) => { if (phone) await page.goto(`${ORIGIN}/?q=%F0%97%8B%95`).then(() => page.locator('.ui-row-pick').first().click()) } },
  { name: 'card-attested', path: '/cangjie?c=172D5', act: async (page, phone) => {
    if (phone) await page.goto(`${ORIGIN}/?q=%F0%97%8B%95`).then(() => page.locator('.ui-row-pick').first().click())
    await page.waitForTimeout(400)
    await page.evaluate(offset => {
      const card = document.querySelector('.card')
      const section = document.querySelector('.attest')
      if (card && section) card.scrollTop += section.getBoundingClientRect().top - card.getBoundingClientRect().top - offset
    }, phone ? 72 : 18)
  } },
  { name: 'intro', path: '/intro' },
  { name: 'gyalrongic', path: '/gyalrongic' },
  { name: 'sources', path: '/about' },
]

/** Draw a rough character on the pad: a roof, two columns and a hook, as a hand might. @param {import('playwright-core').Page} page */
async function draw(page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) return
  const at = (/** @type {number} */ x, /** @type {number} */ y) => [box.x + box.width * x, box.y + box.height * y]
  const strokes = [
    [[0.18, 0.2], [0.82, 0.2]],
    [[0.5, 0.08], [0.5, 0.2]],
    [[0.3, 0.32], [0.3, 0.86]],
    [[0.3, 0.42], [0.45, 0.42]],
    [[0.3, 0.6], [0.45, 0.6]],
    [[0.62, 0.32], [0.62, 0.9], [0.55, 0.84]],
    [[0.52, 0.5], [0.8, 0.5]],
  ]
  for (const stroke of strokes) {
    const [sx, sy] = at(stroke[0][0], stroke[0][1])
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    for (const [x, y] of stroke.slice(1)) {
      const [px, py] = at(x, y)
      await page.mouse.move(px, py, { steps: 8 })
    }
    await page.mouse.up()
  }
  await page.waitForTimeout(400)
}

const browser = await chromium.launch({ executablePath: browserPath() })
await mkdir(OUT, { recursive: true })
for (const scheme of /** @type {const} */ (['light', 'dark'])) {
  for (const [label, viewport, phone] of /** @type {const} */ ([['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]])) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: scheme, hasTouch: phone, isMobile: phone })
    await context.route(`${ORIGIN}/**`, async route => {
      const url = new URL(route.request().url())
      let file = join(DIST, decodeURIComponent(url.pathname))
      if (!existsSync(file) || !extname(file)) file = join(DIST, 'index.html')
      await route.fulfill({ body: await readFile(file), contentType: TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] ?? 'application/octet-stream' })
    })
    const page = await context.newPage()
    page.on('pageerror', error => console.error(`${label} ${scheme}: ${error.message}`))
    for (const screen of SCREENS) {
      if (ONLY && screen.name !== ONLY) continue
      await page.goto(`${ORIGIN}${screen.path}`)
      await page.waitForFunction(() => document.fonts.status === 'loaded' && !document.body.textContent?.includes('Loading the records'))
      await page.waitForTimeout(500)
      if (screen.act) await screen.act(page, phone)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(700)
      await page.screenshot({ path: join(OUT, `${screen.name}-${label}-${scheme}.png`) })
    }
    await context.close()
  }
}
await browser.close()
console.log(`screenshots in ${OUT}`)

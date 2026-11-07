// Local browser regression check against the built app; no server required.
// bun scripts/check_tile_glosses.mjs [screenshot-dir] [--capture-only]
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const root = new URL('..', import.meta.url).pathname
const out = process.argv[2]
const captureOnly = process.argv.includes('--capture-only')
const query = process.env.TILE_QUERY ?? 'tiger'
const origin = 'http://tangut.test'
const cache = join(homedir(), '.cache/ms-playwright')
const executablePath = readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()
  .flatMap(name => ['chrome-linux64/chrome', 'chrome-linux/chrome'].map(file => join(cache, name, file))).find(existsSync)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.gz': 'application/gzip', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' }
const browser = await chromium.launch({ executablePath })
try {
  if (out) await mkdir(out, { recursive: true })
  for (const colorScheme of ['light', 'dark']) {
    for (const phone of [false, true]) {
      const context = await browser.newContext({ colorScheme, viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 2 })
      try {
        await context.route(`${origin}/**`, async route => {
          const pathname = decodeURIComponent(new URL(route.request().url()).pathname)
          let file = join(root, 'dist', pathname)
          if (!existsSync(file) || !extname(file)) file = join(root, 'dist/index.html')
          await route.fulfill({ body: await readFile(file), contentType: types[extname(file)] ?? 'application/octet-stream' })
        })
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(`${origin}/?q=${encodeURIComponent(query)}`)
        await page.locator('.ui-tile-note').first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        if (!captureOnly) {
          const tile = page.locator('.ui-tile').filter({ has: page.locator('.ui-tile-han') }).first()
          await tile.waitFor()
          const han = await tile.locator('.ui-tile-han').innerText()
          assert.match(han, /\p{Script=Han}/u)
          assert(await tile.locator('.ui-tile-note-text').innerText(), 'English remains visible')
          const boxes = await Promise.all(['.ui-tile-sound', '.ui-script', '.ui-tile-han', '.ui-tile-note-text'].map(selector => tile.locator(selector).boundingBox()))
          assert(boxes.every(Boolean), 'reconstruction, glyph, Han gloss and English all render')
          for (let i = 1; i < boxes.length; i++) assert(boxes[i].y >= boxes[i - 1].y + boxes[i - 1].height - 1, 'tile lines do not overlap')
          assert(await tile.locator('.ui-tile-han').getAttribute('title'), 'gloss source is available')
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal page overflow')
        }
        if (out) await page.screenshot({ path: join(out, `find-${phone ? 'phone' : 'desktop'}-${colorScheme}.png`) })
        if (!captureOnly && query === 'poison') {
          const tile = page.locator('.ui-tile').filter({ has: page.locator('.ui-tile-han', { hasText: /^毒$/ }) }).first()
          assert.match(await tile.locator('.ui-tile-han').getAttribute('title'), /Chinese Wiktionary: 毒；下毒者；毒死/)
          await tile.click()
          const meanings = page.locator('.means dd[lang="zh"]')
          await meanings.waitFor({ state: 'visible' })
          assert.equal(await meanings.innerText(), '毒；下毒者；毒死')
          assert(await page.locator('.means a[href*="zh.wiktionary.org"]').count(), 'the Chinese source is linked on the card')
          // Chinese terms imported into the records answer the visible meaning search.
          await page.goto(`${origin}/?q=${encodeURIComponent('吸')}`)
          await page.locator('.ui-tile-han', { hasText: /^吸$/ }).first().waitFor()
          await page.goto(`${origin}/?q=bridge`)
          const bridge = page.locator('.ui-tile').filter({ has: page.locator('.ui-tile-han', { hasText: /^橋$/ }) }).first()
          await bridge.waitFor()
          assert.equal(await bridge.locator('.ui-tile-note-text').innerText(), 'bridge', 'Downes English stays visible alongside the imported Chinese')
        }
        // The shared Candidates grid used by the Parts and Draw pages.
        await page.goto(`${origin}/parts?q=${encodeURIComponent('𘠁')}`)
        await page.locator('.matches .ui-tile-note').first().waitFor()
        if (!captureOnly) {
          assert(await page.locator('.matches .ui-tile-han').count(), 'Parts candidates include Han glosses')
          assert(await page.locator('.matches .ui-tile-note-text').count(), 'Parts candidates retain English')
        }
        if (!captureOnly) {
          await page.goto(`${origin}/pick.html`)
          await page.locator('.picker-panel input').first().fill('tiger')
          const mini = page.locator('.mini-tiles .ui-tile').filter({ has: page.locator('.ui-tile-han') }).first()
          await mini.waitFor()
          assert.match(await mini.getAttribute('aria-label'), /虎/, 'the picker announces its Chinese gloss')
          assert(await mini.locator('.ui-tile-note-text').innerText(), 'the picker retains English')
        }
        assert.deepEqual(errors, [])
        console.log(`${phone ? 'phone' : 'desktop'} ${colorScheme}: passed`)
      } finally { await context.close() }
    }
  }
} finally { await browser.close() }

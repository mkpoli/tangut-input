// Check the built Find and Meaning results without a server.
// bun run build:app && bun scripts/check_meaning_gloss.mjs [screenshot-dir] [--capture-only]
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const DIST = new URL('../dist/', import.meta.url).pathname
const OUT = process.argv[2] ?? '/tmp/tangut-meaning-gloss'
const CAPTURE = process.argv.includes('--capture-only')
const ORIGIN = 'http://tangut.test'
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.gz': 'application/gzip', '.png': 'image/png', '.webp': 'image/webp' }
const cache = join(homedir(), '.cache/ms-playwright')
const executablePath = readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()
  .flatMap(name => ['chrome-linux64/chrome', 'chrome-linux/chrome'].map(file => join(cache, name, file))).find(existsSync)
assert.ok(executablePath, 'Chromium must be installed')
const browser = await chromium.launch({ executablePath })
const errors = []
await mkdir(OUT, { recursive: true })
try {
  for (const colorScheme of ['light', 'dark']) for (const [size, viewport] of [
    ['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme })
    await context.route(`${ORIGIN}/**`, async route => {
      let file = join(DIST, decodeURIComponent(new URL(route.request().url()).pathname))
      if (!existsSync(file) || !extname(file)) file = join(DIST, 'index.html')
      await route.fulfill({ body: await readFile(file), contentType: TYPES[extname(file)] ?? 'application/octet-stream' })
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    for (const [name, path] of [['find', '/'], ['meaning', '/meaning']]) {
      await page.goto(`${ORIGIN}${path}?q=${encodeURIComponent('水')}&lang=ja`)
      await page.locator(name === 'find' ? '.ui-tile' : '.meaning-row').first().waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: join(OUT, `${name}-${size}-${colorScheme}.png`) })
      if (CAPTURE) {
        console.log(name, size, colorScheme, await page.locator(name === 'find' ? '.ui-tile-note' : '.sense').allTextContents())
        continue
      }
      if (name === 'find') {
        const tile = page.locator('.ui-tile').filter({ has: page.locator('.ui-script', { hasText: '𗌜' }) })
        assert.equal(await tile.locator('.ui-tile-note-text').textContent(), 'water')
        assert.doesNotMatch((await page.locator('.ui-tile-note').allTextContents()).join(' '), /CCAMC/)
      } else {
        const row = page.locator('.meaning-row').filter({ has: page.locator('.ui-script', { hasText: '𗌜' }) })
        assert.equal(await row.locator('.sense').getAttribute('lang'), 'en')
        assert.equal(await row.locator('.sense').textContent(), 'enDowneswater, river')
        assert.equal(await page.locator('.ccamc-note').count(), 0)
        // Filtering the search to Chinese still displays the English gloss with its own language.
        await page.getByRole('button', { name: '中文', exact: true }).click()
        assert.equal(await row.locator('.sense').getAttribute('lang'), 'en')
        assert.match(await row.locator('.sense').textContent(), /Downeswater, river/)
        // Wiktionary supplies a gloss when Downes has no entry.
        await page.goto(`${ORIGIN}/meaning?q=${encodeURIComponent('靴')}&lang=ja`)
        const boots = page.locator('.meaning-row').filter({ has: page.locator('.ui-script', { hasText: '𗄀' }) })
        await boots.waitFor()
        assert.equal(await boots.locator('.sense').getAttribute('lang'), 'en')
        assert.equal(await boots.locator('.sense').textContent(), 'enWiktionaryboots')
        // Missing glosses stay empty, with no source or language attribution.
        await page.goto(`${ORIGIN}/meaning?q=${encodeURIComponent('風')}&lang=ja`)
        const missing = page.locator('.meaning-row').filter({ has: page.locator('.ui-script', { hasText: '𗩺' }) })
        await missing.waitFor()
        assert.equal(await missing.locator('.sense').textContent(), '—')
        assert.equal(await missing.locator('.sense').getAttribute('lang'), null)
        assert.equal(await missing.locator('.ui-tag').count(), 0)
        // A Wiktionary match retains its original language and sense.
        await page.goto(`${ORIGIN}/meaning?q=poison&lang=en`)
        const wiktionary = page.locator('.meaning-row').filter({ has: page.locator('.ui-script', { hasText: '𗀀' }) })
        await wiktionary.waitFor()
        assert.equal(await wiktionary.locator('.sense').getAttribute('lang'), 'en')
        assert.match(await wiktionary.locator('.sense').textContent(), /poison; venom; toxin/)
        assert.doesNotMatch(await wiktionary.locator('.sense').textContent(), /Downes/)
      }
    }
    await context.close()
  }
  assert.deepEqual(errors, [], 'No browser errors')
  console.log(CAPTURE ? `Captured results in ${OUT}` : `Meaning gloss checks passed; screenshots in ${OUT}`)
} finally {
  await browser.close()
}

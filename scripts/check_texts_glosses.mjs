// Local browser check of the gloss layers in the Texts reading view; no server required.
// bun scripts/check_texts_glosses.mjs [screenshot-dir] [--capture-only]
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const root = new URL('..', import.meta.url).pathname
const out = process.argv[2]
const captureOnly = process.argv.includes('--capture-only')
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
        await page.goto(`${origin}/texts`)
        await page.locator('.text-card .title-link').first().waitFor()
        await page.locator('.text-card .title-link').first().click()
        await page.locator('.passage').first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        if (!captureOnly) {
          const zh = page.locator('.passage .gloss.zh')
          const en = page.locator('.passage .gloss.en')
          assert(await zh.count() > 0, 'the Chinese layer renders')
          assert((await zh.allInnerTexts()).some(text => /\p{Script=Han}/u.test(text)), 'the Chinese layer carries Han text')
          assert(await en.count() > 0, 'the English layer renders')
          assert((await en.allInnerTexts()).some(text => /[A-Za-z]/.test(text)), 'the English layer carries English text')
          assert(await page.locator('.passage .gloss[title]').count(), 'a gloss carries its full text and source')
        }
        if (out) await page.screenshot({ path: join(out, `texts-${phone ? 'phone' : 'desktop'}-${colorScheme}.png`) })
        if (!captureOnly) {
          const toggle = page.getByRole('button', { name: 'Glosses' })
          assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'glosses start on')
          await toggle.click()
          assert.equal(await page.locator('.passage .gloss').count(), 0, 'the layers turn off')
          await page.reload()
          await page.locator('.passage').first().waitFor()
          assert.equal(await page.locator('.passage .gloss').count(), 0, 'the off choice persists')
          await page.getByRole('button', { name: 'Glosses' }).click()
          assert(await page.locator('.passage .gloss.zh').count() > 0, 'the layers turn back on')
        }
        assert.deepEqual(errors, [])
        console.log(`${phone ? 'phone' : 'desktop'} ${colorScheme}: passed`)
      } finally { await context.close() }
    }
  }
} finally { await browser.close() }

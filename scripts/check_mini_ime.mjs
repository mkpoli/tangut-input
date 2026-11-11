// Run against a local app server: APP_URL=http://127.0.0.1:5189 bun scripts/check_mini_ime.mjs
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const cache = join(homedir(), '.cache/ms-playwright')
const executablePath = process.env.CHROMIUM_PATH ?? readdirSync(cache)
  .filter(name => name.startsWith('chromium-')).sort().reverse()
  .flatMap(dir => ['chrome-linux64/chrome', 'chrome-linux/chrome'].map(tail => join(cache, dir, tail)))
  .find(existsSync)
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium executable')
const browser = await chromium.launch({ executablePath })
const app = process.env.APP_URL ?? 'http://127.0.0.1:5189'
try {
  for (const path of ['/', '/pick.html']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    try {
      await context.addInitScript(() => {
        localStorage.setItem('tangut-input:text', '')
        localStorage.setItem('tangut-input:recent', JSON.stringify(['\u{17001}']))
      })
      const page = await context.newPage()
      await page.goto(app + path)
      if (path === '/') await page.locator('.ime > button').click()
      const box = page.locator('.ime input')
      const options = page.locator('.ime [role=option]')
      await options.first().waitFor({ timeout: 30000 })
      const written = () => page.evaluate(() => localStorage.getItem('tangut-input:text'))
      for (const value of ['U+17001', 'u17001', '10', 'msb1', 'water 2']) {
        await box.fill('')
        await box.pressSequentially(value)
        assert.equal(await box.inputValue(), value, `typing ${value} on ${path}`)
        assert.equal(await written(), '', 'typing must not insert a result')
      }
      if (path === '/') {
        await box.fill('m')
        await page.waitForFunction(() => document.querySelectorAll('.ime [role=option]').length === 48)
        const list = page.locator('.ime .hits')
        await list.evaluate(el => { el.scrollTop = el.scrollHeight })
        assert.ok(await list.evaluate(el => el.scrollTop > 0), 'long result list scrolls')
        await box.fill('a')
        await page.waitForFunction(() => document.querySelector('.ime .hits')?.scrollTop === 0)
        assert.equal(await options.first().getAttribute('aria-selected'), 'true', 'new query highlights a visible first result')
      }
      await box.fill('U+17001')
      await options.first().waitFor()
      assert.equal(await options.first().locator('.ui-script').innerText(), '\u{17001}', 'code point finds its character')
      await box.fill('10')
      await options.first().waitFor()
      assert.match(await options.first().getAttribute('title'), /(?:^| · )10\d*/, 'four-corner code finds a matching result')
      await box.fill('msb')
      await options.first().waitFor()
      assert.equal(await options.first().getAttribute('aria-selected'), 'true', 'the default Enter result is highlighted')
      assert.equal(await box.getAttribute('aria-activedescendant'), await options.first().getAttribute('id'))
      assert.equal(await box.getAttribute('aria-autocomplete'), 'list')
      assert.equal(await options.locator('[tabindex]:not([tabindex="-1"])').count(), 0)
      assert.equal(await options.evaluateAll(nodes => nodes.filter(node => node.tabIndex !== -1).length), 0, 'options are not separate tab stops')
      await box.press('ArrowLeft')
      assert.equal(await box.evaluate(el => el.selectionStart), 2, 'Left moves the caret')
      await box.press('Shift+ArrowLeft')
      assert.deepEqual(await box.evaluate(el => [el.selectionStart, el.selectionEnd]), [1, 2], 'Shift+Left selects text')
      await box.press('ArrowRight')
      assert.equal(await box.evaluate(el => el.selectionStart), 2, 'Right moves the caret')
      await box.press('End')
      await box.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })))
      await box.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true })))
      assert.equal(await written(), '', 'IME confirmation does not pick')
      await box.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 229, bubbles: true, cancelable: true })))
      assert.equal(await options.nth(1).getAttribute('aria-selected'), 'true', 'non-Enter keyCode 229 keeps its shortcut')
      assert.equal(await box.getAttribute('aria-activedescendant'), await options.nth(1).getAttribute('id'))
      const picked = await options.nth(1).locator('.ui-script').innerText()
      await box.press('Enter')
      assert.equal(await written(), picked, 'Enter picks the highlighted result')
      assert.equal(await box.inputValue(), '')
      console.log(`PASS MiniIme typing and keyboard selection ${path}`)
    } finally { await context.close() }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  try {
    const page = await context.newPage()
    await page.goto(app + '/draw')
    const canvas = page.locator('.draw canvas')
    await canvas.waitFor()
    const bounds = await canvas.boundingBox()
    await page.mouse.move(bounds.x + 40, bounds.y + 40)
    await page.mouse.down()
    await page.mouse.move(bounds.x + 170, bounds.y + 170, { steps: 8 })
    await page.mouse.up()
    await page.locator('.draw .results [role=option]').first().waitFor({ timeout: 30000 })
    await page.locator('.ime > button').click()
    const box = page.locator('.ime input')
    await box.fill('U+17001')
    const option = page.locator('.ime [role=option]').first()
    await option.waitFor()
    await option.focus()
    await option.press('Enter')
    assert.equal(await page.evaluate(() => localStorage.getItem('tangut-input:text')), '\u{17001}', 'Enter on a picker option cannot pick a drawing result')
    assert.ok(await page.locator('.draw .results [role=option]').count(), 'drawing results remain after the picker action')
    await page.locator('.ime [role=option]').first().focus()
    await page.keyboard.press('Escape')
    assert.equal(await box.count(), 0, 'Escape from an option closes the popup')
    console.log('PASS MiniIme option keys while Draw is active')
  } finally { await context.close() }
} finally { await browser.close() }

// APP_URL=http://localhost:5173 CHROMIUM_PATH=/path/to/chromium bun demo/check-app-handwriting-parts.js
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const screenshotDir = process.env.SCREENSHOT_DIR
if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
try {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme })
      const page = await context.newPage()
      page.setDefaultTimeout(120000)
      const base = process.env.APP_URL ?? 'http://localhost:5173'
      await page.goto(new URL('/draw', base).href)
      const filter = page.locator('.part-filter')
      await filter.locator('summary').click()
      const palette = filter.locator('.ui-tiles button')
      await palette.first().waitFor()
      await palette.nth(0).click()
      await palette.nth(0).click()
      assert.equal(await filter.locator('.ui-chip').count(), 2)
      async function draw() {
        await page.locator('canvas').scrollIntoViewIfNeeded()
        const bounds = await page.locator('canvas').boundingBox()
        assert.ok(bounds)
        await page.mouse.move(bounds.x + bounds.width * .25, bounds.y + bounds.height * .6)
        await page.mouse.down()
        await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .85, { steps: 8 })
        await page.mouse.up()
      }
      async function screenshot(name) {
        if (!screenshotDir) return
        await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); await new Promise(requestAnimationFrame) })
        await page.screenshot({ path: `${screenshotDir}/${name}-${device}-${theme}.png`, fullPage: true })
      }
      await draw()
      assert.equal(await filter.locator('.ui-chip').count(), 2, 'drawing retains both selected parts')
      await screenshot('draw')
      const drawOutput = await page.locator('textarea').first().inputValue()
      await filter.locator('.ui-chip').first().focus()
      await page.keyboard.press('Enter')
      assert.equal(await filter.locator('.ui-chip').count(), 1)
      assert.equal(await page.locator('textarea').first().inputValue(), drawOutput, 'Enter on a part control does not insert a character')
      assert.equal(await page.locator('.tools button').last().isDisabled(), false, 'Enter on a part control retains the drawing')
      await filter.locator('.ui-toolbar .ui-button').click()
      assert.equal(await filter.locator('.ui-chip').count(), 0)
      const result = page.locator('.draw > .results [role="option"]').nth(1)
      await result.waitFor()
      await result.focus()
      await page.keyboard.press('Enter')
      assert.notEqual(await page.locator('textarea').first().inputValue(), drawOutput, 'Enter on a focused candidate inserts it')

      await page.goto(new URL('/parts', base).href)
      const output = page.locator('textarea').first()
      const before = await output.inputValue()
      await page.locator('.parts > details.ui-card > summary').click()
      await draw()
      const candidates = page.locator('.component-mode .results .ui-tiles button')
      await candidates.first().waitFor()
      const disclosure = page.locator('.parts > details.ui-card > summary')
      await disclosure.click()
      await disclosure.click()
      await candidates.first().waitFor()
      assert.equal(await page.locator('.component-mode canvas').count(), 1, 'reopening retains one drawing pad')
      await screenshot('parts')
      await candidates.first().click()
      assert.equal(await page.locator('.chosen .partwrap').count(), 1)
      assert.equal(await output.inputValue(), before, 'picking a drawn part does not insert text')
      assert.ok(new URL(page.url()).searchParams.get('q'), 'the chosen component is reflected in the parts query')
      assert.equal(await candidates.count(), 0, 'the component drawing clears after selection')
      await page.locator('.chosen .part').first().click()
      assert.equal(await page.locator('.chosen .partwrap').count(), 0)
      console.log(`PASS reciprocal handwriting/parts ${device} ${theme}`)
      await context.close()
    }
  }
} finally {
  await browser.close()
}

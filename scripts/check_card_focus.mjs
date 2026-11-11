// bun run build:app && bun scripts/check_card_focus.mjs [screenshot-dir]
// Serve built assets through Playwright routing; no server is needed.
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const dist = new URL('../dist/', import.meta.url).pathname
const out = process.argv[2] ?? '/tmp/tangut-card-focus'
const origin = 'http://tangut.test'
const cache = join(homedir(), '.cache/ms-playwright')
const executablePath = process.env.CHROMIUM_PATH ?? readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()
  .flatMap(name => ['chrome-linux64/chrome', 'chrome-linux/chrome'].map(file => join(cache, name, file))).find(existsSync)
assert.ok(executablePath, 'Chromium must be installed')
const browser = await chromium.launch({ executablePath })
const errors = []
await mkdir(out, { recursive: true })
try {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme })
    await context.route(`${origin}/**`, async route => {
      let file = join(dist, decodeURIComponent(new URL(route.request().url()).pathname))
      if (!existsSync(file) || !extname(file)) file = join(dist, 'index.html')
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.gz': 'application/gzip', '.png': 'image/png', '.webp': 'image/webp' }
      await route.fulfill({ body: await readFile(file), contentType: types[extname(file)] ?? 'application/octet-stream' })
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${origin}/?q=${encodeURIComponent('水')}&lang=en`)
    const trigger = page.locator('.finder .ui-tile').first()
    await trigger.waitFor()
    await trigger.focus()
    await page.evaluate(() => {
      window.cardTransitions = []
      document.addEventListener('transitionrun', event => {
        if (event.target.matches('dialog.card')) window.cardTransitions.push(event.propertyName)
      })
    })
    await trigger.press('Enter')
    const card = page.locator('dialog.card')
    const close = card.getByRole('button', { name: 'Close', exact: true })
    const settle = () => card.evaluate(node => Promise.allSettled(node.getAnimations().map(animation => animation.finished)))
    await close.waitFor()
    await settle()
    assert.ok(await page.evaluate(() => window.cardTransitions.includes('transform')), 'Opening slides the sheet into view')
    assert.equal(await card.evaluate(node => node.matches(':modal')), true)
    assert.equal(await close.evaluate(node => node === document.activeElement), true, 'Focus enters the sheet')
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: join(out, `phone-${colorScheme}.png`) })

    // Lengthen the transition so assertions observe the exit rather than racing its 160ms duration.
    await card.evaluate(node => node.style.setProperty('--ui-duration', '600ms'))
    // Closing keeps the native modal and focus containment until the slide finishes.
    await close.click()
    await page.waitForFunction(() => document.querySelector('dialog.card')?.hasAttribute('data-closing'))
    assert.equal(await card.evaluate(node => node.matches(':modal')), true, 'Exit remains modal')
    assert.equal(await close.evaluate(node => node === document.activeElement), true, `Exit retains focus: ${await page.evaluate(() => document.activeElement?.outerHTML)}`)
    assert.equal(await card.evaluate(node => node.getAnimations().some(animation => animation.transitionProperty === 'transform')), true, 'Closing slides the sheet out')
    await trigger.evaluate(node => node.focus())
    assert.equal(await close.evaluate(node => node === document.activeElement), true, 'Background stays inert during exit')
    // An in-dialog character choice can reopen the sheet while it is sliding out.
    await card.locator('button.inline.ui-script').first().evaluate(node => node.click())
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.hasAttribute('data-closing'))
    await settle()
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)))
    assert.equal(await card.evaluate(node => node.matches(':modal')), true, 'An interrupted exit cannot close the reopened sheet')
    assert.equal(await card.evaluate(node => getComputedStyle(node).transform), 'none', 'Reopened sheet returns to rest')
    await card.evaluate(node => node.style.removeProperty('--ui-duration'))
    await close.focus()

    // The browser prevents programmatic focus and hides background content from its accessibility tree.
    await trigger.evaluate(node => node.focus())
    assert.equal(await close.evaluate(node => node === document.activeElement), true, 'Background cannot receive focus')
    const cdp = await context.newCDPSession(page)
    const documentNode = await cdp.send('DOM.getDocument')
    const background = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '.finder .ui-tile' })
    const tree = await cdp.send('Accessibility.getPartialAXTree', { nodeId: background.nodeId })
    assert.equal(tree.nodes[0].ignored, true, 'Background is absent from the accessibility tree')
    await cdp.detach()
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press(i < 60 ? 'Tab' : 'Shift+Tab')
      assert.equal(await page.evaluate(() => document.activeElement === document.body || document.querySelector('dialog.card')?.contains(document.activeElement)), true, 'Tab does not enter the background')
    }
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.open)
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Escape restores the opener')

    // Simulate browsers that dispatch a tap click without first focusing the button.
    await page.locator('[data-primary]').focus()
    await trigger.dispatchEvent('click')
    await close.waitFor()
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.open)
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'An unfocused click restores its actual opener')

    await trigger.press('Enter')
    await close.waitFor()
    // The radical link is replaced as the selected character changes.
    const oldCode = await card.locator('button.cp').textContent()
    await card.locator('button.inline.ui-script').first().focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(code => document.querySelector('dialog.card button.cp')?.textContent !== code, oldCode)
    await page.waitForFunction(() => document.querySelector('dialog.card')?.contains(document.activeElement))
    assert.equal(await card.evaluate(node => node.matches(':modal')), true, 'Character navigation retains the modal')
    await close.click()
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.open)
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Close restores the original opener after navigation')

    await trigger.press('Enter')
    await close.waitFor()
    await settle()
    const bar = await card.locator('.sheetbar').boundingBox()
    assert.ok(bar)
    const x = bar.x + bar.width / 2
    const y = bar.y + bar.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 40, { steps: 5 })
    await page.mouse.up()
    assert.equal(await card.evaluate(node => node.getAnimations().some(animation => animation.transitionProperty === 'transform')), true, 'A short swipe animates back')
    await settle()
    assert.equal(await card.evaluate(node => getComputedStyle(node).transform), 'none', 'The sheet returns to its resting position')
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 100, { steps: 5 })
    assert.match(await card.evaluate(node => node.style.transform), /translateY\(100px\)/, 'The sheet follows the pointer')
    await page.mouse.up()
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.open)
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Swipe restores focus')

    await trigger.press('Enter')
    await close.waitFor()
    await settle()
    // A press that starts inside must not turn into a backdrop dismissal.
    const cardBox = await card.boundingBox()
    assert.ok(cardBox)
    await page.mouse.move(10, cardBox.y + cardBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(10, 10)
    await page.mouse.up()
    assert.equal(await card.evaluate(node => node.matches(':modal')), true, 'Dragging from the sheet does not dismiss it')
    await page.mouse.click(10, 10)
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.open)
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Backdrop restores focus')

    await trigger.press('Enter')
    await close.waitFor()
    await page.setViewportSize({ width: 901, height: 844 })
    await page.locator('aside.card').waitFor()
    assert.equal(await page.locator('dialog.card:modal').count(), 0, 'Wide card is nonmodal')
    await trigger.focus()
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Wide background remains interactive')
    await page.setViewportSize({ width: 900, height: 844 })
    await page.waitForFunction(() => !!document.querySelector('dialog.card') && !document.querySelector('dialog.card').open)
    await trigger.focus()
    await trigger.press('Enter')
    await close.waitFor()
    assert.equal(await card.evaluate(node => node.matches(':modal')), true, 'Phone mode reopens modally')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.open)

    await page.goto(`${origin}/?c=172FD&lang=en`)
    await page.locator('dialog.card:modal').waitFor()
    await page.waitForFunction(() => document.querySelector('dialog.card')?.contains(document.activeElement))
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.open)

    // Leaving a card page via history clears the sheet before another modal can open.
    await page.goto(`${origin}/about?lang=en`)
    await page.locator('.tabs a[href="/"]').click()
    await page.locator('[data-primary]').fill('水')
    await trigger.waitFor()
    await trigger.click()
    await close.waitFor()
    await page.goBack()
    await page.locator('main.finder').waitFor()
    await page.locator('button[aria-label="Settings"]').click()
    await page.locator('dialog.settings-sheet:modal').waitFor()
    await page.goForward()
    await page.locator('dialog.card').waitFor({ state: 'attached' })
    assert.equal(await card.evaluate(node => node.open), false, 'History does not reopen a stale card over settings')
    assert.equal(await page.locator('dialog.settings-sheet:modal').count(), 1)
    await page.keyboard.press('Escape')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await trigger.focus()
    await trigger.press('Enter')
    await close.waitFor()
    assert.ok(await card.evaluate(node => parseFloat(getComputedStyle(node).transitionDuration) < 0.001), 'Reduced motion skips the slide')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog.card')?.open)
    assert.equal(await card.evaluate(node => node.getAnimations().some(animation => animation.transitionProperty === 'transform')), false, 'Reduced motion skips exit animation')
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Reduced-motion close restores focus')
    await context.close()
  }
  assert.deepEqual(errors, [], 'No browser errors')
  console.log(`Card focus checks passed; screenshots in ${out}`)
} finally {
  await browser.close()
}

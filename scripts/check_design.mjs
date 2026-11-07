// Checks the design system and the pages built on it in a real browser: accessible names, keyboard
// operation, focus rings, measured contrast, target sizes, the theme switch, reduced motion,
// forced colours, and a visit to every page at a desktop and a phone width.
//
//   DESIGN_URL=http://localhost:5180/design.html bun scripts/check_design.mjs
//   DESIGN_SHOTS=docs/design/check bun scripts/check_design.mjs
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DESIGN = process.env.DESIGN_URL ?? 'http://localhost:5180/design.html'
const APP = new URL('/', DESIGN).href.replace(/\/$/, '')
const SHOTS = process.env.DESIGN_SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

function browserPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const cache = join(homedir(), '.cache/ms-playwright')
  for (const dir of readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()) {
    for (const tail of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const path = join(cache, dir, tail)
      if (existsSync(path)) return path
    }
  }
  throw new Error('No Chromium under ~/.cache/ms-playwright; set CHROMIUM_PATH')
}

const browser = await chromium.launch({ executablePath: browserPath() })
let passed = 0
const failed = []

/** @param {string} name @param {() => Promise<void>} check */
async function step(name, check) {
  try {
    await check()
    passed++
    console.log('PASS', name)
  } catch (error) {
    failed.push({ name, error })
    console.log('FAIL', name, `\n  ${error.message.split('\n').join('\n  ')}`)
  }
}

/** Colour arithmetic as the screen resolves it, and the WCAG ratio between two colours. */
function colourHelpers() {
  /** @param {string} value @returns {[number, number, number, number] | null} */
  const parse = value => {
    const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/)
    if (!match) return null
    const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? parseFloat(match[4]) / 100 : Number(match[4])
    return [Number(match[1]), Number(match[2]), Number(match[3]), alpha]
  }
  const over = (top, below) => top.slice(0, 3).map((c, i) => c * top[3] + below[i] * (1 - top[3]))
  /** @param {Element} el */
  const backdrop = el => {
    const layers = []
    for (let node = el; node; node = node.parentElement ?? node.getRootNode()?.host ?? null) {
      const style = getComputedStyle(node)
      if (style.backgroundImage !== 'none') return null
      const fill = parse(style.backgroundColor)
      if (fill && fill[3] > 0) layers.push(fill)
      if (fill && fill[3] >= 1) break
    }
    let colour = [255, 255, 255]
    for (const layer of layers.reverse()) colour = over(layer, colour)
    return colour
  }
  const luminance = rgb => {
    const [r, g, b] = rgb.map(value => {
      const c = value / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (foreground, behind) => {
    const fg = parse(foreground)
    if (!fg || !behind) return 0
    const [light, dark] = [luminance(over(fg, behind)), luminance(behind)].sort((a, b) => b - a)
    return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
  }
  Object.assign(window, { __colour: { parse, backdrop, ratio } })
}

/**
 * @param {{ scheme?: 'light' | 'dark', reducedMotion?: 'reduce' | 'no-preference', forcedColors?: 'active' | 'none' }} [options]
 * @returns {Promise<{ context: import('playwright-core').BrowserContext, page: import('playwright-core').Page }>}
 */
async function openDesign(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1180, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: options.scheme ?? 'light',
    reducedMotion: options.reducedMotion ?? 'no-preference',
    forcedColors: options.forcedColors ?? 'none',
  })
  await context.addInitScript(colourHelpers)
  const page = await context.newPage()
  page.errors = []
  page.on('pageerror', error => page.errors.push(error.message))
  await page.goto(DESIGN, { waitUntil: 'domcontentloaded' })
  await page.locator('h1').waitFor({ timeout: 30000 })
  await page.waitForFunction(() => document.querySelectorAll('.swatch-score[data-pass]').length > 0)
  await page.waitForTimeout(150)
  return { context, page }
}

/** Every visible control has a name a screen reader can announce. @param {import('playwright-core').Page} page */
async function checkNames(page) {
  const unnamed = await page.evaluate(() => {
    const hasName = el => {
      if (el.getAttribute('aria-label')?.trim()) return true
      const refs = el.getAttribute('aria-labelledby')
      if (refs?.split(/\s+/).some(id => document.getElementById(id)?.textContent?.trim())) return true
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim()) return true
      if (el.closest('label')?.textContent?.trim()) return true
      if (el.getAttribute('title')?.trim()) return true
      if (el.matches('button, [role="button"]') && el.textContent?.trim()) return true
      return false
    }
    return [...document.querySelectorAll('input, select, textarea, button')]
      .filter(el => !(/** @type {HTMLInputElement} */ (el).disabled) && el.getClientRects().length > 0 && !hasName(el))
      .map(el => el.outerHTML.slice(0, 160))
  })
  assert.deepEqual(unnamed, [], `controls without a name:\n${unnamed.join('\n')}`)
}

/** Keyboard: Space on a checkbox and a switch, arrows in a segmented control, one visible ring. @param {import('playwright-core').Page} page */
async function checkKeyboard(page) {
  const checkbox = page.getByLabel('Include empty slots', { exact: true })
  await checkbox.focus()
  const checked = await checkbox.isChecked()
  await page.keyboard.press('Space')
  assert.equal(await checkbox.isChecked(), !checked, 'Space toggles a checkbox')
  await page.keyboard.press('Space')

  const toggle = page.getByRole('switch', { name: 'Follow the system theme', exact: true })
  await toggle.focus()
  const on = await toggle.isChecked()
  await page.keyboard.press('Space')
  assert.equal(await toggle.isChecked(), !on, 'Space toggles a switch')
  await page.keyboard.press('Space')

  const first = page.getByRole('radio', { name: 'By rhyme', exact: true })
  await first.focus()
  await page.keyboard.press('ArrowRight')
  const second = page.getByRole('radio', { name: 'By fanqie', exact: true })
  assert.equal(await second.isChecked(), true, 'ArrowRight moves a segmented control')
  assert.equal(await second.evaluate(el => el === document.activeElement), true, 'focus follows the segment')
  const ring = await second.evaluate(el => {
    const face = el.nextElementSibling
    const style = getComputedStyle(face)
    return { visible: el.matches(':focus-visible'), style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
  })
  assert.equal(ring.visible, true, 'a focused segment matches :focus-visible')
  assert.equal(ring.style, 'solid', 'the segment draws a ring on its face')
  assert.ok(ring.width >= 2, `the segment ring is 2px or more (${ring.width})`)

  await checkbox.focus()
  const control = await checkbox.evaluate(el => {
    const style = getComputedStyle(el)
    return {
      visible: el.matches(':focus-visible'),
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      offset: parseFloat(style.outlineOffset),
    }
  })
  assert.equal(control.visible, true, 'a focused control matches :focus-visible')
  assert.equal(control.style, 'solid', 'the focus ring is drawn')
  assert.ok(control.width >= 2 && control.offset >= 1, `the ring is at least 2px with an offset (${control.width}, ${control.offset})`)
}

/** The palette in the page reports every token's measured ratio. @param {import('playwright-core').Page} page */
async function checkPalette(page) {
  const measured = await page.evaluate(() => [...document.querySelectorAll('.swatch')].map(figure => ({
    ratio: Number(figure.dataset.ratio),
    threshold: Number(figure.dataset.threshold),
    name: figure.querySelector('.swatch-name')?.textContent ?? '',
  })))
  assert.ok(measured.length >= 20, `expected the palette, found ${measured.length} swatches`)
  const below = measured.filter(item => item.threshold > 1 && item.ratio < item.threshold)
  assert.deepEqual(below, [], `tokens below target:\n${below.map(item => `${item.name}: ${item.ratio}:1 < ${item.threshold}:1`).join('\n')}`)
}

/** Text and control boundaries in the page, as the browser paints them. @param {import('playwright-core').Page} page */
async function checkContrast(page) {
  // A mouse click leaves the page in pointer modality; Tab restores the keyboard's focus ring.
  await page.keyboard.press('Tab')
  const results = await page.evaluate(() => {
    const { parse, backdrop, ratio } = window.__colour
    const text = (selector, threshold, against) => {
      const el = document.querySelector(selector)
      if (!el) return { name: selector, ratio: 0, threshold, missing: true }
      const fg = getComputedStyle(el).color
      const bg = against ?? backdrop(el)
      return { name: selector, ratio: ratio(fg, bg), threshold }
    }
    return [
      text('body', 4.5),
      text('.ui-label', 4.5),
      text('.ui-hint', 4.5),
      text('.ui-button', 4.5),
      text('.ui-button[data-variant="primary"]', 4.5),
      text('.ui-button[data-variant="toast"]', 4.5),
      text('.ui-chip[aria-pressed="true"]', 4.5),
      text('.ui-error', 4.5),
      text('.ui-tag', 4.5),
      text('.ui-formula', 4.5),
      text('.ui-table td', 4.5),
      text('.ui-table thead th', 4.5),
      { name: 'input boundary', threshold: 3, ratio: (() => {
        const el = document.querySelector('.ui-input')
        return el ? ratio(getComputedStyle(el).borderTopColor, backdrop(el.parentElement)) : 0
      })() },
      { name: 'focus ring', threshold: 3, ratio: (() => {
        const el = document.querySelector('.ui-checkbox')
        if (!el) return 0
        el.focus()
        return ratio(getComputedStyle(el).outlineColor, backdrop(el.parentElement))
      })() },
      { name: 'checkbox mark', threshold: 4.5, ratio: (() => {
        const el = document.querySelector('.ui-checkbox:checked')
        if (!el) return 0
        return ratio(getComputedStyle(el, '::before').borderRightColor, parse(getComputedStyle(el).backgroundColor)?.slice(0, 3) ?? [0, 0, 0])
      })() },
    ]
  })
  const below = results.filter(item => item.missing || item.ratio < item.threshold)
  assert.deepEqual(below, [], `contrast below target:\n${below.map(item => `${item.name}: ${item.ratio}:1 < ${item.threshold}:1`).join('\n')}`)
}

/** Every control meets the 24px target. @param {import('playwright-core').Page} page */
async function checkTargets(page) {
  const small = await page.evaluate(() => [...document.querySelectorAll(
    '.ui-button, .ui-chip, .ui-input, .ui-select, .ui-textarea, .ui-check-row, .ui-switch, .ui-segment',
  )]
    .filter(el => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && rect.height < 24
    })
    .map(el => `${el.className.split(' ')[0]}: ${Math.round(el.getBoundingClientRect().height)}px`))
  assert.deepEqual(small, [], `targets under 24px:\n${small.join('\n')}`)
}

/**
 * The theme control changes the palette and returns to the system scheme.
 * @param {import('playwright-core').Page} page @param {'light' | 'dark'} scheme
 */
async function checkTheme(page, scheme) {
  // The palette tests leave another palette chosen; the paper canvas is the one named below.
  await page.getByRole('radio', { name: 'Paper', exact: true }).click()
  await page.waitForTimeout(80)
  const other = scheme === 'light' ? 'Dark' : 'Light'
  await page.getByRole('radio', { name: other, exact: true }).click()
  await page.waitForTimeout(120)
  const changed = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    background: getComputedStyle(document.body).backgroundColor,
  }))
  assert.equal(changed.theme, scheme === 'light' ? 'dark' : 'light', 'the control sets data-theme')
  assert.equal(changed.background, scheme === 'light' ? 'rgb(20, 18, 16)' : 'rgb(244, 239, 229)', 'the palette follows the chosen scheme')
  await page.getByRole('radio', { name: 'System', exact: true }).click()
  await page.waitForTimeout(120)
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme ?? ''), '', 'System removes data-theme')
  // Leave the site's own palette selected for the screenshot and the rest of the run.
  await page.getByRole('radio', { name: 'Paper', exact: true }).click()
  await page.waitForTimeout(80)
}

/** A page never scrolls sideways: wide tables scroll inside their own frame. @param {import('playwright-core').Page} page */
async function noSideScroll(page) {
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: window.innerWidth }))
  assert.ok(overflow.scroll <= overflow.view + 1, `the page scrolls sideways (${overflow.scroll} > ${overflow.view})`)
}

const PAGES = ['/', '/meaning?q=water', '/cangjie?q=pa', '/sijiao?q=123', '/reading?q=do1', '/fanqie', '/chart', '/eras', '/texts', '/texts?q=wikisource-tongyin-preface', '/gyalrongic', '/transcribe?q=%F0%97%8B%95%F0%98%8F%A8%F0%98%9C%B6', '/draw', '/parts', '/variants', '/intro', '/about']

/** Visits every page at one viewport and checks it renders without script errors or side scroll. */
async function checkPages(viewport, scheme) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: scheme })
  const page = await context.newPage()
  /** @type {string[]} */
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const path of PAGES) {
    await page.goto(APP + path, { waitUntil: 'networkidle' })
    await page.locator('main.finder').waitFor({ timeout: 30000 })
    await page.waitForTimeout(150)
    await noSideScroll(page)
    const unnamed = await page.evaluate(() => {
      const hasName = el => {
        if (el.getAttribute('aria-label')?.trim()) return true
        const refs = el.getAttribute('aria-labelledby')
        if (refs?.split(/\s+/).some(id => document.getElementById(id)?.textContent?.trim())) return true
        if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim()) return true
        if (el.closest('label')?.textContent?.trim()) return true
        if (el.getAttribute('title')?.trim()) return true
        if (el.matches('button, [role="button"]') && el.textContent?.trim()) return true
        return false
      }
      return [...document.querySelectorAll('input, select, textarea, button')]
        .filter(el => !(/** @type {HTMLInputElement} */ (el).disabled) && el.getClientRects().length > 0 && !hasName(el))
        .map(el => el.outerHTML.slice(0, 140))
    })
    assert.deepEqual(unnamed, [], `${path}: controls without a name:\n${unnamed.join('\n')}`)
    const small = await page.evaluate(() => {
      const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
      return [...document.querySelectorAll('button, input, select, textarea, a[href], [role="button"]')]
        .filter(el => visible(el) && !(/** @type {HTMLInputElement} */ (el).disabled))
        .filter(el => !(el.matches('a') && getComputedStyle(el).display === 'inline'))
        .filter(el => !(el.matches('input[type="checkbox"], input[type="radio"]') && el.closest('label')))
        .filter(el => !el.matches('.inline'))
        .filter(el => {
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && (rect.height < 24 || rect.width < 24)
        })
        .map(el => `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} ${el.tagName.toLowerCase()}.${typeof el.className === 'string' ? el.className.split(' ')[0] : ''}`)
    })
    assert.deepEqual(small, [], `${path}: targets under 24px:\n${small.join('\n')}`)
  }
  await context.close()
  assert.deepEqual(errors, [], `script errors:\n${errors.join('\n')}`)
}

const LIGHT = await openDesign({ scheme: 'light' })
await step('design page renders without script errors', async () => {
  assert.deepEqual(LIGHT.page.errors, [])
})
await step('every control has an accessible name', () => checkNames(LIGHT.page))
await step('the palette clears its contrast targets', () => checkPalette(LIGHT.page))
await step('text and control boundaries clear their targets', () => checkContrast(LIGHT.page))
await step('every palette clears its contrast targets', async () => {
  for (const [label, key] of [['Paper', 'paper'], ['Yulin', 'mineral'], ['Indigo', 'indigo'], ['Khara', 'sand']]) {
    await LIGHT.page.getByRole('radio', { name: label, exact: true }).click()
    await LIGHT.page.waitForTimeout(80)
    assert.equal(await LIGHT.page.evaluate(() => document.documentElement.dataset.palette), key, `${label} sets data-palette`)
    await checkPalette(LIGHT.page)
    await checkContrast(LIGHT.page)
  }
})
await step('keyboard reaches and operates every control', () => checkKeyboard(LIGHT.page))
await step('every control meets the 24px target', () => checkTargets(LIGHT.page))
await step('the theme control changes the palette', () => checkTheme(LIGHT.page, 'light'))
if (SHOTS) await LIGHT.page.screenshot({ path: join(SHOTS, 'design-light.png'), fullPage: true })
await LIGHT.context.close()

const DARK = await openDesign({ scheme: 'dark' })
await step('the palette clears its targets in the dark scheme', () => checkPalette(DARK.page))
await step('every palette clears its targets in the dark scheme', async () => {
  for (const [label, key] of [['Paper', 'paper'], ['Yulin', 'mineral'], ['Indigo', 'indigo'], ['Khara', 'sand']]) {
    await DARK.page.getByRole('radio', { name: label, exact: true }).click()
    await DARK.page.waitForTimeout(80)
    assert.equal(await DARK.page.evaluate(() => document.documentElement.dataset.palette), key, `${label} sets data-palette in dark`)
    await checkPalette(DARK.page)
    await checkContrast(DARK.page)
  }
})
await step('text and boundaries clear their targets in the dark scheme', () => checkContrast(DARK.page))
if (SHOTS) await DARK.page.screenshot({ path: join(SHOTS, 'design-dark.png'), fullPage: true })
await DARK.context.close()

const PHONE = await openDesign({ scheme: 'light' })
await PHONE.page.setViewportSize({ width: 390, height: 844 })
await step('the design page does not scroll sideways on a phone', () => noSideScroll(PHONE.page))
await PHONE.context.close()

const REDUCED = await openDesign({ reducedMotion: 'reduce' })
await step('reduced motion collapses transitions', async () => {
  const duration = await REDUCED.page.locator('.ui-button').first().evaluate(el => getComputedStyle(el).transitionDuration)
  const seconds = Math.max(...duration.split(',').map(value => parseFloat(value)))
  assert.ok(seconds <= 0.02, `a button still transitions for ${duration}`)
})
await REDUCED.context.close()

const FORCED = await openDesign({ forcedColors: 'active' })
await step('forced colours keep the controls visible', async () => {
  const state = await FORCED.page.evaluate(() => {
    const box = document.querySelector('.ui-checkbox')
    const button = document.querySelector('.ui-button[data-variant="primary"]')
    if (!box || !button) return null
    return {
      border: getComputedStyle(box).borderTopStyle,
      button: getComputedStyle(button).backgroundColor,
    }
  })
  assert.ok(state, 'the controls exist')
  assert.notEqual(state.border, 'none', 'a checkbox keeps a border')
  assert.notEqual(state.button, 'rgba(0, 0, 0, 0)', 'a primary button keeps a fill')
})
await FORCED.context.close()

await step('every page renders at 1440 in the light scheme', () => checkPages({ width: 1440, height: 1000 }, 'light'))
await step('every page renders at 390 in the dark scheme', () => checkPages({ width: 390, height: 844 }, 'dark'))

await step('Backspace in the code box takes a selection and nothing else', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.goto(`${APP}/cangjie`)
  await page.evaluate(() => localStorage.setItem('tangut-input:text', '\u{17000}\u{17001}\u{17002}'))
  await page.reload()
  await page.locator('#writing').evaluate(field => { field.focus(); field.setSelectionRange(2, 4); field.dispatchEvent(new Event('select')) })
  await page.locator('[data-primary]').focus()
  await page.keyboard.press('Backspace')
  assert.equal(await page.evaluate(() => localStorage.getItem('tangut-input:text')), '\u{17000}\u{17002}')
  await context.close()
})

const SETTINGS = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' })
const settings = await SETTINGS.newPage()
await settings.goto(`${APP}/`)
await settings.locator('main.finder').waitFor()
await step('the app settings change the scheme, theme, face and language', async () => {
  const trigger = settings.locator('.settings > button')
  await trigger.click()
  const pop = settings.locator('.settings-pop')
  await pop.waitFor()
  await settings.waitForFunction(() => document.activeElement?.getAttribute('value') === 'auto')
  assert.equal(await settings.evaluate(() => document.activeElement?.getAttribute('value')), 'auto', 'the popover opens on the theme choice')
  assert.equal(await pop.getByRole('heading', { name: 'Appearance' }).count(), 1, 'the appearance group is named')
  assert.equal(await pop.getByRole('heading', { name: 'Text' }).count(), 1, 'the text group is named')
  assert.equal(await pop.getByRole('radio').count(), 3, 'the theme is one group of three choices')
  const names = await settings.locator('input[type="radio"]').evaluateAll(inputs => inputs.map(input => /** @type {HTMLInputElement} */ (input).name))
  assert.equal(new Set(names).size, 2, 'the popover and the sheet keep separate theme groups')
  assert.equal(names.filter(name => name === names[0]).length, 3, 'each theme group holds three choices')
  const palette = pop.locator('.palette-trigger')
  await palette.click()
  const list = pop.getByRole('listbox', { name: 'Palette' })
  await list.waitFor()
  assert.equal(await list.getByRole('option').count(), 4, 'the palette lists four schemes')
  assert.equal(await list.locator('.palette-preview').count(), 4, 'each scheme carries a preview')
  await settings.keyboard.press('ArrowDown')
  await settings.keyboard.press('Enter')
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.palette), 'mineral', 'the arrow keys and Enter choose a palette')
  await palette.click()
  await list.getByRole('option', { name: 'Indigo' }).click()
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.palette), 'indigo', 'the palette option sets data-palette')
  await palette.click()
  await list.waitFor()
  await settings.keyboard.press('Escape')
  await list.waitFor({ state: 'hidden' })
  assert.equal(await palette.evaluate(el => el === document.activeElement), true, 'Escape closes the palette and returns focus')
  await pop.getByRole('radio', { name: 'Dark theme' }).check()
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.theme), 'dark', 'the theme choice sets data-theme')
  await settings.keyboard.press('Escape')
  await pop.waitFor({ state: 'hidden' })
  await trigger.click()
  await pop.waitFor()
  await settings.waitForFunction(() => document.activeElement?.getAttribute('value') === 'dark')
  assert.equal(await settings.evaluate(() => document.activeElement?.getAttribute('value')), 'dark', 'the popover opens on the chosen theme')
  await pop.getByRole('radio', { name: 'Theme follows the system' }).check()
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.theme), undefined, 'the system choice clears data-theme')
  await settings.keyboard.press('ArrowRight')
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.theme), 'light', 'the arrow keys move the checked theme choice')
  await settings.keyboard.press('ArrowRight')
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.theme), 'dark', 'the arrow keys reach the last choice')
  await settings.keyboard.press('ArrowRight')
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.theme), undefined, 'the arrow keys wrap to the system choice')
  await settings.keyboard.press('ArrowLeft')
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.theme), 'dark', 'the arrow keys wrap back past the first choice')
  await pop.getByRole('radio', { name: 'Theme follows the system' }).check()
  await pop.locator('select').nth(1).selectOption('yinchuan')
  assert.equal(await settings.evaluate(() => document.documentElement.dataset.tangut), 'yinchuan', 'the face select sets data-tangut')
  await settings.locator('main.finder').click({ position: { x: 10, y: 10 } })
  await pop.waitFor({ state: 'hidden' })
  await trigger.click()
  await pop.waitFor()
  await pop.locator('select').last().focus()
  await settings.keyboard.press('Tab')
  await pop.waitFor({ state: 'hidden' })
  await trigger.click()
  await pop.waitFor()
  await pop.locator('select').nth(0).selectOption('ja')
  assert.equal(await settings.evaluate(() => document.documentElement.lang), 'ja', 'the language select sets the document language')
  await settings.keyboard.press('Escape')
  await pop.waitFor({ state: 'hidden' })
  assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Escape returns focus to the settings button')
})
await SETTINGS.close()

await step('the input method takes the digits of a code and picks after letters', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.goto(`${APP}/`)
  await page.evaluate(() => { localStorage.setItem('tangut-input:text', ''); localStorage.setItem('tangut-input:recent', JSON.stringify(['\u{17001}'])) })
  await page.reload()
  const text = () => page.evaluate(() => localStorage.getItem('tangut-input:text'))
  await page.locator('.ime button').first().click()
  const box = page.locator('.ime input')
  await box.pressSequentially('U+17001')
  assert.equal(await box.inputValue(), 'U+17001')
  await box.fill('')
  await box.pressSequentially('u17001')
  assert.equal(await box.inputValue(), 'u17001')
  await box.fill('')
  await box.pressSequentially('10')
  assert.equal(await box.inputValue(), '10')
  assert.equal(await text(), '')
  await box.fill('msb')
  await page.keyboard.press('1')
  assert.notEqual(await text(), '', 'a digit picks after a Cangjie code')
  await context.close()
})

const TABLET_SETTINGS = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: 'light' })
const tablet = await TABLET_SETTINGS.newPage()
await tablet.goto(`${APP}/`)
await tablet.locator('main.finder').waitFor()
await step('the tablet bar has two rows and settings closes when the layout changes', async () => {
  assert.equal(await tablet.evaluate(() => Math.round(document.querySelector('.top').getBoundingClientRect().height)), 96, 'the tablet bar takes two rows')
  const trigger = tablet.locator('.settings > button')
  await trigger.click()
  await tablet.locator('.settings-pop').waitFor()
  await tablet.setViewportSize({ width: 390, height: 844 })
  await tablet.locator('.settings-pop').waitFor({ state: 'hidden' })
  await tablet.waitForFunction(() => document.querySelector('.settings > button')?.getAttribute('aria-expanded') === 'false')
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'the trigger is closed after the breakpoint change')
  await trigger.click()
  await tablet.locator('.settings-sheet').waitFor({ state: 'visible' })
  await tablet.keyboard.press('Escape')
  await tablet.locator('.settings-sheet').waitFor({ state: 'hidden' })
})
await TABLET_SETTINGS.close()

const DESKTOP_BAR = await browser.newContext({ viewport: { width: 1920, height: 900 }, colorScheme: 'light' })
const desktopBar = await DESKTOP_BAR.newPage()
await desktopBar.goto(`${APP}/`)
await desktopBar.locator('main.finder').waitFor()
await step('the introduction has its own place in the desktop bar', async () => {
  const navIntro = desktopBar.locator('nav.finders a[href="/intro"]')
  const headerIntro = desktopBar.locator('.intro-extra')
  const layout = () => desktopBar.evaluate(() => {
    const nav = document.querySelector('nav.finders')
    const navLink = nav?.querySelector('a[href="/intro"]')
    const extra = document.querySelector('.intro-extra')
    const header = document.querySelector('.top')
    const navRect = nav?.getBoundingClientRect()
    const navLinkRect = navLink?.getBoundingClientRect()
    const extraRect = extra?.getBoundingClientRect()
    const headerRect = header?.getBoundingClientRect()
    const shown = el => Boolean(el && el.getClientRects().length && getComputedStyle(el).display !== 'none')
    return {
      bar: Math.round(headerRect?.height ?? 0),
      navShown: shown(navLink),
      navFits: Boolean(shown(navLink) && navLinkRect && navRect && navLinkRect.right <= navRect.left + nav.clientWidth + 1),
      extraShown: shown(extra),
      extraFits: Boolean(shown(extra) && extraRect && headerRect && extraRect.right <= headerRect.right + 1),
    }
  })
  await desktopBar.goto(`${APP}/`)
  await desktopBar.locator('main.finder').waitFor()
  assert.deepEqual(await layout(), { bar: 54, navShown: true, navFits: true, extraShown: false, extraFits: false }, 'the bar keeps one row at 1920')
  await navIntro.click()
  await desktopBar.waitForURL(/\/intro$/)
  assert.equal(await navIntro.getAttribute('aria-current'), 'page', 'the introduction is marked as current')
  assert.equal(await desktopBar.locator('footer.foot a[href="/intro"]').count(), 0, 'the footer holds sources only')
  for (const [width, bar] of [[1719, 96], [1720, 54], [1440, 96], [1280, 96], [1279, 96], [1141, 96], [1140, 96], [1024, 96]]) {
    await desktopBar.setViewportSize({ width, height: 900 })
    await desktopBar.goto(`${APP}/`)
    await desktopBar.locator('main.finder').waitFor()
    const state = await layout()
    assert.equal(state.bar, bar, `the bar height at ${width}`)
    if (width >= 1280) {
      assert.equal(state.navShown, true, `the finder row carries the introduction at ${width}`)
      assert.equal(state.navFits, true, `the introduction fits the finder row at ${width}`)
      assert.equal(state.extraShown, false, `the first row has no duplicate at ${width}`)
    } else {
      assert.equal(state.navShown, false, `the finder row leaves the introduction at ${width}`)
      assert.equal(state.extraShown, true, `the first row carries the introduction at ${width}`)
      assert.equal(state.extraFits, true, `the introduction fits the first row at ${width}`)
    }
  }
  await desktopBar.goto(`${APP}/intro`)
  await desktopBar.locator('main.finder').waitFor()
  assert.equal(await headerIntro.getAttribute('aria-current'), 'page', 'the first-row introduction is marked as current')
})
await DESKTOP_BAR.close()

await step('a choice in the card stays while a code is typed', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.goto(`${APP}/cangjie`)
  await page.locator('[data-primary]').pressSequentially('msb')
  await page.waitForFunction(() => new URLSearchParams(location.search).has('c'))
  const before = new URL(page.url()).searchParams.get('c')
  await page.locator('aside.card .ui-tile, aside.card .inline').first().click()
  await page.waitForTimeout(200)
  assert.notEqual(new URL(page.url()).searchParams.get('c'), before)
  await context.close()
})

const PHONE_APP = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
const phone = await PHONE_APP.newPage()
await phone.goto(`${APP}/meaning?q=water`)
await phone.locator('main.finder').waitFor()
await step('the phone settings sheet opens and closes', async () => {
  const trigger = phone.getByRole('button', { name: 'Settings', exact: true })
  await trigger.click()
  const dialog = phone.locator('.settings-sheet')
  await dialog.waitFor({ state: 'visible' })
  assert.equal(await dialog.evaluate(el => /** @type {HTMLDialogElement} */ (el).open), true, 'the settings sheet is modal')
  const palette = dialog.locator('.palette-trigger')
  await palette.click()
  assert.equal(await dialog.getByRole('listbox', { name: 'Palette' }).isVisible(), true, 'the palette list opens inside the sheet')
  await dialog.getByRole('option', { name: 'Indigo' }).click()
  assert.equal(await phone.evaluate(() => document.documentElement.dataset.palette), 'indigo', 'the sheet palette applies')
  await palette.click()
  await dialog.getByRole('option', { name: 'Paper' }).click()
  assert.equal(await phone.evaluate(() => document.documentElement.dataset.palette), 'paper', 'the sheet palette resets')
  await dialog.getByRole('radio', { name: 'Dark theme' }).check()
  assert.equal(await phone.evaluate(() => document.documentElement.dataset.theme), 'dark', 'the sheet theme choice applies')
  await dialog.getByRole('radio', { name: 'Theme follows the system' }).check()
  assert.equal(await phone.evaluate(() => document.documentElement.dataset.theme), undefined, 'the sheet theme choice resets')
  await phone.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Escape returns focus to the settings button')
})
await step('a group tab opens its finders in a sheet that closes on Escape', async () => {
  const shape = phone.getByRole('button', { name: 'Shape', exact: true })
  await shape.focus()
  await shape.click()
  const dialog = phone.getByRole('dialog', { name: 'From a shape' })
  await dialog.waitFor()
  assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'focus moves into the sheet')
  assert.equal(await dialog.getByRole('link', { name: /^Cangjie/ }).count(), 1, 'the sheet lists the group finders')
  await phone.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await shape.evaluate(el => el === document.activeElement), true, 'Escape returns focus to the tab')
})
await step('a finder opened from the sheet keeps focus on the page', async () => {
  const shape = phone.getByRole('button', { name: 'Shape', exact: true })
  await shape.click()
  const dialog = phone.getByRole('dialog', { name: 'From a shape' })
  await dialog.waitFor()
  await dialog.getByRole('link', { name: /^Cangjie/ }).click()
  await phone.waitForURL(/\/cangjie/)
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await shape.getAttribute('aria-current'), 'true', 'the group is marked as current')
  assert.notEqual(await shape.evaluate(el => el === document.activeElement), true, 'focus stays with the page')
})
await step('Back closes the sheet', async () => {
  await phone.getByRole('button', { name: 'Shape', exact: true }).click()
  const dialog = phone.getByRole('dialog', { name: 'From a shape' })
  await dialog.waitFor()
  await phone.goBack()
  await phone.waitForURL(/\/meaning/)
  await dialog.waitFor({ state: 'hidden' })
})
await step('the More tab opens the rest of the site in a sheet', async () => {
  const more = phone.getByRole('button', { name: 'More', exact: true })
  await more.focus()
  await more.click()
  const dialog = phone.getByRole('dialog', { name: 'More' })
  await dialog.waitFor()
  assert.equal(await dialog.getByRole('link', { name: /^Sources/ }).count(), 1, 'the sheet links to Sources')
  await phone.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await more.evaluate(el => el === document.activeElement), true, 'Escape returns focus to the button')
})
await step('the card opens as a sheet on a phone', async () => {
  await phone.goto(`${APP}/?q=%F0%97%8B%95`)
  await phone.locator('main.finder').waitFor()
  await phone.locator('.ui-row-pick').first().click()
  const card = phone.locator('aside.card')
  await phone.waitForFunction(() => document.querySelector('aside.card')?.classList.contains('open'))
  assert.equal(await card.isVisible(), true, 'the card sheet is visible')
  await phone.locator('.sheetbar').getByRole('button', { name: 'Close', exact: true }).click()
  await phone.waitForFunction(() => !document.querySelector('aside.card')?.classList.contains('open'))
})
await step('a link to a character opens its card on a phone', async () => {
  await phone.goto(`${APP}/?c=17000`)
  await phone.locator('main.finder').waitFor({ state: 'attached' })
  await phone.waitForFunction(() => document.querySelector('aside.card')?.classList.contains('open'))
  assert.equal(await phone.locator('aside.card').isVisible(), true, 'the card sheet is visible')
  const closed = () => phone.evaluate(() => !document.querySelector('aside.card')?.classList.contains('open'))
  await phone.reload()
  await phone.locator('main.finder').waitFor({ state: 'attached' })
  assert.equal(await closed(), true, 'a reload does not reopen the sheet')
  await phone.goto(`${APP}/cangjie?q=msb&c=17E39`)
  await phone.locator('main.finder').waitFor({ state: 'attached' })
  assert.equal(await closed(), true, 'a finder keeps its page')
})
await PHONE_APP.close()

await step('the code boxes refuse what a code cannot hold', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  for (const [path, typed, kept] of [['cangjie', 'a;', 'a'], ['sijiao', '1x', '1']]) {
    await page.goto(`${APP}/${path}`)
    await page.locator('[data-primary]').pressSequentially(typed)
    assert.equal(await page.locator('[data-primary]').inputValue(), kept, path)
  }
  // A refused key leaves the caret where it was.
  const box = page.locator('[data-primary]')
  await page.goto(`${APP}/cangjie`)
  await box.fill('abcd')
  await box.evaluate(field => field.setSelectionRange(2, 2))
  await page.keyboard.type(';x')
  assert.equal(await box.inputValue(), 'abxcd')
  // A composition is read once, when it ends.
  await page.goto(`${APP}/sijiao`)
  await box.focus()
  const cdp = await context.newCDPSession(page)
  for (const text of ['1', '12', '12x']) await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length })
  await cdp.send('Input.insertText', { text: '12x' })
  await page.waitForFunction(() => new URLSearchParams(location.search).get('q') === '12')
  assert.equal(await box.inputValue(), '12')
  await context.close()
})

await step('the sponsor dialog offers both tips, OFUSE first in Japanese, and Escape closes it', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' })
  const sponsor = await context.newPage()
  for (const [lang, order] of [['en', ['Ko-fi', 'OFUSE']], ['ja', ['OFUSE', 'Ko-fi']]]) {
    await sponsor.goto(`${APP}/?lang=${lang}`, { waitUntil: 'load' })
    assert.equal(await sponsor.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('supporters.mkpo.li'))), false, 'a page view does not reach the supporters service')
    const trigger = sponsor.locator('button.sponsor')
    await trigger.click()
    const dialog = sponsor.locator('dialog.sponsor-dialog')
    await dialog.locator('.tip').first().waitFor()
    assert.deepEqual(await dialog.locator('.tip strong').allTextContents(), order)
    assert.equal(await dialog.locator('supporters-roll').count(), 1, 'the supporters roll is in the dialog')
    const isOpen = () => dialog.evaluate(element => /** @type {HTMLDialogElement} */ (element).open)
    const lead = /** @type {{ x: number, y: number }} */ (await dialog.locator('.lead').boundingBox())
    await sponsor.mouse.move(lead.x + 20, lead.y + 8)
    await sponsor.mouse.down()
    await sponsor.mouse.move(20, 500)
    await sponsor.mouse.up()
    assert.equal(await isOpen(), true, 'a selection dragged out of the box leaves it open')
    await sponsor.mouse.click(20, 500)
    assert.equal(await isOpen(), false, 'a click on the backdrop closes it')
    await trigger.click()
    await sponsor.keyboard.press('Escape')
    assert.equal(await isOpen(), false, 'Escape closes it')
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'focus returns to the button')
  }
  await context.close()
})

await step('an open sponsor dialog leaves the drawing behind it alone', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' })
  const draw = await context.newPage()
  await draw.goto(`${APP}/draw`, { waitUntil: 'load' })
  const canvas = draw.locator('canvas').first()
  await canvas.waitFor()
  const box = /** @type {{ x: number, y: number, width: number, height: number }} */ (await canvas.boundingBox())
  await draw.mouse.move(box.x + box.width * .2, box.y + box.height * .4)
  await draw.mouse.down()
  await draw.mouse.move(box.x + box.width * .8, box.y + box.height * .6, { steps: 8 })
  await draw.mouse.up()
  const ink = () => canvas.evaluate(element => {
    const pad = /** @type {HTMLCanvasElement} */ (element)
    const data = /** @type {CanvasRenderingContext2D} */ (pad.getContext('2d')).getImageData(0, 0, pad.width, pad.height).data
    let painted = 0
    for (let at = 3; at < data.length; at += 4) if (data[at]) painted++
    return painted
  })
  const before = await ink()
  assert.ok(before > 0, 'the stroke is on the pad')
  await draw.locator('button.sponsor').click()
  await draw.locator('dialog.sponsor-dialog .tip').first().waitFor()
  await draw.keyboard.press('Control+z')
  assert.equal(await ink(), before, 'Ctrl+Z leaves the stroke')
  await draw.keyboard.press('Escape')
  assert.equal(await draw.locator('dialog.sponsor-dialog').evaluate(element => /** @type {HTMLDialogElement} */ (element).open), false, 'Escape closes the dialog')
  assert.equal(await ink(), before, 'Escape leaves the stroke')
  await context.close()
})

await browser.close()
console.log(`\n${passed} passed, ${failed.length} failed`)
if (failed.length) process.exit(1)

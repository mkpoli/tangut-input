// The design-system page: theme, the palette with ratios measured from the rendered page, and
// nothing else. The samples in design.html are the shipped CSS.
import './app.css'
import './design-preview.css'

const KEY = 'tangut-input:theme'

/** @param {string} token */
function read(token) {
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;width:0;height:0;background-color:var(${token})`
  document.body.append(probe)
  const value = getComputedStyle(probe).backgroundColor
  probe.remove()
  return value
}

/** @param {string} value @returns {[number, number, number] | null} */
function channels(value) {
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/** @param {number[]} rgb */
function luminance(rgb) {
  const [r, g, b] = rgb.map(value => {
    const c = value / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** @param {string} foreground @param {string} background */
function ratio(foreground, background) {
  const fg = channels(foreground)
  const bg = channels(background)
  if (!fg || !bg) return 0
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
}

/** @type {{ title: string, note?: string, items: { token: string, name: string, pair: string, threshold: number }[] }[]} */
const GROUPS = [
  {
    title: 'Surfaces',
    note: 'Three surfaces, and the two fills a control takes on hover and press.',
    items: [
      { token: '--ui-color-canvas', name: 'Canvas', pair: '--ui-color-ink', threshold: 4.5 },
      { token: '--ui-color-surface', name: 'Surface', pair: '--ui-color-ink', threshold: 4.5 },
      { token: '--ui-color-surface-sunken', name: 'Sunken', pair: '--ui-color-ink-soft', threshold: 4.5 },
      { token: '--ui-color-surface-hover', name: 'Hover', pair: '--ui-color-ink', threshold: 4.5 },
      { token: '--ui-color-surface-active', name: 'Pressed', pair: '--ui-color-ink', threshold: 4.5 },
    ],
  },
  {
    title: 'Text',
    note: 'Measured on the panel surface, its worst common background.',
    items: [
      { token: '--ui-color-ink', name: 'Ink', pair: '--ui-color-surface', threshold: 4.5 },
      { token: '--ui-color-ink-soft', name: 'Ink soft', pair: '--ui-color-surface', threshold: 4.5 },
      { token: '--ui-color-ink-muted', name: 'Ink muted', pair: '--ui-color-surface', threshold: 4.5 },
      { token: '--ui-color-accent-ink', name: 'Accent ink', pair: '--ui-color-surface', threshold: 4.5 },
      { token: '--ui-color-on-accent', name: 'On accent', pair: '--ui-color-accent', threshold: 4.5 },
      { token: '--ui-color-inverse-ink', name: 'On inverse', pair: '--ui-color-inverse-surface', threshold: 4.5 },
    ],
  },
  {
    title: 'Lines',
    note: 'Decorative lines need no ratio; a line that identifies a control needs 3:1.',
    items: [
      { token: '--ui-color-border', name: 'Border', pair: '--ui-color-surface', threshold: 1 },
      { token: '--ui-color-border-strong', name: 'Border strong', pair: '--ui-color-surface', threshold: 1 },
      { token: '--ui-color-control-border', name: 'Control border', pair: '--ui-color-surface', threshold: 3 },
      { token: '--ui-color-control-border-hover', name: 'Control hover', pair: '--ui-color-surface', threshold: 3 },
      { token: '--ui-color-focus', name: 'Focus ring', pair: '--ui-color-surface', threshold: 3 },
    ],
  },
  {
    title: 'Accent and danger',
    note: 'The vermilion marks what acts; the danger red marks what failed.',
    items: [
      { token: '--ui-color-accent', name: 'Accent', pair: '--ui-color-surface', threshold: 4.5 },
      { token: '--ui-color-accent-hover', name: 'Accent hover', pair: '--ui-color-surface', threshold: 4.5 },
      { token: '--ui-color-accent-soft', name: 'Accent soft', pair: '--ui-color-accent-ink', threshold: 4.5 },
      { token: '--ui-color-danger', name: 'Danger', pair: '--ui-color-surface', threshold: 4.5 },
      { token: '--ui-color-danger-soft', name: 'Danger soft', pair: '--ui-color-danger', threshold: 4.5 },
      { token: '--ui-color-inverse-surface', name: 'Inverse', pair: '--ui-color-inverse-ink', threshold: 4.5 },
    ],
  },
]

const palette = /** @type {HTMLElement} */ (document.getElementById('palette'))

function render() {
  palette.replaceChildren()
  for (const group of GROUPS) {
    const section = document.createElement('div')
    section.className = 'palette-group'
    const head = document.createElement('h3')
    head.textContent = group.title
    section.append(head)
    if (group.note) {
      const note = document.createElement('p')
      note.className = 'doc-note'
      note.textContent = group.note
      section.append(note)
    }
    const grid = document.createElement('div')
    grid.className = 'swatches'
    for (const item of group.items) {
      const figure = document.createElement('figure')
      figure.className = 'swatch'
      const chip = document.createElement('span')
      chip.className = 'swatch-chip'
      chip.style.background = `var(${item.token})`
      chip.style.color = `var(${item.pair})`
      chip.textContent = item.name === 'On accent' || item.name === 'Accent soft' ? 'Aa 𘅤' : 'Aa'
      const caption = document.createElement('figcaption')
      const name = document.createElement('span')
      name.className = 'swatch-name'
      name.textContent = item.name
      const code = document.createElement('code')
      code.textContent = item.token
      const score = document.createElement('span')
      score.className = 'swatch-score'
      score.dataset.ratio = ''
      caption.append(name, code, score)
      figure.append(chip, caption)
      grid.append(figure)
      // Filled after the node is in the page, so the computed colours are the rendered ones.
      queueMicrotask(() => {
        const value = ratio(read(item.token), read(item.pair))
        score.textContent = `${value.toFixed(2)}:1${item.threshold > 1 ? ` · needs ${item.threshold}` : ''}`
        score.dataset.pass = item.threshold <= 1 || value >= item.threshold ? 'true' : 'false'
        figure.dataset.ratio = String(value)
        figure.dataset.threshold = String(item.threshold)
      })
    }
    section.append(grid)
    palette.append(section)
  }
}

/* ---------- Theme ---------- */

const radios = /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('input[name="theme"]'))

function current() {
  try {
    const kept = localStorage.getItem(KEY)
    return kept === 'light' || kept === 'dark' ? kept : 'auto'
  } catch {
    return 'auto'
  }
}

/** @param {'auto' | 'light' | 'dark'} theme */
function setTheme(theme) {
  const root = document.documentElement
  if (theme === 'auto') {
    delete root.dataset.theme
    try { localStorage.removeItem(KEY) } catch {}
  } else {
    root.dataset.theme = theme
    try { localStorage.setItem(KEY, theme) } catch {}
  }
  for (const radio of radios) radio.checked = radio.value === theme
  // The palette chips read tokens, so they change with the scheme; re-measure them.
  render()
}

for (const radio of radios) radio.addEventListener('change', () => { if (radio.checked) setTheme(/** @type {'auto'|'light'|'dark'} */ (radio.value)) })

// `indeterminate` is a property, not an attribute; the third sample shows the mixed state.
for (const box of document.querySelectorAll('.ui-checkbox')) if (box.hasAttribute('indeterminate') && box instanceof HTMLInputElement) box.indeterminate = true
setTheme(current())

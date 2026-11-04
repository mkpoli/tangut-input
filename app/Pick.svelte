<script>
  // The input method on its own: the site's own box, always open, for a tool that embeds this page
  // as its picker. A pick is posted to the window that embedded it.
  import MiniIme from './ui/MiniIme.svelte'
  import { db, ix, load, gloss } from './lib/db.svelte.js'
  import { loadShapes, SHAPE_FACES } from './lib/data.js'
  import { parseShapes, indexShapes, rasterize, rankShapes } from './lib/shape.js'
  import { t } from './lib/i18n.svelte.js'
  import { setLocale } from './lib/i18n.svelte.js'

  // The picker loads its own records: on the site the app does it, here there is no app.
  load()

  // Handwriting: the same matcher as the site's pad, loaded when the reviewer first draws.
  /** @type {any[]} */
  let indexes = []
  let loading = $state(false)
  /** @type {HTMLCanvasElement | null} */
  let canvas = $state(null)
  /** @type {[number, number][][]} */
  let strokes = $state([])
  let drawing = false
  /** @type {{ char: string, note: string }[]} */
  let hits = $state([])

  async function ensureIndexes() {
    if (indexes.length || loading) return
    loading = true
    for (const face of SHAPE_FACES) {
      const bytes = await loadShapes(face.file).catch(() => null)
      if (bytes) indexes = [...indexes, indexShapes(parseShapes(bytes))]
    }
    loading = false
  }

  /** @param {PointerEvent} event @returns {[number, number]} */
  function point(event) {
    const box = /** @type {HTMLCanvasElement} */ (canvas).getBoundingClientRect()
    return [Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))]
  }
  /** @param {PointerEvent} event */
  function down(event) {
    if (!canvas) return
    void ensureIndexes()
    canvas.setPointerCapture(event.pointerId)
    drawing = true
    strokes = [...strokes, [point(event)]]
    paint()
  }
  /** @param {PointerEvent} event */
  function move(event) {
    if (!drawing || !strokes.length) return
    strokes[strokes.length - 1].push(point(event))
    strokes = [...strokes]
    paint()
  }
  function up() {
    drawing = false
    rank()
  }
  function clear() { strokes = []; hits = []; paint() }

  function paint() {
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const box = canvas.getBoundingClientRect()
    context.clearRect(0, 0, box.width, box.height)
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ui-color-ink').trim() || '#222'
    context.lineWidth = 3
    context.lineCap = 'round'
    for (const stroke of strokes) {
      context.beginPath()
      stroke.forEach(([x, y], i) => (i ? context.lineTo(x * box.width, y * box.height) : context.moveTo(x * box.width, y * box.height)))
      context.stroke()
    }
  }

  function rank() {
    if (!strokes.length || !indexes.length) return
    /** @type {[number, number][][]} */
    const scaled = strokes.map(stroke => stroke.map(([x, y]) => /** @type {[number, number]} */ ([x * 340, y * 340])))
    const mask = rasterize(scaled)
    /** @type {Map<string, number>} */
    const best = new Map()
    for (const index of indexes) {
      rankShapes(index, mask, { limit: index.chars.length, strokes: scaled.length, strokeCounts: ix.strokes })
        .forEach((hit, at) => { const known = best.get(hit.char); if (known === undefined || at < known) best.set(hit.char, at) })
    }
    hits = [...best.entries()]
      .filter(([char]) => /[\u{17000}-\u{187FF}]/u.test(char))
      .sort((a, b) => a[1] - b[1])
      .slice(0, 24)
      .map(([char]) => ({ char, note: gloss(char) }))
  }

  /** @param {string} char */
  function take(char) {
    const plain = JSON.parse(JSON.stringify(strokes))
    try { window.parent?.postMessage({ type: 'tangut-pick', char, strokes: plain }, '*') } catch { /* a closed window */ }
  }

  // The language follows the reader's, as on the site.
  if (typeof navigator !== 'undefined') {
    const wanted = navigator.language.startsWith('zh') ? 'zh-Hant' : navigator.language.startsWith('ja') ? 'ja' : navigator.language.startsWith('ko') ? 'ko' : 'en'
    setLocale(/** @type {any} */ (wanted))
  }
</script>

<main class="pick">
  <p class="ui-hint">{#if db.status === 'ready'}{t('pick.hint')}{:else}{t('common.loading')}{/if}</p>
  <MiniIme always />
  <p class="ui-hint">{#if loading}{t('pick.loadingPad')}{:else}{t('pick.drawHint')}{/if}</p>
  <div class="pad">
    <canvas bind:this={canvas} onpointerdown={down} onpointermove={move} onpointerup={up} onpointerleave={up}></canvas>
    {#if strokes.length}<button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={clear}>{t('pick.clear')}</button>{/if}
  </div>
  {#if hits.length}
    <div class="hits">
      {#each hits as hit (hit.char)}
        <button type="button" class="ui-tile" title={hit.note} onclick={() => take(hit.char)}>
          <span class="ui-script" lang="txg">{hit.char}</span>
        </button>
      {/each}
    </div>
  {/if}
</main>

<style>
  .pick{display:grid;gap:8px;padding:10px;align-content:start;background:var(--ui-color-surface)}
  .pad{display:grid;gap:6px;justify-items:start}
  canvas{inline-size:100%;block-size:180px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);touch-action:none;cursor:crosshair}
  .hits{display:grid;grid-template-columns:repeat(6, 1fr);gap:2px}
  .hits .ui-tile{min-block-size:34px;font-size:22px}
  /* The box takes the keys as soon as the page is up: an embedded picker should not need a click. */
  .pick :global(.ime input){outline:none}
</style>

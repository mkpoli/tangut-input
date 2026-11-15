<script>
  // The input method on its own: the site's own box, always open, for a tool that embeds this page
  // as its picker. A pick is posted to the window that embedded it.
  import { onMount } from 'svelte'
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

  /** Svelte action: keep the canvas sized to its box, now and whenever the box changes.
   *  @param {HTMLCanvasElement} node */
  function fitCanvas(node) {
    canvas = node
    const observer = new ResizeObserver(() => { fit(); paint() })
    observer.observe(node)
    requestAnimationFrame(() => { fit(); paint() })
    return { destroy() { observer.disconnect() } }
  }

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
  function undo() {
    strokes = strokes.slice(0, -1)
    if (strokes.length) rank()
    else hits = []
    paint()
  }

  /** The drawing surface follows the box it is shown in: a canvas left at its default size is
   *  stretched by CSS, and the pen lands wherever the stretch puts it. */
  function fit() {
    if (!canvas) return
    const box = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(box.width * ratio))
    const height = Math.max(1, Math.round(box.height * ratio))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      paint()
    }
  }

  function paint() {
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ratio = window.devicePixelRatio || 1
    const width = canvas.width
    const height = canvas.height
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, width, height)
    // The pad is paper in either theme: a reviewer drawing in a dark window still draws dark lines
    // on a light surface, which is what the matcher and the eye expect.
    context.strokeStyle = '#23201c'
    context.lineWidth = 3 * ratio
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const stroke of strokes) {
      context.beginPath()
      stroke.forEach(([x, y], i) => (i ? context.lineTo(x * width, y * height) : context.moveTo(x * width, y * height)))
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

  // A tool that embeds this page can hand over the strokes it is asking about: the reviewer then
  // nudges the drawing rather than starting from an empty square.
  // The page is up and can take a drawing; a tool embedding it may send one now.
  onMount(() => { window.parent?.postMessage({ type: 'tangut-ready' }, '*') })

  addEventListener('message', event => {
    const data = event.data
    if (!data || data.type !== 'tangut-preseed' || !Array.isArray(data.strokes) || !data.strokes.length) return
    strokes = /** @type {[number, number][][]} */ (data.strokes)
    void ensureIndexes().then(() => { fit(); paint(); rank() })
  })

  // Keys pressed while the pointer is in this page still reach the tool around it, so its verdict
  // shortcuts keep working after a stroke.
  addEventListener('keydown', (/** @type {KeyboardEvent} */ event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const target = /** @type {HTMLElement | null} */ (event.target)
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
    if (!/^[1-5 ]$/.test(event.key)) return
    event.preventDefault()
    window.parent?.postMessage({ type: 'tangut-key', key: event.key }, '*')
  })

  // The language follows the reader's, as on the site.
  if (typeof navigator !== 'undefined') {
    const wanted = navigator.language.startsWith('zh') ? 'zh-Hant' : navigator.language.startsWith('ja') ? 'ja' : navigator.language.startsWith('ko') ? 'ko' : 'en'
    setLocale(/** @type {any} */ (wanted))
  }
</script>

<svelte:window onresize={() => { fit(); paint() }} />
<svelte:document onvisibilitychange={() => { fit(); paint() }} />

<main class="pick">
  <p class="ui-hint">{#if db.status === 'ready'}{t('pick.hint')}{:else}{t('common.loading')}{/if}</p>
  <MiniIme always />
  <p class="ui-hint">{#if loading}{t('pick.loadingPad')}{:else}{t('pick.drawHint')}{/if}</p>
  <div class="pad">
    <canvas bind:this={canvas} use:fitCanvas onpointerdown={down} onpointermove={move} onpointerup={up} onpointerleave={up}
      aria-label={t('pick.drawHint')}
      oncontextmenu={(/** @type {MouseEvent} */ event) => { event.preventDefault(); undo() }}></canvas>
    <div class="pad-actions">
      <button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={undo} disabled={!strokes.length}>{t('pick.undo')}</button>
      <button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={clear} disabled={!strokes.length}>{t('pick.clear')}</button>
      <span class="ui-count">{strokes.length}</span>
    </div>
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
  .pad{justify-items:stretch}
  canvas{inline-size:100%;aspect-ratio:1;max-block-size:400px;border:1px solid #d8d1c4;
    border-radius:var(--ui-radius-md);background:#faf7f1;touch-action:none;cursor:crosshair}
  .pad-actions{display:flex;align-items:center;gap:6px}
  .hits{display:grid;grid-template-columns:repeat(6, 1fr);gap:2px}
  .hits .ui-tile{min-block-size:34px;font-size:22px}
  /* The box takes the keys as soon as the page is up: an embedded picker should not need a click. */
  .pick :global(.ime input){outline:none}
</style>

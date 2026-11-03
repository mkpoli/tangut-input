<script>
  // The input method on its own: the site's own box, always open, for a tool that embeds this page
  // as its picker. A pick is posted to the window that embedded it.
  import MiniIme from './ui/MiniIme.svelte'
  import { db, load } from './lib/db.svelte.js'
  import { t } from './lib/i18n.svelte.js'
  import { setLocale } from './lib/i18n.svelte.js'

  // The picker loads its own records: on the site the app does it, here there is no app.
  load()

  // The reviewer draws the character they are looking for; the strokes go back with the pick, so
  // the drawing is kept as theirs rather than as the writer's.
  /** @type {HTMLCanvasElement | null} */
  let canvas = $state(null)
  /** @type {[number, number][][]} */
  let strokes = $state([])
  let drawing = false

  /** @param {PointerEvent} event @returns {[number, number]} */
  function point(event) {
    const box = /** @type {HTMLCanvasElement} */ (canvas).getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))
    return [x, y]
  }
  /** @param {PointerEvent} event */
  function down(event) {
    if (!canvas) return
    canvas.setPointerCapture(event.pointerId)
    drawing = true
    strokes = [...strokes, [point(event)]]
    paintPad()
  }
  /** @param {PointerEvent} event */
  function move(event) {
    if (!drawing || !strokes.length) return
    const last = strokes[strokes.length - 1]
    last.push(point(event))
    strokes = [...strokes]
    paintPad()
  }
  function up() { drawing = false }
  function clear() { strokes = []; paintPad() }

  function paintPad() {
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const box = canvas.getBoundingClientRect()
    context.clearRect(0, 0, box.width, box.height)
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ui-color-ink') || '#222'
    context.lineWidth = 3
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const stroke of strokes) {
      context.beginPath()
      stroke.forEach(([x, y], i) => (i ? context.lineTo(x * box.width, y * box.height) : context.moveTo(x * box.width, y * box.height)))
      context.stroke()
    }
  }

  // The language follows the reader's, as on the site.
  if (typeof navigator !== 'undefined') {
    const wanted = navigator.language.startsWith('zh') ? 'zh-Hant' : navigator.language.startsWith('ja') ? 'ja' : navigator.language.startsWith('ko') ? 'ko' : 'en'
    setLocale(/** @type {any} */ (wanted))
  }
</script>

<main class="pick">
  <p class="ui-hint">{#if db.status === 'ready'}{t('pick.hint')}{:else}{t('common.loading')}{/if}</p>
  <MiniIme always {strokes} />
  <p class="ui-hint">{t('pick.drawHint')}</p>
  <div class="pad">
    <canvas bind:this={canvas} onpointerdown={down} onpointermove={move} onpointerup={up} onpointerleave={up}></canvas>
    {#if strokes.length}<button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={clear}>{t('pick.clear')}</button>{/if}
  </div>
</main>

<style>
  .pick{display:grid;gap:8px;padding:12px;align-content:start;background:var(--ui-color-surface);min-block-size:100dvh}
  .pad{display:grid;gap:6px;justify-items:start}
  canvas{inline-size:240px;block-size:200px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);touch-action:none}
  /* The box takes the keys as soon as the page is up: an embedded picker should not need a click. */
  .pick :global(.ime input){outline:none}
</style>

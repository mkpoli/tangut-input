<script>
  // Draw: sketch the character and see the glyphs closest to it in overall shape. There is no
  // recognizer for the whole script; this compares where ink lies with the printed glyphs of Noto
  // Serif Tangut, and says so beside the results.
  import { onDestroy, onMount } from 'svelte'
  import { db, ix, gloss } from '../lib/db.svelte.js'
  import { loadShapes, SHAPE_FACES } from '../lib/data.js'
  import { parseShapes, indexShapes, rasterize, rankShapes, SIZE } from '../lib/shape.js'
  import { attachPad, put } from '../lib/ui.svelte.js'
  import Candidates from '../ui/Candidates.svelte'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {HTMLCanvasElement | null} */
  let canvas = $state(null)
  /** @type {[number, number][][]} */
  let strokes = $state.raw([])
  /** @type {[number, number][] | null} */
  let current = null
  let useCount = $state(true)
  let components = $state(false)
  let active = $state(-1)
  /** @type {'loading' | 'ready' | 'failed'} */
  let status = $state('loading')
  /** One index per face; a drawing is ranked against each and keeps its best rank per character.
   * @type {import('../lib/shape.js').ShapeIndex[]} */
  let indexes = []
  /** @type {Uint8Array} */
  let mask = $state.raw(new Uint8Array(SIZE * SIZE))
  /** Bumped as faces arrive, so a drawing made before the last face still gets ranked against it. */
  let faceGeneration = $state(0)
  /** @type {Candidates | null} */
  let grid = $state(null)

  onMount(() => {
    // The first face is enough to answer a drawing, so the pad opens on it while the rest arrive in
    // the background; a face that fails to load costs only its own shapes.
    loadShapes(SHAPE_FACES[0].file)
      .then(bytes => {
        indexes = [indexShapes(parseShapes(bytes))]
        status = 'ready'
        faceGeneration++
      })
      .catch(() => { status = 'failed' })
    void (async () => {
      for (const face of SHAPE_FACES.slice(1)) {
        const bytes = await loadShapes(face.file).catch(() => null)
        if (!bytes) continue
        await new Promise(resolve => setTimeout(resolve, 0))
        indexes = [...indexes, indexShapes(parseShapes(bytes))]
        faceGeneration++
      }
    })()
    resize()
    // A character picked from these results is recorded with the drawing that produced it.
    attachPad(() => {
      const box = canvas?.getBoundingClientRect()
      if (!box || !strokes.length) return null
      return {
        strokes: strokes.map(stroke => stroke.map(([x, y]) => [+(x / box.width).toFixed(4), +(y / box.height).toFixed(4)])),
        width: Math.round(box.width),
        height: Math.round(box.height),
      }
    })
    onDestroy(() => attachPad(null))
  })

  const strokeCount = $derived(strokes.length)

  /**
   * The glyphs closest to the drawing across every face: each character keeps its best rank in
   * any one face, and the list is that order. The stroke count, when it is counted, is weighed
   * inside each face's ranking, before the faces are merged; weighed afterwards it reorders a list
   * whose scores come from five different scales.
   * @param {Uint8Array} mask
   */
  function rankEveryFace(mask) {
    const best = new Map()
    const strokes = useCount ? strokeCount : 0
    for (const face of indexes) {
      rankShapes(face, mask, { limit: face.chars.length, strokes, strokeCounts: ix.strokes }).forEach((hit, at) => {
        const known = best.get(hit.char)
        if (!known || at < known.at) best.set(hit.char, { hit, at })
      })
    }
    return [...best.values()].sort((a, b) => a.at - b.at).map(entry => entry.hit)
  }

  const hits = $derived.by(() => {
    void mask
    void faceGeneration
    if (status !== 'ready' || db.status !== 'ready' || !indexes.length || !strokes.length) return []
    return rankEveryFace(mask).filter(hit => components || !/[\u{18800}-\u{18AFF}]/u.test(hit.char)).slice(0, 48)
  })
  const items = $derived(hits.map(hit => ({ char: hit.char, sub: gloss(hit.char), title: `${ix.strokes.get(hit.char) ?? '?'} strokes` })))

  function resize() {
    if (!canvas) return
    const box = canvas.getBoundingClientRect()
    const ratio = devicePixelRatio || 1
    canvas.width = Math.round(box.width * ratio)
    canvas.height = Math.round(box.height * ratio)
    paint()
  }

  function paint() {
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ratio = devicePixelRatio || 1
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    const { width, height } = canvas.getBoundingClientRect()
    context.clearRect(0, 0, width, height)
    const ink = getComputedStyle(canvas).color
    context.strokeStyle = ink
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = Math.max(5, width / 42)
    for (const stroke of [...strokes, ...(current ? [current] : [])]) {
      context.beginPath()
      stroke.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y))
      if (stroke.length === 1) context.lineTo(stroke[0][0] + 0.1, stroke[0][1])
      context.stroke()
    }
  }

  /** @param {PointerEvent} event @returns {[number, number]} */
  function point(event) {
    const box = /** @type {HTMLCanvasElement} */ (canvas).getBoundingClientRect()
    return [event.clientX - box.left, event.clientY - box.top]
  }

  /** @param {PointerEvent} event */
  function down(event) {
    if (event.button !== 0) return
    canvas?.setPointerCapture(event.pointerId)
    current = [point(event)]
    paint()
  }
  /** @param {PointerEvent} event */
  function moveTo(event) {
    if (!current) return
    const [x, y] = point(event)
    const last = current[current.length - 1]
    if (Math.hypot(x - last[0], y - last[1]) < 2) return
    current.push([x, y])
    paint()
  }
  function up() {
    if (!current) return
    strokes = [...strokes, current]
    current = null
    update()
  }

  function update() {
    mask = rasterize(strokes)
    active = -1
    paint()
  }
  function undo() { strokes = strokes.slice(0, -1); update() }
  function clear() { strokes = []; update() }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    const typing = /** @type {HTMLElement} */ (event.target).closest('input, textarea')
    if (typing) return
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') { event.preventDefault(); undo(); return }
    if (event.key === 'Escape') { clear(); return }
    if (event.key === 'Enter' && active < 0 && hits[0]) { put(hits[0].char, { place: 0 }); clear(); return }
    if (grid?.key(event)) event.preventDefault()
  }
</script>

<svelte:window onresize={resize} onkeydown={keys} />

<div class="draw">
  <section class="pad-column" aria-label={t('draw.padLabel')}>
    <header class="intro">
      <h1>{t('nav.draw')}</h1>
      <p class="muted">{t('draw.intro')}</p>
    </header>
    <div class="pad">
      <canvas bind:this={canvas} aria-label={t('draw.canvas')}
        onpointerdown={down} onpointermove={moveTo} onpointerup={up} onpointercancel={up}></canvas>
      {#if !strokes.length}<p class="hint" aria-hidden="true">{t('draw.here')}</p>{/if}
    </div>
    <div class="tools">
      <button type="button" class="btn" onclick={undo} disabled={!strokes.length}>{t('draw.undo')}</button>
      <button type="button" class="btn" onclick={clear} disabled={!strokes.length}>{t('draw.clear')}</button>
      <span class="muted strokes">{t('draw.strokes', { count: strokes.length })}</span>
    </div>
  </section>

  <section class="notes" aria-label={t('draw.optionsLabel')}>
    <div class="options">
      <label><input type="checkbox" bind:checked={useCount} onchange={update} /> {t('draw.favourStrokes', { count: strokes.length || '—' })}</label>
      <label><input type="checkbox" bind:checked={components} onchange={update} /> {t('draw.includeComponents')}</label>
    </div>
    <p class="note honest">{@html t('draw.note')}</p>
  </section>

  <section class="results" aria-label={t('draw.resultsLabel')}>
    <div class="head">
      <h2 class="label">{t('draw.results')}</h2>
      {#if status === 'loading'}<span class="muted">{t('draw.loading')}</span>{:else if status === 'failed'}<span class="muted">{t('draw.failed')}</span>{/if}
    </div>
    {#if items.length}
      <Candidates bind:this={grid} {items} bind:active size={70} label={t('draw.results')} />
      <p class="muted keys">{@html t('draw.keys')}</p>
    {:else}
      <p class="empty">{t('draw.empty')}</p>
    {/if}
  </section>
</div>

<style>
  .draw{display:grid;grid-template-columns:minmax(280px,400px) minmax(0,1fr);grid-template-areas:"pad results" "notes results";grid-template-rows:auto 1fr;gap:16px 28px;align-items:start}
  .pad-column{grid-area:pad}
  .notes{grid-area:notes;display:grid;gap:12px}
  .results{grid-area:results}
  .pad-column{display:grid;gap:12px}
  .intro{display:grid;gap:4px}
  h1{font-family:var(--serif);font-size:26px;font-weight:600}
  .intro p{font-size:13.5px}
  .pad{position:relative;aspect-ratio:1;border:1px solid var(--line-strong);border-radius:14px;background:var(--surface);overflow:hidden;box-shadow:var(--shadow)}
  .pad::before,.pad::after{content:"";position:absolute;background:var(--line);pointer-events:none}
  .pad::before{left:50%;top:14px;bottom:14px;width:1px}
  .pad::after{top:50%;left:14px;right:14px;height:1px}
  canvas{position:relative;z-index:1;display:block;width:100%;height:100%;touch-action:none;cursor:crosshair;color:var(--ink)}
  .hint{position:absolute;left:0;right:0;bottom:16px;text-align:center;color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
  .tools{display:flex;align-items:center;gap:6px}
  .strokes{margin-left:auto;font-size:12.5px;font-variant-numeric:tabular-nums}
  .options{display:grid;gap:4px;font-size:13px;color:var(--ink-2)}
  .options input{accent-color:var(--accent);margin-right:6px}
  .honest{font-size:12.5px;line-height:1.55}
  .results{min-width:0}
  .head{display:flex;align-items:baseline;gap:12px;margin:6px 0 12px}
  .head span{font-size:12.5px}
  .keys{margin-top:12px;font-size:12px}
  @media (max-width:1100px){.draw{grid-template-columns:minmax(0,440px);grid-template-areas:"pad" "results" "notes"}}
  @media (max-width:900px){.keys{display:none}.results :global(.tiles){--tile:54px !important}}
</style>

<script>
  // Shared pad and shape ranking for character search and component selection.
  import { onDestroy, onMount } from 'svelte'
  import { db, ix, gloss, readingOf } from '../lib/db.svelte.js'
  import { loadShapes, SHAPE_FACES } from '../lib/data.js'
  import { parseShapes, indexShapes, rasterize, rankShapes, SIZE } from '../lib/shape.js'
  import { isDescriptionPart, siblingIndex } from '../lib/composition.js'
  import { attachPad, put, choose, ui } from '../lib/ui.svelte.js'
  import Candidates from './Candidates.svelte'
  import G from './G.svelte'
  import Icon from './Icon.svelte'
  import { filterHandwriting } from '../lib/handwriting-filter.js'
  import { foldShapeName } from '../lib/names.js'
  import { t } from '../lib/i18n.svelte.js'
  import { record } from '../lib/record.js'
  import { createDrawingCapture } from '../../src/core/drawing-capture.js'
  const capture = createDrawingCapture(record)
  function snapshot() {
    const box = canvas?.getBoundingClientRect()
    if (!box || !box.width || !box.height) return
    capture.update({ origin: 'draw', strokes: strokes.map(stroke => stroke.map(([x, y]) => [+(x / box.width).toFixed(4), +(y / box.height).toFixed(4)])), width: Math.round(box.width), height: Math.round(box.height) })
  }

  /** @type {{ componentsOnly?: boolean, onpick?: (part: string) => void }} */
  let { componentsOnly = false, onpick } = $props()
  let chosen = $state(/** @type {string[]} */ ([]))
  let filter = $state('')
  let showAllParts = $state(false)
  const palette = $derived.by(() => {
    if (db.status !== 'ready') return []
    const query = filter.trim()
    const codes = query.toLowerCase()
    const shape = foldShapeName(query)
    const named = new Set(shape ? ix.names.filter(row => foldShapeName(row.name).includes(shape)).map(row => row.char) : [])
    return [...ix.usedBy.keys()].filter(part => !isDescriptionPart(part) && !chosen.includes(part) && (!query || part.includes(query) || named.has(part) || (ix.codes.get(part) ?? []).some(code => code.startsWith(codes) || code.startsWith(`p${codes}`))))
      .sort((a, b) => (ix.strokes.get(a) ?? 0) - (ix.strokes.get(b) ?? 0) || (ix.usedBy.get(b)?.size ?? 0) - (ix.usedBy.get(a)?.size ?? 0))
  })

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
    let alive = true
    const observer = new ResizeObserver(resize)
    if (canvas) observer.observe(canvas)
    // The first face is enough to answer a drawing, so the pad opens on it while the rest arrive in
    // the background; a face that fails to load costs only its own shapes.
    loadShapes(SHAPE_FACES[0].file)
      .then(bytes => {
        if (!alive) return
        indexes = [...indexes, indexShapes(parseShapes(bytes))]
        status = 'ready'
        faceGeneration++
      })
      .catch(() => { status = 'failed' })
    void (async () => {
      for (const face of SHAPE_FACES.slice(1)) {
        const bytes = await loadShapes(face.file).catch(() => null)
        if (!alive) return
        if (!bytes) continue
        await new Promise(resolve => setTimeout(resolve, 0))
        if (!alive) return
        indexes = [...indexes, indexShapes(parseShapes(bytes))]
        faceGeneration++
      }
    })()
    resize()
    if (!componentsOnly) attachPad((picked, place) => { up(); return capture.capture({ picked, place }) })
    onDestroy(() => { up(); capture.clear(); alive = false; observer.disconnect(); if (!componentsOnly) attachPad(null) })
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

  const ranked = $derived.by(() => {
    void mask
    void faceGeneration
    if (status !== 'ready' || db.status !== 'ready' || !indexes.length || !strokes.length) return []
    return rankEveryFace(mask)
  })
  const hits = $derived(filterHandwriting(ranked, ix, { chosen, componentsOnly, includeComponents: components }))
  const items = $derived(hits.map(hit => ({ char: hit.char, sub: gloss(hit.char), title: `${ix.strokes.get(hit.char) ?? '?'} strokes` })))

  // The characters one component from the best match. A drawing that replaces a component with a
  // neighbour of it is matched to what was drawn; the intended character is usually one of these.
  const siblings = $derived.by(() => {
    if (componentsOnly || !hits.length || db.status !== 'ready') return []
    if (!ix.siblingsReady) {
      ix.siblings = siblingIndex(ix.entries)
      ix.siblingsReady = true
      ix.siblings = new Map(ix.siblings)
    }
    void ix.siblingsReady
    return filterHandwriting((ix.siblings.get(hits[0].char) ?? []).filter(char => !hits.slice(0, 12).some(hit => hit.char === char)).map(char => ({ char })), ix, { chosen, includeComponents: components, limit: 16 }).map(hit => hit.char)
  })

  function resize() {
    if (!canvas) return
    const box = canvas.getBoundingClientRect()
    if (!box.width || !box.height) return
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
    if (event.button !== 0 || !event.isPrimary || current) return
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
    snapshot()
    update()
  }

  function update() {
    mask = rasterize(strokes)
    active = -1
    paint()
  }
  function undo() { up(); capture.capture(); strokes = strokes.slice(0, -1); snapshot(); update() }
  function clear() { up(); capture.clear(); strokes = []; update() }
  function leave() { up(); capture.capture() }
  /** @param {string} part */
  function pickPart(part) { up(); capture.capture({ picked: part }); onpick?.(part); clear() }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (componentsOnly) return
    const target = /** @type {HTMLElement} */ (event.target)
    const typing = target.closest('input, textarea, button:not([role="option"]), summary, select, [contenteditable]')
    // An open dialog owns the keyboard, and the drawing behind it stays as it is.
    if (typing || document.querySelector('dialog[open]')) return
    const option = target.closest('[role="option"]')
    if (option && event.key === 'Enter') {
      const at = [...(option.parentElement?.children ?? [])].indexOf(option)
      if (hits[at]) { event.preventDefault(); put(hits[at].char, { place: at }); clear() }
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') { event.preventDefault(); undo(); return }
    if (event.key === 'Escape') { clear(); return }
    if (event.key === 'Enter' && active < 0 && hits[0]) { put(hits[0].char, { place: 0 }); clear(); return }
    if (grid?.key(event)) event.preventDefault()
  }
</script>

<svelte:window onresize={resize} onkeydown={keys} onpagehide={leave} />
<svelte:document onvisibilitychange={() => { if (document.hidden) leave() }} />

<div class="ui-page draw" class:component-mode={componentsOnly} data-width="wide">
  <section class="pad-column" aria-label={t('draw.padLabel')}>
    <header class="ui-page-head">
      {#if !componentsOnly}<h1 class="ui-page-title"><Icon name="draw" size={22}/><span>{t('nav.draw')}</span></h1>{/if}
      <p class="ui-page-intro">{componentsOnly ? t('parts.drawHint') : t('draw.intro')}</p>
    </header>
    <div class="pad">
      <canvas bind:this={canvas} aria-label={t('draw.canvas')}
        onpointerdown={down} onpointermove={moveTo} onpointerup={up} onpointercancel={up} onlostpointercapture={up}></canvas>
      {#if !strokes.length}<p class="hint" aria-hidden="true">{t('draw.here')}</p>{/if}
    </div>
    <div class="tools">
      <button type="button" class="ui-button" data-size="sm" onclick={undo} disabled={!strokes.length}><Icon name="undo" size={14}/>{t('draw.undo')}</button>
      <button type="button" class="ui-button" data-size="sm" onclick={clear} disabled={!strokes.length}><Icon name="clear" size={14}/>{t('draw.clear')}</button>
      <span class="ui-count strokes">{t('draw.strokes', { count: strokes.length })}</span>
    </div>
  </section>

  <section class="notes" aria-label={t('draw.optionsLabel')}>
    <div class="options">
      <label class="ui-check-row"><input class="ui-checkbox" type="checkbox" bind:checked={useCount} onchange={update} /> <span>{t('draw.favourStrokes', { count: strokes.length || '—' })}</span></label>
      {#if !componentsOnly}<label class="ui-check-row"><input class="ui-checkbox" type="checkbox" bind:checked={components} onchange={update} /> <span>{t('draw.includeComponents')}</span></label>{/if}
    </div>
    {#if !componentsOnly}
      <details class="part-filter">
        <summary>{t('nav.parts')}{#if chosen.length} ({chosen.length}){/if}</summary>
        <div class="ui-toolbar">
          {#each chosen as part (part)}<button type="button" class="ui-chip" title={t('parts.remove')} onclick={() => { chosen = chosen.filter(p => p !== part) }}><G char={part}/> ×</button>{/each}
          {#if chosen.length}<button type="button" class="ui-button" data-size="sm" onclick={() => { chosen = []; filter = '' }}>{t('parts.reset')}</button>{/if}
        </div>
        <input class="ui-input" bind:value={filter} placeholder={t('parts.filterPlaceholder')} aria-label={t('parts.filterLabel')} />
        <div class="ui-tiles" style:--ui-tile-size="38px">
          {#each (showAllParts ? palette : palette.slice(0, 48)) as part (part)}<button type="button" class="ui-tile" onclick={() => { chosen = [...chosen, part]; active = -1 }} title={(ix.codes.get(part) ?? []).join(', ')}><span class="ui-tile-glyph"><G char={part}/></span></button>{/each}
        </div>
        {#if !showAllParts && palette.length > 48}<button type="button" class="ui-button" data-size="sm" onclick={() => { showAllParts = true }}>{t('parts.showAll')}</button>{/if}
      </details>
    {/if}
    <p class="ui-notice">{@html t('draw.note')}</p>
  </section>

  <section class="results" aria-label={t('draw.resultsLabel')}>
    <div class="ui-section-head">
      <h2 class="ui-label">{t('draw.results')}</h2>
      {#if status === 'loading'}<span class="ui-count">{t('draw.loading')}</span>{:else if status === 'failed'}<span class="ui-count">{t('draw.failed')}</span>{/if}
    </div>
    {#if items.length}
      {#if componentsOnly}
        <div class="ui-tiles" style:--ui-tile-size="52px">
          {#each items as item (item.char)}<button type="button" class="ui-tile" onclick={() => pickPart(item.char)} title={item.sub}><span class="ui-tile-glyph"><G char={item.char}/></span></button>{/each}
        </div>
      {:else}
        <Candidates bind:this={grid} {items} bind:active size={70} label={t('draw.results')} />
      {/if}
      {#if siblings.length}
        <div class="kin">
          <p class="ui-hint">{t('draw.siblings', { char: hits[0]?.char ?? '' })}</p>
          <div class="ui-tiles" style:--ui-tile-size="52px">
            {#each siblings as char (char)}
              {@const sound = readingOf(char, ui.reading)}
              <button type="button" class="ui-tile" onclick={() => choose(char)} title={gloss(char)}>
                <G char={char} />{#if sound}<span class="ui-tile-sound">{sound}</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}
      {#if !componentsOnly}<p class="ui-hint keys">{@html t('draw.keys')}</p>{/if}
    {:else}
      <p class="ui-empty">{t('draw.empty')}</p>
    {/if}
  </section>
</div>

<style>
  .component-mode{--ui-space-3xl:20px}
  .part-filter{display:grid;gap:8px}
  .part-filter .ui-tiles{max-height:160px;overflow:auto;margin-top:8px}
  .draw{display:grid;grid-template-columns:minmax(280px,400px) minmax(0,1fr);grid-template-areas:"pad results" "notes results";grid-template-rows:auto 1fr;gap:var(--ui-space-xl) var(--ui-space-3xl);align-items:start}
  .pad-column{grid-area:pad;display:grid;gap:var(--ui-space-lg)}
  .notes{grid-area:notes;display:grid;gap:var(--ui-space-md)}
  .results{grid-area:results;min-inline-size:0}
  .kin{display:grid;gap:6px;margin-top:18px}
  .pad{position:relative;aspect-ratio:1;border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-xl);background:var(--ui-color-surface-sunken);overflow:hidden}
  .pad::before,.pad::after{content:"";position:absolute;background:var(--ui-color-border);pointer-events:none}
  .pad::before{left:50%;top:14px;bottom:14px;width:1px}
  .pad::after{top:50%;left:14px;right:14px;height:1px}
  canvas{position:relative;z-index:1;display:block;width:100%;height:100%;touch-action:none;cursor:crosshair;color:var(--ui-color-ink)}
  .hint{position:absolute;left:0;right:0;bottom:16px;text-align:center;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);letter-spacing:var(--ui-tracking-caps);text-transform:uppercase;pointer-events:none}
  .tools{display:flex;align-items:center;gap:var(--ui-space-xs)}
  .strokes{margin-inline-start:auto}
  .options{display:grid;gap:2px}
  .keys{margin-top:var(--ui-space-md)}
  @media (max-width:1100px){.draw{grid-template-columns:minmax(0,440px);grid-template-areas:"pad" "results" "notes"}}
  @media (max-width:900px){.keys{display:none}.results :global(.ui-tiles){--ui-tile-size:54px !important}}
</style>

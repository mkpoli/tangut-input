<script>
  // A short way into the finders from the Fanqie field. The full pages are laid out for their own
  // input; this panel keeps only the input and the candidates, so two characters can be chosen
  // without leaving the spelling they belong to. A pick goes into the fanqie, never into the text.
  import { keepVariantsTogether } from '../lib/variants.js'
  import { hanGloss } from '../lib/gloss.js'
  import { tick, onDestroy } from 'svelte'
  import { record } from '../lib/record.js'
  import { createDrawingCapture } from '../../src/core/drawing-capture.js'
  const capture = createDrawingCapture(record)
  function snapshot() {
    capture.update({ origin: 'mini', strokes: strokes.map(stroke => stroke.map(([x, y]) => [+(x / CANVAS).toFixed(4), +(y / CANVAS).toFixed(4)])), width: CANVAS, height: CANVAS })
  }
  function leave() { up(); capture.capture() }
  onDestroy(() => { leave(); capture.clear() })
  import { db, ix, gloss, codePoint, isTangut, isComponent, readingOf } from '../lib/db.svelte.js'
  import { byCode, byMeaning, byCodePoint, bySijiao, byParts, byTibetan, partsAmong, tangutIn } from '../lib/search.js'
  import { searchReadings, SYSTEMS } from '../lib/reading.js'
  import { loadShapes } from '../lib/data.js'
  import { parseShapes, indexShapes, rasterize, rankShapes, SIZE } from '../lib/shape.js'
  import { preview, ui } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from './G.svelte'
  import TileNote from './TileNote.svelte'
  import Icon from './Icon.svelte'

  /** @typedef {{ char: string, note: string, title?: string, sound?: string }} MiniHit */

  // `always` is the panel with no field to serve: mounted on a page of its own, it has no trigger, no
  // heading that speaks of the fanqie, and nothing that closes it. `open` stays false, so the listeners
  // that close a popover never run.
  /** @type {{ selected?: string, always?: boolean, onpick: (char: string, place: number, strokes?: [number, number][][]) => boolean }} */
  let { selected = '', always = false, onpick } = $props()

  const MODES = /** @type {const} */ ([
    { key: 'find', label: 'nav.find', icon: 'find' },
    { key: 'meaning', label: 'nav.meaning', icon: 'meaning' },
    { key: 'cangjie', label: 'nav.cangjie', icon: 'cangjie' },
    { key: 'sijiao', label: 'nav.sijiao', icon: 'sijiao' },
    { key: 'reading', label: 'nav.reading', icon: 'reading' },
    { key: 'draw', label: 'nav.draw', icon: 'draw' },
    { key: 'parts', label: 'nav.parts', icon: 'parts' },
  ])
  const LIMIT = 48
  const CANVAS = 320

  let open = $state(false)
  let mode = $state('find')
  /** @type {Record<string, string>} */
  let queries = $state({ find: '', meaning: '', cangjie: '', sijiao: '', reading: '' })
  /** @type {string[]} */
  let parts = $state([])
  let partFilter = $state('')

  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null)
  /** @type {HTMLElement | null} */
  let panel = $state(null)
  /** @type {HTMLElement | null} */
  let body = $state(null)

  /** @type {HTMLCanvasElement | null} */
  let canvas = $state(null)
  /** @type {[number, number][][]} */
  let strokes = $state.raw([])
  /** @type {[number, number][] | null} */
  let current = null
  let mask = $state.raw(new Uint8Array(SIZE * SIZE))
  /** @type {'idle' | 'loading' | 'ready' | 'failed'} */
  let shapeStatus = $state('idle')
  /** @type {import('../lib/shape.js').ShapeIndex | null} */
  let shapeIndex = $state.raw(null)

  const selectedChars = $derived([...selected].filter(isTangut))
  const stateText = $derived.by(() => {
    if (selectedChars.length > 1) return t('fanqie.picker.full', { upper: selectedChars[0], lower: selectedChars[1] })
    if (selectedChars.length === 1) return t('fanqie.picker.lower', { char: selectedChars[0] })
    return t('fanqie.picker.upper')
  })

  const partMatches = $derived(parts.length && db.status === 'ready' ? byParts(parts) : [])
  const partHits = $derived(partMatches.slice(0, LIMIT).map(char => ({ char, note: gloss(char), title: gloss(char) })))
  const partAmong = $derived(parts.length ? partsAmong(partMatches) : null)

  const palette = $derived.by(() => {
    if (db.status !== 'ready') return []
    const needle = partFilter.trim().toLowerCase()
    let list = [...ix.usedBy.keys()].map(part => ({
      part,
      code: ix.codes.get(part)?.[0] ?? '',
      strokes: ix.strokes.get(part) ?? 99,
      uses: ix.usedBy.get(part)?.size ?? 0,
      live: partAmong?.get(part) ?? -1,
    }))
    if (needle) list = list.filter(item => (ix.codes.get(item.part) ?? []).some(code => code.startsWith(needle) || code.startsWith(`p${needle}`)))
    if (partAmong) list = list.filter(item => item.live > 0)
    return keepVariantsTogether(list.sort((a, b) => a.strokes - b.strokes || b.uses - a.uses))
  })

  /** The palette by stroke count, the order a reader looks for a component in. */
  const paletteGroups = $derived.by(() => {
    /** @type {Map<number, typeof palette>} */
    const groups = new Map()
    for (const item of palette) {
      const list = groups.get(item.section) ?? []
      list.push(item)
      groups.set(item.section, list)
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0])
  })

  const drawHits = $derived.by(() => {
    void mask
    const index = shapeIndex
    if (!index || !strokes.length) return []
    return rankShapes(index, mask, { limit: 60, strokes: strokes.length, strokeCounts: ix.strokes, only: char => !isComponent(char) })
      .slice(0, LIMIT)
      .map(hit => ({ char: hit.char, note: gloss(hit.char), title: gloss(hit.char) }))
  })

  /** @type {MiniHit[]} */
  const hits = $derived.by(() => {
    if (db.status !== 'ready') return []
    if (mode === 'find') return findHits(queries.find)
    if (mode === 'meaning') return meaningHits(queries.meaning)
    if (mode === 'cangjie') return byCode(queries.cangjie).slice(0, LIMIT).map(hit => ({ char: hit.char, note: hit.code, title: gloss(hit.char) }))
    if (mode === 'sijiao') return bySijiao(queries.sijiao).slice(0, LIMIT).map(hit => ({ char: hit.char, note: hit.code, title: gloss(hit.char) }))
    if (mode === 'reading') return readingHits(queries.reading)
    if (mode === 'draw') return drawHits
    if (mode === 'parts') return partHits
    return []
  })

  const hasQuery = $derived(mode === 'draw' ? strokes.length > 0 : mode === 'parts' ? parts.length > 0 : (queries[mode] ?? '').trim().length > 0)

  /** @param {string} text */
  function findHits(text) {
    const trimmed = text.trim()
    if (!trimmed) return []
    /** @type {MiniHit[]} */
    const out = []
    const seen = new Set()
    /** @param {string} char @param {string} note @param {string} [title] @param {string} [sound] */
    const add = (char, note, title = '', sound = '') => {
      if (out.length >= LIMIT || seen.has(char)) return
      seen.add(char)
      out.push({ char, note, title: title || note, sound: sound || undefined })
    }
    const chars = tangutIn(trimmed)
    if (chars.length) {
      for (const char of chars) add(char, gloss(char))
      return out
    }
    for (const char of byCodePoint(trimmed).slice(0, 12)) add(char, codePoint(char))
    if (/^[a-z]+$/i.test(trimmed)) {
      for (const hit of byCode(trimmed).slice(0, 12)) add(hit.char, hit.code, gloss(hit.char))
    }
    if (/^[\p{Script=Latin}\p{M}0-9ʔɦɨɪʉɯəɛɔɑŋɣʁɲʷⁿ'·.\- ]+$/u.test(trimmed)) {
      for (const hit of searchReadings(ix.readings, trimmed).filter(hit => hit.tier < 2).slice(0, 12)) {
        add(hit.char, gloss(hit.char), hit.readings.map(reading => reading.raw).join(' · '), readingLabel(hit))
      }
    }
    for (const hit of byTibetan(trimmed).filter(hit => hit.tier === 0).slice(0, 12)) add(hit.char, gloss(hit.char), hit.shown)
    for (const hit of byMeaning(trimmed)) add(hit.char, gloss(hit.char), hit.sense)
    return out
  }

  /** @param {string} text */
  function meaningHits(text) {
    const trimmed = text.trim()
    if (!trimmed) return []
    return byMeaning(trimmed).slice(0, LIMIT).map(hit => ({ char: hit.char, note: gloss(hit.char), title: hit.sense }))
  }

  /**
   * The reading a hit was found by, tagged with its system when that is not the chosen one.
   * @param {import('../lib/reading.js').ReadingHit} hit
   */
  function readingLabel(hit) {
    const reading = hit.readings.find(reading => reading.system === ui.reading) ?? hit.readings[0]
    const system = SYSTEMS.find(system => system.key === reading.system)
    return system && system.key !== ui.reading ? `${reading.raw} (${system.tag})` : reading.raw
  }

  /** @param {string} text */
  function readingHits(text) {
    const trimmed = text.trim()
    if (!trimmed) return []
    return searchReadings(ix.readings, trimmed).slice(0, LIMIT).map(hit => ({
      char: hit.char,
      note: gloss(hit.char),
      sound: readingLabel(hit),
      title: hit.readings.map(reading => reading.raw).join(' · '),
    }))
  }

  function loadDrawShapes() {
    if (shapeStatus !== 'idle') return
    shapeStatus = 'loading'
    void (async () => {
      try {
        const bytes = await loadShapes()
        await new Promise(resolve => setTimeout(resolve, 0))
        shapeIndex = indexShapes(parseShapes(bytes))
        shapeStatus = 'ready'
      } catch {
        shapeStatus = 'failed'
      }
    })()
  }

  /** @param {string} key */
  async function setMode(key) {
    if (key !== 'draw') leave()
    mode = key
    if (key === 'draw') loadDrawShapes()
    await tick()
    if (body) body.scrollTop = 0
    if (!matchMedia('(pointer: coarse)').matches) focusField()
  }

  /** Focus the mode's field when it has one; leave focus on the mode chip otherwise.
   * @returns {boolean} whether a field took the focus */
  function focusField() {
    const field = /** @type {HTMLInputElement | null} */ (body?.querySelector('input') ?? null)
    if (!field) return false
    field.focus()
    return true
  }

  function openPanel() {
    if (open) return
    open = true
    if (mode === 'draw') loadDrawShapes()
    void tick().then(() => {
      if (matchMedia('(pointer: coarse)').matches || !focusField()) panel?.focus()
    })
  }

  /** @param {boolean} [restore] */
  function close(restore = true) {
    if (!open) return
    open = false
    leave()
    if (restore) trigger?.focus()
  }

  /** @param {FocusEvent} event */
  function focusOut(event) {
    if (!open) return
    const next = /** @type {Node | null} */ (event.relatedTarget)
    if (next) {
      if (panel?.contains(next) || trigger?.contains(next)) return
      close(false)
      return
    }
    // The focused control was removed or disabled. Keep the keyboard in the dialog rather than
    // dropping it to the page behind.
    queueMicrotask(() => {
      if (!open) return
      if (panel && !panel.contains(document.activeElement)) panel.focus()
    })
  }

  /** `/` focuses this panel's field while the panel is open. @param {KeyboardEvent} event */
  function panelKeys(event) {
    if (event.isComposing || event.key !== '/' || event.defaultPrevented) return
    const target = /** @type {HTMLElement} */ (event.target)
    if (target.closest('input, textarea, [contenteditable]')) return
    event.preventDefault()
    event.stopPropagation()
    const field = /** @type {HTMLInputElement | null} */ (body?.querySelector('input') ?? null)
    field?.focus()
  }

  /** Show a character in the site's card. On a page of its own there is no card, and opening one
   * would rewrite this page's address to the site's root, which a reload would then load instead.
   * @param {string} char */
  function peek(char) {
    if (!always) preview(char)
  }

  /** @param {MiniHit} hit @param {number} place */
  function pick(hit, place) {
    if (mode === 'draw') { up(); capture.capture({ picked: hit.char, place }) }
    // A pick made from a drawing carries the strokes: whoever asked may keep them as a sample.
    const drawn = mode === 'draw' ? strokes.map(stroke => stroke.map(([x, y]) => /** @type {[number, number]} */ ([x, y]))) : undefined
    if (onpick(hit.char, place, drawn)) always ? reset() : close()
  }

  /** The next character starts clean: strokes left on the pad would be ranked with the new ones, and
   * an old list invites a pick meant for the last one. */
  function reset() {
    for (const key of Object.keys(queries)) queries[key] = ''
    resetParts()
    clearDraw()
  }

  /** @param {KeyboardEvent} event */
  function searchKey(event) {
    if (event.isComposing) return
    if (event.key === 'Enter' && hits.length) {
      event.preventDefault()
      pick(hits[0], 0)
    }
  }

  /** @param {number} index */
  function removePart(index) {
    parts = parts.filter((_, at) => at !== index)
  }

  /** @param {string} part */
  function addPart(part) {
    parts = [...parts, part]
    partFilter = ''
    peek(part)
  }

  function resetParts() {
    parts = []
    partFilter = ''
  }

  /** @param {PointerEvent} event @returns {[number, number]} */
  function point(event) {
    const box = /** @type {HTMLCanvasElement} */ (canvas).getBoundingClientRect()
    return [(event.clientX - box.left) * CANVAS / box.width, (event.clientY - box.top) * CANVAS / box.height]
  }

  function paint() {
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, CANVAS, CANVAS)
    context.strokeStyle = getComputedStyle(canvas).color
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 10
    for (const stroke of [...strokes, ...(current ? [current] : [])]) {
      context.beginPath()
      stroke.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y))
      if (stroke.length === 1) context.lineTo(stroke[0][0] + 0.1, stroke[0][1])
      context.stroke()
    }
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
    if (Math.hypot(x - last[0], y - last[1]) < 3) return
    current.push([x, y])
    paint()
  }

  function up() {
    if (!current) return
    strokes = [...strokes, current]
    current = null
    snapshot()
    mask = rasterize(strokes)
    paint()
  }

  function undoDraw() {
    leave()
    strokes = strokes.slice(0, -1)
    snapshot()
    mask = rasterize(strokes)
    paint()
  }

  function clearDraw() {
    up()
    capture.clear()
    strokes = []
    mask = new Uint8Array(SIZE * SIZE)
    paint()
  }

  $effect(() => {
    void mode
    void strokes
    if (mode === 'draw' && canvas) paint()
  })

  function fitPanel() {
    const node = panel
    if (!node) return
    const host = /** @type {HTMLElement | null} */ (node.offsetParent)
    if (!host) return
    const box = host.getBoundingClientRect()
    const below = matchMedia('(max-width: 700px)').matches ? 72 : 16
    const room = innerHeight - box.bottom - below - 8
    const above = box.top - (matchMedia('(max-width: 700px)').matches ? 144 : 128)
    if (room < 220 && above > room) {
      node.style.top = 'auto'
      node.style.bottom = 'calc(100% + 6px)'
      node.style.maxBlockSize = `${Math.min(560, above)}px`
    } else {
      node.style.top = ''
      node.style.bottom = ''
      node.style.maxBlockSize = `${Math.max(220, Math.min(560, room))}px`
    }
  }

  $effect(() => {
    if (!open) return
    fitPanel()
    addEventListener('resize', fitPanel)
    return () => removeEventListener('resize', fitPanel)
  })

  $effect(() => {
    if (!open) return
    const away = (/** @type {PointerEvent} */ event) => {
      const target = /** @type {Node | null} */ (event.target)
      if (target && (panel?.contains(target) || trigger?.contains(target))) return
      close(false)
    }
    const key = (/** @type {KeyboardEvent} */ event) => {
      if (event.isComposing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    addEventListener('pointerdown', away)
    addEventListener('keydown', key)
    return () => {
      removeEventListener('pointerdown', away)
      removeEventListener('keydown', key)
    }
  })
</script>

<svelte:window onpagehide={leave} onbeforeunload={leave} />
<svelte:document onvisibilitychange={() => { if (document.hidden) leave() }} />

<div class="mini-finder" onfocusout={focusOut}>
  {#if !always}
    <button bind:this={trigger} type="button" class="picker-trigger ui-button" data-variant="quiet" data-size="icon"
      aria-label={t('fanqie.picker.open')} title={t('fanqie.picker.open')} aria-haspopup="dialog" aria-expanded={open}
      aria-controls="fanqie-picker" onclick={() => open ? close() : openPanel()}>
      <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
        <circle cx="8.4" cy="8.4" r="5" fill="none" stroke="currentColor" stroke-width="1.7" />
        <path d="m12.2 12.2 4.1 4.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
        <path d="M16.2 2.5v4.2M14.1 4.6h4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  {/if}

  {#if always || open}
    <div id="fanqie-picker" class={['picker-panel', always ? 'always' : 'ui-popover']} bind:this={panel} role={always ? 'group' : 'dialog'}
      aria-label={always ? t('pick.hint') : undefined} aria-labelledby={always ? undefined : 'fanqie-picker-title'}
      tabindex="-1" onkeydown={panelKeys}>
      {#if !always}
        <header class="picker-head">
          <div class="picker-heading">
            <h2 id="fanqie-picker-title" class="picker-title">{t('fanqie.picker.title')}</h2>
            <p class="picker-state ui-hint" aria-live="polite">{stateText}</p>
          </div>
          <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm"
            aria-label={t('fanqie.picker.close')} title={t('fanqie.picker.close')} onclick={() => close()}>
            <Icon name="close" size={16}/>
          </button>
        </header>
      {/if}

      <div class="picker-modes ui-chip-row" role="group" aria-label={t('nav.label')}>
        {#each MODES as item (item.key)}
          <button type="button" class="ui-chip" aria-pressed={mode === item.key} onclick={() => setMode(item.key)}>
            <Icon name={item.icon} size={13}/>{t(item.label)}
          </button>
        {/each}
      </div>

      <div class="picker-body" bind:this={body}>
        {#if mode === 'find'}
          <input class="ui-input" data-size="lg" value={queries.find} spellcheck="false" autocomplete="off" autocapitalize="off"
            aria-label={t('find.label')} placeholder={t('find.placeholder')}
            oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { queries.find = event.currentTarget.value }}
            onkeydown={searchKey} />
        {:else if mode === 'meaning'}
          <input class="ui-input" data-size="lg" value={queries.meaning} spellcheck="false" autocomplete="off" autocapitalize="off"
            aria-label={t('meaning.label')} placeholder={t('meaning.placeholder')}
            oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { queries.meaning = event.currentTarget.value }}
            onkeydown={searchKey} />
        {:else if mode === 'cangjie'}
          <input class="ui-input ui-mono" data-size="lg" value={queries.cangjie} spellcheck="false" autocomplete="off" autocapitalize="off"
            aria-label={t('cangjie.label')} placeholder={t('cangjie.placeholder')}
            oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => {
              const value = event.currentTarget.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)
              event.currentTarget.value = value
              queries.cangjie = value
            }}
            onkeydown={searchKey} />
        {:else if mode === 'sijiao'}
          <input class="ui-input ui-mono" data-size="lg" value={queries.sijiao} spellcheck="false" autocomplete="off" inputmode="numeric"
            aria-label={t('sijiao.label')} placeholder={t('sijiao.placeholder')}
            oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => {
              const value = event.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 6)
              event.currentTarget.value = value
              queries.sijiao = value
            }}
            onkeydown={searchKey} />
        {:else if mode === 'reading'}
          <input class="ui-input reading-field" data-size="lg" value={queries.reading} spellcheck="false" autocomplete="off" autocapitalize="off"
            aria-label={t('reading.label')} placeholder={t('reading.placeholder')}
            oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { queries.reading = event.currentTarget.value }}
            onkeydown={searchKey} />
        {:else if mode === 'draw'}
          <div class="draw-row">
            <div class="pad">
              <canvas bind:this={canvas} width={CANVAS} height={CANVAS} aria-label={t('draw.canvas')}
                onpointerdown={down} onpointermove={moveTo} onpointerup={up} onpointercancel={up} onlostpointercapture={up}></canvas>
              {#if !strokes.length}<span class="draw-hint" aria-hidden="true">{t('draw.here')}</span>{/if}
            </div>
            <div class="draw-tools">
              <button type="button" class="ui-button" data-size="sm" onclick={undoDraw} disabled={!strokes.length}><Icon name="undo" size={14}/>{t('draw.undo')}</button>
              <button type="button" class="ui-button" data-size="sm" onclick={clearDraw} disabled={!strokes.length}><Icon name="clear" size={14}/>{t('draw.clear')}</button>
              <span class="ui-count">{t('draw.strokes', { count: strokes.length })}</span>
              {#if shapeStatus === 'loading'}<span class="ui-hint">{t('draw.loading')}</span>{:else}<span class="ui-hint">{t('fanqie.picker.drawNote')}</span>{/if}
            </div>
          </div>
          <p class="ui-notice">{t('draw.note')}</p>
        {:else if mode === 'parts'}
          <div class="part-chosen">
            {#if parts.length}
              {#each parts as part, i (i)}
                <button type="button" class="part-pick" onclick={() => removePart(i)} title={t('parts.remove')}>
                  <G char={part} /><span class="part-x" aria-hidden="true">×</span><span class="ui-visually-hidden">{t('parts.remove')}</span>
                </button>
              {/each}
              <button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={resetParts}><Icon name="clear" size={13}/>{t('parts.reset')}</button>
            {:else}
              <span class="ui-hint">{t('parts.noneChosen')}</span>
            {/if}
          </div>
          <input class="ui-input ui-mono" data-size="sm" bind:value={partFilter}
            placeholder={t('parts.filterPlaceholder')} aria-label={t('parts.filterLabel')} spellcheck="false" autocomplete="off" />
        {/if}

        <div class="picker-results">
          {#if db.status !== 'ready'}
            <p class="ui-empty">{t('common.loading')}</p>
          {:else if mode === 'draw' && strokes.length && shapeStatus === 'loading'}
            <p class="ui-empty">{t('draw.loading')}</p>
          {:else if mode === 'draw' && shapeStatus === 'failed'}
            <p class="ui-empty">{t('draw.failed')}</p>
          {:else if hits.length}
            <p class="ui-count" role="status">{t('common.characters', { count: hits.length })}</p>
            <div class="ui-tiles mini-tiles" style:--ui-tile-size="52px">
              {#each hits as hit, i (hit.char)}
                {@const sound = hit.sound ?? readingOf(hit.char, ui.reading)}
                {@const han = hanGloss(ix.leilin.get(hit.char), ix.byChar.get(hit.char)?.definitions?.zh, ix.byChar.get(hit.char)?.wiktionary_zh)}
                <button type="button" class="ui-tile" aria-label={`${always ? hit.char : t('fanqie.picker.add', { char: hit.char })}${sound ? `, ${sound}` : ''}${han.text ? `, ${han.text}` : ''}${hit.note && hit.note !== han.text ? `, ${hit.note}` : ''}`}
                  title={hit.title || hit.note} onmouseenter={() => peek(hit.char)} onfocus={() => peek(hit.char)}
                  onclick={() => pick(hit, i)}>
                  <span class="ui-tile-glyph"><G char={hit.char} /></span>
                  {#if sound}<span class="ui-tile-sound">{sound}</span>{/if}
                  <TileNote char={hit.char} text={hit.note} />
                </button>
              {/each}
            </div>
          {:else if hasQuery}
            <p class="ui-empty">{mode === 'parts' ? t('parts.noMatch') : t('fanqie.picker.empty')}</p>
          {/if}
        </div>

        {#if mode === 'parts'}
          <div class="part-palette">
            {#each paletteGroups as [strokes, items] (strokes)}
              <p class="ui-label part-group">{strokes === 1 ? t('parts.strokeOne') : t('parts.strokeGroup', { count: strokes })}</p>
              <div class="ui-tiles" style:--ui-tile-size="44px">
                {#each items as item (item.part)}
                  {@const sound = readingOf(item.part, ui.reading)}
                  <button type="button" class="ui-tile" onclick={() => addPart(item.part)}
                    title={t('parts.componentTitle', { code: item.code, count: item.live >= 0 ? item.live : item.uses })}>
                    <span class="ui-tile-glyph"><G char={item.part} /></span>
                    {#if sound}<span class="ui-tile-sound">{sound}</span>{/if}
                    <span class="ui-tile-note">{item.live > 0 ? item.live : item.code}{#if item.strokes !== item.section}{' · '}{t('draw.strokes', { count: item.strokes })}{/if}</span>
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .mini-finder{display:contents}
  .picker-trigger{position:absolute;inset-inline-end:var(--ui-space-sm);top:50%;z-index:1;transform:translateY(-50%);color:var(--ui-color-ink-muted)}
  .picker-trigger:hover{color:var(--ui-color-ink)}
  .picker-panel{position:absolute;inset-inline-start:0;top:calc(100% + 6px);z-index:var(--ui-z-menu);display:flex;flex-direction:column;inline-size:min(640px, calc(100vw - 2 * var(--ui-space-lg)));max-block-size:min(560px, calc(100dvh - 400px), 72dvh);overflow:hidden}
  .picker-panel.always{position:static;inline-size:100%;block-size:100dvh;max-block-size:none;padding-block-start:var(--ui-space-md)}
  .picker-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--ui-space-md);padding:var(--ui-space-lg) var(--ui-space-xl) var(--ui-space-xs)}
  .picker-heading{display:grid;gap:1px;min-inline-size:0}
  .picker-title{font-family:var(--ui-font-serif);font-size:var(--ui-text-lg);font-weight:var(--ui-weight-semibold);line-height:var(--ui-leading-tight)}
  .picker-state{font-size:var(--ui-text-xs)}
  .picker-modes{padding:0 var(--ui-space-xl) var(--ui-space-md);border-block-end:1px solid var(--ui-color-border)}
  .picker-body{display:grid;grid-auto-rows:max-content;align-content:start;gap:var(--ui-space-md);min-block-size:0;padding:var(--ui-space-md) var(--ui-space-xl) var(--ui-space-xl);overflow:auto}
  .reading-field{font-family:var(--ui-font-serif)}
  .mini-tiles{--ui-tile-size:52px}
  .picker-results{display:grid;gap:var(--ui-space-sm);min-block-size:0}
  .picker-results .ui-count{margin:0}
  .picker-results .ui-empty{margin:0}
  .draw-row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--ui-space-lg)}
  .pad{position:relative;inline-size:100%;max-inline-size:320px;aspect-ratio:1;border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken);overflow:hidden}
  canvas{display:block;inline-size:100%;block-size:100%;touch-action:none;cursor:crosshair;color:var(--ui-color-ink)}
  .draw-hint{position:absolute;inset-inline:0;bottom:10px;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);letter-spacing:var(--ui-tracking-caps);text-align:center;text-transform:uppercase;pointer-events:none}
  .draw-tools{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .draw-tools .ui-count{margin-inline-start:var(--ui-space-2xs)}
  .part-chosen{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs);min-block-size:42px}
  .part-pick{position:relative;display:grid;place-items:center;inline-size:42px;block-size:42px;border:1px solid var(--ui-color-accent);border-radius:var(--ui-radius-sm);background:var(--ui-color-accent-soft);color:var(--ui-color-ink)}
  .part-pick :global(.ui-script){font-size:26px}
  .part-pick .part-x{position:absolute;top:0;right:4px;color:var(--ui-color-accent-ink);font-size:var(--ui-text-xs)}
  /* The palette runs its full length; the panel around it is what scrolls. */
  .part-palette{padding:1px;display:grid;gap:var(--ui-space-2xs)}
  .part-group{margin:var(--ui-space-2xs) 0 0}
  @media (max-width:700px){
    .picker-head{padding:var(--ui-space-md) var(--ui-space-lg) var(--ui-space-xs)}
    .picker-modes{padding-inline:var(--ui-space-lg)}
    .picker-body{padding:var(--ui-space-sm) var(--ui-space-lg) var(--ui-space-lg)}
    .pad{inline-size:100%;max-inline-size:260px}
  }
</style>

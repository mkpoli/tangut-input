<script>
  // Read a text in layers. The writing strip's text is the text: under each of its characters stands
  // whatever the reader has stacked, top to bottom, in the order and at the size they set. The
  // arrangement stays in this browser. Hovering a character opens its record, with a way to open it
  // or copy it.
  import { db, ix, isTangut } from '../lib/db.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { text, setText } from '../lib/text.svelte.js'
  import { ui, choose } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import { CURRENT, KINDS, MAX_SIZE, MIN_SIZE, cutLine, defaultLayers, layerValue, readLayers, startSize } from '../lib/layers.js'
  import { t, i18n } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'
  import Peek from '../ui/Peek.svelte'
  import Icon from '../ui/Icon.svelte'

  const STORE = 'tangut-input:read-layers'

  // A shared link carries the text in `?q=`; otherwise the writing strip's text goes to the address.
  if (route.q && route.q !== text.value) setText(route.q)
  $effect(() => { if (route.q !== text.value) setQuery(text.value) })

  const editText = () => document.getElementById('writing')?.focus()

  /** The character whose record is open on hover, and where it stands. @type {{ char: string, x: number, y: number, top: number } | null} */
  let peek = $state(null)
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let closing
  /** @param {Element} column @param {string} char */
  function peekAt(column, char) {
    clearTimeout(closing)
    const box = column.getBoundingClientRect()
    peek = { char, x: box.left, y: box.bottom + 6, top: box.top }
  }
  // The pointer has to cross a gap to reach the panel's buttons, so leaving waits a moment.
  const closeSoon = () => { clearTimeout(closing); closing = setTimeout(() => { peek = null }, 180) }
  const keepOpen = () => clearTimeout(closing)

  /** @returns {import('../lib/layers.js').Layer[]} */
  function stored() {
    try { return readLayers(JSON.parse(localStorage.getItem(STORE) ?? 'null')) } catch { return defaultLayers() }
  }
  let layers = $state(stored())
  /** @param {import('../lib/layers.js').Layer[]} next */
  function arrange(next) {
    layers = next
    try { localStorage.setItem(STORE, JSON.stringify(next)) } catch { /* a blocked store only loses the arrangement */ }
  }
  /** @param {number} at @param {Partial<import('../lib/layers.js').Layer>} change */
  const change = (at, change) => arrange(layers.map((layer, i) => (i === at ? { ...layer, ...change } : layer)))
  /** @param {number} from @param {number} to */
  function move(from, to) {
    if (to < 0 || to >= layers.length || from === to) return
    const next = [...layers]
    next.splice(to, 0, ...next.splice(from, 1))
    arrange(next)
  }
  /** @param {string} value */
  function add(value) {
    if (!value) return
    const [kind, system] = value.split(':')
    const layer = /** @type {import('../lib/layers.js').Layer} */ ({ kind, size: startSize(/** @type {any} */ (kind)) })
    if (system) layer.system = system
    arrange([...layers, layer])
  }
  /** Which row is being dragged. @type {number | null} */
  let dragging = $state(null)
  let editing = $state(false)

  /** The system a layer's option stands for. @param {string} key */
  const systemLabel = key => {
    const system = SYSTEMS.find(entry => entry.key === key)
    return system ? systemName(system, i18n.locale) : key
  }
  /** @param {import('../lib/layers.js').Layer} layer */
  const layerName = layer => (layer.kind === 'reading'
    ? (layer.system === CURRENT ? t('read.layer.current', { system: systemLabel(ui.reading) }) : systemLabel(layer.system ?? ''))
    : t(`read.layer.${layer.kind}`))

  // The records are a plain object filled after they load, so everything read from them has to hang
  // off the store's status to be recomputed once they arrive.
  const ready = $derived(db.status === 'ready')
  const query = $derived(text.value)
  const lines = $derived(ready ? query.split('\n').map(line => cutLine(line, isTangut)).filter(line => line.length) : [])
  const chars = $derived(lines.flat().filter(part => part.kind === 'tangut').map(part => part.char))

  /** @param {import('../lib/layers.js').Layer} layer @param {string} char */
  const valueOf = (layer, char) => layerValue(layer, char, {
    entry: ix.byChar.get(char),
    reading: ui.reading,
    downes: ix.downes.get(char),
    rhyme: /** @type {any} */ (ix.rhymes.get(char)),
    hands: ix.tibetanHands[char],
    glosses: ix.tibetan.get(char),
  })
  /** How many characters of the text a layer has something to say about. @param {import('../lib/layers.js').Layer} layer */
  const filled = layer => chars.filter(char => valueOf(layer, char).text).length

  /** The layers with something to show: one with nothing for this text takes no room in it. */
  const shown = $derived(layers.filter(layer => layer.kind === 'tangut' || filled(layer) > 0))

  /** A layer's row across the whole text, a dash where it has nothing. @param {import('../lib/layers.js').Layer} layer */
  const rowText = layer => lines.map(line => line.filter(part => part.kind !== 'gap').map(part => (part.kind === 'tangut' ? (valueOf(layer, part.char).text || '—') : (layer.kind === 'tangut' ? part.char : ''))).filter(Boolean).join(layer.kind === 'tangut' ? '' : ' ')).join('\n')
  /** Every layer in its order, a row of cells to a line of text, for pasting into a table. */
  const table = $derived(lines.map(line => {
    const columns = line.filter(part => part.kind === 'tangut')
    return layers.map(layer => [layerName(layer), ...columns.map(part => valueOf(layer, part.char).text)].join('\t')).join('\n')
  }).join('\n\n'))

</script>

<svelte:window onscroll={() => { peek = null }} onkeydown={event => { if (event.key === 'Escape') peek = null }} />

<div class="ui-page read" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="read" size={22}/><span>{t('nav.read')}</span></h1>
    <p class="ui-page-intro">{t('read.intro')}</p>
  </header>


  <section class="body-text" aria-label={t('nav.read')}>
    <div class="ui-toolbar bar">
      <button type="button" class="ui-button" data-size="sm" onclick={editText}>{t('read.editText')}</button>
      <button type="button" class="ui-chip" aria-pressed={editing} aria-expanded={editing} aria-controls="read-layers" onclick={() => { editing = !editing }}>{t('read.layers')}</button>
      <button type="button" class="ui-button" data-variant="quiet" data-size="sm" disabled={!chars.length} onclick={() => copy(table)}><Icon name="copy" size={14}/>{t('read.copyTable')}</button>
      <span class="ui-count toolbar-end">{t('read.count', { count: chars.length })}</span>
    </div>
    <section id="read-layers" class="editor" hidden={!editing} aria-label={t('read.layers')}>
    <ol class="stack">
      {#each layers as layer, i (i)}
        <li class="row" class:dragging={dragging === i}
          ondragover={event => { event.preventDefault(); if (dragging !== null && dragging !== i) { move(dragging, i); dragging = i } }}>
          <span class="grip" aria-hidden="true" draggable="true" role="presentation" ondragstart={() => { dragging = i }} ondragend={() => { dragging = null }}>⠿</span>
          <span class="name">{layerName(layer)}</span>
          {#if chars.length}<span class="ui-count filled">{filled(layer)}/{chars.length}</span>{/if}
          {#if layer.kind === 'sinograph' && !filled(layer)}<span class="ui-hint none">{t('read.noSinograph')}</span>{/if}
          <label class="size">
            <span class="ui-label">{t('read.size')}</span>
            <input type="range" min={MIN_SIZE} max={MAX_SIZE} value={layer.size} aria-label={t('read.sizeOf', { layer: layerName(layer) })}
              oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => change(i, { size: Number(event.currentTarget.value) })} />
            <span class="px ui-count">{layer.size}</span>
          </label>
          <span class="tools">
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={!chars.length} title={t('read.copyLayer')} aria-label={t('read.copyLayerOf', { layer: layerName(layer) })} onclick={() => copy(rowText(layer))}><Icon name="copy" size={14}/></button>
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={i === 0} aria-label={t('read.up', { layer: layerName(layer) })} onclick={() => move(i, i - 1)}>↑</button>
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={i === layers.length - 1} aria-label={t('read.down', { layer: layerName(layer) })} onclick={() => move(i, i + 1)}>↓</button>
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={layers.length === 1} aria-label={t('read.remove', { layer: layerName(layer) })} onclick={() => arrange(layers.filter((_, at) => at !== i))}>×</button>
          </span>
        </li>
      {/each}
    </ol>
    <div class="ui-toolbar add">
      <span class="ui-select-wrap">
        <select class="ui-select" data-size="sm" aria-label={t('read.add')} value=""
          onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => { add(event.currentTarget.value); event.currentTarget.value = '' }}>
          <option value="">{t('read.add')}</option>
          <optgroup label={t('read.group.reading')}>
            <option value={`reading:${CURRENT}`}>{t('read.layer.current', { system: systemLabel(ui.reading) })}</option>
            {#each SYSTEMS as system (system.key)}<option value={`reading:${system.key}`} title={systemTitle(system)}>{systemName(system, i18n.locale)}</option>{/each}
          </optgroup>
          <optgroup label={t('read.group.other')}>
            {#each KINDS.filter(kind => kind !== 'reading') as kind (kind)}<option value={kind}>{t(`read.layer.${kind}`)}</option>{/each}
          </optgroup>
        </select>
      </span>
      <button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={() => arrange(defaultLayers())}>{t('read.reset')}</button>
    </div>
    </section>
    {#if chars.length}
      <div class="text" aria-live="polite">
        {#each lines as line, l (l)}
          <p class="line">
            {#each line as part, i (i)}
              {#if part.kind === 'gap'}
                <span class="gap"></span>
              {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="column" class:on={peek?.char === part.char}
                  onmouseenter={event => { if (part.kind === 'tangut') peekAt(event.currentTarget, part.char) }} onmouseleave={closeSoon}
                  onfocusin={event => { if (part.kind === 'tangut') peekAt(event.currentTarget, part.char) }} onfocusout={closeSoon}>
                  {#each shown as layer, r (r)}
                    {@const value = part.kind === 'tangut' ? valueOf(layer, part.char) : { text: layer.kind === 'tangut' ? part.char : '', title: '' }}
                    <span class="cell" class:script={layer.kind === 'tangut'} class:bo={layer.kind === 'tibetan'} style:font-size="{layer.size}px" style:block-size="{Math.round(layer.size * 1.45)}px" style:max-inline-size="{Math.max(layer.size * 7, 72)}px"
                      lang={layer.kind === 'sinograph' ? 'zh-Hant' : layer.kind === 'japanese' ? 'ja' : layer.kind === 'tibetan' ? 'bo' : undefined}>
                      {#if layer.kind === 'tangut' && part.kind === 'tangut'}
                        <button type="button" class="glyph" onclick={() => choose(part.char)} aria-label={part.char}><G char={part.char} /></button>
                      {:else}{value.text}{/if}
                    </span>
                  {/each}
                </span>
              {/if}
            {/each}
          </p>
        {/each}
      </div>
    {:else}
      <p class="ui-empty">{t('read.empty')}</p>
    {/if}
  </section>
  {#if peek}<Peek char={peek.char} x={peek.x} y={peek.y} top={peek.top} actions onenter={keepOpen} onleave={closeSoon} />{/if}
</div>

<style>
  .read{min-inline-size:0}
  .body-text{border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface)}
  .bar{padding:var(--ui-space-xs) var(--ui-space-sm);border-block-end:1px solid var(--ui-color-border)}
  .body-text .ui-empty{margin:0;padding:var(--ui-space-xl)}
  .editor{padding:var(--ui-space-sm);border-block-end:1px solid var(--ui-color-border);background:var(--ui-color-surface-sunken)}
  .stack{margin:0;padding:0;list-style:none;display:grid;gap:2px}
  .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs) var(--ui-space-sm);padding:var(--ui-space-2xs) var(--ui-space-xs);border-radius:var(--ui-radius-xs)}
  .row:hover{background:var(--ui-color-surface-hover)}
  .row.dragging{opacity:.5}
  .grip{color:var(--ui-color-ink-muted);cursor:grab;user-select:none}
  .name{flex:1 1 9em;min-inline-size:0;font-size:var(--ui-text-sm)}
  .filled{white-space:nowrap}
  .none{flex-basis:100%;order:1;margin:0}
  .size{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .size input{inline-size:120px;accent-color:var(--ui-color-accent,currentColor)}
  .px{inline-size:2ch;text-align:end}
  .tools{display:flex;gap:2px}
  .add{margin-block-start:var(--ui-space-xs)}
  .text{display:grid;gap:var(--ui-space-lg);padding:var(--ui-space-md)}
  .line{display:flex;flex-wrap:wrap;gap:var(--ui-space-sm) var(--ui-space-2xs);margin:0}
  .gap{inline-size:var(--ui-space-md)}
  .column{display:grid;justify-items:center;align-content:start;min-inline-size:28px;padding-inline:3px;border-radius:var(--ui-radius-xs)}
  .column.on{background:var(--ui-color-surface-hover)}
  .cell{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:1.45;color:var(--ui-color-ink-soft);font-family:var(--ui-font-serif)}
  .cell.script{overflow:visible;color:var(--ui-color-ink)}
  .cell.bo{font-family:'Noto Serif Tibetan','Noto Sans Tibetan',Kailasa,'Microsoft Himalaya','Jomolhari',serif}
  .glyph{display:block;padding:0;border:0;border-radius:var(--ui-radius-xs);background:none;color:inherit;font:inherit;line-height:inherit;cursor:pointer}
  .glyph :global(.ui-script){font-size:inherit}
  @media (max-width:700px){
    .toolbar-end{margin-inline-start:0}
    .name{flex-basis:100%}
    .size input{inline-size:96px}
  }
</style>

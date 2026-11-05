<script>
  // A text set out in layers: under each character stands whatever the reader has stacked, top to
  // bottom, in the order and at the size they set. A layer with nothing for a character shows a dash,
  // so a gap in the records stays in view. The arrangement stays in this browser.
  import { ix, isTangut } from '../lib/db.svelte.js'
  import { route } from '../lib/route.svelte.js'
  import { ui, choose } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import { CURRENT, KINDS, MAX_SIZE, MIN_SIZE, cutLine, defaultLayers, layerValue, readLayers, startSize } from '../lib/layers.js'
  import { t, i18n } from '../lib/i18n.svelte.js'
  import G from './G.svelte'
  import Icon from './Icon.svelte'

  /** @type {{ source: string, arranging?: boolean }} */
  let { source, arranging = false } = $props()

  const STORE = 'tangut-input:transcribe-layers'

  /** @returns {import('../lib/layers.js').Layer[]} */
  function stored() {
    try { return readLayers(JSON.parse(localStorage.getItem(STORE) ?? 'null')) } catch { return defaultLayers() }
  }
  // Each row has an identity of its own while the page is open, so a moved row keeps its focus.
  let serial = 0
  /** @param {import('../lib/layers.js').Layer[]} list @returns {(import('../lib/layers.js').Layer & { id: number })[]} */
  const named = list => list.map(layer => ('id' in layer ? /** @type {any} */ (layer) : { ...layer, id: ++serial }))
  let layers = $state(named(stored()))
  /** @param {import('../lib/layers.js').Layer[]} next */
  function arrange(next) {
    layers = named(next)
    try { localStorage.setItem(STORE, JSON.stringify(next.map(({ kind, system, size }) => ({ kind, system, size })))) } catch { /* a blocked store only loses the arrangement */ }
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

  /** @param {string} key */
  const systemLabel = key => {
    const system = SYSTEMS.find(entry => entry.key === key)
    return system ? systemName(system, i18n.locale) : key
  }
  /** @param {import('../lib/layers.js').Layer} layer */
  const layerName = layer => (layer.kind === 'reading'
    ? (layer.system === CURRENT ? t('layers.current', { system: systemLabel(ui.reading) }) : systemLabel(layer.system ?? ''))
    : t(`layers.${layer.kind}`))

  const lines = $derived(source.split('\n').map(line => cutLine(line, isTangut)).filter(line => line.length))
  const chars = $derived(lines.flat().filter(part => part.kind === 'tangut').map(part => part.char))
  /** @param {import('../lib/layers.js').Layer} layer @param {string} char */
  const valueOf = (layer, char) => layerValue(layer, char, {
    entry: ix.byChar.get(char),
    reading: ui.reading,
    downes: ix.downes.get(char),
    leilin: ix.leilin.get(char),
    rhyme: /** @type {any} */ (ix.rhymes.get(char)),
    hands: ix.tibetanHands[char],
    glosses: ix.tibetan.get(char),
  })
  /** How many characters of the text a layer has something for. @param {import('../lib/layers.js').Layer} layer */
  const filled = layer => chars.filter(char => valueOf(layer, char).text).length
  /** A layer's row across the whole text, a dash where it has nothing. @param {import('../lib/layers.js').Layer} layer */
  const rowText = layer => lines.map(line => (layer.kind === 'tangut' ? line.map(part => part.char).join('') : line.filter(part => part.kind === 'tangut').map(part => valueOf(layer, part.char).text || '—').join(' '))).join('\n')
  // With no Tangut row there is no glyph button, so the column itself takes the keyboard.
  const bare = $derived(!layers.some(layer => layer.kind === 'tangut'))
</script>

{#if arranging}
  <section class="editor" aria-label={t('layers.arrange')}>
    <ol class="stack">
      {#each layers as layer, i (layer.id)}
        <li class="row" class:dragging={dragging === i}
          ondragover={event => { event.preventDefault(); if (dragging !== null && dragging !== i) { move(dragging, i); dragging = i } }}>
          <span class="grip" aria-hidden="true" draggable="true" role="presentation" ondragstart={() => { dragging = i }} ondragend={() => { dragging = null }}>⠿</span>
          <span class="name">{layerName(layer)}</span>
          {#if chars.length}<span class="ui-count filled">{filled(layer)}/{chars.length}</span>{/if}
          <label class="size">
            <span class="ui-label">{t('layers.size')}</span>
            <input type="range" min={MIN_SIZE} max={MAX_SIZE} value={layer.size} aria-label={t('layers.sizeOf', { layer: layerName(layer) })}
              oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => change(i, { size: Number(event.currentTarget.value) })} />
            <span class="px ui-count">{layer.size}</span>
          </label>
          <span class="tools">
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={!chars.length} title={t('layers.copy')} aria-label={t('layers.copyOf', { layer: layerName(layer) })} onclick={() => copy(rowText(layer))}><Icon name="copy" size={14}/></button>
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={i === 0} aria-label={t('layers.up', { layer: layerName(layer) })} onclick={() => move(i, i - 1)}>↑</button>
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={i === layers.length - 1} aria-label={t('layers.down', { layer: layerName(layer) })} onclick={() => move(i, i + 1)}>↓</button>
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={layers.length === 1} aria-label={t('layers.remove', { layer: layerName(layer) })} onclick={() => arrange(layers.filter((_, at) => at !== i))}>×</button>
          </span>
        </li>
      {/each}
    </ol>
    <div class="ui-toolbar add">
      <span class="ui-select-wrap">
        <select class="ui-select" data-size="sm" aria-label={t('layers.add')} value=""
          onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => { add(event.currentTarget.value); event.currentTarget.value = '' }}>
          <option value="">{t('layers.add')}</option>
          <optgroup label={t('layers.group.reading')}>
            <option value={`reading:${CURRENT}`}>{t('layers.current', { system: systemLabel(ui.reading) })}</option>
            {#each SYSTEMS as system (system.key)}<option value={`reading:${system.key}`} title={systemTitle(system)}>{systemName(system, i18n.locale)}</option>{/each}
          </optgroup>
          <optgroup label={t('layers.group.other')}>
            {#each KINDS.filter(kind => kind !== 'reading') as kind (kind)}<option value={kind}>{t(`layers.${kind}`)}</option>{/each}
          </optgroup>
        </select>
      </span>
      <button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={() => arrange(defaultLayers())}>{t('layers.reset')}</button>
    </div>
  </section>
{/if}

<div class="text">
  {#each lines as line, l (l)}
    <p class="line">
      {#each line as part, i (i)}
        {#if part.kind === 'gap'}
          <span class="gap"></span>
        {:else}
          <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events, a11y_no_noninteractive_tabindex -->
          <span class="column" class:on={part.kind === 'tangut' && route.c === part.char} class:opens={part.kind === 'tangut'}
            role={bare && part.kind === 'tangut' ? 'button' : undefined} tabindex={bare && part.kind === 'tangut' ? 0 : undefined}
            onclick={() => { if (part.kind === 'tangut') choose(part.char) }}
            onkeydown={event => { if (bare && part.kind === 'tangut' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(part.char) } }}>
            {#each layers as layer (layer.id)}
              {@const value = part.kind === 'tangut' ? valueOf(layer, part.char) : { text: layer.kind === 'tangut' ? part.char : '', title: '' }}
              <span class="cell" class:ui-phonetic={layer.kind === 'reading'} class:script={layer.kind === 'tangut'} class:bo={layer.kind === 'tibetan'} class:missing={part.kind === 'tangut' && !value.text}
                style:font-size="{layer.size}px" style:block-size="{Math.round(layer.size * 1.45)}px" style:max-inline-size="{Math.max(layer.size * 7, 72)}px"
                title={value.title && value.title !== value.text ? value.title : undefined}
                lang={layer.kind === 'sinograph' ? 'zh-Hant' : layer.kind === 'japanese' ? 'ja' : layer.kind === 'tibetan' ? 'bo' : undefined}>
                {#if layer.kind === 'tangut' && part.kind === 'tangut'}
                  <button type="button" class="glyph" aria-label={part.char}><G char={part.char} /></button>
                {:else if part.kind === 'tangut'}{value.text || '—'}{:else}{value.text}{/if}
              </span>
            {/each}
          </span>
        {/if}
      {/each}
    </p>
  {/each}
</div>

<style>
  .editor{padding:var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken)}
  .stack{margin:0;padding:0;list-style:none;display:grid;gap:2px}
  .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs) var(--ui-space-sm);padding:var(--ui-space-2xs) var(--ui-space-xs);border-radius:var(--ui-radius-xs)}
  .row:hover{background:var(--ui-color-surface-hover)}
  .row.dragging{opacity:.5}
  .grip{color:var(--ui-color-ink-muted);cursor:grab;user-select:none}
  .name{flex:1 1 9em;min-inline-size:0;font-size:var(--ui-text-sm)}
  .filled{white-space:nowrap}
  .size{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .size input{inline-size:120px;accent-color:var(--ui-color-accent,currentColor)}
  .px{inline-size:2ch;text-align:end}
  .tools{display:flex;gap:2px}
  .add{margin-block-start:var(--ui-space-xs)}
  .text{display:grid;gap:var(--ui-space-lg);padding:var(--ui-space-md);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface)}
  .line{display:flex;flex-wrap:wrap;gap:var(--ui-space-sm) var(--ui-space-2xs);margin:0}
  .gap{inline-size:var(--ui-space-md)}
  .column{display:grid;justify-items:center;align-content:start;min-inline-size:28px;padding-inline:3px;border-radius:var(--ui-radius-xs)}
  .column.opens{cursor:pointer}
  .column.opens:hover{background:var(--ui-color-surface-hover)}
  .column.on{background:var(--ui-color-accent-soft)}
  .cell{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:1.45;color:var(--ui-color-ink-soft)}
  .cell.script{overflow:visible;color:var(--ui-color-ink)}
  .cell.missing{color:var(--ui-color-ink-muted);opacity:.6}
  .cell.bo{font-family:'Noto Serif Tibetan','Noto Sans Tibetan',Kailasa,'Microsoft Himalaya','Jomolhari',serif}
  .glyph{display:block;padding:0;border:0;border-radius:var(--ui-radius-xs);background:none;color:inherit;font:inherit;line-height:inherit;cursor:pointer}
  .glyph :global(.ui-script){font-size:inherit}
  @media (max-width:700px){
    .name{flex-basis:100%}
    .size input{inline-size:96px}
  }
</style>

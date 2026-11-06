<script>
  // Parts: build a character from the parts it is drawn from, as the script itself is built. A part
  // can be a component or a character the description spells whole, at any layer. Each choice
  // narrows the characters to those that hold it, and the palette to the parts that still occur, so
  // the next choice always leads somewhere.
  import { keepVariantsTogether } from '../lib/variants.js'
  import { db, ix, gloss, isTangut, codePoint, readingOf } from '../lib/db.svelte.js'
  import G from '../ui/G.svelte'
  import PartInfo from '../ui/PartInfo.svelte'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, ui } from '../lib/ui.svelte.js'
  import { byParts, partsAmong, directPartsIn } from '../lib/search.js'
  import { foldShapeName } from '../lib/names.js'
  import { partInfoPlacement } from '../lib/part-info.js'
  import { LAYOUTS } from '../ui/Ids.svelte'
  import Layout from '../ui/Layout.svelte'
  import Candidates from '../ui/Candidates.svelte'
  import Icon from '../ui/Icon.svelte'
  import { t } from '../lib/i18n.svelte.js'

  let chosen = $state(/** @type {string[]} */ ([...route.q].filter(isTangut).flatMap(char => ix.usedBy.has(char) ? [char] : directPartsIn(char))))
  let layout = $state('')
  let filter = $state('')
  let everything = $state(false)
  let active = $state(-1)
  /** @type {{ part: string, x: number, y: number, live: number } | null} */
  let info = $state(null)
  /** @type {Candidates | null} */
  let grid = $state(null)
  /** @type {HTMLElement | null} */
  let results = $state(null)

  const ready = $derived(db.status === 'ready')
  // A part from the address waits for the records before it can be checked.
  $effect(() => {
    if (ready && !chosen.length && route.q) chosen = [...route.q].filter(isTangut).flatMap(char => ix.usedBy.has(char) ? [char] : directPartsIn(char))
  })

  const hits = $derived(ready ? byParts(chosen, layout) : [])
  const among = $derived(chosen.length || layout ? partsAmong(hits) : null)
  // New matches are read from their first row; the palette keeps its own place.
  $effect(() => {
    void hits
    if (results) results.scrollTop = 0
  })
  const LAYOUT_KEYS = ['⿰', '⿱', '⿲', '⿳', '⿺', '⿸', '⿵', '⿻']

  // Every part at every layer, by strokes then by how often characters use it, with variant components
  // kept together; narrowed by the choice so far.
  const palette = $derived.by(() => {
    if (!ready) return []
    const query = filter.trim()
    const codes = query.toLowerCase()
    const shape = foldShapeName(query)
    /** @type {Set<string>} */
    const named = shape ? new Set(ix.names.filter(row => foldShapeName(row.name).includes(shape)).map(row => row.char)) : new Set()
    let parts = [...ix.usedBy.keys()].map(part => ({ part, uses: ix.usedBy.get(part)?.size ?? 0, strokes: ix.strokes.get(part) ?? 0, live: among ? among.get(part) ?? 0 : -1 }))
    if (query) parts = parts.filter(p => named.has(p.part) || (ix.codes.get(p.part) ?? []).some(code => code.startsWith(codes) || code.startsWith(`p${codes}`)))
    if (among && !everything) parts = parts.filter(p => p.live > 0)
    return keepVariantsTogether(parts.sort((a, b) => a.strokes - b.strokes || b.uses - a.uses))
  })
  const byStroke = $derived.by(() => {
    /** @type {Map<number, typeof palette>} */
    const map = new Map()
    for (const p of palette) map.set(p.section, [...(map.get(p.section) ?? []), p])
    return [...map]
  })

  /** @param {string} part */
  function add(part) {
    chosen = [...chosen, part]
    preview(part)
    setQuery(chosen.join(''))
    active = -1
    info = null
  }
  /** Replace a part that is itself a character by the parts its own description is made of, so a
   *  reader who picks a large component can search its inside instead. @param {number} index */
  function split(index) {
    const inner = directPartsIn(chosen[index])
    if (!inner.length) return
    chosen = [...chosen.slice(0, index), ...inner, ...chosen.slice(index + 1)]
    setQuery(chosen.join(''))
    active = -1
  }

  /** @param {number} index */
  function remove(index) {
    chosen = chosen.filter((_, i) => i !== index)
    setQuery(chosen.join(''))
    active = -1
  }
  function reset() {
    chosen = []
    layout = ''
    setQuery('')
    info = null
  }

  /** @param {Event} event @param {{ part: string, live: number }} p */
  function showInfo(event, p) {
    const box = /** @type {HTMLElement} */ (event.currentTarget).getBoundingClientRect()
    info = { part: p.part, live: p.live, ...partInfoPlacement(box) }
  }
  function hideInfo() {
    info = null
  }
  // Tab reaches a tile, then the palette scrolls it into view: move the record with the tile.
  function scrolled() {
    const active = document.activeElement
    if (active instanceof HTMLElement && active.classList.contains('comp') && active.dataset.part && info?.part === active.dataset.part) {
      info = { ...info, ...partInfoPlacement(active.getBoundingClientRect()) }
      return
    }
    hideInfo()
  }
  /** @param {string} part */
  function shapeName(part) {
    return ix.names.find(row => row.char === part)?.name ?? ''
  }
  /** @param {{ part: string, uses: number, live: number }} p */
  function partLabel(p) {
    const code = ix.codes.get(p.part)?.[0] ?? ''
    const count = p.live >= 0 ? p.live : p.uses
    return [p.part, readingOf(p.part, ui.reading), shapeName(p.part), code ? t('parts.componentTitle', { code, count }) : t('common.characters', { count })].filter(Boolean).join(' · ')
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (grid?.key(event)) event.preventDefault()
  }

  const items = $derived(hits.map(char => ({ char, sub: gloss(char) })))
</script>

<div class="ui-page parts">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="parts" size={22}/><span>{t('nav.parts')}</span></h1>
    <p class="ui-page-intro">{t('parts.intro')}</p>
  </header>

  <section class="ui-card build" data-padding="sm" aria-label={t('parts.chosenLabel')}>
    <div class="chosen">
      {#each chosen as part, i (i)}
        <div class="partwrap">
          <button type="button" class="part" onclick={() => remove(i)} title={t('parts.remove')}><G char={part} /><span class="x" aria-hidden="true">×</span><span class="ui-visually-hidden">{t('parts.remove')}</span></button>
          {#if directPartsIn(part).length}
            <button type="button" class="split" onclick={() => split(i)} title={t('parts.splitTitle', { part })} aria-label={t('parts.splitTitle', { part })}>⿱</button>
          {/if}
        </div>
      {/each}
      {#if !chosen.length}<span class="ui-hint ph">{t('parts.noneChosen')}</span>{/if}
      {#if chosen.length || layout}<button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={reset}><Icon name="clear" size={13}/>{t('parts.reset')}</button>{/if}
    </div>
    <div class="ui-toolbar layouts" role="group" aria-label={t('parts.layout')}>
      <span class="ui-label">{t('parts.layout')}</span>
      <button type="button" class="ui-chip" aria-pressed={!layout} onclick={() => { layout = '' }}>{t('parts.anyLayout')}</button>
      {#each LAYOUT_KEYS as op (op)}
        <button type="button" class="ui-chip" aria-pressed={layout === op} title={t(`layout.${op}`)} onclick={() => { layout = layout === op ? '' : op }}>
          <Layout {op} size={14} /><span>{t(`layout.${op}`)}</span>
        </button>
      {/each}
    </div>
  </section>

  <div class="work">
    <section class="palette pane ui-card" data-padding="sm" aria-label={t('parts.paletteLabel')}>
      <div class="ui-section-head">
        <h2 class="ui-label">{among && !everything ? t('parts.stillOccur') : t('parts.allComponents')}</h2>
        {#if among}
          <label class="ui-check-row all"><input class="ui-checkbox" type="checkbox" bind:checked={everything} /> <span>{t('parts.showAll')}</span></label>
        {/if}
        <span class="filter-wrap">
          <input class="ui-input ui-mono" data-size="sm" data-primary bind:value={filter} oninput={() => { info = null }} placeholder={t('parts.filterPlaceholder')} aria-label={t('parts.filterLabel')} spellcheck="false" autocomplete="off" />
        </span>
      </div>
      <div class="strokes" onscroll={scrolled}>
        {#each byStroke as [count, parts] (count)}
          <div class="stroke-group">
            <h3 class="stroke-count" title={t('draw.strokes', { count })}>{count || '?'}</h3>
            <div class="ui-tiles comps" style:--ui-tile-size="46px">
              {#each parts as p (p.part)}
                {@const sound = readingOf(p.part, ui.reading)}
                <button type="button" class="ui-tile comp" data-dim={p.live === 0 ? '' : undefined} data-part={p.part} onclick={() => add(p.part)}
                  aria-describedby={info?.part === p.part ? 'part-info' : undefined}
                  aria-label={partLabel(p)}
                  onmouseenter={event => showInfo(event, p)} onmouseleave={hideInfo} onfocus={event => showInfo(event, p)} onblur={hideInfo}>
                  <G char={p.part} />{#if sound}<span class="ui-tile-sound">{sound}</span>{/if}{#if p.live > 0}<small class="use">{p.live}</small>{/if}{#if p.strokes !== p.section}<small class="own-strokes" title={t('draw.strokes', { count: p.strokes })}>{p.strokes}</small>{/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section class="matches pane ui-card" data-padding="sm" aria-label={t('parts.matchesLabel')}>
      <div class="ui-section-head">
        <h2 class="ui-label">{chosen.length || layout ? t('common.characters', { count: hits.length }) : t('common.charactersLabel')}</h2>
        {#if chosen.length || layout}<span class="ui-count">{t('parts.fewestStrokes')}</span>{/if}
      </div>
      <div class="results" bind:this={results}>
        {#if chosen.length || layout}
          {#if hits.length}
            <div role="presentation" onkeydown={keys}><Candidates bind:this={grid} {items} bind:active size={64} label={t('parts.matchesLabel')} limit={240} /></div>
          {:else}
            <p class="ui-empty">{layout ? t('parts.noMatchLayout') : t('parts.noMatch')}</p>
          {/if}
        {:else}
          <p class="ui-empty">{t('parts.empty')}</p>
        {/if}
      </div>
    </section>
  </div>

  {#if ready && ix.partNames?.rows.length}
    <details class="name-table">
      <summary>{t('parts.names.title')}</summary>
      <p class="ui-hint">{t('parts.names.hint')}</p>
      <div class="table-wrap">
        <table class="ui-table">
          <thead>
            <tr>
              <th>{t('parts.names.component')}</th>
              {#each ix.partNames.languages as language (language)}<th>{t(`parts.names.${language}`)}</th>{/each}
              <th>{t('parts.names.source')}</th>
            </tr>
          </thead>
          <tbody>
            {#each ix.partNames.rows as row (row.char)}
              <tr>
                <th scope="row"><G char={row.char} /> <span class="ui-mono">{codePoint(row.char)}</span></th>
                {#each ix.partNames.languages as language (language)}
                  <td>{#if row.names[language]?.length}{row.names[language].join(' · ')}{:else}<span class="ui-hint">—</span>{/if}</td>
                {/each}
                <td class="source">{row.source}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}

  {#if info}<PartInfo part={info.part} x={info.x} y={info.y} live={info.live} />{/if}
</div>

<style>
  .build{gap:var(--ui-space-md)}
  .chosen{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs);min-block-size:56px}
  .partwrap{position:relative}
  .part{display:grid;place-items:center;inline-size:56px;block-size:56px;border:1px solid var(--ui-color-accent);border-radius:var(--ui-radius-md);background:var(--ui-color-accent-soft)}
  .part :global(.ui-script){font-size:34px}
  .part .x{position:absolute;top:1px;right:5px;font-size:var(--ui-text-xs);color:var(--ui-color-accent-ink)}
  .split{position:absolute;top:-7px;left:-7px;display:grid;place-items:center;inline-size:20px;block-size:20px;padding:0;border:1px solid var(--ui-color-accent);border-radius:var(--ui-radius-pill);background:var(--ui-color-surface);color:var(--ui-color-accent-ink);font-family:var(--ui-font-ids);font-size:11px;line-height:1}
  .split:hover{background:var(--ui-color-accent);color:var(--ui-color-on-accent)}
  .ph{font-size:var(--ui-text-sm)}
  .build > .chosen + .ui-toolbar{margin-inline-start:0}
  .layouts{gap:var(--ui-space-xs)}
  .layouts .ui-label{margin-inline-end:var(--ui-space-2xs)}
  .filter-wrap{margin-inline-start:auto}
  .filter-wrap .ui-input{inline-size:200px}
  .all{min-block-size:24px;font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft)}
  .work{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:var(--ui-space-xl);align-items:stretch}
  .pane{display:grid;grid-template-rows:auto minmax(0,1fr);gap:var(--ui-space-md);block-size:clamp(280px,calc(100dvh - 500px),680px);min-inline-size:0}
  .strokes,.results{min-block-size:0;overflow:auto;scrollbar-gutter:stable;padding-inline-end:var(--ui-space-2xs)}
  .strokes{display:grid;align-content:start;gap:var(--ui-space-sm)}
  .stroke-group{display:grid;grid-template-columns:30px minmax(0,1fr);gap:var(--ui-space-sm);align-items:start}
  .stroke-count{padding-top:var(--ui-space-xs);color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold);text-align:end}
  .comps{gap:3px}
  .comp{position:relative;min-block-size:var(--ui-tile-size, 46px)}
  .comp :global(.ui-script){font-size:25px}
  .comp :global(.ui-nog){font-size:9px}
  .comp .use{position:absolute;right:3px;bottom:1px;color:var(--ui-color-ink-muted);font-size:9.5px;font-variant-numeric:tabular-nums}
  .comp .own-strokes{position:absolute;left:3px;bottom:1px;color:var(--ui-color-ink-muted);font-size:9.5px;font-variant-numeric:tabular-nums}
  .comp[data-dim]{opacity:.32}
  .name-table{margin-top:var(--ui-space-xl);border-top:1px solid var(--ui-color-border);padding-top:var(--ui-space-lg)}
  .name-table summary{cursor:pointer;font-weight:var(--ui-weight-semibold)}
  .name-table .ui-hint{margin:var(--ui-space-xs) 0 var(--ui-space-sm)}
  .table-wrap{overflow-x:auto}
  .name-table th[scope='row']{white-space:nowrap;font-weight:400}
  .name-table th[scope='row'] :global(.ui-script){font-size:22px;margin-inline-end:4px}
  .name-table td{vertical-align:top}
  .name-table .source{white-space:nowrap;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  @media (max-width:1240px){
    .work{grid-template-columns:minmax(0,1fr)}
    .pane{block-size:clamp(260px,38dvh,460px)}
  }
  @media (max-width:900px){
    .pane{block-size:clamp(260px,33dvh,380px)}
    .filter-wrap{inline-size:100%;margin-inline-start:0}
    .filter-wrap .ui-input{inline-size:100%}
    .layouts .ui-chip span{display:none}
  }
</style>

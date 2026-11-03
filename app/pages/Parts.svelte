<script>
  // Parts: build a character from the components it is drawn from, as the script itself is built.
  // Each chosen part narrows the characters to those whose description holds it, and the palette
  // narrows with them to the parts that still occur, so the next choice always leads somewhere.
  import { db, ix, gloss, isTangut } from '../lib/db.svelte.js'
  import G from '../ui/G.svelte'
  import PartInfo from '../ui/PartInfo.svelte'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview } from '../lib/ui.svelte.js'
  import { byParts, partsAmong, partsIn } from '../lib/search.js'
  import { foldShapeName } from '../lib/names.js'
  import { LAYOUTS } from '../ui/Ids.svelte'
  import Layout from '../ui/Layout.svelte'
  import Candidates from '../ui/Candidates.svelte'
  import { t } from '../lib/i18n.svelte.js'

  let chosen = $state(/** @type {string[]} */ ([...route.q].filter(isTangut).flatMap(char => ix.usedBy.has(char) ? [char] : partsIn(char))))
  let layout = $state('')
  let filter = $state('')
  let everything = $state(false)
  let active = $state(-1)
  /** @type {{ part: string, x: number, y: number, live: number } | null} */
  let info = $state(null)
  /** @type {Candidates | null} */
  let grid = $state(null)

  const ready = $derived(db.status === 'ready')
  // A part from the address waits for the records before it can be checked.
  $effect(() => {
    if (ready && !chosen.length && route.q) chosen = [...route.q].filter(isTangut).flatMap(char => ix.usedBy.has(char) ? [char] : partsIn(char))
  })

  const hits = $derived(ready ? byParts(chosen, layout) : [])
  const among = $derived(chosen.length || layout ? partsAmong(hits) : null)
  const LAYOUT_KEYS = ['⿰', '⿱', '⿲', '⿳', '⿺', '⿸', '⿵', '⿻']

  // Every part, by strokes then by how often descriptions use it; narrowed by the choice so far.
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
    return parts.sort((a, b) => a.strokes - b.strokes || b.uses - a.uses)
  })
  const byStroke = $derived.by(() => {
    /** @type {Map<number, typeof palette>} */
    const map = new Map()
    for (const p of palette) map.set(p.strokes, [...(map.get(p.strokes) ?? []), p])
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
    const inner = partsIn(chosen[index])
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
    info = { part: p.part, live: p.live, x: box.left, y: Math.max(8, Math.min(box.bottom + 6, innerHeight - 240)) }
  }
  function hideInfo() {
    info = null
  }
  /** @param {string} part */
  function shapeName(part) {
    return ix.names.find(row => row.char === part)?.name ?? ''
  }
  /** @param {{ part: string, uses: number, live: number }} p */
  function partLabel(p) {
    const code = ix.codes.get(p.part)?.[0] ?? ''
    const count = p.live >= 0 ? p.live : p.uses
    return [shapeName(p.part), code ? t('parts.componentTitle', { code, count }) : t('common.characters', { count })].filter(Boolean).join(' · ')
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (grid?.key(event)) event.preventDefault()
  }

  const items = $derived(hits.map(char => ({ char, sub: gloss(char) })))
</script>

<div class="ui-page parts">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('nav.parts')}</h1>
    <p class="ui-page-intro">{t('parts.intro')}</p>
  </header>

  <section class="ui-card build" data-padding="sm" aria-label={t('parts.chosenLabel')}>
    <div class="chosen">
      {#each chosen as part, i (i)}
        <div class="partwrap">
          <button type="button" class="part" onclick={() => remove(i)} title={t('parts.remove')}><G char={part} /><span class="x" aria-hidden="true">×</span><span class="ui-visually-hidden">{t('parts.remove')}</span></button>
          {#if partsIn(part).length}
            <button type="button" class="split" onclick={() => split(i)} title={t('parts.splitTitle', { part })} aria-label={t('parts.splitTitle', { part })}>⿱</button>
          {/if}
        </div>
      {/each}
      {#if !chosen.length}<span class="ui-hint ph">{t('parts.noneChosen')}</span>{/if}
      {#if chosen.length || layout}<button type="button" class="ui-button" data-variant="quiet" data-size="sm" onclick={reset}>{t('parts.reset')}</button>{/if}
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

  <section class="matches" aria-label={t('parts.matchesLabel')}>
    <div class="ui-section-head">
      <h2 class="ui-label">{chosen.length || layout ? t('common.characters', { count: hits.length }) : t('common.charactersLabel')}</h2>
      {#if chosen.length || layout}<span class="ui-count">{t('parts.fewestStrokes')}</span>{/if}
    </div>
    {#if chosen.length || layout}
      {#if hits.length}
        <div role="presentation" onkeydown={keys}><Candidates bind:this={grid} {items} bind:active size={64} label={t('parts.matchesLabel')} limit={240} /></div>
      {:else}
        <p class="ui-empty">{layout ? t('parts.noMatchLayout') : t('parts.noMatch')}</p>
      {/if}
    {:else}
      <p class="ui-empty">{t('parts.empty')}</p>
    {/if}
  </section>

  <section class="palette" aria-label={t('parts.paletteLabel')}>
    <div class="ui-section-head">
      <h2 class="ui-label">{among && !everything ? t('parts.stillOccur') : t('parts.allComponents')}</h2>
      {#if among}
        <label class="ui-check-row all"><input class="ui-checkbox" type="checkbox" bind:checked={everything} /> <span>{t('parts.showAll')}</span></label>
      {/if}
      <span class="filter-wrap">
        <input class="ui-input ui-mono" data-size="sm" data-primary bind:value={filter} oninput={() => { info = null }} placeholder={t('parts.filterPlaceholder')} aria-label={t('parts.filterLabel')} spellcheck="false" autocomplete="off" />
      </span>
    </div>
    <div class="strokes">
      {#each byStroke as [count, parts] (count)}
        <div class="stroke-group">
          <h3 class="stroke-count" title={t('draw.strokes', { count })}>{count || '?'}</h3>
          <div class="ui-tiles comps" style:--ui-tile-size="46px">
            {#each parts as p (p.part)}
              <button type="button" class="ui-tile comp" data-dim={p.live === 0 ? '' : undefined} onclick={() => add(p.part)}
                aria-describedby={info?.part === p.part ? 'part-info' : undefined}
                aria-label={partLabel(p)}
                onmouseenter={event => showInfo(event, p)} onmouseleave={hideInfo} onfocus={event => showInfo(event, p)} onblur={hideInfo}>
                <G char={p.part} />{#if p.live > 0}<small class="use">{p.live}</small>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>
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
  .strokes{display:grid;gap:var(--ui-space-sm)}
  .stroke-group{display:grid;grid-template-columns:30px minmax(0,1fr);gap:var(--ui-space-sm);align-items:start}
  .stroke-count{padding-top:var(--ui-space-xs);color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold);text-align:end}
  .comps{gap:3px}
  .comp{position:relative;aspect-ratio:1}
  .comp :global(.ui-script){font-size:25px}
  .comp :global(.ui-nog){font-size:9px}
  .comp .use{position:absolute;right:3px;bottom:1px;color:var(--ui-color-ink-muted);font-size:9.5px;font-variant-numeric:tabular-nums}
  .comp[data-dim]{opacity:.32}
  @media (max-width:900px){
    .filter-wrap{inline-size:100%;margin-inline-start:0}
    .filter-wrap .ui-input{inline-size:100%}
    .layouts .ui-chip span{display:none}
  }
</style>

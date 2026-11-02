<script>
  // Reading: type a reconstruction in whatever system you know. Every system is searched at once,
  // folded to plain letters, and each candidate shows which systems read it so and how. A final
  // digit, or the tone buttons, keep to one tone; systems without tones always pass.
  import { db, ix, gloss } from '../lib/db.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus } from '../lib/ui.svelte.js'
  import { SYSTEMS, TIERS, searchReadings, fold, systemTitle } from '../lib/reading.js'
  import { i18n, t } from '../lib/i18n.svelte.js'

  let query = $state(route.q)
  let tone = $state('')
  let systems = $state(/** @type {string[]} */ ([]))
  let active = $state(-1)
  /** @type {HTMLElement | null} */
  let list = $state(null)

  const ready = $derived(db.status === 'ready')
  const typedTone = $derived(fold(query).tone)
  const hits = $derived(ready && query.trim() ? searchReadings(ix.readings, query, { systems: new Set(systems), tone }) : [])
  const shown = $derived(hits.slice(0, 200))
  const counts = $derived(TIERS.map((_, tier) => hits.filter(hit => hit.tier === tier).length))
  const NAMES = Object.fromEntries(SYSTEMS.map(system => [system.key, system]))

  $effect(() => { void query; void tone; void systems.length; active = -1 })

  /** @param {string} key */
  function toggle(key) {
    systems = systems.includes(key) ? systems.filter(k => k !== key) : [...systems, key]
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (!shown.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      active = Math.max(0, Math.min(shown.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)))
      preview(shown[active].char)
      list?.children[active]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      put(shown[Math.max(0, active)].char, { place: Math.max(0, active) })
    } else if (event.key === 'Escape') {
      query = ''
      setQuery('')
    }
  }

  const EXAMPLES = ['do1', 'ndzi', 'gjwɨr', 'tshja', 'lew']
</script>

<div class="ui-page reading">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('nav.reading')}</h1>
    <p class="ui-page-intro">{@html t('reading.intro')}</p>
  </header>

  <div class="controls">
    <input class="ui-input reading-input" data-size="xl" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-label={t('reading.label')} placeholder={t('reading.placeholder')}
      oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }} onkeydown={keys} use:autofocus />
    <div class="filters">
      <div class="filter-row" role="group" aria-label={t('reading.tone')}>
        <span class="ui-label">{t('reading.tone')}</span>
        <div class="ui-chip-row">
          {#each [['', 'reading.tone.any'], ['1', 'reading.tone.level'], ['2', 'reading.tone.rising']] as [value, name] (value)}
            <button type="button" class="ui-chip" aria-pressed={(typedTone || tone) === value} disabled={!!typedTone}
              onclick={() => { tone = value }}>{t(name)}</button>
          {/each}
          {#if typedTone}<span class="ui-hint">{t('reading.toneTyped', { tone: typedTone })}</span>{/if}
        </div>
      </div>
      <div class="filter-row" role="group" aria-label={t('reading.systems')}>
        <span class="ui-label">{t('reading.systems')}</span>
        <div class="ui-chip-row">
          <button type="button" class="ui-chip" aria-pressed={!systems.length} onclick={() => { systems = [] }}>{t('common.all')}</button>
          {#each SYSTEMS as system (system.key)}
            <button type="button" class="ui-chip" aria-pressed={systems.includes(system.key)} title={system.name} onclick={() => toggle(system.key)}>{system.name.replace(/ \d.*$/, '')}</button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  {#if !query.trim()}
    <div class="start">
      <span class="ui-hint">{t('find.try')}</span>
      {#each EXAMPLES as example (example)}
        <button type="button" class="ui-chip ui-mono" onclick={() => { query = example; setQuery(example) }}>{example}</button>
      {/each}
    </div>
  {:else if !ready}
    <p class="ui-empty">{t('common.loading')}</p>
  {:else if !hits.length}
    <p class="ui-empty">{t('reading.none', { query, systems: systems.length ? t('reading.chosenSystems') : t('reading.anySystem'), tone: tone || typedTone })}</p>
  {:else}
    <p class="ui-count" role="status">
      {t('common.characters', { count: hits.length })} ·
      {#each TIERS as tier, i (tier)}{#if counts[i]}<span class="tier">{t(`reading.tier.${i}`)} {counts[i]}</span>{/if}{/each}
    </p>
    <ol class="ui-rows" bind:this={list}>
      {#each shown as hit, i (hit.char)}
        {#if i === 0 || shown[i - 1].tier !== hit.tier}<li class="ui-group-head" role="presentation">{t(`reading.tier.${hit.tier}`)}</li>{/if}
        <li class="ui-row" data-selected={i === active || (active < 0 && route.c === hit.char)}>
          <button type="button" class="ui-row-pick reading-row" aria-current={i === active || (active < 0 && route.c === hit.char) ? 'true' : undefined}
            onclick={() => { active = i; choose(hit.char) }} ondblclick={() => put(hit.char, { place: i })}>
            <span class="ui-script ui-row-glyph">{hit.char}</span>
            <span class="said">
              {#each hit.readings as reading (reading.system)}
                <span class="r"><span class="ui-tag" title={systemTitle(NAMES[reading.system])}>{NAMES[reading.system].short}</span>{reading.raw}</span>
              {/each}
            </span>
            <span class="ui-row-gloss">{gloss(hit.char)}</span>
          </button>
          <button type="button" class="ui-row-action ui-button" data-variant="quiet" data-size="icon-sm"
            aria-label={t('common.addToText', { char: hit.char })} title={t('common.add')} onclick={() => put(hit.char, { place: i })}>
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </li>
      {/each}
    </ol>
    {#if hits.length > shown.length}<p class="ui-hint">{t('reading.cut', { shown: shown.length, total: hits.length })}</p>{/if}
  {/if}
</div>

<style>
  .controls{display:grid;gap:var(--ui-space-md)}
  .reading-input{font-family:var(--ui-font-serif);font-size:18px}
  .filters{display:grid;gap:var(--ui-space-sm)}
  .filter-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm)}
  .filter-row > .ui-label{inline-size:92px}
  .start{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .tier + .tier::before{content:" · "}
  .reading-row{grid-template-columns:48px minmax(0,1.3fr) minmax(0,1fr)}
  .reading-row :global(.ui-script){font-size:32px;text-align:center}
  .said{display:flex;flex-wrap:wrap;gap:2px var(--ui-space-lg);font-family:var(--ui-font-serif);font-size:var(--ui-text-lg)}
  .said .r{white-space:nowrap}
  .said .ui-tag{margin-inline-end:var(--ui-space-2xs)}
  .ui-group-head{padding:var(--ui-space-lg) 0 var(--ui-space-2xs)}
  @media (max-width:900px){
    .filter-row > .ui-label{inline-size:100%}
    .reading-row{grid-template-columns:40px minmax(0,1fr);gap:var(--ui-space-sm)}
    .reading-row :global(.ui-script){font-size:28px}
    .said{font-size:var(--ui-text-md)}
    .reading-row .ui-row-gloss{grid-column:2;text-align:start;font-size:var(--ui-text-xs)}
  }
</style>

<script>
  // Meaning: search the glosses alone. Wiktionary's English and Japanese glosses are shown, and
  // CCAMC's English and Chinese glosses answer the same box; a hit that only CCAMC answers says so
  // and links there instead of printing the gloss.
  import { db, gloss } from '../lib/db.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus } from '../lib/ui.svelte.js'
  import { byMeaning, MEANING_LANGUAGES } from '../lib/search.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'
  import Icon from '../ui/Icon.svelte'

  let query = $state(route.q)
  /** @type {string[]} an empty list searches all three */
  let languages = $state(/** @type {string[]} */ ([]))
  let active = $state(-1)
  /** @type {HTMLElement | null} */
  let list = $state(null)

  const ready = $derived(db.status === 'ready')
  const text = $derived(query.trim())
  const hits = $derived(ready && text ? byMeaning(text, { languages }) : [])
  const shown = $derived(hits.slice(0, 240))

  $effect(() => { void text; void languages.length; active = -1 })

  /** @param {string} key */
  function toggle(key) {
    languages = languages.includes(key) ? languages.filter(k => k !== key) : [...languages, key]
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (!shown.length) {
      if (event.key === 'Escape') { query = ''; setQuery('') }
      return
    }
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

  const EXAMPLES = ['water', '毒', 'horse']
</script>

<div class="ui-page meaning">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="meaning" size={22}/><span>{t('nav.meaning')}</span></h1>
    <p class="ui-page-intro">{t('meaning.intro')}</p>
  </header>

  <div class="controls">
    <input class="ui-input" data-size="xl" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-label={t('meaning.label')} placeholder={t('meaning.placeholder')}
      oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }}
      onkeydown={keys} use:autofocus />
    <div class="filter-row" role="group" aria-label={t('meaning.languages')}>
      <span class="ui-label">{t('meaning.languages')}</span>
      <div class="ui-chip-row">
        <button type="button" class="ui-chip" aria-pressed={!languages.length} onclick={() => { languages = [] }}>{t('meaning.all')}</button>
        {#each MEANING_LANGUAGES as key (key)}
          <button type="button" class="ui-chip" aria-pressed={languages.includes(key)} onclick={() => toggle(key)}>{t(`meaning.${key}`)}</button>
        {/each}
      </div>
    </div>
  </div>

  {#if !text}
    <div class="start">
      <span class="ui-hint">{t('meaning.try')}</span>
      {#each EXAMPLES as example (example)}
        <button type="button" class="ui-chip" onclick={() => { query = example; setQuery(example) }}>{example}</button>
      {/each}
    </div>
  {:else if !ready}
    <p class="ui-empty">{t('common.loading')}</p>
  {:else if !hits.length}
    <p class="ui-empty">{t('meaning.none', { query: text })}</p>
  {:else}
    <p class="ui-count" role="status">{t('common.characters', { count: hits.length })}</p>
    <ol class="ui-rows" bind:this={list}>
      {#each shown as hit, i (hit.char)}
        <li class="ui-row" data-selected={i === active || (active < 0 && route.c === hit.char)}>
          <button type="button" class="ui-row-pick meaning-row" aria-current={i === active || (active < 0 && route.c === hit.char) ? 'true' : undefined}
            onclick={() => { active = i; choose(hit.char) }} ondblclick={() => put(hit.char, { place: i })}>
            <G char={hit.char} />
            {#if hit.via === 'ccamc'}
              <span class="sense"><span class="ui-tag" aria-hidden="true">{hit.lang}</span><span class="ui-tag">CCAMC</span><span class="ccamc-note">{t('meaning.viaCcamc')}</span></span>
            {:else}
              <span class="sense" lang={hit.lang}><span class="ui-tag" aria-hidden="true">{hit.lang}</span>{hit.sense}</span>
            {/if}
            <span class="ui-row-gloss">{gloss(hit.char)}</span>
          </button>
          <button type="button" class="ui-row-action ui-button" data-variant="quiet" data-size="icon-sm"
            aria-label={t('common.addToText', { char: hit.char })} title={t('common.add')} onclick={() => put(hit.char, { place: i })}>
            <Icon name="add" size={15}/>
          </button>
        </li>
      {/each}
    </ol>
    {#if hits.length > shown.length}<p class="ui-hint">{t('meaning.cut', { shown: shown.length, total: hits.length })}</p>{/if}
  {/if}
</div>

<style>
  .controls{display:grid;gap:var(--ui-space-md)}
  .filter-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm)}
  .filter-row > .ui-label{inline-size:92px}
  .start{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .meaning-row{grid-template-columns:38px minmax(0,1.2fr) minmax(0,1fr)}
  .meaning-row :global(.ui-script){font-size:28px;text-align:center}
  .sense{display:flex;align-items:center;gap:var(--ui-space-2xs);overflow:hidden;color:var(--ui-color-ink);font-size:var(--ui-text-md);text-overflow:ellipsis;white-space:nowrap}
  .ccamc-note{color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);overflow:hidden;text-overflow:ellipsis}
  .meaning-row .ui-row-gloss{text-align:end}
  @media (max-width:900px){
    .filter-row > .ui-label{inline-size:100%}
    .meaning-row{grid-template-columns:34px minmax(0,1fr);gap:var(--ui-space-sm)}
    .meaning-row :global(.ui-script){font-size:26px}
    .meaning-row .ui-row-gloss{grid-column:2;text-align:start;font-size:var(--ui-text-xs)}
  }
</style>

<script>
  // Meaning: search the glosses alone. Open Tangut records a meaning in English, Japanese and
  // Chinese, so the same box takes any of the three, and the chips keep a search to one of them.
  import { db, gloss } from '../lib/db.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus } from '../lib/ui.svelte.js'
  import { byMeaning, MEANING_LANGUAGES } from '../lib/search.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'

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

<div class="meaning">
  <header class="intro">
    <h1>{t('nav.meaning')}</h1>
    <p class="muted">{t('meaning.intro')}</p>
  </header>

  <div class="controls">
    <input class="field big" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-label={t('meaning.label')} placeholder={t('meaning.placeholder')}
      oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }}
      onkeydown={keys} use:autofocus />
    <div class="group" role="group" aria-label={t('meaning.languages')}>
      <span class="label">{t('meaning.languages')}</span>
      <button type="button" class="chip" aria-pressed={!languages.length} onclick={() => { languages = [] }}>{t('meaning.all')}</button>
      {#each MEANING_LANGUAGES as key (key)}
        <button type="button" class="chip" aria-pressed={languages.includes(key)} onclick={() => toggle(key)}>{t(`meaning.${key}`)}</button>
      {/each}
    </div>
  </div>

  {#if !text}
    <div class="tips">
      <p class="muted">{t('meaning.try')}
        {#each EXAMPLES as example (example)}
          <button type="button" class="chip" onclick={() => { query = example; setQuery(example) }}>{example}</button>
        {/each}
      </p>
    </div>
  {:else if !ready}
    <p class="empty">{t('common.loading')}</p>
  {:else if !hits.length}
    <p class="empty">{t('meaning.none', { query: text })}</p>
  {:else}
    <p class="summary muted" role="status">{t('common.characters', { count: hits.length })}</p>
    <ol class="rows" bind:this={list} role="listbox" aria-label={t('common.charactersLabel')}>
      {#each shown as hit, i (hit.char)}
        <li role="option" aria-selected={i === active || (active < 0 && route.c === hit.char)} class="row">
          <button type="button" class="pick" onclick={() => { active = i; choose(hit.char) }} ondblclick={() => put(hit.char, { place: i })}>
            <span class="tg glyph">{hit.char}</span>
            <span class="sense" lang={hit.lang}><span class="tag" aria-hidden="true">{hit.lang}</span>{hit.sense}</span>
            <span class="gl">{gloss(hit.char)}</span>
          </button>
          <button type="button" class="add btn ghost" aria-label={t('common.addToText', { char: hit.char })} title={t('common.add')} onclick={() => put(hit.char, { place: i })}>
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </li>
      {/each}
    </ol>
    {#if hits.length > shown.length}<p class="muted cut">{t('meaning.cut', { shown: shown.length, total: hits.length })}</p>{/if}
  {/if}
</div>

<style>
  .meaning{display:grid;gap:16px;max-width:900px}
  .intro{display:grid;gap:6px}
  h1{font-family:var(--serif);font-size:26px;font-weight:600}
  .intro p{font-size:13.5px;max-width:52em}
  .controls{display:grid;gap:10px}
  .big{font-size:22px;padding:12px 16px;font-family:var(--serif)}
  .group{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
  .group .label{width:auto;margin-right:4px}
  .chip[aria-pressed="true"]{border-color:var(--accent);color:var(--accent-ink);background:var(--accent-soft)}
  .summary{font-size:12.5px}
  .rows{list-style:none;margin:0;padding:0;display:grid;gap:2px}
  .row{display:grid;grid-template-columns:1fr auto;align-items:center;border-radius:9px}
  .row:hover,.row[aria-selected="true"]{background:var(--hover)}
  .pick{display:grid;grid-template-columns:38px minmax(0,1fr) minmax(0,1fr);align-items:center;gap:12px;padding:6px 8px;border:0;background:none;text-align:left;width:100%}
  .glyph{font-family:var(--tangut);font-size:30px;line-height:1}
  .sense{font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tag{display:inline-block;min-width:20px;margin-right:6px;padding:1px 4px;border-radius:4px;background:var(--sunk);color:var(--muted);font-size:10px;font-family:var(--mono);text-transform:uppercase;vertical-align:middle}
  .gl{font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
  .add{opacity:0}
  .row:hover .add,.row:focus-within .add{opacity:1}
  .cut{font-size:12.5px}
  .empty{padding:18px 0;color:var(--muted);font-size:14px}
</style>

<script>
  // Fanqie: the other direction. A character's spelling in the rhyme books is two characters, the
  // upper giving the initial and the lower the rhyme; typing those two finds what they spell.
  import { db, ix, gloss, isTangut } from '../lib/db.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus, ui, setReading } from '../lib/ui.svelte.js'
  import { byFanqie } from '../lib/search.js'
  import { i18n, t } from '../lib/i18n.svelte.js'
  import { record } from '../lib/record.js'
  import MiniFinder from '../ui/MiniFinder.svelte'
  import Icon from '../ui/Icon.svelte'

  let query = $state(route.q)
  // Which reconstruction the results are read in: the reader's choice, remembered across pages.

  const ready = $derived(db.status === 'ready')
  const text = $derived([...query].filter(isTangut).slice(0, 2).join(''))
  const hits = $derived(ready && text ? byFanqie(text) : [])
  // One character is two questions: what spells it, and what it spells. The first is its own record.
  // A Tangut character is two UTF-16 units, so the count has to be over code points.
  const own = $derived(ready && [...text].length === 1 ? ix.rhymes.get(text) ?? null : null)
  const ownSpelling = $derived(own ? (own[3] || own[4] ? `${own[3] ?? ''}${own[4] ?? ''}` : `${own[5] ?? ''}${own[6] ?? ''}`) : '')
  /** @param {string} char */
  const reading = char => (ix.byChar.get(char)?.pronunciations ?? {})[ui.reading]?.trim() ?? ''

  // A fanqie is a spelling: two characters fix one reading. So where a character has no reading of
  // its own recorded, the spelling it shares with a character that has one still gives it — taken
  // from that character, and marked as inferred because no source states it for this one.
  const inferred = $derived.by(() => {
    /** @type {Map<string, { value: string, from: string }>} */
    const map = new Map()
    for (const hit of hits) {
      if (!hit.spelling || map.has(hit.spelling)) continue
      const value = reading(hit.char)
      if (value) map.set(hit.spelling, { value, from: hit.char })
    }
    return map
  })

  /**
   * Put a character into the fanqie: the first picks the upper, the second the lower, and a later
   * pick replaces the lower so another rhyme can be tried without clearing both.
   * @param {string} char
   */
  function placeFanqie(char) {
    const chars = [...text]
    const next = chars.length >= 2 ? `${chars[0]}${char}` : `${chars.join('')}${char}`
    // The candidate's rank belongs to the mini finder's list, not to this page's list.
    record({ type: 'pick', char, finder: 'fanqie', query: route.q || null, locale: i18n.locale })
    query = next
    setQuery(next)
    return [...next].length >= 2
  }
</script>

<div class="ui-page fanqie">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="fanqie" size={22}/><span>{t('nav.fanqie')}</span></h1>
    <p class="ui-page-intro">{t('fanqie.intro')}</p>
  </header>

  <div class="search">
    <div class="fanqie-field">
      <input class="ui-input fanqie-input ui-script" data-size="xl" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
        aria-label={t('fanqie.label')} placeholder={t('fanqie.placeholder')}
        oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }}
        use:autofocus />
      <MiniFinder selected={text} onpick={placeFanqie} />
    </div>
    <label class="choose">
      <span class="ui-label">{t('fanqie.reading')}</span>
      <span class="ui-select-wrap">
        <select class="ui-select" data-size="sm" value={ui.reading} onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setReading(event.currentTarget.value)} aria-label={t('fanqie.reading')}>
          {#each SYSTEMS as entry (entry.key)}<option value={entry.key} title={systemTitle(entry)}>{systemName(entry, i18n.locale)}</option>{/each}
        </select>
      </span>
    </label>
  </div>

  {#if own}
    <section class="own-card" aria-label={t('fanqie.ownLabel')}>
      <span class="ui-script own">{text}</span>
      <span class="cuts">
        {#each [own[3] ?? own[5], own[4] ?? own[6]] as cut, i (i)}
          {#if cut}<span class="cut"><span class="ui-script">{cut}</span>{#if reading(cut)}<small>{reading(cut)}</small>{/if}</span>{/if}
        {/each}
        {#if !ownSpelling}<span class="ui-hint">—</span>{/if}
      </span>
      <span class="own-meta">
        {#if own[0]}<span class="ui-hint">{t('card.rhyme')} {own[0]}</span>{/if}
        {#if own[1]}<span class="ui-hint"> · {t(`card.tone.${own[1] === 1 ? 'level' : own[1] === 2 ? 'rising' : 'entering'}`)}</span>{/if}
        {#if reading(text)}<span class="own-reading">{reading(text)}</span>
        {:else if inferred.get(ownSpelling)}<span class="own-reading guess" title={t('fanqie.inferred', { char: inferred.get(ownSpelling)?.from ?? '' })}>{inferred.get(ownSpelling)?.value}</span>{/if}
      </span>
    </section>
  {/if}

  {#if !text}
    <p class="ui-hint">{t('fanqie.hint')}</p>
  {:else if !ready}
    <p class="ui-empty">{t('common.loading')}</p>
  {:else if !hits.length}
    {#if !own}<p class="ui-empty">{t('fanqie.none', { text })}</p>{/if}
  {:else}
    <p class="ui-count" role="status">{t('common.characters', { count: hits.length })}</p>
    <ol class="ui-rows">
      {#each hits as hit, i (hit.char)}
        <li class="ui-row" data-selected={route.c === hit.char}>
          <button type="button" class="ui-row-pick fanqie-row" aria-current={route.c === hit.char ? 'true' : undefined}
            onclick={() => choose(hit.char)} ondblclick={() => put(hit.char, { place: i })}>
            <span class="ui-script ui-row-glyph">{hit.char}</span>
            <span class="cuts">
              {#if hit.upper}<span class="cut"><span class="ui-script">{hit.upper}</span>{#if reading(hit.upper)}<small>{reading(hit.upper)}</small>{/if}</span>{/if}
              {#if hit.lower}<span class="cut"><span class="ui-script">{hit.lower}</span>{#if reading(hit.lower)}<small>{reading(hit.lower)}</small>{/if}</span>{/if}
            </span>
            <span class="text">
              <span class="meta">
                {#if reading(hit.char)}
                  <span class="say">{reading(hit.char)}</span>
                {:else if inferred.get(hit.spelling)}
                  <span class="say guess" title={t('fanqie.inferred', { char: inferred.get(hit.spelling)?.from ?? '' })}>{inferred.get(hit.spelling)?.value}</span>
                {/if}
                {#if hit.rhyme}<span class="ui-hint">{#if reading(hit.char) || inferred.get(hit.spelling)} · {/if}{t('card.rhyme')} {hit.rhyme}</span>{/if}
              </span>
              <span class="ui-row-gloss">{gloss(hit.char)}</span>
            </span>
          </button>
          <button type="button" class="ui-row-action ui-button" data-variant="quiet" data-size="icon-sm"
            aria-label={t('common.addToText', { char: hit.char })} title={t('common.add')} onclick={() => put(hit.char, { place: i })}>
            <Icon name="add" size={15}/>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .search{display:flex;align-items:flex-end;gap:var(--ui-space-md);flex-wrap:wrap}
  .fanqie-field{position:relative;display:flex;flex:1;min-inline-size:240px}
  .fanqie-field .ui-input{flex:1;min-inline-size:0;padding-inline-end:52px}
  .fanqie-input{font-size:26px}
  .choose{display:flex;align-items:center;gap:var(--ui-space-sm);padding-bottom:10px}
  .choose .ui-label{white-space:nowrap}
  .choose :global(.ui-select){inline-size:auto}
  .own-card{display:flex;align-items:center;flex-wrap:wrap;gap:var(--ui-space-xl);padding:var(--ui-space-md) var(--ui-space-xl);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface-sunken)}
  .own{font-size:36px;line-height:1}
  .cuts{display:flex;gap:var(--ui-space-md);color:var(--ui-color-accent-ink)}
  .cut{display:grid;justify-items:center;line-height:1}
  .cut .ui-script{font-size:21px}
  .cut small{font-family:var(--ui-font-serif);font-size:10px;color:var(--ui-color-ink-muted);margin-top:3px}
  .own-card .cuts :global(.ui-script){font-size:24px}
  .own-meta{display:flex;align-items:center;gap:var(--ui-space-xs);margin-inline-start:auto}
  .own-reading{font-family:var(--ui-font-serif);font-size:var(--ui-text-lg);padding-inline-start:var(--ui-space-sm)}
  .say{font-family:var(--ui-font-serif);font-size:var(--ui-text-md)}
  .guess{color:var(--ui-color-ink-muted);font-style:italic;border-bottom:1px dotted var(--ui-color-border-strong);cursor:help}
  .fanqie-row{grid-template-columns:40px 124px minmax(0,1fr)}
  .fanqie-row :global(.ui-row-glyph){font-size:30px}
  .text{display:grid;gap:1px;min-inline-size:0}
  .meta{font-size:var(--ui-text-xs)}
  .meta .ui-hint{font-size:var(--ui-text-2xs)}
  .fanqie-row .ui-row-gloss{text-align:start;font-size:var(--ui-text-xs)}
  @media (max-width:700px){
    .fanqie-row{grid-template-columns:34px 100px minmax(0,1fr);gap:var(--ui-space-sm)}
    .own-meta{margin-inline-start:0}
  }
</style>

<script>
  // Fanqie: the other direction. A character's spelling in the rhyme books is two characters, the
  // upper giving the initial and the lower the rhyme; typing those two finds what they spell.
  import { db, ix, gloss, isTangut } from '../lib/db.svelte.js'
  import { SYSTEMS } from '../lib/reading.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus } from '../lib/ui.svelte.js'
  import { byFanqie } from '../lib/search.js'
  import { t } from '../lib/i18n.svelte.js'

  let query = $state(route.q)
  // Which reconstruction the results are read in. Kept in the browser, like the script's face.
  let system = $state(/** @type {string} */ ((typeof localStorage !== 'undefined' && localStorage.getItem('tangut-input:reading')) || 'li_fanwen'))
  $effect(() => { try { localStorage.setItem('tangut-input:reading', system) } catch { /* a blocked store only loses the choice */ } })

  const ready = $derived(db.status === 'ready')
  const text = $derived([...query].filter(isTangut).slice(0, 2).join(''))
  const hits = $derived(ready && text ? byFanqie(text) : [])
  // One character is two questions: what spells it, and what it spells. The first is its own record.
  // A Tangut character is two UTF-16 units, so the count has to be over code points.
  const own = $derived(ready && [...text].length === 1 ? ix.rhymes.get(text) ?? null : null)
  const ownSpelling = $derived(own ? (own[3] || own[4] ? `${own[3] ?? ''}${own[4] ?? ''}` : `${own[5] ?? ''}${own[6] ?? ''}`) : '')
  /** @param {string} char */
  const reading = char => (ix.byChar.get(char)?.pronunciations ?? {})[system]?.trim() ?? ''
</script>

<div class="fanqie">
  <header class="intro">
    <h1>{t('nav.fanqie')}</h1>
    <p class="muted">{t('fanqie.intro')}</p>
  </header>

  <div class="search">
    <input class="field big" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-label={t('fanqie.label')} placeholder={t('fanqie.placeholder')}
      oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }}
      use:autofocus />
    <label class="choose">
      <span class="label">{t('fanqie.reading')}</span>
      <select class="field" bind:value={system} aria-label={t('fanqie.reading')}>
        {#each SYSTEMS as entry (entry.key)}<option value={entry.key}>{entry.name}</option>{/each}
      </select>
    </label>
  </div>

  {#if own}
    <section class="record" aria-label={t('fanqie.ownLabel')}>
      <span class="tg own">{text}</span>
      <span class="own-spell tg">{ownSpelling || '—'}</span>
      <span class="own-meta">
        {#if own[0]}<span class="muted">{t('card.rhyme')} {own[0]}</span>{/if}
        {#if own[1]}<span class="muted"> · {t(`card.tone.${own[1] === 1 ? 'level' : own[1] === 2 ? 'rising' : 'entering'}`)}</span>{/if}
        {#if reading(text)}<span class="own-reading">{reading(text)}</span>{/if}
      </span>
    </section>
  {/if}

  {#if !text}
    <p class="muted hint">{t('fanqie.one')}</p>
  {:else if !ready}
    <p class="empty">{t('common.loading')}</p>
  {:else if !hits.length}
    {#if !own}<p class="empty">{t('fanqie.none', { text })}</p>{/if}
  {:else}
    <p class="summary muted" role="status">{t('common.characters', { count: hits.length })}</p>
    <ol class="rows" role="listbox" aria-label={t('fanqie.label')}>
      {#each hits as hit, i (hit.char)}
        <li role="option" aria-selected={route.c === hit.char} class="row">
          <button type="button" class="pick" onclick={() => choose(hit.char)} ondblclick={() => put(hit.char, { place: i })}>
            <span class="tg glyph">{hit.char}</span>
            <span class="spell tg">{hit.spelling}</span>
            <span class="meta">{#if reading(hit.char)}<span class="say">{reading(hit.char)}</span>{/if}{#if hit.rhyme}<span class="muted"> · {t('card.rhyme')} {hit.rhyme}</span>{/if}</span>
            <span class="gl">{gloss(hit.char)}</span>
          </button>
          <button type="button" class="add btn ghost" aria-label={t('common.addToText', { char: hit.char })} title={t('common.add')} onclick={() => put(hit.char, { place: i })}>
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .fanqie{display:grid;gap:16px;max-width:900px}
  .intro{display:grid;gap:6px}
  h1{font-family:var(--serif);font-size:26px;font-weight:600}
  .intro p{font-size:13.5px;max-width:52em}
  .big{font-size:26px;padding:12px 16px;font-family:var(--tangut)}
  .choose{display:flex;align-items:center;gap:8px;font-size:13px}
  .choose .label{flex:0 0 auto;white-space:nowrap}
  .choose select{width:auto;padding:6px 10px;font-size:13px}
  .record{display:flex;align-items:center;gap:14px;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
  .own{font-size:34px;line-height:1}
  .own-spell{font-size:22px;color:var(--accent-ink)}
  .own-meta{display:flex;align-items:center;gap:6px;font-size:13px;margin-left:auto}
  .own-reading{font-family:var(--serif);font-size:15px;padding-left:8px}
  .say{font-family:var(--serif)}
  .hint{font-size:13.5px}
  .summary{font-size:12.5px}
  .rows{list-style:none;margin:0;padding:0;display:grid;gap:2px}
  .row{display:grid;grid-template-columns:1fr auto;align-items:center;border-radius:9px}
  .row:hover,.row[aria-selected="true"]{background:var(--hover)}
  .pick{display:grid;grid-template-columns:40px 90px minmax(0,1fr) minmax(0,1fr);align-items:center;gap:12px;padding:6px 8px;border:0;background:none;text-align:left;width:100%}
  .glyph{font-family:var(--tangut);font-size:30px;line-height:1}
  .spell{font-size:22px;line-height:1;color:var(--accent-ink)}
  .meta{font-size:12.5px}
  .gl{font-size:13px;color:var(--muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .add{opacity:0}
  .row:hover .add,.row:focus-within .add{opacity:1}
  .empty{padding:18px 0;color:var(--muted);font-size:14px}
</style>

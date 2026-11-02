<script>
  // Find: one box for whatever the reader has. Tangut text is split into its characters, each with
  // its gloss and reading, so a pasted line can be read character by character. Latin letters are
  // tried as a Cangjie code, a reading and an English meaning at once, each in its own group; a
  // code point opens its range; Chinese or Japanese is read as a meaning.
  import { db, ix, gloss, codePoint } from '../lib/db.svelte.js'
  import G from '../ui/G.svelte'
  import { route, setQuery, go, link } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus } from '../lib/ui.svelte.js'
  import { byCode, byMeaning, byCodePoint, tangutIn } from '../lib/search.js'
  import { searchReadings, SYSTEMS } from '../lib/reading.js'
  import { t } from '../lib/i18n.svelte.js'

  let query = $state(route.q)
  let active = $state(-1)
  const ready = $derived(db.status === 'ready')
  const text = $derived(query.trim())

  const groups = $derived.by(() => {
    if (!ready || !text) return []
    /** @type {{ key: string, title: string, page?: import('../lib/route.svelte.js').Page, total: number, items: { char: string, sub: string, extra?: string }[] }[]} */
    const out = []
    const chars = tangutIn(text)
    if (chars.length) {
      out.push({ key: 'text', title: chars.length === 1 ? t('find.group.character') : t('find.group.text'), total: chars.length,
        items: chars.map(char => ({ char, sub: gloss(char), extra: firstReading(char) })) })
      return out
    }
    const points = byCodePoint(text)
    if (points.length) out.push({ key: 'cp', title: t('find.group.codepoint'), total: points.length, items: points.slice(0, 48).map(char => ({ char, sub: codePoint(char) })) })
    if (/^[a-z]+$/i.test(text)) {
      const codes = byCode(text)
      if (codes.length) out.push({ key: 'code', title: t('find.group.cangjie'), page: 'cangjie', total: codes.length, items: codes.slice(0, 24).map(hit => ({ char: hit.char, sub: hit.code })) })
    }
    if (/^[\p{Script=Latin}\p{M}0-9ʔɦɨɪʉɯəɛɔɑŋɣʁɲʷⁿ'·.\- ]+$/u.test(text)) {
      const readings = searchReadings(ix.readings, text).filter(hit => hit.tier < 2)
      if (readings.length) out.push({ key: 'reading', title: t('find.group.reading'), page: 'reading', total: readings.length,
        items: readings.slice(0, 24).map(hit => ({ char: hit.char, sub: hit.readings[0].raw, extra: SYSTEMS.find(s => s.key === hit.readings[0].system)?.short })) })
    }
    const meanings = byMeaning(text)
    if (meanings.length) out.push({ key: 'meaning', title: t('find.group.meaning'), total: meanings.length, items: meanings.slice(0, 48).map(hit => ({ char: hit.char, sub: gloss(hit.char) })) })
    return out
  })
  /** The Li Fanwen reading, or the first system that has one, marked with its system. @param {string} char */
  function firstReading(char) {
    const readings = ix.byChar.get(char)?.pronunciations ?? {}
    const system = SYSTEMS.find(s => readings[s.key]?.trim())
    if (!system) return ''
    return system.key === 'li_fanwen' ? readings[system.key].trim() : `${readings[system.key].trim()} (${system.short})`
  }
  const flat = $derived(groups.flatMap(group => group.items))

  $effect(() => { void text; active = -1 })

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (!flat.length) return
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (step && !(event.key.startsWith('ArrowL') || event.key.startsWith('ArrowR')) || (step && active >= 0)) {
      event.preventDefault()
      active = Math.max(0, Math.min(flat.length - 1, active + step))
      preview(flat[active].char)
      document.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      put(flat[Math.max(0, active)].char, { place: Math.max(0, active) })
    }
  }

  const DOORS = /** @type {const} */ ([
    { page: 'cangjie', title: 'nav.cangjie', body: 'find.door.cangjie', glyph: '𗀀' },
    { page: 'sijiao', title: 'nav.sijiao', body: 'find.door.sijiao', glyph: '𗩤' },
    { page: 'reading', title: 'nav.reading', body: 'find.door.reading', glyph: '𗁤' },
    { page: 'draw', title: 'nav.draw', body: 'find.door.draw', glyph: '𗣳' },
    { page: 'parts', title: 'nav.parts', body: 'find.door.parts', glyph: '𘢰' },
  ])
</script>

<div class="ui-page find">
  <div class="search">
    <input class="ui-input" data-size="xl" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-label={t('find.label')} placeholder={t('find.placeholder')}
      oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }} onkeydown={keys} use:autofocus />
  </div>

  {#if !text}
    <section aria-label={t('nav.label')}>
      <div class="ui-index">
        {#each DOORS as door (door.page)}
          <a class="ui-index-link" href={link(door.page)} onclick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey) { event.preventDefault(); go(door.page) } }}>
            <span class="ui-index-glyph" aria-hidden="true">{door.glyph}</span>
            <span class="ui-index-text">
              <span class="ui-index-title">{t(door.title)}</span>
              <span class="ui-index-body">{t(door.body)}</span>
            </span>
            <span class="ui-index-arrow" aria-hidden="true">→</span>
          </a>
        {/each}
      </div>
    </section>
    <section class="tips">
      <p>{t('find.tip')}</p>
      <p class="examples"><span class="ui-hint">{t('find.try')}</span>
        <button type="button" class="ui-chip ui-script" lang="txg" onclick={() => { query = '𗋕𘏨𘜶𗤶𗜈𗧯𘔼'; setQuery(query) }}>𗋕𘏨𘜶𗤶𗜈𗧯𘔼</button>
        <button type="button" class="ui-chip" onclick={() => { query = 'tiger'; setQuery(query) }}>tiger</button>
        <button type="button" class="ui-chip" lang="zh-Hant" onclick={() => { query = '水'; setQuery(query) }}>水</button>
        <button type="button" class="ui-chip ui-mono" onclick={() => { query = 'U+1736'; setQuery(query) }}>U+1736</button>
      </p>
    </section>
  {:else if !ready}
    <p class="ui-empty">{t('common.loading')}</p>
  {:else if !groups.length}
    <p class="ui-empty">{t('find.none', { text })}</p>
  {:else}
    {#each groups as group, g (group.key)}
      {@const offset = groups.slice(0, g).reduce((sum, other) => sum + other.items.length, 0)}
      <section class="ui-section" aria-label={group.title}>
        <header class="ui-section-head">
          <h2 class="ui-label">{group.title}</h2>
          <span class="ui-count">{group.total > group.items.length ? t('common.of', { shown: group.items.length, total: group.total }) : group.total}</span>
          {#if group.page}<a class="ui-more-link" href={link(group.page, route.c, text)} onclick={event => { event.preventDefault(); const page = /** @type {import('../lib/route.svelte.js').Page} */ (group.page); go(page); setQuery(text) }}>{t('find.continue', { page: t(group.page === 'cangjie' ? 'nav.cangjie' : 'nav.reading') })}</a>{/if}
        </header>
        {#if group.key === 'text'}
          <ol class="ui-rows">
            {#each group.items as item, i (item.char)}
              <li class="ui-row" data-selected={offset + i === active || route.c === item.char}>
                <button type="button" data-index={offset + i} class="ui-row-pick gloss-row" aria-current={offset + i === active || route.c === item.char ? 'true' : undefined}
                  onclick={() => { active = offset + i; choose(item.char) }} ondblclick={() => put(item.char, { place: offset + i })}>
                  <G char={item.char} />
                  <span class="ui-row-said">{item.extra}</span>
                  <span class="ui-row-title">{item.sub || '—'}</span>
                </button>
              </li>
            {/each}
          </ol>
        {:else}
          <div class="ui-tiles" role="listbox" aria-label={group.title} style:--ui-tile-size="72px">
            {#each group.items as item, i (item.char)}
              <button type="button" role="option" class="ui-tile" data-index={offset + i} aria-selected={offset + i === active || (active < 0 && route.c === item.char)}
                title={gloss(item.char)} onclick={() => { active = offset + i; choose(item.char) }} ondblclick={() => put(item.char, { place: offset + i })}>
                <G char={item.char} /><span class="ui-tile-note">{item.extra ? `${item.extra} ` : ''}{item.sub}</span>
              </button>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .find{gap:var(--ui-space-3xl)}
  .tips{display:grid;gap:var(--ui-space-xs);font-size:var(--ui-text-sm)}
  .examples{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .examples .ui-script{font-size:17px}
  .gloss-row{grid-template-columns:44px 9rem minmax(0,1fr)}
  .gloss-row :global(.ui-script){font-size:32px;text-align:center}
  .gloss-row .ui-row-said{font-size:var(--ui-text-md)}
  .gloss-row .ui-row-title{font-size:var(--ui-text-md)}
  .ui-tile :global(.ui-script){font-size:calc(var(--ui-tile-size) * .52)}
  @media (max-width:900px){
    .gloss-row{grid-template-columns:38px 6.5rem minmax(0,1fr);gap:var(--ui-space-sm)}
    .gloss-row :global(.ui-script){font-size:28px}
  }
</style>

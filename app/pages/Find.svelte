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

<div class="find">
  <div class="search">
    <input class="field big" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-label={t('find.label')} placeholder={t('find.placeholder')}
      oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }} onkeydown={keys} use:autofocus />
  </div>

  {#if !text}
    <section class="doors" aria-label={t('nav.label')}>
      {#each DOORS as door (door.page)}
        <a class="door" href={link(door.page)} onclick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey) { event.preventDefault(); go(door.page) } }}>
          <span class="tg big-glyph" aria-hidden="true">{door.glyph}</span>
          <span class="title">{t(door.title)}</span>
          <span class="body">{t(door.body)}</span>
        </a>
      {/each}
    </section>
    <section class="tips">
      <p>{t('find.tip')}</p>
      <p class="muted">{t('find.try')} <button type="button" class="chip" onclick={() => { query = '𗋕𘏨𘜶𗤶𗜈𗧯𘔼'; setQuery(query) }}><span class="tg">𗋕𘏨𘜶𗤶𗜈𗧯𘔼</span></button>
        <button type="button" class="chip" onclick={() => { query = 'tiger'; setQuery(query) }}>tiger</button>
        <button type="button" class="chip" onclick={() => { query = '水'; setQuery(query) }}>水</button>
        <button type="button" class="chip mono" onclick={() => { query = 'U+1736'; setQuery(query) }}>U+1736</button></p>
    </section>
  {:else if !ready}
    <p class="empty">{t('common.loading')}</p>
  {:else if !groups.length}
    <p class="empty">{t('find.none', { text })}</p>
  {:else}
    {#each groups as group, g (group.key)}
      {@const offset = groups.slice(0, g).reduce((sum, other) => sum + other.items.length, 0)}
      <section class="group" aria-label={group.title}>
        <header>
          <h2 class="label">{group.title}</h2>
          <span class="muted">{group.total > group.items.length ? t('common.of', { shown: group.items.length, total: group.total }) : group.total}</span>
          {#if group.page}<a class="more" href={link(group.page, route.c, text)} onclick={event => { event.preventDefault(); const page = /** @type {import('../lib/route.svelte.js').Page} */ (group.page); go(page); setQuery(text) }}>{t('find.continue', { page: t(group.page === 'cangjie' ? 'nav.cangjie' : 'nav.reading') })}</a>{/if}
        </header>
        {#if group.key === 'text'}
          <ol class="gloss-list" role="listbox" aria-label={group.title}>
            {#each group.items as item, i (item.char)}
              <li role="presentation">
                <button type="button" role="option" data-index={offset + i} class="gl-row" aria-selected={offset + i === active || route.c === item.char}
                  onclick={() => { active = offset + i; choose(item.char) }} ondblclick={() => put(item.char, { place: offset + i })}>
                  <G char={item.char} />
                  <span class="r">{item.extra}</span>
                  <span class="m">{item.sub || '—'}</span>
                </button>
              </li>
            {/each}
          </ol>
        {:else}
          <div class="tiles" role="listbox" aria-label={group.title}>
            {#each group.items as item, i (item.char)}
              <button type="button" role="option" class="tile" data-index={offset + i} aria-selected={offset + i === active || (active < 0 && route.c === item.char)}
                title={gloss(item.char)} onclick={() => { active = offset + i; choose(item.char) }} ondblclick={() => put(item.char, { place: offset + i })}>
                <G char={item.char} /><small>{item.extra ? `${item.extra} ` : ''}{item.sub}</small>
              </button>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .find{display:grid;gap:22px;max-width:980px}
  .big{font-size:20px;padding:14px 18px;border-radius:14px}
  .doors{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .door{position:relative;display:grid;gap:4px;padding:18px 20px 18px 96px;min-height:108px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);text-decoration:none;box-shadow:var(--shadow)}
  .door:hover{border-color:var(--accent)}
  .big-glyph{position:absolute;left:20px;top:18px;display:grid;place-items:center;width:58px;height:58px;border-radius:10px;background:var(--bg);font-size:40px;color:var(--ink-2)}
  .door:hover .big-glyph{background:var(--accent-soft);color:var(--accent-ink)}
  .title{font-family:var(--serif);font-size:19px;font-weight:600}
  .body{font-size:13px;color:var(--ink-2)}
  .tips{display:grid;gap:8px;font-size:13.5px}
  .tips .muted{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .tips :global(.tg){font-size:17px}
  .group{display:grid;gap:10px}
  .group header{display:flex;align-items:baseline;gap:10px}
  .group header span{font-size:12px}
  .more{margin-left:auto;font-size:13px}
  .tiles{--tile:72px}
  .gloss-list{list-style:none;margin:0;padding:0;display:grid;gap:2px}
  .gl-row{width:100%;display:grid;grid-template-columns:56px 110px 1fr;align-items:center;gap:14px;padding:6px 10px;border:1px solid transparent;border-radius:10px;background:var(--surface);text-align:left}
  .gl-row:hover{background:var(--raised)}
  .gl-row[aria-selected="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
  .gl-row :global(.tg){font-size:36px;text-align:center}
  .gl-row .r{font-family:var(--serif);font-size:15px;color:var(--ink-2)}
  .gl-row .m{font-size:14px}
  @media (max-width:900px){
    .doors{grid-template-columns:1fr}
    .door{padding:14px 14px 14px 84px;min-height:0}
    .big-glyph{left:14px;top:14px;width:54px;height:54px}
    .gl-row{grid-template-columns:44px 80px 1fr;gap:10px}
  }
</style>

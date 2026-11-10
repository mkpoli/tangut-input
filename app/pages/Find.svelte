<script>
  // Find: one box for whatever the reader has. Tangut text is split into its characters, each with
  // its gloss and reading, so a pasted line can be read character by character. Latin letters are
  // tried as a Cangjie code, a reading and an English meaning at once, each in its own group; a
  // code point opens its range; Chinese or Japanese is read as a meaning.
  import { tick } from 'svelte'
  import { db, ix, gloss, codePoint, readingOf } from '../lib/db.svelte.js'
  import G from '../ui/G.svelte'
  import TileNote from '../ui/TileNote.svelte'
  import Icon from '../ui/Icon.svelte'
  import { route, setQuery, go, link } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus, ui } from '../lib/ui.svelte.js'
  import { byCode, byName, byShapeSpelling, byMeaning, byCodePoint, byDescription, byTibetan, byIdentifier, byTibetanSeta, byTangutPua, byUnencodedPua, byEncodedPua, tangutIn } from '../lib/search.js'
  import { searchReadings, SYSTEMS } from '../lib/reading.js'
  import { t } from '../lib/i18n.svelte.js'
  import { parseIdentifier } from '../lib/identifiers.js'
  import { parseSetaQuery } from '../lib/seta.js'
  import { parsePuaQuery, puaCharacter } from '../lib/pua.js'

  let query = $state(route.q)
  let active = $state(-1)
  const ready = $derived(db.status === 'ready')
  const text = $derived(query.trim())

  const groups = $derived.by(() => {
    if (!ready || !text) return []
    /** @type {{ key: string, title: string, page?: import('../lib/route.svelte.js').Page, total: number, shown?: number, items: { char: string, sub: string, extra?: string, sound?: string, tibetan?: boolean }[], pua?: { code: string, ids: string, sources: string[], point?: string, char?: string } }[]} */
    const out = []
    // A whole description or its opening is read against both recorded and editorial forms.
    const described = byDescription(text)
    if (described.length) {
      out.push({ key: 'description', title: t('find.group.description'), total: described.length,
        items: described.map(char => ({ char, sub: gloss(char) })) })
      return out
    }
    const chars = tangutIn(text)
    if (chars.length) {
      out.push({ key: 'text', title: chars.length === 1 ? t('find.group.character') : t('find.group.text'), total: chars.length,
        items: chars.map(char => ({ char, sub: gloss(char), extra: firstReading(char) })) })
      return out
    }
    // A Tangut PUA code is a five-digit private-use code; the encoded block is not in its range.
    const puaQuery = parsePuaQuery(text)
    if (puaQuery) {
      const pua = byTangutPua(text).sort((a, b) => (ix.frequency.get(b.char) ?? 0) - (ix.frequency.get(a.char) ?? 0) || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
      if (pua.length) out.push({ key: 'pua', title: `${t('find.group.pua')} · ${puaQuery}`, total: pua.length,
        items: pua.slice(0, 24).map(hit => ({ char: hit.char, sub: gloss(hit.char) })) })
      const unencoded = byUnencodedPua(text)
      if (unencoded) out.push({ key: 'pua-unencoded', title: `${t('find.group.pua')} · ${puaQuery}`, total: 1, shown: 1, items: [], pua: unencoded })
      const encoded = byEncodedPua(text)
      if (encoded) out.push({ key: 'pua-encoded', title: `${t('find.group.pua')} · ${puaQuery}`, total: 1, shown: 1, items: [], pua: encoded })
      return out
    }
    // A Set A code is a whole answer: its digits and Latin letters are not also a reading.
    const setaQuery = parseSetaQuery(text)
    if (setaQuery) {
      const seta = byTibetanSeta(text).sort((a, b) => (ix.frequency.get(b.char) ?? 0) - (ix.frequency.get(a.char) ?? 0) || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
      if (seta.length) out.push({ key: 'seta', title: `${t('find.group.seta')} · ${setaQuery}`, total: seta.length,
        items: seta.slice(0, 24).map(hit => ({ char: hit.char, sub: gloss(hit.char), sound: hit.script, tibetan: true })) })
      return out
    }
    // An identifier is a whole answer: its Latin letters and digits are not also a reading or a code.
    if (parseIdentifier(text)) {
      const identified = byIdentifier(text).sort((a, b) => (ix.frequency.get(b.char) ?? 0) - (ix.frequency.get(a.char) ?? 0) || (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0))
      if (identified.length) {
        const first = identified[0]
        const system = `${t(`card.identifier.${first.scheme}`)}${first.edition ? ` ${first.edition}` : ''}`
        out.push({ key: 'identifier', title: `${t('find.group.identifier')} · ${system}`, total: identified.length,
          items: identified.slice(0, 24).map(hit => ({ char: hit.char, sub: hit.value })) })
      }
      return out
    }
    const points = byCodePoint(text)
    if (points.length) out.push({ key: 'cp', title: t('find.group.codepoint'), total: points.length, items: points.slice(0, 48).map(char => ({ char, sub: codePoint(char) })) })
    const named = byName(text)
    if (named.length) out.push({ key: 'shape', title: t('find.group.shape'), total: named.length, items: named.slice(0, 24).map(hit => ({ char: hit.char, sub: hit.name })) })
    const shapeSpelled = byShapeSpelling(text)
    if (shapeSpelled.length) out.push({ key: 'spelling', title: t('find.group.spelling'), total: shapeSpelled.length, items: shapeSpelled.slice(0, 24).map(hit => ({ char: hit.char, sub: hit.spelling })) })
    if (/^[a-z]+$/i.test(text)) {
      const codes = byCode(text)
      if (codes.length) out.push({ key: 'code', title: t('find.group.cangjie'), page: 'cangjie', total: codes.length, items: codes.slice(0, 24).map(hit => ({ char: hit.char, sub: hit.code })) })
    }
    if (/^[\p{Script=Latin}\p{M}0-9ʔɦɨɪʉɯəɛɔɑŋɣʁɲʷⁿ'·.\- ]+$/u.test(text)) {
      const readings = searchReadings(ix.readings, text, { frequency: ix.frequency, hidden: ix.hiddenReadings }).filter(hit => hit.tier < 2)
      if (readings.length) out.push({ key: 'reading', title: t('find.group.reading'), page: 'reading', total: readings.length,
        items: readings.slice(0, 24).map(hit => {
          if (hit.via === 'ccamc') return { char: hit.char, sub: 'CCAMC' }
          const reading = hit.readings.find(reading => reading.system === ui.reading) ?? hit.readings[0]
          const system = SYSTEMS.find(s => s.key === reading.system)
          const tag = system && system.key !== ui.reading ? ` (${system.tag})` : ''
          return { char: hit.char, sub: gloss(hit.char), sound: `${reading.raw}${tag}` }
        }) })
    }
    const spelled = byTibetan(text).filter(hit => hit.tier === 0 || /[\u0f40-\u0fbc]/.test(text))
    if (spelled.length) out.push({ key: 'tibetan', title: t('find.group.tibetan'), total: spelled.length, items: spelled.slice(0, 24).map(hit => ({ char: hit.char, sub: gloss(hit.char), sound: hit.shown, tibetan: true })) })
    const meanings = byMeaning(text)
    if (meanings.length) out.push({ key: 'meaning', title: t('find.group.meaning'), total: meanings.length, items: meanings.slice(0, 48).map(hit => ({ char: hit.char, sub: gloss(hit.char) })) })
    return out
  })
  /** The Li Fanwen reading, or the first system that has one, marked with its system. @param {string} char */
  function firstReading(char) {
    const readings = ix.byChar.get(char)?.pronunciations ?? {}
    if (readings[ui.reading]?.trim()) return readings[ui.reading].trim()
    const system = SYSTEMS.find(s => readings[s.key]?.trim())
    return system ? `${readings[system.key].trim()} (${system.tag})` : ''
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
    { page: 'cangjie', icon: 'cangjie', title: 'nav.cangjie', body: 'find.door.cangjie', glyph: '𗀀' },
    { page: 'sijiao', icon: 'sijiao', title: 'nav.sijiao', body: 'find.door.sijiao', glyph: '𗩤' },
    { page: 'draw', icon: 'draw', title: 'nav.draw', body: 'find.door.draw', glyph: '𗣳' },
    { page: 'parts', icon: 'parts', title: 'nav.parts', body: 'find.door.parts', glyph: '𘢰' },
    { page: 'fanqie', icon: 'fanqie', title: 'nav.fanqie', body: 'find.door.fanqie', glyph: '𘓐' },
    { page: 'chart', icon: 'chart', title: 'nav.chart', body: 'find.door.chart', glyph: '𘛽' },
    { page: 'reading', icon: 'reading', title: 'nav.reading', body: 'find.door.reading', glyph: '𗁤' },
    { page: 'transcribe', icon: 'transcribe', title: 'nav.transcribe', body: 'find.door.transcribe', glyph: '𗹱' },
    { page: 'meaning', icon: 'meaning', title: 'nav.meaning', body: 'find.door.meaning', glyph: '𗼇' },
  ])

  /** @type {{ value: string, script?: boolean, lang?: string, mono?: boolean, ids?: boolean }[]} */
  const EXAMPLES = [
    { value: '𗋕𘏨𘜶𗤶𗜈𗧯𘔼', script: true },
    { value: 'tiger', lang: 'en' },
    { value: '水', lang: 'zh-Hant' },
    { value: 'みず', lang: 'ja' },
    { value: 'wind', lang: 'en' },
    { value: 'msb', mono: true },
    { value: 'ndzi', mono: true },
    { value: 'U+1736', mono: true },
    { value: 'L0009', mono: true },
    { value: 'U+F5C0', mono: true },
    { value: 'U+F02BB', mono: true },
    { value: '⿰𘤊', ids: true },
  ]
</script>

<div class="ui-page find">
  <div class="search">
    <input class="ui-input" data-size="xl" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-label={t('find.label')} placeholder={t('find.placeholder')}
      oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }} onkeydown={keys} use:autofocus />
  </div>

  {#if !text}
    <section class="try" aria-label={t('find.try')}>
      <span class="ui-hint">{t('find.try')}</span>
      {#each EXAMPLES as example (example.value)}
        <button type="button" class="ui-chip" class:ui-script={example.script} class:ui-mono={example.mono} class:ui-ids={example.ids}
          lang={example.lang ?? (example.script ? 'txg' : undefined)}
          onclick={() => { query = example.value; setQuery(query) }}>{example.value}</button>
      {/each}
    </section>
    <section aria-label={t('nav.label')}>
      <div class="ui-index">
        {#each DOORS as door (door.page)}
          <a class="ui-index-link" href={link(door.page)} onclick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey) { event.preventDefault(); go(door.page) } }}>
            <span class="ui-index-glyph" aria-hidden="true">{door.glyph}</span>
            <span class="ui-index-text">
              <span class="ui-index-title"><Icon name={door.icon} size={16}/>{t(door.title)}</span>
              <span class="ui-index-body">{t(door.body)}</span>
            </span>
            <span class="ui-index-arrow" aria-hidden="true">→</span>
          </a>
        {/each}
      </div>
    </section>
    <p class="tip">{t('find.tip')}</p>
  {:else if !ready}
    <p class="ui-empty">{t('common.loading')}</p>
  {:else if !groups.length}
    <p class="ui-empty">{t('find.none', { text })}</p>
  {:else}
    {#each groups as group, g (group.key)}
      {@const offset = groups.slice(0, g).reduce((sum, other) => sum + other.items.length, 0)}
      {@const shown = group.shown ?? group.items.length}
      <section class="ui-section" aria-label={group.title}>
        <header class="ui-section-head">
          <h2 class="ui-label">{group.title}</h2>
          <span class="ui-count">{group.total > shown ? t('common.of', { shown, total: group.total }) : group.total}</span>
          {#if group.page}<a class="ui-more-link" href={link(group.page, route.c, text)} onclick={event => { event.preventDefault(); const page = /** @type {import('../lib/route.svelte.js').Page} */ (group.page); go(page); setQuery(text) }}>{t('find.continue', { page: t(group.page === 'cangjie' ? 'nav.cangjie' : 'nav.reading') })}<Icon name="arrow" size={13}/></a>{/if}
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
        {:else if group.key === 'pua-unencoded' && group.pua}
          <div class="pua-hit">
            <span class="pua-hit-glyph" lang="txg" aria-hidden="true">{puaCharacter(group.pua.code)}</span>
            <div class="pua-hit-text">
              <span class="pua-hit-code ui-mono">{group.pua.code}</span>
              <span class="ui-formula pua-hit-ids" title={group.pua.ids}>{group.pua.ids}</span>
              <span class="ui-hint">{group.pua.sources.length ? group.pua.sources.join(' · ') : t('variants.puaNoSource')}</span>
              <a class="ui-more-link" href={link('variants') + '#pua'} onclick={async event => { event.preventDefault(); go('variants'); await tick(); location.hash = 'pua' }}>{t('card.puaVariants')}<Icon name="arrow" size={13}/></a>
            </div>
          </div>
        {:else if group.key === 'pua-encoded' && group.pua}
          <div class="pua-hit">
            <span class="pua-hit-glyph"><G char={group.pua.char ?? ''} /></span>
            <div class="pua-hit-text">
              <span class="pua-hit-code ui-mono">{group.pua.code} → {group.pua.point}</span>
              <span class="ui-formula pua-hit-ids" title={group.pua.ids}>{group.pua.ids}</span>
              <span class="ui-hint">{group.pua.sources.length ? group.pua.sources.join(' · ') : t('variants.puaNoSource')}</span>
              <button class="ui-more-link" type="button" onclick={() => choose(group.pua?.char ?? '')}>{t('find.openCharacter')}<Icon name="arrow" size={13}/></button>
            </div>
          </div>
        {:else}
          <div class="ui-tiles" role="listbox" aria-label={group.title} style:--ui-tile-size="72px">
            {#each group.items as item, i (item.char)}
              {@const sound = item.sound ?? readingOf(item.char, ui.reading)}
              <button type="button" role="option" class="ui-tile" data-index={offset + i} aria-selected={offset + i === active || (active < 0 && route.c === item.char)}
                title={gloss(item.char)} onclick={() => { active = offset + i; choose(item.char) }} ondblclick={() => put(item.char, { place: offset + i })}>
                <G char={item.char} />{#if sound}<span class="ui-tile-sound" lang={item.tibetan ? 'bo' : undefined}>{sound}</span>{/if}<TileNote char={item.char} text={item.sub} />
              </button>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .find{gap:var(--ui-space-2xl)}
  .try{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs);margin-top:calc(-1 * var(--ui-space-lg))}
  .try .ui-script{font-size:17px}
  .try .ui-ids{font-family:var(--ui-font-ids);font-size:17px}
  .tip{font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
  .gloss-row{grid-template-columns:44px 9rem minmax(0,1fr)}
  .gloss-row :global(.ui-script){font-size:32px;text-align:center}
  .gloss-row .ui-row-said{font-size:var(--ui-text-md)}
  .gloss-row .ui-row-title{font-size:var(--ui-text-md)}
  .ui-tile :global(.ui-script){font-size:calc(var(--ui-tile-size) * .52)}
  @media (max-width:900px){
    .gloss-row{grid-template-columns:38px 6.5rem minmax(0,1fr);gap:var(--ui-space-sm)}
    .gloss-row :global(.ui-script){font-size:28px}
  }
  .pua-hit{display:flex;max-width:720px;align-items:flex-start;gap:var(--ui-space-md);padding:var(--ui-space-md);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface)}
  .pua-hit-glyph{font-family:'Tangut PUA',var(--tg-font);font-size:64px;line-height:1;color:var(--ui-color-ink)}
  .pua-hit-text{display:flex;flex-direction:column;align-items:flex-start;gap:var(--ui-space-2xs);min-width:0}
  .pua-hit-code{color:var(--ui-color-accent-ink)}
  .pua-hit-ids{font-size:18px;line-height:1.5}
  .pua-hit .ui-more-link{border:0;background:none;padding:0;font:inherit;font-size:var(--ui-text-xs);color:var(--ui-color-accent-ink);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  .ui-tile-sound[lang='bo']{font-family:'Noto Serif Tibetan','Noto Sans Tibetan',Kailasa,'Microsoft Himalaya','Jomolhari',serif;font-size:14px;line-height:1.7;overflow:visible;text-overflow:clip;flex:none}
</style>

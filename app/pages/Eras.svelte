<script>
  // The era names of the Western Xia in order, each with its Tangut form where one is recorded and
  // what the form rests on: a coin, a Tangut text, only the calendar the list is built from, or a post.
  // The data is `app/data/tangut-eras.json`, built by `scripts/build_tangut_eras.py`. Below them, the
  // imperial titles, from `app/data/tangut-titles.json`, each marked by what its Tangut rests on, and
  // the posthumous, temple and tomb names of 宋史, from `app/data/tangut-posthumous.json`, and the
  // names of the state, from `app/data/tangut-state-names.json`, and later era names, from
  // `app/data/tangut-later-eras.json`.
  import { onMount, tick } from 'svelte'
  import ERAS from '../data/tangut-eras.json' with { type: 'json' }
  import COINS from '../data/tangut-coins.json' with { type: 'json' }
  import TITLES from '../data/tangut-titles.json' with { type: 'json' }
  import POSTHUMOUS from '../data/tangut-posthumous.json' with { type: 'json' }
  import STATE_NAMES from '../data/tangut-state-names.json' with { type: 'json' }
  import LATER_ERAS from '../data/tangut-later-eras.json' with { type: 'json' }
  import CONTEMPORARY_ERAS from '../data/tangut-contemporary-eras.json' with { type: 'json' }
  import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../lib/era-sources.js'
  import { choose } from '../lib/ui.svelte.js'
  import { hex } from '../lib/db.svelte.js'
  import { route } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'
  import Icon from '../ui/Icon.svelte'

  /** @typedef {{ era: string, from: string, to: string | null, years: [number, number | null], calendar: string[], evidence: { tangut: string, kind: string, source: string }[] }} Era */

  /** @param {string} key */
  const number = key => ERA_SOURCE_ORDER.indexOf(/** @type {keyof typeof ERA_SOURCES} */ (key)) + 1

  /**
   * What an era's form rests on: one tag for each kind of evidence, with its sources, or the
   * calendar alone. The build keeps every backed form among the calendar's, so those and the forms of
   * a post, which may differ, are the forms.
   * @param {Era} era
   */
  function basis(era) {
    const tags = ['coin', 'text', 'disputed'].flatMap(kind => {
      const rows = era.evidence.filter(e => e.kind === kind)
      return rows.length ? [{ kind, sources: [...new Set(rows.map(e => e.source))] }] : []
    })
    if (!tags.length && era.calendar.length) tags.push({ kind: 'calendar', sources: ['calendar'] })
    const posted = era.evidence.filter(e => e.kind === 'post')
    if (posted.length) tags.push({ kind: 'post', sources: [...new Set(posted.map(e => e.source))] })
    if (!tags.length) tags.push({ kind: 'none', sources: [] })
    return {
      tags,
      forms: [...new Set([...era.calendar, ...posted.map(e => e.tangut)])],
      doubt: era.evidence.find(e => e.kind === 'unknown'),
      gloss: [...new Set(era.evidence.filter(e => e.kind === 'gloss').map(e => e.source))],
    }
  }

  /** @param {Era} era */
  const years = era => era.years[1] === null ? `${era.years[0]}–` : era.years[0] === era.years[1] ? `${era.years[0]}` : `${era.years[0]}–${era.years[1]}`

  const rows = (/** @type {Era[]} */ (ERAS)).map(era => ({ era, ...basis(era) }))
  const counts = {
    total: rows.length,
    forms: rows.filter(row => row.forms.length).length,
    clear: rows.filter(row => row.tags.some(tag => tag.kind === 'coin' || tag.kind === 'text') && !row.tags.some(tag => tag.kind === 'disputed')).length,
    disputed: rows.filter(row => row.tags.some(tag => tag.kind === 'disputed')).length,
  }

  const coinCharacters = new Map(COINS.characters.map(row => [row.char, row]))
  /** @param {string} inscription */
  const coinReading = inscription => [...inscription].map(char => coinCharacters.get(char)?.reading).join(' ')

  /** Group names that label the same inscription. @param {Coin} coin */
  function legends(coin) {
    return [...new Set(coin.interpretations.map(row => row.tangut))].map(tangut => ({
      tangut,
      names: coin.interpretations.filter(row => row.tangut === tangut).map(row => row.name).join(' / '),
    }))
  }

  // The images West prints for a coin: a photograph of a specimen, or his drawing of the inscription
  // as he reads it. They are shown on hover and from the row's button; a click pins the panel so a
  // touch reader can keep it open. The files stay on his server and load from there.
  /** @typedef {(typeof COINS.coins)[number]} Coin */
  /** @typedef {Coin['images'][number]} CoinImage */
  /** @type {{ coin: Coin, anchor: HTMLElement, pinned: boolean, sheet: boolean, left: number, top: number } | null} */
  let preview = $state(null)
  /** @type {Record<string, boolean>} */
  let failedImages = $state({})
  /** @type {Record<string, boolean>} */
  let loadedImages = $state({})
  /** @type {HTMLElement | null} */
  let panel = $state(null)
  /** @type {HTMLButtonElement | null} */
  let closeButton = $state(null)
  let closeTimer = 0
  let hoverMutedUntil = 0
  let refocusing = false
  const PANEL_WIDTH = 320
  const narrowScreen = () => matchMedia('(max-width: 900px)').matches
  const coinSource = ERA_SOURCES[/** @type {keyof typeof ERA_SOURCES} */ (COINS.source)]

  /** @param {string} text */
  const isChinese = text => /[\u3400-\u9FFF]/.test(text)

  /** @param {CoinImage} image */
  const imageAlt = image => t(image.kind === 'photograph' ? 'eras.coins.image.photographAlt' : 'eras.coins.image.drawingAlt')

  function placePreview() {
    if (!preview || preview.sheet) return
    const width = PANEL_WIDTH
    const rect = preview.anchor.getBoundingClientRect()
    const edge = preview.anchor.closest('.ui-table-wrap')?.getBoundingClientRect().right ?? rect.right
    const beside = rect.right + 12
    preview.left = edge + 12 + width <= innerWidth - 8 ? edge + 12
      : beside + width <= innerWidth - 8 ? beside
      : Math.max(8, rect.left - width - 12)
    preview.top = Math.max(8, Math.min(rect.top, innerHeight - 474))
  }

  // The panel's height depends on how many images it holds, so settle it inside the viewport once it
  // is rendered.
  $effect(() => {
    if (!preview || preview.sheet || !panel) return
    const rect = panel.getBoundingClientRect()
    const overflow = rect.bottom - (innerHeight - 8)
    if (overflow > 0) preview.top = Math.max(8, preview.top - overflow)
  })

  /** @param {Coin} coin @param {HTMLElement} anchor @param {boolean} pinned */
  function openPreview(coin, anchor, pinned) {
    clearTimeout(closeTimer)
    failedImages = {}
    for (const image of coin.images) new Image().src = image.src
    preview = { coin, anchor, pinned, sheet: narrowScreen(), left: 0, top: 0 }
    placePreview()
  }

  function closePreview() {
    clearTimeout(closeTimer)
    const anchor = preview?.anchor
    const refocus = Boolean(anchor && panel?.contains(document.activeElement))
    preview = null
    if (anchor && refocus) {
      // Focusing the trigger fires its focus handler, which would open the panel again.
      refocusing = true
      anchor.focus()
      refocusing = false
    }
  }

  /** Leave after a moment, so the pointer can cross the gap into the panel. */
  function leavePreview() {
    if (preview?.pinned) return
    clearTimeout(closeTimer)
    closeTimer = window.setTimeout(closePreview, 180)
  }

  /** @param {PointerEvent} event @param {Coin} coin */
  function hoverPreview(event, coin) {
    // A narrow screen opens the sheet on a click or tap; hovering it would put the sheet over the
    // button, so the click could never arrive.
    if (narrowScreen() || Date.now() < hoverMutedUntil || event.pointerType !== 'mouse'
      || preview?.pinned || preview?.coin.id === coin.id) return
    const anchor = /** @type {HTMLElement | null} */ (event.currentTarget instanceof Element ? event.currentTarget.querySelector('[data-coin-preview-trigger]') : null)
    if (anchor) openPreview(coin, anchor, false)
  }

  // The panel can sit over other rows; closing it would otherwise reveal another row under the
  // pointer and open its images at once.
  function closeFromPanel() {
    closePreview()
    hoverMutedUntil = Date.now() + 300
  }

  /** @param {MouseEvent} event @param {Coin} coin */
  function togglePreview(event, coin) {
    event.stopPropagation()
    if (preview?.coin.id === coin.id && preview.pinned) { closePreview(); return }
    openPreview(coin, /** @type {HTMLElement} */ (event.currentTarget), true)
    // A keyboard activation moves focus into the panel; a mouse click leaves it on the trigger.
    if (event.detail === 0) tick().then(() => closeButton?.focus())
  }

  /** @param {FocusEvent} event @param {Coin} coin */
  function focusPreview(event, coin) {
    // A touch tap focuses the button, and the sheet would then swallow the tap.
    if (refocusing || narrowScreen() || preview?.coin.id === coin.id) return
    openPreview(coin, /** @type {HTMLElement} */ (event.currentTarget), false)
  }

  /** The parts of the page the tab bar moves between, in their order down the page. */
  const tabs = [
    { id: 'eras', key: 'eras.tab.eras', count: rows.length },
    { id: 'coins', key: 'eras.coins.title', count: COINS.coins.length },
    { id: 'contemporary-eras', key: 'eras.contemporary.tab', count: CONTEMPORARY_ERAS.length },
    { id: 'titles', key: 'eras.tab.titles', count: TITLES.length },
    { id: 'posthumous', key: 'eras.tab.posthumous', count: POSTHUMOUS.length },
    { id: 'states', key: 'eras.tab.states', count: STATE_NAMES.length },
    { id: 'later-eras', key: 'eras.tab.later', count: LATER_ERAS.length },
  ]
  const KINDS = ['coin', 'text', 'disputed', 'calendar', 'post', 'none']
  const kindCounts = Object.fromEntries(KINDS.map(kind => [kind, rows.filter(row => row.tags.some(tag => tag.kind === kind)).length]))
  const TITLE_BASES = ['text', 'reported', 'chinese']
  const titleBasisCounts = Object.fromEntries(TITLE_BASES.map(basis => [basis, TITLES.filter(title => title.basis === basis).length]))
  const glossSources = [...new Set(rows.flatMap(row => row.gloss))]
  const doubtSources = [...new Set(rows.flatMap(row => row.doubt ? [row.doubt.source] : []))]

  // The tab under the bar is the last section whose top has passed below it. A click sets the tab
  // at once, and the scroll listener keeps it right once the page settles.
  let current = $state('eras')
  /** @type {HTMLElement | null} */
  let toc = $state(null)
  let frame = 0

  function sync() {
    if (!toc) return
    const threshold = toc.getBoundingClientRect().bottom + 24
    let active = tabs[0].id
    for (const tab of tabs) {
      const section = document.getElementById(tab.id)
      if (section && section.getBoundingClientRect().top <= threshold) active = tab.id
    }
    current = active
  }

  onMount(() => {
    sync()
    const onViewport = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        sync()
        if (!preview) return
        preview.sheet = narrowScreen()
        placePreview()
        if (preview.sheet) return
        const rect = preview.anchor.getBoundingClientRect()
        if (!preview.pinned && (rect.bottom < 0 || rect.top > innerHeight)) closePreview()
      })
    }
    const onKey = (/** @type {KeyboardEvent} */ event) => { if (event.key === 'Escape' && preview) closePreview() }
    const onPointerDown = (/** @type {PointerEvent} */ event) => {
      if (!preview?.pinned) return
      const target = event.target
      if (!(target instanceof Element) || panel?.contains(target) || target.closest('[data-coin-preview-trigger]')) return
      closePreview()
    }
    addEventListener('scroll', onViewport, { passive: true })
    addEventListener('resize', onViewport)
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onPointerDown, true)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(closeTimer)
      removeEventListener('scroll', onViewport)
      removeEventListener('resize', onViewport)
      removeEventListener('keydown', onKey)
      removeEventListener('pointerdown', onPointerDown, true)
    }
  })
</script>

{#snippet titleTable(/** @type {typeof TITLES} */ rows)}
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('eras.titles.holder')}</th><th scope="col">{t('eras.tangut')}</th><th scope="col">{t('eras.titles.chinese')}</th><th scope="col">{t('eras.basis')}</th></tr></thead>
        <tbody>
          {#each rows as title (`${title.holder} ${title.tangut || title.chinese}`)}
            <tr>
              <th scope="row" lang="zh-Hant">{title.holder}{#if title.identified === 'dated'}<span class="inferred" title={t('eras.titles.dated')} aria-label={t('eras.titles.dated')}>*</span>{:else if title.identified === 'disputed'}<span class="inferred" title={t('eras.titles.disputed')} aria-label={t('eras.titles.disputed')}>?</span>{:else if title.identified === 'caption'}<span class="inferred" title={t('eras.titles.caption')} aria-label={t('eras.titles.caption')}>†</span>{:else if title.identified === 'decoded'}<span class="inferred" title={t('eras.titles.decoded')} aria-label={t('eras.titles.decoded')}>‡</span>{:else if title.identified === 'codes'}<span class="inferred" title={t('eras.titles.codes')} aria-label={t('eras.titles.codes')}>§</span>{/if}</th>
              <td class="forms title-form" data-empty={!title.tangut || undefined}>{#if title.tangut}<span class="form" role="group" aria-label={title.tangut}>{#each [...title.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>{@render cites(title.tangutSources)}{:else}<span class="ui-hint">—</span>{/if}</td>
              <td class="chinese">{#if title.chinese}<span lang="zh">{title.chinese}</span>{@render cites(title.chineseSources)}{:else}<span class="ui-hint">—</span>{/if}</td>
              <td class="basis"><span class="tag" data-kind={title.basis}>{t(`eras.titles.basis.${title.basis}`)}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
{/snippet}

{#snippet cites(/** @type {string[]} */ sources)}
  {#if sources.length}<sup class="cite">{#each sources as key, i (key)}{#if i},{/if}<a href={`#era-source-${number(key)}`} aria-label={t('eras.cite', { n: number(key) })}>{number(key)}</a>{/each}</sup>{/if}
{/snippet}

<article class="ui-page eras">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="eras" size={22}/><span>{t('eras.title')}</span></h1>
    <p class="ui-page-intro">{t('eras.intro')}</p>
  </header>

  <nav class="ui-toc" bind:this={toc} aria-label={t('eras.toc')}>
    {#each tabs as tab (tab.id)}
      <a href={`#${tab.id}`} onclick={() => { current = tab.id }} aria-current={current === tab.id ? 'true' : undefined}>
        <span>{t(tab.key)}</span><span class="ui-count">{tab.count}</span>
      </a>
    {/each}
  </nav>

  <p class="summary">
    <span><strong>{counts.forms}</strong>{t('eras.forms')}</span>
    <span><strong>{counts.clear}</strong>{t('eras.clear')}</span>
    <span><strong>{counts.disputed}</strong>{t('eras.disputed')}</span>
  </p>

  <section class="ui-section" id="eras">
    <h2 class="heading">{t('eras.tab.eras')}<span class="ui-count">{rows.length}</span></h2>
    <ul class="key" aria-label={t('eras.basis')}>
      {#each KINDS as kind (kind)}
        <li title={t(`eras.kind.${kind}.hint`)}><span class="tag" data-kind={kind}>{t(`eras.kind.${kind}`)}</span><span class="ui-count">{kindCounts[kind]}</span></li>
      {/each}
    </ul>

  <div class="ui-table-wrap">
    <table class="ui-table list">
      <thead><tr><th scope="col">{t('eras.era')}</th><th scope="col">{t('eras.years')}</th><th scope="col">{t('eras.tangut')}</th><th scope="col">{t('eras.basis')}</th></tr></thead>
      <tbody>
        {#each rows as row (row.era.from)}
          <tr data-kind={row.tags[0].kind}>
            <th scope="row" lang="zh-Hant">{row.era.era}</th>
            <td class="years">{years(row.era)}</td>
            <td class="forms" data-empty={!row.forms.length || undefined}>
              {#each row.forms as form, i (form)}
                {#if i}<span class="or">{t('eras.or')}</span>{/if}
                <span class="form" role="group" aria-label={t('eras.form', { era: row.era.era, n: i + 1 })}>{#each [...form] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                  aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>{#if row.era.evidence.some(e => e.kind === 'post' && e.tangut === form)}{@render cites(['zoenshiueh'])}{/if}
              {:else}<span class="ui-hint">—</span>{/each}
            </td>
            <td class="basis">
              {#each row.tags as tag (tag.kind)}
                <span class="tagged"><span class="tag" data-kind={tag.kind}>{t(`eras.kind.${tag.kind}`)}</span>{@render cites(tag.sources)}</span>
              {/each}
              {#if row.gloss.length}<span class="mark" title={t('eras.gloss')} aria-label={t('eras.gloss')}>†</span>{/if}
              {#if row.doubt}<span class="mark" title={t('eras.doubt')} aria-label={t('eras.doubt')}>?</span>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
    {#if glossSources.length}<p class="ui-hint">† {t('eras.gloss')}{@render cites(glossSources)}</p>{/if}
    {#if doubtSources.length}<p class="ui-hint">? {t('eras.doubt')}{@render cites(doubtSources)}</p>{/if}
  </section>

  <section class="ui-section coins" id="coins">
    <h2 class="heading">{t('eras.coins.title')}<span class="ui-count">{COINS.coins.length}</span>{@render cites([COINS.source])}</h2>
    <p class="ui-hint">{t('eras.coins.intro')} {t('eras.coins.readings')}</p>
    <div class="ui-table-wrap">
      <table class="ui-table coin-table">
        <thead><tr><th scope="col">{t('eras.coins.era')}</th><th scope="col">{t('eras.coins.inscription')}</th><th scope="col">{t('eras.coins.interpretation')}</th></tr></thead>
        <tbody>
          {#each COINS.coins as coin (coin.id)}
            <tr onpointerenter={event => hoverPreview(event, coin)} onpointerleave={leavePreview}>
              <th scope="row"><span lang="zh-Hant">{coin.era}</span>
                <button type="button" class="coin-preview-trigger" data-coin-preview-trigger aria-expanded={preview?.coin.id === coin.id}
                  aria-controls={preview?.coin.id === coin.id ? 'coin-images' : undefined}
                  aria-label={t(preview?.coin.id === coin.id ? 'eras.coins.preview.hide' : 'eras.coins.preview.show', { era: coin.era })}
                  onclick={event => togglePreview(event, coin)}
                  onfocus={event => focusPreview(event, coin)}
                  onblur={() => { if (!preview?.pinned && preview?.coin.id === coin.id) leavePreview() }}>
                  <Icon name="image" size={14}/><span>{t('eras.coins.preview.label')}</span>
                </button>
                {#if coin.example}<a class="coin-example" href={coin.example.url}>{coin.example.label}</a>{/if}</th>
              <td>
                {#each legends(coin) as legend (legend.tangut)}
                  <div class="coin-legend">
                    <span class="coin-names" lang="zh-Hant">{legend.names}</span>
                    <span class="form" role="group" aria-label={legend.tangut}>{#each [...legend.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                      aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => { closePreview(); choose(char) }}><G {char}/></button>{/each}</span>
                    <span class="coin-reading">{coinReading(legend.tangut)}</span>
                  </div>
                {/each}
              </td>
              <td class="coin-note"><span class="tag" data-kind={coin.kind}>{t(coin.kind === 'clear' ? 'eras.clear' : 'eras.disputed')}</span>{#if coin.kind === 'disputed'}<p class="note">{t(`eras.coins.note.${coin.id}`)}</p>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if preview}
      <aside id="coin-images" class="coin-image-preview" class:sheet={preview.sheet} bind:this={panel}
        role="group" aria-label={t('eras.coins.preview.title', { era: preview.coin.era })}
        style:left={preview.sheet ? undefined : `${preview.left}px`} style:top={preview.sheet ? undefined : `${preview.top}px`}
        onpointerenter={() => clearTimeout(closeTimer)} onpointerleave={leavePreview}>
        <header>
          <span class="preview-era" lang="zh-Hant">{preview.coin.era}</span>
          <span class="tag" data-kind={preview.coin.kind}>{t(preview.coin.kind === 'clear' ? 'eras.clear' : 'eras.disputed')}</span>
          <button type="button" class="preview-close" bind:this={closeButton} aria-label={t('eras.coins.preview.close')} onclick={closeFromPanel}><Icon name="close" size={15}/></button>
        </header>
        <div class="preview-images">
          {#each preview.coin.images as image (image.src)}
            <figure data-kind={image.kind}>
              {#if failedImages[image.src]}
                <span class="preview-failed">{t('eras.coins.image.failed')}</span>
              {:else}
                <div class="preview-frame">
                  <img src={image.src} alt={imageAlt(image)} width={image.width} height={image.height} decoding="async"
                    onload={() => { loadedImages = { ...loadedImages, [image.src]: true } }}
                    onerror={() => { failedImages = { ...failedImages, [image.src]: true } }}/>
                  {#if !loadedImages[image.src]}<span class="preview-loading">{t('eras.coins.image.loading')}</span>{/if}
                </div>
              {/if}
              <figcaption><span>{t(`eras.coins.image.${image.kind}`)}</span>{#if image.label}<span lang={isChinese(image.label) ? 'zh-Hant' : undefined}>{image.label}</span>{/if}</figcaption>
            </figure>
          {/each}
        </div>
        <p class="preview-note"><a href={coinSource.url}>{t('eras.coins.imagesNote')}</a>{#if preview.coin.example} <span aria-hidden="true">·</span> <a href={preview.coin.example.url}>{preview.coin.example.label}</a>{/if}</p>
      </aside>
    {/if}
    <details>
      <summary>{t('eras.coins.characters')}<span class="ui-count">{COINS.characters.length}</span></summary>
      <p class="ui-hint">{t('eras.coins.references')}</p>
      <div class="ui-table-wrap">
        <table class="ui-table coin-characters">
          <thead><tr><th scope="col">{t('eras.tangut')}</th><th scope="col">{t('eras.coins.reading')}</th><th scope="col">{t('eras.titles.chinese')}</th><th scope="col">XHZD</th><th scope="col">WHYJ</th></tr></thead>
          <tbody>
            {#each COINS.characters as entry (entry.char)}
              <tr>
                <th scope="row"><button type="button" class="char" aria-current={route.c === entry.char ? 'true' : undefined} aria-label={t('eras.open', { char: entry.char, code: hex(entry.char) })} onclick={() => choose(entry.char)}><G char={entry.char}/></button></th>
                <td class="coin-reading">{entry.reading}</td><td lang="zh-Hant">{entry.chinese}</td><td>{entry.xhzd}</td><td>{entry.whyj}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  </section>

  <section class="ui-section titles" id="contemporary-eras">
    <h2 class="heading">{t('eras.contemporary.title')}<span class="ui-count">{CONTEMPORARY_ERAS.length}</span></h2>
    <div class="ui-table-wrap">
      <table class="ui-table list contemporary-table">
        <thead><tr><th scope="col">{t('eras.era')}</th><th scope="col">{t('eras.years')}</th><th scope="col">{t('eras.contemporary.inscription')}</th><th scope="col">{t('eras.basis')}</th></tr></thead>
        <tbody>
          {#each CONTEMPORARY_ERAS as era (era.era)}
            <tr>
              <th scope="row" lang="zh-Hant">{era.era}</th>
              <td class="years">{era.years.join('–')}</td>
              <td class="forms title-form"><span class="form" role="group" aria-label={t('eras.contemporary.transcription')}>{#each [...era.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span><span class="mark" role="img" aria-label={t('eras.contemporary.uncertain')}>?</span></td>
              <td class="basis"><span class="tag" data-kind="reported">{t('eras.contemporary.transcription')}</span>{@render cites([era.proposalSource])}<p class="note">{t('eras.contemporary.note')}{@render cites([era.source])}</p><p class="note">{t('eras.contemporary.comparison')}{@render cites([era.proposalSource, era.source])}</p><p class="note">{t('eras.contemporary.dictionary')}{@render cites(era.dictionarySources)}</p></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ui-section titles" id="titles">
    <h2 class="heading">{t('eras.titles')}<span class="ui-count">{TITLES.length}</span></h2>
    <p class="ui-hint">{t('eras.titles.intro')}</p>
    <ul class="key" aria-label={t('eras.basis')}>
      {#each TITLE_BASES as basis (basis)}
        <li title={t(`eras.titles.basis.${basis}.hint`)}><span class="tag" data-kind={basis}>{t(`eras.titles.basis.${basis}`)}</span><span class="ui-count">{titleBasisCounts[basis]}</span></li>
      {/each}
    </ul>
    <h3 class="subheading">{t('eras.titles.honorific')}</h3>
    {@render titleTable(TITLES.filter(title => title.kind === 'honorific'))}
    <h3 class="subheading">{t('eras.titles.city')}</h3>
    <p class="ui-hint">{t('eras.titles.city.intro')}{@render cites(['zhwphui', 'survey2007'])}</p>
    {@render titleTable(TITLES.filter(title => title.kind === 'city'))}
    <p class="ui-hint">* {t('eras.titles.dated')} † {t('eras.titles.caption')} ‡ {t('eras.titles.decoded')} § {t('eras.titles.codes')} ? {t('eras.titles.disputed')}</p>
  </section>

  <section class="ui-section titles" id="posthumous">
    <h2 class="heading">{t('eras.posthumous')}<span class="ui-count">{POSTHUMOUS.length}</span></h2>
    <p class="ui-hint">{t('eras.posthumous.intro')}{@render cites(['songshi'])}</p>
    <div class="ui-table-wrap">
      <table class="ui-table plain">
        <thead><tr><th scope="col">{t('eras.posthumous.temple')}</th><th scope="col">{t('eras.posthumous.name')}</th><th scope="col">{t('eras.posthumous.posthumous')}</th><th scope="col">{t('eras.posthumous.tomb')}</th></tr></thead>
        <tbody>
          {#each POSTHUMOUS.filter(row => row.kind === 'emperor') as row (row.temple)}
            <tr>
              <th scope="row" lang="zh-Hant">{row.temple}</th>
              <td lang="zh-Hant">{row.name}</td>
              <td><span lang="zh-Hant">{row.posthumous || '—'}</span>{#if row.tangut}<span class="form posthumous-form" role="group" aria-label={row.tangut}>{#each [...row.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>{@render cites([row.tanguts])}<span class="tag posthumous-tag" data-kind="reported">{t('eras.titles.basis.reported')}</span><p class="note">{t('eras.posthumous.zhaojian')}</p>{/if}</td>
              <td lang="zh-Hant">{row.tomb || '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <h3 class="subheading">{t('eras.posthumous.empresses')}</h3>
    <p class="ui-hint">{t('eras.posthumous.empresses.intro')}</p>
    <ul class="empresses" lang="zh-Hant">
      {#each POSTHUMOUS.filter(row => row.kind === 'empress') as row (row.posthumous)}
        <li>{row.posthumous}{row.name}<span class="relation">（{row.relation}）</span></li>
      {/each}
    </ul>
  </section>

  <section class="ui-section titles" id="states">
    <h2 class="heading">{t('eras.states')}<span class="ui-count">{STATE_NAMES.length}</span></h2>
    <p class="ui-hint">{t('eras.states.intro')}</p>
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('eras.titles.chinese')}</th><th scope="col">{t('eras.tangut')}</th><th scope="col">{t('eras.basis')}</th></tr></thead>
        <tbody>
          {#each STATE_NAMES as name (name.chinese || name.tangut)}
            <tr>
              <th scope="row">{#if name.chinese}<span lang="zh-Hant">{name.chinese}</span>{@render cites(name.chineseSources)}{:else}<span class="ui-hint no-chinese">—</span>{/if}{#if name.gloss}<span class="state-gloss" lang="en">“{name.gloss}”</span>{/if}</th>
              <td class="forms title-form" data-empty={!name.tangut || undefined}>{#if name.tangut}<span class="form" role="group" aria-label={name.tangut}>{#each [...name.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>{@render cites(name.tangutSources)}{:else}<span class="ui-hint">—</span>{/if}</td>
              <td class="basis"><span class="tag" data-kind={name.basis}>{t(`eras.titles.basis.${name.basis}`)}</span>{#if name.note}<p class="note">{t(`eras.states.note.${name.note}`)}{@render cites(name.noteSources)}</p>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ui-section titles" id="later-eras">
    <h2 class="heading">{t('eras.later')}<span class="ui-count">{LATER_ERAS.length}</span></h2>
    <p class="ui-hint">{t('eras.later.intro')}{@render cites(['zoenshiueh2026'])} {t('eras.later.colophon')}{@render cites(['duan2024'])}</p>
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('eras.era')}</th><th scope="col">{t('eras.tangut')}</th></tr></thead>
        <tbody>
          {#each LATER_ERAS as era (era.era)}
            <tr>
              <th scope="row" lang="zh-Hant">{era.era}</th>
              <td class="forms title-form"><span class="form" role="group" aria-label={era.tangut}>{#each [...era.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ui-section sources">
    <h2 class="heading">{t('eras.sources')}</h2>
    <ol class="source-list">
      {#each ERA_SOURCE_ORDER as key, i (key)}
        {@const source = ERA_SOURCES[key]}
        <li id={`era-source-${i + 1}`}>{source.author}. {#if source.url}<a href={source.url}>{source.title}</a>{:else}{source.title}{/if}. {source.where}.{#if source.note}{' '}{source.note}{/if}</li>
      {/each}
    </ol>
  </section>
</article>

<style>
  .eras{gap:var(--ui-space-xl);padding-bottom:var(--ui-space-5xl)}
  .ui-toc{position:sticky;top:calc(var(--topbar-h) + var(--writing-h));z-index:6;display:flex;gap:2px;margin-inline:calc(var(--ui-space-sm) * -1);padding-inline:var(--ui-space-sm);overflow-x:auto;background:var(--ui-color-canvas);border-bottom:1px solid var(--ui-color-border);scrollbar-width:none}
  .ui-toc::-webkit-scrollbar{display:none}
  .ui-toc a{display:flex;align-items:baseline;gap:var(--ui-space-xs);padding:9px 12px;border-bottom:2px solid transparent;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);text-decoration:none;white-space:nowrap}
  .ui-toc a:hover{color:var(--ui-color-ink)}
  .ui-toc a[aria-current='true']{border-bottom-color:var(--ui-color-accent);color:var(--ui-color-ink);font-weight:var(--ui-weight-semibold)}
  .ui-toc .ui-count{font-size:var(--ui-text-2xs)}
  .summary{display:flex;flex-wrap:wrap;gap:var(--ui-space-sm);margin:0}
  .summary span{display:flex;align-items:baseline;gap:var(--ui-space-xs);padding:6px 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .summary strong{color:var(--ui-color-ink);font-family:var(--ui-font-serif);font-size:22px;font-weight:var(--ui-weight-semibold);font-variant-numeric:tabular-nums;line-height:1}
  .key{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-lg);margin:0;padding:0;list-style:none}
  .key li{display:flex;align-items:center;gap:var(--ui-space-xs)}
  .eras section[id]{scroll-margin-block-start:calc(var(--topbar-h) + var(--writing-h) + 58px)}
  .list th[scope='row']{font-weight:var(--ui-weight-medium);white-space:nowrap}
  .years{color:var(--ui-color-ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
  .forms{white-space:nowrap}
  .form{display:inline-flex}
  .or{margin-inline:var(--ui-space-xs);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .char{padding:0 1px;border:0;border-radius:var(--ui-radius-sm);background:none;color:inherit;font:inherit;cursor:pointer}
  .char :global(.ui-script){font-size:26px;line-height:1.2}
  .char:hover,.char[aria-current='true']{background:var(--ui-color-accent-soft)}
  .tagged{display:inline-block;margin-inline-end:var(--ui-space-xs)}
  .tag{display:inline-block;padding:1px 7px;border:1px solid var(--ui-color-border);border-radius:999px;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);white-space:nowrap}
  .tag[data-kind='coin'],.tag[data-kind='text']{border-color:var(--ui-color-accent);color:var(--ui-color-accent)}
  .tag[data-kind='none'],.tag[data-kind='chinese'],.tag[data-kind='post']{border-style:dashed;color:var(--ui-color-ink-muted)}
  tr[data-kind='none'] th{color:var(--ui-color-ink-soft)}
  .note{margin:4px 0 0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .mark{margin-inline-start:var(--ui-space-xs);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);cursor:help}
  .cite{margin-inline-start:2px;font-size:.72em;line-height:0;vertical-align:super}
  .cite a{padding-inline:1px;color:var(--ui-color-accent);text-decoration:none}
  .cite a:hover{text-decoration:underline}
  .coins,.titles{gap:var(--ui-space-sm)}
  .coin-table th[scope='row']{width:18%;font-weight:var(--ui-weight-medium);white-space:nowrap}
  .coin-table td:nth-child(2){width:38%}
  .coin-example{display:block;margin-top:var(--ui-space-xs);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-regular);color:var(--ui-color-ink-soft);text-underline-offset:2px}
  .coin-legend{display:flex;flex-direction:column;align-items:start;gap:2px}
  .coin-legend + .coin-legend{margin-top:var(--ui-space-sm)}
  .coin-names{font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft)}
  .coin-reading{font-family:var(--ui-font-serif);font-size:var(--ui-text-sm);white-space:nowrap}
  .coin-note .note{max-width:36em;line-height:1.6}
  .coins summary{display:flex;align-items:baseline;gap:var(--ui-space-sm);cursor:pointer;font-size:var(--ui-text-sm);font-weight:var(--ui-weight-medium)}
  .coins summary::before{content:'▸';color:var(--ui-color-ink-muted)}
  .coins details[open] summary::before{content:'▾'}
  .coins details > .ui-hint{margin-block:var(--ui-space-sm)}
  .coin-characters td{font-variant-numeric:tabular-nums}
  .coin-preview-trigger{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-block-size:var(--ui-target-min);margin-inline-start:var(--ui-space-xs);padding:0 7px;border:1px solid var(--ui-color-border);border-radius:999px;background:none;color:var(--ui-color-ink-soft);font:inherit;font-size:var(--ui-text-xs);vertical-align:middle;cursor:pointer}
  .coin-preview-trigger:hover,.coin-preview-trigger[aria-expanded='true']{border-color:var(--ui-color-border-strong);background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .coin-image-preview{position:fixed;z-index:var(--ui-z-hint);inline-size:320px;max-block-size:calc(100dvh - 16px);overflow:auto;padding:var(--ui-space-md);border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface);box-shadow:var(--ui-shadow-2)}
  .coin-image-preview header{display:flex;align-items:center;gap:var(--ui-space-sm);margin-block-end:var(--ui-space-sm)}
  .preview-era{margin-inline-end:auto;font-family:var(--ui-font-serif);font-size:var(--ui-text-lg);font-weight:var(--ui-weight-semibold)}
  .preview-close{display:inline-flex;align-items:center;justify-content:center;inline-size:26px;block-size:26px;padding:0;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:none;color:var(--ui-color-ink-soft);cursor:pointer}
  .preview-close:hover{background:var(--ui-color-surface-hover);color:var(--ui-color-ink)}
  .preview-images{display:flex;flex-wrap:wrap;align-items:end;justify-content:center;gap:var(--ui-space-md) var(--ui-space-sm)}
  .preview-images figure{display:grid;justify-items:center;gap:2px;margin:0}
  .preview-images figure[data-kind='photograph']{flex:1 0 100%}
  .preview-frame{display:grid;place-items:center}
  .preview-frame > *{grid-area:1 / 1}
  .preview-images img{display:block;block-size:112px;inline-size:auto;max-inline-size:100%;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-canvas)}
  .preview-loading{position:relative;z-index:1;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .preview-images figure[data-kind='photograph'] img,.preview-images figure:only-child img{block-size:196px}
  .preview-images figcaption{display:grid;justify-items:center;gap:1px;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);line-height:1.35;text-align:center}
  .preview-images figcaption span:last-child{color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .preview-failed{display:grid;place-items:center;block-size:112px;inline-size:112px;border:1px dashed var(--ui-color-border);border-radius:var(--ui-radius-sm);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);text-align:center}
  .preview-images figure[data-kind='photograph'] .preview-failed{block-size:196px;inline-size:196px}
  .preview-note{margin:var(--ui-space-sm) 0 0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .preview-note a{color:inherit;text-underline-offset:2px}
  .coin-image-preview.sheet{inset-block-start:auto;inset-block-end:calc(var(--ui-space-sm) + env(safe-area-inset-bottom));inset-inline:var(--ui-space-sm);inline-size:auto;max-block-size:calc(100dvh - 16px)}
  .title-form{white-space:normal}
  .contemporary-table .title-form{white-space:nowrap}
  .title-form .form{flex-wrap:wrap;vertical-align:middle}
  .chinese{min-inline-size:12em;font-size:var(--ui-text-sm)}
  .inferred{margin-inline-start:2px;color:var(--ui-color-ink-muted)}
  .heading{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold)}
  .heading .ui-count{margin-inline-start:var(--ui-space-sm);font-size:var(--ui-text-sm)}
  .plain td,.plain th{font-size:var(--ui-text-sm)}
  .plain th[scope='row']{font-weight:var(--ui-weight-medium);white-space:nowrap}
  .state-gloss{display:block;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-regular,400);white-space:normal}
  .posthumous-form{margin-inline-start:var(--ui-space-sm);vertical-align:middle}
  .posthumous-tag{margin-inline-start:var(--ui-space-xs)}
  .relation{color:var(--ui-color-ink-soft)}
  .subheading{font-size:var(--ui-text-md);font-weight:var(--ui-weight-semibold)}
  .empresses{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-lg);margin:0;padding:0;list-style:none;font-size:var(--ui-text-sm)}
  .sources{gap:var(--ui-space-sm);padding-top:var(--ui-space-xl);border-top:1px solid var(--ui-color-border)}
  .source-list{margin:0;padding-inline-start:1.5em;color:var(--ui-color-ink-soft);font-size:13px;line-height:1.65}
  .source-list li{padding-block:2px 6px;scroll-margin-block-start:calc(var(--topbar-h) + var(--ui-space-lg))}
  .source-list li:target{color:var(--ui-color-ink)}
  .source-list a{color:inherit;text-underline-offset:2px}
  @media (max-width:900px){
    .coin-table thead{position:absolute;inline-size:1px;block-size:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    .coin-table tr{display:grid;gap:var(--ui-space-sm);padding:var(--ui-space-md) var(--ui-space-sm);border-bottom:1px solid var(--ui-color-border)}
    .coin-table tr:last-child{border-bottom:0}
    .coin-table th[scope='row'],.coin-table td:nth-child(2){width:auto}
    .coin-table th[scope='row'],.coin-table td{padding:0;border:0}
    .coin-table th[scope='row']{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:var(--ui-space-2xs) var(--ui-space-sm)}
    .coin-table th[scope='row'] > span:first-child{grid-area:1 / 1;align-self:center}
    .coin-table th[scope='row'] .coin-preview-trigger{grid-area:1 / 2;justify-self:end;margin:0}
    .coin-table th[scope='row'] .coin-example{grid-row:2;grid-column:1 / -1;justify-self:start;margin:0}
    .coin-characters th,.coin-characters td{padding-inline:var(--ui-space-xs)}
    .plain th,.plain td{padding-inline:var(--ui-space-sm)}
    .plain thead th{white-space:normal}
    .posthumous-form{display:flex;margin-inline-start:0}
    .no-chinese{display:none}
    .list thead{display:none}
    .contemporary-table thead{display:table-header-group;position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    .list tr{display:grid;grid-template-columns:auto auto minmax(0,1fr);align-items:baseline;column-gap:var(--ui-space-sm);padding-block:var(--ui-space-sm);border-bottom:1px solid var(--ui-color-border)}
    .list tr:last-child{border-bottom:0}
    .list th[scope='row'],.list td{padding:0 var(--ui-space-sm);border:0}
    .list .basis{text-align:end}
    .list .forms{grid-row:2;grid-column:1 / -1;white-space:normal}
    .list .forms[data-empty]{display:none}
    .titles .list .forms{grid-row:auto}
    .titles .list .chinese{grid-column:1 / -1}
    .titles .list .basis{grid-column:1 / -1;text-align:start}
  }
</style>

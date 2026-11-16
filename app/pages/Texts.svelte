<script>
  // Every text behind the attested corpus, grouped by the collection it came from. A text's first
  // passage can be loaded into the writing strip and opened in Transcribe.
  import { db, isTangut } from '../lib/db.svelte.js'
  import { setText } from '../lib/text.svelte.js'
  import { route, go, setQuery } from '../lib/route.svelte.js'
  import { tick } from 'svelte'
  import { t } from '../lib/i18n.svelte.js'
  import Icon from '../ui/Icon.svelte'
  import GlossedLine from '../ui/GlossedLine.svelte'

  const COLLECTIONS = /** @type {const} */ ([
    { key: 'edition' },
    { key: 'wikisource' },
    { key: 'lausanne' },
    { key: 'mica' },
  ])

  /** @param {string} key */
  const collectionTitle = key => key === 'edition' ? t('texts.edition')
    : key === 'lausanne' ? t('texts.lausanne')
    : key === 'mica' ? t('texts.mica')
    : t('texts.wikisource')

  /** @typedef {{ id: string, label: string, text: string, chinese?: string, chineseUrl?: string, chineseCredit?: string }} Passage */

  /**
   * One entry per text: a Wikisource page or edition is one text; the Lausanne source is split by
   * the section its lines carry.
   */
  const texts = $derived.by(() => {
    const found = db.attestation
    if (!found) return []
    const sources = new Map(found.sources.map(source => [source.id, source]))
    /** @type {Map<string, { key: string, title: string, collectionKey: string,
     *   passages: number, characters: number, licence: string, url: string, first: string, lines: Passage[] }>} */
    const entries = new Map()
    for (const [lineId, line] of Object.entries(found.lines)) {
      const source = sources.get(lineId.slice(0, lineId.indexOf(':')))
      if (!source) continue
      const collectionKey = source.id === 'solonin-2024' ? 'edition'
        : source.id === 'lcdtt' ? 'lausanne'
        : source.id === 'mica' ? 'mica'
        : 'wikisource'
      const split = source.id === 'lcdtt' || source.id === 'mica'
      const title = split ? (line.section ?? source.shortTitle ?? source.title) : (source.shortTitle ?? source.title)
      const key = split ? `${source.id}:${title}` : source.id
      let entry = entries.get(key)
      if (!entry) {
        entry = {
          key,
          title,
          collectionKey,
          passages: 0,
          characters: 0,
          licence: source.licence ?? '',
          url: (source.id === 'lcdtt' ? line.url : source.url) ?? source.url,
          first: line.text,
          lines: [],
        }
        entries.set(key, entry)
      }
      entry.passages += 1
      entry.lines.push({ id: lineId, label: line.label, text: line.text, chinese: line.chinese, chineseUrl: line.chineseUrl, chineseCredit: line.chineseCredit })
      for (const char of line.text) if (isTangut(char)) entry.characters += 1
    }
    return [...entries.values()]
  })

  const target = $derived(route.p ? texts.find(text => text.lines.some(line => line.id === route.p)) : undefined)
  const selected = $derived(target ?? texts.find(text => text.key === route.q))
  let from = $state(0)
  const GLOSSES = 'tangut-input:texts-glosses'
  const kept = typeof localStorage !== 'undefined' ? localStorage.getItem(GLOSSES) : null
  let glosses = $state(kept !== 'off')
  /** @param {boolean} next */
  function setGlosses(next) {
    glosses = next
    try { localStorage.setItem(GLOSSES, next ? 'on' : 'off') } catch { /* a blocked store only loses the choice */ }
  }
  let shown = $state(12)
  $effect(() => {
    const entry = selected
    const at = entry && route.p ? entry.lines.findIndex(line => line.id === route.p) : -1
    if (at >= 0 && entry) {
      from = Math.max(0, at - 6)
      shown = Math.min(entry.lines.length, Math.max(from + 12, at + 1))
    } else {
      from = 0
      shown = 12
    }
  })
  let scrolled = ''
  $effect(() => {
    const line = route.p
    shown
    if (!line) {
      scrolled = ''
      return
    }
    if (line === scrolled) return
    tick().then(() => {
      const element = document.getElementById(`line-${line}`)
      if (!element) return
      scrolled = line
      element.scrollIntoView({ block: 'center' })
    })
  })

  const sections = $derived.by(() => {
    /** @type {Map<string, { key: string, title: string, passages: number, texts: any[] }>} */
    const groups = new Map()
    for (const entry of texts) {
      let section = groups.get(entry.collectionKey)
      if (!section) {
        section = { key: entry.collectionKey, title: collectionTitle(entry.collectionKey), passages: 0, texts: [] }
        groups.set(entry.collectionKey, section)
      }
      section.texts.push(entry)
      section.passages += entry.passages
    }
    return COLLECTIONS.flatMap(item => {
      const section = groups.get(item.key)
      return section ? [section] : []
    })
  })

  /** @param {string} value */
  function preview(value) {
    const chars = [...value]
    return chars.length > 34 ? `${chars.slice(0, 34).join('')}…` : value
  }

  /** @param {string} value */
  function start(value) {
    setText(value)
    go('transcribe')
    setQuery(value)
  }

  /** @param {string} key */
  function select(key) {
    setQuery(key)
    scrollTo(0, 0)
  }

  function back() {
    setQuery('')
    scrollTo(0, 0)
  }
</script>

<div class="ui-page texts" data-width="wide">
  {#if selected}
    <div class="view-tools">
      <button class="ui-button back" data-variant="quiet" data-size="sm" type="button" onclick={back}>
        <Icon name="back" size={14}/>{t('texts.back')}
      </button>
      <button class="ui-chip" type="button" aria-pressed={glosses} onclick={() => setGlosses(!glosses)}>{t('texts.glosses')}</button>
    </div>
    <header class="ui-page-head">
      <h1 class="ui-page-title"><Icon name="book" size={22}/><span>{selected.title}</span></h1>
      <p class="ui-page-intro">{t(selected.passages === 1 ? 'texts.countOne' : 'texts.count', { passages: selected.passages.toLocaleString(), characters: selected.characters.toLocaleString() })} · {selected.licence} · <a class="source ui-more-link" href={selected.url} target="_blank" rel="noreferrer">{t('texts.source')}</a></p>
    </header>
    {#if from > 0}
      <div class="more">
        <button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={() => { from = Math.max(0, from - 12) }}>{t('texts.earlier')}</button>
      </div>
    {/if}
    <ol class="passages">
      {#each selected.lines.slice(from, shown) as passage, index (from + index)}
        <li class="passage" class:target={passage.id === route.p} id={`line-${passage.id}`}>
          <div class="passage-head">
            <span class="label">{passage.label}</span>
            <button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={() => start(passage.text)}>{t('texts.transcribeLine')}</button>
          </div>
          <GlossedLine text={passage.text} {glosses} />
          {#if passage.chinese}
            <p class="translation" lang="zh-Hant">{passage.chinese}{#if passage.chineseUrl} <a class="translation-source" href={passage.chineseUrl} target="_blank" rel="noreferrer" title={passage.chineseCredit ?? 'BabelStone'}>BabelStone</a>{/if}</p>
          {/if}
        </li>
      {/each}
    </ol>
    {#if shown < selected.lines.length}
      <div class="more">
        <button class="ui-button" data-size="sm" type="button" onclick={() => { shown = Math.min(selected.lines.length, shown + 12) }}>{t('texts.more', { count: Math.min(12, selected.lines.length - shown).toLocaleString() })}</button>
      </div>
    {/if}
  {:else}
    <header class="ui-page-head">
      <h1 class="ui-page-title"><Icon name="book" size={22}/><span>{t('nav.texts')}</span></h1>
      <p class="ui-page-intro">{t('texts.intro', { texts: texts.length.toLocaleString(), passages: (db.attestation?.corpus.lines ?? 0).toLocaleString() })}</p>
    </header>

    {#if db.attestationFailed}
      <div class="load-failed">
        <p class="ui-hint">{t('texts.failed')}</p>
        <button class="ui-button" data-size="sm" type="button" onclick={() => location.reload()}>{t('texts.reload')}</button>
      </div>
    {:else if !db.attestation}
      <p class="ui-hint">{t('attest.loading')}</p>
    {:else}
      {#each sections as section (section.key)}
        <section class="ui-section">
          <div class="ui-section-head">
            <h2 class="section-title">{section.title}</h2>
            <span class="ui-count">{t(section.passages === 1 ? 'texts.passage' : 'texts.passages', { count: section.passages.toLocaleString() })}</span>
          </div>
          <ul class="texts-grid">
            {#each section.texts as text (text.key)}
              <li class="text-card">
                <div class="text-head">
                  <h3><button class="title-link" type="button" title={t('texts.read')} onclick={() => select(text.key)}>{text.title}</button></h3>
                  <p class="meta">{t(text.passages === 1 ? 'texts.countOne' : 'texts.count', { passages: text.passages.toLocaleString(), characters: text.characters.toLocaleString() })} · {text.licence}</p>
                </div>
                <p class="preview ui-script" lang="txg">{preview(text.first)}</p>
                <div class="actions">
                  <button class="ui-button" data-size="sm" type="button" onclick={() => select(text.key)}>{t('texts.read')}</button>
                  <button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={() => start(text.first)}>{t('texts.transcribe')}</button>
                  <a class="ui-more-link" href={text.url} target="_blank" rel="noreferrer">{t('texts.source')}</a>
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    {/if}
  {/if}
  <p class="related"><a class="ui-more-link" href="/gyalrongic">{t('gyalrongic.more')}</a></p>
</div>

<style>
  .texts{gap:var(--ui-space-3xl)}
  .related{margin:0}
  .related .ui-more-link{display:inline-flex;align-items:center;min-block-size:24px}
  .load-failed{display:flex;align-items:center;gap:var(--ui-space-md);flex-wrap:wrap}
  .section-title{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold)}
  .texts-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ui-space-md)}
  .text-card{display:flex;flex-direction:column;gap:var(--ui-space-sm);min-inline-size:0;padding:var(--ui-space-lg);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface-sunken)}
  .text-head{display:grid;gap:var(--ui-space-2xs)}
  .text-head h3{font-family:var(--ui-font-serif);font-size:var(--ui-text-md);font-weight:var(--ui-weight-semibold);line-height:1.35}
  .title-link{display:block;min-block-size:24px;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:start;cursor:pointer}
  .title-link:hover{text-decoration:underline}
  .meta{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);line-height:1.5}
  .preview{margin:0;overflow:hidden;color:var(--ui-color-ink-soft);font-size:20px;line-height:1.4;text-overflow:ellipsis;white-space:nowrap}
  .actions{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm);margin-top:auto;padding-top:var(--ui-space-xs);border-top:1px solid var(--ui-color-border)}
  .actions .ui-more-link{display:inline-flex;align-items:center;min-block-size:24px}
  .view-tools{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm)}
  .back{align-self:flex-start}
  .source{display:inline-flex;align-items:center;min-block-size:24px}
  .passages{list-style:none;margin:0;padding:0;display:grid;gap:var(--ui-space-lg)}
  .passage{display:grid;gap:var(--ui-space-xs);padding-block:var(--ui-space-md);border-top:1px solid var(--ui-color-border)}
  .passage.target{background:var(--ui-color-accent-soft);box-shadow:0 0 0 var(--ui-space-xs) var(--ui-color-accent-soft)}
  .passage-head{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm)}
  .label{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);font-variant-numeric:tabular-nums}
  .translation{margin:0;font-family:var(--ui-font-serif);font-size:15px;line-height:1.75;color:var(--ui-color-ink-soft);overflow-wrap:anywhere}
  .translation-source{margin-inline-start:var(--ui-space-2xs);font-family:var(--ui-font-sans);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted);white-space:nowrap}
  .more{display:flex;justify-content:center}
  @media (max-width:760px){
    .texts-grid{grid-template-columns:1fr}
    .text-card{padding:var(--ui-space-md)}
  }
</style>

<script>
  // Every text behind the attested corpus, grouped by the collection it came from. A text's first
  // passage can be loaded into the writing strip and opened in Transcribe.
  import { db, isTangut } from '../lib/db.svelte.js'
  import { setText } from '../lib/text.svelte.js'
  import { go, setQuery } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import Icon from '../ui/Icon.svelte'

  const COLLECTIONS = /** @type {const} */ ([
    { key: 'edition', label: 'texts.edition' },
    { key: 'wikisource', label: 'texts.wikisource' },
    { key: 'lausanne', label: 'texts.lausanne' },
  ])

  /**
   * One entry per text: a Wikisource page or edition is one text; the Lausanne source is split by
   * the section its lines carry.
   */
  const texts = $derived.by(() => {
    const found = db.attestation
    if (!found) return []
    const sources = new Map(found.sources.map(source => [source.id, source]))
    /** @type {Map<string, { key: string, title: string, collectionKey: string,
     *   passages: number, characters: number, licence: string, url: string, first: string }>} */
    const entries = new Map()
    for (const [lineId, line] of Object.entries(found.lines)) {
      const source = sources.get(lineId.slice(0, lineId.indexOf(':')))
      if (!source) continue
      const collectionKey = source.id === 'lcdtt' ? 'lausanne' : source.id === 'solonin-2024' ? 'edition' : 'wikisource'
      const title = source.id === 'lcdtt' ? (line.section ?? source.shortTitle ?? source.title) : (source.shortTitle ?? source.title)
      const key = source.id === 'lcdtt' ? `${source.id}:${title}` : source.id
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
        }
        entries.set(key, entry)
      }
      entry.passages += 1
      for (const char of line.text) if (isTangut(char)) entry.characters += 1
    }
    return [...entries.values()]
  })

  const sections = $derived.by(() => {
    /** @type {Map<string, { key: string, title: string, passages: number, texts: any[] }>} */
    const groups = new Map()
    for (const entry of texts) {
      let section = groups.get(entry.collectionKey)
      if (!section) {
        const collection = COLLECTIONS.find(item => item.key === entry.collectionKey)
        section = { key: entry.collectionKey, title: t(collection?.label ?? 'texts.wikisource'), passages: 0, texts: [] }
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
</script>

<div class="ui-page texts" data-width="wide">
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
                <h3><a href={text.url} target="_blank" rel="noreferrer">{text.title}</a></h3>
                <p class="meta">{t(text.passages === 1 ? 'texts.countOne' : 'texts.count', { passages: text.passages.toLocaleString(), characters: text.characters.toLocaleString() })} · {text.licence}</p>
              </div>
              <p class="preview ui-script" lang="txg">{preview(text.first)}</p>
              <div class="actions">
                <button class="ui-button" data-size="sm" type="button" onclick={() => start(text.first)}>{t('texts.transcribe')}</button>
                <a class="ui-more-link" href={text.url} target="_blank" rel="noreferrer">{t('texts.source')}</a>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
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
  .text-head h3 a{color:inherit;text-decoration:none}
  .text-head h3 a:hover{text-decoration:underline}
  .meta{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);line-height:1.5}
  .preview{margin:0;overflow:hidden;color:var(--ui-color-ink-soft);font-size:20px;line-height:1.4;text-overflow:ellipsis;white-space:nowrap}
  .actions{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm);margin-top:auto;padding-top:var(--ui-space-xs);border-top:1px solid var(--ui-color-border)}
  .actions .ui-more-link{display:inline-flex;align-items:center;min-block-size:24px}
  @media (max-width:760px){
    .texts-grid{grid-template-columns:1fr}
    .text-card{padding:var(--ui-space-md)}
  }
</style>

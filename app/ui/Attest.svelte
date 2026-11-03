<script>
  // Where the character stands in the recorded corpus: for a facsimile source, the scribe's form and
  // the edition's translation; for a transcribed source, the passage around it and a link to the
  // page. Outside the corpus the card says the character is not recorded yet, with the corpus size.
  import { db } from '../lib/db.svelte.js'
  import { choose } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import Icon from './Icon.svelte'

  /** @type {{ char: string }} */
  let { char } = $props()

  const groups = $derived.by(() => {
    const found = db.attestation
    if (!found) return []
    const rows = found.rows[char] ?? {}
    return found.sources
      .map(source => ({
        source,
        places: (rows[source.id] ?? []).map(([line, position]) => ({ source, line, position, text: found.lines[line] })),
      }))
      .filter(group => group.places.length)
  })
  const total = $derived(groups.reduce((sum, group) => sum + group.places.length, 0))
  const corpus = $derived(db.attestation?.corpus)

  /** A window of the passage around the character, so a long paragraph stays readable.
   * @param {string} text @param {number} position @param {number} [radius] */
  function context(text, position, radius = 28) {
    const chars = [...text]
    const at = Math.max(0, Math.min(chars.length - 1, position - 1))
    const start = Math.max(0, at - radius)
    const end = Math.min(chars.length, at + radius + 1)
    return { chars: chars.slice(start, end), start, lead: start > 0, tail: end < chars.length }
  }

  /** @param {import('../lib/data.js').AttestationSource} source */
  const oldid = source => `https://wikisource.org/w/index.php?oldid=${source.revision}`
</script>

<section class="attest">
  <h3 class="ui-label"><Icon name="archive" size={15}/>{t('attest.title')}</h3>
  {#if !db.attestation}
    <p class="ui-hint">{t('attest.loading')}</p>
  {:else if !total}
    <p class="ui-notice">{t('attest.absent', { characters: (corpus?.characters ?? 0).toLocaleString(), distinct: (corpus?.distinct ?? 0).toLocaleString() })}</p>
  {:else}
    {#each groups as group (group.source.id)}
      {@const shown = group.places.slice(0, group.source.kind === 'facsimile' ? 2 : 1)}
      <section class="group">
        <header class="group-head">
          <h4 class="group-title"><a href={group.source.url} target="_blank" rel="noreferrer">{group.source.shortTitle ?? group.source.title}</a></h4>
          <span class="ui-count">{t(group.places.length === 1 ? 'attest.place' : 'attest.places', { count: group.places.length })}</span>
        </header>
        <ol class="places">
          {#each shown as place (place.line + place.position)}
            {@const span = context(place.text.text, place.position)}
            {@const crop = place.source.facsimile?.replace('{line}', place.text.label ?? '').replace('{position}', String(place.position))}
            <li class="place">
              {#if crop}
                <img src={crop} alt={t('attest.crop', { char, line: place.text.label ?? place.line })} width="44" height="72" loading="lazy" />
              {/if}
              <div class="line">
                <p class="text ui-script" lang="txg">
                  {#if span.lead}<span class="cut" aria-hidden="true">…</span>{/if}
                  {#each span.chars as other, i (span.start + i)}
                    {#if span.start + i + 1 === place.position}<mark>{other}</mark>{:else}<button type="button" onclick={() => choose(other)}>{other}</button>{/if}
                  {/each}
                  {#if span.tail}<span class="cut" aria-hidden="true">…</span>{/if}
                </p>
                {#if place.text.english}<p class="en">{place.text.english}</p>{/if}
                <p class="where ui-hint">
                  {#if place.text.page}
                    {t('attest.where', { line: place.text.label ?? place.line, position: place.position, page: place.text.page })}
                  {:else}
                    {#if place.text.section && place.text.section !== place.text.label && !place.text.label?.startsWith('Question ') && !place.text.label?.includes('.')}<span class="section">{place.text.section} · </span>{/if}
                    {t('attest.whereText', { line: place.text.label ?? place.line, position: place.position })}
                  {/if}
                  {#if place.text.url}
                    · <a href={place.text.url} target="_blank" rel="noreferrer">{place.source.kind === 'facsimile' ? (place.text.read ? t('attest.reading') : t('attest.unread')) : t('attest.open')}</a>
                  {/if}
                </p>
              </div>
            </li>
          {/each}
        </ol>
        {#if group.places.length > shown.length}
          <p class="more ui-hint">{t('attest.more', { count: group.places.length - shown.length })}</p>
        {/if}
        {#if group.source.kind === 'facsimile'}
          <p class="src ui-hint">{group.source.author} {group.source.year} · {#if group.source.licenceUrl}<a href={group.source.licenceUrl} target="_blank" rel="noreferrer">{group.source.licence}</a>{:else}{group.source.licence}{/if} · {group.source.manuscript}. {t('attest.facsimile')}
            {t('attest.lineReadings')} <a href={group.source.readingUrl} target="_blank" rel="noreferrer">{group.source.reading}</a>.</p>
        {:else}
          <p class="src ui-hint">{group.source.author} · {#if group.source.licenceUrl}<a href={group.source.licenceUrl} target="_blank" rel="noreferrer">{group.source.licence}</a>{:else}{group.source.licence}{/if}{#if group.source.retrieved} · {t('attest.retrieved', { date: group.source.retrieved })}{/if}
            · <a href={oldid(group.source)} target="_blank" rel="noreferrer">{t('attest.revision', { revision: group.source.revision ?? '' })}</a>.</p>
        {/if}
      </section>
    {/each}
  {/if}
</section>

<style>
  .attest{display:grid;gap:var(--ui-space-md);padding-block:var(--ui-space-xl);border-top:1px solid var(--ui-color-border)}
  .attest > .ui-label{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .group{display:grid;gap:var(--ui-space-xs)}
  .group + .group{padding-top:var(--ui-space-md);border-top:1px solid var(--ui-color-border)}
  .group-head{display:grid;grid-template-columns:minmax(0, 1fr) auto;align-items:baseline;gap:var(--ui-space-sm)}
  .group-title{font-family:var(--ui-font-serif);font-size:var(--ui-text-sm);font-weight:var(--ui-weight-semibold);line-height:1.35}
  .group-title a{color:inherit;text-decoration:none}
  .group-title a:hover{text-decoration:underline}
  .group-head .ui-count{white-space:nowrap}
  .places{list-style:none;margin:0;padding:0;display:grid;gap:var(--ui-space-xs)}
  .place{display:flex;gap:var(--ui-space-md);align-items:flex-start;padding:var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken)}
  img{flex:none;inline-size:44px;block-size:72px;object-fit:contain;background:#e8e1d4;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs)}
  .line{display:grid;gap:var(--ui-space-2xs);min-inline-size:0}
  .text{display:flex;flex-wrap:wrap;gap:1px;font-size:23px;line-height:1.3}
  .text button{padding:1px;border:0;border-radius:var(--ui-radius-xs);background:none;font:inherit;color:inherit}
  .text button:hover{background:var(--ui-color-surface-hover)}
  .cut{padding-inline:2px;color:var(--ui-color-ink-muted)}
  mark{padding:1px 2px;border-radius:var(--ui-radius-xs);background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink);box-shadow:inset 0 -2px 0 var(--ui-color-accent)}
  .en{font-family:var(--ui-font-serif);font-size:var(--ui-text-sm);line-height:1.45}
  .where{font-size:var(--ui-text-2xs)}
  .section{color:var(--ui-color-ink-muted)}
  .more{font-size:var(--ui-text-2xs)}
  .src{font-size:var(--ui-text-2xs);line-height:1.55}
</style>

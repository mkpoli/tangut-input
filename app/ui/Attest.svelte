<script>
  // Where the character stands in the recorded corpus: the scribe's form cut from the facsimile,
  // the line around it, and the line's translation, with the source and its rights. Outside the
  // corpus the card says the character is not yet recorded there; the corpus is one chapter.
  import { db, attested } from '../lib/db.svelte.js'
  import { choose } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ char: string }} */
  let { char } = $props()
  const places = $derived(db.attestation ? attested(char) : [])
  const corpus = $derived(db.attestation?.corpus)
  const source = $derived(db.attestation?.sources[0])
</script>

<section class="attest">
  <h3 class="ui-label">{t('attest.title')}</h3>
  {#if !db.attestation}
    <p class="ui-hint">{t('attest.loading')}</p>
  {:else if !places.length}
    <p class="ui-notice">{@html t('attest.absent', { characters: corpus?.characters ?? 0, distinct: corpus?.distinct ?? 0 })}</p>
  {:else}
    <ol class="places">
      {#each places as place (place.line + place.position)}
        {@const crop = place.source.facsimile.replace('{line}', place.line.split(':')[1]).replace('{position}', String(place.position))}
        <li class="place">
          <img src={crop} alt={t('attest.crop', { char, line: place.line.split(':')[1] })} width="44" height="72" loading="lazy" />
          <div class="line">
            <p class="text ui-script" lang="txg">
              {#each [...place.text.text] as other, i (i)}
                {#if i + 1 === place.position}<mark>{other}</mark>{:else}<button type="button" onclick={() => choose(other)}>{other}</button>{/if}
              {/each}
            </p>
            {#if place.text.english}<p class="en">{place.text.english}</p>{/if}
            <p class="where ui-hint">{t('attest.where', { line: place.line.split(':')[1], position: place.position, page: place.text.page })}
              {#if place.text.url} · <a href={place.text.url} target="_blank" rel="noreferrer">{place.text.read ? t('attest.reading') : t('attest.unread')}</a>{/if}</p>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
  {#if source}
    <p class="src ui-hint">{source.author} {source.year}, <a href={source.url} target="_blank" rel="noreferrer"><i>{source.title}</i></a>, {source.licence}; {source.manuscript}.
      {source.facsimileCredit} {t('attest.lineReadings')} <a href={source.readingUrl} target="_blank" rel="noreferrer">{source.reading}</a>. {t('attest.recordedBy')}</p>
  {/if}
</section>

<style>
  .attest{display:grid;gap:var(--ui-space-sm);padding-block:var(--ui-space-xl);border-top:1px solid var(--ui-color-border)}
  .places{list-style:none;margin:0;padding:0;display:grid;gap:var(--ui-space-xs)}
  .place{display:flex;gap:var(--ui-space-md);align-items:flex-start;padding:var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken)}
  img{flex:none;inline-size:44px;block-size:72px;object-fit:contain;background:#e8e1d4;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs)}
  .line{display:grid;gap:var(--ui-space-2xs);min-inline-size:0}
  .text{display:flex;flex-wrap:wrap;gap:1px;font-size:23px;line-height:1.3}
  .text button{padding:1px;border:0;border-radius:var(--ui-radius-xs);background:none;font:inherit;color:inherit}
  .text button:hover{background:var(--ui-color-surface-hover)}
  mark{padding:1px 2px;border-radius:var(--ui-radius-xs);background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink);box-shadow:inset 0 -2px 0 var(--ui-color-accent)}
  .en{font-family:var(--ui-font-serif);font-size:var(--ui-text-sm);line-height:1.45}
  .where{font-size:var(--ui-text-2xs)}
  .src{font-size:var(--ui-text-2xs);line-height:1.55}
</style>

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

<section>
  <h3 class="label">{t('attest.title')}</h3>
  {#if !db.attestation}
    <p class="empty">{t('attest.loading')}</p>
  {:else if !places.length}
    <p class="absent">{@html t('attest.absent', { characters: corpus?.characters ?? 0, distinct: corpus?.distinct ?? 0 })}</p>
  {:else}
    <ol class="places">
      {#each places as place (place.line + place.position)}
        {@const crop = place.source.facsimile.replace('{line}', place.line.split(':')[1]).replace('{position}', String(place.position))}
        <li class="place">
          <img src={crop} alt={t('attest.crop', { char, line: place.line.split(':')[1] })} width="44" height="72" loading="lazy" />
          <div class="line">
            <p class="text tg" lang="txg">
              {#each [...place.text.text] as other, i (i)}
                {#if i + 1 === place.position}<mark>{other}</mark>{:else}<button type="button" onclick={() => choose(other)}>{other}</button>{/if}
              {/each}
            </p>
            {#if place.text.english}<p class="en">{place.text.english}</p>{/if}
            <p class="where muted">{t('attest.where', { line: place.line.split(':')[1], position: place.position, page: place.text.page })}
              {#if place.text.url} · <a href={place.text.url} target="_blank" rel="noreferrer">{place.text.read ? t('attest.reading') : t('attest.unread')}</a>{/if}</p>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
  {#if source}
    <p class="src muted">{source.author} {source.year}, <a href={source.url} target="_blank" rel="noreferrer"><i>{source.title}</i></a>, {source.licence}; {source.manuscript}.
      {source.facsimileCredit} {t('attest.lineReadings')} <a href={source.readingUrl} target="_blank" rel="noreferrer">{source.reading}</a>. {t('attest.recordedBy')}</p>
  {/if}
</section>

<style>
  section{display:grid;gap:8px}
  .absent{padding:10px 12px;border-radius:9px;background:var(--raised);border:1px dashed var(--line-strong);font-size:13.5px;color:var(--ink-2)}
  .places{list-style:none;margin:0;padding:0;display:grid;gap:10px}
  .place{display:flex;gap:12px;align-items:flex-start;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--raised)}
  img{flex:none;width:44px;height:72px;object-fit:contain;background:#f2ede2;border-radius:5px;border:1px solid var(--line)}
  .line{display:grid;gap:4px;min-width:0}
  .text{font-size:24px;display:flex;flex-wrap:wrap;gap:1px}
  .text button{padding:1px;border:0;border-radius:4px;background:none;font:inherit}
  .text button:hover{background:var(--hover)}
  mark{padding:1px 2px;border-radius:4px;background:var(--accent-soft);color:var(--accent-ink);box-shadow:inset 0 -2px 0 var(--accent)}
  .en{font-family:var(--serif);font-size:14px;line-height:1.4}
  .where{font-size:12px}
  .src{font-size:11.5px;line-height:1.5}
</style>

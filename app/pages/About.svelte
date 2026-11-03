<script>
  // Where every record on the site comes from, and how each finder treats it.
  import { db } from '../lib/db.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  const corpus = $derived(db.attestation?.corpus)
</script>

<article class="ui-page about" data-width="narrow">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('nav.sources')}</h1>
    <p class="ui-page-intro">{t('about.lead')}</p>
  </header>

  <section class="ui-section">
    <h2 class="about-heading">{t('about.records')}</h2>
    <dl>
      <dt>{t('about.recordsTitle')}</dt>
      <dd>{@html t('about.openTangut')}</dd>
      <dt>{t('about.cangjieTitle')}</dt>
      <dd>{@html t('about.cangjieSource')}</dd>
      <dt>{t('about.rhymeBooksTitle')}</dt>
      <dd>{@html t('about.rhymeBooks')}</dd>
      <dt>{t('about.classNamesTitle')}</dt>
      <dd>{@html t('about.classNames')}</dd>
      <dt>{t('about.pronunciationTitle')}</dt>
      <dd>{@html t('about.pronunciationCheck')}</dd>
      <dt>{t('about.strokesTitle')}</dt>
      <dd>{@html t('about.strokes')}</dd>
      <dt>{t('about.attestTitle')}</dt>
      <dd>
        <p>{t('about.attestation')}</p>
        {#if corpus}<p>{t('about.attestCount', { sources: corpus.sources, lines: corpus.lines.toLocaleString(), characters: corpus.characters.toLocaleString(), distinct: corpus.distinct.toLocaleString() })}</p>{/if}
        <ul class="corpus">
          {#each db.attestation?.sources ?? [] as source (source.id)}
            <li>
              <p class="corpus-title"><a href={source.url}><i>{source.title}</i></a>
                {#if source.titleTangut}<span class="ui-script" lang="txg">{source.titleTangut}</span>{/if}
              </p>
              <p class="corpus-meta">{source.author}{source.year ? ` ${source.year}` : ''} · {source.publisher} · {#if source.licenceUrl}<a href={source.licenceUrl}>{source.licence}</a>{:else}{source.licence}{/if}
                {#if source.retrieved} · {t('attest.retrieved', { date: source.retrieved })}{/if}
                {#if source.revision} · <a href={`https://wikisource.org/w/index.php?oldid=${source.revision}`}>{t('attest.revision', { revision: source.revision })}</a>{/if}
              </p>
              {#if source.manuscript}<p class="corpus-note">{source.manuscript}.</p>{/if}
              {#if source.note}<p class="corpus-note">{source.note}</p>{/if}
              {#if source.facsimileCredit}<p class="corpus-note">{source.facsimileCredit}</p>{/if}
              {#if source.reading}<p class="corpus-note">{t('attest.lineReadings')} <a href={source.readingUrl}>{source.reading}</a></p>{/if}
            </li>
          {/each}
        </ul>
      </dd>
      <dt>{t('about.glyphsTitle')}</dt>
      <dd>{@html t('about.glyphs')}</dd>
    </dl>
  </section>

  <section class="ui-section">
    <h2 class="about-heading">{t('about.how')}</h2>
    <dl>
      <dt>{t('nav.cangjie')}</dt>
      <dd>{@html t('about.howCangjie')}</dd>
      <dt>{t('nav.reading')}</dt>
      <dd>{@html t('about.howReading')}</dd>
      <dt>{t('nav.draw')}</dt>
      <dd>{@html t('about.howDraw')}</dd>
      <dt>{t('nav.parts')}</dt>
      <dd>{@html t('about.howParts')}</dd>
      <dt>{t('attest.title')}</dt>
      <dd>{@html t('about.howAttest')}</dd>
    </dl>
  </section>

  <section class="ui-section">
    <h2 class="about-heading">{t('about.mark')}</h2>
    <p class="ui-prose">{@html t('about.markText')}</p>
  </section>

  <section class="ui-section">
    <h2 class="about-heading">{t('about.keptTitle')}</h2>
    <p class="ui-prose">{@html t('about.kept')}</p>
  </section>

  <footer class="about-foot ui-hint">
    {t('about.code')} <a href="https://github.com/mkpoli/tangut-input">github.com/mkpoli/tangut-input</a>.
    {@html t('about.footer')}
  </footer>
</article>

<style>
  .about{gap:var(--ui-space-3xl);padding-bottom:var(--ui-space-5xl)}
  .about-heading{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold)}
  dl{display:grid;margin:0}
  dt{padding-top:var(--ui-space-lg);margin-top:var(--ui-space-lg);border-top:1px solid var(--ui-color-border);font-size:var(--ui-text-sm);font-weight:var(--ui-weight-semibold)}
  dt:first-of-type{padding-top:0;margin-top:0;border-top:0}
  dd{margin:var(--ui-space-2xs) 0 0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-md);line-height:var(--ui-leading-loose)}
  .about :global(.ui-script){font-size:22px;vertical-align:-3px}
  .corpus{list-style:none;margin:var(--ui-space-lg) 0 0;padding:0;display:grid;gap:var(--ui-space-md)}
  .corpus li{padding-top:var(--ui-space-md);border-top:1px solid var(--ui-color-border)}
  .corpus p{margin:0}
  .corpus-title{font-family:var(--ui-font-serif);font-size:var(--ui-text-md);line-height:1.45}
  .corpus-title .ui-script{display:inline-block;margin-inline-start:var(--ui-space-xs)}
  .corpus-meta{margin-top:var(--ui-space-2xs) !important;font-size:var(--ui-text-xs);line-height:1.55}
  .corpus-note{margin-top:var(--ui-space-xs) !important;font-size:var(--ui-text-xs);line-height:1.55}
  .about-foot{font-size:var(--ui-text-xs);line-height:1.6;border-top:1px solid var(--ui-color-border);padding-top:var(--ui-space-lg)}
</style>

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
      <dt>{t('about.pronunciationTitle')}</dt>
      <dd>{@html t('about.pronunciationCheck')}</dd>
      <dt>{t('about.strokesTitle')}</dt>
      <dd>{@html t('about.strokes')}</dd>
      <dt>{t('about.attestTitle')}</dt>
      <dd>
        {@html t('about.attestation')}
        {#if corpus}{@html t('about.attestCount', { lines: corpus.lines, characters: corpus.characters, distinct: corpus.distinct })}{/if}
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
  .about-foot{font-size:var(--ui-text-xs);line-height:1.6;border-top:1px solid var(--ui-color-border);padding-top:var(--ui-space-lg)}
</style>

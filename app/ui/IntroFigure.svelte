<script>
  // One plate of the introduction: the image, its caption in the reader's language, and the credit
  // the licence asks for. The file is a resized copy of a Wikimedia Commons original, linked below.
  import { t } from '../lib/i18n.svelte.js'
  import { FIGURES } from '../lib/intro-figures.js'

  /** @type {{ id: keyof typeof FIGURES, eager?: boolean }} */
  let { id, eager = false } = $props()

  const fig = $derived(FIGURES[id])
</script>

<figure class="intro-figure">
  <img src={fig.src} width={fig.width} height={fig.height} alt="" loading={eager ? 'eager' : 'lazy'}
    fetchpriority={eager ? 'high' : 'auto'} decoding="async" />
  <figcaption>
    <span class="fig-caption">{t(`intro.fig.${id}`)}</span>
    <span class="fig-credit">
      {#if fig.author}{fig.author} · {/if}{#if fig.licenseUrl}<a href={fig.licenseUrl}>{fig.license}</a>{:else}{fig.license}{/if} · <a href={fig.page}>Wikimedia Commons</a>
    </span>
  </figcaption>
</figure>

<style>
  .intro-figure{margin:0;display:flex;flex-direction:column;gap:var(--ui-space-xs);min-inline-size:0}
  .intro-figure img{display:block;inline-size:100%;block-size:auto;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken)}
  .fig-caption{color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);line-height:1.55}
  .fig-credit{display:block;margin-top:3px;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);line-height:1.5}
  .fig-credit a{color:inherit;text-underline-offset:2px}
  @media (max-width: 1000px){
    .intro-figure{max-inline-size:520px}
  }
</style>

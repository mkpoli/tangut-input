<script>
  // A reading list for the Gyalrongic languages, grouped by language, with the works that compare
  // them with Tangut first. The works live in `lib/gyalrongic-literature.js`.
  import { t } from '../lib/i18n.svelte.js'
  import { GROUPS, LITERATURE } from '../lib/gyalrongic-literature.js'
</script>

<article class="ui-page gyalrongic" data-width="narrow">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('gyalrongic.title')}</h1>
    <p class="ui-page-intro">{t('gyalrongic.intro')}</p>
  </header>

  <nav class="groups" aria-label={t('gyalrongic.toc')}>
    {#each GROUPS as group (group.id)}
      <a href={`#${group.id}`}><span>{t(`gyalrongic.group.${group.id}`)}</span><span class="ui-count">{LITERATURE[group.id].length}</span></a>
    {/each}
  </nav>

  {#each GROUPS as group (group.id)}
    <section class="group" id={group.id}>
      <h2 class="heading">{t(`gyalrongic.group.${group.id}`)}</h2>
      {#if group.names}<p class="names">{group.names}</p>{/if}
      <ol class="works" role="list">
        {#each LITERATURE[group.id] as work (work.url)}
          <li>
            <p class="work-title"><a href={work.url} target="_blank" rel="noreferrer">{work.title}</a>{#if work.gloss}{' '}<span class="gloss">({work.gloss})</span>{/if}</p>
            <p class="work-meta">{work.authors}{work.year ? `, ${work.year}` : ''}. {work.where}. <span class="ui-tag">{t(`gyalrongic.kind.${work.kind}`)}</span>{#if work.free}{' '}<span class="ui-tag free">{t('gyalrongic.free')}</span>{/if}</p>
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</article>

<style>
  .gyalrongic{gap:var(--ui-space-2xl);padding-bottom:var(--ui-space-5xl)}
  .groups{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs)}
  .groups a{display:flex;align-items:baseline;gap:var(--ui-space-xs);padding:6px 12px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);text-decoration:none}
  .groups a:hover{border-color:var(--ui-color-accent);color:var(--ui-color-ink)}
  .groups .ui-count{font-size:var(--ui-text-2xs)}
  .group{display:flex;flex-direction:column;gap:var(--ui-space-xs);scroll-margin-block-start:calc(var(--topbar-h) + var(--writing-h) + var(--ui-space-lg))}
  .heading{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold);line-height:1.3}
  .names{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);line-height:1.6}
  .works{display:grid;margin:var(--ui-space-sm) 0 0;padding:0;list-style:none}
  .works li{display:grid;gap:var(--ui-space-2xs);padding-block:var(--ui-space-md);border-top:1px solid var(--ui-color-border)}
  .works p{margin:0}
  .work-title{font-family:var(--ui-font-serif);font-size:var(--ui-text-md);line-height:1.45;overflow-wrap:anywhere}
  .work-title a{color:var(--ui-color-ink);text-underline-offset:3px;text-decoration-color:var(--ui-color-border-strong,var(--ui-color-border))}
  .work-title a:hover{color:var(--ui-color-accent-ink);text-decoration-color:currentColor}
  .gloss{color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm)}
  .work-meta{color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);line-height:1.55}
  .free{border-color:var(--ui-color-accent);color:var(--ui-color-accent-ink)}
  :global(html[lang='ko']) .work-title,
  :global(html[lang='ko']) .ui-page-intro{word-break:keep-all}
</style>

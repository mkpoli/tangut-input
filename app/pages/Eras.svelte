<script>
  // The era names of the Western Xia in order, each with its Tangut form where one is recorded and
  // what the form rests on: a coin, a Tangut text, or only the calendar the list is built from.
  // The data is `app/data/tangut-eras.json`, built by `scripts/build_tangut_eras.py`.
  import ERAS from '../data/tangut-eras.json' with { type: 'json' }
  import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../lib/era-sources.js'
  import { choose } from '../lib/ui.svelte.js'
  import { route } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'
  import Icon from '../ui/Icon.svelte'

  /** @typedef {{ era: string, from: string, to: string | null, calendar: string[], evidence: { tangut: string, kind: string, source: string }[] }} Era */

  /** @param {string} key */
  const number = key => ERA_SOURCE_ORDER.indexOf(/** @type {keyof typeof ERA_SOURCES} */ (key)) + 1

  /**
   * What an era's form rests on, strongest first, and the forms to show.
   * @param {Era} era
   */
  function basis(era) {
    const attested = era.evidence.filter(e => e.tangut)
    const kind = ['coin', 'text', 'disputed'].find(k => attested.some(e => e.kind === k))
      ?? (era.calendar.length ? 'calendar' : 'none')
    const forms = attested.length ? attested.map(e => e.tangut) : era.calendar
    const sources = [...new Set(kind === 'calendar' ? ['calendar'] : attested.map(e => e.source))]
    const doubt = era.evidence.find(e => e.kind === 'unknown')
    return { kind, forms, sources, doubt }
  }

  /** @param {Era} era */
  const years = era => era.to ? (era.from.slice(0, 4) === era.to.slice(0, 4) ? era.from.slice(0, 4) : `${era.from.slice(0, 4)}–${era.to.slice(0, 4)}`) : `${era.from.slice(0, 4)}–`

  const rows = (/** @type {Era[]} */ (ERAS)).map(era => ({ era, ...basis(era) }))
  const counts = {
    total: rows.length,
    forms: rows.filter(row => row.forms.length).length,
    backed: rows.filter(row => ['coin', 'text', 'disputed'].includes(row.kind)).length,
  }
</script>

<article class="ui-page eras">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="eras" size={22}/><span>{t('nav.eras')}</span></h1>
    <p class="ui-page-intro">{t('eras.intro', counts)}</p>
  </header>

  <dl class="key">
    {#each ['coin', 'text', 'disputed', 'calendar', 'none'] as kind (kind)}
      <div><dt><span class="tag" data-kind={kind}>{t(`eras.kind.${kind}`)}</span></dt><dd>{t(`eras.kind.${kind}.hint`)}</dd></div>
    {/each}
  </dl>

  <div class="ui-table-wrap">
    <table class="ui-table list">
      <thead><tr><th scope="col">{t('eras.era')}</th><th scope="col">{t('eras.years')}</th><th scope="col">{t('eras.tangut')}</th><th scope="col">{t('eras.basis')}</th></tr></thead>
      <tbody>
        {#each rows as row (row.era.from)}
          <tr data-kind={row.kind}>
            <th scope="row" lang="zh-Hant">{row.era.era}</th>
            <td class="years">{years(row.era)}</td>
            <td class="forms" data-empty={!row.forms.length || undefined}>
              {#each row.forms as form, i (form)}
                {#if i}<span class="or">{t('eras.or')}</span>{/if}
                <span class="form">{#each [...form] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                  aria-label={t('eras.open', { char })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>
              {:else}<span class="ui-hint">—</span>{/each}
            </td>
            <td class="basis">
              <span class="tag" data-kind={row.kind}>{t(`eras.kind.${row.kind}`)}</span>{#if row.sources.length}<sup class="cite">{#each row.sources as key, i (key)}{#if i},{/if}<a href={`#era-source-${number(key)}`}>{number(key)}</a>{/each}</sup>{/if}
              {#if row.doubt}<p class="doubt">{t('eras.doubt')}<sup class="cite"><a href={`#era-source-${number(row.doubt.source)}`}>{number(row.doubt.source)}</a></sup></p>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <section class="ui-section sources">
    <h2 class="heading">{t('eras.sources')}</h2>
    <ol class="source-list">
      {#each ERA_SOURCE_ORDER as key, i (key)}
        {@const source = ERA_SOURCES[key]}
        <li id={`era-source-${i + 1}`}>{source.author}. <a href={source.url}><i>{source.title}</i></a>. {source.publisher}, {source.year}. {source.note}.</li>
      {/each}
    </ol>
  </section>
</article>

<style>
  .eras{gap:var(--ui-space-xl);padding-bottom:var(--ui-space-5xl)}
  .key{display:grid;gap:var(--ui-space-xs);margin:0}
  .key div{display:grid;grid-template-columns:9.5em minmax(0,1fr);align-items:baseline;gap:var(--ui-space-sm)}
  .key dd{margin:0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm)}
  .list th[scope='row']{font-weight:var(--ui-weight-medium);white-space:nowrap}
  .years{color:var(--ui-color-ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
  .forms{white-space:nowrap}
  .form{display:inline-flex}
  .or{margin-inline:var(--ui-space-xs);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .char{padding:0 1px;border:0;border-radius:var(--ui-radius-sm);background:none;color:inherit;font:inherit;cursor:pointer}
  .char :global(.ui-script){font-size:26px;line-height:1.2}
  .char:hover,.char[aria-current='true']{background:var(--ui-color-accent-soft)}
  .tag{display:inline-block;padding:1px 7px;border:1px solid var(--ui-color-border);border-radius:999px;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);white-space:nowrap}
  .tag[data-kind='coin'],.tag[data-kind='text']{border-color:var(--ui-color-accent);color:var(--ui-color-accent)}
  .tag[data-kind='none']{border-style:dashed;color:var(--ui-color-ink-muted)}
  tr[data-kind='none'] th{color:var(--ui-color-ink-soft)}
  .doubt{margin:4px 0 0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .cite{margin-inline-start:2px;font-size:.72em;line-height:0;vertical-align:super}
  .cite a{padding-inline:1px;color:var(--ui-color-accent);text-decoration:none}
  .cite a:hover{text-decoration:underline}
  .heading{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold)}
  .sources{gap:var(--ui-space-sm);padding-top:var(--ui-space-xl);border-top:1px solid var(--ui-color-border)}
  .source-list{margin:0;padding-inline-start:1.5em;color:var(--ui-color-ink-soft);font-size:13px;line-height:1.65}
  .source-list li{padding-block:2px 6px;scroll-margin-block-start:calc(var(--topbar-h) + var(--ui-space-lg))}
  .source-list li:target{color:var(--ui-color-ink)}
  .source-list a{color:inherit;text-underline-offset:2px}
  @media (max-width:900px){
    .key div{display:block}
    .key dt{display:inline;margin-inline-end:var(--ui-space-xs)}
    .key dd{display:inline}
    .list thead{display:none}
    .list tr{display:grid;grid-template-columns:auto auto minmax(0,1fr);align-items:baseline;column-gap:var(--ui-space-sm);padding-block:var(--ui-space-sm);border-bottom:1px solid var(--ui-color-border)}
    .list tr:last-child{border-bottom:0}
    .list th[scope='row'],.list td{padding:0 var(--ui-space-sm);border:0}
    .list .basis{text-align:end}
    .list .forms{grid-row:2;grid-column:1 / -1;white-space:normal}
    .list .forms[data-empty]{display:none}
  }
</style>

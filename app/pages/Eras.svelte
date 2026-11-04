<script>
  // The era names of the Western Xia in order, each with its Tangut form where one is recorded and
  // what the form rests on: a coin, a Tangut text, only the calendar the list is built from, or a post.
  // The data is `app/data/tangut-eras.json`, built by `scripts/build_tangut_eras.py`. Below them, the
  // imperial titles, from `app/data/tangut-titles.json`, each marked by what its Tangut rests on, and
  // the posthumous, temple and tomb names of 宋史, from `app/data/tangut-posthumous.json`, and the
  // names of the state, from `app/data/tangut-state-names.json`, and later era names, from
  // `app/data/tangut-later-eras.json`.
  import ERAS from '../data/tangut-eras.json' with { type: 'json' }
  import TITLES from '../data/tangut-titles.json' with { type: 'json' }
  import POSTHUMOUS from '../data/tangut-posthumous.json' with { type: 'json' }
  import STATE_NAMES from '../data/tangut-state-names.json' with { type: 'json' }
  import LATER_ERAS from '../data/tangut-later-eras.json' with { type: 'json' }
  import { ERA_SOURCES, ERA_SOURCE_ORDER } from '../lib/era-sources.js'
  import { choose } from '../lib/ui.svelte.js'
  import { hex } from '../lib/db.svelte.js'
  import { route } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'
  import Icon from '../ui/Icon.svelte'

  /** @typedef {{ era: string, from: string, to: string | null, years: [number, number | null], calendar: string[], evidence: { tangut: string, kind: string, source: string }[] }} Era */

  /** @param {string} key */
  const number = key => ERA_SOURCE_ORDER.indexOf(/** @type {keyof typeof ERA_SOURCES} */ (key)) + 1

  /**
   * What an era's form rests on: one tag for each kind of evidence, with its sources, or the
   * calendar alone. The build keeps every backed form among the calendar's, so those and the forms of
   * a post, which may differ, are the forms.
   * @param {Era} era
   */
  function basis(era) {
    const tags = ['coin', 'text', 'disputed'].flatMap(kind => {
      const rows = era.evidence.filter(e => e.kind === kind)
      return rows.length ? [{ kind, sources: [...new Set(rows.map(e => e.source))] }] : []
    })
    if (!tags.length && era.calendar.length) tags.push({ kind: 'calendar', sources: ['calendar'] })
    const posted = era.evidence.filter(e => e.kind === 'post')
    if (posted.length) tags.push({ kind: 'post', sources: [...new Set(posted.map(e => e.source))] })
    if (!tags.length) tags.push({ kind: 'none', sources: [] })
    return {
      tags,
      forms: [...new Set([...era.calendar, ...posted.map(e => e.tangut)])],
      doubt: era.evidence.find(e => e.kind === 'unknown'),
      gloss: [...new Set(era.evidence.filter(e => e.kind === 'gloss').map(e => e.source))],
    }
  }

  /** @param {Era} era */
  const years = era => era.years[1] === null ? `${era.years[0]}–` : era.years[0] === era.years[1] ? `${era.years[0]}` : `${era.years[0]}–${era.years[1]}`

  const rows = (/** @type {Era[]} */ (ERAS)).map(era => ({ era, ...basis(era) }))
  const counts = {
    total: rows.length,
    forms: rows.filter(row => row.forms.length).length,
    clear: rows.filter(row => row.tags.some(tag => tag.kind === 'coin' || tag.kind === 'text') && !row.tags.some(tag => tag.kind === 'disputed')).length,
    disputed: rows.filter(row => row.tags.some(tag => tag.kind === 'disputed')).length,
  }
</script>

{#snippet cites(/** @type {string[]} */ sources)}
  {#if sources.length}<sup class="cite">{#each sources as key, i (key)}{#if i},{/if}<a href={`#era-source-${number(key)}`} aria-label={t('eras.cite', { n: number(key) })}>{number(key)}</a>{/each}</sup>{/if}
{/snippet}

<article class="ui-page eras">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="eras" size={22}/><span>{t('eras.title')}</span></h1>
    <p class="ui-page-intro">{t('eras.intro', counts)}</p>
  </header>

  <dl class="key">
    {#each ['coin', 'text', 'disputed', 'calendar', 'post', 'none'] as kind (kind)}
      <div><dt><span class="tag" data-kind={kind}>{t(`eras.kind.${kind}`)}</span></dt><dd>{t(`eras.kind.${kind}.hint`)}</dd></div>
    {/each}
  </dl>

  <div class="ui-table-wrap">
    <table class="ui-table list">
      <thead><tr><th scope="col">{t('eras.era')}</th><th scope="col">{t('eras.years')}</th><th scope="col">{t('eras.tangut')}</th><th scope="col">{t('eras.basis')}</th></tr></thead>
      <tbody>
        {#each rows as row (row.era.from)}
          <tr data-kind={row.tags[0].kind}>
            <th scope="row" lang="zh-Hant">{row.era.era}</th>
            <td class="years">{years(row.era)}</td>
            <td class="forms" data-empty={!row.forms.length || undefined}>
              {#each row.forms as form, i (form)}
                {#if i}<span class="or">{t('eras.or')}</span>{/if}
                <span class="form" role="group" aria-label={t('eras.form', { era: row.era.era, n: i + 1 })}>{#each [...form] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                  aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>{#if row.era.evidence.some(e => e.kind === 'post' && e.tangut === form)}{@render cites(['zoenshiueh'])}{/if}
              {:else}<span class="ui-hint">—</span>{/each}
            </td>
            <td class="basis">
              {#each row.tags as tag (tag.kind)}
                <span class="tagged"><span class="tag" data-kind={tag.kind}>{t(`eras.kind.${tag.kind}`)}</span>{@render cites(tag.sources)}</span>
              {/each}
              {#if row.gloss.length}<p class="note">{t('eras.gloss')}{@render cites(row.gloss)}</p>{/if}
              {#if row.doubt}<p class="note">{t('eras.doubt')}{@render cites([row.doubt.source])}</p>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <section class="ui-section titles" id="titles">
    <h2 class="heading">{t('eras.titles')}</h2>
    <p class="ui-hint">{t('eras.titles.intro')}</p>
    <dl class="key">
      {#each ['text', 'reported', 'chinese'] as basis (basis)}
        <div><dt><span class="tag" data-kind={basis}>{t(`eras.titles.basis.${basis}`)}</span></dt><dd>{t(`eras.titles.basis.${basis}.hint`)}</dd></div>
      {/each}
    </dl>
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('eras.titles.holder')}</th><th scope="col">{t('eras.tangut')}</th><th scope="col">{t('eras.titles.chinese')}</th><th scope="col">{t('eras.basis')}</th></tr></thead>
        <tbody>
          {#each TITLES as title (`${title.holder} ${title.tangut || title.chinese}`)}
            <tr>
              <th scope="row" lang="zh-Hant">{title.holder}{#if title.identified === 'dated'}<span class="inferred" title={t('eras.titles.dated')} aria-label={t('eras.titles.dated')}>*</span>{:else if title.identified === 'disputed'}<span class="inferred" title={t('eras.titles.disputed')} aria-label={t('eras.titles.disputed')}>?</span>{:else if title.identified === 'caption'}<span class="inferred" title={t('eras.titles.caption')} aria-label={t('eras.titles.caption')}>†</span>{/if}</th>
              <td class="forms title-form" data-empty={!title.tangut || undefined}>{#if title.tangut}<span class="form" role="group" aria-label={title.tangut}>{#each [...title.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>{@render cites(title.tangutSources)}{:else}<span class="ui-hint">—</span>{/if}</td>
              <td class="chinese">{#if title.chinese}<span lang="zh">{title.chinese}</span>{@render cites(title.chineseSources)}{:else}<span class="ui-hint">—</span>{/if}</td>
              <td class="basis"><span class="tag" data-kind={title.basis}>{t(`eras.titles.basis.${title.basis}`)}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="ui-hint">* {t('eras.titles.dated')} † {t('eras.titles.caption')} ? {t('eras.titles.disputed')}</p>
  </section>

  <section class="ui-section titles" id="posthumous">
    <h2 class="heading">{t('eras.posthumous')}</h2>
    <p class="ui-hint">{t('eras.posthumous.intro')}{@render cites(['songshi'])}</p>
    <div class="ui-table-wrap">
      <table class="ui-table plain">
        <thead><tr><th scope="col">{t('eras.posthumous.temple')}</th><th scope="col">{t('eras.posthumous.name')}</th><th scope="col">{t('eras.posthumous.posthumous')}</th><th scope="col">{t('eras.posthumous.tomb')}</th></tr></thead>
        <tbody>
          {#each POSTHUMOUS.filter(row => row.kind === 'emperor') as row (row.temple)}
            <tr>
              <th scope="row" lang="zh-Hant">{row.temple}</th>
              <td lang="zh-Hant">{row.name}</td>
              <td><span lang="zh-Hant">{row.posthumous || '—'}</span>{#if row.tangut}<span class="form posthumous-form" role="group" aria-label={row.tangut}>{#each [...row.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>{@render cites([row.tanguts])}<span class="tag posthumous-tag" data-kind="reported">{t('eras.titles.basis.reported')}</span><p class="note">{t('eras.posthumous.zhaojian')}</p>{/if}</td>
              <td lang="zh-Hant">{row.tomb || '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <h3 class="subheading">{t('eras.posthumous.empresses')}</h3>
    <p class="ui-hint">{t('eras.posthumous.empresses.intro')}</p>
    <ul class="empresses" lang="zh-Hant">
      {#each POSTHUMOUS.filter(row => row.kind === 'empress') as row (row.posthumous)}
        <li>{row.posthumous}{row.name}<span class="relation">（{row.relation}）</span></li>
      {/each}
    </ul>
  </section>

  <section class="ui-section titles" id="states">
    <h2 class="heading">{t('eras.states')}</h2>
    <p class="ui-hint">{t('eras.states.intro')}</p>
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('eras.titles.chinese')}</th><th scope="col">{t('eras.tangut')}</th><th scope="col">{t('eras.basis')}</th></tr></thead>
        <tbody>
          {#each STATE_NAMES as name (name.chinese)}
            <tr>
              <th scope="row"><span lang="zh-Hant">{name.chinese}</span>{@render cites(name.chineseSources)}{#if name.gloss}<span class="state-gloss" lang="en">“{name.gloss}”</span>{/if}</th>
              <td class="forms title-form" data-empty={!name.tangut || undefined}>{#if name.tangut}<span class="form" role="group" aria-label={name.tangut}>{#each [...name.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span>{@render cites(name.tangutSources)}{:else}<span class="ui-hint">—</span>{/if}</td>
              <td class="basis"><span class="tag" data-kind={name.basis}>{t(`eras.titles.basis.${name.basis}`)}</span>{#if name.note}<p class="note">{t(`eras.states.note.${name.note}`)}{@render cites(name.noteSources)}</p>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ui-section titles" id="later-eras">
    <h2 class="heading">{t('eras.later')}</h2>
    <p class="ui-hint">{t('eras.later.intro')}{@render cites(['unattributedTable'])} {t('eras.later.colophon')}{@render cites(['duan2024'])}</p>
    <div class="ui-table-wrap">
      <table class="ui-table list">
        <thead><tr><th scope="col">{t('eras.era')}</th><th scope="col">{t('eras.tangut')}</th></tr></thead>
        <tbody>
          {#each LATER_ERAS as era (era.era)}
            <tr>
              <th scope="row" lang="zh-Hant">{era.era}</th>
              <td class="forms title-form"><span class="form" role="group" aria-label={era.tangut}>{#each [...era.tangut] as char, j (j)}<button type="button" class="char" aria-current={route.c === char ? 'true' : undefined}
                aria-label={t('eras.open', { char, code: hex(char) })} onclick={() => choose(char)}><G {char}/></button>{/each}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ui-section sources">
    <h2 class="heading">{t('eras.sources')}</h2>
    <ol class="source-list">
      {#each ERA_SOURCE_ORDER as key, i (key)}
        {@const source = ERA_SOURCES[key]}
        <li id={`era-source-${i + 1}`}>{source.author}. {#if source.url}<a href={source.url}>{source.title}</a>{:else}{source.title}{/if}. {source.where}.{#if source.note}{' '}{source.note}{/if}</li>
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
  .tagged{display:inline-block;margin-inline-end:var(--ui-space-xs)}
  .tag{display:inline-block;padding:1px 7px;border:1px solid var(--ui-color-border);border-radius:999px;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);white-space:nowrap}
  .tag[data-kind='coin'],.tag[data-kind='text']{border-color:var(--ui-color-accent);color:var(--ui-color-accent)}
  .tag[data-kind='none'],.tag[data-kind='chinese'],.tag[data-kind='post']{border-style:dashed;color:var(--ui-color-ink-muted)}
  tr[data-kind='none'] th{color:var(--ui-color-ink-soft)}
  .note{margin:4px 0 0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .cite{margin-inline-start:2px;font-size:.72em;line-height:0;vertical-align:super}
  .cite a{padding-inline:1px;color:var(--ui-color-accent);text-decoration:none}
  .cite a:hover{text-decoration:underline}
  .titles{gap:var(--ui-space-sm)}
  .title-form{white-space:normal}
  .title-form .form{flex-wrap:wrap;vertical-align:middle}
  .chinese{min-inline-size:12em;font-size:var(--ui-text-sm)}
  .inferred{margin-inline-start:2px;color:var(--ui-color-ink-muted)}
  .heading{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold)}
  .plain td,.plain th{font-size:var(--ui-text-sm)}
  .plain th[scope='row']{font-weight:var(--ui-weight-medium);white-space:nowrap}
  .state-gloss{display:block;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-regular,400);white-space:normal}
  .posthumous-form{margin-inline-start:var(--ui-space-sm);vertical-align:middle}
  .posthumous-tag{margin-inline-start:var(--ui-space-xs)}
  .relation{color:var(--ui-color-ink-soft)}
  .subheading{font-size:var(--ui-text-md);font-weight:var(--ui-weight-semibold)}
  .empresses{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-lg);margin:0;padding:0;list-style:none;font-size:var(--ui-text-sm)}
  .sources{gap:var(--ui-space-sm);padding-top:var(--ui-space-xl);border-top:1px solid var(--ui-color-border)}
  .source-list{margin:0;padding-inline-start:1.5em;color:var(--ui-color-ink-soft);font-size:13px;line-height:1.65}
  .source-list li{padding-block:2px 6px;scroll-margin-block-start:calc(var(--topbar-h) + var(--ui-space-lg))}
  .source-list li:target{color:var(--ui-color-ink)}
  .source-list a{color:inherit;text-underline-offset:2px}
  @media (max-width:900px){
    .plain th,.plain td{padding-inline:var(--ui-space-sm)}
    .plain thead th{white-space:normal}
    .posthumous-form{display:flex;margin-inline-start:0}
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
    .titles .list .forms{grid-row:auto}
    .titles .list .chinese{grid-column:1 / -1}
    .titles .list .basis{grid-column:1 / -1;text-align:start}
  }
</style>

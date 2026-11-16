<script>
  import { choose, put } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import G from './G.svelte'
  import Icon from './Icon.svelte'
  import HanziEvidence from './HanziEvidence.svelte'

  /** @type {{ hits: ReturnType<typeof import('../lib/hanzi.js').searchHanziNames>, active?: number, offset?: number }} */
  let { hits, active = -1, offset = 0 } = $props()
  const shown = $derived(hits.slice(0, 48))
  const KINDS = { era: 'eras.tab.eras', title: 'eras.tab.titles', state: 'eras.tab.states', posthumous: 'eras.tab.posthumous', gloss: 'card.meaning' }
  /** @param {import('../lib/hanzi.js').HanziRecord} record */
  const basisKey = record => record.kind === 'era' && record.basis !== 'gloss' ? `eras.kind.${record.basis}`
    : record.basis === 'gloss' ? 'card.meaning' : `eras.titles.basis.${record.basis}`
</script>

{#if hits.length}
  <section class="ui-section names" aria-label={t('nav.eras')}>
    <header class="ui-section-head">
      <h2 class="ui-label">{t('nav.eras')}</h2>
      <span class="ui-count" role="status">{hits.length > shown.length ? t('common.of', { shown: shown.length, total: hits.length }) : hits.length}</span>
      <a class="ui-more-link" href={link('eras')}>{t('nav.eras')}<Icon name="arrow" size={13}/></a>
    </header>
    <ul class="matches">
      {#each shown as hit, i (i)}
        <li class="match" data-index={offset + i} data-selected={active === offset + i}>
          <div class="head">
            <span class="hanzi" lang="zh">{hit.record.hanzi}</span>
            <span class="ui-tag">{t(KINDS[hit.record.kind])}</span>
            {#if hit.record.holder}<span lang="zh">{hit.record.holder}</span>{/if}
            {#each [...new Set(hit.records.map(basisKey))] as key (key)}<span class="ui-tag" title={t(key === 'card.meaning' ? 'eras.gloss' : `${key}.hint`)}>{t(key)}</span>{/each}
          </div>
          <div class="form">
            <span class="characters" role="group" aria-label={hit.record.tangut}>
              {#each [...hit.record.tangut] as char, j (j)}
                <button class="character" type="button" aria-label={char} onclick={() => choose(char)}><G {char}/></button>
              {/each}
            </span>
            <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" aria-label={t('common.addToText', { char: hit.record.tangut })} title={t('common.add')} onclick={() => put(hit.record.tangut)}><Icon name="add" size={15}/></button>
          </div>
          {#each [...new Set(hit.records.map(record => record.identified).filter(status => status && status !== 'stated'))] as status (status)}
            <p class="ui-hint">{t(`eras.titles.${status}`)}</p>
          {/each}
          {#if hit.record.kind === 'posthumous'}<p class="ui-hint">{t('eras.posthumous.zhaojian')}</p>{/if}
          <HanziEvidence records={hit.records}/>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .matches{list-style:none;margin:0;padding:0;display:grid}
  .match{display:grid;gap:var(--ui-space-xs);padding:var(--ui-space-md) 0;border-block-end:1px solid var(--ui-color-border)}
  .match[data-selected='true']{background:var(--ui-color-accent-soft);box-shadow:inset 2px 0 0 var(--ui-color-accent)}
  .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--ui-space-xs);font-size:var(--ui-text-sm)}
  .hanzi{font-size:var(--ui-text-md);color:var(--ui-color-ink)}
  .form{display:flex;align-items:center;gap:var(--ui-space-sm)}
  .characters{display:flex;flex-wrap:wrap;gap:2px}
  .character{border:0;background:none;padding:2px;color:inherit;cursor:pointer;font-size:30px;line-height:1.4}
  .character:hover{background:var(--ui-color-surface-hover)}
  .ui-hint{margin:0}
</style>

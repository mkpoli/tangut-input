<script>
  import { ix } from '../lib/db.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ records: import('../lib/hanzi.js').HanziRecord[] }} */
  let { records } = $props()
  const sources = $derived([...new Set(records.flatMap(record => record.evidence.map(item => item.source)))])
</script>

<details class="evidence">
  <summary>{t('nav.sources')}</summary>
  <ul>
    {#each sources as key (key)}
      {@const source = ix.hanziSources[key]}
      {#if source}
        <li>
          <span>{source.author} · {#if source.url}<a href={source.url}>{source.title}</a>{:else}{source.title}{/if}{#if source.where} · {source.where}{/if}</span>
          {#if source.via}<a class="via" href={source.via}>{source.via}</a>{/if}
          {#if source.note}<p>{source.note}</p>{/if}
          {#each [...new Set(records.flatMap(record => record.evidence.filter(item => item.source === key).map(item => item.place || item.quote || '')))].filter(Boolean) as detail (detail)}
            <p>{detail}</p>
          {/each}
        </li>
      {/if}
    {/each}
  </ul>
</details>

<style>
  .evidence{color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs);overflow-wrap:anywhere}
  summary{cursor:pointer;width:fit-content}
  ul{margin:var(--ui-space-sm) 0 0;padding-inline-start:var(--ui-space-lg);display:grid;gap:var(--ui-space-sm)}
  p{margin:var(--ui-space-2xs) 0 0}
  .via{display:block}
</style>

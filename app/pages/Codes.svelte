<script>
  // Every character and component by code point, in pages of 16 rows, with what the records hold
  // above it. A cell copies its character; nothing opens the card.
  import { db, ix, hex } from '../lib/db.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import { chartPages, componentUse, blockUseAll, pageRange } from '../lib/code-chart.js'
  import G from '../ui/G.svelte'
  import Icon from '../ui/Icon.svelte'

  const ready = $derived(db.status === 'ready')
  const characters = $derived(new Set(ready ? ix.entries.map(entry => entry.char) : []))
  const components = $derived(new Set(ready ? ix.palette.map(([, char]) => char) : []))
  const described = $derived(ready ? ix.entries.filter(entry => entry.composition).length : 0)
  const blocks = $derived(ready ? blockUseAll(characters, components) : [])
  const use = $derived(ready ? componentUse(components, ix.usedBy) : { total: 0, buckets: [], top: [] })
  const characterPages = $derived(ready ? chartPages('characters', characters) : [])
  const componentPages = $derived(ready ? chartPages('components', components) : [])

  const inventory = $derived([
    { key: 'components', label: 'codes.components', count: components.size, share: components.size / (characters.size + components.size || 1) },
    { key: 'characters', label: 'codes.characters', count: characters.size, share: characters.size / (characters.size + components.size || 1) },
  ])
  const total = $derived(characters.size + components.size)

  let componentPage = $state(0)
  let characterPage = $state(0)

  /** @param {number} share */
  const percent = share => `${(share * 100).toFixed(1).replace(/\.0$/, '')}%`
  /** @param {number} count */
  const number = count => count.toLocaleString()

  /** @param {string} char */
  const code = char => `U+${hex(char)}`
  /** @param {number} step */
  function moveComponent(step) {
    componentPage = Math.min(componentPages.length - 1, Math.max(0, componentPage + step))
  }
  /** @param {number} step */
  function moveCharacter(step) {
    characterPage = Math.min(characterPages.length - 1, Math.max(0, characterPage + step))
  }
</script>

{#snippet pager(/** @type {number} */ page, /** @type {number} */ pages, /** @type {(step: number) => void} */ step)}
  <div class="pager">
    <span class="ui-count">{t('codes.page', { page: page + 1, pages })}</span>
    <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={page === 0}
      aria-label={t('codes.prev')} onclick={() => step(-1)}><Icon name="prev" size={16}/></button>
    <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" disabled={page >= pages - 1}
      aria-label={t('codes.next')} onclick={() => step(1)}><Icon name="next" size={16}/></button>
  </div>
{/snippet}

{#snippet cells(/** @type {(string | null)[]} */ list)}
  <div class="grid">
    {#each list as char, index (index)}
      {#if char}
        <button type="button" class="cell" title={code(char)} aria-label={t('codes.copyCell', { code: code(char) })}
          onclick={() => copy(char, char)}><G {char} /><span class="code">{code(char)}</span></button>
      {:else}
        <span class="cell empty" aria-hidden="true"></span>
      {/if}
    {/each}
  </div>
{/snippet}

<div class="ui-page codes" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('nav.codes')}</h1>
    {#if ready}
      <div class="chips">
        <span class="chip"><b>{number(characters.size)}</b>{t('codes.characters')}</span>
        <span class="chip"><b>{number(components.size)}</b>{t('codes.components')}</span>
      </div>
    {/if}
  </header>

  {#if !ready}
    <p class="ui-empty">{t('common.loading')}</p>
  {:else}
    <section class="stats" aria-label={t('codes.stats')}>
      <section class="stat" aria-labelledby="inventory-heading">
        <h2 class="ui-label" id="inventory-heading">{t('codes.inventory')}</h2>
        <div class="inventory">
          {#each inventory as row (row.key)}
            <div class="legend" data-key={row.key}>
              <span class="swatch" aria-hidden="true"></span>
              <span class="legend-label">{t(row.label)}</span>
              <b class="num">{number(row.count)}</b>
              <span class="pct">{percent(row.share)}</span>
            </div>
          {/each}
        </div>
        <div class="bar" aria-hidden="true">
          {#each inventory as row (row.key)}<span class="fill" data-key={row.key} style:inline-size={`${row.share * 100}%`}></span>{/each}
        </div>
        <div class="total"><span>{t('codes.total')}</span><b>{number(total)}</b></div>
      </section>

      <section class="stat" aria-labelledby="blocks-heading">
        <h2 class="ui-label" id="blocks-heading">{t('codes.blocks')}</h2>
        <div class="blocks">
          {#each blocks as block (block.key)}
            <div class="block" data-key={block.key}>
              <div class="block-head"><span class="block-label">{t(block.label)}</span><span class="range">{block.range}</span></div>
              <div class="bar" aria-hidden="true"><span class="fill" style:inline-size={`${block.share * 100}%`}></span></div>
              <div class="block-meta"><span>{number(block.assigned)} / {number(block.positions)}</span><span class="pct">{percent(block.share)}</span></div>
            </div>
          {/each}
        </div>
      </section>

      <section class="stat usage" aria-labelledby="use-heading">
        <h2 class="ui-label" id="use-heading">{t('codes.usage')}</h2>
        <div class="usage-body">
          <div class="buckets">
            {#each use.buckets as bucket (bucket.label)}
              <div class="bucket">
                <span class="bucket-label">{bucket.label}</span>
                <div class="bar" aria-hidden="true"><span class="fill" style:inline-size={`${bucket.share * 100}%`}></span></div>
                <b class="num">{number(bucket.count)}</b>
                <span class="pct">{percent(bucket.share)}</span>
              </div>
            {/each}
          </div>
          <div class="top-wrap">
            <h3 class="ui-label most">{t('codes.mostUsed')}</h3>
            <ol class="top">
              {#each use.top as row (row.char)}
                <li class="top-row">
                  <span class="top-glyph"><G char={row.char} /></span>
                  <span class="code">{code(row.char)}</span>
                  <b class="num">{number(row.uses)}</b>
                  <span class="pct">{percent(row.uses / (characters.size || 1))}</span>
                </li>
              {/each}
            </ol>
          </div>
        </div>
      </section>
    </section>

    <section class="chart" aria-labelledby="components-heading">
      <div class="chart-head">
        <h2 class="chart-title" id="components-heading"><span>{t('codes.components')}</span><span class="ui-tag">{number(components.size)}</span></h2>
        <span class="range">{pageRange(componentPages[componentPage] ?? { cells: [] })}</span>
        {@render pager(componentPage, componentPages.length, moveComponent)}
      </div>
      <div class="grid-wrap">
        {@render cells(componentPages[componentPage]?.cells ?? [])}
      </div>
    </section>

    <section class="chart" aria-labelledby="characters-heading">
      <div class="chart-head">
        <h2 class="chart-title" id="characters-heading"><span>{t('codes.characters')}</span><span class="ui-tag">{number(characters.size)}</span></h2>
        <span class="range">{pageRange(characterPages[characterPage] ?? { cells: [] })}</span>
        <span class="described"><b>{number(described)}</b><span>{t('codes.described')}</span></span>
        {@render pager(characterPage, characterPages.length, moveCharacter)}
      </div>
      <div class="grid-wrap">
        {@render cells(characterPages[characterPage]?.cells ?? [])}
      </div>
    </section>
  {/if}
</div>

<style>
  .codes{gap:var(--ui-space-2xl)}
  .chips{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs)}
  .chip{display:inline-flex;align-items:baseline;gap:5px;min-block-size:26px;padding:3px var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-pill);background:var(--ui-color-surface);color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .chip b{color:var(--ui-color-ink);font:600 var(--ui-text-sm)/1 var(--ui-font-mono);font-variant-numeric:tabular-nums}
  .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--ui-space-md)}
  .stat{display:flex;flex-direction:column;gap:var(--ui-space-sm);min-inline-size:0;padding:var(--ui-space-lg);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .stat .ui-label{margin:0}
  .stat.usage{grid-column:span 2}
  .usage-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--ui-space-md)}
  .bar{display:flex;overflow:hidden;block-size:6px;border-radius:var(--ui-radius-pill);background:var(--ui-color-surface-sunken)}
  .bar .fill{display:block;block-size:100%;background:var(--ui-color-accent)}
  .inventory{display:grid;gap:var(--ui-space-xs)}
  .legend{display:grid;grid-template-columns:8px minmax(0,1fr) auto auto;align-items:center;gap:var(--ui-space-xs);font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft)}
  .swatch{inline-size:8px;block-size:8px;border-radius:2px;background:var(--ui-color-accent)}
  .legend[data-key='characters'] .swatch,.fill[data-key='characters']{background:var(--ui-color-ink-muted)}
  .legend-label{white-space:nowrap}
  .num{color:var(--ui-color-ink);font:500 var(--ui-text-xs)/1 var(--ui-font-mono);font-variant-numeric:tabular-nums}
  .pct{color:var(--ui-color-ink-muted);font:400 var(--ui-text-2xs)/1 var(--ui-font-mono);font-variant-numeric:tabular-nums}
  .total{display:flex;justify-content:space-between;padding-block-start:var(--ui-space-2xs);border-top:1px solid var(--ui-color-border);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .total b{color:var(--ui-color-ink);font:500 var(--ui-text-xs)/1 var(--ui-font-mono)}
  .blocks{display:grid;gap:var(--ui-space-sm)}
  .block{display:grid;gap:4px}
  .block-head{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:2px var(--ui-space-xs);font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft)}
  .block-label{color:var(--ui-color-ink);font-weight:var(--ui-weight-medium);white-space:nowrap}
  .range{font:400 var(--ui-text-2xs)/1 var(--ui-font-mono);color:var(--ui-color-ink-muted);white-space:nowrap}
  .chart-head .range{margin-inline-start:var(--ui-space-xs)}
  .block-meta{display:flex;justify-content:space-between;font:400 var(--ui-text-2xs)/1 var(--ui-font-mono);color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .buckets{display:grid;gap:5px}
  .bucket{display:grid;grid-template-columns:44px minmax(0,1fr) auto auto;align-items:center;gap:var(--ui-space-xs)}
  .bucket-label{font:400 var(--ui-text-2xs)/1 var(--ui-font-mono);color:var(--ui-color-ink-soft);white-space:nowrap}
  .top-wrap{display:flex;flex-direction:column;gap:var(--ui-space-xs)}
  .most{margin:0}
  .top{display:grid;gap:3px;margin:0;padding:0;list-style:none}
  .top-row{display:grid;grid-template-columns:30px minmax(0,1fr) auto auto;align-items:center;gap:var(--ui-space-xs)}
  .top-glyph{display:grid;place-items:center;inline-size:30px;block-size:30px}
  .top-glyph :global(.ui-script){font-size:24px;line-height:1}
  .code{font:400 var(--ui-text-2xs)/1.2 var(--ui-font-mono);color:var(--ui-color-ink-muted);letter-spacing:0}
  .top .code{font-size:9px}
  .chart{display:flex;flex-direction:column;gap:var(--ui-space-sm);min-inline-size:0}
  .chart-head{display:flex;align-items:center;flex-wrap:wrap;gap:var(--ui-space-sm)}
  .chart-title{display:flex;align-items:center;gap:var(--ui-space-xs);font-size:var(--ui-text-lg)}
  .described{display:inline-flex;align-items:baseline;gap:4px;color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs)}
  .described b{font:500 var(--ui-text-xs)/1 var(--ui-font-mono);color:var(--ui-color-ink-soft);font-variant-numeric:tabular-nums}
  .pager{display:flex;align-items:center;gap:2px;margin-inline-start:auto}
  .grid-wrap{overflow-x:auto;padding-block-end:var(--ui-space-xs);overscroll-behavior-inline:contain}
  .grid{display:grid;grid-template-columns:repeat(16,minmax(0,1fr));gap:2px;min-inline-size:640px;margin:0}
  .cell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-inline-size:0;min-block-size:46px;padding:3px 1px;border:1px solid transparent;border-radius:var(--ui-radius-sm);background:none;color:inherit;font:inherit;cursor:pointer}
  .cell:hover{background:var(--ui-color-accent-soft);border-color:var(--ui-color-border)}
  .cell :global(.ui-script){font-size:28px;line-height:1}
  .cell :global(.ui-nog){display:none}
  .empty{cursor:default;border-color:transparent}
  .empty:hover{background:none;border-color:transparent}
  @media (max-width:1100px){
    .stats{grid-template-columns:repeat(2,minmax(0,1fr))}
    .stat.usage{grid-column:1/-1}
  }
  @media (max-width:900px){
    .stats{grid-template-columns:minmax(0,1fr)}
    .stat.usage{grid-column:auto}
    .usage-body{grid-template-columns:minmax(0,1fr)}
    .chart-title{font-size:var(--ui-text-md)}
    .grid{min-inline-size:600px}
  }
</style>

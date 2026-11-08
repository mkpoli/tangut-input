<script>
  // A passage as one line of Tangut, with Chinese and English glosses under each character when the
  // reader asks for them.
  import { db, ix, isTangut } from '../lib/db.svelte.js'
  import { hanGloss } from '../lib/gloss.js'
  import { firstSense } from '../lib/layers.js'
  import { choose } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ text: string, glosses?: boolean }} */
  let { text, glosses = false } = $props()

  /** @param {string} char */
  const entry = char => db.status === 'ready' ? ix.byChar.get(char) : undefined
  /** @param {string} char */
  const chinese = char => {
    const found = entry(char)
    return hanGloss(ix.leilin.get(char), found?.definitions?.zh, found?.wiktionary_zh)
  }
  /** @param {string} char */
  const english = char => {
    const found = entry(char)
    return {
      text: firstSense(found?.definitions?.en?.[0]) || firstSense(ix.downes.get(char)),
      title: found?.definitions?.en?.join('; ') || ix.downes.get(char) || '',
    }
  }
  /** @param {string} source */
  const sourceLabel = source => t(source === 'wiktionary' ? 'card.chineseWiktionary'
    : source === 'keyed' ? 'card.keyedGloss'
    : 'card.leilinTitle')
</script>

{#if glosses}
  <p class="line glossed ui-script" lang="txg">
    {#each [...text] as char}
      {@const tangut = isTangut(char)}
      {@const zh = tangut ? chinese(char) : { text: '', title: '', source: 'leilin' }}
      {@const en = tangut ? english(char) : { text: '', title: '' }}
      <span class="cell" class:plain={!tangut}>
        {#if tangut}
          <button class="char" type="button" onclick={() => choose(char)}>{char}</button>
        {:else}
          <span class="char">{char}</span>
        {/if}
        <span class="gloss zh" lang={zh.source === 'wiktionary' ? 'zh' : 'zh-Hant'} title={zh.text ? `${sourceLabel(zh.source)}: ${zh.title}` : undefined}>{zh.text}</span>
        <span class="gloss en" lang="en" title={en.text ? en.title : undefined}>{en.text}</span>
      </span>
    {/each}
  </p>
{:else}
  <p class="line ui-script" lang="txg">
    {#each [...text] as char}
      {#if isTangut(char)}<button class="char" type="button" onclick={() => choose(char)}>{char}</button>{:else}<span>{char}</span>{/if}
    {/each}
  </p>
{/if}

<style>
  .line{margin:0;font-size:22px;line-height:1.8;overflow-wrap:anywhere}
  .glossed{display:flex;flex-wrap:wrap;align-items:flex-start;gap:0 3px}
  .cell{display:inline-flex;flex:0 0 auto;flex-direction:column;align-items:center;min-inline-size:1.2em;max-inline-size:8em}
  .cell.plain{min-inline-size:0;max-inline-size:none}
  .char{display:inline-flex;align-items:center;justify-content:center;min-inline-size:24px;min-block-size:24px;padding:0 1px;border:0;border-radius:var(--ui-radius-xs);background:none;color:inherit;font:inherit;line-height:1.4;cursor:pointer}
  .char:hover{background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink)}
  .cell.plain .char{white-space:pre;cursor:default}
  .cell.plain .char:hover{background:none;color:inherit}
  .gloss{font-family:var(--ui-font-serif);font-size:13px;line-height:1.35;color:var(--ui-color-ink-muted);text-align:center;min-block-size:1.35em;max-inline-size:8em;overflow-wrap:anywhere}
  .gloss.en{font-family:var(--ui-font-sans);font-size:12px}
  @media (max-width:760px){.line{font-size:20px}}
</style>

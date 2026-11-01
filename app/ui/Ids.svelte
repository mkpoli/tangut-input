<script module>
  /** @typedef {{ op: string, parts: Node[] } | string} Node */

  const ARITY = /** @type {Record<string, number>} */ ({ '⿲': 3, '⿳': 3 })
  export const LAYOUTS = /** @type {Record<string, string>} */ ({
    '⿰': 'side by side', '⿱': 'above and below', '⿲': 'three across', '⿳': 'three down',
    '⿴': 'surrounded', '⿵': 'open below', '⿶': 'open above', '⿷': 'open right',
    '⿸': 'from upper left', '⿹': 'from upper right', '⿺': 'from lower left', '⿻': 'overlaid',
  })

  /** Parse a description into its tree; a malformed tail is kept as plain leaves. @param {string} text @returns {Node[]} */
  export function parse(text) {
    const chars = [...text]
    let i = 0
    /** @returns {Node} */
    function node() {
      const char = chars[i++]
      if (!(char in LAYOUTS)) return char
      const parts = []
      for (let k = 0; k < (ARITY[char] ?? 2) && i < chars.length; k++) parts.push(node())
      return { op: char, parts }
    }
    const roots = []
    while (i < chars.length) roots.push(node())
    return roots
  }
</script>

<script>
  // A description drawn as the shape it describes: side-by-side parts in a row, stacked parts in
  // a column, enclosures as a frame with the inner part inside. Every part opens its own card.
  import { choose } from '../lib/ui.svelte.js'
  import G from './G.svelte'
  import { gloss } from '../lib/db.svelte.js'
  import Layout from './Layout.svelte'

  /** @type {{ composition: string }} */
  let { composition } = $props()
  const roots = $derived(parse(composition))
</script>

{#snippet draw(/** @type {Node} */ node)}
  {#if typeof node === 'string'}
    <button class="leaf" type="button" title={gloss(node) || 'Open this part'} onclick={() => choose(node)}><G char={node} /></button>
  {:else}
    <div class="box" data-op={node.op} title={LAYOUTS[node.op]}>
      <span class="op"><Layout op={node.op} /></span>
      <div class="inner">
        {#each node.parts as part, i (i)}{@render draw(part)}{/each}
      </div>
    </div>
  {/if}
{/snippet}

<div class="ids" aria-label="Structure">
  {#each roots as root, i (i)}{@render draw(root)}{/each}
</div>

<style>
  .ids{display:flex;gap:8px;padding:12px;border-radius:12px;background:var(--bg);border:1px solid var(--line)}
  .box{position:relative;display:flex;padding:18px 8px 8px;border:1px dashed var(--line-strong);border-radius:9px;flex:1}
  .op{position:absolute;top:4px;left:6px;color:var(--muted);display:flex}
  .inner{display:flex;gap:6px;flex:1;align-items:stretch;justify-content:center}
  [data-op="⿱"]>.inner,[data-op="⿳"]>.inner{flex-direction:column}
  [data-op="⿵"]>.inner,[data-op="⿶"]>.inner,[data-op="⿴"]>.inner{flex-direction:column}
  [data-op="⿸"]>.inner,[data-op="⿹"]>.inner,[data-op="⿺"]>.inner,[data-op="⿷"]>.inner{flex-direction:row}
  [data-op="⿻"]>.inner{flex-direction:row}
  .leaf{display:grid;place-items:center;flex:1;min-width:52px;min-height:52px;padding:4px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
  .leaf:hover{border-color:var(--accent);background:var(--accent-soft)}
  .leaf :global(.tg){font-size:34px}
  .ids>.leaf{flex:0 0 auto;min-width:72px;min-height:72px}
</style>

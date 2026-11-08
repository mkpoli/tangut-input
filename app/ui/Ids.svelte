<script module>
  /** @typedef {{ op: string, parts: Node[] } | string} Node */

  const ARITY = /** @type {Record<string, number>} */ ({ '⿲': 3, '⿳': 3 })
  export const LAYOUTS = /** @type {Record<string, string>} */ ({
    '⿰': 'side by side', '⿱': 'above and below', '⿲': 'three across', '⿳': 'three down',
    '⿴': 'surrounded', '⿵': 'open below', '⿶': 'open above', '⿷': 'open right',
    '⿸': 'from upper left', '⿹': 'from upper right', '⿺': 'from lower left', '⿻': 'overlaid', '㇯': 'one part with another taken out',
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

  /** @type {{ composition: string }} */
  let { composition } = $props()
  const roots = $derived(parse(composition))
</script>

{#snippet draw(/** @type {Node} */ node)}
  {#if typeof node === 'string'}
    <button class="leaf" type="button" title={gloss(node) || 'Open this part'} onclick={() => choose(node)}><G char={node} /></button>
  {:else}
    <div class="box" data-op={node.op} title={LAYOUTS[node.op]}>
      <span class="op" aria-hidden="true">{node.op}</span>
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
  .ids{display:flex;gap:var(--ui-space-xs);padding:var(--ui-space-md);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken)}
  .box{position:relative;display:flex;padding:18px 6px 6px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);flex:1;background:var(--ui-color-surface)}
  .op{position:absolute;top:2px;left:5px;font-family:var(--ui-font-ids);font-size:12px;line-height:1;color:var(--ui-color-ink-muted)}
  .inner{display:flex;gap:var(--ui-space-xs);flex:1;align-items:stretch;justify-content:center}
  [data-op="⿱"]>.inner,[data-op="⿳"]>.inner{flex-direction:column}
  [data-op="⿵"]>.inner,[data-op="⿶"]>.inner,[data-op="⿴"]>.inner{flex-direction:column}
  [data-op="⿸"]>.inner,[data-op="⿹"]>.inner,[data-op="⿺"]>.inner,[data-op="⿷"]>.inner{flex-direction:row}
  [data-op="⿻"]>.inner{flex-direction:row}
  .leaf{display:grid;place-items:center;flex:1;min-inline-size:48px;min-block-size:48px;padding:var(--ui-space-2xs);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-xs);background:var(--ui-color-surface)}
  .leaf:hover{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft)}
  .leaf :global(.ui-script){font-size:32px}
  .ids>.leaf{flex:0 0 auto;min-inline-size:64px;min-block-size:64px}
  .ids>.leaf :global(.ui-script){font-size:44px}
</style>

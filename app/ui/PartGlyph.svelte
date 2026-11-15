<script>
  // One part as a reader can tell two of them apart: an encoded character drawn in the Tangut face,
  // or an IDS description drawn in its reading order. Only the four operators whose meaning is the
  // arrangement itself (⿰ ⿱ ⿲ ⿳) can be drawn; an enclosure or an overlay is written instead.
  import { readDescription } from '../lib/composition.js'
  import G from './G.svelte'

  /** @typedef {{ op: string, parts: Node[] } | string} Node */
  /** @type {{ part: string }} */
  let { part } = $props()

  const single = $derived([...part].length === 1)
  const roots = $derived(single ? [] : readDescription(part).roots)
  const COLUMN = new Set(['⿱', '⿳'])
  const PLACED = new Set(['⿰', '⿱', '⿲', '⿳'])

  /** Whether every operator in a tree is one the drawing can stand for. @param {Node} node @returns {boolean} */
  function placeable(node) {
    return typeof node === 'string' || (PLACED.has(node.op) && node.parts.every(placeable))
  }
  /** The glyph size that fits the narrowest cell of a tree drawn in a box. @param {Node} node @param {number} w @param {number} h @returns {number} */
  function fit(node, w, h) {
    if (typeof node === 'string') return Math.min(w, h)
    const k = node.parts.length || 1
    const column = COLUMN.has(node.op)
    return Math.min(...node.parts.map(child => fit(child, column ? w : w / k, column ? h / k : h)))
  }
  const size = $derived(roots.length === 1 && placeable(roots[0]) ? fit(roots[0], 1, 1) : 0)
  // Below this a drawn form is a smudge; the description itself says more.
  const written = $derived(!single && size < 0.22)
</script>

{#snippet draw(/** @type {Node} */ node)}
  {#if typeof node === 'string'}
    <span class="leaf"><G char={node} /></span>
  {:else}
    <span class="group" data-op={node.op}>
      <span class="inner">
        {#each node.parts as child, i (i)}{@render draw(child)}{/each}
      </span>
    </span>
  {/if}
{/snippet}

{#if single}
  <G char={part} />
{:else if written}
  <span class="ids-text" title={part}>{part}</span>
{:else}
  <span class="part-glyph" style:--leaf={size} aria-label={part} role="img">
    {#each roots as root, i (i)}{@render draw(root)}{/each}
  </span>
{/if}

<style>
  .part-glyph{display:flex;inline-size:1em;block-size:1em;line-height:1;align-items:stretch;justify-content:center}
  .group{display:flex;flex:1;min-width:0;min-height:0;align-items:stretch;justify-content:center}
  .inner{display:flex;flex:1;min-width:0;min-height:0;align-items:stretch;justify-content:center}
  .group[data-op='⿱']>.inner,.group[data-op='⿳']>.inner{flex-direction:column}
  .leaf{display:flex;flex:1;min-width:0;min-height:0;align-items:center;justify-content:center;overflow:hidden}
  .part-glyph .leaf :global(.ui-script){font-size:calc(var(--leaf, .5) * 1em);line-height:1;white-space:nowrap}
  .part-glyph .leaf :global(.ui-nog){font-size:.18em}
  .ids-text{font-family:var(--ui-font-ids);font-size:.3em;line-height:1.15;overflow-wrap:anywhere;max-block-size:100%}
</style>

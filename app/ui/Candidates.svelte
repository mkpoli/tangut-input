<script>
  // A grid of candidates. A tap or click opens the card; a double click, or Enter on the
  // highlighted one, adds it to the text. The page's own input drives the highlight through move().
  import { route } from '../lib/route.svelte.js'
  import G from './G.svelte'
  import { readingOf } from '../lib/db.svelte.js'
  import { choose, preview, put, ui } from '../lib/ui.svelte.js'

  /** @type {{ items: { char: string, sub?: string, sound?: string, title?: string }[], active?: number, size?: number, label: string, limit?: number }} */
  let { items, active = $bindable(-1), size = 64, label, limit = 400 } = $props()
  /** @type {HTMLElement | null} */
  let grid = $state(null)
  const shown = $derived(items.slice(0, limit))

  /** Columns in the grid as laid out now. */
  function columns() {
    if (!grid) return 1
    return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1
  }

  /** Move the highlight by a key. Returns whether the key was used. @param {KeyboardEvent} event */
  export function key(event) {
    if (!shown.length) return false
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns(), ArrowUp: -columns() }[event.key]
    if (step) {
      const next = active < 0 ? 0 : Math.max(0, Math.min(shown.length - 1, active + step))
      active = next
      preview(shown[next].char)
      grid?.children[next]?.scrollIntoView({ block: 'nearest' })
      return true
    }
    if (event.key === 'Enter' && active >= 0 && shown[active]) {
      put(shown[active].char, { place: active })
      return true
    }
    return false
  }
</script>

{#if shown.length}
  <div class="ui-tiles" style:--ui-tile-size="{size}px" role="listbox" aria-label={label} bind:this={grid}>
    {#each shown as item, i (item.char)}
      {@const sound = item.sound ?? readingOf(item.char, ui.reading)}
      <button class="ui-tile" type="button" role="option" aria-selected={i === active || (active < 0 && route.c === item.char)}
        title={item.title ?? item.sub ?? ''}
        onclick={() => { active = i; choose(item.char) }} ondblclick={() => put(item.char, { place: i })}>
        <span class="ui-tile-glyph"><G char={item.char} /></span>{#if sound}<span class="ui-tile-sound">{sound}</span>{/if}{#if item.sub}<span class="ui-tile-note">{item.sub}</span>{/if}
      </button>
    {/each}
  </div>
  {#if items.length > limit}<p class="cut ui-hint">The first {limit} of {items.length}. Narrow the search to see the rest.</p>{/if}
{/if}

<style>
  .cut{margin-top:var(--ui-space-md)}
</style>

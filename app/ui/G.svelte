<script>
  // One Tangut character in the Tangut face, or its code point when no font draws it yet.
  import { hasGlyph, hex } from '../lib/db.svelte.js'
  /** @type {{ char: string }} */
  let { char } = $props()
</script>

{#if hasGlyph(char)}<span class="tg" lang="txg">{char}</span>{:else}<span class="nog" title="No font draws U+{hex(char)} yet">{hex(char)}</span>{/if}

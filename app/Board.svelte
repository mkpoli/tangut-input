<script>
  // The search box and its hits. A hit opens the character's record; the record panel shows it and
  // can carry it to the editor. A character typed in directly opens its record without a search.
  import { isTangut } from './data.js'
  import { search, select, app } from './store.svelte.js'

  let input = $state(/** @type {HTMLInputElement | null} */ (null))
  const hits = $derived(search(app.view.query, app.view.mode))

  /** @param {string} query */
  function typed(query) {
    app.view.query = query
    const char = [...query.trim()][0]
    if (char && isTangut(char) && query.trim() === char) select(char)
  }

  /** @param {KeyboardEvent} event */
  function key(event) {
    if (event.key !== 'Escape') return
    app.view.query = ''
    input?.focus()
  }
</script>

<section class="board" aria-label="Input">
  <div class="box">
    <input bind:this={input} value={app.view.query} oninput={event => typed(event.currentTarget.value)} onkeydown={key}
      type="search" spellcheck="false" autocomplete="off"
      aria-label={app.view.mode === 'component' ? 'Component' : app.view.mode === 'phonetic' ? 'Reconstruction' : app.view.mode === 'glyph' ? 'Meaning' : 'Cangjie code'}
      placeholder={app.view.mode === 'component' ? '𘠀' : app.view.mode === 'phonetic' ? 'do, ndo, do̱1' : app.view.mode === 'glyph' ? 'poison, 毒' : 'm s b u'} />
    {#if hits.length}<p class="count" role="status">{hits.length === 1 ? '1 character' : `${hits.length} characters`}</p>{/if}
  </div>

  {#if hits.length}
    <div class="grid" role="listbox" aria-label="Characters">
      {#each hits.slice(0, 600) as char (char)}
        <button type="button" role="option" aria-selected={app.view.selected === char} class:on={app.view.selected === char}
          title={app.data.byChar.get(char)?.codepoint ?? char} onclick={() => select(char)}><span lang="txg">{char}</span></button>
      {/each}
    </div>
    {#if hits.length > 600}<p class="more">The first 600 of {hits.length}.</p>{/if}
  {:else if app.view.query.trim() && app.data.status === 'ready'}
    <p class="none">Nothing matches that.</p>
  {:else if app.view.mode === 'browse' && app.data.status === 'ready'}
    <p class="none">Type a digit to narrow by code point, or a component to find descriptions using it.</p>
  {:else if app.data.status === 'loading'}
    <p class="none">Loading the Tangut records…</p>
  {/if}
</section>

<style>
  .board{padding:20px;border-right:1px solid var(--line);min-width:0}
  .box{display:flex;align-items:center;gap:10px}
  input{flex:1;min-width:0;font:inherit;font-size:16px;padding:11px 14px;border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);color:inherit}
  input:focus-visible{border-color:var(--accent);outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
  .count{margin:0;color:var(--muted);font-size:12px;white-space:nowrap}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px;margin-top:14px;max-height:calc(100dvh - 220px);overflow:auto;padding-bottom:8px}
  .grid button{display:grid;place-items:center;aspect-ratio:1;border:1px solid transparent;border-radius:9px;background:var(--surface-2);cursor:pointer;font-size:30px;line-height:1}
  .grid button:hover{border-color:var(--line-strong)}
  .grid button.on{border-color:var(--accent);background:var(--accent-soft)}
  [lang="txg"]{font-family:var(--tangut)}
  .none,.more{margin:14px 0 0;color:var(--muted);font-size:13px}
  @media (max-width:980px){.board{border-right:0;border-bottom:1px solid var(--line)}.grid{max-height:46dvh}}
</style>

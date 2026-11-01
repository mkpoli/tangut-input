<script>
  // Tangut Input: one search box over several ways of naming a character. The board holds the hits
  // and the chosen character's record; every other panel reads from that choice.
  import { load, app } from './store.svelte.js'
  import Board from './Board.svelte'
  import Record from './Record.svelte'
  import Modes from './Modes.svelte'

  load()
</script>

<header>
  <h1>Tangut Input</h1>
  <Modes />
</header>

{#if app.data.status === 'failed'}
  <p class="fault">The Tangut records could not be loaded.</p>
{:else}
  <main>
    <Board />
    {#if app.view.selected}<Record char={app.view.selected} />{/if}
  </main>
{/if}

<style>
  header{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--surface)}
  h1{margin:0;font-size:17px;font-weight:650;letter-spacing:.01em}
  main{display:grid;grid-template-columns:minmax(340px,1fr) minmax(360px,1.1fr);min-height:calc(100dvh - 58px)}
  @media (max-width:980px){main{grid-template-columns:1fr}}
  .fault{margin:40px auto;max-width:40em;color:var(--fault)}
</style>

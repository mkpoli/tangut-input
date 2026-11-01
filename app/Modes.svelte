<script>
  // The ways of naming a character. Each mode reads the same box differently, so the placeholder
  // and the examples follow the mode.
  import { app } from './store.svelte.js'

  /** @type {{ key: typeof app.view.mode, label: string, hint: string, example: string }[]} */
  const MODES = [
    { key: 'code', label: 'Cangjie', hint: 'Cangjie letters', example: 'msbu' },
    { key: 'phonetic', label: 'Reconstruction', hint: 'a reconstruction', example: 'do' },
    { key: 'glyph', label: 'Meaning', hint: 'an English, Japanese or Chinese meaning', example: 'poison' },
    { key: 'component', label: 'Component', hint: 'a component', example: '𘠀' },
    { key: 'browse', label: 'Browse', hint: 'digits of a code point, or a component', example: '1700' },
  ]
  const current = $derived(MODES.find(mode => mode.key === app.view.mode) ?? MODES[0])
</script>

<div class="modes" role="tablist" aria-label="Input method">
  {#each MODES as mode (mode.key)}
    <button type="button" role="tab" aria-selected={app.view.mode === mode.key} class:active={app.view.mode === mode.key}
      onclick={() => { app.view.mode = mode.key }}>{mode.label}</button>
  {/each}
</div>
<p class="hint">{current.hint}, for example <code>{current.example}</code></p>

<style>
  .modes{display:flex;gap:2px;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
  button{border:0;background:transparent;padding:5px 10px;border-radius:7px;color:var(--muted);cursor:pointer;font-size:12.5px}
  button.active{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}
  .hint{margin:0;color:var(--muted);font-size:12px}
  code{font-family:ui-monospace,monospace}
</style>

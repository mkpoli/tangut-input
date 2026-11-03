<script>
  import { tick } from 'svelte'
  import { t } from '../lib/i18n.svelte.js'
  import { PALETTES, setPalette, ui } from '../lib/ui.svelte.js'
  import PalettePreview from './PalettePreview.svelte'

  const uid = $props.id()
  let open = $state(false)
  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null)
  /** @type {HTMLUListElement | null} */
  let list = $state(null)
  const current = $derived(PALETTES.find(entry => entry.key === ui.palette) ?? PALETTES[0])

  async function show() {
    open = true
    await tick()
    const selected = list?.querySelector('[aria-selected="true"]')
    ;/** @type {HTMLElement | null} */ (selected ?? list?.querySelector('[role="option"]') ?? null)?.focus()
  }

  /** @param {boolean} [restore] */
  function close(restore = true) {
    open = false
    if (restore) trigger?.focus()
  }

  function toggle() {
    if (open) close()
    else show()
  }

  /** @param {string} key */
  function choose(key) {
    setPalette(/** @type {'paper' | 'mineral' | 'indigo' | 'sand'} */ (key))
    close()
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    const options = /** @type {HTMLElement[]} */ ([...(list?.querySelectorAll('[role="option"]') ?? [])])
    const at = options.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (step) {
      event.preventDefault()
      options[(at + step + options.length) % options.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? options[0] : options[options.length - 1])?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      open = false
    }
  }

  $effect(() => {
    if (!open) return
    const outside = (/** @type {PointerEvent} */ event) => {
      if (!(/** @type {HTMLElement} */ (event.target)).closest('.palette-select')) open = false
    }
    addEventListener('pointerdown', outside)
    return () => removeEventListener('pointerdown', outside)
  })

  /** @param {FocusEvent} event */
  function blur(event) {
    const next = /** @type {Node | null} */ (event.relatedTarget)
    if (open && next && !(/** @type {HTMLElement} */ (event.currentTarget)).contains(next)) open = false
  }
</script>

<div class="palette-select" onfocusout={blur}>
  <button class="ui-select palette-trigger" type="button" bind:this={trigger}
    aria-haspopup="listbox" aria-expanded={open} aria-controls={`palette-list-${uid}`}
    aria-label={`${t('palette.label')}: ${t(current.label)}`}
    onclick={toggle}>
    <span class="palette-value"><PalettePreview key={current.key} /><span>{t(current.label)}</span></span>
    <svg class="chevron" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  {#if open}
    <ul class="ui-menu palette-menu" id={`palette-list-${uid}`} role="listbox" aria-label={t('palette.label')} bind:this={list} onkeydown={keys}>
      {#each PALETTES as entry (entry.key)}
        <li role="none">
          <button class="ui-menu-item palette-option" type="button" role="option" tabindex="-1"
            aria-selected={ui.palette === entry.key} onclick={() => choose(entry.key)}>
            <PalettePreview key={entry.key} />
            <span>{t(entry.label)}</span>
            {#if ui.palette === entry.key}
              <svg class="check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .palette-select{position:relative}
  .palette-trigger{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm);inline-size:100%;text-align:start;appearance:none}
  .palette-value{display:flex;align-items:center;gap:var(--ui-space-sm);min-inline-size:0}
  .palette-value span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .chevron{flex:none;color:var(--ui-color-ink-muted)}
  .palette-menu{position:absolute;inset-inline:0;inset-block-start:calc(100% + var(--ui-space-2xs));z-index:var(--ui-z-menu);inline-size:100%;min-inline-size:0}
  .palette-option{align-items:center}
  .palette-option .check{margin-inline-start:auto;color:var(--ui-color-accent-ink)}
  @media (max-width:900px){
    .palette-menu{position:static;inset:auto;margin-block-start:var(--ui-space-2xs);box-shadow:none}
  }
</style>

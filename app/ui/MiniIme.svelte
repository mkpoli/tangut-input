<script>
  // A small input method beside a Tangut field: reach a character by a word, by the parts of its
  // shape or by its sound, and it goes in at the caret. It is a board for the characters a keyboard
  // cannot type, so it stays open between picks.
  import { tick } from 'svelte'
  import { db, ix, isTangut, gloss } from '../lib/db.svelte.js'
  import { byMeaning, byParts, byCode } from '../lib/search.js'
  import { searchReadings } from '../lib/reading.js'
  import { insert, remember } from '../lib/text.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from './G.svelte'
  import Icon from './Icon.svelte'

  /** Which edge of the button the panel hangs from, so it stays on-screen. */
  let { align = 'end' } = $props()

  const MODES = /** @type {const} */ (['sense', 'shape', 'sound'])

  let open = $state(false)
  /** @type {typeof MODES[number]} */
  let mode = $state('sense')
  let query = $state('')
  let active = $state(-1)
  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null)
  /** @type {HTMLInputElement | null} */
  let box = $state(null)

  const ready = $derived(db.status === 'ready')
  const text = $derived(query.trim())
  const hits = $derived.by(() => {
    if (!ready || !text) return []
    if (mode === 'sense') return [...(isTangut(text) ? [text] : []), ...byMeaning(text).map(hit => hit.char)].slice(0, 24)
    if (mode === 'shape') return (/^[a-z]+$/i.test(text) ? byCode(text).map(hit => hit.char) : byParts([...text].filter(isTangut))).slice(0, 24)
    return searchReadings(ix.readings, text).slice(0, 24).map(hit => hit.char)
  })

  $effect(() => { void text; void mode; active = -1 })

  /** @param {string} char */
  function put(char) {
    remember()
    insert(char)
  }

  /** The button can sit near a screen edge, so the panel is nudged back inside it. */
  async function show() {
    open = true
    await tick()
    const panel = /** @type {HTMLElement | null} */ (box?.closest('.panel') ?? null)
    if (panel) {
      const at = panel.getBoundingClientRect()
      const past = Math.max(0, at.right - innerWidth + 12, 12 - at.left)
      if (past) panel.style.transform = `translateX(${at.left < 12 ? past : -past}px)`
    }
    box?.focus()
  }

  /** @param {boolean} [restore] */
  function close(restore = true) {
    open = false
    active = -1
    if (restore) trigger?.focus()
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (!hits.length) return
    if (step) {
      event.preventDefault()
      active = (active + step + hits.length) % hits.length
    } else if (event.key === 'Enter') {
      event.preventDefault()
      put(hits[Math.max(0, active)] ?? hits[0])
      if (active < 0) active = 0
    }
  }

  /** @param {PointerEvent} event */
  function outside(event) {
    const target = /** @type {HTMLElement} */ (event.target)
    if (open && !target.closest('.ime')) close(false)
  }

  $effect(() => {
    if (!open) return
    addEventListener('pointerdown', outside)
    return () => removeEventListener('pointerdown', outside)
  })
</script>

<div class="ime">
  <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" bind:this={trigger}
    aria-haspopup="dialog" aria-expanded={open} aria-label={t('ime.label')} title={t('ime.label')}
    onclick={() => { open ? close() : show() }}>
    <Icon name="keyboard" size={16}/>
  </button>
  {#if open}
    <div class="panel ui-menu" class:start={align === 'start'} role="dialog" aria-label={t('ime.label')}>
      <div class="modes" role="group" aria-label={t('ime.label')}>
        {#each MODES as name (name)}
          <button type="button" class="ui-chip" aria-pressed={mode === name} onclick={() => { mode = name; query = ''; box?.focus() }}><Icon name={name} size={13}/>{t(`ime.${name}`)}</button>
        {/each}
      </div>
      <input class="ui-input" data-size="sm" bind:this={box} bind:value={query} onkeydown={keys}
        aria-label={t(`ime.${mode}Label`)} placeholder={t(`ime.${mode}Placeholder`)} spellcheck="false" autocomplete="off" autocapitalize="off" />
      {#if text && !hits.length}
        <p class="ui-hint">{ready ? t('ime.none') : t('common.loading')}</p>
      {:else if hits.length}
        <div class="hits" role="listbox" aria-label={t(`ime.${mode}`)}>
          {#each hits as char, i (char)}
            <button type="button" role="option" class="ui-tile" aria-selected={i === active} title={gloss(char)}
              onclick={() => put(char)} onmouseenter={() => { active = i }}>
              <G char={char} />
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ime{position:relative}
  .panel{position:absolute;right:0;top:calc(100% + 6px);z-index:var(--ui-z-menu);display:grid;gap:var(--ui-space-sm);inline-size:300px;padding:var(--ui-space-md)}
  .panel.start{right:auto;left:0}
  .modes{display:flex;gap:var(--ui-space-2xs)}
  .hits{display:grid;grid-template-columns:repeat(8, 1fr);gap:2px;max-block-size:186px;overflow:auto}
  .hits .ui-tile{min-block-size:32px;font-size:22px}
  .hits .ui-tile[aria-selected='true']{background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink)}
</style>

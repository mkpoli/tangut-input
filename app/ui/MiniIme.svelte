<script>
  // A small input method beside a Tangut field: reach a character by a word, by the parts of its
  // shape or by its sound, and it goes in at the caret. It is a board for the characters a keyboard
  // cannot type, so it stays open between picks.
  import { tick } from 'svelte'
  import { db, ix, isTangut, gloss, readingOf } from '../lib/db.svelte.js'
  import { byMeaning, byParts, byCode, bySijiao, byCodePoint, byTibetan } from '../lib/search.js'
  import { searchReadings } from '../lib/reading.js'
  import { insert, remember } from '../lib/text.svelte.js'
  import { ui } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from './G.svelte'

  /** Which edge of the button the panel hangs from, so it stays on-screen.
   *  `always` is the standalone picker: no button, no closing, the panel in the flow. */
  let { align = 'end', always = false, strokes = /** @type {[number, number][][] | null} */ (null) } = $props()

  const id = $props.id()
  let open = $state(always)
  let query = $state('')
  let active = $state(0)
  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null)
  /** @type {HTMLInputElement | null} */
  let box = $state(null)

  const ready = $derived(db.status === 'ready')
  const text = $derived(query.trim())

  /** Recent picks, most recent first, so the same character twice is one key away. */
  let recent = $state(/** @type {string[]} */ ([]))
  try { recent = JSON.parse(localStorage.getItem('tangut-input:recent') ?? '[]') } catch { recent = [] }

  /** @typedef {{ char: string, note: string }} Hit */
  /** @typedef {{ list: Hit[], kinds: string[] }} Found */

  /**
   * What the query can mean, judged from its own characters: digits are a four-corner code, letters
   * a Cangjie code and a reading at once, Tangut characters the parts of a shape. A query that finds
   * nothing that way is looked up as a meaning, so a word typed in English still lands somewhere.
   * @returns {Found}
   */
  const found = $derived.by(() => {
    if (!ready) return { list: [], kinds: [] }
    if (!text) return { list: recent.slice(0, 32).map(char => ({ char, note: gloss(char) })), kinds: ['recent'] }
    /** @type {[string, Hit[]][]} */
    const lists = []
    if (/^u\+?[0-9a-f]{3,5}$/i.test(text)) lists.push(['codepoint', byCodePoint(text).slice(0, 24).map(char => ({ char, note: char }))])
    else if (/^[0-9]+$/.test(text)) lists.push(['sijiao', bySijiao(text).slice(0, 24).map(hit => ({ char: hit.char, note: hit.code }))])
    if (/^[a-z]+$/i.test(text)) {
      lists.push(['code', byCode(text).slice(0, 24).map(hit => ({ char: hit.char, note: hit.code }))])
      lists.push(['sound', searchReadings(ix.readings, text).slice(0, 24).map(hit => ({ char: hit.char, note: (hit.readings ?? []).join(' ') }))])
    }
    lists.push(['tibetan', byTibetan(text).slice(0, 24).map(hit => ({ char: hit.char, note: hit.shown }))])
    if ([...text].some(isTangut)) lists.push(['parts', byParts([...text].filter(isTangut)).slice(0, 24).map(char => ({ char, note: gloss(char) }))])
    // A word in English can look like a code; when the shape searches find almost nothing, the
    // meanings are tried as well, so the one or two code matches do not hide the word's sense.
    const shaped = lists.reduce((sum, [, list]) => sum + list.length, 0)
    if (!shaped || (/[a-z]{3,}/i.test(text) && shaped < 5)) {
      lists.push(['sense', byMeaning(text).slice(0, 24).map(hit => ({ char: hit.char, note: gloss(hit.char) }))])
    }
    const used = lists.filter(([, list]) => list.length).map(([kind]) => kind)
    /** @type {Map<string, Hit>} */
    const unique = new Map()
    for (const [, list] of lists) for (const hit of list) if (!unique.has(hit.char)) unique.set(hit.char, hit)
    // A whole Tibetan spelling keeps a place at the end, past the codes and readings a short query
    // fills the list with.
    const list = [...unique.values()]
    const kept = list.slice(0, 48)
    const whole = byTibetan(text).filter(hit => hit.tier === 0 && !kept.some(other => other.char === hit.char)).slice(0, 24)
    return { list: [...kept.slice(0, 48 - whole.length), ...whole.map(hit => ({ char: hit.char, note: hit.shown }))], kinds: used }
  })

  const hits = $derived(found.list)
  const kinds = $derived(found.kinds)

  $effect(() => {
    void text
    active = 0
    void tick().then(() => {
      const list = box?.closest('.panel')?.querySelector('.hits')
      if (list) list.scrollTop = 0
    })
  })

  // A picker takes the keys at once; beside a field it waits to be opened.
  $effect(() => { if (always) queueMicrotask(() => box?.focus()) })

  /** @param {string} char */
  function put(char) {
    remember()
    insert(char)
    // A picker hands its pick back to the window that embedded it.
    if (always || new URLSearchParams(location.search).has('pick')) {
      // The strokes arrive as reactive state, which cannot be posted as it stands; a plain copy can.
      const plain = strokes ? JSON.parse(JSON.stringify(strokes)) : null
      try { window.parent?.postMessage({ type: 'tangut-pick', char, strokes: plain }, '*') } catch { /* a closed window */ }
    }
    recent = [char, ...recent.filter(other => other !== char)].slice(0, 32)
    try { localStorage.setItem('tangut-input:recent', JSON.stringify(recent)) } catch { /* the list lives this visit */ }
    query = ''
    active = 0
    box?.focus()
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
    active = 0
    if (restore) trigger?.focus()
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (event.isComposing || (event.key === 'Enter' && event.keyCode === 229) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (!hits.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      active = active < 0 ? (step > 0 ? 0 : hits.length - 1) : (active + step + hits.length) % hits.length
      void tick().then(() => document.getElementById(`${id}-hit-${active}`)?.scrollIntoView({ block: 'nearest' }))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      put((hits[Math.max(0, active)] ?? hits[0]).char)
    }
  }

  /** @param {KeyboardEvent} event */
  function panelKeys(event) {
    if (!(event.target instanceof Element) || !event.target.closest('[role="option"]')) return
    event.stopPropagation()
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') event.preventDefault()
    if (event.key === 'Escape' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      keys(event)
      if (event.key !== 'Escape' && event.defaultPrevented) box?.focus()
    }
  }

  /** @param {PointerEvent} event */
  function outside(event) {
    // A picker stays: it is the page, not a menu over one, and the reviewer draws beside it.
    if (always) return
    const target = /** @type {HTMLElement} */ (event.target)
    if (open && !target.closest('.ime')) close(false)
  }

  $effect(() => {
    if (!open) return
    addEventListener('pointerdown', outside)
    return () => removeEventListener('pointerdown', outside)
  })
</script>

<div class="ime" class:always>
  {#if !always}
  <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" bind:this={trigger}
    aria-haspopup="dialog" aria-expanded={open} aria-label={t('ime.label')} title={t('ime.label')}
    onclick={() => { open ? close() : show() }}>
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="16" height="10" rx="2"/><path d="M5 9h1M8 9h1M11 9h1M14 9h1M5 12h10" stroke-linecap="round"/></g></svg>
  </button>
  {/if}
  {#if open}
    <div class="panel ui-menu" class:start={align === 'start'} role="dialog" aria-label={t('ime.label')}>
      <input class="ui-input" data-size="sm" bind:this={box} bind:value={query} onkeydown={keys}
        role="combobox" aria-label={t('ime.label')} aria-autocomplete="list" aria-expanded={!!hits.length}
        aria-controls={hits.length ? `${id}-hits` : undefined}
        aria-activedescendant={active >= 0 && active < hits.length ? `${id}-hit-${active}` : undefined}
        aria-describedby={hits.length ? `${id}-keys` : undefined}
        placeholder={t('ime.placeholder')} spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" />
      {#if text && !hits.length}
        <p class="ui-hint">{ready ? t('ime.none') : t('common.loading')}</p>
      {:else if hits.length}
        <p class="ui-hint">
          {#if !text}{t('ime.recent')}{:else}{kinds.map(kind => t(`ime.kind.${kind}`)).join(' · ')}{/if}
          <span id={`${id}-keys`} class="keys"><kbd>↑</kbd><kbd>↓</kbd> · <kbd>Enter</kbd></span>
        </p>
        <div id={`${id}-hits`} class="hits" role="listbox" aria-label={t('ime.label')}>
          {#each hits as hit, i (hit.char)}
            {@const sound = readingOf(hit.char, ui.reading)}
            <button id={`${id}-hit-${i}`} type="button" role="option" tabindex="-1" class="ui-tile" aria-selected={i === active} title={[sound, hit.note].filter(Boolean).join(' · ')}
              onclick={() => put(hit.char)} onkeydown={panelKeys} onmouseenter={() => { active = i }}>
              <G char={hit.char} />
              {#if sound}<span class="ui-tile-sound">{sound}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ime{position:relative}
  .ime.always{display:grid;gap:8px}
  .ime.always .panel{position:static;inline-size:auto;box-shadow:none;border:1px solid var(--ui-color-border);padding:10px}
  .ime.always .hits{grid-template-columns:repeat(8, 1fr);max-block-size:none}
  .panel{position:absolute;right:0;top:calc(100% + 6px);z-index:var(--ui-z-menu);display:grid;gap:var(--ui-space-sm);inline-size:300px;padding:var(--ui-space-md)}
  .panel.start{right:auto;left:0}
  .hits{display:grid;grid-template-columns:repeat(8, 1fr);gap:2px;max-block-size:220px;overflow:auto}
  .hits .ui-tile{min-block-size:42px;padding:2px 1px;font-size:22px;position:relative;gap:0}
  .hits .ui-tile-sound{font-size:9px;line-height:1.1}
  .keys{float:right}
  .hits .ui-tile[aria-selected='true']{background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink)}
</style>

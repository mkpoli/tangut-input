<script>
  // The text being written. Every finder inserts here at the caret; it can also be typed or pasted
  // into directly. Clicking beside a character opens that character in the card.
  import { tick, onMount } from 'svelte'
  import { text, attach, detach, setText, remember, asCodePoints, asCodes } from '../lib/text.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { isTangut } from '../lib/db.svelte.js'
  import { route } from '../lib/route.svelte.js'
  import { preview } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import MiniIme from './MiniIme.svelte'
  import SamplePicker from './SamplePicker.svelte'
  import Icon from './Icon.svelte'

  /** @type {HTMLElement | null} */
  let strip = $state(null)
  /** @type {HTMLTextAreaElement | null} */
  let field = $state(null)
  let menu = $state(false)
  /** @type {HTMLElement | null} */
  let more = $state(null)
  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null)
  /** @type {HTMLElement | null} */
  let list = $state(null)
  const count = $derived([...text.value].filter(isTangut).length)

  $effect(() => {
    if (field) attach(field)
    return () => { if (field) detach(field) }
  })

  // The strip is sticky above the page, and a page's own sticky bar hangs below it. Its height
  // changes with the text, so the offset follows the rendered strip rather than the token.
  onMount(() => {
    if (!strip) return
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--writing-h', `${entry.target.getBoundingClientRect().height}px`)
    })
    observer.observe(strip)
    return () => observer.disconnect()
  })

  // Grow with the text up to three lines.
  $effect(() => {
    void text.value
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight, 150)}px`
  })

  function caret() {
    remember()
    if (!field) return
    const at = field.selectionStart
    if (at !== field.selectionEnd) return
    const after = String.fromCodePoint(text.value.codePointAt(at) ?? 0)
    const before = [...text.value.slice(0, at)].at(-1) ?? ''
    const char = isTangut(after) ? after : isTangut(before) ? before : ''
    if (char) preview(char)
  }

  async function open() {
    menu = true
    await tick()
    ;/** @type {HTMLElement | null} */ (list?.querySelector('button:not(:disabled)') ?? null)?.focus()
  }

  /** @param {boolean} [restore] */
  function close(restore = true) {
    menu = false
    if (restore) trigger?.focus()
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    const entries = [...(list?.querySelectorAll('button') ?? [])].filter(button => !button.disabled)
    const at = entries.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement))
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (step) {
      event.preventDefault()
      entries[(at + step + entries.length) % entries.length]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      menu = false
    }
  }

  /** @param {PointerEvent} event */
  function outside(event) {
    if (menu && !more?.contains(/** @type {Node} */ (event.target))) menu = false
  }

  $effect(() => {
    if (!menu) return
    addEventListener('pointerdown', outside)
    return () => removeEventListener('pointerdown', outside)
  })

  /** @param {FocusEvent} event */
  function closeMenu(event) {
    const next = /** @type {Node | null} */ (event.relatedTarget)
    if (!next || !(/** @type {HTMLElement} */ (event.currentTarget)).contains(next)) menu = false
  }
</script>

<section class="writing" bind:this={strip} aria-label={t('writing.label')}>
  <label class="ui-label writing-label" for="writing">{t('writing.text')}</label>
  <textarea id="writing" bind:this={field} class="ui-input writing-field ui-script" rows="1" spellcheck="false" autocomplete="off"
    value={text.value} placeholder={t('writing.placeholder')}
    oninput={event => { setText(event.currentTarget.value); remember() }}
    onkeyup={remember} onclick={caret} onselect={remember} onblur={remember}></textarea>
  <div class="actions">
    <MiniIme />
    {#if count}<span class="count ui-count">{count}</span>{/if}
    <SamplePicker syncQuery={route.page === 'transcribe'} onpick={() => field?.focus()} />
    <button class="ui-button" data-size="sm" type="button" disabled={!text.value} onclick={() => copy(text.value, t('writing.text'))}><Icon name="copy" size={14}/>{t('common.copy')}</button>
    <div class="more" bind:this={more} onfocusout={closeMenu}>
      <button class="ui-button" data-variant="quiet" data-size="icon-sm" type="button" bind:this={trigger}
        aria-haspopup="menu" aria-expanded={menu} aria-label={t('writing.more')} disabled={!text.value}
        onclick={() => { menu ? close(false) : open() }}>
        <Icon name="more" size={16}/>
      </button>
      {#if menu}
        <div class="ui-menu writing-menu" role="menu" tabindex="-1" bind:this={list} onkeydown={keys}>
          <button class="ui-menu-item" role="menuitem" type="button" disabled={!count} onclick={() => { copy(asCodePoints(text.value), t('writing.codePoints')); close() }}><Icon name="code" size={15}/>{t('writing.copyCodePoints')}</button>
          <button class="ui-menu-item" role="menuitem" type="button" disabled={!count} onclick={() => { copy(asCodes(text.value), t('writing.cangjieCodes')); close() }}><Icon name="cangjie" size={15}/>{t('writing.copyCangjie')}</button>
          <hr class="ui-menu-separator" />
          <button class="ui-menu-item" role="menuitem" type="button" disabled={!text.value} onclick={() => { setText(''); close(false); field?.focus() }}><Icon name="clear" size={15}/>{t('writing.clear')}</button>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .writing{position:sticky;top:var(--topbar-h);z-index:14;display:flex;align-items:center;gap:var(--ui-space-lg);padding:var(--ui-space-sm) var(--ui-space-2xl);background:var(--ui-color-surface);border-bottom:1px solid var(--ui-color-border)}
  .writing-label{flex:none;inline-size:44px}
  .writing-field{flex:1;min-inline-size:0;min-block-size:var(--ui-control-h-lg);max-block-size:150px;padding:var(--ui-space-xs) var(--ui-space-lg);border-color:var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-surface-sunken);font-size:26px;line-height:1.3;letter-spacing:.04em;resize:none;overflow:auto}
  .writing-field:hover:not(:disabled){border-color:var(--ui-color-control-border)}
  .writing-field::placeholder{font-family:var(--ui-font-sans);font-size:var(--ui-text-md);letter-spacing:0;color:var(--ui-color-ink-muted);line-height:2.4}
  .actions{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .count{margin-inline-end:var(--ui-space-xs)}
  .more{position:relative}
  .writing-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:var(--ui-z-menu);min-inline-size:220px}
  .writing-menu .ui-menu-item{align-items:center}
  @media (max-width:900px){
    .writing{gap:var(--ui-space-sm);padding:var(--ui-space-xs) var(--ui-space-lg)}
    .writing-label{display:none}
    .writing-field{font-size:22px;padding:6px var(--ui-space-md);min-block-size:36px}
    .writing-field::placeholder{line-height:2.1}
  }
</style>

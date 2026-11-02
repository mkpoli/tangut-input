<script>
  // The text being written. Every finder inserts here at the caret; it can also be typed or pasted
  // into directly. Clicking beside a character opens that character in the card.
  import { text, attach, setText, remember, asCodePoints, asCodes } from '../lib/text.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { isTangut } from '../lib/db.svelte.js'
  import { preview } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {HTMLTextAreaElement | null} */
  let field = $state(null)
  let menu = $state(false)
  const count = $derived([...text.value].filter(isTangut).length)

  $effect(() => {
    attach(field)
    return () => attach(null)
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

  /** @param {FocusEvent} event */
  function closeMenu(event) {
    const next = /** @type {Node | null} */ (event.relatedTarget)
    if (!next || !(/** @type {HTMLElement} */ (event.currentTarget)).contains(next)) menu = false
  }
</script>

<section class="writing" aria-label={t('writing.label')}>
  <label class="label" for="writing">{t('writing.text')}</label>
  <textarea id="writing" bind:this={field} class="tg" rows="1" spellcheck="false" autocomplete="off"
    value={text.value} placeholder={t('writing.placeholder')}
    oninput={event => { setText(event.currentTarget.value); remember() }}
    onkeyup={remember} onclick={caret} onselect={remember} onblur={remember}></textarea>
  <div class="actions">
    {#if count}<span class="count muted">{count}</span>{/if}
    <button class="btn" type="button" disabled={!text.value} onclick={() => copy(text.value, t('writing.text'))}>{t('common.copy')}</button>
    <div class="more" onfocusout={closeMenu}>
      <button class="btn ghost" type="button" aria-haspopup="menu" aria-expanded={menu} aria-label={t('writing.more')}
        onclick={() => { menu = !menu }}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><g fill="currentColor"><circle cx="4" cy="10" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="16" cy="10" r="1.7"/></g></svg>
      </button>
      {#if menu}
        <div class="menu" role="menu">
          <button role="menuitem" type="button" disabled={!count} onclick={() => { copy(asCodePoints(text.value), t('writing.codePoints')); menu = false }}>{t('writing.copyCodePoints')}</button>
          <button role="menuitem" type="button" disabled={!count} onclick={() => { copy(asCodes(text.value), t('writing.cangjieCodes')); menu = false }}>{t('writing.copyCangjie')}</button>
          <button role="menuitem" type="button" disabled={!text.value} onclick={() => { setText(''); menu = false; field?.focus() }}>{t('writing.clear')}</button>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .writing{position:sticky;top:var(--top);z-index:15;display:flex;align-items:center;gap:14px;padding:10px 18px;background:var(--surface);border-bottom:1px solid var(--line)}
  .label{flex:none;width:44px}
  textarea{flex:1;min-width:0;resize:none;overflow:auto;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--bg);font-size:28px;line-height:1.35;letter-spacing:.04em}
  textarea::placeholder{font-family:var(--ui);font-size:14px;letter-spacing:0;color:var(--muted);line-height:2.4}
  textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
  .actions{display:flex;align-items:center;gap:4px}
  .count{font-size:12px;margin-right:6px;font-variant-numeric:tabular-nums}
  .more{position:relative}
  .menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;display:grid;min-width:210px;padding:5px;border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:var(--lift)}
  .menu button{padding:8px 10px;border:0;border-radius:6px;background:none;text-align:left;font-size:13px}
  .menu button:hover:not(:disabled){background:var(--hover)}
  .menu button:disabled{opacity:.45;cursor:default}
  @media (max-width:900px){
    .writing{gap:8px;padding:8px 12px}
    .label{display:none}
    textarea{font-size:24px;padding:6px 10px}
    textarea::placeholder{line-height:2.1}
  }
</style>

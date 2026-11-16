<script module>
  // A card needs an id for aria-controls; the module keeps the count across instances.
  let serial = 0
</script>

<script>
  import { isImeKey } from '../lib/keyboard.js'
  // One spelling as a reader needs it: the script with its romanisation beside it, and, on hover or
  // focus, the IPA and the records it comes from. The source prints transliteration; the script and
  // the IPA are worked out from it, so the card marks the printed form when it differs.
  import { onDestroy } from 'svelte'
  import { t } from '../lib/i18n.svelte.js'
  import { claim, release } from '../lib/spelling.js'
  import { copy } from '../lib/clip.svelte.js'
  import { SETA_SOURCE } from '../lib/seta.js'

  /** @type {{ script: string, transcription: string, ipa: string, lang: 'bo' | 'sa',
   *   printed?: string, hand?: string, count?: number, babelstone?: boolean, pua?: string }} */
  let { script, transcription, ipa, lang, printed = '', hand = '', count, babelstone = false, pua = '' } = $props()

  const id = `spelling-${++serial}`
  let open = $state(false)
  let pinned = $state(false)
  let x = $state(0)
  let y = $state(0)
  /** @type {HTMLButtonElement | undefined} */
  let trigger = $state(/** @type {HTMLButtonElement | undefined} */ (undefined))
  /** @type {HTMLElement | undefined} */
  let tip = $state(/** @type {HTMLElement | undefined} */ (undefined))
  /** @type {HTMLElement | undefined} */
  let wrap = $state(/** @type {HTMLElement | undefined} */ (undefined))
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let closing
  // Set while Escape puts focus back on the button, whose focus must not reopen the card.
  let restoring = false

  function close() {
    pinned = false
    open = false
    release(close)
  }

  // A card closes when the reader presses outside it, or moves the page under it. A pinned card is
  // no exception: its place would no longer point at the spelling.
  $effect(() => {
    if (!open) return
    /** @param {PointerEvent} event */
    const outside = event => {
      if (wrap?.contains(/** @type {Node | null} */ (event.target))) return
      close()
    }
    /** Keep the card beside its spelling while the page moves, and close it when the spelling
     *  leaves the viewport. */
    const follow = () => {
      if (!trigger) return
      const box = trigger.getBoundingClientRect()
      if (box.bottom < 0 || box.top > (globalThis.innerHeight || 600)) { close(); return }
      place(trigger)
    }
    /** @param {KeyboardEvent} event */
    const escape = event => {
      if (isImeKey(event) || event.key !== 'Escape') return
      event.stopPropagation()
      const inTip = Boolean(tip?.contains(document.activeElement))
      close()
      if (!inTip) return
      restoring = true
      trigger?.focus()
      queueMicrotask(() => { restoring = false })
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    document.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  })

  onDestroy(() => {
    release(close)
    clearTimeout(closing)
  })

  /** Put the card beside the spelling, or above it when the page has no room below.
   *  @param {HTMLElement} element */
  function place(element) {
    const box = element.getBoundingClientRect()
    const width = 280
    const height = 168
    x = Math.max(8, Math.min(box.left, (globalThis.innerWidth || 800) - width - 8))
    y = box.bottom + 6
    if (y + height > (globalThis.innerHeight || 600) - 8) y = Math.max(8, box.top - height - 6)
  }

  /** @param {Event & { currentTarget: HTMLElement }} event */
  function show(event) {
    if (restoring) return
    claim(close)
    clearTimeout(closing)
    place(event.currentTarget)
    open = true
  }

  function stay() {
    clearTimeout(closing)
  }

  function later() {
    if (pinned || wrap?.contains(document.activeElement)) return
    clearTimeout(closing)
    closing = setTimeout(close, 160)
  }

  /** @param {Event & { currentTarget: HTMLElement }} event */
  function toggle(event) {
    if (pinned) { close(); return }
    pinned = true
    show(event)
  }

  /** @param {FocusEvent & { currentTarget: HTMLElement }} event */
  function focusOut(event) {
    if (event.currentTarget.contains(/** @type {Node | null} */ (event.relatedTarget))) return
    close()
  }
</script>

<span class="spelling-wrap" bind:this={wrap} onfocusout={focusOut}>
  <button class="spelling" type="button" aria-expanded={open} aria-controls={open ? id : undefined}
    bind:this={trigger} onclick={toggle} onmouseenter={show} onmouseleave={later} onfocus={show}>
    {#if hand}<span class="hand">{hand}</span>{/if}
    <span class="script" lang={lang}>{script}</span>
    <span class="transcription">{transcription}</span>
    {#if count !== undefined && count !== 1}<span class="count">×{count || '?'}</span>{/if}
  </button>
  {#if open}
    <div id={id} class="spelling-tip ui-popover" style:left="{x}px" style:top="{y}px" role="dialog" tabindex="-1"
      aria-label={`${script} · ${transcription}${ipa ? ` · [${ipa}]` : ''}`} bind:this={tip}
      onmouseenter={stay} onmouseleave={later} onfocusin={stay}>
      <header>
        <span class="tip-script" lang={lang}>{script}</span>
        <span class="tip-transcription">{transcription}</span>
      </header>
      <dl>
        {#if ipa}<dt title={t('card.spellingIpaNote')}>{t('card.spellingIpa')}</dt><dd class="ipa">[{ipa}]</dd>{/if}
        {#if printed && printed !== transcription}<dt>{t('card.spellingPrinted')}</dt><dd class="ui-mono">{printed}</dd>{/if}
        {#if pua}<dt>{t('card.spellingSeta')}</dt><dd><button type="button" class="ui-mono seta" title={t('card.copyIdentifier', { id: pua })} onclick={() => copy(pua, pua)}>{pua}</button></dd>{/if}
      </dl>
      {#if printed.includes('?')}<p class="unread ui-hint">{t('card.spellingUnread')}</p>{/if}
      <p class="links">
        <a href="https://zhuanlan.zhihu.com/p/272058247" target="_blank" rel="noopener noreferrer">{t('card.spellingSource')}<span aria-hidden="true">↗</span></a>
        {#if babelstone}<a href="https://www.babelstone.co.uk/Tangut/TangutTibetanIndex.html" target="_blank" rel="noopener noreferrer">{t('card.spellingIndex')}<span aria-hidden="true">↗</span></a>{/if}
        {#if pua}<a href={SETA_SOURCE} target="_blank" rel="noopener noreferrer">{t('card.spellingSetaSource')}<span aria-hidden="true">↗</span></a>{/if}
      </p>
    </div>
  {/if}
</span>

<style>
  .spelling-wrap{display:inline}
  .spelling{display:inline-flex;align-items:baseline;gap:5px;padding:1px 4px;border:0;border-radius:var(--ui-radius-xs);background:none;color:inherit;font:inherit;white-space:nowrap;cursor:pointer}
  .spelling:hover,.spelling[aria-expanded='true']{background:var(--ui-color-surface-hover)}
  .hand{font-family:var(--ui-font-mono);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted)}
  .script{font-size:1.2em;line-height:1.2}
  .script[lang='bo']{font-family:'Noto Serif Tibetan','Noto Sans Tibetan',Kailasa,'Microsoft Himalaya','Jomolhari',serif}
  .script[lang='sa']{font-family:'Noto Serif Devanagari','Noto Sans Devanagari',Kohinoor,serif}
  .transcription{font-family:var(--ui-font-sans);font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
  .count{font-family:var(--ui-font-sans);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted)}
  .spelling-tip{position:fixed;z-index:var(--ui-z-hint);inline-size:280px;padding:var(--ui-space-lg) var(--ui-space-lg) var(--ui-space-md);font-size:var(--ui-text-sm)}
  header{display:flex;align-items:baseline;gap:var(--ui-space-sm)}
  .tip-script{font-size:28px;line-height:1.6}
  .tip-script[lang='bo']{font-family:'Noto Serif Tibetan','Noto Sans Tibetan',Kailasa,'Microsoft Himalaya','Jomolhari',serif}
  .tip-script[lang='sa']{font-family:'Noto Serif Devanagari','Noto Sans Devanagari',Kohinoor,serif}
  .tip-transcription{font-family:var(--ui-font-serif);font-size:var(--ui-text-md);color:var(--ui-color-ink-soft)}
  dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px var(--ui-space-md);margin:var(--ui-space-sm) 0 0;padding-top:var(--ui-space-sm);border-top:1px solid var(--ui-color-border)}
  dt{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  dd{margin:0;font-size:var(--ui-text-xs);overflow-wrap:anywhere}
  .ipa{font-family:var(--ui-font-sans);font-size:var(--ui-text-sm);letter-spacing:0.01em}
  .seta{padding:0;border:0;background:none;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
  .unread{margin:var(--ui-space-sm) 0 0;font-size:var(--ui-text-2xs);line-height:1.35}
  .links{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-md);margin:var(--ui-space-sm) 0 0;padding-top:var(--ui-space-sm);border-top:1px solid var(--ui-color-border)}
  .links a{display:inline-flex;align-items:center;gap:2px;font-size:var(--ui-text-xs);text-underline-offset:2px}
</style>

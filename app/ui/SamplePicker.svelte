<script>
  // A short list of passages copied from the recorded texts. Picking one replaces the text being
  // written, so a reader can try the transcribe table on a real line without typing Tangut first.
  import { tick } from 'svelte'
  import { db } from '../lib/db.svelte.js'
  import { setText, text, loadSample, restoreSample, sampleHistory } from '../lib/text.svelte.js'
  import { setQuery } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import Icon from './Icon.svelte'

  /** @type {{ align?: 'start' | 'end', syncQuery?: boolean, onpick?: () => void }} */
  let { align = 'end', syncQuery = false, onpick } = $props()

  let open = $state(false)
  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null)
  /** @type {HTMLElement | null} */
  let panel = $state(null)

  /** @param {string} value */
  function preview(value) {
    const flat = value.replace(/\s+/g, ' ')
    const chars = [...flat]
    return chars.length > 30 ? `${chars.slice(0, 30).join('')}…` : flat
  }

  /** @param {import('../lib/data.js').Sample} sample */
  function pick(sample) {
    loadSample(sample.text)
    if (syncQuery) setQuery(sample.text)
    open = false
    onpick?.()
  }

  function back() {
    restoreSample()
    if (syncQuery) setQuery(text.value)
    open = false
    onpick?.()
  }

  function clear() {
    setText('')
    if (syncQuery) setQuery('')
    open = false
    onpick?.()
  }

  async function show() {
    if (open) {
      open = false
      return
    }
    open = true
    await tick()
    ;/** @type {HTMLButtonElement | null} */ (panel?.querySelector('button') ?? null)?.focus()
  }

  /** @param {boolean} [restore] */
  function close(restore = true) {
    open = false
    if (restore) trigger?.focus()
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    const entries = [...(panel?.querySelectorAll('button') ?? [])]
    const at = entries.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement))
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (step) {
      event.preventDefault()
      entries[(at + step + entries.length) % entries.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? entries[0] : entries[entries.length - 1])?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  /** @param {PointerEvent} event */
  function outside(event) {
    if (open && !(/** @type {HTMLElement} */ (event.target)).closest('.samples')) open = false
  }

  /** @param {FocusEvent} event */
  function focusOut(event) {
    const next = /** @type {Node | null} */ (event.relatedTarget)
    if (open && (!next || !(/** @type {HTMLElement} */ (event.currentTarget)).contains(next))) open = false
  }

  $effect(() => {
    if (!open) return
    addEventListener('pointerdown', outside)
    return () => removeEventListener('pointerdown', outside)
  })
</script>

<div class="samples" class:start={align === 'start'} onfocusout={focusOut}>
  <button class="ui-button trigger" data-variant="quiet" data-size="sm" type="button" bind:this={trigger}
    aria-haspopup="dialog" aria-expanded={open} aria-label={t('samples.button')} title={t('samples.button')}
    onclick={show}>
    <Icon name="book" size={16}/>
    <span class="label">{t('samples.button')}</span>
  </button>
  {#if open}
    <div class="panel ui-menu" role="dialog" tabindex="-1" aria-label={t('samples.title')} bind:this={panel} onkeydown={keys}>
      <header class="head">
        <p class="ui-label">{t('samples.title')}</p>
        <p class="ui-hint">{t('samples.hint')}</p>
        {#if text.value}<p class="note ui-hint">{t('samples.replace')}</p>{/if}
      </header>
      {#if sampleHistory.backup !== null || text.value}
        <div class="actions">
          {#if sampleHistory.backup !== null}
            <button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={back}>
              <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M8 5 4 9l4 4M5 9h5.5a4 4 0 0 1 0 8H8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {t('samples.back')}
            </button>
          {/if}
          <button class="ui-button" data-variant="quiet" data-size="sm" type="button" disabled={!text.value} onclick={clear}>
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6.5 6l.8 9h5.4l.8-9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {t('samples.clear')}
          </button>
        </div>
      {/if}
      {#if !db.samples.length}
        <p class="ui-hint">{t('samples.loading')}</p>
      {:else}
        <div class="list">
          {#each db.samples as sample (sample.id)}
            <button class="item" type="button" onclick={() => pick(sample)}>
              <span class="row">
                <span class="source">{sample.sourceTitle}</span>
                {#if sample.famous}<span class="famous">{t('samples.famous')}</span>{/if}
              </span>
              <span class="meta">{sample.label} · {sample.licence}</span>
              <span class="preview ui-script" lang="txg">{preview(sample.text)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .samples{position:relative}
  .trigger{gap:var(--ui-space-xs)}
  .panel{position:absolute;right:0;top:calc(100% + 6px);z-index:var(--ui-z-menu);display:grid;gap:var(--ui-space-sm);inline-size:min(360px, calc(100vw - 24px));padding:var(--ui-space-md)}
  .start .panel{right:auto;left:0}
  .head{display:grid;gap:var(--ui-space-2xs)}
  .head p{margin:0}
  .list{display:grid;gap:2px;max-block-size:min(56dvh, 470px);overflow:auto;margin-inline:calc(var(--ui-space-md) * -1);padding-inline:var(--ui-space-md)}
  .item{display:grid;gap:2px;padding:var(--ui-space-sm);border:0;border-radius:var(--ui-radius-sm);background:none;color:inherit;text-align:start;cursor:pointer}
  .item:hover,.item:focus-visible{background:var(--ui-color-surface-hover)}
  .item:focus-visible{outline:2px solid var(--ui-color-accent);outline-offset:-2px}
  .row{display:flex;align-items:baseline;gap:var(--ui-space-xs);min-inline-size:0}
  .source{font-size:var(--ui-text-sm);font-weight:var(--ui-weight-semibold);line-height:1.35}
  .famous{flex:none;padding:1px 5px;border:1px solid var(--ui-color-accent);border-radius:var(--ui-radius-pill);color:var(--ui-color-accent-ink);font-size:var(--ui-text-2xs);line-height:1.4}
  .meta{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .preview{overflow:hidden;color:var(--ui-color-ink-soft);font-size:18px;line-height:1.4;text-overflow:ellipsis;white-space:nowrap}
  .note{margin:0;color:var(--ui-color-accent-ink)}
  .actions{display:flex;justify-content:flex-end;gap:var(--ui-space-xs);padding-block:var(--ui-space-2xs) var(--ui-space-sm);border-bottom:1px solid var(--ui-color-border)}
  .actions :global(.ui-button){gap:var(--ui-space-2xs)}
  @media (max-width:900px){
    .trigger .label{display:none}
    .trigger{padding-inline:var(--ui-space-xs)}
  }
  @media (max-width:700px){
    .panel{position:fixed;inset:auto 0 0 0;inline-size:auto;max-block-size:82dvh;border-radius:var(--ui-radius-2xl) var(--ui-radius-2xl) 0 0;padding-bottom:calc(var(--ui-space-lg) + env(safe-area-inset-bottom))}
  }
</style>

<script>
  // 四角號碼, the four-corner code: six digits read from the shapes in the four corners of the
  // character, then a digit naming the shape beside the last corner. A reader with a printed
  // dictionary can find a character by its code without knowing a reading or a decomposition.
  import { db, ix, gloss } from '../lib/db.svelte.js'
  import G from '../ui/G.svelte'
  import Icon from '../ui/Icon.svelte'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus } from '../lib/ui.svelte.js'
  import { bySijiao } from '../lib/search.js'
  import { t } from '../lib/i18n.svelte.js'

  const PAGE = 9
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  // The digits 1 to 9 and 0, on the letter that roughly spells them, as the four-corner schemes do.
  const KEYS = /** @type {Record<string, string>} */ ({ i: '1', e: '2', s: '3', x: '4', w: '5', l: '6', q: '7', b: '8', j: '9', o: '0' })

  let code = $state((route.q ?? '').replace(/[^0-9]/g, '').slice(0, 6))
  let page = $state(0)
  let active = $state(0)
  /** @type {HTMLInputElement | null} */
  let input = $state(null)
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  const ready = $derived(db.status === 'ready')
  const hits = $derived(ready ? bySijiao(code) : [])
  const pages = $derived(Math.max(1, Math.ceil(hits.length / PAGE)))
  const shown = $derived(hits.slice(page * PAGE, page * PAGE + PAGE))

  $effect(() => { void code; page = 0; active = 0 })
  $effect(() => { const char = shown[active]?.char; if (char) preview(char) })

  /** @param {string} value */
  function setCode(value) {
    code = value.replace(/[^0-9]/g, '').slice(0, 6)
    setQuery(code)
  }
  /** @param {number} index */
  function commit(index) {
    const hit = shown[index]
    if (!hit) return
    put(hit.char, { place: index })
    setCode('')
    input?.focus()
  }
  /** @param {string} digit */
  function press(digit) {
    if (digit === 'back') { if (code) setCode(code.slice(0, -1)); return }
    if (digit === 'space') { if (code) commit(active); return }
    setCode(code + digit)
    if (!touch) input?.focus()
  }
  /** @param {number} delta */
  function turn(delta) {
    page = (page + delta + pages) % pages
    active = 0
  }
  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const k = event.key
    if (k === 'Backspace' && code) { event.preventDefault(); setCode(code.slice(0, -1)); return }
    if (k === 'Escape' && code) { event.preventDefault(); setCode(''); return }
    if (/^[0-9]$/.test(k)) { event.preventDefault(); setCode(code + k); return }
    if (!code) return
    if (k === ' ' || k === 'Enter') { event.preventDefault(); commit(active) }
    else if (k === 'ArrowRight') { event.preventDefault(); if (active < shown.length - 1) active++; else if (page < pages - 1) turn(1) }
    else if (k === 'ArrowLeft') { event.preventDefault(); if (active > 0) active--; else if (page > 0) { turn(-1); active = PAGE - 1 } }
    else if (k === 'ArrowDown' || k === 'PageDown') { event.preventDefault(); turn(1) }
    else if (k === 'ArrowUp' || k === 'PageUp') { event.preventDefault(); turn(-1) }
  }
</script>

<div class="ui-page sijiao">
  <section class="composer" aria-label="Four-corner code">
    <div class="box">
      <input bind:this={input} data-primary class="ui-input code-input ui-mono" value={code} spellcheck="false" autocomplete="off"
        inputmode={touch ? 'none' : 'numeric'} aria-label={t('sijiao.label')} placeholder={t('sijiao.placeholder')}
        oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { setCode(event.currentTarget.value); event.currentTarget.value = code }} onkeydown={keys} use:autofocus />
      <span class="ui-count count" role="status">{#if code}{hits.length ? t('common.characters', { count: hits.length }) : t('sijiao.none')}{/if}</span>
    </div>

    <div class="ui-candidates" role="listbox" aria-label={t('common.candidates')} data-idle={!code ? '' : undefined}>
      {#if code && shown.length}
        {#each shown as hit, i (hit.char)}
          <button type="button" role="option" class="ui-candidate" aria-selected={i === active}
            onclick={() => commit(i)} onmouseenter={() => { active = i }} title={gloss(hit.char)}>
            <span class="ui-candidate-number">{i + 1}</span>
            <G char={hit.char} />
            <span class="ui-candidate-code"><span class="typed">{code}</span>{hit.code.slice(code.length)}</span>
          </button>
        {/each}
        {#if pages > 1}
          <span class="ui-pager">
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" aria-label={t('common.previous')} onclick={() => turn(-1)}><Icon name="prev" size={16}/></button>
            <span>{page + 1}/{pages}</span>
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" aria-label={t('common.more')} onclick={() => turn(1)}><Icon name="next" size={16}/></button>
          </span>
        {/if}
      {:else if code}
        <p>{t('sijiao.noCode', { code })}</p>
      {:else}
        <p class="keys">{@html t('sijiao.keys')}</p>
      {/if}
    </div>
  </section>

  <section class="pad" aria-label={t('sijiao.padLabel')}>
    <header class="head"><h2 class="ui-label">{t('sijiao.digits')}</h2><p class="ui-hint">{t('sijiao.digitsHint')}</p></header>
    <div class="ui-keys">
      {#each ROWS as row (row)}
        <div class="ui-key-row">
          {#each [...row] as letter (letter)}
            <button type="button" class="ui-key digit-key" data-dead={!KEYS[letter] ? '' : undefined} disabled={!KEYS[letter]} onclick={() => press(KEYS[letter])}
              aria-label={KEYS[letter] ? t('sijiao.digitKey', { digit: KEYS[letter] }) : t('sijiao.unusedKey', { letter })}>
              <span class="digit ui-mono">{KEYS[letter] ?? ''}</span>
              <span class="letter ui-mono">{letter}</span>
            </button>
          {/each}
          {#if row === 'zxcvbnm'}<button type="button" class="ui-key" data-wide onclick={() => press('back')} aria-label={t('common.backspace')}>⌫</button>{/if}
        </div>
      {/each}
      <div class="ui-key-row"><button type="button" class="ui-key" data-space onclick={() => press('space')} disabled={!code}>{#if shown[active]}{t('cangjie.spaceAdds')} <span class="ui-script">{shown[active].char}</span>{:else}{t('cangjie.space')}{/if}</button></div>
    </div>
  </section>

  <section class="legend">
    <h2 class="ui-label">{t('sijiao.corners')}</h2>
    <p class="ui-notice">{@html t('sijiao.cornersHint', { count: ix.sijiao.size })}</p>
  </section>
</div>

<style>
  .composer{display:grid;gap:var(--ui-space-md)}
  .box{display:flex;align-items:center;gap:var(--ui-space-xl)}
  .code-input{flex:1;min-inline-size:0;min-block-size:60px;padding:var(--ui-space-md) var(--ui-space-xl);border-radius:var(--ui-radius-lg);font-size:30px;letter-spacing:.24em}
  .code-input::placeholder{font-family:var(--ui-font-sans);font-size:var(--ui-text-lg);letter-spacing:.02em}
  .count{min-inline-size:9em;text-align:end}
  .keys{color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm)}
  .sijiao .ui-candidate :global(.ui-script){font-size:34px}
  .pad{max-inline-size:560px;display:grid;gap:var(--ui-space-md)}
  .head{display:flex;align-items:baseline;flex-wrap:wrap;gap:var(--ui-space-sm)}
  .head .ui-hint{font-size:var(--ui-text-xs)}
  .digit-key{position:relative;place-items:center;max-inline-size:50px;aspect-ratio:1;grid-template-rows:1fr}
  .digit-key .digit{font-size:17px;font-weight:var(--ui-weight-semibold)}
  .digit-key .letter{position:absolute;right:5px;bottom:3px;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .digit-key[data-dead]{opacity:.35}
  .legend{display:grid;gap:var(--ui-space-sm);max-inline-size:60ch}
  .legend .ui-notice{font-size:var(--ui-text-xs);line-height:1.55}
  @media (max-width:900px){
    .code-input{min-block-size:50px;padding:var(--ui-space-sm) var(--ui-space-md);font-size:24px}
    .count{display:none}
    .keys{display:none}
    .sijiao .ui-candidate :global(.ui-script){font-size:30px}
  }
</style>

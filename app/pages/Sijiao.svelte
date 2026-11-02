<script>
  // 四角號碼, the four-corner code: six digits read from the shapes in the four corners of the
  // character, then a digit naming the shape beside the last corner. A reader with a printed
  // dictionary can find a character by its code without knowing a reading or a decomposition.
  import { db, ix, gloss } from '../lib/db.svelte.js'
  import G from '../ui/G.svelte'
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

<div class="sijiao">
  <section class="composer" aria-label="Four-corner code">
    <div class="box">
      <input bind:this={input} data-primary class="code mono" value={code} spellcheck="false" autocomplete="off"
        inputmode={touch ? 'none' : 'numeric'} aria-label={t('sijiao.label')} placeholder={t('sijiao.placeholder')}
        oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => setCode(event.currentTarget.value)} onkeydown={keys} use:autofocus />
      <span class="count muted" role="status">{#if code}{hits.length ? t('common.characters', { count: hits.length }) : t('sijiao.none')}{/if}</span>
    </div>

    <div class="bar" role="listbox" aria-label={t('common.candidates')} class:idle={!code}>
      {#if code && shown.length}
        {#each shown as hit, i (hit.char)}
          <button type="button" role="option" class="cand" aria-selected={i === active}
            onclick={() => commit(i)} onmouseenter={() => { active = i }} title={gloss(hit.char)}>
            <span class="n mono">{i + 1}</span>
            <G char={hit.char} />
            <span class="rest mono"><span class="typed">{code}</span>{hit.code.slice(code.length)}</span>
          </button>
        {/each}
        {#if pages > 1}
          <span class="pager">
            <button type="button" class="btn ghost" aria-label={t('common.previous')} onclick={() => turn(-1)}>‹</button>
            <span class="muted mono">{page + 1}/{pages}</span>
            <button type="button" class="btn ghost" aria-label={t('common.more')} onclick={() => turn(1)}>›</button>
          </span>
        {/if}
      {:else if code}
        <p class="muted">{t('sijiao.noCode', { code })}</p>
      {:else}
        <p class="muted keys">{@html t('sijiao.keys')}</p>
      {/if}
    </div>
  </section>

  <section class="pad" aria-label={t('sijiao.padLabel')}>
    <div class="head"><h2 class="label">{t('sijiao.digits')}</h2><p class="muted">{t('sijiao.digitsHint')}</p></div>
    {#each ROWS as row (row)}
      <div class="row">
        {#each [...row] as letter (letter)}
          <button type="button" class="key" class:dead={!KEYS[letter]} disabled={!KEYS[letter]} onclick={() => press(KEYS[letter])}
            aria-label={KEYS[letter] ? t('sijiao.digitKey', { digit: KEYS[letter] }) : t('sijiao.unusedKey', { letter })}>
            <span class="digit mono">{KEYS[letter] ?? ''}</span>
            <span class="letter mono">{letter}</span>
          </button>
        {/each}
        {#if row === 'zxcvbnm'}<button type="button" class="key wide" onclick={() => press('back')} aria-label={t('common.backspace')}>⌫</button>{/if}
      </div>
    {/each}
    <div class="row"><button type="button" class="key space" onclick={() => press('space')} disabled={!code}>{#if shown[active]}{t('cangjie.spaceAdds')} <span class="tg">{shown[active].char}</span>{:else}{t('cangjie.space')}{/if}</button></div>
  </section>

  <div class="legend">
    <h2 class="label">{t('sijiao.corners')}</h2>
    <p class="muted">{@html t('sijiao.cornersHint', { count: ix.sijiao.size })}</p>
  </div>
</div>

<style>
  .sijiao{display:grid;gap:22px}
  .composer{display:grid;gap:10px}
  .box{display:flex;align-items:center;gap:14px}
  .code{flex:1;min-width:0;padding:12px 16px;border:1px solid var(--line-strong);border-radius:12px;background:var(--surface);font-size:30px;letter-spacing:.24em}
  .code:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
  .code::placeholder{font-size:17px;letter-spacing:.02em;color:var(--muted);font-family:var(--ui)}
  .count{min-width:9em;text-align:right;font-size:13px}
  .bar{display:flex;align-items:stretch;gap:6px;min-height:92px;padding:8px;border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow-x:auto}
  .bar.idle{align-items:center;padding:8px 14px}
  .bar p{font-size:13px}
  .bar :global(kbd){margin:0 1px}
  .cand{position:relative;display:grid;grid-template-rows:auto 1fr auto;justify-items:center;min-width:76px;padding:4px 6px 6px;border:1px solid transparent;border-radius:9px;background:none}
  .cand:hover{background:var(--hover)}
  .cand[aria-selected="true"]{background:var(--accent-soft);border-color:var(--accent)}
  .cand .n{align-self:start;justify-self:start;font-size:11px;color:var(--muted)}
  .cand[aria-selected="true"] .n{color:var(--accent-ink);font-weight:700}
  .cand :global(.tg){font-size:40px}
  .rest{font-size:12px;letter-spacing:.04em}
  .typed{color:var(--muted)}
  .pager{display:flex;align-items:center;gap:2px;margin-left:auto;padding-left:8px;font-size:12px}
  .pad{max-width:560px}
  .head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}
  .head p{font-size:12.5px}
  .row{display:flex;gap:6px;margin-bottom:6px}
  .key{position:relative;display:grid;place-items:center;width:52px;height:52px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
  .key .digit{font-size:17px;font-weight:600}
  .key .letter{position:absolute;right:5px;bottom:3px;font-size:10px;color:var(--muted)}
  .key.dead{opacity:.35}
  .key.wide{width:auto;flex:1}
  .key.space{width:100%;height:40px;margin-top:2px;font-size:13px}
  .key.space .tg{font-size:20px;margin-left:6px}
  .legend{max-width:60ch}
  .legend p{font-size:12.5px;line-height:1.55}
</style>

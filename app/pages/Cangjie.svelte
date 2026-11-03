<script>
  // Cangjie, the fast method: letters name the shapes of a character in writing order. The code
  // box behaves like an input method: candidates are numbered, Space or a digit commits one into
  // the text, Backspace in an empty box deletes from the text. The keyboard below doubles as the
  // key chart: each key shows the shapes it stands for and dims when no code continues with it.
  // The component palette beside it lists every component under its own code.
  import { db, ix, gloss, hasGlyph } from '../lib/db.svelte.js'
  import G from '../ui/G.svelte'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus } from '../lib/ui.svelte.js'
  import { backspace } from '../lib/text.svelte.js'
  import { byCode } from '../lib/search.js'
  import { t } from '../lib/i18n.svelte.js'

  const PAGE = 9
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

  let code = $state(route.q.toLowerCase().replace(/[^a-z]/g, ''))
  let page = $state(0)
  let active = $state(0)
  let palette = $state(/** @type {'all' | string} */ ('all'))
  /** @type {HTMLInputElement | null} */
  let input = $state(null)
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  const ready = $derived(db.status === 'ready')
  const hits = $derived(ready ? byCode(code) : [])
  const fuzz = $derived(hits.length > 0 && hits[0].near === true)
  const pages = $derived(Math.max(1, Math.ceil(hits.length / PAGE)))
  const shown = $derived(hits.slice(page * PAGE, page * PAGE + PAGE))

  // The letters that continue the typed code, with how many codes each leads to.
  const next = $derived.by(() => {
    /** @type {Map<string, number>} */
    const counts = new Map()
    if (!ready) return counts
    for (const [full] of ix.codeList) {
      if (full.length > code.length && full.startsWith(code)) {
        const letter = full[code.length]
        counts.set(letter, (counts.get(letter) ?? 0) + 1)
      }
    }
    return counts
  })

  // The shapes each key stands for: the components whose whole code is p + that letter.
  const roots = $derived.by(() => {
    /** @type {Map<string, string[]>} */
    const map = new Map()
    if (!ready) return map
    for (const [full, char] of ix.palette) if (full.length === 2 && hasGlyph(char)) map.set(full[1], [...(map.get(full[1]) ?? []), char])
    return map
  })

  // The palette, grouped by the letter after p.
  const groups = $derived.by(() => {
    /** @type {Map<string, { char: string, code: string }[]>} */
    const map = new Map()
    if (!ready) return map
    const seen = new Set()
    for (const [full, char] of ix.palette) {
      if (seen.has(char)) continue
      seen.add(char)
      const letter = full[1] ?? ''
      map.set(letter, [...(map.get(letter) ?? []), { char, code: full }])
    }
    return new Map([...map].sort((a, b) => a[0].localeCompare(b[0])))
  })
  const typedComponent = $derived(code.startsWith('p') && code.length > 1 ? code[1] : '')
  const paletteShown = $derived(palette === 'all' ? [...groups] : [...groups].filter(([letter]) => letter === palette))

  $effect(() => {
    // A new code starts at the first page; the highlighted candidate is previewed in the card.
    void code
    page = 0
    active = 0
  })
  $effect(() => {
    const char = shown[active]?.char
    if (char) preview(char)
  })
  $effect(() => { if (typedComponent) palette = typedComponent })

  /** @param {string} value */
  function setCode(value) {
    code = value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)
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

  /** @param {string} letter */
  function press(letter) {
    if (letter === 'back') {
      if (code) setCode(code.slice(0, -1))
      else backspace()
    } else if (letter === 'space') {
      if (code) commit(active)
    } else setCode(code + letter)
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
    if (k === 'Backspace' && !code) { event.preventDefault(); backspace(); return }
    if (k === 'Escape' && code) { event.preventDefault(); setCode(''); return }
    if (!code) return
    if (k === ' ' || k === 'Enter') { event.preventDefault(); commit(active) }
    else if (/^[1-9]$/.test(k)) { event.preventDefault(); commit(Number(k) - 1) }
    else if (k === 'ArrowRight') { event.preventDefault(); if (active < shown.length - 1) active++; else if (page < pages - 1) turn(1) }
    else if (k === 'ArrowLeft') { event.preventDefault(); if (active > 0) active--; else if (page > 0) { turn(-1); active = PAGE - 1 } }
    else if (k === 'ArrowDown' || k === 'PageDown' || k === '=' || k === '.') { event.preventDefault(); turn(1) }
    else if (k === 'ArrowUp' || k === 'PageUp' || k === '-' || k === ',') { event.preventDefault(); turn(-1) }
  }

  /** The letters of a candidate's code: the typed part, then the rest. @param {string} full */
  const split = full => [full.slice(0, code.length), full.slice(code.length)]
</script>

<div class="ui-page cangjie" data-width="wide">
  <section class="composer" aria-label="Cangjie code">
    <div class="box">
      <input bind:this={input} data-primary class="ui-input code-input ui-mono" value={code} spellcheck="false" autocomplete="off" autocapitalize="off"
        inputmode={touch ? 'none' : 'text'} aria-label={t('cangjie.label')} placeholder={t('cangjie.placeholder')}
        oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => setCode(event.currentTarget.value)} onkeydown={keys} use:autofocus />
      <span class="ui-count count" role="status">{#if code}{hits.length ? t('common.characters', { count: hits.length }) : t('cangjie.none')}{/if}</span>
    </div>

    <div class="ui-candidates" role="listbox" aria-label={t('common.candidates')} data-idle={!code ? '' : undefined}>
      {#if code && fuzz}<p class="ui-hint near">{t('cangjie.near', { code })}</p>{/if}
      {#if code && shown.length}
        {#each shown as hit, i (hit.char)}
          {@const [typed, rest] = split(hit.code)}
          <button type="button" role="option" class="ui-candidate" aria-selected={i === active}
            onclick={() => commit(i)} onmouseenter={() => { active = i }} title={gloss(hit.char)}>
            <span class="ui-candidate-number">{i + 1}</span>
            <G char={hit.char} />
            <span class="ui-candidate-code"><span class="typed">{typed}</span>{rest}</span>
          </button>
        {/each}
        {#if pages > 1}
          <span class="ui-pager">
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" aria-label={t('common.previous')} onclick={() => turn(-1)}>‹</button>
            <span>{page + 1}/{pages}</span>
            <button type="button" class="ui-button" data-variant="quiet" data-size="icon-sm" aria-label={t('common.more')} onclick={() => turn(1)}>›</button>
          </span>
        {/if}
      {:else if code}
        <p>{t('cangjie.noCode', { code })}</p>
      {:else}
        <p class="keys">{@html t('cangjie.keys')}</p>
      {/if}
    </div>
  </section>

  <div class="split">
    <section class="keyboard" aria-label={t('cangjie.keysLabel')}>
      <header class="head"><h2 class="ui-label">{t('cangjie.keysTitle')}</h2><p class="ui-hint">{#if code}{t('cangjie.keysHint')}{:else}{t('cangjie.keysHintIdle')}{/if}</p></header>
      <div class="ui-keys">
        {#each ROWS as row, r (row)}
          <div class="ui-key-row" style:padding-inline-start="{r * 18}px">
            {#each row as letter (letter)}
              {@const n = next.get(letter) ?? 0}
              <button type="button" class="ui-key" data-dead={!n ? '' : undefined} onclick={() => press(letter)}
                title={n ? t('cangjie.keyContinues', { count: n, letter }) : t('cangjie.keyDead', { letter })}>
                <span class="ui-key-letter">{letter}</span>
                <span class="ui-key-glyphs ui-script">{(roots.get(letter) ?? []).slice(0, 3).join('')}</span>
              </button>
            {/each}
            {#if r === 2}<button type="button" class="ui-key" data-wide onclick={() => press('back')} aria-label={t('common.backspace')}>⌫</button>{/if}
          </div>
        {/each}
        <div class="ui-key-row"><button type="button" class="ui-key" data-space onclick={() => press('space')} disabled={!code}>{#if shown[active]}{t('cangjie.spaceAdds')} <span class="ui-script">{shown[active].char}</span>{:else}{t('cangjie.space')}{/if}</button></div>
      </div>
    </section>

    <section class="palette" aria-label={t('cangjie.componentsLabel')}>
      <header class="head">
        <h2 class="ui-label">{t('cangjie.components')}</h2>
        <p class="ui-hint">{@html t('cangjie.componentsHint')}</p>
      </header>
      <div class="ui-chip-row letters" role="group" aria-label={t('cangjie.groupBy')}>
        <button type="button" class="ui-chip" aria-pressed={palette === 'all'} onclick={() => { palette = 'all' }}>{t('common.all')}</button>
        {#each [...groups.keys()] as letter (letter)}
          <button type="button" class="ui-chip ui-mono" aria-pressed={palette === letter} onclick={() => { palette = letter }}>p{letter}</button>
        {/each}
      </div>
      <div class="groups">
        {#each paletteShown as [letter, items] (letter)}
          <div class="group">
            <h3 class="group-head"><span class="ui-mono">p{letter}</span> <span class="ui-script group-glyphs">{(roots.get(letter) ?? []).join(' ')}</span></h3>
            <div class="ui-tiles comps" style:--ui-tile-size="54px">
              {#each items as item (item.char)}
                <button type="button" class="ui-tile comp" data-open={route.c === item.char ? '' : undefined}
                  onclick={() => choose(item.char)} ondblclick={() => put(item.char)} title={t('cangjie.componentTitle', { code: item.code, count: ix.usedBy.get(item.char)?.size ?? 0 })}>
                  <G char={item.char} /><span class="ui-tile-note ui-mono">{item.code}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .composer{display:grid;gap:var(--ui-space-md)}
  .near{margin:0 0 var(--ui-space-sm)}
  .box{display:flex;align-items:center;gap:var(--ui-space-xl)}
  .code-input{flex:1;min-inline-size:0;min-block-size:60px;padding:var(--ui-space-md) var(--ui-space-xl);border-radius:var(--ui-radius-lg);font-size:30px;letter-spacing:.14em;text-transform:lowercase}
  .code-input::placeholder{font-family:var(--ui-font-sans);font-size:var(--ui-text-lg);letter-spacing:.02em}
  .count{min-inline-size:9em;text-align:end}
  .keys{color:var(--ui-color-ink-muted);font-size:var(--ui-text-sm)}
  .cangjie .ui-candidate :global(.ui-script){font-size:34px}
  .split{display:grid;grid-template-columns:minmax(0,540px) minmax(0,1fr);gap:var(--ui-space-3xl);align-items:start}
  .head{display:flex;align-items:baseline;flex-wrap:wrap;gap:var(--ui-space-sm);margin-bottom:var(--ui-space-md)}
  .head .ui-hint{font-size:var(--ui-text-xs)}
  .keyboard{min-inline-size:0}
  .palette{min-inline-size:0}
  .letters{margin-bottom:var(--ui-space-md)}
  .groups{display:grid;gap:var(--ui-space-xl);max-block-size:calc(100dvh - 390px);min-block-size:320px;overflow:auto;padding-inline-end:var(--ui-space-2xs)}
  .group-head{position:sticky;top:0;z-index:1;display:flex;align-items:baseline;gap:var(--ui-space-sm);padding:var(--ui-space-2xs) 0;background:var(--ui-color-canvas);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);font-weight:var(--ui-weight-semibold)}
  .group-glyphs{font-size:15px;color:var(--ui-color-ink-muted)}
  .comp{aspect-ratio:1/1.08}
  .comp :global(.ui-script){font-size:26px}
  .comp :global(.ui-nog){font-size:9px}
  .comp[data-open]{background:var(--ui-color-accent-soft)}
  .comp .ui-tile-note{font-size:var(--ui-text-2xs)}
  @media (max-width:1320px){
    .split{grid-template-columns:1fr}
    .groups{max-block-size:520px}
  }
  @media (max-width:900px){
    .code-input{min-block-size:50px;padding:var(--ui-space-sm) var(--ui-space-md);font-size:24px}
    .count{display:none}
    .cangjie .ui-candidate :global(.ui-script){font-size:30px}
    .keys{display:none}
    .ui-key-row[style]{padding-inline-start:0 !important}
    .ui-key{max-inline-size:none}
    .ui-key-glyphs{font-size:12px}
  }
</style>

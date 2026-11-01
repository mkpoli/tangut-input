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
    put(hit.char)
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

<div class="cangjie">
  <section class="composer" aria-label="Cangjie code">
    <div class="box">
      <input bind:this={input} data-primary class="code mono" value={code} spellcheck="false" autocomplete="off" autocapitalize="off"
        inputmode={touch ? 'none' : 'text'} aria-label="Cangjie code" placeholder="type a code, e.g. msbu"
        oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => setCode(event.currentTarget.value)} onkeydown={keys} use:autofocus />
      <span class="count muted" role="status">{#if code}{hits.length ? `${hits.length} ${hits.length === 1 ? 'character' : 'characters'}` : 'no code begins so'}{/if}</span>
    </div>

    <div class="bar" role="listbox" aria-label="Candidates" class:idle={!code}>
      {#if code && shown.length}
        {#each shown as hit, i (hit.char)}
          {@const [typed, rest] = split(hit.code)}
          <button type="button" role="option" class="cand" aria-selected={i === active}
            onclick={() => commit(i)} onmouseenter={() => { active = i }} title={gloss(hit.char)}>
            <span class="n mono">{i + 1}</span>
            <G char={hit.char} />
            <span class="rest mono"><span class="typed">{typed}</span>{rest}</span>
          </button>
        {/each}
        {#if pages > 1}
          <span class="pager">
            <button type="button" class="btn ghost" aria-label="Previous candidates" onclick={() => turn(-1)}>‹</button>
            <span class="muted mono">{page + 1}/{pages}</span>
            <button type="button" class="btn ghost" aria-label="More candidates" onclick={() => turn(1)}>›</button>
          </span>
        {/if}
      {:else if code}
        <p class="muted">No code begins with <b class="mono">{code}</b>. Backspace and try another letter; the keyboard dims the keys that lead nowhere.</p>
      {:else}
        <p class="muted keys"><kbd>Space</kbd> or <kbd>1</kbd>–<kbd>9</kbd> adds a candidate to the text · <kbd>←</kbd><kbd>→</kbd> highlight · <kbd>↑</kbd><kbd>↓</kbd> page · <kbd>Esc</kbd> clears · <kbd>⌫</kbd> on an empty box deletes from the text</p>
      {/if}
    </div>
  </section>

  <div class="split">
    <section class="keyboard" aria-label="Keyboard and key chart">
      <div class="head"><h2 class="label">Keys</h2><p class="muted">Each key and the shapes it names. {#if code}Faint keys continue no code.{/if}</p></div>
      {#each ROWS as row, r (row)}
        <div class="row" style:padding-left="{r * 18}px">
          {#each row as letter (letter)}
            {@const n = next.get(letter) ?? 0}
            <button type="button" class="key" class:dead={!n} onclick={() => press(letter)} title={n ? `${n} codes continue with ${letter}` : `No code continues with ${letter}`}>
              <span class="letter mono">{letter}</span>
              <span class="roots tg">{(roots.get(letter) ?? []).slice(0, 3).join('')}</span>
            </button>
          {/each}
          {#if r === 2}<button type="button" class="key wide" onclick={() => press('back')} aria-label="Backspace">⌫</button>{/if}
        </div>
      {/each}
      <div class="row"><button type="button" class="key space" onclick={() => press('space')} disabled={!code}>{#if shown[active]}Space adds <span class="tg">{shown[active].char}</span>{:else}Space{/if}</button></div>
    </section>

    <section class="palette" aria-label="Components by code">
      <div class="head">
        <h2 class="label">Components</h2>
        <p class="muted">Each component is typed as <span class="mono">p</span> and its own code.</p>
      </div>
      <div class="letters" role="group" aria-label="Group by second letter">
        <button type="button" class="chip" aria-pressed={palette === 'all'} onclick={() => { palette = 'all' }}>all</button>
        {#each [...groups.keys()] as letter (letter)}
          <button type="button" class="chip mono" aria-pressed={palette === letter} onclick={() => { palette = letter }}>p{letter}</button>
        {/each}
      </div>
      <div class="groups">
        {#each paletteShown as [letter, items] (letter)}
          <div class="group">
            <h3 class="mono">p{letter} <span class="tg">{(roots.get(letter) ?? []).join(' ')}</span></h3>
            <div class="comps">
              {#each items as item (item.char)}
                <button type="button" class="comp" class:match={code.startsWith('p') && item.code.startsWith(code)} class:on={route.c === item.char}
                  onclick={() => choose(item.char)} ondblclick={() => put(item.char)} title="{item.code}, used in {ix.usedBy.get(item.char)?.size ?? 0} characters">
                  <G char={item.char} /><small class="mono">{item.code}</small>
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
  .cangjie{display:grid;gap:22px}
  .composer{display:grid;gap:10px}
  .box{display:flex;align-items:center;gap:14px}
  .code{flex:1;min-width:0;padding:12px 16px;border:1px solid var(--line-strong);border-radius:12px;background:var(--surface);font-size:30px;letter-spacing:.14em;text-transform:lowercase}
  .code:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
  .code::placeholder{font-size:17px;letter-spacing:.02em;color:var(--muted);font-family:var(--ui)}
  .count{min-width:9em;text-align:right;font-size:13px}
  .bar{display:flex;align-items:stretch;gap:6px;min-height:92px;padding:8px;border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow-x:auto}
  .bar.idle{align-items:center;padding:8px 14px}
  .bar p{font-size:13px}
  .keys kbd{margin:0 1px}
  .cand{position:relative;display:grid;grid-template-rows:auto 1fr auto;justify-items:center;min-width:76px;padding:4px 6px 6px;border:1px solid transparent;border-radius:9px;background:none}
  .cand:hover{background:var(--hover)}
  .cand[aria-selected="true"]{background:var(--accent-soft);border-color:var(--accent)}
  .cand .n{align-self:start;justify-self:start;font-size:11px;color:var(--muted)}
  .cand[aria-selected="true"] .n{color:var(--accent-ink);font-weight:700}
  .cand :global(.tg){font-size:40px}
  .rest{font-size:12px;color:var(--ink);letter-spacing:.04em}
  .typed{color:var(--muted)}
  .pager{display:flex;align-items:center;gap:2px;margin-left:auto;padding-left:8px;font-size:12px}

  .split{display:grid;grid-template-columns:minmax(0,560px) minmax(0,1fr);gap:24px;align-items:start}
  .head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}
  .head p{font-size:12.5px}
  .row{display:flex;gap:5px;margin-bottom:5px}
  .key{display:grid;grid-template-rows:auto 1fr;flex:1;max-width:52px;aspect-ratio:1/1.12;padding:4px 5px;border:1px solid var(--line-strong);border-bottom-width:2px;border-radius:8px;background:var(--surface);text-align:left}
  .key:hover{border-color:var(--accent)}
  .key:active{transform:translateY(1px)}
  .key.dead{opacity:.32}
  .letter{font-size:12px;font-weight:700;color:var(--ink-2)}
  .roots{align-self:end;justify-self:center;font-size:15px;letter-spacing:-.04em;color:var(--ink)}
  .key.wide{max-width:72px;flex:1.4;place-items:center;font-size:18px;grid-template-rows:1fr}
  .key.space{display:flex;align-items:center;justify-content:center;gap:4px;max-width:none;flex:1;aspect-ratio:auto;height:44px;white-space:nowrap;font-size:13px;color:var(--ink-2)}
  .key.space :global(.tg){font-size:20px;margin-left:6px}
  .key:disabled{opacity:.5;cursor:default}

  .palette{min-width:0}
  .letters{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px}
  .letters .chip{min-height:24px;padding:0 7px;font-size:11.5px}
  .groups{display:grid;gap:14px;max-height:calc(100dvh - 380px);min-height:320px;overflow:auto;padding-right:4px}
  .group h3{position:sticky;top:0;z-index:1;padding:3px 0;background:var(--bg);font-size:12px;font-weight:700;color:var(--ink-2)}
  .group h3 :global(.tg){font-size:15px;margin-left:6px;color:var(--muted)}
  .comps{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:4px}
  .comp{display:grid;justify-items:center;gap:2px;padding:6px 2px 4px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
  .comp:hover{border-color:var(--line-strong)}
  .comp.match{border-color:var(--accent);background:var(--accent-soft)}
  .comp.on{box-shadow:0 0 0 2px var(--accent)}
  .comp :global(.tg){font-size:26px}
  .comp small{font-size:10.5px;color:var(--muted)}

  @media (max-width:1320px){.split{grid-template-columns:1fr}.groups{max-height:520px}}
  @media (max-width:900px){
    .code{font-size:24px;padding:10px 12px}
    .count{display:none}
    .bar{min-height:80px}
    .cand{min-width:62px}
    .cand :global(.tg){font-size:32px}
    .bar.idle .keys{display:none}
    .row{gap:4px}
    .row[style]{padding-left:0 !important}
    .key{max-width:none;padding:3px}
    .roots{font-size:12px}
  }
</style>

<script>
  // Reading: type a reconstruction in whatever system you know. Every system is searched at once,
  // folded to plain letters, and each candidate shows which systems read it so and how. A final
  // digit, or the tone buttons, keep to one tone; systems without tones always pass.
  import { db, ix, gloss } from '../lib/db.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview, choose, put, autofocus } from '../lib/ui.svelte.js'
  import { SYSTEMS, TIERS, searchReadings, fold } from '../lib/reading.js'

  let query = $state(route.q)
  let tone = $state('')
  let systems = $state(/** @type {string[]} */ ([]))
  let active = $state(-1)
  /** @type {HTMLElement | null} */
  let list = $state(null)

  const ready = $derived(db.status === 'ready')
  const typedTone = $derived(fold(query).tone)
  const hits = $derived(ready && query.trim() ? searchReadings(ix.readings, query, { systems: new Set(systems), tone }) : [])
  const shown = $derived(hits.slice(0, 200))
  const counts = $derived(TIERS.map((_, tier) => hits.filter(hit => hit.tier === tier).length))
  const NAMES = Object.fromEntries(SYSTEMS.map(system => [system.key, system]))

  $effect(() => { void query; void tone; void systems.length; active = -1 })

  /** @param {string} key */
  function toggle(key) {
    systems = systems.includes(key) ? systems.filter(k => k !== key) : [...systems, key]
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (!shown.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      active = Math.max(0, Math.min(shown.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)))
      preview(shown[active].char)
      list?.children[active]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      put(shown[Math.max(0, active)].char)
    } else if (event.key === 'Escape') {
      query = ''
      setQuery('')
    }
  }

  const EXAMPLES = ['do1', 'ndzi', 'gjwɨr', 'tshja', 'lew']
</script>

<div class="reading">
  <header class="intro">
    <h1>Reading</h1>
    <p class="muted">Type a reconstruction in any system: Li Fanwen, Gong, Gong Xun, Arakawa, Miyake, Nishida, Kychanov or Sofronov. Diacritics and IPA are optional; <span class="mono">ɨ</span> can be typed <span class="mono">i</span>, <span class="mono">ś</span> as <span class="mono">s</span>, <span class="mono">ŋ</span> as <span class="mono">ng</span>.</p>
  </header>

  <div class="controls">
    <input class="field big" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
      aria-label="Reconstruction" placeholder="a reading, e.g. ndzi or dzjɨ1"
      oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query) }} onkeydown={keys} use:autofocus />
    <div class="filters">
      <div class="group" role="group" aria-label="Tone">
        <span class="label">Tone</span>
        {#each [['', 'any'], ['1', '1 level'], ['2', '2 rising']] as [value, name] (value)}
          <button type="button" class="chip" aria-pressed={(typedTone || tone) === value} disabled={!!typedTone}
            onclick={() => { tone = value }}>{name}</button>
        {/each}
        {#if typedTone}<span class="muted hint">tone {typedTone} from the typed digit</span>{/if}
      </div>
      <div class="group" role="group" aria-label="Systems">
        <span class="label">Systems</span>
        <button type="button" class="chip" aria-pressed={!systems.length} onclick={() => { systems = [] }}>all</button>
        {#each SYSTEMS as system (system.key)}
          <button type="button" class="chip" aria-pressed={systems.includes(system.key)} title={system.name} onclick={() => toggle(system.key)}>{system.name.replace(/ \d.*$/, '')}</button>
        {/each}
      </div>
    </div>
  </div>

  {#if !query.trim()}
    <div class="start">
      <p class="muted">Try</p>
      {#each EXAMPLES as example (example)}
        <button type="button" class="chip mono" onclick={() => { query = example; setQuery(example) }}>{example}</button>
      {/each}
    </div>
  {:else if !ready}
    <p class="empty">Loading the records…</p>
  {:else if !hits.length}
    <p class="empty">No reading in {systems.length ? 'the chosen systems' : 'any system'} comes close to <b>{query}</b>{tone || typedTone ? ` in tone ${typedTone || tone}` : ''}. Try fewer letters, or drop the tone.</p>
  {:else}
    <p class="summary muted" role="status">
      {hits.length} {hits.length === 1 ? 'character' : 'characters'} ·
      {#each TIERS as tier, i (tier)}{#if counts[i]}<span class="tier">{tier.toLowerCase()} {counts[i]}</span>{/if}{/each}
    </p>
    <ol class="rows" bind:this={list} role="listbox" aria-label="Characters">
      {#each shown as hit, i (hit.char)}
        {#if i === 0 || shown[i - 1].tier !== hit.tier}<li class="divider label" role="presentation">{TIERS[hit.tier]}</li>{/if}
        <li role="option" aria-selected={i === active || (active < 0 && route.c === hit.char)} class="row">
          <button type="button" class="pick" onclick={() => { active = i; choose(hit.char) }} ondblclick={() => put(hit.char)}>
            <span class="tg glyph">{hit.char}</span>
            <span class="said">
              {#each hit.readings as reading (reading.system)}
                <span class="r"><span class="sys" title={NAMES[reading.system].name}>{NAMES[reading.system].short}</span>{reading.raw}</span>
              {/each}
            </span>
            <span class="gl">{gloss(hit.char)}</span>
          </button>
          <button type="button" class="add btn ghost" aria-label="Add {hit.char} to the text" title="Add to the text" onclick={() => put(hit.char)}>
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </li>
      {/each}
    </ol>
    {#if hits.length > shown.length}<p class="muted cut">The first {shown.length} of {hits.length}. Add letters or a tone to narrow.</p>{/if}
  {/if}
</div>

<style>
  .reading{display:grid;gap:16px;max-width:900px}
  .intro{display:grid;gap:6px}
  h1{font-family:var(--serif);font-size:26px;font-weight:600}
  .intro p{font-size:13.5px;max-width:52em}
  .controls{display:grid;gap:10px}
  .big{font-size:22px;padding:12px 16px;font-family:var(--serif)}
  .filters{display:grid;gap:8px}
  .group{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
  .group .label{width:68px}
  .chip:disabled{opacity:.5;cursor:default}
  .hint{font-size:12px;margin-left:4px}
  .start{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .summary{font-size:12.5px}
  .tier+.tier::before{content:" · "}
  .rows{list-style:none;margin:0;padding:0;display:grid;gap:2px}
  .divider{padding:12px 0 4px}
  .row{display:flex;align-items:center;border:1px solid transparent;border-radius:10px;background:var(--surface)}
  .row[aria-selected="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
  .pick{flex:1;min-width:0;display:grid;grid-template-columns:56px minmax(0,1.3fr) minmax(0,1fr);align-items:center;gap:14px;padding:6px 10px;border:0;background:none;text-align:left}
  .row:hover{background:var(--raised)}
  .glyph{font-size:38px;text-align:center}
  .said{display:flex;flex-wrap:wrap;gap:4px 12px;font-family:var(--serif);font-size:16px}
  .r{white-space:nowrap}
  .sys{display:inline-block;min-width:24px;margin-right:4px;padding:0 4px;border-radius:4px;background:var(--sunk);font:600 10px/1.7 var(--ui);color:var(--muted);text-align:center;vertical-align:2px}
  .gl{color:var(--ink-2);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .add{margin-right:6px;padding:0 9px}
  .cut{font-size:12.5px}
  @media (max-width:900px){
    .pick{grid-template-columns:44px minmax(0,1fr);gap:10px}
    .glyph{font-size:32px}
    .gl{grid-column:2;margin-top:-6px;font-size:12.5px}
    .group .label{width:100%}
  }
</style>

<script>
  // Parts: build a character from the components it is drawn from, as the script itself is built.
  // Each chosen part narrows the characters to those whose description holds it, and the palette
  // narrows with them to the parts that still occur, so the next choice always leads somewhere.
  import { db, ix, gloss, isTangut } from '../lib/db.svelte.js'
  import G from '../ui/G.svelte'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { preview } from '../lib/ui.svelte.js'
  import { byParts, partsAmong, partsIn } from '../lib/search.js'
  import { LAYOUTS } from '../ui/Ids.svelte'
  import Layout from '../ui/Layout.svelte'
  import Candidates from '../ui/Candidates.svelte'

  let chosen = $state(/** @type {string[]} */ ([...route.q].filter(isTangut).flatMap(char => ix.usedBy.has(char) ? [char] : partsIn(char))))
  let layout = $state('')
  let filter = $state('')
  let everything = $state(false)
  let active = $state(-1)
  /** @type {Candidates | null} */
  let grid = $state(null)

  const ready = $derived(db.status === 'ready')
  // A part from the address waits for the records before it can be checked.
  $effect(() => {
    if (ready && !chosen.length && route.q) chosen = [...route.q].filter(isTangut).flatMap(char => ix.usedBy.has(char) ? [char] : partsIn(char))
  })

  const hits = $derived(ready ? byParts(chosen, layout) : [])
  const among = $derived(chosen.length || layout ? partsAmong(hits) : null)
  const LAYOUT_KEYS = ['⿰', '⿱', '⿲', '⿳', '⿺', '⿸', '⿵', '⿻']

  // Every part, by strokes then by how often descriptions use it; narrowed by the choice so far.
  const palette = $derived.by(() => {
    if (!ready) return []
    const codes = filter.trim().toLowerCase()
    let parts = [...ix.usedBy.keys()].map(part => ({ part, uses: ix.usedBy.get(part)?.size ?? 0, strokes: ix.strokes.get(part) ?? 0, live: among ? among.get(part) ?? 0 : -1 }))
    if (codes) parts = parts.filter(p => (ix.codes.get(p.part) ?? []).some(code => code.startsWith(codes) || code.startsWith(`p${codes}`)))
    if (among && !everything) parts = parts.filter(p => p.live > 0)
    return parts.sort((a, b) => a.strokes - b.strokes || b.uses - a.uses)
  })
  const byStroke = $derived.by(() => {
    /** @type {Map<number, typeof palette>} */
    const map = new Map()
    for (const p of palette) map.set(p.strokes, [...(map.get(p.strokes) ?? []), p])
    return [...map]
  })

  /** @param {string} part */
  function add(part) {
    chosen = [...chosen, part]
    preview(part)
    setQuery(chosen.join(''))
    active = -1
  }
  /** @param {number} index */
  function remove(index) {
    chosen = chosen.filter((_, i) => i !== index)
    setQuery(chosen.join(''))
    active = -1
  }
  function reset() {
    chosen = []
    layout = ''
    setQuery('')
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    if (grid?.key(event)) event.preventDefault()
  }

  const items = $derived(hits.map(char => ({ char, sub: gloss(char) })))
</script>

<div class="parts">
  <header class="intro">
    <h1>Parts</h1>
    <p class="muted">Choose the components you can see in the character. Each choice keeps only the characters built with it, and the palette keeps only the parts that still occur.</p>
  </header>

  <section class="build" aria-label="Chosen parts">
    <div class="chosen">
      {#each chosen as part, i (i)}
        <button type="button" class="part" onclick={() => remove(i)} title="Remove this part"><G char={part} /><span class="x" aria-hidden="true">×</span><span class="sr">Remove</span></button>
      {/each}
      {#if !chosen.length}<span class="muted ph">No parts chosen yet: pick from the palette below.</span>{/if}
      {#if chosen.length || layout}<button type="button" class="btn ghost reset" onclick={reset}>Start over</button>{/if}
    </div>
    <div class="layouts" role="group" aria-label="Outer layout">
      <span class="label">Layout</span>
      <button type="button" class="chip" aria-pressed={!layout} onclick={() => { layout = '' }}>any</button>
      {#each LAYOUT_KEYS as op (op)}
        <button type="button" class="chip" aria-pressed={layout === op} title={LAYOUTS[op]} onclick={() => { layout = layout === op ? '' : op }}>
          <Layout {op} size={15} /><span>{LAYOUTS[op]}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="matches" aria-label="Matching characters">
    <div class="head">
      <h2 class="label">{chosen.length || layout ? `${hits.length} ${hits.length === 1 ? 'character' : 'characters'}` : 'Characters'}</h2>
      {#if chosen.length || layout}<span class="muted">fewest strokes first</span>{/if}
    </div>
    {#if chosen.length || layout}
      {#if hits.length}
        <div role="presentation" onkeydown={keys}><Candidates bind:this={grid} {items} bind:active size={64} label="Matching characters" limit={240} /></div>
      {:else}
        <p class="empty">No recorded description holds all of these parts{layout ? ` in that layout` : ''}. Remove one to widen the search.</p>
      {/if}
    {:else}
      <p class="empty">The characters built from the chosen parts appear here.</p>
    {/if}
  </section>

  <section class="palette" aria-label="Components">
    <div class="head">
      <h2 class="label">{among && !everything ? 'Parts that still occur' : 'All components'}</h2>
      <input class="field filter mono" data-primary bind:value={filter} placeholder="filter by code, e.g. pm" aria-label="Filter components by Cangjie code" spellcheck="false" autocomplete="off" />
      {#if among}<label class="all"><input type="checkbox" bind:checked={everything} /> show all</label>{/if}
    </div>
    <div class="strokes">
      {#each byStroke as [count, parts] (count)}
        <div class="stroke-group">
          <h3 class="n" title="{count} strokes">{count || '?'}</h3>
          <div class="comps">
            {#each parts as p (p.part)}
              <button type="button" class="comp" class:dim={p.live === 0} onclick={() => add(p.part)}
                title="{ix.codes.get(p.part)?.[0] ?? ''} · in {p.live >= 0 ? `${p.live} of these` : `${p.uses}`} characters">
                <G char={p.part} />{#if p.live > 0}<small>{p.live}</small>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .parts{display:grid;gap:18px}
  .intro{display:grid;gap:4px}
  h1{font-family:var(--serif);font-size:26px;font-weight:600}
  .intro p{font-size:13.5px;max-width:56em}
  .build{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
  .chosen{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-height:58px}
  .part{position:relative;display:grid;place-items:center;width:58px;height:58px;border:1px solid var(--accent);border-radius:10px;background:var(--accent-soft)}
  .part :global(.tg){font-size:36px}
  .part .x{position:absolute;top:1px;right:5px;font-size:13px;color:var(--accent-ink)}
  .part:hover{filter:brightness(.96)}
  .ph{font-size:13px}
  .reset{margin-left:auto}
  .layouts{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
  .layouts .label{margin-right:4px}
  .layouts .chip{gap:6px}
  .head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}
  .head span{font-size:12.5px}
  .filter{width:200px;padding:6px 10px;font-size:13px;margin-left:auto}
  .all{font-size:12.5px;color:var(--ink-2)}
  .all input{accent-color:var(--accent)}
  .strokes{display:grid;gap:8px}
  .stroke-group{display:grid;grid-template-columns:28px 1fr;gap:8px;align-items:start}
  .n{padding-top:10px;font:600 12px var(--mono);color:var(--muted);text-align:right}
  .comps{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:4px}
  .comp{position:relative;display:grid;place-items:center;aspect-ratio:1;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
  .comp:hover{border-color:var(--accent);background:var(--accent-soft)}
  .comp :global(.tg){font-size:27px}
  .comp small{position:absolute;right:3px;bottom:1px;font-size:9.5px;color:var(--muted);font-variant-numeric:tabular-nums}
  .comp.dim{opacity:.3}
  @media (max-width:900px){.filter{width:100%;margin-left:0}.layouts .chip span{display:none}}
</style>

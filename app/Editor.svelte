<script>
  // The description, part by part: each operand of the record's description is a cell with the
  // characters that carry it, so a slot can be replaced. The editor shows the chosen description
  // and the characters that use it.
  import { isTangut } from './data.js'
  import { select, app } from './store.svelte.js'

  /** @type {{ char: string, composition: string }} */
  let { char, composition } = $props()

  const OPERATORS = new Set([...'⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻〾⿼⿽㇯'])
  const parts = $derived([...composition])
  // The description's operators carry the shape; the components are set in the Tangut face.
  const OPERATOR_FONT = '"IDS Strokes","IDS Parts","Noto Sans CJK JP",sans-serif'
  let chosen = $state(-1)

  // The other characters whose description uses the same operands.
  const matches = $derived.by(() => {
    if (!composition || chosen >= 0) return []
    return app.data.entries.filter(entry => entry.char !== char && entry.composition === composition).map(entry => entry.char).slice(0, 40)
  })

  /** The characters a part stands in, with the count of descriptions using each. @param {string} part */
  function replacements(part) {
    /** @type {Map<string, number>} */
    const counts = new Map()
    for (const entry of app.data.entries) {
      for (const other of new Set([...(entry.composition ?? '')])) {
        if (other === part || OPERATORS.has(other) || !isTangut(other)) continue
        counts.set(other, (counts.get(other) ?? 0) + 1)
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 24)
  }
</script>

{#if composition}
  <h2>Description</h2>
  <div class="parts" role="group" aria-label="Description">
    {#each parts as part, index (index)}
      {#if OPERATORS.has(part)}
        <span class="operator" aria-label="operator {part}" style:font-family={OPERATOR_FONT}>{part}</span>
      {:else}
        <button type="button" class:on={chosen === index} title={part}
          onclick={() => { chosen = chosen === index ? -1 : index }}><span lang="txg">{part}</span></button>
      {/if}
    {/each}
  </div>
  {#if chosen >= 0}
    <p class="pick">Parts that stand in this slot:</p>
    <div class="substitute">
      {#each replacements(parts[chosen]) as [part, count] (part)}
        <button type="button" title={`${count} descriptions`} lang="txg" onclick={() => { chosen = -1; select(part) }}>{part}</button>
      {/each}
    </div>
  {/if}
{:else}
  <p class="none">No description is recorded for this character.</p>
{/if}

{#if matches.length}
  <h2>Described the same way</h2>
  <div class="same">
    {#each matches as other (other)}
      <button type="button" lang="txg" onclick={() => select(other)}>{other}</button>
    {/each}
  </div>
{/if}

<style>
  .parts,.substitute,.same{display:flex;flex-wrap:wrap;gap:6px}
  button{display:grid;place-items:center;min-width:44px;min-height:44px;border:1px solid var(--line);border-radius:9px;background:var(--surface);cursor:pointer;font-size:26px;line-height:1}
  button:hover{border-color:var(--accent)}
  button.on{border-color:var(--accent);background:var(--accent-soft)}
  .operator{display:grid;place-items:center;min-width:44px;min-height:44px;border-radius:9px;background:var(--surface-2);color:var(--muted);font-family:var(--tangut);font-size:24px}
  [lang="txg"]{font-family:var(--tangut)}
  .pick,.none{margin:12px 0 6px;color:var(--muted);font-size:12.5px}
  .same button{min-width:36px;min-height:36px;font-size:20px}
</style>

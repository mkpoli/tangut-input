<script>
  // Where the character stands in the corpus the Glyph Atlas records: the sources that attest it
  // and its first lines, with each source's rights. A character outside the corpus says so.
  import { loadAttestation } from './data.js'

  /** @type {{ char: string }} */
  let { char } = $props()
  /** @type {import('./data.js').Attestation | null} */
  let corpus = $state(null)
  let failed = $state(false)

  $effect(() => {
    let live = true
    loadAttestation().then(found => { if (live) corpus = found }, () => { if (live) failed = true })
    return () => { live = false }
  })

  const sources = $derived.by(() => {
    const found = /** @type {import('./data.js').Attestation | null} */ (corpus)
    if (!found) return /** @type {{ id: string, title: string, author?: string, url?: string, licence?: string, note?: string, lines: import('./data.js').AttestedLine[] }[]} */ ([])
    const rows = found.rows[char] ?? {}
    return found.sources.map(source => ({ ...source, lines: rows[source.id] ?? [] })).filter(source => source.lines.length)
  })
</script>

<h2>Attestation</h2>
{#if failed}
  <p class="note">The corpus could not be loaded.</p>
{:else if !corpus}
  <p class="note">Loading…</p>
{:else if !sources.length}
  <p class="note">No attestation recorded yet: the corpus so far holds {corpus.corpus.characters} characters of chapter 2, and this one is outside it.</p>
{:else}
  {#each sources as source (source.id)}
    <div class="source">
      <p class="title">{source.title}{#if source.author} · {source.author}{/if}</p>
      <p class="lines">{source.lines.length} line{source.lines.length === 1 ? '' : 's'}: {source.lines.slice(0, 6).map(line => line[0].split(':').pop()).join(', ')}{#if source.lines.length > 6}…{/if}</p>
      <p class="rights">{#if source.url}<a href={source.url} target="_blank" rel="noreferrer">source</a>{/if}{#if source.licence} · {source.licence}{/if}</p>
    </div>
  {/each}
{/if}

<style>
  .note,.title,.lines,.rights{margin:4px 0;font-size:13px}
  .rights{font-size:12px}
  .note,.lines{color:var(--muted)}
  .title{font-weight:600}

</style>

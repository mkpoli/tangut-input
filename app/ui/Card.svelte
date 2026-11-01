<script>
  // Everything recorded about the open character, arranged around using it: the actions come
  // first, then what helps a reader confirm it is the one they mean (meaning, readings, structure,
  // where it stands in a text), then the characters near it.
  import { db, ix, codePoint, gloss, isComponent } from '../lib/db.svelte.js'
  import G from './G.svelte'
  import { route, link } from '../lib/route.svelte.js'
  import { ui, put, choose } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { SYSTEMS } from '../lib/reading.js'
  import { partsIn } from '../lib/search.js'
  import Ids from './Ids.svelte'
  import Attest from './Attest.svelte'

  const char = $derived(route.c)
  const ready = $derived(db.status === 'ready')
  const entry = $derived(ready && char ? ix.byChar.get(char) : undefined)
  const codes = $derived(ready && char ? ix.codes.get(char) ?? [] : [])
  const strokes = $derived(ready && char ? entry?.total_strokes ?? ix.strokes.get(char) : undefined)
  const meanings = $derived(entry?.definitions ?? {})
  const readings = $derived(SYSTEMS.map(system => ({ ...system, value: entry?.pronunciations?.[system.key]?.trim() ?? '' })).filter(r => r.value))
  const fanqie = $derived([
    { name: 'Li Fanwen', value: entry?.pronunciations?.sound_li_fanwen?.trim() ?? '' },
    { name: 'Nie Lishan', value: entry?.pronunciations?.sound_nie_lishan?.trim() ?? '' },
  ].filter(r => r.value))

  const same = $derived.by(() => {
    if (!entry?.composition) return []
    return ix.entries.filter(other => other.char !== char && other.composition === entry.composition).map(other => other.char)
  })
  const homophones = $derived.by(() => {
    const li = entry?.pronunciations?.li_fanwen?.trim()
    if (!li) return []
    return ix.entries.filter(other => other.char !== char && other.pronunciations?.li_fanwen?.trim() === li).map(other => other.char)
  })
  const users = $derived(ready && char ? [...(ix.usedBy.get(char) ?? [])] : [])
  const parts = $derived(ready && char ? partsIn(char) : [])

  const first = $derived(ready && char ? gloss(char) : '')
  const address = $derived(char ? `${location.origin}${link('', char)}` : '')
</script>

{#if ui.sheet}
  <div class="sheetbar">
    <button class="btn ghost" type="button" onclick={() => { ui.sheet = false }}>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Back
    </button>
  </div>
{/if}

{#if !char}
  <div class="blank">
    <p class="tg ghost" aria-hidden="true">𘅤</p>
    <p>Pick a character to see its record here, with ways to copy it or add it to your text.</p>
    <p class="muted">Arrow keys move through candidates; <kbd>Enter</kbd> adds the highlighted one.</p>
  </div>
{:else}
  <article class="record">
    <header class="head">
      <div class="glyph"><G {char} /></div>
      <div class="facts">
        <button class="cp mono" type="button" title="Copy the code point" onclick={() => copy(codePoint(char))}>{codePoint(char)}</button>
        {#if first}<p class="gloss">{first}</p>{:else if isComponent(char)}<p class="gloss">component</p>{/if}
        <p class="meta">
          {#if strokes}{strokes} strokes{/if}{#if entry?.radical}&ensp;·&ensp;radical <button class="inline tg" type="button" onclick={() => choose(/** @type {string} */ (entry?.radical))}>{entry.radical}</button>{/if}
        </p>
      </div>
    </header>

    <div class="use">
      <button class="btn primary" type="button" onclick={() => put(char)}>
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Add to text
      </button>
      <button class="btn" type="button" onclick={() => copy(char)}>Copy <span class="tg sm">{char}</span></button>
      <button class="btn" type="button" onclick={() => copy(address, 'the link')}>Copy link</button>
    </div>

    {#if codes.length}
      <section>
        <h3 class="label">Cangjie</h3>
        <div class="codes">
          {#each codes as code, i (code)}
            <button class="code" type="button" title="Copy this code" onclick={() => copy(code, `the code ${code}`)}>
              <span class="mono">{code}</span><small>{codes.length > 1 ? (i === 0 ? 'short' : i === codes.length - 1 ? 'full' : '') : ''}</small>
            </button>
          {/each}
          <a class="type" href={link('cangjie', char, codes[0])}>Type it</a>
        </div>
      </section>
    {/if}

    {#if meanings.en?.length || meanings.ja?.length || meanings.zh?.length}
      <section>
        <h3 class="label">Meaning</h3>
        <dl class="means">
          {#if meanings.en?.length}<dt>en</dt><dd><ol>{#each meanings.en as sense, i (i)}<li>{sense}</li>{/each}</ol></dd>{/if}
          {#if meanings.ja?.length}<dt>ja</dt><dd lang="ja">{meanings.ja.join(' ')}</dd>{/if}
          {#if meanings.zh?.length}<dt>zh</dt><dd lang="zh-Hant">{meanings.zh.join('；')}</dd>{/if}
        </dl>
      </section>
    {/if}

    {#if readings.length}
      <section>
        <h3 class="label">Readings</h3>
        <table class="readings">
          <tbody>
            {#each readings as reading (reading.key)}
              <tr><th scope="row">{reading.name}</th><td>{reading.value}</td></tr>
            {/each}
            {#each fanqie as row (row.name)}
              <tr><th scope="row">Sound gloss, {row.name}</th><td lang="zh-Hant" class="cjk">{row.value}</td></tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if entry?.wenhai_text_en || entry?.wenhai_text_zh}
      <section>
        <h3 class="label">Wenhai 文海 gloss</h3>
        {#if entry.wenhai_text_zh}<p lang="zh-Hant">{entry.wenhai_text_zh}</p>{/if}
        {#if entry.wenhai_text_en}<p>{entry.wenhai_text_en}</p>{/if}
      </section>
    {/if}

    <section>
      <h3 class="label">Built from</h3>
      {#if entry?.composition}
        <Ids composition={entry.composition} />
        <p class="ids"><button class="inline" type="button" title="Copy the description" onclick={() => copy(/** @type {string} */ (entry?.composition), 'the description')}><span class="tg">{entry.composition}</span></button>
          {#if parts.length}<a href={link('parts', char, parts.join(''))}>Characters with these parts</a>{/if}</p>
      {:else if isComponent(char)}
        <p class="empty">A component: it is a part of other characters, not built from parts itself.</p>
      {:else}
        <p class="empty">No description from parts is recorded for this character.</p>
      {/if}
    </section>

    <Attest {char} />

    {#if users.length}
      <section>
        <h3 class="label">Used in {users.length} {users.length === 1 ? 'character' : 'characters'}</h3>
        <div class="tiles small">
          {#each users.slice(0, 48) as other (other)}<button class="tile" type="button" title={gloss(other)} onclick={() => choose(other)}><G char={other} /></button>{/each}
        </div>
        {#if users.length > 48}<p class="more"><a href={link('parts', char, char)}>All {users.length} in Parts</a></p>{/if}
      </section>
    {/if}

    {#if same.length}
      <section>
        <h3 class="label">Described the same way</h3>
        <div class="tiles small">
          {#each same as other (other)}<button class="tile" type="button" title={gloss(other)} onclick={() => choose(other)}><G char={other} /></button>{/each}
        </div>
      </section>
    {/if}

    {#if homophones.length}
      <section>
        <h3 class="label">Same reading in Li Fanwen</h3>
        <div class="tiles small">
          {#each homophones.slice(0, 48) as other (other)}<button class="tile" type="button" title={gloss(other)} onclick={() => choose(other)}><G char={other} /><small>{gloss(other)}</small></button>{/each}
        </div>
      </section>
    {/if}

    <footer class="credit muted">
      Meanings, readings and descriptions: Open Tangut (MIT), from CCAMC and Wiktionary. Codes: RIME Tangut Cangjie, whose table warns that some codes are wrong.
      <a href="/about">Sources</a>
    </footer>
  </article>
{/if}

<style>
  .sheetbar{position:sticky;top:0;z-index:2;padding:8px 10px;background:var(--surface);border-bottom:1px solid var(--line)}
  .blank{display:grid;gap:10px;justify-items:center;text-align:center;padding:80px 40px;color:var(--ink-2)}
  .blank .ghost{font-size:96px;color:var(--line-strong);margin-bottom:8px}
  .blank p{max-width:24em}
  .record{padding:22px 24px 40px;display:grid;gap:22px}
  .head{display:flex;gap:18px;align-items:center}
  .glyph{position:relative;display:grid;place-items:center;flex:none;width:132px;height:132px;border:1px solid var(--line-strong);border-radius:12px;background:var(--bg)}
  .glyph::before,.glyph::after{content:"";position:absolute;background:var(--line);pointer-events:none}
  .glyph::before{left:50%;top:10px;bottom:10px;width:1px}
  .glyph::after{top:50%;left:10px;right:10px;height:1px}
  .glyph :global(.tg){position:relative;z-index:1;font-size:104px}
  .facts{display:grid;gap:4px;min-width:0}
  .cp{justify-self:start;padding:2px 6px;margin-left:-6px;border:0;border-radius:6px;background:none;font-size:14px;font-weight:600}
  .cp:hover{background:var(--hover)}
  .gloss{font-family:var(--serif);font-size:21px;line-height:1.25}
  .meta{color:var(--muted);font-size:13px}
  .inline{padding:0 3px;border:0;border-radius:4px;background:none;color:inherit}
  .inline:hover{background:var(--hover)}
  .inline.tg{font-size:17px;vertical-align:-2px}
  .use{display:flex;flex-wrap:wrap;gap:6px}
  .sm{font-size:17px}
  section{display:grid;gap:8px}
  .codes{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .code{display:inline-flex;align-items:baseline;gap:6px;padding:5px 10px;border:1px solid var(--line);border-radius:7px;background:var(--raised);font-size:15px}
  .code:hover{border-color:var(--accent)}
  .code small{font-size:11px;color:var(--muted)}
  .code small:empty{display:none}
  .type{font-size:13px;margin-left:4px}
  .means{display:grid;grid-template-columns:22px 1fr;gap:6px 10px;margin:0}
  .means dt{font:600 11px/1.9 var(--mono);color:var(--muted);text-transform:uppercase}
  .means dd{margin:0}
  .means ol{margin:0;padding-left:1.2em}
  .readings{border-collapse:collapse;width:100%;font-size:13.5px}
  .readings th{width:46%;padding:4px 10px 4px 0;text-align:left;font-weight:400;color:var(--muted);vertical-align:top}
  .readings td{padding:4px 0;font-family:var(--serif);font-size:15px}
  .readings td.cjk{font-family:var(--ui);font-size:13.5px}
  .readings tr+tr{border-top:1px solid var(--line)}
  .ids{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;font-size:13px}
  .ids :global(.tg){font-size:20px}
  .tiles.small{--tile:48px}
  .tiles.small .tile{background:var(--raised);box-shadow:none;border-color:var(--line)}
  .tiles.small .tile:hover{border-color:var(--accent)}
  .more{font-size:13px}
  .credit{font-size:12px;line-height:1.55;border-top:1px solid var(--line);padding-top:14px}
  @media (max-width:900px){.record{padding:16px 16px 40px}}
</style>

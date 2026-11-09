<script>
  // The 文海's fanqie as two graphs. Each fanqie statement equates the characters it governs; a
  // chain is one transitive set of those equations, and the characters in a chain share an initial
  // or a rhyme. The page lists the chains, their members and the direct links that hold them, and
  // marks the sets whose members the 同音 or the rhyme divisions classify differently.
  import { db, ix, gloss, readingOf } from '../lib/db.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { choose, put, ui, setReading, autofocus } from '../lib/ui.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import { i18n, t } from '../lib/i18n.svelte.js'
  import { chainsOf, classEvidence, junctionLines, memberChars, nodeChar } from '../lib/wenhai.js'
  import Icon from '../ui/Icon.svelte'

  const ready = $derived(db.status === 'ready')
  const wenhai = $derived(ready ? ix.wenhai : null)
  // An object so the mode widens to a string: a closed literal would not accept the other tab.
  const view = $state(/** @type {{ graph: string }} */ ({ graph: 'initial' }))
  let query = $state(route.q)
  let crossed = $state(false)
  /** The chain whose body is open. Only one body is rendered, so a long list stays cheap. */
  let open = $state(/** @type {string | null} */ (null))

  /** The chains of the open tab, each with the graph it belongs to. @type {(import('../lib/data.js').WenhaiChain & { graph: 'initial' | 'rhyme' })[]} */
  const CHAINS = $derived([...(wenhai?.chains.values() ?? [])].filter(chain => chain.graph === view.graph))
  const typed = $derived([...query].filter(char => (char.codePointAt(0) ?? 0) >= 0x17000))

  // A query is read as a chain ID when it looks like one, and as a character otherwise: either way
  // the list narrows to the chains that answer.
  const found = $derived.by(() => {
    const q = query.trim()
    if (!q) return CHAINS
    if (typed.length) {
      const char = typed[0]
      return CHAINS.filter(chain => chain.members.some(node => nodeChar(node) === char))
    }
    const id = q.toUpperCase()
    return CHAINS.filter(chain => chain.id.toUpperCase().startsWith(id))
  })
  const shown = $derived(crossed ? found.filter(chain => chain.cross) : found)
  const own = $derived(ready && typed.length === 1 && wenhai ? chainsOf(wenhai, typed[0]) : { initial: [], rhyme: [] })

  // Back and forward change the address without passing through the field; the field follows.
  $effect(() => {
    if (route.q !== query) {
      query = route.q
      open = null
    }
  })

  // A link to a chain (`/chains?q=R-036`) opens that chain, in the tab it belongs to.
  $effect(() => {
    const q = route.q.trim().toUpperCase()
    if (!q || !wenhai) return
    if (wenhai.chains.has(q)) {
      const chain = wenhai.chains.get(q)
      if (chain) {
        view.graph = chain.graph
        crossed = false
        open = q
      }
    }
  })

  /** @param {string} graph */
  function setGraph(graph) {
    view.graph = graph
    open = null
    crossed = false
    query = ''
    setQuery('')
  }

  /** The release names three kinds of edge; the page gives each a short message key. */
  const RELATION = /** @type {Record<string, string>} */ ({ 'co-governed': 'co', 'upper speller': 'upper', 'lower speller': 'lower' })

  /** @param {string} id */
  function toggle(id) {
    open = open === id ? null : id
  }

</script>

<div class="ui-page chains" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title"><Icon name="link" size={22}/><span>{t('nav.chains')}</span></h1>
    <p class="ui-page-intro">{t('chains.intro')}</p>
  </header>

  {#if !ready}
    <p class="ui-empty">{t('common.loading')}</p>
  {:else if !wenhai}
    <p class="ui-empty">{t('chains.failed')}</p>
  {:else}
    <div class="ui-toolbar modes">
      <div class="ui-chip-row" role="group" aria-label={t('chains.graph')}>
        <button type="button" class="ui-chip" aria-pressed={view.graph === 'initial'} onclick={() => setGraph('initial')}>
          {t('chains.initial')} <span class="num">{wenhai.doc.stats.initial}</span>
        </button>
        <button type="button" class="ui-chip" aria-pressed={view.graph === 'rhyme'} onclick={() => setGraph('rhyme')}>
          {t('chains.rhyme')} <span class="num">{wenhai.doc.stats.rhyme}</span>
        </button>
      </div>
      <input class="ui-input chains-input" data-size="sm" data-primary value={query} spellcheck="false" autocomplete="off" autocapitalize="off"
        aria-label={t('chains.search')} placeholder={t('chains.search')}
        oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => { query = event.currentTarget.value; setQuery(query); open = null }}
        use:autofocus />
      <button type="button" class="ui-chip" aria-pressed={crossed} onclick={() => { crossed = !crossed }}>{t('chains.cross')}</button>
      <label class="choose">
        <span class="ui-label">{t('chains.reading')}</span>
        <span class="ui-select-wrap">
          <select class="ui-select" data-size="sm" value={ui.reading} onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setReading(event.currentTarget.value)} aria-label={t('chains.reading')}>
            {#each SYSTEMS as entry (entry.key)}<option value={entry.key} title={systemTitle(entry)}>{systemName(entry, i18n.locale)}</option>{/each}
          </select>
        </span>
      </label>
    </div>

    {#if typed.length === 1 && (own.initial.length || own.rhyme.length)}
      <p class="ui-hint own-chains">
        <span class="ui-script">{typed[0]}</span>
        {#each [...own.initial, ...own.rhyme] as chain (chain.id)}<button type="button" class="ui-chip" onclick={() => { view.graph = chain.graph; crossed = false; query = chain.id; setQuery(chain.id); open = chain.id }}>{chain.id}</button>{/each}
      </p>
    {/if}

    <p class="ui-count" role="status">{t(shown.length === 1 ? 'chains.countOne' : 'chains.count', { count: shown.length })}</p>

    {#if !shown.length}
      <p class="ui-empty">{crossed && !query.trim() ? t('chains.noCross') : t('chains.none', { query })}</p>
    {:else}
      <ol class="chain-list">
        {#each shown as chain (chain.id)}
          <li class="chain" data-open={open === chain.id}>
            <button type="button" class="chain-head" aria-expanded={open === chain.id} aria-controls={`chain-body-${chain.id}`} onclick={() => toggle(chain.id)}
              title={chain.cross ? t(chain.graph === 'initial' ? 'chains.crossingClass' : 'chains.crossingRhyme') : undefined}>
              <span class="ident">
                <span class="id ui-mono">{chain.id}</span>
                <span class="class">{#if chain.graph === 'initial'}{chain.ty}{:else}{chain.level?.join(' · ') || '—'}{/if}</span>
              </span>
              <span class="anchor ui-script">{chain.anchor}</span>
              <span class="members-preview ui-script">{memberChars(chain).filter(member => member !== chain.anchor).slice(0, 8).join('')}{#if chain.size > 9}…{/if}</span>
              <span class="size ui-count">{chain.size}</span>
              <span class="cross">{#if chain.cross}<span class="ui-tag">{t('chains.crossTag')}</span>{/if}</span>
              <span class="caret" aria-hidden="true">{open === chain.id ? '−' : '+'}</span>
            </button>

            {#if open === chain.id}
              <div class="chain-body" id={`chain-body-${chain.id}`}>
                <div class="ui-tiles members" style:--ui-tile-size="46px">
                  {#each memberChars(chain) as member (member)}
                    {@const sound = readingOf(member, ui.reading)}
                    <button class="ui-tile" type="button" title={gloss(member)} onclick={() => choose(member)} ondblclick={() => put(member)}>
                      <span class="ui-script ui-tile-glyph">{member}</span>
                      {#if sound}<span class="ui-tile-sound">{sound}</span>{/if}
                    </button>
                  {/each}
                </div>

                {#if chain.graph === 'initial' && chain.uppers?.length}
                  <h2 class="ui-label">{t('chains.uppers')}</h2>
                  <div class="evidence">
                    {#each chain.uppers as upper (upper)}
                      {@const ty = classEvidence(chain.evidence ?? '').find(row => row.char === upper)?.ty}
                      <span class="evidence-item"><button class="ui-script" type="button" onclick={() => choose(upper)}>{upper}</button>{#if ty}<span class="ui-tag">{ty}</span>{/if}</span>
                    {/each}
                  </div>
                {/if}

                {#if chain.graph === 'rhyme' && (chain.level?.length || chain.other?.length)}
                  <h2 class="ui-label">{t(chain.partial ? 'chains.rhymesHeads' : 'chains.rhymes')}</h2>
                  <div class="evidence">
                    {#each chain.level ?? [] as rhyme (rhyme)}<span class="ui-tag">{rhyme}</span>{/each}
                    {#each chain.other ?? [] as rhyme (rhyme)}<span class="ui-tag other">{rhyme}</span>{/each}
                  </div>
                {/if}

                {#if chain.junctions}
                  <h2 class="ui-label">{t('chains.junctions')}</h2>
                  <ul class="junctions">{#each junctionLines(chain.junctions) as line (line)}<li>{line}</li>{/each}</ul>
                {/if}

                {#if (wenhai.doc.links[chain.graph][chain.id] ?? []).length}
                  <h2 class="ui-label">{t('chains.links', { count: wenhai.doc.links[chain.graph][chain.id].length })}</h2>
                  <ul class="links">
                    {#each wenhai.doc.links[chain.graph][chain.id] as [node, other, relation, base, governed], i (i)}
                      <li>
                        <span class="ui-script">{node}</span><span class="tie" aria-hidden="true">—</span><span class="ui-script">{other}</span>
                        <span class="ui-hint">{t(`chains.relation.${RELATION[relation] ?? 'co'}`, { base, governed })}</span>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    <section class="unresolved">
      <h2 class="ui-label">{t('chains.unresolved')}</h2>
      <p class="ui-hint">{t('chains.unresolvedIntro')}</p>
      <ul>
        {#each wenhai.doc.unresolved as set (set.graph + set.base)}
          <li>
            <span class="ui-mono">{set.graph === 'Initial' ? t('chains.initialOne') : t('chains.rhymeOne')} · {set.base}</span>
            <button type="button" class="ui-script fanqie" onclick={() => choose(set.members[0])} aria-label={set.fanqie}>{set.fanqie}</button>
            <span class="ui-script members-preview">{set.members.join('')}</span>
            <span class="ui-hint">{set.status}</span>
          </li>
        {/each}
      </ul>
    </section>

    <footer class="source ui-hint">{@html t('chains.source')}</footer>
  {/if}
</div>

<style>
  .modes{flex-wrap:wrap}
  .num{font-variant-numeric:tabular-nums;color:var(--ui-color-ink-muted)}
  .chains-input{flex:1;min-inline-size:200px;max-inline-size:340px}
  .choose .ui-label{white-space:nowrap}
  .own-chains{display:flex;align-items:center;flex-wrap:wrap;gap:var(--ui-space-xs)}
  .own-chains .ui-script{font-size:22px}
  .chain-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--ui-color-border)}
  .chain{border-bottom:1px solid var(--ui-color-border)}
  .chain[data-open='true']{background:var(--ui-color-surface-sunken)}
  .chain-head{border:0;background:none;color:inherit;display:grid;grid-template-columns:92px 34px minmax(0,1fr) 40px 84px 18px;align-items:center;gap:var(--ui-space-sm);inline-size:100%;padding:6px var(--ui-space-sm);text-align:start}
  .chain-head:hover{background:var(--ui-color-surface-hover)}
  .ident{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 var(--ui-space-xs);min-inline-size:0;line-height:1.25}
  .id{font-size:var(--ui-text-xs)}
  .class{overflow:hidden;font-family:var(--ui-font-serif);font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft);white-space:nowrap;text-overflow:ellipsis}
  .cross{display:flex;justify-content:flex-end}
  .anchor{font-size:24px;line-height:1}
  .members-preview{overflow:hidden;font-size:18px;white-space:nowrap;text-overflow:ellipsis;color:var(--ui-color-ink-soft)}
  .size{text-align:end;font-size:var(--ui-text-xs)}
  .caret{color:var(--ui-color-ink-muted);text-align:center}
  .chain-body{display:grid;gap:var(--ui-space-xs);padding:var(--ui-space-xs) var(--ui-space-sm) var(--ui-space-md)}
  .members{margin-block-start:var(--ui-space-2xs)}
  .evidence{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs);align-items:center}
  .evidence-item{display:inline-flex;align-items:center;gap:3px}
  .evidence-item button{display:inline-flex;align-items:center;min-block-size:24px;padding:0;border:0;background:none;color:inherit;font-size:22px;line-height:1}
  .evidence .other{opacity:.7}
  .junctions,.links{list-style:none;margin:0;padding:0;display:grid;gap:2px;font-size:var(--ui-text-xs)}
  .junctions{font-family:var(--ui-font-script),var(--ui-font-sans);line-height:1.5}
  .links li{display:flex;align-items:baseline;gap:var(--ui-space-2xs)}
  .links .ui-script{font-size:18px;line-height:1}
  .tie{color:var(--ui-color-ink-muted)}
  .unresolved{margin-block-start:var(--ui-space-xl);border-top:1px solid var(--ui-color-border);padding-block-start:var(--ui-space-md)}
  .unresolved ul{list-style:none;margin:var(--ui-space-xs) 0 0;padding:0;display:grid;gap:var(--ui-space-sm)}
  .unresolved li{display:grid;gap:2px;grid-template-columns:max-content max-content minmax(0,1fr);align-items:baseline}
  .unresolved li .ui-hint{grid-column:1 / -1}
  .fanqie{display:inline-flex;align-items:center;min-block-size:24px;padding:0;border:0;background:none;color:inherit;font-size:20px;line-height:1;text-align:start}
  .source{margin-block-start:var(--ui-space-xl);border-top:1px solid var(--ui-color-border);padding-block-start:var(--ui-space-md);font-size:var(--ui-text-xs)}
  @media (max-width:700px){
    .chain-head{grid-template-columns:76px 30px minmax(0,1fr) 30px 16px;gap:var(--ui-space-xs)}
    .members-preview{display:none}
    .unresolved li{grid-template-columns:1fr}
  }
</style>

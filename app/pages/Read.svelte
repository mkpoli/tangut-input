<script>
  // Read a line of Tangut by meaning: under each character stands the Chinese word it is glossed by,
  // and under that the Japanese reading of that word. The words and readings come from the two built
  // tables, fetched once; a character without a word keeps its place but shows nothing.
  import { onMount } from 'svelte'
  import { isTangut } from '../lib/db.svelte.js'
  import { loadGlossReadings } from '../lib/data.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { choose } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import G from '../ui/G.svelte'

  /** @type {Record<string, [string, string, string]>} */
  let rows = $state({})
  let text = $state(route.q)

  onMount(async () => { rows = await loadGlossReadings() })

  /** 佛法僧 and 天地人: three characters each, every one with a word and a reading. */
  const EXAMPLES = ['𗢳𗹙𗗆', '𗹦𗧮𗚡']

  /** Each line split into Tangut characters and the runs between them. */
  const lines = $derived(text.split(/\r?\n/).map(line => {
    /** @type {{ tangut: boolean, text: string }[]} */
    const cells = []
    for (const char of line) {
      const last = cells[cells.length - 1]
      if (isTangut(char)) cells.push({ tangut: true, text: char })
      else if (last && !last.tangut) last.text += char
      else cells.push({ tangut: false, text: char })
    }
    return cells
  }))

  const count = $derived([...text].filter(char => isTangut(char)).length)

  /** The kana a Tangut character is read as: the word's on reading and its kun reading. @param {string} char */
  function kana(char) {
    const value = rows[char]
    return value ? [value[1], value[2]].filter(Boolean).join('・') : ''
  }

  /** @param {string} char @param {1 | 2} index */
  function reading(char, index) {
    return rows[char]?.[index] ?? ''
  }

  /** @param {string} char */
  function word(char) {
    return rows[char]?.[0] ?? ''
  }

  /** @param {Event & { currentTarget: HTMLTextAreaElement }} event */
  function type(event) {
    text = event.currentTarget.value
    setQuery(text)
  }
</script>

<div class="ui-page read" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('nav.read')}</h1>
    <p class="ui-page-intro">{t('read.intro')}</p>
  </header>

  <textarea class="ui-textarea read-input ui-script" rows="2" data-primary value={text} spellcheck="false" autocomplete="off"
    aria-label={t('read.input')} placeholder={t('read.placeholder')} oninput={type}></textarea>

  {#if !text.trim()}
    <div class="start">
      <span class="ui-hint">{t('read.try')}</span>
      {#each EXAMPLES as example (example)}
        <button type="button" class="ui-chip ui-script example" onclick={() => { text = example; setQuery(example) }}>{example}</button>
      {/each}
    </div>
  {:else}
    <p class="ui-count" role="status">{t('common.characters', { count })}</p>
    <ol class="lines">
      {#each lines as cells, i (i)}
        <li class="line">
          {#each cells as cell, j (j)}
            {#if cell.tangut}
              <button type="button" class="cell" onclick={() => choose(cell.text)}
                aria-label={[cell.text, word(cell.text), kana(cell.text)].filter(Boolean).join(' ')}>
                <G char={cell.text} />
                <span class="word" lang="zh-Hant">{word(cell.text)}</span>
                <span class="kana" lang="ja">{reading(cell.text, 1)}</span>
                <span class="kana" lang="ja">{reading(cell.text, 2)}</span>
              </button>
            {:else}
              <span class="plain">{cell.text}</span>
            {/if}
          {/each}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .read-input{inline-size:100%;min-block-size:calc(var(--ui-text-lg) * 2.4);resize:vertical}
  .start{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .example{font-size:20px}
  .lines{display:grid;gap:var(--ui-space-lg);margin:0;padding:0;list-style:none}
  .line{display:flex;flex-wrap:wrap;align-items:flex-start;gap:2px;line-height:1.2}
  .plain{white-space:pre-wrap;color:var(--ui-color-ink-soft);font-size:var(--ui-text-lg);line-height:2.4rem}
  .cell{display:grid;grid-template-rows:2.4rem 1.1rem 1rem 1rem;justify-items:center;align-items:start;inline-size:4.6rem;padding:0 2px;border:0;border-radius:var(--ui-radius-sm);background:none;color:inherit;cursor:pointer}
  .cell:hover{background:var(--ui-color-surface-hover)}
  .cell :global(.ui-script){font-size:34px;line-height:1.05}
  .word{font-size:var(--ui-text-sm);color:var(--ui-color-ink);max-inline-size:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kana{font-size:var(--ui-text-2xs);color:var(--ui-color-ink-soft);line-height:1.25;text-align:center;white-space:nowrap}
  @media (max-width:900px){
    .cell{inline-size:3.9rem}
    .cell :global(.ui-script){font-size:28px}
    .line{gap:1px}
  }
</style>

<script>
  // A passage as one line of Tangut, with Chinese and English glosses under each character when the
  // reader asks for them.
  import { db, ix, isTangut } from '../lib/db.svelte.js'
  import { hanGloss } from '../lib/gloss.js'
  import { firstSense } from '../lib/layers.js'
  import { choose } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ text: string, glosses?: boolean }} */
  let { text, glosses = false } = $props()

  /** @param {string} char */
  const entry = char => db.status === 'ready' ? ix.byChar.get(char) : undefined
  /** @param {string} char */
  const chinese = char => {
    const found = entry(char)
    const gloss = hanGloss(ix.leilin.get(char), found?.definitions?.zh, found?.wiktionary_zh)
    return /\p{Script=Han}/u.test(gloss.text) ? gloss : { text: '', title: '', source: gloss.source }
  }
  /** @param {string} char */
  const english = char => {
    const found = entry(char)
    const senses = found?.definitions?.en ?? []
    const downes = ix.downes.get(char)
    return {
      text: firstSense(senses[0]) || firstSense(downes),
      title: senses.length ? `Wiktionary: ${senses.join('; ')}` : downes ? `Downes: ${downes}` : '',
    }
  }
  const CLOSING = /[，。、；：！？）」』】》〉…,.;:!?)\]}]/u
  // One cell per Tangut character, with its closing punctuation kept in the same cell so a line
  // cannot break before a comma or a full stop. Spaces and opening punctuation stand alone.
  const groups = $derived.by(() => {
    /** @type {{ char?: string, trail?: string, plain?: string }[]} */
    const list = []
    for (const char of text) {
      if (isTangut(char)) {
        list.push({ char, trail: '' })
        continue
      }
      const last = list[list.length - 1]
      if (last && CLOSING.test(char) && (last.char !== undefined || last.plain !== undefined)) {
        if (last.char !== undefined) last.trail = `${last.trail ?? ''}${char}`
        else last.plain = `${last.plain ?? ''}${char}`
      } else {
        list.push({ plain: char })
      }
    }
    return list
  })
  /** @param {string} source */
  const sourceLabel = source => t(source === 'wiktionary' ? 'card.chineseWiktionary'
    : source === 'keyed' ? 'card.keyedGloss'
    : 'card.leilinTitle')
</script>

{#if glosses}
  <p class="line glossed ui-script" lang="txg">
    {#each groups as group}
      {#if group.char}
        {@const zh = chinese(group.char)}
        {@const en = english(group.char)}
        <span class="cell">
          <span class="glyph">
            <button class="char" type="button" onclick={() => choose(/** @type {string} */ (group.char))}>{group.char}</button>
            {#if group.trail}<span class="punct">{group.trail}</span>{/if}
          </span>
          <span class="gloss zh" lang={zh.source === 'wiktionary' ? 'zh' : 'zh-Hant'} title={zh.text ? `${sourceLabel(zh.source)}: ${zh.title}` : undefined}>{zh.text}</span>
          <span class="gloss en" lang="en" title={en.text ? en.title : undefined}>{en.text}</span>
        </span>
      {:else}
        <span class="cell plain"><span class="char">{group.plain}</span></span>
      {/if}
    {/each}
  </p>
{:else}
  <p class="line ui-script" lang="txg">
    {#each [...text] as char}
      {#if isTangut(char)}<button class="char" type="button" onclick={() => choose(char)}>{char}</button>{:else}<span>{char}</span>{/if}
    {/each}
  </p>
{/if}

<style>
  .line{margin:0;font-size:22px;line-height:1.8;overflow-wrap:anywhere}
  .glossed{display:flex;flex-wrap:wrap;align-items:flex-start;row-gap:0.45em}
  .cell{display:inline-flex;flex:0 0 auto;flex-direction:column;align-items:center;min-inline-size:1.2em;max-inline-size:8em}
  .cell:not(.plain){margin-inline:1.5px}
  .glyph{display:inline-flex;align-items:center}
  .punct{white-space:pre;line-height:1.4}
  .cell.plain{min-inline-size:0;max-inline-size:none}
  .char{display:inline-flex;align-items:center;justify-content:center;min-inline-size:24px;min-block-size:24px;padding:0 1px;border:0;border-radius:var(--ui-radius-xs);background:none;color:inherit;font:inherit;line-height:1.4;cursor:pointer}
  .char:hover{background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink)}
  .cell.plain .char{white-space:pre;cursor:default}
  .cell.plain .char:hover{background:none;color:inherit}
  .gloss{font-family:var(--ui-font-serif);font-size:13px;line-height:1.35;color:var(--ui-color-ink-muted);text-align:center;min-block-size:1.35em;max-inline-size:8em;overflow-wrap:anywhere}
  .gloss.en{font-family:var(--ui-font-sans);font-size:12px}
  @media (max-width:760px){.line{font-size:20px}}
</style>

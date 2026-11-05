<script>
  // A character's record on hover: the sound it is read with, what it means, and the few fields a
  // reader needs to tell it from a neighbour. Everything here is already in the index, so the panel
  // costs nothing to open.
  import { ix, gloss } from '../lib/db.svelte.js'
  import { ui } from '../lib/ui.svelte.js'
  import { partsOfSpeech } from '../lib/pos.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ char: string, x: number, y: number }} */
  let { char, x, y } = $props()
  const entry = $derived(ix.byChar.get(char))
  const rhyme = $derived(ix.rhymes.get(char))
  const reading = $derived((entry?.pronunciations ?? {})[ui.reading]?.trim() ?? '')
  const pos = $derived(partsOfSpeech(entry?.definitions?.zh))
  const spelling = $derived(rhyme ? [rhyme[3] ?? rhyme[5], rhyme[4] ?? rhyme[6]].filter(Boolean).join('') : '')
  const codes = $derived(ix.codes.get(char) ?? [])
</script>

<aside class="peek ui-popover" style:left="{Math.min(x, innerWidth - 320)}px" style:top="{y}px" aria-hidden="true">
  <header>
    <span class="ui-script glyph">{char}</span>
    <span class="head">
      {#if reading}<span class="say">{reading}</span>{/if}
      <span class="ui-hint ui-mono">U+{(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}</span>
    </span>
  </header>
  <p class="gloss">{gloss(char)}</p>
  {#if entry?.definitions?.zh?.length}<p class="zh" lang="zh-Hant">{entry.definitions.zh.slice(0, 2).join('；')}</p>{/if}
  {#if pos.length}<p class="pos">{#each pos as key (key)}<span class="ui-tag">{t(`pos.${key}`)}</span>{/each}</p>{/if}
  <dl>
    {#if rhyme?.[0]}<dt>{t('card.rhyme')}</dt><dd>{rhyme[0]}{#if rhyme[1]} · {t(`card.tone.${rhyme[1] === 1 ? 'level' : rhyme[1] === 2 ? 'rising' : 'entering'}`)}{/if}</dd>{/if}
    {#if spelling}<dt>{t('card.fanqie')}</dt><dd class="ui-script">{spelling}</dd>{/if}
    {#if codes.length}<dt>{t('nav.cangjie')}</dt><dd class="ui-mono">{codes.join(' ')}</dd>{/if}
  </dl>
</aside>

<style>
  .peek{position:fixed;z-index:var(--ui-z-hint);inline-size:300px;padding:var(--ui-space-md) var(--ui-space-lg);pointer-events:none;font-size:var(--ui-text-sm)}
  header{display:flex;align-items:center;gap:var(--ui-space-md)}
  .glyph{font-size:34px;line-height:1}
  .head{display:grid;gap:1px}
  .say{font-family:var(--ui-font-serif);font-size:var(--ui-text-lg)}
  .gloss{margin:var(--ui-space-xs) 0 0;color:var(--ui-color-ink)}
  .zh{margin:2px 0 0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .pos{display:flex;gap:var(--ui-space-2xs);flex-wrap:wrap;margin:var(--ui-space-xs) 0 0}
  dl{display:grid;grid-template-columns:auto 1fr;gap:2px var(--ui-space-md);margin:var(--ui-space-sm) 0 0;padding-top:var(--ui-space-sm);border-top:1px solid var(--ui-color-border)}
  dt{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  dd{margin:0;font-size:var(--ui-text-xs)}
</style>

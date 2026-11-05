<script>
  // A character's record on hover: the sound it is read with, what it means, and the few fields a
  // reader needs to tell it from a neighbour. Everything here is already in the index, so the panel
  // costs nothing to open.
  import { ix, gloss } from '../lib/db.svelte.js'
  import { ui, choose } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { SYSTEMS, systemName, systemTitle } from '../lib/reading.js'
  import { i18n } from '../lib/i18n.svelte.js'
  import Icon from './Icon.svelte'
  import { partsOfSpeech } from '../lib/pos.js'
  import { t } from '../lib/i18n.svelte.js'

  // With `actions` the reader can move into the panel: it lists every system and offers to open or
  // copy the character. `top` is the top of what it describes, so it can flip above when short of room.
  /** @type {{ char: string, x: number, y: number, top?: number, actions?: boolean, onenter?: () => void, onleave?: () => void }} */
  let { char, x, y, top, actions = false, onenter, onleave } = $props()
  let height = $state(0)
  const place = $derived(top !== undefined && y + height > innerHeight - 8 ? Math.max(8, top - height - 6) : y)
  const systems = $derived(SYSTEMS.map(system => ({ system, value: (entry?.pronunciations ?? {})[system.key]?.trim() ?? '' })).filter(row => row.value))
  // One spelling can stand in several hand classes; each is listed once, the commonest first.
  const tibetan = $derived([...new Map((ix.tibetanHands[char]?.tibetan ?? []).toSorted((a, b) => b[2] - a[2]).toReversed().map(spelled => [spelled[3], spelled])).values()].reverse().slice(0, 3))
  const downes = $derived(ix.downes.get(char))
  const entry = $derived(ix.byChar.get(char))
  const rhyme = $derived(ix.rhymes.get(char))
  const reading = $derived((entry?.pronunciations ?? {})[ui.reading]?.trim() ?? '')
  const pos = $derived(partsOfSpeech(entry?.definitions?.zh))
  const spelling = $derived(rhyme ? [rhyme[3] ?? rhyme[5], rhyme[4] ?? rhyme[6]].filter(Boolean).join('') : '')
  const codes = $derived(ix.codes.get(char) ?? [])
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<aside class="peek ui-popover" class:actions style:left="{Math.max(8, Math.min(x, innerWidth - 320))}px" style:top="{place}px" aria-hidden={actions ? undefined : 'true'}
  bind:clientHeight={height} onmouseenter={onenter} onmouseleave={onleave}>
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
    {#if actions}
      {#if downes && downes !== gloss(char)}<dt>Downes</dt><dd>{downes}</dd>{/if}
      {#if tibetan.length}<dt>{t('card.tibetanHands')}</dt><dd class="bo" lang="bo">{#each tibetan as spelled, i (i)}{i ? ' · ' : ''}<span title={spelled[4]}>{spelled[3]}</span>{/each}</dd>{/if}
      {#each systems as { system, value } (system.key)}<dt title={systemTitle(system)}>{systemName(system, i18n.locale)}</dt><dd class="say-row">{value}</dd>{/each}
    {/if}
  </dl>
  {#if actions}
    <p class="do">
      <button type="button" class="ui-button" data-size="sm" onclick={() => choose(char)}><Icon name="link" size={14}/>{t('read.openChar')}</button>
      <button type="button" class="ui-button" data-size="sm" onclick={() => copy(char)}><Icon name="copy" size={14}/>{t('common.copy')}</button>
    </p>
  {/if}
</aside>

<style>
  .peek{position:fixed;z-index:var(--ui-z-hint);inline-size:300px;padding:var(--ui-space-md) var(--ui-space-lg);pointer-events:none;font-size:var(--ui-text-sm)}
  .peek.actions{pointer-events:auto;max-block-size:calc(100dvh - 16px);overflow:auto}
  .do{display:flex;gap:var(--ui-space-xs);margin:var(--ui-space-sm) 0 0}
  .say-row{font-family:var(--ui-font-serif)}
  .bo{font-family:'Noto Serif Tibetan','Noto Sans Tibetan',Kailasa,'Microsoft Himalaya','Jomolhari',serif;font-size:var(--ui-text-sm)}
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

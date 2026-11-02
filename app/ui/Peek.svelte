<script>
  // A character's record on hover: the sound it is read with, what it means, and the few fields a
  // reader needs to tell it from a neighbour. Everything here is already in the index, so the panel
  // costs nothing to open.
  import { ix, gloss } from '../lib/db.svelte.js'
  import { ui } from '../lib/ui.svelte.js'
  import { partsOfSpeech } from '../lib/pos.js'
  import { systemTitle } from '../lib/reading.js'
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

<aside class="peek" style:left="{Math.min(x, innerWidth - 320)}px" style:top="{y}px" aria-hidden="true">
  <header>
    <span class="tg glyph">{char}</span>
    <span class="head">
      {#if reading}<span class="say">{reading}</span>{/if}
      <span class="muted mono">U+{(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}</span>
    </span>
  </header>
  <p class="gloss">{gloss(char)}</p>
  {#if entry?.definitions?.zh?.length}<p class="zh" lang="zh-Hant">{entry.definitions.zh.slice(0, 2).join('；')}</p>{/if}
  {#if pos.length}<p class="pos">{#each pos as key (key)}<span>{t(`pos.${key}`)}</span>{/each}</p>{/if}
  <dl>
    {#if rhyme?.[0]}<dt>{t('card.rhyme')}</dt><dd>{rhyme[0]}{#if rhyme[1]} · {t(`card.tone.${rhyme[1] === 1 ? 'level' : rhyme[1] === 2 ? 'rising' : 'entering'}`)}{/if}</dd>{/if}
    {#if spelling}<dt>{t('card.fanqie')}</dt><dd class="tg">{spelling}</dd>{/if}
    {#if codes.length}<dt>{t('nav.cangjie')}</dt><dd class="mono">{codes.join(' ')}</dd>{/if}
  </dl>
</aside>

<style>
  .peek{position:fixed;z-index:80;width:300px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:12px;background:var(--surface);box-shadow:var(--lift);pointer-events:none;font-size:13px}
  header{display:flex;align-items:center;gap:10px}
  .glyph{font-family:var(--tangut);font-size:34px;line-height:1}
  .head{display:grid;gap:1px}
  .say{font-family:var(--serif);font-size:15px}
  .mono{font-family:var(--mono);font-size:11px}
  .gloss{margin:6px 0 0;color:var(--ink)}
  .zh{margin:2px 0 0;color:var(--ink-2);font-size:12.5px}
  .pos{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 0}
  .pos span{padding:1px 6px;border-radius:999px;background:var(--sunk);color:var(--muted);font-size:11px}
  dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:8px 0 0;padding-top:8px;border-top:1px solid var(--line)}
  dt{color:var(--muted);font-size:11.5px}
  dd{margin:0;font-size:12.5px}
</style>
